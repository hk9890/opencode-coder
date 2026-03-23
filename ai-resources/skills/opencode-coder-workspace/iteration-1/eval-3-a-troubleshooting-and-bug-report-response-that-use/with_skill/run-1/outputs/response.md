This is a debugging + potential bug report task. I need `debugging-logs.md`, `troubleshooting-patterns.md`, and `bug-reporting.md`.

Here's the complete troubleshooting path for `bd ready` failing with database errors.

---

## Step 1: Run built-in diagnostics first

```bash
bd doctor
bd doctor --fix
```

`bd doctor` is the authoritative first step — it understands the Dolt-backed store and can identify broken local setup, stale runtime state, or incomplete migration. Use `--fix` to let it repair common problems automatically.

If `bd doctor` reports uncommitted Dolt changes, inspect them before doing anything else:

```bash
bd vc status
```

If doctor + fix doesn't resolve it, try bootstrap (safe for fresh-clone or recovery paths):

```bash
bd bootstrap
```

---

## Step 2: Collect logs and environment variables

Enable both log levels before reproducing the error:

```bash
export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"
export OPENCODE_CODER_DEBUG=1
```

Then reproduce `bd ready` and collect from your log directory (Linux):

```bash
ls -lt ~/.local/share/opencode/log/ | head -5
tail -200 $(ls -t ~/.local/share/opencode/log/*.log | head -1)
grep -C 3 "opencode-coder" ~/.local/share/opencode/log/*.log
grep -i "error\|database\|dolt\|beads" ~/.local/share/opencode/log/*.log
```

Key environment variables to record:

| Variable | Command |
|---|---|
| Plugin disabled? | `echo $OPENCODE_CODER_DISABLED` |
| bd version | `bd --version` |
| Node version | `node --version` |
| Shell | `echo $SHELL` |
| Plugin install | `npm list opencode-coder` |

---

## Step 3: Determine if it's a plugin issue

**It's a plugin issue** (worth a GitHub report) if any of these are true:

- `bd doctor` passes clean but `bd ready` still throws a DB error
- `bd bootstrap` completes without errors but `bd ready` still fails
- The error message references internals (Dolt, WAL, schema migration, lock files) with no clear user action to fix
- The error is reproducible on a fresh `.beads/` that was just initialized
- `bd list --status=open` works but `bd ready` doesn't (narrowed to the `ready` command specifically)

**It's likely a local setup issue** (not a plugin bug) if:

- `bd doctor` reports a fixable problem
- `.beads/` is missing or was deleted by `git clean -fdx`
- The error goes away after `bd doctor --fix` or `bd bootstrap`

---

## Step 4: If it is a plugin issue — what to put in the bug report

Run the automated system info collector:

```bash
bash ai-resources/skills/opencode-coder/scripts/collect-system-info.sh
```

Then file at `https://github.com/dynatrace-oss/opencode-coder/issues/new` with title `[bd ready] Database error on ready command`.

**Required sections:**

1. **Problem** — exact error message and full output of `bd ready`
2. **Steps to reproduce** — minimal sequence (e.g. "fresh clone → bd init → bd create → bd ready")
3. **Environment** — paste the output of `collect-system-info.sh` plus `node --version`, `bd --version`, `npm list opencode-coder`
4. **bd doctor output** — full output of `bd doctor` (even if it shows "no issues")
5. **Logs** — filtered log excerpt:
   ```bash
   grep -i "error\|database\|dolt" ~/.local/share/opencode/log/*.log
   ```
6. **What you already tried** — list which of doctor/fix/bootstrap you ran and their output

**Optional but valuable for hard-to-reproduce errors:** run the diagnostics bundle collector and attach `manifest.json` + `README.md`:

```bash
bun run diagnostics:collect
```

> Do not manually delete `.beads/` or Dolt internals as a workaround before capturing this evidence — once deleted, the diagnostic state is gone.
