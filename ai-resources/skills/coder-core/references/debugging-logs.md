# Debug Logging & Log Analysis (Plugin/Runtime)

Core guide for enabling debug logging and collecting plugin/runtime log evidence.

## Enable debug logging

Use OpenCode default options:

```bash
export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"
```

Enable opencode-coder plugin-specific debug messages:

```bash
export OPENCODE_CODER_DEBUG=1
```

Notes:

- `OPENCODE_DEFAULT_OPTIONS` enables broad OpenCode debug output.
- `OPENCODE_CODER_DEBUG=1` highlights opencode-coder plugin messages.

## Log file locations

```text
Linux:   ~/.local/share/opencode/log/
macOS:   ~/Library/Application Support/opencode/log/
Windows: %LOCALAPPDATA%\opencode\log\
```

macOS fallback in older/alternate setups may still use `~/.local/share/opencode/log/`.

## Quick discovery commands

```bash
# Linux
ls -la ~/.local/share/opencode/log/

# macOS canonical
ls -la ~/Library/Application\ Support/opencode/log/
```

## Filter plugin messages

```bash
# Linux
grep "opencode-coder" ~/.local/share/opencode/log/*.log

# macOS canonical
grep "opencode-coder" ~/Library/Application\ Support/opencode/log/*.log
```

## What to look for

- plugin load/registration errors
- command exposure failures
- runtime exceptions and stack traces
- environment/config signals affecting startup

## Disable debug logging

```bash
unset OPENCODE_DEFAULT_OPTIONS
unset OPENCODE_CODER_DEBUG
```

## Escalation

If unresolved after log review, continue with [bug-reporting.md](bug-reporting.md) and include relevant snippets plus reproduction steps.
