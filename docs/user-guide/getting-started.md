# Getting Started

This guide helps you install the `@dynatrace-oss/opencode-coder` plugin and get it working in a project.

## Prerequisites

- [OpenCode CLI](https://opencode.ai/)
- Node.js 18+
- Bun or npm
- Optional: `bd` if you want beads issue tracking

## 1. Install the plugin

Add the plugin to your OpenCode config at `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@dynatrace-oss/opencode-coder"]
}
```

If needed, configure npm to use GitHub Packages for this scope in `~/.npmrc`:

```text
@dynatrace-oss:registry=https://npm.pkg.github.com
```

## 2. Open a project

Start OpenCode in the repository where you want to use the plugin.

## 3. Run `/opencode-coder/init`

For most users, this is the main setup step.

`/opencode-coder/init` will guide project setup and can:

- discover and install relevant AI resources
- initialize beads if you want issue tracking
- install git hooks
- create or refresh the project's `AGENTS.md`
- explicitly save whether this project should be `disabled`, `stealth`, or `team`

Fresh projects stay inactive until you explicitly enable them with `/opencode-coder/init`.
Startup no longer creates `.coder/` files automatically just because the plugin is installed.

If you enable the project, `/opencode-coder/init` will ask which mode you want:

- **stealth** — keeps opencode-coder artifacts local
- **team** — stores shared setup in the repository

If you choose saved **disabled** mode, project-local startup behavior stays off, but `/opencode-coder/init` remains available so you can re-enable the project later.

`OPENCODE_CODER_DISABLED=true` is different: it hard-disables the plugin entirely and hides `/opencode-coder/init` for that session.

## 4. Review the generated project guidance

After `/opencode-coder/init`, check the active guidance files:

- `AGENTS.md` in team mode
- `.coder/AGENTS.md` in stealth mode

These files should point agents to the right project docs and workflows.

## 5. Start using it

Common next steps:

- ask the agent to help with planning or implementation
- run `bd ready` to see unblocked work if you use beads
- create work with `bd create "Task description" --type task`
- re-run `/opencode-coder/init` after installing new resources
- run `/opencode-coder/docs` to inspect, refresh, audit, and verify the project docs lifecycle

## Optional manual setup

If you only want beads itself and are **not** trying to activate the full opencode-coder project workflow, you can install the CLI and initialize beads manually:

```bash
npm install -g beads
bd init --skip-agents
```

For local-only usage, use stealth mode instead:

```bash
bd init --stealth --skip-agents
```

Important: manual `bd init --skip-agents` / `bd init --stealth --skip-agents` is beads-only setup. It is not the documented plugin activation path. To explicitly enable opencode-coder for the project, use `/opencode-coder/init` so the saved plugin mode state is written correctly.

Boundary note: manual beads init with `--skip-agents` only sets up beads tracker state/hooks. It does not own project markdown/doc generation or refresh (`AGENTS.md`, `README`, etc.); those docs remain under the opencode-coder docs lifecycle.

## Troubleshooting

- Use `/opencode-coder/status` to check current plugin state
- Use `/opencode-coder/doctor` to diagnose setup problems
- If `bd` is missing, install it before using beads workflows
- If an older initialized project upgrades to this version, the plugin should preserve active behavior by inferring and saving the prior mode automatically
