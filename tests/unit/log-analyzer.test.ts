import { describe, expect, it } from "bun:test";
import { parseLine } from "../../scripts/log-analyzer/parser";
import { matchesFilter } from "../../scripts/log-analyzer/filters";

describe("log-analyzer", () => {
  it("parses OpenCode log lines with explicit source", () => {
    const line =
      "INFO  2026-01-02T17:45:26 +1ms pid=357917 service=opencode-coder durationMs=2 beadsEnabled=true OpencodeCoder plugin loaded";

    const parsed = parseLine(line, "/tmp/opencode.log", "opencode");

    expect(parsed).not.toBeNull();
    expect(parsed?.source).toBe("opencode");
    expect(parsed?.service).toBe("opencode-coder");
    expect(parsed?.pid).toBe(357917);
    expect(parsed?.fields["durationMs"]).toBe("2");
  });

  it("parses project-local plugin log lines and extra context", () => {
    const line =
      '2026-03-23T10:40:00.123Z INFO [opencode-coder] (pid=1234) Runtime diagnostic signal extra={"signal":"runtime.project_context.available","installReady":true,"ecosystemReady":true}';

    const parsed = parseLine(line, "/repo/.coder/logs/coder-2026-03-23.log", "project-local");

    expect(parsed).not.toBeNull();
    expect(parsed?.source).toBe("project-local");
    expect(parsed?.service).toBe("opencode-coder");
    expect(parsed?.pid).toBe(1234);
    expect(parsed?.message).toBe("Runtime diagnostic signal");
    expect(parsed?.fields["signal"]).toBe("runtime.project_context.available");
    expect(parsed?.fields["installReady"]).toBe("true");
  });

  it("matches source filter correctly", () => {
    const parsed = parseLine(
      "INFO  2026-01-02T17:45:26 +1ms pid=100 service=opencode-coder plugin loaded",
      "/tmp/opencode.log",
      "opencode"
    );

    expect(parsed).not.toBeNull();
    if (!parsed) {
      return;
    }

    expect(matchesFilter(parsed, { source: "opencode" })).toBe(true);
    expect(matchesFilter(parsed, { source: "project-local" })).toBe(false);
    expect(matchesFilter(parsed, { source: ["project-local", "opencode"] })).toBe(true);
  });
});
