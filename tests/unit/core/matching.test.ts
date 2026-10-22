import { describe, it, expect } from "vitest";
import {
  matchKeyword,
  normalizeText,
  stripEdgePunctuation,
  stripEmojis,
  foldLatinDiacritics,
} from "@/core/matching";

describe("core/matching", () => {
  describe("normalization & diacritics", () => {
    it("collapses multiple whitespaces and normalizes case", () => {
      expect(normalizeText("  HELLO   WORLD  ")).toBe("hello world");
    });

    it("folds Latin diacritics while preserving Devanagari combining marks", () => {
      // Latin diacritics folded
      expect(foldLatinDiacritics("PORTFOLIO")).toBe("PORTFOLIO");
      expect(foldLatinDiacritics("crème brûlée")).toBe("creme brulee");
      expect(foldLatinDiacritics("PREÇO")).toBe("PRECO");

      // Devanagari combining marks preserved (kitab = क + ि + त + ा + ब)
      const hindiText = "किताब";
      expect(foldLatinDiacritics(hindiText)).toBe(hindiText);
    });

    it("strips emojis cleanly", () => {
      expect(stripEmojis("🔥 portfolio ✨🚀")).toBe(" portfolio ");
    });

    it("strips edge punctuation and emojis", () => {
      expect(stripEdgePunctuation("!portfolio?")).toBe("portfolio");
      expect(stripEdgePunctuation("🔥PORTFOLIO✨")).toBe("PORTFOLIO");
    });
  });

  describe("exact match mode", () => {
    it("matches exact keyword ignoring edge punctuation and emoji", () => {
      expect(matchKeyword("PORTFOLIO", "portfolio", "exact").matched).toBe(true);
      expect(matchKeyword("portfolio", "PORTFOLIO", "exact").matched).toBe(true);
      expect(matchKeyword("🔥 portfolio ✨", "portfolio", "exact").matched).toBe(true);
      expect(matchKeyword("!portfolio?", "portfolio", "exact").matched).toBe(true);
    });

    it("rejects comments with additional words in exact mode", () => {
      expect(matchKeyword("portfolio please", "portfolio", "exact").matched).toBe(false);
      expect(matchKeyword("check my portfolio", "portfolio", "exact").matched).toBe(false);
      expect(matchKeyword("myportfoliosite", "portfolio", "exact").matched).toBe(false);
    });
  });

  describe("whole_word match mode", () => {
    it("matches standalone word inside a sentence", () => {
      const res = matchKeyword("portfolio please", "portfolio", "whole_word");
      expect(res.matched).toBe(true);
      expect(res.position).toBe(0);

      const midRes = matchKeyword("please send portfolio link", "portfolio", "whole_word");
      expect(midRes.matched).toBe(true);
      expect(midRes.position).toBe(12);
    });

    it("rejects keyword when embedded inside another word", () => {
      expect(matchKeyword("myportfoliosite", "portfolio", "whole_word").matched).toBe(false);
      expect(matchKeyword("superportfolio", "portfolio", "whole_word").matched).toBe(false);
    });

    it("supports Hindi and Hinglish keywords with Unicode awareness", () => {
      // Hindi Devanagari keyword
      const hindiComment = "मुझे लिंक भेजो"; // "send me link"
      const res = matchKeyword(hindiComment, "लिंक", "whole_word");
      expect(res.matched).toBe(true);

      // Hinglish keyword
      const hinglishComment = "bhai mujhe link bhejo";
      const hinglishRes = matchKeyword(hinglishComment, "link", "whole_word");
      expect(hinglishRes.matched).toBe(true);
    });

    it("matches with surrounding emoji and punctuation in whole_word mode", () => {
      const res = matchKeyword("Hey! 🔥portfolio✨ is awesome", "portfolio", "whole_word");
      expect(res.matched).toBe(true);
    });
  });

  describe("contains match mode", () => {
    it("matches substring even inside other words", () => {
      const res = matchKeyword("myportfoliosite", "portfolio", "contains");
      expect(res.matched).toBe(true);
      expect(res.position).toBe(2);
    });

    it("fails when substring is absent", () => {
      expect(matchKeyword("random text here", "portfolio", "contains").matched).toBe(false);
    });
  });
});
