import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { checkOpencodeAvailability, createIsolatedOpenCodePaths } from "./helpers/harness";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");

async function runLauncher(
  args: string[],
  extraEnv: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "scripts/manual-test/index.ts", "--", ...args],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PATH: process.env.PATH ?? "",
      ...extraEnv,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode, stdout, stderr };
}

const opencodeCheck = await checkOpencodeAvailability();

describe("manual launcher preflight", () => {
  it("copies the committed OpenCode config fixture into isolated config", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "opencode-coder-isolated-config-"));

    try {
      const isolatedPaths = await createIsolatedOpenCodePaths(tempRoot);
      const opencodeConfig = await readFile(join(isolatedPaths.opencodeConfigDir, "opencode.json"), "utf8");

      expect(opencodeConfig).toContain('"@dynatrace-oss/opencode-coder@0.34.2"');
      expect(opencodeConfig).toContain('"theme": "catppuccin"');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("fails clearly for unknown fixture", async () => {
    const result = await runLauncher(["--mode=command", "--fixture=does-not-exist", "--", "env"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown fixture: does-not-exist");
  });

  it("fails clearly for non-existent auth path", async () => {
    const result = await runLauncher([
      "--mode=command",
      "--fixture=cli-smoke-project",
      "--auth=/tmp/does-not-exist-auth.json",
      "--",
      "env",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Auth seed error:");
    expect(result.stderr).not.toContain(" at ");
  });
});

describe.skipIf(!opencodeCheck.available)("manual launcher non-interactive mode", () => {
  it("runs one-shot command with shared isolated setup and explicit auth seed", async () => {
    const tempAuthDir = await mkdtemp(join(tmpdir(), "opencode-coder-manual-auth-"));
    const authPath = join(tempAuthDir, "auth.json");
    await writeFile(authPath, "{}\n", "utf8");

    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher([
        "--mode=command",
        "--fixture=cli-smoke-project",
        "--keep",
        `--auth=${authPath}`,
        "--",
        "env",
      ], {
        OPENCODE_DEFAULT_OPTIONS: "--log-level DEBUG",
        OPENCODE_LOG_RETENTION: "100",
        MANUAL_LAUNCHER_ENV_LEAK_CANARY: "should-not-leak",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Mode: command");
      expect(result.stdout).toContain("Fixture: cli-smoke-project");
      expect(result.stdout).toContain("Auth seeded: yes (explicit-path)");
      expect(result.stdout).toContain("Plugin path used:");
      expect(result.stdout).toContain("OPENCODE_DISABLE_DEFAULT_PLUGINS=true");
      expect(result.stdout).toContain("OPENCODE_CONFIG_DIR=");
      expect(result.stdout).not.toContain("OPENCODE_DEFAULT_OPTIONS=");
      expect(result.stdout).not.toContain("OPENCODE_LOG_RETENTION=");
      expect(result.stdout).not.toContain("MANUAL_LAUNCHER_ENV_LEAK_CANARY=");

      const envLineCount = result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).length;
      expect(envLineCount).toBeGreaterThanOrEqual(8);
      expect(envLineCount).toBeLessThan(30);

      const preservedMatch = result.stdout.match(/Environment preserved at: (.+)\n?/);
      expect(preservedMatch).not.toBeNull();
      preservedRoot = preservedMatch?.[1]?.trim();
      expect(Boolean(preservedRoot)).toBe(true);

      const pluginLink = Bun.file(join(preservedRoot!, "project", ".opencode", "plugins", "opencode-coder.js"));
      const isolatedAuth = Bun.file(join(preservedRoot!, "isolated-opencode", "xdg-data", "opencode", "auth.json"));
      const isolatedConfig = await readFile(
        join(preservedRoot!, "isolated-opencode", "xdg-config", "opencode", "opencode.json"),
        "utf8"
      );

      expect(await pluginLink.exists()).toBe(true);
      expect(await isolatedAuth.exists()).toBe(true);
      expect(isolatedConfig).toContain('"@dynatrace-oss/opencode-coder@0.34.2"');
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
      await rm(tempAuthDir, { recursive: true, force: true });
    }
  }, 120000);
});
