import { mkdirSync } from "fs";
import { join } from "path";
import { $ } from "bun";
import { checkHostToolPrerequisites, prependResolvedHostToolBinDirs } from "../e2e/helpers/harness";

/**
 * Embedded beads backend write-concurrency rule (opencode-coder-eupg):
 *
 * The default embedded-dolt store is single-writer per workspace. Running
 * multiple `bd` write commands concurrently against the same `.beads/` directory
 * can fail with lock/exclusive-access errors.
 *
 * Test guidance:
 * - Keep `bd create` / `bd update` / `bd close` calls serialized within a workspace.
 * - If parallel test workers need `bd` writes, each worker should use its own
 *   isolated workspace instead of sharing one `.beads/` directory.
 * - Do not assert that concurrent writes must fail; the repo contract is to
 *   avoid concurrent writes entirely and serialize tracker mutations per workspace.
 */

/**
 * Creates a .beads/ directory marker in the given workdir.
 * Use this in unit tests that only need beads directory detection (no real bd).
 */
export function ensureBeadsMarker(workdir: string): void {
  mkdirSync(join(workdir, ".beads"), { recursive: true });
}

/**
 * Runs `bd init` in the given workdir to create a fully functional beads workspace.
 * Requires `bd` CLI to be available on PATH.
 *
 * See file-level note for single-writer constraints on embedded-dolt workspaces.
 *
 * @returns true if bd init succeeded, false if bd is not available or init failed
 */
export async function initBeadsWorkspace(workdir: string): Promise<boolean> {
  try {
    const hostPrerequisites = await checkHostToolPrerequisites({ requireOpencode: false, requireBd: true });
    if (!hostPrerequisites.available) {
      return false;
    }

    prependResolvedHostToolBinDirs(hostPrerequisites.tools, { tools: ["bd"] });
    const result = await $`bd init --non-interactive --skip-hooks --skip-agents --quiet`.cwd(workdir).quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
