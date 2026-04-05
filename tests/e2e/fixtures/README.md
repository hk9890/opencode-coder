# E2E Fixture Projects

These fixtures are **committed, read-only baselines** used by the e2e harness.

Test helpers copy a fixture into a temp workspace before execution so tests can mutate files without touching committed inputs.

The manual launcher also supports `--project-path <dir>` for reproducing behavior from a real local project. That mode now runs **directly in the provided project path** while keeping HOME/XDG/OpenCode state isolated under the launcher run directory. Use a clean branch, worktree, or disposable project when testing this way.

## Fixture directories

- `existing-active-project/` — existing project already enabled for active startup
- `cli-smoke-project/` — minimal project used for lightweight CLI startup smoke checks
- `fresh-inactive-project/` — project with no `.coder/` state (init-only behavior)
- `local-startup-parity-project/` — project shape used for local startup parity checks

Each fixture intentionally keeps content minimal. Scenario-specific files can be added later with the same disposable fixture-copy model.

### `/simplify` validation note for `existing-active-project`

`existing-active-project` does not guarantee the minimal normal-mode threshold (`opencode-coder/init` command + `opencode-coder` skill). In isolated runs, `/simplify` may be unavailable until resources are installed through the normal path.

For reproducible semantic validation without manual file copying:

1. `bun run test:manual -- --mode=shell --fixture=existing-active-project --plugin-source=local-build`
2. inside shell:
   - `aimgr repo add local:/absolute/path/to/your/opencode-coder/clone/ai-resources`
   - `aimgr install package/opencode-coder`
   - do not run `aimgr init` for this fixture (`ai.package.yaml` is already committed)
3. run OpenCode and validate `/simplify`

## Shared support fixtures

- `_shared/opencode-config/opencode.json` — committed snapshot of the OpenCode config seeded into each isolated `OPENCODE_CONFIG_DIR` during manual and e2e runs. Update this file intentionally when the test baseline should change; tests do not read your live `~/.config/opencode/opencode.json`.
  - Keeps `plugin` empty so isolated startup does not attempt unavailable external plugin installs.
  - Does **not** pin `@dynatrace-oss/opencode-coder`; the coder plugin under test comes from the locally wired build artifact at `.opencode/plugins/opencode-coder.js`.

For manual installed-vs-local comparison flows:

- `--plugin-source=local-build` wires this repository's built artifact into `.opencode/plugins/opencode-coder.js` and disables configured default plugin loading.
- `--plugin-source=installed-configured` resolves one configured `@dynatrace-oss/opencode-coder@...` package from host `opencode.json`, then writes that package spec into isolated temp config.
