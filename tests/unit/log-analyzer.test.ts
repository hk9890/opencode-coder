import { describe, expect, it } from "bun:test";
import { parseLine } from "../../scripts/log-analyzer/parser";
import { matchesFilter } from "../../scripts/log-analyzer/filters";
import { hasExplicitFilters, parseArgs } from "../../scripts/log-analyzer/cli-args";

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

  describe("parseArgs interactive mode gating", () => {
    it("treats --service-only queries as non-interactive", () => {
      const parsed = parseArgs(["--source=project-local", "--service=opencode-coder"]);

      expect(parsed.interactive).toBeUndefined();
      expect(parsed.filter.service).toBe("opencode-coder");
      expect(parsed.source).toBe("project-local");
    });

    it("treats --level-only queries as non-interactive", () => {
      const parsed = parseArgs(["--source=project-local", "--level=ERROR,WARN"]);

      expect(parsed.interactive).toBeUndefined();
      expect(parsed.filter.level).toEqual(["ERROR", "WARN"]);
      expect(parsed.source).toBe("project-local");
    });

    it("keeps no-filter runs interactive", () => {
      const parsed = parseArgs([]);

      expect(parsed.interactive).toBe(true);
    });

    it("treats --source alone as config and keeps interactive mode", () => {
      const parsed = parseArgs(["--source=project-local"]);

      expect(parsed.interactive).toBe(true);
      expect(parsed.source).toBe("project-local");
    });
  });

  describe("hasExplicitFilters", () => {
    it("returns true for service-only and level-only filters", () => {
      expect(hasExplicitFilters({ service: "opencode-coder" })).toBe(true);
      expect(hasExplicitFilters({ level: ["ERROR"] })).toBe(true);
    });

    it("returns false for source-only configuration and tail-only shaping", () => {
      expect(hasExplicitFilters({ source: "project-local" })).toBe(false);
      expect(hasExplicitFilters({ tail: 200 })).toBe(false);
    });
  });
});
