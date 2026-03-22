#!/usr/bin/env python3

"""Swap a vacuumed OpenCode DB into place when no OpenCode process is running."""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


DEFAULT_BASE = Path.home() / ".local/share/opencode"
DEFAULT_DB = DEFAULT_BASE / "opencode.db"
DEFAULT_VACUUMED = DEFAULT_BASE / "opencode.vacuumed.db"
DEFAULT_OLD = DEFAULT_BASE / "opencode.db.old"


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
        description="Swap opencode.vacuumed.db into place as opencode.db when OpenCode is not running.",
    )
    parser.add_argument(
        "--db", default=str(DEFAULT_DB), help=f"Live DB path (default: {DEFAULT_DB})"
    )
    parser.add_argument(
        "--vacuumed",
        default=str(DEFAULT_VACUUMED),
        help=f"Vacuumed DB path (default: {DEFAULT_VACUUMED})",
    )
    parser.add_argument(
        "--old",
        default=str(DEFAULT_OLD),
        help=f"Backup old DB path (default: {DEFAULT_OLD})",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ignore running-process check (not recommended)",
    )
    return parser.parse_args()


def is_opencode_running():
    try:
        result = subprocess.run(
            ["pgrep", "-af", "opencode|OpenCode"],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return False, "pgrep not available"

    lines = [line for line in result.stdout.splitlines() if line.strip()]
    filtered = []
    for line in lines:
        if "opencode_db_swap_vacuumed.py" in line:
            continue
        filtered.append(line)
    return len(filtered) > 0, "\n".join(filtered)


def stat_line(label, path):
    if path.exists():
        size = path.stat().st_size
        print(f"{label}: {path} ({size} bytes, {format_bytes(size)})", flush=True)
    else:
        print(f"{label}: {path} (missing)", flush=True)


def main():
    args = parse_args()

    db_path = Path(args.db).expanduser()
    vacuumed_path = Path(args.vacuumed).expanduser()
    old_path = Path(args.old).expanduser()

    if not db_path.exists():
        print(f"missing live DB: {db_path}", file=sys.stderr)
        return 2
    if not vacuumed_path.exists():
        print(f"missing vacuumed DB: {vacuumed_path}", file=sys.stderr)
        return 2
    if old_path.exists():
        print(f"refusing to overwrite existing old DB: {old_path}", file=sys.stderr)
        return 2

    running, details = is_opencode_running()
    if running and not args.force:
        print(
            "OpenCode appears to still be running; refusing to swap.", file=sys.stderr
        )
        print(details, file=sys.stderr)
        return 3

    print("before swap", flush=True)
    stat_line("live", db_path)
    stat_line("vacuumed", vacuumed_path)
    stat_line("old", old_path)

    print("moving live DB to .old", flush=True)
    shutil.move(str(db_path), str(old_path))

    print("moving vacuumed DB into live position", flush=True)
    shutil.move(str(vacuumed_path), str(db_path))

    print("after swap", flush=True)
    stat_line("live", db_path)
    stat_line("vacuumed", vacuumed_path)
    stat_line("old", old_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
