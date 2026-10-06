import { createAnthropicExtractor } from "./adapters/anthropic";
import { createOpenAICompatibleExtractor } from "./adapters/openai-compatible";
import { LLMConfigError, type ReceiptExtractor } from "./types";

export * from "./types";
export { RECEIPT_PROMPT } from "./receipt-prompt";

export const DEFAULT_PROVIDER = "anthropic";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new LLMConfigError(`${name} environment variable is not set`);
  }
  return value;
}

/**
 * Adapter factories keyed by provider id. Factories run lazily, so only the
 * selected provider's configuration needs to be present. To add a provider,
 * write an adapter (or reuse openai-compatible) and register it here.
 */
const registry: Record<string, (model: string | undefined) => ReceiptExtractor> = {
  anthropic: (model) =>
    createAnthropicExtractor({ apiKey: requireEnv("ANTHROPIC_API_KEY"), model }),
  openai: (model) =>
    createOpenAICompatibleExtractor({
      provider: "openai",
      apiKey: requireEnv("OPENAI_API_KEY"),
      model: model ?? "gpt-6-luna",
    }),
  openrouter: (model) =>
    createOpenAICompatibleExtractor({
      provider: "openrouter",
      apiKey: requireEnv("OPENROUTER_API_KEY"),
      baseURL: "https://openrouter.ai/api/v1",
      model: model ?? "openai/gpt-6-luna",
      tokenLimitParam: "max_tokens",
      defaultHeaders: { "X-Title": "Receipt Splitter" },
      // Only route to upstreams that honor every request param, so strict
      // json_schema can't be silently ignored
      extraBody: { provider: { require_parameters: true } },
    }),
};

export const SUPPORTED_PROVIDERS = Object.keys(registry);

/**
 * Returns the extractor selected by RECEIPT_LLM_PROVIDER (default "anthropic"),
 * using RECEIPT_LLM_MODEL to override the provider's default model.
 * Throws LLMConfigError if the provider is unknown or misconfigured.
 */
export function getReceiptExtractor(): ReceiptExtractor {
  const provider = process.env.RECEIPT_LLM_PROVIDER?.trim().toLowerCase() || DEFAULT_PROVIDER;
  // hasOwn so values like "toString" don't resolve to Object.prototype members
  const factory = Object.hasOwn(registry, provider) ? registry[provider] : undefined;
  if (!factory) {
    throw new LLMConfigError(
      `Unknown RECEIPT_LLM_PROVIDER "${provider}" (expected one of: ${SUPPORTED_PROVIDERS.join(", ")})`
    );
  }
  return factory(process.env.RECEIPT_LLM_MODEL?.trim() || undefined);
}
