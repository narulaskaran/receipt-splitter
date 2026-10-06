/**
 * Provider-agnostic contract for the LLM call that turns a receipt file into
 * JSON. Adapters own everything provider-specific (request shape, structured
 * output mechanism, SDK error types); the parse-receipt route owns validation
 * and normalization so every provider gets the same safety nets.
 */

export interface ExtractInput {
  /** Raw file bytes */
  data: Buffer;
  /** One of the adapter's supportedMimeTypes */
  mimeType: string;
  prompt: string;
  /** JSON schema the model's output must conform to */
  jsonSchema: Record<string, unknown>;
}

export interface ReceiptExtractor {
  /** Short provider id, e.g. "anthropic" */
  readonly provider: string;
  readonly model: string;
  readonly supportedMimeTypes: readonly string[];
  /**
   * Returns the parsed JSON from the model. The result is unvalidated; callers
   * must run it through receiptSchema. Throws LLMError on failure.
   */
  extract(input: ExtractInput): Promise<unknown>;
}

export type LLMErrorKind =
  /** Provider rate limit (HTTP 429) */
  | "rate_limit"
  /** Provider rejected the request (HTTP 400), e.g. unreadable file */
  | "bad_request"
  /** Any other provider API error with a status code */
  | "api_error"
  /** Model returned no text content */
  | "empty_response"
  /** Model returned text that is not valid JSON */
  | "invalid_json"
  /** Network failure or anything else without a status */
  | "unknown";

export class LLMError extends Error {
  readonly kind: LLMErrorKind;
  readonly provider: string;
  readonly status?: number;

  constructor(
    kind: LLMErrorKind,
    provider: string,
    message: string,
    options?: { status?: number; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "LLMError";
    this.kind = kind;
    this.provider = provider;
    this.status = options?.status;
  }
}

/** Thrown when the selected provider is missing configuration (e.g. API key). */
export class LLMConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMConfigError";
  }
}
