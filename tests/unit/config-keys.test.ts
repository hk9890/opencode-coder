import { describe, expect, it } from "bun:test";
import { normalizeConfigKey } from "../../src/config/keys";

describe("normalizeConfigKey", () => {
  it("returns an empty string for empty input", () => {
    expect(normalizeConfigKey("")).toBe("");
    expect(normalizeConfigKey("   ")).toBe("");
  });

  it("normalizes camelCase keys", () => {
    expect(normalizeConfigKey("defaultAgent")).toBe("default_agent");
    expect(normalizeConfigKey("http2Port")).toBe("http2_port");
  });

  it("normalizes acronym boundaries", () => {
    expect(normalizeConfigKey("APIKey")).toBe("api_key");
    expect(normalizeConfigKey("userID")).toBe("user_id");
  });

  it("normalizes mixed separators and casing", () => {
    expect(normalizeConfigKey(" default-agent ")).toBe("default_agent");
    expect(normalizeConfigKey("DEFAULT AGENT")).toBe("default_agent");
    expect(normalizeConfigKey("default.agent")).toBe("default_agent");
  });

  it("collapses repeated separators and trims punctuation", () => {
    expect(normalizeConfigKey("__default---agent__")).toBe("default_agent");
    expect(normalizeConfigKey("...default///agent...")).toBe("default_agent");
  });
});
