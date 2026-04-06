import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");

describe("coder-beads additive integration surface", () => {
  it("ships a standalone package manifest that exposes only skill/coder-beads", () => {
    const manifestPath = join(PROJECT_ROOT, "ai-resources", "packages", "coder-beads.package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      resources?: string[];
    };

    expect(manifest.name).toBe("coder-beads");
    expect(manifest.resources).toEqual(["skill/coder-beads"]);
  });

  it("loads coder-beads skill entry and references via deterministic local paths", () => {
    const skillDir = join(PROJECT_ROOT, "ai-resources", "skills", "coder-beads");
    const skillEntryPath = join(skillDir, "SKILL.md");
    const referencesDir = join(skillDir, "references");
    const skillEntry = readFileSync(skillEntryPath, "utf8");
    const referenceFiles = readdirSync(referencesDir).filter((name) => name.endsWith(".md")).sort();

    expect(existsSync(skillDir)).toBe(true);
    expect(existsSync(skillEntryPath)).toBe(true);
    expect(skillEntry).toContain("name: coder-beads");
    expect(skillEntry).toContain("references/planning.md");
    expect(skillEntry).toContain("references/beads-issue-workflow.md");

    expect(referenceFiles.length).toBeGreaterThan(0);
    expect(referenceFiles).toContain("planning.md");
    expect(referenceFiles).toContain("beads-issue-workflow.md");
  });

  it("coexists with unchanged combined opencode-coder skill path", () => {
    const combinedSkillPath = join(PROJECT_ROOT, "ai-resources", "skills", "opencode-coder", "SKILL.md");
    const combinedSkill = readFileSync(combinedSkillPath, "utf8");
    const beadsSkill = readFileSync(join(PROJECT_ROOT, "ai-resources", "skills", "coder-beads", "SKILL.md"), "utf8");

    expect(existsSync(combinedSkillPath)).toBe(true);
    expect(combinedSkill).toContain("name: opencode-coder");
    expect(combinedSkill).toContain("references/planning.md");

    expect(beadsSkill).toContain("name: coder-beads");
    expect(beadsSkill).not.toContain("name: opencode-coder");
  });
});
