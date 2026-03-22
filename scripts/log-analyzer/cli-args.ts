import type { CliArgs, FilterOptions, LogLevel } from "./types";

/**
 * True when at least one explicit content filter is provided.
 *
 * Source selection and output shaping options (for example --source, --tail)
 * are not content filters and should not disable interactive mode by themselves.
 */
export function hasExplicitFilters(filter: FilterOptions): boolean {
  return Boolean(
    filter.pid ||
      filter.sessionID ||
      filter.service ||
      (filter.level && filter.level.length > 0) ||
      filter.startTime ||
      filter.endTime
  );
}

/**
 * Parse command line arguments.
 */
export function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    filter: {},
    format: {},
    source: "opencode",
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "help" || arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "list") {
      result.command = "list";
      if (args[i + 1] === "processes" || args[i + 1] === "sessions") {
        result.listType = args[i + 1] as "processes" | "sessions";
        i++;
      }
    } else if (arg.startsWith("--pid=")) {
      result.filter.pid = parseInt(arg.slice(6), 10);
    } else if (arg.startsWith("--session=")) {
      result.filter.sessionID = arg.slice(10);
    } else if (arg.startsWith("--service=")) {
      const services = arg.slice(10).split(",");
      result.filter.service = services.length === 1 ? services[0] : services;
    } else if (arg.startsWith("--source=")) {
      const source = arg.slice(9);
      if (source === "opencode" || source === "project-local" || source === "both") {
        result.source = source;
      }
    } else if (arg.startsWith("--project-log-dir=")) {
      result.projectLogDir = arg.slice(18);
    } else if (arg.startsWith("--level=")) {
      result.filter.level = arg.slice(8).split(",") as LogLevel[];
    } else if (arg.startsWith("--tail=")) {
      result.filter.tail = parseInt(arg.slice(7), 10);
    } else if (arg === "--json") {
      result.format.json = true;
    } else if (arg === "--no-color") {
      result.format.noColor = true;
    } else if (arg === "--raw") {
      result.format.raw = true;
    } else if (arg === "--full-timestamp") {
      result.format.fullTimestamp = true;
    }

    i++;
  }

  // If no command and no explicit content filters, assume interactive mode.
  if (!result.command && !hasExplicitFilters(result.filter)) {
    result.interactive = true;
  }

  return result;
}
