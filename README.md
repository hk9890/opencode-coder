# @dynatrace-oss/opencode-coder

OpenCode plugin for story-driven development with agents and commands.

## Documentation Map

Use these docs as the primary navigation path:

- [`docs/README.md`](docs/README.md) — documentation taxonomy and canonical operating docs
- [`docs/OVERVIEW.md`](docs/OVERVIEW.md) — project context and repository map
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contributor setup and workflow

Focused guides under `docs/`:

- [`docs/CODING.md`](docs/CODING.md)
- [`docs/TESTING.md`](docs/TESTING.md)
- [`docs/PULL-REQUESTS.md`](docs/PULL-REQUESTS.md)
- [`docs/RELEASING.md`](docs/RELEASING.md)
- [`docs/MONITORING.md`](docs/MONITORING.md)

## Features

- **Beads Integration (Optional)** - Local-first issue tracking with stealth mode (local-only) or team mode (git-synced)
- **Custom Agents** - Four specialized agents for planning, review, task execution, and verification
- **Knowledge Base Commands** - Rich command library for issue management (`bd/*`)
- **Skills as Commands** - Skills from `.opencode/skills/` and other installed locations automatically available as `/skills/*` commands
- **Template Support** - Customizable workflows and issue templates


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

### 2. Explicitly enable your project for project-local behavior

The plugin starts in an inactive state for fresh projects. It will not create `.coder/` files or activate project-local behavior until you explicitly opt in with `/opencode-coder/init`.

If you want to use the project-local workflow, run `/opencode-coder/init` inside the repository and choose one of these saved modes:

- `stealth` — local-only active mode
- `team` — shared active mode
- `disabled` — keep project-local startup inactive until you re-enable it later

## Using with Beads

Beads integration is optional. You can use the plugin without beads at all.

If you want the full opencode-coder project workflow, use `/opencode-coder/init` to enable the project first and let the command drive the correct mode setup.

If you are only setting up beads itself, you can still initialize beads manually with `bd init` or `bd init --stealth`, but that is beads-only setup — it is **not** the documented way to activate opencode-coder for a project.

### Stealth Mode (Recommended default)

- Beads files stay local to your machine (gitignored)
- Won't affect git history or other team members
- Perfect for: personal use, OSS contributions, teams not using beads yet
- `/opencode-coder/init` configures this mode for plugin-managed setup
- `bd init --stealth` is only the manual beads command underneath that setup

### Team Mode

- Beads files are committed and synced via git
- Enables multi-device sync and team collaboration
- Perfect for: teams adopting beads together
- `/opencode-coder/init` configures this mode for plugin-managed setup
- `bd init` is only the manual beads command underneath that setup


## aimgr Integration (Optional)

The plugin includes automatic integration with [aimgr](https://github.com/hk9890/ai-config-manager), a CLI tool for discovering and managing AI resources (commands, skills, agents).

### How It Works

When the plugin starts in an active project mode, it can automatically:

1. **Check** if `ai.package.yaml` exists in your project
2. **Detect** if `aimgr` is installed on your system
3. **Initialize** aimgr if available (`aimgr init`)
4. **Install** the `opencode-coder` package if available in your aimgr repository
5. **Notify** you via toast when initialization completes

Fresh or saved-disabled projects skip these startup side effects until explicitly enabled.

### Installing aimgr

To use this feature, install aimgr:

```bash
# See installation instructions
https://github.com/hk9890/ai-config-manager
```

### Disabling or suppressing startup behavior

- **Saved project disabled mode**: use `/opencode-coder/init` and choose the disabled option for this project
- **Hard-disable plugin completely**: set `OPENCODE_CODER_DISABLED=true`

The env var hard override disables the plugin entirely and hides its commands. Saved disabled mode keeps the plugin installed but inactive for the current project until you re-enable it.

### Benefits

- **Auto-discovery**: Automatically finds relevant AI resources for your project
- **Zero-config**: Works out-of-the-box if aimgr is installed
- **Non-intrusive**: Fails gracefully if aimgr is not available
- **Project-specific**: Each project can have its own AI resource configuration

## Quick Start

### With Beads

First run `/opencode-coder/init` in OpenCode and choose `stealth` or `team` mode so plugin-managed project setup is explicit and repeatable.

Then track issues with `bd`:

```bash
# Create your first issue
bd create "Setup project structure" --type task --priority 2

# Find available work
bd ready

# Start working on a task
bd update <id> --status in_progress

# Close a completed task
bd close <id>
```

## Available Commands

### Plugin Commands

These commands are provided by this plugin and available in OpenCode:

| Command | Description |
|---------|-------------|
| `/opencode-coder/init` | Explicitly enable, refresh, disable, or reconfigure opencode-coder for a project |
| `/simplify` | Review and simplify recently changed files using the opencode-coder workflow |
| `/opencode-coder/doctor` | Diagnose plugin health and configuration |
| `/opencode-coder/status` | Show plugin status |
| `/opencode-coder/report-bug` | Report a bug with session context |
| `/opencode-coder/dump-session` | Export current session data |
| `/opencode-coder/docs` | Run docs lifecycle (inspect, bootstrap, refresh, audit, slim, verify) |
| `/opencode-coder/improve-doc` | Turn an incident into targeted doc/routing fixes to prevent recurrence |
| `/opencode-coder-dev/analyze-logs` | Analyze OpenCode logs for errors (dev use) |
| `/opencode-coder-dev/fix-bugs` | Triage and fix bugs from logs (dev use) |
| `/opencode-coder-dev/import-tasks` | Import tasks from GitHub issues (dev use) |
| `/opencode-coder-dev/release` | Canonical repo release entrypoint (dev use) |

### Beads CLI Commands (requires `bd` installed separately)

The following are **not plugin commands** — they are commands from the [beads CLI](https://github.com/hk9890/beads) (`bd`), which must be installed separately. Agents use them as shell commands when beads is initialized in your project.

| Command | Description |
|---------|-------------|
| `bd create` | Create a new issue |
| `bd list` | List issues with filters |
| `bd ready` | Show issues ready to work |
| `bd show` | Display issue details |
| `bd update` | Update issue properties |
| `bd close` | Close an issue |
| `bd blocked` | Show blocked issues |
| `bd stats` | Project statistics |
| `bd export` | Export issues to JSONL |
| `bd dep` | Manage dependencies |
| `bd epic` | Create an epic with tasks |
| `bd template` | Manage issue templates |

## Available Skills

Skills extend the agent's capabilities with specialized workflows and domain expertise.

### Core Plugin Skills

| Skill | Description |
|-------|-------------|
| `opencode-coder` | Core workflow hub for planning, setup, troubleshooting, and the `/simplify` cleanup workflow. |

### Release and Development Skills

| Skill | Description |
|-------|-------------|
| `github-releases` | Release workflow for versioning, quality gates, and GitHub release creation. |
| `opencode-coder-dev` | Internal development workflow for this repository, including release, log analysis, bug fixing, and task import. |
| `opencode-coder-skill-creator` | Authoring workflow for creating, adapting, testing, and packaging OpenCode skills. |

### Task Synchronization Skills

Bidirectional sync between beads and external task systems (GitHub, Jira, etc.).

| Skill | Description |
|-------|-------------|
| `task-sync` | System-agnostic orchestrator for task synchronization. Provides workflow guidance and delegates to backend-specific skills. |
| `github-task-sync` | GitHub backend for task sync. Syncs beads with GitHub issues using gh CLI. Supports import, export, and bidirectional workflows. |

**Usage Examples:**

```
Sync with GitHub
Import GitHub issues to beads
Export beads to GitHub  
Sync tasks bidirectionally
```

**Features:**
- **Import**: Fetch GitHub issues into beads with automatic priority mapping
- **Export**: Create GitHub issues from beads (NEW capability)
- **Bidirectional**: Full two-way sync with conflict detection and resolution
- **Smart Deduplication**: Never import the same issue twice
- **Label Tracking**: `source:external` and `github:<number>` labels for sync direction

**Prerequisites:**
- GitHub CLI (`gh`) authenticated: `gh auth login`
- Beads initialized: `bd init`

For detailed workflow documentation, see the skills at `.opencode/skills/task-sync/` and `.opencode/skills/github-task-sync/`.

## Available Agents

| Agent | Role |
|-------|------|
| `orchestrator` | Planning, structure, orchestration - creates epics and tasks, delegates implementation |
| `reviewer` | Reviews plans and structure (not code) |
| `tasker` | Implements tasks and closes them when complete |
| `verifier` | Verifies outcomes and owns acceptance review tasks |

### Workflow

1. **Orchestrator** creates epic + tasks + acceptance review task
2. **Reviewer** reviews plans and creates additional tasks/review work if needed
3. **Tasker** implements tasks and closes when complete
4. **Verifier** validates acceptance review tasks and closes them or creates bugs

## License

MIT
