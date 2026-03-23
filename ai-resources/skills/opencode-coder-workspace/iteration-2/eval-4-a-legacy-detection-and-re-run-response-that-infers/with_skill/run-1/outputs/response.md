Your situation is the **legacy upgrade scenario** described in the installation-setup reference. Here's what `/opencode-coder/init` should do when it sees your state:

## What init detects

You have mixed legacy signals:
- **Stealth marker** in `.git/info/exclude` → suggests stealth mode was set up originally
- **`.beads/` and `AGENTS.md`** in root → team-mode markers (shared, committed files)

No `.coder/opencode-coder.yaml` means the plugin has never written explicit saved state.

## What init should do

1. **Detect legacy active state** from the existing markers rather than treating this as a fresh project
2. **Prompt you to pick a mode** — stealth, team, or disabled — since the signals are ambiguous (stealth marker + team artifacts coexist)
3. **Write `.coder/opencode-coder.yaml`** with the chosen mode, so future startups use explicit saved state instead of re-inferring from heuristics
4. **Refresh the active AGENTS file** for the chosen mode
5. **Optionally offer a docs setup/refresh step**

## The key outcome

After init completes, `.coder/opencode-coder.yaml` should exist. If it still doesn't after re-running init, that's a bug — init should always write the config file when completing successfully in an active mode.

## Quick manual fix if init didn't write it

If you know you want stealth mode:
```bash
mkdir -p .coder && printf 'mode: stealth\n' > .coder/opencode-coder.yaml
```
Or team mode:
```bash
mkdir -p .coder && printf 'mode: team\n' > .coder/opencode-coder.yaml
echo '.coder/' >> .gitignore
```

Did init complete without writing the file, or did it error/prompt unexpectedly?
