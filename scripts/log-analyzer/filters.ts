/**
 * OpenCode Log Filters
 * 
 * Uses ripgrep for fast filtering, then parses matching lines.
 */

import { spawn } from "child_process";
import { readFile } from "fs/promises";
import type { FilterOptions, LogLine, LogSource } from "./types";
import { parseLine, parseLines } from "./parser";
import { listLogFiles } from "./discovery";

/**
 * Check if ripgrep (rg) is available.
 */
export async function hasRipgrep(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("rg", ["--version"]);
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Build ripgrep pattern from filter options.
 * Returns null if no pattern can be built (use full file read instead).
 */
function buildRipgrepPattern(options: FilterOptions): string | null {
  const patterns: string[] = [];

  if (options.pid) {
    patterns.push(`pid=${options.pid}`);
  }

  if (options.sessionID) {
    patterns.push(`sessionID=${options.sessionID}`);
  }

  if (options.service) {
    const services = Array.isArray(options.service) ? options.service : [options.service];
    if (services.length === 1) {
      patterns.push(`service=${services[0]}`);
    }
    // Multiple services handled by post-filtering
  }

  if (options.level && options.level.length > 0 && options.level.length < 4) {
    // Only add level filter if not all levels
    const levelPattern = options.level.join("|");
    patterns.push(`^(${levelPattern})`);
  }

  if (patterns.length === 0) {
    return null;
  }

  // Combine with AND logic (all patterns must match)
  // ripgrep doesn't support AND directly, so we'll use the most selective pattern
  // and post-filter the rest
  return patterns[0];
}

/**
 * Run ripgrep on log files with the given pattern.
 * Returns raw matching lines.
 */
async function runRipgrep(logDir: string, pattern: string): Promise<Map<string, string[]>> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, string[]>();
    
    const proc = spawn("rg", [
      "--no-heading",
      "--with-filename",
      "--line-number",
      "-e",
      pattern,
      logDir,
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && code !== 1) {
        // code 1 means no matches, which is fine
        reject(new Error(`ripgrep failed: ${stderr}`));
        return;
      }

      // Parse ripgrep output: filename:linenum:content
      const lines = stdout.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) continue;
        
        const secondColonIndex = line.indexOf(":", colonIndex + 1);
        if (secondColonIndex === -1) continue;

        const filename = line.slice(0, colonIndex);
        const content = line.slice(secondColonIndex + 1);

        if (!results.has(filename)) {
          results.set(filename, []);
        }
        results.get(filename)!.push(content);
      }

      resolve(results);
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ripgrep: ${err.message}`));
    });
  });
}

/**
 * Filter logs using ripgrep for fast pre-filtering.
 * 
 * @param logDir - Path to log directory
 * @param options - Filter options
 * @returns Array of matching LogLine objects, sorted by timestamp
 */
export async function filterLogs(
  logDir: string,
  options: FilterOptions,
  source: LogSource = "opencode"
): Promise<LogLine[]> {
  const useRipgrep = await hasRipgrep();
  const pattern = buildRipgrepPattern(options);

  let allLines: LogLine[] = [];

  if (useRipgrep && pattern) {
    // Use ripgrep for fast filtering
    const matches = await runRipgrep(logDir, pattern);
    
    for (const [filename, lines] of matches) {
      for (const line of lines) {
        const parsed = parseLine(line, filename, source);
        if (parsed && matchesFilter(parsed, options)) {
          allLines.push(parsed);
        }
      }
    }
  } else {
    // Fall back to reading all files
    const logFiles = await listLogFiles(logDir);
    
    for (const logFile of logFiles) {
      const content = await readFile(logFile, "utf-8");
      const lines = parseLines(content, logFile, source);
      
      for (const line of lines) {
        if (matchesFilter(line, options)) {
          allLines.push(line);
        }
      }
    }
  }

  // Sort by timestamp
  allLines.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Apply tail limit
  if (options.tail && options.tail > 0 && allLines.length > options.tail) {
    allLines = allLines.slice(-options.tail);
  }

  return allLines;
}

/**
 * Check if a log line matches all filter criteria.
 */
export function matchesFilter(line: LogLine, options: FilterOptions): boolean {
  if (options.pid && line.pid !== options.pid) {
    return false;
  }

  if (options.sessionID && line.sessionID !== options.sessionID) {
    return false;
  }

  if (options.service) {
    const services = Array.isArray(options.service) ? options.service : [options.service];
    if (!services.includes(line.service)) {
      return false;
    }
  }

  if (options.level && options.level.length > 0) {
    if (!options.level.includes(line.level)) {
      return false;
    }
  }

  if (options.startTime && line.timestamp < options.startTime) {
    return false;
  }

  if (options.endTime && line.timestamp > options.endTime) {
    return false;
  }

  if (options.source) {
    const sources = Array.isArray(options.source) ? options.source : [options.source];
    if (!sources.includes(line.source)) {
      return false;
    }
  }

  return true;
}

/**
 * Get unique values for a field across all logs.
 * Useful for building filter suggestions.
 */
export async function getUniqueValues(
  logDir: string,
  field: "service" | "level"
): Promise<string[]> {
  const logFiles = await listLogFiles(logDir);
  const values = new Set<string>();

  for (const logFile of logFiles) {
    const content = await readFile(logFile, "utf-8");
    const lines = parseLines(content, logFile);
    
    for (const line of lines) {
      if (field === "service") {
        values.add(line.service);
      } else if (field === "level") {
        values.add(line.level);
      }
    }
  }

  return Array.from(values).sort();
}
