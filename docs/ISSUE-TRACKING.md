# Issue Tracking (bd)

This repository uses **bd (beads)** for all planning and execution tracking.

Related docs:

- [`OVERVIEW.md`](OVERVIEW.md) for repository context and doc routing
- [`../AGENTS.md`](../AGENTS.md) for agent-level routing and global task policies
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) for contributor workflow

Do not maintain parallel markdown TODO lists or external trackers for repository work.

## Core Commands

### Check ready work

```bash
bd ready --json
```

### View a specific issue

```bash
bd show <id> --json
```

### Start work

```bash
bd update <id> --status=in_progress --json
```

### Create follow-up work

```bash
bd create --title="<title>" --type=task --priority=2 --description="<details>" --json
```

### Close completed work

```bash
bd close <id> --reason="<what was completed>" --json
```

## Discovered Bugs During Another Task

When you find an unrelated problem while executing an issue, create a bug and link it back to the parent issue:

```bash
bd create --title="Found: <description>" --type=bug --priority=2 --description="Discovered while working on <task-id>. <details>"
```

If needed, add explicit dependency links using `discovered-from:<parent-id>`.

## Conventions

- Use `--json` in agent/programmatic flows.
- Keep issue titles specific and action-oriented.
- Keep close reasons outcome-focused (what is now true).
