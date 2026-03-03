/**
 * Brand name normalization and matching utilities.
 * Used by both client-side (ClientDashboard) and server-side (geo-audit edge function).
 */

/**
 * Normalize a brand name for fuzzy matching.
 * Strips TLDs (.com, .io, etc.), common suffixes (CRM, App, Software...),
 * punctuation, and extra whitespace so that "monday.com", "Monday CRM",
 * and "Monday" all reduce to the same core token for comparison.
 */
export function normalizeBrandToken(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\.(com|io|ai|co|org|net|app|dev|me|us|uk|de|fr|in|ca|au|xyz|info|biz|so|gg)$/gi, '')
    .replace(/\b(crm|app|software|platform|tool|cloud|hq|labs|inc|llc|ltd|corp|suite|hub|pro|studio|agency|group|saas|erp)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/** Common English words that cause false positive brand matches */
export const COMMON_WORD_SKIP = new Set([
  "able", "also", "area", "back", "been", "best", "both", "call", "came", "case",
  "come", "could", "data", "days", "does", "done", "down", "each", "even", "fact",
  "find", "first", "form", "from", "full", "gave", "gets", "give", "goes", "good",
  "great", "hack", "half", "hand", "hard", "have", "head", "help", "here", "high",
  "home", "idea", "info", "into", "just", "keep", "kind", "know", "last", "lead",
  "left", "less", "life", "like", "line", "link", "list", "live", "long", "look",
  "made", "main", "make", "many", "meet", "mind", "more", "most", "much", "must",
  "name", "near", "need", "next", "note", "once", "only", "open", "over", "page",
  "part", "past", "plan", "play", "plus", "post", "push", "read", "real", "rest",
  "rich", "role", "rule", "runs", "safe", "said", "same", "save", "seen", "send",
  "show", "side", "sign", "site", "size", "some", "sort", "step", "stop", "sure",
  "take", "talk", "team", "tell", "test", "text", "that", "them", "then", "they",
  "this", "time", "tool", "turn", "type", "unit", "upon", "used", "user", "uses",
  "very", "view", "want", "wave", "well", "went", "were", "what", "when", "will",
  "with", "word", "work", "year", "your", "zero"
]);

/**
 * Check if two brand names refer to the same entity using normalized tokens.
 * E.g. "monday.com" matches "Monday CRM", "Monday" matches "monday.com"
 */
export function brandNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeBrandToken(a);
  const nb = normalizeBrandToken(b);
  if (!na || !nb) return false;
  if (COMMON_WORD_SKIP.has(na) || COMMON_WORD_SKIP.has(nb)) return false;
  return na === nb || (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na)));
}

/**
 * Check if a brand name (or any of its aliases) appears in a response text.
 * Uses both exact substring and normalized token matching.
 */
export function brandMentionedInText(response: string, brandName: string, aliases: string[] = []): boolean {
  if (!response) return false;
  const lower = response.toLowerCase();
  const allTerms = [brandName, ...aliases].filter(Boolean);
  for (const term of allTerms) {
    if (lower.includes(term.toLowerCase())) return true;
  }
  const brandToken = normalizeBrandToken(brandName);
  if (brandToken.length >= 4 && !COMMON_WORD_SKIP.has(brandToken)) {
    // Strip ALL non-alphanumeric (including spaces) so multi-word brands like
    // "Tata Tele Services" → "tatateleservices" can match in running text
    const responseClean = lower.replace(/[^a-z0-9]/g, '');
    if (responseClean.includes(brandToken)) return true;
  }
  return false;
}
