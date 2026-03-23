import { describe, expect, it } from "bun:test";
import {
  resolveOpenCodeLogDirectory,
  summarizeOpenCodeLogDirectory,
} from "../../src/tool/coder-tool";

describe("coder-tool logs path resolution", () => {
  it("uses canonical Linux path when no candidate exists", () => {
    const resolved = resolveOpenCodeLogDirectory({
      platform: "linux",
      homeDir: "/home/tester",
      exists: () => false,
    });

    expect(resolved.directory).toBe("/home/tester/.local/share/opencode/log");
    expect(resolved.candidates).toEqual(["/home/tester/.local/share/opencode/log"]);
    expect(resolved.exists).toBe(false);
  });

  it("prefers first existing candidate on macOS", () => {
    const resolved = resolveOpenCodeLogDirectory({
      platform: "darwin",
      homeDir: "/Users/tester",
      exists: (candidate) => candidate.endsWith("Application Support/opencode/log"),
    });

    expect(resolved.directory).toBe("/Users/tester/Library/Application Support/opencode/log");
    expect(resolved.exists).toBe(true);
  });
});

describe("coder-tool logs directory summary", () => {
  it("summarizes log files and latest file deterministically", () => {
    const summary = summarizeOpenCodeLogDirectory({
      directory: "/logs",
      exists: true,
      readdir: () => ["alpha.log", "notes.txt", "omega.log"],
      stat: (path) =>
        ({
          mtime: new Date(path.endsWith("omega.log") ? "2026-03-23T10:00:00.000Z" : "2026-03-22T10:00:00.000Z"),
        }) as any,
    });

    expect(summary.fileCount).toBe(2);
    expect(summary.latestFile).toBe("omega.log");
  });

  it("returns empty summary when directory does not exist", () => {
    const summary = summarizeOpenCodeLogDirectory({
      directory: "/logs",
      exists: false,
    });

    expect(summary).toEqual({ fileCount: 0, latestFile: "none" });
  });
});
