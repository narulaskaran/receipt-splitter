/**
 * @jest-environment node
 */
import { getReceiptExtractor, LLMConfigError } from "./index";
import { DEFAULT_ANTHROPIC_MODEL } from "./adapters/anthropic";

const ENV_KEYS = [
  "RECEIPT_LLM_PROVIDER",
  "RECEIPT_LLM_MODEL",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
] as const;

describe("getReceiptExtractor", () => {
  const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("defaults to Anthropic with its default model", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const extractor = getReceiptExtractor();
    expect(extractor.provider).toBe("anthropic");
    expect(extractor.model).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("throws LLMConfigError when the selected provider's API key is missing", () => {
    expect(() => getReceiptExtractor()).toThrow(LLMConfigError);
    expect(() => getReceiptExtractor()).toThrow("ANTHROPIC_API_KEY environment variable is not set");
  });

  it.each([
    ["openai", "OPENAI_API_KEY", "gpt-6-luna"],
    ["openrouter", "OPENROUTER_API_KEY", "openai/gpt-6-luna"],
  ])("selects %s via RECEIPT_LLM_PROVIDER", (provider, keyName, defaultModel) => {
    process.env.RECEIPT_LLM_PROVIDER = provider;
    expect(() => getReceiptExtractor()).toThrow(`${keyName} environment variable is not set`);

    process.env[keyName] = "test-key";
    const extractor = getReceiptExtractor();
    expect(extractor.provider).toBe(provider);
    expect(extractor.model).toBe(defaultModel);
  });

  it("does not require keys for providers that are not selected", () => {
    process.env.RECEIPT_LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    expect(getReceiptExtractor().provider).toBe("openai");
  });

  it("normalizes provider casing and whitespace", () => {
    process.env.RECEIPT_LLM_PROVIDER = "  OpenRouter ";
    process.env.OPENROUTER_API_KEY = "test-key";
    expect(getReceiptExtractor().provider).toBe("openrouter");
  });

  it("overrides the model with RECEIPT_LLM_MODEL", () => {
    process.env.RECEIPT_LLM_PROVIDER = "openrouter";
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.RECEIPT_LLM_MODEL = "deepseek/deepseek-v4.1-flash";
    expect(getReceiptExtractor().model).toBe("deepseek/deepseek-v4.1-flash");
  });

  it.each(["gemini", "constructor", "__proto__"])("rejects unknown provider %s", (provider) => {
    process.env.RECEIPT_LLM_PROVIDER = provider;
    expect(() => getReceiptExtractor()).toThrow(LLMConfigError);
    expect(() => getReceiptExtractor()).toThrow(/Unknown RECEIPT_LLM_PROVIDER/);
  });
});
