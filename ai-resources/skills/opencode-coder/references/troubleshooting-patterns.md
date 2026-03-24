# Troubleshooting Patterns

Lean routing guide for diagnosing opencode-coder plugin issues.

Use this file to quickly identify the right troubleshooting workflow, then load the focused reference for commands and recovery steps.

## Fast Triage Flow

1. **Confirm plugin state first**
   - Check `OPENCODE_CODER_DISABLED`
   - Run `/opencode-coder/status`
2. **Run health checks before manual fixes**
   - `bd doctor`
   - `bd doctor --fix` (ask before repair)
3. **Choose a workflow-specific troubleshooting reference**
   - Installation/init/mode transitions → [troubleshooting-installation-init.md](troubleshooting-installation-init.md)
   - Runtime/config/logging issues → [troubleshooting-runtime-config.md](troubleshooting-runtime-config.md)
   - Agent behavior, git visibility, performance → [troubleshooting-agents-git-performance.md](troubleshooting-agents-git-performance.md)
4. **Escalate with evidence if unresolved**
   - Use [bug-reporting.md](bug-reporting.md)

## Quick Search Patterns

```bash
# Search focused troubleshooting docs by keyword
grep -n "not found\|permission\|git clean" references/troubleshooting-*.md
grep -n "plugin not loading\|log" references/troubleshooting-runtime-config.md
grep -n "agent\|hooks\|slow" references/troubleshooting-agents-git-performance.md
```

## Workflow Routing

### 1) Installation, initialization, and mode detection

Load [troubleshooting-installation-init.md](troubleshooting-installation-init.md) for:

- `bd` not found
- npm permission errors
- `bd init` git-repo failures
- hooks missing right after setup
- stealth/team switching issues
- stealth marker or excluded-file detection issues
- `git clean` deleting stealth files

### 2) Runtime configuration and log discovery

Load [troubleshooting-runtime-config.md](troubleshooting-runtime-config.md) for:

- `bd` database/runtime errors and recovery
- plugin not loading or appearing inactive
- command recognition failures caused by plugin loading/setup
- log directory location and debug logging setup

### 3) Agent behavior, sync/git visibility, and performance

Load [troubleshooting-agents-git-performance.md](troubleshooting-agents-git-performance.md) for:

- agent behavior/context problems
- hooks not triggering during normal commits
- stealth/team file visibility problems in git
- uncommitted beads state pileups
- slow `bd` commands
- log retention/disk usage issues

## Escalation Path

If issue remains unresolved after the workflow-specific checks:

1. Collect logs and diagnostics evidence
2. Capture reproduction steps and expected vs actual behavior
3. Report with [bug-reporting.md](bug-reporting.md)

## Pattern Index

- **"command not found"** → [troubleshooting-installation-init.md](troubleshooting-installation-init.md)
- **"permission denied" during install** → [troubleshooting-installation-init.md](troubleshooting-installation-init.md)
- **"not a git repository" on init** → [troubleshooting-installation-init.md](troubleshooting-installation-init.md)
- **Stealth marker/mode not detected** → [troubleshooting-installation-init.md](troubleshooting-installation-init.md)
- **Plugin not active / unknown command** → [troubleshooting-runtime-config.md](troubleshooting-runtime-config.md)
- **Can't find logs** → [troubleshooting-runtime-config.md](troubleshooting-runtime-config.md)
- **Hooks not triggering / agent context issues** → [troubleshooting-agents-git-performance.md](troubleshooting-agents-git-performance.md)
- **Git visibility mismatch in stealth/team** → [troubleshooting-agents-git-performance.md](troubleshooting-agents-git-performance.md)
- **Slow commands / large logs** → [troubleshooting-agents-git-performance.md](troubleshooting-agents-git-performance.md)
