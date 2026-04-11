# Beads Planning Reference

Reference guide for creating epics, tasks, acceptance review tasks, and managing beads workflow structure.

## Beads Types

- **epic** — Large feature or initiative (contains tasks)
- **feature** — User-facing functionality
- **task** — Atomic unit of work, including acceptance review tasks in this beads setup
- **bug** — Defect to fix
- **chore** — Maintenance, refactoring

## Task Quality Standards

Each task MUST be executable by agents WITHOUT additional questions.

**Quality Checklist:**
- Clear step-by-step instructions
- Specific files to modify (with actions: create/update/delete)
- Testable acceptance criteria (not "works" or "is good")
- No ambiguities or open questions
- Self-contained (agent doesn't need to ask clarifying questions)

**Good Task:**
```markdown
## Description
Add JWT token verification middleware to protect API routes.

## Instructions
1. Create file `src/middleware/auth.ts`
2. Import `jsonwebtoken` package
3. Implement `verifyToken` middleware function that:
   - Extracts token from Authorization header (Bearer scheme)
   - Verifies token using JWT_SECRET from env
   - Attaches decoded user to `req.user`
   - Returns 401 for missing/invalid tokens
4. Export middleware for use in routes

## Acceptance Criteria
- [ ] Middleware file created at correct path
- [ ] Valid tokens pass through with user attached
- [ ] Invalid/expired tokens return 401
- [ ] Missing Authorization header returns 401
- [ ] Tests pass: `npm test -- auth.test.ts`

## Files to Modify
- src/middleware/auth.ts (create)
- src/middleware/index.ts (add export)
```

**Bad Task:**
```markdown
## Description
Add authentication

## Instructions
Make the API secure
```

## Creating Issues

> **Important**: Use `--body-file -` to read body content from stdin. Heredoc syntax (`<< 'EOF'`) alone does NOT work with `bd create`.

### Epic Structure

```bash
# Create the epic
cat << 'EOF' | bd create --title="User Authentication" --type=epic --priority=1 --body-file -
## Description
Implement user authentication with JWT tokens.

## Goals
- Users can register and login
- Sessions persist across browser refreshes

## Success Criteria
- [ ] All child tasks completed
- [ ] Acceptance review task passed
EOF

# Create acceptance review task (every epic needs one)
cat << 'EOF' | bd create --title="Acceptance Review: User Authentication" --type=task --priority=1 --body-file -
## Description
Verify the epic outcome before the epic is closed.

## Acceptance Criteria
- [ ] All tasks closed
- [ ] Integration tested
- [ ] No critical bugs

## Owner
verifier
EOF

# Link acceptance review task to epic
bd dep add <epic-id> <acceptance-review-id>
```

### Task Structure

```bash
cat << 'EOF' | bd create --title="Add JWT middleware" --type=task --priority=2 --body-file -
## Description
What and why — context for the task.

## Instructions
Step-by-step implementation guide:
1. First do X
2. Then do Y
3. Finally do Z

## Files to Modify
- src/middleware/auth.ts — add JWT verification
- src/types/auth.ts — add token types

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests pass
- [ ] No new lint errors
EOF
```

For simple issues, use `--description` directly:

```bash
bd create --title="Fix login bug" --type=bug --priority=1 --description="Users cannot login when email contains + character."
```

### Needs Discussion (Not Ready for Execution)

Some tasks need user input, scoping, or discussion before a tasker should touch them. The planner MUST distinguish between "ready to execute" and "needs discussion" tasks at creation time.

**Pattern:** Create with `needs:discussion` label, then immediately set `status=blocked`.

```bash
# Create the task with the label
cat << 'EOF' | bd create --title="Design auth token strategy" --type=task --priority=1 --labels=needs:discussion --body-file -
## Description
Implement token refresh strategy.

## Open Questions
- [ ] Should tokens auto-refresh or require explicit refresh call?
- [ ] What's the token expiry time? (suggested: 1 hour)

## Why This Needs Discussion
User needs to decide on token strategy before implementation can begin.

## Instructions
(blocked until discussion resolves open questions)
EOF

# Immediately block it so it won't appear in bd ready
bd update <id> --status=blocked
```

**Why `status=blocked` + label?**
- `status=blocked` keeps the task out of `bd ready` — taskers will never pick it up
- `needs:discussion` label explains *why* it's blocked (not a dependency — needs human input)
- When discussion completes, the orchestrator unblocks it: `bd update <id> --status=open --remove-label needs:discussion`

**When to use this pattern:**
- Imported issues that lack implementation detail
- Tasks where the user explicitly said "let's discuss this first"
- Tasks with unresolved architectural or design questions
- Any task where a tasker would have to guess or improvise

**Planner rule:** If you are unsure whether a task is ready for execution, mark it `needs:discussion`. It is better to block a task for discussion than to let a tasker guess.

### Open Questions on Otherwise Ready Tasks

For tasks that are mostly ready but have minor open questions that don't block core implementation, use the `has:open-questions` label and set `status=blocked`:

```bash
cat << 'EOF' | bd create --title="Add JWT middleware" --type=task --priority=1 --labels=has:open-questions --body-file -
## Description
Implement JWT verification middleware.

## Open Questions
- [ ] What's the token expiry time? (suggested: 1 hour)

## Instructions
1. Create src/middleware/auth.ts
2. Implement verifyToken middleware
...
EOF

# Block until questions are resolved
bd update <id> --status=blocked
```

Issues with `has:open-questions` stay blocked until questions are resolved. Once resolved, unblock: `bd update <id> --status=open --remove-label has:open-questions`. If the open questions are fundamental enough that the task can't be scoped at all, use the `needs:discussion` pattern above instead.

### External Bug Handling

Bugs from user/customer reports use `source:external` label and get a linked post-mortem task:

```bash
# Create the bug
cat << 'EOF' | bd create --title="Login fails for + in email" --type=bug --priority=1 --labels=source:external --body-file -
## Description
User reported: login fails when email contains + character.

## Steps to Reproduce
1. Register with email user+tag@example.com
2. Try to login
3. Error: "Invalid email format"
EOF

# Create linked post-mortem
cat << 'EOF' | bd create --title="Post-mortem: Email validation bug" --type=task --priority=3 --body-file -
## Post-mortem Questions
- [ ] Why wasn't this caught in testing?
- [ ] Are there similar validation issues?
- [ ] What process improvement prevents recurrence?
EOF

bd dep add <postmortem-id> <bug-id>
```

Post-mortems are ONLY for external bugs (`source:external`). Internal discovery bugs don't need them.

## Labels and Acceptance Review Tasks

### Labels
- `need:review` — Signals reviewer agent must review the plan
- `needs:discussion` — Task needs user discussion/scoping before execution (use with `status=blocked`)
- `has:open-questions` — Issue has unresolved questions
- `source:external` — Bug reported by user/customer
- `risk:high` — High-risk change (optional)
- `area:<name>` — Area tag (optional)

### Acceptance Review Tasks
Use normal `task` issues for blocking review work in this beads setup:
- `Acceptance Review: <Epic>` — Every epic should have one
- `Security Review: <Scope>` — For security-sensitive work
- `Performance Check: <Scope>` — For performance-critical work

These tasks represent **blocking conditions**, not approval states. Add comments on the epic and review task when you need to clarify that they are serving as acceptance gates.

### Comment discipline

Keep `bd` comments short and decision-oriented:
- status
- outcome
- artifact path(s)
- next step

Do **not** use a long comment as a substitute for tracked work. If planning, review, or verification discovers substantial new analysis, a new blocker, or follow-up implementation/research, create or update a dedicated bug/task instead of burying it in a large comment.

## Priority Guide

| Level | Name | When to Use |
|-------|------|-------------|
| 0 (P0) | Critical | Blocks everything |
| 1 (P1) | High | Needed soon |
| 2 (P2) | Medium | Default |
| 3 (P3) | Low | Nice to have |
| 4 (P4) | Backlog | Someday |

**Format**: Always use numeric 0-4 or P0-P4. Do NOT use "high", "medium", "low" — bd does not accept string priorities.

## Execution Expectations

When the user asks you to create beads issues (epic, tasks, bugs), **create them immediately**. Do not describe what you would create and ask for permission. The user's request to plan work IS the permission.

**Do this:**
```
User: "Create an epic and tasks for the search feature."
→ Run bd create commands. Show the created issues afterward.
```

**Do NOT do this:**
```
User: "Create an epic and tasks for the search feature."
→ "I would create an epic with these tasks... Shall I go ahead?"
```

The plan is the deliverable. Creating the issues IS the work. If the plan needs user input on specific ambiguities, create what you can and mark the ambiguous parts with `needs:discussion` + `status=blocked` — don't hold everything back waiting for permission to start.

After creating the plan, show `bd ready` and `bd blocked` so the user can see what's actionable and what needs their input.

## Workflow Phases

### Beads write concurrency guard

The default embedded-dolt backend is single-writer per workspace. When issuing
`bd` write operations (`bd create`, `bd update`, `bd close`) for the same
`.beads/` directory, run them **sequentially**.

Do **not** launch concurrent `bd` writes in one workspace; they can fail with
exclusive-lock/busy errors. If parallelism is required, use separate isolated
workspaces so each writer has its own `.beads/` store.

### Discovery
1. Ask clarifying questions if scope is unclear
2. Research codebase (launch explore agents in parallel for complex scope)
3. Identify affected areas, dependencies, risks

### Planning
1. Create epic with clear goals
2. Break into atomic tasks (one focused session each)
3. Create acceptance review task
4. Set dependencies with `bd dep add`
5. Apply `need:review` to complex/risky items
6. Show the plan: `bd status`, `bd ready`, `bd blocked`

### Review (if needed)
Spawn reviewer for items labeled `need:review`. Reviewer creates new beads if issues found — does NOT modify existing ones.

### User Approval
Before execution: show `bd ready`, show `bd blocked`, confirm user wants to proceed.

### Execution
- Spawn taskers for ready work (parallel when independent)
- Check `bd ready` for newly unblocked work after each completion
- Continue until no ready tasks remain

### Verification
Spawn verifier for acceptance review tasks. Verifier closes the review task or creates bugs/tasks.

### Closure
When all implementation tasks closed AND the acceptance review task is closed → close the epic.

## Agent Tips

**Updating issues:**
```bash
bd update <id> --claim                  # Claim work atomically
bd update <id> --status=in_progress     # Set status directly when needed
bd update <id> --assignee=username      # Assign to someone
bd update <id> --title="New title"      # Update title
bd update <id> --description="..."      # Update description
bd update <id> --notes="..."            # Update notes
bd update <id> --priority=1             # Change priority
```

**Filtering issues:**
```bash
bd list --status=open                   # All open issues
bd list --status=in_progress            # Currently active work
bd list --parent <id>                   # Children of an epic
bd list --type=bug                      # All bugs
```

**Close multiple issues at once:**
```bash
bd close oc-abc oc-def oc-ghi --reason="All implemented"
```

**Use `--json` for structured output:**
```bash
bd ready --json
bd show <id> --json
```

**Use `bd <command> --help`** for full flag reference on any command.

**WARNING**: Do NOT use `bd edit` — it opens $EDITOR (vim/nano) which blocks agents. Use `bd update` instead.
