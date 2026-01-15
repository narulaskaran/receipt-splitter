import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TextBlock } from "@anthropic-ai/sdk/resources";
import { z } from "zod";
import { sendReceiptParsedNotification } from "@/lib/webhook-notifications";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
});

export async function POST(request: NextRequest) {
  try {
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
                "items": [
                  {
                    "name": "Item name",
                    "price": "Item price as number (this should always be the price for a single unit, not the total for all units)",
                    "quantity": "Quantity as number (default to 1 if not specified)"
                  }
                ]
              }
              \nInstructions for items:\n- If the receipt lists a line item with a quantity greater than 1, and shows a total price for that line, divide the total price by the quantity to get the per-unit price, and use that value for the 'price' field.\n- Do NOT multiply the price by the quantity in the output.\n- The 'price' field should always be the price for a single unit, even if the receipt shows a total for multiple units.\n- Only include items that were actually purchased AND have a visible price on the receipt.\n- SKIP item modifiers or add-ons (like "ADD CHEESE", "EXTRA SAUCE", etc.) that don't have their own price listed - these costs are included in the parent item's price.\n- If you can't determine any field, use null.\n- Keep the item names exactly as they appear on the receipt.\n- Return ONLY the JSON with no explanations or additional text.`;

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

    // Call Anthropic with the file
    let message;
    try {
      message = await anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content,
          },
        ],
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

    // Extract the JSON from the response and handle potential type issues
    let jsonText = "";

    // Safely get text content from the response
    for (const block of message.content) {
      if (block.type === "text") {
        jsonText = (block as TextBlock).text;
        break;
      }
    }

    if (!jsonText) {
      console.error("No text content in response");
      return NextResponse.json(
        { error: "Failed to parse receipt. Please try again later." },
        { status: 500 }
      );
    }

    // Try to parse the JSON
    try {
      const parsedData = JSON.parse(jsonText);

      // Validate receipt data structure using Zod
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

      const normalizedReceipt = {
        ...validationResult.data,
        subtotal: validationResult.data.subtotal ?? 0,
        tax: validationResult.data.tax ?? 0,
        total: validationResult.data.total ?? 0,
        items: validItems.map((item) => ({
          ...item,
          quantity: item.quantity ?? 1,
        })),
      };

      // Send webhook notification (awaited to prevent race condition in serverless)
      // The webhook has a 5-second timeout, so this adds minimal latency (~100-500ms typically)
      if (process.env.WEBHOOK_URL) {
        try {
          await sendReceiptParsedNotification(
            normalizedReceipt,
            null, // fileUrl - will be added when Supabase integration is complete
            sessionId,
            file.name,
            file.type
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
      console.error("Response text:", jsonText.substring(0, 200)); // Log first 200 chars
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
