# E2E Fixture Projects

These fixtures are **committed, read-only baselines** used by the e2e harness.

Test helpers copy a fixture into a temp workspace before execution so tests can mutate files without touching committed inputs.

The manual launcher also supports `--project-path <dir>` for reproducing behavior from a real local project. That mode now runs **directly in the provided project path** while keeping HOME/XDG/OpenCode state isolated under the launcher run directory. Use a clean branch, worktree, or disposable project when testing this way.

## Fixture directories

- `empty-project/` — Stage 0 baseline with no committed `.coder/` state
- `coder-mode-configured/` — Stage 1 baseline with committed coder mode config only
- `coder-skill-installed/` — Stage 2 baseline with committed coder mode and skill-install files

Each fixture intentionally keeps content minimal. Scenario-specific files can be added later with the same disposable fixture-copy model.

## Canonical stage model (committed state)

| Stage | Fixture directory | What is committed |
|---|---|---|
| Stage 0 | `empty-project` | `.gitkeep`, `.opencode/.gitkeep` |
| Stage 1 | `coder-mode-configured` | Stage 0 + `.coder/opencode-coder.yaml` |
| Stage 2 | `coder-skill-installed` | Stage 1 + `.coder/project.yaml`, `ai.package.yaml` |
| Stage 3 | `beads-initialized` | Stage 2 + `.beads/.gitkeep` |

## Scenarios vs fixture identity

- Fixture identity is the committed on-disk state in these directories.
- Scenario labels (for example smoke, parity, team, stealth) describe **how** a test is run, not fixture directory names.

## Legacy fixture name mapping

| Legacy fixture name | Canonical fixture |
|---|---|
| `cli-smoke-project` | `empty-project` |
| `fresh-inactive-project` | `empty-project` |
| `local-startup-parity-project` | `coder-mode-configured` |
| `existing-active-project` | `coder-skill-installed` |

### `/simplify` validation note for `coder-skill-installed`

`coder-skill-installed` does not guarantee the minimal normal-mode threshold (`opencode-coder/init` command + `opencode-coder` skill). In isolated runs, `/simplify` may be unavailable until resources are installed through the normal path.

**`local-build` runs** (default for development): The manual launcher calls `seedAiResources()` which copies agents, commands, and skills from `ai-resources/` into the workspace `.opencode/`. This makes `/simplify` available automatically — no manual `aimgr` steps needed.

```bash
bun run test:manual -- --mode=shell --fixture=coder-skill-installed --plugin-source=local-build
# /simplify is available immediately after OpenCode starts
```

**`installed-configured` runs**: Resources are not seeded automatically. Use `aimgr` to install them in the isolated shell:

1. `bun run test:manual -- --mode=shell --fixture=coder-skill-installed --plugin-source=installed-configured`
2. inside shell:
   - `aimgr repo add local:/absolute/path/to/your/opencode-coder/clone/ai-resources`
   - `aimgr install package/opencode-coder`
   - do not run `aimgr init` for this fixture (`ai.package.yaml` is already committed)
3. run OpenCode and validate `/simplify`

## Beads-stage fixture strategy

### Two-tier approach

1. **Committed marker**: `.beads/.gitkeep` is the only beads content committed in fixtures. This is sufficient for plugin detection tests (`detectBeadsDirectory()` only checks directory existence).

2. **Runtime generation**: The harness auto-detects `.beads/` in copied fixture workspaces and runs `bd init --skip-hooks --skip-agents --quiet` to create a functional beads workspace. This keeps committed state minimal while providing real beads for manual and integration testing.

### Resource seeding

The manual launcher seeds `ai-resources/` (agents, commands, skills) into the workspace `.opencode/` directory when using `local-build` plugin source. This ensures `classifyRuntimePhase()` returns `normal` and all agents (orchestrator, tasker, reviewer, verifier) are available.

### Single-writer constraint

The embedded-dolt beads backend is single-writer. Concurrent `bd create` / `bd update` calls against the same `.beads/` workspace will fail with exclusive-lock errors. Tests and evals that issue `bd` write commands must serialize them. See `opencode-coder-eupg` for details.

## Shared support fixtures

- `_shared/opencode-config/opencode.json` — committed snapshot of the OpenCode config seeded into each isolated `OPENCODE_CONFIG_DIR` during manual and e2e runs. Update this file intentionally when the test baseline should change; tests do not read your live `~/.config/opencode/opencode.json`.
  - Keeps `plugin` empty so isolated startup does not attempt unavailable external plugin installs.
  - Does **not** pin `@dynatrace-oss/opencode-coder`; the coder plugin under test comes from the locally wired build artifact at `.opencode/plugins/opencode-coder.js`.

For manual installed-vs-local comparison flows:

- `--plugin-source=local-build` wires this repository's built artifact into `.opencode/plugins/opencode-coder.js` and disables configured default plugin loading.
- `--plugin-source=installed-configured` resolves one configured `@dynatrace-oss/opencode-coder@...` package from host `opencode.json`, then writes that package spec into isolated temp config.
