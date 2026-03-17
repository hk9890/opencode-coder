import { isDebugLoggingEnabled } from "../config";
import type { OpencodeClient } from "./opencode";
import { appendFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

export const SERVICE_NAME = "opencode-coder";
const LOG_RETENTION_DAYS = 7;
const MAX_BUFFERED_FILE_LOGS = 200;
type LogLevel = "debug" | "info" | "warn" | "error";

interface BufferedFileLogEntry {
  path: string;
  line: string;
}

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  enableFileLogging(): void;
}

export function createLogger(client: OpencodeClient, workdir: string): Logger {
  // Check if debug logging is enabled via environment variable
  const isDebugEnabled = isDebugLoggingEnabled();

  const logsDir = join(workdir, ".coder", "logs");
  let isFileLoggingEnabled = false;
  const bufferedFileLogs: BufferedFileLogEntry[] = [];

  const writeFileLog = (entry: BufferedFileLogEntry) => {
    appendFileSync(entry.path, entry.line);
  };

  const enableFileLogging = () => {
    if (isFileLoggingEnabled) {
      return;
    }

    isFileLoggingEnabled = true;

    try {
      mkdirSync(logsDir, { recursive: true });
      pruneOldLogFiles(logsDir);

      for (const entry of bufferedFileLogs) {
        appendFileSync(entry.path, entry.line);
      }

      bufferedFileLogs.length = 0;
    } catch {
      // Never break plugin startup/runtime if local file logging fails
    }
  };

  const log = (level: LogLevel, message: string, extra?: Record<string, unknown>) => {
    // For debug messages, only log when debug logging is enabled
    if (level === "debug" && !isDebugEnabled) {
      return;
    }

    const timestamp = new Date();
    const fileLogEntry: BufferedFileLogEntry = {
      path: getDailyLogPath(logsDir, timestamp),
      line: formatLogLine(level, message, extra, timestamp),
    };

    // Always use "info" level for OpenCode logging
    // (even for our internal debug messages when they are enabled)
    const body: { service: string; level: "info" | "warn" | "error"; message: string; extra?: { [key: string]: unknown } } = {
      service: SERVICE_NAME,
      level: level === "debug" ? "info" : level,
      message,
    };
    if (extra) {
      body.extra = extra;
    }
    client.app.log({ body });

    if (!isFileLoggingEnabled) {
      bufferedFileLogs.push(fileLogEntry);
      if (bufferedFileLogs.length > MAX_BUFFERED_FILE_LOGS) {
        bufferedFileLogs.splice(0, bufferedFileLogs.length - MAX_BUFFERED_FILE_LOGS);
      }
      return;
    }

    try {
      writeFileLog(fileLogEntry);
    } catch {
      // Never break plugin startup/runtime if local file logging fails
    }
  };

  return {
    debug: (message: string, extra?: Record<string, unknown>) => log("debug", message, extra),
    info: (message: string, extra?: Record<string, unknown>) => log("info", message, extra),
    warn: (message: string, extra?: Record<string, unknown>) => log("warn", message, extra),
    error: (message: string, extra?: Record<string, unknown>) => log("error", message, extra),
    enableFileLogging,
  };
}

function getDailyLogPath(logsDir: string, now: Date = new Date()): string {
  return join(logsDir, `coder-${toUtcDate(now)}.log`);
}

function formatLogLine(level: LogLevel, message: string, extra?: Record<string, unknown>, now: Date = new Date()): string {
  const timestamp = now.toISOString();
  const normalizedMessage = message.replaceAll("\n", "\\n");
  const base = `${timestamp} ${level.toUpperCase()} [${SERVICE_NAME}] (pid=${process.pid}) ${normalizedMessage}`;

  if (!extra) {
    return `${base}\n`;
  }

  return `${base} extra=${safeStringify(extra)}\n`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function pruneOldLogFiles(logsDir: string): void {
  try {
    const files = readdirSync(logsDir);
    const cutoff = dateAtUtcMidnight(new Date());
    cutoff.setUTCDate(cutoff.getUTCDate() - LOG_RETENTION_DAYS);

    for (const fileName of files) {
      const fileDate = parseLogDateFromFilename(fileName);
      if (!fileDate) {
        continue;
      }

      if (fileDate < cutoff) {
        unlinkSync(join(logsDir, fileName));
      }
    }
  } catch {
    // Retention is best-effort and must never crash startup
  }
}

function parseLogDateFromFilename(fileName: string): Date | null {
  const match = /^coder-(\d{4})-(\d{2})-(\d{2})\.log$/.exec(fileName);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function dateAtUtcMidnight(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function toUtcDate(input: Date): string {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, "0");
  const day = String(input.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
