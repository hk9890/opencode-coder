import { describe, expect, it } from "bun:test";
import { hasResourceIssues } from "../../../src/service/aimgr-service";
import { interpretAimgrVerifyHealth } from "../../../src/service/aimgr-health";

describe("service/aimgr-service hasResourceIssues", () => {
  it("returns true for invalid results", () => {
    expect(hasResourceIssues(null)).toBe(true);
    expect(hasResourceIssues(undefined)).toBe(true);
    expect(hasResourceIssues("bad")).toBe(true);
  });

  it("returns true when issues/errors arrays are populated", () => {
    expect(hasResourceIssues({ issues: [{ id: 1 }] })).toBe(true);
    expect(hasResourceIssues({ errors: ["boom"] })).toBe(true);
  });

  it("returns true when error string exists or status is unhealthy", () => {
    expect(hasResourceIssues({ error: "failed" })).toBe(true);
    expect(hasResourceIssues({ status: "degraded" })).toBe(true);
    expect(hasResourceIssues({ status: "broken" })).toBe(true);
  });

  it("returns false for clean healthy payloads", () => {
    expect(hasResourceIssues({ status: "ok", issues: [], errors: [] })).toBe(false);
    expect(hasResourceIssues({ status: "healthy", issues: [], errors: [], error: "" })).toBe(false);
    expect(hasResourceIssues({ issues: [], errors: [] })).toBe(false);
  });

  it("uses typed verify health interpretation as source of truth", () => {
    const payload = { status: "degraded", issues: [{ id: "missing" }] };
    expect(hasResourceIssues(payload)).toBe(interpretAimgrVerifyHealth(payload).hasIssues);
  });
});
