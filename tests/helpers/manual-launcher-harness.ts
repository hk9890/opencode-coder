import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk";
import { expect } from "bun:test";
import { join } from "path";
import { buildStrippedHostEnv, withEnvironment } from "../e2e/helpers/harness";

export const PROJECT_ROOT = join(import.meta.dir, "..", "..");

export function buildLauncherTestEnv(extraEnv: Record<string, string> = {}): Record<string, string> {
  return {
    ...buildStrippedHostEnv(),
    ...extraEnv,
  };
}

export async function runLauncher(
  args: string[],
  extraEnv: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    // Use the current Bun executable explicitly; bare "bun" fails under restricted PATH.
    cmd: [process.execPath, "run", "scripts/manual-test/index.ts", "--", ...args],
    cwd: PROJECT_ROOT,
    env: buildLauncherTestEnv(extraEnv),
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

export function getPreservedRoot(stdout: string): string {
  const preservedMatch = stdout.match(/Environment preserved at: (.+)\n?/);
  const preservedRoot = preservedMatch?.[1]?.trim();
  if (!preservedRoot) {
    throw new Error("Launcher output did not include preserved environment path");
  }
  return preservedRoot;
}

export function getPreservedConfigDir(preservedRoot: string): string {
  return join(preservedRoot, "isolated-opencode", "xdg-config", "opencode");
}

export async function getLauncherPreparedEnv(stdout: string): Promise<Record<string, string>> {
  const preservedRoot = getPreservedRoot(stdout);
  const isolatedRoot = join(preservedRoot, "isolated-opencode");
  return {
    HOME: join(isolatedRoot, "home"),
    XDG_CONFIG_HOME: join(isolatedRoot, "xdg-config"),
    XDG_DATA_HOME: join(isolatedRoot, "xdg-data"),
    XDG_CACHE_HOME: join(isolatedRoot, "xdg-cache"),
    OPENCODE_CONFIG_DIR: join(isolatedRoot, "xdg-config", "opencode"),
    OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
  };
}

export async function proveLauncherStartupViability(workdir: string, launcherEnv: Record<string, string>) {
  const server = await withEnvironment(launcherEnv, () =>
    createOpencodeServer({
      hostname: "127.0.0.1",
      port: 0,
      timeout: 30000,
      config: {
        autoupdate: false,
        snapshot: false,
      },
    })
  );

  try {
    const url = new URL(server.url);
    expect(url.hostname).toBe("127.0.0.1");
    expect(Number(url.port)).toBeGreaterThan(0);

    const client = createOpencodeClient({
      baseUrl: server.url,
      responseStyle: "data",
      throwOnError: true,
    });
    const commandListResult = await client.command.list({ query: { directory: workdir } });
    const commandList = "data" in commandListResult ? commandListResult.data : commandListResult;
    expect(Array.isArray(commandList)).toBe(true);
  } finally {
    server.close();
  }
}
