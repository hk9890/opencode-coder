/**
 * Environment variable helpers for plugin control.
 *
 * This module provides type-safe access to environment variables that control
 * plugin behavior, with proper default values and boolean parsing.
 */

/**
 * Parse a string value as a boolean.
 *
 * Converts string representations of booleans to actual boolean values:
 * - "true" (case-insensitive) → true
 * - "false" (case-insensitive) → false
 * - undefined/empty → defaultValue
 *
 * @param value - The string value to parse
 * @param defaultValue - The default value if parsing fails or value is undefined
 * @returns The parsed boolean value
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") {
    return defaultValue;
  }
  const normalized = value.toLowerCase().trim();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return defaultValue;
}

/**
 * Check if the plugin is disabled via environment variable.
 *
 * Environment Variable: `OPENCODE_CODER_DISABLED`
 *
 * When set to "true", the entire plugin will be disabled and not load any features.
 * This acts as a kill switch for the plugin.
 *
 * @example
 * ```bash
 * # Disable the plugin
 * export OPENCODE_CODER_DISABLED=true
 * ```
 *
 * @returns true if the plugin should be disabled, false otherwise (default: false)
 */
export function isPluginDisabled(): boolean {
  return parseBoolean(process.env["OPENCODE_CODER_DISABLED"], false);
}

/**
 * Check if plugin debug logging is enabled.
 *
 * Environment Variable: `OPENCODE_CODER_DEBUG`
 *
 * Historical behavior treats most non-empty values as enabled. Keep that
 * behavior explicit while honoring common disable values.
 */
export function isDebugLoggingEnabled(): boolean {
  const value = process.env["OPENCODE_CODER_DEBUG"];
  if (value === undefined || value === "") {
    return false;
  }

  const normalized = value.toLowerCase().trim();
  return normalized !== "false" && normalized !== "0";
}
