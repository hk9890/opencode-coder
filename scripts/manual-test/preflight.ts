#!/usr/bin/env bun

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildStrippedHostEnv,
  checkHostToolPrerequisites,
  prependResolvedHostToolBinDirs,
} from "../../tests/e2e/helpers/harness";

function buildPreflightEnv(tempHome: string): Record<string, string> {
  const env = buildStrippedHostEnv();

  env.HOME = tempHome;
  env.OPENCODE_CODER_PRIVATE_TESTS = "false";

  return env;
}

async function runCommand(command: string[], env: Record<string, string>): Promise<void> {
  const proc = Bun.spawn({
    cmd: command,
    cwd: join(import.meta.dir, "..", ".."),
    env,
    stdout: "inherit",
    stderr: "inherit",
  });

  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Command failed (${code.toString()}): ${command.join(" ")}`);
  }
}

async function main(): Promise<number> {
  const hostPrerequisites = await checkHostToolPrerequisites({
    requireAimgr: false,
    requireBd: false,
  });
  if (!hostPrerequisites.available) {
    console.error(hostPrerequisites.diagnostics ?? "Missing required host tools for preflight.");
    return 1;
  }
  prependResolvedHostToolBinDirs(hostPrerequisites.tools, {
    tools: ["opencode", "git", "aimgr", "bd"],
  });

  const tempHome = await mkdtemp(join(tmpdir(), "opencode-coder-preflight-home-"));

  try {
    const env = buildPreflightEnv(tempHome);

    console.log("[preflight] Running validate:isolated-pins with stripped host env");
    await runCommand([process.execPath, "run", "validate:isolated-pins"], env);

    console.log("[preflight] Running manual launcher integration checks with stripped host env");
    await runCommand([process.execPath, "test", "tests/integration/manual-launcher.test.ts"], env);

    console.log("[preflight] Hermetic launcher preflight passed.");
    return 0;
  } catch (error) {
    console.error(`[preflight] ${(error as Error).message}`);
    return 1;
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
