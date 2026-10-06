import OpenAI from "openai";
import { parseModelJson } from "../parse-json";
import {
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  LLMError,
  toLLMError,
  type ExtractInput,
  type ReceiptExtractor,
} from "../types";

export interface OpenAICompatibleOptions {
  /** Provider id used in errors and webhooks, e.g. "openai", "openrouter" */
  provider: string;
  apiKey: string;
  model: string;
  /** Omit for api.openai.com */
  baseURL?: string;
  /**
   * OpenAI rejects `max_tokens` on reasoning models and wants
   * `max_completion_tokens`; OpenRouter documents `max_tokens`.
   */
  tokenLimitParam?: "max_tokens" | "max_completion_tokens";
  /** Set false for models without native PDF input */
  supportsPdf?: boolean;
  defaultHeaders?: Record<string, string>;
  /** Provider-specific request fields merged into every request body */
  extraBody?: Record<string, unknown>;
}

function toFilePart(
  mimeType: string,
  data: string
): OpenAI.Chat.ChatCompletionContentPart {
  const dataUrl = `data:${mimeType};base64,${data}`;
  if (mimeType === "application/pdf") {
    return { type: "file", file: { filename: "receipt.pdf", file_data: dataUrl } };
  }
  return { type: "image_url", image_url: { url: dataUrl } };
}

/**
 * Adapter for any provider exposing the OpenAI Chat Completions API with
 * json_schema structured outputs (OpenAI, OpenRouter, ...).
 */
export function createOpenAICompatibleExtractor(
  options: OpenAICompatibleOptions
): ReceiptExtractor {
  const {
    provider,
    model,
    tokenLimitParam = "max_completion_tokens",
    supportsPdf = true,
  } = options;
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    defaultHeaders: options.defaultHeaders,
  });
  const supportedMimeTypes: readonly string[] = supportsPdf
    ? [...IMAGE_TYPES, ...DOCUMENT_TYPES]
    : IMAGE_TYPES;

  return {
    provider,
    model,
    supportedMimeTypes,

    async extract({ data, mimeType, prompt, jsonSchema }: ExtractInput) {
      if (!supportedMimeTypes.includes(mimeType)) {
        throw new LLMError("bad_request", provider, `Unsupported media type: ${mimeType}`);
      }

      let completion: OpenAI.Chat.ChatCompletion;
      try {
        completion = await client.chat.completions.create({
          model,
          [tokenLimitParam]: 4096,
          messages: [
            {
              role: "user",
              content: [
                toFilePart(mimeType, data.toString("base64")),
                { type: "text", text: prompt },
              ],
            },
          ],
          // Structured outputs: the response is constrained to jsonSchema
          response_format: {
            type: "json_schema",
            json_schema: { name: "receipt", strict: true, schema: jsonSchema },
          },
          ...options.extraBody,
        });
      } catch (error) {
        // Connection errors and timeouts extend APIError with no status
        const status = error instanceof OpenAI.APIError ? error.status : undefined;
        throw toLLMError(provider, error, status);
      }

      const choice = completion.choices[0];
      // Reasoning tokens count against the limit, so long receipts can truncate
      if (choice?.finish_reason === "length") {
        throw new LLMError("invalid_json", provider, "Response truncated at the output token limit");
      }

      const message = choice?.message;
      if (!message?.content) {
        const detail = message?.refusal ? `: ${message.refusal}` : "";
        throw new LLMError("empty_response", provider, `No text content in ${provider} response${detail}`);
      }

      return parseModelJson(message.content, provider);
    },
  };
}
