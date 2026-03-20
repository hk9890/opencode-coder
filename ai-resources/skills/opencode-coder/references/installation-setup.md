# Installation & Setup Guide

Lean reference for explicit enablement and `/opencode-coder/init`.

**Canonical references**:
- File locations, saved mode state, AGENTS rules, and stealth vs team behavior: [project-structure.md](project-structure.md)
- Switching between modes: [mode-transition.md](mode-transition.md)
- Common failures and fixes: [troubleshooting-patterns.md](troubleshooting-patterns.md)

## Installation

For most users, open a project and run `/opencode-coder/init`.

Startup no longer creates project-local opencode-coder files automatically for fresh projects. A project stays inactive until the user explicitly enables it.

### Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| `bd` | Beads issue tracking CLI | `npm install -g beads` |
| `aimgr` *(optional)* | AI resource discovery | See: https://github.com/hk9890/ai-config-manager |

### Manual Install

Use this only if you need to install or upgrade outside `/opencode-coder/init`:

```bash
# Install or upgrade beads
npm install -g beads
npm update -g beads

# Verify
bd --version
```

**Rule**: Use npm for install and upgrade. Do not use ad-hoc curl/bash installers.

## Explicit Enablement Model

The plugin now has three persisted project modes stored in `.coder/opencode-coder.yaml`:

- `disabled` — project-local startup behavior stays off, but `/opencode-coder/init` remains available
- `stealth` — active local-only mode
- `team` — active shared mode

Fresh projects without a saved mode are **not yet enabled**. That is distinct from saved `disabled`.

### Hard override

`OPENCODE_CODER_DISABLED=true` is different from saved `disabled` mode:

- env var hard override → plugin is fully disabled and exposes no commands
- saved `disabled` mode → plugin stays inactive for the project, but `/opencode-coder/init` is still available so the user can re-enable it later

## Initialization

`/opencode-coder/init` is the preferred path. It is safe to re-run.

### Before You Start

Verify:

1. `git status` works
2. `bd --version` works

### What `/opencode-coder/init` does

It can:

- explicitly enable a fresh project in `stealth` or `team`
- keep a project in saved `disabled`
- refresh an active `stealth` or `team` setup
- switch between `stealth` and `team`
- switch an active project back to saved `disabled`
- migrate legacy initialized projects to explicit saved mode on first detection

### Legacy upgrade behavior

Existing initialized projects should keep working after upgrade.

If `.coder/opencode-coder.yaml` is missing, init/startup may infer legacy active state from:

- the stealth marker in `.git/info/exclude`
- legacy `.coder/project.yaml` with `mode: stealth` or `mode: team`
- shared team markers like `.beads/`, `AGENTS.md`, and `ai.package.yaml`

When legacy active state is inferred, the plugin should write `.coder/opencode-coder.yaml` so future startups use explicit saved state instead of legacy heuristics.

### Manual Initialization

#### Stealth mode

```bash
mkdir -p .coder
printf 'mode: stealth\n' > .coder/opencode-coder.yaml
bd init --stealth && bd hooks install
mkdir -p .coder/docs

if ! grep -q "# opencode-coder stealth mode" .git/info/exclude 2>/dev/null; then
  cat >> .git/info/exclude << 'STEALTH'

# opencode-coder stealth mode
.beads/
.opencode/
.coder/
ai.package.yaml
STEALTH
fi
```

#### Team mode

```bash
mkdir -p .coder
printf 'mode: team\n' > .coder/opencode-coder.yaml
bd init && bd hooks install
grep -qF '.coder/' .gitignore 2>/dev/null || echo '.coder/' >> .gitignore
```

#### Saved disabled mode

```bash
mkdir -p .coder
printf 'mode: disabled\n' > .coder/opencode-coder.yaml
```

This keeps project-local startup inactive until the user re-enables the project with `/opencode-coder/init`.

### Verify Setup

After initialization:

- `.coder/opencode-coder.yaml` exists with the intended saved mode
- fresh startup does not create `.coder/` until explicit enablement
- `bd ready` runs without errors in active modes
- the active AGENTS path exists in active modes
- the active docs directory exists in active modes
- git visibility matches the chosen mode

Use [project-structure.md](project-structure.md) to verify the expected paths.

### Re-running `/opencode-coder/init`

- Safe to re-run
- Should refresh or switch the active mode instead of assuming a fresh install
- In stealth mode, the marker in `.git/info/exclude` should prevent ambiguous re-detection
- Re-runs refresh generated docs and the active AGENTS file

### First Steps After Setup

```bash
bd create "Setup project" --type task
bd ready
```

## Configuration

The plugin is controlled by environment variables.

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENCODE_CODER_DISABLED` | `false` | Hard-disable the plugin entirely |
| `BEADS_AUTO_APPROVE` | `true` | Require approval for `bd` commands when set to `false` |

### Check Current State

```bash
echo $OPENCODE_CODER_DISABLED
```

Empty or `false` means the plugin is not hard-disabled.

### Change Configuration

```bash
# Hard-disable plugin completely
export OPENCODE_CODER_DISABLED=true

# Re-enable plugin runtime
unset OPENCODE_CODER_DISABLED
# or
export OPENCODE_CODER_DISABLED=false

# Require approval for bd commands
export BEADS_AUTO_APPROVE=false
```

Add permanent settings to your shell profile if needed.
