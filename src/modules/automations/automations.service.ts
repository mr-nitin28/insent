/**
 * Automations service with 30-second in-memory rule caching,
 * rule creation collision guards, and account pause triggers.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { validateRuleOverlap, type AutomationRule } from "@/core/rules";
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

  async createRule(candidate: Omit<AutomationRule, "id" | "version">): Promise<AutomationRule> {
    const existingRules = await this.getActiveRulesForAccount(candidate.accountId);
    const candidateRule: AutomationRule = {
      ...candidate,
      id: "candidate",
      version: 1,
    };

    // Rejects overlapping rules with identical keywords and scopes
    validateRuleOverlap(candidateRule, existingRules);

    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .insert({
        workspace_id: candidate.workspaceId,
        account_id: candidate.accountId,
        name: candidate.name,
        priority: candidate.priority,
        match_mode: candidate.matchMode,
        keywords: candidate.keywords,
        post_scope: candidate.postScope,
        destination_ref: candidate.destinationRef,
        message_template: candidate.messageTemplate,
        public_reply_template: candidate.publicReplyTemplate ?? null,
        status: candidate.status,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create automation rule: ${error.message}`);
    }

    this.clearAccountCache(candidate.accountId);

    const row = data as AutomationRuleRow;
    return {
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
    };
  },

  async pauseRulesForAccount(accountId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("automation_rules")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("account_id", accountId);

    if (error) {
      throw new Error(`Failed to pause rules for account: ${error.message}`);
    }

    this.clearAccountCache(accountId);
  },

  clearAccountCache(accountId: string): void {
    ruleCache.delete(accountId);
  },
};
