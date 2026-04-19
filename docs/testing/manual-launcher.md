# Manual Launcher Reference

Use this secondary reference when `bun run test:manual` is the right validation path.

For testing policy and change-level selection, start with [`../TESTING.md`](../TESTING.md).
For fixture semantics, use [`../../tests/e2e/fixtures/README.md`](../../tests/e2e/fixtures/README.md) as the runtime source of truth.

## Entry points

```bash
bun run test:manual -- --help
bun run test:launcher:preflight
```

- `bun run test:manual -- --help` shows the launcher surface.
- `bun run test:launcher:preflight` is the release-critical preflight for launcher setup.

## Execution models

- `--fixture=<name>`
  - prepares a disposable workspace from a canonical fixture
  - best default for reproducible launcher checks
- `--project-path <path>`
  - runs against a real project without copying it
  - still uses isolated HOME/XDG/OpenCode state under `.manual-test-runs/`
  - keeps launcher-owned plugin/resources in isolated `OPENCODE_CONFIG_DIR`

Manual launcher runs prewarm isolated OpenCode runtime state when `opencode` is available so repeated local checks avoid paying the one-time migration cost every time.

## Key options

- `--mode=tui|shell|command` — interactive UI, inspect-first shell, or one-shot command execution
- `--plugin-source=local-build` — use the current repo build
- `--plugin-source=installed-configured` — compare against the installed configured plugin
- `--auth <path>` — seed auth into isolated OpenCode data when model-backed behavior is needed

## Recommended workflow

1. Run deterministic checks first when the change type requires them.
2. Pick the smallest manual scenario that answers the question.
3. Prefer fixtures for reproducible startup and routing checks.
4. Use `--project-path` only when a real repo is required.
5. Judge semantic outcomes directly; do not rely on string-fragment heuristics.

## Scenario guide

| Scenario | Use when | Recommended command |
|---|---|---|
| Quick startup smoke | Prove launcher/plugin wiring starts at all | `bun run test:manual -- --mode=tui --fixture=empty-project` |
| Existing active project behavior | Inspect commands and startup shape in an active project | `bun run test:manual -- --mode=shell --fixture=coder-skill-installed` |
| Fresh inactive project behavior | Confirm init-only behavior before activation | `bun run test:manual -- --mode=shell --fixture=empty-project` |
| Local startup parity | Compare real CLI startup against the parity fixture | `bun run test:manual -- --mode=shell --fixture=coder-mode-configured` |
| Real project reproduction | Validate behavior against an actual local repo | `bun run test:manual -- --mode=shell --project-path "$HOME/dev/some-project"` |
| Installed vs local comparison | Answer whether a fix exists only locally | rerun the same scenario once with `--plugin-source=installed-configured` and once with `--plugin-source=local-build` |

`env` remains useful for checking isolated launcher environment wiring:

```bash
bun run test:manual -- --mode=command --project-path "$HOME/dev/some-project" -- env
```

## `/simplify` semantic validation

Use this path when you need isolated manual validation of standalone `code-simplify` behavior.

### `local-build`

```bash
bun run test:manual -- --mode=tui --fixture=coder-skill-installed --plugin-source=local-build
```

Shell mode is inspection-first. If you stay in shell mode, install any extra resources manually inside the isolated shell before launching OpenCode.

### `installed-configured`

1. Launch the isolated shell:

   ```bash
   bun run test:manual -- --mode=shell --fixture=coder-skill-installed --plugin-source=installed-configured
   ```

2. Bootstrap resources through `aimgr` inside that shell:

   ```bash
   # coder-skill-installed already includes ai.package.yaml, so do not run `aimgr init` here
   aimgr repo add local:/absolute/path/to/your/opencode-coder/clone/ai-resources

   # Full split surface
   aimgr install --target opencode package/coder-core package/coder-support package/coder-docs package/coder-beads

   # Or isolated simplify validation only
   aimgr install --target opencode package/code-simplify
   ```

3. Start OpenCode from the same shell and run `/simplify ...`.

Notes:

- Pass `--target opencode` in hermetic launcher/test environments so installs land in `.opencode/`.
- If `aimgr` or package access is unavailable, `installed-configured` semantic validation cannot complete.

## Beads-specific launcher notes

- Fixture-based beads runtime checks use the two-tier fixture model described in [`../../tests/e2e/fixtures/README.md`](../../tests/e2e/fixtures/README.md).
- Test harness paths initialize copied beads workspaces with `bd init --non-interactive --skip-hooks --skip-agents --quiet` when required.
- Beads uses a single-writer embedded backend, so serialize `bd` writes in tests and evals for the same workspace.
- Do not rely on “one concurrent write must fail” as a test oracle; route tracker mutations through one serialized lane per workspace.
