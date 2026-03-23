#!/usr/bin/env bun

import { collectDiagnosticsBundle } from "./collector";

interface CliArgs {
  outputDir?: string;
  sessionID?: string;
  sessionExportPaths: string[];
  projectRoot?: string;
  opencodeLogDir?: string;
  projectLogDir?: string;
  help: boolean;
}

const HELP = `
Project diagnostics collector

USAGE:
  bun run scripts/collect-diagnostics [options]

OPTIONS:
  --session=<id>              Session ID for focused log extracts
  --session-export=<path>     Path to session export JSON or directory (repeatable)
  --output-dir=<path>         Output base directory (default: <project>/.coder/diagnostics)
  --project-root=<path>       Project root to collect from (default: cwd)
  --opencode-log-dir=<path>   Override OpenCode log directory
  --project-log-dir=<path>    Override project-local plugin log directory
  -h, --help                  Show this help

EXAMPLES:
  bun run scripts/collect-diagnostics
  bun run scripts/collect-diagnostics --session=ses_abc
  bun run scripts/collect-diagnostics --session-export=private/session-dump/ses_abc
  bun run scripts/collect-diagnostics --session=ses_abc --session-export=private/session-dump/ses_abc/session.json

PRIVACY:
  This bundle may include prompts, logs, file paths, and code excerpts.
  Review and redact before sharing outside your trust boundary.
`;

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {
    help: false,
    sessionExportPaths: [],
  };

  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") {
      parsed.help = true;
      continue;
    }

    if (arg.startsWith("--session=")) {
      parsed.sessionID = arg.slice("--session=".length);
      continue;
    }

    if (arg.startsWith("--session-export=")) {
      parsed.sessionExportPaths.push(arg.slice("--session-export=".length));
      continue;
    }

    if (arg.startsWith("--output-dir=")) {
      parsed.outputDir = arg.slice("--output-dir=".length);
      continue;
    }

    if (arg.startsWith("--project-root=")) {
      parsed.projectRoot = arg.slice("--project-root=".length);
      continue;
    }

    if (arg.startsWith("--opencode-log-dir=")) {
      parsed.opencodeLogDir = arg.slice("--opencode-log-dir=".length);
      continue;
    }

    if (arg.startsWith("--project-log-dir=")) {
      parsed.projectLogDir = arg.slice("--project-log-dir=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`Argument error: ${(error as Error).message}`);
    console.error("Run with --help for usage.");
    return 2;
  }

  if (args.help) {
    console.log(HELP.trim());
    return 0;
  }

  try {
    const result = await collectDiagnosticsBundle({
      sessionID: args.sessionID,
      sessionExportPaths: args.sessionExportPaths,
      outputDir: args.outputDir,
      projectRoot: args.projectRoot,
      opencodeLogDir: args.opencodeLogDir,
      projectLogDir: args.projectLogDir,
    });

    console.log("Diagnostics bundle collected.");
    console.log(`Bundle: ${result.bundleDir}`);
    console.log(`Manifest: ${result.manifestPath}`);
    console.log("Artifact status summary:");
    for (const [name, artifact] of Object.entries(result.manifest.artifacts)) {
      const details = artifact.details ? ` (${artifact.details})` : "";
      console.log(`- ${name}: ${artifact.status}${details}`);
    }
    return 0;
  } catch (error) {
    console.error(`Collection failed: ${(error as Error).message}`);
    return 1;
  }
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
