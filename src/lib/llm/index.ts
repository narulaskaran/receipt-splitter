import { createAnthropicExtractor } from "./adapters/anthropic";
import { LLMConfigError, type ReceiptExtractor } from "./types";

export * from "./types";
export { RECEIPT_PROMPT } from "./receipt-prompt";

/**
 * Adapter factories keyed by provider id. Factories run lazily, so only the
 * selected provider's configuration needs to be present.
 */
const registry: Record<string, () => ReceiptExtractor> = {
  anthropic: () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new LLMConfigError("ANTHROPIC_API_KEY environment variable is not set");
    }
    return createAnthropicExtractor({ apiKey });
  },
};

/** Returns the configured receipt extractor. Throws LLMConfigError if misconfigured. */
export function getReceiptExtractor(): ReceiptExtractor {
  // Anthropic is the only provider for now; env-based selection comes with
  // the next adapter.
  return registry.anthropic();
}
