#!/usr/bin/env python3
"""Run trigger evaluation for a skill description using OpenCode CLI.

This script uses `opencode run --format json --print-logs --log-level DEBUG`
to execute prompts and detect whether a target skill was actually used.
"""

import argparse
import json
import shutil
import subprocess
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from scripts.utils import (
    derive_runtime_skill_name,
    derive_runtime_skill_names,
    parse_skill_md,
    replace_frontmatter_description,
)


def _json_default(value):
    if isinstance(value, Path):
        return str(value)
    return str(value)


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _prepare_sandbox_workspace(
    run_artifact_dir: Path,
    runtime_skill_name: str,
    skill_markdown: str,
    candidate_description: str,
) -> Path:
    sandbox = run_artifact_dir / "sandbox"
    skill_dir = sandbox / ".opencode" / "skills" / runtime_skill_name
    _ensure_dir(skill_dir)
    patched = replace_frontmatter_description(skill_markdown, candidate_description)
    (skill_dir / "SKILL.md").write_text(patched)
    (sandbox / ".opencode" / ".gitignore").write_text("node_modules/\n")
    return sandbox


def _build_prompt(user_query: str, description: str, skill_name: str) -> str:
    return (
        "You are being evaluated for skill-trigger behavior.\n"
        f"Target skill runtime name: {skill_name}\n"
        f"Candidate skill description: {description}\n"
        "Task: respond to the user request naturally and correctly. "
        "If a skill is appropriate, use it.\n\n"
        f"User request: {user_query}"
    )


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


def _extract_signal(
    stdout_text: str,
    stderr_text: str,
    runtime_skill_name: str,
    runtime_skill_names: list[str] | None = None,
) -> tuple[bool, dict]:
    events = _parse_ndjson_lines(stdout_text)
    candidate_names = runtime_skill_names or [runtime_skill_name]

    # Direct proof: skill tool use with target skill input
    for event in events:
        if event.get("type") != "tool_use":
            continue
        part = event.get("part", {})
        if part.get("tool") != "skill":
            continue
        state = part.get("state", {})
        input_obj = state.get("input", {})
        matched_name = input_obj.get("name")
        if matched_name in candidate_names:
            return True, {
                "reason": "tool_use",
                "tool": "skill",
                "input_name": matched_name,
                "matched_runtime_skill_names": candidate_names,
            }

    # Fallback proof from debug logs
    if any(
        f"permission=skill pattern={candidate_name}" in stderr_text
        for candidate_name in candidate_names
    ):
        return False, {
            "reason": "available_but_not_used",
            "skill_available": True,
            "matched_runtime_skill_names": candidate_names,
        }

    return False, {
        "reason": "no_signal",
        "skill_available": "service=skill count=" in stderr_text,
        "matched_runtime_skill_names": candidate_names,
    }


def run_single_query(
    query: str,
    skill_description: str,
    skill_markdown: str,
    runtime_skill_name: str,
    runtime_skill_names: list[str],
    timeout: int,
    artifacts_dir: str,
    run_label: str,
    model: str | None = None,
) -> dict:
    run_artifact_dir = Path(artifacts_dir) / run_label
    _ensure_dir(run_artifact_dir)
    sandbox = _prepare_sandbox_workspace(
        run_artifact_dir,
        runtime_skill_name,
        skill_markdown,
        skill_description,
    )

    prompt = _build_prompt(query, skill_description, runtime_skill_name)
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

    try:
        started_at = time.time()
        proc = subprocess.run(
            cmd,
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        finished_at = time.time()

        triggered, detection = _extract_signal(
            proc.stdout,
            proc.stderr,
            runtime_skill_name,
            runtime_skill_names,
        )

        (run_artifact_dir / "stdout.ndjson").write_text(proc.stdout)
        (run_artifact_dir / "stderr.log").write_text(proc.stderr)

        result = {
            "query": query,
            "run_label": run_label,
            "triggered": triggered,
            "returncode": proc.returncode,
            "started_at": started_at,
            "finished_at": finished_at,
            "duration_seconds": round(finished_at - started_at, 3),
            "detection": detection,
            "artifacts": {
                "stdout": str(run_artifact_dir / "stdout.ndjson"),
                "stderr": str(run_artifact_dir / "stderr.log"),
            },
        }
        (run_artifact_dir / "result.json").write_text(
            json.dumps(result, indent=2, default=_json_default)
        )
        return result
    finally:
        shutil.rmtree(sandbox, ignore_errors=True)


def run_eval(
    eval_set: list[dict],
    skill_name: str,
    skill_markdown: str,
    description: str,
    num_workers: int,
    timeout: int,
    artifacts_dir: Path,
    runs_per_query: int = 1,
    trigger_threshold: float = 0.5,
    model: str | None = None,
) -> dict:
    runtime_skill_name = derive_runtime_skill_name(skill_name)
    runtime_skill_names = derive_runtime_skill_names(skill_name)
    _ensure_dir(artifacts_dir)

    futures = {}
    per_query_runs: dict[str, list[dict]] = {}
    per_query_expected: dict[str, bool] = {}

    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        for idx, item in enumerate(eval_set):
            per_query_expected[item["query"]] = bool(item["should_trigger"])
            for run_idx in range(runs_per_query):
                run_label = f"query-{idx:03d}-run-{run_idx + 1:02d}"
                fut = executor.submit(
                    run_single_query,
                    item["query"],
                    description,
                    skill_markdown,
                    runtime_skill_name,
                    runtime_skill_names,
                    timeout,
                    str(artifacts_dir),
                    run_label,
                    model,
                )
                futures[fut] = item["query"]

        for fut in as_completed(futures):
            query = futures[fut]
            if query not in per_query_runs:
                per_query_runs[query] = []
            try:
                per_query_runs[query].append(fut.result())
            except Exception as exc:
                per_query_runs[query].append(
                    {
                        "query": query,
                        "triggered": False,
                        "error": str(exc),
                        "detection": {"reason": "runner_exception"},
                    }
                )

    results = []
    for query, runs in per_query_runs.items():
        should_trigger = per_query_expected[query]
        triggers = sum(1 for r in runs if r.get("triggered"))
        total = len(runs)
        trigger_rate = triggers / total if total else 0.0
        if should_trigger:
            did_pass = trigger_rate >= trigger_threshold
        else:
            did_pass = trigger_rate < trigger_threshold
        results.append(
            {
                "query": query,
                "should_trigger": should_trigger,
                "triggers": triggers,
                "runs": total,
                "trigger_rate": trigger_rate,
                "pass": did_pass,
                "run_details": runs,
            }
        )

    results.sort(key=lambda x: x["query"])
    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    return {
        "engine": "opencode-run-json-debug",
        "skill_name": skill_name,
        "runtime_skill_name": runtime_skill_name,
        "runtime_skill_names": runtime_skill_names,
        "description": description,
        "artifacts_dir": str(artifacts_dir),
        "results": results,
        "summary": {
            "total": total,
            "passed": passed,
            "failed": total - passed,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run trigger evaluation for a skill description with OpenCode CLI"
    )
    parser.add_argument("--eval-set", required=True, help="Path to eval set JSON file")
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument(
        "--description", default=None, help="Override description to test"
    )
    parser.add_argument(
        "--num-workers", type=int, default=4, help="Number of parallel workers"
    )
    parser.add_argument(
        "--timeout", type=int, default=120, help="Timeout per query in seconds"
    )
    parser.add_argument(
        "--runs-per-query", type=int, default=1, help="Number of runs per query"
    )
    parser.add_argument(
        "--trigger-threshold", type=float, default=0.5, help="Trigger rate threshold"
    )
    parser.add_argument(
        "--model", default=None, help="Optional model override for opencode run"
    )
    parser.add_argument(
        "--artifacts-dir",
        default=None,
        help="Directory for raw run artifacts (stdout/stderr/result)",
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Print progress to stderr"
    )
    args = parser.parse_args()

    eval_set = json.loads(Path(args.eval_set).read_text())
    skill_path = Path(args.skill_path)
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        sys.exit(1)

    name, original_description, skill_markdown = parse_skill_md(skill_path)
    description = args.description or original_description

    artifacts_dir = (
        Path(args.artifacts_dir)
        if args.artifacts_dir
        else skill_path / "eval-artifacts" / time.strftime("%Y%m%d-%H%M%S")
    )

    output = run_eval(
        eval_set=eval_set,
        skill_name=name,
        skill_markdown=skill_markdown,
        description=description,
        num_workers=args.num_workers,
        timeout=args.timeout,
        artifacts_dir=artifacts_dir,
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        model=args.model,
    )

    if args.verbose:
        summary = output["summary"]
        print(
            f"Results: {summary['passed']}/{summary['total']} passed; artifacts: {artifacts_dir}",
            file=sys.stderr,
        )
        for r in output["results"]:
            status = "PASS" if r["pass"] else "FAIL"
            print(
                f"  [{status}] {r['triggers']}/{r['runs']} expected={r['should_trigger']}: {r['query'][:100]}",
                file=sys.stderr,
            )

    print(json.dumps(output, indent=2, default=_json_default))


if __name__ == "__main__":
    main()
