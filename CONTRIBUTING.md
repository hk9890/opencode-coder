# Contributing to opencode-coder

Thanks for contributing to the OpenCode plugin for story-driven development.

This document owns **contributor onboarding and workflow**.

- For repository context and doc routing, start with [`docs/OVERVIEW.md`](docs/OVERVIEW.md)
- For architecture and code conventions, see [`docs/CODING.md`](docs/CODING.md)
- For unit/integration/e2e strategy and commands, see [`docs/TESTING.md`](docs/TESTING.md)
- For branching and PR expectations, see [`docs/PULL-REQUESTS.md`](docs/PULL-REQUESTS.md)
- For issue lifecycle and `bd` usage conventions, see [`docs/ISSUE-TRACKING.md`](docs/ISSUE-TRACKING.md)

## Local Development Setup

### Prerequisites

- [Bun](https://bun.sh/)
- [OpenCode CLI](https://opencode.ai/) (required for e2e/manual plugin verification)

### Getting Started

```bash
git clone https://github.com/dynatrace-oss/opencode-coder.git
cd opencode-coder
bun install
```

### Baseline Checks

Run these before opening a PR:

```bash
bun run build
bun run typecheck
bun run test
```

For targeted test levels (unit, integration, e2e), use the commands in [`docs/TESTING.md`](docs/TESTING.md).

## Contribution Workflow

1. Pick or create an issue (this repo uses `bd` for issue tracking)
2. Create a branch from `main`
3. Implement your change following [`docs/CODING.md`](docs/CODING.md)
4. Run relevant tests from [`docs/TESTING.md`](docs/TESTING.md)
5. Open a PR and follow [`docs/PULL-REQUESTS.md`](docs/PULL-REQUESTS.md)

## Where To Put Commands and Agents

### `ai-resources/` (published with the plugin)

Use for reusable resources that should ship to every plugin user:

- Generic commands
- Generic agents
- Shared skills
- Generic documentation

### `.opencode/` (project-local, not published)

Use for repository-specific development workflows:

- Commands for maintaining this plugin
- Internal tooling/configuration
- Project-specific helper instructions

Rule of thumb: if it only makes sense while developing `opencode-coder`, keep it in `.opencode/`.

## Questions

If something is unclear, open an issue or discussion in the repository.
