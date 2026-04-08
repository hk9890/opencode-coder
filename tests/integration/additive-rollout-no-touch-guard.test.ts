import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");

describe("additive rollout no-touch guard", () => {
  it("keeps root ai.package.yaml free of standalone additive rollout resources", () => {
    const rootPackageYaml = readFileSync(join(PROJECT_ROOT, "ai.package.yaml"), "utf8");

    expect(rootPackageYaml).toContain("package/opencode-coder");
    expect(rootPackageYaml).not.toContain("package/coder-beads");
    expect(rootPackageYaml).not.toContain("skill/coder-beads");
    expect(rootPackageYaml).not.toContain("package/coder-core");
    expect(rootPackageYaml).not.toContain("skill/coder-core");
    expect(rootPackageYaml).not.toContain("package/coder-docs");
    expect(rootPackageYaml).not.toContain("skill/coder-docs");
  });

  it("keeps opencode-coder package surface constrained to intentional additive inclusions", () => {
    const packageManifest = JSON.parse(
      readFileSync(join(PROJECT_ROOT, "ai-resources", "packages", "opencode-coder.package.json"), "utf8")
    ) as { resources?: string[] };

    const resources = packageManifest.resources ?? [];
    expect(resources).toContain("skill/opencode-coder");
    expect(resources).toContain("skill/code-simplify");
    expect(resources).not.toContain("skill/coder-beads");
    expect(resources).not.toContain("package/coder-beads");
    expect(resources).not.toContain("skill/coder-core");
    expect(resources).not.toContain("package/coder-core");
    expect(resources).not.toContain("skill/coder-docs");
    expect(resources).not.toContain("package/coder-docs");
  });
});
