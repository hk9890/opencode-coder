# Validation Transcript

## Mode

without_skill

## Eval Prompt

In my opencode-coder setup, bd ready is failing with database errors. Give me a troubleshooting path, tell me what logging or environment variables to collect, and if this really looks like a plugin issue tell me what evidence to put into a GitHub bug report.

## Tool Calls

1. **Glob** `{"pattern": "**/.beads/**", "path": "/home/hans/dev/github/opencode-coder"}`
2. **Glob** `{"pattern": "**/bd*", "path": "/home/hans/dev/github/opencode-coder"}`
3. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/.beads/daemon.log", "limit": 80}`
4. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/.beads/dolt-server.log", "limit": 80}`
5. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/.beads/config.yaml"}`
6. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/.beads/dolt-server.port"}`
7. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/.beads/dolt/.dolt/config.json"}`
8. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/.beads/dolt/opencode_coder/.dolt/config.json"}`
9. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/.beads/metadata.json"}`
10. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/.beads/dolt/config.yaml"}`
11. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/.beads/dolt/.dolt/repo_state.json"}`

## Final Response

Let me look at the project structure to understand the beads setup here.

I can see the root cause in the logs. Let me check a few more files before giving you the full picture.

Now I have the full picture. The root cause is clearly visible.

---

## Diagnosis: Database Name Mismatch

**Root cause** (confirmed from your logs):

- `metadata.json` says `"dolt_database": "opencode_coder"` — the correct database name
- `dolt-server.log` line 13-14 shows beads connecting with `database=beads` — **wrong name**
- The actual dolt database directory is `.beads/dolt/opencode_coder/`
- Beads is ignoring `metadata.json` and hardcoding `beads` as the database name

This is **almost certainly a beads bug** introduced between Dec 2025 (your last successful daemon.log) and Mar 2026 (when dolt-server.log was written).

---

## Troubleshooting Path

**Step 1 — Confirm the immediate state**
```bash
bd doctor
cat .beads/dolt-server.pid       # is a pid there?
cat .beads/dolt-server.port      # should be 43257
ps aux | grep dolt               # is the server actually running?
```

**Step 2 — Verify the database name mismatch directly**
```bash
mysql -h 127.0.0.1 -P 43257 -u root --execute "SHOW DATABASES;"
# You'll see 'opencode_coder', NOT 'beads'
```

**Step 3 — Kill everything and try a clean restart**
```bash
bd doctor   # check sync state first
pkill -f "dolt sql-server"
pkill -f "bd daemon"
rm -f .beads/dolt-server.pid .beads/dolt-server.lock
rm -f .beads/daemon.pid .beads/daemon.lock
bd ready    # triggers auto-restart
```

**Step 4 — If still broken, fall back to no-db mode** (reads directly from JSONL, bypasses the whole SQLite/Dolt stack):
```bash
BD_NO_DB=1 bd ready
# or add to .beads/config.yaml: no-db: true
```

**Step 5 — Check bd version and whether an update is available**
```bash
bd version
bd update   # or however you installed beads
```

---

## Environment Variables / Logs to Collect

```bash
# Version info
bd version 2>&1

# Full daemon log (tail for recent errors)
tail -100 .beads/daemon.log

# Full dolt-server log
cat .beads/dolt-server.log

# Metadata
cat .beads/metadata.json

# Dolt database listing
mysql -h 127.0.0.1 -P 43257 -u root --execute "SHOW DATABASES;" 2>&1

# Environment
echo "BD_NO_DB=$BD_NO_DB"
echo "BEADS_DB=$BEADS_DB"
env | grep -E "BD_|BEADS_"

# Lock file state
ls -la .beads/*.lock .beads/*.pid 2>/dev/null
```

---

## GitHub Bug Report Evidence

Yes, this looks like a beads bug. Here's what to include:

**Title**: `dolt backend: beads connects with hardcoded database name "beads" instead of reading dolt_database from metadata.json`

**Key evidence**:

1. **`.beads/metadata.json`** — shows `"dolt_database": "opencode_coder"`
2. **`.beads/dolt-server.log` lines 13-14** — the smoking gun:
   ```
   level=error msg="unable to process ComInitDB: database not found: beads" database=beads
   level=error msg="failed to set the database client 4 (127.0.0.1:33232): database not found: beads (errno 1049) (sqlstate HY000)"
   ```
3. **Directory listing of `.beads/dolt/`** — shows `opencode_coder/` subdirectory exists, no `beads/` subdirectory
4. **Last known-good daemon.log timestamp**: Dec 29, 2025 (when the project prefix was first established)
5. **bd version output**
6. **`mysql SHOW DATABASES` output** confirming only `opencode_coder` is served

The hypothesis to state in the report: *"After a beads update or daemon restart, the dolt connection code reverted to using a hardcoded database name `beads` rather than reading `dolt_database` from `.beads/metadata.json`. Projects initialized with a non-default prefix (like `opencode_coder`) are broken on reconnect."*
