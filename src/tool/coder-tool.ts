import { tool } from "@opencode-ai/plugin";
import type { ToolContext, ToolDefinition } from "@opencode-ai/plugin/tool";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { isDebugLoggingEnabled, isPluginDisabled } from "../config";
import type { SessionExportService } from "../service";
import type { VersionInfo } from "../core";
import { resolveOpenCodeLogDirectory, summarizeOpenCodeLogDirectory } from "../core";

/**
 * Options for creating the coder tool.
 */
export interface CoderToolOptions {
  sessionExportService: SessionExportService;
  versionInfo: VersionInfo;
}

/**
 * Create the `coder` custom tool that AI agents can call.
 *
 * This is a single tool with a string parameter that dispatches to
 * sub-commands: session, version, session-export, tokens.
 */
export function createCoderTool(options: CoderToolOptions): ToolDefinition {
  const { sessionExportService, versionInfo } = options;

  return tool({
    description:
      "Tool to access coding agent internals like version, session data, used tokens. Call without parameter to get more info. Tool also allows session export.",
    args: {
      command: tool.schema
        .string()
        .optional()
        .describe("Command to execute. Call with no argument for help."),
    },
    async execute(args, context: ToolContext) {
      const { command } = args;
      const { sessionID } = context;

      // Parse the command string
      const parts = (command || "").trim().split(/\s+/);
      const subCommand = parts[0]?.toLowerCase();

      if (!subCommand) {
        return `Coder Plugin Tool - Session & Plugin Utilities

Available commands:
  session              Current session metadata (ID, title, timestamps)
  version              Plugin name and version
  plugin               Plugin status (enabled, debug mode)
  tokens               Token usage summary (input, output, cache, cost)
  list-sessions        List all OpenCode sessions
  beads                Beads status (initialized, mode, hooks)
  logs                 Log directory info (path, file count, latest)
  session-export <path> [session-id]
                       Export session data to folder

Examples:
  coder("version")
  coder("tokens")
  coder("session-export ./exports")`;
      }

      switch (subCommand) {
        case "session":
          return await sessionExportService.formatSessionInfo(sessionID);

        case "version":
          return `${versionInfo.name} v${versionInfo.version}`;

        case "session-export": {
          const exportPath = parts[1];
          const targetSessionID = parts[2] || sessionID;
          if (!exportPath) {
            return "Error: session-export requires a path argument. Usage: session-export <path> [session-id]";
          }
          const resolvedPath = isAbsolute(exportPath)
            ? exportPath
            : join(context.directory, exportPath);

          const result = await sessionExportService.exportSession(targetSessionID, resolvedPath);
          return `Session exported successfully.\nPath: ${result.outputPath}\nMessages: ${result.messageCount}\nTotal tokens: ${result.totalTokens}\nTotal cost: $${result.totalCost.toFixed(4)}`;
        }

        case "tokens":
          return await sessionExportService.formatTokenSummary(sessionID);

        case "list-sessions":
          return await sessionExportService.formatSessionList();

        case "plugin": {
          const disabled = isPluginDisabled();
          const debugEnabled = isDebugLoggingEnabled();

          return `Plugin: ${versionInfo.name}
Version: ${versionInfo.version}
Status: ${disabled ? "DISABLED" : "ACTIVE"}
Debug: ${debugEnabled ? "enabled" : "disabled"}`;
        }

        case "beads": {
          const beadsDir = join(context.directory, ".beads");
          const configPath = join(beadsDir, "config.json");
          const preCommitPath = join(context.directory, ".git", "hooks", "pre-commit");

          const initialized = existsSync(beadsDir);

          let mode = "unknown";
          if (initialized && existsSync(configPath)) {
            try {
              const configContent = readFileSync(configPath, "utf-8");
              const config = JSON.parse(configContent);
              mode = config.mode || "unknown";
            } catch {
              mode = "error reading config";
            }
          }

          let hooksInstalled = false;
          if (existsSync(preCommitPath)) {
            try {
              const hookContent = readFileSync(preCommitPath, "utf-8");
              hooksInstalled = hookContent.includes("bd sync");
            } catch {
              hooksInstalled = false;
            }
          }

          return `Beads Status:
Initialized: ${initialized ? "yes" : "no"}
Mode: ${initialized ? mode : "n/a"}
Git hooks installed: ${hooksInstalled ? "yes" : "no"}
Directory: ${beadsDir}`;
        }

        case "logs": {
          const resolved = resolveOpenCodeLogDirectory({
            platform: process.platform,
            ...(process.env["LOCALAPPDATA"]
              ? { localAppData: process.env["LOCALAPPDATA"] }
              : {}),
          });

          const summary = summarizeOpenCodeLogDirectory({
            directory: resolved.directory,
            exists: resolved.exists,
          });

          return `OpenCode Logs
Directory: ${resolved.directory}
Candidates: ${resolved.candidates.join(", ")}
Exists: ${resolved.exists ? "yes" : "no"}
Log files: ${summary.fileCount}
Latest: ${summary.latestFile}`;
        }

        default:
          return `Unknown command: "${subCommand}". Available commands: session, version, session-export <path> [session-id], tokens, list-sessions, plugin, beads, logs`;
      }
    },
  });
}
