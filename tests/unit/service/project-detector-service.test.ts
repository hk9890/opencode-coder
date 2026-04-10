import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as childProcess from "child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ProjectDetectorService } from "../../../src/service/project-detector-service";
import type { ProjectContext } from "../../../src/service/project-detector-service";
import { createMockLogger } from "../../helpers/mock-logger";

function createService(workdir: string) {
  return new ProjectDetectorService({ logger: createMockLogger(), workdir });
}

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
    },
    ...overrides,
  };
}

const tempDirs: string[] = [];

function createTempWorkdir(prefix: string): string {
  const workdir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(workdir);
  return workdir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("ProjectDetectorService", () => {
  describe("real filesystem coverage", () => {
    it("writeProjectContext() creates .coder files and writes expected yaml", () => {
      const workdir = createTempWorkdir("project-detector-write-context-");
      const service = createService(workdir);

      const context = createProjectContextFixture({
        mode: "stealth",
        installReady: false,
        pluginVersion: "2.3.4",
        beads: { initialized: true, stealthMode: true, bdCliInstalled: false },
        runtimePhase: {
          phase: "bootstrap",
          missingRequiredSurfaces: ["resource/opencode-coder"],
          shouldExposeBootstrapInit: true,
          shouldUseResourceBackedCommands: false,
        },
      });

      service.writeProjectContext(context);

      const coderDir = join(workdir, ".coder");
      const gitignorePath = join(coderDir, ".gitignore");
      const projectYamlPath = join(coderDir, "project.yaml");

      expect(existsSync(coderDir)).toBe(true);
      expect(readFileSync(gitignorePath, "utf-8")).toBe("*\n");

      const yaml = readFileSync(projectYamlPath, "utf-8");
      expect(yaml).toContain("mode: stealth");
      expect(yaml).toContain("installReady: false");
      expect(yaml).toContain("stealthMode: true");
      expect(yaml).toContain("bdCliInstalled: false");
      expect(yaml).toContain("pluginVersion: 2.3.4");
      expect(yaml).toContain("phase: bootstrap");
      expect(yaml).toContain("missingRequiredSurfaces:");
      expect(yaml).toContain("- resource/opencode-coder");
    });

    it("writeProjectContext() does not overwrite existing .coder/.gitignore", () => {
      const workdir = createTempWorkdir("project-detector-write-gitignore-");
      const service = createService(workdir);
      const coderDir = join(workdir, ".coder");
      mkdirSync(coderDir, { recursive: true });
      const gitignorePath = join(coderDir, ".gitignore");
      writeFileSync(gitignorePath, "# keep me\n", "utf-8");

      service.writeProjectContext(createProjectContextFixture());

      expect(readFileSync(gitignorePath, "utf-8")).toBe("# keep me\n");
    });

    it("detectGitInitialized() checks real .git directory", () => {
      const workdir = createTempWorkdir("project-detector-git-");
      const service = createService(workdir);

      expect(service.detectGitInitialized()).toBe(false);

      mkdirSync(join(workdir, ".git"), { recursive: true });
      expect(service.detectGitInitialized()).toBe(true);
    });

    it("detectBeadsInitialized() checks real .beads directory", () => {
      const workdir = createTempWorkdir("project-detector-beads-");
      const service = createService(workdir);

      expect(service.detectBeadsInitialized()).toBe(false);

      mkdirSync(join(workdir, ".beads"), { recursive: true });
      expect(service.detectBeadsInitialized()).toBe(true);
    });

    it("detectStealthMode() checks real .git/info/exclude marker", () => {
      const workdir = createTempWorkdir("project-detector-stealth-");
      const service = createService(workdir);
      const excludePath = join(workdir, ".git", "info", "exclude");
      mkdirSync(join(workdir, ".git", "info"), { recursive: true });

      writeFileSync(excludePath, "# baseline\n", "utf-8");
      expect(service.detectStealthMode()).toBe(false);

      writeFileSync(excludePath, "# opencode-coder stealth mode\n.coder/\n", "utf-8");
      expect(service.detectStealthMode()).toBe(true);
    });

    it("classifyRuntimePhase() returns bootstrap until both required .opencode surfaces exist", () => {
      const workdir = createTempWorkdir("project-detector-runtime-bootstrap-");
      const service = createService(workdir);

      expect(service.classifyRuntimePhase()).toEqual({
        phase: "bootstrap",
        missingRequiredSurfaces: ["resource/opencode-coder"],
        shouldExposeBootstrapInit: true,
        shouldUseResourceBackedCommands: false,
      });

      mkdirSync(join(workdir, ".opencode", "commands", "opencode-coder"), { recursive: true });
      writeFileSync(join(workdir, ".opencode", "commands", "opencode-coder", "init.md"), "# init\n", "utf-8");

      expect(service.classifyRuntimePhase().phase).toBe("bootstrap");

      mkdirSync(join(workdir, ".opencode", "skills", "opencode-coder"), { recursive: true });
      writeFileSync(join(workdir, ".opencode", "skills", "opencode-coder", "SKILL.md"), "# skill\n", "utf-8");

      expect(service.classifyRuntimePhase()).toEqual({
        phase: "normal",
        missingRequiredSurfaces: [],
        shouldExposeBootstrapInit: false,
        shouldUseResourceBackedCommands: true,
      });
    });
  });

  describe("CLI-backed detection (mocked where external execution is undesirable)", () => {
    it("detectBdCliInstalled() returns false and logs timeout warning", () => {
      const logger = createMockLogger();
      const service = new ProjectDetectorService({ logger, workdir: "/tmp/nonexistent" });
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        const timeoutError = new Error("timed out") as Error & { killed: boolean; signal: string };
        timeoutError.killed = true;
        timeoutError.signal = "SIGTERM";
        throw timeoutError;
      });

      expect(service.detectBdCliInstalled()).toBe(false);
      expect(logger.hasLogged("warn", "bd CLI availability check timed out")).toBe(true);

      execSyncSpy.mockRestore();
    });

    it("detectAimgrInstalled() returns false and logs timeout warning", () => {
      const logger = createMockLogger();
      const service = new ProjectDetectorService({ logger, workdir: "/tmp/nonexistent" });
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        const timeoutError = new Error("timed out") as Error & { killed: boolean; signal: string };
        timeoutError.killed = true;
        timeoutError.signal = "SIGTERM";
        throw timeoutError;
      });

      expect(service.detectAimgrInstalled()).toBe(false);
      expect(logger.hasLogged("warn", "aimgr availability check timed out")).toBe(true);

      execSyncSpy.mockRestore();
    });

    it("detectCoderPackageInstalled() parses aimgr list json and handles malformed output", () => {
      const service = new ProjectDetectorService({ logger: createMockLogger(), workdir: "/tmp/nonexistent" });
      const execSyncSpy = spyOn(childProcess, "execSync");

      execSyncSpy.mockReturnValueOnce(JSON.stringify([{ type: "package", name: "opencode-coder" }]) as any);
      expect(service.detectCoderPackageInstalled()).toBe(true);

      execSyncSpy.mockReturnValueOnce("[]" as any);
      expect(service.detectCoderPackageInstalled()).toBe(false);

      execSyncSpy.mockReturnValueOnce("not-json" as any);
      expect(service.detectCoderPackageInstalled()).toBe(false);

      execSyncSpy.mockRestore();
    });

    it("detectResourcesHealthy() returns healthy only when verify has no issues", () => {
      const service = new ProjectDetectorService({ logger: createMockLogger(), workdir: "/tmp/nonexistent" });
      const execSyncSpy = spyOn(childProcess, "execSync");

      execSyncSpy.mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return "" as any;
        if (cmd === "aimgr verify --format json") return JSON.stringify({ status: "ok", issues: [] }) as any;
        return "" as any;
      });
      expect(service.detectResourcesHealthy()).toBe(true);

      execSyncSpy.mockImplementation((cmd: string) => {
        if (cmd === "command -v aimgr") return "" as any;
        if (cmd === "aimgr verify --format json") {
          return JSON.stringify({ status: "ok", issues: [{ id: "missing-skill" }] }) as any;
        }
        return "" as any;
      });
      expect(service.detectResourcesHealthy()).toBe(false);

      execSyncSpy.mockRestore();
    });
  });

  describe("detectAndWrite", () => {
    const versionInfo = { name: "@dynatrace-oss/opencode-coder", version: "1.2.3" };

    it("uses startupMode override and resourcesHealthyOverride in final context", () => {
      const workdir = createTempWorkdir("project-detector-detect-and-write-");
      mkdirSync(join(workdir, ".git"), { recursive: true });
      mkdirSync(join(workdir, ".beads"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "commands", "opencode-coder"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "skills", "opencode-coder"), { recursive: true });
      writeFileSync(join(workdir, ".opencode", "commands", "opencode-coder", "init.md"), "# init\n", "utf-8");
      writeFileSync(join(workdir, ".opencode", "skills", "opencode-coder", "SKILL.md"), "# skill\n", "utf-8");
      writeFileSync(join(workdir, "ai.package.yaml"), "resources: []\n", "utf-8");

      const service = createService(workdir);
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

      const result = service.detectAndWrite(versionInfo as any, {
        startupMode: "team",
        resourcesHealthyOverride: true,
      });

      expect(result.mode).toBe("team");
      expect(result.installReady).toBe(true);
      expect(result.ecosystemReady).toBe(true);
      expect(result.runtimePhase.phase).toBe("normal");

      const yaml = readFileSync(join(workdir, ".coder", "project.yaml"), "utf-8");
      expect(yaml).toContain("mode: team");
      expect(yaml).toContain("installReady: true");
      expect(yaml).toContain("ecosystemReady: true");
      expect(yaml).toContain("pluginVersion: 1.2.3");

      execSyncSpy.mockRestore();
    });
  });
});
