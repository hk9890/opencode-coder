# coder-beads isolated eval assets validation (additive)

Task: `opencode-coder-3mv8.4.3`  
Date: 2026-04-06

## Scope applied

- Added only new files under `ai-resources/skills/coder-beads/evals/**`.
- No edits to existing eval files under `ai-resources/skills/opencode-coder/evals/**`.
- No slash-command routing assumptions; evals target direct `coder-beads` skill ownership.

## Created files

- `ai-resources/skills/coder-beads/evals/evals.json`
- `ai-resources/skills/coder-beads/evals/trigger-evals.json`
- `ai-resources/skills/coder-beads/evals/verification/2026-04-06-isolated-evals-validation.md`

No `evals/files/**` or `evals/hooks/**` were needed for this initial isolated behavioral coverage.

## Coverage alignment (frozen contract)

Functional eval topics are constrained to coder-beads ownership:

- planning and decomposition
- issue workflow readiness/labels/dependencies
- execution orchestration
- acceptance-review gating
- setup troubleshooting
- runtime troubleshooting
- status/health checks
- beads bug-reporting / follow-up

Explicitly excluded from positive scope:

- docs lifecycle ownership
- AGENTS generation ownership
- command-routing behaviors owned by unchanged `opencode-coder`

## Trigger matrix checks

- Positive cases: 8
- Negative cases: 8
- Near-miss overlap negatives vs unchanged `opencode-coder`: at least 2
  - `/opencode-coder/init` / mode behavior prompt
  - `/simplify` safe-vs-ask-first prompt
  - (also includes docs lifecycle prompts for additional overlap pressure)

## Parse validation performed

Validated JSON parseability with:

```bash
python3 -m json.tool ai-resources/skills/coder-beads/evals/evals.json
python3 -m json.tool ai-resources/skills/coder-beads/evals/trigger-evals.json
```

Result: both files parse successfully.

## Runner family and pass criteria (matrix contract)

Planned runner family for isolated execution:

- Functional: `python3 -m scripts.run_functional_eval`
- Trigger: `python3 -m scripts.run_eval`

Pass criteria:

- functional evals: zero failures
- trigger evals: all expected outcomes match

## Additive no-touch verification

Verified no tracked files under existing eval sets were modified.

Suggested check command used during validation:

```bash
git status --short
```

Expected outcome for this task: only new files under `ai-resources/skills/coder-beads/evals/**` appear.
