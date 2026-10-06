import { LLMError } from "./types";

/**
 * Parses a model's JSON text output. Strips markdown code fences first as a
 * safety fallback: structured outputs should never produce them, but models
 * and API versions drift.
 */
export function parseModelJson(text: string, provider: string): unknown {
  const jsonText = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown parse error";
    throw new LLMError("invalid_json", provider, msg, { cause: error });
  }
}
