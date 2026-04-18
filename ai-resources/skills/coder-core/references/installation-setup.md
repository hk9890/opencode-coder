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

## Continuing project setup after core is available

Once core resources are available for the project, continue setup by using the installed project-local skills.

1. Load the installed skills for the project, especially installed skills whose names start with `coder-`.
2. Determine which of those skills define initialization or setup workflows.
3. Determine a logical order for initializing those skills.
4. Run the project setup/initialization work for each relevant skill.
5. Skip skills that do not define additional initialization work.
6. Verify that the project setup is complete for the selected mode and installed capabilities.

## If setup still looks wrong

Route to focused troubleshooting:

- runtime/config/log locations: [troubleshooting-runtime.md](troubleshooting-runtime.md)
- debug logging and evidence collection: [debugging-logs.md](debugging-logs.md)
