import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { collectDiagnosticsBundle } from "../../scripts/collect-diagnostics/collector";

const tempRoots: string[] = [];

function createTempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0, tempRoots.length)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("collectDiagnosticsBundle", () => {
  it("handles missing optional artifacts explicitly", async () => {
    const projectRoot = createTempRoot("opencode-coder-diagnostics-missing-");
    writeFileSync(
      join(projectRoot, "package.json"),
      JSON.stringify({ name: "test", version: "0.0.1" }, null, 2),
      "utf-8"
    );

    const result = await collectDiagnosticsBundle({
      projectRoot,
      outputDir: join(projectRoot, "out"),
      opencodeLogDir: join(projectRoot, "does-not-exist-opencode"),
      projectLogDir: join(projectRoot, "does-not-exist-project"),
      sessionID: "ses_missing",
      now: new Date("2026-03-23T11:22:33.000Z"),
    });

    expect(existsSync(result.bundleDir)).toBe(true);
    expect(existsSync(result.manifestPath)).toBe(true);
    expect(result.manifest.artifacts.projectContextYaml.status).toBe("missing");
    expect(result.manifest.artifacts.projectLocalLogs.status).toBe("missing");
    expect(result.manifest.artifacts.opencodeSessionIndex.status).toBe("missing");
    expect(result.manifest.artifacts.opencodeSessionExtract.status).toBe("missing");
    expect(result.manifest.artifacts.readme.status).toBe("included");
    expect(result.manifest.artifacts.projectLocalLogs.details).toContain("unavailable");
    expect(result.manifest.artifacts.opencodeSessionIndex.details).toContain("unavailable");
  });

  it("collects available artifacts and session extracts", async () => {
    const projectRoot = createTempRoot("opencode-coder-diagnostics-full-");
    writeFileSync(
      join(projectRoot, "package.json"),
      JSON.stringify({ name: "test", version: "1.2.3" }, null, 2),
      "utf-8"
    );

    mkdirSync(join(projectRoot, ".coder", "logs"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".coder", "project.yaml"),
      "mode: team\npluginVersion: 9.9.9\n",
      "utf-8"
    );
    writeFileSync(
      join(projectRoot, ".coder", "logs", "coder-2026-03-23.log"),
      '2026-03-23T10:40:00.123Z INFO [opencode-coder] (pid=1234) Runtime diagnostic signal extra={"sessionID":"ses_abc","signal":"runtime.project_context.available"}\n',
      "utf-8"
    );

    const opencodeLogDir = join(projectRoot, "opencode-logs");
    mkdirSync(opencodeLogDir, { recursive: true });
    writeFileSync(
      join(opencodeLogDir, "opencode.log"),
      "INFO  2026-03-23T10:40:01 +1ms pid=555 service=opencode-coder sessionID=ses_abc OpencodeCoder plugin loaded\n",
      "utf-8"
    );

    const sessionExportDir = join(projectRoot, "private", "session-dump", "ses_abc");
    mkdirSync(sessionExportDir, { recursive: true });
    writeFileSync(join(sessionExportDir, "session.json"), JSON.stringify({ id: "ses_abc" }), "utf-8");

    const result = await collectDiagnosticsBundle({
      projectRoot,
      outputDir: join(projectRoot, "out"),
      opencodeLogDir,
      sessionID: "ses_abc",
      sessionExportPaths: [sessionExportDir],
      now: new Date("2026-03-23T11:22:33.000Z"),
    });

    expect(result.manifest.pluginVersion.packageJson).toBe("1.2.3");
    expect(result.manifest.pluginVersion.projectContext).toBe("9.9.9");
    expect(result.manifest.artifacts.projectContextYaml.status).toBe("included");
    expect(result.manifest.artifacts.projectLocalLogs.status).toBe("included");
    expect(result.manifest.artifacts.sessionExports.status).toBe("included");
    expect(result.manifest.artifacts.opencodeSessionIndex.status).toBe("included");
    expect(result.manifest.artifacts.opencodeSessionExtract.status).toBe("included");
    expect(result.manifest.artifacts.projectLocalSessionExtract.status).toBe("included");
    expect(result.manifest.artifacts.readme.status).toBe("included");
    expect(result.manifest.artifacts.opencodeSessionExtract.count).toBeGreaterThan(0);
    expect(result.manifest.artifacts.projectLocalSessionExtract.count).toBeGreaterThan(0);
  });

  it("produces self-describing session extracts for both OpenCode and project-local sources", async () => {
    const projectRoot = createTempRoot("opencode-coder-diagnostics-dual-source-");
    writeFileSync(
      join(projectRoot, "package.json"),
      JSON.stringify({ name: "test", version: "2.0.0" }, null, 2),
      "utf-8"
    );

    const sessionID = "ses_dual";
    mkdirSync(join(projectRoot, ".coder", "logs"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".coder", "logs", "coder-2026-03-23.log"),
      `2026-03-23T10:40:00.123Z INFO [opencode-coder] (pid=1234) Runtime diagnostic signal extra={"sessionID":"${sessionID}","signal":"runtime.project_context.available"}\n`,
      "utf-8"
    );

    const opencodeLogDir = join(projectRoot, "opencode-logs");
    mkdirSync(opencodeLogDir, { recursive: true });
    writeFileSync(
      join(opencodeLogDir, "opencode.log"),
      `INFO  2026-03-23T10:40:01 +1ms pid=555 service=opencode-coder sessionID=${sessionID} OpencodeCoder plugin loaded\n`,
      "utf-8"
    );

    const result = await collectDiagnosticsBundle({
      projectRoot,
      outputDir: join(projectRoot, "out"),
      opencodeLogDir,
      sessionID,
      now: new Date("2026-03-23T11:22:33.000Z"),
    });

    const opencodeExtractPath = join(result.bundleDir, "logs", "opencode-session-extract.json");
    const projectLocalExtractPath = join(result.bundleDir, "logs", "project-local-session-extract.json");

    expect(existsSync(opencodeExtractPath)).toBe(true);
    expect(existsSync(projectLocalExtractPath)).toBe(true);

    const opencodeExtract = JSON.parse(await readFile(opencodeExtractPath, "utf-8")) as Array<{
      source?: string;
      sessionID?: string;
      service?: string;
    }>;
    const projectLocalExtract = JSON.parse(await readFile(projectLocalExtractPath, "utf-8")) as Array<{
      sourceFile?: string;
      service?: string;
      raw?: string;
    }>;

    expect(opencodeExtract.length).toBeGreaterThan(0);
    expect(opencodeExtract[0]?.source).toBe("opencode");
    expect(opencodeExtract[0]?.sessionID).toBe(sessionID);
    expect(opencodeExtract[0]?.service).toBe("opencode-coder");

    expect(projectLocalExtract.length).toBeGreaterThan(0);
    expect(projectLocalExtract[0]?.service).toBe("opencode-coder");
    expect(projectLocalExtract[0]?.sourceFile).toContain("coder-2026-03-23.log");
    expect(projectLocalExtract[0]?.raw).toContain("Runtime diagnostic signal");
  });

  it("keeps README artifact table consistent with manifest readme status", async () => {
    const projectRoot = createTempRoot("opencode-coder-diagnostics-readme-consistency-");
    writeFileSync(
      join(projectRoot, "package.json"),
      JSON.stringify({ name: "test", version: "1.0.0" }, null, 2),
      "utf-8"
    );

    const result = await collectDiagnosticsBundle({
      projectRoot,
      outputDir: join(projectRoot, "out"),
      opencodeLogDir: join(projectRoot, "does-not-exist-opencode"),
      projectLogDir: join(projectRoot, "does-not-exist-project"),
      now: new Date("2026-03-23T11:22:33.000Z"),
    });

    expect(result.manifest.artifacts.readme.status).toBe("included");

    const readme = await readFile(join(result.bundleDir, "README.md"), "utf-8");
    const readmeRow = readme
      .split("\n")
      .find((line) => line.startsWith("| readme |"));

    expect(readmeRow).toBeDefined();
    expect(readmeRow).toContain("| readme | included |");
  });
});
