import json
from pathlib import Path

from retrieval_autopsy.score import score_answer

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures" / "answers.jsonl"


def test_fixtures_match_labels():
    lines = [line for line in FIXTURES.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) > 3
    for line in lines:
        row = json.loads(line)
        card = score_answer(row["document"], row["question"], row["passages"], row["answer"])
        by_id = {check["id"]: check for check in card["checks"]}
        for name, status in row["expect"].items():
            assert by_id[name]["status"] == status, f"{row['id']} {name}"
        if span := row.get("qualifier_span"):
            texts = [item["text"] for item in by_id["qualifier"]["spans"]]
            assert span in texts


def test_leave_span_is_exact():
    row = json.loads(FIXTURES.read_text(encoding="utf-8").splitlines()[1])
    card = score_answer(row["document"], row["question"], row["passages"], row["answer"])
    qualifier = next(check for check in card["checks"] if check["id"] == "qualifier")
    span = next(item for item in qualifier["spans"] if item["text"] == "full-time employees only")
    passage = row["passages"][span["passageIndex"]]
    assert passage[span["start"]:span["end"]] == "full-time employees only"
