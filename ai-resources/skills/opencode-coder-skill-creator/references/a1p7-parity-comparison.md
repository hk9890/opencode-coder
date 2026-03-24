# opencode-coder-a1p.7 — Upstream-vs-OpenCode parity comparison (durable evidence)

This artifact records the required parity assessment for `opencode-coder-a1p.7`.

- **Upstream baseline (read-only reference):** `.opencode/skills/skill-creator/SKILL.md`
- **OpenCode port under assessment:** `ai-resources/skills/opencode-coder-skill-creator/SKILL.md`
- **Supporting evidence used:**
  - `ai-resources/skills/opencode-coder-skill-creator/references/a1p8-port-diff-classification.md`
  - `ai-resources/skills/opencode-coder-skill-creator/references/a1p2-description-pipeline-audit.md`
  - `docs/testing/opencode-coder-a1p.6-skill-creator-smoke-2026-03-24.md`

## Classification legend (task-required)

- **Preserved verbatim**
- **Preserved with compatibility patches**
- **OpenCode-specific addition**
- **Removed with rationale**
- **Rewritten with rationale**

## Comparison rubric (task-required)

Each representative workflow is assessed on:

1. **Clarity**
2. **Completeness**
3. **Actionability**
4. **Preservation of useful upstream guidance**
5. **Honesty about limitations**
6. **Capability preservation** (does replacement preserve practical user outcome?)

Scale used in this document:

- **Strong** = clearly meets intent
- **Adequate** = meets intent with caveats
- **Weak** = does not reliably meet intent

## Section-by-section diff and classification

| Upstream section / material area | OpenCode treatment | Classification | Rationale |
|---|---|---|---|
| Frontmatter `name` and `description` | Renamed to `opencode-coder-skill-creator`; description retargeted to OpenCode packaging and loop language | Preserved with compatibility patches | Required naming and trigger-surface adaptation for vendored OpenCode resource identity. |
| Intro loop bullets | Kept same loop structure; changed “run claude-with-access-to-the-skill” phrasing to OpenCode skill-loading wording | Preserved with compatibility patches | Core flow preserved; host-runtime wording patched. |
| Intro flexibility notes | Preserved | Preserved verbatim | Same user-flexibility guidance retained. |
| Description optimization mention in intro | Updated from separate “description improver script” mention to explicit OpenCode script path mention | Preserved with compatibility patches | Intent retained; pathing/host wording updated. |
| `## Communicating with the user` | Mostly unchanged except “Claude” generalized to “AI assistants” | Preserved with compatibility patches | Generic communication guidance preserved; provider-specific wording removed. |
| `## OpenCode Environment Assumptions` | New section | OpenCode-specific addition | Explicitly documents browser/headless/path/telemetry constraints that upstream Claude/Cowork sections previously implied differently. |
| `## Agent Mapping (OpenCode)` | New section | OpenCode-specific addition | Adds practical role mapping (`orchestrator/tasker/reviewer/verifier`) without replacing upstream workflow semantics. |
| `## Model Selection Guidance` | New section | OpenCode-specific addition | Adds execution-quality guidance for model choice in this runtime. |
| `## Creating a skill` → `Capture Intent` | Mostly unchanged; “Claude” generalized to “AI” | Preserved with compatibility patches | Core interview scaffold retained. |
| `Interview and Research` | Subagent wording softened to runtime-capability conditional parallelization | Preserved with compatibility patches | Keeps proactive research intent while avoiding unsupported assumptions. |
| `Write the SKILL.md` | Substantively retained; undertrigger warning generalized from Claude-specific framing to AI-assistant framing | Preserved with compatibility patches | Trigger-writing guidance preserved. |
| `Skill Writing Guide` (anatomy/progressive disclosure/patterns/domain org/lack of surprise/writing patterns/style) | Structurally retained with minor wording patches (“Claude reads…” → “AI reads…”) | Preserved with compatibility patches | High-value upstream authoring guidance preserved. |
| `Test Cases` | Retained | Preserved verbatim | Same 2–3 prompt drafting workflow and schema seed. |
| `## Running and evaluating test cases` overall | Retained as one continuous sequence | Preserved verbatim | Core loop and outputs/benchmark workflow preserved. |
| Step 1 (`Spawn all runs ... in same turn`) | Reworded to “run all eval variants; parallel if supported, else serial” | Rewritten with rationale | Maintains methodological intent while removing hard dependency on always-available parallel subagents. |
| Step 2 assertions drafting | Retained | Preserved verbatim | Same quantitative+qualitative guidance. |
| Step 3 timing capture | Changed from fixed task-notification field assumptions to fallback hierarchy with null-token handling | Rewritten with rationale | Honest adaptation to telemetry availability differences in OpenCode; preserves timing-capture outcome. |
| Step 4 grading/aggregation/viewer | Largely preserved; headless guidance generalized from Cowork wording to host-neutral no-browser path; user message fallback added | Preserved with compatibility patches | Maintains grader/benchmark/viewer flow and improves runtime portability. |
| Step 5 feedback ingestion and server cleanup | Retained | Preserved verbatim | Same review loop behavior. |
| `## Improving the skill` + “How to think about improvements” | Preserved with minimal wording edits (“subagents” → “runs” in repeated-work note) | Preserved with compatibility patches | Core upstream improvement philosophy retained. |
| Iteration loop | Retained | Preserved verbatim | Same loop termination criteria and re-run structure. |
| `## Advanced: Blind comparison` | Retained | Preserved verbatim | Same optional rigor path and agent refs. |
| `## Description Optimization` intro + Step 1 | Retained with host-neutral wording | Preserved with compatibility patches | Same trigger-eval strategy and near-miss guidance preserved. |
| Description Optimization Step 2 (HTML review) | Placeholder handling changed to encoded JSON insertion and explicit path-confirmed export handling; browser fallback strengthened | Rewritten with rationale | Security/robustness patch and environment realism; retains user review objective. |
| Description Optimization Step 3 | Replaced from Claude CLI (`claude -p`) loop instructions to OpenCode-native `scripts.run_eval` / `scripts.run_loop` commands and evidence artifacts | Rewritten with rationale | This is the required replacement path for feature parity in OpenCode after prior deferred phase. |
| “How skill triggering works” | Retained with host-neutral wording | Preserved with compatibility patches | Same trigger-mechanism education intent preserved. |
| Description Optimization Step 4 | Updated to “best validated description,” optional `--apply-best` flow | Preserved with compatibility patches | Same apply-result outcome preserved with OpenCode command options. |
| `Package and Present` | Changed from conditional “if present_files exists” to unconditional packaging path + path-based fallback | Rewritten with rationale | More portable in OpenCode; preserves packaging capability. |
| `Claude.ai-specific instructions` | Removed | Removed with rationale | Runtime-specific to Claude.ai; not appropriate as OpenCode guidance. |
| `Cowork-Specific Instructions` | Removed | Removed with rationale | Runtime-specific to Cowork and mixed assumptions no longer required after OpenCode-native path exists. |
| `Reference files` section | Retained | Preserved verbatim | Same agent/reference navigation retained. |
| Final recap bullets | Kept but host wording generalized (“run the skill on test prompts”) | Preserved with compatibility patches | Same iterative loop emphasis retained. |
| Final TodoList reminder | Removed | Removed with rationale | Upstream reminder referenced environment-specific TODO behavior; not required for capability parity and conflicts with project preference to avoid TODO tracker workflows. |

## Generic upstream content potentially weakened / unnecessarily changed

Assessment result: **no material generic regression found that blocks parity claim**, with two minor caveats.

### Caveat A (minor): explicit “same-turn launch all runs” strictness softened

- Upstream enforced strict same-turn spawning for timing parity.
- Port allows serial fallback when runtime cannot parallelize.
- This is justified for compatibility, but does weaken experimental rigor in constrained environments.
- **Disposition:** acceptable compatibility tradeoff, not an epic blocker.

### Caveat B (minor): final operational reminder removed

- Upstream included a final “add steps to TodoList” reminder.
- Port removes this reminder.
- Execution quality may rely more on orchestrator discipline.
- **Disposition:** minor process-style reduction only; not a functional parity blocker.

## Representative workflow parity evaluation

### Workflow 1 — Create a new skill

- **Evidence anchors:** SKILL sections `Creating a skill`, `Skill Writing Guide`, `Test Cases`; smoke report scenario 1 (PASS).
- **Rubric:**
  - Clarity: **Strong**
  - Completeness: **Strong**
  - Actionability: **Strong**
  - Upstream guidance preservation: **Strong**
  - Honesty about limitations: **Adequate** (limitations mostly in environment assumptions section)
  - Capability preservation: **Strong**
- **Verdict:** **Equivalent capability preserved**.

### Workflow 2 — Improve an existing skill

- **Evidence anchors:** `Improving the skill` + “How to think about improvements”; smoke scenario 2 (PASS).
- **Rubric:**
  - Clarity: **Strong**
  - Completeness: **Strong**
  - Actionability: **Strong**
  - Upstream guidance preservation: **Strong**
  - Honesty about limitations: **Strong**
  - Capability preservation: **Strong**
- **Verdict:** **Equivalent capability preserved**.

### Workflow 3 — Eval prompt creation and quantitative setup

- **Evidence anchors:** `Test Cases`, run/eval Step 2 assertions guidance, description optimization Step 1; smoke scenario 5 (PASS for eval query quality).
- **Rubric:**
  - Clarity: **Strong**
  - Completeness: **Strong**
  - Actionability: **Strong**
  - Upstream guidance preservation: **Strong**
  - Honesty about limitations: **Strong**
  - Capability preservation: **Strong**
- **Verdict:** **Equivalent capability preserved**.

### Workflow 4 — Review/iteration loop

- **Evidence anchors:** run/eval Step 4+5 and iteration loop; smoke scenario 3 (PASS).
- **Rubric:**
  - Clarity: **Strong**
  - Completeness: **Strong**
  - Actionability: **Strong**
  - Upstream guidance preservation: **Strong**
  - Honesty about limitations: **Strong** (explicit headless/browser alternatives)
  - Capability preservation: **Strong**
- **Verdict:** **Equivalent capability preserved**.

### Workflow 5 — Description optimization / trigger-eval replacement path

- **Evidence anchors:** Description Optimization Step 2+3+4 in ported SKILL, plus prior deferred-state audit (`a1p2`) and later OpenCode-native script path now documented.
- **Rubric:**
  - Clarity: **Strong**
  - Completeness: **Adequate-to-Strong** (depends on script runtime reliability during real runs)
  - Actionability: **Strong** (explicit runnable commands)
  - Upstream guidance preservation: **Adequate** (implementation changed substantially, intent preserved)
  - Honesty about limitations: **Strong**
  - Capability preservation: **Strong** (replacement path exists and is concrete)
- **Verdict:** **Intentionally different implementation, capability preserved through OpenCode-native replacement**.

## Gaps and epic-closure relevance

### Blocking gaps for parity claim

- **None identified in SKILL.md parity comparison scope.**

### Non-blocking follow-up hygiene

1. `SKILL.md` is slightly above its own “<500 lines ideal” guidance (current file ~502 lines). This is advisory, not a parity blocker.
2. If runtime constraints force serial eval execution, document that choice in run artifacts to preserve interpretation quality.

## Final conclusion

The OpenCode port preserves the upstream skill-creator’s **core workflows and practical capability** while applying compatibility edits where runtime assumptions differ. Material differences are either:

- necessary compatibility patches,
- explicit OpenCode additions improving execution honesty/actionability, or
- intentional removal of provider-specific sections no longer applicable.

No critical regression was found that undermines the epic’s parity objective for the skill’s primary use cases.
