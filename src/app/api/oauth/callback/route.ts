/**
 * Instagram OAuth Callback Endpoint.
 * Exchanges authorization code for long-lived token, encrypts credentials,
 * and saves/updates social_accounts.
 */

import { NextResponse } from "next/server";
import { instagramAdapter } from "@/channels/instagram/adapter";
import { encryptToken } from "@/channels/instagram/crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error_description") || searchParams.get("error");

  if (error || !code) {
    const errorMsg = encodeURIComponent(error || "Authorization code was missing");
    return NextResponse.redirect(new URL(`/?error=${errorMsg}`, req.url));
  }

  try {
    const account = await instagramAdapter.completeConnect(code);
    const encrypted = encryptToken(account.accessToken);
    const workspaceId = await getOrCreateDefaultWorkspace();

    const expiresAt = account.expiresIn
      ? new Date(Date.now() + account.expiresIn * 1000).toISOString()
      : null;

    const { error: upsertErr } = await supabaseAdmin.from("social_accounts").upsert(
      {
        workspace_id: workspaceId,
        platform: account.platform,
        account_id: account.accountId,
        username: account.username,
        name: account.name ?? null,
        profile_picture_url: account.profilePictureUrl ?? null,
        encrypted_access_token: encrypted.encryptedData,
        token_iv: encrypted.iv,
        token_auth_tag: encrypted.authTag,
        token_expires_at: expiresAt,
        status: "connected",
        hourly_cap: 600,
        webhook_subscribed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform,account_id" },
    );

    if (upsertErr) {
      throw new Error(`Database error saving account: ${upsertErr.message}`);
    }

    return NextResponse.redirect(new URL("/?connected=success", req.url));
  } catch (err: unknown) {
    const message = encodeURIComponent(err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(new URL(`/?error=${message}`, req.url));
  }
}
