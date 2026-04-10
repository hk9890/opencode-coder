import { execSync } from "child_process";
import type { Logger } from "./logger";

export const COMMAND_CHECK_TIMEOUT_MS = 5_000;
export const AIMGR_COMMAND_TIMEOUT_MS = 10_000;

export type CommandAvailabilityStatus = "installed" | "missing" | "timeout";

interface CommandAvailabilityOptions {
  timeoutMs?: number;
  successMessage?: string;
  missingMessage?: string;
  timeoutMessage?: string;
}

export function isExecTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const timeoutError = error as { code?: string; killed?: boolean; signal?: string };
  return timeoutError.code === "ETIMEDOUT" || timeoutError.killed === true || timeoutError.signal === "SIGTERM";
}

export function getCommandAvailabilityStatus(
  commandName: string,
  logger: Pick<Logger, "debug" | "warn">,
  options: CommandAvailabilityOptions = {},
): CommandAvailabilityStatus {
  const timeoutMs = options.timeoutMs ?? COMMAND_CHECK_TIMEOUT_MS;
  const command = `command -v ${commandName}`;

  try {
    execSync(command, {
      stdio: "ignore",
      timeout: timeoutMs,
    });

    if (options.successMessage) {
      logger.debug(options.successMessage);
    }

    return "installed";
  } catch (error) {
    if (isExecTimeoutError(error)) {
      logger.warn(options.timeoutMessage ?? `${commandName} availability check timed out`, {
        command,
        timeoutMs,
      });
      return "timeout";
    }

    if (options.missingMessage) {
      logger.debug(options.missingMessage);
    }

    return "missing";
  }
}

export function isCommandAvailable(
  commandName: string,
  logger: Pick<Logger, "debug" | "warn">,
  options: CommandAvailabilityOptions = {},
): boolean {
  return getCommandAvailabilityStatus(commandName, logger, options) === "installed";
}
