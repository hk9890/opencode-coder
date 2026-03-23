#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
WORKSPACE = (
    ROOT / "ai-resources" / "skills" / "opencode-coder-workspace" / "iteration-3"
)

GRADING_SCHEMA = {
    "type": "object",
    "properties": {
        "expectations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "passed": {"type": "boolean"},
                    "evidence": {"type": "string"},
                },
                "required": ["text", "passed", "evidence"],
            },
        },
        "summary": {
            "type": "object",
            "properties": {
                "passed": {"type": "integer"},
                "failed": {"type": "integer"},
                "total": {"type": "integer"},
                "pass_rate": {"type": "number"},
            },
            "required": ["passed", "failed", "total", "pass_rate"],
        },
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "type": {"type": "string"},
                    "verified": {"type": "boolean"},
                    "evidence": {"type": "string"},
                },
                "required": ["claim", "type", "verified", "evidence"],
            },
        },
        "user_notes_summary": {
            "type": "object",
            "properties": {
                "uncertainties": {"type": "array", "items": {"type": "string"}},
                "needs_review": {"type": "array", "items": {"type": "string"}},
                "workarounds": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["uncertainties", "needs_review", "workarounds"],
        },
        "eval_feedback": {
            "type": "object",
            "properties": {
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "assertion": {"type": "string"},
                            "reason": {"type": "string"},
                        },
                        "required": ["reason"],
                    },
                },
                "overall": {"type": "string"},
            },
            "required": ["suggestions", "overall"],
        },
    },
    "required": [
        "expectations",
        "summary",
        "claims",
        "user_notes_summary",
        "eval_feedback",
    ],
}


def grade_run(run_dir: Path, expectations: list[str]) -> None:
    transcript = (run_dir / "transcript.md").read_text()
    response = (run_dir / "outputs" / "response.md").read_text()
    metrics = json.loads((run_dir / "outputs" / "metrics.json").read_text())
    timing = json.loads((run_dir / "timing.json").read_text())

    prompt = f"""
You are grading a skill-validation run.

Expectations to grade:
{json.dumps(expectations, indent=2)}

Transcript:
{transcript}

Primary output file (response.md):
{response}

Return JSON only. Be strict and evidence-based. A pass requires clear, substantive support in the response or transcript, not vague similarity. Add concise eval-feedback suggestions only when the assertions miss something important or are too weak.
""".strip()

    proc = subprocess.run(
        [
            "claude",
            "-p",
            prompt,
            "--output-format",
            "stream-json",
            "--include-partial-messages",
            "--permission-mode",
            "bypassPermissions",
            "--tools",
            "StructuredOutput",
            "--json-schema",
            json.dumps(GRADING_SCHEMA),
        ],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=180000,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"grading failed for {run_dir}: {proc.stderr[:500]}")

    events = [json.loads(line) for line in proc.stdout.splitlines() if line.strip()]
    result_event = next(
        event for event in reversed(events) if event.get("type") == "result"
    )
    grading = result_event.get("structured_output")
    if not isinstance(grading, dict):
        raise RuntimeError(f"structured output missing for {run_dir}")
    grading["execution_metrics"] = metrics
    grading["timing"] = timing
    (run_dir / "grading.json").write_text(json.dumps(grading, indent=2) + "\n")


def main() -> int:
    for eval_dir in sorted(WORKSPACE.glob("eval-*")):
        metadata = json.loads((eval_dir / "eval_metadata.json").read_text())
        expectations = metadata.get("assertions", [])
        for run_dir in sorted(eval_dir.glob("*/run-*")):
            grade_run(run_dir, expectations)
    print(f"Wrote grading files under {WORKSPACE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
