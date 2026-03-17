import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { isDebugLoggingEnabled, isPluginDisabled } from "../../src/config/env";

describe("Environment Variable Helpers", () => {
  // Store original env values to restore after tests
  let originalDisabled: string | undefined;
  let originalDebug: string | undefined;

  beforeEach(() => {
    // Save original values
    originalDisabled = process.env["OPENCODE_CODER_DISABLED"];
    originalDebug = process.env["OPENCODE_CODER_DEBUG"];

    // Clear env vars before each test
    delete process.env["OPENCODE_CODER_DISABLED"];
    delete process.env["OPENCODE_CODER_DEBUG"];
  });

  afterEach(() => {
    // Restore original values
    if (originalDisabled === undefined) {
      delete process.env["OPENCODE_CODER_DISABLED"];
    } else {
      process.env["OPENCODE_CODER_DISABLED"] = originalDisabled;
    }

    if (originalDebug === undefined) {
      delete process.env["OPENCODE_CODER_DEBUG"];
    } else {
      process.env["OPENCODE_CODER_DEBUG"] = originalDebug;
    }
  });

  describe("isPluginDisabled", () => {
    it("should return false by default when env var is not set", () => {
      expect(isPluginDisabled()).toBe(false);
    });

    it("should return true when OPENCODE_CODER_DISABLED is 'true'", () => {
      process.env["OPENCODE_CODER_DISABLED"] = "true";
      expect(isPluginDisabled()).toBe(true);
    });

    it("should return true when OPENCODE_CODER_DISABLED is 'TRUE' (case-insensitive)", () => {
      process.env["OPENCODE_CODER_DISABLED"] = "TRUE";
      expect(isPluginDisabled()).toBe(true);
    });

    it("should return true when OPENCODE_CODER_DISABLED is 'True' (mixed case)", () => {
      process.env["OPENCODE_CODER_DISABLED"] = "True";
      expect(isPluginDisabled()).toBe(true);
    });

    it("should return false when OPENCODE_CODER_DISABLED is 'false'", () => {
      process.env["OPENCODE_CODER_DISABLED"] = "false";
      expect(isPluginDisabled()).toBe(false);
    });

    it("should return false when OPENCODE_CODER_DISABLED is 'FALSE' (case-insensitive)", () => {
      process.env["OPENCODE_CODER_DISABLED"] = "FALSE";
      expect(isPluginDisabled()).toBe(false);
    });

    it("should return false when OPENCODE_CODER_DISABLED is empty string", () => {
      process.env["OPENCODE_CODER_DISABLED"] = "";
      expect(isPluginDisabled()).toBe(false);
    });

    it("should return false (default) when OPENCODE_CODER_DISABLED is invalid value", () => {
      process.env["OPENCODE_CODER_DISABLED"] = "invalid";
      expect(isPluginDisabled()).toBe(false);
    });

    it("should return false (default) when OPENCODE_CODER_DISABLED is '1'", () => {
      process.env["OPENCODE_CODER_DISABLED"] = "1";
      expect(isPluginDisabled()).toBe(false);
    });

    it("should trim whitespace from OPENCODE_CODER_DISABLED value", () => {
      process.env["OPENCODE_CODER_DISABLED"] = "  true  ";
      expect(isPluginDisabled()).toBe(true);
    });
  });

  describe("isDebugLoggingEnabled", () => {
    it("should return false by default when env var is not set", () => {
      expect(isDebugLoggingEnabled()).toBe(false);
    });

    it("should return true when OPENCODE_CODER_DEBUG is '1'", () => {
      process.env["OPENCODE_CODER_DEBUG"] = "1";
      expect(isDebugLoggingEnabled()).toBe(true);
    });

    it("should return true when OPENCODE_CODER_DEBUG is 'TRUE'", () => {
      process.env["OPENCODE_CODER_DEBUG"] = "TRUE";
      expect(isDebugLoggingEnabled()).toBe(true);
    });

    it("should return false when OPENCODE_CODER_DEBUG is 'false'", () => {
      process.env["OPENCODE_CODER_DEBUG"] = "false";
      expect(isDebugLoggingEnabled()).toBe(false);
    });

    it("should return false when OPENCODE_CODER_DEBUG is '0'", () => {
      process.env["OPENCODE_CODER_DEBUG"] = "0";
      expect(isDebugLoggingEnabled()).toBe(false);
    });

    it("should return true for other non-empty values to preserve compatibility", () => {
      process.env["OPENCODE_CODER_DEBUG"] = "debug";
      expect(isDebugLoggingEnabled()).toBe(true);
    });
  });
});
