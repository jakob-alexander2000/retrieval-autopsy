"""Port of src/score/score.ts. Keep the rules in step with that file."""

from __future__ import annotations

import re
from typing import Iterable

STOP = {
    "a", "an", "the", "of", "to", "and", "or", "in", "on", "for", "is", "are", "be",
    "this", "that", "it", "as", "by", "with", "from", "at", "their", "they", "them",
    "who", "which", "do", "does", "did", "how", "what", "when", "where", "why", "many",
    "much", "can", "may", "i", "my", "me", "you", "your", "we", "our", "if", "am", "off",
    "into", "about", "than", "then", "so", "its", "was", "were", "been", "being", "will",
    "would", "should", "could",
}

SUPPORT_MIN = 0.72
RELEVANT_FLOOR = 0.45

QUALIFIER_PATTERNS = [
    r"full-time employees only",
    r"part-time employees only",
    r"after the probation period",
    r"during the probation period",
    r"€\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?",
    r"\b\d+(?:\.\d+)?\s+times\b",
    r"\bat least\s+\d+(?:\.\d+)?",
    r"\bno more than\s+\d+(?:\.\d+)?",
    r"\bup to\s+\d+(?:\.\d+)?",
    r"\b\d+(?:st|nd|rd|th)?\s+working\s+days?\b",
    r"\b\d+(?:\.\d+)?\s+(?:working\s+|calendar\s+)?(?:days|months|weeks|hours)\b",
]

OMISSION_PATTERNS = [
    r"\bunless\b[^.]*",
    r"\bexcept\b[^.]*",
    r"\bprovided that\b[^.]*",
    r"\bsubject to\b[^.]*",
    r"\bonly if\b[^.]*",
    r"\bonly when\b[^.]*",
    r"\bare not eligible\b[^.]*",
]

BROAD_PHRASES = (
    "everyone",
    "every employee",
    "every worker",
    "all employees",
    "all workers",
    "all staff",
)


def tokenize(text: str) -> list[str]:
    raw = re.sub(r"[^a-z0-9]+", " ", text.lower()).split()
    out: list[str] = []
    for tok in raw:
        if len(tok) < 2 and not tok.isdigit():
            continue
        if tok in STOP:
            continue
        out.append(tok)
    return out


def content_tokens(text: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for tok in tokenize(text):
        if tok in seen:
            continue
        seen.add(tok)
        out.append(tok)
    return out


def coverage(needle: str, haystack: str) -> float:
    tokens = content_tokens(needle)
    if not tokens:
        return 1.0
    hay = set(content_tokens(haystack))
    hit = sum(1 for tok in tokens if tok in hay)
    return hit / len(tokens)


def split_sentences(text: str) -> list[str]:
    flat = re.sub(r"\s+", " ", text).strip()
    if not flat:
        return []
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", flat) if part.strip()]


def sentence_spans(passage: str) -> list[dict]:
    spans = []
    cursor = 0
    for part in split_sentences(passage):
        start = passage.find(part, cursor)
        if start < 0:
            continue
        spans.append({"text": part, "start": start, "end": start + len(part)})
        cursor = start + len(part)
    return spans


def relevant_sentences(question: str, passage: str) -> list[dict]:
    spans = sentence_spans(passage)
    if not spans:
        return []
    scored = [(span, coverage(question, span["text"])) for span in spans]
    best = max(score for _, score in scored)
    floor = max(RELEVANT_FLOOR, best * 0.5)
    picked = [span for span, score in scored if score >= floor and score > 0]
    if picked:
        return picked[:3]
    return spans[:1]


def find_spans(text: str, patterns: Iterable[str]) -> list[dict]:
    found = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            found.append({"text": match.group(0), "start": match.start(), "end": match.end()})
    found.sort(key=lambda span: (span["start"], -span["end"]))
    kept = []
    cursor = -1
    for span in found:
        if span["start"] < cursor:
            continue
        kept.append(span)
        cursor = span["end"]
    return kept


def _contains(answer: str, phrase: str) -> bool:
    return phrase.lower() in answer.lower()


def _quote(spans: list[dict]) -> str:
    return " and ".join(f"“{span['text'].strip()}”" for span in spans)


def _source_indexes(answer: str, passages: list[str]) -> list[int]:
    indexes = [i for i, passage in enumerate(passages) if coverage(answer, passage) >= SUPPORT_MIN]
    if indexes:
        return indexes
    return [0] if passages else []


def _support(answer: str, passages: list[str]) -> dict:
    sentences = split_sentences(answer)
    if not answer.strip() or not sentences:
        return {"id": "support", "status": "fail", "detail": "There is no answer to check.", "spans": []}
    missing = [s for s in sentences if not any(coverage(s, p) >= SUPPORT_MIN for p in passages)]
    if not missing:
        return {
            "id": "support",
            "status": "pass",
            "detail": "Every sentence is made of words from a retrieved passage.",
            "spans": [],
        }
    spans = []
    cursor = 0
    for sentence in missing:
        start = answer.find(sentence, cursor)
        if start < 0:
            continue
        spans.append({
            "where": "answer",
            "passageIndex": -1,
            "start": start,
            "end": start + len(sentence),
            "text": sentence,
        })
        cursor = start + len(sentence)
    return {
        "id": "support",
        "status": "fail",
        "detail": "A sentence is not in the retrieved passages.",
        "spans": spans,
    }


def _broadened(answer: str) -> bool:
    lowered = answer.lower()
    for phrase in BROAD_PHRASES:
        start = 0
        while start < len(lowered):
            index = lowered.find(phrase, start)
            if index < 0:
                break
            if not lowered[:index].endswith("not "):
                return True
            start = index + len(phrase)
    return False


def _excluded(document: str, answer: str) -> bool:
    match = re.search(r"does not apply to ([^.]+)", document, flags=re.IGNORECASE)
    if not match:
        return False
    if re.search(r"\b(not eligible|not entitled|not included|not covered|does not apply|are not|is not)\b", answer, flags=re.IGNORECASE):
        return False
    groups = [part.strip().lower() for part in re.split(r",|\bor\b", match.group(1), flags=re.IGNORECASE)]
    groups = [group for group in groups if len(group) > 2]
    lowered = answer.lower()
    for group in groups:
        if group in lowered and re.search(r"\b(eligible|entitled|included|covered|receive|receives|get|gets)\b", answer, flags=re.IGNORECASE):
            return True
    return False


def _locate(passages: list[str], needle: str) -> dict | None:
    wanted = needle.lower()
    for index, passage in enumerate(passages):
        start = passage.lower().find(wanted)
        if start >= 0:
            return {"passageIndex": index, "start": start, "end": start + len(needle)}
    return None


def _scope(document: str, answer: str, passages: list[str]) -> dict:
    passed = {
        "id": "scope",
        "status": "pass",
        "detail": "The answer stays inside who the handbook is for.",
        "spans": [],
    }
    only = re.search(r"applies only to [^.]+\.", document, flags=re.IGNORECASE)
    if not only:
        return passed
    who = re.sub(r"^applies only to\s+", "", only.group(0), flags=re.IGNORECASE).rstrip(".")
    required = [tok for tok in ("linden", "atelier", "germany") if tok in who.lower()]
    lowered = answer.lower()
    widened = _broadened(answer) or (
        "applies to" in lowered and not re.search(r"\bonly\b", answer, flags=re.IGNORECASE) and any(tok not in lowered for tok in required)
    )
    if not widened and not _excluded(document, answer):
        return passed
    located = _locate(passages, only.group(0))
    if located:
        passage = passages[located["passageIndex"]]
        span = {
            "where": "passage",
            "passageIndex": located["passageIndex"],
            "start": located["start"],
            "end": located["end"],
            "text": passage[located["start"]:located["end"]],
        }
    else:
        span = {
            "where": "document",
            "passageIndex": -1,
            "start": only.start(),
            "end": only.end(),
            "text": only.group(0),
        }
    return {"id": "scope", "status": "fail", "detail": "The answer widens who this is for.", "spans": [span]}


def _kept(check_id: str, question: str, passages: list[str], answer: str, patterns: list[str], pass_detail: str) -> dict:
    missing = []
    for index in _source_indexes(answer, passages):
        passage = passages[index]
        for sentence in relevant_sentences(question, passage):
            for span in find_spans(sentence["text"], patterns):
                if _contains(answer, span["text"]):
                    continue
                start = sentence["start"] + span["start"]
                end = sentence["start"] + span["end"]
                missing.append({
                    "where": "passage",
                    "passageIndex": index,
                    "start": start,
                    "end": end,
                    "text": passage[start:end],
                })
    if not missing:
        return {"id": check_id, "status": "pass", "detail": pass_detail, "spans": []}
    return {
        "id": check_id,
        "status": "fail",
        "detail": f"The answer drops {_quote(missing)}.",
        "spans": missing,
    }


def score_answer(document: str, question: str, passages: list[str], answer: str) -> dict:
    return {
        "checks": [
            _support(answer, passages),
            _scope(document, answer, passages),
            _kept("qualifier", question, passages, answer, QUALIFIER_PATTERNS, "The limits in the passage are still in the answer."),
            _kept("omission", question, passages, answer, OMISSION_PATTERNS, "No condition that would change the result was dropped."),
        ]
    }


def pass_rate(cases: list[dict]) -> float:
    checks = 0
    passed = 0
    for case in cases:
        card = score_answer(case["document"], case["question"], case["passages"], case["answer"])
        for check in card["checks"]:
            checks += 1
            if check["status"] == "pass":
                passed += 1
    return passed / checks if checks else 0.0
