import { $ } from "bun";
import { constants, existsSync } from "fs";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "fs/promises";
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
export const ISOLATED_TEST_MANIFEST_PATH = join(SHARED_FIXTURES_DIR, "test-manifest.json");
export const HARNESS_SOURCE_PATH = join(E2E_DIR, "helpers", "harness.ts");

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

export interface WorkspaceCreationOptions {
  tempRoot?: string;
}

export const OPENCODE_CODER_PACKAGE_NAME = "@dynatrace-oss/opencode-coder";
export const OPENCODE_DYNATRACE_PACKAGE_NAME = "@hk9890/opencode-dynatrace";

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

interface IsolatedTestManifest {
  pins: Record<string, string>;
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
let isolatedTestManifestCache: IsolatedTestManifest | null = null;

async function findExecutableOnPath(
  executableName: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | null> {
  const pathEntries = env.PATH?.split(":").filter(Boolean) ?? [];

  for (const entry of pathEntries) {
    const candidate = join(entry, executableName);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // continue searching other PATH entries
    }
  }

  return null;
}

async function findMiseInstalledExecutable(
  executableName: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> {
  const homeDir = env.HOME?.trim() || homedir();
  const installsDir = join(homeDir, ".local", "share", "mise", "installs", executableName);

  try {
    const versions = await readdir(installsDir);
    const matches: string[] = [];

    for (const version of versions) {
      const candidate = join(installsDir, version, executableName);
      try {
        await access(candidate, constants.X_OK);
        matches.push(candidate);
      } catch {
        // skip non-executable/missing candidates
      }
    }

    return matches.sort();
  } catch {
    return [];
  }
}

function buildPluginSpecFromPin(packageName: string, versionRange: string): string {
  const trimmedPackage = packageName.trim();
  const trimmedVersion = versionRange.trim();
  if (!trimmedPackage || !trimmedVersion) {
    throw new Error(`Cannot build plugin spec from invalid pin: ${packageName} -> ${versionRange}`);
  }
  return `${trimmedPackage}@${trimmedVersion}`;
}

export async function readIsolatedTestManifest(): Promise<IsolatedTestManifest> {
  if (isolatedTestManifestCache) {
    return isolatedTestManifestCache;
  }

  const raw = await readFile(ISOLATED_TEST_MANIFEST_PATH, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Isolated test manifest is invalid JSON: ${ISOLATED_TEST_MANIFEST_PATH}`);
  }

  if (!parsed || typeof parsed !== "object" || !("pins" in parsed)) {
    throw new Error(`Isolated test manifest must include a pins object: ${ISOLATED_TEST_MANIFEST_PATH}`);
  }

  const pins = (parsed as { pins: unknown }).pins;
  if (!pins || typeof pins !== "object" || Array.isArray(pins)) {
    throw new Error(`Isolated test manifest pins must be an object: ${ISOLATED_TEST_MANIFEST_PATH}`);
  }

  const normalizedPins: Record<string, string> = {};
  for (const [key, value] of Object.entries(pins as Record<string, unknown>)) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(
        `Isolated test manifest pin must be a non-empty string for ${key}: ${ISOLATED_TEST_MANIFEST_PATH}`
      );
    }
    normalizedPins[key] = value.trim();
  }

  isolatedTestManifestCache = { pins: normalizedPins };
  return isolatedTestManifestCache;
}

async function getPinnedVersionFromManifest(packageName: string): Promise<string> {
  const manifest = await readIsolatedTestManifest();
  const pinned = manifest.pins[packageName]?.trim();
  if (!pinned) {
    throw new Error(`Missing required pinned dependency '${packageName}' in ${ISOLATED_TEST_MANIFEST_PATH}`);
  }

  return pinned;
}

async function getPinnedDynatracePluginSpec(): Promise<string> {
  const pinnedVersion = await getPinnedVersionFromManifest(OPENCODE_DYNATRACE_PACKAGE_NAME);
  return buildPluginSpecFromPin(OPENCODE_DYNATRACE_PACKAGE_NAME, pinnedVersion);
}

export async function readHarnessScaffoldDependenciesFromManifest(): Promise<Record<string, string>> {
  return {
    "@opencode-ai/plugin": await getPinnedVersionFromManifest("@opencode-ai/plugin"),
  };
}

async function buildSharedConfiguredPluginSpecs(): Promise<string[]> {
  const fixtureRaw = await readFile(OPENCODE_CONFIG_FIXTURE_PATH, "utf8");
  const fixtureConfig = JSON.parse(fixtureRaw) as unknown;
  const fixturePluginSpecs = readPluginSpecsFromConfig(fixtureConfig);
  const dynatraceSpec = await getPinnedDynatracePluginSpec();

  const filtered = fixturePluginSpecs.filter((spec) => {
    const packageName = parsePackageNameFromPluginSpec(spec);
    return packageName !== OPENCODE_CODER_PACKAGE_NAME && packageName !== OPENCODE_DYNATRACE_PACKAGE_NAME;
  });

  return [...filtered, dynatraceSpec];
}

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

async function installWorkspacePluginDependencies(workdir: string, pluginSpecsToPrepare: string[]): Promise<void> {
  const opencodeDir = join(workdir, ".opencode");
  const scaffoldDependencies = await readHarnessScaffoldDependenciesFromManifest();

  await writeFile(
    join(opencodeDir, "package.json"),
    JSON.stringify(
      {
        private: true,
        dependencies: scaffoldDependencies,
      },
      null,
      2
    ) + "\n"
  );

  const installBaseResult = await $`bun install`.cwd(opencodeDir).quiet();
  if (installBaseResult.exitCode !== 0) {
    throw new Error(`Failed to install .opencode base dependencies:\n${installBaseResult.stderr.toString()}`);
  }

  for (const spec of pluginSpecsToPrepare) {
    const normalizedSpec = spec.trim();
    if (!normalizedSpec) {
      continue;
    }

    const addResult = await $`bun add --exact ${normalizedSpec}`.cwd(opencodeDir).quiet();
    if (addResult.exitCode !== 0) {
      throw new Error(`Failed to prepare configured plugin package (${normalizedSpec}):\n${addResult.stderr.toString()}`);
    }
  }
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
  await installWorkspacePluginDependencies(workdir, [await getPinnedDynatracePluginSpec(), normalizedSpec]);

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
  const opencodePath = await findExecutableOnPath("opencode");
  if (opencodePath) {
    return { available: true };
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

  const miseInstalls = await findMiseInstalledExecutable("opencode");
  if (miseInstalls.length > 0) {
    diagnostics.push(`  Found mise install: ${miseInstalls.join(", ")}`);
    diagnostics.push("  -> OpenCode exists on disk but is not currently on PATH");
  } else {
    diagnostics.push("  No opencode binary found in common mise install path");
  }

  const pathEntries = process.env.PATH?.split(":").filter((entry) => entry.includes("opencode")) ?? [];
  if (pathEntries.length > 0) {
    diagnostics.push(`  PATH entries containing 'opencode': ${pathEntries.join(", ")}`);
  }

  return { available: false, diagnostics: diagnostics.join("\n") };
}

/**
 * Checks whether the `aimgr` binary is available in PATH.
 */
export async function checkAimgrAvailability(): Promise<{ available: boolean; diagnostics?: string }> {
  const aimgrPath = await findExecutableOnPath("aimgr");
  if (aimgrPath) {
    return { available: true };
  }

  return {
    available: false,
    diagnostics:
      "aimgr binary not found in PATH. Active e2e scenarios may still prove plugin load and startup parity, but docs lifecycle commands remain gated when runtime resource verification cannot confirm healthy resources.",
  };
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
 * Ensures dist/opencode-coder.js exists and is fresh enough for e2e runs.
 */
export async function ensurePluginBuilt(projectRoot: string): Promise<string> {
  const pluginPath = join(projectRoot, "dist", "opencode-coder.js");
  const sourceRoots = [join(projectRoot, "src"), join(projectRoot, "ai-resources")];

  const newestSourceMtimeMs = await getNewestMtimeMsForPaths([
    ...sourceRoots,
    join(projectRoot, "package.json"),
  ]);

  let pluginMtimeMs = Number.NEGATIVE_INFINITY;

  try {
    pluginMtimeMs = (await stat(pluginPath)).mtimeMs;
  } catch {
    // Build below when artifact is missing.
  }

  if (pluginMtimeMs < newestSourceMtimeMs) {
    const result = await $`bun run build`.cwd(projectRoot).quiet();
    if (result.exitCode !== 0) {
      throw new Error(`Failed to build plugin:\n${result.stderr.toString()}`);
    }
  }

  await access(pluginPath);
  return pluginPath;
}

async function getNewestMtimeMsForPaths(paths: string[]): Promise<number> {
  let newestMtimeMs = Number.NEGATIVE_INFINITY;

  for (const targetPath of paths) {
    let targetStat;
    try {
      targetStat = await stat(targetPath);
    } catch {
      continue;
    }

    if (targetStat.isDirectory()) {
      const newestInDir = await getNewestMtimeMsForDirectory(targetPath);
      newestMtimeMs = Math.max(newestMtimeMs, newestInDir);
      continue;
    }

    newestMtimeMs = Math.max(newestMtimeMs, targetStat.mtimeMs);
  }

  return newestMtimeMs;
}

async function getNewestMtimeMsForDirectory(directory: string): Promise<number> {
  let newestMtimeMs = Number.NEGATIVE_INFINITY;
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      const newestInChild = await getNewestMtimeMsForDirectory(fullPath);
      newestMtimeMs = Math.max(newestMtimeMs, newestInChild);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStat = await stat(fullPath);
    newestMtimeMs = Math.max(newestMtimeMs, fileStat.mtimeMs);
  }

  return newestMtimeMs;
}

/**
 * Copies a committed fixture into an isolated temp workdir.
 */
export async function createFixtureWorkspace(
  fixtureName: FixtureName,
  options?: WorkspaceCreationOptions
): Promise<FixtureWorkspace> {
  const fixtureSourceDir = join(FIXTURES_DIR, fixtureName);

  return createWorkspaceFromSource({
    kind: "fixture",
    fixtureName,
    sourceDir: fixtureSourceDir,
  }, options);
}

/**
 * Uses an external project directory directly while preserving isolated HOME/XDG roots under tempRoot.
 */
export async function createProjectPathWorkspace(
  projectPath: string,
  options?: WorkspaceCreationOptions
): Promise<FixtureWorkspace> {
  const normalizedPath = projectPath.trim();
  if (!normalizedPath) {
    throw new Error("Missing external project path");
  }

  const tempRoot = options?.tempRoot ?? (await mkdtemp(join(tmpdir(), "opencode-coder-project-path-")));

  return {
    workspaceSource: {
      kind: "project-path",
      projectPath: normalizedPath,
      sourceDir: normalizedPath,
    },
    projectSourceDir: normalizedPath,
    tempRoot,
    workdir: normalizedPath,
  };
}

async function createWorkspaceFromSource(
  workspaceSource: WorkspaceSource,
  options?: WorkspaceCreationOptions
): Promise<FixtureWorkspace> {
  const sourceLabel = workspaceSource.kind === "fixture" ? workspaceSource.fixtureName : "project-path";
  const tempRoot = options?.tempRoot ?? (await mkdtemp(join(tmpdir(), `opencode-coder-${sourceLabel}-`)));
  const workdir = join(tempRoot, "project");

  await cp(workspaceSource.sourceDir, workdir, { recursive: true });

  await $`git init --quiet`.cwd(workdir).quiet();
  await $`git config user.name "opencode-coder-test"`.cwd(workdir).quiet();
  await $`git config user.email "test@opencode-coder.local"`.cwd(workdir).quiet();

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
  await installWorkspacePluginDependencies(workdir, [await getPinnedDynatracePluginSpec()]);

  await rm(pluginSymlink, { force: true });
  await symlink(pluginPath, pluginSymlink);

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

  const fixtureRaw = await readFile(OPENCODE_CONFIG_FIXTURE_PATH, "utf8");
  const parsed = JSON.parse(fixtureRaw) as Record<string, unknown>;
  parsed.plugin = await buildSharedConfiguredPluginSpecs();
  await writeFile(join(opencodeConfigDir, "opencode.json"), JSON.stringify(parsed, null, 2) + "\n", "utf8");

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
  parsed.plugin = await buildSharedConfiguredPluginSpecs();
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
  await rm(outputDir, { recursive: true, force: true });
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
