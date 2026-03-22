#!/usr/bin/env python3

"""Delete old OpenCode sessions safely.

This script is dry-run by default and avoids scanning large message payloads.
It deletes from the `session` table only and relies on SQLite foreign-key
cascade rules to remove rows from related tables such as message, part, todo,
and session_share.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from pathlib import Path


DEFAULT_DB = Path.home() / ".local/share/opencode/opencode.db"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete OpenCode sessions older than a given age. Dry-run by default.",
    )
    parser.add_argument(
        "--db",
        default=str(DEFAULT_DB),
        help=f"Path to opencode.db (default: {DEFAULT_DB})",
    )
    parser.add_argument(
        "--older-than-days",
        type=int,
        required=True,
        help="Delete sessions whose time_updated is older than this many days.",
    )
    parser.add_argument(
        "--project-dir",
        help="Only delete sessions whose session.directory exactly matches this path.",
    )
    parser.add_argument(
        "--archived-only",
        action="store_true",
        help="Only delete sessions that have time_archived set.",
    )
    parser.add_argument(
        "--children-only",
        action="store_true",
        help="Only delete child sessions (session.parent_id is not null).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Only act on the first N matching sessions (ordered oldest first).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete sessions. Default is dry-run.",
    )
    return parser.parse_args()


def get_connection(db_path: Path, writable: bool) -> sqlite3.Connection:
    if writable:
        conn = sqlite3.connect(db_path)
    else:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.execute("pragma query_only=on")
    conn.row_factory = sqlite3.Row
    return conn


def build_query(args: argparse.Namespace, cutoff_ms: int) -> tuple[str, list[object]]:
    conditions = ["time_updated < ?"]
    params: list[object] = [cutoff_ms]

    if args.project_dir:
        conditions.append("directory = ?")
        params.append(args.project_dir)

    if args.archived_only:
        conditions.append("time_archived is not null")

    if args.children_only:
        conditions.append("parent_id is not null")

    where_clause = " and ".join(conditions)
    query = (
        "select id, parent_id, directory, title, time_created, time_updated, time_archived "
        f"from session where {where_clause} order by time_updated asc"
    )

    if args.limit is not None:
        query += " limit ?"
        params.append(args.limit)

    return query, params


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).expanduser()

    if not db_path.exists():
        print(f"database not found: {db_path}", file=sys.stderr)
        return 2

    cutoff_ms = int((time.time() - args.older_than_days * 86400) * 1000)
    mode = "apply" if args.apply else "dry-run"
    print(f"db={db_path}")
    print(f"mode={mode}")
    print(f"older_than_days={args.older_than_days}")
    print(f"cutoff_ms={cutoff_ms}")
    if args.project_dir:
        print(f"project_dir={args.project_dir}")
    if args.archived_only:
        print("archived_only=true")
    if args.children_only:
        print("children_only=true")
    if args.limit is not None:
        print(f"limit={args.limit}")

    conn = get_connection(db_path, writable=args.apply)
    try:
        query, params = build_query(args, cutoff_ms)
        rows = conn.execute(query, params).fetchall()

        print(f"matching_sessions={len(rows)}")
        for index, row in enumerate(rows, start=1):
            kind = "child" if row["parent_id"] else "root"
            archived = "yes" if row["time_archived"] is not None else "no"
            print(
                f"[{index}/{len(rows)}] id={row['id']} kind={kind} archived={archived} updated={row['time_updated']} dir={row['directory']} title={row['title']}"
            )

        if not args.apply or not rows:
            return 0

        conn.execute("pragma foreign_keys=on")
        deleted = 0
        for index, row in enumerate(rows, start=1):
            sid = row["id"]
            print(f"deleting [{index}/{len(rows)}] {sid}", flush=True)
            conn.execute("delete from session where id=?", (sid,))
            conn.commit()
            deleted += 1

        print(f"deleted_sessions={deleted}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
