import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");

describe("coder-core additive integration surface", () => {
  it("ships a standalone package manifest that exposes only skill/coder-core", () => {
    const manifestPath = join(PROJECT_ROOT, "ai-resources", "packages", "coder-core.package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      resources?: string[];
    };

    expect(manifest.name).toBe("coder-core");
    expect(manifest.resources).toEqual(["skill/coder-core"]);
  });

  it("loads coder-core skill entry and references through deterministic local paths", () => {
    const skillDir = join(PROJECT_ROOT, "ai-resources", "skills", "coder-core");
    const skillEntryPath = join(skillDir, "SKILL.md");
    const referencesDir = join(skillDir, "references");
    const skillEntry = readFileSync(skillEntryPath, "utf8");
    const referenceFiles = readdirSync(referencesDir).filter((name) => name.endsWith(".md")).sort();

    expect(existsSync(skillDir)).toBe(true);
    expect(existsSync(skillEntryPath)).toBe(true);
    expect(skillEntry).toContain("name: coder-core");
    expect(skillEntry).toContain("references/installation-setup.md");
    expect(skillEntry).toContain("references/mode-runtime.md");

    expect(referenceFiles.length).toBeGreaterThan(0);
    expect(referenceFiles).toContain("installation-setup.md");
    expect(referenceFiles).toContain("mode-runtime.md");
  });

  it("coexists with the combined opencode-coder skill without replacing it", () => {
    const combinedSkillPath = join(PROJECT_ROOT, "ai-resources", "skills", "opencode-coder", "SKILL.md");
    const combinedSkill = readFileSync(combinedSkillPath, "utf8");
    const coreSkill = readFileSync(join(PROJECT_ROOT, "ai-resources", "skills", "coder-core", "SKILL.md"), "utf8");

    expect(existsSync(combinedSkillPath)).toBe(true);
    expect(combinedSkill).toContain("name: opencode-coder");

    expect(coreSkill).toContain("name: coder-core");
    expect(coreSkill).not.toContain("name: opencode-coder");
  });
});
