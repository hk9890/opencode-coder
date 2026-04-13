# Coder Mode Configured Fixture

Runtime contract source: [`../README.md`](../README.md).

Use this fixture to validate configured mode behavior before runtime resources or beads are installed.

Runtime expectations after launcher preparation:

- Preparation strategy: `none`
- `.coder/opencode-coder.yaml` exists with `mode: stealth`
- `.coder/project.yaml` is absent
- `.opencode/skills`, `.opencode/agents`, `.opencode/commands` are absent
- `.beads/` is absent

Committed placeholders are repository-maintenance scaffolding, not fixture identity.
