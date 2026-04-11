import { mkdirSync } from "fs";
import { join } from "path";
import { $ } from "bun";

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
 * **Single-writer constraint (see opencode-coder-eupg):**
 * The embedded-dolt backend is single-writer. Concurrent `bd create` / `bd update`
 * calls against the same workspace will fail with exclusive-lock errors.
 * Tests that call `bd` write commands must serialize them — do NOT run parallel
 * bd writes against the same .beads/ directory.
 *
 * @returns true if bd init succeeded, false if bd is not available or init failed
 */
export async function initBeadsWorkspace(workdir: string): Promise<boolean> {
  try {
    const result = await $`bd init --skip-hooks --skip-agents --quiet`.cwd(workdir).quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
