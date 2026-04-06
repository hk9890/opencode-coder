import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");

describe("coder-docs additive integration surface", () => {
  it("ships a standalone package manifest that exposes only skill/coder-docs", () => {
    const manifestPath = join(PROJECT_ROOT, "ai-resources", "packages", "coder-docs.package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      resources?: string[];
    };

    expect(manifest.name).toBe("coder-docs");
    expect(manifest.resources).toEqual(["skill/coder-docs"]);
  });

  it("loads coder-docs skill entry and references via deterministic local paths", () => {
    const skillDir = join(PROJECT_ROOT, "ai-resources", "skills", "coder-docs");
    const skillEntryPath = join(skillDir, "SKILL.md");
    const referencesDir = join(skillDir, "references");
    const skillEntry = readFileSync(skillEntryPath, "utf8");
    const referenceFiles = readdirSync(referencesDir).filter((name) => name.endsWith(".md")).sort();

    expect(existsSync(skillDir)).toBe(true);
    expect(existsSync(skillEntryPath)).toBe(true);
    expect(skillEntry).toContain("name: coder-docs");
    expect(skillEntry).toContain("references/project-setup.md");
    expect(skillEntry).toContain("references/project-doc-review-guidelines.md");

    expect(referenceFiles.length).toBeGreaterThan(0);
    expect(referenceFiles).toContain("project-setup.md");
    expect(referenceFiles).toContain("project-doc-guidelines.md");
    expect(referenceFiles).toContain("project-doc-review-guidelines.md");
  });

  it("coexists with unchanged combined opencode-coder skill path", () => {
    const combinedSkillPath = join(PROJECT_ROOT, "ai-resources", "skills", "opencode-coder", "SKILL.md");
    const combinedSkill = readFileSync(combinedSkillPath, "utf8");
    const docsSkill = readFileSync(join(PROJECT_ROOT, "ai-resources", "skills", "coder-docs", "SKILL.md"), "utf8");

    expect(existsSync(combinedSkillPath)).toBe(true);
    expect(combinedSkill).toContain("name: opencode-coder");
    expect(combinedSkill).toContain("references/project-docs-lifecycle.md");

    expect(docsSkill).toContain("name: coder-docs");
    expect(docsSkill).not.toContain("name: opencode-coder");
  });
});
