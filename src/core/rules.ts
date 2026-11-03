/**
 * Pure core rule evaluation and collision prevention.
 */

import { matchKeyword, normalizeText, type MatchMode } from "./matching";
import { RuleOverlapError } from "./errors";

export type ScopeType = "specific" | "all" | "next_post" | "story";

export interface MediaSnapshotItem {
  readonly id: string;
  readonly caption?: string;
  readonly permalink?: string;
  readonly mediaUrl?: string;
  readonly thumbnailUrl?: string;
  readonly mediaProductType?: "FEED" | "REELS" | "STORY";
  readonly timestamp?: string;
}

export interface AutomationRule {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly name: string;
  readonly priority: number;
  readonly matchMode: MatchMode;
  readonly keywords: readonly string[];
  readonly scopeType?: ScopeType;
  readonly targetMediaIds?: readonly string[];
  readonly targetMediaSnapshot?: readonly MediaSnapshotItem[];
  readonly postScope: string | null; // null represents all posts (maintained for backward-compatibility)
  readonly destinationRef: string;
  readonly messageTemplate: string;
  readonly publicReplyTemplate?: string | null;
  readonly status: "active" | "paused";
  readonly version: number;
  readonly createdAt?: string;
}

export interface MatchedRuleResult {
  readonly rule: AutomationRule;
  readonly matchedKeyword: string;
  readonly matchPosition: number;
}

const MATCH_MODE_STRICTNESS: Record<MatchMode, number> = {
  exact: 1,
  whole_word: 2,
  contains: 3,
};

type ScopeInput =
  | string
  | null
  | {
      readonly scopeType?: ScopeType;
      readonly targetMediaIds?: readonly string[];
      readonly postScope?: string | null;
    };

function extractScope(input: ScopeInput): { type: ScopeType; ids: string[] } {
  if (typeof input !== "object" || input === null) {
    return {
      type: input === null ? "all" : "specific",
      ids: input ? [input] : [],
    };
  }

  const specificIds: string[] = [];
  if (input.targetMediaIds && input.targetMediaIds.length > 0) {
    specificIds.push(...input.targetMediaIds);
  } else if (input.postScope) {
    specificIds.push(input.postScope);
  }

  const hasSpecificIds = specificIds.length > 0;
  let type: ScopeType = input.scopeType ?? (hasSpecificIds ? "specific" : "all");

  if (hasSpecificIds && (!input.scopeType || input.scopeType === "all")) {
    type = "specific";
  }

  return { type, ids: specificIds };
}

/**
 * Checks whether two post scopes overlap.
 * Backward compatible with raw string | null parameters.
 */
export function doScopesOverlap(scopeA: ScopeInput, scopeB: ScopeInput): boolean {
  const normA = extractScope(scopeA);
  const normB = extractScope(scopeB);

  // If either scope is global 'all', they overlap with any specific post or global
  if (normA.type === "all" || normB.type === "all") return true;

  // If different scope types (e.g. story vs specific post), they do not overlap
  if (normA.type !== normB.type) return false;

  // If both are specific, they overlap only if target media IDs intersect
  if (normA.ids.length === 0 || normB.ids.length === 0) return true;
  return normA.ids.some((id) => normB.ids.includes(id));
}

/**
 * Validates that a new or updated rule does not duplicate any keyword with overlapping post scope.
 * Throws RuleOverlapError on collision.
 */
export function validateRuleOverlap(
  candidate: AutomationRule,
  existingRules: readonly AutomationRule[],
): void {
  for (const existing of existingRules) {
    if (existing.id === candidate.id) continue;
    if (existing.accountId !== candidate.accountId) continue;
    if (!doScopesOverlap(candidate, existing)) continue;

    for (const candKw of candidate.keywords) {
      const normCand = normalizeText(candKw);
      for (const existKw of existing.keywords) {
        if (normCand === normalizeText(existKw)) {
          throw new RuleOverlapError(
            candKw,
            candidate.postScope ?? candidate.targetMediaIds?.[0] ?? null,
          );
        }
      }
    }
  }
}

/**
 * Determines whether a rule applies to a specific postId.
 */
export function isRuleApplicableToPost(rule: AutomationRule, postId: string): boolean {
  if (rule.status !== "active") return false;

  const { type, ids } = extractScope(rule);

  if (type === "all") return true;
  if (type === "next_post") return true; // Matches candidate next post
  if (type === "specific" || type === "story") {
    return ids.length === 0 ? true : ids.includes(postId);
  }
  return false;
}

/**
 * Selects exactly one winning rule for a comment:
 * 0. Specific post rule beats global/all rule
 * 1. Lowest priority number first
 * 2. Stricter match mode first (exact > whole_word > contains)
 * 3. Earliest keyword position in the comment text
 */
export function chooseRule(
  commentText: string,
  postId: string,
  rules: readonly AutomationRule[],
): MatchedRuleResult | null {
  const applicableRules = rules.filter((r) => isRuleApplicableToPost(r, postId));

  const candidates: MatchedRuleResult[] = [];

  for (const rule of applicableRules) {
    for (const keyword of rule.keywords) {
      const result = matchKeyword(commentText, keyword, rule.matchMode);
      if (result.matched) {
        candidates.push({
          rule,
          matchedKeyword: keyword,
          matchPosition: result.position,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    // 0. Specific post scope beats global wildcard scope
    const normA = extractScope(a.rule);
    const normB = extractScope(b.rule);
    const isSpecificA = normA.type === "specific" && normA.ids.includes(postId);
    const isSpecificB = normB.type === "specific" && normB.ids.includes(postId);

    if (isSpecificA !== isSpecificB) {
      return isSpecificA ? -1 : 1; // Specific post rule strictly wins over global rule
    }

    // 1. Lowest priority number first
    if (a.rule.priority !== b.rule.priority) {
      return a.rule.priority - b.rule.priority;
    }

    // 2. Stricter match mode first
    const strictA = MATCH_MODE_STRICTNESS[a.rule.matchMode];
    const strictB = MATCH_MODE_STRICTNESS[b.rule.matchMode];
    if (strictA !== strictB) {
      return strictA - strictB;
    }

    // 3. Earliest keyword position in the comment
    if (a.matchPosition !== b.matchPosition) {
      return a.matchPosition - b.matchPosition;
    }

    // Deterministic fallback by rule ID
    return a.rule.id.localeCompare(b.rule.id);
  });

  return candidates[0] ?? null;
}
