# Change Workflow

## Default path: commit directly to `main`

This repository normally lands work by committing and pushing directly to `main`.

- Do **not** create a branch or PR by default.
- Use a branch and PR only when the user explicitly asks for one or when an external review flow requires it.
- Keep each change small, scoped, and easy to review from the final commit diff.

### Direct-to-main checklist

1. Run the relevant checks from [`TESTING.md`](TESTING.md).
2. Review the exact diff you plan to ship:

   ```bash
   git status
   git diff
   ```

3. Stage only the intended files:

   ```bash
   git add <path>
   ```

4. Create a focused commit:

   ```bash
   git commit -m "docs: refresh change workflow guidance"
   ```

5. Rebase onto the latest remote state:

   ```bash
   git pull --rebase
   ```

6. Push the finished commit:

   ```bash
   git push
   ```

- If the working tree contains unrelated local edits, do not mix them into the same commit.
- If `git pull --rebase` reports conflicts, resolve them before `git push`.

## Branch and PR path (only when explicitly needed)

Use this path only when a branch is explicitly required.

### Create the branch

Start from `main` and create a short descriptive branch:

```bash
git switch -c docs/change-workflow
```

### Branch naming

```text
<type>/<short-description>
```

| Type | When to use | Example |
|---|---|---|
| `feature/` | New functionality | `feature/skill-routing-audit` |
| `fix/` | Bug fixes | `fix/stealth-mode-detection` |
| `chore/` | Maintenance, deps, CI | `chore/update-bun-lock` |
| `docs/` | Documentation only | `docs/change-workflow` |
| `refactor/` | Code restructuring | `refactor/service-layer` |

Rules:

- lowercase, hyphens only
- keep it short — 3-5 words max
- include an issue ID when it helps: `fix/123-null-pointer-in-config`

### Push and open the PR

1. Run the relevant checks from [`TESTING.md`](TESTING.md).
2. Push the branch:

   ```bash
   git push -u origin <branch-name>
   ```

3. Open the PR with GitHub CLI:

   ```bash
   gh pr create --title "docs: refresh change workflow guidance" --body "$(cat <<'EOF'
## Summary
- explain what changed and why

## Testing
- list the commands you ran from docs/TESTING.md
EOF
)"
   ```

### PR expectations

- Use a conventional-commit-style PR title such as `docs: refresh change workflow guidance`.
- Explain the **why** in the PR summary, not just the file list.
- Keep PRs small enough to review from the final diff.
- Review your own diff before requesting review.

Suggested PR body shape:

```markdown
## Summary
<1-3 bullet points explaining what changed and why>

## Testing
<commands from docs/TESTING.md that were run>
```

## Review and merge expectations

### As a reviewer

Focus on, in order:

1. correctness
2. edge cases
3. architecture consistency with [`CODING.md`](CODING.md)
4. naming clarity
5. meaningful verification from [`TESTING.md`](TESTING.md)

### As an author

- respond to every review comment
- push follow-up fixes as new commits
- do not force-push during review unless the reviewer explicitly asks for it

### Merge policy

- default path for this repo: direct commits to `main`
- if a PR is used, squash and merge to `main`
- delete the branch after merge
