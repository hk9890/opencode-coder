# E2E Fixture Projects

These fixtures are **committed, read-only baselines** used by the e2e harness.

Test helpers copy a fixture into a temp workspace before execution so tests can mutate files without touching committed inputs.

## Fixture directories

- `existing-active-project/` — existing project already enabled for active startup
- `cli-smoke-project/` — minimal project used for lightweight CLI startup smoke checks
- `fresh-inactive-project/` — project with no `.coder/` state (init-only behavior)
- `local-startup-parity-project/` — project shape used for local startup parity checks

Each fixture intentionally keeps content minimal. Scenario-specific files can be added later with the same copy-then-run model.

## Shared support fixtures

- `_shared/opencode-config/opencode.json` — committed snapshot of the OpenCode config seeded into each isolated `OPENCODE_CONFIG_DIR` during manual and e2e runs. Update this file intentionally when the test baseline should change; tests do not read your live `~/.config/opencode/opencode.json`.
