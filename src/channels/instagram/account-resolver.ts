/**
 * Auto-resolver for Instagram Business Account IDs from Meta tokens and assets.
 * Self-heals when a user connects via a System User ID, App ID, or Facebook Page.
 */

import { env } from "@/config/env";
import { supabaseAdmin } from "@/lib/supabase";

interface InstagramAccountEntry {
  id: string;
}

interface AssignedAccountsResponse {
  data?: InstagramAccountEntry[];
}

interface PageAccountEntry {
  id: string;
  instagram_business_account?: { id: string; username?: string };
}

interface PagesResponse {
  data?: PageAccountEntry[];
}

interface DebugTokenResponse {
  data?: {
    user_id?: string;
    app_id?: string;
    is_valid?: boolean;
  };
}

export async function resolveInstagramAccountId(
  token: string,
  providedId: string,
  dbAccountId?: string,
): Promise<string | null> {
  const version = env.META_GRAPH_API_VERSION;

  // 1. Try assigned_instagram_accounts on the provided ID (if System User)
  try {
    const url = `https://graph.facebook.com/${version}/${providedId}/assigned_instagram_accounts?access_token=${token}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = (await res.json()) as AssignedAccountsResponse;
      const foundId = json.data?.[0]?.id;
      if (foundId) {
        await persistResolvedId(dbAccountId, foundId);
        return foundId;
      }
    }
  } catch {
    // Non-blocking fallback
  }

  // 2. Try Facebook Pages associated with the token (/me/accounts)
  try {
    const url = `https://graph.facebook.com/${version}/me/accounts?fields=id,name,instagram_business_account&access_token=${token}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = (await res.json()) as PagesResponse;
      for (const page of json.data ?? []) {
        if (page.instagram_business_account?.id) {
          const foundId = page.instagram_business_account.id;
          await persistResolvedId(dbAccountId, foundId);
          return foundId;
        }
      }
    }
  } catch {
    // Non-blocking fallback
  }

  // 3. Inspect debug_token with App Token to discover system user ID
  try {
    const appToken = `${env.INSTAGRAM_APP_ID}|${env.INSTAGRAM_APP_SECRET}`;
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appToken}`;
    const debugRes = await fetch(debugUrl);
    if (debugRes.ok) {
      const debugJson = (await debugRes.json()) as DebugTokenResponse;
      const userId = debugJson.data?.user_id;
      if (userId && userId !== providedId) {
        const assignedUrl = `https://graph.facebook.com/${version}/${userId}/assigned_instagram_accounts?access_token=${token}`;
        const assignedRes = await fetch(assignedUrl);
        if (assignedRes.ok) {
          const assignedJson = (await assignedRes.json()) as AssignedAccountsResponse;
          const foundId = assignedJson.data?.[0]?.id;
          if (foundId) {
            await persistResolvedId(dbAccountId, foundId);
            return foundId;
          }
        }
      }
    }
  } catch {
    // Non-blocking fallback
  }

  return null;
}

async function persistResolvedId(dbAccountId: string | undefined, resolvedId: string) {
  if (!dbAccountId) return;
  try {
    await supabaseAdmin
      .from("social_accounts")
      .update({ account_id: resolvedId, status: "connected", updated_at: new Date().toISOString() })
      .eq("id", dbAccountId);
  } catch {
    // Non-blocking
  }
}
