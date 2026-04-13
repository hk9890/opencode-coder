import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
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
          verify: { available: true, healthy: true, hasIssues: false },
          repair: { attempted: false, healthy: false },
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

    it("canonical startup: inactive/init-only mode exposes bootstrap init and skips active startup flow", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(
        savedModeResolution("not-enabled", "fresh")
      );
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verify: { available: true, healthy: true, hasIssues: false },
        repair: { attempted: false, healthy: false },
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

    it("canonical startup: active bootstrap mode preserves docs commands and keeps interactive bootstrap init", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verify: { available: true, healthy: false, hasIssues: true },
        repair: { attempted: false, healthy: false },
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
      const cfg: Record<string, any> = { command: createPhase2CommandFixture() };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
      expect(cfg.command?.["opencode-coder/init"]?.template).toContain("question()");
      expect(cfg.command?.["opencode-coder/init"]?.template).toContain("Manual equivalent path");
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();
      expect(cfg.default_agent).toBeUndefined();
      expect(hooks.tool?.coder).toBeDefined();
      expect(autoInitializeSpy).toHaveBeenCalled();
      expect(healthSpy).toHaveBeenCalled();
      expect(detectSpy).toHaveBeenCalled();
      expect(
        mockInput.client.app.logs.some(
          (entry) =>
            entry.message === "beadsReady=false, not setting default_agent to orchestrator" &&
            entry.extra?.["beadsInitialized"] === true &&
            entry.extra?.["bdCliInstalled"] === true &&
            entry.extra?.["coderBeadsSkillAvailable"] === true &&
            entry.extra?.["orchestratorAgentAvailable"] === true &&
            Array.isArray(entry.extra?.["missingBeadsReadinessRequirements"])
        )
      ).toBe(true);
      expect(mockInput.client.tui.toasts).toHaveLength(1);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("logs missing readiness requirements when orchestrator is not made default", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verify: { available: true, healthy: true, hasIssues: false },
        repair: { attempted: false, healthy: false },
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({
          beadsReady: false,
          beads: {
            initialized: false,
            stealthMode: false,
            bdCliInstalled: false,
            coderBeadsSkillAvailable: true,
            orchestratorAgentAvailable: false,
          },
        })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = { command: createPhase2CommandFixture() };
      await hooks.config?.(cfg as any);

      const readinessLog = mockInput.client.app.logs.find(
        (entry) => entry.message === "beadsReady=false, not setting default_agent to orchestrator"
      );

      expect(readinessLog).toBeDefined();
      expect(readinessLog?.extra).toEqual({
        beadsReady: false,
        beadsInitialized: false,
        bdCliInstalled: false,
        coderBeadsSkillAvailable: true,
        orchestratorAgentAvailable: false,
        missingBeadsReadinessRequirements: ["agent/orchestrator", "bd-cli", ".beads"],
      });
      expect(cfg.default_agent).toBeUndefined();

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("canonical startup: active normal mode with beads ready enables default orchestrator", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verify: { available: true, healthy: true, hasIssues: false },
        repair: { attempted: false, healthy: false },
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(createProjectContext());

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const seededCommands = createPhase2CommandFixture();
      const cfg: Record<string, any> = { command: seededCommands };
      await hooks.config?.(cfg as any);

      expect(hooks.tool?.coder).toBeDefined();
      expect(cfg.default_agent).toBe("orchestrator");
      expect(
        mockInput.client.app.logs.some(
          (entry) =>
            entry.message === "Set default_agent to orchestrator (beads ready)" &&
            entry.extra?.["beadsReady"] === true &&
            entry.extra?.["beadsInitialized"] === true &&
            entry.extra?.["bdCliInstalled"] === true &&
            entry.extra?.["coderBeadsSkillAvailable"] === true &&
            entry.extra?.["orchestratorAgentAvailable"] === true &&
            Array.isArray(entry.extra?.["missingBeadsReadinessRequirements"]) &&
            (entry.extra?.["missingBeadsReadinessRequirements"] as unknown[]).length === 0
        )
      ).toBe(true);
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

    it("preserves stealth .coder/AGENTS.md instruction injection", async () => {
      const worktree = mkdtempSync(join(tmpdir(), "opencode-coder-stealth-agents-injection-"));

      try {
        mkdirSync(join(worktree, ".coder"), { recursive: true });
        writeFileSync(join(worktree, ".coder", "opencode-coder.yaml"), "mode: stealth\n", "utf-8");
        writeFileSync(join(worktree, ".coder", "AGENTS.md"), "# stealth instructions\n", "utf-8");

        const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
          createProjectContext({ mode: "stealth" })
        );

        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
        const cfg: Record<string, unknown> = { instructions: [] };
        await hooks.config?.(cfg as any);

        expect(Array.isArray(cfg.instructions)).toBe(true);
        expect((cfg.instructions as string[]).includes(".coder/AGENTS.md")).toBe(true);

        detectSpy.mockRestore();
      } finally {
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("canonical startup: degraded timeout keeps plugin config responsive with bootstrap fallback", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockImplementation(
        () => new Promise<void>(() => {})
      );
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verify: { available: true, healthy: true, hasIssues: false },
        repair: { attempted: false, healthy: false },
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

    it("uses runtime bootstrap /opencode-coder/init template in Phase 1 and keeps it interactive", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verify: { available: true, healthy: false, hasIssues: true },
        repair: { attempted: false, healthy: false },
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
        verify: { available: true, healthy: false, hasIssues: true },
        repair: { attempted: false, healthy: false },
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
          verify: { available: true, healthy: true, hasIssues: false },
          repair: { attempted: false, healthy: false },
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
  });
});
