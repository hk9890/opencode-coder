import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  AIMGR_COMMAND_TIMEOUT_MS,
  getCommandAvailabilityStatus,
  isCommandAvailable,
  isExecTimeoutError,
} from "./exec";
import type { Logger } from "./logger";
import type { CommandAvailabilityStatus } from "./exec";

export const STEALTH_MARKER = "# opencode-coder stealth mode";

export interface DetectionLogger {
  debug: Logger["debug"];
  warn: Logger["warn"];
  error: Logger["error"];
}

export interface VerifyAimgrResourcesOptions {
  logger: DetectionLogger;
  /**
   * Optional per-startup-call-graph cache.
   *
   * This must be provided by the caller and intentionally scoped to the active
   * startup flow. Do not retain this map across repair boundaries that need a
   * fresh verify result.
   */
  cache?: Map<string, unknown | null>;
}

export function detectBeadsDirectory(workdir: string, logger: Pick<Logger, "debug">): boolean {
  const beadsDir = path.join(workdir, ".beads");
  try {
    fs.accessSync(beadsDir, fs.constants.F_OK);
    logger.debug("Beads directory detected", { path: beadsDir });
    return true;
  } catch {
    logger.debug("Beads directory not found", { path: beadsDir });
    return false;
  }
}

export function detectStealthMarker(workdir: string, logger: Pick<Logger, "debug">): boolean {
  const excludeFile = path.join(workdir, ".git", "info", "exclude");
  try {
    const content = fs.readFileSync(excludeFile, "utf-8");
    const isStealthy = content.includes(STEALTH_MARKER);
    logger.debug("Stealth mode detection", { stealthMode: isStealthy });
    return isStealthy;
  } catch {
    logger.debug("Could not read .git/info/exclude, assuming no stealth mode", { workdir });
    return false;
  }
}

export function detectAimgrAvailable(_workdir: string, logger: Pick<Logger, "debug" | "warn">): boolean {
  return isCommandAvailable("aimgr", logger, {
    successMessage: "aimgr CLI is available",
    missingMessage: "aimgr CLI not found on PATH",
    timeoutMessage: "aimgr availability check timed out",
  });
}

export function detectPackageYaml(workdir: string, logger: Pick<Logger, "debug">): boolean {
  const packagePath = path.join(workdir, "ai.package.yaml");
  const exists = fs.existsSync(packagePath);
  logger.debug("Checking for ai.package.yaml", { path: packagePath, exists });
  return exists;
}

export function detectBdCliAvailable(_workdir: string, logger: Pick<Logger, "debug" | "warn">): boolean {
  return detectBdCliAvailabilityStatus(_workdir, logger) === "installed";
}

export function detectBdCliAvailabilityStatus(
  _workdir: string,
  logger: Pick<Logger, "debug" | "warn">,
): CommandAvailabilityStatus {
  return getCommandAvailabilityStatus("bd", logger, {
    successMessage: "bd CLI is available",
    missingMessage: "bd CLI not found on PATH",
    timeoutMessage: "bd CLI availability check timed out",
  });
}

/**
 * Run `aimgr verify --format json` and return parsed verify output.
 *
 * Optional caching is caller-scoped only via `options.cache`. The cache is
 * intentionally not module-global to avoid stale verify results surviving
 * repair boundaries.
 */
export function verifyAimgrResources(workdir: string, options: VerifyAimgrResourcesOptions): unknown | null {
  const cacheKey = path.resolve(workdir);
  if (options.cache?.has(cacheKey)) {
    return options.cache.get(cacheKey) ?? null;
  }

  try {
    const stdout = execSync("aimgr verify --format json", {
      cwd: workdir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: AIMGR_COMMAND_TIMEOUT_MS,
    });
    const result = JSON.parse(stdout);
    options.logger.debug("aimgr verify completed", { result });
    options.cache?.set(cacheKey, result);
    return result;
  } catch (error) {
    if (isExecTimeoutError(error)) {
      options.logger.warn("Failed to run aimgr verify", {
        error: String(error),
        command: "aimgr verify --format json",
        timeoutMs: AIMGR_COMMAND_TIMEOUT_MS,
      });
    } else {
      options.logger.error("Failed to run aimgr verify", { error: String(error) });
    }

    options.cache?.set(cacheKey, null);
    return null;
  }
}
