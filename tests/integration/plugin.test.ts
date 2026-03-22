import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { OpencodeCoder } from "../../src";
import { AimgrService, BeadsService, PluginModeService, ProjectDetectorService } from "../../src/service";
import type { PluginModeResolution, ProjectContext } from "../../src/service";
import { createMockPluginInput, asMockPluginInput } from "../helpers/mock-client";

function createProjectContext(overrides?: Partial<ProjectContext>): ProjectContext {
  return {
    mode: "team",
    installReady: true,
    ecosystemReady: true,
    git: { initialized: true },
    beads: {
      initialized: true,
      stealthMode: false,
      bdCliInstalled: true,
    },
    aimgr: {
      installed: true,
      packageYaml: true,
      resourcesHealthy: true,
      coderPackageInstalled: true,
    },
    pluginVersion: "1.0.0",
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

const DOCS_LIFECYCLE_COMMANDS = ["opencode-coder/docs", "opencode-coder/improve-doc"] as const;
const LEGACY_DOCS_COMMAND = "opencode-coder/update-agent-md";

function createLifecycleCommandFixture() {
  return {
    "opencode-coder/docs": {
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
        expect(cfg.command?.[commandName]).toBeUndefined();
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
        expect(cfg.command?.[commandName]).toBeUndefined();
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
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({ ecosystemReady: true })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const seededCommands = createLifecycleCommandFixture();
      const cfg: Record<string, any> = { command: seededCommands };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.["opencode-coder/docs"]?.description).toBe(
        "Inspect, bootstrap, refresh, audit, and verify project docs lifecycle"
      );
      expect(cfg.command?.["opencode-coder/docs"]?.template).toContain("references/project-docs-lifecycle.md");
      expect(cfg.command?.["opencode-coder/improve-doc"]?.description).toBe(
        "Turn a documentation/routing incident into targeted recurrence-prevention updates"
      );
      expect(cfg.command?.["opencode-coder/improve-doc"]?.template).toContain("incident-improvement section");
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
        createProjectContext({ mode: "stealth", ecosystemReady: true })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const seededCommands = createLifecycleCommandFixture();
      const cfg: Record<string, any> = { command: seededCommands };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeDefined();
      }
      expect(cfg.command?.["opencode-coder/docs"]?.description).toBe(
        "Inspect, bootstrap, refresh, audit, and verify project docs lifecycle"
      );
      expect(cfg.command?.["opencode-coder/improve-doc"]?.description).toBe(
        "Turn a documentation/routing incident into targeted recurrence-prevention updates"
      );
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("suppresses docs lifecycle commands for active team mode when runtime resources are unavailable", async () => {
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
          ecosystemReady: false,
          aimgr: { ...createProjectContext().aimgr, resourcesHealthy: false },
        })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeUndefined();
      }
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();
      expect(
        mockInput.client.app.logs.some(
          (entry) => entry.message === "Docs lifecycle commands not registered because runtime resources are unavailable"
        )
      ).toBe(true);

      resolveModeSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("suppresses docs lifecycle commands for active stealth mode when runtime resources are unavailable", async () => {
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
          ecosystemReady: false,
          aimgr: { ...createProjectContext().aimgr, resourcesHealthy: false },
        })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = { command: createLifecycleCommandFixture() };
      await hooks.config?.(cfg as any);

      expect(cfg.command?.["opencode-coder/init"]).toBeDefined();
      for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
        expect(cfg.command?.[commandName]).toBeUndefined();
      }
      expect(cfg.command?.[LEGACY_DOCS_COMMAND]).toBeUndefined();
      expect(
        mockInput.client.app.logs.some(
          (entry) => entry.message === "Docs lifecycle commands not registered because runtime resources are unavailable"
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
          createProjectContext({ ecosystemReady: true })
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

    it("sets default_agent to orchestrator when ecosystem is ready and no default exists", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({ ecosystemReady: true })
      );

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
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({ ecosystemReady: true })
      );

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

    it("shows readiness toast when default_agent assignment is skipped because ecosystem is not ready", async () => {
      const resolveModeSpy = spyOn(PluginModeService.prototype, "resolveStartupMode").mockReturnValue(savedModeResolution("team"));
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({ ecosystemReady: false })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = {};
      await hooks.config?.(cfg as any);

      expect(cfg.default_agent).toBeUndefined();
      expect(
        mockInput.client.app.logs.some(
          (entry) => entry.message === "ecosystemReady=false, not setting default_agent to orchestrator"
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
        createProjectContext({ ecosystemReady: false })
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
          ecosystemReady: repaired,
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

    it("degrades safely when project context startup times out", async () => {
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
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockReturnValue(
        createProjectContext({ ecosystemReady: true })
      );

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
        const cfg: Record<string, unknown> = {};
        await hooks.config?.(cfg as any);

        expect(cfg.default_agent).toBeUndefined();
        expect(cfg.command).toBeDefined();
        expect((cfg.command as Record<string, unknown>)["opencode-coder/init"]).toBeDefined();
        expect(
          mockInput.client.app.logs.some(
            (entry) => entry.level === "warn" && entry.message === "Project context startup timed out; continuing in degraded mode"
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
