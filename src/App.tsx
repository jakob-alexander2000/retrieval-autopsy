import { useRef, useState } from "react";
import { draftAnswer } from "./answer/draft";
import { HANDBOOK } from "./sample/handbook";
import { QUESTIONS } from "./sample/questions";
import { chunkDocument } from "./retrieve/chunk";
import { bm25Rank, TOP_K } from "./retrieve/bm25";
import { rankByMeaning } from "./retrieve/embed";
import type { Hit } from "./run";
import { scoreAnswer, type ScoreCard } from "./score/score";
import { matchedTerms, wordCount } from "./text";
import { Judges } from "./ui/Judges";
import { Highlighted } from "./ui/Highlighted";
import { PassageList } from "./ui/PassageList";
import { Scorecard } from "./ui/Scorecard";

type Source = "keyword" | "meaning";
type Mode = "faithful" | "naive" | "cloud";
type MeaningState =
  | { status: "idle" }
  | { status: "loading"; ratio: number; label: string }
  | { status: "ready" }
  | { status: "error"; message: string };

type Draft = {
  answer: string;
  note: string;
  card: ScoreCard | null;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function liveText(card: ScoreCard): string {
  return card.checks.map((check) => `${check.id} ${check.status}`).join(", ");
}

async function draftCloud(question: string, passages: string[]): Promise<{ answer: string; note: string }> {
  const fallback = draftAnswer(question, passages, "faithful");
  try {
    const response = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, passages: passages.slice(0, 3) }),
    });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { answer?: unknown };
    if (typeof data.answer === "string" && data.answer.trim()) {
      return {
        answer: data.answer.trim(),
        note: "Drafted by the server model. The checks below are still rules.",
      };
    }
    throw new Error("empty");
  } catch {
    return {
      answer: fallback,
      note: "The server model is not available, so this answer is taken from the passage.",
    };
  }
}

export function App() {
  const [documentText, setDocumentText] = useState(HANDBOOK);
  const [question, setQuestion] = useState("");
  const [picked, setPicked] = useState("");
  const [source, setSource] = useState<Source>("keyword");
  const [mode, setMode] = useState<Mode>("faithful");
  const [keyword, setKeyword] = useState<Hit[]>([]);
  const [meaning, setMeaning] = useState<Hit[]>([]);
  const [meaningState, setMeaningState] = useState<MeaningState>({ status: "idle" });
  const [draft, setDraft] = useState<Draft>({ answer: "", note: "", card: null });
  const [live, setLive] = useState("");
  const runId = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const synthetic = /NOTICE/.test(documentText) && /synthetic/i.test(documentText);
  const ready = question.trim().length > 0 && documentText.trim().length > 0;
  const passageSpans = draft.card?.checks.flatMap((check) => check.spans) ?? [];
  const answerSpans = passageSpans.filter((span) => span.where === "answer");
  const disagree =
    meaningState.status === "ready" &&
    keyword[0] &&
    meaning[0] &&
    keyword[0].text !== meaning[0].text;

  function scrollToResult() {
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({
        block: "start",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  }

  async function publish(nextSource: Source, nextMode: Mode, keywordHits: Hit[], meaningHits: Hit[], doc: string, asked: string) {
    const hits = nextSource === "keyword" ? keywordHits : meaningHits;
    const passages = hits.map((hit) => hit.text);
    if (nextSource === "meaning" && passages.length === 0) {
      setDraft({ answer: "", note: "Waiting for the meaning model.", card: null });
      setLive("Waiting for the meaning model.");
      return;
    }
    if (nextMode === "cloud") {
      setDraft({ answer: "", note: "Asking the server model.", card: null });
      const cloud = await draftCloud(asked, passages);
      const card = scoreAnswer({ document: doc, question: asked, passages, answer: cloud.answer });
      setDraft({ answer: cloud.answer, note: cloud.note, card });
      setLive(liveText(card));
      scrollToResult();
      return;
    }
    const local = draftAnswer(asked, passages, nextMode);
    const card = scoreAnswer({ document: doc, question: asked, passages, answer: local });
    setDraft({
      answer: local,
      note: nextMode === "naive" ? "Conditions were stripped on purpose." : "Sentences taken from the top passage.",
      card,
    });
    setLive(liveText(card));
    scrollToResult();
  }

  function chooseMode(next: Mode) {
    setMode(next);
    if (keyword.length === 0) return;
    void publish(source, next, keyword, meaning, documentText, question);
  }

  async function onRun() {
    const asked = question.trim();
    const doc = documentText;
    if (!asked || !doc.trim()) return;
    const id = ++runId.current;
    const chunks = chunkDocument(doc);
    const keywordHits = bm25Rank(asked, chunks, TOP_K).map((hit) => ({
      ...hit,
      terms: matchedTerms(asked, hit.text),
    }));
    setKeyword(keywordHits);
    setMeaning([]);
    setMeaningState({ status: "loading", ratio: 0, label: "Loading the meaning model" });
    await publish(source, mode, keywordHits, [], doc, asked);
    let lastRatio = -1;
    try {
      const ranked = await rankByMeaning(asked, chunks, TOP_K, (progress) => {
        if (id !== runId.current) return;
        const ratio = Math.round(progress.ratio * 100);
        if (ratio === lastRatio) return;
        lastRatio = ratio;
        setMeaningState({ status: "loading", ratio: progress.ratio, label: progress.label });
      });
      if (id !== runId.current) return;
      const meaningHits = ranked.map((hit) => ({ ...hit, terms: [] as string[] }));
      setMeaning(meaningHits);
      setMeaningState({ status: "ready" });
      if (source === "meaning") await publish(source, mode, keywordHits, meaningHits, doc, asked);
    } catch {
      if (id !== runId.current) return;
      setMeaningState({
        status: "error",
        message: "The meaning model did not download. Keyword search still works.",
      });
    }
  }

  return (
    <>
      <a className="skip" href="#ask">Skip to the question</a>
      <main className="wrap">
        <header className="mast">
          <p className="eyebrow"><span className="sq" aria-hidden="true" /> Retrieval autopsy</p>
          <h1>Show exactly where a document answer picks the wrong passage or drops a condition.</h1>
          <p className="dek">Paste a few pages, or use the sample handbook. No account.</p>
        </header>

        <form
          className="inputs"
          onSubmit={(event) => {
            event.preventDefault();
            void onRun();
          }}
        >
          <section className="ask" id="ask">
            <label htmlFor="question">Question</label>
            <input
              id="question"
              type="text"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setPicked("");
              }}
              placeholder="Ask something the handbook might answer"
              autoComplete="off"
            />
            <ul className="chips">
              {QUESTIONS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={picked === item.id ? "chip is-on" : "chip"}
                    aria-pressed={picked === item.id}
                    data-testid={`question-${item.id}`}
                    onClick={() => {
                      setQuestion(item.text);
                      setPicked(item.id);
                    }}
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
            {picked ? <p className="quiet">{QUESTIONS.find((item) => item.id === picked)?.note}</p> : null}
            <fieldset>
              <legend>Answer</legend>
              <div className="choices">
                <label className="choice">
                  <input type="radio" name="mode" checked={mode === "faithful"} onChange={() => chooseMode("faithful")} data-testid="mode-faithful" />
                  Keeps the wording
                </label>
                <label className="choice">
                  <input type="radio" name="mode" checked={mode === "naive"} onChange={() => chooseMode("naive")} data-testid="mode-naive" />
                  Drops conditions
                </label>
                <label className="choice">
                  <input type="radio" name="mode" checked={mode === "cloud"} onChange={() => chooseMode("cloud")} data-testid="mode-cloud" />
                  Server model, if one is configured
                </label>
              </div>
            </fieldset>
            <button className="run" type="submit" data-testid="run" disabled={!ready}>Run</button>
          </section>

          <section className="document">
            <div className="label-row">
              <label htmlFor="document">Handbook</label>
              <span className="num">{wordCount(documentText).toLocaleString("en")} words</span>
            </div>
            <textarea
              id="document"
              value={documentText}
              onChange={(event) => setDocumentText(event.target.value.slice(0, 30_000))}
              spellCheck={false}
            />
            <div className="label-row">
              <button type="button" data-testid="load-sample" onClick={() => setDocumentText(HANDBOOK)}>
                Reload the sample
              </button>
              {synthetic ? <p className="quiet">Synthetic sample. Not a real policy.</p> : null}
            </div>
          </section>
        </form>

        <div className="results" ref={resultRef}>
          <div className="results-main">
          <div className="columns">
            <PassageList
              title="Keyword"
              kicker="Shared words, ranked"
              testPrefix="passage-keyword"
              hits={keyword}
              spans={source === "keyword" ? passageSpans : []}
              active={source === "keyword"}
            />
            <PassageList
              title="By meaning"
              kicker="A small model in this browser. The handbook is not uploaded."
              testPrefix="passage-meaning"
              hits={meaning}
              spans={source === "meaning" ? passageSpans : []}
              active={source === "meaning"}
            >
              {meaningState.status === "idle" ? <p className="quiet">Meaning search starts when you run.</p> : null}
              {meaningState.status === "loading" ? (
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(meaningState.ratio * 100)}
                  aria-label="Meaning model download"
                >
                  <span style={{ width: `${Math.round(meaningState.ratio * 100)}%` }} />
                  <p>{meaningState.label}</p>
                </div>
              ) : null}
              {meaningState.status === "error" ? <p className="quiet">{meaningState.message}</p> : null}
            </PassageList>
          </div>

          {keyword.length > 0 ? (
            <fieldset className="source">
              <legend>Use for the answer</legend>
              <div className="choices">
                <label className="choice">
                  <input
                    type="radio"
                    name="source"
                    checked={source === "keyword"}
                    data-testid="source-keyword"
                    onChange={() => {
                      setSource("keyword");
                      void publish("keyword", mode, keyword, meaning, documentText, question);
                    }}
                  />
                  Keyword
                </label>
                <label className="choice">
                  <input
                    type="radio"
                    name="source"
                    checked={source === "meaning"}
                    data-testid="source-meaning"
                    onChange={() => {
                      setSource("meaning");
                      void publish("meaning", mode, keyword, meaning, documentText, question);
                    }}
                  />
                  By meaning
                </label>
              </div>
            </fieldset>
          ) : null}

          {disagree ? <p className="disagree" data-testid="disagree">Keyword and meaning picked different passages.</p> : null}

          {draft.answer || draft.note ? (
            <section className="answer" aria-labelledby="answer-heading">
              <h2 id="answer-heading">Answer</h2>
              {draft.note ? <p className="quiet">{draft.note}</p> : null}
              {draft.answer ? (
                <p data-answer="true">
                  <Highlighted text={draft.answer} spans={answerSpans} />
                </p>
              ) : null}
            </section>
          ) : null}

          </div>
          <aside className="rail">
            {draft.card ? <Scorecard card={draft.card} /> : <Judges />}
            {draft.card ? <Judges /> : null}
          </aside>
        </div>
        <p className="sr-only" aria-live="polite">{live}</p>
        <footer>
          <p>The handbook stays in this browser, unless you choose the server model. That choice sends the question and the three passages to /api/answer.</p>
        </footer>
      </main>
    </>
  );
}
