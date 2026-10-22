/**
 * Pure core rule evaluation and collision prevention.
 */

import { matchKeyword, normalizeText, type MatchMode } from "./matching";
import { RuleOverlapError } from "./errors";

export interface AutomationRule {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly name: string;
  readonly priority: number;
  readonly matchMode: MatchMode;
  readonly keywords: readonly string[];
  readonly postScope: string | null; // null represents all posts
  readonly destinationRef: string;
  readonly messageTemplate: string;
  readonly publicReplyTemplate?: string | null;
  readonly status: "active" | "paused";
  readonly version: number;
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

/**
 * Checks whether two post scopes overlap.
 * A null scope covers all posts, thus overlapping with any specific post or null.
 */
export function doScopesOverlap(scopeA: string | null, scopeB: string | null): boolean {
  if (scopeA === null || scopeB === null) return true;
  return scopeA === scopeB;
}

/**
 * Validates that a new or updated rule does not duplicate any keyword with overlapping post scope.
 * Throws RuleOverlapError on collision.
 */
export function validateRuleOverlap(
  candidate: AutomationRule,
  existingRules: readonly AutomationRule[]
): void {
  for (const existing of existingRules) {
    if (existing.id === candidate.id) continue;
    if (existing.accountId !== candidate.accountId) continue;
    if (!doScopesOverlap(candidate.postScope, existing.postScope)) continue;

    for (const candKw of candidate.keywords) {
      const normCand = normalizeText(candKw);
      for (const existKw of existing.keywords) {
        if (normCand === normalizeText(existKw)) {
          throw new RuleOverlapError(candKw, candidate.postScope);
        }
      }
    }
  }
}

/**
 * Selects exactly one winning rule for a comment:
 * 1. Lowest priority number first
 * 2. Stricter match mode first (exact > whole_word > contains)
 * 3. Earliest keyword position in the comment text
 */
export function chooseRule(
  commentText: string,
  postId: string,
  rules: readonly AutomationRule[]
): MatchedRuleResult | null {
  const applicableRules = rules.filter(
    (r) => r.status === "active" && (r.postScope === null || r.postScope === postId)
  );

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
