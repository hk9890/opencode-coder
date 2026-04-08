import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");

describe("code-simplify additive integration surface", () => {
  it("ships a standalone package manifest that exposes only skill/code-simplify", () => {
    const manifestPath = join(PROJECT_ROOT, "ai-resources", "packages", "code-simplify.package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      resources?: string[];
    };

    expect(manifest.name).toBe("code-simplify");
    expect(manifest.resources).toEqual(["skill/code-simplify"]);
  });

  it("loads code-simplify skill entry and references via deterministic local paths", () => {
    const skillDir = join(PROJECT_ROOT, "ai-resources", "skills", "code-simplify");
    const skillEntryPath = join(skillDir, "SKILL.md");
    const referencesDir = join(skillDir, "references");
    const skillEntry = readFileSync(skillEntryPath, "utf8");
    const referenceFiles = readdirSync(referencesDir).filter((name) => name.endsWith(".md")).sort();

    expect(existsSync(skillDir)).toBe(true);
    expect(existsSync(skillEntryPath)).toBe(true);
    expect(skillEntry).toContain("name: code-simplify");
    expect(skillEntry).toContain("references/simplify.md");

    expect(referenceFiles.length).toBeGreaterThan(0);
    expect(referenceFiles).toContain("simplify.md");
  });

  it("coexists with the combined opencode-coder skill via delegated simplify routing", () => {
    const combinedSkillPath = join(PROJECT_ROOT, "ai-resources", "skills", "opencode-coder", "SKILL.md");
    const combinedSkill = readFileSync(combinedSkillPath, "utf8");
    const simplifySkill = readFileSync(join(PROJECT_ROOT, "ai-resources", "skills", "code-simplify", "SKILL.md"), "utf8");

    expect(existsSync(combinedSkillPath)).toBe(true);
    expect(combinedSkill).toContain("name: opencode-coder");
    expect(combinedSkill).toContain("Use standalone [code-simplify]");

    expect(simplifySkill).toContain("name: code-simplify");
    expect(simplifySkill).not.toContain("name: opencode-coder");
  });
});
