import { NextRequest, NextResponse } from "next/server";
import {
  sendReceiptParsedNotification,
  sendErrorNotification,
  type ErrorNotificationContext,
} from "@/lib/webhook-notifications";
import { uploadReceiptFile } from "@/lib/uploadthing-storage";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { type GeolocationData } from "@/types";
import { fixMultiQuantityPrices } from "@/lib/receipt-utils";
import { isSupportedCurrency } from "@/lib/currency";
import {
  receiptSchema,
  receiptJsonSchema,
} from "@/lib/receipt-schema";
import {
  getReceiptExtractor,
  LLMConfigError,
  LLMError,
  RECEIPT_PROMPT,
  type ReceiptExtractor,
} from "@/lib/llm";

// Extract geolocation data from Vercel headers
function extractGeolocation(request: NextRequest): GeolocationData | null {
  const country = request.headers.get('x-vercel-ip-country');
  const region = request.headers.get('x-vercel-ip-country-region');
  const city = request.headers.get('x-vercel-ip-city');
  const latitude = request.headers.get('x-vercel-ip-latitude');
  const longitude = request.headers.get('x-vercel-ip-longitude');

  // Return null if no geo data is available (local dev without Vercel CLI)
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

// Map a failed LLM extraction to a webhook notification and HTTP response
function handleExtractError(
  error: unknown,
  extractor: ReceiptExtractor,
  errorContext: ErrorNotificationContext
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

  switch (kind) {
    case "rate_limit":
      sendErrorNotification("llm_rate_limit", `Rate limit exceeded: ${message}`, errorContext).catch(() => {});
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a few moments." },
        { status: 429 }
      );
    case "bad_request":
      sendErrorNotification("llm_bad_request", `Bad request to ${provider} API: ${message}`, errorContext).catch(() => {});
      return NextResponse.json(
        {
          error:
            "Invalid request format. Please ensure your file is a valid receipt image or PDF.",
        },
        { status: 400 }
      );
    case "auth":
      sendErrorNotification("llm_auth_error", `${provider} rejected the API key: ${message}`, errorContext).catch(() => {});
      return NextResponse.json(
        { error: "Server configuration error: LLM provider is not configured" },
        { status: 500 }
      );
    case "empty_response":
      sendErrorNotification("empty_response", message, errorContext).catch(() => {});
      return NextResponse.json(
        { error: "Failed to parse receipt. Please try again later." },
        { status: 500 }
      );
    case "invalid_json":
      sendErrorNotification("json_parse_error", `Failed to parse JSON response: ${message}`, errorContext).catch(() => {});
      return NextResponse.json(
        { error: "Failed to parse receipt. Please try again later." },
        { status: 500 }
      );
    case "api_error":
      sendErrorNotification("llm_api_error", `${provider} API error (${status}): ${message}`, errorContext).catch(() => {});
      break;
    case "unknown":
      sendErrorNotification("llm_unknown_error", message, errorContext).catch(() => {});
      break;
    default: {
      // Adding an LLMErrorKind without handling it here is a compile error
      const unhandled: never = kind;
      throw new Error(`Unhandled LLM error kind: ${String(unhandled)}`);
    }
  }

  return NextResponse.json(
    { error: "Failed to process receipt. Please try again later." },
    { status: 503 }
  );
}

// Helper function to format file size in MB
function formatFileSizeMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

export async function POST(request: NextRequest) {
  try {
    // Extract geolocation data from request headers
    const geolocation = extractGeolocation(request);

    // Resolve the configured LLM provider (validates its API key)
    let extractor: ReceiptExtractor;
    try {
      extractor = getReceiptExtractor();
    } catch (error) {
      if (!(error instanceof LLMConfigError)) throw error;
      console.error(error.message);
      sendErrorNotification("llm_config_error", error.message, { geolocation }).catch(() => {});
      return NextResponse.json(
        { error: "Server configuration error: LLM provider is not configured" },
        { status: 500 }
      );
    }

    // Get receipt image data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sessionId = (formData.get("sessionId") as string | null) || crypto.randomUUID();

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in the request" },
        { status: 400 }
      );
    }

    // Validate file size (Vercel serverless function body limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds the maximum limit of ${formatFileSizeMB(MAX_FILE_SIZE_BYTES)}MB`,
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const mimeType = file.type;

    console.log(`Processing file: ${file.name}, type: ${mimeType}, size: ${file.size} bytes`);

    if (!extractor.supportedMimeTypes.includes(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file format. Please use JPEG, PNG, GIF, WebP, or PDF.",
        },
        { status: 400 }
      );
    }

    // Error notification context — shared across error paths
    const llm = { provider: extractor.provider, model: extractor.model };
    const errorContext = { sessionId, fileName: file.name, mimeType, fileUrl: null as string | null, geolocation, llm };

    // Upload file to UploadThing storage BEFORE parsing
    // This ensures the file URL is available for both success and error notifications
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
          console.warn("[API] File upload failed, continuing without file URL:", uploadResult.error);
        }
      } catch (error) {
        // Upload errors shouldn't block processing - fileUrl stays null
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
      return handleExtractError(error, extractor, errorContext);
    }

    // Validate and normalize the model output
    try {
      const validationResult = receiptSchema.safeParse(parsedData);

      if (!validationResult.success) {
        console.error("Receipt validation failed:", validationResult.error);
        sendErrorNotification("zod_validation", `Zod validation failed: ${validationResult.error.message}`, errorContext).catch(() => {});
        return NextResponse.json(
          { error: "Failed to parse receipt. Please try again later." },
          { status: 500 }
        );
      }

      console.log("Successfully parsed receipt data");

      // Normalize receipt data to match Receipt type (ensure numeric fields are never null)
      // Filter out items with null prices (these are typically modifiers like "ADD CHEESE"
      // that don't have their own price - the cost is included in the parent item)
      const allItems = validationResult.data.items;
      const validItems = allItems.filter(
        (item): item is typeof item & { price: number } => item.price !== null
      );

      // Log filtered items for debugging/analytics
      const filteredItems = allItems.filter((item) => item.price === null);
      if (filteredItems.length > 0) {
        console.log(
          `Filtered out ${filteredItems.length} item(s) with null prices:`,
          filteredItems.map((item) => item.name)
        );
      }

      // Return error if all items were filtered out (receipt has no priced items)
      if (validItems.length === 0 && allItems.length > 0) {
        console.error(
          "All items filtered out - receipt contained only modifiers/items without prices"
        );
        return NextResponse.json(
          {
            error:
              "Could not find any items with prices on the receipt. The receipt may only contain modifiers or add-ons without individual prices.",
          },
          { status: 422 }
        );
      }

      const subtotalValue = validationResult.data.subtotal ?? 0;

      // Guard against unsupported currency codes: the model can return any ISO
      // code, but only currencies in src/lib/currency.ts have display/formatting
      // metadata. Fall back to USD (the documented default) to avoid a silent
      // financial mismatch between the raw code and USD formatting rules.
      let currency = validationResult.data.currency;
      if (!isSupportedCurrency(currency)) {
        console.warn(
          `[parse-receipt] Unsupported currency "${currency}" returned by the model; falling back to USD`
        );
        currency = "USD";
      }

      // Normalize items: ensure quantity defaults to 1
      const normalizedItems = validItems.map((item) => ({
        ...item,
        quantity: item.quantity ?? 1,
      }));

      // Cross-check items total against subtotal and auto-correct multi-quantity
      // price errors (LLM returned line total instead of per-unit price).
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

      // Send webhook notification after upload completes (success or failure)
      // The webhook receives fileUrl (URL if upload succeeded, null if it failed)
      if (process.env.WEBHOOK_URL) {
        try {
          await sendReceiptParsedNotification(
            normalizedReceipt,
            fileUrl,
            sessionId,
            file.name,
            file.type,
            geolocation,
            llm
          );
        } catch (error) {
          // Webhook errors are already logged in the function, this is a safety catch
          console.error("[API] Unexpected webhook error:", error);
        }
      }

      return NextResponse.json(normalizedReceipt);
    } catch (parseError) {
      const errorMsg =
        parseError instanceof Error ? parseError.message : "Unknown parse error";
      console.error("Failed to parse JSON response:", errorMsg);
      sendErrorNotification("json_parse_error", `Failed to parse JSON response: ${errorMsg}`, errorContext).catch(() => {});
      return NextResponse.json(
        {
          error: "Failed to parse receipt. Please try again later.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error processing receipt:", errorMessage);

    // Handle specific error types
    if (error instanceof TypeError && errorMessage.includes("FormData")) {
      return NextResponse.json(
        { error: "Invalid request format. Please upload a valid file." },
        { status: 400 }
      );
    }

    sendErrorNotification("unexpected_error", errorMessage).catch(() => {});
    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while processing your receipt. Please try again.",
      },
      { status: 500 }
    );
  }
}
