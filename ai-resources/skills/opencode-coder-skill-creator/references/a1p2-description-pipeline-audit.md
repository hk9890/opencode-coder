# opencode-coder-a1p.2 — Claude CLI description/eval pipeline audit (OpenCode port)

This document records the script-level audit and disposition for the description-optimization pipeline in `opencode-coder-skill-creator`.

> Status note: this document originally captured the first audit state where the Claude CLI-dependent pipeline was deferred. It now reflects the current repository state after the OpenCode-native replacement workflow was implemented.

## Scope and intent

- Scope-limited to `ai-resources/skills/opencode-coder-skill-creator/**`.
- Preserves upstream-oriented content where possible, while explicitly documenting where OpenCode required a different execution design.
- Focuses on scripts named in task requirements:
  - `scripts/run_eval.py`
  - `scripts/improve_description.py`
  - `scripts/run_loop.py`
  - `scripts/package_skill.py`

## Claude-specific dependency audit (what upstream scripts did)

### `scripts/run_eval.py` (upstream behavior)

Upstream behavior depended on Claude Code runtime mechanics:

1. **Project-root discovery for `.claude/`**
   - Walked upward to find `.claude/` and treated that as execution root.
2. **Temporary `.claude/commands` injection**
   - Wrote a synthetic command markdown file into `.claude/commands/<unique>.md` for each query run so the skill appeared in Claude's available skills list.
   - Deleted that file after execution.
3. **Nested `claude -p` subprocess calls**
   - Spawned `claude -p` from Python workers.
   - Explicitly removed `CLAUDECODE` environment variable to bypass nested-session guard.
4. **Claude `stream-json`/tool-event assumptions**
   - Required `--output-format stream-json --include-partial-messages`.
   - Parsed `stream_event` payloads (`content_block_start`, `content_block_delta`, `content_block_stop`, `message_stop`).
   - Interpreted `tool_use` events (`Skill`/`Read`) as trigger signals.
5. **Parallelized query execution**
   - Used process pool fanout and trigger-rate thresholding.

### `scripts/improve_description.py` (upstream behavior)

1. **Nested `claude -p` text generation**
   - Called `claude -p --output-format text` from Python, passing a large prompt on stdin.
2. **Nested-session environment hack**
   - Removed `CLAUDECODE` env var to permit invocation from within Claude Code sessions.
3. **Structured extraction by tags**
   - Parsed `<new_description>...</new_description>` from model output.
4. **One-shot rewriter fallback**
   - If output exceeded 1024 chars, made another `claude -p` call to shorten.

### `scripts/run_loop.py` (upstream behavior)

1. **Orchestrated automated loop**
   - Called `run_eval.py` + `improve_description.py` iteratively.
2. **Train/test split + holdout scoring**
   - Split eval set, selected "best" candidate by held-out score.
3. **Browser/report assumptions**
   - Wrote live HTML report and attempted `webbrowser.open()`.

Important: browser/report behavior itself is not Claude-specific; the blocker is that the loop depends on deferred automation scripts above.

### `scripts/package_skill.py` (audit result)

- **No Claude CLI dependency.**
- Performs local validation and `.skill` zip packaging only.
- Workflow assumption check: it does **not** require `present_files` or any Claude-only tool; it simply prints output path and can be used in OpenCode as-is.

## Current implementation outcomes

| Script / flow | Classification | Outcome in this port |
|---|---|---|
| `scripts/run_eval.py` | **Replaced** | Now runs OpenCode CLI (`opencode run --format json --print-logs --log-level DEBUG`) inside a per-run sandbox, detects skill use from `tool_use` events and debug-log skill-availability signals, and records per-run artifacts/results. |
| `scripts/improve_description.py` | **Replaced** | Now uses OpenCode CLI as the description rewriter, extracts `<new_description>...</new_description>`, and records rewrite transcripts for each iteration. |
| `scripts/run_loop.py` | **Replaced** | Now orchestrates eval + improve iterations in OpenCode, supports train/test splits, writes results/report artifacts, and can optionally apply the best description back to `SKILL.md`. |
| Description optimization workflow in `SKILL.md` | **Redesigned** | Required path is now an OpenCode-native CLI workflow centered on `scripts.run_eval` and `scripts.run_loop`, with explicit artifact recording and headless-safe guidance. |
| `scripts/package_skill.py` | **Retained (works)** | Local validation and `.skill` packaging remain OpenCode-compatible. |

## Replacement design details and residual risk

### Implemented replacement A — automated trigger evaluation

- **OpenCode mechanism used:**
  - `opencode run --format json --print-logs --log-level DEBUG`
  - per-run sandbox skill injection via `.opencode/skills/<runtime-skill-name>/SKILL.md`
  - trigger detection from JSON `tool_use` events for the `skill` tool
  - fallback signal from debug logs such as `permission=skill pattern=<name>`
- **Recorded artifacts:** `stdout.ndjson`, `stderr.log`, and `result.json` per run.

### Implemented replacement B — automated description rewriting

- **OpenCode mechanism used:**
  - scripted `opencode run` prompt asking for a revised trigger description
  - structured extraction via `<new_description>...</new_description>` tags
  - automatic shorten-and-rewrite pass if the generated description exceeds limits
- **Recorded artifacts:** `logs/improve_iter_*.json` transcript files.

### Implemented replacement C — end-to-end optimization loop orchestration

- **OpenCode mechanism used:**
  - iterative orchestration in `scripts/run_loop.py`
  - train/test split with held-out scoring
  - generated HTML reports and JSON result bundles
  - optional `--apply-best` to persist best description into `SKILL.md`

### Residual risk / remaining platform gap

- This replacement depends on current OpenCode JSON/debug-log surfaces remaining stable enough for signal extraction.
- There is still no first-class product API dedicated specifically to skill-trigger eval automation; that harder product-level gap remains tracked as `opencode-coder-6ik`.
- This is now a **hardening/primitive-quality** concern, not a reason to describe the workflow itself as deferred.

## Evidence for implemented replacement

- Representative eval pass success: `ai-resources/skills/opencode-coder-workspace/skill-creator-parity-eval/run-eval-1/results.json`
- Representative loop success: `ai-resources/skills/opencode-coder-workspace/skill-creator-parity-eval/run-loop-2/2026-03-24_135027/results.json`
- Final user-facing workflow documentation: `ai-resources/skills/opencode-coder-skill-creator/SKILL.md`

## Resulting required workflow posture

- No required documented step depends on `claude -p`.
- The required description-optimization workflow is an implemented OpenCode-native CLI path, not a permanent deferral.
- Remaining limitations are about signal robustness and environment/browser fallbacks, and those are documented explicitly in `SKILL.md` and the parity evidence.
