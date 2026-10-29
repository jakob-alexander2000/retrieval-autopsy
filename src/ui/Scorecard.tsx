import type { CheckResult, ScoreCard } from "../score/score";

const NAMES: Record<CheckResult["id"], string> = {
  support: "Support",
  scope: "Scope",
  qualifier: "Qualifier",
  omission: "Omission",
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Scorecard({ card }: { card: ScoreCard }) {
  return (
    <section className="scorecard" aria-labelledby="score-heading">
      <h2 id="score-heading">Scorecard</h2>
      <p className="quiet">Four checks. Rules, not another model.</p>
      <ol className="checks">
        {card.checks.map((check) => (
          <li key={check.id} className={check.status === "fail" ? "check is-fail" : "check"} data-testid={`check-${check.id}`}>
            <div className="check-top">
              <h3>{NAMES[check.id]}</h3>
              <p className="status" data-testid={`check-${check.id}-status`}>
                {check.status === "fail" ? "Fail" : "Pass"}
              </p>
            </div>
            <p>{check.detail}</p>
            {check.spans.length > 0 ? (
              <button
                type="button"
                className="jump"
                onClick={() => {
                  const span = check.spans[0];
                  if (!span) return;
                  const selector = span.where === "answer" ? "[data-answer] mark" : `[data-passage-index="${span.passageIndex}"] mark`;
                  document.querySelector(selector)?.scrollIntoView({
                    block: "center",
                    behavior: prefersReducedMotion() ? "auto" : "smooth",
                  });
                }}
              >
                Show the marked words
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
