import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");

describe("additive rollout no-touch guard", () => {
  it("keeps root ai.package.yaml free of standalone coder-beads resources", () => {
    const rootPackageYaml = readFileSync(join(PROJECT_ROOT, "ai.package.yaml"), "utf8");

    expect(rootPackageYaml).toContain("package/opencode-coder");
    expect(rootPackageYaml).not.toContain("package/coder-beads");
    expect(rootPackageYaml).not.toContain("skill/coder-beads");
  });

  it("keeps existing opencode-coder package surface unchanged by additive coder-beads", () => {
    const packageManifest = JSON.parse(
      readFileSync(join(PROJECT_ROOT, "ai-resources", "packages", "opencode-coder.package.json"), "utf8")
    ) as { resources?: string[] };

    const resources = packageManifest.resources ?? [];
    expect(resources).toContain("skill/opencode-coder");
    expect(resources).not.toContain("skill/coder-beads");
    expect(resources).not.toContain("package/coder-beads");
  });
});
