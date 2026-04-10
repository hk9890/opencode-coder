import type { Logger, OpencodeClient } from "../core";
import { detectBdCliAvailabilityStatus, detectBeadsDirectory, showToast } from "../core";

/**
 * Options for BeadsService
 */
export interface BeadsServiceOptions {
  /** Logger for reporting status and errors */
  logger: Logger;
  /** OpenCode client for session operations */
  client: OpencodeClient;
  /** Working directory (defaults to process.cwd()) */
  workdir?: string;
  /** Override beads enabled state (for testing) */
  beadsEnabled?: boolean;
}

/**
 * Service that handles beads-related functionality.
 *
 * Features:
 * - Detects beads availability (.beads/ directory)
 * - Shows toast notifications if beads is not properly set up
 *
 * Guidance and CLI reference are provided by the agent configurations
 * (ai-resources/agents/*.md), not injected by this service.
 */
export class BeadsService {
  private readonly logger: Logger;
  private readonly beadsEnabled: boolean;
  private readonly client: OpencodeClient;
  private readonly workdir: string;

  constructor(options: BeadsServiceOptions) {
    this.logger = options.logger;
    this.client = options.client;
    this.workdir = options.workdir ?? process.cwd();

    // Detect beads enabled state (can be overridden for testing)
    if (options.beadsEnabled !== undefined) {
      this.beadsEnabled = options.beadsEnabled;
    } else {
      this.beadsEnabled = this.detectBeadsDirectory();
      this.logger.debug("Beads enabled from auto-detection", { enabled: this.beadsEnabled });
    }
  }

  /**
   * Check if beads integration is enabled
   */
  isBeadsEnabled(): boolean {
    return this.beadsEnabled;
  }

  /**
   * Check beads availability and show toast notification if something is missing.
   * This helps users understand why beads features aren't working.
   *
   * Shows warning toast if:
   * - bd CLI is not installed
   * - .beads directory is missing
   *
   * Does NOT show toast if both conditions pass (beads is working).
   */
  async checkBeadsAvailability(): Promise<void> {
    const start = Date.now();
    try {
      // Check if bd CLI is installed
      const bdCliAvailability = this.getBdCliAvailability();

      // Check if .beads directory exists
      const beadsDirExists = this.detectBeadsDirectory();

      // Only show toast if something is missing
      if (bdCliAvailability === "missing") {
        await showToast(this.client, this.logger, {
          title: "Beads Not Available",
          message: "Beads CLI not found. Install with: npm install -g beads",
          variant: "warning",
          duration: 8000,
        });
        this.logger.warn("Beads CLI not installed");
        return;
      }

      if (bdCliAvailability === "timeout") {
        this.logger.warn("Skipping Beads CLI install guidance due to timeout");
      }

      if (!beadsDirExists) {
        await showToast(this.client, this.logger, {
          title: "Beads Not Initialized",
          message: "Beads not initialized for this project. Run: bd init",
          variant: "warning",
          duration: 8000,
        });
        this.logger.warn("Beads directory not found");
        return;
      }

      // Both conditions pass - no toast needed
      this.logger.debug("Beads availability check passed");
    } finally {
      this.logger.debug("checkBeadsAvailability completed", { durationMs: Date.now() - start });
    }
  }

  /**
   * Check bd CLI availability status via shared project-detection helper.
   */
  private getBdCliAvailability() {
    return detectBdCliAvailabilityStatus(this.workdir, this.logger);
  }

  /**
   * Check whether .beads/ directory exists.
   */
  private detectBeadsDirectory(): boolean {
    return detectBeadsDirectory(this.workdir, this.logger);
  }
}
