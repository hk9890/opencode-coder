# Advanced Beads Use Cases: Real-World Molecules & Chemistry

## Executive Summary

This document covers **actual, production use** of beads advanced features (molecules, formulas, wisps) based on real examples from the beads project itself. These are not theoretical "could be useful" scenarios — these are workflows the beads maintainers use daily to ship beads itself.

**Key Finding:** The beads team uses molecules for their own release process, proving the concept works at scale.

---

## 1. The Primary Real-World Use Case: Beads Self-Hosting

### The beads-release Formula

**Location:** `.beads/formulas/beads-release.formula.toml` (825 lines)
**Purpose:** Complete release workflow for beads itself
**Type:** Wisp (ephemeral operational work)
**Frequency:** Every release (2-3 times per week historically)

**What It Does:**
Orchestrates the complete release cycle from version bump to verification:
- 20+ steps across 3 phases
- Uses gates for async CI waits
- Parallel verification (GitHub + npm + PyPI)
- Fan-in for final installation

### The Three Phases

```
Phase 1: Prep & Push (Polecat Work)
├── preflight-worktree
├── preflight-git (auto-stash)
├── preflight-pull
├── detect-half-done-release
├── review-changes
├── verify-changelog-complete
├── update-changelog
├── update-info-go
├── bump-version-go
├── bump-plugin-json
├── bump-mcp-python
├── bump-npm-package
├── bump-hook-templates
├── bump-readme
├── bump-default-nix
├── update-vendorhash
├── stamp-changelog
├── verify-versions
├── commit-release
├── create-tag
├── push-main
└── push-tag → PHASE COMPLETE

Gate: CI Completion
└── await-ci (waits for GitHub Actions)

Phase 2: Verification (Parallel)
├── verify-github
├── verify-npm
└── verify-pypi

Phase 3: Installation (Fan-in)
├── local-install
├── restart-daemons
├── generate-newsletter
└── release-complete
```

### Why This Uses Molecules

**Problem Solved:**
- Releases have 20+ steps (easy to forget one)
- Some steps must be sequential (can't push before commit)
- Some steps can run parallel (verify GitHub/npm/PyPI concurrently)
- CI completion is async (need to wait without blocking)
- Need to resume after interruptions

**Without Molecules:**
- Markdown checklist (easy to lose track)
- Manual dependency tracking (error-prone)
- No automatic gate coordination
- Resume after failures is manual

**With Molecules:**
- `bd ready` always shows correct next step
- Dependencies enforce order (can't push before commit)
- Parallel steps run concurrently
- Gate waits for CI automatically
- Resume is seamless (just `bd ready` again)

### Usage Pattern

**From Changelog (Real Commits):**

> "release.sh is now a molecule gateway - Creates a release wisp instead of running a batch script"

**How They Run It:**

```bash
# Start release workflow
bd mol wisp beads-release --var version=0.49.6

# Or via gastown polecat (agent automation)
gt sling beads/polecats/p1 --formula beads-release --var version=0.49.6
```

**What Happens:**
1. Creates wisp (ephemeral, won't clutter git history)
2. Spawns all 20+ steps with dependencies
3. Agent (or human) works through with `bd ready`
4. Dependencies block incorrect order
5. Gate step waits for CI
6. Parallel verification runs concurrently
7. Fan-in waits for all verifications
8. Molecule auto-closes when complete

**After Completion:**
```bash
bd mol squash <wisp-id>  # Creates permanent digest of findings
# OR
bd mol burn <wisp-id>    # If release was aborted
```

---

## 2. The Formula Structure (beads-release.formula.toml)

### Variable Definition

```toml
formula = "beads-release"
description = "Beads release workflow v2 - gate-aware async release"
type = "workflow"
phase = "vapor"  # Forces wisp creation
version = 1

[vars.version]
description = "The semantic version to release (e.g., 0.44.0)"
required = true
```

### Step Anatomy (Real Example)

```toml
[[steps]]
id = "preflight-git"
title = "Preflight: Check git status & auto-stash"
needs = ["preflight-worktree"]  # Sequential dependency
description = """
Ensure working tree is clean before starting release.

```bash
git status --short
```

**Handling uncommitted changes:**

If changes are in **non-release files**:
```bash
# Auto-stash non-release files
git stash push -m "pre-release: non-release changes" \
  -- .beads/ .claude/ *.local* .env*

# Verify working tree is now clean
git status --short
```

**Important:** The bump script may fail if non-release files 
are modified. Always stash .beads/, .claude/ directories.

After release completes, restore with:
```bash
git stash pop
```
"""
```

**Key Elements:**
- `id`: Step identifier
- `title`: Human-readable name
- `needs`: Array of dependencies (blocks until these complete)
- `description`: Markdown with code examples, explanations, gotchas

### Dependency Types in Action

**Sequential (Default):**
```toml
[[steps]]
id = "commit-release"
needs = ["verify-versions"]  # Must verify before committing

[[steps]]
id = "create-tag"
needs = ["commit-release"]  # Must commit before tagging

[[steps]]
id = "push-main"
needs = ["create-tag"]  # Must tag before pushing

[[steps]]
id = "push-tag"
needs = ["push-main"]  # Must push main before pushing tag
```

**Parallel (No Dependencies):**
```toml
[[steps]]
id = "verify-github"
needs = ["await-ci"]  # All three need CI, but not each other

[[steps]]
id = "verify-npm"
needs = ["await-ci"]  # Can run parallel with verify-github

[[steps]]
id = "verify-pypi"
needs = ["await-ci"]  # Can run parallel with others
```

**Fan-in (Multiple Dependencies):**
```toml
[[steps]]
id = "local-install"
needs = ["verify-github", "verify-npm", "verify-pypi"]  
# Waits for ALL three verifications
```

### Gate Step (Async Wait)

```toml
[[steps]]
id = "await-ci"
title = "Await CI: release.yml completion"
needs = ["push-tag"]
description = """
Gate step: Wait for GitHub Actions release workflow to complete.

This gate blocks until the release.yml workflow run succeeds.
The Refinery auto-discovers the workflow run triggered by v{{version}}
and closes this gate when it completes.

Expected time: 5-10 minutes

If the workflow fails, this gate remains open and requires 
manual intervention.
"""

[steps.gate]
type = "gh:run"
id = "release.yml"
timeout = "30m"
```

**How This Works:**
1. Agent completes `push-tag`, signals phase-complete
2. `await-ci` gate becomes active but blocked
3. GitHub Actions workflow starts (triggered by tag push)
4. Beads "Refinery" monitors GitHub API
5. When workflow completes, Refinery closes gate
6. Next steps become unblocked
7. Agent resumes with `bd ready`

---

## 3. Why They Chose Wisps (Not Mols)

### The Decision

```toml
phase = "vapor"  # Ensures this runs as a wisp
```

**From Formula Comments:**
> "bd pour will warn, gt sling --formula creates wisp"

### Reasoning

**Release workflows are operational:**
- Routine (happens every few days)
- Not reference material (don't need to review past releases)
- Findings matter, process doesn't
- Would clutter git history

**What Gets Preserved:**
```bash
bd mol squash <wisp-id>
# Creates permanent digest: "Released v0.49.6: 
# - All checks passed
# - GitHub release verified
# - npm package published
# - PyPI package published
# - Local install updated"
```

**What Gets Discarded:**
- Individual step completion records
- Intermediate git stash operations
- Verification check details
- Process scaffolding

**If Release Fails:**
```bash
bd mol burn <wisp-id>  # No trace, start fresh
```

### Compare to Mol Approach

**If this were a mol (persistent):**
```bash
bd pour beads-release --var version=0.49.6
```

**Problems:**
- Git history cluttered with every release attempt
- Failed releases leave permanent records
- 20+ issues per release = database bloat
- Hard to distinguish "release records" from "actual work"

**With wisp:**
- Clean during execution
- Only outcome preserved (via squash)
- Failed attempts disappear (via burn)
- Database stays focused on actual development work

---

## 4. The Polecat Integration (Agent Automation)

### What is a Polecat?

**From gastown:** An agent that executes molecules autonomously.

### Usage Pattern

```bash
# Manual human execution
bd mol wisp beads-release --var version=0.49.6
# Human runs: bd ready, bd show, bd close, repeat

# Automated polecat execution
gt sling beads/polecats/p1 --formula beads-release --var version=0.49.6
# Polecat automatically: reads formula, executes steps, handles gates
```

### Polecat Workflow

```
1. gt sling assigns formula to polecat
   ↓
2. Polecat spawns wisp from formula
   ↓
3. Polecat enters execution loop:
   - bd ready (get next steps)
   - For each ready step:
     * Read step description
     * Execute commands from description
     * Verify success
     * bd close <step>
   - Repeat until blocked or complete
   ↓
4. If blocked by gate:
   - Signal phase-complete
   - Wait for gate to close
   - Resume when unblocked
   ↓
5. When all steps complete:
   - bd mol squash (create digest)
   - Report completion
```

### Why This Works

**Step descriptions are executable:**
```toml
description = """
Update the Go version constant.

```bash
# macOS
sed -i '' 's/Version = "[^"]*"/Version = "{{version}}"/' cmd/bd/version.go

# Linux
sed -i 's/Version = "[^"]*"/Version = "{{version}}"/' cmd/bd/version.go
```

Verify:
```bash
grep 'Version = ' cmd/bd/version.go
```
"""
```

**Polecat can:**
- Parse the bash blocks
- Execute platform-appropriate commands
- Run verification checks
- Report success/failure

**The formula is both:**
1. Human-readable documentation (explains WHY)
2. Machine-executable script (shows WHAT)

---

## 5. Other Real-World Patterns (From Docs)

### Pattern: Parallel Fanout with Gate

**Use Case:** Process multiple files, then aggregate results

```bash
bd create "Process files" -t epic
bd create "File A" -t task --parent <epic>
bd create "File B" -t task --parent <epic>
bd create "File C" -t task --parent <epic>
bd create "Aggregate" -t task --parent <epic>

# Aggregate needs all three (waits-for gate)
bd dep add <aggregate> <fileA> --type waits-for
bd dep add <aggregate> <fileB> --type waits-for
bd dep add <aggregate> <fileC> --type waits-for
```

**Execution:**
```
t=0:  File A, File B, File C start (parallel)
t=5:  File A completes
t=7:  File B completes
t=10: File C completes → Aggregate unblocks
t=11: Aggregate runs
```

### Pattern: Dynamic Bonding (Christmas Ornament)

**Use Case:** Number of parallel tasks unknown until runtime

**From docs/MOLECULES.md:**

```bash
# In a survey step, discover polecats and bond arms dynamically
for polecat in $(gt polecat list); do
  bd mol bond mol-polecat-arm $PATROL_ID \
    --ref arm-$polecat \
    --var name=$polecat
done
```

**Creates:**
```
patrol-x7k (wisp)
├── preflight
├── survey-workers
│   ├── patrol-x7k.arm-ace (dynamically bonded)
│   ├── patrol-x7k.arm-nux (dynamically bonded)
│   └── patrol-x7k.arm-toast (dynamically bonded)
└── aggregate (waits for all arms)
```

**Real-World Scenario:**
- Patrol health check for multi-agent system
- Don't know how many agents exist until survey runs
- Each agent gets parallel health check
- Aggregate waits for ALL checks before reporting

### Pattern: Conditional Bonding (Error Handling)

**Use Case:** Rollback if deploy fails

```bash
bd mol bond mol-deploy mol-rollback --type conditional
```

**Execution:**
```
IF deploy succeeds:
  - Rollback mol never spawns
  - Workflow complete

IF deploy fails:
  - Rollback mol spawns automatically
  - Executes rollback steps
  - Original deploy marked failed
```

---

## 6. Formulas vs Ad-Hoc Molecules

### When Formulas Make Sense

**From beads team experience:**

**Use formulas if:**
1. **Repeatable** - Same workflow structure used multiple times
   - Example: Every release follows same 20 steps
   
2. **Complex** - Too many steps to remember
   - Example: 20+ steps with dependencies
   
3. **Documented** - Steps need detailed explanations
   - Example: Each step has gotchas, examples, recovery procedures
   
4. **Agent-executable** - Want autonomous execution
   - Example: Polecats can execute without human intervention

**Don't use formulas if:**
1. **One-off work** - Unlikely to repeat
   - Just create epic + tasks manually
   
2. **Simple** - Only 3-5 linear steps
   - TodoWrite or simple epic is fine
   
3. **Exploratory** - Structure not yet clear
   - Start ad-hoc, extract formula later (via `bd mol distill`)

### Formula Evolution Pattern

**1. Start Ad-Hoc:**
```bash
# First release: manual epic
bd create "Release 0.1.0" -t epic
bd create "Bump version" -t task --parent <epic>
bd create "Update changelog" -t task --parent <epic>
bd create "Push tag" -t task --parent <epic>
# Work through manually
```

**2. Second Release: Realize It's Repeatable:**
```bash
# Extract formula from first release
bd mol distill <epic-id> --as "release-workflow"
# Beads generates formula from epic structure
```

**3. Third Release Onward: Use Formula:**
```bash
bd mol wisp release-workflow --var version=0.2.0
# All steps generated automatically
```

**4. Refine Over Time:**
- Add steps discovered missing
- Update descriptions with gotchas found
- Add verification checks
- Add gates for async waits

---

## 7. The Molecule Execution Model

### How Agents Traverse Molecules

**From docs/MOLECULES.md:**

```
epic-root (assigned to agent)
├── child.1 (no deps → ready)      ← execute in parallel
├── child.2 (no deps → ready)      ← execute in parallel
├── child.3 (needs child.1) → blocked until child.1 closes
└── child.4 (needs child.2, child.3) → blocked until both close
```

**Execution Loop:**
```
WHILE molecule not complete:
  1. bd ready (get ready children)
  2. FOR EACH ready child (can be parallel):
     - bd update <id> --status in_progress
     - Execute work
     - bd close <id>
  3. REPEAT
```

**Key Insight:**
> "Children are parallel by default. Only explicit dependencies create sequence."

### Multi-Day Execution

**Agent workflow:**
```
Day 1:
  - bd ready shows: child.1, child.2
  - Complete child.1, child.2
  - bd ready shows: child.3 (now unblocked)
  - Session ends

Day 2:
  - bd ready shows: child.3 (still ready)
  - Complete child.3
  - bd ready shows: child.4 (now unblocked)
  - Complete child.4
  - Molecule complete
```

**Persistence:**
- Mol state survives sessions
- Dependencies tracked automatically
- `bd ready` always correct
- Can resume any time

---

## 8. Practical Recommendations

### For OpenCode Users

**When to Use Molecules:**

**✅ YES - Use molecules/formulas if:**
- Workflow repeats 3+ times
- 10+ steps with dependencies
- Steps have detailed procedures/gotchas
- Need autonomous execution capability
- Parallel steps exist
- Async waits needed (gates)

**Example Candidates:**
- Release workflows (like beads-release)
- Onboarding checklists (new hire setup)
- Security review processes (standardized checks)
- Migration procedures (database, infrastructure)

**❌ NO - Skip molecules if:**
- One-off project work
- Simple linear task lists
- Exploratory/research work
- Still figuring out structure

**Use instead:**
- Basic epics + tasks (for project work)
- TodoWrite (for session work)
- Notes in regular beads (for exploration)

### Starting Point: Extract, Don't Design

**Anti-Pattern:**
```
❌ Design perfect formula upfront
❌ Try to anticipate all steps
❌ Build formula before doing work
```

**Recommended Pattern:**
```
✅ Do work manually first (epic + tasks)
✅ Note what was hard/confusing
✅ After 2-3 iterations, extract formula
✅ Refine formula over next few uses
```

**Use `bd mol distill`:**
```bash
# After completing work manually
bd mol distill <epic-id> --as "my-workflow" --var key=value

# Beads extracts:
# - Task structure
# - Dependencies
# - Variable placeholders
# - Generates formula.toml
```

### When to Use Wisps vs Mols

**Based on beads team's choice:**

**Use Wisps for:**
- ✅ Release workflows (operational, routine)
- ✅ Patrol cycles (health checks)
- ✅ Code review checklists (process scaffolding)
- ✅ Research spikes (might be valuable or trash)
- ✅ Any workflow where process isn't the product

**Use Mols for:**
- ✅ Feature development (audit trail matters)
- ✅ Bug fixes (need historical record)
- ✅ Architecture changes (future reference)
- ✅ Any work that becomes documentation

**Decision test:**
> "Is the process itself valuable, or just the outcome?"

- Outcome valuable → Wisp (squash to digest)
- Process valuable → Mol (keep full history)

---

## 9. The Reality Check

### Adoption Statistics

**From GitHub issues + community:**

| Feature | Real-World Usage | Status |
|---------|------------------|--------|
| **Basic beads** (epic/task/dep) | Very High | Production-ready |
| **Session workflows** (ready/show) | Very High | Production-ready |
| **Compaction survival** (notes) | High | Production-ready |
| **Formulas/Molecules** | **Low** | **Working, but niche** |
| **Wisps** | **Very Low** | **Experimental** |
| **Gates** | **Very Low** | **Experimental** |
| **Gastown** | **Minimal** | **Alpha** |

### Who Actually Uses Molecules?

**From evidence:**
1. **Beads maintainers** - beads-release formula (proven at scale)
2. **Gastown users** - Multi-agent coordination (experimental)
3. **? Unknown users** - No public examples found

### Why Low Adoption?

**Barriers:**
1. **Steep learning curve** - Chemistry metaphor, TOML syntax
2. **Documentation gap** - Most docs are theoretical, not practical
3. **Discoverability** - Most users don't know feature exists
4. **Not needed** - Basic beads solve 95% of problems
5. **Tooling** - No GUI, must edit TOML by hand
oder
### The Honest Assessment

**Molecules work well for:**
- ✅ Highly repetitive workflows (releases, checklists)
- ✅ Complex dependencies (parallel + sequential)
- ✅ Agent automation (polecats executing formulas)
- ✅ Async coordination (gates for CI waits)

**But they're overkill for:**
- ❌ Most development work (features, bugs)
- ❌ Exploratory projects (research, spikes)
- ❌ Small teams without repetition
- ❌ Users learning beads

**Bottom line:** Molecules are a **power-user feature** for **highly structured, repetitive workflows**. The beads release process proves they work at scale. But for typical software development, basic beads are sufficient.

---

## 10. Conclusion: When to Actually Use This

### The Litmus Test

Ask these questions:

1. **Repetition:** Will I run this workflow 5+ times?
   - No → Skip formulas
   - Yes → Consider formula

2. **Complexity:** Does it have 10+ steps with dependencies?
   - No → Skip formulas
   - Yes → Consider formula

3. **Documentation:** Do steps need detailed procedures?
   - No → Skip formulas
   - Yes → Consider formula

4. **Automation:** Want agents to execute autonomously?
   - No → Skip formulas
   - Yes → Consider formula

**Need 3+ "Yes" answers** to justify formula investment.

### Real-World Example Scorecard

**Beads Release Workflow:**
- ✅ Repetition: Every release (2-3x per week)
- ✅ Complexity: 20+ steps with dependencies
- ✅ Documentation: Each step has gotchas, examples
- ✅ Automation: Polecats execute autonomously
- **Score: 4/4** → Perfect fit for formula

**Feature Development:**
- ❌ Repetition: Each feature is unique
- ⚠️ Complexity: Maybe 5-10 tasks
- ❌ Documentation: Captured in design docs
- ❌ Automation: Human judgment needed
- **Score: 0/4** → Basic beads sufficient

**Code Review:**
- ⚠️ Repetition: Every PR (frequent)
- ⚠️ Complexity: 5-10 checks
- ✅ Documentation: Checklist helps consistency
- ❌ Automation: Requires human judgment
- **Score: 1.5/4** → Maybe wisp for scaffolding

### The Conservative Recommendation

**For 95% of users:**
1. Master basic beads first (epics, tasks, dependencies)
2. Get comfortable with session workflows (ready/show/close)
3. Practice compaction survival (good notes)
4. Use TodoWrite effectively (temporal layering)

**Only explore molecules if:**
- You have a workflow that scores 3+ on litmus test
- You've done it manually 3+ times
- You can articulate what's painful without automation
- You're willing to invest time learning TOML + formula syntax

**The beads team's approach:**
- Used basic beads for ~1 year
- Identified release process as painful
- Built beads-release formula to solve real pain
- Proved it works at production scale

**Learn from their pattern:** Solve real pain with real evidence, not theoretical optimization.

---

## References

- **beads-release Formula:** `.beads/formulas/beads-release.formula.toml` (825 lines, production use)
- **Molecules Documentation:** `docs/MOLECULES.md`
- **Formula Guide:** `website/docs/workflows/formulas.md`
- **Changelog Evidence:** Search for "molecule", "wisp", "pour" in CHANGELOG.md
- **Real Commits:** "release.sh is now a molecule gateway" (v0.49.4)
