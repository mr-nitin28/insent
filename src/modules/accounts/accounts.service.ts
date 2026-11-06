/**
 * Accounts service handling credentials encryption, retrieval, and rate counts.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken, encryptToken } from "@/channels/instagram/crypto";
import type { AccountCredentials } from "@/channels/types";

export interface SocialAccountRecord {
  readonly id: string;
  readonly workspace_id: string;
  readonly platform: string;
  readonly account_id: string;
  readonly username: string;
  readonly encrypted_access_token: string;
  readonly token_iv: string;
  readonly token_auth_tag: string;
  readonly status: "connected" | "needs_reauth" | "restricted" | "disconnected";
  readonly hourly_cap: number;
}

export const accountsService = {
  async findById(id: string): Promise<AccountCredentials | null> {
    const { data, error } = await supabaseAdmin
      .from("social_accounts")
      .select(
        "id, workspace_id, platform, account_id, username, encrypted_access_token, token_iv, token_auth_tag, status, hourly_cap",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query social account: ${error.message}`);
    }

    if (!data) return null;

    const record = data as SocialAccountRecord;
    const decryptedAccessToken = decryptToken({
      encryptedData: record.encrypted_access_token,
      iv: record.token_iv,
      authTag: record.token_auth_tag,
    });

    return {
      id: record.id,
      workspaceId: record.workspace_id,
      platform: record.platform,
      accountId: record.account_id,
      username: record.username,
      decryptedAccessToken,
    };
  },

  async findByPlatformId(
    platform: string,
    platformAccountId: string,
  ): Promise<AccountCredentials | null> {
    const { data, error } = await supabaseAdmin
      .from("social_accounts")
      .select(
        "id, workspace_id, platform, account_id, username, encrypted_access_token, token_iv, token_auth_tag, status, hourly_cap",
      )
      .eq("platform", platform)
      .eq("account_id", platformAccountId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query social account: ${error.message}`);
    }

    if (!data) return null;

    const record = data as SocialAccountRecord;
    const decryptedAccessToken = decryptToken({
      encryptedData: record.encrypted_access_token,
      iv: record.token_iv,
      authTag: record.token_auth_tag,
    });

    return {
      id: record.id,
      workspaceId: record.workspace_id,
      platform: record.platform,
      accountId: record.account_id,
      username: record.username,
      decryptedAccessToken,
    };
  },

  async countSendsInLastHour(accountId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count, error } = await supabaseAdmin
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "sent")
      .gte("sent_at", oneHourAgo);

    if (error) {
      throw new Error(`Failed to count sends in last hour: ${error.message}`);
    }

    return count ?? 0;
  },

  async updateAccountStatus(
    accountId: string,
    status: "connected" | "needs_reauth" | "restricted" | "disconnected",
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from("social_accounts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", accountId);

    if (error) {
      throw new Error(`Failed to update account status: ${error.message}`);
    }
  },

  async updateCredentials(
    accountId: string,
    newAccessToken: string,
    expiresIn?: number,
  ): Promise<void> {
    const encrypted = encryptToken(newAccessToken);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const { error } = await supabaseAdmin
      .from("social_accounts")
      .update({
        encrypted_access_token: encrypted.encryptedData,
        token_iv: encrypted.iv,
        token_auth_tag: encrypted.authTag,
        token_expires_at: expiresAt,
        status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (error) {
      throw new Error(`Failed to update credentials: ${error.message}`);
    }
  },
};
