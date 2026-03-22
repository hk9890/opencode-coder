# Existing Active Project Fixture

Represents a project that already opted into active startup.

This fixture intentionally includes a committed `ai.package.yaml` with an empty
resource list so first-startup `aimgr verify` resolves healthy deterministically
for scenario 1 registration checks.

Harness expectations:

- copied to a temp workspace before each test run
- built plugin symlinked into `.opencode/plugins/opencode-coder.js`
- isolated HOME/XDG/OpenCode env applied to prevent global plugin discovery
