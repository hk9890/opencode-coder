import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createLogger, SERVICE_NAME } from "../../src/core/logger";
import { createMockClient } from "../helpers/mock-client";

describe("createLogger", () => {
  let tempDir: string;
  let originalDebugEnv: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "opencode-coder-logger-"));
    originalDebugEnv = process.env["OPENCODE_CODER_DEBUG"];
    delete process.env["OPENCODE_CODER_DEBUG"];
  });

  afterEach(() => {
    if (originalDebugEnv === undefined) {
      delete process.env["OPENCODE_CODER_DEBUG"];
    } else {
      process.env["OPENCODE_CODER_DEBUG"] = originalDebugEnv;
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes info logs to OpenCode and daily project log file", () => {
    const client = createMockClient();
    const logger = createLogger(client as any, tempDir);
    logger.enableFileLogging();

    logger.info("plugin ready", { requestId: "abc-123" });

    expect(client.app.logs).toHaveLength(1);
    expect(client.app.logs[0]).toMatchObject({
      service: SERVICE_NAME,
      level: "info",
      message: "plugin ready",
      extra: { requestId: "abc-123" },
    });

    const today = new Date().toISOString().slice(0, 10);
    const logPath = join(tempDir, ".coder", "logs", `coder-${today}.log`);
    const line = readFileSync(logPath, "utf8").trim();

    expect(line).toContain("INFO");
    expect(line).toContain(`[${SERVICE_NAME}]`);
    expect(line).toContain("(pid=");
    expect(line).toContain("plugin ready");
    expect(line).toContain('extra={"requestId":"abc-123"}');
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not emit debug logs when OPENCODE_CODER_DEBUG is unset", () => {
    const client = createMockClient();
    const logger = createLogger(client as any, tempDir);
    logger.enableFileLogging();

    logger.debug("hidden debug");

    expect(client.app.logs).toHaveLength(0);
    const today = new Date().toISOString().slice(0, 10);
    const logPath = join(tempDir, ".coder", "logs", `coder-${today}.log`);
    expect(() => readFileSync(logPath, "utf8")).toThrow();
  });

  it("emits debug logs to both sinks when OPENCODE_CODER_DEBUG is enabled", () => {
    process.env["OPENCODE_CODER_DEBUG"] = "1";
    const client = createMockClient();
    const logger = createLogger(client as any, tempDir);
    logger.enableFileLogging();

    logger.debug("visible debug", { mode: "startup" });

    expect(client.app.logs).toHaveLength(1);
    expect(client.app.logs[0]).toMatchObject({
      service: SERVICE_NAME,
      // Existing behavior: debug is sent as info to OpenCode
      level: "info",
      message: "visible debug",
    });

    const today = new Date().toISOString().slice(0, 10);
    const logPath = join(tempDir, ".coder", "logs", `coder-${today}.log`);
    const line = readFileSync(logPath, "utf8").trim();
    expect(line).toContain("DEBUG");
    expect(line).toContain('extra={"mode":"startup"}');
  });

  it("does not emit debug logs when OPENCODE_CODER_DEBUG is explicitly false", () => {
    process.env["OPENCODE_CODER_DEBUG"] = "false";
    const client = createMockClient();
    const logger = createLogger(client as any, tempDir);
    logger.enableFileLogging();

    logger.debug("hidden debug");

    expect(client.app.logs).toHaveLength(0);
  });

  it("prunes files older than 7 days using filename date", () => {
    const logsDir = join(tempDir, ".coder", "logs");
    mkdirSync(logsDir, { recursive: true });

    const oldDate = new Date();
    oldDate.setUTCDate(oldDate.getUTCDate() - 8);
    const keepDate = new Date();
    keepDate.setUTCDate(keepDate.getUTCDate() - 7);

    const oldName = `coder-${oldDate.toISOString().slice(0, 10)}.log`;
    const keepName = `coder-${keepDate.toISOString().slice(0, 10)}.log`;
    const invalidName = "coder-not-a-date.log";

    writeFileSync(join(logsDir, oldName), "old\n");
    writeFileSync(join(logsDir, keepName), "keep\n");
    writeFileSync(join(logsDir, invalidName), "invalid\n");

    const client = createMockClient();
    const logger = createLogger(client as any, tempDir);
    logger.enableFileLogging();

    expect(() => readFileSync(join(logsDir, oldName), "utf8")).toThrow();
    expect(readFileSync(join(logsDir, keepName), "utf8")).toContain("keep");
    expect(readFileSync(join(logsDir, invalidName), "utf8")).toContain("invalid");
  });

  it("does not crash on startup when retention fails", () => {
    const coderDir = join(tempDir, ".coder");
    mkdirSync(coderDir, { recursive: true });
    writeFileSync(join(coderDir, "logs"), "not-a-directory");

    const client = createMockClient();
    const logger = createLogger(client as any, tempDir);

    expect(() => logger.enableFileLogging()).not.toThrow();
  });

  it("keeps startup diagnostics in OpenCode sink before file logging is enabled", () => {
    const client = createMockClient();
    const logger = createLogger(client as any, tempDir);

    logger.info("startup diagnostic");

    expect(client.app.logs).toHaveLength(1);
    expect(client.app.logs[0]).toMatchObject({
      service: SERVICE_NAME,
      level: "info",
      message: "startup diagnostic",
    });

    const today = new Date().toISOString().slice(0, 10);
    const logPath = join(tempDir, ".coder", "logs", `coder-${today}.log`);
    expect(() => readFileSync(logPath, "utf8")).toThrow();
  });

  it("replays buffered startup logs in order when file logging is enabled", () => {
    const client = createMockClient();
    const logger = createLogger(client as any, tempDir);

    logger.info("startup one");
    logger.warn("startup two");

    const today = new Date().toISOString().slice(0, 10);
    const logPath = join(tempDir, ".coder", "logs", `coder-${today}.log`);
    expect(() => readFileSync(logPath, "utf8")).toThrow();

    logger.enableFileLogging();
    logger.error("startup three");

    const lines = readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("INFO");
    expect(lines[0]).toContain("startup one");
    expect(lines[1]).toContain("WARN");
    expect(lines[1]).toContain("startup two");
    expect(lines[2]).toContain("ERROR");
    expect(lines[2]).toContain("startup three");
  });
});
