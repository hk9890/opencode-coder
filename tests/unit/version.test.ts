import { describe, expect, it, mock, spyOn } from "bun:test";
import * as fsPromises from "node:fs/promises";
import * as pathModule from "node:path";

describe("getVersionInfo fallback paths", () => {
  function installJoinToFakePaths() {
    const realJoin = pathModule.join;
    return spyOn(pathModule, "join").mockImplementation((...parts: string[]) => {
      const result = realJoin(...parts);
      if (result.endsWith("src/package.json")) return "/fake/path-1/package.json";
      if (result.endsWith("package.json")) {
        if (parts.length >= 3 && parts[1] === ".." && parts[2] === "..") {
          return "/fake/path-2/package.json";
        }
        if (parts.length === 2 && parts[1] === "package.json") {
          return "/fake/path-3/package.json";
        }
      }
      return result;
    });
  }

  async function importFreshVersionModule() {
    return import(`../../src/core/version.ts?test=${Date.now()}-${Math.random()}`);
  }

  it("uses first candidate path when available", async () => {
    const joinSpy = installJoinToFakePaths();
    const accessSpy = spyOn(fsPromises, "access").mockImplementation(async (path: any) => {
      if (String(path) === "/fake/path-1/package.json") return;
      throw new Error("not found");
    });

    const bunFileSpy = spyOn(Bun, "file").mockImplementation((path: any) => {
      if (String(path) === "/fake/path-1/package.json") {
        return {
          json: mock(async () => ({
            name: "pkg-from-path-1",
            version: "1.2.3",
            description: "desc-1",
          })),
        } as any;
      }
      throw new Error("unexpected path");
    });

    const { getVersionInfo } = await importFreshVersionModule();
    const info = await getVersionInfo();

    expect(info).toEqual({
      name: "pkg-from-path-1",
      version: "1.2.3",
      description: "desc-1",
    });

    expect(accessSpy).toHaveBeenCalledWith("/fake/path-1/package.json");
    expect(bunFileSpy).toHaveBeenCalledWith("/fake/path-1/package.json");

    joinSpy.mockRestore();
    accessSpy.mockRestore();
    bunFileSpy.mockRestore();
  });

  it("falls back to second candidate when first fails", async () => {
    const joinSpy = installJoinToFakePaths();
    const accessSpy = spyOn(fsPromises, "access").mockImplementation(async (path: any) => {
      const p = String(path);
      if (p === "/fake/path-2/package.json") return;
      throw new Error("not found");
    });

    const bunFileSpy = spyOn(Bun, "file").mockImplementation((path: any) => {
      if (String(path) === "/fake/path-2/package.json") {
        return {
          json: mock(async () => ({ name: "pkg-from-path-2", version: "2.0.0" })),
        } as any;
      }
      throw new Error("unexpected path");
    });

    const { getVersionInfo } = await importFreshVersionModule();
    const info = await getVersionInfo();

    expect(info).toEqual({
      name: "pkg-from-path-2",
      version: "2.0.0",
      description: undefined,
    });

    expect(accessSpy).toHaveBeenCalledWith("/fake/path-1/package.json");
    expect(accessSpy).toHaveBeenCalledWith("/fake/path-2/package.json");
    expect(bunFileSpy).toHaveBeenCalledWith("/fake/path-2/package.json");

    joinSpy.mockRestore();
    accessSpy.mockRestore();
    bunFileSpy.mockRestore();
  });

  it("falls back to cwd candidate when first two fail", async () => {
    const joinSpy = installJoinToFakePaths();
    const accessSpy = spyOn(fsPromises, "access").mockImplementation(async (path: any) => {
      const p = String(path);
      if (p === "/fake/path-3/package.json") return;
      throw new Error("not found");
    });

    const bunFileSpy = spyOn(Bun, "file").mockImplementation((path: any) => {
      if (String(path) === "/fake/path-3/package.json") {
        return {
          json: mock(async () => ({
            name: "pkg-from-path-3",
            version: "3.1.4",
            description: "cwd pkg",
          })),
        } as any;
      }
      throw new Error("unexpected path");
    });

    const { getVersionInfo } = await importFreshVersionModule();
    const info = await getVersionInfo();

    expect(info).toEqual({
      name: "pkg-from-path-3",
      version: "3.1.4",
      description: "cwd pkg",
    });

    expect(accessSpy).toHaveBeenCalledWith("/fake/path-1/package.json");
    expect(accessSpy).toHaveBeenCalledWith("/fake/path-2/package.json");
    expect(accessSpy).toHaveBeenCalledWith("/fake/path-3/package.json");
    expect(bunFileSpy).toHaveBeenCalledWith("/fake/path-3/package.json");

    joinSpy.mockRestore();
    accessSpy.mockRestore();
    bunFileSpy.mockRestore();
  });

  it("returns unknown fallback when all candidate paths fail", async () => {
    const joinSpy = installJoinToFakePaths();
    const accessSpy = spyOn(fsPromises, "access").mockImplementation(async () => {
      throw new Error("not found");
    });
    const bunFileSpy = spyOn(Bun, "file");

    const { getVersionInfo } = await importFreshVersionModule();
    const info = await getVersionInfo();

    expect(info).toEqual({
      name: "@dynatrace-oss/opencode-coder",
      version: "unknown",
      description: "OpenCode plugin for story-driven development",
    });
    expect(accessSpy).toHaveBeenCalledTimes(3);
    expect(bunFileSpy).not.toHaveBeenCalled();

    joinSpy.mockRestore();
    accessSpy.mockRestore();
    bunFileSpy.mockRestore();
  });
});
