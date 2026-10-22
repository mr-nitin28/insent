/**
 * Accounts API: List connected accounts and connect accounts directly with tokens.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { encryptToken } from "@/channels/instagram/crypto";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { metaClient } from "@/channels/instagram/meta-client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace();
    const { data, error } = await supabaseAdmin
      .from("social_accounts")
      .select(
        "id, platform, account_id, username, name, profile_picture_url, status, hourly_cap, created_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ accounts: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, accessToken, accountId, hourlyCap = 600 } = body;

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json({ error: "Access token is required" }, { status: 400 });
    }

    let finalAccountId = accountId;
    let finalUsername = username;
    let name: string | null = null;
    let profilePic: string | null = null;

    // Attempt to verify and query Instagram Graph API
    try {
      const profile = await metaClient.getMe(accessToken);
      if (profile.id) {
        finalAccountId = profile.id;
        finalUsername = profile.username || username;
        name = profile.name ?? null;
        profilePic = profile.profile_picture_url ?? null;
      }
    } catch {
      // Fallback for offline / simulation tokens
      if (!finalAccountId) {
        finalAccountId = `ig_${Date.now()}`;
      }
      if (!finalUsername) {
        finalUsername = "creator";
      }
    }

    const encrypted = encryptToken(accessToken);
    const workspaceId = await getOrCreateDefaultWorkspace();

    const { data: saved, error } = await supabaseAdmin
      .from("social_accounts")
      .upsert(
        {
          workspace_id: workspaceId,
          platform: "instagram",
          account_id: finalAccountId,
          username: finalUsername.replace(/^@/, ""),
          name,
          profile_picture_url: profilePic,
          encrypted_access_token: encrypted.encryptedData,
          token_iv: encrypted.iv,
          token_auth_tag: encrypted.authTag,
          status: "connected",
          hourly_cap: Number(hourlyCap) || 600,
          webhook_subscribed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "platform,account_id" },
      )
      .select("id, platform, account_id, username, name, profile_picture_url, status, hourly_cap")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, account: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
