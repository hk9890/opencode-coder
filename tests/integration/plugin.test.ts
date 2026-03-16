import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { OpencodeCoder } from "../../src";
import { AimgrService, BeadsService, ProjectDetectorService } from "../../src/service";
import type { ProjectContext } from "../../src/service/project-detector-service";
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

    it("should provide tool hook with coder tool", async () => {
      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      expect(hooks.tool).toBeDefined();
      expect(hooks.tool?.coder).toBeDefined();
    });

    it("no-.coder startup regression: does not create .coder or ai.package.yaml", async () => {
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

    it("replays early startup logs into .coder/logs when project already opted in", async () => {
      const worktree = mkdtempSync(join(tmpdir(), "opencode-coder-with-coder-"));

      try {
        mkdirSync(join(worktree, ".coder"), { recursive: true });

        const mockInput = createMockPluginInput({ worktree, directory: worktree });
        await OpencodeCoder(asMockPluginInput(mockInput));

        const today = new Date().toISOString().slice(0, 10);
        const logPath = join(worktree, ".coder", "logs", `coder-${today}.log`);
        const logContent = readFileSync(logPath, "utf8");

        expect(logContent).toContain("OpencodeCoder plugin loading...");
        expect(logContent).toContain("OpencodeCoder plugin loaded");

        const loadingIndex = logContent.indexOf("OpencodeCoder plugin loading...");
        const loadedIndex = logContent.indexOf("OpencodeCoder plugin loaded");

        expect(loadingIndex).toBeGreaterThanOrEqual(0);
        expect(loadedIndex).toBeGreaterThan(loadingIndex);
      } finally {
        rmSync(worktree, { recursive: true, force: true });
      }
    });

    it("registers /init even when .coder is absent and skips startup project management", async () => {
      const detectCoderDirSpy = spyOn(ProjectDetectorService.prototype, "detectCoderDirectory").mockReturnValue(false);
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockResolvedValue(createProjectContext());

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, any> = {};
      await hooks.config?.(cfg as any);

      expect(cfg.command?.init).toBeDefined();
      expect(cfg.default_agent).toBeUndefined();
      expect(autoInitializeSpy).not.toHaveBeenCalled();
      expect(healthSpy).not.toHaveBeenCalled();
      expect(detectSpy).not.toHaveBeenCalled();
      expect(
        mockInput.client.app.logs.some(
          (entry) => entry.message === ".coder directory not found, skipping startup project management"
        )
      ).toBe(true);

      detectCoderDirSpy.mockRestore();
      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
    });

    it("sets default_agent to orchestrator when ecosystem is ready and no default exists", async () => {
      const detectCoderDirSpy = spyOn(ProjectDetectorService.prototype, "detectCoderDirectory").mockReturnValue(true);
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockResolvedValue(
        createProjectContext({ ecosystemReady: true })
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = {};
      await hooks.config?.(cfg as any);

      expect(cfg.default_agent).toBe("orchestrator");

      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
      detectCoderDirSpy.mockRestore();
    });

    it("does not show readiness toast when default_agent assignment is skipped because default already exists", async () => {
      const detectCoderDirSpy = spyOn(ProjectDetectorService.prototype, "detectCoderDirectory").mockReturnValue(true);
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockResolvedValue(
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

      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
      detectCoderDirSpy.mockRestore();
    });

    it("does not show readiness toast when default_agent assignment is skipped because project context is unavailable", async () => {
      const detectCoderDirSpy = spyOn(ProjectDetectorService.prototype, "detectCoderDirectory").mockReturnValue(true);
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockRejectedValue(
        new Error("detector failed")
      );

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = {};
      await hooks.config?.(cfg as any);

      expect(cfg.default_agent).toBeUndefined();
      expect(
        mockInput.client.app.logs.some((entry) => entry.message === "Project context unavailable, not setting default_agent")
      ).toBe(true);
      expect(mockInput.client.tui.toasts).toHaveLength(0);

      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
      detectCoderDirSpy.mockRestore();
    });

    it("shows readiness toast when default_agent assignment is skipped because ecosystem is not ready", async () => {
      const detectCoderDirSpy = spyOn(ProjectDetectorService.prototype, "detectCoderDirectory").mockReturnValue(true);
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockResolvedValue(
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
      expect(mockInput.client.tui.toasts[0]?.message).toContain("not fully ready yet");

      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
      detectCoderDirSpy.mockRestore();
    });

    it("does not block config when readiness toast never resolves", async () => {
      const detectCoderDirSpy = spyOn(ProjectDetectorService.prototype, "detectCoderDirectory").mockReturnValue(true);
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockResolvedValue(undefined);
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockResolvedValue(
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
      expect(
        mockInput.client.app.logs.some(
          (entry) => entry.message === "ecosystemReady=false, not setting default_agent to orchestrator"
        )
      ).toBe(true);

      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
      detectCoderDirSpy.mockRestore();
    });

    it("evaluates readiness after autoInitialize so config uses final state", async () => {
      const detectCoderDirSpy = spyOn(ProjectDetectorService.prototype, "detectCoderDirectory").mockReturnValue(true);
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
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockImplementation(async () => {
        order.push("detectAndWrite");
        return createProjectContext({ ecosystemReady: repaired, aimgr: { ...createProjectContext().aimgr, resourcesHealthy: repaired } });
      });

      const mockInput = createMockPluginInput();
      const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
      const cfg: Record<string, unknown> = {};
      await hooks.config?.(cfg as any);

      expect(order).toEqual(["autoInitialize", "verifyAndAutoRepairResources", "detectAndWrite"]);
      expect(cfg.default_agent).toBe("orchestrator");
      expect(mockInput.client.tui.toasts).toHaveLength(0);

      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
      detectCoderDirSpy.mockRestore();
    });

    it("degrades safely when project context startup times out", async () => {
      const detectCoderDirSpy = spyOn(ProjectDetectorService.prototype, "detectCoderDirectory").mockReturnValue(true);
      const autoInitializeSpy = spyOn(AimgrService.prototype, "autoInitialize").mockImplementation(
        () => new Promise<void>(() => {})
      );
      const healthSpy = spyOn(AimgrService.prototype, "verifyAndAutoRepairResources").mockResolvedValue({
        verifyResult: { status: "ok", issues: [] },
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      });
      const detectSpy = spyOn(ProjectDetectorService.prototype, "detectAndWrite").mockResolvedValue(
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
        expect((cfg.command as Record<string, unknown>).init).toBeDefined();
        expect(
          mockInput.client.app.logs.some(
            (entry) => entry.level === "warn" && entry.message === "Project context startup timed out; continuing in degraded mode"
          )
        ).toBe(true);
      } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
      }

      // Timeout happened before startup flow completed
      expect(healthSpy).not.toHaveBeenCalled();
      expect(detectSpy).not.toHaveBeenCalled();

      autoInitializeSpy.mockRestore();
      healthSpy.mockRestore();
      detectSpy.mockRestore();
      detectCoderDirSpy.mockRestore();
    });
  });
});
