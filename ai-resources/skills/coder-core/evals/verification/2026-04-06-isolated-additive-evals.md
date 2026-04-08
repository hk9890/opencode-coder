# coder-core isolated eval assets verification (2026-04-06)

> Historical note (superseded for current-state simplify ownership): this verification artifact reflects additive rollout scope under `opencode-coder-3mv8`, when simplify baseline was temporarily assigned to `coder-core`. Under epic `opencode-coder-wlpd`, base `/simplify` ownership moved to standalone `code-simplify`.

## Task

- Task ID: `opencode-coder-3mv8.3.3`
- Scope: additive-only eval work under `ai-resources/skills/coder-core/evals/**`

## Files in scope

- `ai-resources/skills/coder-core/evals/evals.json`
- `ai-resources/skills/coder-core/evals/trigger-evals.json`
- `ai-resources/skills/coder-core/evals/verification/2026-04-06-isolated-additive-evals.md`

No fixtures were required for this phase (`evals/files/**` not created).

## Contract/matrix checks

1. **JSON parse validation**
   - `evals.json` parses
   - `trigger-evals.json` parses
2. **Trigger coverage minimums**
   - positive cases: at least 8
   - negative cases: at least 8
3. **Near-miss overlap coverage**
   - includes at least 2 negative near-miss overlaps against unchanged `opencode-coder` owned areas
4. **Scope boundary**
   - historical additive scope included simplify baseline for that phase; current-state ownership moved simplify to standalone `code-simplify`
   - current-state coder-core scope is runtime/setup/mode/doctor/logs/session dump/plugin bug-reporting split
   - non-core ownership is represented as negative/delegation cases
5. **No-touch guard**
   - no edits under `ai-resources/skills/opencode-coder/evals/**`
6. **Additive-only change shape**
   - only files under `ai-resources/skills/coder-core/evals/**` were added/updated for this task
7. **Direct-skill phase only**
   - no slash-command additions were made

## Validation commands and outcomes

### JSON parse validation

```bash
python3 -m json.tool ai-resources/skills/coder-core/evals/evals.json >/dev/null
python3 -m json.tool ai-resources/skills/coder-core/evals/trigger-evals.json >/dev/null
```

Observed: both files parse successfully.

### Trigger count validation

```bash
python3 - <<'PY'
import json
from pathlib import Path
p = Path('ai-resources/skills/coder-core/evals/trigger-evals.json')
data = json.loads(p.read_text())
pos = [d for d in data if d.get('should_trigger') is True]
neg = [d for d in data if d.get('should_trigger') is False]
near = [d for d in neg if any(k in d.get('query','').lower() for k in ['agents', 'docs lifecycle', 'beads', 'bd doctor', 'planner', 'planning'])]
print(f'positive={len(pos)} negative={len(neg)} near_miss_overlap={len(near)}')
PY
```

Observed: `positive=8 negative=8 near_miss_overlap=6`.

### Required-PATH + working-directory runner probe (bounded)

Working-directory requirement (critical):

- Runner modules must be invoked from:
  `/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder-skill-creator`
- PATH must be prefixed with:
  `/home/hans/.local/share/mise/installs/opencode/1.3.15:$PATH`

Commands executed (bounded `--help` checks only):

```bash
PATH="/home/hans/.local/share/mise/installs/opencode/1.3.15:$PATH" \
python3 -m scripts.run_functional_eval --help

PATH="/home/hans/.local/share/mise/installs/opencode/1.3.15:$PATH" \
python3 -m scripts.run_eval --help
```

Observed (from required working directory):

- `python3 -m scripts.run_functional_eval --help` succeeded and printed usage/options.
- `python3 -m scripts.run_eval --help` succeeded and printed usage/options.

Clarification of prior failure statement:

- Earlier `No module named scripts.run_functional_eval` / `scripts.run_eval` errors are attributable to invoking from the wrong working directory, not to missing runner modules in the documented execution environment.

Current limitation status:

- No runner-module import blocker observed under the documented invocation contract.
- This verification note demonstrates runner availability (`--help`) only; full functional/trigger eval execution was not re-run in this bounded check.

### No-touch and additive-file checks

```bash
git diff --name-only -- ai-resources/skills/opencode-coder/evals
git status --short -- ai-resources/skills/coder-core/evals
git status --short -- ai-resources/skills/opencode-coder/evals
```

Observed:

- no diff under `ai-resources/skills/opencode-coder/evals/**`
- coder-core eval path shows only additive files for this task
