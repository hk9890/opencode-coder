# @dynatrace-oss/opencode-coder

OpenCode plugin for story-driven development with agents and commands.

## Start here

Use these docs first:

- [`docs/OVERVIEW.md`](docs/OVERVIEW.md) — project context, repository map, and doc routes
- [`docs/user-guide/getting-started.md`](docs/user-guide/getting-started.md) — install the plugin and enable it for a project
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contributor setup and workflow

Focused contributor guides:

- [`docs/CODING.md`](docs/CODING.md)
- [`docs/TESTING.md`](docs/TESTING.md)
- [`docs/CHANGE-WORKFLOW.md`](docs/CHANGE-WORKFLOW.md)
- [`docs/RELEASING.md`](docs/RELEASING.md)
- [`docs/MONITORING.md`](docs/MONITORING.md)

## What it provides

- Explicit project activation with `/opencode-coder/init`
- Optional beads-backed workflow support through the `bd` CLI
- Project-installed skill integration alongside the published plugin surface
- Built-in commands for setup, docs lifecycle, troubleshooting, and session export

## Prerequisites

- Node.js (v18+)
- Bun (recommended for local scripts/tests)
- [OpenCode CLI](https://opencode.ai)
- npm authentication for GitHub Packages (token with `read:packages` when installing from `npm.pkg.github.com`)

## Installation

### 1. Configure package access + plugin loading

Since this package is published to GitHub Packages, configure npm for the `@dynatrace-oss` scope (and provide a token with package read access):

```ini
@dynatrace-oss:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<token-with-read:packages>
```

Then add the plugin to your OpenCode configuration (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": ["@dynatrace-oss/opencode-coder"]
}
```

## Enable a project

The plugin starts in an inactive state for fresh projects. It will not create `.coder/` files or activate project-local behavior until you explicitly opt in with `/opencode-coder/init`.

If you want to use the project-local workflow, run `/opencode-coder/init` inside the repository and choose one of these saved modes:

- `stealth` — local-only active mode
- `team` — shared active mode
- `disabled` — keep project-local startup inactive until you re-enable it later

## Optional integrations

### Beads

Beads integration is optional. You can use the plugin without beads at all.

If you want the full opencode-coder project workflow, use `/opencode-coder/init` to enable the project first and let the command drive the correct mode setup.

If you are only setting up beads itself, you can still initialize beads manually with `bd init --skip-agents` or `bd init --stealth --skip-agents`, but that is beads-only setup — it is **not** the documented way to activate opencode-coder for a project.

Manual `bd init ... --skip-agents` only creates/updates beads tracker state and hooks. It must not be used to create or refresh project markdown guidance (such as `AGENTS.md`, `README`, or other docs); project-doc lifecycle remains the opencode-coder docs responsibility.

### aimgr

When a project is active and [aimgr](https://github.com/hk9890/ai-config-manager) is available, the plugin can detect or install the split packages it needs.

Current split-package setup centers on:

- `package/coder-core` as the baseline package
- optional `package/coder-beads`, `package/coder-docs`, and `package/code-simplify`
- legacy `package/opencode-coder` only for backward-compatibility setups

Fresh or saved-disabled projects skip those startup side effects until explicitly enabled.

## Quick Start

1. Install the plugin and configure package access.
2. Open a project in OpenCode.
3. Run `/opencode-coder/init` and choose `stealth`, `team`, or `disabled`.
4. If you use beads, manage work with `bd`.
5. Use the focused docs above when you need implementation, testing, release, or monitoring details.

Example beads flow:

```bash
bd create "Setup project structure" --type task --priority 2
bd ready
bd update <id> --status in_progress
bd close <id>
```

For deeper details, use [`docs/OVERVIEW.md`](docs/OVERVIEW.md) as the main router instead of keeping full command, skill, and agent catalogs in this README.

## License

MIT
