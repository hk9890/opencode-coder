import { $ } from "bun";
import { describe, expect, it } from "bun:test";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  checkAimgrAvailability,
  cleanupFixtureWorkspace,
  createFixtureWorkspace,
  createIsolatedOpenCodePaths,
} from "./helpers/harness";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const AI_RESOURCES_DIR = join(PROJECT_ROOT, "ai-resources");

const aimgrCheck = await checkAimgrAvailability();

describe.skipIf(!aimgrCheck.available)("coder-core additive isolated loadability", () => {
  it("installs package/coder-core into an isolated workspace without changing root manifest", async () => {
    const workspace = await createFixtureWorkspace("existing-active-project");

    try {
      const isolatedPaths = await createIsolatedOpenCodePaths(workspace.tempRoot);
      const isolatedEnv = {
        ...process.env,
        ...isolatedPaths.env,
      };

      const workspacePackageYaml = await Bun.file(join(workspace.workdir, "ai.package.yaml")).exists();
      if (!workspacePackageYaml) {
        const initResult = await $`aimgr init`.cwd(workspace.workdir).env(isolatedEnv).quiet();
        expect(initResult.exitCode).toBe(0);
      }

      const repoAddResult = await $`aimgr repo add local:${AI_RESOURCES_DIR}`.cwd(workspace.workdir).env(isolatedEnv).quiet();
      expect(repoAddResult.exitCode).toBe(0);
      expect(repoAddResult.stderr.toString().toLowerCase()).not.toContain("author identity unknown");

      const installResult = await $`aimgr install package/coder-core`.cwd(workspace.workdir).env(isolatedEnv).quiet();
      expect(installResult.exitCode).toBe(0);
      expect(installResult.stderr.toString().toLowerCase()).not.toContain("author identity unknown");

      const skillPath = join(workspace.workdir, ".opencode", "skills", "coder-core", "SKILL.md");
      const installedSkill = await readFile(skillPath, "utf8");
      expect(installedSkill).toContain("name: coder-core");

      const opencodeCoderSkillPath = join(workspace.workdir, ".opencode", "skills", "opencode-coder", "SKILL.md");
      const opencodeCoderSkill = await Bun.file(opencodeCoderSkillPath).exists();
      expect(opencodeCoderSkill).toBe(false);

      const rootManifest = await readFile(join(PROJECT_ROOT, "ai.package.yaml"), "utf8");
      expect(rootManifest).not.toContain("package/coder-core");
    } finally {
      await cleanupFixtureWorkspace(workspace);
    }
  }, 120000);
});
