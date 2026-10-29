export function cosine(a: number[], b: number[]): number {
  const width = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < width; i += 1) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

export type VectorHit = { index: number; score: number; text: string };

export function rankByVectors(
  query: number[],
  docs: number[][],
  texts: string[],
  k: number,
): VectorHit[] {
  return docs
    .map((vector, index) => ({
      index,
      score: cosine(query, vector),
      text: texts[index] ?? "",
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, k);
}
