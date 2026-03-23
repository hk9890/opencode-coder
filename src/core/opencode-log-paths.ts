import { homedir } from "node:os";
import { join } from "node:path";

type SupportedPlatform = "linux" | "darwin" | "win32";

export interface OpenCodeLogDirectoryCandidateOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  localAppData?: string;
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
