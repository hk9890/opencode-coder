# Status & Doctor (Plugin/Runtime Scope)

Core status/doctor checks for plugin runtime health.

This reference intentionally excludes beads-owned health checks such as `bd doctor`, hooks verification, and tracker diagnostics.

## Quick runtime verification

```bash
echo $OPENCODE_CODER_DISABLED
node --version
npm --version
```

Interpretation:

- `OPENCODE_CODER_DISABLED=true` explains full runtime suppression.
- Missing Node/npm prerequisites can prevent expected runtime behavior.

## Plugin/resource presence checks

```bash
ls -la ai-resources/commands/
ls -la ai-resources/skills/
```

Use these checks when command/skill exposure looks incomplete.

## Runtime doctor triage flow

1. Check hard-disable env override.
2. Verify saved mode file (`.coder/opencode-coder.yaml`) if present.
3. Verify core resource surfaces exist.
4. Enable debug logging and inspect logs.
5. Escalate with bug-report evidence when unresolved.

Detailed troubleshooting routes:

- [troubleshooting-runtime.md](troubleshooting-runtime.md)
- [debugging-logs.md](debugging-logs.md)
- [bug-reporting.md](bug-reporting.md)
