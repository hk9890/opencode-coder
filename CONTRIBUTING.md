# Contributing to opencode-coder

Thanks for contributing to the OpenCode plugin for story-driven development.

- For repository context and doc routing, start with [`docs/OVERVIEW.md`](docs/OVERVIEW.md)
- For architecture and code conventions, see [`docs/CODING.md`](docs/CODING.md)
- For unit/integration/e2e strategy and commands, see [`docs/TESTING.md`](docs/TESTING.md)
- For direct-to-main workflow and optional branch/PR expectations, see [`docs/CHANGE-WORKFLOW.md`](docs/CHANGE-WORKFLOW.md)

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

Run the minimum checks from [`docs/TESTING.md`](docs/TESTING.md) for the change type before pushing a change (or before opening a PR when a PR is explicitly requested).

Typical baseline for low-risk doc or code changes:

```bash
bun run build
bun run typecheck
```

Add the targeted unit, integration, e2e, or manual checks required by [`docs/TESTING.md`](docs/TESTING.md#change-type-matrix).

## Split-skill package model (current)

Contributor guidance and tests should follow the split capability model:

- plugin runtime is responsible for bootstrap/core availability and beads readiness detection
- `coder-core` is plugin-coupled runtime/bootstrap ownership
- `coder-beads` is plugin-integrated for defaults/activation only when beads is ready
- `coder-docs` and `code-simplify` are standalone skill owners

When manually validating split-package behavior in isolated runs, prefer canonical split-package installs such as:

```bash
aimgr install package/coder-core package/coder-docs package/code-simplify package/coder-beads
```

`package/opencode-coder` is also available as a legacy compatibility bundle, but new validation should target the split packages directly.

## Contribution Workflow

1. Pick or create an issue (this repo uses `bd` for issue tracking)
2. Unless someone explicitly asks for a branch or PR, work directly on `main`
3. Implement your change following [`docs/CODING.md`](docs/CODING.md)
4. Run relevant tests from [`docs/TESTING.md`](docs/TESTING.md)
5. Push to `main`; if a branch or PR is explicitly requested, follow [`docs/CHANGE-WORKFLOW.md`](docs/CHANGE-WORKFLOW.md)

## Where To Put Commands and Agents

For published-vs-local resource placement, see [`docs/CODING.md`](docs/CODING.md#4-keep-published-and-local-resources-separate).

## Questions

If something is unclear, open an issue or discussion in the repository.
