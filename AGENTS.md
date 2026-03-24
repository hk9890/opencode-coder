# Agent Guidelines for opencode-coder

OpenCode plugin for story-driven development with agents and commands.

**Tech Stack**: TypeScript, Bun, @opencode-ai/plugin SDK, zod, yaml

## Start Here

- Project overview and repository map: [`docs/OVERVIEW.md`](docs/OVERVIEW.md)
- Contributor setup and local workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md)

### Coding

- Read [`docs/CODING.md`](docs/CODING.md) for architecture, repository structure, coding conventions, and build commands.

### Testing

- Read [`docs/TESTING.md`](docs/TESTING.md) for test levels, commands, and local/e2e guidance.

### Releases

- Load the **github-releases** skill for release workflow.
- Read [`docs/RELEASING.md`](docs/RELEASING.md) for repository-specific release checks and publishing details.

### Monitoring

- Load the **observability-triage** skill for logs, metrics, and incident triage.
- Read [`docs/MONITORING.md`](docs/MONITORING.md) for repo-specific evidence sources and analysis workflow.

### Pull Requests

- Read [`docs/PULL-REQUESTS.md`](docs/PULL-REQUESTS.md) for branch naming, PR expectations, and review conventions.

### Issue Tracking (beads)

- Use `bd` for all project issue tracking.
- Load the **opencode-coder** skill for issue-tracking, planning, setup, and beads workflow guidance.
- Keep issue descriptions, dependencies, and status aligned with the current plan.

## Landing the Plane (Session Completion)

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
