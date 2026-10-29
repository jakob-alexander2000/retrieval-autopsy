import type { ReactNode } from "react";
import type { Hit } from "../run";
import type { Span } from "../score/score";
import { Highlighted } from "./Highlighted";

export function PassageList({
  title,
  kicker,
  testPrefix,
  hits,
  spans,
  active,
  children,
}: {
  title: string;
  kicker: string;
  testPrefix: string;
  hits: Hit[];
  spans: Span[];
  active: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={active ? "column is-active" : "column"} aria-label={title}>
      <header className="column-head">
        <h3>{title}</h3>
        <p>{kicker}</p>
      </header>
      {children}
      {hits.length > 0 ? (
        <ol className="passages">
          {hits.map((hit, index) => {
            const local = spans.filter((span) => span.where === "passage" && span.passageIndex === index);
            return (
              <li key={`${hit.index}-${index}`} className="passage" data-testid={`${testPrefix}-${index}`} data-passage-index={index}>
                <div className="passage-meta">
                  <span>{index + 1}</span>
                  <span className="num">{hit.score.toFixed(2)}</span>
                </div>
                <p className="passage-text">
                  <Highlighted text={hit.text} spans={local} />
                </p>
                {hit.terms.length > 0 ? (
                  <p className="terms">Shared words: {hit.terms.join(", ")}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
