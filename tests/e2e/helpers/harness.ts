import { $ } from "bun";
import { existsSync } from "fs";
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "fs/promises";
import { createServer } from "net";
import { homedir, tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const E2E_DIR = join(__dirname, "..");
export const FIXTURES_DIR = join(E2E_DIR, "fixtures");
export const SHARED_FIXTURES_DIR = join(FIXTURES_DIR, "_shared");
export const OPENCODE_CONFIG_FIXTURE_DIR = join(SHARED_FIXTURES_DIR, "opencode-config");
export const OPENCODE_CONFIG_FIXTURE_PATH = join(OPENCODE_CONFIG_FIXTURE_DIR, "opencode.json");

export const FIXTURE_NAMES = [
  "existing-active-project",
  "cli-smoke-project",
  "fresh-inactive-project",
  "local-startup-parity-project",
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

export function isFixtureName(value: string): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value);
}

export interface FixtureWorkspace {
  fixtureName: FixtureName;
  fixtureSourceDir: string;
  tempRoot: string;
  workdir: string;
}

export interface IsolatedOpenCodePaths {
  root: string;
  homeDir: string;
  xdgConfigHome: string;
  xdgDataHome: string;
  xdgCacheHome: string;
  opencodeConfigDir: string;
  env: Record<string, string>;
}

export interface IsolatedAuthSeedInput {
  authJsonPath?: string;
  authJsonContent?: string;
}

export interface ResolvedCopilotAuthSeed {
  seed: IsolatedAuthSeedInput;
  source: "env-path" | "env-content" | "default-local-auth";
}

export interface ResolvedAuthSeedPath {
  authJsonPath: string;
  source: "explicit-path" | "default-local-auth";
}

export const DEFAULT_LOCAL_OPENCODE_AUTH_JSON_PATH = join(homedir(), ".local", "share", "opencode", "auth.json");

/**
 * Resolves auth.json path precedence for file-based seeds:
 * 1) explicit path input
 * 2) default local OpenCode auth path (if present)
 */
export function resolveAuthSeedPath(explicitPath?: string): ResolvedAuthSeedPath | null {
  const normalizedExplicitPath = explicitPath?.trim();
  if (normalizedExplicitPath) {
    if (!existsSync(normalizedExplicitPath)) {
      throw new Error(`Auth seed path does not exist: ${normalizedExplicitPath}`);
    }

    return {
      authJsonPath: normalizedExplicitPath,
      source: "explicit-path",
    };
  }

  if (existsSync(DEFAULT_LOCAL_OPENCODE_AUTH_JSON_PATH)) {
    return {
      authJsonPath: DEFAULT_LOCAL_OPENCODE_AUTH_JSON_PATH,
      source: "default-local-auth",
    };
  }

  return null;
}

export interface FailureArtifactInput {
  artifactDir: string;
  testName: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  notes?: string;
  isolationPaths?: Partial<IsolatedOpenCodePaths>;
}

export interface OpencodeCliRunOptions {
  cwd: string;
  env: Record<string, string>;
  timeoutMs?: number;
}

export interface OpencodeCliRunResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Checks whether the `opencode` binary is available in PATH.
 */
export async function checkOpencodeAvailability(): Promise<{ available: boolean; diagnostics?: string }> {
  try {
    const result = await $`which opencode`.quiet();
    if (result.exitCode === 0) {
      return { available: true };
    }
  } catch {
    // fall through to diagnostics
  }

  const diagnostics: string[] = [
    "opencode binary not found in PATH.",
    "",
    "This usually happens when OpenCode was installed/updated but the current shell has stale PATH values.",
    "",
    "Suggested fix: restart the shell/OpenCode host and re-run tests.",
    "",
    "Diagnostic info:",
  ];

  try {
    const miseCheck = await $`ls -d ~/.local/share/mise/installs/opencode/*/opencode 2>/dev/null`.quiet();
    if (miseCheck.exitCode === 0) {
      diagnostics.push(`  Found mise install: ${miseCheck.stdout.toString().trim()}`);
      diagnostics.push("  -> OpenCode exists on disk but is not currently on PATH");
    } else {
      diagnostics.push("  No opencode binary found in common mise install path");
    }
  } catch {
    diagnostics.push("  Could not inspect mise install path");
  }

  const pathEntries = process.env.PATH?.split(":").filter((entry) => entry.includes("opencode")) ?? [];
  if (pathEntries.length > 0) {
    diagnostics.push(`  PATH entries containing 'opencode': ${pathEntries.join(", ")}`);
  }

  return { available: false, diagnostics: diagnostics.join("\n") };
}

/**
 * Finds an available local TCP port.
 */
export async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        server.close(() => resolve(address.port));
      } else {
        server.close(() => reject(new Error("Could not resolve ephemeral port")));
      }
    });
    server.on("error", reject);
  });
}

/**
 * Ensures dist/opencode-coder.js exists by running `bun run build` if required.
 */
export async function ensurePluginBuilt(projectRoot: string): Promise<string> {
  const pluginPath = join(projectRoot, "dist", "opencode-coder.js");

  try {
    await access(pluginPath);
    return pluginPath;
  } catch {
    const result = await $`bun run build`.cwd(projectRoot).quiet();
    if (result.exitCode !== 0) {
      throw new Error(`Failed to build plugin:\n${result.stderr.toString()}`);
    }
  }

  await access(pluginPath);
  return pluginPath;
}

/**
 * Copies a committed fixture into an isolated temp workdir.
 */
export async function createFixtureWorkspace(fixtureName: FixtureName): Promise<FixtureWorkspace> {
  const fixtureSourceDir = join(FIXTURES_DIR, fixtureName);
  const tempRoot = await mkdtemp(join(tmpdir(), `opencode-coder-${fixtureName}-`));
  const workdir = join(tempRoot, "project");

  await cp(fixtureSourceDir, workdir, { recursive: true });
  await $`git init --quiet`.cwd(workdir).quiet();

  return {
    fixtureName,
    fixtureSourceDir,
    tempRoot,
    workdir,
  };
}

/**
 * Injects this repository's built plugin as the only project-local plugin source.
 */
export async function wireBuiltPluginArtifact(projectRoot: string, workdir: string): Promise<string> {
  const pluginPath = await ensurePluginBuilt(projectRoot);
  const opencodeDir = join(workdir, ".opencode");
  const pluginDir = join(opencodeDir, "plugins");
  const pluginSymlink = join(pluginDir, "opencode-coder.js");

  await mkdir(pluginDir, { recursive: true });
  await writeFile(
    join(opencodeDir, "package.json"),
    JSON.stringify(
      {
        private: true,
        dependencies: {
          "@opencode-ai/plugin": "^1.2.16",
        },
      },
      null,
      2
    ) + "\n"
  );

  await rm(pluginSymlink, { force: true });
  await symlink(pluginPath, pluginSymlink);

  const installResult = await $`bun install`.cwd(opencodeDir).quiet();
  if (installResult.exitCode !== 0) {
    throw new Error(`Failed to install .opencode dependencies:\n${installResult.stderr.toString()}`);
  }

  return pluginSymlink;
}

/**
 * Creates isolated HOME/XDG/OpenCode path roots to prevent global plugin discovery.
 */
export async function createIsolatedOpenCodePaths(baseDir: string): Promise<IsolatedOpenCodePaths> {
  const root = join(baseDir, "isolated-opencode");
  const homeDir = join(root, "home");
  const xdgConfigHome = join(root, "xdg-config");
  const xdgDataHome = join(root, "xdg-data");
  const xdgCacheHome = join(root, "xdg-cache");
  const opencodeConfigDir = join(xdgConfigHome, "opencode");

  await mkdir(homeDir, { recursive: true });
  await mkdir(xdgConfigHome, { recursive: true });
  await mkdir(xdgDataHome, { recursive: true });
  await mkdir(xdgCacheHome, { recursive: true });
  await mkdir(opencodeConfigDir, { recursive: true });
  await cp(OPENCODE_CONFIG_FIXTURE_PATH, join(opencodeConfigDir, "opencode.json"), { force: true });

  return {
    root,
    homeDir,
    xdgConfigHome,
    xdgDataHome,
    xdgCacheHome,
    opencodeConfigDir,
    env: {
      HOME: homeDir,
      XDG_CONFIG_HOME: xdgConfigHome,
      XDG_DATA_HOME: xdgDataHome,
      XDG_CACHE_HOME: xdgCacheHome,
      OPENCODE_CONFIG_DIR: opencodeConfigDir,
      OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
    },
  };
}

/**
 * Seeds isolated OpenCode auth storage at XDG_DATA_HOME/opencode/auth.json.
 *
 * The seed must come from explicit test-controlled input, either:
 * - `authJsonPath`: path to a source auth.json file
 * - `authJsonContent`: raw auth.json content
 */
export async function seedIsolatedOpenCodeAuth(
  paths: IsolatedOpenCodePaths,
  seed: IsolatedAuthSeedInput
): Promise<string> {
  const hasPathSeed = Boolean(seed.authJsonPath?.trim());
  const hasContentSeed = Boolean(seed.authJsonContent?.trim());

  if (!hasPathSeed && !hasContentSeed) {
    throw new Error("Missing auth seed input: provide authJsonPath or authJsonContent");
  }

  if (hasPathSeed && hasContentSeed) {
    throw new Error("Ambiguous auth seed input: provide either authJsonPath or authJsonContent, not both");
  }

  const authDir = join(paths.xdgDataHome, "opencode");
  const authFilePath = join(authDir, "auth.json");

  await mkdir(authDir, { recursive: true });

  const content = hasPathSeed
    ? await readFile(seed.authJsonPath as string, "utf8")
    : (seed.authJsonContent as string);

  try {
    JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid auth.json content for isolated seed: ${String(error)}`);
  }

  await writeFile(authFilePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return authFilePath;
}

/**
 * Resolves copilot auth seed input using precedence:
 * 1) E2E_COPILOT_AUTH_JSON_PATH
 * 2) E2E_COPILOT_AUTH_JSON_CONTENT
 * 3) ~/.local/share/opencode/auth.json (if it exists)
 */
export function resolveCopilotAuthSeedFromEnv(): ResolvedCopilotAuthSeed | null {
  const authJsonPath = process.env.E2E_COPILOT_AUTH_JSON_PATH?.trim();
  if (authJsonPath) {
    return {
      seed: { authJsonPath },
      source: "env-path",
    };
  }

  const authJsonContent = process.env.E2E_COPILOT_AUTH_JSON_CONTENT?.trim();
  if (authJsonContent) {
    return {
      seed: { authJsonContent },
      source: "env-content",
    };
  }

  if (existsSync(DEFAULT_LOCAL_OPENCODE_AUTH_JSON_PATH)) {
    return {
      seed: { authJsonPath: DEFAULT_LOCAL_OPENCODE_AUTH_JSON_PATH },
      source: "default-local-auth",
    };
  }

  return null;
}

/**
 * Temporarily applies environment variable overrides while running fn.
 */
export async function withEnvironment<T>(overrides: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const original = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    original.set(key, process.env[key]);
    process.env[key] = value;
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

/**
 * Runs `opencode` with explicit cwd/env and captures output.
 */
export async function runOpencodeCli(
  args: string[],
  options: OpencodeCliRunOptions
): Promise<OpencodeCliRunResult> {
  const command = `opencode ${args.join(" ")}`;
  const timeoutMs = options.timeoutMs ?? 30000;

  const proc = Bun.spawn({
    cmd: ["opencode", ...args],
    cwd: options.cwd,
    env: {
      ...options.env,
      PATH: process.env.PATH ?? "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  clearTimeout(timer);

  return {
    command,
    exitCode,
    stdout,
    stderr,
    timedOut,
  };
}

/**
 * Writes failure artifacts for easier triage.
 */
export async function writeFailureArtifacts(input: FailureArtifactInput): Promise<string> {
  const safeName = input.testName.replace(/[^a-z0-9-_.]+/gi, "-").toLowerCase();
  const outputDir = join(input.artifactDir, safeName);
  await mkdir(outputDir, { recursive: true });

  const summary = {
    testName: input.testName,
    command: input.command,
    capturedAt: new Date().toISOString(),
    isolationPaths: input.isolationPaths,
  };

  await writeFile(join(outputDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  await writeFile(join(outputDir, "stdout.log"), input.stdout ?? "");
  await writeFile(join(outputDir, "stderr.log"), input.stderr ?? "");
  await writeFile(join(outputDir, "notes.txt"), input.notes ?? "");

  return outputDir;
}

/**
 * Best-effort helper that reads an on-disk file if present.
 */
export async function readIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Cleans up a temp fixture workspace.
 */
export async function cleanupFixtureWorkspace(workspace: FixtureWorkspace | null): Promise<void> {
  if (!workspace) {
    return;
  }
  await rm(workspace.tempRoot, { recursive: true, force: true });
}
