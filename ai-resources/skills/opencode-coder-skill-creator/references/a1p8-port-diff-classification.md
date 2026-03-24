# opencode-coder-a1p.8 — Section-by-section upstream-vs-port classification (durable evidence)

This tracked artifact is the durable acceptance evidence for `opencode-coder-a1p.8`.

- **Upstream baseline (source of truth):** `.opencode/skills/skill-creator/`
- **Port target under review:** `ai-resources/skills/opencode-coder-skill-creator/`
- **Authoritative scope:** section-level/material-change classification for all intended compatibility-touch files retained in the skill folder

## Classification legend

- **[C] Compatibility change** — required to avoid Claude/Cowork/runtime assumptions that do not hold in OpenCode
- **[O] OpenCode additive guidance** — explicit OpenCode addition that preserves upstream intent while making execution practical here
- **[I] Identity/packaging change** — intentional repo identity change (vendored name/packaging), not semantic workflow drift
- **[S] Security hardening** — minimal safety fix that preserves workflow intent while removing exploitable behavior
- **[R] Reverted/narrowed** — prior local modification intentionally removed from retained port scope

## Primary file: `SKILL.md` (section-level)

| SKILL.md section / material area | Class | Rationale |
|---|---|---|
| YAML frontmatter `name` + description retargeted to `opencode-coder-skill-creator` | [I] | Required vendored identity for OpenCode package; keeps upstream skill purpose but maps to project naming/install surface. |
| Title + high-level loop wording (`claude-with-access-to-the-skill` → OpenCode skill-loading wording) | [C] | Removes Claude-specific runtime phrasing while preserving same iterative workflow semantics. |
| Added `OpenCode Environment Assumptions` section | [O] | Explicitly documents OpenCode/browser/headless/path realities to prevent misleading Claude/Cowork assumptions. |
| Added `Agent Mapping (OpenCode)` section | [O] | Clarifies role mapping (`orchestrator/tasker/reviewer/verifier`) for this host runtime without replacing upstream process logic. |
| Added `Model Selection Guidance` section | [O] | Runtime-practical model selection note; additive and non-destructive to upstream core flow. |
| “Capture Intent / Write SKILL.md / triggering” Claude-brand wording generalized to “AI assistant/host environment” | [C] | Removes Claude-specific assumptions that would mislead OpenCode users while preserving the same guidance intent. |
| Running eval variants wording changed from mandatory parallel subagent phrasing to “parallel if supported, else serial” | [C] | Preserves objective (with-skill + baseline coverage) while removing unsupported runtime assumption that parallel subagents are always available. |
| Timing capture subsection changed to fallback hierarchy (metadata → wall clock → token unavailable) | [C] | Required because OpenCode may not expose identical per-run notification telemetry; preserves measurement intent. |
| Headless viewer guidance generalized from Cowork-specific text to OpenCode no-browser fallback | [C] | Keeps upstream workflow outcome (human review via generated viewer/static HTML) while removing Cowork/Claude-specific framing. |
| Description Optimization Step 2 placeholder instructions updated to encoded eval data path (template-driven safe parsing) | [S] [C] | Minimal hardening against inline `</script>` breakouts; still uses same manual inline template workflow and placeholder replacement model. |
| Description Optimization Step 3 rewritten as explicit manual loop with deferred automation note | [C] [O] | Honest compatibility patch: upstream automation primitives are unavailable; manual loop preserves user-visible intent without claiming unsupported execution. |
| Claude.ai-specific and Cowork-specific standalone sections removed | [C] | These sections rely on environment assumptions outside OpenCode and would mislead users; removal is compatibility-driven, not arbitrary content loss. |
| Packaging section normalized to portable `python -m scripts.package_skill` invocation | [C] | Keeps packaging behavior but removes path form tied to prior layout wording. |
| Final recap wording adjusted (`Run claude-with-access...` → OpenCode-neutral wording) | [C] | Terminology compatibility only; no semantic process change. |

## Additional retained compatibility-touch files (outside SKILL.md)

| File | Material change area | Class | Rationale |
|---|---|---|---|
| `assets/eval_review.html` | Inline eval data initialization now parses decoded URI component (`JSON.parse(decodeURIComponent(...))`) instead of direct raw JSON literal insertion | [S] [C] | Prevents script-breakout payloads like `</script>` while preserving existing manual template replacement workflow and user editing/export UX. |
| `agents/analyzer.md` | Added OpenCode agent mapping header block | [O] | Additive role guidance only; analyzer logic/content remains upstream-aligned. |
| `agents/comparator.md` | Added OpenCode agent mapping header block | [O] | Additive role guidance only; blind-comparison rubric logic unchanged. |
| `agents/grader.md` | Added OpenCode agent mapping header block | [O] | Additive role guidance only; grading criteria/output schema semantics preserved. |
| `eval-viewer/viewer.html` | UI copy references changed from Claude Code phrasing to OpenCode session phrasing | [C] | Terminology compatibility so instructions match host runtime. |
| `references/schemas.md` | Timing capture guidance made fallback-friendly; model label example generalized | [C] [O] | Aligns schema guidance with OpenCode telemetry reality while preserving structural schema intent. |

## Narrowed/reverted local edits (not retained for a1p.8 compatibility evidence)

The following locally modified files under the skill folder are intentionally **out of retained a1p.8 compatibility scope** and should be treated as narrowed/reverted for this blocker resolution:

- `scripts/improve_description.py` — large deferred rewrite not required for this blocker pair; excluded from retained compatibility evidence.
- `scripts/run_eval.py` — large deferred rewrite not required for this blocker pair; excluded from retained compatibility evidence.
- `scripts/run_loop.py` — large deferred rewrite not required for this blocker pair; excluded from retained compatibility evidence.
- `scripts/package_skill.py` — formatting/usage text cleanup not required for this blocker pair; excluded from retained compatibility evidence.
- `scripts/__pycache__/...` deletions — generated artifacts; not material acceptance evidence.

## Why this now satisfies the a1p.8 evidence bar

1. **Durable:** this evidence file is in tracked repo path under the skill folder (`references/`), not ignored workspace output.
2. **Section-specific:** SKILL.md changes are classified by material section/change unit, not just file-level tags.
3. **Coverage-complete for intended retained touches:** all remaining compatibility-touch documentation/artifact files in the skill folder are explicitly classified with rationale.
4. **Scope discipline:** non-essential side edits are explicitly identified as narrowed/reverted from retained acceptance evidence.

## Residual risk notes

- If future upstream sync reintroduces different eval-review template wiring, re-run the `</script>` safety check for any inline script placeholder insertion path.
- Agent-mapping header blocks in `agents/*.md` are additive and low risk, but should be revisited if OpenCode role conventions change.
