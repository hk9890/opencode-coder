import * as fs from "fs";
import * as path from "path";
import { stringify } from "yaml";
import type { Logger } from "../core";
import type { ProjectContext } from "./project-detector-service";

export interface ProjectContextWriterOptions {
  logger: Logger;
  workdir?: string;
}

/**
 * Persists `.coder/project.yaml` and ensures `.coder/.gitignore` semantics.
 */
export class ProjectContextWriter {
  private readonly logger: Logger;
  private readonly workdir: string;

  constructor(options: ProjectContextWriterOptions) {
    this.logger = options.logger;
    this.workdir = options.workdir ?? process.cwd();
  }

  /**
   * Ensure `.coder/` exists and write `context` as YAML to `.coder/project.yaml`.
   *
   * Also creates `.coder/.gitignore` (containing `*`) if it does not already exist,
   * so that the entire `.coder/` directory is excluded from git in team mode.
   */
  write(context: ProjectContext): void {
    const coderDir = path.join(this.workdir, ".coder");
    fs.mkdirSync(coderDir, { recursive: true });

    const gitignorePath = path.join(coderDir, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, "*\n");
    }

    const outputPath = path.join(coderDir, "project.yaml");
    const yamlContent = stringify(context);
    fs.writeFileSync(outputPath, yamlContent, "utf-8");
    this.logger.debug("Project context written", { path: outputPath });
  }
}
