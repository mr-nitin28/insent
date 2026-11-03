import { describe, it, expect } from "vitest";
import {
  chooseRule,
  validateRuleOverlap,
  doScopesOverlap,
  type AutomationRule,
} from "@/core/rules";
import { RuleOverlapError } from "@/core/errors";

describe("core/rules", () => {
  const baseRule: AutomationRule = {
    id: "rule-1",
    workspaceId: "ws-1",
    accountId: "acc-1",
    name: "Rule 1",
    priority: 10,
    matchMode: "contains",
    keywords: ["link"],
    postScope: null,
    scopeType: "all",
    targetMediaIds: [],
    destinationRef: "dest-1",
    messageTemplate: "Here is your link",
    status: "active",
    version: 1,
  };

  describe("scope overlap checks", () => {
    it("detects scope overlap correctly with legacy string scopes", () => {
      expect(doScopesOverlap(null, null)).toBe(true);
      expect(doScopesOverlap(null, "post-123")).toBe(true);
      expect(doScopesOverlap("post-123", null)).toBe(true);
      expect(doScopesOverlap("post-123", "post-123")).toBe(true);
      expect(doScopesOverlap("post-123", "post-456")).toBe(false);
    });

    it("detects scope overlap with targetMediaIds", () => {
      expect(
        doScopesOverlap(
          { scopeType: "specific", targetMediaIds: ["post-1", "post-2"] },
          { scopeType: "specific", targetMediaIds: ["post-2", "post-3"] },
        ),
      ).toBe(true);

      expect(
        doScopesOverlap(
          { scopeType: "specific", targetMediaIds: ["post-1", "post-2"] },
          { scopeType: "specific", targetMediaIds: ["post-3", "post-4"] },
        ),
      ).toBe(false);

      expect(
        doScopesOverlap(
          { scopeType: "all" },
          { scopeType: "specific", targetMediaIds: ["post-1"] },
        ),
      ).toBe(true);
    });
  });

  describe("rule collision validation on creation", () => {
    it("rejects creation of two rules with identical keyword and overlapping scope", () => {
      const existing: AutomationRule[] = [baseRule];
      const candidate: AutomationRule = {
        ...baseRule,
        id: "rule-2",
        keywords: ["LINK"], // case-insensitive check
      };

      expect(() => validateRuleOverlap(candidate, existing)).toThrow(RuleOverlapError);
    });

    it("allows duplicate keyword if post scopes are mutually disjoint", () => {
      const existing: AutomationRule[] = [{ ...baseRule, id: "rule-1", postScope: "post-1" }];
      const candidate: AutomationRule = {
        ...baseRule,
        id: "rule-2",
        postScope: "post-2",
      };

      expect(() => validateRuleOverlap(candidate, existing)).not.toThrow();
    });

    it("allows duplicate keyword if targetMediaIds are mutually disjoint", () => {
      const existing: AutomationRule[] = [
        {
          ...baseRule,
          id: "rule-1",
          scopeType: "specific",
          targetMediaIds: ["reel-101", "reel-102"],
        },
      ];
      const candidate: AutomationRule = {
        ...baseRule,
        id: "rule-2",
        scopeType: "specific",
        targetMediaIds: ["reel-201"],
      };

      expect(() => validateRuleOverlap(candidate, existing)).not.toThrow();
    });

    it("rejects duplicate keyword if targetMediaIds intersect", () => {
      const existing: AutomationRule[] = [
        {
          ...baseRule,
          id: "rule-1",
          scopeType: "specific",
          targetMediaIds: ["reel-101", "reel-102"],
        },
      ];
      const candidate: AutomationRule = {
        ...baseRule,
        id: "rule-2",
        scopeType: "specific",
        targetMediaIds: ["reel-102", "reel-201"],
      };

      expect(() => validateRuleOverlap(candidate, existing)).toThrow(RuleOverlapError);
    });

    it("allows different accounts to use the same keyword", () => {
      const existing: AutomationRule[] = [{ ...baseRule, id: "rule-1", accountId: "acc-1" }];
      const candidate: AutomationRule = {
        ...baseRule,
        id: "rule-2",
        accountId: "acc-2",
      };

      expect(() => validateRuleOverlap(candidate, existing)).not.toThrow();
    });
  });

  describe("rule selection precedence", () => {
    it("prioritizes specific post rule over global rule regardless of priority number", () => {
      const globalRule: AutomationRule = {
        ...baseRule,
        id: "global-rule",
        scopeType: "all",
        postScope: null,
        priority: 1, // Higher global priority
        keywords: ["guide"],
      };

      const specificRule: AutomationRule = {
        ...baseRule,
        id: "specific-rule",
        scopeType: "specific",
        targetMediaIds: ["reel-42"],
        priority: 10, // Lower priority number
        keywords: ["guide"],
      };

      // A comment arrives on reel-42
      const result = chooseRule("send guide please", "reel-42", [globalRule, specificRule]);
      expect(result).not.toBeNull();
      expect(result?.rule.id).toBe("specific-rule");
    });

    it("matches rule when postId is inside targetMediaIds array", () => {
      const multiPostRule: AutomationRule = {
        ...baseRule,
        id: "multi-post-rule",
        scopeType: "specific",
        targetMediaIds: ["post-a", "post-b", "post-c"],
        keywords: ["info"],
      };

      const result = chooseRule("need info", "post-b", [multiPostRule]);
      expect(result).not.toBeNull();
      expect(result?.rule.id).toBe("multi-post-rule");

      const noMatch = chooseRule("need info", "post-d", [multiPostRule]);
      expect(noMatch).toBeNull();
    });

    it("chooses rule with lowest priority number first when scope specificity is identical", () => {
      const highPriRule: AutomationRule = {
        ...baseRule,
        id: "high-pri",
        priority: 1, // higher importance
        keywords: ["portfolio"],
      };
      const lowPriRule: AutomationRule = {
        ...baseRule,
        id: "low-pri",
        priority: 10,
        keywords: ["portfolio"],
      };

      const result = chooseRule("portfolio please", "post-1", [lowPriRule, highPriRule]);
      expect(result).not.toBeNull();
      expect(result?.rule.id).toBe("high-pri");
    });

    it("breaks priority tie using stricter match mode (exact > whole_word > contains)", () => {
      const exactRule: AutomationRule = {
        ...baseRule,
        id: "exact-rule",
        priority: 5,
        matchMode: "exact",
        keywords: ["portfolio"],
      };
      const wholeWordRule: AutomationRule = {
        ...baseRule,
        id: "whole-word-rule",
        priority: 5,
        matchMode: "whole_word",
        keywords: ["portfolio"],
      };

      const result = chooseRule("portfolio", "post-1", [wholeWordRule, exactRule]);
      expect(result).not.toBeNull();
      expect(result?.rule.id).toBe("exact-rule");
    });

    it("breaks mode tie using earliest keyword position in the comment", () => {
      const firstKwRule: AutomationRule = {
        ...baseRule,
        id: "first-kw",
        priority: 5,
        matchMode: "whole_word",
        keywords: ["start"],
      };
      const secondKwRule: AutomationRule = {
        ...baseRule,
        id: "second-kw",
        priority: 5,
        matchMode: "whole_word",
        keywords: ["finish"],
      };

      const result = chooseRule("start from here and then finish", "post-1", [
        secondKwRule,
        firstKwRule,
      ]);
      expect(result).not.toBeNull();
      expect(result?.rule.id).toBe("first-kw");
    });

    it("ignores paused rules", () => {
      const pausedRule: AutomationRule = {
        ...baseRule,
        id: "paused-rule",
        status: "paused",
        keywords: ["activekw"],
      };

      const result = chooseRule("activekw please", "post-1", [pausedRule]);
      expect(result).toBeNull();
    });
  });
});
