import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const COMMANDS_DIR = join(PROJECT_ROOT, "ai-resources", "commands", "opencode-coder");
const PACKAGE_PATH = join(PROJECT_ROOT, "ai-resources", "packages", "opencode-coder.package.json");

describe("docs lifecycle command contracts", () => {
  it("publishes docs lifecycle commands and excludes legacy update-agent-md", () => {
    const packageSpec = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as { resources: string[] };

    expect(packageSpec.resources).toContain("command/opencode-coder/init-or-update-docs");
    expect(packageSpec.resources).toContain("command/opencode-coder/improve-doc");
    expect(packageSpec.resources).not.toContain("command/opencode-coder/update-agent-md");
  });

  it("keeps docs lifecycle command files and removes legacy command file", () => {
    expect(existsSync(join(COMMANDS_DIR, "init-or-update-docs.md"))).toBe(true);
    expect(existsSync(join(COMMANDS_DIR, "improve-doc.md"))).toBe(true);
    expect(existsSync(join(COMMANDS_DIR, "docs.md"))).toBe(false);
    expect(existsSync(join(COMMANDS_DIR, "update-agent-md.md"))).toBe(false);
  });
});
