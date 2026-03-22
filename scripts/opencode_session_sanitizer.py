#!/usr/bin/env python3

"""Sanitize oversized OpenCode session message diff payloads safely.

This script is designed for very large shared OpenCode databases. It avoids
full-table scans over `message.data` and instead works on an explicit scope:

- one or more session IDs, or
- all sessions for a specific project directory

It processes one message row at a time, prints progress continuously, and is
dry-run by default.
"""

from __future__ import annotations

import argparse
import fnmatch
import gc
import json
import os
import shutil
import sqlite3
import sys
import time
from pathlib import Path
from typing import Iterable


DEFAULT_DB = Path.home() / ".local/share/opencode/opencode.db"
DEFAULT_CACHE_DIR = Path.home() / ".cache/opencode"
DEFAULT_SESSION_DIFF_DIR = Path.home() / ".local/share/opencode/storage/session_diff"

DEFAULT_EXCLUDE_PATTERNS = [
    ".beads/**",
    ".agent-history/**",
    ".git/**",
    ".dolt/**",
    "build/**",
    "dist/**",
    "target/**",
    "coverage/**",
    "**/*.log",
    "**/*.jsonl",
    "**/MANIFEST.json",
    "**/EVENTS.jsonl",
    "**/.ninja_log",
    "**/build.ninja",
    "**/CMakeConfigureLog.yaml",
]


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sanitize oversized OpenCode message summary diffs without full DB scans.",
    )
    parser.add_argument(
        "--db",
        default=str(DEFAULT_DB),
        help=f"Path to opencode.db (default: {DEFAULT_DB})",
    )
    parser.add_argument(
        "--project-dir",
        help="Only process sessions whose session.directory exactly matches this path.",
    )
    parser.add_argument(
        "--session-id",
        action="append",
        default=[],
        help="Process this session ID. Repeat to provide more than one.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write changes. Default is dry-run.",
    )
    parser.add_argument(
        "--clear-cache",
        action="store_true",
        help=f"Delete {DEFAULT_CACHE_DIR} before DB work.",
    )
    parser.add_argument(
        "--clear-session-diff",
        action="store_true",
        help=f"Delete {DEFAULT_SESSION_DIFF_DIR} before DB work.",
    )
    parser.add_argument(
        "--max-diff-bytes",
        type=int,
        default=200_000,
        help="Trim any summary diff whose before+after bytes exceed this value (default: 200000).",
    )
    parser.add_argument(
        "--exclude-pattern",
        action="append",
        default=[],
        help="Additional glob pattern for files whose inline diff bodies should always be trimmed.",
    )
    parser.add_argument(
        "--backup-jsonl",
        help="When --apply is used, append original changed rows to this JSONL file for rollback.",
    )
    parser.add_argument(
        "--list-sessions",
        action="store_true",
        help="List matching sessions and exit without inspecting messages.",
    )
    args = parser.parse_args()

    if not args.project_dir and not args.session_id:
        parser.error("provide at least one --session-id or a --project-dir scope")

    if args.backup_jsonl and not args.apply:
        parser.error("--backup-jsonl requires --apply")

    return args


def remove_path(target: Path) -> None:
    if not target.exists():
        print(f"cleanup skip missing: {target}")
        return
    if target.is_dir():
        shutil.rmtree(target)
        print(f"cleanup removed dir: {target}")
    else:
        target.unlink()
        print(f"cleanup removed file: {target}")


def get_connection(db_path: Path, writable: bool) -> sqlite3.Connection:
    if writable:
        conn = sqlite3.connect(db_path)
    else:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.execute("pragma query_only=on")
    conn.row_factory = sqlite3.Row
    return conn


def resolve_sessions(
    conn: sqlite3.Connection, project_dir: str | None, session_ids: list[str]
) -> list[sqlite3.Row]:
    rows: list[sqlite3.Row] = []
    seen: set[str] = set()
    cur = conn.cursor()

    for sid in session_ids:
        row = cur.execute(
            "select id, title, directory, time_created, time_updated from session where id=?",
            (sid,),
        ).fetchone()
        if row and row["id"] not in seen:
            rows.append(row)
            seen.add(row["id"])

    if project_dir:
        for row in cur.execute(
            "select id, title, directory, time_created, time_updated from session where directory=? order by time_updated desc",
            (project_dir,),
        ):
            if row["id"] not in seen:
                rows.append(row)
                seen.add(row["id"])

    rows.sort(
        key=lambda row: (row["time_updated"] or 0, row["time_created"] or 0),
        reverse=True,
    )
    return rows


def matches_pattern(path: str, patterns: Iterable[str]) -> bool:
    normalized = path.replace("\\", "/")
    for pattern in patterns:
        if fnmatch.fnmatch(normalized, pattern):
            return True
    return False


def summarize_trim(
    path: str, before: str | None, after: str | None
) -> dict[str, object]:
    return {
        "file": path,
        "before_bytes": len(before or ""),
        "after_bytes": len(after or ""),
        "trimmed": True,
    }


def sanitize_message(
    raw_json: str,
    max_diff_bytes: int,
    patterns: list[str],
) -> tuple[bool, str | None, dict[str, object]]:
    obj = json.loads(raw_json)
    summary = obj.get("summary")
    diffs = summary.get("diffs") if isinstance(summary, dict) else None

    if not isinstance(diffs, list) or not diffs:
        return (
            False,
            None,
            {"diff_count": 0, "trimmed_count": 0, "reason": "no_summary_diffs"},
        )

    changed = False
    trimmed_count = 0
    new_diffs: list[object] = []

    for diff in diffs:
        if not isinstance(diff, dict):
            new_diffs.append(diff)
            continue

        path = str(diff.get("file") or "")
        before = diff.get("before")
        after = diff.get("after")
        total_bytes = len(before or "") + len(after or "")

        if matches_pattern(path, patterns) or total_bytes > max_diff_bytes:
            replacement = dict(diff)
            replacement.pop("before", None)
            replacement.pop("after", None)
            replacement.update(summarize_trim(path, before, after))
            new_diffs.append(replacement)
            changed = True
            trimmed_count += 1
        else:
            new_diffs.append(diff)

    if not changed:
        return (
            False,
            None,
            {"diff_count": len(diffs), "trimmed_count": 0, "reason": "below_threshold"},
        )

    obj.setdefault("summary", {})["diffs"] = new_diffs
    compact_json = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    return (
        True,
        compact_json,
        {"diff_count": len(diffs), "trimmed_count": trimmed_count, "reason": "trimmed"},
    )


def write_backup_line(backup_path: Path, payload: dict[str, object]) -> None:
    with backup_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False))
        handle.write("\n")


def process_session(
    conn: sqlite3.Connection,
    session_row: sqlite3.Row,
    args: argparse.Namespace,
    patterns: list[str],
    backup_path: Path | None,
) -> dict[str, int]:
    sid = session_row["id"]
    title = session_row["title"] or ""
    print(f"session {sid} :: {title}")

    message_rows = conn.execute(
        "select id, data from message where session_id=? order by time_created",
        (sid,),
    )

    processed = 0
    changed = 0
    trimmed_diffs = 0

    for row in message_rows:
        processed += 1
        mid = row["id"]
        raw_json = row["data"]

        did_change, new_json, info = sanitize_message(
            raw_json,
            max_diff_bytes=args.max_diff_bytes,
            patterns=patterns,
        )
        print(
            f"  message {processed} id={mid} bytes={len(raw_json)} diffs={info['diff_count']} trimmed={info['trimmed_count']} action={'update' if did_change else 'skip'}"
        )

        if did_change:
            changed += 1
            trimmed_count = info.get("trimmed_count", 0)
            trimmed_diffs += trimmed_count if isinstance(trimmed_count, int) else 0
            if args.apply:
                if backup_path is not None:
                    write_backup_line(
                        backup_path,
                        {
                            "session_id": sid,
                            "message_id": mid,
                            "original_data": raw_json,
                        },
                    )
                conn.execute(
                    "update message set data=?, time_updated=? where id=?",
                    (new_json, int(time.time() * 1000), mid),
                )
                conn.commit()

        del raw_json
        gc.collect()

    print(
        f"session done {sid}: processed_messages={processed} changed_messages={changed} trimmed_diffs={trimmed_diffs}"
    )
    return {
        "processed_messages": processed,
        "changed_messages": changed,
        "trimmed_diffs": trimmed_diffs,
    }


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).expanduser()
    if not db_path.exists():
        eprint(f"database not found: {db_path}")
        return 2

    if args.clear_cache:
        remove_path(DEFAULT_CACHE_DIR)
    if args.clear_session_diff:
        remove_path(DEFAULT_SESSION_DIFF_DIR)

    patterns = [*DEFAULT_EXCLUDE_PATTERNS, *args.exclude_pattern]
    conn = get_connection(db_path, writable=args.apply)

    try:
        sessions = resolve_sessions(conn, args.project_dir, args.session_id)
        if not sessions:
            print("no matching sessions")
            return 0

        print(f"db={db_path}")
        print(f"mode={'apply' if args.apply else 'dry-run'}")
        print(f"matching_sessions={len(sessions)}")
        for row in sessions:
            print(
                f"  session={row['id']} updated={row['time_updated']} directory={row['directory']} title={row['title']}"
            )

        if args.list_sessions:
            return 0

        backup_path = (
            Path(args.backup_jsonl).expanduser() if args.backup_jsonl else None
        )
        if backup_path is not None:
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            print(f"backup_jsonl={backup_path}")

        totals = {"processed_messages": 0, "changed_messages": 0, "trimmed_diffs": 0}
        for index, session_row in enumerate(sessions, start=1):
            print(f"=== [{index}/{len(sessions)}] ===")
            stats = process_session(conn, session_row, args, patterns, backup_path)
            for key, value in stats.items():
                totals[key] += value

        print("summary")
        print(f"  processed_messages={totals['processed_messages']}")
        print(f"  changed_messages={totals['changed_messages']}")
        print(f"  trimmed_diffs={totals['trimmed_diffs']}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
