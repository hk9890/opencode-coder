# Monitoring & Analysis Guide

Use the **observability-triage** skill for generic monitoring triage patterns.
This file is the **canonical repository-specific workflow** for analyzing
opencode-coder/OpenCode behavior in this repo.

## Canonical Evidence Sources

Use these sources together (not in isolation):

| Source | Purpose | Typical location / access |
|---|---|---|
| Project runtime context | Snapshot of detected mode/readiness and plugin version | `.coder/project.yaml` |
| Project-local plugin logs | Repository-scoped plugin timeline (`opencode-coder` events) | `.coder/logs/coder-YYYY-MM-DD.log` |
| OpenCode logs | Host/runtime-wide session/process log stream | auto-discovered by `scripts/log-analyzer` (Linux default: `~/.local/share/opencode/log/`) |
| Session data access/export | Ground truth for message/tool timeline and token usage | `coder("session")`, `coder("list-sessions")`, `coder("session-export <path> [session-id]")`, `/opencode-coder/dump-session` |
| Diagnostics bundle | Portable evidence package combining available artifacts | `.coder/diagnostics/diagnostics-<timestamp>/` |

`docs/TESTING.md` may point here for deep troubleshooting, but this document owns
the monitoring/analysis workflow.

## Recommended Triage Sequence

Follow this order for most plugin/runtime incidents:

1. **Capture runtime context** from `.coder/project.yaml`.
2. **Inspect project-local logs** for repository-scoped plugin events.
3. **Query OpenCode logs** with `scripts/log-analyzer` (session/service filters).
4. **Access/export session evidence** when behavior depends on tool-call/message flow.
5. **Collect a diagnostics bundle** for sharing/review.
6. **Correlate across all sources** (timestamps, `sessionID`, `pid`, plugin version).

This sequence stays general-purpose for local dev, manual repro, or automated runs.

## 1) Runtime Context Evidence (`.coder/project.yaml`)

Treat `.coder/project.yaml` as the current runtime snapshot for the project:

- mode (`stealth`, `team`, `uninitialized`)
- readiness signals (`installReady`, `ecosystemReady`)
- detector facts for git/beads/aimgr
- `pluginVersion` observed by runtime detection

Use it to quickly answer:

- Is the plugin running in the expected mode?
- Were ecosystem prerequisites detected as healthy?
- Does the observed plugin version match the scenario being analyzed?

## 2) Project-Local Plugin Logs

opencode-coder writes project-local logs to:

`<project-root>/.coder/logs/coder-YYYY-MM-DD.log`

- daily filename rotation (`YYYY-MM-DD`, UTC)
- log directory created lazily
- 7-day retention (older files pruned at startup)

These logs are ideal for repository-scoped investigation and process overlap analysis
because they persist in the project workspace.

## 3) OpenCode Logs + `scripts/log-analyzer`

The log analyzer is the primary query tool for OpenCode and project-local logs.

```bash
# List recent sessions from default source (opencode)
bun run scripts/log-analyzer list sessions

# Query one session for plugin warnings/errors
bun run scripts/log-analyzer --session=<session-id> --service=opencode-coder --level=WARN,ERROR

# Merge OpenCode + project-local logs in one timeline
bun run scripts/log-analyzer --source=both --session=<session-id> --tail=200

# Structured output for automation
bun run scripts/log-analyzer --session=<session-id> --level=ERROR,WARN --json
```

Source options:

- `--source=opencode` (default)
- `--source=project-local`
- `--source=both`

For quick aliases, `package.json` also exposes:

- `bun run logs:sessions`
- `bun run logs:processes`

## 4) Session Access and Session Export Evidence

When incident analysis depends on message/tool-call sequencing, include direct
session data evidence:

```text
coder("session")
coder("list-sessions")
coder("tokens")
coder("session-export private/session-dump/<session-id>")
```

You can also use `/opencode-coder/dump-session` to guide session export in-agent.

Session exports (`session.json`) are especially useful when logs alone do not explain
tool orchestration or assistant decision flow.

## 5) Project Diagnostics Collection (`diagnostics:collect`)

Use the diagnostics collector for a self-describing bundle of available evidence:

```bash
bun run diagnostics:collect
```

Session-focused collection with existing export(s):

```bash
bun run diagnostics:collect \
  --session=<session-id> \
  --session-export=private/session-dump/<session-id>
```

Output bundle:

`<project-root>/.coder/diagnostics/diagnostics-<timestamp>/`

Key artifacts (best effort):

- `manifest.json` (what was included, missing, or errored)
- `README.md` (human summary + privacy checklist)
- `.coder/project.yaml` copy (if present)
- recent project-local logs
- OpenCode session index and optional session extracts
- included/provided `session.json` export files

Missing sources are recorded in the manifest; collection does not fail solely
because one source is unavailable.

### Privacy

Diagnostics and session exports may include prompts, code snippets, paths, and
environment details. Review/redact before sharing outside your trust boundary.

## 6) Correlating Evidence Across Sources

Use the following fields to build a consistent timeline:

- **`sessionID`**: join OpenCode logs, project-local extracts, and session export.
- **`pid`**: separate overlapping processes in merged logs.
- **timestamps**: align startup, command, and failure windows.
- **plugin version**: compare `.coder/project.yaml` with package/runtime expectations.
- **readiness signals**: relate failures to `installReady` / `ecosystemReady` state.

A practical classification after correlation:

- runtime/context mismatch (mode/readiness/version)
- command registration/exposure problems
- resource or dependency gating failures
- tool execution/runtime exceptions
- workspace/setup issues in isolated reproductions

Record the classification together with evidence paths to make bug reports and
follow-up debugging reproducible.
