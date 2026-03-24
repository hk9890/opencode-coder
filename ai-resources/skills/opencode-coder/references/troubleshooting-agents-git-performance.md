# Troubleshooting: Agents, Git Visibility, and Performance

Focused fixes for behavior, sync, and performance issues.

## Beads agents not following instructions

**Symptoms**: agent behavior diverges from intended role/process.

**Checks**:

```bash
bd hooks install
bd history <issue-id>
bd comments <issue-id>
```

**Common causes**:

- conflicting or overly heavy AGENTS.md guidance
- missing/outdated hooks
- runtime/plugin context injection problems

**Best practice**: keep AGENTS.md as routing guidance and use [project-structure.md](project-structure.md) for canonical structure rules.

## Git hooks not triggering on commits

```bash
ls -la .git/hooks/
bd hooks install
chmod +x .git/hooks/pre-commit
```

If needed, inspect `.git/hooks/pre-commit` to confirm beads hook content.

## Beads files showing in git status (stealth mode)

If stealth exclusion block is missing in `.git/info/exclude`, re-add it:

```bash
if ! grep -q "# opencode-coder stealth mode" .git/info/exclude 2>/dev/null; then
  cat >> .git/info/exclude << 'STEALTH'

# opencode-coder stealth mode
.beads/
.opencode/
.coder/
ai.package.yaml
STEALTH
fi
```

Verify with:

```bash
cat .git/info/exclude
```

## `.coder/project.yaml` dirty in team mode

```bash
grep -qF '.coder/' .gitignore 2>/dev/null || echo '.coder/' >> .gitignore
git rm -r --cached .coder/ 2>/dev/null
git commit -m "chore: exclude .coder/ runtime state from git"
```

## Beads files not showing in git status (team mode)

```bash
grep -n ".beads" .gitignore
git add .beads/
git check-ignore -v .beads/issues.jsonl .beads/config.yaml
```

In team mode, shared `.beads/` data should be trackable while local-only runtime files stay excluded.

## Uncommitted beads changes piling up

```bash
bd hooks install
git add .beads/issues.jsonl
git commit -m "chore: sync beads state"
git push origin main
```

## `bd` commands are slow

```bash
bd doctor --perf
wc -l .beads/issues.jsonl
bd gc --dry-run
```

Likely causes: large issue history, pending maintenance, or slow local Dolt state.

## Large logs filling disk

```bash
# Linux
du -sh ~/.local/share/opencode/log/
find ~/.local/share/opencode/log/ -name "*.log" -mtime +30 -delete

# macOS canonical
du -sh ~/Library/Application\ Support/opencode/log/
find ~/Library/Application\ Support/opencode/log/ -name "*.log" -mtime +30 -delete

# macOS fallback (older/alternate setups)
du -sh ~/.local/share/opencode/log/
find ~/.local/share/opencode/log/ -name "*.log" -mtime +30 -delete

unset OPENCODE_DEFAULT_OPTIONS
```
