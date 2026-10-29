import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { draftAnswer } from "./answer/draft";
import { QUESTIONS } from "./sample/questions";
import { HANDBOOK } from "./sample/handbook";
import { keywordHits, runKeyword } from "./run";
import { checkById, findSpans, QUALIFIER_PATTERNS, scoreAnswer } from "./score/score";
import { cosine, rankByVectors } from "./retrieve/vectors";
import { wordCount } from "./text";

const leave = QUESTIONS.find((q) => q.id === "leave");
if (!leave) throw new Error("missing leave question");

describe("handbook", () => {
  it("is a synthetic sample of about 2,000 words", () => {
    const words = wordCount(HANDBOOK);
    expect(words).toBeGreaterThan(1900);
    expect(words).toBeLessThan(2400);
    expect(HANDBOOK).toContain("NOTICE");
    expect(HANDBOOK.toLowerCase()).toContain("synthetic");
    expect(HANDBOOK).toContain("full-time employees only");
  });
});

describe("bm25", () => {
  it("ranks a tiny corpus by the distinctive term", () => {
    const docs = ["the cafeteria serves soup daily", "annual leave policy for the studio"];
    const ranked = keywordHits("annual leave", docs.join("\n\n"));
    expect(ranked[0]?.text).toContain("annual leave");
  });

  it("finds the annual leave passage", () => {
    const hits = keywordHits(leave.text, HANDBOOK);
    expect(hits[0]?.text).toContain("full-time employees only");
    expect(hits[0]?.text).toContain("30 days");
  });

  it("latches onto the picnic fund for a learning question", () => {
    const question = QUESTIONS.find((q) => q.id === "learning");
    if (!question) throw new Error("missing");
    const hits = keywordHits(question.text, HANDBOOK);
    expect(hits[0]?.text.toLowerCase()).toContain("picnic");
    expect(hits[0]?.text.toLowerCase()).not.toContain("stipend");
  });

  it("misses the medical certificate rule for a doctor's note question", () => {
    const question = QUESTIONS.find((q) => q.id === "doctor");
    if (!question) throw new Error("missing");
    const hits = keywordHits(question.text, HANDBOOK);
    expect(hits[0]?.text).toContain("office doctor");
    expect(hits[0]?.text).not.toContain("4th working day");
  });

  it("finds resignation rather than a bare notice", () => {
    const question = QUESTIONS.find((q) => q.id === "notice");
    if (!question) throw new Error("missing");
    const hits = keywordHits(question.text, HANDBOOK);
    expect(hits[0]?.text).toContain("resign");
  });
});

describe("the leave trap", () => {
  it("keeps the limit when the answer keeps the wording", () => {
    const result = runKeyword(HANDBOOK, leave.text, "faithful");
    expect(result.answer).toContain("full-time employees only");
    expect(result.answer).toContain("after the probation period");
    for (const id of ["support", "scope", "qualifier", "omission"] as const) {
      expect(checkById(result.card, id).status).toBe("pass");
    }
  });

  it("drops full-time employees only when conditions are stripped", () => {
    const result = runKeyword(HANDBOOK, leave.text, "naive");
    expect(result.answer).toBe("In practice, employees receive 30 days of paid annual leave.");
    expect(result.answer.toLowerCase()).not.toContain("full-time employees only");
    expect(checkById(result.card, "support").status).toBe("pass");
    expect(checkById(result.card, "scope").status).toBe("pass");
    expect(checkById(result.card, "omission").status).toBe("pass");
    const qualifier = checkById(result.card, "qualifier");
    expect(qualifier.status).toBe("fail");
    expect(qualifier.spans.some((span) => span.text === "full-time employees only")).toBe(true);
    const span = qualifier.spans.find((item) => item.text === "full-time employees only");
    const passage = result.passages[span?.passageIndex ?? -1] ?? "";
    expect(passage.slice(span?.start, span?.end)).toBe("full-time employees only");
  });
});

describe("other checks", () => {
  it("fails support when a sentence was invented", () => {
    const passages = ["Employees receive 30 days of paid annual leave."];
    const card = scoreAnswer({
      document: HANDBOOK,
      question: leave.text,
      passages,
      answer: "Employees receive 30 days of paid annual leave. This right is guaranteed in every country.",
    });
    const support = checkById(card, "support");
    expect(support.status).toBe("fail");
    expect(support.spans[0]?.text).toContain("every country");
  });

  it("fails scope when the answer says every worker", () => {
    const question = QUESTIONS.find((q) => q.id === "scope");
    if (!question) throw new Error("missing");
    const faithful = runKeyword(HANDBOOK, question.text, "faithful");
    expect(checkById(faithful.card, "scope").status).toBe("pass");
    const naive = runKeyword(HANDBOOK, question.text, "naive");
    expect(naive.answer).toBe("Every worker gets these benefits.");
    const scope = checkById(naive.card, "scope");
    expect(scope.status).toBe("fail");
    expect(scope.spans[0]?.text.toLowerCase()).toContain("applies only to");
    expect(checkById(naive.card, "support").status).toBe("pass");
  });

  it("fails omission when unless is dropped and keeps the number", () => {
    const question = QUESTIONS.find((q) => q.id === "home");
    if (!question) throw new Error("missing");
    const faithful = runKeyword(HANDBOOK, question.text, "faithful");
    expect(checkById(faithful.card, "omission").status).toBe("pass");
    const naive = runKeyword(HANDBOOK, question.text, "naive");
    expect(naive.answer.toLowerCase()).not.toContain("unless");
    const omission = checkById(naive.card, "omission");
    expect(omission.status).toBe("fail");
    expect(omission.spans[0]?.text.toLowerCase()).toContain("unless");
    expect(checkById(naive.card, "qualifier").status).toBe("pass");
  });

  it("fails omission when contractors are not eligible is dropped", () => {
    const question = QUESTIONS.find((q) => q.id === "contractors");
    if (!question) throw new Error("missing");
    const naive = runKeyword(HANDBOOK, question.text, "naive");
    expect(naive.answer.toLowerCase()).not.toContain("not eligible");
    expect(checkById(naive.card, "omission").status).toBe("fail");
    expect(checkById(naive.card, "support").status).toBe("pass");
  });

  it("passes faithful wording on every prepared question for support, qualifier, and omission", () => {
    for (const question of QUESTIONS) {
      const result = runKeyword(HANDBOOK, question.text, "faithful");
      expect(result.hits.length, question.id).toBeGreaterThan(0);
      expect(checkById(result.card, "support").status, question.id).toBe("pass");
      expect(checkById(result.card, "qualifier").status, question.id).toBe("pass");
      expect(checkById(result.card, "omission").status, question.id).toBe("pass");
    }
  });
});

describe("vectors", () => {
  it("ranks the closer vector first", () => {
    const hits = rankByVectors([1, 0], [[0, 1], [0.9, 0.1]], ["far", "near"], 2);
    expect(hits[0]?.text).toBe("near");
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
  });
});

describe("shared fixtures", () => {
  it("matches the labels in fixtures/answers.jsonl", () => {
    const lines = readFileSync(new URL("../fixtures/answers.jsonl", import.meta.url), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) {
      const row = JSON.parse(line) as {
        id: string;
        document: string;
        question: string;
        passages: string[];
        answer: string;
        expect: Record<"support" | "scope" | "qualifier" | "omission", "pass" | "fail">;
        qualifier_span?: string;
      };
      const card = scoreAnswer(row);
      for (const id of ["support", "scope", "qualifier", "omission"] as const) {
        expect(checkById(card, id).status, `${row.id} ${id}`).toBe(row.expect[id]);
      }
      if (row.qualifier_span) {
        const qualifier = checkById(card, "qualifier");
        expect(qualifier.spans.some((span) => span.text === row.qualifier_span)).toBe(true);
      }
    }
  });
});

describe("qualifier patterns", () => {
  it("does not treat a bare only as the full-time phrase", () => {
    const spans = findSpans("This booking note is for scheduling only.", QUALIFIER_PATTERNS);
    expect(spans.map((span) => span.text)).not.toContain("only");
  });
});

describe("draft", () => {
  it("copies the relevant sentence", () => {
    const answer = draftAnswer(
      leave.text,
      ["In practice, full-time employees only receive 30 days of paid annual leave after the probation period."],
      "faithful",
    );
    expect(answer).toContain("full-time employees only");
  });
});
