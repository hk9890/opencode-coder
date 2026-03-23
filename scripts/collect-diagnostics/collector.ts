import { mkdir, copyFile, readFile, readdir, stat, writeFile, access } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import YAML from "yaml";
import { discoverSessions, findLogDirectory } from "../log-analyzer/discovery";
import { filterLogs } from "../log-analyzer/filters";
import { parseLines } from "../log-analyzer/parser";

type ArtifactStatus = "included" | "missing" | "error" | "referenced";

export interface ArtifactRecord {
  status: ArtifactStatus;
  description: string;
  bundlePath?: string;
  sourcePath?: string;
  details?: string;
  count?: number;
}

export interface DiagnosticsManifest {
  manifestVersion: "1.0";
  collectedAt: string;
  collector: {
    script: string;
    packageVersion: string | null;
    bunVersion: string | null;
  };
  environment: {
    cwd: string;
    projectRoot: string;
    platform: NodeJS.Platform;
  };
  request: {
    sessionID?: string;
    requestedSessionExportPaths: string[];
  };
  pluginVersion: {
    packageJson: string | null;
    projectContext: string | null;
  };
  artifacts: {
    projectContextYaml: ArtifactRecord;
    projectLocalLogs: ArtifactRecord;
    opencodeSessionIndex: ArtifactRecord;
    opencodeSessionExtract: ArtifactRecord;
    projectLocalSessionExtract: ArtifactRecord;
    sessionExports: ArtifactRecord;
    readme: ArtifactRecord;
  };
  privacy: {
    warning: string;
    checklist: string[];
  };
}

export interface CollectDiagnosticsOptions {
  projectRoot?: string;
  outputDir?: string;
  sessionID?: string;
  sessionExportPaths?: string[];
  opencodeLogDir?: string;
  projectLogDir?: string;
  maxOpenCodeLogs?: number;
  maxProjectLogs?: number;
  extractTail?: number;
  now?: Date;
}

export interface CollectDiagnosticsResult {
  bundleDir: string;
  manifestPath: string;
  manifest: DiagnosticsManifest;
}

async function collectProjectLocalSessionExtract(
  projectLogDir: string,
  sessionID: string,
  tail: number
): Promise<unknown[]> {
  const logFiles = await listRecentFiles(projectLogDir, ".log", 10);
  const parsed: Array<{ timestamp: string; raw: string; sourceFile: string; service: string }> = [];

  for (const logFile of logFiles) {
    const content = await readFile(logFile, "utf-8");
    const lines = parseLines(content, logFile, "project-local");
    for (const line of lines) {
      if (line.sessionID === sessionID || line.fields["sessionID"] === sessionID) {
        parsed.push({
          timestamp: line.timestamp.toISOString(),
          raw: line.raw,
          sourceFile: line.sourceFile,
          service: line.service,
        });
      }
    }
  }

  parsed.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (parsed.length > tail) {
    return parsed.slice(parsed.length - tail);
  }
  return parsed;
}

function toAbsolute(root: string, maybeRelative: string): string {
  return isAbsolute(maybeRelative) ? maybeRelative : resolve(root, maybeRelative);
}

function sanitizeTimestampForPath(value: Date): string {
  return value.toISOString().replace(/[:.]/g, "-");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readPackageVersion(projectRoot: string): Promise<string | null> {
  const packagePath = join(projectRoot, "package.json");
  try {
    const content = await readFile(packagePath, "utf-8");
    const parsed = JSON.parse(content) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

async function readProjectContextPluginVersion(projectRoot: string): Promise<string | null> {
  const projectYamlPath = join(projectRoot, ".coder", "project.yaml");
  try {
    const content = await readFile(projectYamlPath, "utf-8");
    const parsed = YAML.parse(content) as { pluginVersion?: unknown } | null;
    return typeof parsed?.pluginVersion === "string" ? parsed.pluginVersion : null;
  } catch {
    return null;
  }
}

async function listRecentFiles(dirPath: string, suffix: string, limit: number): Promise<string[]> {
  const entries = await readdir(dirPath);
  const matching = entries.filter((entry) => entry.endsWith(suffix));
  const withStats = await Promise.all(
    matching.map(async (entry) => {
      const fullPath = join(dirPath, entry);
      const fileStat = await stat(fullPath);
      return { fullPath, mtimeMs: fileStat.mtimeMs };
    })
  );

  withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return withStats.slice(0, limit).map((entry) => entry.fullPath);
}

async function copyFilesToBundle(files: string[], targetDir: string): Promise<string[]> {
  await mkdir(targetDir, { recursive: true });
  const copiedRelativePaths: string[] = [];
  for (const filePath of files) {
    const destination = join(targetDir, basename(filePath));
    await copyFile(filePath, destination);
    copiedRelativePaths.push(destination);
  }
  return copiedRelativePaths;
}

async function resolveSessionExportFiles(projectRoot: string, explicitPaths: string[]): Promise<string[]> {
  const resolved: string[] = [];

  for (const rawPath of explicitPaths) {
    const absPath = toAbsolute(projectRoot, rawPath);
    if (!(await pathExists(absPath))) {
      continue;
    }

    const fileStat = await stat(absPath);
    if (fileStat.isDirectory()) {
      const candidate = join(absPath, "session.json");
      if (await pathExists(candidate)) {
        resolved.push(candidate);
      }
    } else {
      resolved.push(absPath);
    }
  }

  if (resolved.length > 0) {
    return resolved;
  }

  const autoBase = join(projectRoot, "private", "session-dump");
  if (!(await pathExists(autoBase))) {
    return [];
  }

  const children = await readdir(autoBase);
  for (const child of children) {
    const candidate = join(autoBase, child, "session.json");
    if (await pathExists(candidate)) {
      resolved.push(candidate);
    }
  }

  return resolved;
}

function toBundleRelative(bundleDir: string, fullPath: string): string {
  return fullPath.startsWith(bundleDir) ? fullPath.slice(bundleDir.length + 1) : fullPath;
}

async function writeReadme(bundleDir: string, manifest: DiagnosticsManifest): Promise<string> {
  const readmePath = join(bundleDir, "README.md");
  const rows = Object.entries(manifest.artifacts)
    .map(([key, record]) => {
      const location = record.bundlePath ? `\`${record.bundlePath}\`` : "-";
      const source = record.sourcePath ? `\`${record.sourcePath}\`` : "-";
      const details = record.details ?? "";
      return `| ${key} | ${record.status} | ${location} | ${source} | ${details} |`;
    })
    .join("\n");

  const content = `# Project diagnostics bundle

Collected at: ${manifest.collectedAt}

## Environment

- Project root: \`${manifest.environment.projectRoot}\`
- Current working directory at collection time: \`${manifest.environment.cwd}\`
- Package version: ${manifest.pluginVersion.packageJson ?? "unknown"}
- Project context plugin version: ${manifest.pluginVersion.projectContext ?? "unknown"}

## Privacy warning

${manifest.privacy.warning}

Before sharing this bundle, review and redact as needed:

${manifest.privacy.checklist.map((item) => `- ${item}`).join("\n")}

## Collected artifacts

| Artifact | Status | Bundle path | Source path | Details |
|---|---|---|---|---|
${rows}
`;

  await writeFile(readmePath, content, "utf-8");
  return readmePath;
}

export async function collectDiagnosticsBundle(
  options: CollectDiagnosticsOptions = {}
): Promise<CollectDiagnosticsResult> {
  const now = options.now ?? new Date();
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const cwd = process.cwd();
  const outputBase = options.outputDir
    ? toAbsolute(projectRoot, options.outputDir)
    : join(projectRoot, ".coder", "diagnostics");
  const bundleDir = join(outputBase, `diagnostics-${sanitizeTimestampForPath(now)}`);

  await mkdir(bundleDir, { recursive: true });

  const requestedSessionExportPaths = options.sessionExportPaths ?? [];
  const packageVersion = await readPackageVersion(projectRoot);
  const manifest: DiagnosticsManifest = {
    manifestVersion: "1.0",
    collectedAt: now.toISOString(),
    collector: {
      script: "scripts/collect-diagnostics/index.ts",
      packageVersion,
      bunVersion: typeof Bun !== "undefined" ? Bun.version : null,
    },
    environment: {
      cwd,
      projectRoot,
      platform: process.platform,
    },
    request: {
      sessionID: options.sessionID,
      requestedSessionExportPaths,
    },
    pluginVersion: {
      packageJson: packageVersion,
      projectContext: await readProjectContextPluginVersion(projectRoot),
    },
    artifacts: {
      projectContextYaml: {
        status: "missing",
        description: "Project context snapshot (.coder/project.yaml)",
      },
      projectLocalLogs: {
        status: "missing",
        description: "Recent project-local plugin logs (.coder/logs)",
      },
      opencodeSessionIndex: {
        status: "missing",
        description: "Recent OpenCode session identifiers from logs",
      },
      opencodeSessionExtract: {
        status: "missing",
        description: "Filtered OpenCode log extract for requested session",
      },
      projectLocalSessionExtract: {
        status: "missing",
        description: "Filtered project-local log extract for requested session",
      },
      sessionExports: {
        status: "missing",
        description: "Session export JSON files (metadata/messages/diffs)",
      },
      readme: {
        status: "missing",
        description: "Human-oriented diagnostics summary",
      },
    },
    privacy: {
      warning:
        "Diagnostics may include prompts, code snippets, file paths, and environment details. Review the bundle before sharing outside your trust boundary.",
      checklist: [
        "Remove or redact secrets (tokens, keys, credentials).",
        "Remove proprietary source excerpts if external sharing is required.",
        "Check paths and hostnames for sensitive environment details.",
      ],
    },
  };

  // .coder/project.yaml
  const projectYamlPath = join(projectRoot, ".coder", "project.yaml");
  if (await pathExists(projectYamlPath)) {
    const target = join(bundleDir, "project", "project.yaml");
    await mkdir(dirname(target), { recursive: true });
    await copyFile(projectYamlPath, target);
    manifest.artifacts.projectContextYaml = {
      status: "included",
      description: manifest.artifacts.projectContextYaml.description,
      sourcePath: projectYamlPath,
      bundlePath: toBundleRelative(bundleDir, target),
    };
  } else {
    manifest.artifacts.projectContextYaml.details = "No .coder/project.yaml found in project root";
  }

  // project-local logs
  const projectLogDir = options.projectLogDir
    ? toAbsolute(projectRoot, options.projectLogDir)
    : join(projectRoot, ".coder", "logs");
  try {
    const recentProjectLogs = await listRecentFiles(projectLogDir, ".log", options.maxProjectLogs ?? 5);
    if (recentProjectLogs.length === 0) {
      manifest.artifacts.projectLocalLogs.details = "Project log directory exists but no *.log files were found";
    } else {
      const copied = await copyFilesToBundle(recentProjectLogs, join(bundleDir, "logs", "project-local"));
      manifest.artifacts.projectLocalLogs = {
        status: "included",
        description: manifest.artifacts.projectLocalLogs.description,
        sourcePath: projectLogDir,
        bundlePath: toBundleRelative(bundleDir, join(bundleDir, "logs", "project-local")),
        count: copied.length,
      };
    }
  } catch (error) {
    manifest.artifacts.projectLocalLogs = {
      ...manifest.artifacts.projectLocalLogs,
      status: "missing",
      sourcePath: projectLogDir,
      details: `Project-local logs unavailable: ${(error as Error).message}`,
    };
  }

  // session export files
  const resolvedSessionExports = await resolveSessionExportFiles(projectRoot, requestedSessionExportPaths);
  if (resolvedSessionExports.length > 0) {
    const destination = join(bundleDir, "session-exports");
    await mkdir(destination, { recursive: true });
    for (const sourcePath of resolvedSessionExports) {
      await copyFile(sourcePath, join(destination, basename(dirname(sourcePath)) + "-session.json"));
    }
    manifest.artifacts.sessionExports = {
      status: "included",
      description: manifest.artifacts.sessionExports.description,
      sourcePath: resolvedSessionExports.join(", "),
      bundlePath: toBundleRelative(bundleDir, destination),
      count: resolvedSessionExports.length,
    };
  } else {
    manifest.artifacts.sessionExports.details =
      requestedSessionExportPaths.length > 0
        ? "Requested session exports were not found"
        : "No explicit session export paths provided and no auto-discovered exports under private/session-dump";
  }

  // OpenCode session identifiers and optional extract
  let opencodeLogDir: string | null = null;
  let openCodeLogsAvailable = false;
  try {
    opencodeLogDir = options.opencodeLogDir ? toAbsolute(projectRoot, options.opencodeLogDir) : await findLogDirectory();
    const sessions = await discoverSessions(opencodeLogDir, "opencode");
    const topSessions = sessions.slice(0, 25).map((session) => ({
      sessionID: session.sessionID,
      pid: session.pid,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      lineCount: session.lineCount,
      logFiles: session.logFiles.map((logFile) => basename(logFile)),
    }));
    const indexPath = join(bundleDir, "logs", "opencode-session-index.json");
    await mkdir(dirname(indexPath), { recursive: true });
    await writeFile(indexPath, JSON.stringify(topSessions, null, 2), "utf-8");
    manifest.artifacts.opencodeSessionIndex = {
      status: "included",
      description: manifest.artifacts.opencodeSessionIndex.description,
      sourcePath: opencodeLogDir,
      bundlePath: toBundleRelative(bundleDir, indexPath),
      count: topSessions.length,
    };
    openCodeLogsAvailable = true;

    const recentOpencodeLogs = await listRecentFiles(opencodeLogDir, ".log", options.maxOpenCodeLogs ?? 3);
    if (recentOpencodeLogs.length > 0) {
      await copyFilesToBundle(recentOpencodeLogs, join(bundleDir, "logs", "opencode"));
    }
  } catch (error) {
    manifest.artifacts.opencodeSessionIndex = {
      ...manifest.artifacts.opencodeSessionIndex,
      status: "missing",
      sourcePath: opencodeLogDir ?? undefined,
      details: `OpenCode logs unavailable: ${(error as Error).message}`,
    };
  }

  if (options.sessionID && opencodeLogDir && openCodeLogsAvailable) {
    try {
      const opencodeExtract = await filterLogs(
        opencodeLogDir,
        { sessionID: options.sessionID, tail: options.extractTail ?? 200 },
        "opencode"
      );
      if (opencodeExtract.length > 0) {
        const extractPath = join(bundleDir, "logs", "opencode-session-extract.json");
        await writeFile(extractPath, JSON.stringify(opencodeExtract, null, 2), "utf-8");
        manifest.artifacts.opencodeSessionExtract = {
          status: "included",
          description: manifest.artifacts.opencodeSessionExtract.description,
          sourcePath: opencodeLogDir,
          bundlePath: toBundleRelative(bundleDir, extractPath),
          count: opencodeExtract.length,
        };
      } else {
        manifest.artifacts.opencodeSessionExtract.details = `No OpenCode log entries found for sessionID=${options.sessionID}`;
      }
    } catch (error) {
      manifest.artifacts.opencodeSessionExtract = {
        ...manifest.artifacts.opencodeSessionExtract,
        status: "error",
        details: `Failed to collect OpenCode session extract: ${(error as Error).message}`,
      };
    }
  } else if (options.sessionID) {
    manifest.artifacts.opencodeSessionExtract.details =
      "Session requested but OpenCode log directory was not available";
  } else {
    manifest.artifacts.opencodeSessionExtract.details = "No sessionID requested";
  }

  if (options.sessionID) {
    try {
      const projectExtract = await collectProjectLocalSessionExtract(
        projectLogDir,
        options.sessionID,
        options.extractTail ?? 200
      );
      if (projectExtract.length > 0) {
        const extractPath = join(bundleDir, "logs", "project-local-session-extract.json");
        await writeFile(extractPath, JSON.stringify(projectExtract, null, 2), "utf-8");
        manifest.artifacts.projectLocalSessionExtract = {
          status: "included",
          description: manifest.artifacts.projectLocalSessionExtract.description,
          sourcePath: projectLogDir,
          bundlePath: toBundleRelative(bundleDir, extractPath),
          count: projectExtract.length,
        };
      } else {
        manifest.artifacts.projectLocalSessionExtract.details =
          `No project-local log entries found for sessionID=${options.sessionID}`;
      }
    } catch (error) {
      manifest.artifacts.projectLocalSessionExtract = {
        ...manifest.artifacts.projectLocalSessionExtract,
        status: "missing",
        sourcePath: projectLogDir,
        details: `Project-local session extract unavailable: ${(error as Error).message}`,
      };
    }
  } else {
    manifest.artifacts.projectLocalSessionExtract.details = "No sessionID requested";
  }

  const readmePath = join(bundleDir, "README.md");
  manifest.artifacts.readme = {
    status: "included",
    description: manifest.artifacts.readme.description,
    bundlePath: toBundleRelative(bundleDir, readmePath),
  };
  await writeReadme(bundleDir, manifest);

  const manifestPath = join(bundleDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return {
    bundleDir,
    manifestPath,
    manifest,
  };
}
