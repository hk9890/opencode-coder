# Existing Active Project Fixture

Represents a project that already opted into active startup.

Harness expectations:

- copied to a temp workspace before each test run
- built plugin symlinked into `.opencode/plugins/opencode-coder.js`
- isolated HOME/XDG/OpenCode env applied to prevent global plugin discovery
