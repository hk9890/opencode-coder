import { describe, expect, it } from "bun:test";
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
