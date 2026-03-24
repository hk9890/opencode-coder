/**
 * Normalize a config key into canonical snake_case.
 *
 * Examples:
 * - `defaultAgent` -> `default_agent`
 * - `default-agent` -> `default_agent`
 * - `DEFAULT AGENT` -> `default_agent`
 */
export function normalizeConfigKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .replace(/([A-Z]+)([A-Z][a-z0-9])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
