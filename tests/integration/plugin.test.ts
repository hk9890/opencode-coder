import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as childProcess from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { OpencodeCoder } from "../../src";
import { AimgrService, BeadsService, PluginModeService, ProjectDetectorService } from "../../src/service";
import type { PluginModeResolution, ProjectContext } from "../../src/service";
import { createMockPluginInput, asMockPluginInput } from "../helpers/mock-client";

function createProjectContext(overrides?: Partial<ProjectContext>): ProjectContext {
  const runtimePhase: ProjectContext["runtimePhase"] = {
    phase: "normal" as const,
    coreAvailable: true,
    bootstrapRequired: false,
    missingRequiredSurfaces: [],
    shouldExposeBootstrapInit: false,
  };

  return {
    mode: "team",
    coreAvailable: true,
    bootstrapRequired: false,
    beadsReady: true,
    git: { initialized: true },
    beads: {
      initialized: true,
      stealthMode: false,
      bdCliInstalled: true,
      coderBeadsSkillAvailable: true,
      orchestratorAgentAvailable: true,
    },
    aimgr: {
      installed: true,
      packageYaml: true,
      resourcesHealthy: true,
    },
    pluginVersion: "1.0.0",
    runtimePhase,
    ...overrides,
  };
}

function savedModeResolution(mode: PluginModeResolution["mode"], source: PluginModeResolution["source"] = "saved"): PluginModeResolution {
  return {
    mode,
    source,
    stateFilePath: "/test/project/.coder/opencode-coder.yaml",
  };
}

const DOCS_LIFECYCLE_COMMANDS = ["opencode-coder/init-or-update-docs", "opencode-coder/improve-doc"] as const;
const LEGACY_DOCS_COMMAND = "opencode-coder/update-agent-md";

function createLifecycleCommandFixture() {
  return {
    "opencode-coder/init-or-update-docs": {
      description: "docs lifecycle",
      template: "docs template",
    },
    "opencode-coder/improve-doc": {
      description: "incident improvement",
      template: "improve template",
    },
    "opencode-coder/update-agent-md": {
      description: "legacy docs command",
      template: "legacy template",
    },
  } as Record<string, { description: string; template: string }>;
}

function createPhase2CommandFixture() {
  return {
    ...createLifecycleCommandFixture(),
    "opencode-coder/init": {
      description: "resource-backed init",
      template: "resource init template",
    },
  } as Record<string, { description: string; template: string }>;
}

function createActiveTeamWorktree(prefix: string, options?: { withGit?: boolean; withBeads?: boolean; withPackageYaml?: boolean }) {
  const worktree = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(worktree, ".coder"), { recursive: true });
  writeFileSync(join(worktree, ".coder", "opencode-coder.yaml"), "mode: team\n", "utf-8");

  if (options?.withGit !== false) {
    mkdirSync(join(worktree, ".git"), { recursive: true });
  }

  if (options?.withBeads) {
    mkdirSync(join(worktree, ".beads"), { recursive: true });
  }

  if (options?.withPackageYaml) {
    writeFileSync(join(worktree, "ai.package.yaml"), "name: test\nversion: 1\n", "utf-8");
  }

  return worktree;
}

function readProjectContextFromWorktree(worktree: string): ProjectContext {
  const contextPath = join(worktree, ".coder", "project.yaml");
  const raw = readFileSync(contextPath, "utf-8");
  return parseYaml(raw) as ProjectContext;
}

function createExecTimeoutError(message: string): Error & { code: string; killed: boolean; signal: string } {
  return Object.assign(new Error(message), {
    code: "ETIMEDOUT",
    killed: true,
    signal: "SIGTERM",
  });
}

describe("OpencodeCoder Plugin Integration", () => {
  beforeEach(() => {
    spyOn(BeadsService.prototype, "checkBeadsAvailability").mockResolvedValue(undefined);
  });

  afterEach(() => {
    mock.restore();
  });

  describe("plugin loading", () => {
    it("should load without errors", async () => {
      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      expect(hooks).toBeDefined();
    });

    it("should provide tool hook with coder tool for active projects", async () => {
      spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      expect(hooks.tool).toBeDefined();
      expect(hooks.tool?.coder).toBeDefined();
    });

    it("no-.coder startup regression: does not create .coder or ai.package.yaml for fresh projects", async () => {
      const worktree = mkdtempSync(join(tmpdir(), "opencode-coder-no-coder-"));

      try {
        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        await OpencodeCoder(asMockPluginInput(mockInput));

        expect(existsSync(join(worktree, ".coder"))).toBe(false);
        expect(existsSync(join(worktree, "ai.package.yaml"))).toBe(false);
      } finally {
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("replays early startup logs into .coder/logs for active projects", async () => {
      const worktree = mkdtempSync(join(tmpdir(), "opencode-coder-with-coder-"));

      try {
        mkdirSync(join(worktree, ".coder"), { recursive: true });
        writeFileSync(join(worktree, ".coder", "opencode-coder.yaml"), "mode: team\n", "utf-8");

        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        await OpencodeCoder(asMockPluginInput(mockInput));

        const today = new Date().toISOString().slice(0, 10);
        const logPath = join(worktree, ".coder", "logs", `coder-${today}.log`);
        const logContent = readFileSync(logPath, "utf8");

        expect(logContent).toContain("OpencodeCoder plugin loading...");
        expect(logContent).toContain("OpencodeCoder plugin loaded");
        expect(logContent).toContain("Runtime diagnostic signal");
        expect(logContent).toContain("runtime.log_sink.project_local_enabled");
      } finally {
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("records startup/runtime structured evidence in the project-local diagnostic log sink", async () => {
      const worktree = mkdtempSync(join(tmpdir(), "opencode-coder-runtime-evidence-"));

      try {
        const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
        const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
          verifyResult: { status: "ok", issues: [] },
          resourcesHealthy: true,
          repairAttempted: false,
          repairSucceeded: false,
        });
        const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
          createProjectContext()
        );

        mkdirSync(join(worktree, ".coder"), { recursive: true });
        writeFileSync(join(worktree, ".coder", "opencode-coder.yaml"), "mode: team\n", "utf-8");

        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
        const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
        await hooks.config?.(cfg as any);

        const today = new Date().toISOString().slice(0, 10);
        const logPath = join(worktree, ".coder", "logs", `coder-${today}.log`);
        const lines = readFileSync(logPath, "utf8").trim().split("\n");
        const evidenceLines = lines.filter((line) =>
          line.includes("Runtime diagnostic signal") && line.includes("extra=")
        );

        expect(evidenceLines.length).toBeGreaterThan(0);
        expect(
          evidenceLines.some((line) =>
            line.includes('"signal":"runtime.startup_mode.resolved"') &&
            line.includes('"startupMode":"team"') &&
            line.includes('"active":true')
          )
        ).toBe(true);
        expect(
          evidenceLines.some((line) =>
            line.includes('"signal":"runtime.project_context.available"') &&
            line.includes('"mode":"team"')
          )
        ).toBe(true);
        expect(
          evidenceLines.some((line) =>
            line.includes('"signal":"runtime.command_registration.docs_lifecycle"') &&
            line.includes('"action":"not-gated"')
          )
        ).toBe(true);

        autoInitializeSpy.mockRestore();
        healthSpy.mockRestore();
        detectSpy.mockRestore();
      } finally {
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("registers /opencode-coder/init for a fresh inactive project and skips active startup management", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(
        savedModeResolution("not-enabled", "fresh")
      );
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(createProjectContext());

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();
      expect(cfg.default_agent).toBeUndefined();
      expect(hooks.tool?.coder).toBeUndefined();
      expect(autoInitializeSpy).not.toHaveBeenCalled();
      expect(healthSpy).not.toHaveBeenCalled();
      expect(detectSpy).not.toHaveBeenCalled();
      expect(
        mockInput.client.app.logs.some(
          (entry) => entry.message === "Project not explicitly enabled for active startup; exposing init entry point only"
        )
      ).toBe(true);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("keeps /opencode-coder/init available but suppresses active behavior for saved disabled mode", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(
        savedModeResolution("disabled")
      );
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(createProjectContext());

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();
      expect(cfg.default_agent).toBeUndefined();
      expect(hooks.tool?.coder).toBeUndefined();
      expect(autoInitializeSpy).not.toHaveBeenCalled();
      expect(healthSpy).not.toHaveBeenCalled();
      expect(detectSpy).not.toHaveBeenCalled();
      expect(mockInput.client.tui.toasts).toHaveLength(0);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("keeps docs lifecycle commands for active team mode when runtime resources are healthy", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(createProjectContext());

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const seededCommands = createPhase2CommandFixture();
      const cfg: Record<string, any> = { command: seededCommands };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toMatchObject({
        description: "resource-backed init",
        template: "resource init template",
      });
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.["opencode-coder/init-or-update-docs"]?.description).toBe("docs lifecycle");
      expect(cfg.command?.["opencode-coder/init-or-update-docs"]?.template).toBe("docs template");
      expect(cfg.command?.["opencode-coder/improve-doc"]?.description).toBe("incident improvement");
      expect(cfg.command?.["opencode-coder/improve-doc"]?.template).toBe("improve template");
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("keeps improve-doc in output config when runtime phase is normal and init-or-update-docs is absent", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({
          runtimePhase: {
            ...createProjectContext().runtimePhase,
            phase: "normal",
            shouldExposeBootstrapInit: false,
            missingRequiredSurfaces: [],
          },
        })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = {
        command: {
          "opencode-coder/init": {
            description: "resource-backed init",
            template: "resource init template",
          },
          "opencode-coder/improve-doc": {
            description: "incident improvement",
            template: "improve template",
          },
          [LEGACY_DOCS_COMMAND]: {
            description: "legacy docs command",
            template: "legacy template",
          },
        },
      };

      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/improve-doc"]).toBeDefined();
      expect(cfg.command?.["opencode-coder/improve-doc"]?.description).toBe("incident improvement");
      expect(cfg.command?.["opencode-coder/init-or-update-docs"]).toBeUndefined();
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("keeps docs lifecycle commands for active stealth mode when runtime resources are healthy", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("stealth"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({ mode: "stealth" })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const seededCommands = createPhase2CommandFixture();
      const cfg: Record<string, any> = { command: seededCommands };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toMatchObject({
        description: "resource-backed init",
        template: "resource init template",
      });
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.["opencode-coder/init-or-update-docs"]?.description).toBe("docs lifecycle");
      expect(cfg.command?.["opencode-coder/improve-doc"]?.description).toBe("incident improvement");
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("keeps docs lifecycle commands for active team mode even when runtime phase is bootstrap", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [{ id: "missing-docs-lifecycle-resource" }] },
        resourcesHealthy: false,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({
          beadsReady: false,
          aimgr: { ...createProjectContext().aimgr, resourcesHealthy: false },
          runtimePhase: {
            ...createProjectContext().runtimePhase,
            phase: "bootstrap",
            shouldExposeBootstrapInit: true,
            coreAvailable: false,
            bootstrapRequired: true,
            missingRequiredSurfaces: ["command/opencode-coder/init", "skill/coder-core"],
          },
        })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();
      expect(
        mockInput.client.app.logs.some(
          (entry) =>
            entry.message === "Runtime diagnostic signal" &&
            entry.extra?.["signal"] === "runtime.command_registration.docs_lifecycle" &&
            entry.extra?.["action"] === "not-gated"
        )
      ).toBe(true);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("uses runtime bootstrap /opencode-coder/init template in Phase 1 and keeps it interactive", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [{ id: "missing-skill" }] },
        resourcesHealthy: false,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({
          beadsReady: false,
          runtimePhase: {
            ...createProjectContext().runtimePhase,
            phase: "bootstrap",
            shouldExposeBootstrapInit: true,
            coreAvailable: false,
            bootstrapRequired: true,
            missingRequiredSurfaces: ["command/opencode-coder/init", "skill/coder-core"],
          },
        })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = { command: createPhase2CommandFixture() };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]?.template).toContain("question()");
      expect(cfg.command?.["opencode-coder/init"]?.template).toContain("restart/reopen OpenCode");
      expect(cfg.command?.["opencode-coder/init"]?.template).toContain("Manual equivalent path");
      expect(cfg.command?.["opencode-coder/init"]?.template).toContain("install package/coder-core");

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("keeps docs lifecycle commands for active stealth mode even when runtime phase is bootstrap", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("stealth"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [{ id: "missing-docs-lifecycle-resource" }] },
        resourcesHealthy: false,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({
          mode: "stealth",
          beadsReady: false,
          aimgr: { ...createProjectContext().aimgr, resourcesHealthy: false },
          runtimePhase: {
            ...createProjectContext().runtimePhase,
            phase: "bootstrap",
            shouldExposeBootstrapInit: true,
            coreAvailable: false,
            bootstrapRequired: true,
            missingRequiredSurfaces: ["command/opencode-coder/init", "skill/coder-core"],
          },
        })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();
      expect(
        mockInput.client.app.logs.some(
          (entry) =>
            entry.message === "Runtime diagnostic signal" &&
            entry.extra?.["signal"] === "runtime.command_registration.docs_lifecycle" &&
            entry.extra?.["action"] === "not-gated"
        )
      ).toBe(true);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("fully disables the plugin when the env hard override wins", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(
        savedModeResolution("hard-disabled", "env")
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));

      expect(hooks.tool).toBeUndefined();
      expect(hooks.config).toBeUndefined();

      resolveModeSpy.mockRestore();
    });

    it("migrates a legacy active project to explicit saved mode and keeps startup active", async () => {
      const worktree = mkdtempSync(join(tmpdir(), "opencode-coder-legacy-team-"));

      try {
        mkdirSync(join(worktree, ".coder"), { recursive: true });
        writeFileSync(join(worktree, ".coder", "project.yaml"), "mode: team\n", "utf-8");

        const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
        const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
          verifyResult: { status: "ok", issues: [] },
          resourcesHealthy: true,
          repairAttempted: false,
          repairSucceeded: false,
        });
        const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
          createProjectContext()
        );

        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
        const cfg: Record<string, unknown> = {};
        await hooks.config?.(cfg as any);

        expect(hooks.tool?.coder).toBeDefined();
        expect(cfg.default_agent).toBe("orchestrator");
        expect(existsSync(join(worktree, ".coder", "opencode-coder.yaml"))).toBe(true);
        expect(readFileSync(join(worktree, ".coder", "opencode-coder.yaml"), "utf-8")).toContain("mode: team");
        expect(autoInitializeSpy).toHaveBeenCalled();
        expect(healthSpy).toHaveBeenCalled();
        expect(detectSpy).toHaveBeenCalled();

        autoInitializeSpy.mockRestore();
        healthSpy.mockRestore();
        detectSpy.mockRestore();
      } finally {
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("sets default_agent to orchestrator when beads runtime is ready and no default exists", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(createProjectContext());

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = {};
      await hooks.config?.(cfg as any);

      expect(cfg.default_agent).toBe("orchestrator");

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("does not show readiness toast when default_agent assignment is skipped because default already exists", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(createProjectContext());

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = { default_agent: "some-other-agent" };
      await hooks.config?.(cfg as any);

      expect(cfg.default_agent).toBe("some-other-agent");
      expect(
        mockInput.client.app.logs.some((entry) => entry.message === "default_agent already configured, not overriding")
      ).toBe(true);
      expect(mockInput.client.tui.toasts).toHaveLength(0);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("does not show readiness toast when default_agent assignment is skipped because project context is unavailable", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockImplementation(() => {
        throw new Error("detector failed");
      });

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = {};
      await hooks.config?.(cfg as any);

      expect(cfg.default_agent).toBeUndefined();
      expect(
        mockInput.client.app.logs.some((entry) => entry.message === "Project context unavailable, not setting default_agent")
      ).toBe(true);
      expect(mockInput.client.tui.toasts).toHaveLength(0);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("shows readiness toast when default_agent assignment is skipped because beads runtime is not ready", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({ beadsReady: false })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = {};
      await hooks.config?.(cfg as any);

      expect(cfg.default_agent).toBeUndefined();
      expect(
        mockInput.client.app.logs.some(
            (entry) => entry.message === "beadsReady=false, not setting default_agent to orchestrator"
          )
        ).toBe(true);
      expect(mockInput.client.tui.toasts).toHaveLength(1);
      expect(mockInput.client.tui.toasts[0]).toMatchObject({
        title: "Orchestrator not enabled",
        variant: "warning",
      });

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("does not block config when readiness toast never resolves", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({ beadsReady: false })
      );

      const mockInput = createMockPluginInput();
      const showToastSpy = spyOn(mockInput.client.tui, "showToast").mockImplementation(
        () => new Promise<void>(() => {})
      );
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = {};

      await hooks.config?.(cfg as any);

      expect(cfg.default_agent).toBeUndefined();
      expect(showToastSpy).toHaveBeenCalledTimes(1);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("evaluates readiness after autoInitialize so config uses final state", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const order: string[] = [];
      let repaired = false;

      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockImplementation(async () => {
        order.push("autoInitialize");
        repaired = true;
      });
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockImplementation(async () => {
        order.push("verifyAndAutoRepairResources");
        return {
          verifyResult: { status: "ok", issues: [] },
          resourcesHealthy: repaired,
          repairAttempted: false,
          repairSucceeded: false,
        };
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockImplementation(() => {
        order.push("detectAndWrite");
        return createProjectContext({
          beadsReady: repaired,
          aimgr: { ...createProjectContext().aimgr, resourcesHealthy: repaired },
        });
      });

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = {};
      await hooks.config?.(cfg as any);

      expect(order).toEqual(["autoInitialize", "verifyAndAutoRepairResources", "detectAndWrite"]);
      expect(cfg.default_agent).toBe("orchestrator");
      expect(mockInput.client.tui.toasts).toHaveLength(0);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("degrades safely when aimgr is missing on PATH (partial tools: bd available)", async () => {
      const worktree = createActiveTeamWorktree("opencode-coder-aimgr-missing-", {
        withGit: true,
        withBeads: true,
      });

      // Mock boundary: external command execution is mocked; filesystem interactions use a real temp worktree.
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((command: string) => {
        if (command === "command -v bd") {
          return Buffer.from("/usr/bin/bd") as any;
        }

        if (command === "command -v aimgr") {
          const err = Object.assign(new Error("aimgr not found"), { code: "ENOENT" });
          throw err;
        }

        throw new Error(`Unexpected command in aimgr-missing integration test: ${command}`);
      });

      try {
        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
        const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
        await hooks.config?.(cfg as any);

        expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
        for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
          expect(cfg.command?.[commandName]).toBeDefined();
        }
        expect(cfg.default_agent).toBeUndefined();

        const context = readProjectContextFromWorktree(worktree);
        expect(context.aimgr.installed).toBe(false);
        expect(context.aimgr.resourcesHealthy).toBe(false);
        expect(context.beads.bdCliInstalled).toBe(true);
        expect(context.beadsReady).toBe(false);

        expect(
          mockInput.client.app.logs.some(
            (entry) =>
              entry.message === "Runtime diagnostic signal" &&
              entry.extra?.["signal"] === "runtime.project_context.available" &&
              entry.extra?.["resourcesHealthy"] === false
          )
        ).toBe(true);
        expect(
          mockInput.client.app.logs.some(
            (entry) =>
              entry.message === "Runtime diagnostic signal" &&
              entry.extra?.["signal"] === "runtime.command_registration.docs_lifecycle" &&
              entry.extra?.["action"] === "not-gated"
          )
        ).toBe(true);
      } finally {
        execSyncSpy.mockRestore();
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("handles execSync timeout on tool discovery without crashing startup", async () => {
      const worktree = createActiveTeamWorktree("opencode-coder-aimgr-timeout-", {
        withGit: true,
        withBeads: true,
      });

      // Mock boundary: external command execution is mocked; filesystem interactions use a real temp worktree.
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((command: string) => {
        if (command === "command -v bd") {
          return Buffer.from("/usr/bin/bd") as any;
        }

        if (command === "command -v aimgr") {
          throw createExecTimeoutError("aimgr discovery timed out");
        }

        throw new Error(`Unexpected command in timeout integration test: ${command}`);
      });

      try {
        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
        const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
        await hooks.config?.(cfg as any);

        expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
        expect(cfg.default_agent).toBeUndefined();
        expect(
          mockInput.client.app.logs.some(
            (entry) => entry.level === "warn" && entry.message === "aimgr availability check timed out"
          )
        ).toBe(true);
        expect(
          mockInput.client.app.logs.some(
            (entry) =>
              entry.message === "Runtime diagnostic signal" &&
              entry.extra?.["signal"] === "runtime.project_context.available"
          )
        ).toBe(true);
      } finally {
        execSyncSpy.mockRestore();
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("7rn regression: uses post-repair readiness before detection/config hook consumption", async () => {
      const worktree = createActiveTeamWorktree("opencode-coder-7rn-sequencing-", {
        withGit: true,
        withBeads: true,
      });

      const callOrder: string[] = [];
      let verifyCount = 0;

      // Mock boundary: external command execution is mocked; filesystem interactions use a real temp worktree.
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((command: string) => {
        callOrder.push(command);

        if (command === "command -v aimgr" || command === "command -v bd") {
          return Buffer.from("/usr/bin/tool") as any;
        }

        if (command === "aimgr init") {
          return Buffer.from("initialized") as any;
        }

        if (command === "aimgr repo list --format=json") {
          return JSON.stringify({ packages: [{ name: "coder-core" }] }) as any;
        }

        if (command === "aimgr install package/coder-core") {
          return Buffer.from("installed") as any;
        }

        if (command === "aimgr verify --format json") {
          verifyCount += 1;
          if (verifyCount === 1) {
            return JSON.stringify({ status: "ok", issues: [{ id: "missing-resource" }] }) as any;
          }
          return JSON.stringify({ status: "ok", issues: [] }) as any;
        }

        if (command === "aimgr repair --format json") {
          return JSON.stringify({ status: "ok", fixed: ["missing-resource"] }) as any;
        }

        throw new Error(`Unexpected command in 7rn sequencing integration test: ${command}`);
      });

      try {
        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
        const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
        await hooks.config?.(cfg as any);

        expect(verifyCount).toBe(2);
        const firstVerifyIndex = callOrder.indexOf("aimgr verify --format json");
        const repairIndex = callOrder.indexOf("aimgr repair --format json");
        const secondVerifyIndex = callOrder.findIndex((command, index) => command === "aimgr verify --format json" && index > firstVerifyIndex);
        expect(firstVerifyIndex).toBeGreaterThan(-1);
        expect(repairIndex).toBeGreaterThan(firstVerifyIndex);
        expect(secondVerifyIndex).toBeGreaterThan(repairIndex);

        const context = readProjectContextFromWorktree(worktree);
        expect(context.aimgr.resourcesHealthy).toBe(true);
        expect(cfg.default_agent).toBeUndefined();

        expect(
          mockInput.client.app.logs.some(
            (entry) => entry.message === "aimgr verify found resource issues, attempting automatic repair"
          )
        ).toBe(true);
        expect(mockInput.client.tui.toasts.some((toast) => toast.message.includes("auto-repair fixed resource issues"))).toBe(true);
      } finally {
        execSyncSpy.mockRestore();
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("detects partial availability when aimgr is present but bd is missing", async () => {
      const worktree = createActiveTeamWorktree("opencode-coder-partial-bd-missing-", {
        withGit: true,
        withBeads: true,
        withPackageYaml: true,
      });

      // Mock boundary: external command execution is mocked; filesystem interactions use a real temp worktree.
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((command: string) => {
        if (command === "command -v aimgr") {
          return Buffer.from("/usr/bin/aimgr") as any;
        }

        if (command === "command -v bd") {
          const err = Object.assign(new Error("bd not found"), { code: "ENOENT" });
          throw err;
        }

        if (command === "aimgr verify --format json") {
          return JSON.stringify({ status: "ok", issues: [] }) as any;
        }

        throw new Error(`Unexpected command in partial-availability integration test: ${command}`);
      });

      try {
        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
        const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
        await hooks.config?.(cfg as any);

        const context = readProjectContextFromWorktree(worktree);
        expect(context.aimgr.installed).toBe(true);
        expect(context.beads.bdCliInstalled).toBe(false);
        expect(context.beadsReady).toBe(false);
        expect(cfg.default_agent).toBeUndefined();

        expect(
          mockInput.client.app.logs.some(
            (entry) =>
              entry.message === "Runtime diagnostic signal" &&
              entry.extra?.["signal"] === "runtime.project_context.available" &&
              entry.extra?.["beadsReady"] === false &&
              entry.extra?.["resourcesHealthy"] === true
          )
        ).toBe(true);
      } finally {
        execSyncSpy.mockRestore();
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("skips runtime bootstrap when manual Phase 2 surfaces exist without ai.package.yaml", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const classifySpy = spyOn(ProjectDetectorService.prototype, "classifyRuntimePhase").mockReturnValue({
        phase: "normal",
        coreAvailable: true,
        bootstrapRequired: false,
        missingRequiredSurfaces: [],
        shouldExposeBootstrapInit: false,
      });
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({
          beadsReady: false,
          aimgr: {
            installed: true,
            packageYaml: false,
            resourcesHealthy: false,
          },
        })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = { command: createPhase2CommandFixture() };
      await hooks.config?.(cfg as any);

      expect(autoInitializeSpy).not.toHaveBeenCalled();
      expect(healthSpy).not.toHaveBeenCalled();
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.["opencode-coder/init"]).toMatchObject({
        description: "resource-backed init",
        template: "resource init template",
      });
      expect(
        mockInput.client.app.logs.some(
          (entry) => entry.message === "Runtime phase already normal from required resource surfaces; skipping startup bootstrap"
        )
      ).toBe(true);

      resolveModeSpy.mockRestore();
      classifySpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("degrades safely when config hook times out waiting on startup context", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockImplementation(
        () => new Promise<void>(() => {})
      );
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(createProjectContext());

      const originalSetTimeout = globalThis.setTimeout;
      const originalClearTimeout = globalThis.clearTimeout;
      globalThis.setTimeout = ((cb: (...args: any[]) => void) => {
        cb();
        return 1 as any;
      }) as typeof setTimeout;
      globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;

      try {
        const mockInput = createMockPluginInput();
        const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
        const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
        await hooks.config?.(cfg as any);

        expect(cfg.default_agent).toBeUndefined();
        expect(cfg.command).toBeDefined();
        expect((cfg.command as Record<string, unknown>)["opencode-coder/init"]).toBeDefined();
        for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
          expect((cfg.command as Record<string, unknown>)[commandName]).toBeDefined();
        }
        expect(
          mockInput.client.app.logs.some(
            (entry) => entry.level === "warn" && entry.message === "Project context startup timed out; continuing in degraded mode"
          )
        ).toBe(true);
        expect(
          mockInput.client.app.logs.some(
            (entry) =>
              entry.message === "Runtime diagnostic signal" &&
              entry.extra?.["signal"] === "runtime.project_context.timeout" &&
              entry.extra?.["degradedMode"] === true
          )
        ).toBe(true);
      } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
      }

      expect(healthSpy).not.toHaveBeenCalled();
      expect(detectSpy).not.toHaveBeenCalled();

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });
  });
});
