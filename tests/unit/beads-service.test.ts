import { describe, expect, it, beforeEach, spyOn } from "bun:test";
import { BeadsService } from "../../src/service/beads-service";
import type { PluginInput } from "@opencode-ai/plugin";
import { createMockLogger, type MockLogger } from "../helpers/mock-logger";
import { createMockClient } from "../helpers/mock-client";
import * as core from "../../src/core";
import * as childProcess from "child_process";
import * as fs from "fs";
import { join } from "path";

type OpencodeClient = PluginInput["client"];

interface ToastCall {
  title?: string;
  message?: string;
  variant?: string;
  duration?: number;
}

describe("BeadsService", () => {
  let mockLogger: MockLogger;
  let mockClient: OpencodeClient;
  let toastCalls: ToastCall[];

  beforeEach(() => {
    mockLogger = createMockLogger();
    toastCalls = [];

    // Create mock client with tui.showToast
    const baseMockClient = createMockClient();
    mockClient = {
      ...baseMockClient,
      tui: {
        showToast: async (params: ToastCall) => {
          toastCalls.push(params);
          return { data: true };
        },
      },
    } as unknown as OpencodeClient;
  });

  describe("Init workflow routing (coder-beads)", () => {
    it("keeps SKILL.md concise and routes detailed init contract to reference docs", () => {
      const skillPath = join(import.meta.dir, "..", "..", "ai-resources", "skills", "coder-beads", "SKILL.md");
      const referencePath = join(
        import.meta.dir,
        "..",
        "..",
        "ai-resources",
        "skills",
        "coder-beads",
        "references",
        "beads-init.md"
      );
      const skill = fs.readFileSync(skillPath, "utf-8");
      const reference = fs.readFileSync(referencePath, "utf-8");

      expect(skill).toContain("references/beads-init.md");
      expect(skill).not.toContain("### `skill-init:beads`");

      expect(reference).toContain("stealth");
      expect(reference).toContain("team");
      expect(reference).toContain("bd doctor");
      expect(reference).toContain("Only do the missing or corrective setup steps");
    });
  });

  describe("isBeadsEnabled", () => {
    it("should return true when beads is enabled", () => {
      const service = new BeadsService({
        logger: mockLogger,
        client: mockClient,
        beadsEnabled: true,
      });

      expect(service.isBeadsEnabled()).toBe(true);
    });

    it("should return false when beads is disabled", () => {
      const service = new BeadsService({
        logger: mockLogger,
        client: mockClient,
        beadsEnabled: false,
      });

      expect(service.isBeadsEnabled()).toBe(false);
    });

    it("should detect beads from the provided workdir", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      const service = new BeadsService({
        logger: mockLogger,
        client: mockClient,
        workdir: "/custom/project",
      });

      expect(service.isBeadsEnabled()).toBe(true);
      expect(accessSyncSpy).toHaveBeenCalledWith("/custom/project/.beads", fs.constants.F_OK);

      accessSyncSpy.mockRestore();
    });
  });

  describe("checkBeadsAvailability", () => {
    it("should delegate bd CLI detection through shared project-detection helper", async () => {
      const bdDetectionSpy = spyOn(core, "detectBdCliAvailabilityStatus").mockReturnValue("missing");
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      const service = new BeadsService({
        logger: mockLogger,
        client: mockClient,
        workdir: "/custom/project",
        beadsEnabled: true,
      });

      await service.checkBeadsAvailability();

      expect(bdDetectionSpy).toHaveBeenCalledWith("/custom/project", mockLogger);
      expect(toastCalls.length).toBe(1);
      expect(toastCalls[0].title).toBe("Beads Not Available");

      bdDetectionSpy.mockRestore();
      accessSyncSpy.mockRestore();
    });

    it("should show toast when bd CLI is not installed", async () => {
      // Mock execSync to throw (bd not found)
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        throw new Error("command not found");
      });

      // Mock fs.accessSync to succeed (.beads exists)
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      const service = new BeadsService({
        logger: mockLogger,
        client: mockClient,
        beadsEnabled: true,
      });

      await service.checkBeadsAvailability();

      expect(toastCalls.length).toBe(1);
      expect(toastCalls[0].title).toBe("Beads Not Available");
      expect(toastCalls[0].message).toContain("npm install -g beads");
      expect(toastCalls[0].variant).toBe("warning");
      expect(mockLogger.hasLogged("warn", "Beads CLI not installed")).toBe(true);

      execSyncSpy.mockRestore();
      accessSyncSpy.mockRestore();
    });

    it("should show toast when .beads directory is missing", async () => {
      // Mock execSync to succeed (bd is installed)
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(
        () => Buffer.from("/usr/local/bin/bd") as any
      );

      // Mock fs.accessSync to throw (.beads not found)
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const service = new BeadsService({
        logger: mockLogger,
        client: mockClient,
        beadsEnabled: true,
      });

      await service.checkBeadsAvailability();

      expect(toastCalls.length).toBe(1);
      expect(toastCalls[0].title).toBe("Beads Not Initialized");
      expect(toastCalls[0].message).toContain("bd init");
      expect(toastCalls[0].variant).toBe("warning");
      expect(mockLogger.hasLogged("warn", "Beads directory not found")).toBe(true);

      execSyncSpy.mockRestore();
      accessSyncSpy.mockRestore();
    });

    it("should not show toast when both bd CLI and .beads directory exist", async () => {
      // Mock execSync to succeed (bd is installed)
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(
        () => Buffer.from("/usr/local/bin/bd") as any
      );

      // Mock fs.accessSync to succeed (.beads exists)
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      const service = new BeadsService({
        logger: mockLogger,
        client: mockClient,
        beadsEnabled: true,
      });

      await service.checkBeadsAvailability();

      expect(toastCalls.length).toBe(0);
      expect(mockLogger.hasLogged("debug", "Beads availability check passed")).toBe(true);
      expect(execSyncSpy).toHaveBeenCalledWith("command -v bd", {
        stdio: "ignore",
        timeout: 5000,
      });

      execSyncSpy.mockRestore();
      accessSyncSpy.mockRestore();
    });

    it("should not show install toast when bd CLI check times out", async () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        const timeoutError = new Error("timed out") as Error & { killed: boolean; signal: string };
        timeoutError.killed = true;
        timeoutError.signal = "SIGTERM";
        throw timeoutError;
      });

      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      const service = new BeadsService({
        logger: mockLogger,
        client: mockClient,
        beadsEnabled: true,
      });

      await service.checkBeadsAvailability();

      expect(toastCalls.length).toBe(0);
      expect(mockLogger.hasLogged("warn", "Beads CLI not installed")).toBe(false);
      expect(mockLogger.hasLogged("warn", "bd CLI availability check timed out")).toBe(true);
      expect(mockLogger.hasLogged("warn", "Skipping Beads CLI install guidance due to timeout")).toBe(true);

      execSyncSpy.mockRestore();
      accessSyncSpy.mockRestore();
    });

    it("should still show beads init toast when bd check times out and .beads directory is missing", async () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        const timeoutError = new Error("timed out") as Error & { code: string };
        timeoutError.code = "ETIMEDOUT";
        throw timeoutError;
      });

      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const service = new BeadsService({
        logger: mockLogger,
        client: mockClient,
        beadsEnabled: true,
      });

      await service.checkBeadsAvailability();

      expect(toastCalls.length).toBe(1);
      expect(toastCalls[0].title).toBe("Beads Not Initialized");
      expect(toastCalls[0].message).toContain("bd init");
      expect(mockLogger.hasLogged("warn", "Beads CLI not installed")).toBe(false);
      expect(mockLogger.hasLogged("warn", "bd CLI availability check timed out")).toBe(true);

      execSyncSpy.mockRestore();
      accessSyncSpy.mockRestore();
    });
  });
});
