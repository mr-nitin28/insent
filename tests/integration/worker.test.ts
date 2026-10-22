import { describe, it, expect, vi } from "vitest";
import { workerPipeline } from "@/modules/worker/worker-pipeline";
import { runsService, type AutomationRunRow } from "@/modules/runs/runs.service";
import { accountsService } from "@/modules/accounts/accounts.service";
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

  it("skips comments older than 6.5 days with explicit reason", async () => {
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
      return {} as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    // 7 days old
    const oldRun: AutomationRunRow = {
      ...mockRun,
      created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    };

    const markOutcomeSpy = vi.spyOn(runsService, "markRunOutcome").mockResolvedValueOnce();

    const outcome = await workerPipeline.processRun(oldRun);
    expect(outcome).toBe("skipped");
    expect(markOutcomeSpy).toHaveBeenCalledWith(
      "run-001",
      "skipped",
      0,
      expect.objectContaining({
        reason: expect.stringContaining("6.5-day"),
      }),
    );

    markOutcomeSpy.mockRestore();
  });

  it("delays (does not fail) runs when account is over hourly cap", async () => {
    // Mock settings
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
      return {} as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    vi.spyOn(accountsService, "findByPlatformId").mockResolvedValueOnce({
      id: "acc-001",
      workspaceId: "ws-001",
      platform: "instagram",
      accountId: "17841401",
      username: "creator",
      decryptedAccessToken: "token_abc",
    });

    // Already sent 600 this hour (at cap!)
    vi.spyOn(accountsService, "countSendsInLastHour").mockResolvedValueOnce(600);

    const markOutcomeSpy = vi.spyOn(runsService, "markRunOutcome").mockResolvedValueOnce();

    const outcome = await workerPipeline.processRun(mockRun);
    expect(outcome).toBe("delayed");
    expect(markOutcomeSpy).toHaveBeenCalledWith(
      "run-001",
      "pending",
      0,
      expect.objectContaining({
        reason: expect.stringContaining("reached hourly cap"),
        nextRunAt: expect.any(Date),
      }),
    );

    vi.restoreAllMocks();
  });

  it("transitions to unknown_delivery on mid-send timeout and never auto-resends", async () => {
    // Mock settings and account
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
                    destination_ref: "user/portfolio",
                    message_template: "Hey @{username}! {link}",
                  },
                }),
            }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "tracked_links") {
        return {
          insert: () => Promise.resolve({ error: null }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return {} as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    vi.spyOn(accountsService, "findByPlatformId").mockResolvedValueOnce({
      id: "acc-001",
      workspaceId: "ws-001",
      platform: "instagram",
      accountId: "17841401",
      username: "creator",
      decryptedAccessToken: "token_abc",
    });

    vi.spyOn(accountsService, "countSendsInLastHour").mockResolvedValueOnce(10);

    // Instagram adapter returns 'unknown' (e.g. timeout / Meta code 1)
    vi.spyOn(instagramAdapter, "send").mockResolvedValueOnce({
      type: "unknown",
      reason: "Request timed out mid-flight; delivery unconfirmed",
    });

    const markOutcomeSpy = vi.spyOn(runsService, "markRunOutcome").mockResolvedValueOnce();

    const outcome = await workerPipeline.processRun(mockRun);
    expect(outcome).toBe("unknown");
    expect(markOutcomeSpy).toHaveBeenCalledWith(
      "run-001",
      "unknown_delivery",
      1,
      expect.objectContaining({
        reason: expect.stringContaining("timed out"),
      }),
    );

    vi.restoreAllMocks();
  });
});
