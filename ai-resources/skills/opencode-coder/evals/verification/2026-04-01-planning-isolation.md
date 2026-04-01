# Functional planning eval isolation verification (2026-04-01)

## Scope

- Task: `opencode-coder-n3rw.6`
- Bug target: `opencode-coder-j6nc`
- Evals: planning-oriented entries `id: 0` and `id: 1` in `evals/evals.json`

## Commands executed

### 1) Live tracker baseline (before)

```bash
bd where
bd status
```

Observed:

- `bd where` pointed to live repo tracker: `/home/hans/dev/github/opencode-coder/.beads`
- `bd status` summary before validation:
  - Total `370`
  - Open `9`
  - In Progress `2`
  - Blocked `4`
  - Closed `358`

### 2) Functional runner invocation attempt (earlier blocked)

```bash
python3 -m scripts.run_functional_eval \
  --skill-path "../opencode-coder" \
  --eval-id 0 --eval-id 1 \
  --artifacts-dir "../opencode-coder/eval-artifacts/functional/20260401-planning-isolation" \
  --timeout 180 --verbose
```

Run location:

- `/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder-skill-creator`

Observed at that time:

- Runner exited with: `Error: opencode CLI not found on PATH`
- Environment limitation prevented full model-run phase in that earlier attempt.

### 3) Hook isolation proof in disposable workspace

```bash
tmp_root=$(mktemp -d)
mkdir -p "$tmp_root/workspace" "$tmp_root/artifacts"

EVAL_WORKSPACE="$tmp_root/workspace" \
EVAL_ARTIFACTS_DIR="$tmp_root/artifacts" \
EVAL_ID="0" EVAL_NAME="planning-eval-0" EVAL_PHASE="before_run" \
ai-resources/skills/opencode-coder/evals/hooks/setup-local-planning-workspace.sh

EVAL_WORKSPACE="$tmp_root/workspace" \
EVAL_ARTIFACTS_DIR="$tmp_root/artifacts" \
EVAL_ID="0" EVAL_NAME="planning-eval-0" EVAL_PHASE="after_run" \
ai-resources/skills/opencode-coder/evals/hooks/capture-local-beads-proof.sh
```

Observed proof artifacts in temp run:

- `.../artifacts/hooks/setup-local-planning-workspace/workspace-proof.txt`
  - `cwd` and `workspace_root` both inside `/tmp/.../workspace`
  - `git_dir_exists=yes`
  - `beads_dir_exists=yes`
- `.../artifacts/hooks/setup-local-planning-workspace/bd-where.txt`
  - `.../workspace/.beads`
- `.../artifacts/hooks/capture-local-beads-proof/bd-where.txt`
  - `.../workspace/.beads`

This confirms git/beads initialization and reporting were workspace-local, not live-repo-local.

### 4) Live tracker re-check (after)

```bash
bd status
```

Observed:

- `bd status` summary unchanged from baseline:
  - Total `370`
  - Open `9`
  - In Progress `2`
  - Blocked `4`
  - Closed `358`

Conclusion: validation activity did not mutate live tracker state.

### 5) Full functional runner verification (successful rerun)

Later in the same session, `opencode` was confirmed to be available on PATH:

```bash
which opencode
```

Observed:

- `/home/hans/.local/share/mise/installs/opencode/1.3.13/opencode`

Then the real functional planning evals were rerun end-to-end:

```bash
bd list --json > /tmp/opencode-coder-bd-before.json

python3 -m scripts.run_functional_eval \
  --skill-path "../opencode-coder" \
  --eval-id 0 --eval-id 1 \
  --artifacts-dir "../opencode-coder/eval-artifacts/functional/20260401-acceptance-review" \
  --timeout 300 \
  --verbose

bd list --json > /tmp/opencode-coder-bd-after.json
diff -u /tmp/opencode-coder-bd-before.json /tmp/opencode-coder-bd-after.json
```

Observed:

- Functional runner summary: `2/2 passed`
- Both planning-oriented evals (`id: 0` and `id: 1`) completed successfully
- Hook proof artifacts confirmed workspace-local beads roots:
  - `eval-000-run-01/hooks/capture-local-beads-proof/bd-where.txt` → `/tmp/functional-eval-eval-000-run-01-.../.beads`
  - `eval-001-run-02/hooks/capture-local-beads-proof/bd-where.txt` → `/tmp/functional-eval-eval-001-run-02-.../.beads`
- `diff -u /tmp/opencode-coder-bd-before.json /tmp/opencode-coder-bd-after.json` produced no output

Conclusion: the real `opencode-coder` planning evals now run successfully through the functional runner, create beads state only inside disposable workspaces, and leave the live repository tracker unchanged.

## Notes

- Trigger eval automation (`evals/trigger-evals.json`) was intentionally left unchanged.
- Full model execution artifacts were captured successfully under `eval-artifacts/functional/20260401-acceptance-review/` later in this session.
