# Agent Guidelines for opencode-coder

OpenCode plugin for story-driven development with agents and commands.

**Tech Stack**: TypeScript, Bun, @opencode-ai/plugin SDK, zod, yaml

## Start Here

- Project overview, repository map, and doc routes: [`docs/OVERVIEW.md`](docs/OVERVIEW.md)
- Contributor setup and local workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md)

Prefer the canonical docs above for default task guidance. Brainstorming notes, design history, and test-report artifacts are secondary unless the task explicitly needs them.

### Coding

- Read [`docs/CODING.md`](docs/CODING.md) for architecture, repository structure, coding conventions, and build commands.

### Testing

- Read [`docs/TESTING.md`](docs/TESTING.md) for test levels, commands, and local/e2e guidance.
- Before running any skill trigger or functional evals, read [`docs/TESTING.md`](docs/TESTING.md) and follow the required skill-eval preflight guidance there first.

### Releases

- Start release work with `/opencode-coder-dev/release` or by loading the **github-releases** skill.
- Treat [`docs/RELEASING.md`](docs/RELEASING.md) as a repo-specific companion only, not a standalone release runbook.

### Monitoring

- Load the **observability-triage** skill for logs, metrics, and incident triage.
- Read [`docs/MONITORING.md`](docs/MONITORING.md) for repo-specific evidence sources and analysis workflow.

### Change Workflow

- Read [`docs/CHANGE-WORKFLOW.md`](docs/CHANGE-WORKFLOW.md) for direct-to-main flow, optional branch/PR rules, and review conventions.

### Issue Tracking (beads)

- Use `bd` for all project issue tracking.
- Load the **coder-beads** skill for issue-tracking, planning, setup, and beads workflow guidance.
- Load **coder-core** only when the work also touches plugin runtime/bootstrap/status/doctor concerns.
- Keep issue descriptions, dependencies, and status aligned with the current plan.

### Docs Lifecycle Work

- Edit canonical project-doc references under `ai-resources/skills/coder-docs/references/`.
- Edit `ai-resources/skills/coder-docs/SKILL.md` when the published docs-lifecycle entrypoint itself must change.
- Treat `ai-resources/skills/coder-core/SKILL.md` as plugin-coupled runtime/bootstrap ownership, not docs-lifecycle ownership.
- Do **not** edit `.opencode/skills/` or `.opencode/commands/` directly; they are aimgr-managed installed runtime surfaces, not authoring sources.
- Treat `docs/user-guide/project-setup.md`, `docs/user-guide/project-doc-guidelines.md`, and `docs/user-guide/project-doc-review-guidelines.md` as copied entrypoints for the canonical `coder-docs` references; keep them aligned with the `ai-resources/` source.

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
