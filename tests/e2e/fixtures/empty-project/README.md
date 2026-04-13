# Empty Project Fixture

Runtime contract source: [`../README.md`](../README.md).

Use this fixture to validate startup in an empty project before any coder state exists.

Runtime expectations after launcher preparation:

- Preparation strategy: `none`
- `.coder/` is absent
- `.opencode/skills`, `.opencode/agents`, `.opencode/commands` are absent
- `.beads/` is absent

Committed placeholder files (for example `.gitkeep`) exist only to keep fixture directories tracked in git and are not the runtime contract.
