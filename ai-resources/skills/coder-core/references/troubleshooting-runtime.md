# Troubleshooting Runtime/Config (Core)

Focused troubleshooting for plugin/runtime issues.

## Plugin appears disabled or missing

Check hard-disable override first:

```bash
echo $OPENCODE_CODER_DISABLED
```

If needed:

```bash
unset OPENCODE_CODER_DISABLED
# or
export OPENCODE_CODER_DISABLED=false
```

Then verify mode/runtime expectations via [mode-runtime.md](mode-runtime.md).

## Commands not recognized

Check resource surfaces:

```bash
ls -la ai-resources/commands/
ls -la ai-resources/skills/
```

Typical causes:

- plugin not loaded
- runtime hard-disabled
- incomplete or missing resource surface

## Can't find OpenCode logs

Enable debug:

```bash
export OPENCODE_DEFAULT_OPTIONS="--log-level DEBUG"
```

Then inspect known log paths (see [debugging-logs.md](debugging-logs.md)).

## Runtime still unhealthy

Collect evidence and escalate with:

- [debugging-logs.md](debugging-logs.md)
- [bug-reporting.md](bug-reporting.md)
- [session-dump.md](session-dump.md)

For tracker-specific errors, hooks, or `bd doctor` remediation, use the `coder-beads` skill.
