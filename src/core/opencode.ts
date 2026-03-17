import type { PluginInput } from "@opencode-ai/plugin";
import type { Logger } from "./logger";

export type OpencodeClient = PluginInput["client"];

export interface ToastOptions {
  title: string;
  message: string;
  variant: "info" | "success" | "warning" | "error";
  duration?: number;
}

export async function showToast(
  client: OpencodeClient,
  logger: Logger,
  options: ToastOptions,
  errorMessage = "Failed to show toast",
): Promise<void> {
  try {
    await (client as any).tui.showToast({
      title: options.title,
      message: options.message,
      variant: options.variant,
      duration: options.duration,
    });
  } catch (error) {
    logger.error(errorMessage, { error: String(error) });
  }
}
