# Mode & Runtime Guidance (Core)

Canonical core guidance for plugin runtime mode behavior.

## Saved mode source of truth

Use `.coder/opencode-coder.yaml` as the primary project-local source when it exists.

Saved modes:

- `disabled`
- `stealth`
- `team`

## Fresh project rule

If no saved mode is present and no legacy active markers are detected, treat the project as **not yet enabled**.

In this state:

- project-local active startup behavior should not run
- init/setup surface remains the path to explicit enablement

## Runtime phase threshold

`coder-core` is a direct-load skill surface. Core runtime semantics must not depend on legacy command-wrapper or combined-skill surfaces.

Treat runtime phase behavior as determined by core mode signals:

- hard-disable env override (`OPENCODE_CODER_DISABLED`)
- saved mode file state (`.coder/opencode-coder.yaml`) when present

Optional companion skills may add workflows, but they are not required for core runtime semantics.

## Hard-disable rule

`OPENCODE_CODER_DISABLED=true` is outside saved-mode behavior.

- hard override active → plugin runtime surfaces are suppressed
- saved `disabled` mode → project-local active behavior is suppressed, but setup/init path can remain available

## Operational checks

```bash
echo $OPENCODE_CODER_DISABLED
ls -la .coder/opencode-coder.yaml
```

If runtime behavior does not match expected mode:

1. verify env override first
2. verify saved mode file content
3. continue with [status-doctor.md](status-doctor.md)
