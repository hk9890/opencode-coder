import { describe, expect, it } from "bun:test";
import {
  resolveOpenCodeLogDirectory,
  summarizeOpenCodeLogDirectory,
} from "../../src/tool/coder-tool";
import { getOpenCodeLogDirectoryCandidates } from "../../src/core";

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

  it("uses the same canonical Linux candidate list as core log discovery", () => {
    const homeDir = "/home/tester";
    const resolved = resolveOpenCodeLogDirectory({
      platform: "linux",
      homeDir,
      exists: () => false,
    });

    const canonicalCandidates = getOpenCodeLogDirectoryCandidates({
      platform: "linux",
      homeDir,
    });

    expect(resolved.candidates).toEqual(canonicalCandidates);
    expect(resolved.directory).toBe(canonicalCandidates[0]);
  });

  it("resolves existing canonical Linux log directory with non-zero summary", () => {
    const homeDir = "/home/tester";
    const canonicalDirectory = "/home/tester/.local/share/opencode/log";

    const resolved = resolveOpenCodeLogDirectory({
      platform: "linux",
      homeDir,
      exists: (candidate) => candidate === canonicalDirectory,
    });

    const summary = summarizeOpenCodeLogDirectory({
      directory: resolved.directory,
      exists: resolved.exists,
      readdir: () => ["2026-03-22T232753.log", "2026-03-23T000001.log"],
      stat: (path) =>
        ({
          mtime: new Date(
            path.endsWith("2026-03-23T000001.log")
              ? "2026-03-23T00:00:01.000Z"
              : "2026-03-22T23:27:53.000Z",
          ),
        }) as any,
    });

    expect(resolved.directory).toBe(canonicalDirectory);
    expect(resolved.exists).toBe(true);
    expect(summary.fileCount).toBe(2);
    expect(summary.latestFile).toBe("2026-03-23T000001.log");
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
