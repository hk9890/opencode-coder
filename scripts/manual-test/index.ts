#!/usr/bin/env bun

import { readFile, rm, stat } from "fs/promises";
import { join } from "path";
import {
  FIXTURE_NAMES,
  type FixtureName,
  checkOpencodeAvailability,
  createFixtureWorkspace,
  createIsolatedOpenCodePathsWithPluginSource,
  createProjectPathWorkspace,
  isFixtureName,
  type PluginSource,
  prepareWorkspacePluginSource,
  resolveAuthSeedPath,
  seedIsolatedOpenCodeAuth,
} from "../../tests/e2e/helpers/harness";

type LauncherMode = "tui" | "shell" | "command";

const BASE_ENV_KEYS = ["USER", "LOGNAME", "LANG"] as const;
const INTERACTIVE_ENV_KEYS = [
  "TERM",
  "COLORTERM",
  "TERMINFO",
  "DISPLAY",
  "WAYLAND_DISPLAY",
  "XDG_RUNTIME_DIR",
  "XDG_SESSION_CLASS",
  "XDG_SESSION_DESKTOP",
  "XDG_SESSION_TYPE",
  "XDG_CURRENT_DESKTOP",
  "DBUS_SESSION_BUS_ADDRESS",
] as const;

function copyDefinedEnvKey(
  sourceEnv: NodeJS.ProcessEnv,
  targetEnv: Record<string, string | undefined>,
  key: string
): void {
  const value = sourceEnv[key];
  if (value !== undefined && value !== "") {
    targetEnv[key] = value;
  }
}

function buildChildEnv(
  mode: LauncherMode,
  isolatedEnv: Record<string, string | undefined>,
  sourceEnv: NodeJS.ProcessEnv = process.env
): Record<string, string | undefined> {
  // Child env is intentionally allowlist-only to preserve e2e isolation parity.
  // Do not spread process.env here.
  const childEnv: Record<string, string | undefined> = {
    PATH: sourceEnv.PATH ?? "",
  };

  for (const key of BASE_ENV_KEYS) {
    copyDefinedEnvKey(sourceEnv, childEnv, key);
  }

  for (const [key, value] of Object.entries(sourceEnv)) {
    if (key.startsWith("LC_") && value !== undefined && value !== "") {
      childEnv[key] = value;
    }
  }

  if (mode === "tui" || mode === "shell") {
    for (const key of INTERACTIVE_ENV_KEYS) {
      copyDefinedEnvKey(sourceEnv, childEnv, key);
    }
  }

  if (mode === "shell") {
    copyDefinedEnvKey(sourceEnv, childEnv, "SHELL");
  }

  return {
    ...childEnv,
    ...isolatedEnv,
  };
}

interface ParsedArgs {
  mode: LauncherMode;
  pluginSource: PluginSource;
  fixture?: string;
  projectPath?: string;
  keep: boolean;
  authPath?: string;
  requireAuth: boolean;
  command: string[];
  help: boolean;
}

const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const DEFAULT_FIXTURE = "cli-smoke-project";

function printHelp(): void {
  console.log(`Manual isolated plugin test launcher

Usage:
  bun run test:manual -- [options]
  bun run test:manual -- --mode=command -- opencode run --command "pwd" --format json

Modes:
  --mode=tui        Launch interactive OpenCode TUI (default)
  --mode=shell      Launch interactive shell in isolated project
  --mode=command    Run one-shot command (arguments after --)
  --tui             Alias for --mode=tui
  --shell           Alias for --mode=shell
  --command         Alias for --mode=command

Options:
  --fixture=<name>  Fixture to copy (default: ${DEFAULT_FIXTURE})
  --project-path    External project directory to copy into temp workspace
  --plugin-source=<mode> Plugin source: local-build (default) | installed-configured
  --auth=<path>     Explicit auth.json path seed (copied to isolated XDG data)
  --require-auth    Fail if no auth seed source is available
  --keep            Keep temp workspace after exit
  -h, --help        Show this help

Available fixtures:
  ${FIXTURE_NAMES.join("\n  ")}
`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    mode: "tui",
    pluginSource: "local-build",
    keep: false,
    requireAuth: false,
    command: [],
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      parsed.command = argv.slice(i + 1);
      break;
    }

    if (arg === "-h" || arg === "--help") {
      parsed.help = true;
      i++;
      continue;
    }

    if (arg === "--keep") {
      parsed.keep = true;
      i++;
      continue;
    }

    if (arg === "--require-auth") {
      parsed.requireAuth = true;
      i++;
      continue;
    }

    if (arg === "--tui") {
      parsed.mode = "tui";
      i++;
      continue;
    }

    if (arg === "--shell") {
      parsed.mode = "shell";
      i++;
      continue;
    }

    if (arg === "--command") {
      parsed.mode = "command";
      i++;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const mode = arg.slice("--mode=".length);
      if (mode === "tui" || mode === "shell" || mode === "command") {
        parsed.mode = mode;
      } else {
        throw new Error(`Unknown mode: ${mode}`);
      }
      i++;
      continue;
    }

    if (arg === "--mode") {
      const mode = argv[i + 1];
      if (!mode || !["tui", "shell", "command"].includes(mode)) {
        throw new Error("Expected one of: tui, shell, command");
      }
      parsed.mode = mode as LauncherMode;
      i += 2;
      continue;
    }

    if (arg.startsWith("--fixture=")) {
      parsed.fixture = arg.slice("--fixture=".length);
      i++;
      continue;
    }

    if (arg === "--fixture") {
      const fixture = argv[i + 1];
      if (!fixture) {
        throw new Error("Missing value for --fixture");
      }
      parsed.fixture = fixture;
      i += 2;
      continue;
    }

    if (arg.startsWith("--project-path=")) {
      const projectPath = arg.slice("--project-path=".length);
      if (!projectPath.trim()) {
        throw new Error("Missing value for --project-path");
      }
      parsed.projectPath = projectPath;
      i++;
      continue;
    }

    if (arg === "--project-path") {
      const projectPath = argv[i + 1];
      if (!projectPath || projectPath === "--") {
        throw new Error("Missing value for --project-path");
      }
      parsed.projectPath = projectPath;
      i += 2;
      continue;
    }

    if (arg.startsWith("--plugin-source=")) {
      const pluginSource = arg.slice("--plugin-source=".length);
      if (pluginSource === "local-build" || pluginSource === "installed-configured") {
        parsed.pluginSource = pluginSource;
      } else {
        throw new Error(`Unknown plugin source: ${pluginSource}`);
      }
      i++;
      continue;
    }

    if (arg === "--plugin-source") {
      const pluginSource = argv[i + 1];
      if (!pluginSource || !["local-build", "installed-configured"].includes(pluginSource)) {
        throw new Error("Expected one of: local-build, installed-configured");
      }
      parsed.pluginSource = pluginSource as PluginSource;
      i += 2;
      continue;
    }

    if (arg.startsWith("--auth=")) {
      parsed.authPath = arg.slice("--auth=".length);
      i++;
      continue;
    }

    if (arg === "--auth") {
      const authPath = argv[i + 1];
      if (!authPath) {
        throw new Error("Missing value for --auth");
      }
      parsed.authPath = authPath;
      i += 2;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.mode === "command" && parsed.command.length === 0) {
    throw new Error("Command mode requires command arguments after '--'");
  }

  if (parsed.fixture !== undefined && parsed.projectPath !== undefined) {
    throw new Error("--fixture and --project-path are mutually exclusive");
  }

  if (parsed.fixture === undefined && parsed.projectPath === undefined) {
    parsed.fixture = DEFAULT_FIXTURE;
  }

  return parsed;
}

async function validateProjectPath(projectPath: string): Promise<string> {
  const normalizedPath = projectPath.trim();
  if (!normalizedPath) {
    throw new Error("Missing value for --project-path");
  }

  const metadata = await stat(normalizedPath).catch(() => null);
  if (!metadata) {
    throw new Error(`Project path does not exist: ${normalizedPath}`);
  }

  if (!metadata.isDirectory()) {
    throw new Error(`Project path is not a directory: ${normalizedPath}`);
  }

  return normalizedPath;
}

function printSection(title: string, value: string): void {
  console.log(`${title}: ${value}`);
}

function exitReason(exitCode: number, signalCode: NodeJS.Signals | null): string {
  if (signalCode) {
    return `signal ${signalCode}`;
  }
  return `exit code ${exitCode}`;
}

function isInstalledConfiguredLoadProofValid(loadedPluginVersion: string | null, expectedVersion: string): boolean {
  const loaded = loadedPluginVersion?.trim();
  if (!loaded || loaded === "fixture") {
    return false;
  }

  return loaded === expectedVersion.trim();
}

async function readLoadedPluginVersion(workdir: string): Promise<string | null> {
  const projectYamlPath = join(workdir, ".coder", "project.yaml");
  const content = await readFile(projectYamlPath, "utf8").catch(() => null);
  if (!content) {
    return null;
  }

  const match = content.match(/^pluginVersion:\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

async function runInteractive(
  cmd: string[],
  cwd: string,
  env: Record<string, string | undefined>
): Promise<{ exitCode: number; signalCode: NodeJS.Signals | null }> {
  const child = Bun.spawn({
    cmd,
    cwd,
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const forwardSignal = (signal: NodeJS.Signals) => {
    try {
      child.kill(signal);
    } catch {
      // Child may already be exiting.
    }
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  try {
    const exitCode = await child.exited;
    return {
      exitCode,
      signalCode: child.signalCode,
    };
  } finally {
    process.off("SIGINT", forwardSignal);
    process.off("SIGTERM", forwardSignal);
  }
}

async function runCaptured(
  cmd: string[],
  cwd: string,
  env: Record<string, string | undefined>
): Promise<{ exitCode: number; signalCode: NodeJS.Signals | null; stdout: string; stderr: string }> {
  const child = Bun.spawn({
    cmd,
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const forwardSignal = (signal: NodeJS.Signals) => {
    try {
      child.kill(signal);
    } catch {
      // Child may already be exiting.
    }
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    return {
      exitCode,
      signalCode: child.signalCode,
      stdout,
      stderr,
    };
  } finally {
    process.off("SIGINT", forwardSignal);
    process.off("SIGTERM", forwardSignal);
  }
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`Argument error: ${(error as Error).message}`);
    console.error("Run with --help for usage.");
    return 2;
  }

  if (args.help) {
    printHelp();
    return 0;
  }

  if (args.fixture && !isFixtureName(args.fixture)) {
    console.error(`Unknown fixture: ${args.fixture}`);
    console.error(`Available fixtures: ${FIXTURE_NAMES.join(", ")}`);
    return 2;
  }

  let validatedProjectPath: string | undefined;
  if (args.projectPath !== undefined) {
    try {
      validatedProjectPath = await validateProjectPath(args.projectPath);
    } catch (error) {
      console.error(`Project path error: ${(error as Error).message}`);
      return 2;
    }
  }

  const opencodeCheck = await checkOpencodeAvailability();
  if (!opencodeCheck.available) {
    console.error(opencodeCheck.diagnostics ?? "opencode binary not found in PATH.");
    return 1;
  }

  let authSeedPath: ReturnType<typeof resolveAuthSeedPath>;
  try {
    authSeedPath = resolveAuthSeedPath(args.authPath);
  } catch (error) {
    console.error(`Auth seed error: ${(error as Error).message}`);
    return 2;
  }

  if (args.requireAuth && !authSeedPath) {
    console.error("No usable auth seed found.");
    console.error("Provide --auth <path> or ensure ~/.local/share/opencode/auth.json exists.");
    return 1;
  }

  const workspace = validatedProjectPath
    ? await createProjectPathWorkspace(validatedProjectPath)
    : await createFixtureWorkspace(args.fixture as FixtureName);
  let pluginPathUsed = "<none>";
  let resolvedInstalledPackage = "<none>";
  let resolvedHostConfig = "<none>";
  let expectedInstalledLoadedVersion = "<none>";
  let exitCode = 1;
  let shouldKeep = args.keep;
  let seededAuthPath: string | null = null;
  let authSourceCategory: string = "none";

  try {
    const preparedPluginSource = await prepareWorkspacePluginSource({
      projectRoot: PROJECT_ROOT,
      workdir: workspace.workdir,
      pluginSource: args.pluginSource,
    });

    const isolatedPaths = await createIsolatedOpenCodePathsWithPluginSource(workspace.tempRoot, {
      pluginSource: preparedPluginSource.pluginSource,
    });

    pluginPathUsed = preparedPluginSource.localPluginSymlink ?? "<none>";
    resolvedInstalledPackage = preparedPluginSource.resolvedInstalledPackageSpec ?? "<none>";
    resolvedHostConfig = preparedPluginSource.resolvedHostConfigPath ?? "<none>";
    expectedInstalledLoadedVersion = preparedPluginSource.expectedLoadedPluginVersion ?? "<none>";

    if (args.pluginSource === "installed-configured" && expectedInstalledLoadedVersion === "<none>") {
      throw new Error("installed-configured setup did not resolve expected loaded plugin version");
    }

    if (authSeedPath) {
      seededAuthPath = await seedIsolatedOpenCodeAuth(isolatedPaths, {
        authJsonPath: authSeedPath.authJsonPath,
      });
      authSourceCategory = authSeedPath.source;
    }

    console.log("\nManual isolated plugin test environment ready\n");
    printSection("Mode", args.mode);
    printSection("Plugin source", args.pluginSource);
    if (workspace.workspaceSource.kind === "fixture") {
      printSection("Fixture", workspace.workspaceSource.fixtureName);
    } else {
      printSection("Project path", workspace.workspaceSource.projectPath);
    }
    printSection("Project source", workspace.projectSourceDir);
    printSection("Temp root", workspace.tempRoot);
    printSection("Temp workdir", workspace.workdir);
    printSection("Plugin path used", pluginPathUsed);
    printSection("Resolved installed package", resolvedInstalledPackage);
    printSection("Resolved host config", resolvedHostConfig);
    printSection("Expected installed plugin version", expectedInstalledLoadedVersion);
    printSection("Isolated HOME", isolatedPaths.homeDir);
    printSection("Isolated XDG_CONFIG_HOME", isolatedPaths.xdgConfigHome);
    printSection("Isolated XDG_DATA_HOME", isolatedPaths.xdgDataHome);
    printSection("Isolated XDG_CACHE_HOME", isolatedPaths.xdgCacheHome);
    printSection("Isolated OPENCODE_CONFIG_DIR", isolatedPaths.opencodeConfigDir);
    printSection(
      "Configured plugin loading",
      Object.prototype.hasOwnProperty.call(isolatedPaths.env, "OPENCODE_DISABLE_DEFAULT_PLUGINS")
        ? "disabled (OPENCODE_DISABLE_DEFAULT_PLUGINS=true)"
        : "enabled"
    );
    printSection("Auth seeded", seededAuthPath ? `yes (${authSourceCategory})` : "no");
    printSection("Cleanup plan", args.keep ? "keep (--keep enabled)" : "cleanup on success");
    if (args.mode === "command") {
      printSection("One-shot command", args.command.join(" "));
    }
    console.log("");

    const childEnv = buildChildEnv(args.mode, isolatedPaths.env);

    if (args.mode === "tui") {
      const result = await runInteractive(["opencode"], workspace.workdir, childEnv);
      exitCode = result.exitCode;
      if (result.exitCode !== 0 || result.signalCode !== null) {
        shouldKeep = true;
      }
      const loadedPluginVersion = await readLoadedPluginVersion(workspace.workdir);
      printSection("Loaded plugin version", loadedPluginVersion ?? "<not-detected>");
      if (args.pluginSource === "installed-configured") {
        const validProof = isInstalledConfiguredLoadProofValid(loadedPluginVersion, expectedInstalledLoadedVersion);
        printSection("Installed plugin load proof", validProof ? "valid" : "MISSING_OR_INVALID");
        if (!validProof) {
          console.error(
            `INVALID_COMPARISON: installed-configured plugin load proof missing (expected ${expectedInstalledLoadedVersion}, loaded ${
              loadedPluginVersion ?? "<not-detected>"
            })`
          );
          exitCode = 1;
        }
      }
      console.log(`\nOpenCode TUI finished (${exitReason(result.exitCode, result.signalCode)}).`);
    } else if (args.mode === "shell") {
      const shell = process.env.SHELL?.trim() || "/bin/sh";
      const result = await runInteractive([shell], workspace.workdir, childEnv);
      exitCode = result.exitCode;
      if (result.exitCode !== 0 || result.signalCode !== null) {
        shouldKeep = true;
      }
      const loadedPluginVersion = await readLoadedPluginVersion(workspace.workdir);
      printSection("Loaded plugin version", loadedPluginVersion ?? "<not-detected>");
      if (args.pluginSource === "installed-configured") {
        const validProof = isInstalledConfiguredLoadProofValid(loadedPluginVersion, expectedInstalledLoadedVersion);
        printSection("Installed plugin load proof", validProof ? "valid" : "MISSING_OR_INVALID");
        if (!validProof) {
          console.error(
            `INVALID_COMPARISON: installed-configured plugin load proof missing (expected ${expectedInstalledLoadedVersion}, loaded ${
              loadedPluginVersion ?? "<not-detected>"
            })`
          );
          exitCode = 1;
        }
      }
      console.log(`\nIsolated shell finished (${exitReason(result.exitCode, result.signalCode)}).`);
    } else {
      const result = await runCaptured(args.command, workspace.workdir, childEnv);
      if (result.stdout.trim().length > 0) {
        console.log("--- stdout ---");
        process.stdout.write(result.stdout);
        if (!result.stdout.endsWith("\n")) {
          process.stdout.write("\n");
        }
      }

      if (result.stderr.trim().length > 0) {
        console.log("--- stderr ---");
        process.stdout.write(result.stderr);
        if (!result.stderr.endsWith("\n")) {
          process.stdout.write("\n");
        }
      }

      exitCode = result.exitCode;
      if (result.exitCode !== 0 || result.signalCode !== null) {
        shouldKeep = true;
      }

      const loadedPluginVersion = await readLoadedPluginVersion(workspace.workdir);
      printSection("Loaded plugin version", loadedPluginVersion ?? "<not-detected>");
      if (args.pluginSource === "installed-configured") {
        const validProof = isInstalledConfiguredLoadProofValid(loadedPluginVersion, expectedInstalledLoadedVersion);
        printSection("Installed plugin load proof", validProof ? "valid" : "MISSING_OR_INVALID");
        if (!validProof) {
          console.error(
            `INVALID_COMPARISON: installed-configured plugin load proof missing (expected ${expectedInstalledLoadedVersion}, loaded ${
              loadedPluginVersion ?? "<not-detected>"
            })`
          );
          exitCode = 1;
        }
      }

      console.log(`--- result ---\nExit: ${exitReason(result.exitCode, result.signalCode)}`);
    }
  } catch (error) {
    shouldKeep = true;
    console.error(`Launcher failed: ${(error as Error).message}`);
    exitCode = 1;
  } finally {
    if (shouldKeep) {
      console.log(`Environment preserved at: ${workspace.tempRoot}`);
    } else {
      await rm(workspace.tempRoot, { recursive: true, force: true });
      console.log("Environment cleaned up.");
    }
  }

  return exitCode;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
