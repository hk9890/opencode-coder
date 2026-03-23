#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SKILL_DIR = ROOT / "ai-resources" / "skills" / "opencode-coder"
WORKSPACE = ROOT / "ai-resources" / "skills" / "opencode-coder-workspace"
ITERATION_DIR = WORKSPACE / "iteration-3"
EVALS_PATH = SKILL_DIR / "evals" / "evals.json"

CONTENT_TOOLS = "Read,Grep,Glob"


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:50].strip("-") or "eval"


def build_with_skill_prompt() -> str:
    return (
        "You are validating the local skill bundle at "
        f"`{SKILL_DIR}`. Treat it like an available skill. Before answering: "
        f"(1) read `{SKILL_DIR / 'SKILL.md'}`, (2) follow its routing instructions, "
        "(3) read only the reference files needed for the task, and (4) answer from that "
        "skill guidance plus any directly relevant repository context you inspect. "
        "Do not modify files. If the task involves planning, use the beads conventions "
        "from the skill rather than generic project management advice."
    )


def extract_text_content(events: list[dict]) -> str:
    texts: list[str] = []
    for event in events:
        if event.get("type") != "assistant":
            continue
        message = event.get("message", {})
        for content in message.get("content", []):
            if content.get("type") == "text":
                texts.append(content.get("text", ""))
    return "\n\n".join(t for t in texts if t).strip()


def parse_stream_json(stdout: str) -> list[dict]:
    events: list[dict] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        events.append(json.loads(line))
    return events


def collect_tool_calls(events: list[dict]) -> list[dict]:
    calls: list[dict] = []
    for event in events:
        if event.get("type") != "assistant":
            continue
        message = event.get("message", {})
        for content in message.get("content", []):
            if content.get("type") == "tool_use":
                calls.append(
                    {
                        "name": content.get("name", "unknown"),
                        "input": content.get("input", {}),
                    }
                )
    return calls


def summarize_tool_calls(tool_calls: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for call in tool_calls:
        name = call["name"]
        counts[name] = counts.get(name, 0) + 1
    return counts


def build_transcript(
    prompt: str, mode: str, tool_calls: list[dict], response: str
) -> str:
    lines = [
        "# Validation Transcript",
        "",
        f"## Mode\n\n{mode}",
        "",
        f"## Eval Prompt\n\n{prompt}",
        "",
        "## Tool Calls",
        "",
    ]
    if tool_calls:
        for idx, call in enumerate(tool_calls, 1):
            lines.append(
                f"{idx}. **{call['name']}** `{json.dumps(call['input'], ensure_ascii=False)}`"
            )
    else:
        lines.append("No tool calls.")
    lines.extend(["", "## Final Response", "", response or "(No response text)", ""])
    return "\n".join(lines)


def run_eval(eval_item: dict, config: str, system_prompt: str | None) -> None:
    eval_id = eval_item["id"]
    eval_name = slugify(eval_item["expected_output"])
    eval_dir = ITERATION_DIR / f"eval-{eval_id}-{eval_name}"
    run_dir = eval_dir / config / "run-1"
    outputs_dir = run_dir / "outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)

    metadata = {
        "eval_id": eval_id,
        "eval_name": eval_name,
        "prompt": eval_item["prompt"],
        "assertions": eval_item.get("expectations", []),
    }
    (eval_dir / "eval_metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")

    cmd = [
        "claude",
        "-p",
        eval_item["prompt"],
        "--output-format",
        "stream-json",
        "--permission-mode",
        "bypassPermissions",
        "--tools",
        CONTENT_TOOLS,
    ]
    if system_prompt:
        cmd.extend(["--append-system-prompt", system_prompt])

    start = time.time()
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=180000,
    )
    duration_seconds = round(time.time() - start, 3)

    raw_path = run_dir / "raw_response.json"
    stderr_path = run_dir / "stderr.txt"
    raw_path.write_text(proc.stdout)
    stderr_path.write_text(proc.stderr)

    if proc.returncode != 0:
        raise RuntimeError(
            f"claude failed for eval {eval_id} config {config}: {proc.stderr[:500]}"
        )

    events = parse_stream_json(proc.stdout)
    result_event = next(
        (event for event in reversed(events) if event.get("type") == "result"), {}
    )
    response_text = extract_text_content(events)
    tool_calls = collect_tool_calls(events)
    tool_counts = summarize_tool_calls(tool_calls)

    (outputs_dir / "response.md").write_text(
        response_text + ("\n" if response_text else "")
    )
    (run_dir / "transcript.md").write_text(
        build_transcript(eval_item["prompt"], config, tool_calls, response_text)
    )

    metrics = {
        "tool_calls": tool_counts,
        "total_tool_calls": sum(tool_counts.values()),
        "total_steps": len(tool_calls) + 1,
        "files_created": ["response.md"],
        "errors_encountered": 0,
        "output_chars": len(response_text),
        "transcript_chars": len((run_dir / "transcript.md").read_text()),
    }
    (outputs_dir / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")

    timing = {
        "total_tokens": result_event.get("usage", {}).get("input_tokens", 0)
        + result_event.get("usage", {}).get("output_tokens", 0)
        + result_event.get("usage", {}).get("cache_read_input_tokens", 0)
        + result_event.get("usage", {}).get("cache_creation_input_tokens", 0),
        "duration_ms": result_event.get("duration_ms", int(duration_seconds * 1000)),
        "total_duration_seconds": round(
            result_event.get("duration_ms", duration_seconds * 1000) / 1000, 3
        ),
        "executor_duration_seconds": round(
            result_event.get("duration_ms", duration_seconds * 1000) / 1000, 3
        ),
    }
    (run_dir / "timing.json").write_text(json.dumps(timing, indent=2) + "\n")


def main() -> int:
    ITERATION_DIR.mkdir(parents=True, exist_ok=True)
    evals = json.loads(EVALS_PATH.read_text())["evals"]
    with_skill_prompt = build_with_skill_prompt()

    for eval_item in evals:
        run_eval(eval_item, "with_skill", with_skill_prompt)
        run_eval(eval_item, "without_skill", None)

    print(f"Wrote content validation runs to {ITERATION_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
