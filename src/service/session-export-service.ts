import type { Logger, OpencodeClient } from "../core";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Options for SessionExportService
 */
export interface SessionExportServiceOptions {
  /** Logger for reporting status and errors */
  logger: Logger;
  /** OpenCode client for session operations */
  client: OpencodeClient;
}

/**
 * Aggregated token usage summary for a session
 */
export interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalReasoning: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalCost: number;
}

/**
 * Result returned from exportSession()
 */
export interface ExportResult {
  outputPath: string;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
}

/**
 * Service that handles fetching session data from the OpenCode SDK
 * and serializing it to JSON files on disk.
 *
 * Used by the `coder` tool and `/dump-session` command.
 */
export class SessionExportService {
  private readonly log: Logger;
  private readonly client: OpencodeClient;

  constructor(options: SessionExportServiceOptions) {
    this.log = options.logger;
    this.client = options.client;
  }

  /**
   * Get session metadata (id, title, time, summary, share info)
   */
  async getSessionInfo(sessionID: string): Promise<unknown> {
    this.log.debug("Fetching session info", { sessionID });
    const response = await this.client.session.get({
      path: { id: sessionID },
    });
    return response.data;
  }

  /**
   * Get full conversation history for a session.
   * Returns array of { info: Message, parts: Part[] }.
   */
  async getSessionMessages(sessionID: string): Promise<unknown[]> {
    this.log.debug("Fetching session messages", { sessionID });
    const response = await this.client.session.messages({
      path: { id: sessionID },
    });
    return (response.data as unknown[]) ?? [];
  }

  /**
   * Get file diffs made during the session.
   */
  async getSessionDiffs(sessionID: string): Promise<unknown> {
    this.log.debug("Fetching session diffs", { sessionID });
    const response = await this.client.session.diff({
      path: { id: sessionID },
    });
    return response.data;
  }

  /**
   * Compute aggregated token usage summary from all assistant messages.
   */
  async getTokenSummary(sessionID: string): Promise<TokenSummary> {
    this.log.debug("Computing token summary", { sessionID });
    const messages = await this.getSessionMessages(sessionID);

    return this.summarizeTokenUsage(messages, sessionID);
  }

  private summarizeTokenUsage(messages: unknown[], sessionID: string): TokenSummary {
    const summary: TokenSummary = {
      totalInput: 0,
      totalOutput: 0,
      totalReasoning: 0,
      totalCacheRead: 0,
      totalCacheWrite: 0,
      totalCost: 0,
    };

    for (const msg of messages) {
      const info = (msg as any).info;
      if (!info || info.role !== "assistant") continue;

      const tokens = info.tokens;
      if (tokens) {
        summary.totalInput += tokens.input ?? 0;
        summary.totalOutput += tokens.output ?? 0;
        summary.totalReasoning += tokens.reasoning ?? 0;
        if (tokens.cache) {
          summary.totalCacheRead += tokens.cache.read ?? 0;
          summary.totalCacheWrite += tokens.cache.write ?? 0;
        }
      }

      if (typeof info.cost === "number") {
        summary.totalCost += info.cost;
      }
    }

    this.log.debug("Token summary computed", {
      sessionID,
      totalInput: summary.totalInput,
      totalOutput: summary.totalOutput,
    });

    return summary;
  }

  /**
   * Export full session data to disk as JSON.
   *
   * Creates the output directory and writes `session.json` containing
   * session metadata, messages, diffs, and token summary.
   */
  async exportSession(sessionID: string, outputDir: string): Promise<ExportResult> {
    this.log.info("Exporting session", { sessionID, outputDir });

    // Fetch all data in parallel, handling diffs failure gracefully
    const [session, messages, diffs] = await Promise.all([
      this.getSessionInfo(sessionID),
      this.getSessionMessages(sessionID),
      this.getSessionDiffs(sessionID).catch((error) => {
        this.log.warn("Failed to fetch session diffs, exporting without diffs", {
          sessionID,
          error: String(error),
        });
        return { error: "Failed to fetch diffs" };
      }),
    ]);
    const tokenSummary = this.summarizeTokenUsage(messages, sessionID);

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0" as const,
      session,
      tokenSummary,
      messages,
      diffs,
    };

    // Write to disk
    await mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, "session.json");
    await writeFile(outputPath, JSON.stringify(exportData, null, 2));

    const totalTokens =
      tokenSummary.totalInput + tokenSummary.totalOutput + tokenSummary.totalReasoning;

    this.log.info("Session exported successfully", {
      sessionID,
      outputPath,
      messageCount: messages.length,
      totalTokens,
      totalCost: tokenSummary.totalCost,
    });

    return {
      outputPath,
      messageCount: messages.length,
      totalTokens,
      totalCost: tokenSummary.totalCost,
    };
  }

  /**
   * Format session info as a human-readable string.
   */
  async formatSessionInfo(sessionID: string): Promise<string> {
    const session = (await this.getSessionInfo(sessionID)) as any;
    if (!session) {
      return `Session ${sessionID}: not found`;
    }

    const lines: string[] = [];
    lines.push(`Session: ${session.id ?? sessionID}`);
    if (session.title) lines.push(`Title: ${session.title}`);
    if (session.createdAt) lines.push(`Created: ${session.createdAt}`);
    if (session.updatedAt) lines.push(`Updated: ${session.updatedAt}`);
    if (session.summary) lines.push(`Summary: ${session.summary}`);

    return lines.join("\n");
  }

  /**
   * Format token usage summary as a human-readable string.
   */
  async formatTokenSummary(sessionID: string): Promise<string> {
    const summary = await this.getTokenSummary(sessionID);

    const totalTokens = summary.totalInput + summary.totalOutput + summary.totalReasoning;
    const lines: string[] = [];
    lines.push(`Token Usage Summary`);
    lines.push(`  Input:     ${summary.totalInput.toLocaleString()}`);
    lines.push(`  Output:    ${summary.totalOutput.toLocaleString()}`);
    lines.push(`  Reasoning: ${summary.totalReasoning.toLocaleString()}`);
    lines.push(`  Cache Read:  ${summary.totalCacheRead.toLocaleString()}`);
    lines.push(`  Cache Write: ${summary.totalCacheWrite.toLocaleString()}`);
    lines.push(`  Total:     ${totalTokens.toLocaleString()}`);
    lines.push(`  Cost:      $${summary.totalCost.toFixed(4)}`);

    return lines.join("\n");
  }

  /**
   * List all sessions from the OpenCode SDK.
   */
  async listSessions(): Promise<unknown[]> {
    this.log.debug("Fetching session list");
    const response = await this.client.session.list();
    return (response.data as unknown[]) ?? [];
  }

  /**
   * Format session list as a human-readable string.
   * Sessions are sorted by updatedAt descending (most recent first).
   */
  async formatSessionList(): Promise<string> {
    const sessions = await this.listSessions();

    if (sessions.length === 0) {
      return "No sessions found.";
    }

    // Sort by updatedAt descending (most recent first)
    const sorted = [...sessions].sort((a: any, b: any) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });

    const lines: string[] = [];
    lines.push(`Sessions (${sorted.length} total)`);
    lines.push("─".repeat(80));

    for (const session of sorted as any[]) {
      const id = session.id ?? "unknown";
      const title = session.title ?? "(untitled)";
      const truncatedTitle = title.length > 40 ? title.slice(0, 37) + "..." : title;
      const createdAt = session.createdAt ?? "unknown";
      const updatedAt = session.updatedAt ?? "unknown";

      lines.push(`  ${id}`);
      lines.push(`    Title:   ${truncatedTitle}`);
      lines.push(`    Created: ${createdAt}`);
      lines.push(`    Updated: ${updatedAt}`);
      lines.push("");
    }

    return lines.join("\n").trimEnd();
  }
}
