import { $ } from "bun";
import { existsSync } from "fs";
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "fs/promises";
import { createServer } from "net";
import { homedir, tmpdir } from "os";
import { dirname, join, relative, sep } from "path";
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

export type WorkspaceSource =
  | {
      kind: "fixture";
      fixtureName: FixtureName;
      sourceDir: string;
    }
  | {
      kind: "project-path";
      projectPath: string;
      sourceDir: string;
    };

export function isFixtureName(value: string): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value);
}

export interface FixtureWorkspace {
  fixtureName?: FixtureName;
  fixtureSourceDir?: string;
  workspaceSource: WorkspaceSource;
  projectSourceDir: string;
  tempRoot: string;
  workdir: string;
}

export const OPENCODE_CODER_PACKAGE_NAME = "@dynatrace-oss/opencode-coder";

export type PluginSource = "local-build" | "installed-configured";

export interface ResolvedInstalledConfiguredPlugin {
  packageSpec: string;
  hostConfigPath: string;
}

export interface PreparedPluginSource {
  pluginSource: PluginSource;
  localPluginSymlink?: string;
  resolvedInstalledPackageSpec?: string;
  resolvedHostConfigPath?: string;
  expectedLoadedPluginVersion?: string;
}

export interface IsolatedOpenCodePathOptions {
  pluginSource?: PluginSource;
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

const DEFAULT_PLUGIN_SOURCE: PluginSource = "local-build";
const EXCLUDED_COPY_SEGMENTS = [".git", ".beads", ".opencode"] as const;

function parsePackageNameFromPluginSpec(spec: string): string {
  const trimmed = spec.trim();
  if (!trimmed) {
    return "";
  }

  if (!trimmed.startsWith("@")) {
    const atIndex = trimmed.lastIndexOf("@");
    return atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;
  }

  const versionSeparator = trimmed.lastIndexOf("@");
  if (versionSeparator <= 0) {
    return trimmed;
  }

  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0) {
    return trimmed;
  }

  return versionSeparator > slashIndex ? trimmed.slice(0, versionSeparator) : trimmed;
}

function readPluginSpecsFromConfig(config: unknown): string[] {
  if (!config || typeof config !== "object") {
    return [];
  }

  const rawPlugins = (config as { plugin?: unknown }).plugin;
  if (!Array.isArray(rawPlugins)) {
    return [];
  }

  return rawPlugins.filter((entry): entry is string => typeof entry === "string");
}

export function resolveHostOpenCodeConfigPath(
  hostEnv: NodeJS.ProcessEnv = process.env,
  hostHomeDir: string = homedir()
): string {
  const explicitConfigDir = hostEnv.OPENCODE_CONFIG_DIR?.trim();
  if (explicitConfigDir) {
    return join(explicitConfigDir, "opencode.json");
  }

  const xdgConfigHome = hostEnv.XDG_CONFIG_HOME?.trim();
  if (xdgConfigHome) {
    return join(xdgConfigHome, "opencode", "opencode.json");
  }

  return join(hostHomeDir, ".config", "opencode", "opencode.json");
}

export async function resolveInstalledConfiguredPluginFromHostConfig(
  hostEnv: NodeJS.ProcessEnv = process.env,
  hostHomeDir: string = homedir()
): Promise<ResolvedInstalledConfiguredPlugin> {
  const hostConfigPath = resolveHostOpenCodeConfigPath(hostEnv, hostHomeDir);

  let hostConfigRaw: string;
  try {
    hostConfigRaw = await readFile(hostConfigPath, "utf8");
  } catch {
    throw new Error(`Host OpenCode config not found: ${hostConfigPath}`);
  }

  let hostConfig: unknown;
  try {
    hostConfig = JSON.parse(hostConfigRaw);
  } catch {
    throw new Error(`Host OpenCode config is invalid JSON: ${hostConfigPath}`);
  }

  const pluginSpecs = readPluginSpecsFromConfig(hostConfig);
  const matches = pluginSpecs.filter((spec) => parsePackageNameFromPluginSpec(spec) === OPENCODE_CODER_PACKAGE_NAME);

  if (matches.length === 0) {
    throw new Error(
      `Host config must contain exactly one ${OPENCODE_CODER_PACKAGE_NAME} plugin entry (found 0 at ${hostConfigPath})`
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Host config must contain exactly one ${OPENCODE_CODER_PACKAGE_NAME} plugin entry (found ${matches.length.toString()} at ${hostConfigPath})`
    );
  }

  return {
    packageSpec: matches[0],
    hostConfigPath,
  };
}

async function readSharedProviderPluginSpecs(): Promise<string[]> {
  const fixtureRaw = await readFile(OPENCODE_CONFIG_FIXTURE_PATH, "utf8");
  const fixtureConfig = JSON.parse(fixtureRaw) as unknown;
  const fixturePluginSpecs = readPluginSpecsFromConfig(fixtureConfig);
  return fixturePluginSpecs.filter((spec) => parsePackageNameFromPluginSpec(spec) !== OPENCODE_CODER_PACKAGE_NAME);
}

function parseExactVersionFromPluginSpec(spec: string): string | null {
  const trimmed = spec.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("@")) {
    const atIndex = trimmed.lastIndexOf("@");
    return atIndex > 0 ? trimmed.slice(atIndex + 1).trim() : null;
  }

  const slashIndex = trimmed.indexOf("/");
  const atIndex = trimmed.lastIndexOf("@");
  if (slashIndex <= 0 || atIndex <= slashIndex) {
    return null;
  }

  const candidate = trimmed.slice(atIndex + 1).trim();
  if (!candidate) {
    return null;
  }

  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(candidate) ? candidate : null;
}

async function wireInstalledConfiguredPluginArtifact(workdir: string, packageSpec: string): Promise<{
  pluginSymlink: string;
  installedVersion: string;
}> {
  const normalizedSpec = packageSpec.trim();
  if (!normalizedSpec) {
    throw new Error("Cannot prepare installed-configured plugin source: package spec is empty");
  }

  const opencodeDir = join(workdir, ".opencode");
  const pluginDir = join(opencodeDir, "plugins");
  const pluginSymlink = join(pluginDir, "opencode-coder.js");
  const packageDir = join(opencodeDir, "node_modules", "@dynatrace-oss", "opencode-coder");
  const pluginEntrypoint = join(packageDir, "dist", "opencode-coder.js");
  const packageJsonPath = join(packageDir, "package.json");

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

  const installBaseResult = await $`bun install`.cwd(opencodeDir).quiet();
  if (installBaseResult.exitCode !== 0) {
    throw new Error(`Failed to install .opencode base dependencies:\n${installBaseResult.stderr.toString()}`);
  }

  const addInstalledResult = await $`bun add --exact ${normalizedSpec}`.cwd(opencodeDir).quiet();
  if (addInstalledResult.exitCode !== 0) {
    throw new Error(
      `Failed to prepare installed-configured plugin package (${normalizedSpec}):\n${addInstalledResult.stderr.toString()}`
    );
  }

  let installedPackageJsonRaw: string;
  try {
    installedPackageJsonRaw = await readFile(packageJsonPath, "utf8");
  } catch {
    throw new Error(`Installed package metadata missing after prepare: ${packageJsonPath}`);
  }

  let installedPackageJson: unknown;
  try {
    installedPackageJson = JSON.parse(installedPackageJsonRaw);
  } catch {
    throw new Error(`Installed package metadata is invalid JSON: ${packageJsonPath}`);
  }

  const installedVersion =
    typeof (installedPackageJson as { version?: unknown }).version === "string"
      ? (installedPackageJson as { version: string }).version.trim()
      : "";
  if (!installedVersion) {
    throw new Error(`Installed package metadata missing version field: ${packageJsonPath}`);
  }

  try {
    await access(pluginEntrypoint);
  } catch {
    throw new Error(`Installed plugin entrypoint missing after prepare: ${pluginEntrypoint}`);
  }

  await rm(pluginSymlink, { force: true });
  await symlink(pluginEntrypoint, pluginSymlink);

  return {
    pluginSymlink,
    installedVersion,
  };
}

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
  projectSourceDir?: string;
  tempWorkdir?: string;
  pluginSource?: PluginSource;
  resolvedPackageSpec?: string;
}

export interface OpencodeCliRunOptions {
  cwd: string;
  env: Record<string, string>;
  timeoutMs?: number;
  progressLabel?: string;
}

export interface OpencodeCliRunResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ProgressHeartbeatHandle {
  startedAt: number;
  stop: (summary: string) => void;
  elapsedMs: () => number;
}

export interface ProgressHeartbeatOptions {
  label: string;
  details?: string;
  intervalMs?: number;
}

export function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Emits start/heartbeat/summary progress lines to stderr for long-running e2e operations.
 */
export function startProgressHeartbeat(options: ProgressHeartbeatOptions): ProgressHeartbeatHandle {
  const startedAt = Date.now();
  const intervalMs = options.intervalMs ?? 15000;
  const detailSuffix = options.details ? ` (${options.details})` : "";
  console.error(`[e2e] ${options.label}: start${detailSuffix}`);

  const interval = setInterval(() => {
    const elapsed = formatElapsed(Date.now() - startedAt);
    console.error(`[e2e] ${options.label}: heartbeat after ${elapsed}`);
  }, intervalMs);

  return {
    startedAt,
    stop: (summary: string) => {
      clearInterval(interval);
      const elapsed = formatElapsed(Date.now() - startedAt);
      console.error(`[e2e] ${options.label}: ${summary} after ${elapsed}`);
    },
    elapsedMs: () => Date.now() - startedAt,
  };
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

  return createWorkspaceFromSource({
    kind: "fixture",
    fixtureName,
    sourceDir: fixtureSourceDir,
  });
}

/**
 * Copies an external project directory into an isolated temp workdir.
 */
export async function createProjectPathWorkspace(projectPath: string): Promise<FixtureWorkspace> {
  const normalizedPath = projectPath.trim();
  if (!normalizedPath) {
    throw new Error("Missing external project path");
  }

  return createWorkspaceFromSource({
    kind: "project-path",
    projectPath: normalizedPath,
    sourceDir: normalizedPath,
  });
}

function shouldCopyPath(sourceRoot: string, sourcePath: string): boolean {
  const rel = relative(sourceRoot, sourcePath);
  if (!rel) {
    return true;
  }

  const segments = rel.split(sep).filter(Boolean);
  if (EXCLUDED_COPY_SEGMENTS.some((excludedSegment) => segments.includes(excludedSegment))) {
    return false;
  }

  if (segments[0] === ".coder") {
    if (segments[1] === "project.yaml") {
      return false;
    }

    if (segments[1] === "logs") {
      return false;
    }
  }

  return true;
}

async function createWorkspaceFromSource(workspaceSource: WorkspaceSource): Promise<FixtureWorkspace> {
  const sourceLabel = workspaceSource.kind === "fixture" ? workspaceSource.fixtureName : "project-path";
  const tempRoot = await mkdtemp(join(tmpdir(), `opencode-coder-${sourceLabel}-`));
  const workdir = join(tempRoot, "project");

  if (workspaceSource.kind === "project-path") {
    await cp(workspaceSource.sourceDir, workdir, {
      recursive: true,
      filter: async (sourcePath) => shouldCopyPath(workspaceSource.sourceDir, sourcePath),
    });
  } else {
    await cp(workspaceSource.sourceDir, workdir, { recursive: true });
  }

  await $`git init --quiet`.cwd(workdir).quiet();

  return {
    fixtureName: workspaceSource.kind === "fixture" ? workspaceSource.fixtureName : undefined,
    fixtureSourceDir: workspaceSource.kind === "fixture" ? workspaceSource.sourceDir : undefined,
    workspaceSource,
    projectSourceDir: workspaceSource.sourceDir,
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

export async function prepareWorkspacePluginSource(options: {
  projectRoot: string;
  workdir: string;
  pluginSource?: PluginSource;
  hostEnv?: NodeJS.ProcessEnv;
  hostHomeDir?: string;
}): Promise<PreparedPluginSource> {
  const pluginSource = options.pluginSource ?? DEFAULT_PLUGIN_SOURCE;

  if (pluginSource === "local-build") {
    const localPluginSymlink = await wireBuiltPluginArtifact(options.projectRoot, options.workdir);
    return {
      pluginSource,
      localPluginSymlink,
    };
  }

  const localPluginSymlink = join(options.workdir, ".opencode", "plugins", "opencode-coder.js");
  await rm(localPluginSymlink, { force: true });

  const resolved = await resolveInstalledConfiguredPluginFromHostConfig(options.hostEnv, options.hostHomeDir);
  const wiredInstalledArtifact = await wireInstalledConfiguredPluginArtifact(options.workdir, resolved.packageSpec);
  const pinnedVersionFromSpec = parseExactVersionFromPluginSpec(resolved.packageSpec);

  if (pinnedVersionFromSpec && pinnedVersionFromSpec !== wiredInstalledArtifact.installedVersion) {
    throw new Error(
      `Installed package version mismatch after prepare: spec requested ${pinnedVersionFromSpec} but resolved ${wiredInstalledArtifact.installedVersion}`
    );
  }

  return {
    pluginSource,
    localPluginSymlink: wiredInstalledArtifact.pluginSymlink,
    resolvedInstalledPackageSpec: resolved.packageSpec,
    resolvedHostConfigPath: resolved.hostConfigPath,
    expectedLoadedPluginVersion: wiredInstalledArtifact.installedVersion,
  };
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

export async function createIsolatedOpenCodePathsWithPluginSource(
  baseDir: string,
  options: IsolatedOpenCodePathOptions
): Promise<IsolatedOpenCodePaths> {
  const paths = await createIsolatedOpenCodePaths(baseDir);
  const pluginSource = options.pluginSource ?? DEFAULT_PLUGIN_SOURCE;

  if (pluginSource === "local-build") {
    return paths;
  }

  const configPath = join(paths.opencodeConfigDir, "opencode.json");
  const configRaw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(configRaw) as { plugin?: unknown };
  const sharedProviderSpecs = await readSharedProviderPluginSpecs();
  parsed.plugin = sharedProviderSpecs;
  await writeFile(configPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");

  return paths;
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
  const progress = startProgressHeartbeat({
    label: options.progressLabel ?? "opencode cli",
    details: `${command}; timeout ${timeoutMs.toString()}ms`,
  });

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
    console.error(
      `[e2e] ${options.progressLabel ?? "opencode cli"}: timeout reached at ${formatElapsed(
        progress.elapsedMs()
      )}; sending kill signal`
    );
    proc.kill();
  }, timeoutMs);

  let stdout = "";
  let stderr = "";
  let exitCode = -1;

  try {
    [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
  } finally {
    clearTimeout(timer);
    const status = timedOut ? "timed out" : `exit ${exitCode.toString()}`;
    progress.stop(status);
  }

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
    projectSourceDir: input.projectSourceDir,
    tempWorkdir: input.tempWorkdir,
    pluginSource: input.pluginSource,
    resolvedPackageSpec: input.resolvedPackageSpec,
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
