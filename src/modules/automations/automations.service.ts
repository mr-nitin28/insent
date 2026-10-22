/**
 * Automations service with 30-second in-memory rule caching.
 */

import { supabaseAdmin } from "@/lib/supabase";
import type { AutomationRule } from "@/core/rules";
import type { MatchMode } from "@/core/matching";

interface CacheEntry {
  readonly rules: AutomationRule[];
  readonly expiresAt: number;
}

const ruleCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

interface AutomationRuleRow {
  id: string;
  workspace_id: string;
  account_id: string;
  name: string;
  priority: number;
  match_mode: string;
  keywords: string[];
  post_scope: string | null;
  destination_ref: string;
  message_template: string;
  public_reply_template: string | null;
  status: string;
  version: number;
}

export const automationsService = {
  async getActiveRulesForAccount(accountId: string): Promise<AutomationRule[]> {
    const cached = ruleCache.get(accountId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rules;
    }

    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .select(
        "id, workspace_id, account_id, name, priority, match_mode, keywords, post_scope, destination_ref, message_template, public_reply_template, status, version",
      )
      .eq("account_id", accountId)
      .eq("status", "active")
      .order("priority", { ascending: true });

    if (error) {
      throw new Error(`Failed to load automation rules: ${error.message}`);
    }

    const rules: AutomationRule[] = (data as AutomationRuleRow[]).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      accountId: row.account_id,
      name: row.name,
      priority: row.priority,
      matchMode: row.match_mode as MatchMode,
      keywords: row.keywords,
      postScope: row.post_scope,
      destinationRef: row.destination_ref,
      messageTemplate: row.message_template,
      publicReplyTemplate: row.public_reply_template,
      status: row.status as "active" | "paused",
      version: row.version,
    }));

    ruleCache.set(accountId, {
      rules,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return rules;
  },

  clearAccountCache(accountId: string): void {
    ruleCache.delete(accountId);
  },
};
