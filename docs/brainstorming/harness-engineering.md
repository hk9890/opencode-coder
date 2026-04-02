# Harness Engineering: Agent-First Development Capabilities

Research document based on OpenAI's "Harness Engineering" article (Feb 2026) — their experience building a product with zero manually-written code using Codex agents (~1M LOC, ~1500 PRs, 3.5 PRs/engineer/day over 5 months).

Core thesis: **"Humans steer. Agents execute."**

## Where We Already Align

We independently converged on many of the same patterns:

- Humans steer via orchestrator, agents execute via tasker/reviewer/verifier
- AGENTS.md as routing table (OpenAI's monolithic manual failed, they moved to this)
- Repository as system of record (beads issues live in-repo)
- Progressive disclosure via skills (load on demand, not upfront)
- Structured execution plans (epics/tasks/gates/dependencies)
- Agent specialization with strict boundaries
- Verification gates and pre-execution ticket QA
- Immutable history ("review produces new work, not rewrites")
- Session close protocol (commit → sync → push)

## Triage Summary

| Decision | Gap | ID |
|---|---|---|
| **GO** | Agent-to-Agent Iterative Review Loops | oc-90fr |
| **GO** | Architecture and Taste Enforcement Patterns | oc-wdc0 |
| **GO** | Automated Doc Gardening | oc-aqyl |
| **GO** | Throughput-Optimized Merge Philosophy | oc-sstk |
| **DEFER** | Ephemeral Observability Stack in Container | oc-w0oi |
| **DEFER** | Browser/UI Automation for Agents in Container | oc-z32g |
| **DEFER** | Tech Debt Tracker and Automated Cleanup | oc-r8t9 |
| **CLOSE** | Design Docs and Core Beliefs Framework | oc-211h |
| **CLOSE** | Quality Grading System Per Domain | oc-n012 |

---

## GO Items (Detailed)

### 1. Agent-to-Agent Iterative Review Loops (`oc-90fr`)

**The gap**: Our agents operate in a single-pass delegation model. Orchestrator spawns reviewer, reviewer returns comments or creates new beads, orchestrator proceeds. There is no re-review after changes are made to address feedback.

OpenAI's "Ralph Wiggum Loop": agent reviews its own changes locally → requests specific agent reviews → responds to feedback → iterates until ALL agent reviewers are satisfied. Humans may review but aren't required.

**Current architecture** (from `ai-resources/agents/`):

```
Orchestrator → Reviewer (returns once, creates beads)
Orchestrator → Tasker (implements, returns once)
Orchestrator → Verifier (verifies, returns once)
```

The only iteration loop is the orchestrator's `bd ready` check cycle for taskers. No analogous re-review cycle exists.

**What we could do (phased)**:

**Phase 1 — Tasker self-review step** (simplest, highest ROI)

Before a tasker returns to the orchestrator, it does a self-review:
- Run tests/lint/typecheck
- Re-read the changed files and check against the task's acceptance criteria
- If issues found, fix them in the same session
- Only return when self-check passes

This is purely a tasker agent definition change — no orchestrator changes needed. Add a "Self-Verification" section to `ai-resources/agents/tasker.md` with a checklist: run quality gates, re-read changes against acceptance criteria, verify nothing was missed.

**Phase 2 — Orchestrator review-fix-rereview cycle**

After reviewer returns findings:
1. Orchestrator spawns tasker to address reviewer findings
2. Orchestrator re-spawns reviewer to verify the fixes
3. Loop until reviewer is satisfied (with a max iteration cap, e.g., 3 rounds)

This requires orchestrator logic changes. The orchestrator needs to recognize when a reviewer created issues, spawn taskers for those issues, and then re-verify. The `bd ready` loop already handles the "spawn tasker for ready work" part, but there's no "then re-review" step.

Implementation: add a `needs:re-review` label. When reviewer creates issues, they also label the parent task `needs:re-review`. After tasker fixes the issues and they're closed, orchestrator checks for `needs:re-review` and re-spawns reviewer.

**Phase 3 — Multi-reviewer pattern**

Orchestrator can request N reviewers with different focuses (architecture, security, performance). All must be satisfied before proceeding. This is a specialization of Phase 2 — each reviewer type is a different agent or the same agent with different prompts.

**Phase 4 — Auto-merge when all agents agree**

If tasker + reviewer + verifier all pass, and the change is within an auto-merge policy (e.g., docs-only, refactoring, test additions), auto-merge without human review. This is the most controversial and connects to the merge philosophy task.

**Key decisions to make**:
- Max iteration rounds before escalating to human? (Suggest 3)
- Should self-review (Phase 1) be mandatory or opt-in? (Suggest mandatory)
- Should Phase 2 be orchestrator logic or a separate "review coordinator" pattern?

---

### 2. Architecture and Taste Enforcement Patterns (`oc-wdc0`)

**The gap**: We have quality gates (build/test/typecheck) but no way to mechanically enforce architectural rules. Our own documented patterns in `docs/CODING.md` — package index imports, minimal entry points, service architecture — are enforced only by convention.

OpenAI's approach: custom linters enforcing dependency directions, naming conventions, structured logging, file size limits. Lint error messages include remediation instructions that get injected into agent context.

Key quote: "This is the kind of architecture you usually postpone until you have hundreds of engineers. With coding agents, it's an early prerequisite: the constraints are what allows speed without decay."

**Current state in our project**:
- No ESLint, Biome, or custom lint rules
- Only static analysis: `bun x tsc --noEmit`
- No `lint` or `format` script in package.json
- Architectural rules (import from package index, not internals) documented but unenforced

**What we could do**:

**Option A — Architecture enforcement skill (recommended)**

Create a skill that guides agents to set up project-specific architectural linters. The skill would:
1. Analyze the project's documented architecture (CODING.md, AGENTS.md)
2. Identify enforceable invariants (dependency directions, import patterns, naming conventions)
3. Generate appropriate linter configs and custom rules
4. Create lint error messages with remediation instructions (agent-legible)

This is high-leverage because it's reusable across any project — each user gets architectural enforcement tailored to their codebase.

**Option B — Eat our own dog food first**

Before creating a general skill, enforce our own architectural patterns:

1. **Package index import rule**: A simple script or ESLint rule that flags direct imports from internal files when a package index exists. Our CODING.md already documents this pattern (lines 43-44). Example check:

   ```
   # Bad:  import { foo } from "../commands/init/init.ts"
   # Good: import { foo } from "../commands/index.ts"
   ```

2. **Service architecture validation**: Check that services follow the documented pattern (interface + implementation + error handling).

3. **Lint error messages with remediation**: When a rule fires, the error message should explain what to do — this is what makes linting agent-friendly.

**Option C — Golden principles template**

A `docs/PRINCIPLES.md` or `docs/ARCHITECTURE.md` template that captures machine-enforceable invariants:

```markdown
## Invariants (machine-enforced)
- Import from package index, never internal files
- All services implement graceful degradation (catch all errors at service boundary)
- Entry point files delegate to domain packages (no business logic)
- No file exceeds 300 lines without explicit justification

## Principles (human-enforced)
- Enforce invariants, not implementations
- Local autonomy within strict boundaries
- Skills load on demand, not upfront
```

The distinction between "machine-enforced" and "human-enforced" is the key insight. Machine-enforced invariants become lint rules. Human-enforced principles stay as documentation.

**Recommended approach**: Start with Option B (eat our own food) + Option C (template), then generalize into Option A (skill) once we have proven patterns.

---

### 3. Automated Doc Gardening (`oc-aqyl`)

**The gap**: The current docs workflows handle on-demand documentation fixes and lifecycle updates, but there's no automated way to detect stale documentation, validate cross-links, or check coverage.

OpenAI's approach: dedicated linters and CI jobs validate the knowledge base. Recurring "doc-gardening" agent scans for stale/obsolete docs. Opens fix-up PRs automatically.

Key quote: "A monolithic manual turns into a graveyard of stale rules. Agents can't tell what's still true."

**Current state**:
- Project docs work is handled through the `opencode-coder` docs lifecycle workflow
- The workflow verifies file paths mentioned in docs and tests documented commands when applicable
- No freshness detection, no cross-link validation, no coverage analysis

**What we could do (focused on AGENTS.md freshness — our core artifact)**:

**1. AGENTS.md validation command**

A `/doc-validate` command (or extending the docs lifecycle workflow) that checks:

- **Path validation**: All file paths referenced in AGENTS.md exist
- **Command validation**: All build/test/lint commands in AGENTS.md actually work
- **Skill reference validation**: All skills referenced in AGENTS.md exist in `.opencode/skills/`
- **Freshness heuristic**: If a referenced doc file hasn't been modified in the last N months but the code it documents has changed significantly, flag it as potentially stale
- **Link validation**: Any URLs in docs are still reachable (HTTP 200)

**2. Cross-doc consistency checks**

- AGENTS.md references docs/CODING.md → verify CODING.md's patterns match actual code structure
- AGENTS.md references docs/TESTING.md → verify test commands in TESTING.md still pass
- README.md installation instructions → verify they work against current codebase

**3. Doc coverage analysis**

- Detect source files with no corresponding documentation coverage
- Detect documented features that no longer exist in code
- Flag TODOs/FIXMEs in documentation files

**Recommended approach**: Start with AGENTS.md validation (it's our core artifact and most likely to go stale). Add a validation step to the docs lifecycle workflow. Cross-doc consistency and coverage analysis can come later.

**Implementation**: This could be a validation checklist added to the docs lifecycle reference files, or a standalone validation script that agents can run.

---

### 4. Throughput-Optimized Merge Philosophy (`oc-sstk`)

**The gap**: Current PULL-REQUESTS.md follows conventional merge patterns — at least one approval, no unresolved comments, squash and merge. No guidance on optimizing for agent throughput.

OpenAI's approach: minimal blocking merge gates, short-lived PRs, test flakes addressed with follow-up runs, "corrections are cheap, waiting is expensive," agents can squash and merge their own PRs.

Key quote: "This would be irresponsible in a low-throughput environment. Here, it's often the right tradeoff."

**Current PULL-REQUESTS.md content**:
- Branch naming: `<type>/<short-description>`, all from `main`
- PR target: < 400 lines
- Before merging: all CI passes + at least one approval + no unresolved comments
- Merge strategy: squash and merge

**What we could add (as a new section in PULL-REQUESTS.md)**:

**Risk-Tiered Review Requirements**

Not all changes carry equal risk. Agent-authored PRs should follow tiered review:

| Change Type | Review Requirement | Auto-Merge? |
|---|---|---|
| Documentation only | Self-review | Yes, when CI passes |
| Test additions/fixes | Self-review | Yes, when CI passes |
| Refactoring (no behavior change) | One agent review (verifier) | Yes, when all gates pass |
| Bug fixes with tests | One human or agent review | Optional, configurable |
| New features | Human review | No |
| Architecture changes | Human review | No |

**Flake Resilience**

- Don't block on known flaky tests — re-run up to 2 times
- Track flake frequency; create cleanup tasks when a test flakes > 5% of runs
- Agent-authored PRs should run the full test suite, not just affected tests

**PR Sizing for Agent Throughput**

- Agent PRs should be atomic: one task = one PR
- If a task touches > 5 files or > 300 lines, consider splitting
- Prefer many small PRs over few large ones (reduces conflict surface)

**Merge Queue Patterns**

- When multiple agent PRs are in flight, use merge queue semantics
- Each PR rebases on the merge target before final CI check
- Conflicts are resolved by re-running the task, not by manual merge

**Agent-Authored PR Conventions**

- Title: `[agent] <conventional commit message>`
- Body: auto-generated from beads task description + changes summary
- Labels: `agent-authored` for filtering and metrics

**Recommended approach**: Add a "Throughput-Optimized Patterns" section to PULL-REQUESTS.md. Frame it as opt-in guidance for teams using agents at scale, not as a replacement for the existing conventional workflow.

---

## DEFER Items

### Ephemeral Observability Stack in Container (`oc-w0oi`)

**Why defer**: Infrastructure lives in the container project. We can't ship or control Vector/VictoriaMetrics/Loki installation. The minimum useful version (structured logging to files that agents can grep) is already possible without dedicated infrastructure.

**When to revisit**: When the container project adds observability tooling as a layer/profile. At that point, we add an observability skill that teaches agents to query the local stack.

**Minimum viable alternative**: Enhance the observability-triage skill with patterns for analyzing structured log files (JSON logs written to disk) rather than requiring a full metrics/traces stack. This covers 80% of the use case without any infrastructure dependency.

### Browser/UI Automation for Agents in Container (`oc-z32g`)

**Why defer**: Headless Chrome/CDP infrastructure belongs in the container project. The audience is narrower (only web UI projects). No demand signal yet.

**When to revisit**: When the container project includes headless Chrome. Or when a user specifically requests browser automation capabilities.

**Minimum viable alternative**: A skill that guides agents to use screenshots provided by users (MCP tool that accepts screenshot attachments) rather than taking screenshots themselves. Manual but functional.

### Tech Debt Tracker and Automated Cleanup (`oc-r8t9`)

**Why defer**: What counts as "tech debt" is deeply project-specific. Universal scanning (TODOs, large files, deprecated APIs) generates noise. Beads already supports creating chore-type issues manually.

**When to revisit**: After architecture enforcement (oc-wdc0) is implemented — "golden principles" violations detected by linters IS automated tech debt detection. This becomes a natural extension of that work.

**Minimum viable alternative**: Use beads labels (`tech-debt`) on manually created issues. Periodic `bd list --label tech-debt` to review debt backlog. No automation needed.

---

## CLOSE Items

### Design Docs and Core Beliefs Framework (`oc-211h`)

**Why close**: Beads epics already serve as execution plans with full dependency tracking, progress visibility, and decision logging (via comments). Adding a parallel design doc system creates redundancy. Core beliefs are just another `docs/` file — any project can add `docs/PRINCIPLES.md` without plugin support. The /init workflow already generates the standard doc set.

### Quality Grading System Per Domain (`oc-n012`)

**Why close**: This was designed for OpenAI's scale (~1M LOC, hundreds of agents generating code). For our target audience, the verifier already validates quality per task execution. Persistent scoring per domain is overhead that doesn't justify itself. If architecture enforcement (oc-wdc0) lands, lint pass rates and violation counts provide implicit quality signals without a dedicated scoring system.

---

## Dependency Graph

```
                     ┌─────────────────────────┐
                     │  oc-gu7t (Epic)          │
                     │  Harness Engineering     │
                     └────────────┬────────────┘
                                  │ depends on
                ┌─────────────────┼─────────────────┐
                │                 │                  │
        ┌───────▼──────┐  ┌──────▼───────┐  ┌──────▼──────┐
        │ GO (execute)  │  │ DEFER (wait) │  │ CLOSE       │
        └───────┬──────┘  └──────────────┘  └─────────────┘
                │
    ┌───────────┼───────────┬───────────┐
    │           │           │           │
 oc-90fr    oc-wdc0     oc-aqyl     oc-sstk
 Review     Arch        Doc         Merge
 Loops      Enforce     Garden      Philosophy
    │                                   │
    └──────────► oc-sstk depends on ────┘
                 oc-90fr
```

Phase 1 (independent, can parallel): oc-wdc0, oc-aqyl
Phase 2 (after discussion): oc-90fr (review loops)
Phase 3 (depends on oc-90fr): oc-sstk (merge philosophy)

---

## Open Questions

1. Should we eat our own dog food on architecture enforcement before creating a general skill?
2. How much review iteration is valuable vs. diminishing returns? (Suggest cap at 3 rounds)
3. Should Phase 1 of review loops (tasker self-review) be mandatory for all taskers?
4. Is risk-tiered review too opinionated for a plugin, or is it valuable guidance?
5. Should doc validation be a skill enhancement or a standalone command?
