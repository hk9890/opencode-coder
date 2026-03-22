/**
 * OpenCode Log Formatter
 * 
 * Format log output with colors and structure.
 */

import type { LogLine, ProcessInfo, SessionInfo, FormatOptions, LogLevel } from "./types";
import { Colors } from "./types";

/**
 * Check if stdout supports colors.
 */
function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY ?? false;
}

/**
 * Apply color to text if colors are enabled.
 */
function colorize(text: string, color: keyof typeof Colors, options: FormatOptions): string {
  if (options.noColor || !supportsColor()) {
    return text;
  }
  return `${Colors[color]}${text}${Colors.reset}`;
}

/**
 * Get color for log level.
 */
function getLevelColor(level: LogLevel): keyof typeof Colors {
  switch (level) {
    case "ERROR":
      return "red";
    case "WARN":
      return "yellow";
    case "INFO":
      return "green";
    case "DEBUG":
      return "gray";
    default:
      return "white";
  }
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(date: Date, full: boolean): string {
  if (full) {
    return date.toISOString().replace("T", " ").replace("Z", "");
  }
  // Time only: HH:MM:SS.mmm
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  const ms = date.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format a single log line.
 */
export function formatLine(line: LogLine, options: FormatOptions = {}): string {
  if (options.raw) {
    return line.raw;
  }

  if (options.json) {
    return JSON.stringify({
      level: line.level,
      timestamp: line.timestamp.toISOString(),
      pid: line.pid,
      source: line.source,
      service: line.service,
      sessionID: line.sessionID,
      message: line.message,
      fields: line.fields,
    });
  }

  const timestamp = colorize(
    formatTimestamp(line.timestamp, options.fullTimestamp ?? false),
    "dim",
    options
  );

  const level = colorize(line.level.padEnd(5), getLevelColor(line.level), options);

  const service = colorize(`[${line.service}]`, "cyan", options);
  const source = colorize(`{${line.source}}`, "dim", options);

  // Format additional fields
  const fieldParts: string[] = [];
  for (const [key, value] of Object.entries(line.fields)) {
    fieldParts.push(colorize(`${key}=${value}`, "blue", options));
  }
  if (line.sessionID) {
    fieldParts.push(colorize(`sessionID=${line.sessionID}`, "magenta", options));
  }

  const fields = fieldParts.length > 0 ? ` ${fieldParts.join(" ")}` : "";

  const message = line.message;

  return `${timestamp} ${level} ${service} ${source}${fields} ${message}`;
}

/**
 * Format multiple log lines.
 */
export function formatLines(lines: LogLine[], options: FormatOptions = {}): string {
  return lines.map((line) => formatLine(line, options)).join("\n");
}

/**
 * Format process list for display.
 */
export function formatProcessList(processes: ProcessInfo[], options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify(processes, null, 2);
  }

  if (processes.length === 0) {
    return "No processes found.";
  }

  const lines: string[] = [];
  lines.push(colorize("Processes:", "white", options));
  lines.push("");

  for (let i = 0; i < processes.length; i++) {
    const proc = processes[i];
    const index = colorize(`${(i + 1).toString().padStart(3)})`, "dim", options);
    const pid = colorize(`pid=${proc.pid}`, "cyan", options);
    const timeRange = colorize(
      `${formatTimestamp(proc.startTime, false)} - ${formatTimestamp(proc.endTime, false)}`,
      "dim",
      options
    );
    const dir = proc.directory ? colorize(proc.directory, "blue", options) : colorize("(unknown)", "gray", options);
    const sessions = colorize(`${proc.sessionCount} sessions`, "green", options);
    const lineCount = colorize(`${proc.lineCount} lines`, "gray", options);

    lines.push(`${index} ${pid} ${timeRange}`);
    lines.push(`      ${dir}`);
    lines.push(`      ${sessions}, ${lineCount}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format session list for display.
 */
export function formatSessionList(sessions: SessionInfo[], options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify(sessions, null, 2);
  }

  if (sessions.length === 0) {
    return "No sessions found.";
  }

  const lines: string[] = [];
  lines.push(colorize("Sessions:", "white", options));
  lines.push("");

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const index = colorize(`${(i + 1).toString().padStart(3)})`, "dim", options);
    const sessionID = colorize(session.sessionID, "magenta", options);
    const pid = colorize(`pid=${session.pid}`, "cyan", options);
    const timeRange = colorize(
      `${formatTimestamp(session.startTime, false)} - ${formatTimestamp(session.endTime, false)}`,
      "dim",
      options
    );
    const lineCount = colorize(`${session.lineCount} lines`, "gray", options);

    lines.push(`${index} ${sessionID}`);
    lines.push(`      ${pid} ${timeRange} ${lineCount}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format process info for fzf selection.
 * Returns a single line suitable for fzf with the PID as the key.
 */
export function formatProcessForFzf(proc: ProcessInfo, index: number): string {
  const time = formatTimestamp(proc.startTime, false);
  const dir = proc.directory ?? "(unknown)";
  // Format: "pid=XXXXX | HH:MM:SS | /path/to/dir | N sessions"
  return `pid=${proc.pid} | ${time} | ${dir} | ${proc.sessionCount} sessions`;
}

/**
 * Format session info for fzf selection.
 * Returns a single line suitable for fzf with the session ID as the key.
 */
export function formatSessionForFzf(session: SessionInfo, index: number): string {
  const time = formatTimestamp(session.startTime, false);
  // Format: "ses_XXXXX | HH:MM:SS | pid=YYYYY | N lines"
  return `${session.sessionID} | ${time} | pid=${session.pid} | ${session.lineCount} lines`;
}

/**
 * Format a summary header.
 */
export function formatSummary(
  logDir: string,
  fileCount: number,
  processCount: number,
  sessionCount: number,
  options: FormatOptions = {}
): string {
  if (options.json) {
    return JSON.stringify({ logDir, fileCount, processCount, sessionCount });
  }

  const lines: string[] = [];
  lines.push(colorize("OpenCode Log Analyzer", "white", options));
  lines.push(colorize(`Log directory: ${logDir}`, "dim", options));
  lines.push(
    colorize(
      `Found ${fileCount} log files, ${processCount} processes, ${sessionCount} sessions`,
      "dim",
      options
    )
  );
  lines.push("");

  return lines.join("\n");
}
