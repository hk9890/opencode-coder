import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import * as path from "path";
import * as fs from "fs";
import * as childProcess from "child_process";
import { ProjectDetectorService } from "../../../src/service/project-detector-service";
import type { ProjectContext } from "../../../src/service/project-detector-service";
import { createMockLogger, type MockLogger } from "../../helpers/mock-logger";

function createProjectContextFixture(overrides?: Partial<ProjectContext>): ProjectContext {
  return {
    mode: "team",
    installReady: true,
    ecosystemReady: true,
    git: { initialized: true },
    beads: { initialized: true, stealthMode: false, bdCliInstalled: true },
    aimgr: { installed: true, packageYaml: true, resourcesHealthy: true, coderPackageInstalled: true },
    pluginVersion: "1.0.0",
    runtimePhase: {
      phase: "normal",
      missingRequiredSurfaces: [],
      shouldExposeBootstrapInit: false,
      shouldUseResourceBackedCommands: true,
      requiredSurfaceAvailability: {
        "resource/opencode-coder": true,
      },
      optionalAgentAvailability: {
        "resource/opencode-coder/optional-agents": true,
      },
      diagnostics: {
        aimgrAvailable: true,
        packageYamlAvailable: true,
        coderPackageInstalled: true,
        resourcesHealthy: true,
        opencodeCoderSkillMarkerAvailable: true,
      },
    },
    ...overrides,
  };
}

describe("ProjectDetectorService", () => {
  let mockLogger: MockLogger;
  let service: ProjectDetectorService;

  beforeEach(() => {
    mockLogger = createMockLogger();
    service = new ProjectDetectorService({
      logger: mockLogger,
      workdir: "/test/project",
    });
  });

  afterEach(() => {
    // Restore any spies
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  describe("constructor", () => {
    it("should create service with custom workdir", () => {
      expect(service).toBeDefined();
    });

    it("should default to process.cwd() when no workdir given", () => {
      const defaultService = new ProjectDetectorService({ logger: mockLogger });
      expect(defaultService).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Git detection
  // ---------------------------------------------------------------------------

  describe("detectGitInitialized", () => {
    it("should return true when .git directory exists", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      const result = service.detectGitInitialized();

      expect(result).toBe(true);
      expect(accessSyncSpy).toHaveBeenCalledWith("/test/project/.git", fs.constants.F_OK);
      accessSyncSpy.mockRestore();
    });

    it("should return false when .git directory is missing", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const result = service.detectGitInitialized();

      expect(result).toBe(false);
      accessSyncSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Beads detection
  // ---------------------------------------------------------------------------

  describe("detectBeadsInitialized", () => {
    it("should return true when .beads directory exists", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      const result = service.detectBeadsInitialized();

      expect(result).toBe(true);
      expect(accessSyncSpy).toHaveBeenCalledWith("/test/project/.beads", fs.constants.F_OK);
      accessSyncSpy.mockRestore();
    });

    it("should return false when .beads directory is missing", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const result = service.detectBeadsInitialized();

      expect(result).toBe(false);
      accessSyncSpy.mockRestore();
    });
  });

  describe("detectStealthMode", () => {
    it("should return true when stealth marker is in .git/info/exclude", () => {
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        "# opencode-coder stealth mode\n.coder/\n" as any
      );

      const result = service.detectStealthMode();

      expect(result).toBe(true);
      expect(readFileSyncSpy).toHaveBeenCalledWith("/test/project/.git/info/exclude", "utf-8");
      readFileSyncSpy.mockRestore();
    });

    it("should return false when stealth marker is absent", () => {
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        "# git ls-files --others --exclude-from=.git/info/exclude\n.DS_Store\n" as any
      );

      const result = service.detectStealthMode();

      expect(result).toBe(false);
      readFileSyncSpy.mockRestore();
    });

    it("should return false when .git/info/exclude cannot be read", () => {
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const result = service.detectStealthMode();

      expect(result).toBe(false);
      readFileSyncSpy.mockRestore();
    });
  });

  describe("detectBdCliInstalled", () => {
    it("should return true when bd is on PATH", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => undefined as any);

      const result = service.detectBdCliInstalled();

      expect(result).toBe(true);
      expect(execSyncSpy).toHaveBeenCalledWith("command -v bd", {
        stdio: "ignore",
        timeout: 5000,
      });
      execSyncSpy.mockRestore();
    });

    it("should return false when bd is not on PATH", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        throw new Error("command not found");
      });

      const result = service.detectBdCliInstalled();

      expect(result).toBe(false);
      execSyncSpy.mockRestore();
    });

    it("should return false and log timeout details when bd check times out", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        const timeoutError = new Error("timed out") as Error & { killed: boolean; signal: string };
        timeoutError.killed = true;
        timeoutError.signal = "SIGTERM";
        throw timeoutError;
      });

      const result = service.detectBdCliInstalled();

      expect(result).toBe(false);
      expect(mockLogger.hasLogged("warn", "bd CLI availability check timed out")).toBe(true);
      expect(mockLogger.hasLogged("debug", "bd CLI not found on PATH")).toBe(false);
      execSyncSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // aimgr detection
  // ---------------------------------------------------------------------------

  describe("detectAimgrInstalled", () => {
    it("should return true when aimgr is on PATH", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => undefined as any);

      const result = service.detectAimgrInstalled();

      expect(result).toBe(true);
      expect(execSyncSpy).toHaveBeenCalledWith("command -v aimgr", {
        stdio: "ignore",
        timeout: 5000,
      });
      execSyncSpy.mockRestore();
    });

    it("should return false when aimgr is not on PATH", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        throw new Error("command not found");
      });

      const result = service.detectAimgrInstalled();

      expect(result).toBe(false);
      execSyncSpy.mockRestore();
    });

    it("should return false and log timeout details when aimgr check times out", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        const timeoutError = new Error("timed out") as Error & { killed: boolean; signal: string };
        timeoutError.killed = true;
        timeoutError.signal = "SIGTERM";
        throw timeoutError;
      });

      const result = service.detectAimgrInstalled();

      expect(result).toBe(false);
      expect(mockLogger.hasLogged("warn", "aimgr CLI availability check timed out")).toBe(true);
      expect(mockLogger.hasLogged("debug", "aimgr CLI not found on PATH")).toBe(false);
      execSyncSpy.mockRestore();
    });
  });

  describe("detectPackageYaml", () => {
    it("should return true when ai.package.yaml exists", () => {
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true);

      const result = service.detectPackageYaml();

      expect(result).toBe(true);
      expect(existsSyncSpy).toHaveBeenCalledWith("/test/project/ai.package.yaml");
      existsSyncSpy.mockRestore();
    });

    it("should return false when ai.package.yaml is absent", () => {
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);

      const result = service.detectPackageYaml();

      expect(result).toBe(false);
      existsSyncSpy.mockRestore();
    });
  });

  describe("detectCoderPackageInstalled", () => {
    it("should return true when aimgr list returns the package", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockReturnValue(
        JSON.stringify([{
          type: "package",
          name: "opencode-coder",
          description: "opencode-coder plugin toolkit",
          targets: [],
          sync_status: "in-sync",
          health: "ok",
        }]) as any
      );

      const result = service.detectCoderPackageInstalled();

      expect(result).toBe(true);
      expect(execSyncSpy).toHaveBeenCalledWith(
        'aimgr list "package/opencode-coder" --format json',
        {
          cwd: "/test/project",
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 10000,
        }
      );
      execSyncSpy.mockRestore();
    });

    it("should return false when aimgr list returns empty array", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockReturnValue("[]" as any);

      const result = service.detectCoderPackageInstalled();

      expect(result).toBe(false);
      execSyncSpy.mockRestore();
    });

    it("should return false when aimgr list returns non-JSON (not found message)", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockReturnValue(
        "No installed resources match pattern 'package/opencode-coder'.\n\nInstall resources with: aimgr install <resource>\n" as any
      );

      const result = service.detectCoderPackageInstalled();

      expect(result).toBe(false);
      execSyncSpy.mockRestore();
    });

    it("should return false when aimgr is not installed", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        throw new Error("command not found");
      });

      const result = service.detectCoderPackageInstalled();

      expect(result).toBe(false);
      execSyncSpy.mockRestore();
    });

    it("should return false when aimgr list returns malformed JSON", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockReturnValue("{broken" as any);

      const result = service.detectCoderPackageInstalled();

      expect(result).toBe(false);
      execSyncSpy.mockRestore();
    });

    it("should return false and log timeout details when aimgr list times out", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        const timeoutError = new Error("timed out") as Error & { killed: boolean; signal: string };
        timeoutError.killed = true;
        timeoutError.signal = "SIGTERM";
        throw timeoutError;
      });

      const result = service.detectCoderPackageInstalled();

      expect(result).toBe(false);
      expect(
        mockLogger.hasLogged("warn", "aimgr list timed out while checking opencode-coder package")
      ).toBe(true);
      expect(mockLogger.hasLogged("debug", "Could not detect opencode-coder package via aimgr list")).toBe(false);
      execSyncSpy.mockRestore();
    });
  });

  describe("detectResourcesHealthy", () => {
    it("should return false when aimgr is not installed", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        throw new Error("command not found");
      });

      const result = service.detectResourcesHealthy();

      expect(result).toBe(false);
      execSyncSpy.mockRestore();
    });

    it("should return true when aimgr verify reports healthy status", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return "" as any;
        if (cmd === "aimgr verify --format json") return JSON.stringify({ status: "ok", issues: [] }) as any;
        return "" as any;
      });

      const result = service.detectResourcesHealthy();

      expect(result).toBe(true);
      expect(execSyncSpy).toHaveBeenCalledWith("aimgr verify --format json", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      });
      execSyncSpy.mockRestore();
    });

    it("should return false when aimgr verify reports issues", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return "" as any;
        if (cmd === "aimgr verify --format json") {
          return JSON.stringify({ status: "ok", issues: [{ id: "missing-skill" }] }) as any;
        }
        return "" as any;
      });

      const result = service.detectResourcesHealthy();

      expect(result).toBe(false);
      execSyncSpy.mockRestore();
    });

    it("should return false when aimgr verify fails", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return "" as any;
        throw new Error("verify failed");
      });

      const result = service.detectResourcesHealthy();

      expect(result).toBe(false);
      execSyncSpy.mockRestore();
    });

    it("should return false when aimgr verify times out", () => {
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return "" as any;
        const timeoutError = new Error("timed out") as Error & { killed: boolean; signal: string };
        timeoutError.killed = true;
        timeoutError.signal = "SIGTERM";
        throw timeoutError;
      });

      const result = service.detectResourcesHealthy();

      expect(result).toBe(false);
      expect(mockLogger.hasLogged("error", "Failed to run aimgr verify")).toBe(true);
      execSyncSpy.mockRestore();
    });
  });

  describe("classifyRuntimePhase", () => {
    it("classifies Phase 2 normal when required command and skill surfaces exist without aimgr", () => {
      const existsSyncSpy = spyOn(fs, "existsSync").mockImplementation((p: any) => {
        const normalized = String(p);
        if (normalized.includes("/.opencode/commands/opencode-coder/")) return true;
        if (normalized.endsWith("/.opencode/skills/opencode-coder/SKILL.md")) return true;
        if (normalized.includes("/.opencode/skills/opencode-coder/references/")) return true;
        if (normalized.endsWith("/.opencode/agents/orchestrator.md")) return false;
        if (normalized.endsWith("/.opencode/agents/tasker.md")) return false;
        if (normalized.endsWith("/.opencode/agents/reviewer.md")) return false;
        if (normalized.endsWith("/.opencode/agents/verifier.md")) return false;
        if (normalized.endsWith("/ai.package.yaml")) return false;
        return false;
      });

      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") throw new Error("aimgr missing");
        throw new Error(`unexpected command: ${cmd}`);
      });

      const result = service.classifyRuntimePhase();

      expect(result.phase).toBe("normal");
      expect(result.shouldUseResourceBackedCommands).toBe(true);
      expect(result.shouldExposeBootstrapInit).toBe(false);
      expect(result.missingRequiredSurfaces).toEqual([]);
      expect(result.optionalAgentAvailability["resource/opencode-coder/optional-agents"]).toBe(false);
      expect(result.diagnostics.aimgrAvailable).toBe(false);
      expect(result.diagnostics.coderPackageInstalled).toBe(false);
      expect(result.diagnostics.opencodeCoderSkillMarkerAvailable).toBe(true);

      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
    });

    it("classifies Phase 1 bootstrap when required surfaces are missing even if aimgr package is installed", () => {
      const existsSyncSpy = spyOn(fs, "existsSync").mockImplementation((p: any) => {
        const normalized = String(p);
        if (normalized.endsWith("/.opencode/commands/opencode-coder/init-or-update-docs.md")) return false;
        if (normalized.includes("/.opencode/commands/opencode-coder/")) return true;
        if (normalized.endsWith("/.opencode/skills/opencode-coder/SKILL.md")) return true;
        if (normalized.includes("/.opencode/skills/opencode-coder/references/")) return true;
        if (normalized.endsWith("/ai.package.yaml")) return true;
        return false;
      });

      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return "/usr/bin/aimgr" as any;
        if (cmd === 'aimgr list "package/opencode-coder" --format json') {
          return JSON.stringify([{ type: "package", name: "opencode-coder" }]) as any;
        }
        if (cmd === "aimgr verify --format json") {
          return JSON.stringify({ status: "ok", issues: [] }) as any;
        }
        throw new Error(`unexpected command: ${cmd}`);
      });

      const result = service.classifyRuntimePhase();

      expect(result.phase).toBe("bootstrap");
      expect(result.shouldUseResourceBackedCommands).toBe(false);
      expect(result.shouldExposeBootstrapInit).toBe(true);
      expect(result.missingRequiredSurfaces).toContain("resource/opencode-coder");
      expect(result.diagnostics.aimgrAvailable).toBe(true);
      expect(result.diagnostics.coderPackageInstalled).toBe(true);

      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
    });

    it("classifies Phase 1 bootstrap when a required skill reference surface is missing", () => {
      const existsSyncSpy = spyOn(fs, "existsSync").mockImplementation((p: any) => {
        const normalized = String(p);
        if (normalized.includes("/.opencode/commands/opencode-coder/")) return true;
        if (normalized.endsWith("/.opencode/skills/opencode-coder/SKILL.md")) return true;
        if (normalized.endsWith("/.opencode/skills/opencode-coder/references/status-health.md")) return false;
        if (normalized.includes("/.opencode/skills/opencode-coder/references/")) return true;
        if (normalized.endsWith("/ai.package.yaml")) return false;
        return false;
      });

      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") throw new Error("aimgr missing");
        throw new Error(`unexpected command: ${cmd}`);
      });

      const result = service.classifyRuntimePhase();

      expect(result.phase).toBe("bootstrap");
      expect(result.shouldUseResourceBackedCommands).toBe(false);
      expect(result.shouldExposeBootstrapInit).toBe(true);
      expect(result.missingRequiredSurfaces).toContain("resource/opencode-coder");

      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Mode derivation
  // ---------------------------------------------------------------------------

  describe("deriveMode", () => {
    it("should return 'stealth' when stealthMode is true", () => {
      expect(service.deriveMode(true, true)).toBe("stealth");
      expect(service.deriveMode(false, true)).toBe("stealth");
    });

    it("should return 'team' when beads initialized but no stealth", () => {
      expect(service.deriveMode(true, false)).toBe("team");
    });

    it("should return 'uninitialized' when neither beads nor stealth", () => {
      expect(service.deriveMode(false, false)).toBe("uninitialized");
    });
  });

  // ---------------------------------------------------------------------------
  // Install readiness
  // ---------------------------------------------------------------------------

  describe("deriveInstallReady", () => {
    it("should return true when all prerequisites are met", () => {
      expect(service.deriveInstallReady(true, true, true, true)).toBe(true);
    });

    it("should return false when git is not initialized", () => {
      expect(service.deriveInstallReady(false, true, true, true)).toBe(false);
    });

    it("should return false when bd CLI is not installed", () => {
      expect(service.deriveInstallReady(true, false, true, true)).toBe(false);
    });

    it("should return false when aimgr is not installed", () => {
      expect(service.deriveInstallReady(true, true, false, true)).toBe(false);
    });

    it("should return false when coderPackageInstalled is false", () => {
      expect(service.deriveInstallReady(true, true, true, false)).toBe(false);
    });

    it("should return false when nothing is installed", () => {
      expect(service.deriveInstallReady(false, false, false, false)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Ecosystem readiness
  // ---------------------------------------------------------------------------

  describe("deriveEcosystemReady", () => {
    it("should return true when all components are operational", () => {
      expect(service.deriveEcosystemReady(true, true, true, true, true)).toBe(true);
    });

    it("should return false when git is not initialized", () => {
      expect(service.deriveEcosystemReady(false, true, true, true, true)).toBe(false);
    });

    it("should return false when beads is not initialized", () => {
      expect(service.deriveEcosystemReady(true, false, true, true, true)).toBe(false);
    });

    it("should return false when aimgr is not installed", () => {
      expect(service.deriveEcosystemReady(true, true, false, true, true)).toBe(false);
    });

    it("should return false when ai.package.yaml is missing", () => {
      expect(service.deriveEcosystemReady(true, true, true, false, true)).toBe(false);
    });

    it("should return false when resources are not healthy", () => {
      expect(service.deriveEcosystemReady(true, true, true, true, false)).toBe(false);
    });

    it("should return false when nothing is installed", () => {
      expect(service.deriveEcosystemReady(false, false, false, false, false)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // writeProjectContext
  // ---------------------------------------------------------------------------

  describe("writeProjectContext", () => {
    it("should create .coder/ directory and write project.yaml", () => {
      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      const context: ProjectContext = createProjectContextFixture({
        installReady: false,
        ecosystemReady: false,
        beads: { initialized: true, stealthMode: false, bdCliInstalled: false },
        aimgr: { installed: false, packageYaml: false, resourcesHealthy: false, coderPackageInstalled: false },
      });

      service.writeProjectContext(context);

      expect(mkdirSyncSpy).toHaveBeenCalledWith("/test/project/.coder", { recursive: true });
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        "/test/project/.coder/project.yaml",
        expect.stringContaining("mode: team"),
        "utf-8"
      );
      mkdirSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should create .coder/.gitignore with '*' when it does not exist", () => {
      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      // .gitignore does NOT exist
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);
      const calls: Array<[string, string]> = [];
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(
        (p: any, data: any) => { calls.push([String(p), String(data)]); }
      );

      const context: ProjectContext = createProjectContextFixture({
        installReady: false,
        ecosystemReady: false,
        beads: { initialized: true, stealthMode: false, bdCliInstalled: false },
        aimgr: { installed: false, packageYaml: false, resourcesHealthy: false, coderPackageInstalled: false },
      });

      service.writeProjectContext(context);

      const gitignoreCall = calls.find(([p]) => p === "/test/project/.coder/.gitignore");
      expect(gitignoreCall).toBeDefined();
      expect(gitignoreCall![1]).toBe("*\n");

      expect(existsSyncSpy).toHaveBeenCalledWith("/test/project/.coder/.gitignore");

      mkdirSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should NOT overwrite .coder/.gitignore when it already exists", () => {
      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      // .gitignore already exists
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true);
      const calls: Array<[string, string]> = [];
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(
        (p: any, data: any) => { calls.push([String(p), String(data)]); }
      );

      const context: ProjectContext = createProjectContextFixture({
        installReady: false,
        ecosystemReady: false,
        beads: { initialized: true, stealthMode: false, bdCliInstalled: false },
        aimgr: { installed: false, packageYaml: false, resourcesHealthy: false, coderPackageInstalled: false },
      });

      service.writeProjectContext(context);

      // .gitignore should NOT be written when it already exists
      const gitignoreCall = calls.find(([p]) => p === "/test/project/.coder/.gitignore");
      expect(gitignoreCall).toBeUndefined();

      mkdirSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should include all required fields in YAML output", () => {
      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      let writtenContent = "";
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(
        (_p: any, data: any) => { writtenContent = data; }
      );

      const context: ProjectContext = createProjectContextFixture({
        mode: "stealth",
        installReady: false,
        ecosystemReady: true,
        beads: { initialized: false, stealthMode: true, bdCliInstalled: true },
        aimgr: { installed: true, packageYaml: true, resourcesHealthy: true, coderPackageInstalled: true },
        pluginVersion: "2.3.4",
      });

      service.writeProjectContext(context);

      expect(writtenContent).toContain("mode: stealth");
      expect(writtenContent).toContain("ecosystemReady: true");
      expect(writtenContent).toContain("stealthMode: true");
      expect(writtenContent).toContain("installed: true");
      expect(writtenContent).toContain("resourcesHealthy: true");
      expect(writtenContent).toContain("pluginVersion: 2.3.4");
      expect(writtenContent).toContain("bdCliInstalled: true");
      expect(writtenContent).toContain("coderPackageInstalled: true");
      expect(writtenContent).toContain("installReady: false");

      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // detectAndWrite (integration of all detections)
  // ---------------------------------------------------------------------------

  describe("detectAndWrite", () => {
    const versionInfo = { name: "@dynatrace-oss/opencode-coder", version: "1.2.3" };

    it("should write context with team mode for initialized beads repo", () => {
      // .git exists
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation((p: any) => {
        // Allow .git and .beads, reject everything else
        if (String(p).endsWith(".git") || String(p).endsWith(".beads")) return undefined;
        throw new Error("ENOENT");
      });

      const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(() => {
        // No stealth marker
        return "# default excludes\n" as any;
      });

      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);

      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        // aimgr not available
        if (cmd === "command -v aimgr") throw new Error("not found");
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      let writtenContent = "";
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(
        (_p: any, data: any) => { writtenContent = data; }
      );

      const result = service.detectAndWrite(versionInfo as any);

      expect(result.mode).toBe("team");
      expect(result.ecosystemReady).toBe(false);
      expect(writtenContent).toContain("mode: team");
      expect(writtenContent).toContain("ecosystemReady: false");
      expect(writtenContent).toContain("initialized: true");
      expect(writtenContent).toContain("pluginVersion: 1.2.3");

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should write context with stealth mode when marker present", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        "# opencode-coder stealth mode\n.coder/\n" as any
      );

      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);

      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") throw new Error("not found");
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      let writtenContent = "";
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(
        (_p: any, data: any) => { writtenContent = data; }
      );

      const result = service.detectAndWrite(versionInfo as any);

      expect(result.mode).toBe("stealth");
      expect(result.ecosystemReady).toBe(false);
      expect(writtenContent).toContain("mode: stealth");
      expect(writtenContent).toContain("stealthMode: true");

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should write context with uninitialized mode when no .beads", () => {
      // .git exists, .beads does NOT
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation((p: any) => {
        if (String(p).endsWith(".git")) return undefined;
        throw new Error("ENOENT");
      });

      const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(() => {
        return "# default\n" as any;
      });

      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);

      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") throw new Error("not found");
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      let writtenContent = "";
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(
        (_p: any, data: any) => { writtenContent = data; }
      );

      const result = service.detectAndWrite(versionInfo as any);

      expect(result.mode).toBe("uninitialized");
      expect(result.ecosystemReady).toBe(false);
      expect(writtenContent).toContain("mode: uninitialized");

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should set ecosystemReady true when all components operational", () => {
      // .git and .beads both exist
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      // No stealth marker
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        "# default excludes\n" as any
      );

      // ai.package.yaml exists
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true);

      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return "/usr/local/bin/aimgr" as any;
        if (cmd === "aimgr verify --format json") return JSON.stringify({ status: "ok", issues: [] }) as any;
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      let writtenContent = "";
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(
        (_p: any, data: any) => { writtenContent = data; }
      );

      const result = service.detectAndWrite(versionInfo as any);

      expect(result.ecosystemReady).toBe(true);
      expect(result.mode).toBe("team");
      expect(writtenContent).toContain("ecosystemReady: true");

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should set installReady true when all install prerequisites are met", () => {
      // .git exists, .beads exists
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);

      // No stealth marker
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        "# no stealth marker\n" as any
      );

      // ai.package.yaml exists
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true);

      const aimgrListResult = JSON.stringify([{
        type: "package", name: "opencode-coder", description: "toolkit",
        targets: [], sync_status: "in-sync", health: "ok",
      }]);
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") return "/usr/local/bin/bd" as any;
        if (cmd === "command -v aimgr") return "/usr/local/bin/aimgr" as any;
        if (cmd === "aimgr verify --format json") return JSON.stringify({ status: "ok", issues: [] }) as any;
        if (cmd === 'aimgr list "package/opencode-coder" --format json') return aimgrListResult as any;
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      let writtenContent = "";
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(
        (_p: any, data: any) => { writtenContent = data; }
      );

      const result = service.detectAndWrite(versionInfo as any);

      expect(result.installReady).toBe(true);
      expect(result.beads.bdCliInstalled).toBe(true);
      expect(result.aimgr.coderPackageInstalled).toBe(true);
      expect(writtenContent).toContain("installReady: true");
      expect(writtenContent).toContain("bdCliInstalled: true");
      expect(writtenContent).toContain("coderPackageInstalled: true");

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should set installReady false when bd CLI is missing", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation((p: any) => {
        if (String(p).endsWith(".git")) return undefined;
        throw new Error("ENOENT");
      });
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        "# no stealth marker\n" as any
      );
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true);
      const aimgrListResult = JSON.stringify([{
        type: "package", name: "opencode-coder", description: "toolkit",
        targets: [], sync_status: "in-sync", health: "ok",
      }]);
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") throw new Error("not found");
        if (cmd === "command -v aimgr") return "/usr/local/bin/aimgr" as any;
        if (cmd === "aimgr verify --format json") return JSON.stringify({ status: "ok", issues: [] }) as any;
        if (cmd === 'aimgr list "package/opencode-coder" --format json') return aimgrListResult as any;
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      const result = service.detectAndWrite(versionInfo as any);

      expect(result.installReady).toBe(false);
      expect(result.beads.bdCliInstalled).toBe(false);

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should not call detectCoderPackageInstalled when aimgr is not installed", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation((p: any) => {
        if (String(p).endsWith(".git")) return undefined;
        throw new Error("ENOENT");
      });
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue("# default\n" as any);
      // ai.package.yaml does NOT exist
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") return "/usr/local/bin/bd" as any;
        // aimgr is NOT installed
        if (cmd === "command -v aimgr") throw new Error("not found");
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      const result = service.detectAndWrite(versionInfo as any);

      // coderPackageInstalled should be false since aimgr is not installed
      expect(result.aimgr.coderPackageInstalled).toBe(false);
      // installReady should be false since coderPackageInstalled is false
      expect(result.installReady).toBe(false);

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should create .coder/ directory if it does not exist", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => {
        throw new Error("ENOENT");
      });
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(() => {
        throw new Error("ENOENT");
      });
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        throw new Error("not found");
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      service.detectAndWrite(versionInfo as any);

      expect(mkdirSyncSpy).toHaveBeenCalledWith(
        path.join("/test/project", ".coder"),
        { recursive: true }
      );

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should detect .coder directory when it exists", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation((p: any) => {
        if (String(p).endsWith(".coder")) return undefined;
        throw new Error("ENOENT");
      });

      expect(service.detectCoderDirectory()).toBe(true);

      accessSyncSpy.mockRestore();
    });

    it("should return false when .coder directory does not exist", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => {
        throw new Error("ENOENT");
      });

      expect(service.detectCoderDirectory()).toBe(false);

      accessSyncSpy.mockRestore();
    });

    it("should use resourcesHealthyOverride as authoritative health state", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue("# default excludes\n" as any);
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true);

      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") return "/usr/local/bin/bd" as any;
        if (cmd === "command -v aimgr") return "/usr/local/bin/aimgr" as any;
        if (cmd === 'aimgr list "package/opencode-coder" --format json') {
          return JSON.stringify([{ type: "package", name: "opencode-coder" }]) as any;
        }
        if (cmd === "aimgr verify --format json") {
          throw new Error("verify should not be called when override is provided");
        }
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      const result = service.detectAndWrite(versionInfo as any, { resourcesHealthyOverride: true });

      expect(result.aimgr.resourcesHealthy).toBe(true);
      expect(result.ecosystemReady).toBe(true);

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should log runtime context snapshot signal after writing project context", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation((p: any) => {
        if (String(p).endsWith(".git") || String(p).endsWith(".beads")) return undefined;
        throw new Error("ENOENT");
      });
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue("# default excludes\n" as any);
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);

      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") return "/usr/local/bin/bd" as any;
        if (cmd === "command -v aimgr") throw new Error("not found");
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      service.detectAndWrite(versionInfo as any, { startupMode: "team" });

      const snapshotLog = mockLogger.calls.find((entry) => entry.message === "Project runtime context snapshot updated");
      expect(snapshotLog).toBeDefined();
      expect(snapshotLog?.level).toBe("info");
      expect(snapshotLog?.extra?.["projectContextFile"]).toBe(".coder/project.yaml");
      expect(snapshotLog?.extra?.["mode"]).toBe("team");
      expect(snapshotLog?.extra?.["installReady"]).toBe(false);
      expect(snapshotLog?.extra?.["ecosystemReady"]).toBe(false);

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should honor startupMode override when active startup already resolved team mode", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation((p: any) => {
        if (String(p).endsWith(".git")) return undefined;
        throw new Error("ENOENT");
      });
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue("# default excludes\n" as any);
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(false);
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") return "/usr/local/bin/bd" as any;
        if (cmd === "command -v aimgr") throw new Error("not found");
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      const result = service.detectAndWrite(versionInfo as any, { startupMode: "team" });

      expect(result.mode).toBe("team");

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it("should avoid a second aimgr availability shell-out when detectAndWrite already knows aimgr is installed", () => {
      const accessSyncSpy = spyOn(fs, "accessSync").mockImplementation(() => undefined);
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue("# default excludes\n" as any);
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValue(true);

      let aimgrAvailabilityChecks = 0;
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") return "/usr/local/bin/bd" as any;
        if (cmd === "command -v aimgr") {
          aimgrAvailabilityChecks += 1;
          return "/usr/local/bin/aimgr" as any;
        }
        if (cmd === "aimgr verify --format json") return JSON.stringify({ status: "ok", issues: [] }) as any;
        if (cmd === 'aimgr list "package/opencode-coder" --format json') return JSON.stringify([]) as any;
        return "" as any;
      });

      const mkdirSyncSpy = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any);
      const writeFileSyncSpy = spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

      service.detectAndWrite(versionInfo as any);

      expect(aimgrAvailabilityChecks).toBe(1);

      accessSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      execSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });
  });
});
