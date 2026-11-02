import { NextRequest } from "next/server";
import { handleParseReceipt } from "@/lib/parse-receipt-handler";

// A pasted link adds a Firecrawl screenshot (up to ~45s) before the LLM call
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handleParseReceipt(request, { apiVersion: "legacy" });
}
