#!/usr/bin/env python3
"""Run trigger evaluation for a skill description using OpenCode CLI.

This script uses `opencode run --format json --print-logs --log-level DEBUG`
to execute prompts and detect whether a target skill was actually used.
"""

import argparse
import json
import os
import re
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


def _write_text(path: Path, content: str) -> None:
    _ensure_dir(path.parent)
    path.write_text(content)


def _coerce_text(value: str | bytes | None) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _verbose_log(enabled: bool, message: str) -> None:
    if not enabled:
        return
    print(message, file=sys.stderr, flush=True)


class OpencodeCommandError(RuntimeError):
    def __init__(self, message: str, *, details: dict) -> None:
        super().__init__(message)
        self.details = details


SKILL_EVAL_PREFLIGHT_HINT = (
    "This is a skill-eval preflight/infra problem. Fix it first, then rerun the eval. "
    "See docs/TESTING.md for the required preflight steps."
)


def _classify_opencode_startup_exception(exc: Exception) -> dict:
    startup_error_kind = "os_error"
    if isinstance(exc, FileNotFoundError):
        startup_error_kind = "not_found"
    elif isinstance(exc, PermissionError):
        startup_error_kind = "not_executable"

    details = {
        "reason": "opencode_startup_error",
        "startup_error_kind": startup_error_kind,
        "error_type": type(exc).__name__,
        "error": str(exc),
    }
    errno = getattr(exc, "errno", None)
    if errno is not None:
        details["errno"] = errno
    return details


def _validate_opencode_command(opencode_path: str) -> dict:
    resolved = Path(opencode_path)
    resolved_command = opencode_path

    # Preserve PATH-based command resolution for bare command names.
    # This keeps programmatic callers compatible when they pass "opencode".
    if not resolved.exists() and resolved.name == opencode_path:
        resolved_from_path = shutil.which(opencode_path)
        if resolved_from_path:
            resolved = Path(resolved_from_path)
            resolved_command = resolved_from_path

    details = {
        "command": opencode_path,
        "resolved_command": resolved_command,
        "resolved_path": str(resolved),
    }

    if not resolved.exists():
        details.update(
            {
                "reason": "opencode_preflight_failed",
                "failure_kind": "path_missing",
            }
        )
        raise OpencodeCommandError(
            f"Resolved opencode path does not exist: {resolved}", details=details
        )

    if resolved.is_dir():
        details.update(
            {
                "reason": "opencode_preflight_failed",
                "failure_kind": "path_is_directory",
            }
        )
        raise OpencodeCommandError(
            f"Resolved opencode path is a directory: {resolved}", details=details
        )

    if not os.access(resolved, os.X_OK):
        details.update(
            {
                "reason": "opencode_preflight_failed",
                "failure_kind": "not_executable",
            }
        )
        raise OpencodeCommandError(
            f"Resolved opencode path is not executable: {resolved}", details=details
        )

    try:
        probe = subprocess.run(
            [resolved_command, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception as exc:
        details.update(
            {
                "reason": "opencode_preflight_failed",
                "failure_kind": "startup_exception",
                "startup": _classify_opencode_startup_exception(exc),
            }
        )
        raise OpencodeCommandError(
            "Resolved opencode command failed startup probe", details=details
        ) from exc

    details["probe"] = {
        "command": [resolved_command, "--version"],
        "returncode": probe.returncode,
        "stdout": probe.stdout,
        "stderr": probe.stderr,
    }
    if probe.returncode != 0:
        details.update(
            {
                "reason": "opencode_preflight_failed",
                "failure_kind": "startup_nonzero_exit",
            }
        )
        raise OpencodeCommandError(
            "Resolved opencode command failed startup probe with non-zero exit",
            details=details,
        )

    details.update(
        {
            "reason": "opencode_preflight_ok",
            "failure_kind": None,
        }
    )
    return details


def _prepare_sandbox_workspace(
    run_artifact_dir: Path,
    runtime_skill_name: str,
    skill_markdown: str,
    candidate_description: str,
    source_skill_path: Path | None = None,
) -> Path:
    sandbox = run_artifact_dir / "sandbox"
    skill_dir = sandbox / ".opencode" / "skills" / runtime_skill_name
    sandbox_opencode_dir = sandbox / ".opencode"
    _ensure_dir(skill_dir)

    if source_skill_path:
        source_references = source_skill_path / "references"
        if source_references.exists() and source_references.is_dir():
            shutil.copytree(source_references, skill_dir / "references")

    patched = replace_frontmatter_description(skill_markdown, candidate_description)
    (skill_dir / "SKILL.md").write_text(patched)

    # Keep trigger eval sandboxes lightweight and deterministic:
    # avoid loading user-level configured plugins that are unrelated to
    # skill-trigger routing and can consume a large portion of timeout budget.
    (sandbox_opencode_dir / "opencode.json").write_text(
        json.dumps({"plugin": []}, indent=2) + "\n"
    )
    (sandbox_opencode_dir / ".gitignore").write_text("node_modules/\n")
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


_REJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bdoes\s+not\s+own\b",
        r"\bdoes\s+not\s+cover\b",
        r"\bdoes\s+not\s+have\b",
        r"\boutside\s+(?:its|the)\s+(?:scope|ownership\s+boundary)\b",
        r"\bfalls\s+outside\b",
        r"\bnot\s+the\s+right\s+tool\b",
        r"\bnot\s+appropriate\b",
        r"\bout\s+of\s+scope\b",
    ]
]


def _extract_text_parts(events: list[dict], start_index: int) -> list[str]:
    snippets: list[str] = []
    for event in events[start_index:]:
        if event.get("type") != "text":
            continue
        text_part = event.get("part", {}).get("text")
        if isinstance(text_part, str) and text_part.strip():
            snippets.append(text_part)
    return snippets


def _detect_explicit_rejection(
    text_snippets: list[str], candidate_names: list[str]
) -> tuple[bool, str | None]:
    text_candidate_names = [
        candidate
        for candidate in candidate_names
        if "-" in candidate or len(candidate) >= 8
    ] or candidate_names

    for snippet in text_snippets:
        normalized = re.sub(r"[*_`]+", "", snippet)
        lowered = normalized.lower()
        if "skill" not in lowered:
            continue
        if not any(candidate.lower() in lowered for candidate in text_candidate_names):
            continue
        for pattern in _REJECTION_PATTERNS:
            if pattern.search(normalized):
                return True, snippet
    return False, None


_PLUGIN_HEALTH_QUERY_PATTERN = re.compile(
    r"\b(plugin\s+mode|aimgr|ai\s*manager|startup\s+failures?)\b",
    re.IGNORECASE,
)
_PLUGIN_HEALTH_REJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bthere\s+is\s+no\b[^\n]{0,120}\bplugin\s+mode\b",
        r"\bthere\s+is\s+no\b[^\n]{0,120}\baimgr\b",
        r"\bno\b[^\n]{0,120}\b(?:aimgr|ai\s*manager|plugin\s+mode)\b[^\n]{0,120}\bin\s+this\s+project\b",
        r"\bthis\s+(?:workspace|project)\s+is\b[^\n]{0,120}\bdocumentation\b",
    ]
]

_PLUGIN_HEALTH_ADJACENT_LOAD_PATTERN = re.compile(
    r"\bexplore\s+the\s+codebase\b[^\n]{0,180}\b(plugin\s+mode|aimgr)\b",
    re.IGNORECASE,
)


def _detect_implicit_scope_rejection(
    text_snippets: list[str], query: str
) -> tuple[bool, str | None]:
    if not _PLUGIN_HEALTH_QUERY_PATTERN.search(query):
        return False, None

    for snippet in text_snippets:
        for pattern in _PLUGIN_HEALTH_REJECTION_PATTERNS:
            if pattern.search(snippet):
                return True, snippet
        if _PLUGIN_HEALTH_ADJACENT_LOAD_PATTERN.search(snippet):
            return True, snippet
    return False, None


def _extract_signal(
    stdout_text: str,
    stderr_text: str,
    query: str,
    runtime_skill_name: str,
    runtime_skill_names: list[str] | None = None,
) -> tuple[bool, dict]:
    events = _parse_ndjson_lines(stdout_text)
    candidate_names = runtime_skill_names or [runtime_skill_name]

    # Direct proof: skill tool use with target skill input.
    # If the model clearly rejects the skill after loading it, classify as
    # load_then_reject instead of a real trigger claim.
    matching_uses: list[tuple[int, str]] = []
    for idx, event in enumerate(events):
        if event.get("type") != "tool_use":
            continue
        part = event.get("part", {})
        if part.get("tool") != "skill":
            continue
        state = part.get("state", {})
        input_obj = state.get("input", {})
        matched_name = input_obj.get("name")
        if matched_name in candidate_names:
            matching_uses.append((idx, matched_name))

    if matching_uses:
        first_idx, first_match = matching_uses[0]
        text_after_load = _extract_text_parts(events, first_idx + 1)
        rejected, rejection_excerpt = _detect_explicit_rejection(
            text_after_load, candidate_names
        )
        if not rejected:
            rejected, rejection_excerpt = _detect_implicit_scope_rejection(
                text_after_load, query
            )
        if rejected:
            detection: dict = {
                "reason": "load_then_reject",
                "tool": "skill",
                "input_name": first_match,
                "matched_runtime_skill_names": candidate_names,
            }
            if rejection_excerpt:
                detection["rejection_excerpt"] = rejection_excerpt[:400]
            return False, detection

        return True, {
            "reason": "tool_use",
            "tool": "skill",
            "input_name": first_match,
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


def _is_decidable_signal(reason: str | None) -> bool:
    return reason in {
        "tool_use",
        "available_but_not_used",
        "load_then_reject",
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
    opencode_path: str = "opencode",
    source_skill_path: str | None = None,
) -> dict:
    run_artifact_dir = Path(artifacts_dir) / run_label
    _ensure_dir(run_artifact_dir)
    sandbox = _prepare_sandbox_workspace(
        run_artifact_dir,
        runtime_skill_name,
        skill_markdown,
        skill_description,
        Path(source_skill_path) if source_skill_path else None,
    )

    prompt = _build_prompt(query, skill_description, runtime_skill_name)
    cmd = [
        opencode_path,
        "run",
        "--pure",
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
    timed_out = False
    timeout_seconds = timeout
    stdout_text = ""
    stderr_text = ""
    returncode = None
    detection: dict = {"reason": "not_evaluated"}
    triggered = False
    decidable = False

    try:
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(sandbox),
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            returncode = proc.returncode
            stdout_text = proc.stdout
            stderr_text = proc.stderr

            triggered, detection = _extract_signal(
                stdout_text,
                stderr_text,
                query,
                runtime_skill_name,
                runtime_skill_names,
            )
            decidable = _is_decidable_signal(detection.get("reason"))
        except subprocess.TimeoutExpired as exc:
            timed_out = True
            stdout_text = _coerce_text(exc.stdout)
            stderr_text = _coerce_text(exc.stderr)
            triggered, signal_detection = _extract_signal(
                stdout_text,
                stderr_text,
                query,
                runtime_skill_name,
                runtime_skill_names,
            )

            timeout_reason = (
                "timeout_after_trigger" if triggered else "timeout_without_trigger"
            )
            if signal_detection.get("reason") == "load_then_reject":
                timeout_reason = "timeout_after_load_then_reject"

            detection = {
                "reason": timeout_reason,
                "timeout_seconds": timeout_seconds,
                "matched_runtime_skill_names": runtime_skill_names,
                "partial_signal": signal_detection,
            }
            decidable = _is_decidable_signal(signal_detection.get("reason"))
        except (FileNotFoundError, PermissionError, OSError) as exc:
            detection = _classify_opencode_startup_exception(exc)
            detection["matched_runtime_skill_names"] = runtime_skill_names
            decidable = False
        except Exception as exc:
            detection = {
                "reason": "runner_exception",
                "error": str(exc),
                "matched_runtime_skill_names": runtime_skill_names,
            }
            decidable = False

        finished_at = time.time()

        _write_text(run_artifact_dir / "stdout.ndjson", stdout_text)
        _write_text(run_artifact_dir / "stderr.log", stderr_text)

        result = {
            "query": query,
            "run_label": run_label,
            "triggered": triggered,
            "returncode": returncode,
            "timed_out": timed_out,
            "decidable": decidable,
            "timeout_seconds": timeout_seconds,
            "started_at": started_at,
            "finished_at": finished_at,
            "duration_seconds": round(finished_at - started_at, 3),
            "detection": detection,
            "artifacts": {
                "stdout": str(run_artifact_dir / "stdout.ndjson"),
                "stderr": str(run_artifact_dir / "stderr.log"),
            },
            "command": cmd,
            "cwd": str(sandbox),
        }
        _write_text(
            run_artifact_dir / "result.json",
            json.dumps(result, indent=2, default=_json_default),
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
    opencode_path: str = "opencode",
    verbose: bool = False,
    source_skill_path: Path | None = None,
) -> dict:
    runtime_skill_name = derive_runtime_skill_name(skill_name)
    runtime_skill_names = derive_runtime_skill_names(skill_name)
    _ensure_dir(artifacts_dir)

    preflight = _validate_opencode_command(opencode_path)
    _write_text(
        artifacts_dir / "opencode-preflight.json",
        json.dumps(preflight, indent=2, default=_json_default),
    )

    futures = {}
    future_meta: dict = {}
    per_query_runs: dict[str, list[dict]] = {}
    per_query_expected: dict[str, bool] = {}
    total_submissions = len(eval_set) * runs_per_query
    completed_runs = 0

    _verbose_log(
        verbose,
        (
            f"Trigger eval run start: queries={len(eval_set)} "
            f"runs_per_query={runs_per_query} timeout={timeout}s workers={num_workers}"
        ),
    )

    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        for idx, item in enumerate(eval_set):
            per_query_expected[item["query"]] = bool(item["should_trigger"])
            for run_idx in range(runs_per_query):
                run_label = f"query-{idx:03d}-run-{run_idx + 1:02d}"
                submission_number = len(futures) + 1
                _verbose_log(
                    verbose,
                    (
                        f"[{submission_number}/{total_submissions}] start {run_label} "
                        f"timeout={timeout}s query={item['query'][:80]}"
                    ),
                )
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
                    opencode_path,
                    str(source_skill_path) if source_skill_path else None,
                )
                futures[fut] = item["query"]
                future_meta[fut] = {
                    "run_label": run_label,
                    "query": item["query"],
                    "submission_number": submission_number,
                    "submitted_at": time.time(),
                }

        for fut in as_completed(futures):
            query = futures[fut]
            meta = future_meta[fut]
            if query not in per_query_runs:
                per_query_runs[query] = []
            try:
                run_result = fut.result()
                per_query_runs[query].append(run_result)
                completed_runs += 1

                if run_result.get("timed_out"):
                    status = "TIMED OUT"
                elif run_result.get("returncode") == 0:
                    status = "PASS"
                elif (
                    run_result.get("detection", {}).get("reason")
                    == "opencode_startup_error"
                ):
                    startup_kind = run_result.get("detection", {}).get(
                        "startup_error_kind", "unknown"
                    )
                    status = f"FAIL(startup_error={startup_kind})"
                elif run_result.get("returncode") is None:
                    status = f"FAIL({run_result.get('detection', {}).get('reason', 'unknown')})"
                else:
                    status = f"FAIL(exit={run_result.get('returncode')})"
                _verbose_log(
                    verbose,
                    (
                        f"[{completed_runs}/{total_submissions}] end {meta['run_label']} -> {status} "
                        f"in {run_result.get('duration_seconds', 0.0):.3f}s"
                    ),
                )
            except Exception as exc:
                completed_runs += 1
                duration = round(time.time() - meta["submitted_at"], 3)
                failed_result = {
                    "query": query,
                    "run_label": meta["run_label"],
                    "triggered": False,
                    "returncode": None,
                    "timed_out": False,
                    "timeout_seconds": timeout,
                    "started_at": meta["submitted_at"],
                    "finished_at": time.time(),
                    "duration_seconds": duration,
                    "detection": {
                        "reason": "worker_exception",
                        "error": str(exc),
                        "matched_runtime_skill_names": runtime_skill_names,
                    },
                    "artifacts": {
                        "stdout": None,
                        "stderr": None,
                    },
                }
                per_query_runs[query].append(failed_result)
                _verbose_log(
                    verbose,
                    (
                        f"[{completed_runs}/{total_submissions}] end {meta['run_label']} "
                        f"-> FAIL(worker_exception) in {duration:.3f}s"
                    ),
                )

    results = []
    for query, runs in per_query_runs.items():
        should_trigger = per_query_expected[query]
        triggers = sum(1 for r in runs if r.get("triggered"))
        total = len(runs)
        decidable_runs = sum(1 for r in runs if r.get("decidable"))
        success_count = sum(
            1
            for r in runs
            if r.get("decidable") and (r.get("triggered") == should_trigger)
        )
        trigger_rate = triggers / total if total else 0.0
        success_rate = success_count / total if total else 0.0
        if should_trigger:
            did_pass = success_rate >= trigger_threshold
        else:
            did_pass = success_rate >= trigger_threshold
        results.append(
            {
                "query": query,
                "should_trigger": should_trigger,
                "triggers": triggers,
                "runs": total,
                "trigger_rate": trigger_rate,
                "decidable_runs": decidable_runs,
                "success_count": success_count,
                "success_rate": success_rate,
                "pass": did_pass,
                "run_details": runs,
            }
        )

    results.sort(key=lambda x: x["query"])
    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    timed_out_runs = 0
    undecidable_runs = 0
    worker_exception_runs = 0
    opencode_startup_error_runs = 0
    for grouped in results:
        for run in grouped.get("run_details", []):
            if run.get("timed_out"):
                timed_out_runs += 1
            if not run.get("decidable"):
                undecidable_runs += 1
            reason = run.get("detection", {}).get("reason")
            if reason == "worker_exception":
                worker_exception_runs += 1
            if reason == "opencode_startup_error":
                opencode_startup_error_runs += 1
    _verbose_log(
        verbose,
        (
            "Trigger eval run end: "
            f"passed={passed}/{total} failed={total - passed} "
            f"timed_out_runs={timed_out_runs} undecidable_runs={undecidable_runs} "
            f"worker_exception_runs={worker_exception_runs} "
            f"opencode_startup_error_runs={opencode_startup_error_runs}"
        ),
    )
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
            "timed_out_runs": timed_out_runs,
            "undecidable_runs": undecidable_runs,
            "worker_exception_runs": worker_exception_runs,
            "opencode_startup_error_runs": opencode_startup_error_runs,
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

    if args.timeout <= 0:
        print("Error: --timeout must be a positive integer", file=sys.stderr)
        sys.exit(1)

    eval_set_path = Path(args.eval_set).resolve()
    if not eval_set_path.exists():
        print(f"Error: Trigger eval set not found at {eval_set_path}", file=sys.stderr)
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(1)

    try:
        eval_set = json.loads(eval_set_path.read_text())
    except json.JSONDecodeError as exc:
        print(
            f"Error: Trigger eval set at {eval_set_path} is not valid JSON: {exc}",
            file=sys.stderr,
        )
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(1)

    skill_path = Path(args.skill_path)
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(1)

    name, original_description, skill_markdown = parse_skill_md(skill_path)
    description = args.description or original_description

    opencode_path = shutil.which("opencode")
    if not opencode_path:
        print("Error: opencode CLI not found on PATH", file=sys.stderr)
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(1)

    artifacts_dir = (
        Path(args.artifacts_dir)
        if args.artifacts_dir
        else skill_path / "eval-artifacts" / time.strftime("%Y%m%d-%H%M%S")
    )

    try:
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
            opencode_path=opencode_path,
            verbose=args.verbose,
            source_skill_path=skill_path,
        )
    except OpencodeCommandError as exc:
        error_payload = {
            "error": "opencode_preflight_failed",
            "message": str(exc),
            "details": exc.details,
            "artifacts_dir": str(artifacts_dir),
        }
        _write_text(
            artifacts_dir / "opencode-preflight-error.json",
            json.dumps(error_payload, indent=2, default=_json_default),
        )
        print(f"Error: {exc}", file=sys.stderr)
        print(
            f"See preflight artifact: {artifacts_dir / 'opencode-preflight-error.json'}",
            file=sys.stderr,
        )
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(2)

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
