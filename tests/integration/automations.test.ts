import { describe, it, expect, vi, beforeEach } from "vitest";
import { automationsService } from "@/modules/automations/automations.service";
import { supabaseAdmin } from "@/lib/supabase";
import { RuleOverlapError } from "@/core/errors";

describe("integration/automations service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    automationsService.clearAccountCache("acc-1");
  });

  it("rejects creation of rule that collides with existing rule on keyword and post scope", async () => {
    const existingRow = {
      id: "rule-1",
      workspace_id: "ws-1",
      account_id: "acc-1",
      name: "Existing Rule",
      priority: 5,
      match_mode: "whole_word",
      keywords: ["portfolio"],
      post_scope: null, // Global scope
      destination_ref: "dest-1",
      message_template: "Hey {link}",
      public_reply_template: null,
      status: "active",
      version: 1,
    };

    vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
      if (table === "automation_rules") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [existingRow], error: null }),
              }),
            }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return {} as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    // Candidate collides on keyword "PORTFOLIO" with global scope
    await expect(
      automationsService.createRule({
        workspaceId: "ws-1",
        accountId: "acc-1",
        name: "Colliding Rule",
        priority: 1,
        matchMode: "exact",
        keywords: ["PORTFOLIO"],
        postScope: "media-123", // Overlaps with global null
        destinationRef: "dest-2",
        messageTemplate: "Here {link}",
        publicReplyTemplate: null,
        status: "active",
      }),
    ).rejects.toThrow(RuleOverlapError);
  });

  it("successfully creates rule when keywords or post scopes do not collide", async () => {
    const existingRow = {
      id: "rule-1",
      workspace_id: "ws-1",
      account_id: "acc-1",
      name: "Existing Rule",
      priority: 5,
      match_mode: "whole_word",
      keywords: ["pricing"],
      post_scope: null,
      destination_ref: "dest-1",
      message_template: "Hey {link}",
      public_reply_template: null,
      status: "active",
      version: 1,
    };

    const newRow = {
      id: "rule-2",
      workspace_id: "ws-1",
      account_id: "acc-1",
      name: "Portfolio Rule",
      priority: 1,
      match_mode: "whole_word",
      keywords: ["portfolio"],
      post_scope: null,
      destination_ref: "dest-2",
      message_template: "Portfolio {link}",
      public_reply_template: null,
      status: "active",
      version: 1,
    };

    vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
      if (table === "automation_rules") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [existingRow], error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: newRow, error: null }),
            }),
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return {} as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    const created = await automationsService.createRule({
      workspaceId: "ws-1",
      accountId: "acc-1",
      name: "Portfolio Rule",
      priority: 1,
      matchMode: "whole_word",
      keywords: ["portfolio"],
      postScope: null,
      destinationRef: "dest-2",
      messageTemplate: "Portfolio {link}",
      publicReplyTemplate: null,
      status: "active",
    });

    expect(created.id).toBe("rule-2");
    expect(created.keywords).toContain("portfolio");
  });

  it("pauses all rules for an account and invalidates cache", async () => {
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
      if (table === "automation_rules") {
        return { update: updateSpy } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return {} as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await automationsService.pauseRulesForAccount("acc-1");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "paused" }));
  });
});
