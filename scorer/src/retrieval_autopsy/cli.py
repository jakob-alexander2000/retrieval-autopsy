"""Fail a run when the pass rate drops under the baseline."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from retrieval_autopsy.score import score_answer


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Score document answers and fail if the pass rate drops.")
    parser.add_argument("jsonl", type=Path)
    parser.add_argument("--baseline", type=Path, help="JSON file with min_pass_rate")
    parser.add_argument("--check-labels", action="store_true", help="Fail if an expect label does not match")
    args = parser.parse_args(argv)
    rows = load_jsonl(args.jsonl)
    totals = {name: [0, 0] for name in ("support", "scope", "qualifier", "omission")}
    label_errors = 0
    for row in rows:
        card = score_answer(row["document"], row["question"], row["passages"], row["answer"])
        by_id = {check["id"]: check for check in card["checks"]}
        for name, check in by_id.items():
            totals[name][1] += 1
            if check["status"] == "pass":
                totals[name][0] += 1
        expected = row.get("expect")
        if args.check_labels and expected:
            for name, status in expected.items():
                if by_id[name]["status"] != status:
                    label_errors += 1
                    print(f"{row.get('id', '?')} {name}: got {by_id[name]['status']} expected {status}", file=sys.stderr)
    passed = sum(item[0] for item in totals.values())
    total = sum(item[1] for item in totals.values())
    rate = passed / total if total else 0.0
    print(f"pass_rate {rate:.4f}")
    for name, (ok, count) in totals.items():
        print(f"{name} {ok}/{count}")
    if label_errors:
        return 1
    if args.baseline:
        baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
        minimum = float(baseline["min_pass_rate"])
        print(f"baseline {minimum:.4f}")
        if rate + 1e-9 < minimum:
            print("score dropped", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
