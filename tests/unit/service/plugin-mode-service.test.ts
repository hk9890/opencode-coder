import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PluginModeService } from "../../../src/service";
import { createMockLogger, type MockLogger } from "../../helpers/mock-logger";

describe("PluginModeService", () => {
  let mockLogger: MockLogger;
  let originalDisabled: string | undefined;

  beforeEach(() => {
    mockLogger = createMockLogger();
    originalDisabled = process.env["OPENCODE_CODER_DISABLED"];
    delete process.env["OPENCODE_CODER_DISABLED"];
  });

  afterEach(() => {
    if (originalDisabled === undefined) {
      delete process.env["OPENCODE_CODER_DISABLED"];
    } else {
      process.env["OPENCODE_CODER_DISABLED"] = originalDisabled;
    }
  });

  it("resolves a saved mode from .coder/opencode-coder.yaml", () => {
    const workdir = mkdtempSync(join(tmpdir(), "plugin-mode-saved-"));

    try {
      mkdirSync(join(workdir, ".coder"), { recursive: true });
      writeFileSync(join(workdir, ".coder", "opencode-coder.yaml"), "mode: disabled\n", "utf-8");

      const service = new PluginModeService({ logger: mockLogger, workdir });
      const result = service.resolveStartupMode();

      expect(result.mode).toBe("disabled");
      expect(result.source).toBe("saved");
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("treats invalid saved state as not-enabled and logs a warning", () => {
    const workdir = mkdtempSync(join(tmpdir(), "plugin-mode-invalid-"));

    try {
      mkdirSync(join(workdir, ".coder"), { recursive: true });
      writeFileSync(join(workdir, ".coder", "opencode-coder.yaml"), "mode: mystery\n", "utf-8");

      const service = new PluginModeService({ logger: mockLogger, workdir });
      const result = service.resolveStartupMode();

      expect(result.mode).toBe("not-enabled");
      expect(result.source).toBe("invalid-saved");
      expect(mockLogger.hasLogged("warn", "Saved plugin mode file is invalid")).toBe(true);
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("lets OPENCODE_CODER_DISABLED override any saved mode", () => {
    const workdir = mkdtempSync(join(tmpdir(), "plugin-mode-env-"));

    try {
      mkdirSync(join(workdir, ".coder"), { recursive: true });
      writeFileSync(join(workdir, ".coder", "opencode-coder.yaml"), "mode: team\n", "utf-8");
      process.env["OPENCODE_CODER_DISABLED"] = "true";

      const service = new PluginModeService({ logger: mockLogger, workdir });
      const result = service.resolveStartupMode();

      expect(result.mode).toBe("hard-disabled");
      expect(result.source).toBe("env");
      expect(
        mockLogger.hasLogged("info", "OPENCODE_CODER_DISABLED hard override won over saved plugin mode")
      ).toBe(true);
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("infers legacy stealth mode from the stealth marker and persists the migrated state", () => {
    const workdir = mkdtempSync(join(tmpdir(), "plugin-mode-legacy-stealth-"));

    try {
      mkdirSync(join(workdir, ".git", "info"), { recursive: true });
      writeFileSync(
        join(workdir, ".git", "info", "exclude"),
        "# opencode-coder stealth mode\n.coder/\n",
        "utf-8"
      );

      const service = new PluginModeService({ logger: mockLogger, workdir });
      const result = service.resolveStartupMode();

      expect(result.mode).toBe("stealth");
      expect(result.source).toBe("legacy");
      expect(readFileSync(join(workdir, ".coder", "opencode-coder.yaml"), "utf-8")).toContain("mode: stealth");
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("infers legacy team mode from project context and persists the migrated state", () => {
    const workdir = mkdtempSync(join(tmpdir(), "plugin-mode-legacy-team-"));

    try {
      mkdirSync(join(workdir, ".coder"), { recursive: true });
      writeFileSync(join(workdir, ".coder", "project.yaml"), "mode: team\n", "utf-8");

      const service = new PluginModeService({ logger: mockLogger, workdir });
      const result = service.resolveStartupMode();

      expect(result.mode).toBe("team");
      expect(result.source).toBe("legacy");
      expect(readFileSync(join(workdir, ".coder", "opencode-coder.yaml"), "utf-8")).toContain("mode: team");
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });
});
