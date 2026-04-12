import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseLine } from "../../scripts/log-analyzer/parser";
import { __testing as filterTesting, filterLogs, matchesFilter } from "../../scripts/log-analyzer/filters";
import { hasExplicitFilters, parseArgs } from "../../scripts/log-analyzer/cli-args";
import { discoverSessions, getLogDirectoryCandidates } from "../../scripts/log-analyzer/discovery";
import { resolveOpenCodeLogDirectory } from "../../src/core";

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
      '2026-03-23T10:40:00.123Z INFO [opencode-coder] (pid=1234) Runtime diagnostic signal extra={"signal":"runtime.project_context.available","coreAvailable":true,"beadsReady":true}';

    const parsed = parseLine(line, "/repo/.coder/logs/coder-2026-03-23.log", "project-local");

    expect(parsed).not.toBeNull();
    expect(parsed?.source).toBe("project-local");
    expect(parsed?.service).toBe("opencode-coder");
    expect(parsed?.pid).toBe(1234);
    expect(parsed?.message).toBe("Runtime diagnostic signal");
    expect(parsed?.fields["signal"]).toBe("runtime.project_context.available");
    expect(parsed?.fields["beadsReady"]).toBe("true");
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

  describe("source-aware discovery and filtering", () => {
    it("discovers OpenCode sessions by sessionID fields", async () => {
      const logDir = mkdtempSync(join(tmpdir(), "opencode-coder-log-analyzer-opencode-"));
      try {
        writeFileSync(
          join(logDir, "opencode.log"),
          [
            "INFO  2026-03-23T10:40:01 +1ms pid=555 service=opencode-coder sessionID=ses_abc OpencodeCoder plugin loaded",
            "WARN  2026-03-23T10:40:02 +2ms pid=555 service=opencode-coder sessionID=ses_abc Runtime warning",
            "INFO  2026-03-23T10:40:03 +3ms pid=777 service=opencode-coder sessionID=ses_xyz Second session",
            "",
          ].join("\n"),
          "utf-8"
        );

        const sessions = await discoverSessions(logDir, "opencode");
        const sessionIds = sessions.map((session) => session.sessionID);

        expect(sessionIds).toContain("ses_abc");
        expect(sessionIds).toContain("ses_xyz");

        const sesAbc = sessions.find((session) => session.sessionID === "ses_abc");
        expect(sesAbc).toBeDefined();
        expect(sesAbc?.pid).toBe(555);
        expect(sesAbc?.lineCount).toBe(2);
      } finally {
        rmSync(logDir, { recursive: true, force: true });
      }
    });

    it("supports project-local session extraction path with source-aware filtering", async () => {
      const logDir = mkdtempSync(join(tmpdir(), "opencode-coder-log-analyzer-project-local-"));
      try {
        writeFileSync(
          join(logDir, "coder-2026-03-23.log"),
          [
            '2026-03-23T10:40:00.123Z INFO [opencode-coder] (pid=1234) Runtime diagnostic signal sessionID=ses_local extra={"sessionID":"ses_local","signal":"runtime.project_context.available"}',
            '2026-03-23T10:41:00.123Z INFO [opencode-coder] (pid=1234) Runtime diagnostic signal extra={"sessionID":"ses_other","signal":"runtime.command_registration.docs_lifecycle"}',
            "",
          ].join("\n"),
          "utf-8"
        );

        const sessions = await discoverSessions(logDir, "project-local");
        expect(sessions.map((session) => session.sessionID)).toContain("ses_local");

        const extracted = await filterLogs(
          logDir,
          { sessionID: "ses_local", tail: 50 },
          "project-local"
        );
        expect(extracted).toHaveLength(1);
        expect(extracted[0]?.source).toBe("project-local");
        expect(extracted[0]?.sessionID).toBe("ses_local");
        expect(extracted[0]?.fields["signal"]).toBe("runtime.project_context.available");
      } finally {
        rmSync(logDir, { recursive: true, force: true });
      }
    });
  });

  describe("OpenCode log path alignment with coder logs output", () => {
    it("keeps log-analyzer discovery candidates aligned with coder logs candidates for canonical platforms", () => {
      const scenarios = [
        {
          platform: "linux" as const,
          homeDir: "/home/tester",
        },
        {
          platform: "darwin" as const,
          homeDir: "/Users/tester",
        },
        {
          platform: "win32" as const,
          homeDir: "C:/Users/tester",
          localAppData: "D:/LocalAppData",
        },
      ];

      for (const scenario of scenarios) {
        const discoveryCandidates = getLogDirectoryCandidates({
          platform: scenario.platform,
          homeDir: scenario.homeDir,
          ...(scenario.localAppData ? { localAppData: scenario.localAppData } : {}),
        });

        const coderResolution = resolveOpenCodeLogDirectory({
          platform: scenario.platform,
          homeDir: scenario.homeDir,
          ...(scenario.localAppData ? { localAppData: scenario.localAppData } : {}),
          exists: () => false,
        });

        expect(discoveryCandidates).toEqual(coderResolution.candidates);
        expect(discoveryCandidates[0]).toBe(coderResolution.directory);
      }
    });
  });

  describe("ripgrep prefilter for project-local source", () => {
    const projectLocalLines = [
      "2026-03-23T10:40:00.123Z INFO [opencode-coder] (pid=2840752) Plugin startup complete extra={\"sessionID\":\"ses_2e80b1765ffeeS5232XRw6yHYq\",\"signal\":\"runtime.startup\"}",
      "2026-03-23T10:40:02.123Z WARN [other-service] (pid=9999) Not relevant",
    ];

    it("builds source-specific ripgrep patterns for project-local logs", () => {
      expect(filterTesting.buildRipgrepPattern({ service: "opencode-coder" }, "project-local")).toBe("\\[opencode-coder\\]");
      expect(filterTesting.buildRipgrepPattern({ level: ["INFO"] }, "project-local")).toBe("\\s(INFO)\\s+\\[");
      expect(filterTesting.buildRipgrepPattern({ pid: 2840752 }, "project-local")).toBe("\\(pid=2840752\\)");
      expect(filterTesting.buildRipgrepPattern({ sessionID: "ses_2e80b1765ffeeS5232XRw6yHYq" }, "project-local")).toBe(
        '("sessionID"\\s*:\\s*"ses_2e80b1765ffeeS5232XRw6yHYq"|sessionID=ses_2e80b1765ffeeS5232XRw6yHYq)'
      );
    });

    it("uses rg fast path and returns project-local matches for service/level/pid/session filters", async () => {
      const logDir = mkdtempSync(join(tmpdir(), "opencode-coder-log-analyzer-rg-project-local-"));
      try {
        writeFileSync(join(logDir, "coder-2026-03-23.log"), `${projectLocalLines.join("\n")}\n`, "utf-8");

        const seenPatterns: string[] = [];
        const runtime = {
          hasRipgrep: async () => true,
          runRipgrep: async (_files: string[], pattern: string) => {
            seenPatterns.push(pattern);
            return new Map([[join(logDir, "coder-2026-03-23.log"), projectLocalLines]]);
          },
        };

        const byService = await filterLogs(logDir, { service: "opencode-coder", tail: 10 }, "project-local", runtime);
        const byLevel = await filterLogs(logDir, { level: ["INFO"], tail: 10 }, "project-local", runtime);
        const byPid = await filterLogs(logDir, { pid: 2840752, tail: 10 }, "project-local", runtime);
        const bySession = await filterLogs(
          logDir,
          { sessionID: "ses_2e80b1765ffeeS5232XRw6yHYq", tail: 10 },
          "project-local",
          runtime
        );

        expect(byService).toHaveLength(1);
        expect(byLevel).toHaveLength(1);
        expect(byPid).toHaveLength(1);
        expect(bySession).toHaveLength(1);
        expect(bySession[0]?.sessionID).toBe("ses_2e80b1765ffeeS5232XRw6yHYq");

        expect(seenPatterns).toContain("\\[opencode-coder\\]");
        expect(seenPatterns).toContain("\\s(INFO)\\s+\\[");
        expect(seenPatterns).toContain("\\(pid=2840752\\)");
        expect(seenPatterns).toContain(
          '("sessionID"\\s*:\\s*"ses_2e80b1765ffeeS5232XRw6yHYq"|sessionID=ses_2e80b1765ffeeS5232XRw6yHYq)'
        );
      } finally {
        rmSync(logDir, { recursive: true, force: true });
      }
    });

    it("preserves project-local entries in merged source-style queries", async () => {
      const projectLocalDir = mkdtempSync(join(tmpdir(), "opencode-coder-log-analyzer-rg-both-local-"));
      const opencodeDir = mkdtempSync(join(tmpdir(), "opencode-coder-log-analyzer-rg-both-opencode-"));

      try {
        writeFileSync(
          join(projectLocalDir, "coder-2026-03-23.log"),
          `${projectLocalLines[0]}\n`,
          "utf-8"
        );
        writeFileSync(
          join(opencodeDir, "opencode.log"),
          "INFO  2026-03-23T10:39:59 +1ms pid=101 service=opencode-coder startup\n",
          "utf-8"
        );

        const runtime = {
          hasRipgrep: async () => true,
          runRipgrep: async (_files: string[], _pattern: string) =>
            new Map([[join(projectLocalDir, "coder-2026-03-23.log"), [projectLocalLines[0]]]]),
        };

        const local = await filterLogs(projectLocalDir, { service: "opencode-coder", tail: 20 }, "project-local", runtime);
        const openCode = await filterLogs(opencodeDir, { service: "opencode-coder", tail: 20 }, "opencode", {
          hasRipgrep: async () => false,
        });

        const merged = [...local, ...openCode].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        expect(merged).toHaveLength(2);
        expect(merged.some((line) => line.source === "project-local")).toBe(true);
        expect(merged.some((line) => line.source === "opencode")).toBe(true);
      } finally {
        rmSync(projectLocalDir, { recursive: true, force: true });
        rmSync(opencodeDir, { recursive: true, force: true });
      }
    });

    it("passes explicit log files to rg path for ignored project-local directories", async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "opencode-coder-log-analyzer-ignored-dir-"));
      const logDir = join(projectRoot, ".coder", "logs");
      const logFile = join(logDir, "coder-2026-03-23.log");

      try {
        mkdirSync(logDir, { recursive: true });
        writeFileSync(join(projectRoot, ".gitignore"), ".coder/logs/\n", "utf-8");
        writeFileSync(logFile, `${projectLocalLines[0]}\n`, "utf-8");

        const seenFileLists: string[][] = [];
        const runtime = {
          hasRipgrep: async () => true,
          runRipgrep: async (logFiles: string[], _pattern: string) => {
            seenFileLists.push(logFiles);
            return new Map([[logFile, [projectLocalLines[0]]]]);
          },
        };

        const matches = await filterLogs(logDir, { service: "opencode-coder", tail: 5 }, "project-local", runtime);

        expect(matches).toHaveLength(1);
        expect(matches[0]?.service).toBe("opencode-coder");
        expect(seenFileLists).toHaveLength(1);
        expect(seenFileLists[0]).toEqual([logFile]);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  });
});
