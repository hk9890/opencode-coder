# Generating AGENTS.md

Template/format guidance for generating or updating an AGENTS.md file.

For project-doc lifecycle workflow logic (inspect/bootstrap/refresh/audit/slim/verify decisions), use [project-docs-lifecycle.md](project-docs-lifecycle.md).

**Goal**: Produce a small AGENTS.md that acts as a routing table — each section points agents to the right documents and skills for a given use case. No inline content except Project Overview and Landing the Plane.

**Target size**: 30-60 lines.

---

## Canonical Path Rules

Load [project-structure.md](project-structure.md) first. It is the source of truth for:

- stealth vs team detection
- where AGENTS.md lives
- where standard docs live
- what may be shared vs local-only
- AGENTS.md writing rules

Use these placeholders throughout this template:

- `{agents_md}` = `AGENTS.md` in team mode, `.coder/AGENTS.md` in stealth mode
- `{docs}` = `docs/` in team mode, `.coder/docs/` in stealth mode

## Standard File Convention

Each section can map to a standard file in `{docs}` when project-specific guidance exists:

| Section | Standard File | Always Present |
|---------|--------------|----------------|
| Project Overview | *(inline)* | Yes |
| Coding | `{docs}CODING.md` | Only if project-specific coding guidance exists |
| Testing | `{docs}TESTING.md` | Only if relevant docs/skills exist |
| Releases | `{docs}RELEASING.md` | Only if relevant docs/skills exist |
| Monitoring | `{docs}MONITORING.md` | Only if relevant docs/skills exist |
| Pull Requests | `{docs}PULL-REQUESTS.md` | Only if relevant docs/skills exist |
| Landing the Plane | *(inline)* | Only if beads is installed |

**Always detect mode first and use the correct path throughout all subsequent steps.**

---

## Workflow

### Step 1: Gather Context

Spawn an **explore agent** with the following prompt:

> Analyze this project and return a structured summary with:
>
> 1. **Project identity** — Name, one-sentence description, tech stack
> 2. **Build & test commands** — How to build, test, lint, type-check (extract from project config files and scripts)
> 3. **Directory structure** — Top-level directories with one-line purpose each
> 4. **Existing docs** — List ALL files in `docs/` directory AND `.coder/docs/` directory (if either exists). Also check for `CONTRIBUTING.md`, `CODING.md`, `TESTING.md`, `RELEASING.md`, `MONITORING.md`, `PULL-REQUESTS.md` in project root. Check for `.coder/AGENTS.md` (stealth mode AGENTS.md). Report full paths.
> 5. **Coding conventions** — Are there any files that describe coding conventions, guidelines, or architecture? Check: `CONTRIBUTING.md`, `docs/coding-guidelines.md`, `docs/CODING.md`, `.editorconfig`, or similar. Report filenames only.
> 6. **Testing docs** — Are there files that describe testing patterns, test setup, or test conventions? Report filenames only.
> 7. **Release docs** — Are there files that describe the release process? Report filenames only.
> 8. **Monitoring docs** — Are there files that describe monitoring, observability, or log analysis? Report filenames only.
> 9. **PR & branching docs** — Are there files that describe pull request conventions, branching strategy, or code review guidelines? Report filenames only.
> 10. **Installed skills** — List all skills in `.opencode/skills/` directory with their descriptions
> 11. **Beads status** — Is `bd` CLI available? Is `.beads/` directory present?
>
> Be thorough but return ONLY the structured summary, no commentary.

Wait for the explore agent to return before proceeding.

### Step 2: Map Existing Docs to Sections

From the explore output, map every discovered doc file to a section:

| Section | Matches these existing files |
|---------|------------------------------|
| Coding | `CONTRIBUTING.md`, `docs/coding-guidelines.md`, `docs/CODING.md`, `.coder/docs/CODING.md`, `docs/architecture.md`, `.editorconfig` |
| Testing | `docs/TESTING.md`, `.coder/docs/TESTING.md`, `docs/testing-guide.md`, `docs/test-patterns.md` |
| Releases | `docs/RELEASING.md`, `.coder/docs/RELEASING.md`, `docs/release-process.md`, `RELEASING.md` |
| Monitoring | `docs/MONITORING.md`, `.coder/docs/MONITORING.md`, `docs/observability.md`, `docs/logging.md` |
| Pull Requests | `docs/PULL-REQUESTS.md`, `.coder/docs/PULL-REQUESTS.md`, `docs/branching.md`, `docs/code-review.md`, `docs/pr-conventions.md` |

Also map installed skills to sections:
- Skills matching "release", "publish", "ship" → Releases
- Skills matching "observability", "triage", "monitoring" → Monitoring
- Skills matching "test" → Testing
- Skills matching "pull request", "PR", "code review", "bitbucket", "github-pr" → Pull Requests

A section is **active** if it has at least one matching project doc file OR one matching skill/workflow.

### Step 3: Migration Decision

Check if any active section has docs under **non-standard names**.

If non-standard names are found, ask the user **once**:

> "This plugin uses a standard documentation structure where each topic has a dedicated file in `{docs}`:
>
> | Topic | Standard File |
> |-------|--------------|
> | Coding | `{docs}CODING.md` |
> | Testing | `{docs}TESTING.md` |
> | Releases | `{docs}RELEASING.md` |
> | Monitoring | `{docs}MONITORING.md` |
> | Pull Requests | `{docs}PULL-REQUESTS.md` |
>
> I found existing docs that could be migrated into this structure:
>
> - `docs/coding-guidelines.md` → `{docs}CODING.md`
> - `CONTRIBUTING.md` (coding conventions) → `{docs}CODING.md` (CONTRIBUTING.md would reference it)
> - *(list all proposed moves)*
>
> Would you like to adopt the standard structure?"

**If yes:**
1. Create the standard files in `{docs}` and move/consolidate content
2. If `CONTRIBUTING.md` had coding conventions mixed with contribution process, split them: coding conventions go to `{docs}CODING.md`, `CONTRIBUTING.md` keeps the contribution process and adds a reference to `{docs}CODING.md`
3. Reference the new standard paths in AGENTS.md

**If no:**
- Reference the existing file paths as-is in AGENTS.md

### Step 4: Create Missing Standard Files

Only create a standard file when the project has real local guidance for that topic.

If a section is active only because a skill/workflow is installed (no project-specific doc content found), reference the skill/workflow in AGENTS.md and do not create a hollow topic doc.

**Before creating any new file, ask the user to confirm** — show them a summary of what you plan to write and let them approve or adjust.

### Step 5: Generate AGENTS.md

Build the file section by section. Use `{agents_md}` and `{docs}` consistently.

#### Project Overview (always, inline)

```markdown
# Project Name

One-sentence description.

**Tech Stack**: [from explore agent]
```

Just what the project is and the tech stack. Nothing else.

#### Coding (conditional)

```markdown
## Coding

Read `{docs}CODING.md` for project-specific build commands, project structure, and code conventions.

Read `CONTRIBUTING.md` for contribution workflow.
```

If no project-specific coding doc exists and coding workflow is fully covered by skills/reusable guidance, route to the relevant skill/reference instead.

#### Testing (conditional)

```markdown
## Testing

Read `{docs}TESTING.md` for test patterns and commands.
```

If a testing skill is installed, add: `Load the **skill-name** skill for [description].`

#### Releases (conditional)

```markdown
## Releases

Load the **release-skill-name** skill for release workflow. Read `{docs}RELEASING.md` for details.
```

#### Monitoring (conditional)

```markdown
## Monitoring

Load the **monitoring-skill-name** skill for observability and triage. Read `{docs}MONITORING.md` for data sources.
```

#### Pull Requests (conditional)

```markdown
## Pull Requests

Read `{docs}PULL-REQUESTS.md` for branching strategy, PR conventions, and code review guidelines.
```

If a PR skill is installed, add: `Load the **skill-name** skill for [description].`

#### Landing the Plane (conditional — only if beads installed)

Include this exact content:

```markdown
## Landing the Plane (Session Completion)

**When ending a work session**, complete ALL steps:

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Verify** - All changes committed AND pushed

**CRITICAL**: Work is NOT complete until `git push` succeeds.
```

### Step 6: Verify

After generating, confirm:

- [ ] Project Overview is just name + description + tech stack (no commands)
- [ ] Every other section is a pointer (file or skill reference), not a summary
- [ ] All referenced file paths actually exist
- [ ] Topic docs are referenced only when they exist and contain project-specific guidance
- [ ] If a topic is skill-only, AGENTS routes to the skill/workflow and does not imply a missing doc is required
- [ ] Conditional sections only appear when relevant docs/skills exist
- [ ] Landing the Plane only appears if beads is installed
- [ ] No duplicated content from referenced files
- [ ] Total size is under 60 lines
- [ ] Mode-specific paths match `project-structure.md`

---

## Updating an Existing AGENTS.md

When AGENTS.md already exists:

1. Run the same explore + mapping steps
2. Match existing sections by `##` headers
3. **Update** sections that match template sections (with fresh data)
4. **Preserve** custom sections that don't match any template section
5. **Add** new sections for newly discovered docs/skills
6. **Remove** sections for content that no longer exists
7. Keep custom sections in their original position; place new sections before "Landing the Plane"
8. Offer migration if non-standard file names are detected (same as Step 3)

If the mode changed since the last generation, move the file to the correct path and rewrite doc references accordingly.

---

## Existing Team AGENTS.md

If a team `AGENTS.md` already exists and the repo is in stealth mode:

- read it for context
- write only `.coder/AGENTS.md`
- supplement, do not overwrite or duplicate
- keep new doc references under `.coder/docs/`

See [project-structure.md](project-structure.md) for the full rule set.

---

## Scope Boundary

This reference defines AGENTS template/format conventions.

It does **not** own the full project-doc lifecycle workflow. Lifecycle decisions about when to create, skip, refresh, audit, or slim topic docs belong to [project-docs-lifecycle.md](project-docs-lifecycle.md).
