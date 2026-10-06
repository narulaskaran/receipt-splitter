/**
 * @jest-environment node
 */
import { getReceiptExtractor, LLMConfigError } from "./index";

describe("getReceiptExtractor", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns the Anthropic extractor when its API key is set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(getReceiptExtractor().provider).toBe("anthropic");
  });

  it("throws LLMConfigError when the API key is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getReceiptExtractor()).toThrow(LLMConfigError);
    expect(() => getReceiptExtractor()).toThrow("ANTHROPIC_API_KEY environment variable is not set");
  });
});
