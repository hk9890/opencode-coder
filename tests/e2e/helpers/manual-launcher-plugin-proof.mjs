import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk";

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        server.close(() => resolve(address.port));
      } else {
        server.close(() => reject(new Error("Could not resolve ephemeral port")));
      }
    });
    server.on("error", reject);
  });
}

const directory = process.cwd();
const projectYamlPath = join(directory, ".coder", "project.yaml");
const port = await findAvailablePort();
const server = await createOpencodeServer({
  hostname: "127.0.0.1",
  port,
  timeout: 30000,
  config: {
    autoupdate: false,
    snapshot: false,
  },
});

const client = createOpencodeClient({
  baseUrl: server.url,
  responseStyle: "data",
  throwOnError: true,
});

async function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readLoadedPluginVersion() {
  try {
    const content = await readFile(projectYamlPath, "utf8");
    const match = content.match(/^pluginVersion:\s*(.+)$/m);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

async function waitForPluginVersionWrite(timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const pluginVersion = await readLoadedPluginVersion();
    if (pluginVersion && pluginVersion !== "fixture") {
      return pluginVersion;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return await readLoadedPluginVersion();
}

try {
  try {
    await withTimeout(client.command.list({ query: { directory } }), 10000, "command.list");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`PLUGIN_PROOF_NOTE: command.list probe did not complete (${message})`);
  }

  const loadedPluginVersion = await waitForPluginVersionWrite(15000);
  if (!loadedPluginVersion || loadedPluginVersion === "fixture") {
    throw new Error(
      `Plugin proof failed: pluginVersion was not rewritten in ${projectYamlPath}; observed ${loadedPluginVersion ?? "<missing>"}`
    );
  }

  console.log(`PLUGIN_PROOF_OK:${loadedPluginVersion}`);
} finally {
  server.close();
}
