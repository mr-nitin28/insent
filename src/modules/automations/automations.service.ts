/**
 * Automations service with 30-second in-memory rule caching,
 * rule creation collision guards, and graceful schema backward-compatibility.
 */

import { supabaseAdmin } from "@/lib/supabase";
import {
  validateRuleOverlap,
  type AutomationRule,
  type ScopeType,
  type MediaSnapshotItem,
} from "@/core/rules";
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
  scope_type?: string;
  target_media_ids?: string[];
  target_media_snapshot?: MediaSnapshotItem[];
  post_scope: string | null;
  destination_ref: string;
  message_template: string;
  public_reply_template: string | null;
  status: string;
  version: number;
}

const BASE_COLUMNS =
  "id, workspace_id, account_id, name, priority, match_mode, keywords, post_scope, destination_ref, message_template, public_reply_template, status, version";
const EXTENDED_COLUMNS = `${BASE_COLUMNS}, scope_type, target_media_ids, target_media_snapshot`;

function isMissingColumnError(err: { message: string; code?: string }): boolean {
  return (
    err.message.includes("does not exist") ||
    err.message.includes("schema cache") ||
    err.message.includes("Could not find") ||
    err.code === "42703" ||
    err.code === "PGRST204"
  );
}

export const automationsService = {
  async getActiveRulesForAccount(accountId: string): Promise<AutomationRule[]> {
    const cached = ruleCache.get(accountId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rules;
    }

    let rows: AutomationRuleRow[] = [];
    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .select(EXTENDED_COLUMNS)
      .eq("account_id", accountId)
      .eq("status", "active")
      .order("priority", { ascending: true });

    if (error) {
      if (isMissingColumnError(error)) {
        const fb = await supabaseAdmin
          .from("automation_rules")
          .select(BASE_COLUMNS)
          .eq("account_id", accountId)
          .eq("status", "active")
          .order("priority", { ascending: true });
        if (fb.error) throw new Error(`Failed to load automation rules: ${fb.error.message}`);
        rows = (fb.data as AutomationRuleRow[]) ?? [];
      } else {
        throw new Error(`Failed to load automation rules: ${error.message}`);
      }
    } else {
      rows = (data as AutomationRuleRow[]) ?? [];
    }

    const rules: AutomationRule[] = rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      accountId: row.account_id,
      name: row.name,
      priority: row.priority,
      matchMode: row.match_mode as MatchMode,
      keywords: row.keywords,
      scopeType: (row.scope_type as ScopeType) ?? (row.post_scope ? "specific" : "all"),
      targetMediaIds: row.target_media_ids ?? (row.post_scope ? [row.post_scope] : []),
      targetMediaSnapshot: row.target_media_snapshot ?? [],
      postScope: row.post_scope,
      destinationRef: row.destination_ref,
      messageTemplate: row.message_template,
      publicReplyTemplate: row.public_reply_template,
      status: row.status as "active" | "paused",
      version: row.version,
    }));

    ruleCache.set(accountId, { rules, expiresAt: Date.now() + CACHE_TTL_MS });
    return rules;
  },

  async createRule(candidate: Omit<AutomationRule, "id" | "version">): Promise<AutomationRule> {
    const existingRules = await this.getActiveRulesForAccount(candidate.accountId);
    const candidateRule: AutomationRule = { ...candidate, id: "candidate", version: 1 };

    validateRuleOverlap(candidateRule, existingRules);

    const postScope = candidate.postScope ?? candidate.targetMediaIds?.[0] ?? null;
    const scopeType =
      candidate.scopeType ??
      (candidate.targetMediaIds?.length ? "specific" : postScope ? "specific" : "all");

    let row: AutomationRuleRow;
    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .insert({
        workspace_id: candidate.workspaceId,
        account_id: candidate.accountId,
        name: candidate.name,
        priority: candidate.priority,
        match_mode: candidate.matchMode,
        keywords: candidate.keywords,
        scope_type: scopeType,
        target_media_ids: candidate.targetMediaIds ?? (postScope ? [postScope] : []),
        target_media_snapshot: candidate.targetMediaSnapshot ?? [],
        post_scope: postScope,
        destination_ref: candidate.destinationRef,
        message_template: candidate.messageTemplate,
        public_reply_template: candidate.publicReplyTemplate ?? null,
        status: candidate.status,
      })
      .select()
      .single();

    if (error) {
      if (isMissingColumnError(error)) {
        const fb = await supabaseAdmin
          .from("automation_rules")
          .insert({
            workspace_id: candidate.workspaceId,
            account_id: candidate.accountId,
            name: candidate.name,
            priority: candidate.priority,
            match_mode: candidate.matchMode,
            keywords: candidate.keywords,
            post_scope: postScope,
            destination_ref: candidate.destinationRef,
            message_template: candidate.messageTemplate,
            public_reply_template: candidate.publicReplyTemplate ?? null,
            status: candidate.status,
          })
          .select()
          .single();
        if (fb.error) throw new Error(`Failed to create automation rule: ${fb.error.message}`);
        row = fb.data as AutomationRuleRow;
      } else {
        throw new Error(`Failed to create automation rule: ${error.message}`);
      }
    } else {
      row = data as AutomationRuleRow;
    }

    this.clearAccountCache(candidate.accountId);

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      accountId: row.account_id,
      name: row.name,
      priority: row.priority,
      matchMode: row.match_mode as MatchMode,
      keywords: row.keywords,
      scopeType: (row.scope_type as ScopeType) ?? scopeType,
      targetMediaIds: row.target_media_ids ?? (row.post_scope ? [row.post_scope] : []),
      targetMediaSnapshot: row.target_media_snapshot ?? [],
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

    if (error) throw new Error(`Failed to pause rules for account: ${error.message}`);
    this.clearAccountCache(accountId);
  },

  clearAccountCache(accountId: string): void {
    ruleCache.delete(accountId);
  },
};
