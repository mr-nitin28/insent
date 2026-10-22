/**
 * Pure core text normalization and keyword matching engine.
 * Supports exact, whole_word, and contains match modes.
 * Unicode NFKC normalized, diacritic and Devanagari safe, emoji and punctuation aware.
 */

export type MatchMode = "exact" | "whole_word" | "contains";

export interface MatchResult {
  matched: boolean;
  position: number;
}

/**
 * Remove diacritics from Latin-script characters while leaving combining
 * marks in other scripts (Devanagari, Thai, Arabic) untouched.
 */
export function foldLatinDiacritics(text: string): string {
  let out = "";
  let baseIsLatin = false;

  for (const char of text.normalize("NFD")) {
    if (/\p{M}/u.test(char)) {
      if (!baseIsLatin) {
        out += char;
      }
      continue;
    }
    baseIsLatin = /\p{Script=Latin}/u.test(char);
    out += char;
  }

  return out.normalize("NFC");
}

/**
 * Strips emoji characters from the text.
 */
export function stripEmojis(text: string): string {
  return text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu,
    "",
  );
}

/**
 * Normalizes text: Unicode NFKC, lowercase, whitespace collapse, Latin diacritic fold.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  const nfkc = text.normalize("NFKC");
  const folded = foldLatinDiacritics(nfkc);
  return folded.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Strips leading and trailing punctuation and emoji for clean exact matching.
 */
export function stripEdgePunctuation(text: string): string {
  const stripped = stripEmojis(text);
  // Strip characters that are neither letters, numbers, nor combining marks at start/end
  return stripped
    .replace(/^[^\p{L}\p{N}\p{M}]+/gu, "")
    .replace(/[^\p{L}\p{N}\p{M}]+$/gu, "")
    .trim();
}

/**
 * Matches a keyword against a comment text given a match mode.
 * Returns match status and the 0-based character index where the match began.
 */
export function matchKeyword(commentText: string, keyword: string, mode: MatchMode): MatchResult {
  const normComment = normalizeText(commentText);
  const normKeyword = normalizeText(keyword);

  if (!normComment || !normKeyword) {
    return { matched: false, position: -1 };
  }

  if (mode === "exact") {
    const cleanComment = stripEdgePunctuation(normComment);
    const cleanKeyword = stripEdgePunctuation(normKeyword);
    if (cleanComment === cleanKeyword) {
      return { matched: true, position: normComment.indexOf(cleanKeyword) };
    }
    return { matched: false, position: -1 };
  }

  if (mode === "contains") {
    const pos = normComment.indexOf(normKeyword);
    return { matched: pos !== -1, position: pos };
  }

  // mode === "whole_word"
  // Unicode-aware word boundary: must not be preceded or followed by another letter or number
  const escaped = normKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
  const match = regex.exec(normComment);

  if (match) {
    return { matched: true, position: match.index };
  }

  return { matched: false, position: -1 };
}
