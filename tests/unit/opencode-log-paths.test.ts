import { describe, expect, it } from "bun:test";
import { getOpenCodeLogDirectoryCandidates } from "../../src/core";

describe("getOpenCodeLogDirectoryCandidates", () => {
  it("returns canonical Linux OpenCode log path", () => {
    const candidates = getOpenCodeLogDirectoryCandidates({
      platform: "linux",
      homeDir: "/home/tester",
    });

    expect(candidates).toEqual(["/home/tester/.local/share/opencode/log"]);
  });

  it("returns canonical macOS OpenCode log candidates", () => {
    const candidates = getOpenCodeLogDirectoryCandidates({
      platform: "darwin",
      homeDir: "/Users/tester",
    });

    expect(candidates).toEqual([
      "/Users/tester/Library/Application Support/opencode/log",
      "/Users/tester/.local/share/opencode/log",
    ]);
  });

  it("returns canonical Windows OpenCode log path and honors LOCALAPPDATA", () => {
    const candidates = getOpenCodeLogDirectoryCandidates({
      platform: "win32",
      homeDir: "C:/Users/tester",
      localAppData: "D:/LocalAppData",
    });

    expect(candidates).toEqual(["D:/LocalAppData/opencode/log"]);
  });
});
