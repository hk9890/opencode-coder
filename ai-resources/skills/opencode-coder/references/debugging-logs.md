# Debug Logging & Log Analysis

Complete guide to enabling debug logging and analyzing OpenCode logs for troubleshooting.

## Table of Contents

1. [Debug Logging](#debug-logging)
   - [Enabling Debug Logging](#enabling-debug-logging)
   - [Plugin-Specific Debug Logging](#plugin-specific-debug-logging)
   - [Setting Debug Logging Permanently](#setting-debug-logging-permanently)
   - [Log File Locations](#log-file-locations)
   - [Finding Log Files](#finding-log-files)
   - [Analyzing Log Files](#analyzing-log-files)
   - [Useful Log Analysis Commands](#useful-log-analysis-commands)
   - [What to Look For](#what-to-look-for)
   - [Disabling Debug Logging](#disabling-debug-logging)

---

## Debug Logging

When troubleshooting plugin issues or reporting bugs, debug logging is essential for understanding what's happening.

OpenCode provides two types of debug logging:
1. **General OpenCode debug logging** - Shows all OpenCode internals and plugin activity
2. **Plugin-specific debug logging** - Shows only opencode-coder plugin messages

### Enabling Debug Logging

To enable debug logging, set the `OPENCODE_DEFAULT_OPTIONS` environment variable:

```bash
export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"
```

**Important**: The `OPENCODE_LOG` environment variable does NOT work for OpenCode. You must use `OPENCODE_DEFAULT_OPTIONS`.

### Plugin-Specific Debug Logging

The opencode-coder plugin provides its own debug logging that can be enabled independently:

```bash
export OPENCODE_CODER_DEBUG=1
```

**When to use each variable:**

| Variable | What it shows | When to use |
|----------|---------------|-------------|
| `OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"` | All OpenCode internals, all plugins, verbose output | General OpenCode troubleshooting, understanding flow |
| `OPENCODE_CODER_DEBUG=1` | Only opencode-coder plugin messages | Debugging plugin behavior, cleaner logs |
| Both together | Full context with plugin details highlighted | Complex issues, plugin interaction problems |

**Key differences:**
- `OPENCODE_DEFAULT_OPTIONS` affects all of OpenCode and produces verbose output
- `OPENCODE_CODER_DEBUG` only enables opencode-coder plugin messages
- Plugin debug messages log at **info level** and are always visible in OpenCode logs
- Plugin messages are tagged with the `opencode-coder` service name for easy filtering

**Example - Using both together:**

```bash
# Enable all debug logging
export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"
export OPENCODE_CODER_DEBUG=1
```

**Filtering plugin messages in logs:**

When plugin debug logging is enabled, messages are tagged with the service name. Use grep to filter (matching `coder("logs")` / `getOpenCodeLogDirectoryCandidates()` resolution):

```bash
# Linux
grep "opencode-coder" ~/.local/share/opencode/log/*.log

# macOS (canonical)
grep "opencode-coder" ~/Library/Application\ Support/opencode/log/*.log

# macOS fallback (older/alternate setups only)
grep "opencode-coder" ~/.local/share/opencode/log/*.log
```

See [Analyzing Log Files](#analyzing-log-files) for more log analysis techniques.

### Setting Debug Logging Permanently

Add the export command to your shell configuration file:

**For bash (~/.bashrc or ~/.bash_profile):**
```bash
# General OpenCode debug logging
echo 'export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"' >> ~/.bashrc
# Plugin-specific debug logging
echo 'export OPENCODE_CODER_DEBUG=1' >> ~/.bashrc
source ~/.bashrc
```

**For zsh (~/.zshrc):**
```bash
# General OpenCode debug logging
echo 'export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"' >> ~/.zshrc
# Plugin-specific debug logging
echo 'export OPENCODE_CODER_DEBUG=1' >> ~/.zshrc
source ~/.zshrc
```

### Log File Locations

OpenCode log locations vary by operating system:

**Linux:**
```
~/.local/share/opencode/log/
```

**macOS:**
```
~/Library/Application Support/opencode/log/
~/.local/share/opencode/log/ (fallback)
```

**Windows:**
```
%LOCALAPPDATA%\opencode\log\
```

### Finding Log Files

To locate your log directory:

```bash
# Linux
ls -la ~/.local/share/opencode/log/

# macOS (canonical)
ls -la ~/Library/Application\ Support/opencode/log/

# macOS fallback (older/alternate setups)
ls -la ~/.local/share/opencode/log/

# Windows (PowerShell)
dir $env:LOCALAPPDATA\opencode\log\
```

### Analyzing Log Files

Log files are named by date and session. Look for:

1. **Recent files**: Sort by modification time to find latest logs
2. **Error messages**: Search for "ERROR" or "WARN" keywords
3. **Stack traces**: Look for multi-line error traces
4. **Plugin loading**: Check for coder plugin initialization messages

### Useful Log Analysis Commands

```bash
# Linux
ls -lt ~/.local/share/opencode/log/ | head -5

# Linux
grep -i "error" ~/.local/share/opencode/log/*.log

# Linux
tail -100 $(ls -t ~/.local/share/opencode/log/*.log | head -1)

# macOS (canonical)
ls -lt ~/Library/Application\ Support/opencode/log/ | head -5

# macOS (canonical)
grep -i "error" ~/Library/Application\ Support/opencode/log/*.log

# macOS (canonical)
tail -100 $(ls -t ~/Library/Application\ Support/opencode/log/*.log | head -1)

# macOS fallback (older/alternate setups only)
ls -lt ~/.local/share/opencode/log/ | head -5

# Search for opencode-coder plugin messages (Linux)
grep "opencode-coder" ~/.local/share/opencode/log/*.log

# Search for opencode-coder plugin messages (macOS canonical)
grep "opencode-coder" ~/Library/Application\ Support/opencode/log/*.log

# Search for plugin messages with context (Linux)
grep -C 3 "opencode-coder" ~/.local/share/opencode/log/*.log

# Search for plugin messages with context (macOS canonical)
grep -C 3 "opencode-coder" ~/Library/Application\ Support/opencode/log/*.log

# Search for any coder-related messages (Linux)
grep -i "coder" ~/.local/share/opencode/log/*.log

# Search for any coder-related messages (macOS canonical)
grep -i "coder" ~/Library/Application\ Support/opencode/log/*.log
```

### What to Look For

When analyzing logs for plugin issues:

| Issue Type | What to Search For |
|------------|-------------------|
| Plugin not loading | "plugin", "skill", "command", "agent", "coder" keywords |
| Plugin debug messages | "opencode-coder" (when `OPENCODE_CODER_DEBUG=1`) |
| Command failures | "command", "error", stack traces |
| bd CLI issues | "bd", "beads", "spawn", "ENOENT" |
| Hook failures | "hook", "git", "pre-commit" |

**Tip**: When `OPENCODE_CODER_DEBUG=1` is set, plugin debug messages are tagged with the service name `opencode-coder` and log at info level, making them easy to filter from general OpenCode logs.

### Disabling Debug Logging

To disable debug logging, unset the environment variables:

```bash
# Disable general OpenCode debug logging
unset OPENCODE_DEFAULT_OPTIONS

# Disable plugin-specific debug logging
unset OPENCODE_CODER_DEBUG
```

Or remove them from your shell configuration file.

---

> **Plugin developers**: For the log analyzer CLI tool (`bun run scripts/log-analyzer`), load the internal plugin development skill.
