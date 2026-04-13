import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { AimgrService } from "../../../src/service/aimgr-service";
import type { Logger } from "../../../src/core/logger";

describe("AimgrService", () => {
  let mockLogger: Logger;
  let mockClient: any;
  let aimgrService: AimgrService;

  // We'll mock these at the method level, not module level
  let execSyncMock: any;
  let existsSyncMock: any;

  beforeEach(async () => {
    // Create mock logger
    mockLogger = {
      debug: mock(),
      info: mock(),
      warn: mock(),
      error: mock(),
      enableFileLogging: mock(),
    } as unknown as Logger;

    // Create mock client with TUI
    mockClient = {
      tui: {
        showToast: mock().mockResolvedValue(undefined),
      },
    };

    // Import and mock the modules dynamically
    const childProcess = await import("child_process");
    const fs = await import("fs");
    
    execSyncMock = spyOn(childProcess, "execSync");
    existsSyncMock = spyOn(fs, "existsSync");
  });

  afterEach(() => {
    execSyncMock.mockRestore();
    existsSyncMock.mockRestore();
  });

  describe("constructor", () => {
    it("should create AimgrService with default workdir", () => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
      });

      expect(aimgrService).toBeDefined();
    });

    it("should create AimgrService with custom workdir", () => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
        workdir: "/custom/path",
      });

      expect(aimgrService).toBeDefined();
    });
  });

  describe("isAimgrAvailable", () => {
    beforeEach(() => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
      });
    });

    it("should return true when aimgr is available", () => {
      execSyncMock.mockReturnValue(Buffer.from("/usr/bin/aimgr"));

      const result = aimgrService.isAimgrAvailable();

      expect(result).toBe(true);
      expect(execSyncMock).toHaveBeenCalledWith("command -v aimgr", {
        stdio: "ignore",
        timeout: 5000,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith("aimgr CLI is available");
    });

    it("should return false when aimgr is not available", () => {
      execSyncMock.mockImplementation(() => {
        throw new Error("command not found");
      });

      const result = aimgrService.isAimgrAvailable();

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith("aimgr CLI not found on PATH");
    });

    it("should return false and log timeout details when availability check times out", () => {
      execSyncMock.mockImplementation(() => {
        const timeoutError = new Error("timed out") as Error & { killed: boolean; signal: string };
        timeoutError.killed = true;
        timeoutError.signal = "SIGTERM";
        throw timeoutError;
      });

      const result = aimgrService.isAimgrAvailable();

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith("aimgr availability check timed out", {
        command: "command -v aimgr",
        timeoutMs: 5000,
      });
      expect(mockLogger.debug).not.toHaveBeenCalledWith("aimgr CLI not found on PATH");
    });

    it("should cache the availability result for the service lifetime", () => {
      execSyncMock.mockReturnValue(Buffer.from("/usr/bin/aimgr"));

      expect(aimgrService.isAimgrAvailable()).toBe(true);
      expect(aimgrService.isAimgrAvailable()).toBe(true);

      expect(execSyncMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("hasPackageYaml", () => {
    beforeEach(() => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
        workdir: "/test/path",
      });
    });

    it("should return true when ai.package.yaml exists", () => {
      existsSyncMock.mockReturnValue(true);

      const result = aimgrService.hasPackageYaml();

      expect(result).toBe(true);
      expect(existsSyncMock).toHaveBeenCalledWith("/test/path/ai.package.yaml");
    });

    it("should return false when ai.package.yaml does not exist", () => {
      existsSyncMock.mockReturnValue(false);

      const result = aimgrService.hasPackageYaml();

      expect(result).toBe(false);
      expect(existsSyncMock).toHaveBeenCalledWith("/test/path/ai.package.yaml");
    });
  });

  describe("initializeAimgr", () => {
    beforeEach(() => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
        workdir: "/test/path",
      });
    });

    it("should successfully run aimgr init", () => {
      execSyncMock.mockReturnValue(Buffer.from("Initialized"));

      aimgrService.initializeAimgr();

      expect(execSyncMock).toHaveBeenCalledWith("aimgr init", {
        cwd: "/test/path",
        stdio: "ignore",
        timeout: 10000,
      });
      expect(mockLogger.info).toHaveBeenCalledWith("aimgr init completed successfully");
    });

    it("should throw error when aimgr init fails", () => {
      execSyncMock.mockImplementation(() => {
        throw new Error("init failed");
      });

      expect(() => aimgrService.initializeAimgr()).toThrow("init failed");
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("isPackageAvailable", () => {
    beforeEach(() => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
      });
    });

    it("should return true when package exists", () => {
      const mockOutput = JSON.stringify({
        packages: [
          { name: "coder-core" },
          { name: "other-package" },
        ],
      });

      execSyncMock.mockReturnValue(mockOutput);

      const result = aimgrService.isPackageAvailable("coder-core");

      expect(result).toBe(true);
      expect(execSyncMock).toHaveBeenCalledWith("aimgr repo list --format=json", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      });
    });

    it("should return false when package does not exist", () => {
      const mockOutput = JSON.stringify({
        packages: [
          { name: "other-package" },
        ],
      });

      execSyncMock.mockReturnValue(mockOutput);

      const result = aimgrService.isPackageAvailable("coder-core");

      expect(result).toBe(false);
    });

    it("should return false when aimgr repo list fails", () => {
      execSyncMock.mockImplementation(() => {
        throw new Error("command failed");
      });

      const result = aimgrService.isPackageAvailable("coder-core");

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("installPackage", () => {
    beforeEach(() => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
        workdir: "/test/path",
      });
    });

    it("should successfully install package", () => {
      execSyncMock.mockReturnValue(Buffer.from("Installed"));

      aimgrService.installPackage("coder-core");

      expect(execSyncMock).toHaveBeenCalledWith("aimgr install package/coder-core", {
        cwd: "/test/path",
        stdio: "ignore",
        timeout: 10000,
      });
      expect(mockLogger.info).toHaveBeenCalledWith("Package installed successfully", { packageName: "coder-core" });
    });

    it("should throw error when install fails", () => {
      execSyncMock.mockImplementation(() => {
        throw new Error("install failed");
      });

      expect(() => aimgrService.installPackage("coder-core")).toThrow("install failed");
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("verifyAndAutoRepairResources", () => {
    beforeEach(() => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
        workdir: "/test/path",
      });
    });

    it("should return healthy without repair when verify is healthy", async () => {
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return Buffer.from("/usr/bin/aimgr");
        if (cmd === "aimgr verify --format json") {
          return JSON.stringify({ status: "ok", issues: [] });
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const result = await aimgrService.verifyAndAutoRepairResources();

      expect(result).toEqual({
        verify: {
          available: true,
          healthy: true,
          hasIssues: false,
        },
        repair: {
          attempted: false,
          healthy: false,
        },
      });
      expect(execSyncMock).not.toHaveBeenCalledWith("aimgr repair --format json", expect.anything());
      expect(mockClient.tui.showToast).not.toHaveBeenCalled();
    });

    it("should repair and return healthy when verify is unhealthy then repair succeeds", async () => {
      let verifyCalls = 0;
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return Buffer.from("/usr/bin/aimgr");
        if (cmd === "aimgr verify --format json") {
          verifyCalls += 1;
          if (verifyCalls === 1) {
            return JSON.stringify({ status: "degraded", issues: [{ id: "missing-resource" }] });
          }
          return JSON.stringify({ status: "ok", issues: [] });
        }
        if (cmd === "aimgr repair --format json") {
          return JSON.stringify({ status: "ok", repaired: 1 });
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const result = await aimgrService.verifyAndAutoRepairResources();

      expect(result).toEqual({
        verify: {
          available: true,
          healthy: true,
          hasIssues: false,
        },
        repair: {
          attempted: true,
          healthy: true,
        },
      });
      expect(mockClient.tui.showToast).toHaveBeenCalledWith({
        title: "aimgr",
        message: "aimgr auto-repair fixed resource issues.",
        variant: "success",
        duration: 7000,
      });
    });

    it("should report failed repair when verify remains unhealthy after repair attempt", async () => {
      let verifyCalls = 0;
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return Buffer.from("/usr/bin/aimgr");
        if (cmd === "aimgr verify --format json") {
          verifyCalls += 1;
          return JSON.stringify({ status: "degraded", issues: [{ id: `issue-${verifyCalls}` }] });
        }
        if (cmd === "aimgr repair --format json") {
          throw new Error("repair failed");
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const result = await aimgrService.verifyAndAutoRepairResources();

      expect(result).toEqual({
        verify: {
          available: true,
          healthy: false,
          hasIssues: true,
        },
        repair: {
          attempted: true,
          healthy: false,
        },
      });
      expect(mockClient.tui.showToast).toHaveBeenCalledWith({
        title: "aimgr",
        message: "aimgr auto-repair was attempted, but issues remain. Run /opencode-coder/doctor for details.",
        variant: "warning",
        duration: 8000,
      });
    });
  });

  describe("timeout handling", () => {
    beforeEach(() => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
        workdir: "/test/path",
      });
    });

    it("should return null when aimgr verify times out", () => {
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return Buffer.from("/usr/bin/aimgr");

        const timeoutError = new Error("Command timed out") as Error & { killed: boolean; signal: string };
        timeoutError.killed = true;
        timeoutError.signal = "SIGTERM";
        throw timeoutError;
      });

      const result = aimgrService.verifyResources();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to run aimgr verify",
        expect.objectContaining({
          error: expect.any(String),
          command: "aimgr verify --format json",
          timeoutMs: 10000,
        })
      );
    });
  });

  describe("autoInitialize", () => {
    beforeEach(() => {
      aimgrService = new AimgrService({
        logger: mockLogger,
        client: mockClient,
        workdir: "/test/path",
      });
    });

    it("should skip when ai.package.yaml already exists", async () => {
      existsSyncMock.mockReturnValue(true);

      await aimgrService.autoInitialize();

      expect(mockLogger.debug).toHaveBeenCalledWith("ai.package.yaml already exists, skipping auto-initialization");
      expect(execSyncMock).not.toHaveBeenCalled();
    });

    it("should skip when aimgr is not available", async () => {
      existsSyncMock.mockReturnValue(false);
      execSyncMock.mockImplementation(() => {
        throw new Error("not found");
      });

      await aimgrService.autoInitialize();

      expect(mockLogger.debug).toHaveBeenCalledWith("aimgr not available, skipping auto-initialization");
    });

    it("should initialize and install when package is available", async () => {
      existsSyncMock.mockReturnValue(false);

      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") {
          return Buffer.from("/usr/bin/aimgr");
        } else if (cmd === "aimgr init") {
          return Buffer.from("Initialized");
        } else if (cmd === "aimgr repo list --format=json") {
          return JSON.stringify({ packages: [{ name: "coder-core" }] });
        } else if (cmd === "aimgr install package/coder-core") {
          return Buffer.from("Installed");
        }
        return Buffer.from("");
      });

      await aimgrService.autoInitialize();

      expect(mockClient.tui.showToast).toHaveBeenCalledWith({
        title: "aimgr Initialized",
        message: "Detected aimgr and installed coder-core package",
        variant: "success",
        duration: 6000,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "aimgr auto-initialization completed",
        expect.objectContaining({ durationMs: expect.any(Number) })
      );
    });

    it("should show info toast when package is not available", async () => {
      existsSyncMock.mockReturnValue(false);

      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") {
          return Buffer.from("/usr/bin/aimgr");
        } else if (cmd === "aimgr init") {
          return Buffer.from("Initialized");
        } else if (cmd === "aimgr repo list --format=json") {
          return JSON.stringify({ packages: [] });
        }
        return Buffer.from("");
      });

      await aimgrService.autoInitialize();

      expect(mockClient.tui.showToast).toHaveBeenCalledWith({
        title: "aimgr Initialized",
        message: "Created ai.package.yaml. Run 'aimgr repo search coder-core' to discover resources.",
        variant: "info",
        duration: 6000,
      });
    });

    it("should catch and log errors without throwing", async () => {
      existsSyncMock.mockReturnValue(false);

      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") {
          return Buffer.from("/usr/bin/aimgr");
        } else if (cmd === "aimgr init") {
          throw new Error("init failed");
        }
        return Buffer.from("");
      });

      // Should not throw
      await expect(aimgrService.autoInitialize()).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "aimgr auto-initialization failed",
        expect.objectContaining({ error: expect.any(String), durationMs: expect.any(Number) })
      );
    });
  });
});
