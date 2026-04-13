# Coder Skill Installed Fixture

Runtime contract source: [`../README.md`](../README.md).

Use this fixture to validate non-beads runtime capability where coder resources are installed but orchestrator and beads are not.

Runtime expectations after launcher preparation:

- Preparation strategy: `aimgr-installed`
- `.coder/opencode-coder.yaml` exists with `mode: team`
- `.coder/project.yaml` exists with pre-beads semantics (runtime-generated file is authoritative)
- `.opencode/skills` and `.opencode/commands` are present
- `.opencode/agents` is absent (orchestrator not installed)
- `.beads/` is absent

Committed files (including `ai.package.yaml` and placeholder markers) support reproducible setup. The committed `.coder/project.yaml` is a placeholder seed; runtime startup rewrites it and that runtime-generated state defines fixture behavior.
