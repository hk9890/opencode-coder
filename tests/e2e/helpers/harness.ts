import { $ } from "bun";
import { constants, existsSync } from "fs";
import { access, chmod, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, symlink, writeFile } from "fs/promises";
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
export const AI_RESOURCES_DIR = join(fileURLToPath(new URL("../../..", import.meta.url)), "ai-resources");

export const FIXTURE_NAMES = [
  "empty-project",
  "coder-mode-configured",
  "coder-skill-installed",
  "beads-initialized",
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
const ISOLATED_GIT_AUTHOR_NAME = "opencode-coder-isolated";
const ISOLATED_GIT_AUTHOR_EMAIL = "isolated@opencode-coder.local";

export type PluginSource = "local-build" | "installed-configured";

export interface ResolvedInstalledConfiguredPlugin {
  packageSpec: string;
  hostConfigPath: string;
}

export interface PreparedPluginSource {
  pluginSource: PluginSource;
  workspaceDependenciesPrepared: boolean;
  localPluginSymlink?: string;
  resolvedInstalledPackageSpec?: string;
  resolvedHostConfigPath?: string;
  expectedLoadedPluginVersion?: string;
}

export interface PreparedCoderResourcesResult {
  prepared: boolean;
  strategy: "none" | "seeded" | "aimgr-installed";
}

const STAGE2_CODER_PACKAGES = ["package/coder-core", "package/coder-support", "package/coder-docs"] as const;
const STAGE3_BEADS_PACKAGES = [...STAGE2_CODER_PACKAGES, "package/coder-beads"] as const;

export interface IsolatedOpenCodePathOptions {
  pluginSource?: PluginSource;
  prewarmOpenCodeData?: boolean;
  prewarmCacheRoot?: string;
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
  prewarmedOpenCodeData: "disabled" | "applied" | "skipped";
  prewarmedOpenCodeDataReason?: string;
  prewarmedOpenCodeBaselineDir?: string;
  env: Record<string, string>;
}

interface PrewarmedOpenCodeDataResult {
  status: "applied" | "skipped";
  reason?: string;
  baselineDir?: string;
}

export type HostToolName = "opencode" | "git" | "aimgr" | "bd";
export type HostBinaryResolutionSource = "PATH" | "mise-latest" | "mise-scan";

export const STRIPPED_ENV_ALLOWLIST_KEYS = ["PATH", "USER", "LOGNAME", "LANG"] as const;

export interface HostBinaryResolution {
  tool: HostToolName;
  available: boolean;
  executablePath?: string;
  resolvedBinDir?: string;
  source?: HostBinaryResolutionSource;
}

export interface HostPrerequisiteOptions {
  /**
   * Require the real opencode runtime/CLI.
   * Defaults to true so runtime-facing suites fail fast unless they opt out explicitly.
   */
  requireOpencode?: boolean;
  /**
   * Require aimgr for aimgr-installed/additive coverage paths.
   */
  requireAimgr?: boolean;
  /**
   * Require bd for beads bootstrap coverage paths.
   */
  requireBd?: boolean;
}

export interface HostToolPrerequisiteResult extends HostBinaryResolution {
  required: boolean;
}

export interface HostPrerequisiteCheckResult {
  available: boolean;
  tools: HostToolPrerequisiteResult[];
  diagnostics?: string;
}

export interface PrependResolvedHostToolPathOptions {
  tools?: HostToolName[];
  env?: NodeJS.ProcessEnv;
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
const DEFAULT_PREWARMED_OPENCODE_DATA_CACHE_ROOT = join(
  tmpdir(),
  "opencode-coder",
  "prewarmed-opencode-data"
);
let isolatedTestManifestCache: IsolatedTestManifest | null = null;
const builtProjectRoots = new Set<string>();

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

export async function resolveHostBinary(
  executableName: HostToolName,
  env: NodeJS.ProcessEnv = process.env
): Promise<HostBinaryResolution> {
  const fromPath = await findExecutableOnPath(executableName, env);
  if (fromPath) {
    return {
      tool: executableName,
      available: true,
      executablePath: fromPath,
      resolvedBinDir: dirname(fromPath),
      source: "PATH",
    };
  }

  const homeDir = env.HOME?.trim() || homedir();
  const miseLatestCandidate = join(homeDir, ".local", "share", "mise", "installs", executableName, "latest", executableName);
  try {
    await access(miseLatestCandidate, constants.X_OK);
    return {
      tool: executableName,
      available: true,
      executablePath: miseLatestCandidate,
      resolvedBinDir: dirname(miseLatestCandidate),
      source: "mise-latest",
    };
  } catch {
    // continue to full mise scan
  }

  const installs = await findMiseInstalledExecutable(executableName, env);
  if (installs.length > 0) {
    const bestCandidate = installs[installs.length - 1];
    return {
      tool: executableName,
      available: true,
      executablePath: bestCandidate,
      resolvedBinDir: dirname(bestCandidate),
      source: "mise-scan",
    };
  }

  return {
    tool: executableName,
    available: false,
  };
}

function formatMissingRequiredToolsDiagnostics(results: HostToolPrerequisiteResult[]): string {
  const missingRequired = results.filter((result) => result.required && !result.available);
  const missingList = missingRequired.map((result) => result.tool).join(", ");

  const lines = [
    `Missing required host tools for test bootstrap: ${missingList}`,
    "",
    "Required host tools are resolved from PATH first, then from common mise install paths.",
    "Install the missing binaries and retry.",
    "",
    "Checks:",
    ...results.map((result) => {
      const requirement = result.required ? "required" : "conditional";
      const status = result.available
        ? `found at ${result.executablePath ?? "<unknown>"} (${result.source ?? "unknown source"})`
        : "not found";
      return `  - ${result.tool} (${requirement}): ${status}`;
    }),
  ];

  const pathEntries = process.env.PATH?.split(":").filter(Boolean) ?? [];
  if (pathEntries.length > 0) {
    lines.push("", `Current PATH entries: ${pathEntries.join(":")}`);
  }

  lines.push(
    "",
    "Tip: restart your shell/OpenCode host if binaries were recently installed and PATH has stale values."
  );

  return lines.join("\n");
}

export async function checkHostToolPrerequisites(
  options: HostPrerequisiteOptions = {}
): Promise<HostPrerequisiteCheckResult> {
  const contract: Array<{ tool: HostToolName; required: boolean }> = [
    { tool: "opencode", required: options.requireOpencode !== false },
    { tool: "git", required: true },
    { tool: "aimgr", required: options.requireAimgr === true },
    { tool: "bd", required: options.requireBd === true },
  ];

  const tools: HostToolPrerequisiteResult[] = [];
  for (const entry of contract) {
    const resolved = await resolveHostBinary(entry.tool);
    tools.push({
      ...resolved,
      required: entry.required,
    });
  }

  const hasMissingRequired = tools.some((result) => result.required && !result.available);
  if (hasMissingRequired) {
    return {
      available: false,
      tools,
      diagnostics: formatMissingRequiredToolsDiagnostics(tools),
    };
  }

  return {
    available: true,
    tools,
  };
}

export function prependResolvedHostToolBinDirs(
  tools: HostToolPrerequisiteResult[],
  options: PrependResolvedHostToolPathOptions = {}
): string {
  const env = options.env ?? process.env;
  const selectedTools = options.tools?.length ? new Set(options.tools) : null;
  const prependDirs: string[] = [];

  for (const tool of tools) {
    if (!tool.available || !tool.resolvedBinDir) {
      continue;
    }

    if (selectedTools && !selectedTools.has(tool.tool)) {
      continue;
    }

    if (!prependDirs.includes(tool.resolvedBinDir)) {
      prependDirs.push(tool.resolvedBinDir);
    }
  }

  if (prependDirs.length === 0) {
    return env.PATH ?? "";
  }

  const existingEntries = env.PATH?.split(":").filter(Boolean) ?? [];
  const nextPath = [...prependDirs, ...existingEntries.filter((entry) => !prependDirs.includes(entry))].join(":");
  env.PATH = nextPath;
  return nextPath;
}

export function buildStrippedHostEnv(
  sourceEnv: NodeJS.ProcessEnv = process.env,
  passthroughKeys: readonly string[] = STRIPPED_ENV_ALLOWLIST_KEYS
): Record<string, string> {
  const env: Record<string, string> = {};

  for (const key of passthroughKeys) {
    const value = sourceEnv[key];
    if (typeof value === "string" && value.trim().length > 0) {
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(sourceEnv)) {
    if (key.startsWith("LC_") && typeof value === "string" && value.trim().length > 0) {
      env[key] = value;
    }
  }

  return env;
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

function privateTestsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENCODE_CODER_PRIVATE_TESTS === "true";
}

async function getOptionalPinnedDynatracePluginSpec(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (!privateTestsEnabled(env)) {
    return null;
  }

  return getPinnedDynatracePluginSpec();
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
  const dynatraceSpec = await getOptionalPinnedDynatracePluginSpec();

  const filtered = fixturePluginSpecs.filter((spec) => {
    const packageName = parsePackageNameFromPluginSpec(spec);
    return packageName !== OPENCODE_CODER_PACKAGE_NAME && packageName !== OPENCODE_DYNATRACE_PACKAGE_NAME;
  });

  return dynatraceSpec ? [...filtered, dynatraceSpec] : filtered;
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

function buildIsolatedPackageManagerEnv(rootDir: string, sourceEnv: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env = buildStrippedHostEnv(sourceEnv);

  env.HOME = join(rootDir, ".harness-home");
  env.XDG_CONFIG_HOME = join(rootDir, ".harness-xdg-config");
  env.XDG_DATA_HOME = join(rootDir, ".harness-xdg-data");
  env.XDG_CACHE_HOME = join(rootDir, ".harness-xdg-cache");

  const nodeAuthToken = sourceEnv.NODE_AUTH_TOKEN?.trim();
  if (nodeAuthToken) {
    env.NODE_AUTH_TOKEN = nodeAuthToken;
  }

  return env;
}

function requiresDynatraceOssRegistry(pluginSpecsToPrepare: string[]): boolean {
  return pluginSpecsToPrepare.some((spec) => parsePackageNameFromPluginSpec(spec) === OPENCODE_CODER_PACKAGE_NAME);
}

async function installWorkspacePluginDependencies(
  rootDir: string,
  pluginSpecsToPrepare: string[],
  sourceEnv: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const scaffoldDependencies = await readHarnessScaffoldDependenciesFromManifest();
  const packageManagerEnv = buildIsolatedPackageManagerEnv(rootDir, sourceEnv);

  await mkdir(packageManagerEnv.HOME, { recursive: true });
  await mkdir(packageManagerEnv.XDG_CONFIG_HOME, { recursive: true });
  await mkdir(packageManagerEnv.XDG_DATA_HOME, { recursive: true });
  await mkdir(packageManagerEnv.XDG_CACHE_HOME, { recursive: true });

  const needsDynatraceRegistry = requiresDynatraceOssRegistry(pluginSpecsToPrepare);
  if (needsDynatraceRegistry && !packageManagerEnv.NODE_AUTH_TOKEN) {
    throw new Error(
      "Missing GitHub Packages auth token for installed-configured plugin preparation. Set NODE_AUTH_TOKEN explicitly before running installed-configured launcher coverage."
    );
  }

  await writeFile(
    join(rootDir, ".npmrc"),
    [
      "@dynatrace-oss:registry=https://npm.pkg.github.com",
      "always-auth=true",
      "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}",
      "",
    ].join("\n")
  );

  await writeFile(
    join(rootDir, "package.json"),
    JSON.stringify(
      {
        private: true,
        dependencies: scaffoldDependencies,
      },
      null,
      2
    ) + "\n"
  );

  const normalizedPluginSpecs = pluginSpecsToPrepare.map((spec) => spec.trim()).filter((spec) => spec.length > 0);
  if (normalizedPluginSpecs.length > 0) {
    const addResult = await $`bun add --exact ${normalizedPluginSpecs}`.cwd(rootDir).env(packageManagerEnv).quiet();
    if (addResult.exitCode !== 0) {
      throw new Error(`Failed to prepare configured plugin package(s):\n${addResult.stderr.toString()}`);
    }
    return;
  }

  const installBaseResult = await $`bun install`.cwd(rootDir).env(packageManagerEnv).quiet();
  if (installBaseResult.exitCode !== 0) {
    throw new Error(`Failed to install isolated OpenCode config dependencies:\n${installBaseResult.stderr.toString()}`);
  }
}

async function installHermeticLocalCoderPackage(rootDir: string, version: string = "0.34.2"): Promise<void> {
  const packageDir = join(rootDir, "node_modules", "@dynatrace-oss", "opencode-coder");

  await mkdir(packageDir, { recursive: true });
  const builtPluginPath = await ensurePluginBuilt(join(fileURLToPath(new URL("../../..", import.meta.url))));
  await mkdir(join(packageDir, "dist"), { recursive: true });
  await cp(builtPluginPath, join(packageDir, "dist", "opencode-coder.js"), { force: true });
  await writeFile(
    join(packageDir, "package.json"),
    JSON.stringify(
        {
          name: OPENCODE_CODER_PACKAGE_NAME,
          version,
          type: "module",
          main: "dist/opencode-coder.js",
        },
      null,
      2
    ) + "\n"
  );
}

async function wireInstalledConfiguredPluginArtifact(
  opencodeConfigDir: string,
  packageSpec: string,
  hostEnv: NodeJS.ProcessEnv = process.env
): Promise<{
  pluginSymlink: string;
  installedVersion: string;
}> {
  const normalizedSpec = packageSpec.trim();
  if (!normalizedSpec) {
    throw new Error("Cannot prepare installed-configured plugin source: package spec is empty");
  }

  const pluginDir = join(opencodeConfigDir, "plugins");
  const pluginSymlink = join(pluginDir, "opencode-coder.js");
  const packageDir = join(opencodeConfigDir, "node_modules", "@dynatrace-oss", "opencode-coder");
  const pluginEntrypoint = join(packageDir, "dist", "opencode-coder.js");
  const packageJsonPath = join(packageDir, "package.json");
  const dynatraceSpec = await getOptionalPinnedDynatracePluginSpec();
  const requestedVersionFromSpec = parseExactVersionFromPluginSpec(normalizedSpec);

  await mkdir(pluginDir, { recursive: true });
  if (hostEnv.CI === "true") {
    await installWorkspacePluginDependencies(opencodeConfigDir, dynatraceSpec ? [dynatraceSpec] : [], hostEnv);
    await installHermeticLocalCoderPackage(opencodeConfigDir, requestedVersionFromSpec ?? "0.34.2");
  } else {
    await installWorkspacePluginDependencies(opencodeConfigDir, [...(dynatraceSpec ? [dynatraceSpec] : []), normalizedSpec], hostEnv);
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

  let installedVersion =
    typeof (installedPackageJson as { version?: unknown }).version === "string"
      ? (installedPackageJson as { version: string }).version.trim()
      : "";
  if (!installedVersion && requestedVersionFromSpec) {
    installedVersion = requestedVersionFromSpec;
  }
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

async function resolveOpencodeExecutablePath(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const opencode = await resolveHostBinary("opencode", env);
  return opencode.executablePath ?? null;
}

async function ensurePrewarmedOpenCodeDataBaseline(cacheRoot: string): Promise<PrewarmedOpenCodeDataResult> {
  const executablePath = await resolveOpencodeExecutablePath();
  if (!executablePath) {
    return {
      status: "skipped",
      reason: "opencode binary unavailable while preparing prewarmed OpenCode data baseline",
    };
  }

  const executableStat = await stat(executablePath);
  const signature = Buffer.from(`${executablePath}:${executableStat.mtimeMs.toFixed(0)}`).toString("hex");
  const baselineRoot = join(cacheRoot, signature);
  const baselineDataDir = join(baselineRoot, "opencode");
  const baselineMarker = join(baselineDataDir, ".opencode-coder-prewarmed.json");

  if (!(await Bun.file(baselineMarker).exists())) {
    await mkdir(cacheRoot, { recursive: true });

    const buildRoot = await mkdtemp(join(cacheRoot, "build-"));
    const homeDir = join(buildRoot, "home");
    const xdgConfigHome = join(buildRoot, "xdg-config");
    const xdgDataHome = join(buildRoot, "xdg-data");
    const xdgCacheHome = join(buildRoot, "xdg-cache");
    const opencodeConfigDir = join(xdgConfigHome, "opencode");

    try {
      await mkdir(homeDir, { recursive: true });
      await mkdir(xdgConfigHome, { recursive: true });
      await mkdir(xdgDataHome, { recursive: true });
      await mkdir(xdgCacheHome, { recursive: true });
      await mkdir(opencodeConfigDir, { recursive: true });

      await writeFile(join(opencodeConfigDir, "opencode.json"), "{}\n", "utf8");

      const prewarmProc = Bun.spawn({
        cmd: [executablePath, "--help"],
        cwd: buildRoot,
        env: {
          ...process.env,
          PATH: [dirname(executablePath), process.env.PATH ?? ""].filter((entry) => entry && entry.length > 0).join(":"),
          HOME: homeDir,
          XDG_CONFIG_HOME: xdgConfigHome,
          XDG_DATA_HOME: xdgDataHome,
          XDG_CACHE_HOME: xdgCacheHome,
          OPENCODE_CONFIG_DIR: opencodeConfigDir,
          OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(prewarmProc.stdout).text(),
        new Response(prewarmProc.stderr).text(),
        prewarmProc.exited,
      ]);

      if (exitCode !== 0) {
        throw new Error(`opencode --help failed while generating prewarmed baseline (exit ${exitCode.toString()}).\n${stderr || stdout}`);
      }

      const generatedDataDir = join(xdgDataHome, "opencode");
      if (!(await Bun.file(join(generatedDataDir, "opencode.db")).exists())) {
        throw new Error("Prewarmed OpenCode baseline generation did not create opencode.db");
      }

      await writeFile(
        join(generatedDataDir, ".opencode-coder-prewarmed.json"),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            executablePath,
            executableMtimeMs: executableStat.mtimeMs,
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      const stagingDir = join(cacheRoot, `${signature}.staging`);
      await rm(stagingDir, { recursive: true, force: true });
      await mkdir(stagingDir, { recursive: true });
      await cp(generatedDataDir, join(stagingDir, "opencode"), { recursive: true, force: true });

      await rm(baselineRoot, { recursive: true, force: true });
      await rename(stagingDir, baselineRoot);
    } finally {
      await rm(buildRoot, { recursive: true, force: true });
    }
  }

  return {
    status: "applied",
    baselineDir: baselineDataDir,
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
  const alreadyBuilt = builtProjectRoots.has(projectRoot);

  if (!alreadyBuilt) {
    const result = await $`bun run build`.cwd(projectRoot).quiet();
    if (result.exitCode !== 0) {
      throw new Error(`Failed to build plugin:\n${result.stderr.toString()}`);
    }
    builtProjectRoots.add(projectRoot);
  } else {
    try {
      await access(pluginPath);
    } catch {
      const result = await $`bun run build`.cwd(projectRoot).quiet();
      if (result.exitCode !== 0) {
        throw new Error(`Failed to build plugin:\n${result.stderr.toString()}`);
      }
    }
  }

  await access(pluginPath);
  return pluginPath;
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

  if (workspaceSource.kind === "fixture") {
    const runtimeForbiddenScaffoldingPaths = [
      join(workdir, "README.md"),
      join(workdir, ".gitkeep"),
      join(workdir, ".opencode", ".gitkeep"),
      join(workdir, ".beads", ".gitkeep"),
    ];

    for (const filePath of runtimeForbiddenScaffoldingPaths) {
      await rm(filePath, { force: true });
    }
  }

  await $`git init --quiet`.cwd(workdir).quiet();
  await $`git config user.name "opencode-coder-test"`.cwd(workdir).quiet();
  await $`git config user.email "test@opencode-coder.local"`.cwd(workdir).quiet();

  // Auto-initialize beads if .beads/ marker exists in fixture
  const beadsMarker = join(workdir, ".beads");
  try {
    await access(beadsMarker);
    // bd init creates a functional beads workspace from the marker.
    // Force non-interactive mode so manual launcher TTY sessions never block on prompts.
    const bdInit = await $`bd init --non-interactive --skip-hooks --skip-agents --quiet`.cwd(workdir).quiet();
    if (bdInit.exitCode !== 0) {
      // Non-fatal: beads init failure should not break fixture setup
      // bd may not be installed in all test environments
      console.error(`[harness] beads auto-init skipped (bd init exit ${bdInit.exitCode})`);
    } else {
      // Secure .beads/ permissions to avoid bd warning (expects 0700)
      await chmod(beadsMarker, 0o700);
    }
  } catch {
    // No .beads/ marker — nothing to do
  }

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

  await rm(pluginSymlink, { force: true });
  await symlink(pluginPath, pluginSymlink);

  return pluginSymlink;
}

/**
 * Injects this repository's built plugin into an isolated OpenCode config directory.
 */
export async function wireBuiltPluginArtifactToConfigDir(projectRoot: string, opencodeConfigDir: string): Promise<string> {
  const pluginPath = await ensurePluginBuilt(projectRoot);
  const pluginDir = join(opencodeConfigDir, "plugins");
  const pluginSymlink = join(pluginDir, "opencode-coder.js");

  await mkdir(pluginDir, { recursive: true });
  await rm(pluginSymlink, { force: true });
  await symlink(pluginPath, pluginSymlink);

  return pluginSymlink;
}

async function seedAiResourcesToDirectory(projectRoot: string, targetDir: string): Promise<void> {
  const aiResourcesDir = join(projectRoot, "ai-resources");

  // Agents
  const agentsSource = join(aiResourcesDir, "agents");
  const agentsDest = join(targetDir, "agents");
  await cp(agentsSource, agentsDest, { recursive: true });

  // Commands
  const commandsSource = join(aiResourcesDir, "commands");
  const commandsDest = join(targetDir, "commands");
  await cp(commandsSource, commandsDest, { recursive: true });

  // Skills (seed split ownership surfaces only)
  for (const skill of ["coder-core", "coder-docs", "code-simplify", "complexity-review", "coder-beads"]) {
    const skillSource = join(aiResourcesDir, "skills", skill);
    const skillDest = join(targetDir, "skills", skill);
    // Check source exists before copying (some skills may not exist in all setups)
    try {
      await access(skillSource);
      await cp(skillSource, skillDest, { recursive: true });
    } catch {
      // Skip missing skill directories
    }
  }
}

export async function seedAiResources(projectRoot: string, workdir: string): Promise<void> {
  await seedAiResourcesToDirectory(projectRoot, join(workdir, ".opencode"));
}

export async function seedAiResourcesToConfigDir(projectRoot: string, opencodeConfigDir: string): Promise<void> {
  await seedAiResourcesToDirectory(projectRoot, opencodeConfigDir);
}

export async function prepareCoderFixtureResources(options: {
  projectRoot: string;
  workdir: string;
  opencodeConfigDir: string;
  fixtureName?: FixtureName;
  pluginSource?: PluginSource;
  env?: Record<string, string>;
}): Promise<PreparedCoderResourcesResult> {
  const fixtureName = options.fixtureName;
  const pluginSource = options.pluginSource ?? DEFAULT_PLUGIN_SOURCE;

  if (fixtureName === "empty-project" || fixtureName === "coder-mode-configured") {
    return { prepared: false, strategy: "none" };
  }

  if (!fixtureName) {
    if (pluginSource === "local-build") {
      await seedAiResourcesToConfigDir(options.projectRoot, options.opencodeConfigDir);
      return { prepared: true, strategy: "seeded" };
    }

    return { prepared: false, strategy: "none" };
  }

  if (fixtureName !== "coder-skill-installed" && fixtureName !== "beads-initialized") {
    return { prepared: false, strategy: "none" };
  }

  if (pluginSource !== "local-build") {
    return { prepared: false, strategy: "none" };
  }

  const env = options.env ?? process.env;
  const workspacePackageYaml = await Bun.file(join(options.workdir, "ai.package.yaml")).exists();
  if (!workspacePackageYaml) {
    const initResult = await $`aimgr init`.cwd(options.workdir).env(env).quiet();
    if (initResult.exitCode !== 0) {
      throw new Error(`Failed to initialize aimgr project manifest:\n${initResult.stderr.toString()}`);
    }
  }

  const repoInitResult = await $`aimgr repo init`.cwd(options.workdir).env(env).quiet();
  if (repoInitResult.exitCode !== 0) {
    throw new Error(`Failed to initialize isolated aimgr repo:\n${repoInitResult.stderr.toString()}`);
  }

  const repoAddResult = await $`aimgr repo add local:${AI_RESOURCES_DIR}`.cwd(options.workdir).env(env).quiet();
  if (repoAddResult.exitCode !== 0) {
    throw new Error(`Failed to add local ai-resources repo:\n${repoAddResult.stderr.toString()}`);
  }

  const packagesToInstall = fixtureName === "beads-initialized" ? STAGE3_BEADS_PACKAGES : STAGE2_CODER_PACKAGES;
  const installResult = await $`aimgr install --target opencode ${packagesToInstall}`
    .cwd(options.workdir)
    .env(env)
    .quiet();
  if (installResult.exitCode !== 0) {
    throw new Error(
      `Failed to install split capability packages for fixture workspace:\n${installResult.stderr.toString()}`
    );
  }

  return { prepared: true, strategy: "aimgr-installed" };
}

export async function prepareWorkspacePluginSource(options: {
  projectRoot: string;
  opencodeConfigDir: string;
  pluginSource?: PluginSource;
  hostEnv?: NodeJS.ProcessEnv;
  hostHomeDir?: string;
}): Promise<PreparedPluginSource> {
  const pluginSource = options.pluginSource ?? DEFAULT_PLUGIN_SOURCE;

  if (pluginSource === "local-build") {
    const localPluginSymlink = await wireBuiltPluginArtifactToConfigDir(options.projectRoot, options.opencodeConfigDir);
    return {
      pluginSource,
      workspaceDependenciesPrepared: false,
      localPluginSymlink,
    };
  }

  const localPluginSymlink = join(options.opencodeConfigDir, "plugins", "opencode-coder.js");
  await rm(localPluginSymlink, { force: true });

  const resolved = await resolveInstalledConfiguredPluginFromHostConfig(options.hostEnv, options.hostHomeDir);
  const wiredInstalledArtifact = await wireInstalledConfiguredPluginArtifact(
    options.opencodeConfigDir,
    resolved.packageSpec,
    options.hostEnv
  );
  const pinnedVersionFromSpec = parseExactVersionFromPluginSpec(resolved.packageSpec);

  if (pinnedVersionFromSpec && pinnedVersionFromSpec !== wiredInstalledArtifact.installedVersion) {
    throw new Error(
      `Installed package version mismatch after prepare: spec requested ${pinnedVersionFromSpec} but resolved ${wiredInstalledArtifact.installedVersion}`
    );
  }

  return {
    pluginSource,
    workspaceDependenciesPrepared: true,
    localPluginSymlink: wiredInstalledArtifact.pluginSymlink,
    resolvedInstalledPackageSpec: resolved.packageSpec,
    resolvedHostConfigPath: resolved.hostConfigPath,
    expectedLoadedPluginVersion: wiredInstalledArtifact.installedVersion,
  };
}

/**
 * Creates isolated HOME/XDG/OpenCode path roots to prevent global plugin discovery.
 */
export async function createIsolatedOpenCodePaths(
  baseDir: string,
  options?: Pick<IsolatedOpenCodePathOptions, "prewarmOpenCodeData" | "prewarmCacheRoot">
): Promise<IsolatedOpenCodePaths> {
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

  let prewarmedOpenCodeData: IsolatedOpenCodePaths["prewarmedOpenCodeData"] = "disabled";
  let prewarmedOpenCodeDataReason: string | undefined;
  let prewarmedOpenCodeBaselineDir: string | undefined;

  if (options?.prewarmOpenCodeData) {
    const prewarmResult = await ensurePrewarmedOpenCodeDataBaseline(
      options.prewarmCacheRoot ?? DEFAULT_PREWARMED_OPENCODE_DATA_CACHE_ROOT
    );
    if (prewarmResult.status === "applied") {
      const opencodeDataDir = join(xdgDataHome, "opencode");
      await rm(opencodeDataDir, { recursive: true, force: true });
      await cp(prewarmResult.baselineDir as string, opencodeDataDir, { recursive: true, force: true });
      prewarmedOpenCodeData = "applied";
      prewarmedOpenCodeBaselineDir = prewarmResult.baselineDir;
    } else {
      prewarmedOpenCodeData = "skipped";
      prewarmedOpenCodeDataReason = prewarmResult.reason;
    }
  }

  return {
    root,
    homeDir,
    xdgConfigHome,
    xdgDataHome,
    xdgCacheHome,
    opencodeConfigDir,
    prewarmedOpenCodeData,
    prewarmedOpenCodeDataReason,
    prewarmedOpenCodeBaselineDir,
    env: {
      HOME: homeDir,
      XDG_CONFIG_HOME: xdgConfigHome,
      XDG_DATA_HOME: xdgDataHome,
      XDG_CACHE_HOME: xdgCacheHome,
      OPENCODE_CONFIG_DIR: opencodeConfigDir,
      OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
      GIT_AUTHOR_NAME: ISOLATED_GIT_AUTHOR_NAME,
      GIT_AUTHOR_EMAIL: ISOLATED_GIT_AUTHOR_EMAIL,
      GIT_COMMITTER_NAME: ISOLATED_GIT_AUTHOR_NAME,
      GIT_COMMITTER_EMAIL: ISOLATED_GIT_AUTHOR_EMAIL,
    },
  };
}

export async function createIsolatedOpenCodePathsWithPluginSource(
  baseDir: string,
  options: IsolatedOpenCodePathOptions
): Promise<IsolatedOpenCodePaths> {
  const paths = await createIsolatedOpenCodePaths(baseDir, {
    prewarmOpenCodeData: options.prewarmOpenCodeData,
    prewarmCacheRoot: options.prewarmCacheRoot,
  });
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
