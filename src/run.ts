import { draftAnswer } from "./answer/draft";
import { chunkDocument } from "./retrieve/chunk";
import { bm25Rank, TOP_K, type RankedPassage } from "./retrieve/bm25";
import { matchedTerms } from "./text";
import { scoreAnswer, type ScoreCard } from "./score/score";

export type Mode = "faithful" | "naive";

export type Hit = RankedPassage & { terms: string[] };

export function keywordHits(question: string, document: string): Hit[] {
  return bm25Rank(question, chunkDocument(document), TOP_K).map((hit) => ({
    ...hit,
    terms: matchedTerms(question, hit.text),
  }));
}

export function runKeyword(
  document: string,
  question: string,
  mode: Mode,
): { passages: string[]; answer: string; card: ScoreCard; hits: Hit[] } {
  const hits = keywordHits(question, document);
  const passages = hits.map((hit) => hit.text);
  const answer = draftAnswer(question, passages, mode);
  const card = scoreAnswer({ document, question, passages, answer });
  return { passages, answer, card, hits };
}
