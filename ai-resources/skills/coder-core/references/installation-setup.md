# Installation & Setup (Core Runtime)

Core setup guidance for opencode-coder plugin/runtime behavior.

This reference intentionally excludes beads tracker bootstrap, hooks, and tracker-health workflows.

## Preferred setup path

Use the plugin's init/setup entrypoint in your OpenCode session when available.

If startup appears inactive, first verify runtime state using:

- [mode-runtime.md](mode-runtime.md)
- [status-doctor.md](status-doctor.md)

## Prerequisites

| Tool | Purpose |
|---|---|
| OpenCode CLI/runtime | Loads plugin resources and commands |
| Node.js + npm | Runtime prerequisites for plugin/tooling |

## Manual runtime checks

```bash
node --version
npm --version
echo $OPENCODE_CODER_DISABLED
```

- `OPENCODE_CODER_DISABLED=true` hard-disables the plugin runtime.
- Empty or `false` means runtime is allowed (subject to project mode/resource state).

## Saved mode file

Project-local mode state is persisted at:

```text
.coder/opencode-coder.yaml
```

Supported saved modes:

- `disabled`
- `stealth`
- `team`

See [mode-runtime.md](mode-runtime.md) for behavior details.

## Hard-disable override vs saved disabled mode

- Hard override (`OPENCODE_CODER_DISABLED=true`): plugin returns no runtime surfaces.
- Saved mode `disabled`: project-local active behavior is suppressed, but setup/init surface may remain available.

## If setup still looks wrong

Route to focused troubleshooting:

- runtime/config/log locations: [troubleshooting-runtime.md](troubleshooting-runtime.md)
- debug logging and evidence collection: [debugging-logs.md](debugging-logs.md)
