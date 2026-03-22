# Monitoring Configuration

Use the **observability-triage** skill for the generic monitoring analysis and triage workflow.
This file records the repository-specific log sources, scripts, and signals for opencode-coder.

## How to Get Monitoring Data

### OpenCode Logs

OpenCode stores logs in `~/.local/share/opencode/log/`. The log-analyzer
script parses these structured logs.

> opencode-coder plugin logs continue to be emitted to OpenCode logs.
> The project-local file logs described below are an additional sink, not a
> replacement.

### Project-Local Plugin Logs

In addition to OpenCode logs, opencode-coder writes plugin logs to a
project-local file under:

`<project-root>/.coder/logs/coder-YYYY-MM-DD.log`

- `YYYY-MM-DD` is the UTC calendar date of the log file
- one file is used per day (daily rotation by filename)
- `.coder/logs/` is created lazily when logging starts

This location is intentionally project-local so plugin debugging is possible
directly from the repository, without needing to inspect ephemeral OpenCode
file descriptors under `/proc/<pid>/fd/...`.

Runtime diagnostics now emit a stable `Runtime diagnostic signal` event with
structured `signal` and readiness fields. The same signal model is emitted to
both sinks, and `.coder/project.yaml` remains the snapshot of current detected
runtime state.

#### Retention

Project-local `coder-YYYY-MM-DD.log` files are retained for 7 days.
Files older than 7 days are pruned automatically during startup.

Retention is based on the date in the filename (not file modification time),
so manually touching old files does not prevent pruning.

#### List Recent Sessions

```bash
bun run scripts/log-analyzer list sessions
```

By default, `log-analyzer` reads OpenCode logs. To analyze project-local logs,
add `--source=project-local`. To merge both streams in one query, use
`--source=both`.

```bash
# OpenCode logs (default)
bun run scripts/log-analyzer --session=<session-id> --service=opencode-coder

# Project-local plugin logs from <cwd>/.coder/logs
bun run scripts/log-analyzer --source=project-local --service=opencode-coder

# Merge OpenCode + project-local in one timeline
bun run scripts/log-analyzer --source=both --service=opencode-coder --tail=200
```

This shows all recent OpenCode sessions with timestamps and session IDs.

#### Get Errors and Warnings

```bash
bun run scripts/log-analyzer --session=<session-id> --level=ERROR,WARN --json
```

Replace `<session-id>` with the actual session ID from the list. Use
`--json` for structured output that's easier to parse programmatically.

#### Filter by Service

```bash
# Plugin loading issues
bun run scripts/log-analyzer --session=<session-id> \
  --service=opencode-coder --level=ERROR,WARN

# Beads-related issues
bun run scripts/log-analyzer --session=<session-id> \
  --service=beads --level=ERROR,WARN

# Agent execution issues
bun run scripts/log-analyzer --session=<session-id> \
  --service=agent --level=ERROR,WARN
```

#### Recent Errors Across All Sessions

```bash
# Get the 3 most recent sessions and check each for errors
bun run scripts/log-analyzer list sessions | head -5
```

Then query each session for errors.

### Inspect Project-Local Logs

```bash
# list local plugin log files for this project
ls .coder/logs/

# inspect today's log file
less ".coder/logs/coder-$(date -u +%F).log"
```

## What to Look For

### Critical (needs immediate attention)

- **Plugin loading failures** — Errors from `service=opencode-coder`
  during startup
  - "Failed to load plugin" or "Plugin initialization error"
  - These prevent the plugin from functioning at all

- **Beads sync failures** — Errors from `service=beads` or services
  containing "beads"
  - "Sync failed" or "Failed to sync"
  - Git operation failures during sync
  - These can cause data loss or inconsistent state

- **Agent execution crashes** — Errors from `service=agent`
  - Unhandled exceptions during agent execution
  - Tool execution failures

### Important (should be tracked)

- **Warnings that recur frequently** — Any WARN level message appearing
  multiple times
  - May indicate a pattern or systematic issue

- **Tool execution warnings** — Problems running tools like `bd` commands
  - May indicate misconfiguration or missing dependencies

- **File system errors** — Permission issues, missing directories
  - Can affect beads storage or plugin functionality

### Can Usually Ignore

- **Single INFO messages** — Normal operational logging
- **Transient network errors** — One-off connection issues that don't
  repeat
- **Debug-level output** — Only relevant when actively debugging

## Troubleshooting

### Startup Debugging

If startup behavior is hard to reproduce, inspect both log sources:

1. OpenCode session logs (`~/.local/share/opencode/log/`) for full runtime context
2. Project-local plugin logs (`.coder/logs/coder-YYYY-MM-DD.log`) for a stable,
   repository-scoped plugin timeline

When debug logging is enabled (for example via `OPENCODE_CODER_DEBUG`), the
same debug events are written to both destinations.

### Duplicate-Process Investigation

When multiple OpenCode/plugin processes overlap, use the project-local logs to
disambiguate behavior by process ID (`pid`) in each line:

- scan `.coder/logs/coder-YYYY-MM-DD.log` for interleaved entries
- group by `pid` to separate concurrent plugin processes
- correlate timestamps with OpenCode session logs as needed

This is typically easier than chasing active process file handles via
`/proc/<pid>/fd/...`, especially after processes exit.
