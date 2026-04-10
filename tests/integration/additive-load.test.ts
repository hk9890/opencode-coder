import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");

type AdditiveIntegrationCase = {
  packageName: "coder-core" | "coder-beads" | "coder-docs" | "code-simplify";
  requiredSkillEntrySnippets: string[];
  requiredReferenceFiles: string[];
  combinedSkillRequiredSnippets: string[];
  forbiddenSkillEntrySnippets?: string[];
};

const ADDITIVE_INTEGRATION_CASES: AdditiveIntegrationCase[] = [
  {
    packageName: "coder-core",
    requiredSkillEntrySnippets: ["name: coder-core", "references/installation-setup.md", "references/mode-runtime.md"],
    requiredReferenceFiles: ["installation-setup.md", "mode-runtime.md"],
    combinedSkillRequiredSnippets: ["name: opencode-coder"],
    forbiddenSkillEntrySnippets: ["references/simplify.md"],
  },
  {
    packageName: "coder-beads",
    requiredSkillEntrySnippets: ["name: coder-beads", "references/planning.md", "references/beads-issue-workflow.md"],
    requiredReferenceFiles: ["planning.md", "beads-issue-workflow.md"],
    combinedSkillRequiredSnippets: ["name: opencode-coder", "references/planning.md"],
  },
  {
    packageName: "coder-docs",
    requiredSkillEntrySnippets: ["name: coder-docs", "references/project-setup.md", "references/project-doc-review-guidelines.md"],
    requiredReferenceFiles: ["project-setup.md", "project-doc-guidelines.md", "project-doc-review-guidelines.md"],
    combinedSkillRequiredSnippets: ["name: opencode-coder", "references/project-docs-lifecycle.md"],
  },
  {
    packageName: "code-simplify",
    requiredSkillEntrySnippets: ["name: code-simplify", "references/simplify.md"],
    requiredReferenceFiles: ["simplify.md"],
    combinedSkillRequiredSnippets: ["name: opencode-coder", "Use standalone [code-simplify]"],
  },
];

describe("additive integration surface", () => {
  for (const testCase of ADDITIVE_INTEGRATION_CASES) {
    const { packageName } = testCase;

    it(`ships standalone package/${packageName} manifest exposing only skill/${packageName}`, () => {
      const manifestPath = join(PROJECT_ROOT, "ai-resources", "packages", `${packageName}.package.json`);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
        resources?: string[];
      };

      expect(manifest.name).toBe(packageName);
      expect(manifest.resources).toEqual([`skill/${packageName}`]);
    });

    it(`loads ${packageName} skill entry and references through deterministic local paths`, () => {
      const skillDir = join(PROJECT_ROOT, "ai-resources", "skills", packageName);
      const skillEntryPath = join(skillDir, "SKILL.md");
      const referencesDir = join(skillDir, "references");
      const skillEntry = readFileSync(skillEntryPath, "utf8");
      const referenceFiles = readdirSync(referencesDir).filter((name) => name.endsWith(".md")).sort();

      expect(existsSync(skillDir)).toBe(true);
      expect(existsSync(skillEntryPath)).toBe(true);
      expect(referenceFiles.length).toBeGreaterThan(0);

      for (const snippet of testCase.requiredSkillEntrySnippets) {
        expect(skillEntry).toContain(snippet);
      }

      for (const fileName of testCase.requiredReferenceFiles) {
        expect(referenceFiles).toContain(fileName);
      }

      for (const forbiddenSnippet of testCase.forbiddenSkillEntrySnippets ?? []) {
        expect(skillEntry).not.toContain(forbiddenSnippet);
      }
    });

    it(`keeps ${packageName} additive skill coexistence with combined opencode-coder skill`, () => {
      const combinedSkillPath = join(PROJECT_ROOT, "ai-resources", "skills", "opencode-coder", "SKILL.md");
      const combinedSkill = readFileSync(combinedSkillPath, "utf8");
      const additiveSkill = readFileSync(join(PROJECT_ROOT, "ai-resources", "skills", packageName, "SKILL.md"), "utf8");

      expect(existsSync(combinedSkillPath)).toBe(true);
      for (const snippet of testCase.combinedSkillRequiredSnippets) {
        expect(combinedSkill).toContain(snippet);
      }

      expect(additiveSkill).toContain(`name: ${packageName}`);
      expect(additiveSkill).not.toContain("name: opencode-coder");
    });
  }
});
