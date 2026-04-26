#!/usr/bin/env python3
"""Run functional evals in disposable workspaces with lifecycle hooks."""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from scripts.utils import (
    derive_runtime_skill_name,
    ensure_dir,
    hook_display_name,
    json_default,
    parse_skill_md,
    resolve_relative_path,
    sanitize_label,
)


DEFAULT_HOOK_TIMEOUT_SECONDS = 30

SKILL_EVAL_PREFLIGHT_HINT = (
    "This is a skill-eval preflight/infra problem. Fix it first, then rerun the eval. "
    "See docs/TESTING.md for the required preflight steps."
)


def _write_text(path: Path, content: str) -> None:
    ensure_dir(path.parent)
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


def _is_executable_file(path: str) -> bool:
    return os.path.isfile(path) and os.access(path, os.X_OK)


def _resolve_opencode_executable() -> tuple[str | None, str | None]:
    """Resolve an opencode executable path stable across isolated HOME environments.

    Prefers a direct executable from PATH when available. If PATH only provides a
    shim (or does not provide opencode), falls back to `mise which opencode` to
    obtain the concrete versioned install path.
    """

    which_path = shutil.which("opencode")
    if which_path:
        real_path = os.path.realpath(which_path)
        if _is_executable_file(real_path):
            return real_path, None
        return (
            None,
            (
                "opencode resolved on PATH but target is not executable: "
                f"{which_path} -> {real_path}"
            ),
        )

    mise_path = shutil.which("mise")
    if mise_path:
        proc = subprocess.run(
            [mise_path, "which", "opencode"],
            capture_output=True,
            text=True,
        )
        candidate = proc.stdout.strip()
        if proc.returncode == 0 and candidate and _is_executable_file(candidate):
            return candidate, None
        if proc.returncode == 0 and candidate:
            return (
                None,
                f"mise resolved opencode to non-executable path: {candidate}",
            )

        detail = proc.stderr.strip() or "unknown error"
        return None, f"failed to resolve opencode via mise: {detail}"

    return None, "opencode CLI not found on PATH and mise is unavailable"


def _build_eval_env(
    *,
    eval_id: str,
    eval_name: str,
    phase: str,
    workspace_root: Path,
    artifacts_root: Path,
    skill_root: Path,
    isolated_env: dict[str, str] | None = None,
) -> dict[str, str]:
    env = os.environ.copy()
    env["EVAL_ID"] = eval_id
    env["EVAL_NAME"] = eval_name
    env["EVAL_PHASE"] = phase
    env["EVAL_WORKSPACE"] = str(workspace_root)
    env["EVAL_ARTIFACTS_DIR"] = str(artifacts_root)
    env["EVAL_SKILL_ROOT"] = str(skill_root)
    if isolated_env:
        env.update(isolated_env)
    return env


def _hydrate_eval_files(
    skill_root: Path, workspace_root: Path, files: list[str]
) -> list[dict]:
    hydrated: list[dict] = []
    for relative_file in files:
        source = resolve_relative_path(skill_root, relative_file, "eval file")
        if not source.exists() or not source.is_file():
            raise FileNotFoundError(f"Eval file not found: {relative_file}")

        destination = resolve_relative_path(
            workspace_root,
            relative_file,
            "workspace hydration path",
        )
        ensure_dir(destination.parent)
        shutil.copy2(source, destination)
        hydrated.append(
            {
                "source": str(source),
                "destination": str(destination),
                "relative_path": relative_file,
            }
        )
    return hydrated


def _inject_runtime_skill(
    *,
    skill_root: Path,
    workspace_root: Path,
    runtime_skill_name: str,
) -> Path:
    destination = workspace_root / ".opencode" / "skills" / runtime_skill_name
    ensure_dir(destination.parent)
    if destination.exists():
        shutil.rmtree(destination)

    shutil.copytree(
        skill_root,
        destination,
        ignore=shutil.ignore_patterns("__pycache__", ".DS_Store", "eval-artifacts"),
    )
    return destination


def _prepare_sandbox_opencode_config(workspace_root: Path) -> Path:
    sandbox_opencode_dir = workspace_root / ".opencode"
    ensure_dir(sandbox_opencode_dir)
    (sandbox_opencode_dir / "opencode.json").write_text(
        json.dumps({"plugin": []}, indent=2) + "\n"
    )
    (sandbox_opencode_dir / ".gitignore").write_text("node_modules/\n")
    return sandbox_opencode_dir


def _prepare_isolated_opencode_environment(workspace_root: Path) -> dict[str, str]:
    isolated_root = workspace_root / ".eval-isolated-opencode"
    home_dir = isolated_root / "home"
    xdg_config_home = isolated_root / "xdg-config"
    xdg_data_home = isolated_root / "xdg-data"
    xdg_cache_home = isolated_root / "xdg-cache"
    opencode_config_dir = xdg_config_home / "opencode"

    ensure_dir(home_dir)
    ensure_dir(xdg_config_home)
    ensure_dir(xdg_data_home)
    ensure_dir(xdg_cache_home)
    ensure_dir(opencode_config_dir)

    (opencode_config_dir / "opencode.json").write_text(
        json.dumps({"plugin": []}, indent=2) + "\n"
    )

    return {
        "HOME": str(home_dir),
        "XDG_CONFIG_HOME": str(xdg_config_home),
        "XDG_DATA_HOME": str(xdg_data_home),
        "XDG_CACHE_HOME": str(xdg_cache_home),
        "OPENCODE_CONFIG_DIR": str(opencode_config_dir),
        "OPENCODE_DISABLE_DEFAULT_PLUGINS": "true",
    }


def _run_hook(
    *,
    hook: dict,
    hook_index: int,
    phase: str,
    skill_root: Path,
    workspace_root: Path,
    artifacts_root: Path,
    phase_artifacts_dir: Path,
    isolated_env: dict[str, str],
    verbose: bool = False,
) -> dict:
    script_value = hook.get("script")
    if not script_value or not isinstance(script_value, str):
        raise ValueError(f"Hook missing required script field in {phase} phase")

    args = hook.get("args") or []
    if not isinstance(args, list) or not all(isinstance(a, str) for a in args):
        raise ValueError(f"Hook args must be an array of strings: {script_value}")

    timeout_seconds = hook.get("timeout_seconds", DEFAULT_HOOK_TIMEOUT_SECONDS)
    if not isinstance(timeout_seconds, int) or timeout_seconds <= 0:
        raise ValueError(
            f"Hook timeout_seconds must be a positive integer: {script_value}"
        )

    resolved_script = resolve_relative_path(skill_root, script_value, "hook script")
    if not resolved_script.exists() or not resolved_script.is_file():
        raise FileNotFoundError(f"Hook script not found: {script_value}")

    display_name = hook_display_name(hook)
    hook_label = f"hook-{hook_index:02d}-{sanitize_label(display_name)}"
    hook_dir = phase_artifacts_dir / hook_label
    ensure_dir(hook_dir)

    command = [str(resolved_script), *args]
    env = _build_eval_env(
        eval_id=str(hook.get("_eval_id", "unknown")),
        eval_name=str(hook.get("_eval_name", "unknown")),
        phase=phase,
        workspace_root=workspace_root,
        artifacts_root=artifacts_root,
        skill_root=skill_root,
        isolated_env=isolated_env,
    )

    started_at = time.time()
    _verbose_log(
        verbose,
        (
            f"[{hook.get('_eval_id', 'unknown')}] {phase} hook start: {display_name} "
            f"(timeout={timeout_seconds}s)"
        ),
    )
    timed_out = False
    exit_code = None
    stdout_text = ""
    stderr_text = ""

    try:
        proc = subprocess.run(
            command,
            cwd=str(workspace_root),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            env=env,
        )
        exit_code = proc.returncode
        stdout_text = proc.stdout
        stderr_text = proc.stderr
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        stdout_text = _coerce_text(exc.stdout)
        stderr_text = _coerce_text(exc.stderr)

    finished_at = time.time()
    duration_seconds = round(finished_at - started_at, 3)

    _write_text(hook_dir / "stdout.log", stdout_text)
    _write_text(hook_dir / "stderr.log", stderr_text)

    if timed_out:
        hook_status = "TIMED OUT"
    elif exit_code == 0:
        hook_status = "PASS"
    else:
        hook_status = f"FAIL(exit={exit_code})"
    _verbose_log(
        verbose,
        (
            f"[{hook.get('_eval_id', 'unknown')}] {phase} hook end: {display_name} "
            f"-> {hook_status} in {duration_seconds:.3f}s"
        ),
    )

    result = {
        "display_name": display_name,
        "script": script_value,
        "resolved_script_path": str(resolved_script),
        "args": args,
        "timeout_seconds": timeout_seconds,
        "cwd": str(workspace_root),
        "phase": phase,
        "exit_code": exit_code,
        "timed_out": timed_out,
        "success": (not timed_out) and exit_code == 0,
        "started_at": started_at,
        "finished_at": finished_at,
        "duration_seconds": duration_seconds,
        "stdout": str(hook_dir / "stdout.log"),
        "stderr": str(hook_dir / "stderr.log"),
    }
    _write_text(
        hook_dir / "result.json", json.dumps(result, indent=2, default=json_default)
    )
    return result


def _run_model_execution(
    *,
    prompt: str,
    eval_id: str,
    eval_name: str,
    skill_root: Path,
    workspace_root: Path,
    artifacts_root: Path,
    execution_dir: Path,
    opencode_path: str,
    timeout_seconds: int,
    model: str | None,
    isolated_env: dict[str, str],
    verbose: bool = False,
) -> dict:
    ensure_dir(execution_dir)

    command = [
        opencode_path,
        "run",
        "--format",
        "json",
        "--print-logs",
        "--log-level",
        "DEBUG",
        prompt,
    ]
    if model:
        command.extend(["--model", model])

    env = _build_eval_env(
        eval_id=eval_id,
        eval_name=eval_name,
        phase="model_run",
        workspace_root=workspace_root,
        artifacts_root=artifacts_root,
        skill_root=skill_root,
        isolated_env=isolated_env,
    )

    started_at = time.time()
    _verbose_log(
        verbose,
        f"[{eval_id}] model run start (timeout={timeout_seconds}s)",
    )
    timed_out = False
    exit_code = None
    stdout_text = ""
    stderr_text = ""

    try:
        proc = subprocess.run(
            command,
            cwd=str(workspace_root),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            env=env,
        )
        exit_code = proc.returncode
        stdout_text = proc.stdout
        stderr_text = proc.stderr
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        stdout_text = _coerce_text(exc.stdout)
        stderr_text = _coerce_text(exc.stderr)

    finished_at = time.time()
    duration_seconds = round(finished_at - started_at, 3)

    _write_text(execution_dir / "stdout.ndjson", stdout_text)
    _write_text(execution_dir / "stderr.log", stderr_text)

    if timed_out:
        run_status = "TIMED OUT"
    elif exit_code == 0:
        run_status = "PASS"
    else:
        run_status = f"FAIL(exit={exit_code})"
    _verbose_log(
        verbose,
        f"[{eval_id}] model run end -> {run_status} in {duration_seconds:.3f}s",
    )

    result = {
        "ran": True,
        "skipped": False,
        "skipped_reason": None,
        "command": command,
        "cwd": str(workspace_root),
        "exit_code": exit_code,
        "timed_out": timed_out,
        "success": (not timed_out) and exit_code == 0,
        "started_at": started_at,
        "finished_at": finished_at,
        "duration_seconds": duration_seconds,
        "stdout": str(execution_dir / "stdout.ndjson"),
        "stderr": str(execution_dir / "stderr.log"),
    }
    _write_text(
        execution_dir / "result.json",
        json.dumps(result, indent=2, default=json_default),
    )
    return result


def _build_skipped_model_result(execution_dir: Path, reason: str) -> dict:
    ensure_dir(execution_dir)
    _write_text(execution_dir / "stdout.ndjson", "")
    _write_text(execution_dir / "stderr.log", "")
    result = {
        "ran": False,
        "skipped": True,
        "skipped_reason": reason,
        "command": None,
        "cwd": None,
        "exit_code": None,
        "timed_out": False,
        "success": False,
        "started_at": None,
        "finished_at": None,
        "duration_seconds": 0.0,
        "stdout": str(execution_dir / "stdout.ndjson"),
        "stderr": str(execution_dir / "stderr.log"),
    }
    _write_text(
        execution_dir / "result.json",
        json.dumps(result, indent=2, default=json_default),
    )
    return result


def _copy_workspace_snapshot(workspace_root: Path, snapshot_dir: Path) -> None:
    if snapshot_dir.exists():
        shutil.rmtree(snapshot_dir)
    ensure_dir(snapshot_dir.parent)
    shutil.copytree(workspace_root, snapshot_dir)


def run_single_eval(
    *,
    eval_entry: dict,
    run_label: str,
    skill_root: Path,
    runtime_skill_name: str,
    artifacts_root: Path,
    opencode_path: str,
    timeout_seconds: int,
    model: str | None,
    verbose: bool = False,
) -> dict:
    run_artifacts = artifacts_root / run_label
    hooks_before_dir = run_artifacts / "hooks" / "before_run"
    hooks_after_dir = run_artifacts / "hooks" / "after_run"
    execution_dir = run_artifacts / "execution"
    workspace_snapshot_dir = run_artifacts / "outputs" / "workspace"

    ensure_dir(hooks_before_dir)
    ensure_dir(hooks_after_dir)
    ensure_dir(execution_dir)

    eval_id = str(eval_entry.get("id", "unknown"))
    eval_name = str(eval_entry.get("name") or f"eval-{eval_id}")
    prompt = eval_entry.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError(f"Eval {eval_id} missing prompt")

    eval_files = eval_entry.get("files") or []
    if not isinstance(eval_files, list) or not all(
        isinstance(p, str) for p in eval_files
    ):
        raise ValueError(f"Eval {eval_id} files must be an array of strings")

    hooks = eval_entry.get("hooks") or {}
    if not isinstance(hooks, dict):
        raise ValueError(f"Eval {eval_id} hooks must be an object")

    before_hooks = hooks.get("before_run") or []
    after_hooks = hooks.get("after_run") or []
    if not isinstance(before_hooks, list) or not isinstance(after_hooks, list):
        raise ValueError(f"Eval {eval_id} hook phases must be arrays")

    before_results: list[dict] = []
    after_results: list[dict] = []
    hydrated_files: list[dict] = []

    setup_failed = False
    setup_failure_reason: str | None = None
    setup_error: str | None = None
    model_failed = False
    model_failure_reason: str | None = None
    model_error: str | None = None
    after_failed = False
    runtime_skill_path: Path | None = None
    model_result: dict | None = None
    isolated_env: dict[str, str] = {}

    workspace_root = Path(
        tempfile.mkdtemp(prefix=f"functional-eval-{sanitize_label(run_label)}-")
    ).resolve()
    started_at = time.time()
    _verbose_log(
        verbose,
        f"[{eval_id}] eval start: {run_label} (timeout={timeout_seconds}s)",
    )

    try:
        try:
            runtime_skill_path = _inject_runtime_skill(
                skill_root=skill_root,
                workspace_root=workspace_root,
                runtime_skill_name=runtime_skill_name,
            )
            _prepare_sandbox_opencode_config(workspace_root)
            isolated_env = _prepare_isolated_opencode_environment(workspace_root)

            hydrated_files = _hydrate_eval_files(skill_root, workspace_root, eval_files)

            for index, hook in enumerate(before_hooks, start=1):
                hook_with_eval = dict(hook)
                hook_with_eval["_eval_id"] = eval_id
                hook_with_eval["_eval_name"] = eval_name
                result = _run_hook(
                    hook=hook_with_eval,
                    hook_index=index,
                    phase="before_run",
                    skill_root=skill_root,
                    workspace_root=workspace_root,
                    artifacts_root=run_artifacts,
                    phase_artifacts_dir=hooks_before_dir,
                    isolated_env=isolated_env,
                    verbose=verbose,
                )
                before_results.append(result)
                if not result["success"]:
                    setup_failed = True
                    setup_failure_reason = "before_run_failed"
                    break
        except (
            Exception
        ) as exc:  # Ensure after_run still executes on setup/model errors
            if not setup_failed:
                setup_failed = True
                setup_failure_reason = "setup_exception"
            setup_error = str(exc)

        if setup_failed:
            skip_reason = setup_failure_reason or "setup_failed"
            _verbose_log(verbose, f"[{eval_id}] model run skipped: {skip_reason}")
            model_result = _build_skipped_model_result(execution_dir, skip_reason)
        else:
            try:
                model_result = _run_model_execution(
                    prompt=prompt,
                    eval_id=eval_id,
                    eval_name=eval_name,
                    skill_root=skill_root,
                    workspace_root=workspace_root,
                    artifacts_root=run_artifacts,
                    execution_dir=execution_dir,
                    opencode_path=opencode_path,
                    timeout_seconds=timeout_seconds,
                    model=model,
                    isolated_env=isolated_env,
                    verbose=verbose,
                )
            except Exception as exc:
                model_failed = True
                model_failure_reason = "model_execution_exception"
                model_error = str(exc)
                _verbose_log(
                    verbose,
                    f"[{eval_id}] model run exception: {model_error}",
                )
                model_result = _build_skipped_model_result(
                    execution_dir,
                    model_failure_reason,
                )

        for index, hook in enumerate(after_hooks, start=1):
            hook_with_eval = dict(hook)
            hook_with_eval["_eval_id"] = eval_id
            hook_with_eval["_eval_name"] = eval_name
            try:
                result = _run_hook(
                    hook=hook_with_eval,
                    hook_index=index,
                    phase="after_run",
                    skill_root=skill_root,
                    workspace_root=workspace_root,
                    artifacts_root=run_artifacts,
                    phase_artifacts_dir=hooks_after_dir,
                    isolated_env=isolated_env,
                    verbose=verbose,
                )
            except Exception as exc:
                result = {
                    "display_name": hook_display_name(hook),
                    "script": str(hook.get("script", "")),
                    "resolved_script_path": None,
                    "args": hook.get("args") or [],
                    "timeout_seconds": hook.get(
                        "timeout_seconds", DEFAULT_HOOK_TIMEOUT_SECONDS
                    ),
                    "cwd": str(workspace_root),
                    "phase": "after_run",
                    "exit_code": None,
                    "timed_out": False,
                    "success": False,
                    "started_at": None,
                    "finished_at": None,
                    "duration_seconds": 0.0,
                    "stdout": None,
                    "stderr": None,
                    "error": str(exc),
                }
            after_results.append(result)
            if not result["success"]:
                after_failed = True

        _copy_workspace_snapshot(workspace_root, workspace_snapshot_dir)

        finished_at = time.time()
        overall_success = (
            (not setup_failed)
            and (not model_failed)
            and bool(model_result and model_result.get("success", False))
            and (not after_failed)
        )
        eval_duration = round(finished_at - started_at, 3)
        if overall_success:
            eval_status = "PASS"
        elif setup_failed:
            eval_status = f"FAIL(setup:{setup_failure_reason})"
        elif model_failed:
            eval_status = f"FAIL(model:{model_failure_reason})"
        elif model_result and model_result.get("timed_out"):
            eval_status = "FAIL(model_timeout)"
        elif after_failed:
            eval_status = "FAIL(after_run)"
        else:
            eval_status = "FAIL"
        _verbose_log(
            verbose,
            f"[{eval_id}] eval end: {run_label} -> {eval_status} in {eval_duration:.3f}s",
        )

        result = {
            "run_label": run_label,
            "eval_id": eval_id,
            "eval_name": eval_name,
            "prompt": prompt,
            "runtime_skill_name": runtime_skill_name,
            "runtime_skill_path": str(runtime_skill_path)
            if runtime_skill_path
            else None,
            "workspace_cleaned_up": False,
            "setup_failed": setup_failed,
            "setup_failure_reason": setup_failure_reason,
            "setup_error": setup_error,
            "model_failed": model_failed,
            "model_failure_reason": model_failure_reason,
            "model_error": model_error,
            "after_run_failed": after_failed,
            "success": overall_success,
            "started_at": started_at,
            "finished_at": finished_at,
            "duration_seconds": eval_duration,
            "hydrated_files": hydrated_files,
            "hooks": {
                "before_run": before_results,
                "after_run": after_results,
            },
            "model_execution": model_result,
            "artifacts": {
                "run_root": str(run_artifacts),
                "hooks_before_run": str(hooks_before_dir),
                "hooks_after_run": str(hooks_after_dir),
                "execution": str(execution_dir),
                "workspace_snapshot": str(workspace_snapshot_dir),
            },
        }
        _write_text(
            run_artifacts / "result.json",
            json.dumps(result, indent=2, default=json_default),
        )
        return result
    finally:
        shutil.rmtree(workspace_root, ignore_errors=True)


def run_functional_eval(
    *,
    skill_root: Path,
    eval_set: dict,
    artifacts_root: Path,
    opencode_path: str,
    timeout_seconds: int,
    model: str | None,
    eval_ids: set[int] | None,
    verbose: bool = False,
) -> dict:
    skill_name, _, _ = parse_skill_md(skill_root)
    runtime_skill_name = derive_runtime_skill_name(skill_name)

    evals = eval_set.get("evals")
    if not isinstance(evals, list):
        raise ValueError("Functional eval schema invalid: 'evals' must be an array")

    selected_evals: list[dict] = []
    for entry in evals:
        if not isinstance(entry, dict):
            raise ValueError("Each eval entry must be an object")
        entry_id = entry.get("id")
        if not isinstance(entry_id, int):
            raise ValueError("Each eval entry requires integer 'id'")
        if eval_ids and entry_id not in eval_ids:
            continue
        selected_evals.append(entry)

    ensure_dir(artifacts_root)
    run_results = []
    _verbose_log(
        verbose,
        f"Functional eval run start: {len(selected_evals)} eval(s), timeout={timeout_seconds}s",
    )
    for index, entry in enumerate(selected_evals, start=1):
        entry_id = entry["id"]
        run_label = f"eval-{entry_id:03d}-run-{index:02d}"
        _verbose_log(
            verbose,
            f"Queue eval {index}/{len(selected_evals)}: id={entry_id} label={run_label}",
        )
        run_result = run_single_eval(
            eval_entry=entry,
            run_label=run_label,
            skill_root=skill_root,
            runtime_skill_name=runtime_skill_name,
            artifacts_root=artifacts_root,
            opencode_path=opencode_path,
            timeout_seconds=timeout_seconds,
            model=model,
            verbose=verbose,
        )
        run_result["workspace_cleaned_up"] = True
        _write_text(
            Path(run_result["artifacts"]["run_root"]) / "result.json",
            json.dumps(run_result, indent=2, default=json_default),
        )
        run_results.append(run_result)

    passed = sum(1 for r in run_results if r.get("success"))
    total = len(run_results)
    output = {
        "engine": "opencode-functional-eval-runner",
        "skill_name": skill_name,
        "runtime_skill_name": runtime_skill_name,
        "artifacts_dir": str(artifacts_root),
        "eval_count": total,
        "results": run_results,
        "summary": {
            "total": total,
            "passed": passed,
            "failed": total - passed,
        },
    }
    _write_text(
        artifacts_root / "summary.json",
        json.dumps(output, indent=2, default=json_default),
    )
    _verbose_log(
        verbose,
        (
            "Functional eval run end: "
            f"passed={output['summary']['passed']}/{output['summary']['total']} "
            f"failed={output['summary']['failed']}"
        ),
    )
    return output


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run functional evals in disposable workspaces"
    )
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument(
        "--eval-set",
        default=None,
        help="Path to functional eval schema (defaults to <skill-path>/evals/evals.json)",
    )
    parser.add_argument(
        "--artifacts-dir",
        default=None,
        help="Directory where functional run artifacts are written",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=180,
        help="Timeout for model execution in seconds",
    )
    parser.add_argument("--model", default=None, help="Optional model override")
    parser.add_argument(
        "--eval-id",
        type=int,
        action="append",
        dest="eval_ids",
        help="Run only selected eval IDs (can be repeated)",
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Print progress to stderr"
    )
    args = parser.parse_args()

    if args.timeout <= 0:
        print("Error: --timeout must be a positive integer", file=sys.stderr)
        sys.exit(1)

    skill_root = Path(args.skill_path).resolve()
    if not (skill_root / "SKILL.md").exists():
        print(f"Error: No SKILL.md found at {skill_root}", file=sys.stderr)
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(1)

    eval_set_path = (
        Path(args.eval_set).resolve()
        if args.eval_set
        else (skill_root / "evals" / "evals.json").resolve()
    )
    if not eval_set_path.exists():
        print(
            f"Error: Functional eval set not found at {eval_set_path}", file=sys.stderr
        )
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(1)

    if eval_set_path.name != "evals.json":
        print(
            "Error: Functional runner only supports evals/evals.json schema",
            file=sys.stderr,
        )
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(1)

    opencode_path, opencode_error = _resolve_opencode_executable()
    if not opencode_path:
        print(
            f"Error: Unable to resolve executable opencode binary: {opencode_error}",
            file=sys.stderr,
        )
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(1)

    artifacts_root = (
        Path(args.artifacts_dir).resolve()
        if args.artifacts_dir
        else (
            skill_root
            / "eval-artifacts"
            / "functional"
            / time.strftime("%Y%m%d-%H%M%S")
        ).resolve()
    )

    try:
        eval_set = json.loads(eval_set_path.read_text())
    except json.JSONDecodeError as exc:
        print(
            f"Error: Functional eval set at {eval_set_path} is not valid JSON: {exc}",
            file=sys.stderr,
        )
        print(SKILL_EVAL_PREFLIGHT_HINT, file=sys.stderr)
        sys.exit(1)

    eval_ids = set(args.eval_ids) if args.eval_ids else None

    started = time.time()
    output = run_functional_eval(
        skill_root=skill_root,
        eval_set=eval_set,
        artifacts_root=artifacts_root,
        opencode_path=opencode_path,
        timeout_seconds=args.timeout,
        model=args.model,
        eval_ids=eval_ids,
        verbose=args.verbose,
    )
    finished = time.time()

    if args.verbose:
        summary = output["summary"]
        print(
            f"Functional evals: {summary['passed']}/{summary['total']} passed in {round(finished - started, 2)}s",
            file=sys.stderr,
        )
        print(f"Artifacts: {artifacts_root}", file=sys.stderr)

    print(json.dumps(output, indent=2, default=json_default))


if __name__ == "__main__":
    main()
