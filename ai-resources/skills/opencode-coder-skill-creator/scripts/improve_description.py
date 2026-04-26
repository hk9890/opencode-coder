#!/usr/bin/env python3
"""Improve a skill description using OpenCode CLI based on eval outcomes."""

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

from scripts.utils import parse_skill_md


def _json_default(value):
    if isinstance(value, Path):
        return str(value)
    return str(value)


def _parse_ndjson_lines(text: str) -> list[dict]:
    events: list[dict] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("{"):
            continue
        try:
            events.append(json.loads(stripped))
        except json.JSONDecodeError:
            continue
    return events


def _extract_text(events: list[dict]) -> str:
    chunks: list[str] = []
    for event in events:
        if event.get("type") != "text":
            continue
        part = event.get("part", {})
        text = part.get("text")
        if isinstance(text, str):
            chunks.append(text)
    return "".join(chunks).strip()


def _call_opencode(prompt: str, model: str | None, timeout: int = 300) -> dict:
    cmd = [
        "opencode",
        "run",
        "--format",
        "json",
        "--print-logs",
        "--log-level",
        "DEBUG",
        prompt,
    ]
    if model:
        cmd.extend(["--model", model])

    started_at = time.time()
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    finished_at = time.time()

    events = _parse_ndjson_lines(proc.stdout)
    text = _extract_text(events)
    return {
        "returncode": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
        "events": events,
        "text": text,
        "duration_seconds": round(finished_at - started_at, 3),
    }


def _extract_description(text: str) -> str:
    match = re.search(r"<new_description>(.*?)</new_description>", text, re.DOTALL)
    if match:
        return match.group(1).strip().strip('"')
    return text.strip().strip('"')


def improve_description(
    skill_name: str,
    skill_content: str,
    current_description: str,
    eval_results: dict,
    history: list[dict],
    model: str | None,
    test_results: dict | None = None,
    log_dir: Path | None = None,
    iteration: int | None = None,
) -> str:
    failed_triggers = [
        r for r in eval_results["results"] if r["should_trigger"] and not r["pass"]
    ]
    false_triggers = [
        r
        for r in eval_results["results"]
        if (not r["should_trigger"]) and not r["pass"]
    ]

    train_score = (
        f"{eval_results['summary']['passed']}/{eval_results['summary']['total']}"
    )
    if test_results:
        test_score = (
            f"{test_results['summary']['passed']}/{test_results['summary']['total']}"
        )
        scores_summary = f"Train: {train_score}, Test: {test_score}"
    else:
        scores_summary = f"Train: {train_score}"

    prompt = (
        f"You are optimizing the description of an OpenCode skill named '{skill_name}'.\n"
        "The description is the trigger surface for whether the skill is used.\n"
        "Your goal: improve trigger precision/recall without overfitting.\n\n"
        f"Current description:\n{current_description}\n\n"
        f"Current scores: {scores_summary}\n\n"
    )

    if failed_triggers:
        prompt += "FAILED TO TRIGGER:\n"
        for r in failed_triggers:
            prompt += f"- {r['query']} (triggered {r['triggers']}/{r['runs']})\n"
        prompt += "\n"

    if false_triggers:
        prompt += "FALSE TRIGGERS:\n"
        for r in false_triggers:
            prompt += f"- {r['query']} (triggered {r['triggers']}/{r['runs']})\n"
        prompt += "\n"

    if history:
        prompt += "PREVIOUS ATTEMPTS (avoid repeating):\n"
        for h in history[-5:]:
            prompt += (
                f"- train={h.get('train_passed', h.get('passed', 0))}/{h.get('train_total', h.get('total', 0))} "
                f"desc={h.get('description', '')}\n"
            )
        prompt += "\n"

    prompt += (
        "Skill content for context:\n"
        "<skill_content>\n"
        f"{skill_content}\n"
        "</skill_content>\n\n"
        "Constraints:\n"
        "- 100-200 words preferred\n"
        "- hard limit 1024 chars\n"
        "- imperative style (e.g. 'Use this skill for ...')\n"
        "- focus on user intent and triggering context, not implementation details\n"
        "- be distinctive vs neighboring skills\n\n"
        "Respond with ONLY the new description wrapped in <new_description>...</new_description>."
    )

    response = _call_opencode(prompt, model=model)
    description = _extract_description(response["text"])

    transcript: dict = {
        "iteration": iteration,
        "prompt": prompt,
        "returncode": response["returncode"],
        "duration_seconds": response["duration_seconds"],
        "response_text": response["text"],
        "parsed_description": description,
        "char_count": len(description),
        "over_limit": len(description) > 1024,
    }

    if len(description) > 1024:
        shorten_prompt = (
            "The following skill description exceeds 1024 chars. "
            "Rewrite it under 1024 chars while preserving the strongest trigger intent.\n\n"
            f"Description:\n{description}\n\n"
            "Return ONLY <new_description>...</new_description>."
        )
        shorten_response = _call_opencode(shorten_prompt, model=model)
        shortened = _extract_description(shorten_response["text"])
        transcript["rewrite_prompt"] = shorten_prompt
        transcript["rewrite_returncode"] = shorten_response["returncode"]
        transcript["rewrite_response_text"] = shorten_response["text"]
        transcript["rewrite_char_count"] = len(shortened)
        description = shortened

    transcript["final_description"] = description

    if log_dir:
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"improve_iter_{iteration or 'unknown'}.json"
        log_file.write_text(json.dumps(transcript, indent=2, default=_json_default))

    return description


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Improve a skill description based on eval results"
    )
    parser.add_argument(
        "--eval-results",
        required=True,
        help="Path to eval results JSON (from run_eval.py)",
    )
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument("--history", default=None, help="Path to history JSON")
    parser.add_argument("--model", default=None, help="Optional model override")
    parser.add_argument("--verbose", action="store_true", help="Print progress")
    args = parser.parse_args()

    skill_path = Path(args.skill_path)
    if not (skill_path / "SKILL.md").exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        sys.exit(1)

    eval_results = json.loads(Path(args.eval_results).read_text())
    history = []
    if args.history:
        history = json.loads(Path(args.history).read_text())

    name, _, content = parse_skill_md(skill_path)
    current_description = eval_results["description"]

    if args.verbose:
        print(f"Current: {current_description}", file=sys.stderr)
        print(
            f"Score: {eval_results['summary']['passed']}/{eval_results['summary']['total']}",
            file=sys.stderr,
        )

    new_description = improve_description(
        skill_name=name,
        skill_content=content,
        current_description=current_description,
        eval_results=eval_results,
        history=history,
        model=args.model,
    )

    output = {
        "description": new_description,
        "history": history
        + [
            {
                "description": current_description,
                "passed": eval_results["summary"]["passed"],
                "failed": eval_results["summary"]["failed"],
                "total": eval_results["summary"]["total"],
                "results": eval_results["results"],
            }
        ],
    }
    print(json.dumps(output, indent=2, default=_json_default))


if __name__ == "__main__":
    main()
