# Coder Skill Installed Fixture

Canonical fixture for a project with coder mode state and committed skill-install baseline files.

Committed contents include:

- `.coder/opencode-coder.yaml`
- `.coder/project.yaml`
- `ai.package.yaml`
- `.gitkeep`
- `.opencode/.gitkeep`

Runtime dependency artifacts under `.opencode/` are intentionally not committed; the harness regenerates them in isolated workspaces.
