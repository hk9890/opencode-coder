import { describe, expect, it, mock } from "bun:test";
import { createCoderTool } from "../../src/tool/coder-tool";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("createCoderTool subcommand dispatch", () => {
  function createFixture() {
    const sessionExportService = {
      formatSessionInfo: mock(async () => "session info"),
      exportSession: mock(async () => ({
        outputPath: "/tmp/export/session.json",
        messageCount: 7,
        totalTokens: 123,
        totalCost: 0.4567,
      })),
      formatTokenSummary: mock(async () => "token summary"),
      formatSessionList: mock(async () => "session list"),
    };

    const definition = createCoderTool({
      sessionExportService: sessionExportService as any,
      versionInfo: { name: "@pkg/coder", version: "9.9.9" },
    }) as any;

    return {
      sessionExportService,
      execute: definition.execute as (args: { command?: string }, context: any) => Promise<string>,
      context: {
        sessionID: "ses_ctx",
        directory: "/workspace/project",
      },
    };
  }

  it("routes session command to formatSessionInfo", async () => {
    const { execute, sessionExportService, context } = createFixture();

    await expect(execute({ command: "session" }, context)).resolves.toBe("session info");
    expect(sessionExportService.formatSessionInfo).toHaveBeenCalledWith("ses_ctx");
  });

  it("routes version command to version info output", async () => {
    const { execute, context } = createFixture();
    await expect(execute({ command: "version" }, context)).resolves.toBe("@pkg/coder v9.9.9");
  });

  it("routes tokens and list-sessions commands", async () => {
    const { execute, sessionExportService, context } = createFixture();

    await expect(execute({ command: "tokens" }, context)).resolves.toBe("token summary");
    await expect(execute({ command: "list-sessions" }, context)).resolves.toBe("session list");

    expect(sessionExportService.formatTokenSummary).toHaveBeenCalledWith("ses_ctx");
    expect(sessionExportService.formatSessionList).toHaveBeenCalledTimes(1);
  });

  it("routes session-export with relative path and default session id", async () => {
    const { execute, sessionExportService, context } = createFixture();

    const response = await execute({ command: "session-export ./exports" }, context);

    expect(sessionExportService.exportSession).toHaveBeenCalledWith(
      "ses_ctx",
      "/workspace/project/exports",
    );
    expect(response).toContain("Session exported successfully.");
    expect(response).toContain("Messages: 7");
    expect(response).toContain("Total tokens: 123");
    expect(response).toContain("Total cost: $0.4567");
  });

  it("routes session-export with explicit session id", async () => {
    const { execute, sessionExportService, context } = createFixture();

    await execute({ command: "session-export /tmp/out ses_override" }, context);

    expect(sessionExportService.exportSession).toHaveBeenCalledWith("ses_override", "/tmp/out");
  });

  it("returns usage error when session-export path is missing", async () => {
    const { execute, context, sessionExportService } = createFixture();

    await expect(execute({ command: "session-export" }, context)).resolves.toContain(
      "session-export requires a path argument",
    );
    expect(sessionExportService.exportSession).not.toHaveBeenCalled();
  });

  it("returns help text when command is empty and unknown for unsupported subcommands", async () => {
    const { execute, context } = createFixture();

    await expect(execute({}, context)).resolves.toContain("Available commands:");
    await expect(execute({ command: "" }, context)).resolves.toContain("Available commands:");
    await expect(execute({ command: "not-a-command" }, context)).resolves.toContain(
      'Unknown command: "not-a-command"',
    );
  });

  it("detects current beads hook shims", async () => {
    const { execute, context } = createFixture();
    const workdir = mkdtempSync(join(tmpdir(), "coder-tool-beads-"));

    try {
      mkdirSync(join(workdir, ".beads"));
      mkdirSync(join(workdir, ".git", "hooks"), { recursive: true });
      writeFileSync(join(workdir, ".beads", "config.json"), JSON.stringify({ mode: "embedded" }));
      writeFileSync(join(workdir, ".git", "hooks", "pre-commit"), "bd hooks run pre-commit \"$@\"\n");

      const response = await execute({ command: "beads" }, { ...context, directory: workdir });

      expect(response).toContain("Initialized: yes");
      expect(response).toContain("Mode: embedded");
      expect(response).toContain("Git hooks installed: yes");
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });
});
