import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TextBlock } from "@anthropic-ai/sdk/resources";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Valid media types for Anthropic API
type ValidMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function POST(request: NextRequest) {
  try {
    // Validate API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Anthropic API key is not configured" },
        { status: 500 }
      );
    }

    // Get receipt image data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = file.type;

    // Validate mime type
    const validMediaTypes: ValidMediaType[] = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validMediaTypes.includes(mimeType as ValidMediaType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported image format. Please use JPEG, PNG, GIF, or WebP.",
        },
        { status: 400 }
      );
    }

    // Call Anthropic with the image
    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as ValidMediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: `Parse this receipt image and return a JSON object with the following structure:
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
              \nInstructions for items:\n- If the receipt lists a line item with a quantity greater than 1, and shows a total price for that line, divide the total price by the quantity to get the per-unit price, and use that value for the 'price' field.\n- Do NOT multiply the price by the quantity in the output.\n- The 'price' field should always be the price for a single unit, even if the receipt shows a total for multiple units.\n- Only include items that were actually purchased.\n- If you can't determine any field, use null.\n- Keep the item names exactly as they appear on the receipt.\n- Return ONLY the JSON with no explanations or additional text.`,
            },
          ],
        },
      ],
    });

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
      return NextResponse.json(
        { error: "No text response received from Claude" },
        { status: 500 }
      );
    }

    // Try to parse the JSON
    try {
      const parsedData = JSON.parse(jsonText);
      return NextResponse.json(parsedData);
    } catch {
      console.error("Failed to parse JSON from Claude response:", jsonText);
      return NextResponse.json(
        { error: "Failed to parse receipt data" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing receipt:", error);
    return NextResponse.json(
      { error: "Failed to process receipt" },
      { status: 500 }
    );
  }
}
