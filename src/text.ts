export const STOP = new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "and",
  "or",
  "in",
  "on",
  "for",
  "is",
  "are",
  "be",
  "this",
  "that",
  "it",
  "as",
  "by",
  "with",
  "from",
  "at",
  "their",
  "they",
  "them",
  "who",
  "which",
  "do",
  "does",
  "did",
  "how",
  "what",
  "when",
  "where",
  "why",
  "many",
  "much",
  "can",
  "may",
  "i",
  "my",
  "me",
  "you",
  "your",
  "we",
  "our",
  "if",
  "am",
  "off",
  "into",
  "about",
  "than",
  "then",
  "so",
  "its",
  "was",
  "were",
  "been",
  "being",
  "will",
  "would",
  "should",
  "could",
]);

export const SUPPORT_MIN = 0.72;
export const RELEVANT_FLOOR = 0.45;

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/);
  const out: string[] = [];
  for (const tok of raw) {
    if (!tok) continue;
    if (tok.length < 2 && !/^\d+$/.test(tok)) continue;
    if (STOP.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

export function contentTokens(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of tokenize(text)) {
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

export function coverage(needle: string, haystack: string): number {
  const tokens = contentTokens(needle);
  if (tokens.length === 0) return 1;
  const hay = new Set(contentTokens(haystack));
  let hit = 0;
  for (const tok of tokens) {
    if (hay.has(tok)) hit += 1;
  }
  return hit / tokens.length;
}

export function splitSentences(text: string): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return [];
  return flat
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export type SentenceSpan = { text: string; start: number; end: number };

export function sentenceSpans(passage: string): SentenceSpan[] {
  const parts = splitSentences(passage);
  const spans: SentenceSpan[] = [];
  let from = 0;
  for (const part of parts) {
    const start = passage.indexOf(part, from);
    if (start < 0) continue;
    spans.push({ text: part, start, end: start + part.length });
    from = start + part.length;
  }
  return spans;
}

export function relevantSentences(question: string, passage: string): SentenceSpan[] {
  const spans = sentenceSpans(passage);
  if (spans.length === 0) return [];
  const scored = spans.map((span) => ({
    span,
    score: coverage(question, span.text),
  }));
  const best = Math.max(...scored.map((row) => row.score));
  const floor = Math.max(RELEVANT_FLOOR, best * 0.5);
  const picked = scored
    .filter((row) => row.score >= floor && row.score > 0)
    .map((row) => row.span);
  if (picked.length > 0) return picked.slice(0, 3);
  return spans.slice(0, 1);
}

export function matchedTerms(query: string, passage: string): string[] {
  const hay = new Set(contentTokens(passage));
  return contentTokens(query).filter((tok) => hay.has(tok));
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
