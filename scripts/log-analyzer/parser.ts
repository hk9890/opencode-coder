/**
 * OpenCode Log Parser
 * 
 * Parses OpenCode and project-local plugin log lines into structured objects.
 * 
 * OpenCode log format:
 * LEVEL  TIMESTAMP +deltaMs pid=PID service=SERVICE [key=value]... message
 * 
 * Example:
 * INFO  2026-01-02T17:45:26 +1ms pid=357917 service=opencode-coder durationMs=2 beadsEnabled=true OpencodeCoder plugin loaded
 */

import type { LogLevel, LogLine, LogSource } from "./types";

/**
 * Regex to parse the main structure of a log line.
 * Groups:
 * 1. Level (INFO, WARN, ERROR, DEBUG)
 * 2. Timestamp (ISO format without timezone)
 * 3. Delta milliseconds
 * 4. PID
 * 5. Rest of the line (service and other fields + message)
 */
const LOG_LINE_REGEX = /^(INFO|WARN|ERROR|DEBUG)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s+\+(\d+)ms\s+pid=(\d+)\s+(.+)$/;

/**
 * Regex for project-local plugin logs written to .coder/logs/coder-YYYY-MM-DD.log.
 */
const PROJECT_LOCAL_LOG_LINE_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+(INFO|WARN|ERROR|DEBUG)\s+\[([^\]]+)\]\s+\(pid=(\d+)\)\s*(.*)$/;

/**
 * Known keys that should be extracted as fields (not part of message).
 * Order matters - service should be first.
 */
const KNOWN_KEYS = [
  "service",
  "sessionID",
  "directory",
  "status",
  "method",
  "path",
  "duration",
  "durationMs",
  "providerID",
  "modelID",
  "agent",
  "step",
  "type",
  "file",
  "branch",
  "cmd",
  "cwd",
  "code",
  "plugin",
  "key",
  "small",
  "beadsEnabled",
];

/**
 * Parse a single log line into a structured LogLine object.
 * 
 * @param line - Raw log line string
 * @param sourceFile - Path to the source log file
 * @returns Parsed LogLine or null if line doesn't match expected format
 */
export function parseLine(line: string, sourceFile: string, source: LogSource = "opencode"): LogLine | null {
  const match = line.match(LOG_LINE_REGEX);
  if (match) {
    const [, levelStr, timestampStr, deltaStr, pidStr, rest] = match;
    
    const level = levelStr as LogLevel;
    const timestamp = new Date(timestampStr);
    const deltaMs = parseInt(deltaStr, 10);
    const pid = parseInt(pidStr, 10);

    // Extract key=value pairs and message
    const fields: Record<string, string> = {};
    let service = "unknown";
    let sessionID: string | undefined;
    let directory: string | undefined;

    // Split rest into tokens and classify each
    const tokens = rest.split(/\s+/);
    const messageTokens: string[] = [];
    let foundNonKv = false;

    for (const token of tokens) {
      if (!token) continue;
      
      const kvMatch = token.match(/^(\w+)=(.+)$/);
      
      if (kvMatch && !foundNonKv) {
        const [, key, value] = kvMatch;
        
        if (key === "service") {
          service = value;
        } else if (key === "sessionID") {
          sessionID = value;
        } else if (key === "directory") {
          directory = value;
        } else if (KNOWN_KEYS.includes(key)) {
          fields[key] = value;
        } else {
          // Unknown key=value - could be a field or part of message
          // Treat as field if value looks reasonable
          if (value.length < 100) {
            fields[key] = value;
          } else {
            foundNonKv = true;
            messageTokens.push(token);
          }
        }
      } else {
        // Not a key=value pair - start of message
        foundNonKv = true;
        messageTokens.push(token);
      }
    }

    const message = messageTokens.join(" ");

    return {
      level,
      timestamp,
      deltaMs,
      pid,
      service,
      sessionID,
      directory,
      fields,
      message,
      raw: line,
      sourceFile,
      source,
    };
  }

  const projectLocalMatch = line.match(PROJECT_LOCAL_LOG_LINE_REGEX);
  if (!projectLocalMatch) {
    return null;
  }

  const [, timestampStr, levelStr, service, pidStr, remainder] = projectLocalMatch;
  const level = levelStr as LogLevel;
  const timestamp = new Date(timestampStr);
  const pid = parseInt(pidStr, 10);
  const deltaMs = 0;

  const fields: Record<string, string> = {};
  let sessionID: string | undefined;
  let directory: string | undefined;
  let message = remainder;

  const extraMarker = " extra=";
  const extraIndex = remainder.indexOf(extraMarker);
  if (extraIndex !== -1) {
    message = remainder.slice(0, extraIndex);
    const extraRaw = remainder.slice(extraIndex + extraMarker.length);
    try {
      const parsedExtra = JSON.parse(extraRaw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsedExtra)) {
        if (value === undefined) {
          continue;
        }
        const normalized = typeof value === "string" ? value : JSON.stringify(value);
        fields[key] = normalized;
      }
      if (typeof parsedExtra["sessionID"] === "string") {
        sessionID = parsedExtra["sessionID"];
      }
      if (typeof parsedExtra["directory"] === "string") {
        directory = parsedExtra["directory"];
      }
    } catch {
      fields["extra"] = extraRaw;
    }
  }

  return {
    level,
    timestamp,
    deltaMs,
    pid,
    service,
    sessionID,
    directory,
    fields,
    message,
    raw: line,
    sourceFile,
    source,
  };
}



/**
 * Parse multiple lines from a string (e.g., file contents).
 * 
 * @param content - Multi-line string content
 * @param sourceFile - Path to the source file
 * @returns Array of parsed LogLine objects (skips unparseable lines)
 */
export function parseLines(content: string, sourceFile: string, source: LogSource = "opencode"): LogLine[] {
  const lines = content.split("\n");
  const result: LogLine[] = [];
  
  for (const line of lines) {
    if (line.trim()) {
      const parsed = parseLine(line, sourceFile, source);
      if (parsed) {
        result.push(parsed);
      }
    }
  }
  
  return result;
}

/**
 * Check if a line matches the expected log format (quick check without full parsing).
 */
export function isLogLine(line: string): boolean {
  return LOG_LINE_REGEX.test(line) || PROJECT_LOCAL_LOG_LINE_REGEX.test(line);
}
