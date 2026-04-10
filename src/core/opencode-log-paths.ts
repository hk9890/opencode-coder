import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";

type SupportedPlatform = "linux" | "darwin" | "win32";

export interface OpenCodeLogDirectoryCandidateOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  localAppData?: string;
}

export interface OpenCodeLogDirectoryResolutionOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  localAppData?: string;
  exists?: (path: string) => boolean;
}

export interface OpenCodeLogDirectorySummaryOptions {
  directory: string;
  exists: boolean;
  readdir?: (path: string) => string[];
  stat?: (path: string) => { mtime: Date };
}

/**
 * Canonical OpenCode log directory candidates by platform.
 *
 * Keep this in sync with repository monitoring docs and tooling.
 */
export function getOpenCodeLogDirectoryCandidates(
  options: OpenCodeLogDirectoryCandidateOptions = {},
): string[] {
  const currentPlatform = (options.platform ?? process.platform) as SupportedPlatform;
  const homeDir = options.homeDir ?? homedir();

  if (currentPlatform === "darwin") {
    return [
      join(homeDir, "Library", "Application Support", "opencode", "log"),
      join(homeDir, ".local", "share", "opencode", "log"),
    ];
  }

  if (currentPlatform === "win32") {
    const localAppData = options.localAppData ?? join(homeDir, "AppData", "Local");
    return [join(localAppData, "opencode", "log")];
  }

  return [join(homeDir, ".local", "share", "opencode", "log")];
}

export function resolveOpenCodeLogDirectory(
  options: OpenCodeLogDirectoryResolutionOptions = {},
): { directory: string; candidates: string[]; exists: boolean } {
  const candidates = getOpenCodeLogDirectoryCandidates({
    ...(options.platform ? { platform: options.platform } : {}),
    ...(options.homeDir ? { homeDir: options.homeDir } : {}),
    ...(options.localAppData ? { localAppData: options.localAppData } : {}),
  });

  const existsPredicate = options.exists ?? existsSync;
  const existingCandidate = candidates.find((candidate) => existsPredicate(candidate));
  const directory = existingCandidate ?? candidates[0] ?? "unknown";
  const directoryExists = directory !== "unknown" && existsPredicate(directory);

  return {
    directory,
    candidates,
    exists: directoryExists,
  };
}

export function summarizeOpenCodeLogDirectory(
  options: OpenCodeLogDirectorySummaryOptions,
): { fileCount: number; latestFile: string } {
  if (!options.exists) {
    return { fileCount: 0, latestFile: "none" };
  }

  const readDirectory = options.readdir ?? readdirSync;
  const readStats = options.stat ?? statSync;
  const files = readDirectory(options.directory).filter((f) => f.endsWith(".log"));
  const fileCount = files.length;

  if (fileCount === 0) {
    return { fileCount, latestFile: "none" };
  }

  const latest = files
    .map((f) => ({ name: f, mtime: readStats(join(options.directory, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0]?.name;

  return {
    fileCount,
    latestFile: latest ?? "none",
  };
}
