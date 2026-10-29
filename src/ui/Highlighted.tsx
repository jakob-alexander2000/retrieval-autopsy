import type { ReactNode } from "react";
import type { Span } from "../score/score";

function merge(spans: Span[]): Span[] {
  const sorted = spans
    .filter((span) => span.start >= 0 && span.end > span.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Span[] = [];
  for (const span of sorted) {
    const prev = kept[kept.length - 1];
    if (prev && span.start < prev.end) continue;
    kept.push(span);
  }
  return kept;
}

export function Highlighted({ text, spans }: { text: string; spans: Span[] }): ReactNode {
  const usable = merge(spans.filter((span) => span.end <= text.length));
  const nodes: ReactNode[] = [];
  let cursor = 0;
  usable.forEach((span, index) => {
    if (span.start > cursor) nodes.push(text.slice(cursor, span.start));
    const slice = text.slice(span.start, span.end);
    nodes.push(
      <mark key={`${span.start}-${index}`} className="miss" data-span={slice}>
        {slice}
      </mark>,
    );
    cursor = span.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
