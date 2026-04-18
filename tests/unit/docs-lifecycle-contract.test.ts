import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const COMMANDS_DIR = join(PROJECT_ROOT, "ai-resources", "commands", "opencode-coder");
const DOCS_PACKAGE_PATH = join(PROJECT_ROOT, "ai-resources", "packages", "coder-docs.package.json");
const LEGACY_PACKAGE_PATH = join(PROJECT_ROOT, "ai-resources", "packages", "opencode-coder.package.json");
const INIT_COMMAND_PATH = join(PROJECT_ROOT, "ai-resources", "commands", "opencode-coder", "init.md");
const CODER_CORE_SKILL_PATH = join(PROJECT_ROOT, "ai-resources", "skills", "coder-core", "SKILL.md");
const CODER_DOCS_SKILL_PATH = join(PROJECT_ROOT, "ai-resources", "skills", "coder-docs", "SKILL.md");
const CORE_INIT_DISPATCH_REFERENCE_PATH = join(
  PROJECT_ROOT,
  "ai-resources",
  "skills",
  "coder-core",
  "references",
  "init-dispatch.md"
);
const DOCS_INIT_REFERENCE_PATH = join(
  PROJECT_ROOT,
  "ai-resources",
  "skills",
  "coder-docs",
  "references",
  "docs-init.md"
);

describe("docs lifecycle command contracts", () => {
  it("publishes docs lifecycle commands from split docs package and excludes legacy update-agent-md", () => {
    const packageSpec = JSON.parse(readFileSync(DOCS_PACKAGE_PATH, "utf8")) as { resources: string[] };

    expect(packageSpec.resources).toContain("command/opencode-coder/init-or-update-docs");
    expect(packageSpec.resources).toContain("command/opencode-coder/improve-doc");
    expect(packageSpec.resources).not.toContain("command/opencode-coder/update-agent-md");
  });

  it("keeps the legacy combined package manifest for backward compatibility", () => {
    expect(existsSync(LEGACY_PACKAGE_PATH)).toBe(true);
  });

  it("keeps docs lifecycle command files and removes legacy command file", () => {
    expect(existsSync(join(COMMANDS_DIR, "init-or-update-docs.md"))).toBe(true);
    expect(existsSync(join(COMMANDS_DIR, "improve-doc.md"))).toBe(true);
    expect(existsSync(join(COMMANDS_DIR, "docs.md"))).toBe(false);
    expect(existsSync(join(COMMANDS_DIR, "update-agent-md.md"))).toBe(false);
  });

  it("documents /opencode-coder/init as resource-backed command, not plugin bootstrap detector", () => {
    const initCommand = readFileSync(INIT_COMMAND_PATH, "utf8");

    expect(initCommand).toContain("Run the init/enablement workflow.");
    expect(initCommand).not.toContain("two-pass workflow");
  });

  it("keeps coder-core SKILL routing-focused and moves detailed init dispatch to references", () => {
    const coreSkill = readFileSync(CODER_CORE_SKILL_PATH, "utf8");
    const coreInitDispatchReference = readFileSync(CORE_INIT_DISPATCH_REFERENCE_PATH, "utf8");

    expect(coreSkill).toContain("Initialize and set up opencode-coder for a project");
    expect(coreSkill).toContain("references/init-dispatch.md");
    expect(coreSkill).not.toContain("Installed-skill init dispatch");

    expect(coreInitDispatchReference).toContain("Initialize and Set Up opencode-coder");
    expect(coreInitDispatchReference).toContain("installed skills whose names start with `coder-`");
    expect(coreInitDispatchReference).toContain("Determine which of those skills define initialization or setup workflows");
    expect(coreInitDispatchReference).toContain("Determine a logical order for initializing those skills");
    expect(coreInitDispatchReference).not.toContain("Related setup workflows");
  });

  it("keeps coder-docs SKILL concise and routes mode-aware init contract to references", () => {
    const docsSkill = readFileSync(CODER_DOCS_SKILL_PATH, "utf8");
    const docsInitReference = readFileSync(DOCS_INIT_REFERENCE_PATH, "utf8");

    expect(docsSkill).toContain("Initialize and set up project docs");
    expect(docsSkill).toContain("references/docs-init.md");
    expect(docsSkill).not.toContain("Run docs init workflow when dispatched");

    expect(docsInitReference).toContain("Initialize and Set Up Project Docs");
    expect(docsInitReference).toContain("team");
    expect(docsInitReference).toContain("stealth");
    expect(docsInitReference).toContain("Only create or update the docs and routing files");
  });
});
