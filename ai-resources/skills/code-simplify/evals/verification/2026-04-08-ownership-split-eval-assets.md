# code-simplify eval assets verification (2026-04-08)

Task: `opencode-coder-wlpd.4`

## Scope

- Added standalone eval assets for `code-simplify` under `ai-resources/skills/code-simplify/evals/**`.
- Migrated simplify-positive assumptions away from `coder-core`/`opencode-coder` eval trigger assets.
- Preserved historical context in prior additive verification notes where needed.

## Files created

- `ai-resources/skills/code-simplify/evals/evals.json`
- `ai-resources/skills/code-simplify/evals/trigger-evals.json`
- `ai-resources/skills/code-simplify/evals/verification/2026-04-08-ownership-split-eval-assets.md`

## Static sanity checks

```bash
python3 -m json.tool ai-resources/skills/code-simplify/evals/evals.json >/dev/null
python3 -m json.tool ai-resources/skills/code-simplify/evals/trigger-evals.json >/dev/null
python3 -m json.tool ai-resources/skills/coder-core/evals/evals.json >/dev/null
python3 -m json.tool ai-resources/skills/coder-core/evals/trigger-evals.json >/dev/null
python3 -m json.tool ai-resources/skills/opencode-coder/evals/trigger-evals.json >/dev/null
```

Observed: all parse checks succeeded.

## Trigger balance check (code-simplify)

```bash
python3 - <<'PY'
import json
from pathlib import Path
p = Path('ai-resources/skills/code-simplify/evals/trigger-evals.json')
data = json.loads(p.read_text())
pos = [d for d in data if d.get('should_trigger') is True]
neg = [d for d in data if d.get('should_trigger') is False]
print(f'positive={len(pos)} negative={len(neg)} total={len(data)}')
PY
```

Observed: `positive=8 negative=8 total=16`.

## Important constraint acknowledgment

No skill eval suites were executed for this task.

- Not run: `python3 -m scripts.run_eval ...`
- Not run: `python3 -m scripts.run_functional_eval ...`
