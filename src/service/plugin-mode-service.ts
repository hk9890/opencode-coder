import * as fs from "fs";
import * as path from "path";
import { parse as parseYaml, stringify } from "yaml";
import { type Logger } from "../core";
import { isPluginDisabled } from "../config";

export type SavedPluginMode = "disabled" | "stealth" | "team";
export type ResolvedPluginMode = SavedPluginMode | "not-enabled" | "hard-disabled";
export type PluginModeSource = "env" | "saved" | "legacy" | "fresh" | "invalid-saved";

export interface PluginModeServiceOptions {
  logger: Logger;
  workdir?: string;
}

export interface PluginModeResolution {
  mode: ResolvedPluginMode;
  source: PluginModeSource;
  stateFilePath: string;
}

interface SavedPluginModeDocument {
  mode: SavedPluginMode;
}

type SavedModeReadResult =
  | { kind: "missing" }
  | { kind: "saved"; mode: SavedPluginMode }
  | { kind: "invalid"; reason: string };

const STEALTH_MARKER = "# opencode-coder stealth mode";
const SAVED_PLUGIN_MODES: ReadonlySet<SavedPluginMode> = new Set(["disabled", "stealth", "team"]);

export class PluginModeService {
  private readonly logger: Logger;
  private readonly workdir: string;

  constructor(options: PluginModeServiceOptions) {
    this.logger = options.logger;
    this.workdir = options.workdir ?? process.cwd();
  }

  getStateFilePath(): string {
    return path.join(this.workdir, ".coder", "opencode-coder.yaml");
  }

  getProjectContextPath(): string {
    return path.join(this.workdir, ".coder", "project.yaml");
  }

  getActiveMode(): SavedPluginMode | null {
    const resolution = this.resolveStartupMode();
    return resolution.mode === "stealth" || resolution.mode === "team"
      ? resolution.mode
      : null;
  }

  resolveStartupMode(): PluginModeResolution {
    const stateFilePath = this.getStateFilePath();
    const savedMode = this.readSavedMode();

    if (isPluginDisabled()) {
      if (savedMode.kind === "saved") {
        this.logger.info("OPENCODE_CODER_DISABLED hard override won over saved plugin mode", {
          savedMode: savedMode.mode,
        });
      } else {
        this.logger.info("OpencodeCoder plugin disabled via OPENCODE_CODER_DISABLED env var");
      }

      return {
        mode: "hard-disabled",
        source: "env",
        stateFilePath,
      };
    }

    if (savedMode.kind === "saved") {
      return {
        mode: savedMode.mode,
        source: "saved",
        stateFilePath,
      };
    }

    if (savedMode.kind === "invalid") {
      this.logger.warn("Saved plugin mode file is invalid; falling back to init-only mode", {
        path: stateFilePath,
        reason: savedMode.reason,
      });
      return {
        mode: "not-enabled",
        source: "invalid-saved",
        stateFilePath,
      };
    }

    const legacyMode = this.inferLegacyMode();
    if (legacyMode) {
      this.persistSavedMode(legacyMode, "legacy migration");
      return {
        mode: legacyMode,
        source: "legacy",
        stateFilePath,
      };
    }

    return {
      mode: "not-enabled",
      source: "fresh",
      stateFilePath,
    };
  }

  persistSavedMode(mode: SavedPluginMode, reason = "saved mode update"): void {
    const stateFilePath = this.getStateFilePath();
    fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
    const yamlContent = stringify({ mode } satisfies SavedPluginModeDocument);
    fs.writeFileSync(stateFilePath, yamlContent, "utf-8");
    this.logger.info("Persisted opencode-coder plugin mode", {
      mode,
      path: stateFilePath,
      reason,
    });
  }

  private readSavedMode(): SavedModeReadResult {
    const stateFilePath = this.getStateFilePath();
    if (!fs.existsSync(stateFilePath)) {
      return { kind: "missing" };
    }

    try {
      const raw = fs.readFileSync(stateFilePath, "utf-8");
      const parsed = parseYaml(raw);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { kind: "invalid", reason: "expected a YAML object with a mode field" };
      }

      const mode = (parsed as Record<string, unknown>)["mode"];
      if (!isSavedPluginMode(mode)) {
        return { kind: "invalid", reason: `unrecognized mode ${JSON.stringify(mode)}` };
      }

      return { kind: "saved", mode };
    } catch (error) {
      return { kind: "invalid", reason: String(error) };
    }
  }

  private inferLegacyMode(): SavedPluginMode | null {
    if (this.detectStealthMarker()) {
      this.logger.info("Inferred legacy opencode-coder mode from stealth marker", {
        mode: "stealth",
      });
      return "stealth";
    }

    const projectContextMode = this.readLegacyProjectContextMode();
    if (projectContextMode) {
      this.logger.info("Inferred legacy opencode-coder mode from project context", {
        mode: projectContextMode,
      });
      return projectContextMode;
    }

    if (this.detectLegacyTeamMarkers()) {
      this.logger.info("Inferred legacy opencode-coder mode from team setup markers", {
        mode: "team",
      });
      return "team";
    }

    if (this.detectLegacyStealthAgentsFile()) {
      this.logger.info("Inferred legacy opencode-coder mode from stealth AGENTS file", {
        mode: "stealth",
      });
      return "stealth";
    }

    return null;
  }

  private detectStealthMarker(): boolean {
    const excludeFile = path.join(this.workdir, ".git", "info", "exclude");
    try {
      return fs.readFileSync(excludeFile, "utf-8").includes(STEALTH_MARKER);
    } catch {
      return false;
    }
  }

  private readLegacyProjectContextMode(): Exclude<SavedPluginMode, "disabled"> | null {
    const projectContextPath = this.getProjectContextPath();
    if (!fs.existsSync(projectContextPath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(projectContextPath, "utf-8");
      const parsed = parseYaml(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      const mode = (parsed as Record<string, unknown>)["mode"];
      return mode === "stealth" || mode === "team" ? mode : null;
    } catch {
      return null;
    }
  }

  private detectLegacyTeamMarkers(): boolean {
    return [
      path.join(this.workdir, ".beads"),
      path.join(this.workdir, "AGENTS.md"),
      path.join(this.workdir, "ai.package.yaml"),
    ].every((filePath) => fs.existsSync(filePath));
  }

  private detectLegacyStealthAgentsFile(): boolean {
    return fs.existsSync(path.join(this.workdir, ".coder", "AGENTS.md"));
  }
}

function isSavedPluginMode(value: unknown): value is SavedPluginMode {
  return typeof value === "string" && SAVED_PLUGIN_MODES.has(value as SavedPluginMode);
}
