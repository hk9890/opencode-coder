import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk";
import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "fs/promises";
import { createServer } from "net";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildInteractiveShellCommand,
  ensureInteractiveShellStartupReady,
  parseArgs,
  shouldActivateWizard,
} from "../../scripts/manual-test/index";
import {
  OPENCODE_DYNATRACE_PACKAGE_NAME,
  checkOpencodeAvailability,
  createFixtureWorkspace,
  createIsolatedOpenCodePaths,
  createIsolatedOpenCodePathsWithPluginSource,
  prepareWorkspacePluginSource,
  readIsolatedTestManifest,
  resolveHostOpenCodeConfigPath,
  resolveInstalledConfiguredPluginFromHostConfig,
  withEnvironment,
} from "../e2e/helpers/harness";
import { createStartupState, resolveStartupState } from "../../src/core/startup-state";
import { ProjectDetectorService } from "../../src/service";
import { createMockLogger } from "../helpers/mock-logger";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const DYNATRACE_PLUGIN_SPEC = `${OPENCODE_DYNATRACE_PACKAGE_NAME}@0.6.0`;

function buildLauncherTestEnv(extraEnv: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
  };

  for (const key of ["USER", "LOGNAME", "LANG"] as const) {
    const value = process.env[key];
    if (value && value.length > 0) {
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("LC_") && value && value.length > 0) {
      env[key] = value;
    }
  }

  return {
    ...env,
    ...extraEnv,
  };
}

async function runLauncher(
  args: string[],
  extraEnv: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    // Use the current Bun executable explicitly; bare "bun" fails under restricted PATH.
    cmd: [process.execPath, "run", "scripts/manual-test/index.ts", "--", ...args],
    cwd: PROJECT_ROOT,
    env: buildLauncherTestEnv(extraEnv),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode, stdout, stderr };
}

const opencodeCheck = await checkOpencodeAvailability();
if (opencodeCheck.resolvedBinDir) {
  process.env.PATH = [opencodeCheck.resolvedBinDir, process.env.PATH ?? ""]
    .filter((entry) => entry && entry.length > 0)
    .join(":");
}
const privateTestsEnabled = process.env.OPENCODE_CODER_PRIVATE_TESTS === "true";

async function checkBdAvailability(): Promise<boolean> {
  try {
    const proc = Bun.spawn({
      cmd: ["bd", "version"],
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}

const bdAvailable = await checkBdAvailability();

async function getLauncherPreparedEnv(stdout: string): Promise<Record<string, string>> {
  const preservedMatch = stdout.match(/Environment preserved at: (.+)\n?/);
  const preservedRoot = preservedMatch?.[1]?.trim();
  if (!preservedRoot) {
    throw new Error("Launcher output did not include preserved environment path");
  }

  const isolatedRoot = join(preservedRoot, "isolated-opencode");
  return {
    HOME: join(isolatedRoot, "home"),
    XDG_CONFIG_HOME: join(isolatedRoot, "xdg-config"),
    XDG_DATA_HOME: join(isolatedRoot, "xdg-data"),
    XDG_CACHE_HOME: join(isolatedRoot, "xdg-cache"),
    OPENCODE_CONFIG_DIR: join(isolatedRoot, "opencode-config"),
    OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
  };
}

async function proveLauncherStartupViability(workdir: string, launcherEnv: Record<string, string>) {
  const server = await withEnvironment(launcherEnv, () =>
    createOpencodeServer({
      hostname: "127.0.0.1",
      port: 0,
      timeout: 30000,
      config: {
        autoupdate: false,
        snapshot: false,
      },
    })
  );

  try {
    const url = new URL(server.url);
    expect(url.hostname).toBe("127.0.0.1");
    expect(Number(url.port)).toBeGreaterThan(0);

    const client = createOpencodeClient({
      baseUrl: server.url,
      responseStyle: "data",
      throwOnError: true,
    });
    const commandListResult = await client.command.list({ query: { directory: workdir } });
    const commandList = "data" in commandListResult ? commandListResult.data : commandListResult;
    expect(Array.isArray(commandList)).toBe(true);
  } finally {
    server.close();
  }
}

function getPreservedRoot(stdout: string): string {
  const preservedMatch = stdout.match(/Environment preserved at: (.+)\n?/);
  const preservedRoot = preservedMatch?.[1]?.trim();
  if (!preservedRoot) {
    throw new Error("Launcher output did not include preserved environment path");
  }
  return preservedRoot;
}

async function expectNoRuntimeScaffolding(workdir: string): Promise<void> {
  const readme = Bun.file(join(workdir, "README.md"));
  const rootGitkeep = Bun.file(join(workdir, ".gitkeep"));
  const opencodeGitkeep = Bun.file(join(workdir, ".opencode", ".gitkeep"));
  const beadsGitkeep = Bun.file(join(workdir, ".beads", ".gitkeep"));

  expect(await readme.exists()).toBe(false);
  expect(await rootGitkeep.exists()).toBe(false);
  expect(await opencodeGitkeep.exists()).toBe(false);
  expect(await beadsGitkeep.exists()).toBe(false);
}

async function assertRuntimeReadinessFromWorkspace(
  workdir: string,
  stage: "coder-skill-installed" | "beads-initialized"
): Promise<void> {
  const logger = createMockLogger();
  const detector = new ProjectDetectorService({ logger, workdir });
  const facts = detector.collectFacts();
  const context = detector.assembleContext({
    startupMode: "team",
    versionInfo: {
      name: "@dynatrace-oss/opencode-coder",
      version: "integration-test",
    },
    facts,
  });
  detector.writeProjectContext(context);

  const startup = createStartupState({
    startupMode: {
      mode: "team",
      source: "saved",
      stateFilePath: join(workdir, ".coder", "opencode-coder.yaml"),
    },
    runtimeCapability: context.runtimePhase,
  });
  const resolved = resolveStartupState({ startup, projectContext: context, timedOut: false });

  const projectYamlPath = join(workdir, ".coder", "project.yaml");
  const projectYaml = await readFile(projectYamlPath, "utf8");
  expect(projectYaml).toContain("mode: team");
  expect(projectYaml).toContain("pluginVersion: integration-test");

  if (stage === "coder-skill-installed") {
    expect(facts.runtimePhase.phase).toBe("normal");
    expect(facts.coderBeadsSkillAvailable).toBe(false);
    expect(facts.orchestratorAgentAvailable).toBe(false);
    expect(facts.beadsInitialized).toBe(false);
    expect(facts.beadsReady).toBe(false);
    expect(resolved.defaultAgentDecision).toBe("beads-not-ready");
    expect(resolved.shouldSetDefaultAgent).toBe(false);
    expect(projectYaml).toContain("beadsReady: false");
    expect(projectYaml).toContain("coderBeadsSkillAvailable: false");
    expect(projectYaml).toContain("orchestratorAgentAvailable: false");
    return;
  }

  expect(facts.runtimePhase.phase).toBe("normal");
  expect(facts.coderBeadsSkillAvailable).toBe(true);
  expect(facts.orchestratorAgentAvailable).toBe(true);
  expect(facts.beadsInitialized).toBe(true);
  expect(facts.beadsReady).toBe(true);
  expect(resolved.defaultAgentDecision).toBe("set-orchestrator");
  expect(resolved.shouldSetDefaultAgent).toBe(true);
  expect(projectYaml).toContain("beadsReady: true");
  expect(projectYaml).toContain("coderBeadsSkillAvailable: true");
  expect(projectYaml).toContain("orchestratorAgentAvailable: true");
}

describe("manual launcher preflight", () => {
  it("seeds isolated .zshrc for zsh shell mode in empty HOME", async () => {
    const tempHome = await mkdtemp(join(tmpdir(), "opencode-coder-zsh-home-"));

    try {
      const zshrcPath = join(tempHome, ".zshrc");
      await ensureInteractiveShellStartupReady("/bin/zsh", { HOME: tempHome });

      const seededFile = Bun.file(zshrcPath);
      expect(await seededFile.exists()).toBe(true);
      expect(await seededFile.text()).toContain("Generated by opencode-coder manual launcher");
    } finally {
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it("does not overwrite existing .zshrc during zsh shell setup", async () => {
    const tempHome = await mkdtemp(join(tmpdir(), "opencode-coder-zsh-home-existing-"));

    try {
      const zshrcPath = join(tempHome, ".zshrc");
      await writeFile(zshrcPath, "# existing zshrc\n", "utf8");

      await ensureInteractiveShellStartupReady("/bin/zsh", { HOME: tempHome });
      const finalContent = await readFile(zshrcPath, "utf8");
      expect(finalContent).toBe("# existing zshrc\n");
    } finally {
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it("does not create zsh startup files for non-zsh shells", async () => {
    const tempHome = await mkdtemp(join(tmpdir(), "opencode-coder-sh-home-"));

    try {
      const zshrcPath = join(tempHome, ".zshrc");
      await ensureInteractiveShellStartupReady("/bin/bash", { HOME: tempHome });

      const seededFile = Bun.file(zshrcPath);
      expect(await seededFile.exists()).toBe(false);
    } finally {
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it("uses interactive flags for common shells", () => {
    expect(buildInteractiveShellCommand("/bin/zsh")).toEqual(["/bin/zsh", "-i"]);
    expect(buildInteractiveShellCommand("/bin/bash")).toEqual(["/bin/bash", "-i"]);
    expect(buildInteractiveShellCommand("/bin/sh")).toEqual(["/bin/sh", "-i"]);
    expect(buildInteractiveShellCommand("/usr/bin/fish")).toEqual(["/usr/bin/fish", "-i"]);
  });

  it("does not add shell flags for unknown shells", () => {
    expect(buildInteractiveShellCommand("/usr/bin/custom-shell")).toEqual(["/usr/bin/custom-shell"]);
  });

  it("activates wizard only when project source and mode are both implicit", () => {
    const implicit = parseArgs([]);
    expect(shouldActivateWizard(implicit)).toBe(true);

    const explicitFixture = parseArgs(["--fixture=empty-project"]);
    expect(shouldActivateWizard(explicitFixture)).toBe(false);

    const explicitProjectPath = parseArgs(["--project-path", "/tmp"]);
    expect(shouldActivateWizard(explicitProjectPath)).toBe(false);

    const explicitMode = parseArgs(["--mode=shell"]);
    expect(shouldActivateWizard(explicitMode)).toBe(false);
  });

  it("fails clearly in non-tty contexts without explicit source and mode", async () => {
    const result = await runLauncher([]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Usage error: no project source or mode specified in non-interactive context");
    expect(result.stderr).toContain("Run with --help for usage.");
  });

  it("runs command mode with stripped runtime/npm/auth env unless explicitly seeded", async () => {
    const result = await runLauncher(["--mode=command", "--fixture=empty-project", "--", "env"], {
      HOME: "/tmp/opencode-coder-host-home-canary",
      XDG_CONFIG_HOME: "/tmp/opencode-coder-host-xdg-config-canary",
      XDG_DATA_HOME: "/tmp/opencode-coder-host-xdg-data-canary",
      XDG_CACHE_HOME: "/tmp/opencode-coder-host-xdg-cache-canary",
      OPENCODE_DEFAULT_OPTIONS: "--log-level DEBUG",
      NPM_CONFIG_USERCONFIG: "/tmp/opencode-coder-host-npmrc-canary",
      npm_config_registry: "https://registry.example.invalid",
      NODE_AUTH_TOKEN: "host-token-should-not-leak",
      BUN_INSTALL: "/tmp/opencode-coder-host-bun-install-canary",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("HOME=");
    expect(result.stdout).toContain("XDG_CONFIG_HOME=");
    expect(result.stdout).toContain("XDG_DATA_HOME=");
    expect(result.stdout).toContain("XDG_CACHE_HOME=");
    expect(result.stdout).toContain("OPENCODE_CONFIG_DIR=");
    expect(result.stdout).not.toContain("HOME=/tmp/opencode-coder-host-home-canary");
    expect(result.stdout).not.toContain("XDG_CONFIG_HOME=/tmp/opencode-coder-host-xdg-config-canary");
    expect(result.stdout).not.toContain("XDG_DATA_HOME=/tmp/opencode-coder-host-xdg-data-canary");
    expect(result.stdout).not.toContain("XDG_CACHE_HOME=/tmp/opencode-coder-host-xdg-cache-canary");
    expect(result.stdout).not.toContain("OPENCODE_DEFAULT_OPTIONS=");
    expect(result.stdout).not.toContain("NPM_CONFIG_USERCONFIG=");
    expect(result.stdout).not.toContain("npm_config_registry=");
    expect(result.stdout).not.toContain("NODE_AUTH_TOKEN=");
    expect(result.stdout).not.toContain("BUN_INSTALL=");
  });

  it("prints help with command-mode launcher usage and manual boundary notes", async () => {
    const result = await runLauncher(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("bun run test:manual -- --mode=command --fixture=empty-project -- env");
    expect(result.stdout).toContain("beads-initialized");
    expect(result.stdout).toContain(
      "empty-project — runtime baseline: no README/.gitkeep scaffolding, no .coder state, and no seeded project-local .opencode resources"
    );
    expect(result.stdout).toContain(
      "coder-skill-installed — runtime stage 2: aimgr installs coder-core/coder-docs/code-simplify only; no coder-beads, no orchestrator agent, no .beads"
    );
    expect(result.stdout).toContain("--fixture selects a committed fixture baseline, then prepares a runtime workspace");
    expect(result.stdout).toContain("Runtime-generated .coder/project.yaml is authoritative whenever startup rewrites project state.");
    expect(result.stdout).toContain("Shell and TUI runs prepare the same runtime workspace state");
    expect(result.stdout).toContain("Automated launcher guardrails cover environment preparation + startup viability only.");
    expect(result.stdout).toContain("Auth/model-backed prompts (for example: \"say hi\") are exploratory manual checks.");
    expect(result.stdout).not.toContain('opencode run --command "pwd"');
  });

  it("accepts beads-initialized as a fixture argument", () => {
    const args = parseArgs(["--mode=command", "--fixture=beads-initialized", "--", "env"]);
    expect(args.fixture).toBe("beads-initialized");
  });

  it.skipIf(!bdAvailable)(
    "createFixtureWorkspace(beads-initialized) auto-initializes metadata and enforces 0700 permissions",
    async () => {
      const workspace = await createFixtureWorkspace("beads-initialized");

      try {
        const metadata = Bun.file(join(workspace.workdir, ".beads", "metadata.json"));
        expect(await metadata.exists()).toBe(true);

        const beadsDirStat = await stat(join(workspace.workdir, ".beads"));
        expect(beadsDirStat.mode & 0o777).toBe(0o700);
      } finally {
        await rm(workspace.tempRoot, { recursive: true, force: true });
      }
    }
  );

  it.skipIf(!bdAvailable)("documents single-writer behavior via concurrent bd create lock failure", async () => {
    const workspace = await createFixtureWorkspace("beads-initialized");

    try {
      const createA = Bun.spawn({
        cmd: ["bd", "create", "--type=task", "--title", "single-writer-a", "--description", "concurrency guard"],
        cwd: workspace.workdir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const createB = Bun.spawn({
        cmd: ["bd", "create", "--type=task", "--title", "single-writer-b", "--description", "concurrency guard"],
        cwd: workspace.workdir,
        stdout: "pipe",
        stderr: "pipe",
      });

      const results = await Promise.all([
        Promise.all([createA.exited, new Response(createA.stdout).text(), new Response(createA.stderr).text()]),
        Promise.all([createB.exited, new Response(createB.stdout).text(), new Response(createB.stderr).text()]),
      ]);

      const exitCodes = results.map(([exitCode]) => exitCode);
      const bothSucceeded = exitCodes.every((exitCode) => exitCode === 0);
      expect(bothSucceeded).toBe(false);

      const combinedOutput = results
        .map(([, stdout, stderr]) => `${stdout}\n${stderr}`.toLowerCase())
        .join("\n");
      expect(combinedOutput).toMatch(/lock|exclusive|busy|timeout/);
    } finally {
      await rm(workspace.tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects removed --probe-plugin-load option", async () => {
    const result = await runLauncher(["--mode=command", "--probe-plugin-load", "--", "env"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Argument error: Unknown argument: --probe-plugin-load");
  });

  it("copies the committed OpenCode config fixture into isolated config", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "opencode-coder-isolated-config-"));

    try {
      const isolatedPaths = await createIsolatedOpenCodePaths(tempRoot);
      const opencodeConfig = await readFile(join(isolatedPaths.opencodeConfigDir, "opencode.json"), "utf8");

      if (privateTestsEnabled) {
        expect(opencodeConfig).toContain(`"${DYNATRACE_PLUGIN_SPEC}"`);
      } else {
        expect(opencodeConfig).not.toContain(`"${DYNATRACE_PLUGIN_SPEC}"`);
      }
      expect(opencodeConfig).not.toContain('"@dynatrace-oss/opencode-coder@0.34.2"');
      expect(opencodeConfig).toContain('"theme": "catppuccin"');
      expect(isolatedPaths.env.GIT_AUTHOR_NAME).toBe("opencode-coder-isolated");
      expect(isolatedPaths.env.GIT_AUTHOR_EMAIL).toBe("isolated@opencode-coder.local");
      expect(isolatedPaths.env.GIT_COMMITTER_NAME).toBe("opencode-coder-isolated");
      expect(isolatedPaths.env.GIT_COMMITTER_EMAIL).toBe("isolated@opencode-coder.local");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("prewarms isolated OpenCode data baseline before first launcher command", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=command", "--fixture=empty-project", "--", "true"]);

      expect(result.exitCode).toBe(0);
      if (opencodeCheck.available) {
        expect(result.stdout).toContain("Isolated OpenCode data prewarmed: yes (empty baseline copied)");
      } else {
        expect(result.stdout).toContain("Isolated OpenCode data prewarmed: no (skipped:");
      }

      preservedRoot = getPreservedRoot(result.stdout);

      const isolatedDb = Bun.file(join(preservedRoot, "isolated-opencode", "xdg-data", "opencode", "opencode.db"));
      if (opencodeCheck.available) {
        expect(await isolatedDb.exists()).toBe(true);
      } else {
        expect(await isolatedDb.exists()).toBe(false);
      }
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  }, 120000);

  it("reads isolated test manifest pins used by harness setup", async () => {
    const manifest = await readIsolatedTestManifest();

    expect(manifest.pins["@hk9890/opencode-dynatrace"]).toBe("0.6.0");
    expect(manifest.pins["@opencode-ai/plugin"]).toBe("^1.3.17");
  });

  it("fails clearly for unknown fixture", async () => {
    const result = await runLauncher(["--mode=command", "--fixture=does-not-exist", "--", "env"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown fixture: does-not-exist");
  });

  it("fails clearly for non-existent auth path", async () => {
    const result = await runLauncher([
      "--mode=command",
      "--fixture=empty-project",
      "--auth=/tmp/does-not-exist-auth.json",
      "--",
      "env",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Auth seed error:");
    expect(result.stderr).not.toContain(" at ");
  });

  it("fails clearly when --project-path is missing a value", async () => {
    const result = await runLauncher(["--mode=command", "--project-path=", "--", "env"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Argument error: Missing value for --project-path");
  });

  it("fails clearly for invalid --project-path directory", async () => {
    const result = await runLauncher(["--mode=command", "--project-path=/tmp/does-not-exist-project", "--", "env"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Project path error: Project path does not exist:");
  });

  it("prepares shell workspaces with the same bootstrap state as TUI for empty-project", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=shell", "--fixture=empty-project"], {
        SHELL: "/bin/true",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Mode: shell");
      expect(result.stdout).toContain("Plugin bootstrap: prepared (local-build)");
      expect(result.stdout).not.toContain("Plugin path used: <none>");
      expect(result.stdout).toContain("Workspace plugin dependencies prepared: no");
      expect(result.stdout).toContain("AI resources prepared: no");

      preservedRoot = getPreservedRoot(result.stdout);

      const pluginLink = Bun.file(join(preservedRoot!, "project", ".opencode", "plugins", "opencode-coder.js"));
      const packageJson = Bun.file(join(preservedRoot!, "project", ".opencode", "package.json"));
      const seededCommandFile = Bun.file(
        join(preservedRoot!, "project", ".opencode", "commands", "opencode-coder", "init.md")
      );
      const coderModeConfig = Bun.file(join(preservedRoot!, "project", ".coder", "opencode-coder.yaml"));
      const coderProjectConfig = Bun.file(join(preservedRoot!, "project", ".coder", "project.yaml"));
      const opencodeCommands = Bun.file(join(preservedRoot!, "project", ".opencode", "commands"));
      const opencodeAgents = Bun.file(join(preservedRoot!, "project", ".opencode", "agents"));
      const opencodeSkills = Bun.file(join(preservedRoot!, "project", ".opencode", "skills"));
      const beadsDir = Bun.file(join(preservedRoot!, "project", ".beads"));

      expect(await pluginLink.exists()).toBe(true);
      expect(await packageJson.exists()).toBe(false);
      expect(await seededCommandFile.exists()).toBe(false);
      expect(await coderModeConfig.exists()).toBe(false);
      expect(await coderProjectConfig.exists()).toBe(false);
      expect(await opencodeCommands.exists()).toBe(false);
      expect(await opencodeAgents.exists()).toBe(false);
      expect(await opencodeSkills.exists()).toBe(false);
      expect(await beadsDir.exists()).toBe(false);
      await expectNoRuntimeScaffolding(join(preservedRoot!, "project"));
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  });

  it("keeps coder-mode-configured minimally prepared at runtime", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=shell", "--fixture=coder-mode-configured"], {
        SHELL: "/bin/true",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Mode: shell");
      expect(result.stdout).toContain("Plugin bootstrap: prepared (local-build)");
      expect(result.stdout).toContain("AI resources prepared: no");

      preservedRoot = getPreservedRoot(result.stdout);

      const coderModeConfig = Bun.file(join(preservedRoot!, "project", ".coder", "opencode-coder.yaml"));
      const coderProjectConfig = Bun.file(join(preservedRoot!, "project", ".coder", "project.yaml"));
      const opencodeCommands = Bun.file(join(preservedRoot!, "project", ".opencode", "commands"));
      const opencodeAgents = Bun.file(join(preservedRoot!, "project", ".opencode", "agents"));
      const opencodeSkills = Bun.file(join(preservedRoot!, "project", ".opencode", "skills"));
      const beadsDir = Bun.file(join(preservedRoot!, "project", ".beads"));

      expect(await coderModeConfig.exists()).toBe(true);
      const coderModeConfigText = await coderModeConfig.text();
      expect(coderModeConfigText).toContain("mode: stealth");
      expect(await coderProjectConfig.exists()).toBe(false);
      expect(await opencodeCommands.exists()).toBe(false);
      expect(await opencodeAgents.exists()).toBe(false);
      expect(await opencodeSkills.exists()).toBe(false);
      expect(await beadsDir.exists()).toBe(false);
      await expectNoRuntimeScaffolding(join(preservedRoot!, "project"));
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  });

  it("prepares coder-skill-installed as stage-2 non-beads runtime capability", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=command", "--fixture=coder-skill-installed", "--", "env"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("AI resources prepared: yes (aimgr-installed)");

      preservedRoot = getPreservedRoot(result.stdout);

      const coderModeConfig = Bun.file(join(preservedRoot!, "project", ".coder", "opencode-coder.yaml"));
      const coderProjectConfig = Bun.file(join(preservedRoot!, "project", ".coder", "project.yaml"));
      const coderCoreSkill = Bun.file(join(preservedRoot!, "project", ".opencode", "skills", "coder-core", "SKILL.md"));
      const coderDocsSkill = Bun.file(join(preservedRoot!, "project", ".opencode", "skills", "coder-docs", "SKILL.md"));
      const simplifySkill = Bun.file(join(preservedRoot!, "project", ".opencode", "skills", "code-simplify", "SKILL.md"));
      const beadsSkill = Bun.file(join(preservedRoot!, "project", ".opencode", "skills", "coder-beads", "SKILL.md"));
      const initCommand = Bun.file(join(preservedRoot!, "project", ".opencode", "commands", "opencode-coder", "init.md"));
      const docsCommand = Bun.file(
        join(preservedRoot!, "project", ".opencode", "commands", "opencode-coder", "init-or-update-docs.md")
      );
      const improveDocCommand = Bun.file(
        join(preservedRoot!, "project", ".opencode", "commands", "opencode-coder", "improve-doc.md")
      );
      const orchestratorAgent = Bun.file(join(preservedRoot!, "project", ".opencode", "agents", "orchestrator.md"));
      const opencodeAgentsDir = Bun.file(join(preservedRoot!, "project", ".opencode", "agents"));
      const beadsDir = Bun.file(join(preservedRoot!, "project", ".beads"));
      const aiPackage = Bun.file(join(preservedRoot!, "project", "ai.package.yaml"));

      expect(await coderModeConfig.exists()).toBe(true);
      expect(await coderModeConfig.text()).toContain("mode: team");
      expect(await coderProjectConfig.exists()).toBe(true);
      expect(await aiPackage.exists()).toBe(true);
      expect(await coderCoreSkill.exists()).toBe(true);
      expect(await coderDocsSkill.exists()).toBe(true);
      expect(await simplifySkill.exists()).toBe(true);
      expect(await beadsSkill.exists()).toBe(false);
      expect(await initCommand.exists()).toBe(true);
      expect(await docsCommand.exists()).toBe(true);
      expect(await improveDocCommand.exists()).toBe(true);
      expect(await orchestratorAgent.exists()).toBe(false);
      expect(await opencodeAgentsDir.exists()).toBe(false);
      expect(await beadsDir.exists()).toBe(false);
      await expectNoRuntimeScaffolding(join(preservedRoot!, "project"));
      await assertRuntimeReadinessFromWorkspace(join(preservedRoot!, "project"), "coder-skill-installed");
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  }, 120000);

  it("fails clearly when --fixture and --project-path are both set", async () => {
    const result = await runLauncher([
      "--mode=command",
      "--fixture=empty-project",
      "--project-path=/tmp",
      "--",
      "env",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Argument error: --fixture and --project-path are mutually exclusive");
  });

  it("resolves host config path precedence", () => {
    const fallbackPath = resolveHostOpenCodeConfigPath({}, "/tmp/fallback-home");
    expect(fallbackPath).toBe("/tmp/fallback-home/.config/opencode/opencode.json");

    const xdgPath = resolveHostOpenCodeConfigPath({ XDG_CONFIG_HOME: "/tmp/xdg-config" }, "/tmp/fallback-home");
    expect(xdgPath).toBe("/tmp/xdg-config/opencode/opencode.json");

    const explicitPath = resolveHostOpenCodeConfigPath(
      {
        OPENCODE_CONFIG_DIR: "/tmp/explicit-config",
        XDG_CONFIG_HOME: "/tmp/xdg-config",
      },
      "/tmp/fallback-home"
    );
    expect(explicitPath).toBe("/tmp/explicit-config/opencode.json");
  });

  it("resolves installed-configured package when exactly one matching plugin is configured", async () => {
    const hostConfigRoot = await mkdtemp(join(tmpdir(), "opencode-coder-host-config-ok-"));

    try {
      await writeFile(
        join(hostConfigRoot, "opencode.json"),
        JSON.stringify(
          {
            plugin: ["@hk9890/opencode-dynatrace@0.6.0", "@dynatrace-oss/opencode-coder@0.34.2"],
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      const resolved = await resolveInstalledConfiguredPluginFromHostConfig({ OPENCODE_CONFIG_DIR: hostConfigRoot });

      expect(resolved.packageSpec).toBe("@dynatrace-oss/opencode-coder@0.34.2");
      expect(resolved.hostConfigPath).toBe(join(hostConfigRoot, "opencode.json"));
    } finally {
      await rm(hostConfigRoot, { recursive: true, force: true });
    }
  });

  it("fails when host config has no matching installed opencode-coder entry", async () => {
    const hostConfigRoot = await mkdtemp(join(tmpdir(), "opencode-coder-host-config-none-"));

    try {
      await writeFile(
        join(hostConfigRoot, "opencode.json"),
        JSON.stringify(
          {
            plugin: ["@hk9890/opencode-dynatrace@0.6.0"],
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      await expect(
        resolveInstalledConfiguredPluginFromHostConfig({ OPENCODE_CONFIG_DIR: hostConfigRoot })
      ).rejects.toThrow("found 0");
    } finally {
      await rm(hostConfigRoot, { recursive: true, force: true });
    }
  });

  it("fails when host config has multiple matching opencode-coder entries", async () => {
    const hostConfigRoot = await mkdtemp(join(tmpdir(), "opencode-coder-host-config-many-"));

    try {
      await writeFile(
        join(hostConfigRoot, "opencode.json"),
        JSON.stringify(
          {
            plugin: [
              "@dynatrace-oss/opencode-coder@0.34.1",
              "@dynatrace-oss/opencode-coder@0.34.2",
              "@hk9890/opencode-dynatrace@0.6.0",
            ],
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      await expect(
        resolveInstalledConfiguredPluginFromHostConfig({ OPENCODE_CONFIG_DIR: hostConfigRoot })
      ).rejects.toThrow("found 2");
    } finally {
      await rm(hostConfigRoot, { recursive: true, force: true });
    }
  });

  it("seeds installed-configured isolated config without configured opencode-coder entry", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "opencode-coder-installed-config-seed-"));

    try {
      const isolatedPaths = await createIsolatedOpenCodePathsWithPluginSource(tempRoot, {
        pluginSource: "installed-configured",
      });

      const opencodeConfig = await readFile(join(isolatedPaths.opencodeConfigDir, "opencode.json"), "utf8");
      if (privateTestsEnabled) {
        expect(opencodeConfig).toContain(`"${DYNATRACE_PLUGIN_SPEC}"`);
      } else {
        expect(opencodeConfig).not.toContain(`"${DYNATRACE_PLUGIN_SPEC}"`);
      }
      expect(opencodeConfig).not.toContain('"@dynatrace-oss/opencode-coder@0.34.2"');
      expect(Object.prototype.hasOwnProperty.call(isolatedPaths.env, "OPENCODE_DISABLE_DEFAULT_PLUGINS")).toBe(true);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it.skipIf(!privateTestsEnabled)("prepares pinned Dynatrace package deterministically for isolated local-build startup", async () => {
    const workspace = await createFixtureWorkspace("empty-project");

    try {
      await prepareWorkspacePluginSource({
        projectRoot: PROJECT_ROOT,
        workdir: workspace.workdir,
        pluginSource: "local-build",
      });

      const opencodePackageJsonPath = join(workspace.workdir, ".opencode", "package.json");
      expect(await Bun.file(opencodePackageJsonPath).exists()).toBe(false);
    } finally {
      await rm(workspace.tempRoot, { recursive: true, force: true });
    }
  }, 120000);

  it("skips private Dynatrace package prep when OPENCODE_CODER_PRIVATE_TESTS is unset/false", async () => {
    const workspace = await createFixtureWorkspace("empty-project");

    try {
      await withEnvironment({ OPENCODE_CODER_PRIVATE_TESTS: "false" }, async () => {
        await prepareWorkspacePluginSource({
          projectRoot: PROJECT_ROOT,
          workdir: workspace.workdir,
          pluginSource: "local-build",
        });
      });

      const opencodePackageJsonPath = join(workspace.workdir, ".opencode", "package.json");
      expect(await Bun.file(opencodePackageJsonPath).exists()).toBe(false);
    } finally {
      await rm(workspace.tempRoot, { recursive: true, force: true });
    }
  }, 120000);

  it("prepares workspace dependencies for installed-configured source", async () => {
    const workspace = await createFixtureWorkspace("empty-project");
    const hostConfigRoot = await mkdtemp(join(tmpdir(), "opencode-coder-host-config-installed-prepare-"));

    try {
      await writeFile(
        join(hostConfigRoot, "opencode.json"),
        JSON.stringify(
          {
            plugin: ["@dynatrace-oss/opencode-coder@0.34.2"],
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      await prepareWorkspacePluginSource({
        projectRoot: PROJECT_ROOT,
        workdir: workspace.workdir,
        pluginSource: "installed-configured",
        hostEnv: {
          ...buildLauncherTestEnv(),
          OPENCODE_CONFIG_DIR: hostConfigRoot,
          CI: "true",
        },
      });

      const opencodePackageJsonPath = join(workspace.workdir, ".opencode", "package.json");
      const npmrcPath = join(workspace.workdir, ".opencode", ".npmrc");
      const installedPluginPath = join(
        workspace.workdir,
        ".opencode",
        "node_modules",
        "@dynatrace-oss",
        "opencode-coder",
        "dist",
        "opencode-coder.js"
      );

      expect(await Bun.file(opencodePackageJsonPath).exists()).toBe(true);
      expect(await Bun.file(npmrcPath).exists()).toBe(true);
      expect(await Bun.file(npmrcPath).text()).toContain("@dynatrace-oss:registry=https://npm.pkg.github.com");
      expect(await Bun.file(installedPluginPath).exists()).toBe(true);
    } finally {
      await rm(workspace.tempRoot, { recursive: true, force: true });
      await rm(hostConfigRoot, { recursive: true, force: true });
    }
  }, 120000);

  it("fails clearly when installed-configured auth token is not seeded", async () => {
    const workspace = await createFixtureWorkspace("empty-project");
    const hostConfigRoot = await mkdtemp(join(tmpdir(), "opencode-coder-host-config-installed-auth-missing-"));

    try {
      await writeFile(
        join(hostConfigRoot, "opencode.json"),
        JSON.stringify(
          {
            plugin: ["@dynatrace-oss/opencode-coder@0.34.2"],
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      await expect(
        prepareWorkspacePluginSource({
          projectRoot: PROJECT_ROOT,
          workdir: workspace.workdir,
          pluginSource: "installed-configured",
          hostEnv: {
            ...buildLauncherTestEnv(),
            OPENCODE_CONFIG_DIR: hostConfigRoot,
            CI: "false",
          },
        })
      ).rejects.toThrow("Missing GitHub Packages auth token for installed-configured plugin preparation");
    } finally {
      await rm(workspace.tempRoot, { recursive: true, force: true });
      await rm(hostConfigRoot, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!opencodeCheck.available || !privateTestsEnabled)("manual launcher non-interactive mode", () => {
  it("runs one-shot command with shared isolated setup and explicit auth seed", async () => {
    const tempAuthDir = await mkdtemp(join(tmpdir(), "opencode-coder-manual-auth-"));
    const authPath = join(tempAuthDir, "auth.json");
    await writeFile(authPath, "{}\n", "utf8");

    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher([
        "--mode=command",
        "--fixture=empty-project",
        `--auth=${authPath}`,
        "--",
        "env",
      ], {
        OPENCODE_DEFAULT_OPTIONS: "--log-level DEBUG",
        OPENCODE_LOG_RETENTION: "100",
        MANUAL_LAUNCHER_ENV_LEAK_CANARY: "should-not-leak",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Mode: command");
      expect(result.stdout).toContain("Plugin source: local-build");
      expect(result.stdout).toContain("Execution model: fixture copy (disposable workspace)");
      expect(result.stdout).toContain("Fixture: empty-project");
      expect(result.stdout).toContain("Project source:");
      expect(result.stdout).toContain("Workdir:");
      expect(result.stdout).toContain("Auth seeded: yes (explicit-path)");
      expect(result.stdout).toContain("Plugin path used:");
      expect(result.stdout).toContain("Resolved installed package: <none>");
      expect(result.stdout).toContain("Resolved host config: <none>");
      expect(result.stdout).toContain("AI resources prepared: no");
      expect(result.stdout).toContain("Configured plugin loading: disabled (OPENCODE_DISABLE_DEFAULT_PLUGINS=true)");
      expect(result.stdout).toContain("Cleanup plan: preserve copied workspace and isolated environment");
      expect(result.stdout).not.toContain("--keep: accepted (backward-compatible no-op)");
      expect(result.stdout).toContain("OPENCODE_DISABLE_DEFAULT_PLUGINS=true");
      expect(result.stdout).toContain("OPENCODE_CONFIG_DIR=");
      expect(result.stdout).not.toContain("OPENCODE_DEFAULT_OPTIONS=");
      expect(result.stdout).not.toContain("OPENCODE_LOG_RETENTION=");
      expect(result.stdout).not.toContain("MANUAL_LAUNCHER_ENV_LEAK_CANARY=");

      const envLineCount = result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).length;
      expect(envLineCount).toBeGreaterThanOrEqual(8);
      expect(envLineCount).toBeLessThan(30);

      const preservedMatch = result.stdout.match(/Environment preserved at: (.+)\n?/);
      expect(preservedMatch).not.toBeNull();
      preservedRoot = preservedMatch?.[1]?.trim();
      expect(Boolean(preservedRoot)).toBe(true);
      expect(preservedRoot).toContain(`${join(".manual-test-runs", "run-")}`);

      const pluginLink = Bun.file(join(preservedRoot!, "project", ".opencode", "plugins", "opencode-coder.js"));
      const dynatracePackageJsonPath = join(
        preservedRoot!,
        "project",
        ".opencode",
        "node_modules",
        "@hk9890",
        "opencode-dynatrace",
        "package.json"
      );
      const isolatedAuth = Bun.file(join(preservedRoot!, "isolated-opencode", "xdg-data", "opencode", "auth.json"));
      const isolatedConfig = await readFile(
        join(preservedRoot!, "isolated-opencode", "xdg-config", "opencode", "opencode.json"),
        "utf8"
      );

      expect(await pluginLink.exists()).toBe(true);
      expect(await isolatedAuth.exists()).toBe(true);
      expect(isolatedConfig).toContain(`"${DYNATRACE_PLUGIN_SPEC}"`);
      expect(isolatedConfig).not.toContain('"@dynatrace-oss/opencode-coder@0.34.2"');

      const dynatracePackageJson = JSON.parse(await readFile(dynatracePackageJsonPath, "utf8")) as {
        version?: string;
      };
      expect(dynatracePackageJson.version).toBe("0.6.0");
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
      await rm(tempAuthDir, { recursive: true, force: true });
    }
  }, 120000);

  it("runs one-shot command with external --project-path directly in place", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "opencode-coder-manual-project-source-"));
    const sourceAuthDir = await mkdtemp(join(tmpdir(), "opencode-coder-manual-auth-"));
    const authPath = join(sourceAuthDir, "auth.json");
    await writeFile(authPath, "{}\n", "utf8");

    await mkdir(join(sourceRoot, ".git"), { recursive: true });
    await mkdir(join(sourceRoot, ".beads"), { recursive: true });
    await mkdir(join(sourceRoot, ".coder"), { recursive: true });
    await mkdir(join(sourceRoot, ".opencode", "commands"), { recursive: true });
    await writeFile(join(sourceRoot, ".git", "SENTINEL"), "copied-git-metadata\n", "utf8");
    await writeFile(join(sourceRoot, ".beads", "daemon.pid"), "123\n", "utf8");
    await writeFile(join(sourceRoot, ".coder", "project.yaml"), "pluginVersion: stale\n", "utf8");
    await writeFile(join(sourceRoot, ".coder", "opencode-coder.yaml"), "mode: team\n", "utf8");
    await writeFile(join(sourceRoot, ".opencode", "commands", "local-command.md"), "# local command\n", "utf8");
    await symlink("/tmp/opencode-coder-missing-command.md", join(sourceRoot, ".opencode", "commands", "broken-link.md"));
    await writeFile(join(sourceRoot, "README.md"), "external project fixture\n", "utf8");

    const sourceSocketPath = join(sourceRoot, ".beads", "bd.sock");
    const sourceSocketServer = createServer();
    await new Promise<void>((resolve, reject) => {
      sourceSocketServer.once("error", reject);
      sourceSocketServer.listen(sourceSocketPath, () => {
        sourceSocketServer.off("error", reject);
        resolve();
      });
    });

    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher([
        "--mode=command",
        "--project-path",
        sourceRoot,
        "--keep",
        `--auth=${authPath}`,
        "--",
        "env",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Mode: command");
      expect(result.stdout).toContain("Plugin source: local-build");
      expect(result.stdout).toContain("Execution model: direct project path (in place)");
      expect(result.stdout).toContain(`Project path: ${sourceRoot}`);
      expect(result.stdout).toContain(`Project source: ${sourceRoot}`);
      expect(result.stdout).toContain(`Workdir: ${sourceRoot}`);
      expect(result.stdout).toContain("Auth seeded: yes (explicit-path)");
      expect(result.stdout).toContain("AI resources prepared: yes (seeded)");
      expect(result.stdout).toContain("Project mutation risk: yes (project-path runs execute in place)");

      const preservedMatch = result.stdout.match(/Environment preserved at: (.+)\n?/);
      expect(preservedMatch).not.toBeNull();
      preservedRoot = preservedMatch?.[1]?.trim();
      expect(Boolean(preservedRoot)).toBe(true);
      expect(preservedRoot).toContain(`${join(".manual-test-runs", "run-")}`);

      const preservedProjectDir = Bun.file(join(preservedRoot!, "project"));
      const isolatedConfig = Bun.file(join(preservedRoot!, "isolated-opencode", "xdg-config", "opencode", "opencode.json"));
      const isolatedAuth = Bun.file(join(preservedRoot!, "isolated-opencode", "xdg-data", "opencode", "auth.json"));
      const sourceReadme = Bun.file(join(sourceRoot, "README.md"));
      const sourceGitSentinel = Bun.file(join(sourceRoot, ".git", "SENTINEL"));
      const sourceBeadsPid = Bun.file(join(sourceRoot, ".beads", "daemon.pid"));
      const sourceBeadsSocketPath = join(sourceRoot, ".beads", "bd.sock");
      const sourceCoderProject = Bun.file(join(sourceRoot, ".coder", "project.yaml"));
      const sourceCoderModeState = Bun.file(join(sourceRoot, ".coder", "opencode-coder.yaml"));
      const sourceOpencodeLocalCommand = Bun.file(join(sourceRoot, ".opencode", "commands", "local-command.md"));
      const sourceOpencodeBrokenLink = Bun.file(join(sourceRoot, ".opencode", "commands", "broken-link.md"));
      const sourcePluginLink = Bun.file(join(sourceRoot, ".opencode", "plugins", "opencode-coder.js"));

      expect(await preservedProjectDir.exists()).toBe(false);
      expect(await isolatedConfig.exists()).toBe(true);
      expect(await isolatedAuth.exists()).toBe(true);
      expect(await sourceReadme.exists()).toBe(true);
      expect(await sourceGitSentinel.exists()).toBe(true);
      expect(await sourceBeadsPid.exists()).toBe(true);
      // Bun.file().exists() returns false for Unix domain sockets — use stat instead
      const sourceBeadsSocketStat = await stat(sourceBeadsSocketPath).catch(() => null);
      expect(sourceBeadsSocketStat?.isSocket()).toBe(true);
      expect(await sourceCoderProject.exists()).toBe(true);
      expect(await sourceCoderProject.text()).toContain("pluginVersion: stale");
      expect(await sourceCoderModeState.exists()).toBe(true);
      expect(await sourceCoderModeState.text()).toContain("mode: team");
      expect(await sourceOpencodeLocalCommand.exists()).toBe(true);
      expect(await sourceOpencodeBrokenLink.exists()).toBe(false);
      expect(await sourcePluginLink.exists()).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        sourceSocketServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
      await rm(sourceRoot, { recursive: true, force: true });
      await rm(sourceAuthDir, { recursive: true, force: true });
    }
  }, 120000);

  it("supports installed-configured plugin source with deterministic package prep", async () => {
    const hostConfigRoot = await mkdtemp(join(tmpdir(), "opencode-coder-launcher-installed-source-"));

    await writeFile(
      join(hostConfigRoot, "opencode.json"),
      JSON.stringify(
        {
          plugin: ["@dynatrace-oss/opencode-coder@0.34.2", "@hk9890/opencode-dynatrace@0.6.0"],
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(
        [
          "--mode=command",
          "--fixture=coder-skill-installed",
          "--plugin-source=installed-configured",
          "--keep",
          "--",
          "env",
        ],
        {
          OPENCODE_CONFIG_DIR: hostConfigRoot,
          CI: "true",
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Plugin source: installed-configured");
      expect(result.stdout).toContain("Plugin path used:");
      expect(result.stdout).not.toContain("Plugin path used: <none>");
      expect(result.stdout).toContain("Resolved installed package: @dynatrace-oss/opencode-coder@0.34.2");
      expect(result.stdout).toContain(`Resolved host config: ${join(hostConfigRoot, "opencode.json")}`);
      expect(result.stdout).toContain("Configured plugin loading: disabled (OPENCODE_DISABLE_DEFAULT_PLUGINS=true)");
      expect(result.stdout).toContain("AI resources prepared: no");
      expect(result.stdout).toContain("One-shot command: env");

      const preservedMatch = result.stdout.match(/Environment preserved at: (.+)\n?/);
      expect(preservedMatch).not.toBeNull();
      preservedRoot = preservedMatch?.[1]?.trim();
      expect(Boolean(preservedRoot)).toBe(true);
      expect(preservedRoot).toContain(`${join(".manual-test-runs", "run-")}`);

      const pluginLink = Bun.file(join(preservedRoot!, "project", ".opencode", "plugins", "opencode-coder.js"));
      expect(await pluginLink.exists()).toBe(true);

      const isolatedConfig = await readFile(
        join(preservedRoot!, "isolated-opencode", "xdg-config", "opencode", "opencode.json"),
        "utf8"
      );
      expect(isolatedConfig).toContain(`"${DYNATRACE_PLUGIN_SPEC}"`);
      expect(isolatedConfig).not.toContain('"@dynatrace-oss/opencode-coder@0.34.2"');
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
      await rm(hostConfigRoot, { recursive: true, force: true });
    }
  }, 120000);

  it("prepares beads-initialized as stage-3 beads/orchestrator-ready runtime capability", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=command", "--fixture=beads-initialized", "--", "env"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("AI resources prepared: yes (aimgr-installed)");

      preservedRoot = getPreservedRoot(result.stdout);

      const coderModeConfig = Bun.file(join(preservedRoot!, "project", ".coder", "opencode-coder.yaml"));
      const coderProjectConfig = Bun.file(join(preservedRoot!, "project", ".coder", "project.yaml"));
      const coderBeadsSkill = Bun.file(join(preservedRoot!, "project", ".opencode", "skills", "coder-beads", "SKILL.md"));
      const coderCoreSkill = Bun.file(join(preservedRoot!, "project", ".opencode", "skills", "coder-core", "SKILL.md"));
      const orchestratorAgent = Bun.file(join(preservedRoot!, "project", ".opencode", "agents", "orchestrator.md"));
      const beadsMetadata = Bun.file(join(preservedRoot!, "project", ".beads", "metadata.json"));

      expect(await coderModeConfig.exists()).toBe(true);
      expect(await coderModeConfig.text()).toContain("mode: team");
      expect(await coderProjectConfig.exists()).toBe(true);
      expect(await coderBeadsSkill.exists()).toBe(true);
      expect(await coderCoreSkill.exists()).toBe(true);
      expect(await orchestratorAgent.exists()).toBe(true);
      expect(await beadsMetadata.exists()).toBe(true);
      await expectNoRuntimeScaffolding(join(preservedRoot!, "project"));
      await assertRuntimeReadinessFromWorkspace(join(preservedRoot!, "project"), "beads-initialized");
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  }, 120000);

  it("prepares beads shell workspaces through aimgr so manual opencode launch matches TUI", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=shell", "--fixture=beads-initialized"], {
        SHELL: "/bin/true",
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Plugin bootstrap: prepared (local-build)");
      expect(result.stdout).toContain("AI resources prepared: yes (aimgr-installed)");

      const preservedMatch = result.stdout.match(/Environment preserved at: (.+)\n?/);
      preservedRoot = preservedMatch?.[1]?.trim();
      expect(Boolean(preservedRoot)).toBe(true);

      const packageSkill = Bun.file(
        join(preservedRoot!, "project", ".opencode", "skills", "coder-core", "SKILL.md")
      );
      expect(await packageSkill.exists()).toBe(true);
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  }, 120000);
});

describe.skipIf(!opencodeCheck.available)("manual launcher startup viability contract", () => {
  it("avoids first-run migration log in fresh manual launcher invocations via prewarmed isolated data", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=command", "--fixture=empty-project", "--", "opencode", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Isolated OpenCode data prewarmed: yes (empty baseline copied)");
      expect(result.stdout).not.toContain("Performing one time database migration...");
      expect(result.stderr).not.toContain("Performing one time database migration...");

      preservedRoot = getPreservedRoot(result.stdout);
      const isolatedDb = Bun.file(join(preservedRoot, "isolated-opencode", "xdg-data", "opencode", "opencode.db"));
      expect(await isolatedDb.exists()).toBe(true);
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  }, 120000);

  it("proves launcher-prepared local-build environment can start server and return structured SDK response", async () => {
    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(["--mode=command", "--fixture=empty-project", "--", "env"]);
      expect(result.exitCode).toBe(0);

      const preservedMatch = result.stdout.match(/Environment preserved at: (.+)\n?/);
      preservedRoot = preservedMatch?.[1]?.trim();
      expect(Boolean(preservedRoot)).toBe(true);

      const seededCommandFile = Bun.file(
        join(preservedRoot!, "project", ".opencode", "commands", "opencode-coder", "init.md")
      );
      expect(await seededCommandFile.exists()).toBe(false);

      const launcherEnv = await getLauncherPreparedEnv(result.stdout);
      await proveLauncherStartupViability(join(preservedRoot!, "project"), launcherEnv);
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
    }
  }, 120000);

  it("proves launcher-prepared installed-configured environment can start server and return structured SDK response", async () => {
    const hostConfigRoot = await mkdtemp(join(tmpdir(), "opencode-coder-launcher-installed-source-viability-"));
    await writeFile(
      join(hostConfigRoot, "opencode.json"),
      JSON.stringify(
        {
          plugin: ["@dynatrace-oss/opencode-coder@0.34.2"],
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    let preservedRoot: string | undefined;

    try {
      const result = await runLauncher(
        ["--mode=command", "--fixture=empty-project", "--plugin-source=installed-configured", "--", "env"],
        { OPENCODE_CONFIG_DIR: hostConfigRoot, CI: "true" }
      );
      expect(result.exitCode).toBe(0);

      const preservedMatch = result.stdout.match(/Environment preserved at: (.+)\n?/);
      preservedRoot = preservedMatch?.[1]?.trim();
      expect(Boolean(preservedRoot)).toBe(true);

      const launcherEnv = await getLauncherPreparedEnv(result.stdout);
      await proveLauncherStartupViability(join(preservedRoot!, "project"), launcherEnv);
    } finally {
      if (preservedRoot) {
        await rm(preservedRoot, { recursive: true, force: true });
      }
      await rm(hostConfigRoot, { recursive: true, force: true });
    }
  }, 120000);
});
