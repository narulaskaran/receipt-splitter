import Anthropic from "@anthropic-ai/sdk";
import { parseModelJson } from "../parse-json";
import {
  LLMError,
  llmErrorKindForStatus,
  type ExtractInput,
  type ReceiptExtractor,
} from "../types";

const PROVIDER = "anthropic";
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const DOCUMENT_TYPES = ["application/pdf"] as const;

type ImageMediaType = (typeof IMAGE_TYPES)[number];
type DocumentMediaType = (typeof DOCUMENT_TYPES)[number];

function isImageType(mimeType: string): mimeType is ImageMediaType {
  return (IMAGE_TYPES as readonly string[]).includes(mimeType);
}

function isDocumentType(mimeType: string): mimeType is DocumentMediaType {
  return (DOCUMENT_TYPES as readonly string[]).includes(mimeType);
}

function toFileBlock(
  mimeType: string,
  data: string
): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam {
  if (isImageType(mimeType)) {
    return { type: "image", source: { type: "base64", media_type: mimeType, data } };
  }
  if (isDocumentType(mimeType)) {
    return { type: "document", source: { type: "base64", media_type: mimeType, data } };
  }
  // Defensive: the route already rejects types outside supportedMimeTypes
  throw new LLMError("bad_request", PROVIDER, `Unsupported media type: ${mimeType}`);
}

function toLLMError(error: unknown): LLMError {
  // Connection errors and timeouts extend APIError with no status
  if (error instanceof Anthropic.APIError && error.status !== undefined) {
    return new LLMError(llmErrorKindForStatus(error.status), PROVIDER, error.message, {
      status: error.status,
      cause: error,
    });
  }
  const msg = error instanceof Error ? error.message : "Unknown Anthropic error";
  return new LLMError("unknown", PROVIDER, msg, { cause: error });
}

export function createAnthropicExtractor(options: {
  apiKey: string;
  model?: string;
}): ReceiptExtractor {
  const client = new Anthropic({ apiKey: options.apiKey });
  const model = options.model ?? DEFAULT_ANTHROPIC_MODEL;

  return {
    provider: PROVIDER,
    model,
    supportedMimeTypes: [...IMAGE_TYPES, ...DOCUMENT_TYPES],

    async extract({ data, mimeType, prompt, jsonSchema }: ExtractInput) {
      const fileBlock = toFileBlock(mimeType, data.toString("base64"));

      let message: Anthropic.Message;
      try {
        // Structured outputs: the response is constrained to jsonSchema
        message = await client.messages.create({
          model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [fileBlock, { type: "text", text: prompt }],
            },
          ],
          output_config: {
            format: { type: "json_schema", schema: jsonSchema },
          },
        });
      } catch (error) {
        throw toLLMError(error);
      }

      if (message.stop_reason === "max_tokens") {
        throw new LLMError("invalid_json", PROVIDER, "Response truncated at the output token limit");
      }

      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new LLMError("empty_response", PROVIDER, "No text content in Anthropic response");
      }

      return parseModelJson(textBlock.text, PROVIDER);
    },
  };
}
