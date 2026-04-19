import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { checkHostToolPrerequisites, prependResolvedHostToolBinDirs } from "../e2e/helpers/harness";
import {
  getLauncherPreparedEnv,
  getPreservedRoot,
  proveLauncherStartupViability,
  runLauncher,
} from "../helpers/manual-launcher-harness";

const runtimeHostPrerequisites = await checkHostToolPrerequisites();
if (!runtimeHostPrerequisites.available && runtimeHostPrerequisites.diagnostics) {
  throw new Error(runtimeHostPrerequisites.diagnostics);
}

prependResolvedHostToolBinDirs(runtimeHostPrerequisites.tools, {
  tools: ["opencode", "git"],
});

describe("manual launcher runtime-integration", () => {
  it("avoids first-run migration log in fresh manual launcher invocations via prewarmed isolated data", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=command", "--fixture=empty-project", "--", "opencode", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Isolated OpenCode data prewarmed: yes (empty baseline copied)");
      expect(result.stdout).not.toContain("Performing one time database migration...");
      expect(result.stderr).not.toContain("Performing one time database migration...");

      preservedRoot = getPreservedRoot(result.stdout);
      const isolatedDb = Bun.file(join(preservedRoot, "isolated-opencode", "xdg-data", "opencode", "opencode.db"));
      expect(await isolatedDb.exists()).toBe(true);
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  }, 120000);

  it("proves launcher-prepared local-build environment can start server and return structured SDK response", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=command", "--fixture=empty-project", "--", "env"]);
      expect(result.exitCode).toBe(0);

      preservedRoot = getPreservedRoot(result.stdout);
      const seededCommandFile = Bun.file(join(preservedRoot, "project", ".opencode", "commands", "opencode-coder", "init.md"));
      expect(await seededCommandFile.exists()).toBe(false);

      const launcherEnv = await getLauncherPreparedEnv(result.stdout);
      await proveLauncherStartupViability(join(preservedRoot, "project"), launcherEnv);
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  }, 120000);

  it("proves launcher-prepared installed-configured environment can start server and return structured SDK response", async () => {
    const hostConfigRoot = await mkdtemp(join(tmpdir(), "opencode-coder-launcher-installed-source-viability-"));
    await writeFile(
      join(hostConfigRoot, "opencode.json"),
      JSON.stringify(
        {
          plugin: ["@dynatrace-oss/opencode-coder@0.34.2"],
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(
        ["--mode=command", "--fixture=empty-project", "--plugin-source=installed-configured", "--", "env"],
        { OPENCODE_CONFIG_DIR: hostConfigRoot, CI: "true" }
      );
      expect(result.exitCode).toBe(0);

      preservedRoot = getPreservedRoot(result.stdout);

      const launcherEnv = await getLauncherPreparedEnv(result.stdout);
      await proveLauncherStartupViability(join(preservedRoot, "project"), launcherEnv);
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
      await rm(hostConfigRoot, { recursive: true, force: true });
    }
  }, 120000);
});
