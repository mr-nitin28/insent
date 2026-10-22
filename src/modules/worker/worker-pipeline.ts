/**
 * Queue Worker Pipeline.
 * Reaps stuck runs, claims batches with SKIP LOCKED, verifies eligibility,
 * checks hourly throttling, creates tracked links, dispatches DMs, and classifies results.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { businessConfig } from "@/config/business.config";
import { runsService, type AutomationRunRow } from "@/modules/runs/runs.service";
import { accountsService } from "@/modules/accounts/accounts.service";
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
    // 1. Reap stuck 'sending' runs into 'unknown_delivery' (halt double DM storms)
    await runsService.reapStuckRuns(300);

    // 2. Claim batch atomically using FOR UPDATE SKIP LOCKED
    const runs = await runsService.claimBatch(
      batchSize,
      businessConfig.limits.maxCommentAgeSeconds,
    );

    let sent = 0;
    let delayed = 0;
    let skipped = 0;
    let failed = 0;
    let unknown = 0;

    for (const run of runs) {
      const outcome = await this.processRun(run);
      if (outcome === "sent") sent++;
      else if (outcome === "delayed") delayed++;
      else if (outcome === "skipped") skipped++;
      else if (outcome === "failed") failed++;
      else if (outcome === "unknown") unknown++;
    }

    return {
      claimed: runs.length,
      sent,
      delayed,
      skipped,
      failed,
      unknown,
    };
  },

  async processRun(
    run: AutomationRunRow,
  ): Promise<"sent" | "delayed" | "skipped" | "failed" | "unknown"> {
    // A. Eligibility: Workspace Kill Switch
    const { data: appSettings } = await supabaseAdmin
      .from("app_settings")
      .select("kill_switch_active")
      .eq("workspace_id", run.workspace_id)
      .maybeSingle();

    if (appSettings?.kill_switch_active) {
      await runsService.markRunOutcome(run.id, "skipped", run.attempts, {
        reason: "Workspace emergency kill switch is active",
      });
      return "skipped";
    }

    // B. Eligibility: 6.5-Day Reply Window
    const ageSeconds = (Date.now() - new Date(run.created_at).getTime()) / 1000;
    if (ageSeconds > businessConfig.limits.maxCommentAgeSeconds) {
      await runsService.markRunOutcome(run.id, "skipped", run.attempts, {
        reason: "Comment age exceeds Meta 6.5-day private reply window",
      });
      return "skipped";
    }

    // C. Account Credentials & Status
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
      // Delay run by scheduling next run_at timestamp; return to pending
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

    // F. Destination & Tracked Link Generation
    const { slug } = await linksService.createTrackedLink(run.workspace_id, rule.id, {
      providerId: "anozik",
      value: rule.destination_ref,
    });
    const trackedUrl = `${businessConfig.brand.domain.startsWith("http") ? "" : "https://"}${businessConfig.brand.domain}/r/${slug}`;

    // G. Message Template Rendering
    const renderedText = renderTemplate(
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

    // H. Dispatch via Channel Adapter
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

    const result = await adapter.send(credentials, event, renderedText);

    // I. Classify Result
    if (result.type === "sent") {
      await runsService.markRunOutcome(run.id, "sent", run.attempts + 1, {
        messageId: result.messageId,
      });

      // Optional Public Reply (Failure never affects DM status)
      if (businessConfig.features.enablePublicReplies && adapter.replyPublicly) {
        const publicText =
          rule.public_reply_template || businessConfig.templates.defaultPublicReply;
        try {
          await adapter.replyPublicly(credentials, event, publicText);
        } catch (pubErr) {
          console.warn("Public comment reply warning:", pubErr);
        }
      }

      return "sent";
    }

    if (result.type === "retry") {
      const retryPlan = calculateRetryPlan(run.attempts + 1, businessConfig.limits.maxSendAttempts);

      if (retryPlan.shouldRetry && retryPlan.delaySeconds) {
        const nextRunAt = new Date(Date.now() + retryPlan.delaySeconds * 1000);
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
      if (result.requiresReauth) {
        await accountsService.updateAccountStatus(credentials.id, "needs_reauth");
      }
      await runsService.markRunOutcome(run.id, "failed", run.attempts + 1, {
        reason: result.reason,
      });
      return "failed";
    }

    // result.type === "unknown" -> Worker crash, timeout, or Meta Code 1
    // NEVER auto-retry!
    await runsService.markRunOutcome(run.id, "unknown_delivery", run.attempts + 1, {
      reason: result.reason,
    });
    return "unknown";
  },
};
