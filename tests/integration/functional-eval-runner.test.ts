import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const SKILL_ROOT = join(
  PROJECT_ROOT,
  "ai-resources",
  "skills",
  "opencode-coder-skill-creator"
);

type CommandResult = { exitCode: number; stdout: string; stderr: string };

async function runCommand(cmd: string[], options: { cwd?: string; env?: Record<string, string> } = {}): Promise<CommandResult> {
  const proc = Bun.spawn({
    cmd,
    cwd: options.cwd ?? PROJECT_ROOT,
    env: {
      ...process.env,
      PATH: process.env.PATH ?? "",
      ...(options.env ?? {}),
    },
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

async function ensureExecutable(filePath: string): Promise<void> {
  const chmod = await runCommand(["chmod", "+x", filePath]);
  expect(chmod.exitCode).toBe(0);
}

describe("functional eval runner", () => {
  it("covers bare workspace start, hook lifecycle edge-cases, and basename fallback naming", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "opencode-coder-functional-eval-"));

    try {
      const fakeBin = join(tempRoot, "bin");
      const artifactsDir = join(tempRoot, "functional-artifacts");
      const fakeOpencode = join(fakeBin, "opencode");

      await mkdir(fakeBin, { recursive: true });
      await writeFile(
        fakeOpencode,
        "#!/usr/bin/env bash\nset -euo pipefail\nprintf '{\"type\":\"message\",\"text\":\"ok\"}\\n'\nprintf 'service=skill count=1\\n' >&2\n",
        "utf8"
      );
      await ensureExecutable(fakeOpencode);

      const result = await runCommand(
        [
          "python3",
          "-m",
          "scripts.run_functional_eval",
          "--skill-path",
          SKILL_ROOT,
          "--eval-set",
          join(SKILL_ROOT, "evals", "functional-fixtures", "evals.json"),
          "--artifacts-dir",
          artifactsDir,
          "--timeout",
          "5",
        ],
        {
          cwd: SKILL_ROOT,
          env: {
            PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
          },
        }
      );

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as {
        summary: { total: number; passed: number; failed: number };
        results: Array<Record<string, unknown>>;
      };

      expect(output.summary).toEqual({ total: 3, passed: 1, failed: 2 });

      const byId = new Map<number, Record<string, any>>(
        output.results.map((run) => [Number(run.eval_id), run])
      );

      const successRun = byId.get(201);
      expect(successRun).toBeDefined();
      expect(successRun?.success).toBe(true);
      expect(successRun?.hooks.before_run[0].display_name).toBe("assert-bare-workspace.sh");
      expect(successRun?.hooks.after_run[0].display_name).toBe("write success marker");

      const successSnapshot = String(successRun?.artifacts.workspace_snapshot);
      const injectedSkill = Bun.file(join(successSnapshot, ".opencode", "skills", "skill-creator", "SKILL.md"));
      const hydratedInput = Bun.file(join(successSnapshot, "evals", "functional-fixtures", "input", "hydrated.txt"));
      const gitDir = Bun.file(join(successSnapshot, ".git"));
      const beadsDir = Bun.file(join(successSnapshot, ".beads"));

      expect(await injectedSkill.exists()).toBe(true);
      expect(await hydratedInput.exists()).toBe(true);
      expect(await gitDir.exists()).toBe(false);
      expect(await beadsDir.exists()).toBe(false);

      const beforeFailRun = byId.get(202);
      expect(beforeFailRun).toBeDefined();
      expect(beforeFailRun?.setup_failed).toBe(true);
      expect(beforeFailRun?.setup_failure_reason).toBe("before_run_failed");
      expect(beforeFailRun?.model_execution?.ran).toBe(false);
      expect(beforeFailRun?.model_execution?.skipped).toBe(true);
      expect(beforeFailRun?.model_execution?.skipped_reason).toBe("before_run_failed");
      expect(beforeFailRun?.hooks.before_run).toHaveLength(1);
      expect(beforeFailRun?.hooks.after_run).toHaveLength(1);
      expect(beforeFailRun?.hooks.after_run[0].success).toBe(true);

      const afterFailRun = byId.get(203);
      expect(afterFailRun).toBeDefined();
      expect(afterFailRun?.after_run_failed).toBe(true);
      expect(afterFailRun?.hooks.after_run).toHaveLength(2);
      expect(afterFailRun?.hooks.after_run[0].success).toBe(false);
      expect(afterFailRun?.hooks.after_run[1].success).toBe(true);
      expect(afterFailRun?.hooks.after_run[1].display_name).toBe("after-write-late.sh");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 120000);

  it("keeps functional eval workspace setup isolated from the live repo tracker", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "opencode-coder-functional-eval-live-tracker-"));

    try {
      const fakeBin = join(tempRoot, "bin");
      const artifactsDir = join(tempRoot, "functional-artifacts");
      const fakeOpencode = join(fakeBin, "opencode");

      await mkdir(fakeBin, { recursive: true });
      await writeFile(
        fakeOpencode,
        "#!/usr/bin/env bash\nset -euo pipefail\nprintf '{\"type\":\"message\",\"text\":\"ok\"}\\n'\n",
        "utf8"
      );
      await ensureExecutable(fakeOpencode);

      const beforeBd = await runCommand(["bd", "list", "--json"]);
      expect(beforeBd.exitCode).toBe(0);

      const runResult = await runCommand(
        [
          "python3",
          "-m",
          "scripts.run_functional_eval",
          "--skill-path",
          SKILL_ROOT,
          "--eval-id",
          "100",
          "--artifacts-dir",
          artifactsDir,
          "--timeout",
          "5",
        ],
        {
          cwd: SKILL_ROOT,
          env: {
            PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
          },
        }
      );

      expect(runResult.exitCode).toBe(0);
      const runOutput = JSON.parse(runResult.stdout) as {
        results: Array<Record<string, unknown>>;
      };

      const planningRun = runOutput.results.find((entry) => Number(entry.eval_id) === 100) as Record<string, any> | undefined;
      expect(planningRun).toBeDefined();
      expect(planningRun?.hooks.before_run[0].success).toBe(true);

      const snapshotRoot = String(planningRun?.artifacts.workspace_snapshot);
      expect((await stat(join(snapshotRoot, ".git"))).isDirectory()).toBe(true);
      expect((await stat(join(snapshotRoot, ".beads"))).isDirectory()).toBe(true);

      const afterBd = await runCommand(["bd", "list", "--json"]);
      expect(afterBd.exitCode).toBe(0);
      expect(afterBd.stdout).toBe(beforeBd.stdout);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 120000);

  it("keeps trigger-eval automation on run_eval.py with trigger-evals.json", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "opencode-coder-trigger-eval-path-"));

    try {
      const fakeBin = join(tempRoot, "bin");
      const artifactsDir = join(tempRoot, "trigger-artifacts");
      const fakeOpencode = join(fakeBin, "opencode");
      const triggerEvalSet = join(SKILL_ROOT, "evals", "functional-fixtures", "trigger-evals.json");

      await mkdir(fakeBin, { recursive: true });
      await writeFile(
        fakeOpencode,
        "#!/usr/bin/env bash\nset -euo pipefail\nprintf '{\"type\":\"message\",\"text\":\"trigger path\"}\\n'\nprintf 'service=skill count=1\\n' >&2\n",
        "utf8"
      );
      await ensureExecutable(fakeOpencode);

      const runResult = await runCommand(
        [
          "python3",
          "-m",
          "scripts.run_eval",
          "--skill-path",
          SKILL_ROOT,
          "--eval-set",
          triggerEvalSet,
          "--num-workers",
          "1",
          "--runs-per-query",
          "1",
          "--timeout",
          "5",
          "--artifacts-dir",
          artifactsDir,
        ],
        {
          cwd: SKILL_ROOT,
          env: {
            PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
          },
        }
      );

      expect(runResult.exitCode).toBe(0);
      const output = JSON.parse(runResult.stdout) as {
        engine: string;
        summary: { total: number };
        artifacts_dir: string;
      };

      expect(output.engine).toBe("opencode-run-json-debug");
      expect(output.summary.total).toBe(1);

      const runResultPath = join(output.artifacts_dir, "query-000-run-01", "result.json");
      const perRun = JSON.parse(await readFile(runResultPath, "utf8")) as { run_label: string };
      expect(perRun.run_label).toBe("query-000-run-01");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 120000);
});
