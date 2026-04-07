# coder-docs isolated eval assets verification (2026-04-06)

## Task

- Task ID: `opencode-coder-3mv8.5.3`
- Scope: additive-only `coder-docs` eval assets under `ai-resources/skills/coder-docs/evals/**`

## Files created

- `ai-resources/skills/coder-docs/evals/evals.json`
- `ai-resources/skills/coder-docs/evals/trigger-evals.json`
- `ai-resources/skills/coder-docs/evals/hooks/setup-minimal-project-workspace.sh`

## Fixture status

No static `evals/files/**` fixtures were needed for this phase, but eval `0` now uses a minimal setup hook.

- `ai-resources/skills/coder-docs/evals/files/**` was intentionally not created.
- Eval `0` uses `evals/hooks/setup-minimal-project-workspace.sh` to seed a plausible repo root (`README.md`, `package.json`, `src/index.ts`, `.gitignore`, optional `.git/`) before execution.
- Rationale: a bare functional workspace exposed only `.opencode/**`, which let the model misread the sandbox as the target repo and spend time creating docs under `.opencode/` instead of evaluating project-doc setup against a plausible project root.

## Contract checks

1. **Per-skill additive path only**
   - New files were created only under `ai-resources/skills/coder-docs/evals/**`.
2. **No edits to existing eval files**
   - Existing `ai-resources/skills/opencode-coder/evals/**` files were left untouched.
3. **Trigger coverage shape**
   - Positive queries: 11
   - Negative queries: 9
   - Near-miss overlaps vs unchanged `opencode-coder`: 3 negatives
4. **Scope ownership alignment**
   - Functional/trigger prompts target coder-docs-owned scope:
     - docs lifecycle
     - project-doc setup/taxonomy
     - AGENTS generation/template guidance
     - project-doc review guidance
     - canonical change-landing topic as `CHANGE-WORKFLOW.md`
   - Bug-reporting and debugging-logs are represented only as negative or optional-companion context.

## Validation commands and outcomes

### JSON parse validation

```bash
python3 -m json.tool ai-resources/skills/coder-docs/evals/evals.json >/dev/null
python3 -m json.tool ai-resources/skills/coder-docs/evals/trigger-evals.json >/dev/null
```

Observed: both files parse successfully.

### Trigger shape verification

```bash
python3 - <<'PY'
import json
from pathlib import Path
p = Path('ai-resources/skills/coder-docs/evals/trigger-evals.json')
data = json.loads(p.read_text())
pos = [d for d in data if d.get('should_trigger') is True]
neg = [d for d in data if d.get('should_trigger') is False]
near = [d for d in neg if any(k in d.get('query','').lower() for k in ['bug', 'runtime', 'diagnostic', 'status', 'doctor'])]
print(f'positive={len(pos)} negative={len(neg)} near_miss_overlap={len(near)}')
PY
```

Observed: `positive=11 negative=9 near_miss_overlap=3`.

### Runner verification from documented working directory

Documented runner context (validation matrix):

- **workdir**: `/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder-skill-creator`
- **PATH prefix**: `/home/hans/.local/share/mise/installs/opencode/1.3.15:$PATH`

Bounded re-check commands:

```bash
PATH="/home/hans/.local/share/mise/installs/opencode/1.3.15:$PATH" \
  python3 -m scripts.run_functional_eval --help

PATH="/home/hans/.local/share/mise/installs/opencode/1.3.15:$PATH" \
  python3 -m scripts.run_eval --help

PATH="/home/hans/.local/share/mise/installs/opencode/1.3.15:$PATH" opencode --version
```

Observed results:

- `python3 -m scripts.run_functional_eval --help` succeeded (runner module resolves in documented workdir).
- `python3 -m scripts.run_eval --help` succeeded (runner module resolves in documented workdir).
- `opencode --version` succeeded: `1.3.15`.

Clarification:

- The prior `No module named scripts.run_*` failure mode is a **working-directory invocation issue** (e.g., repo root), not missing runner modules from the environment.
- Full runtime pass criteria were not re-executed in this bug fix; this update provides bounded invocation evidence only.

Impact:

- Verification evidence now reflects the documented invocation context and does not attribute failure to missing Python modules.
- Asset creation and static validation remain successful.
