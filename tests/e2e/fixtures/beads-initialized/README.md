# Beads Initialized Fixture

Runtime contract source: [`../README.md`](../README.md).

Use this fixture to validate fully initialized team workflow behavior with beads ready and orchestrator available.

Runtime expectations after launcher preparation:

- Preparation strategy: `aimgr-installed`
- `.coder/opencode-coder.yaml` exists with `mode: team`
- `.coder/project.yaml` exists with beads-ready semantics (runtime-generated file is authoritative)
- `.opencode/skills`, `.opencode/commands`, and `.opencode/agents` are present (including `coder-beads` and orchestrator)
- `.beads/` is present and initialized

This fixture does not rely on a "seed ai-resources at runtime" contract; runtime resources follow the canonical `aimgr-installed` staged behavior. The committed `.coder/project.yaml` remains a placeholder seed and is rewritten by runtime detection.
