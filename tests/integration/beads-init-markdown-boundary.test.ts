import { describe, expect, it } from "bun:test";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

type CommandResult = { exitCode: number; stdout: string; stderr: string };

async function runCommand(cmd: string[], cwd: string): Promise<CommandResult> {
  const proc = Bun.spawn({
    cmd,
    cwd,
    env: {
      ...process.env,
      PATH: process.env.PATH ?? "",
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

async function listMarkdownFiles(
  root: string,
  relativeDir = "",
  excludedTopLevelDirs = new Set<string>([".beads", ".git"])
): Promise<string[]> {
  const absoluteDir = join(root, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const discovered: string[] = [];

  for (const entry of entries) {
    const nextRelative = relativeDir ? join(relativeDir, entry.name) : entry.name;

    if (entry.isDirectory()) {
      if (!relativeDir && excludedTopLevelDirs.has(entry.name)) {
        continue;
      }

      const nested = await listMarkdownFiles(root, nextRelative, excludedTopLevelDirs);
      discovered.push(...nested);
      continue;
    }

    if (/\.(md|markdown)$/i.test(entry.name)) {
      discovered.push(nextRelative);
    }
  }

  return discovered.sort();
}

describe("bd init markdown boundary", () => {
  it("bd init --non-interactive --skip-agents creates tracker state without creating or mutating markdown docs", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "opencode-coder-bd-init-"));

    try {
      // Integration coverage is sufficient here: we run the real `bd init` command in an
      // isolated git workspace and assert on the resulting filesystem boundary.
      const readmePath = join(workspace, "README.md");
      const agentsPath = join(workspace, "AGENTS.md");
      const originalReadme = "# Existing project docs\n\nDo not mutate this file.\n";

      await writeFile(readmePath, originalReadme, "utf8");

      const gitInit = await runCommand(["git", "init", "--quiet"], workspace);
      expect(gitInit.exitCode).toBe(0);

      const markdownBefore = await listMarkdownFiles(workspace);
      expect(markdownBefore).toEqual(["README.md"]);

      const initResult = await runCommand(
        ["bd", "init", "--non-interactive", "--skip-hooks", "--skip-agents", "--quiet"],
        workspace
      );
      expect(initResult.exitCode).toBe(0);

      const beadsDirStats = await stat(join(workspace, ".beads"));
      expect(beadsDirStats.isDirectory()).toBe(true);

      const agentsFile = Bun.file(agentsPath);
      expect(await agentsFile.exists()).toBe(false);

      const markdownAfter = await listMarkdownFiles(workspace);
      expect(markdownAfter).toEqual(markdownBefore);

      const readmeAfter = await readFile(readmePath, "utf8");
      expect(readmeAfter).toBe(originalReadme);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }, 120000);
});
