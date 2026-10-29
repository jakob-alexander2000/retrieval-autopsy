import { relevantSentences, splitSentences } from "../text";

function tidy(sentence: string): string {
  let text = sentence.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();
  text = text.replace(/^[\s,]+/, "").replace(/,\s*\./g, ".").replace(/\(\s*\)/g, "").trim();
  if (!text) return "";
  if (!/[.!?]$/.test(text)) text = `${text}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function draftFaithful(question: string, passages: string[]): string {
  const top = passages[0];
  if (!top) return "";
  return relevantSentences(question, top)
    .map((span) => span.text.trim())
    .filter(Boolean)
    .join(" ");
}

export function toNaive(faithful: string): string {
  const kept: string[] = [];
  for (const sentence of splitSentences(faithful)) {
    if (/\bare not eligible\b/i.test(sentence)) continue;
    let text = sentence.replace(/\bnot every\b/gi, "every");
    text = text.replace(/\bfull-time employees only\b/gi, "employees");
    text = text.replace(/\bpart-time employees only\b/gi, "employees");
    text = text.replace(/\bapplies only to\b[^.]+\./gi, "applies to people.");
    text = text.replace(/\bafter the probation period\b,?/gi, "");
    text = text.replace(/\bduring the probation period\b,?/gi, "");
    text = text.replace(/,?\s*\bunless\b[^.]*/gi, "");
    text = text.replace(/,?\s*\bonly if\b[^.]*/gi, "");
    text = text.replace(/,?\s*\bonly when\b[^.]*/gi, "");
    text = text.replace(/,?\s*\bprovided that\b[^.]*/gi, "");
    text = text.replace(/,?\s*\bsubject to\b[^.]*/gi, "");
    text = text.replace(/,?\s*\bexcept\b[^.]*/gi, "");
    const cleaned = tidy(text);
    if (cleaned.replace(/[.?!]/g, "").trim()) kept.push(cleaned);
  }
  return kept.join(" ");
}

export function draftAnswer(
  question: string,
  passages: string[],
  mode: "faithful" | "naive",
): string {
  const faithful = draftFaithful(question, passages);
  return mode === "naive" ? toNaive(faithful) : faithful;
}
