import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk";
import { describe, expect, it } from "bun:test";
import { cp, mkdir, readFile, rm } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  checkAimgrAvailability,
  checkOpencodeAvailability,
  cleanupFixtureWorkspace,
  createFixtureWorkspace,
  createIsolatedOpenCodePaths,
  formatElapsed,
  findAvailablePort,
  readIfExists,
  resolveCopilotAuthSeedFromEnv,
  runOpencodeCli,
  seedIsolatedOpenCodeAuth,
  startProgressHeartbeat,
  withEnvironment,
  wireBuiltPluginArtifact,
  writeFailureArtifacts,
} from "./helpers/harness";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const ARTIFACT_DIR = join(PROJECT_ROOT, "tests", "e2e", ".artifacts");
const AI_RESOURCES_DIR = join(PROJECT_ROOT, "ai-resources");

const opencodeCheck = await checkOpencodeAvailability();
if (!opencodeCheck.available && opencodeCheck.diagnostics) {
  console.warn("\n" + opencodeCheck.diagnostics + "\n");
}

const aimgrCheck = await checkAimgrAvailability();
if (!aimgrCheck.available && aimgrCheck.diagnostics) {
  console.warn("\n" + aimgrCheck.diagnostics + "\n");
}

async function withScenarioLogging<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  console.error(`[e2e] START ${name} @ ${new Date(startedAt).toISOString()}`);

  try {
    const result = await fn();
    console.error(`[e2e] PASS  ${name} after ${formatElapsed(Date.now() - startedAt)}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[e2e] FAIL  ${name} after ${formatElapsed(Date.now() - startedAt)}: ${message}`);
    throw error;
  }
}

async function runLoggedOpencodeCli(
  scenarioName: string,
  args: string[],
  options: Parameters<typeof runOpencodeCli>[1]
) {
  const command = `opencode ${args.join(" ")}`;
  const startedAt = Date.now();
  console.error(
    `[e2e] ${scenarioName}: running ${command} (timeout ${(options.timeoutMs ?? 30000).toString()}ms)`
  );

  const result = await runOpencodeCli(args, {
    ...options,
    progressLabel: `${scenarioName}: opencode cli`,
  });
  const status = result.timedOut ? "timed out" : `exit ${result.exitCode.toString()}`;
  console.error(`[e2e] ${scenarioName}: ${status} after ${formatElapsed(Date.now() - startedAt)}`);
  return result;
}

describe.skipIf(!opencodeCheck.available)("OpencodeCoder E2E Tests", () => {
  const countMatches = (items: string[], value: string): number => items.filter((item) => item === value).length;
  const DOCS_LIFECYCLE_COMMANDS = ["opencode-coder/init-or-update-docs", "opencode-coder/improve-doc"] as const;
  const LEGACY_DOCS_COMMAND = "opencode-coder/update-agent-md";
  const COPILOT_MODEL_ENV = "E2E_COPILOT_MODEL";
  const DEFAULT_COPILOT_MODEL = "github-copilot/gpt-5.3-codex";

  const expectDocsLifecycleCommands = (commandNames: string[]) => {
    for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
      expect(commandNames).toContain(commandName);
    }
    expect(commandNames).not.toContain(LEGACY_DOCS_COMMAND);
  };

  const expectNoDocsLifecycleCommands = (commandNames: string[]) => {
    for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
      expect(commandNames).not.toContain(commandName);
    }
    expect(commandNames).not.toContain(LEGACY_DOCS_COMMAND);
  };

  const getPluginSignalsViaRealServer = async (workspaceDir: string, isolatedEnv: Record<string, string>) => {
    const progress = startProgressHeartbeat({
      label: "real-server probe",
      details: `workspace ${workspaceDir}`,
    });
    let server: Awaited<ReturnType<typeof createOpencodeServer>> | undefined;
    let completed = false;

    try {
      const port = await findAvailablePort();
      server = await withEnvironment(isolatedEnv, () =>
        createOpencodeServer({
          hostname: "127.0.0.1",
          port,
          timeout: 30000,
          config: {
            autoupdate: false,
            snapshot: false,
          },
        })
      );

      const client = createOpencodeClient({
        baseUrl: server.url,
        responseStyle: "data",
        throwOnError: true,
      });

      const toolIdsResult = await client.tool.ids({ query: { directory: workspaceDir } });
      const commandListResult = await client.command.list({ query: { directory: workspaceDir } });

      const toolIds = "data" in toolIdsResult ? toolIdsResult.data : toolIdsResult;
      const commands = "data" in commandListResult ? commandListResult.data : commandListResult;

      if (!Array.isArray(toolIds) || !Array.isArray(commands)) {
        throw new Error("Failed to query tool IDs or command list from real-server startup path");
      }

      completed = true;
      return {
        toolIds,
        commandNames: commands.map((command) => command.name),
      };
    } finally {
      progress.stop(completed ? "done" : "failed");
      server?.close();
    }
  };

  const seedManualPhase2Resources = async (workspaceDir: string) => {
    const commandsRootDir = join(workspaceDir, ".opencode", "commands");
    const skillsRootDir = join(workspaceDir, ".opencode", "skills");

    await mkdir(commandsRootDir, { recursive: true });
    await mkdir(skillsRootDir, { recursive: true });

    const commandsTargetDir = join(commandsRootDir, "opencode-coder");
    const skillTargetDir = join(skillsRootDir, "opencode-coder");
    await rm(commandsTargetDir, { recursive: true, force: true });
    await rm(skillTargetDir, { recursive: true, force: true });

    await cp(join(AI_RESOURCES_DIR, "commands", "opencode-coder"), commandsTargetDir, { recursive: true });
    await cp(join(AI_RESOURCES_DIR, "skills", "opencode-coder"), skillTargetDir, { recursive: true });
  };

  describe("real startup scenario coverage", () => {
    it("scenario 1: should load once in existing real-server startup path", async () => {
      await withScenarioLogging("scenario 1", async () => {
        const workspace = await createFixtureWorkspace("existing-active-project");
        try {
          await wireBuiltPluginArtifact(PROJECT_ROOT, workspace.workdir);
          const isolatedPaths = await createIsolatedOpenCodePaths(workspace.tempRoot);

          const pluginSignals = await getPluginSignalsViaRealServer(workspace.workdir, isolatedPaths.env);

          expect(countMatches(pluginSignals.toolIds, "coder")).toBe(1);
          expect(pluginSignals.commandNames).toContain("opencode-coder/init");
          expectNoDocsLifecycleCommands(pluginSignals.commandNames);

          const projectYamlAfter = await readFile(join(workspace.workdir, ".coder", "project.yaml"), "utf8");
          expect(projectYamlAfter).toContain("pluginVersion:");
          expect(projectYamlAfter).not.toContain("pluginVersion: fixture");

          const isolatedDb = Bun.file(join(isolatedPaths.xdgDataHome, "opencode", "opencode.db"));
          expect(await isolatedDb.exists()).toBe(true);
        } catch (error) {
          const artifactPath = await writeFailureArtifacts({
            artifactDir: ARTIFACT_DIR,
            testName: "scenario-1-existing-real-server-startup",
            notes: `Failed while querying real-server startup path.\n${String(error)}`,
          });
          throw new Error(`Scenario 1 failed. Artifacts: ${artifactPath}`);
        } finally {
          await cleanupFixtureWorkspace(workspace);
        }
      });
    }, 120000);

    it("scenario 2: should run CLI smoke startup path via opencode run equivalent", async () => {
      await withScenarioLogging("scenario 2", async () => {
        const workspace = await createFixtureWorkspace("cli-smoke-project");
        try {
          await mkdir(join(workspace.workdir, ".coder"), { recursive: true });
          await Bun.write(join(workspace.workdir, ".coder", "opencode-coder.yaml"), "mode: team\n");

          await wireBuiltPluginArtifact(PROJECT_ROOT, workspace.workdir);
          const isolatedPaths = await createIsolatedOpenCodePaths(workspace.tempRoot);

          const result = await runLoggedOpencodeCli("scenario 2", ["run", "--command", "pwd", "--format", "json"], {
            cwd: workspace.workdir,
            env: isolatedPaths.env,
            timeoutMs: 120000,
          });

          if (result.exitCode !== 0 || result.timedOut) {
            const artifactPath = await writeFailureArtifacts({
              artifactDir: ARTIFACT_DIR,
              testName: "scenario-2-cli-smoke-run-pwd",
              command: result.command,
              stdout: result.stdout,
              stderr: result.stderr,
              notes: result.timedOut ? "CLI smoke command timed out" : "CLI smoke command failed",
              isolationPaths: isolatedPaths,
            });

            throw new Error(`CLI smoke command failed. Artifacts: ${artifactPath}`);
          }

          const projectYamlAfter = await readFile(join(workspace.workdir, ".coder", "project.yaml"), "utf8");
          const pluginSignals = await getPluginSignalsViaRealServer(workspace.workdir, isolatedPaths.env);

          expect(result.exitCode).toBe(0);
          expect(result.timedOut).toBe(false);
          expect(projectYamlAfter).toContain("pluginVersion:");
          expect(countMatches(pluginSignals.toolIds, "coder")).toBe(1);

          const gitHead = await readFile(join(workspace.workdir, ".git", "HEAD"), "utf8");
          expect(gitHead.length).toBeGreaterThan(0);

          const isolatedDb = Bun.file(join(isolatedPaths.xdgDataHome, "opencode", "opencode.db"));
          expect(await isolatedDb.exists()).toBe(true);
        } finally {
          await cleanupFixtureWorkspace(workspace);
        }
      });
    }, 120000);

    it("scenario 3: should keep local-startup parity on real CLI entrypoint", async () => {
      await withScenarioLogging("scenario 3", async () => {
        const workspace = await createFixtureWorkspace("local-startup-parity-project");
        try {
          await seedManualPhase2Resources(workspace.workdir);
          await rm(join(workspace.workdir, "ai.package.yaml"), { force: true });

          await wireBuiltPluginArtifact(PROJECT_ROOT, workspace.workdir);
          const isolatedPaths = await createIsolatedOpenCodePaths(workspace.tempRoot);

          const result = await runLoggedOpencodeCli("scenario 3", ["run", "--command", "pwd", "--format", "json"], {
            cwd: workspace.workdir,
            env: isolatedPaths.env,
            timeoutMs: 120000,
          });

          if (result.exitCode !== 0 || result.timedOut) {
            const artifactPath = await writeFailureArtifacts({
              artifactDir: ARTIFACT_DIR,
              testName: "scenario-3-local-startup-parity",
              command: result.command,
              stdout: result.stdout,
              stderr: result.stderr,
              notes: result.timedOut ? "Local parity command timed out" : "Local parity command failed",
              isolationPaths: isolatedPaths,
            });

            throw new Error(`Local startup parity command failed. Artifacts: ${artifactPath}`);
          }

          const projectYamlAfter = await readFile(join(workspace.workdir, ".coder", "project.yaml"), "utf8");
          const pluginSignals = await getPluginSignalsViaRealServer(workspace.workdir, isolatedPaths.env);

          expect(result.exitCode).toBe(0);
          expect(projectYamlAfter).toContain("mode: stealth");
          expect(projectYamlAfter).toContain("pluginVersion:");
          expect(countMatches(pluginSignals.toolIds, "coder")).toBe(1);
          expectDocsLifecycleCommands(pluginSignals.commandNames);

          const today = new Date().toISOString().slice(0, 10);
          const startupLog = await readIfExists(join(workspace.workdir, ".coder", "logs", `coder-${today}.log`));
          expect(startupLog).toContain("Runtime phase already normal from required resource surfaces; skipping startup bootstrap");
          expect(startupLog).not.toContain("Running aimgr init");
        } finally {
          await cleanupFixtureWorkspace(workspace);
        }
      });
    }, 120000);

    it("scenario 4: should keep fresh project inactive and expose init behavior only", async () => {
      await withScenarioLogging("scenario 4", async () => {
        const workspace = await createFixtureWorkspace("fresh-inactive-project");
        try {
          await wireBuiltPluginArtifact(PROJECT_ROOT, workspace.workdir);
          const isolatedPaths = await createIsolatedOpenCodePaths(workspace.tempRoot);

          const result = await runLoggedOpencodeCli("scenario 4", ["run", "--command", "pwd", "--format", "json"], {
            cwd: workspace.workdir,
            env: isolatedPaths.env,
            timeoutMs: 120000,
          });

          if (result.exitCode !== 0 || result.timedOut) {
            const artifactPath = await writeFailureArtifacts({
              artifactDir: ARTIFACT_DIR,
              testName: "scenario-4-fresh-inactive-startup",
              command: result.command,
              stdout: result.stdout,
              stderr: result.stderr,
              notes: result.timedOut ? "Fresh inactive command timed out" : "Fresh inactive command failed",
              isolationPaths: isolatedPaths,
            });

            throw new Error(`Fresh inactive startup command failed. Artifacts: ${artifactPath}`);
          }

          const projectYamlAfter = await readIfExists(join(workspace.workdir, ".coder", "project.yaml"));
          const pluginSignals = await getPluginSignalsViaRealServer(workspace.workdir, isolatedPaths.env);

          expect(projectYamlAfter).toBeUndefined();
          expect(countMatches(pluginSignals.toolIds, "coder")).toBe(0);
          expect(pluginSignals.commandNames).toContain("opencode-coder/init");
          expectNoDocsLifecycleCommands(pluginSignals.commandNames);
        } finally {
          await cleanupFixtureWorkspace(workspace);
        }
      });
    }, 120000);

    const copilotAuthSeed = resolveCopilotAuthSeedFromEnv();

    it.skipIf(!copilotAuthSeed)(
      "scenario 5 (optional): should support isolated GitHub Copilot auth-seeded LLM-backed CLI run",
      async () => {
        await withScenarioLogging("scenario 5 (optional)", async () => {
          const workspace = await createFixtureWorkspace("cli-smoke-project");
          try {
            await mkdir(join(workspace.workdir, ".coder"), { recursive: true });
            await Bun.write(join(workspace.workdir, ".coder", "opencode-coder.yaml"), "mode: team\n");

            await wireBuiltPluginArtifact(PROJECT_ROOT, workspace.workdir);
            const isolatedPaths = await createIsolatedOpenCodePaths(workspace.tempRoot);

            if (!copilotAuthSeed) {
              throw new Error("Missing copilot auth seed after skip guard");
            }

            const model = process.env[COPILOT_MODEL_ENV] ?? DEFAULT_COPILOT_MODEL;

            const seededAuthPath = await seedIsolatedOpenCodeAuth(isolatedPaths, copilotAuthSeed.seed);

            const llmConfig = {
              model,
              autoupdate: false,
              snapshot: false,
              enabled_providers: ["github-copilot"],
            };

            const result = await runLoggedOpencodeCli(
              "scenario 5 (optional)",
              ["run", "Respond with exactly E2E_LLM_OK and nothing else.", "--format", "default"],
              {
                cwd: workspace.workdir,
                env: {
                  ...isolatedPaths.env,
                  OPENCODE_CONFIG_CONTENT: JSON.stringify(llmConfig),
                },
                timeoutMs: 180000,
              }
            );

            if (result.exitCode !== 0 || result.timedOut) {
              const artifactPath = await writeFailureArtifacts({
                artifactDir: ARTIFACT_DIR,
                testName: "scenario-5-llm-backed-isolated-run",
                command: result.command,
                stdout: result.stdout,
                stderr: result.stderr,
                notes: result.timedOut
                  ? "LLM-backed command timed out"
                  : `LLM-backed command failed for model ${model} using isolated auth seed source ${copilotAuthSeed.source} at ${seededAuthPath}`,
                isolationPaths: isolatedPaths,
              });

              throw new Error(`LLM-backed isolated run failed. Artifacts: ${artifactPath}`);
            }

            const pluginSignals = await getPluginSignalsViaRealServer(workspace.workdir, isolatedPaths.env);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("E2E_LLM_OK");
            expect(result.stderr).not.toContain("No providers configured");
            expect(result.stderr).not.toContain("opencode providers");
            expect(countMatches(pluginSignals.toolIds, "coder")).toBe(1);
          } finally {
            await cleanupFixtureWorkspace(workspace);
          }
        });
      },
      180000
    );
  });
});
