# Smoke Test Report — `opencode-coder-a1p.6`

Date: 2026-03-24  
Tester: OpenCode agent (CLI-only)  
Scope: Validate ported `opencode-coder-skill-creator` behavior in OpenCode using project manual-testing harness

## Test Method (per `docs/TESTING.md`)

- Used **Manual testing** flow with harness command mode:
  - `bun run test:manual -- --mode=command ... -- opencode run ...`
- Used **OpenCode CLI only** (`opencode run`), no GUI/TUI app launch.
- Used disposable fixture workspace:
  - `--fixture=existing-active-project`
  - Harness copied fixture into `.manual-test-runs/run-*/project`

## Exact Commands Run

1. `bd show opencode-coder-a1p.6`
2. `bd update opencode-coder-a1p.6 --status=in_progress`
3. `bun run test:manual -- --mode=command --fixture=existing-active-project --plugin-source=local-build -- opencode run --command "Use the opencode-coder-skill-creator skill to draft a new SKILL.md for a skill named commit-message-auditor. Follow the Skill Writing Guide anatomy (frontmatter, trigger, instructions, examples, boundaries) and include progressive disclosure. Return concise markdown only." --format json`
4. `bun run test:manual -- --mode=command --fixture=existing-active-project --plugin-source=local-build -- opencode run --help`
5. `bun run test:manual -- --mode=command --fixture=existing-active-project --plugin-source=local-build -- opencode run "Say exactly: hello from smoke test"`
6. `bun run test:manual -- --mode=command --fixture=existing-active-project --plugin-source=local-build -- opencode run "You are validating the opencode-coder-skill-creator guidance. Create a brand-new skill called commit-message-auditor from scratch. Return a full SKILL.md draft with YAML frontmatter, clear trigger/when-to-use section, step-by-step instructions, examples, and boundaries/non-goals. Apply Skill Writing Guide patterns such as progressive disclosure and realistic examples."`
7. `bun run test:manual -- --mode=command --fixture=existing-active-project --plugin-source=local-build -- opencode run "Improve this existing skill after review feedback. Existing skill summary: trigger='when user asks to summarize commits', instructions are verbose and tool-specific, examples are generic. Feedback: too narrow, overfits git repos, does not explain why choices are made, and has no non-goals. Rewrite the skill and briefly explain your improvement reasoning using principles from How to think about improvements (generalization, lean prompt, and explicit why)."`
8. `bun run test:manual -- --mode=command --fixture=existing-active-project --plugin-source=local-build -- opencode run "Run a review/iteration loop for a skill draft in OpenCode-compatible style. Step 1: propose a minimal first draft for a skill named release-note-curator. Step 2: provide a reviewer critique with concrete issues. Step 3: provide a revised draft incorporating feedback. Keep each step clearly labeled."`
9. `bun run test:manual -- --mode=command --fixture=existing-active-project --plugin-source=local-build -- opencode run "Generate high-quality trigger eval queries for the skill release-note-curator. Provide 8 realistic user queries with expected decision (trigger or no-trigger) and short rationale. Include both positive and negative examples and make them concrete, not generic."`

## Scenario Outcomes

### 1) Creating a new skill from scratch

Status: **PASS**

Observed:
- Response returned a full markdown draft with YAML frontmatter.
- Included trigger/when-to-use section, workflow/instructions, examples, and boundaries/non-goals.
- Included progressive refinement language and realistic examples.

Notes:
- Matches requested upstream guidance usage shape (Skill Writing Guide-like anatomy).

### 2) Improving an existing skill

Status: **PASS**

Observed:
- Response rewrote the skill from narrow git-summary framing to broader “contextual change summarizer.”
- Included explicit improvement rationale referencing:
  - **Generalization**
  - **Lean prompt** (less brittle hardcoded command detail)
  - **Explicit why** (intent-focused synthesis)
- Added non-goals.

Notes:
- Aligns with preserved “How to think about improvements” guidance intent.

### 3) Review/iteration loop (OpenCode-compatible)

Status: **PASS**

Observed:
- Response provided clearly labeled Step 1 (initial draft), Step 2 (review critique), Step 3 (revised draft).
- Critique contained concrete issues; revision addressed those issues.

Notes:
- Demonstrates practical review loop usability in OpenCode CLI run flow.

### 4) Preserved upstream guidance section exercise

Status: **PASS**

Checked via two prompts:
- Skill Writing Guide usage prompt (new SKILL.md draft)
- Improvement reasoning prompt (“How to think about improvements” principles)

Observed:
- Output structure and reasoning reflected preserved guidance sections in practice, not just static text presence.

### 5) Eval query quality check (reviewer-suggested)

Status: **PASS**

Observed:
- Returned 8 concrete trigger/no-trigger queries with rationale.
- Included balanced positive and negative examples.
- Queries were realistic and specific (release tags, changelog updates, non-trigger debug/diff asks).

## What Worked

- Harness and command mode executed reliably with fixture isolation.
- `opencode run` produced usable semantic outputs for all required scenarios.
- Plugin load proof in each run showed local plugin version `0.35.0`.

## What Failed / Degraded / Manual Steps

- No blocking workflow failures for required scenarios.
- Repeated **degraded warning** observed in OpenCode logs: attempted install of `@hk9890/opencode-dynatrace@0.6.0` from npm registry returned 404 under isolated environment.
  - Did **not** block scenario completion.
  - `opencode-coder` plugin still loaded and scenario outputs were produced.
  - Treated as non-blocking environment noise for this task; documented here for traceability.

## Artifacts / Evidence

- This report file (durable repo-visible artifact)
- Preserved harness run directories:
  - `.manual-test-runs/run-y2u4JO/`
  - `.manual-test-runs/run-UQGiKJ/`
  - `.manual-test-runs/run-dEdL7P/`
  - `.manual-test-runs/run-fix3E6/`
- Acceptance-follow-up load-proof logs recorded after the repo root `aimgr repair` reconciled the packaged skill install state:
  - `docs/testing/opencode-coder-a1p.6-load-proof-create-2026-03-24.log`
  - `docs/testing/opencode-coder-a1p.6-load-proof-improve-2026-03-24.log`

### Load-proof follow-up evidence

The original smoke report established semantic scenario outcomes, but acceptance review later identified that the preserved fixture runs did not prove the ported skill was actually loaded. To close that evidence gap, two representative smoke scenarios were re-run in the repository root after reconciling the packaged skill state with `aimgr repair`.

Verified durable proof in the follow-up logs:

- **Create-skill scenario**
  - `docs/testing/opencode-coder-a1p.6-load-proof-create-2026-03-24.log:29` contains a JSON `tool_use` event with `tool:"skill"` and `input.name:"opencode-coder-skill-creator"`
  - `docs/testing/opencode-coder-a1p.6-load-proof-create-2026-03-24.log:146` shows `service=skill count=10 init`
- **Improve-existing-skill scenario**
  - `docs/testing/opencode-coder-a1p.6-load-proof-improve-2026-03-24.log:29` contains a JSON `tool_use` event with `tool:"skill"` and `input.name:"opencode-coder-skill-creator"`
  - `docs/testing/opencode-coder-a1p.6-load-proof-improve-2026-03-24.log:148` shows `service=skill count=10 init`

These follow-up runs confirm both semantic behavior **and** actual skill loading in OpenCode for representative create/improve workflows.

## Acceptance Verdict for `a1p.6`

All required scenario coverage executed with project-supported manual infrastructure and OpenCode CLI only.  
No blocking failures observed.  
Task is acceptable to close.
