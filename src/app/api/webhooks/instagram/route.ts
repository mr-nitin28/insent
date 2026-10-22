/**
 * Instagram Webhook Ingest Endpoint.
 * Validates HMAC-SHA256 signature, filters loop guards, matches rules in memory,
 * enqueues runs idempotently, returns 200, and kicks the worker.
 */

import { after } from "next/server";
import { env } from "@/config/env";
import { businessConfig } from "@/config/business.config";
import { instagramAdapter } from "@/channels/instagram/adapter";
import { accountsService } from "@/modules/accounts/accounts.service";
import { automationsService } from "@/modules/automations/automations.service";
import { runsService } from "@/modules/runs/runs.service";
import { chooseRule } from "@/core/rules";
import { workerPipeline } from "@/modules/worker/worker-pipeline";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  let parsedPayload: unknown;

  try {
    parsedPayload = await instagramAdapter.verifyAndParse(req);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("signature")) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Malformed payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const events = instagramAdapter.normalize(parsedPayload);
  let enqueuedCount = 0;

  try {
    for (const event of events) {
      // 1. Locate registered account
      const account = await accountsService.findByPlatformId("instagram", event.accountId);
      if (!account) continue;

      // 2. Loop Guard: Ignore account's own comments
      if (event.commenterId === event.accountId) continue;

      // 3. Loop Guard: Ignore comment replies (V1 responds to top-level comments only)
      if (event.parentId) continue;

      // 4. Check comment age eligibility (max 6.5 days)
      const ageSeconds = (Date.now() - event.timestamp.getTime()) / 1000;
      if (ageSeconds > businessConfig.limits.maxCommentAgeSeconds) {
        continue;
      }

      // 5. Match rules in memory (30-second cached)
      const rules = await automationsService.getActiveRulesForAccount(account.id);
      const match = chooseRule(event.commentText, event.postId, rules);
      if (!match) continue;

      // 6. Enqueue run idempotently (unique constraint on account_id + comment_id)
      const inserted = await runsService.enqueueRun({
        workspaceId: account.workspaceId,
        accountId: account.id,
        ruleId: match.rule.id,
        commentId: event.commentId,
        commenterId: event.commenterId,
        commenterUsername: event.commenterUsername,
        commentText: event.commentText,
        postId: event.postId,
      });

      if (inserted) {
        enqueuedCount++;
      }
    }
  } catch (error: unknown) {
    console.error("Database ingestion error during webhook processing:", error);
    // Return 500 only on internal database write failures so Meta retries delivery
    return new Response(JSON.stringify({ error: "Ingestion failure" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 7. Non-blocking worker kick via Next.js after() with safe test fallback
  try {
    after(async () => {
      try {
        await workerPipeline.drainBatch();
      } catch (workerErr) {
        console.error("Background worker kick encountered error:", workerErr);
      }
    });
  } catch {
    // When invoked outside Next.js request context (e.g. unit/integration test)
    // schedule via microtask without throwing
    queueMicrotask(() => {
      void workerPipeline.drainBatch().catch(() => {});
    });
  }

  return new Response(JSON.stringify({ success: true, enqueued: enqueuedCount }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
