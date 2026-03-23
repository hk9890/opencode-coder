---
description: Show opencode-coder plugin status and information
---

# Plugin Status

Use `/opencode-coder/status` to inspect the current plugin installation, project state, and basic health signals.

## Task

Use direct bash commands to gather the following information:

1. **Plugin information**
   - Check the supported install locations under `~/.cache/opencode/node_modules/`.
   - Read `package.json` from the detected install.
   - Report the plugin name, version, description, and installation path.

2. **Current project status**
   - Report whether `OPENCODE_CODER_DISABLED=true` is set.
   - Report the current working directory.
   - Report the beads CLI version when `bd` is available.
   - Report whether `.beads/` exists.
   - Report the saved plugin mode from `.coder/opencode-coder.yaml` when present.

3. **Health summary**
   - Check whether the plugin is installed.
   - Check whether the plugin is active or disabled.
   - Check whether beads CLI is available.
   - Check whether the project is beads-initialized.
   - Check whether git hooks are installed.

4. **Escalate when deeper diagnosis is needed**
   - If the user wants full troubleshooting guidance, load the `opencode-coder` skill and use `references/status-health.md`.

## Report

Present the result as a concise status report with clear sections such as:

- Plugin Information
- Configuration / Mode
- Health Summary
- Immediate next steps when something is missing or broken

## Notes

- Use bash for the data collection.
- Probe both supported install scopes: `@dynatrace-oss` and `@hk9890`.
- Prefer concise, readable output over dumping raw command noise.
