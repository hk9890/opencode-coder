# Fixture Runtime Contract (Manual + E2E)

This document is the canonical contract for what each manual-test fixture means **at runtime** after launcher preparation.

- Source-of-truth: the prepared runtime workspace.
- Not source-of-truth: committed placeholder scaffolding (`README.md`, `.gitkeep`, etc.).

For launcher execution flow and scenario matrix details, see [`docs/TESTING.md`](../../../docs/TESTING.md).

## Runtime preparation strategies

The launcher uses one of these preparation strategies per fixture:

- `none` — do not preinstall project-local OpenCode resources.
- `seeded` — copy resource surfaces directly into project `.opencode/` (legacy helper strategy, intentionally not the canonical staged-fixture strategy).
- `aimgr-installed` — initialize isolated aimgr state and install packages so `.opencode/` surfaces are created by package install behavior.

## Fixture contract by runtime stage

### `empty-project`

Use case: start OpenCode with the plugin in an empty directory and confirm startup/init behavior before any project-local coder state exists.

- Preparation strategy: `none`
- Expected runtime workspace after launcher preparation:
  - `.coder/` absent
  - `.opencode/skills`, `.opencode/agents`, `.opencode/commands` absent
  - `.beads/` absent
- `.coder` YAML expectations:
  - `.coder/opencode-coder.yaml` absent
  - `.coder/project.yaml` absent
- `.coder/project.yaml` status: absent (not generated yet, no placeholder expected)
- Orchestrator availability: unavailable

### `coder-mode-configured`

Use case: validate startup when coder mode is configured, but runtime resources and beads have not been installed yet.

- Preparation strategy: `none`
- Expected runtime workspace after launcher preparation:
  - `.coder/opencode-coder.yaml` present
  - `.coder/project.yaml` absent
  - `.opencode/skills`, `.opencode/agents`, `.opencode/commands` absent
  - `.beads/` absent
- `.coder` YAML expectations:
  - `.coder/opencode-coder.yaml` exists with `mode: stealth`
    - Rationale: this fixture pins configured mode-only behavior without implying team/beads readiness.
  - `.coder/project.yaml` absent at this stage
- `.coder/project.yaml` status: absent (runtime not initialized enough to generate stable project state)
- Orchestrator availability: unavailable

### `coder-skill-installed`

Use case: validate non-beads coder runtime capability in a prepared project where core/docs/simplify surfaces exist, but beads and orchestrator are intentionally not installed.

- Preparation strategy: `aimgr-installed`
- Expected runtime workspace after launcher preparation:
  - `.coder/opencode-coder.yaml` present
  - `.coder/project.yaml` present
  - `.opencode/skills` present
  - `.opencode/commands` present
  - `.opencode/agents` absent (orchestrator not installed at this stage)
  - `.beads/` absent
- `.coder` YAML expectations:
  - `.coder/opencode-coder.yaml` exists with `mode: team`
    - Rationale: stage-2 represents an active team-style coder setup, but still below beads/orchestrator readiness.
  - `.coder/project.yaml` exists and describes a pre-beads runtime phase (`beadsReady: false` semantics)
- `.coder/project.yaml` status: runtime-generated project-state file is authoritative; committed fixture copy is only a placeholder seed
- Orchestrator availability: unavailable

### `beads-initialized`

Use case: validate fully initialized team workflow with beads state present and orchestrator available to become default on startup.

- Preparation strategy: `aimgr-installed`
- Expected runtime workspace after launcher preparation:
  - `.coder/opencode-coder.yaml` present
  - `.coder/project.yaml` present
  - `.opencode/skills` present (including `coder-beads`)
  - `.opencode/commands` present
  - `.opencode/agents` present (including orchestrator)
  - `.beads/` present and initialized for runtime use
- `.coder` YAML expectations:
  - `.coder/opencode-coder.yaml` exists with `mode: team`
    - Rationale: this fixture models the team-mode/beads-ready runtime where orchestrator routing can be defaulted.
  - `.coder/project.yaml` exists and reflects beads-ready semantics for the initialized workspace
- `.coder/project.yaml` status: runtime-generated state is authoritative; committed fixture copy is only a placeholder seed
- Orchestrator availability: available and expected to become the default agent on startup

## Committed scaffolding vs runtime contract

Fixture directories in git may include scaffolding files (`README.md`, `.gitkeep`, and similar markers) so directories stay tracked and documented.

Runtime contract precedence:

- If a fixture contract says a path is absent at runtime, committed scaffolding for that path must not appear in the prepared workspace.
- Committed scaffolding is implementation support for repository maintenance, not a user-visible runtime guarantee.

## Isolated state outside project workspace

Manual launcher runs also create isolated runtime state **outside** the project workspace under the run directory (HOME/XDG/OpenCode config emulation).

That external isolated state is part of launcher hermeticity, but it is not part of the per-fixture project tree contract described above.
