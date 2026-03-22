#!/usr/bin/env python3

"""Create a compacted copy of a live OpenCode database.

This script is safe to run while OpenCode is still using the original DB.
It does NOT modify the live database. Instead it:

1. creates a consistent SQLite backup copy using sqlite3 backup API
2. runs VACUUM INTO on that copy
3. leaves the compacted DB next to the original for later manual swap
"""

import argparse
import os
import sqlite3
import sys
import time
from pathlib import Path


DEFAULT_BASE = Path.home() / ".local/share/opencode"
DEFAULT_DB = DEFAULT_BASE / "opencode.db"
DEFAULT_SNAPSHOT = DEFAULT_BASE / "opencode.snapshot.db"
DEFAULT_OUTPUT = DEFAULT_BASE / "opencode.vacuumed.db"


def format_bytes(size):
    units = ["B", "KB", "MB", "GB", "TB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Create a compacted copy of a live OpenCode SQLite database.",
    )
    parser.add_argument(
        "--db",
        default=str(DEFAULT_DB),
        help=f"Live source database (default: {DEFAULT_DB})",
    )
    parser.add_argument(
        "--snapshot",
        default=str(DEFAULT_SNAPSHOT),
        help=f"Temporary snapshot database (default: {DEFAULT_SNAPSHOT})",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help=f"Compacted output database (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--pages-per-step",
        type=int,
        default=2000,
        help="SQLite backup pages per step/progress callback (default: 2000)",
    )
    return parser.parse_args()


def ensure_missing(path):
    if path.exists():
        print(f"removing existing file: {path}", flush=True)
        path.unlink()


def stat_line(label, path):
    if path.exists():
        size = path.stat().st_size
        print(f"{label}: {path} ({size} bytes, {format_bytes(size)})", flush=True)
    else:
        print(f"{label}: {path} (missing)", flush=True)


def main():
    args = parse_args()

    db_path = Path(args.db).expanduser()
    snapshot_path = Path(args.snapshot).expanduser()
    output_path = Path(args.output).expanduser()

    if not db_path.exists():
        print(f"database not found: {db_path}", file=sys.stderr)
        return 2

    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    ensure_missing(snapshot_path)
    ensure_missing(output_path)

    print("source database", flush=True)
    stat_line("db", db_path)

    print("creating live snapshot copy...", flush=True)
    start = time.time()
    source = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    snapshot = sqlite3.connect(snapshot_path)

    def progress(status, remaining, total):
        copied = total - remaining
        percent = (copied / total * 100.0) if total else 100.0
        print(
            f"backup progress: copied_pages={copied} total_pages={total} remaining_pages={remaining} percent={percent:.1f}%",
            flush=True,
        )

    source.backup(snapshot, pages=args.pages_per_step, progress=progress)
    snapshot.close()
    source.close()
    print(f"snapshot complete in {time.time() - start:.1f}s", flush=True)
    stat_line("snapshot", snapshot_path)

    print("vacuuming snapshot copy into compacted database...", flush=True)
    start = time.time()
    conn = sqlite3.connect(snapshot_path)
    conn.execute(f"vacuum into '{output_path}'")
    conn.close()
    print(f"vacuum complete in {time.time() - start:.1f}s", flush=True)
    stat_line("vacuumed", output_path)

    original_size = db_path.stat().st_size
    compacted_size = output_path.stat().st_size
    saved = original_size - compacted_size
    print(
        f"space_reclaimed_estimate: {saved} bytes ({format_bytes(saved)})",
        flush=True,
    )

    print("next step (after closing OpenCode):", flush=True)
    print(
        f"mv '{db_path}' '{db_path}.old' && mv '{output_path}' '{db_path}'",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
