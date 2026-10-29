import { splitSentences } from "../text";

export function chunkDocument(document: string): string[] {
  const paragraphs = document
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    if (words.length <= 120) {
      chunks.push(paragraph);
      continue;
    }
    const sentences = splitSentences(paragraph);
    let buffer: string[] = [];
    let count = 0;
    for (const sentence of sentences) {
      const size = sentence.split(/\s+/).length;
      if (count + size > 80 && buffer.length > 0) {
        chunks.push(buffer.join(" "));
        buffer = [];
        count = 0;
      }
      buffer.push(sentence);
      count += size;
    }
    if (buffer.length > 0) chunks.push(buffer.join(" "));
  }
  return chunks;
}
