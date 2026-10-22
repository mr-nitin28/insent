/**
 * Test scenario: Burst with 1,000 queued comments.
 * Asserts: None lost, sends paced strictly under the account hourly cap.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateThrottle } from "@/core/throttle";
import { workerPipeline } from "@/modules/worker/worker-pipeline";
import { runsService, type AutomationRunRow } from "@/modules/runs/runs.service";
import { accountsService } from "@/modules/accounts/accounts.service";
import { supabaseAdmin } from "@/lib/supabase";
import { instagramAdapter } from "@/channels/instagram/adapter";

describe("integration/burst 1,000 comments", () => {
  const HOURLY_CAP = 600;
  const TOTAL_BURST_RUNS = 1000;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("paces 1,000 queued comments under hourly cap with zero runs lost", async () => {
    // 1. Core throttle verification across 1,000 sequential items
    let sentCount = 0;
    let delayedCount = 0;

    for (let currentSends = 0; currentSends < TOTAL_BURST_RUNS; currentSends++) {
      const decision = evaluateThrottle(currentSends, HOURLY_CAP);
      if (decision.action === "send_now") {
        sentCount++;
      } else {
        delayedCount++;
      }
    }

    expect(sentCount).toBe(600);
    expect(delayedCount).toBe(400);
    expect(sentCount + delayedCount).toBe(TOTAL_BURST_RUNS);

    // 2. Worker pipeline simulation of processing the burst
    let rollingSends = 595; // Account has already sent 595 messages this hour
    vi.spyOn(accountsService, "countSendsInLastHour").mockImplementation(async () => rollingSends);

    vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
      if (table === "app_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { kill_switch_active: false } }),
            }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "social_accounts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "acc-burst",
                    platform: "instagram",
                    account_id: "17841499",
                    hourly_cap: HOURLY_CAP,
                    status: "connected",
                  },
                }),
            }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "automation_rules") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "rule-burst",
                    status: "active",
                    destination_ref: "link",
                    message_template: "Hey {link}",
                  },
                }),
            }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "tracked_links") {
        return { insert: () => Promise.resolve({ error: null }) } as unknown as ReturnType<
          typeof supabaseAdmin.from
        >;
      }
      return {} as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    vi.spyOn(accountsService, "findByPlatformId").mockResolvedValue({
      id: "acc-burst",
      workspaceId: "ws-burst",
      platform: "instagram",
      accountId: "17841499",
      username: "creator_burst",
      decryptedAccessToken: "token_abc",
    });

    vi.spyOn(instagramAdapter, "send").mockImplementation(async () => {
      rollingSends++;
      return { type: "sent", messageId: `msg_${rollingSends}` };
    });

    const outcomes: string[] = [];
    vi.spyOn(runsService, "markRunOutcome").mockImplementation(async (_id, status) => {
      outcomes.push(status);
    });

    // 10 comments arrive right near the cap threshold (595 / 600)
    for (let i = 0; i < 10; i++) {
      const run: AutomationRunRow = {
        id: `run-burst-${i}`,
        workspace_id: "ws-burst",
        account_id: "acc-burst",
        rule_id: "rule-burst",
        comment_id: `comm-burst-${i}`,
        commenter_id: `user-${i}`,
        commenter_username: `user_${i}`,
        comment_text: "portfolio please",
        post_id: "media-burst",
        status: "sending",
        reason: null,
        attempts: 0,
        run_at: new Date().toISOString(),
        claimed_at: new Date().toISOString(),
        sent_at: null,
        message_id: null,
        created_at: new Date().toISOString(),
      };
      await workerPipeline.processRun(run);
    }

    // Exactly 5 sends should succeed to hit 600, then the next 5 should be delayed
    const sentRuns = outcomes.filter((s) => s === "sent").length;
    const delayedRuns = outcomes.filter((s) => s === "pending").length;

    expect(sentRuns).toBe(5);
    expect(delayedRuns).toBe(5);
    expect(rollingSends).toBe(600); // Strict cap adhered to
    expect(outcomes.length).toBe(10); // None lost
  });
});
