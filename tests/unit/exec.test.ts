import { describe, expect, it, mock, spyOn } from "bun:test";
import * as childProcess from "node:child_process";
import {
  getCommandAvailabilityStatus,
  isCommandAvailable,
  isExecTimeoutError,
} from "../../src/core";

describe("core/exec", () => {
  describe("isExecTimeoutError", () => {
    it("returns true for ETIMEDOUT code", () => {
      expect(isExecTimeoutError({ code: "ETIMEDOUT" })).toBe(true);
    });

    it("returns true for killed SIGTERM process", () => {
      expect(isExecTimeoutError({ killed: true, signal: "SIGTERM" })).toBe(true);
      expect(isExecTimeoutError({ killed: true })).toBe(true);
      expect(isExecTimeoutError({ signal: "SIGTERM" })).toBe(true);
    });

    it("returns false for non-timeout and non-object values", () => {
      expect(isExecTimeoutError(new Error("not timeout"))).toBe(false);
      expect(isExecTimeoutError({ code: "ENOENT" })).toBe(false);
      expect(isExecTimeoutError(null)).toBe(false);
      expect(isExecTimeoutError("oops")).toBe(false);
    });
  });

  describe("getCommandAvailabilityStatus + isCommandAvailable", () => {
    const createLogger = () => ({ debug: mock(), warn: mock() });

    it("returns installed and logs success message", () => {
      const logger = createLogger();
      const execSpy = spyOn(childProcess, "execSync").mockReturnValue(Buffer.from("/usr/bin/aimgr") as any);

      const status = getCommandAvailabilityStatus("aimgr", logger, {
        successMessage: "available",
      });

      expect(status).toBe("installed");
      expect(logger.debug).toHaveBeenCalledWith("available");
      expect(execSpy).toHaveBeenCalledWith("command -v aimgr", {
        stdio: "ignore",
        timeout: 5000,
      });

      execSpy.mockRestore();
    });

    it("returns missing and logs missing message", () => {
      const logger = createLogger();
      const execSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        throw Object.assign(new Error("not found"), { code: "ENOENT" });
      });

      const status = getCommandAvailabilityStatus("bd", logger, {
        missingMessage: "missing",
      });

      expect(status).toBe("missing");
      expect(logger.debug).toHaveBeenCalledWith("missing");

      execSpy.mockRestore();
    });

    it("returns timeout and logs warning with context", () => {
      const logger = createLogger();
      const execSpy = spyOn(childProcess, "execSync").mockImplementation(() => {
        throw Object.assign(new Error("timed out"), { killed: true, signal: "SIGTERM" });
      });

      const status = getCommandAvailabilityStatus("aimgr", logger, {
        timeoutMessage: "timed out",
        timeoutMs: 1234,
      });

      expect(status).toBe("timeout");
      expect(logger.warn).toHaveBeenCalledWith("timed out", {
        command: "command -v aimgr",
        timeoutMs: 1234,
      });

      execSpy.mockRestore();
    });

    it("isCommandAvailable returns boolean installed wrapper", () => {
      const logger = createLogger();
      const execSpy = spyOn(childProcess, "execSync")
        .mockReturnValueOnce(Buffer.from("/usr/bin/ok") as any)
        .mockImplementationOnce(() => {
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
        });

      expect(isCommandAvailable("ok", logger)).toBe(true);
      expect(isCommandAvailable("missing", logger)).toBe(false);

      execSpy.mockRestore();
    });
  });

});
