# Changelog

All notable changes to the opencode-coder plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- *(No unreleased changes yet)*

## [0.35.0] - 2026-03-23

### Changed

- **Explicit project enablement**: Startup now requires an explicit saved project mode (`disabled`, `stealth`, or `team`) before opencode-coder activates project-local behavior or creates `.coder/` files.
- **Single setup entry point**: `/opencode-coder/init` is now the documented entry point for first-time enablement, refresh, disablement, and mode switching.

### Fixed

- **Legacy upgrade preservation**: Previously initialized projects are now inferred and migrated to explicit saved mode so upgrades keep active behavior instead of silently falling back to an inactive state.
- **Disabled-state precedence**: `OPENCODE_CODER_DISABLED=true` now clearly wins over any saved project mode while remaining distinct from the new saved `disabled` project state.

### Added

- **Mode-resolution coverage**: Added tests for explicit saved mode resolution, legacy migration, init-template guidance, and inactive startup behavior.

### Docs

- **Enablement model docs**: Updated README, user guide, and opencode-coder skill references to explain explicit enablement, saved disabled mode, legacy migration, and the hard-disable override.

## [0.34.3] - 2026-03-15

### Fixed

- **Startup readiness warning hang**: The "Orchestrator not enabled" startup toast no longer blocks the plugin config hook when the TUI toast promise stalls, preventing blank-screen hangs in not-ready projects.

### Added

- **Readiness toast regression coverage**: Added integration coverage for the non-ready startup path when the readiness toast promise never resolves.

### Docs

- **Beads persistence guidance**: Replaced outdated `bd sync` references with supported `bd dolt` persistence commands in agent and troubleshooting docs.

## [0.34.2] - 2026-03-15

### Fixed

- **Startup opt-in guardrail**: Startup no longer creates `.coder/`, `.coder/logs/`, or `ai.package.yaml` in repositories that have not explicitly opted in.
- **Opted-in startup diagnostics**: Early startup log lines are now replayed into `.coder/logs` once file logging is enabled so opted-in projects keep a complete startup timeline.

### Added

- **Filesystem regression coverage**: Added real temp-directory integration coverage for both the no-`.coder` startup path and the opted-in `.coder` startup path.

## [0.34.1] - 2026-03-15

### Fixed

- **Startup side effects**: Startup no longer auto-runs aimgr bootstrap, creates `ai.package.yaml`, or writes `.coder/project.yaml` when `.coder/` is absent.
- **Explicit setup flow**: `/init` remains available as the opt-in setup path and now creates `.coder/` before reading project context when needed.

## [0.34.0] - 2026-03-15

### Added

- **Project-local plugin logs**: Added daily log files at `.coder/logs/coder-YYYY-MM-DD.log` with 7-day retention so startup/runtime diagnostics are available directly in the repository context.
- **Startup timeout guardrails**: Added bounded startup timeouts for project-context and CLI-backed checks to prevent hanging during initialization.

### Fixed

- **CLI availability timeout handling**: `aimgr`/`bd` availability checks now treat command timeouts explicitly and continue in degraded mode with warning logs instead of blocking startup or misreporting missing tools.

## [0.33.1] - 2026-03-13

### Changed

- **Startup readiness flow**: Startup now waits for aimgr initialization and can auto-repair unhealthy resources before project detection and default-agent selection.
- **Project context shape**: Removed unused git platform/remote metadata from the generated project context.
- **Status diagnostics**: `/coder/status` now probes supported plugin install scopes instead of assuming a single package path.

### Fixed

- **Default agent selection**: Prevented stale readiness state from blocking orchestrator as the default agent after successful aimgr remediation.
- **Release verification guidance**: Clarified the difference between package visibility and GitHub Packages auth/token-scope failures.

### Docs

- **Architecture docs**: Updated coding and release docs to match the current startup, repair, and verification flow.
- **Scion exploration**: Added brainstorming notes for future Scion integration work.

## [0.33.0] - 2026-03-11

### Added

- **`/simplify` command**: Added a dedicated workflow command to review and simplify recently changed files using the opencode-coder process.

### Changed

- **Repository/package identity migration**: Updated project and package identity to `dynatrace-oss`, including install and release references for `@dynatrace-oss/opencode-coder`.
- **Project setup and workflow docs**: Consolidated and clarified setup guidance, including GitHub task sync workflow and acceptance review task patterns.

### Fixed

- **Agent workflow enforcement**: Improved agent guidance to consistently load required skills for beads issue workflows and improved reviewer comment quality expectations.
- **Beads command examples**: Replaced invalid `bd` command usage with current v0.59.0-compatible commands.

## [0.32.0] - 2026-03-04

### Added

- **PULL-REQUESTS.md**: New standard documentation file covering branching strategy, PR conventions, and code review guidelines

### Fixed

- **Team mode git tracking**: Auto-exclude `.coder/` from git tracking when initializing in team mode

### Changed

- **Package detection**: Replaced `ai.package.yaml` parsing with `aimgr list` CLI for more reliable installed-package detection

### Removed

- **Dead code**: Removed `GitHubService`, `filesystem.ts`, context stubs, and orphaned test fixtures
- **bitbucket-pr skill**: Removed unused skill
- **Stale documentation**: Fixed `CONTRIBUTING.md`, `CODING.md`, `README.md`, and skill files to reflect current codebase

### Chore

- **MIT LICENSE**: Added missing license file
- **Dependency bumps**: `@opencode-ai/plugin` → 1.2.16, `@types/bun` → 1.3.10
- **Git object store**: Optimized repository from 94 MB to 4.2 MB

## [0.31.1] - 2026-03-03

### Fixed

- **Package detection broken**: `detectCoderPackageInstalled()` checked for `packages` key in `ai.package.yaml` but aimgr uses `resources`, causing detection to always return false and `/init` to loop on the install guide
- **Init install UX**: Agent now offers to run `aimgr init && aimgr install package/opencode-coder` via `question()` instead of just printing commands

## [0.31.0] - 2026-03-03

### Added

- **Init readiness gating**: `/init` command now checks installation readiness before running, preventing use when prerequisites are missing

### Fixed

- **Default agent selection**: Orchestrator is now correctly set as the default agent only when the full ecosystem (beads, aimgr, stealth mode) is ready (closes #11)

## [0.30.0] - 2026-03-02

### Added

- **ProjectDetectorService**: Detects git platform, beads status, stealth mode, and aimgr status; writes `.coder/project.yaml` on startup
- **Smart skill discovery**: `/init` delegates to ai-resource-manager for context-aware skill filtering
- **Unified stealth mode**: Hide all opencode-coder artifacts from git in one operation
- **Aimgr repair integration**: Integrated aimgr repair into `/init` and `/doctor` commands
- **Agent improvements**: Agent colors, command argument forwarding, init bootstrapping, aimgr verify

### Fixed

- **Stealth AGENTS.md**: Moved to `.coder/` and injected via plugin config hook
- **Hooks structure**: Flattened to match SDK Hooks interface
- **Stealth mode awareness**: Added to fix-documentation skill

### Changed

- **Agent definitions**: Improved orchestrator, reviewer, tasker, and verifier agents
- **Planning references**: Updated with `needs:discussion` and `open-questions` patterns
- **Package manifest**: ai-resource-manager added

## [0.29.0] - 2026-02-28

### Added

- **opencode-coder-dev skill**: New internal skill separating developer-facing content from the public opencode-coder skill
- **Project context discovery**: All agents now discover and use project-specific context automatically

### Changed

- **Agent architecture**: Redesigned to 4 focused agents (orchestrator, reviewer, tasker, verifier); skill serves as reference hub
- **AI resources consolidation**: Slimmed skill, inlined CLI reference, promoted /init command
- **AGENTS.md**: Rewritten as a routing table; coding guidelines moved to CODING.md; TESTING.md added
- **ai-resources template**: Slimmed down template, added update-agent-md command, fixed package list

### Fixed

- **Skill links**: Repaired broken links in opencode-coder and opencode-coder-dev skills
- **JSON blocks**: Fixed invalid JSON blocks in bitbucket-pr skill; added orphaned reference link in github-releases skill
- **Cross-skill references**: Replaced hard-coded skill name references with capability descriptions

### Removed

- **Beads injection machinery**: Removed BeadsContext and KnowledgeBaseService; simplified beads integration

## [0.28.0] - 2026-02-24

### Added

- **New template**: AGENTS.md template file for project initialization

### Changed

- **AGENTS.md**: Complete rewrite with comprehensive coding conventions, build/test commands, directory structure, code style guidelines, async patterns, error handling, and naming conventions
- **Enhanced /init command**: Enhanced with 3-step workflow — skill discovery → beads init → AGENTS.md creation, with mandatory user interaction points
- **Enhanced opencode-coder skill**: Step-by-step init workflow with project type detection and framework analysis

## [0.26.1] - 2026-02-17

### Added

- **github-releases skill**: TODO validation script to verify all placeholders filled
- **github-releases skill**: Script-based task generation for releases

### Fixed

- **github-releases skill**: Removed technology assumptions, added TODO markers for customization
- **github-releases skill**: Corrected task parent type from task to epic

### Changed

- **Beads**: Updated migration hint for better clarity

## [0.26.0] - 2026-02-15

### Added

- **monitoring-analysis skill**: Agentic log/metric triage for production monitoring (ai-resources/)
- **Release workflow structure**: Now uses --parent and bd dep add for proper task hierarchy

### Changed

- **github-releases skill**: Enforces epic/task structure to prevent skipped steps
- **release-workflow.md**: Condensed from 457 to 261 lines with clearer instructions

### Fixed

- **Release workflow**: Strengthened to prevent agents skipping critical steps
- **Markdown linting**: Resolved errors in release-workflow.md

## [0.25.0] - 2026-02-14

### Added

- **github-releases skill**: Complete language-agnostic release workflow (ai-resources/)
  - Quality gates validation (tests, builds, CI checks)
  - Documentation validation integration
  - Version management and semver guidance
  - GitHub Actions and manual release support
  - Release notes templates and best practices
  - Comprehensive troubleshooting guides
  - Setup guide for creating project-specific RELEASING.md files

### Changed

- **AGENTS.md**: Added ai-resources/ section explaining optional installable resources
  - Clarified three-tier directory structure (knowledge-base/, .opencode/, ai-resources/)
  - Simplified release section to reference github-releases skill
- **docs/RELEASING.md**: Created comprehensive project-specific release guide
  - Exact build, test, and typecheck commands
  - GitHub Actions workflow instructions (primary method)
  - Manual release fallback procedures
  - Pre-release checklist and post-release verification
  - Rollback procedures and troubleshooting

### Fixed

- **Documentation**: Fixed plugin path and hook references
- **Markdown linting**: Resolved all 27 linting errors in github-releases skill
  - Line length violations (MD013)
  - Blank lines around lists and fences (MD031/MD032)
  - Missing code block language tags (MD040)

## [0.24.0] - 2026-02-14

### Fixed

- **E2E test failures**: Removed obsolete command registration tests (bug oc-xbxi)
  - Plugin now only registers agents; commands provided by OpenCode's skill system
  - All 148 tests passing (was 146 passing, 2 failing)
  - Added comprehensive test analysis documentation

### Removed

- **system_info tool**: Removed in favor of direct bash commands in skill instructions
  - The tool provided no value over simple bash commands
  - Current implementation had bugs (plugin version showed "unknown" due to path resolution issues)
  - Simplification aligns with "best code is no code" philosophy
  - Status command now uses direct bash commands documented in skill (more reliable)
  - **Removed 212 lines of unnecessary code**
  - **Migration**: The system_info tool was only used internally by the status command, which has been updated. No external migration needed.

### Added

- **Comprehensive status check documentation**: New `status-checks-reference.md` in skill with battle-tested bash commands for all status checks
  - Plugin version detection via package.json
  - Configuration status checks
  - Beads integration verification
  - Complete copy-paste ready status script
  - Troubleshooting guides
- **Test analysis documentation**: Complete analysis of test suite health and coverage

### Changed

- **Status command**: Now uses direct bash commands instead of system_info tool
  - More reliable (no path resolution bugs)
  - More transparent (LLM sees actual commands)
  - Easier to debug and maintain

## [0.23.0] - 2026-02-13

*(Previous releases would be documented here)*
