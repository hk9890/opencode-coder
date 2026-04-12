import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");

type SplitPackageCase = {
  packageName: "coder-core" | "coder-beads" | "coder-docs" | "code-simplify";
  requiredResources: string[];
};

const SPLIT_PACKAGE_CASES: SplitPackageCase[] = [
  {
    packageName: "coder-core",
    requiredResources: [
      "skill/coder-core",
      "command/opencode-coder/init",
      "command/opencode-coder/status",
      "command/opencode-coder/doctor",
      "command/opencode-coder/report-bug",
      "command/opencode-coder/dump-session",
    ],
  },
  {
    packageName: "coder-beads",
    requiredResources: [
      "skill/coder-beads",
      "agent/orchestrator",
      "agent/reviewer",
      "agent/tasker",
      "agent/verifier",
    ],
  },
  {
    packageName: "coder-docs",
    requiredResources: [
      "skill/coder-docs",
      "command/opencode-coder/init-or-update-docs",
      "command/opencode-coder/improve-doc",
    ],
  },
  {
    packageName: "code-simplify",
    requiredResources: ["skill/code-simplify", "command/simplify"],
  },
];

describe("split capability package ownership", () => {
  for (const testCase of SPLIT_PACKAGE_CASES) {
    it(`package/${testCase.packageName} owns expected split resources`, () => {
      const manifestPath = join(PROJECT_ROOT, "ai-resources", "packages", `${testCase.packageName}.package.json`);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
        resources?: string[];
      };

      expect(manifest.name).toBe(testCase.packageName);
      expect(manifest.resources).toEqual(testCase.requiredResources);
    });
  }

  it("root ai.package.yaml uses split packages and no combined package", () => {
    const rootPackageYaml = readFileSync(join(PROJECT_ROOT, "ai.package.yaml"), "utf8");

    expect(rootPackageYaml).toContain("package/coder-core");
    expect(rootPackageYaml).toContain("package/coder-beads");
    expect(rootPackageYaml).toContain("package/coder-docs");
    expect(rootPackageYaml).toContain("package/code-simplify");

    expect(rootPackageYaml).not.toContain("- package/opencode-coder\n");
    expect(rootPackageYaml).not.toContain("- skill/opencode-coder\n");
  });

  it("does not ship legacy combined package manifest", () => {
    const combinedManifestPath = join(PROJECT_ROOT, "ai-resources", "packages", "opencode-coder.package.json");
    expect(existsSync(combinedManifestPath)).toBe(false);
  });
});
