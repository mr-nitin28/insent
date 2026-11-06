/**
 * Queue Worker Pipeline.
 * Reaps stuck runs, claims batches with SKIP LOCKED, verifies eligibility,
 * checks hourly throttling, creates tracked links, dispatches DMs, and classifies results.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { env } from "@/config/env";
import { businessConfig } from "@/config/business.config";
import { runsService, type AutomationRunRow } from "@/modules/runs/runs.service";
import { accountsService } from "@/modules/accounts/accounts.service";
import { automationsService } from "@/modules/automations/automations.service";
import { linksService } from "@/modules/links/links.service";
import { channelRegistry } from "@/channels/registry";
import { evaluateThrottle } from "@/core/throttle";
import { renderTemplate } from "@/core/templates";
import { calculateRetryPlan } from "@/core/status-machine";
import type { InboundEvent } from "@/channels/types";

export interface DrainResult {
  readonly claimed: number;
  readonly sent: number;
  readonly delayed: number;
  readonly skipped: number;
  readonly failed: number;
  readonly unknown: number;
}

export const workerPipeline = {
  async drainBatch(batchSize = 10): Promise<DrainResult> {
    await runsService.reapStuckRuns(300);
    const runs = await runsService.claimBatch(
      batchSize,
      businessConfig.limits.maxCommentAgeSeconds,
    );

    let [sent, delayed, skipped, failed, unknown] = [0, 0, 0, 0, 0];

    for (const run of runs) {
      const outcome = await this.processRun(run);
      if (outcome === "sent") sent++;
      else if (outcome === "delayed") delayed++;
      else if (outcome === "skipped") skipped++;
      else if (outcome === "failed") failed++;
      else if (outcome === "unknown") unknown++;
    }

    return { claimed: runs.length, sent, delayed, skipped, failed, unknown };
  },

  async processRun(
    run: AutomationRunRow,
  ): Promise<"sent" | "delayed" | "skipped" | "failed" | "unknown"> {
    // A. Kill Switch
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("kill_switch_active")
      .eq("workspace_id", run.workspace_id)
      .maybeSingle();

    if (settings?.kill_switch_active) {
      await runsService.markRunOutcome(run.id, "skipped", run.attempts, {
        reason: "Workspace emergency kill switch is active",
      });
      return "skipped";
    }

    // B. 6.5-Day Reply Window
    const ageSeconds = (Date.now() - new Date(run.created_at).getTime()) / 1000;
    if (ageSeconds > businessConfig.limits.maxCommentAgeSeconds) {
      await runsService.markRunOutcome(run.id, "skipped", run.attempts, {
        reason: "Comment age exceeds Meta 6.5-day private reply window",
      });
      return "skipped";
    }

    // C. Account Status & Decrypted Credentials
    const { data: accountRow } = await supabaseAdmin
      .from("social_accounts")
      .select("id, platform, account_id, hourly_cap, status")
      .eq("id", run.account_id)
      .maybeSingle();

    if (!accountRow || accountRow.status !== "connected") {
      await runsService.markRunOutcome(run.id, "failed", run.attempts + 1, {
        reason: "Connected social account is unavailable or requires re-authentication",
      });
      return "failed";
    }

    const credentials = await accountsService.findByPlatformId(
      accountRow.platform,
      accountRow.account_id,
    );
    if (!credentials) {
      await runsService.markRunOutcome(run.id, "failed", run.attempts + 1, {
        reason: "Failed to retrieve decrypted social account credentials",
      });
      return "failed";
    }

    // D. Hourly Throttle Cap
    const hourlySends = await accountsService.countSendsInLastHour(credentials.id);
    const throttle = evaluateThrottle(hourlySends, accountRow.hourly_cap);
    if (throttle.action === "delay") {
      await runsService.markRunOutcome(run.id, "pending", run.attempts, {
        reason: throttle.reason,
        nextRunAt: throttle.delayUntil,
      });
      return "delayed";
    }

    // E. Rule Resolution
    const { data: rule } = await supabaseAdmin
      .from("automation_rules")
      .select("id, status, destination_ref, message_template, public_reply_template")
      .eq("id", run.rule_id ?? "")
      .maybeSingle();

    if (!rule || rule.status !== "active") {
      await runsService.markRunOutcome(run.id, "skipped", run.attempts, {
        reason: "Automation rule is missing or inactive",
      });
      return "skipped";
    }

    // F. Tracked Link & Template Rendering
    const isDirectUrl =
      rule.destination_ref.startsWith("http://") || rule.destination_ref.startsWith("https://");
    const providerId = isDirectUrl ? "custom-url" : "anozik";
    const { slug } = await linksService.createTrackedLink(run.workspace_id, rule.id, {
      providerId,
      value: rule.destination_ref,
    });
    const baseUrl =
      env.NODE_ENV === "development"
        ? env.NEXT_PUBLIC_APP_URL
        : businessConfig.brand.domain.startsWith("http")
          ? businessConfig.brand.domain
          : `https://${businessConfig.brand.domain}`;
    const trackedUrl = `${baseUrl.replace(/\/+$/, "")}/r/${slug}`;

    const text = renderTemplate(
      rule.message_template,
      {
        username: run.commenter_username ?? "",
        link: trackedUrl,
        post_id: run.post_id,
        account_username: credentials.username,
      },
      businessConfig.templates.disclosureText,
      businessConfig.limits.maxMessageLength,
    );

    // G. Channel Dispatch
    const adapter = channelRegistry.get(credentials.platform);
    const event: InboundEvent = {
      channelId: credentials.platform,
      accountId: credentials.accountId,
      commentId: run.comment_id,
      commenterId: run.commenter_id ?? "",
      commenterUsername: run.commenter_username ?? "",
      commentText: run.comment_text ?? "",
      postId: run.post_id,
      timestamp: new Date(run.created_at),
    };

    const result = await adapter.send(credentials, event, text);

    // H. Outcome Classification
    if (result.type === "sent") {
      await runsService.markRunOutcome(run.id, "sent", run.attempts + 1, {
        messageId: result.messageId,
      });
      if (businessConfig.features.enablePublicReplies && adapter.replyPublicly) {
        const rawReply = rule.public_reply_template || businessConfig.templates.defaultPublicReply;
        const replyText = renderTemplate(rawReply, {
          username: run.commenter_username ?? "",
          link: trackedUrl,
          post_id: run.post_id,
          account_username: credentials.username,
        });
        adapter.replyPublicly(credentials, event, replyText).catch(() => {});
      }
      return "sent";
    }

    if (result.type === "retry") {
      const plan = calculateRetryPlan(run.attempts + 1, businessConfig.limits.maxSendAttempts);
      if (plan.shouldRetry && plan.delaySeconds) {
        const nextRunAt = new Date(Date.now() + plan.delaySeconds * 1000);
        await runsService.markRunOutcome(run.id, "pending", run.attempts + 1, {
          reason: result.reason,
          nextRunAt,
        });
        return "delayed";
      }
      await runsService.markRunOutcome(run.id, "failed", run.attempts + 1, {
        reason: `Exhausted retries: ${result.reason}`,
      });
      return "failed";
    }

    if (result.type === "failed") {
      if (result.isDuplicate) {
        await runsService.markRunOutcome(run.id, "skipped", run.attempts + 1, {
          reason: result.reason,
        });
        return "skipped";
      }
      if (result.isRestricted) {
        await accountsService.updateAccountStatus(credentials.id, "restricted");
        await automationsService.pauseRulesForAccount(credentials.id);
      } else if (result.requiresReauth) {
        await accountsService.updateAccountStatus(credentials.id, "needs_reauth");
        await automationsService.pauseRulesForAccount(credentials.id);
      }
      await runsService.markRunOutcome(run.id, "failed", run.attempts + 1, {
        reason: result.reason,
      });
      return "failed";
    }

    // result.type === "unknown" -> timeouts / crash. NEVER auto-retry!
    await runsService.markRunOutcome(run.id, "unknown_delivery", run.attempts + 1, {
      reason: result.reason,
    });
    return "unknown";
  },
};
