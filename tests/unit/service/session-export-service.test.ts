import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionExportService } from "../../../src/service";
import { createMockLogger } from "../../helpers/mock-logger";

describe("SessionExportService.formatSessionInfo", () => {
  const createService = (sessionData: unknown) => {
    const logger = createMockLogger();
    const client = {
      session: {
        get: async () => ({ data: sessionData }),
        messages: async () => ({ data: [] }),
        diff: async () => ({ data: [] }),
        list: async () => ({ data: [] }),
      },
    } as any;

    return new SessionExportService({ logger, client });
  };

  it("renders string summary inline", async () => {
    const service = createService({
      id: "ses_123",
      title: "Test",
      summary: "quick summary",
    });

    const result = await service.formatSessionInfo("ses_123");

    expect(result).toContain("Session: ses_123");
    expect(result).toContain("Title: Test");
    expect(result).toContain("Summary: quick summary");
  });

  it("renders object-valued summary as structured, readable JSON", async () => {
    const service = createService({
      id: "ses_obj",
      summary: {
        kind: "monitoring-review",
        status: "needs-followup",
        notes: ["missing signal", "confirm severity"],
      },
    });

    const result = await service.formatSessionInfo("ses_obj");

    expect(result).toContain("Session: ses_obj");
    expect(result).toContain("Summary:");
    expect(result).toContain('  {');
    expect(result).toContain('    "kind": "monitoring-review",');
    expect(result).toContain('    "status": "needs-followup",');
    expect(result).not.toContain("[object Object]");
  });

  it("truncates long object summaries to keep output concise", async () => {
    const service = createService({
      id: "ses_trunc",
      summary: {
        a: "1",
        b: "2",
        c: "3",
        d: "4",
        e: "5",
        f: "6",
        g: "7",
        h: "8",
        i: "9",
      },
    });

    const result = await service.formatSessionInfo("ses_trunc");

    expect(result).toContain("Summary:");
    expect(result).toContain("  ...");
  });
});

describe("SessionExportService export + token/list formatting", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  function createService(overrides?: {
    session?: unknown;
    messages?: unknown[];
    diffs?: unknown;
    diffError?: Error;
    sessions?: unknown[];
  }) {
    const logger = createMockLogger();
    const client = {
      session: {
        get: mock(async () => ({ data: overrides?.session ?? { id: "ses_1" } })),
        messages: mock(async () => ({ data: overrides?.messages ?? [] })),
        diff: mock(async () => {
          if (overrides?.diffError) throw overrides.diffError;
          return { data: overrides?.diffs ?? [] };
        }),
        list: mock(async () => ({ data: overrides?.sessions ?? [] })),
      },
    } as any;

    return {
      logger,
      client,
      service: new SessionExportService({ logger, client }),
    };
  }

  it("exportSession writes session.json and returns aggregate metadata", async () => {
    const messages = [
      { info: { role: "assistant", tokens: { input: 100, output: 25, reasoning: 10 }, cost: 0.0012 } },
      { info: { role: "user", tokens: { input: 999 }, cost: 9 } },
      { info: { role: "assistant", tokens: { input: 5, output: 3, cache: { read: 2, write: 1 } }, cost: 0.0023 } },
    ];

    const { service } = createService({
      session: { id: "ses_123", title: "Investigate issue" },
      messages,
      diffs: [{ file: "src/a.ts", patch: "..." }],
    });

    const dir = await mkdtemp(join(tmpdir(), "opencode-coder-export-"));
    tempDirs.push(dir);

    const result = await service.exportSession("ses_123", join(dir, "nested", "exports"));

    expect(result.messageCount).toBe(3);
    expect(result.totalTokens).toBe(143);
    expect(result.totalCost).toBeCloseTo(0.0035, 6);

    const written = JSON.parse(await readFile(result.outputPath, "utf-8"));
    expect(written.exportVersion).toBe("1.0");
    expect(written.session).toEqual({ id: "ses_123", title: "Investigate issue" });
    expect(written.messages).toHaveLength(3);
    expect(written.diffs).toEqual([{ file: "src/a.ts", patch: "..." }]);
    expect(written.tokenSummary).toMatchObject({
      totalInput: 105,
      totalOutput: 28,
      totalReasoning: 10,
      totalCacheRead: 2,
      totalCacheWrite: 1,
    });
    expect(written.tokenSummary.totalCost).toBeCloseTo(0.0035, 8);
  });

  it("exportSession continues when diff fetch fails", async () => {
    const { service, logger } = createService({
      session: { id: "ses_partial" },
      messages: [{ info: { role: "assistant", tokens: { input: 1, output: 2 }, cost: 0.01 } }],
      diffError: new Error("diff endpoint unavailable"),
    });

    const dir = await mkdtemp(join(tmpdir(), "opencode-coder-export-partial-"));
    tempDirs.push(dir);

    const result = await service.exportSession("ses_partial", dir);
    const written = JSON.parse(await readFile(result.outputPath, "utf-8"));

    expect(result).toMatchObject({ messageCount: 1, totalTokens: 3, totalCost: 0.01 });
    expect(written.diffs).toEqual({ error: "Failed to fetch diffs" });
    expect(logger.hasLogged("warn", /Failed to fetch session diffs/)).toBe(true);
  });

  it("summarizeTokenUsage aggregates only assistant tokens with sparse fields", () => {
    const { service } = createService();
    const summary = (service as any).summarizeTokenUsage(
      [
        { info: { role: "assistant", tokens: { input: 10, output: 4 }, cost: 0.1 } },
        { info: { role: "assistant", tokens: { reasoning: 3, cache: { read: 2 } } } },
        { info: { role: "assistant", tokens: { cache: { write: 5 } }, cost: 0.25 } },
        { info: { role: "user", tokens: { input: 999, output: 999 }, cost: 123 } },
        { info: { role: "assistant" } },
        {},
      ],
      "ses_sum",
    );

    expect(summary).toEqual({
      totalInput: 10,
      totalOutput: 4,
      totalReasoning: 3,
      totalCacheRead: 2,
      totalCacheWrite: 5,
      totalCost: 0.35,
    });
  });

  it("formatTokenSummary renders all token counters and cost", async () => {
    const { service } = createService({
      messages: [
        {
          info: {
            role: "assistant",
            tokens: { input: 1234, output: 5678, reasoning: 9, cache: { read: 100, write: 7 } },
            cost: 1.5,
          },
        },
      ],
    });

    const summary = await service.formatTokenSummary("ses_tokens");
    expect(summary).toContain("Token Usage Summary");
    expect(summary).toContain("Input:     1,234");
    expect(summary).toContain("Output:    5,678");
    expect(summary).toContain("Reasoning: 9");
    expect(summary).toContain("Cache Read:  100");
    expect(summary).toContain("Cache Write: 7");
    expect(summary).toContain("Total:     6,921");
    expect(summary).toContain("Cost:      $1.5000");
  });

  it("formatSessionList sorts by updatedAt and truncates long titles", async () => {
    const { service } = createService({
      sessions: [
        {
          id: "older",
          title: "Old title",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T01:00:00.000Z",
        },
        {
          id: "latest",
          title: "This title is intentionally very long so that truncation should apply in output",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T01:00:00.000Z",
        },
      ],
    });

    const list = await service.formatSessionList();
    const latestIndex = list.indexOf("  latest");
    const olderIndex = list.indexOf("  older");

    expect(list).toContain("Sessions (2 total)");
    expect(latestIndex).toBeGreaterThan(-1);
    expect(olderIndex).toBeGreaterThan(-1);
    expect(latestIndex).toBeLessThan(olderIndex);
    expect(list).toContain("This title is intentionally very long...");
  });

  it("formatSessionList returns no-sessions message", async () => {
    const { service } = createService({ sessions: [] });
    await expect(service.formatSessionList()).resolves.toBe("No sessions found.");
  });
});
