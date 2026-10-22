import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "@/app/api/webhooks/instagram/route";
import { accountsService } from "@/modules/accounts/accounts.service";
import { automationsService } from "@/modules/automations/automations.service";
import { runsService } from "@/modules/runs/runs.service";
import { env } from "@/config/env";
import type { AutomationRule } from "@/core/rules";

function createSignedRequest(body: object | string, secret = env.INSTAGRAM_APP_SECRET): Request {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const signature = "sha256=" + createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  return new Request("http://localhost:3000/api/webhooks/instagram", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
    body: raw,
  });
}

const mockCommentPayload = (val: Record<string, unknown>, entryId = "17841400001") => ({
  object: "instagram",
  entry: [{ id: entryId, changes: [{ field: "comments", value: val }] }],
});

describe("integration/webhook", () => {
  const mockRule: AutomationRule = {
    id: "rule-100",
    workspaceId: "ws-1",
    accountId: "acc-1",
    name: "Portfolio Rule",
    priority: 1,
    matchMode: "whole_word",
    keywords: ["portfolio"],
    postScope: null,
    destinationRef: "user/portfolio",
    messageTemplate: "Hi @{username}, here is your link: {link}",
    status: "active",
    version: 1,
  };

  it("rejects webhook requests with invalid signature (HTTP 401)", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-signature-256": "sha256=invalid00000" },
      body: JSON.stringify({ object: "instagram", entry: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects malformed non-JSON payloads (HTTP 400)", async () => {
    const res = await POST(createSignedRequest("MALFORMED_NON_JSON"));
    expect(res.status).toBe(400);
  });

  it("drops own comments via loop guard", async () => {
    const findSpy = vi.spyOn(accountsService, "findByPlatformId").mockResolvedValueOnce({
      id: "acc-1",
      workspaceId: "ws-1",
      platform: "instagram",
      accountId: "17841400001",
      username: "my_business_account",
      decryptedAccessToken: "token_123",
    });
    const enqueueSpy = vi.spyOn(runsService, "enqueueRun");

    const payload = mockCommentPayload({
      id: "comm_own_1",
      text: "portfolio",
      from: { id: "17841400001", username: "my_business_account" },
      media: { id: "post_1" },
    });

    const res = await POST(createSignedRequest(payload));
    expect(res.status).toBe(200);
    expect(enqueueSpy).not.toHaveBeenCalled();

    findSpy.mockRestore();
    enqueueSpy.mockRestore();
  });

  it("drops comment replies via loop guard (V1)", async () => {
    const findSpy = vi.spyOn(accountsService, "findByPlatformId").mockResolvedValueOnce({
      id: "acc-1",
      workspaceId: "ws-1",
      platform: "instagram",
      accountId: "17841400001",
      username: "my_business_account",
      decryptedAccessToken: "token_123",
    });
    const enqueueSpy = vi.spyOn(runsService, "enqueueRun");

    const payload = mockCommentPayload({
      id: "comm_child_1",
      parent_id: "comm_parent_0",
      text: "portfolio",
      from: { id: "user_999", username: "commenter" },
      media: { id: "post_1" },
    });

    const res = await POST(createSignedRequest(payload));
    expect(res.status).toBe(200);
    expect(enqueueSpy).not.toHaveBeenCalled();

    findSpy.mockRestore();
    enqueueSpy.mockRestore();
  });

  it("idempotently handles duplicate webhooks without double-enqueuing", async () => {
    const findSpy = vi.spyOn(accountsService, "findByPlatformId").mockResolvedValue({
      id: "acc-1",
      workspaceId: "ws-1",
      platform: "instagram",
      accountId: "17841400001",
      username: "my_business_account",
      decryptedAccessToken: "token_123",
    });
    const getRulesSpy = vi
      .spyOn(automationsService, "getActiveRulesForAccount")
      .mockResolvedValue([mockRule]);
    const enqueueSpy = vi
      .spyOn(runsService, "enqueueRun")
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const payload = mockCommentPayload({
      id: "comm_dup_1",
      text: "Can I get your portfolio?",
      from: { id: "user_123", username: "fan" },
      media: { id: "post_1" },
    });

    const res1 = await POST(createSignedRequest(payload));
    expect(res1.status).toBe(200);
    expect((await res1.json()).enqueued).toBe(1);

    const res2 = await POST(createSignedRequest(payload));
    expect(res2.status).toBe(200);
    expect((await res2.json()).enqueued).toBe(0);

    findSpy.mockRestore();
    getRulesSpy.mockRestore();
    enqueueSpy.mockRestore();
  });

  it("returns HTTP 500 when database operation fails so Meta retries delivery", async () => {
    const findSpy = vi
      .spyOn(accountsService, "findByPlatformId")
      .mockRejectedValueOnce(new Error("Database connection timeout"));
    const payload = mockCommentPayload({
      id: "comm_err_1",
      text: "portfolio",
      from: { id: "user_123", username: "fan" },
      media: { id: "post_1" },
    });

    const res = await POST(createSignedRequest(payload));
    expect(res.status).toBe(500);
    findSpy.mockRestore();
  });
});
