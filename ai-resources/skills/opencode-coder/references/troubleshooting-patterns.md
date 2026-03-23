# Troubleshooting Patterns

This reference contains detailed solutions for common issues when using the opencode-coder plugin. Issues are organized by category for quick reference.

## Table of Contents

1. [Quick Search Patterns](#quick-search-patterns)
2. [Installation Issues](#installation-issues)
   - [bd command not found after installation](#bd-command-not-found-after-installation)
   - [npm permission errors during installation](#npm-permission-errors-during-installation)
3. [Initialization Issues](#initialization-issues)
   - [bd init fails with "not a git repository"](#bd-init-fails-with-not-a-git-repository)
   - [Hooks not working after initialization](#hooks-not-working-after-initialization)
   - [Already initialized but want to switch modes (stealth ↔ team)](#already-initialized-but-want-to-switch-modes-stealth--team)
   - [Stealth files deleted by git clean](#stealth-files-deleted-by-git-clean)
   - [Stealth mode not detected on re-run](#stealth-mode-not-detected-on-re-run)
4. [Runtime Issues](#runtime-issues)
   - [bd commands failing with database errors](#bd-commands-failing-with-database-errors)
   - [Git hooks not triggering](#git-hooks-not-triggering)
   - [Uncommitted beads changes piling up](#uncommitted-beads-changes-piling-up)
5. [Configuration Issues](#configuration-issues)
   - [Plugin not loading or not active](#plugin-not-loading-or-not-active)
   - [Can't find log files](#cant-find-log-files)
6. [Agent and Command Issues](#agent-and-command-issues)
   - [Commands not being recognized](#commands-not-being-recognized)
   - [Beads agents not following instructions](#beads-agents-not-following-instructions)
7. [Sync and Git Issues](#sync-and-git-issues)
   - [Beads files showing up in git status (stealth mode)](#beads-files-showing-up-in-git-status-stealth-mode)
   - [Beads files not showing up in git status (team mode)](#beads-files-not-showing-up-in-git-status-team-mode)
8. [Performance Issues](#performance-issues)
   - [bd commands are slow](#bd-commands-are-slow)
   - [Large log files filling disk](#large-log-files-filling-disk)
9. [Getting Additional Help](#getting-additional-help)
10. [Pattern Index](#pattern-index)

---

## Quick Search Patterns

Use these grep patterns to quickly find solutions:

```bash
# Search for specific error types
grep -n "not found" references/troubleshooting-patterns.md
grep -n "permission" references/troubleshooting-patterns.md
grep -n "hooks" references/troubleshooting-patterns.md

# Search by category
grep -n "## Installation" references/troubleshooting-patterns.md
grep -n "## Runtime" references/troubleshooting-patterns.md
grep -n "## Configuration" references/troubleshooting-patterns.md
```

---

## Installation Issues

### bd command not found after installation

**Symptoms**: Running `bd` returns "command not found" error after installing beads.

**Solutions**:

```bash
# Solution 1: Check npm global bin is in PATH
npm bin -g

# Solution 2: Add npm global bin to PATH
export PATH="$(npm bin -g):$PATH"

# Solution 3: Reinstall beads
npm install -g beads
```

**Root Cause**: The npm global bin directory is not in your system's PATH.

**Permanent Fix**: Add the export command to your shell profile (~/.bashrc, ~/.zshrc, etc.).

---

### npm permission errors during installation

**Symptoms**: EACCES or permission denied errors when running `npm install -g beads`.

**Solutions**:

```bash
# Solution 1: Use sudo (quick but not recommended)
sudo npm install -g beads

# Solution 2: Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g beads
```

**Root Cause**: npm's default global directory requires root permissions on some systems.

**Recommendation**: Always prefer Solution 2 to avoid security issues with sudo.

---

## Initialization Issues

### bd init fails with "not a git repository"

**Symptoms**: Running `bd init` returns an error about not being in a git repository.

**Solution**:

```bash
# Initialize git first
git init
git add .
git commit -m "Initial commit"
bd init --stealth
```

**Root Cause**: Beads requires an existing git repository to function.

**Note**: For mode selection and layout rules, see [project-structure.md](project-structure.md).

---

### Hooks not working after initialization

**Symptoms**: Git commits don't trigger beads sync; hooks appear to be inactive.

**Solution**:

```bash
# Reinstall hooks
bd hooks install

# Verify installation
ls -la .git/hooks/pre-commit
cat .git/hooks/pre-commit
```

**Root Cause**: Hooks may not have been installed properly, or were overwritten by another tool.

**Verification**: The pre-commit hook should contain beads-specific code.

---

### Already initialized but want to switch modes (stealth ↔ team)

**Symptoms**: Need to change from stealth mode to team mode or vice versa.

**Fix**: Follow the canonical transition workflow in [mode-transition.md](mode-transition.md).

Quick checks:

- Stealth detection is driven by the marker in `.git/info/exclude`
- Stealth → team moves AGENTS and docs back to standard repo paths
- Team → stealth creates a visible commit that removes shared opencode-coder artifacts from git

After switching, verify:

- AGENTS.md is in the correct location for the active mode
- docs are in the correct directory for the active mode
- `.coder/` is excluded or gitignored as appropriate
- re-running `/opencode-coder/init` detects the new mode correctly

---

### Stealth files deleted by git clean

**Symptoms**: `.coder/`, `.beads/`, or ai.package.yaml disappeared after running `git clean`.

**Solution**:

```bash
# Re-run /opencode-coder/init to restore stealth setup
# Issue data in .beads/issues.jsonl is lost if .beads/ was deleted
```

**Root Cause**: `git clean -fdx` removes files matched by exclude patterns, including stealth-excluded files.

**Prevention**: Avoid `git clean -fdx` in stealth mode. Prefer `git clean -fd`. If you must use `-x`, exclude stealth directories explicitly.

---

### Stealth mode not detected on re-run

**Symptoms**: `/opencode-coder/init` asks stealth vs team even though stealth was previously configured.

**Solution**: Check `.git/info/exclude` for the stealth marker:

```bash
grep "# opencode-coder stealth mode" .git/info/exclude
```

If marker is missing but `.coder/` exists, re-add the exclusion block manually or re-run `/opencode-coder/init` and choose stealth.

**Root Cause**: Detection relies on the marker comment in `.git/info/exclude`. If someone manually edited the exclude file and removed the marker, detection fails.

See [project-structure.md](project-structure.md) for the canonical detection rules.

---

## Runtime Issues

### bd commands failing with database errors

**Symptoms**: Commands like `bd ready` or `bd list` fail with database-related errors.

**Solution**:

```bash
# Start with diagnostics
bd doctor

# Let bd repair common local problems
bd doctor --fix

# If you're on a fresh clone or recovery path, bootstrap safely
bd bootstrap
```

**Root Cause**: In modern bd setups the issue store is Dolt-backed. Database errors usually come from broken local setup, stale runtime state, or incomplete recovery/migration — not from a single `beads.db` cache file.

**Note**: Prefer `bd doctor` / `bd bootstrap` over manually deleting files unless the diagnostics explicitly tell you to do so. If `bd doctor` reports uncommitted Dolt changes, inspect them with `bd vc status`.

---

### Git hooks not triggering

**Symptoms**: Making commits doesn't trigger beads sync; hooks seem inactive.

**Solution**:

```bash
# Check if hooks are installed
ls -la .git/hooks/

# Reinstall if missing
bd hooks install

# Check if hooks are executable
chmod +x .git/hooks/pre-commit
```

**Root Cause**: Hooks may be missing, not executable, or overwritten by another tool.

**Debugging**: Check `.git/hooks/pre-commit` content to verify it's the beads hook.

---

### Uncommitted beads changes piling up

**Symptoms**: Multiple beads changes accumulate without being committed to git.

**Solution**:

```bash
# Verify hooks are installed (pre-commit hook exports beads state automatically)
bd hooks install

# Then commit as normal — the hook handles beads export
git add .beads/issues.jsonl
git commit -m "chore: sync beads state"
git push origin main
```

**Root Cause**: Hooks may not be installed, or git push is not happening automatically.

**Prevention**: Ensure hooks are installed with `bd hooks install` and remote tracking is configured.

---

## Configuration Issues

### Plugin not loading or not active

**Symptoms**: Plugin commands/agents not available; plugin appears inactive in OpenCode.

**Solution**:

```bash
# Check if plugin is disabled
echo $OPENCODE_CODER_DISABLED

# If "true", enable it by unsetting or setting to false
unset OPENCODE_CODER_DISABLED
# or
export OPENCODE_CODER_DISABLED=false
```

**Root Cause**: `OPENCODE_CODER_DISABLED` environment variable is set to "true".

**Verification**: Check OpenCode logs for plugin loading errors.

---

### Can't find log files

**Symptoms**: Need to view logs for debugging but can't locate them.

**Solution**:

```bash
# Enable debug logging first
export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"

# Find logs by OS:
# Linux:
ls -la ~/.local/share/opencode/log/

# macOS:
ls -la ~/Library/Application\ Support/opencode/log/

# macOS fallback:
ls -la ~/.local/share/opencode/log/

# Windows (PowerShell):
dir $env:LOCALAPPDATA\opencode\log\
```

**Root Cause**: Log location varies by operating system.

**Tip**: Load the internal plugin development skill to parse logs efficiently using its log-analyzer reference.

---

## Agent and Command Issues

### Commands not being recognized

**Symptoms**: Custom commands like `/bd` or `/coder` return "unknown command" errors.

**Solution**:

```bash
# Verify plugin is not disabled
echo $OPENCODE_CODER_DISABLED
# Should be empty or "false"

# Verify ai-resources structure
ls -la ai-resources/commands/
ls -la ai-resources/agents/
```

**Root Cause**: Plugin not loaded, or ai-resources structure is incorrect.

**Debugging**: Check OpenCode logs for plugin loading errors.

---

### Beads agents not following instructions

**Symptoms**: Agents don't behave according to their defined roles or instructions.

**Solution**:

```bash
# Check that AGENTS.md is not interfering
# The plugin injects context via hooks, AGENTS.md should be minimal

# Verify hooks/context plumbing
bd hooks install

# Inspect the issue history and comments that the agent actually touched
bd history <issue-id>
bd comments <issue-id>
```

**Root Cause**: Conflicting instructions in AGENTS.md, missing/outdated hooks, or plugin/runtime problems that prevent the intended context from reaching the agent.

**Best Practice**: Keep AGENTS.md minimal and use [project-structure.md](project-structure.md) as the rule set.

---

## Sync and Git Issues

### Beads files showing up in git status (stealth mode)

**Symptoms**: `.beads/`, `.coder/`, or `ai.package.yaml` appear in `git status` in stealth mode.

**Also applies in team mode**: `.coder/project.yaml` showing as modified in `git status`.

**Solution (stealth mode):**

```bash
# Add the full stealth exclusion block if missing
if ! grep -q "# opencode-coder stealth mode" .git/info/exclude 2>/dev/null; then
  cat >> .git/info/exclude << 'STEALTH'

# opencode-coder stealth mode
.beads/
.opencode/
.coder/
ai.package.yaml
STEALTH
fi

# Verify exclusions
cat .git/info/exclude
```

**Solution (team mode — `.coder/project.yaml` showing as dirty):**

Add `.coder/` to `.gitignore` if needed:

```bash
grep -qF '.coder/' .gitignore 2>/dev/null || echo '.coder/' >> .gitignore
git rm -r --cached .coder/ 2>/dev/null  # Remove from tracking if already committed
git commit -m "chore: exclude .coder/ runtime state from git"
```

**Root Cause**: Files are not properly excluded from git.

See [project-structure.md](project-structure.md) for the canonical visibility rules.

---

### Beads files not showing up in git status (team mode)

**Symptoms**: Can't commit `.beads/` changes in team mode.

**Solution**:

```bash
# Ensure the repo-level ignore rules do not exclude the whole .beads directory
grep -n ".beads" .gitignore

# Ensure files are tracked
git add .beads/

# If git still ignores files, inspect the winning ignore rule
git check-ignore -v .beads/issues.jsonl .beads/config.yaml
```

**Root Cause**: Files are excluded by repo-level `.gitignore` rules or other ignore patterns, or they were never added to git in team mode.

**Best Practice**: In team mode, commit the shared `.beads/` state but keep local-only runtime and legacy files excluded via `.beads/.gitignore`. See [project-structure.md](project-structure.md).

---

## Performance Issues

### bd commands are slow

**Symptoms**: Commands like `bd ready` or `bd list` take several seconds to complete.

**Solution**:

```bash
# Run performance diagnostics first
bd doctor --perf

# Check for large issues.jsonl
wc -l .beads/issues.jsonl

# Preview maintenance before applying it
bd gc --dry-run
```

**Root Cause**: Large issue history, pending maintenance, or slow local Dolt state.

**Prevention**: Periodically run maintenance (`bd gc`) on long-running projects and fix setup/integrity issues with `bd doctor` before doing broader cleanup.

---

### Large log files filling disk

**Symptoms**: OpenCode logs consuming significant disk space.

**Solution**:

```bash
# Linux
du -sh ~/.local/share/opencode/log/

# macOS (canonical)
du -sh ~/Library/Application\ Support/opencode/log/

# macOS fallback (older/alternate setups only)
du -sh ~/.local/share/opencode/log/

# Remove old logs (Linux)
find ~/.local/share/opencode/log/ -name "*.log" -mtime +30 -delete

# Remove old logs (macOS canonical)
find ~/Library/Application\ Support/opencode/log/ -name "*.log" -mtime +30 -delete

# Remove old logs (macOS fallback, if used)
find ~/.local/share/opencode/log/ -name "*.log" -mtime +30 -delete

# Disable debug logging if not needed
unset OPENCODE_DEFAULT_OPTIONS
```

**Root Cause**: Debug logging enabled produces verbose logs that accumulate over time.

**Prevention**: Only enable debug logging when actively troubleshooting.

---

## Getting Additional Help

If your issue isn't covered here:

1. **Enable debug logging** and examine logs by loading the internal plugin development skill
2. **Run health checks**: `bd doctor` and `bd status`
3. **Search existing issues**: https://github.com/dynatrace-oss/opencode-coder/issues
4. **Create a discussion**: https://github.com/dynatrace-oss/opencode-coder/discussions
5. **Report a bug**: Use the [Reporting Issues](#reporting-issues) section in SKILL.md

## Pattern Index

For quick reference, common error patterns:

- **"command not found"** → [Installation Issues](#installation-issues)
- **"permission denied"** → [npm permission errors](#npm-permission-errors-during-installation)
- **"not a git repository"** → [Initialization Issues](#initialization-issues)
- **"database error"** → [Runtime Issues](#runtime-issues)
- **Hook problems** → [Git hooks not triggering](#git-hooks-not-triggering)
- **Slow performance** → [Performance Issues](#performance-issues)
- **File visibility** → [Sync and Git Issues](#sync-and-git-issues)
- **Stealth files missing after git clean** → [Stealth files deleted by git clean](#stealth-files-deleted-by-git-clean)
- **Stealth mode not detected** → [Stealth mode not detected on re-run](#stealth-mode-not-detected-on-re-run)
- **Switch stealth ↔ team** → [Already initialized but want to switch modes](#already-initialized-but-want-to-switch-modes-stealth--team)
