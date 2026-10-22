import { describe, it, expect, vi, beforeEach } from "vitest";
import { workerPipeline } from "@/modules/worker/worker-pipeline";
import { runsService, type AutomationRunRow } from "@/modules/runs/runs.service";
import { accountsService } from "@/modules/accounts/accounts.service";
import { automationsService } from "@/modules/automations/automations.service";
import { supabaseAdmin } from "@/lib/supabase";
import { instagramAdapter } from "@/channels/instagram/adapter";

describe("integration/worker", () => {
  const mockRun: AutomationRunRow = {
    id: "run-001",
    workspace_id: "ws-001",
    account_id: "acc-001",
    rule_id: "rule-001",
    comment_id: "comm-001",
    commenter_id: "user-123",
    commenter_username: "testuser",
    comment_text: "portfolio please",
    post_id: "media-123",
    status: "sending",
    reason: null,
    attempts: 0,
    run_at: new Date().toISOString(),
    claimed_at: new Date().toISOString(),
    sent_at: null,
    message_id: null,
    created_at: new Date().toISOString(),
  };

  const setupDefaultMocks = () => {
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
                    id: "acc-001",
                    platform: "instagram",
                    account_id: "17841401",
                    hourly_cap: 600,
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
                    id: "rule-001",
                    status: "active",
                    destination_ref: "portfolio",
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
      id: "acc-001",
      workspaceId: "ws-001",
      platform: "instagram",
      accountId: "17841401",
      username: "creator",
      decryptedAccessToken: "token_abc",
    });

    vi.spyOn(accountsService, "countSendsInLastHour").mockResolvedValue(10);
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("skips comments older than 6.5 days with explicit reason", async () => {
    setupDefaultMocks();
    const oldRun: AutomationRunRow = {
      ...mockRun,
      created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    };
    const markSpy = vi.spyOn(runsService, "markRunOutcome").mockResolvedValueOnce();
    const outcome = await workerPipeline.processRun(oldRun);

    expect(outcome).toBe("skipped");
    expect(markSpy).toHaveBeenCalledWith(
      "run-001",
      "skipped",
      0,
      expect.objectContaining({
        reason: expect.stringContaining("6.5-day"),
      }),
    );
  });

  it("delays (does not fail) runs when account is over hourly cap", async () => {
    setupDefaultMocks();
    vi.spyOn(accountsService, "countSendsInLastHour").mockResolvedValueOnce(600);
    const markSpy = vi.spyOn(runsService, "markRunOutcome").mockResolvedValueOnce();

    const outcome = await workerPipeline.processRun(mockRun);
    expect(outcome).toBe("delayed");
    expect(markSpy).toHaveBeenCalledWith(
      "run-001",
      "pending",
      0,
      expect.objectContaining({
        reason: expect.stringContaining("reached hourly cap"),
        nextRunAt: expect.any(Date),
      }),
    );
  });

  it("transitions to unknown_delivery on mid-send timeout and never auto-resends", async () => {
    setupDefaultMocks();
    vi.spyOn(instagramAdapter, "send").mockResolvedValueOnce({
      type: "unknown",
      reason: "Request timed out mid-flight; delivery unconfirmed",
    });
    const markSpy = vi.spyOn(runsService, "markRunOutcome").mockResolvedValueOnce();

    const outcome = await workerPipeline.processRun(mockRun);
    expect(outcome).toBe("unknown");
    expect(markSpy).toHaveBeenCalledWith(
      "run-001",
      "unknown_delivery",
      1,
      expect.objectContaining({
        reason: expect.stringContaining("timed out"),
      }),
    );
  });

  it("retries transient errors with backoff up to max attempts, then fails", async () => {
    setupDefaultMocks();
    vi.spyOn(instagramAdapter, "send").mockResolvedValue({
      type: "retry",
      delaySeconds: 180,
      reason: "Meta rate limit encountered (Code 368)",
    });

    const markSpy = vi.spyOn(runsService, "markRunOutcome").mockResolvedValue();

    // Attempt 1: retryable -> returns delayed (pending with nextRunAt)
    const run1 = { ...mockRun, attempts: 0 };
    const outcome1 = await workerPipeline.processRun(run1);
    expect(outcome1).toBe("delayed");
    expect(markSpy).toHaveBeenLastCalledWith(
      "run-001",
      "pending",
      1,
      expect.objectContaining({
        nextRunAt: expect.any(Date),
      }),
    );

    // Attempt 4 (last attempt): retries exhausted -> failed
    const run4 = { ...mockRun, attempts: 3 };
    const outcome4 = await workerPipeline.processRun(run4);
    expect(outcome4).toBe("failed");
    expect(markSpy).toHaveBeenLastCalledWith(
      "run-001",
      "failed",
      4,
      expect.objectContaining({
        reason: expect.stringContaining("Exhausted retries"),
      }),
    );
  });

  it("marks account needs_reauth and pauses active rules when token is invalid", async () => {
    setupDefaultMocks();
    vi.spyOn(instagramAdapter, "send").mockResolvedValueOnce({
      type: "failed",
      permanent: true,
      requiresReauth: true,
      reason: "Instagram access token expired or revoked (Meta 190)",
    });

    const updateStatusSpy = vi
      .spyOn(accountsService, "updateAccountStatus")
      .mockResolvedValueOnce();
    const pauseRulesSpy = vi
      .spyOn(automationsService, "pauseRulesForAccount")
      .mockResolvedValueOnce();
    const markSpy = vi.spyOn(runsService, "markRunOutcome").mockResolvedValueOnce();

    const outcome = await workerPipeline.processRun(mockRun);
    expect(outcome).toBe("failed");
    expect(updateStatusSpy).toHaveBeenCalledWith("acc-001", "needs_reauth");
    expect(pauseRulesSpy).toHaveBeenCalledWith("acc-001");
    expect(markSpy).toHaveBeenCalledWith("run-001", "failed", 1, expect.any(Object));
  });

  it("marks run skipped when comment has already been replied to on Meta", async () => {
    setupDefaultMocks();
    vi.spyOn(instagramAdapter, "send").mockResolvedValueOnce({
      type: "failed",
      permanent: true,
      isDuplicate: true,
      reason: "Comment has already been replied to on Meta platform",
    });

    const markSpy = vi.spyOn(runsService, "markRunOutcome").mockResolvedValueOnce();
    const outcome = await workerPipeline.processRun(mockRun);

    expect(outcome).toBe("skipped");
    expect(markSpy).toHaveBeenCalledWith(
      "run-001",
      "skipped",
      1,
      expect.objectContaining({
        reason: expect.stringContaining("already been replied"),
      }),
    );
  });
});
