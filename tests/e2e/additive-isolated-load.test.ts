import { $ } from "bun";
import { describe, expect, it } from "bun:test";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  checkHostToolPrerequisites,
  cleanupFixtureWorkspace,
  createFixtureWorkspace,
  createIsolatedOpenCodePaths,
  prependResolvedHostToolBinDirs,
} from "./helpers/harness";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const AI_RESOURCES_DIR = join(PROJECT_ROOT, "ai-resources");

const hostPrerequisites = await checkHostToolPrerequisites({ requireOpencode: false, requireAimgr: true });
if (!hostPrerequisites.available && hostPrerequisites.diagnostics) {
  throw new Error(hostPrerequisites.diagnostics);
}
prependResolvedHostToolBinDirs(hostPrerequisites.tools, {
  tools: ["opencode", "git", "aimgr"],
});

const aimgrCheck = hostPrerequisites.tools.find((tool) => tool.tool === "aimgr");

type AdditiveIsolatedLoadCase = {
  packageName: "coder-core" | "coder-beads" | "coder-docs" | "coder-support" | "code-simplify";
  expectedSkillName: string;
};

const ADDITIVE_ISOLATED_LOAD_CASES: AdditiveIsolatedLoadCase[] = [
  { packageName: "coder-core", expectedSkillName: "coder-core" },
  { packageName: "coder-beads", expectedSkillName: "coder-beads" },
  { packageName: "coder-docs", expectedSkillName: "coder-docs" },
  { packageName: "coder-support", expectedSkillName: "complexity-review" },
  { packageName: "code-simplify", expectedSkillName: "code-simplify" },
];

describe.skipIf(!aimgrCheck?.available)("additive isolated loadability", () => {
  for (const testCase of ADDITIVE_ISOLATED_LOAD_CASES) {
    it(`installs package/${testCase.packageName} from coder-skill-installed baseline without requiring root manifest edits`, async () => {
      const workspace = await createFixtureWorkspace("coder-skill-installed");

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

        const installResult = await $`aimgr install package/${testCase.packageName}`
          .cwd(workspace.workdir)
          .env(isolatedEnv)
          .quiet();
        expect(installResult.exitCode).toBe(0);

        const installStderr = installResult.stderr.toString().toLowerCase();
        expect(installStderr).not.toContain("author identity unknown");

        const skillPath = join(workspace.workdir, ".opencode", "skills", testCase.expectedSkillName, "SKILL.md");
        const installedSkill = await readFile(skillPath, "utf8");
        expect(installedSkill).toContain(`name: ${testCase.expectedSkillName}`);

        const opencodeCoderSkillPath = join(workspace.workdir, ".opencode", "skills", "opencode-coder", "SKILL.md");
        const opencodeCoderSkill = await Bun.file(opencodeCoderSkillPath).exists();
        expect(opencodeCoderSkill).toBe(false);

        const rootManifest = await readFile(join(PROJECT_ROOT, "ai.package.yaml"), "utf8");
        expect(rootManifest).toContain("package/coder-core");
        expect(rootManifest).toContain("package/coder-beads");
        expect(rootManifest).toContain("package/coder-docs");
        expect(rootManifest).toContain("package/coder-support");
        expect(rootManifest).toContain("package/code-simplify");
        expect(rootManifest).toContain("package/opencode-coder");
      } finally {
        await cleanupFixtureWorkspace(workspace);
      }
    }, 120000);
  }
});
