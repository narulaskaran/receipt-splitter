import { NextRequest, NextResponse } from "next/server";
import {
  sendReceiptParsedNotification,
  sendErrorNotification,
  type ErrorNotificationContext,
} from "@/lib/webhook-notifications";
import { summarizeZodValidationForWebhook } from "@/lib/error-webhook-summary";
import { uploadReceiptFile } from "@/lib/uploadthing-storage";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { type GeolocationData } from "@/types";
import { fixMultiQuantityPrices } from "@/lib/receipt-utils";
import { screenshotReceiptUrl, ReceiptUrlError } from "@/lib/receipt-screenshot";
import { normalizeReceiptUrl } from "@/lib/receipt-url";
import { DEFAULT_CURRENCY, isSupportedCurrency } from "@/lib/currency";
import { receiptSchema, receiptJsonSchema } from "@/lib/receipt-schema";
import {
  getReceiptExtractor,
  LLMConfigError,
  LLMError,
  RECEIPT_PROMPT,
  type ReceiptExtractor,
} from "@/lib/llm";
import { withV1Cors, v1PreflightResponse } from "@/lib/api-cors";
import { parseClientMetadata, type ClientMetadata } from "@/lib/client-metadata";

export type ParseReceiptApiVersion = "legacy" | 1;

export interface HandleParseReceiptOptions {
  apiVersion: ParseReceiptApiVersion;
}

function extractGeolocation(request: NextRequest): GeolocationData | null {
  const country = request.headers.get("x-vercel-ip-country");
  const region = request.headers.get("x-vercel-ip-country-region");
  const city = request.headers.get("x-vercel-ip-city");
  const latitude = request.headers.get("x-vercel-ip-latitude");
  const longitude = request.headers.get("x-vercel-ip-longitude");

  if (!country && !region && !city) {
    return null;
  }

  return {
    country: country || null,
    region: region || null,
    city: city || null,
    latitude: latitude || null,
    longitude: longitude || null,
  };
}

function buildJsonResponse(
  apiVersion: ParseReceiptApiVersion,
  origin: string | null,
  body: Record<string, unknown>,
  status: number,
  responseHeaders?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(body, {
    status,
    headers: responseHeaders,
  });
  if (apiVersion === 1) {
    return withV1Cors(response, origin, responseHeaders);
  }
  return response;
}

function errorPayload(
  apiVersion: ParseReceiptApiVersion,
  message: string,
  code?: string
): Record<string, unknown> {
  if (apiVersion === 1 && code) {
    return { error: message, code };
  }
  return { error: message };
}

function mergeClientIntoContext(
  context: ErrorNotificationContext,
  client: ClientMetadata
): ErrorNotificationContext {
  return {
    ...context,
    clientPlatform: client.platform,
    clientVersion: client.version,
  };
}

function handleExtractError(
  error: unknown,
  extractor: ReceiptExtractor,
  errorContext: ErrorNotificationContext,
  apiVersion: ParseReceiptApiVersion,
  origin: string | null
): NextResponse {
  const { provider } = extractor;
  const llmError =
    error instanceof LLMError
      ? error
      : new LLMError(
          "unknown",
          provider,
          error instanceof Error ? error.message : "Unknown LLM error",
          { cause: error }
        );
  const { kind, message, status } = llmError;
  console.error(`LLM extraction failed (${provider}, ${kind}):`, error);

  const ctx = errorContext;

  switch (kind) {
    case "rate_limit":
      sendErrorNotification(
        "llm_rate_limit",
        `Rate limit exceeded: ${message}`,
        ctx
      ).catch(() => {});
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "Rate limit exceeded. Please try again in a few moments.",
          "rate_limited"
        ),
        429,
        apiVersion === 1 ? { "Retry-After": "60" } : undefined
      );
    case "bad_request":
      sendErrorNotification(
        "llm_bad_request",
        `Bad request to ${provider} API: ${message}`,
        ctx
      ).catch(() => {});
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "Invalid request format. Please ensure your file is a valid receipt image or PDF.",
          "bad_request"
        ),
        400
      );
    case "auth":
      sendErrorNotification(
        "llm_auth_error",
        `${provider} auth or billing error (${status}): ${message}`,
        ctx
      ).catch(() => {});
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "Server configuration error: LLM provider is not configured",
          "llm_not_configured"
        ),
        500
      );
    case "empty_response":
      sendErrorNotification("empty_response", message, ctx).catch(() => {});
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "Failed to parse receipt. Please try again later.",
          "parse_failed"
        ),
        500
      );
    case "invalid_json":
      sendErrorNotification(
        "json_parse_error",
        `Failed to parse JSON response: ${message}`,
        ctx
      ).catch(() => {});
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "Failed to parse receipt. Please try again later.",
          "parse_failed"
        ),
        500
      );
    case "api_error":
      sendErrorNotification(
        "llm_api_error",
        `${provider} API error (${status}): ${message}`,
        ctx
      ).catch(() => {});
      break;
    case "unknown":
      sendErrorNotification("llm_unknown_error", message, ctx).catch(() => {});
      break;
    default: {
      const unhandled: never = kind;
      throw new Error(`Unhandled LLM error kind: ${String(unhandled)}`);
    }
  }

  return buildJsonResponse(
    apiVersion,
    origin,
    errorPayload(
      apiVersion,
      "Failed to process receipt. Please try again later.",
      "parse_failed"
    ),
    503
  );
}

async function fileFromReceiptUrl(rawUrl: string): Promise<File> {
  const { data, mimeType } = await screenshotReceiptUrl(rawUrl);
  const host = new URL(normalizeReceiptUrl(rawUrl) ?? "https://link").hostname;
  return new File([new Uint8Array(data)], `${host}.${mimeType.split("/")[1]}`, {
    type: mimeType,
  });
}

export function handleParseReceiptOptions(request: NextRequest): NextResponse {
  return v1PreflightResponse(request.headers.get("origin"));
}

export async function handleParseReceipt(
  request: NextRequest,
  { apiVersion }: HandleParseReceiptOptions
): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  const client = parseClientMetadata(request);

  try {
    const geolocation = extractGeolocation(request);

    let extractor: ReceiptExtractor;
    try {
      extractor = getReceiptExtractor();
    } catch (error) {
      if (!(error instanceof LLMConfigError)) throw error;
      console.error(error.message);
      sendErrorNotification(
        "llm_config_error",
        error.message,
        mergeClientIntoContext({ geolocation }, client)
      ).catch(() => {});
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "Server configuration error: LLM provider is not configured",
          "llm_not_configured"
        ),
        500
      );
    }

    const formData = await request.formData();
    let file = formData.get("file") as File | null;
    const sessionId =
      (formData.get("sessionId") as string | null) || crypto.randomUUID();

    const receiptUrl = formData.get("url");
    let sourceUrl: string | null = null;
    if (!file && typeof receiptUrl === "string" && receiptUrl.trim()) {
      sourceUrl =
        normalizeReceiptUrl(receiptUrl) ?? receiptUrl.trim().slice(0, 500);
      try {
        file = await fileFromReceiptUrl(receiptUrl);
      } catch (error) {
        if (!(error instanceof ReceiptUrlError)) throw error;
        console.warn(
          `Receipt link failed (${error.code}): ${error.detail ?? error.message}`
        );
        sendErrorNotification(
          `url_${error.code}`,
          error.detail ?? error.message,
          mergeClientIntoContext(
            {
              sessionId,
              fileName: sourceUrl,
              sourceUrl,
              geolocation,
              llm: { provider: extractor.provider, model: extractor.model },
            },
            client
          )
        ).catch(() => {});
        const linkCode =
          apiVersion === 1 ? error.code : undefined;
        return buildJsonResponse(
          apiVersion,
          origin,
          errorPayload(apiVersion, error.message, linkCode),
          error.status
        );
      }
    }

    if (!file) {
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "No file or link provided in the request",
          "no_input"
        ),
        400
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          `File size exceeds the maximum limit of ${MAX_FILE_SIZE_MB}MB`,
          "file_too_large"
        ),
        400
      );
    }

    if (file.size === 0) {
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(apiVersion, "Uploaded file is empty", "empty_file"),
        400
      );
    }

    const buffer = await file.arrayBuffer();
    const mimeType = file.type;

    console.log(
      `Processing file: ${file.name}, type: ${mimeType}, size: ${file.size} bytes`
    );

    if (!extractor.supportedMimeTypes.includes(mimeType)) {
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "Unsupported file format. Please use JPEG, PNG, GIF, WebP, or PDF.",
          "unsupported_type"
        ),
        400
      );
    }

    const llm = { provider: extractor.provider, model: extractor.model };
    const errorContext: ErrorNotificationContext = mergeClientIntoContext(
      {
        sessionId,
        fileName: file.name,
        mimeType,
        fileUrl: null as string | null,
        geolocation,
        llm,
        sourceUrl,
      },
      client
    );

    let fileUrl: string | null = null;
    if (process.env.UPLOADTHING_TOKEN) {
      try {
        const uploadResult = await uploadReceiptFile(
          Buffer.from(buffer),
          file.name,
          file.type,
          sessionId
        );
        fileUrl = uploadResult.url;
        errorContext.fileUrl = fileUrl;
        if (!uploadResult.success) {
          console.warn(
            "[API] File upload failed, continuing without file URL:",
            uploadResult.error
          );
        }
      } catch (error) {
        console.error("[API] Unexpected upload error:", error);
      }
    }

    let parsedData: unknown;
    try {
      parsedData = await extractor.extract({
        data: Buffer.from(buffer),
        mimeType,
        prompt: RECEIPT_PROMPT,
        jsonSchema: receiptJsonSchema,
      });
    } catch (error) {
      return handleExtractError(
        error,
        extractor,
        errorContext,
        apiVersion,
        origin
      );
    }

    try {
      const validationResult = receiptSchema.safeParse(parsedData);

      if (!validationResult.success) {
        console.error("Receipt validation failed:", validationResult.error);
        sendErrorNotification(
          "zod_validation",
          summarizeZodValidationForWebhook(validationResult.error),
          errorContext
        ).catch(() => {});
        return buildJsonResponse(
          apiVersion,
          origin,
          errorPayload(
            apiVersion,
            "Failed to parse receipt. Please try again later.",
            "parse_failed"
          ),
          500
        );
      }

      console.log("Successfully parsed receipt data");

      const allItems = validationResult.data.items;
      const validItems = allItems.filter(
        (item): item is typeof item & { price: number } => item.price !== null
      );

      const filteredItems = allItems.filter((item) => item.price === null);
      if (filteredItems.length > 0) {
        console.log(
          `Filtered out ${filteredItems.length} item(s) with null prices:`,
          filteredItems.map((item) => item.name)
        );
      }

      if (validItems.length === 0 && allItems.length > 0) {
        console.error(
          "All items filtered out - receipt contained only modifiers/items without prices"
        );
        return buildJsonResponse(
          apiVersion,
          origin,
          errorPayload(
            apiVersion,
            "Could not find any items with prices on the receipt. The receipt may only contain modifiers or add-ons without individual prices.",
            "no_priced_items"
          ),
          422
        );
      }

      const subtotalValue = validationResult.data.subtotal ?? 0;

      let currency = validationResult.data.currency;
      if (!isSupportedCurrency(currency)) {
        console.warn(
          `[parse-receipt] Unsupported currency "${currency}" returned by the model; falling back to USD`
        );
        currency = DEFAULT_CURRENCY;
      }

      const normalizedItems = validItems.map((item) => ({
        ...item,
        quantity: item.quantity ?? 1,
      }));

      const { items: correctedItems, corrected: pricesCorrected } =
        fixMultiQuantityPrices(normalizedItems, subtotalValue);
      if (pricesCorrected) {
        console.log(
          "[parse-receipt] Auto-corrected multi-quantity item prices: " +
            "model returned line totals instead of per-unit prices. " +
            `Affected items: ${correctedItems.filter((_, i) => normalizedItems[i].price !== correctedItems[i].price).map((item) => item.name).join(", ")}`
        );
      }

      const normalizedReceipt = {
        ...validationResult.data,
        currency,
        subtotal: subtotalValue,
        tax: validationResult.data.tax ?? 0,
        fees: validationResult.data.fees ?? null,
        total: validationResult.data.total ?? 0,
        items: correctedItems,
      };

      if (process.env.WEBHOOK_URL) {
        try {
          const webhookArgs = [
            normalizedReceipt,
            fileUrl,
            sessionId,
            file.name,
            file.type,
            geolocation,
            llm,
            sourceUrl,
          ] as const;
          if (client.platform || client.version) {
            await sendReceiptParsedNotification(
              ...webhookArgs,
              client.platform,
              client.version
            );
          } else {
            await sendReceiptParsedNotification(...webhookArgs);
          }
        } catch (error) {
          console.error("[API] Unexpected webhook error:", error);
        }
      }

      const response = NextResponse.json(normalizedReceipt);
      if (apiVersion === 1) {
        return withV1Cors(response, origin);
      }
      return response;
    } catch (parseError) {
      const errorMsg =
        parseError instanceof Error ? parseError.message : "Unknown parse error";
      console.error("Failed to parse JSON response:", errorMsg);
      sendErrorNotification(
        "json_parse_error",
        "Failed to parse model JSON response",
        errorContext
      ).catch(() => {});
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "Failed to parse receipt. Please try again later.",
          "parse_failed"
        ),
        500
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error processing receipt:", errorMessage);

    if (error instanceof TypeError && errorMessage.includes("FormData")) {
      return buildJsonResponse(
        apiVersion,
        origin,
        errorPayload(
          apiVersion,
          "Invalid request format. Please upload a valid file.",
          "bad_request"
        ),
        400
      );
    }

    sendErrorNotification(
      "unexpected_error",
      errorMessage,
      mergeClientIntoContext({}, client)
    ).catch(() => {});
    return buildJsonResponse(
      apiVersion,
      origin,
      errorPayload(
        apiVersion,
        "An unexpected error occurred while processing your receipt. Please try again.",
        "unexpected"
      ),
      500
    );
  }
}
