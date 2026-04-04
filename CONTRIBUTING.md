# Contributing to opencode-coder

Thanks for contributing to the OpenCode plugin for story-driven development.

- For repository context and doc routing, start with [`docs/OVERVIEW.md`](docs/OVERVIEW.md)
- For architecture and code conventions, see [`docs/CODING.md`](docs/CODING.md)
- For unit/integration/e2e strategy and commands, see [`docs/TESTING.md`](docs/TESTING.md)
- For direct-to-main workflow and optional branch/PR expectations, see [`docs/PULL-REQUESTS.md`](docs/PULL-REQUESTS.md)

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

Run these before pushing a change (or before opening a PR when a PR is explicitly requested):

```bash
bun run build
bun run typecheck
bun run test
```

For targeted test levels (unit, integration, e2e), use the commands in [`docs/TESTING.md`](docs/TESTING.md).

## Contribution Workflow

1. Pick or create an issue (this repo uses `bd` for issue tracking)
2. Unless someone explicitly asks for a branch or PR, work directly on `main`
3. Implement your change following [`docs/CODING.md`](docs/CODING.md)
4. Run relevant tests from [`docs/TESTING.md`](docs/TESTING.md)
5. Push to `main`; if a branch or PR is explicitly requested, follow [`docs/PULL-REQUESTS.md`](docs/PULL-REQUESTS.md)

## Where To Put Commands and Agents

For published-vs-local resource placement, see [`docs/CODING.md`](docs/CODING.md#4-keep-published-and-local-resources-separate).

## Questions

If something is unclear, open an issue or discussion in the repository.
