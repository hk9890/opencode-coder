# Troubleshooting: Runtime, Configuration, and Logs

Focused fixes for active plugin/runtime problems.

## `bd` commands failing with database/runtime errors

**Symptoms**: `bd ready`, `bd list`, or related commands fail with database errors.

**Fix sequence**:

```bash
bd doctor
bd doctor --fix
bd bootstrap
```

**Notes**:

- Prefer `bd doctor`/`bd bootstrap` over manual file deletion unless diagnostics explicitly say otherwise.
- If `bd doctor` reports uncommitted Dolt changes, inspect with:

```bash
bd vc status
```

## Plugin not loading or not active

Check disable override:

```bash
echo $OPENCODE_CODER_DISABLED
unset OPENCODE_CODER_DISABLED
# or
export OPENCODE_CODER_DISABLED=false
```

Then validate with `/opencode-coder/status` and plugin logs.

## Commands not recognized (for example `/bd`, `/coder`)

**Checks**:

```bash
echo $OPENCODE_CODER_DISABLED
ls -la ai-resources/commands/
ls -la ai-resources/agents/
```

**Typical causes**: plugin not loaded, disabled mode, or incomplete ai-resources structure.

## Can't find OpenCode log files

Enable debug logging first:

```bash
export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"
```

Log locations:

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

For deeper logging strategy and filters, use [debugging-logs.md](debugging-logs.md).
