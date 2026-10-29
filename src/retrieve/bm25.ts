import { tokenize } from "../text";

export const BM25_K1 = 1.2;
export const BM25_B = 0.75;
export const TOP_K = 3;

export type RankedPassage = {
  index: number;
  score: number;
  text: string;
};

export function bm25Rank(query: string, docs: string[], k = TOP_K): RankedPassage[] {
  if (docs.length === 0) return [];
  const tokenized = docs.map((doc) => tokenize(doc));
  const avgdl =
    tokenized.reduce((sum, toks) => sum + toks.length, 0) / tokenized.length || 1;
  const df = new Map<string, number>();
  for (const toks of tokenized) {
    for (const tok of new Set(toks)) {
      df.set(tok, (df.get(tok) ?? 0) + 1);
    }
  }
  const q = tokenize(query);
  const total = docs.length;
  const ranked: RankedPassage[] = tokenized.map((toks, index) => {
    const tf = new Map<string, number>();
    for (const tok of toks) tf.set(tok, (tf.get(tok) ?? 0) + 1);
    const dl = toks.length || 1;
    let score = 0;
    for (const term of q) {
      const freq = tf.get(term) ?? 0;
      if (!freq) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log((total - n + 0.5) / (n + 0.5) + 1);
      const norm = freq + BM25_K1 * (1 - BM25_B + BM25_B * (dl / avgdl));
      score += (idf * (freq * (BM25_K1 + 1))) / norm;
    }
    return { index, score, text: docs[index] ?? "" };
  });
  return ranked
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, k);
}
