import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TextBlock } from "@anthropic-ai/sdk/resources";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Valid media types for Anthropic API
type ValidMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
type ValidDocumentType = "application/pdf";

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

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in the request" },
        { status: 400 }
      );
    }

    // Validate file size (limit to 20MB)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
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
              \nInstructions for items:\n- If the receipt lists a line item with a quantity greater than 1, and shows a total price for that line, divide the total price by the quantity to get the per-unit price, and use that value for the 'price' field.\n- Do NOT multiply the price by the quantity in the output.\n- The 'price' field should always be the price for a single unit, even if the receipt shows a total for multiple units.\n- Only include items that were actually purchased.\n- If you can't determine any field, use null.\n- Keep the item names exactly as they appear on the receipt.\n- Return ONLY the JSON with no explanations or additional text.`;

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
      const errorMessage =
        apiError instanceof Error ? apiError.message : "Unknown API error";
      console.error("Anthropic API error:", errorMessage);

      // Check for specific API errors
      if (errorMessage.includes("rate_limit")) {
        return NextResponse.json(
          {
            error:
              "Rate limit exceeded. Please try again in a few moments.",
          },
          { status: 429 }
        );
      }

      if (errorMessage.includes("invalid_request")) {
        return NextResponse.json(
          {
            error:
              "Invalid request format. Please ensure your file is a valid receipt image or PDF.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error:
            "Failed to communicate with AI service. Please try again later.",
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
      console.error("No text content in Claude response");
      return NextResponse.json(
        { error: "No text response received from AI service" },
        { status: 500 }
      );
    }

    // Try to parse the JSON
    try {
      const parsedData = JSON.parse(jsonText);

      // Validate that parsed data has expected structure
      if (typeof parsedData !== "object" || parsedData === null) {
        console.error("Parsed data is not a valid object");
        return NextResponse.json(
          { error: "Invalid receipt data format received" },
          { status: 500 }
        );
      }

      console.log("Successfully parsed receipt data");
      return NextResponse.json(parsedData);
    } catch (parseError) {
      const errorMsg =
        parseError instanceof Error ? parseError.message : "Unknown parse error";
      console.error("Failed to parse JSON from Claude response:", errorMsg);
      console.error("Response text:", jsonText.substring(0, 200)); // Log first 200 chars
      return NextResponse.json(
        {
          error:
            "The AI service returned an unexpected format. Please try with a clearer receipt image.",
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
