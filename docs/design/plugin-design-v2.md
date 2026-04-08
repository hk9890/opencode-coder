# Plugin Design V2

## Purpose

This document describes the desired end state for the plugin after the current additive split work. It is not an implementation plan for the current epics. It is a target design for what the plugin should do at a high level when the new skills exist.

## Desired outcome

The plugin should be a small runtime/orchestration layer that helps a project become ready for OpenCode workflows without requiring every optional integration to be installed.

At a high level, the plugin should:

1. support users to install and configure OpenCode / opencode-coder project setup
2. use beads integration when beads is installed and configured
3. use aimgr integration when aimgr is installed and configured
4. write the current project state to a local project context file

## High-level features

### 1. Install and configure support

The plugin should help users set up a project for OpenCode usage.

This includes:

- detecting whether the project is already configured
- guiding the user through setup when it is not
- supporting explicit startup modes such as `stealth`, `team`, and `disabled`
- exposing a minimal bootstrap/init experience when the project is not fully ready yet

### 2. Optional beads integration

If beads is installed and the project is using beads, the plugin should enable beads-aware behavior.

This includes:

- injecting beads-aware workflow guidance/messages
- recognizing beads project state
- configuring `orchestrator` as the default agent when no other default agent is configured
- keeping beads behavior optional rather than required for the plugin to function

If beads is not installed, the plugin should still work in a degraded but valid core mode.

### 3. Optional aimgr integration

If aimgr is installed, the plugin should help the user keep resources healthy.

This includes:

- detecting aimgr availability
- verifying installed resources
- attempting auto-repair when appropriate
- using aimgr as a convenience layer, not as a hard requirement for basic plugin operation

If aimgr is not installed, the plugin should still work and should fall back to a simpler bootstrap/setup path.

### 4. Project state snapshot

The plugin should always be able to write the current local project state to a file such as `.coder/project.yaml`.

This state should include at least:

- startup mode (`stealth`, `team`, `disabled`, inactive/not enabled)
- whether beads is present/active
- whether aimgr is present/healthy
- whether the core runtime is ready
- which optional capabilities are available

## Design principles

### Core first

The plugin should have one minimal baseline capability that works without beads and without aimgr.

### Optional capability layers

Beads and docs should be additive capabilities on top of the core experience.

### Graceful degradation

Missing integrations should reduce capability, not break startup.

### Clear ownership

The plugin should own runtime detection/orchestration. Skills should own workflow guidance.

## How this should work with the new skills

## Skill model

### `coder-core`

`coder-core` should be the minimal required skill/capability for the plugin's intended normal operation.

It should own:

- install/configure guidance
- startup mode guidance
- runtime/bootstrap guidance
- project state interpretation
- general troubleshooting that does not depend on beads
- aimgr-related core guidance where relevant to setup/repair

If only `coder-core` is available, the plugin should still be useful.

### `coder-beads`

`coder-beads` should be an optional layer.

It should own:

- beads workflow guidance
- beads tracker/planning behavior
- beads-specific troubleshooting
- beads-specific follow-up behavior

The plugin should enable beads-aware runtime behavior only when beads is actually available in the project.

### `coder-docs`

`coder-docs` should be another optional layer.

It should own:

- docs lifecycle guidance
- AGENTS generation/routing guidance
- docs review/improvement workflows

The plugin should not require `coder-docs` in order to provide core setup/bootstrap behavior.

### `code-simplify`

`code-simplify` should own base `/simplify` workflow guidance.

It should own:

- simplify scope guardrails for recently changed files
- safe-vs-ask-first simplification boundaries
- standalone simplify workflow detail consumed by `/simplify` routing

`coder-core` should not own simplify baseline workflow in this model.

## Runtime model with new skills

The runtime should be organized around capabilities instead of one large combined skill.

### Baseline capability

- `coder-core` present -> core/bootstrap/runtime features can work

### Optional capabilities

- `coder-beads` present + beads available -> enable beads-aware behavior
- `coder-docs` present -> enable docs lifecycle behavior
- `code-simplify` present -> enable dedicated simplify workflow guidance

This means the plugin should move toward:

- **core required**
- **beads optional**
- **docs optional**
- **simplify capability optional and standalone**

## Proposed plugin responsibilities in V2

The plugin itself should be responsible for:

1. resolving startup mode
2. detecting which capabilities are available
3. writing `.coder/project.yaml`
4. exposing bootstrap/init behavior when core is not ready
5. enabling beads-aware behavior only when beads is available
6. enabling docs behavior only when docs capability is available
7. helping with aimgr verify/repair when aimgr exists

The plugin should not require every capability to exist before it can load.

## Proposed readiness model

### Core-ready

The project has enough setup for core plugin behavior.

### Beads-capable

The project also has working beads integration.

### Docs-capable

The project also has working docs-lifecycle integration.

The project can be:

- core-ready only
- core-ready + beads-capable
- core-ready + docs-capable
- core-ready + beads-capable + docs-capable

## Non-goals for this plugin

Session export / trajectory export should not be a core responsibility of this plugin long term.

If trajectory/session export is needed, it should live in a separate dedicated plugin rather than inside this plugin.

## Summary

The V2 direction is:

- make `coder-core` the minimal runtime target
- keep beads integration optional and capability-based
- keep docs integration optional and capability-based
- let aimgr improve the experience when available, but not define basic viability
- keep the plugin focused on runtime detection, bootstrap, repair help, and project-state writing
