/**
 * OpenCode Log Discovery
 * 
 * Find log directory, list log files, and discover processes/sessions.
 */

import { homedir } from "os";
import { join, basename } from "path";
import { readdir, access, readFile, stat } from "fs/promises";
import type { LogSource, ProcessInfo, SessionInfo } from "./types";
import { parseLine } from "./parser";

/**
 * Possible log directory locations by platform.
 */
const LOG_LOCATIONS = {
  linux: [join(homedir(), ".local/share/opencode/log")],
  darwin: [
    join(homedir(), "Library/Application Support/opencode/log"),
    join(homedir(), ".local/share/opencode/log"),
  ],
  win32: [join(homedir(), "AppData/Local/opencode/log")],
};

/**
 * Find the OpenCode log directory.
 * 
 * @returns Path to log directory
 * @throws Error if no log directory found
 */
export async function findLogDirectory(): Promise<string> {
  const platform = process.platform as "linux" | "darwin" | "win32";
  const locations = LOG_LOCATIONS[platform] ?? LOG_LOCATIONS.linux;

  for (const location of locations) {
    try {
      await access(location);
      return location;
    } catch {
      // Try next location
    }
  }

  throw new Error(
    `OpenCode log directory not found. Checked:\n${locations.map((l) => `  - ${l}`).join("\n")}`
  );
}

/**
 * List all log files in the log directory.
 * Returns files sorted by modification time (newest first).
 * 
 * @param logDir - Path to log directory
 * @returns Array of full paths to log files
 */
export async function listLogFiles(logDir: string): Promise<string[]> {
  const entries = await readdir(logDir);
  const logFiles = entries.filter((f) => f.endsWith(".log"));

  // Get stats for sorting by mtime
  const filesWithStats = await Promise.all(
    logFiles.map(async (f) => {
      const fullPath = join(logDir, f);
      const stats = await stat(fullPath);
      return { path: fullPath, mtime: stats.mtime };
    })
  );

  // Sort by modification time, newest first
  filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return filesWithStats.map((f) => f.path);
}

/**
 * Resolve project-local plugin log directory.
 */
export async function findProjectLogDirectory(projectRoot: string = process.cwd()): Promise<string> {
  const logDir = join(projectRoot, ".coder", "logs");
  try {
    await access(logDir);
    return logDir;
  } catch {
    throw new Error(`Project-local plugin log directory not found: ${logDir}`);
  }
}

/**
 * Discover all processes from log files.
 * Uses ripgrep for fast scanning if available, falls back to reading files.
 * 
 * @param logDir - Path to log directory
 * @returns Array of ProcessInfo objects sorted by start time (newest first)
 */
export async function discoverProcesses(logDir: string, source: LogSource = "opencode"): Promise<ProcessInfo[]> {
  const logFiles = await listLogFiles(logDir);
  const processMap = new Map<number, ProcessInfo>();

  for (const logFile of logFiles) {
    const content = await readFile(logFile, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parsed = parseLine(line, logFile, source);
      if (!parsed) continue;

      const existing = processMap.get(parsed.pid);
      if (existing) {
        // Update existing process info
        if (parsed.timestamp < existing.startTime) {
          existing.startTime = parsed.timestamp;
        }
        if (parsed.timestamp > existing.endTime) {
          existing.endTime = parsed.timestamp;
        }
        if (!existing.logFiles.includes(logFile)) {
          existing.logFiles.push(logFile);
        }
        if (parsed.directory && !existing.directory) {
          existing.directory = parsed.directory;
        }
        existing.lineCount++;
      } else {
        // New process
        processMap.set(parsed.pid, {
          pid: parsed.pid,
          directory: parsed.directory,
          startTime: parsed.timestamp,
          endTime: parsed.timestamp,
          logFiles: [logFile],
          sessionCount: 0, // Will be updated later
          lineCount: 1,
        });
      }
    }
  }

  // Count sessions per process
  const sessions = await discoverSessions(logDir, source);
  for (const session of sessions) {
    const proc = processMap.get(session.pid);
    if (proc) {
      proc.sessionCount++;
    }
  }

  // Sort by start time, newest first
  const processes = Array.from(processMap.values());
  processes.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  return processes;
}

/**
 * Discover all sessions from log files.
 * 
 * @param logDir - Path to log directory
 * @returns Array of SessionInfo objects sorted by start time (newest first)
 */
export async function discoverSessions(logDir: string, source: LogSource = "opencode"): Promise<SessionInfo[]> {
  const logFiles = await listLogFiles(logDir);
  const sessionMap = new Map<string, SessionInfo>();

  for (const logFile of logFiles) {
    const content = await readFile(logFile, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parsed = parseLine(line, logFile, source);
      if (!parsed || !parsed.sessionID) continue;

      const existing = sessionMap.get(parsed.sessionID);
      if (existing) {
        // Update existing session info
        if (parsed.timestamp < existing.startTime) {
          existing.startTime = parsed.timestamp;
        }
        if (parsed.timestamp > existing.endTime) {
          existing.endTime = parsed.timestamp;
        }
        if (!existing.logFiles.includes(logFile)) {
          existing.logFiles.push(logFile);
        }
        existing.lineCount++;
      } else {
        // New session
        sessionMap.set(parsed.sessionID, {
          sessionID: parsed.sessionID,
          pid: parsed.pid,
          startTime: parsed.timestamp,
          endTime: parsed.timestamp,
          lineCount: 1,
          logFiles: [logFile],
        });
      }
    }
  }

  // Sort by start time, newest first
  const sessions = Array.from(sessionMap.values());
  sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  return sessions;
}

/**
 * Get a summary of the log directory.
 */
export async function getLogSummary(logDir: string): Promise<{
  logDir: string;
  fileCount: number;
  processCount: number;
  sessionCount: number;
  oldestLog: Date | null;
  newestLog: Date | null;
}> {
  const logFiles = await listLogFiles(logDir);
  const processes = await discoverProcesses(logDir);
  const sessions = await discoverSessions(logDir);

  let oldestLog: Date | null = null;
  let newestLog: Date | null = null;

  for (const proc of processes) {
    if (!oldestLog || proc.startTime < oldestLog) {
      oldestLog = proc.startTime;
    }
    if (!newestLog || proc.endTime > newestLog) {
      newestLog = proc.endTime;
    }
  }

  return {
    logDir,
    fileCount: logFiles.length,
    processCount: processes.length,
    sessionCount: sessions.length,
    oldestLog,
    newestLog,
  };
}
