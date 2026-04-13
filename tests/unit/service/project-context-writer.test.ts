import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ProjectContextWriter } from "../../../src/service/project-context-writer";
import type { ProjectContext } from "../../../src/service/project-detector-service";
import { createMockLogger } from "../../helpers/mock-logger";

const tempDirs: string[] = [];

function createTempWorkdir(prefix: string): string {
  const workdir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(workdir);
  return workdir;
}

function createProjectContextFixture(overrides?: Partial<ProjectContext>): ProjectContext {
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
    aimgr: { installed: true, packageYaml: true, resourcesHealthy: true },
    pluginVersion: "1.0.0",
    runtimePhase: {
      phase: "normal",
      coreAvailable: true,
      bootstrapRequired: false,
      missingRequiredSurfaces: [],
      shouldExposeBootstrapInit: false,
    },
    ...overrides,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("ProjectContextWriter", () => {
  it("write() creates .coder files and writes expected yaml", () => {
    const workdir = createTempWorkdir("project-context-writer-");
    const writer = new ProjectContextWriter({ logger: createMockLogger(), workdir });

    const context = createProjectContextFixture({
      mode: "stealth",
      coreAvailable: false,
      bootstrapRequired: true,
      beadsReady: false,
      pluginVersion: "2.3.4",
      beads: {
        initialized: true,
        stealthMode: true,
        bdCliInstalled: false,
        coderBeadsSkillAvailable: false,
        orchestratorAgentAvailable: false,
      },
      runtimePhase: {
        phase: "bootstrap",
        coreAvailable: false,
        bootstrapRequired: true,
        missingRequiredSurfaces: ["command/opencode-coder/init", "skill/coder-core"],
        shouldExposeBootstrapInit: true,
      },
    });

    writer.write(context);

    const coderDir = join(workdir, ".coder");
    const gitignorePath = join(coderDir, ".gitignore");
    const projectYamlPath = join(coderDir, "project.yaml");

    expect(existsSync(coderDir)).toBe(true);
    expect(readFileSync(gitignorePath, "utf-8")).toBe("*\n");

    const yaml = readFileSync(projectYamlPath, "utf-8");
    expect(yaml).toContain("mode: stealth");
    expect(yaml).toContain("coreAvailable: false");
    expect(yaml).toContain("bootstrapRequired: true");
    expect(yaml).toContain("beadsReady: false");
    expect(yaml).toContain("stealthMode: true");
    expect(yaml).toContain("bdCliInstalled: false");
    expect(yaml).toContain("pluginVersion: 2.3.4");
    expect(yaml).toContain("phase: bootstrap");
    expect(yaml).toContain("missingRequiredSurfaces:");
    expect(yaml).toContain("- command/opencode-coder/init");
    expect(yaml).toContain("- skill/coder-core");
  });

  it("write() does not overwrite existing .coder/.gitignore", () => {
    const workdir = createTempWorkdir("project-context-writer-gitignore-");
    const writer = new ProjectContextWriter({ logger: createMockLogger(), workdir });
    const coderDir = join(workdir, ".coder");
    mkdirSync(coderDir, { recursive: true });
    const gitignorePath = join(coderDir, ".gitignore");
    writeFileSync(gitignorePath, "# keep me\n", "utf-8");

    writer.write(createProjectContextFixture());

    expect(readFileSync(gitignorePath, "utf-8")).toBe("# keep me\n");
  });
});
