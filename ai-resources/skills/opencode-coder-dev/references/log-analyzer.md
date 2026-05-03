# Log Analyzer Tool

The log analyzer CLI tool is located at `scripts/log-analyzer/` in the `opencode-coder` repository.

---

## Analyzing OpenCode Logs

The opencode-coder plugin includes a powerful log analyzer tool for debugging plugin loading issues, command execution, agent behavior, and other OpenCode-related problems. The analyzer provides fast filtering, interactive mode with fzf, and various output formats.

### Overview

The log analyzer is a CLI tool located at `scripts/log-analyzer/` that:

- **Discovers** processes and sessions across all OpenCode log files
- **Filters** logs by process ID, session ID, service name, log level, and time range
- **Formats** output with colors, timestamps, and structured data
- **Analyzes** patterns using ripgrep for performance (falls back gracefully if not available)
- **Provides** interactive mode with fzf for easy process/session selection

The tool automatically locates your OpenCode log directory based on your operating system.

### Running the Log Analyzer

The log analyzer requires the Bun runtime:

```bash
# From the opencode-coder repository root
bun run scripts/log-analyzer
```

### Interactive Mode

Interactive mode uses `fzf` to provide a visual picker for selecting processes or sessions. This is the easiest way to explore logs.

**Requirements:**
- `fzf` must be installed: https://github.com/junegunn/fzf#installation

**Usage:**
```bash
# Run without arguments to enter interactive mode
bun run scripts/log-analyzer
```

**What happens:**
1. Analyzer scans all log files for processes and sessions
2. Presents a searchable list with fzf
3. Shows process info (PID, directory, session count, line count)
4. Shows session info (session ID, PID, timestamps, line count)
5. After selection, displays filtered logs

**If fzf is not available:**
```
Error: fzf is required for interactive mode but was not found.
Install fzf: https://github.com/junegunn/fzf#installation

Alternatively, use CLI arguments:
  bun run scripts/log-analyzer list sessions
  bun run scripts/log-analyzer --session=<sessionID>
```

### CLI Mode

CLI mode allows direct filtering with command-line arguments. Useful for scripting, automation, or when fzf is not available.

#### List Commands

**List all processes:**
```bash
bun run scripts/log-analyzer list processes
```

Output example:
```
Found 3 processes:

Process 12345
  Directory: /home/user/project
  Session count: 2
  Line count: 847
  Started: 2026-01-25 10:30:15
  Ended: 2026-01-25 10:45:22
  Log files: 2026-01-25-session.log

Process 12346
  Directory: /home/user/another-project
  Session count: 1
  Line count: 423
  ...
```

**List all sessions:**
```bash
bun run scripts/log-analyzer list sessions
```

Output example:
```
Found 5 sessions:

Session ses_48058fe91ffeRYQhrEE0q0u8rm
  Process ID: 12345
  Line count: 512
  Started: 2026-01-25 10:30:15
  Ended: 2026-01-25 10:35:40
  Log files: 2026-01-25-session.log

Session ses_xyz789...
  Process ID: 12346
  Line count: 201
  ...
```

#### Filter Options

**Filter by process ID:**
```bash
bun run scripts/log-analyzer --pid=12345
```

Shows all log entries from the specified process across all sessions.

**Filter by session ID:**
```bash
bun run scripts/log-analyzer --session=ses_48058fe91ffeRYQhrEE0q0u8rm
```

Shows all log entries from a specific session. Most useful for debugging a particular interaction.

**Filter by service:**
```bash
# Single service
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder

# Multiple services (comma-separated)
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder,session.prompt
```

Available service names typically include:
- `opencode-coder` - Plugin-specific logs
- `session.prompt` - AI session management
- `server` - OpenCode server logs
- `plugin.loader` - Plugin loading system

**Filter by log level:**
```bash
# Show only errors and warnings
bun run scripts/log-analyzer --session=ses_xxx --level=ERROR,WARN

# Show only errors
bun run scripts/log-analyzer --pid=12345 --level=ERROR

# Multiple levels
bun run scripts/log-analyzer --session=ses_xxx --level=WARN,ERROR,DEBUG
```

Available log levels:
- `DEBUG` - Detailed diagnostic information
- `INFO` - General informational messages
- `WARN` - Warning messages
- `ERROR` - Error messages

**Limit output with tail:**
```bash
# Show last 50 lines
bun run scripts/log-analyzer --session=ses_xxx --tail=50

# Show last 100 lines of errors only
bun run scripts/log-analyzer --session=ses_xxx --level=ERROR --tail=100
```

Tail is applied after all other filters and sorting by timestamp.

#### Output Options

**JSON output:**
```bash
bun run scripts/log-analyzer --session=ses_xxx --json
```

Returns structured JSON array of log entries:
```json
[
  {
    "level": "INFO",
    "timestamp": "2026-01-25T10:30:15.234Z",
    "deltaMs": 0,
    "pid": 12345,
    "service": "opencode-coder",
    "sessionID": "ses_xxx",
    "directory": "/home/user/project",
    "fields": { "key": "value" },
    "message": "Plugin loaded successfully",
    "raw": "INFO ...",
    "sourceFile": "2026-01-25-session.log"
  }
]
```

Useful for:
- Further processing with `jq` or other tools
- Scripting and automation
- Extracting specific fields

**Disable colors:**
```bash
bun run scripts/log-analyzer --session=ses_xxx --no-color
```

Useful when:
- Piping to files
- Using in CI/CD environments
- Terminal doesn't support ANSI colors

**Raw output:**
```bash
bun run scripts/log-analyzer --session=ses_xxx --raw
```

Shows original log lines without formatting. Useful for:
- Copying exact log output
- Debugging log format issues
- Preserving exact spacing and formatting

**Full timestamps:**
```bash
bun run scripts/log-analyzer --session=ses_xxx --full-timestamp
```

Shows complete ISO timestamps instead of just time. Useful when analyzing logs across multiple days or when exact dates matter.

### Common Use Cases

#### Debugging Plugin Loading Issues

When the plugin fails to load or commands aren't recognized:

```bash
# Find recent session with plugin issues
bun run scripts/log-analyzer list sessions

# Analyze plugin loading for that session
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder,plugin.loader

# Look for errors during plugin initialization
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder --level=ERROR,WARN
```

**What to look for:**
- "Plugin failed to load" messages
- Missing dependencies or configuration files
- Path resolution errors
- Permission issues

#### Analyzing Command Execution

When custom commands fail or behave unexpectedly:

```bash
# Show all logs from a session where command failed
bun run scripts/log-analyzer --session=ses_xxx

# Filter to command execution logs
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder | grep -i "command"

# Check for errors during command execution
bun run scripts/log-analyzer --session=ses_xxx --level=ERROR --service=opencode-coder
```

**What to look for:**
- Command registration messages
- Argument parsing errors
- Execution failures
- Return value issues

#### Investigating Agent Behavior

When beads agents don't follow instructions or behave incorrectly:

```bash
# Get full session context
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder

# Focus on session/agent interactions
bun run scripts/log-analyzer --session=ses_xxx --service=session.prompt

# Last 200 lines to see recent context
bun run scripts/log-analyzer --session=ses_xxx --tail=200
```

**What to look for:**
- Agent mode initialization
- Context injection messages
- Prompt construction logs
- Tool execution logs

#### Finding Patterns Across Sessions

When issues occur intermittently across multiple sessions:

```bash
# List all sessions to identify affected ones
bun run scripts/log-analyzer list sessions

# Search for specific error across all recent logs
bun run scripts/log-analyzer list sessions | grep "ENOENT"

# Analyze multiple sessions with same issue
bun run scripts/log-analyzer --session=ses_xxx --level=ERROR
bun run scripts/log-analyzer --session=ses_yyy --level=ERROR
```

#### Performance Analysis

When OpenCode feels slow or unresponsive:

```bash
# Get full timeline of a session
bun run scripts/log-analyzer --session=ses_xxx --full-timestamp

# Look for slow operations (check deltaMs in output)
bun run scripts/log-analyzer --session=ses_xxx --json | jq '.[] | select(.deltaMs > 1000)'

# Focus on server performance logs
bun run scripts/log-analyzer --session=ses_xxx --service=server
```

### Integration with Troubleshooting Workflows

The log analyzer integrates with the overall troubleshooting process:

**Step 1: Enable debug logging**
```bash
export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"
```

**Step 2: Reproduce the issue**
Perform the action that causes the problem in OpenCode.

**Step 3: Find the session**
```bash
# Interactive mode (easiest)
bun run scripts/log-analyzer

# Or list recent sessions
bun run scripts/log-analyzer list sessions | head -20
```

**Step 4: Analyze the session**
```bash
# Start broad
bun run scripts/log-analyzer --session=ses_xxx

# Narrow to errors
bun run scripts/log-analyzer --session=ses_xxx --level=ERROR,WARN

# Focus on plugin
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder --level=ERROR,WARN
```

**Step 5: Extract relevant logs for reporting**
```bash
# Get JSON for detailed analysis
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder --json > issue-logs.json

# Get formatted output for issue description
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder --level=ERROR,WARN --no-color > issue-logs.txt
```

### Advanced Filtering Examples

**Combine multiple filters:**
```bash
# Errors and warnings from plugin in last 50 lines
bun run scripts/log-analyzer --session=ses_xxx --service=opencode-coder --level=ERROR,WARN --tail=50

# All plugin activity for a specific process
bun run scripts/log-analyzer --pid=12345 --service=opencode-coder --json

# Recent errors across all services
bun run scripts/log-analyzer --session=ses_xxx --level=ERROR --tail=100 --full-timestamp
```

**Using with other CLI tools:**
```bash
# Count errors by service
bun run scripts/log-analyzer --level=ERROR --json | jq -r '.[] | .service' | sort | uniq -c

# Find sessions with specific error
bun run scripts/log-analyzer list sessions | grep "opencode-coder" | head -5

# Extract error messages only
bun run scripts/log-analyzer --session=ses_xxx --level=ERROR --json | jq -r '.[] | .message'

# Get timestamps of all errors
bun run scripts/log-analyzer --session=ses_xxx --level=ERROR --json | jq -r '.[] | .timestamp'
```

### Performance Notes

**Fast filtering with ripgrep:**

The log analyzer uses `ripgrep` (rg) for fast log filtering when available. This makes analyzing large log files much faster.

To install ripgrep:
```bash
# Ubuntu/Debian
apt-get install ripgrep

# macOS
brew install ripgrep

# Fedora
dnf install ripgrep
```

**Graceful fallback:**

If ripgrep is not available, the analyzer falls back to reading files directly. Functionality is identical, just slower for large log directories.

**Performance tips:**
- Use `--session` to narrow scope before other filters
- Use `--tail` to limit output size
- Filter by `--service` when debugging specific components
- Use `--level=ERROR,WARN` to focus on problems

### Troubleshooting the Log Analyzer

**Issue: "Cannot find log directory"**

The analyzer looks in standard OpenCode log locations. If logs are in a custom location, ensure `OPENCODE_DEFAULT_OPTIONS` is set correctly.

**Issue: "bun: command not found"**

The log analyzer requires Bun runtime. Install it:
```bash
curl -fsSL https://bun.sh/install | bash
```

Or check: https://bun.sh/docs/installation

**Issue: Interactive mode fails without fzf**

Install fzf or use CLI mode with explicit filters:
```bash
# Instead of interactive mode
bun run scripts/log-analyzer

# Use explicit session filter
bun run scripts/log-analyzer list sessions
bun run scripts/log-analyzer --session=ses_xxx
```

**Issue: No matching log entries found**

Check that:
1. Debug logging is enabled: `echo $OPENCODE_DEFAULT_OPTIONS`
2. The session ID is correct: `bun run scripts/log-analyzer list sessions`
3. Log files exist: `ls -la ~/.local/share/opencode/log/` (Linux)
4. Filters aren't too restrictive: remove `--level` or `--service` filters

### Summary

The log analyzer is a powerful tool for:

- **Discovery**: Find processes and sessions across log files
- **Filtering**: Narrow logs by process, session, service, level, and time
- **Analysis**: Understand plugin loading, command execution, and agent behavior
- **Debugging**: Identify errors, warnings, and performance issues
- **Reporting**: Extract relevant logs for bug reports

For most troubleshooting, start with basic debug logging, then use the analyzer when you need precise filtering or when reporting issues.
