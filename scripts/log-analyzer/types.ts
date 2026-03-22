/**
 * OpenCode Log Analyzer Types
 */

/** Log levels supported by OpenCode */
export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

/** Supported log sources */
export type LogSource = "opencode" | "project-local";

/** Parsed log line */
export interface LogLine {
  /** Log level */
  level: LogLevel;
  /** Timestamp of the log entry */
  timestamp: Date;
  /** Time delta in milliseconds from previous log */
  deltaMs: number;
  /** Process ID */
  pid: number;
  /** Service name (e.g., 'opencode-coder', 'session.prompt', 'server') */
  service: string;
  /** Session ID if present */
  sessionID?: string;
  /** Working directory if present */
  directory?: string;
  /** Other key=value fields */
  fields: Record<string, string>;
  /** Log message (text after all key=value pairs) */
  message: string;
  /** Original raw line */
  raw: string;
  /** Source log file */
  sourceFile: string;
  /** Source log type */
  source: LogSource;
}

/** Information about a process found in logs */
export interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** Working directory (from 'directory=' field) */
  directory?: string;
  /** First log timestamp */
  startTime: Date;
  /** Last log timestamp */
  endTime: Date;
  /** Log files containing this process */
  logFiles: string[];
  /** Number of unique sessions in this process */
  sessionCount: number;
  /** Total number of log lines */
  lineCount: number;
}

/** Information about a session found in logs */
export interface SessionInfo {
  /** Session ID */
  sessionID: string;
  /** Process ID that owns this session */
  pid: number;
  /** First log timestamp for this session */
  startTime: Date;
  /** Last log timestamp for this session */
  endTime: Date;
  /** Number of log lines with this session ID */
  lineCount: number;
  /** Log files containing this session */
  logFiles: string[];
}

/** Filter options for log queries */
export interface FilterOptions {
  /** Filter by process ID */
  pid?: number;
  /** Filter by session ID */
  sessionID?: string;
  /** Filter by service name(s) */
  service?: string | string[];
  /** Filter by log level(s) */
  level?: LogLevel[];
  /** Only return last N lines */
  tail?: number;
  /** Start time filter */
  startTime?: Date;
  /** End time filter */
  endTime?: Date;
  /** Filter by source log type(s) */
  source?: LogSource | LogSource[];
}

/** Output format options */
export interface FormatOptions {
  /** Disable colored output */
  noColor?: boolean;
  /** Output as JSON */
  json?: boolean;
  /** Show raw lines without formatting */
  raw?: boolean;
  /** Show full timestamps instead of time only */
  fullTimestamp?: boolean;
}

/** CLI arguments */
export interface CliArgs {
  /** Command: 'list' or undefined for filter/interactive */
  command?: "list";
  /** Subcommand for list: 'processes' or 'sessions' */
  listType?: "processes" | "sessions";
  /** Filter options */
  filter: FilterOptions;
  /** Format options */
  format: FormatOptions;
  /** Run in interactive mode */
  interactive?: boolean;
  /** Show help */
  help?: boolean;
  /** Which log source to analyze */
  source: "opencode" | "project-local" | "both";
  /** Optional explicit project-local log directory */
  projectLogDir?: string;
}

/** ANSI color codes */
export const Colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
} as const;

export type ColorName = keyof typeof Colors;
