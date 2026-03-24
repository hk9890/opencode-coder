---
name: opencode-coder-dev
description: "Internal dev skill for working IN the opencode-coder plugin repo. Use when the AI assistant needs to: (1) Analyze OpenCode logs using the log-analyzer tool, (2) Run or understand dev commands (analyze-logs, fix-bugs, import-tasks, release), (3) Execute the release workflow, (4) Triage and import bugs from GitHub issues, (5) Understand plugin internals for development"
---

# opencode-coder-dev Skill

Internal dev reference hub for the opencode-coder plugin repository. Load specific documents based on what you need.

## When to Load What

| Need | Load |
|------|------|
| Analyze OpenCode log files | [references/log-analyzer.md](references/log-analyzer.md) |
| Release a new plugin version | `/opencode-coder-dev/release` or `github-releases` skill, then [docs/RELEASING.md](../../docs/RELEASING.md) |
| Import bugs from GitHub issues | Run `/opencode-coder-dev import-tasks` command |
| Fix and triage open bugs | Run `/opencode-coder-dev fix-bugs` command |

## Dev Commands

| Command | Purpose |
|---------|---------|
| `/opencode-coder-dev analyze-logs` | Fetch and analyze OpenCode log files |
| `/opencode-coder-dev fix-bugs` | Triage and fix open bugs from beads |
| `/opencode-coder-dev import-tasks` | Import GitHub issues into beads |
| `/opencode-coder-dev release` | Execute the full release workflow |

## Key Dev Paths

| Resource | Path |
|----------|------|
| Log analyzer script | `scripts/log-analyzer/` |
| Release companion doc | `docs/RELEASING.md` |
| GitHub repo | `https://github.com/dynatrace-oss/opencode-coder` |
| Dev commands | `.opencode/commands/opencode-coder-dev/` |
| This skill | `.opencode/skills/opencode-coder-dev/` |
