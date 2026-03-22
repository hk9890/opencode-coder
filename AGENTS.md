# Agent Guidelines for opencode-coder

OpenCode plugin for story-driven development with agents and commands.

**Tech Stack**: TypeScript, Bun, @opencode-ai/plugin SDK, zod, yaml

## Start Here

- Project overview and repository map: [`docs/OVERVIEW.md`](docs/OVERVIEW.md)
- Contributor setup and local workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- This file is a routing layer; use topic docs below for detailed guidance.

## Route by Task

### Coding

- Read [`docs/CODING.md`](docs/CODING.md) for architecture, repository structure, coding conventions, and build commands.

### Testing

- Read [`docs/TESTING.md`](docs/TESTING.md) for test levels, commands, and local/e2e requirements.

### Releases

- Load the **github-releases** skill for release workflow.
- Read [`docs/RELEASING.md`](docs/RELEASING.md) for repository-specific release details.

### Monitoring and Triage

- Load the **observability-triage** skill for logs/metrics triage.
- Read [`docs/MONITORING.md`](docs/MONITORING.md) for project-specific monitoring sources and workflows.

### Pull Requests

- Read [`docs/PULL-REQUESTS.md`](docs/PULL-REQUESTS.md) for branch strategy, PR expectations, and merge rules.

### Issue Tracking (beads)

- Use `bd` for all project issue tracking.
- Load the **opencode-coder** skill for issue-tracking, planning, setup, and beads workflow guidance.
- Follow the opencode-coder workflow when creating or updating issues so project tracking stays consistent.

## OpenCode Reference Docs

- [Commands](https://opencode.ai/docs/commands/) - Custom commands with arguments
- [Agents](https://opencode.ai/docs/agents/) - Agent configuration and modes
- [Skills](https://opencode.ai/docs/skills/) - Agent skills
- [Plugins](https://opencode.ai/docs/plugins/) - Plugin development
- [SDK](https://opencode.ai/docs/sdk/) - TypeScript SDK reference

## Critical Global Rules

### Required Session-End Workflow

When ending a work session, complete all steps:

1. File follow-up issues for remaining work.
2. Run quality gates for changed code (tests, lint, build as applicable).
3. Update issue status (close finished work, keep in-progress accurate).
4. Push all committed work:

   ```bash
   git pull --rebase
   git push
   git status  # must show up to date with origin
   ```

5. Verify no work is stranded locally.

**Critical**: Work is not complete until `git push` succeeds.

### Task Tracking Policy

- Use **bd (beads)** for all task tracking.
- Do not create markdown TODO trackers.
- For agent/programmatic flows, use `--json` with `bd` commands.

### Discovered Work Policy

If you find unrelated problems while executing an issue, create a linked bug:

```bash
bd create --title="Found: <description>" --type=bug --priority=2 --description="Discovered while working on <task-id>. <details>"
```

Link discovered follow-up work with `discovered-from:<parent-id>` dependencies where appropriate.
