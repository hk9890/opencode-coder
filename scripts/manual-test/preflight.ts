#!/usr/bin/env bun

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_ENV_KEYS = ["PATH", "USER", "LOGNAME", "LANG"] as const;

function buildPreflightEnv(tempHome: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const key of BASE_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.length > 0) {
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("LC_") && value && value.length > 0) {
      env[key] = value;
    }
  }

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
