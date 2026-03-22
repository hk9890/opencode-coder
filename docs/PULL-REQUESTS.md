# Pull Requests & Branching

## Branching Strategy

### Branch Naming

```
<type>/<short-description>
```

| Type | When to use | Example |
|------|-------------|---------|
| `feature/` | New functionality | `feature/pull-requests-doc` |
| `fix/` | Bug fixes | `fix/stealth-mode-detection` |
| `chore/` | Maintenance, deps, CI | `chore/update-bun-lock` |
| `docs/` | Documentation only | `docs/add-monitoring-guide` |
| `refactor/` | Code restructuring | `refactor/service-layer` |

Rules:
- Lowercase, hyphens only (no underscores, no camelCase)
- Keep it short — 3-5 words max
- Include issue ID when relevant: `fix/42-null-pointer-in-config`

### Base Branch

- All branches start from `main`
- Merge back to `main` via pull request
- No long-lived feature branches — keep PRs small and focused

## Pull Request Guidelines

### Creating a PR

1. **Push your branch** and ensure CI passes before requesting review
2. **Title**: Use conventional commit style — `feat: add PULL-REQUESTS.md standard file`
3. **Description**: Explain the "why", not just the "what"
   - What problem does this solve?
   - What approach did you take and why?
   - Are there alternatives you considered?
4. **Size**: Aim for < 400 lines changed. Split larger work into stacked PRs.
5. **Self-review**: Review your own diff before requesting others

### PR Description Template

```markdown
## Summary
<1-3 bullet points explaining what and why>

## Changes
<Brief list of what changed>

## Testing
<How was this tested? What commands to run?>
```

### Before Merging

- All CI checks pass (build, test, typecheck)
- At least one approval
- No unresolved review comments
- Branch is up to date with `main`

## Code Review

### As a Reviewer

Focus areas (in priority order):

1. **Correctness** — Does the code do what it claims?
2. **Edge cases** — What happens with empty input, errors, missing data?
3. **Architecture** — Does it follow the package index pattern? (see [CODING.md](CODING.md))
4. **Naming** — Are variables, functions, and files named clearly?
5. **Tests** — Are meaningful tests included?

Guidelines:
- Be specific — point to the line, suggest the fix
- Distinguish "must fix" from "nit" or "suggestion"
- Approve with nits when the nits are truly minor
- If you don't understand something, ask — don't assume it's wrong

### As an Author

- Respond to every comment (even with "done" or "acknowledged")
- Don't take feedback personally — it's about the code
- Push fixes as new commits (don't force-push during review)
- Squash on merge, not before

## Merge Strategy

- **Squash and merge** to `main` (keeps history clean)
- The squash commit message should follow conventional commits: `feat:`, `fix:`, `chore:`, etc.
- Delete the branch after merge
