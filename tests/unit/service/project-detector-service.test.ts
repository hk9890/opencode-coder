import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as childProcess from "child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ProjectDetectorService } from "../../../src/service/project-detector-service";
import type { ProjectDetectionFacts } from "../../../src/service/project-detector-service";
import { createMockLogger } from "../../helpers/mock-logger";

function createService(workdir: string) {
  return new ProjectDetectorService({ logger: createMockLogger(), workdir });
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
        coreAvailable: false,
        bootstrapRequired: true,
        missingRequiredSurfaces: ["command/opencode-coder/init", "skill/coder-core"],
        shouldExposeBootstrapInit: true,
      });

      mkdirSync(join(workdir, ".opencode", "commands", "opencode-coder"), { recursive: true });
      writeFileSync(join(workdir, ".opencode", "commands", "opencode-coder", "init.md"), "# init\n", "utf-8");

      expect(service.classifyRuntimePhase().phase).toBe("bootstrap");

      mkdirSync(join(workdir, ".opencode", "skills", "coder-core"), { recursive: true });
      writeFileSync(join(workdir, ".opencode", "skills", "coder-core", "SKILL.md"), "# skill\n", "utf-8");

      expect(service.classifyRuntimePhase()).toEqual({
        phase: "normal",
        coreAvailable: true,
        bootstrapRequired: false,
        missingRequiredSurfaces: [],
        shouldExposeBootstrapInit: false,
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

    it("requires explicit startupMode from caller", () => {
      const workdir = createTempWorkdir("project-detector-mode-derived-");
      mkdirSync(join(workdir, ".git", "info"), { recursive: true });
      mkdirSync(join(workdir, ".beads"), { recursive: true });
      writeFileSync(join(workdir, ".git", "info", "exclude"), "# opencode-coder stealth mode\n.coder/\n", "utf-8");

      const service = createService(workdir);
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") return "/usr/local/bin/bd" as any;
        if (cmd === "command -v aimgr") {
          const err = Object.assign(new Error("aimgr not found"), { code: "ENOENT" });
          throw err;
        }
        return "" as any;
      });

      expect(() => service.detectAndWrite(versionInfo as any, undefined as any)).toThrow();

      execSyncSpy.mockRestore();
    });

    it("uses startupMode override and resourcesHealthyOverride in final context", () => {
      const workdir = createTempWorkdir("project-detector-detect-and-write-");
      mkdirSync(join(workdir, ".git"), { recursive: true });
      mkdirSync(join(workdir, ".beads"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "commands", "opencode-coder"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "skills", "coder-core"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "skills", "coder-beads"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "agents"), { recursive: true });
      writeFileSync(join(workdir, ".opencode", "commands", "opencode-coder", "init.md"), "# init\n", "utf-8");
      writeFileSync(join(workdir, ".opencode", "skills", "coder-core", "SKILL.md"), "# skill\n", "utf-8");
      writeFileSync(join(workdir, ".opencode", "skills", "coder-beads", "SKILL.md"), "# skill\n", "utf-8");
      writeFileSync(join(workdir, ".opencode", "agents", "orchestrator.md"), "# orchestrator\n", "utf-8");
      writeFileSync(join(workdir, "ai.package.yaml"), "resources: []\n", "utf-8");

      const service = createService(workdir);
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") return "/usr/local/bin/bd" as any;
        if (cmd === "command -v aimgr") return "/usr/local/bin/aimgr" as any;
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
      expect(result.coreAvailable).toBe(true);
      expect(result.bootstrapRequired).toBe(false);
      expect(result.beadsReady).toBe(true);
      expect(result.runtimePhase.phase).toBe("normal");

      const yaml = readFileSync(join(workdir, ".coder", "project.yaml"), "utf-8");
      expect(yaml).toContain("mode: team");
      expect(yaml).toContain("coreAvailable: true");
      expect(yaml).toContain("bootstrapRequired: false");
      expect(yaml).toContain("beadsReady: true");
      expect(yaml).toContain("pluginVersion: 1.2.3");

      execSyncSpy.mockRestore();
    });

    it("assembleContext() builds project context from explicit facts and startup mode", () => {
      const workdir = createTempWorkdir("project-detector-assemble-context-");
      const service = createService(workdir);
      const facts: ProjectDetectionFacts = {
        gitInitialized: true,
        beadsInitialized: true,
        stealthMode: false,
        bdCliInstalled: true,
        aimgrInstalled: true,
        packageYaml: true,
        resourcesHealthy: true,
        runtimePhase: {
          phase: "normal",
          coreAvailable: true,
          bootstrapRequired: false,
          missingRequiredSurfaces: [],
          shouldExposeBootstrapInit: false,
        },
        coderBeadsSkillAvailable: true,
        orchestratorAgentAvailable: true,
        beadsReady: true,
      };

      const context = service.assembleContext({
        startupMode: "team",
        versionInfo: versionInfo as any,
        facts,
      });

      expect(context.mode).toBe("team");
      expect(context.beadsReady).toBe(true);
      expect(context.runtimePhase.phase).toBe("normal");
      expect(context.aimgr.resourcesHealthy).toBe(true);
    });

    it("collectFacts() keeps readiness/resource checks local and honors resourcesHealthyOverride", () => {
      const workdir = createTempWorkdir("project-detector-collect-facts-");
      mkdirSync(join(workdir, ".git"), { recursive: true });
      mkdirSync(join(workdir, ".beads"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "commands", "opencode-coder"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "skills", "coder-core"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "skills", "coder-beads"), { recursive: true });
      mkdirSync(join(workdir, ".opencode", "agents"), { recursive: true });
      writeFileSync(join(workdir, ".opencode", "commands", "opencode-coder", "init.md"), "# init\n", "utf-8");
      writeFileSync(join(workdir, ".opencode", "skills", "coder-core", "SKILL.md"), "# skill\n", "utf-8");
      writeFileSync(join(workdir, ".opencode", "skills", "coder-beads", "SKILL.md"), "# skill\n", "utf-8");
      writeFileSync(join(workdir, ".opencode", "agents", "orchestrator.md"), "# orchestrator\n", "utf-8");

      const service = createService(workdir);
      const detectResourcesHealthySpy = spyOn(service, "detectResourcesHealthy").mockImplementation(() => {
        throw new Error("detectResourcesHealthy should not run when override is provided");
      });
      const execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (cmd === "command -v bd") return "/usr/local/bin/bd" as any;
        if (cmd === "command -v aimgr") return "/usr/local/bin/aimgr" as any;
        return "" as any;
      });

      const facts = service.collectFacts({ resourcesHealthyOverride: true });

      expect(facts.runtimePhase.phase).toBe("normal");
      expect(facts.beadsReady).toBe(true);
      expect(facts.resourcesHealthy).toBe(true);

      execSyncSpy.mockRestore();
      detectResourcesHealthySpy.mockRestore();
    });

    it("collectFacts() marks beadsReady=false when any readiness requirement is missing", () => {
      const workdir = createTempWorkdir("project-detector-collect-facts-partial-");
      const service = createService(workdir);

      const detectGitInitializedSpy = spyOn(service, "detectGitInitialized").mockReturnValue(true);
      const detectBeadsInitializedSpy = spyOn(service, "detectBeadsInitialized").mockReturnValue(true);
      const detectStealthModeSpy = spyOn(service, "detectStealthMode").mockReturnValue(false);
      const detectBdCliInstalledSpy = spyOn(service, "detectBdCliInstalled").mockReturnValue(false);
      const detectAimgrInstalledSpy = spyOn(service, "detectAimgrInstalled").mockReturnValue(true);
      const detectPackageYamlSpy = spyOn(service, "detectPackageYaml").mockReturnValue(true);
      const detectResourcesHealthySpy = spyOn(service, "detectResourcesHealthy").mockReturnValue(true);
      const classifyRuntimePhaseSpy = spyOn(service, "classifyRuntimePhase").mockReturnValue({
        phase: "normal",
        coreAvailable: true,
        bootstrapRequired: false,
        missingRequiredSurfaces: [],
        shouldExposeBootstrapInit: false,
      });

      const facts = service.collectFacts();

      expect(facts.resourcesHealthy).toBe(true);
      expect(facts.beadsReady).toBe(false);
      expect(facts.bdCliInstalled).toBe(false);

      detectGitInitializedSpy.mockRestore();
      detectBeadsInitializedSpy.mockRestore();
      detectStealthModeSpy.mockRestore();
      detectBdCliInstalledSpy.mockRestore();
      detectAimgrInstalledSpy.mockRestore();
      detectPackageYamlSpy.mockRestore();
      detectResourcesHealthySpy.mockRestore();
      classifyRuntimePhaseSpy.mockRestore();
    });

    it("assembleContext() keeps startup mode as authoritative over detected stealth marker", () => {
      const workdir = createTempWorkdir("project-detector-assemble-mode-authority-");
      const service = createService(workdir);
      const facts: ProjectDetectionFacts = {
        gitInitialized: true,
        beadsInitialized: true,
        stealthMode: true,
        bdCliInstalled: true,
        aimgrInstalled: true,
        packageYaml: true,
        resourcesHealthy: true,
        runtimePhase: {
          phase: "normal",
          coreAvailable: true,
          bootstrapRequired: false,
          missingRequiredSurfaces: [],
          shouldExposeBootstrapInit: false,
        },
        coderBeadsSkillAvailable: true,
        orchestratorAgentAvailable: true,
        beadsReady: true,
      };

      const context = service.assembleContext({
        startupMode: "team",
        versionInfo: versionInfo as any,
        facts,
      });

      expect(context.mode).toBe("team");
      expect(context.beads.stealthMode).toBe(true);
      expect(context.beadsReady).toBe(true);
    });
  });
});
