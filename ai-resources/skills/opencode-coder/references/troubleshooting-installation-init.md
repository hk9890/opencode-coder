# Troubleshooting: Installation, Initialization, and Mode Detection

Focused fixes for setup-time failures.

## `bd` command not found after installation

**Symptoms**: Running `bd` returns "command not found".

**Fix**:

```bash
# Check npm global bin location
npm bin -g

# Add it to PATH for current shell
export PATH="$(npm bin -g):$PATH"

# Reinstall beads if needed
npm install -g beads
```

**Root cause**: npm global bin directory is not on `PATH`.

## npm permission errors during `npm install -g beads`

**Symptoms**: `EACCES` or permission denied.

**Fix**:

```bash
# Preferred: user-local npm global prefix
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g beads
```

**Fallback** (quick, less preferred):

```bash
sudo npm install -g beads
```

## `bd init` fails with "not a git repository"

**Fix**:

```bash
git init
git add .
git commit -m "Initial commit"
bd init --stealth
```

**Why**: beads requires an initialized git repository.

For mode/layout rules, see [project-structure.md](project-structure.md).

## Hooks not working right after initialization

**Fix**:

```bash
bd hooks install
ls -la .git/hooks/pre-commit
```

If needed, inspect hook content:

```bash
cat .git/hooks/pre-commit
```

## Switching stealth ↔ team after initialization

Follow [mode-transition.md](mode-transition.md) for canonical workflow.

After switching, verify:

- AGENTS.md location matches active mode
- docs are in expected mode-specific path
- `.coder/` exclusion/ignore rules match mode
- rerunning `/opencode-coder/init` detects the new mode

## Stealth files deleted by `git clean`

**Symptoms**: `.coder/`, `.beads/`, or `ai.package.yaml` disappeared.

**Recovery**: Re-run `/opencode-coder/init` to restore stealth setup.

**Important**: if `.beads/` was deleted, issue history in `.beads/issues.jsonl` is lost.

**Prevention**: avoid `git clean -fdx` in stealth mode; prefer `git clean -fd`.

## Stealth mode not detected on re-run

Check stealth marker:

```bash
grep "# opencode-coder stealth mode" .git/info/exclude
```

If marker is missing but `.coder/` exists, restore exclusion block or re-run `/opencode-coder/init` and choose stealth.

Detection rules are in [project-structure.md](project-structure.md).
