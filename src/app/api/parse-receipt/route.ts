import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { sendReceiptParsedNotification } from "@/lib/webhook-notifications";
import { uploadReceiptFile } from "@/lib/uploadthing-storage";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { type GeolocationData } from "@/types";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

// Valid media types for Anthropic API
type ValidMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
type ValidDocumentType = "application/pdf";

// Helper function to format file size in MB
function formatFileSizeMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

// Zod schema for receipt validation
// Note: price is nullable to handle item modifiers (e.g., "ADD CHEESE") that don't have
// their own price listed on the receipt. These items are filtered out during normalization.
const receiptItemSchema = z.object({
  name: z.string(),
  price: z.number().nullable(),
  quantity: z.number().optional(),
});

const receiptSchema = z.object({
  restaurant: z.string().nullable(),
  date: z.string().nullable(),
  total: z.number().nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  tip: z.number().nullable(),
  items: z.array(receiptItemSchema),
  currency: z.string().optional().default('USD'),
});

/**
 * Detects and corrects the common LLM mis-parse where a multi-quantity line-item's
 * *line total* is returned as `price` instead of the per-unit price.
 *
 * Example: the receipt shows "7 Guinness Dft  $91.00" and the model outputs
 * price=91.00, quantity=7.  The frontend multiplies these, yielding $637 instead
 * of $91.  This function detects the discrepancy via the subtotal cross-check and
 * divides each affected item's price by its quantity to restore the per-unit value.
 *
 * The correction is only applied when:
 *   1. There is at least one item with quantity > 1.
 *   2. The current items total differs from the subtotal by more than 10 %.
 *   3. Dividing all multi-quantity item prices by their quantities brings the total
 *      at least 50 % closer to the subtotal (ensuring we don't over-correct).
 */
function fixMultiQuantityPrices(
  items: Array<{ name: string; price: number; quantity: number }>,
  subtotal: number
): { items: Array<{ name: string; price: number; quantity: number }>; corrected: boolean } {
  if (subtotal <= 0) return { items, corrected: false };

  const hasMultiQty = items.some((item) => (item.quantity || 1) > 1);
  if (!hasMultiQty) return { items, corrected: false };

  const currentTotal = items.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );
  const currentDiff = Math.abs(currentTotal - subtotal);

  // No meaningful mismatch — nothing to fix (allow 10% tolerance for discounts/rounding)
  if (currentDiff <= subtotal * 0.1) return { items, corrected: false };

  // Try treating every multi-quantity item's price as a line total (divide by qty)
  const corrected = items.map((item) => {
    const qty = item.quantity || 1;
    if (qty > 1) {
      return { ...item, price: item.price / qty };
    }
    return item;
  });

  const correctedTotal = corrected.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );
  const correctedDiff = Math.abs(correctedTotal - subtotal);

  // Only apply if correction achieves at least 50% improvement in the mismatch
  if (correctedDiff < currentDiff * 0.5) {
    return { items: corrected, corrected: true };
  }

  return { items, corrected: false };
}

export async function POST(request: NextRequest) {
  try {
    // Extract geolocation data from request headers
    const geolocation = extractGeolocation(request);

    // Validate API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY environment variable is not set");
      return NextResponse.json(
        { error: "Server configuration error: API key not found" },
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

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = file.type;

    console.log(`Processing file: ${file.name}, type: ${mimeType}, size: ${file.size} bytes`);

    // Validate mime type
    const validMediaTypes: ValidMediaType[] = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const validDocumentTypes: ValidDocumentType[] = ["application/pdf"];
    const isImage = validMediaTypes.includes(mimeType as ValidMediaType);
    const isPDF = validDocumentTypes.includes(mimeType as ValidDocumentType);

    if (!isImage && !isPDF) {
      return NextResponse.json(
        {
          error:
            "Unsupported file format. Please use JPEG, PNG, GIF, WebP, or PDF.",
        },
        { status: 400 }
      );
    }

    // Prepare content based on file type
    const promptText = `Parse this receipt and return a JSON object with the following structure:
              {
                "restaurant": "Name of the restaurant or store",
                "date": "Date of purchase in YYYY-MM-DD format",
                "total": "Total amount as number",
                "subtotal": "Subtotal amount as number",
                "tax": "Tax amount as number",
                "tip": "Tip amount as number (if included)",
                "currency": "ISO 4217 currency code (e.g., USD, EUR, GBP, JPY, CAD, AUD, etc.)",
                "items": [
                  {
                    "name": "Item name",
                    "price": "Per-unit price as number (NEVER the line total — see instructions below)",
                    "quantity": "Quantity as number (default to 1 if not specified)"
                  }
                ]
              }
              \nInstructions:\n- Detect the currency and return the 3-letter ISO 4217 code (USD, EUR, GBP, JPY, CAD, AUD, INR, CNY, etc.). Use the following priority:\n  1. Explicit currency codes on the receipt (e.g., "USD", "EUR")\n  2. Country/region indicators (e.g., "USA" or US address → USD, "Japan" or Japanese text → JPY, "China" or Chinese characters → CNY)\n  3. Language context as a last resort\n- For ambiguous cases:\n  - If the receipt appears to be from Japan (Japanese text, Japan address, etc.) → use JPY\n  - If the receipt appears to be from China (Chinese characters, China address, etc.) → use CNY\n  - If the receipt appears to be from the USA → use USD\n  - If the receipt appears to be from Canada → use CAD\n  - If the receipt appears to be from Australia → use AUD\n- If the currency cannot be determined with confidence, default to 'USD'\n- Return ONLY the 3-letter ISO 4217 code (e.g., 'JPY'), not the currency symbol or full name\n- CRITICAL — Per-unit pricing for multi-quantity items:\n  - The 'price' field must ALWAYS be the price for ONE unit, never the line total.\n  - If the receipt shows a line total for multiple units, divide to get the per-unit price.\n  - Example: receipt line "7 Guinness Dft  $91.00" → output {"name": "Guinness Dft", "price": 13.00, "quantity": 7} because $91.00 ÷ 7 = $13.00 per drink.\n  - Example: receipt line "2 Club Soda  $16.00" → output {"name": "Club Soda", "price": 8.00, "quantity": 2} because $16.00 ÷ 2 = $8.00 each.\n  - Do NOT output the line total as the price — the application will multiply price × quantity automatically.\n- After extracting all items, verify: the sum of (price × quantity) for all items should approximately equal the subtotal. If it does not, re-examine any multi-quantity items to confirm you used the per-unit price and not the line total.\n- Only include items that were actually purchased AND have a visible price on the receipt.\n- SKIP item modifiers or add-ons (like "ADD CHEESE", "EXTRA SAUCE", etc.) that don't have their own price listed - these costs are included in the parent item's price.\n- If you can't determine any field, use null.\n- Keep the item names exactly as they appear on the receipt.\n- Return ONLY the JSON with no explanations or additional text.`;

    const content: Array<
      | {
          type: "image";
          source: {
            type: "base64";
            media_type: ValidMediaType;
            data: string;
          };
        }
      | {
          type: "document";
          source: {
            type: "base64";
            media_type: ValidDocumentType;
            data: string;
          };
        }
      | { type: "text"; text: string }
    > = [];

    if (isImage) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as ValidMediaType,
          data: base64,
        },
      });
    } else if (isPDF) {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: mimeType as ValidDocumentType,
          data: base64,
        },
      });
    }

    content.push({
      type: "text",
      text: promptText,
    });

    // Call Anthropic with structured outputs (deterministic JSON via schema)
    let message;
    try {
      message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content,
          },
        ],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                restaurant: { type: ["string", "null"] },
                date: { type: ["string", "null"] },
                total: { type: ["number", "null"] },
                subtotal: { type: ["number", "null"] },
                tax: { type: ["number", "null"] },
                tip: { type: ["number", "null"] },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      price: { type: ["number", "null"] },
                      quantity: { type: "number" },
                    },
                    required: ["name", "price", "quantity"],
                  },
                },
              },
              required: ["restaurant", "date", "total", "subtotal", "tax", "tip", "items"],
            },
          },
        },
      });
    } catch (apiError: unknown) {
      console.error("Anthropic API error:", apiError);

      // Use API status codes for error detection
      if (apiError instanceof Anthropic.APIError) {
        if (apiError.status === 429) {
          return NextResponse.json(
            {
              error:
                "Rate limit exceeded. Please try again in a few moments.",
            },
            { status: 429 }
          );
        }

        if (apiError.status === 400) {
          return NextResponse.json(
            {
              error:
                "Invalid request format. Please ensure your file is a valid receipt image or PDF.",
            },
            { status: 400 }
          );
        }

        console.error("Anthropic API error details:", apiError.message, apiError.status);
      }

      return NextResponse.json(
        {
          error:
            "Failed to process receipt. Please try again later.",
        },
        { status: 503 }
      );
    }

    // Extract and parse the structured JSON response
    try {
      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        console.error("No text content in response");
        return NextResponse.json(
          { error: "Failed to parse receipt. Please try again later." },
          { status: 500 }
        );
      }

      // Strip code fences if present (safety fallback in case structured outputs
      // returns fenced JSON due to API version mismatch or model rollback)
      const jsonText = textBlock.text
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      const parsedData = JSON.parse(jsonText);
      const validationResult = receiptSchema.safeParse(parsedData);

      if (!validationResult.success) {
        console.error("Receipt validation failed:", validationResult.error);
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
        subtotal: subtotalValue,
        tax: validationResult.data.tax ?? 0,
        total: validationResult.data.total ?? 0,
        items: correctedItems,
      };

      // Upload file to UploadThing storage
      // This provides a public URL for the file that can be displayed in Slack
      // We await the upload to ensure it completes before sending the webhook
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
          if (!uploadResult.success) {
            console.warn("[API] File upload failed, continuing without file URL:", uploadResult.error);
          }
        } catch (error) {
          // Upload errors shouldn't block the webhook - fileUrl stays null
          console.error("[API] Unexpected upload error:", error);
        }
      }

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
            geolocation
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

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while processing your receipt. Please try again.",
      },
      { status: 500 }
    );
  }
}
