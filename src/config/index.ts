/**
 * Configuration module - Environment variable helpers
 *
 * This module provides environment variable based configuration for the plugin.
 * The plugin works with zero configuration by default, using sensible defaults.
 *
 * Available environment variables:
 * - OPENCODE_CODER_DISABLED: Disable the plugin entirely (default: false)
 * - OPENCODE_CODER_DEBUG: Enable plugin debug logging
 */

// Environment variable helpers
export { isDebugLoggingEnabled, isPluginDisabled } from "./env";
