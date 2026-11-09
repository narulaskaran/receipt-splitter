import { NextRequest } from "next/server";
import {
  handleParseReceipt,
  handleParseReceiptOptions,
} from "@/lib/parse-receipt-handler";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handleParseReceipt(request, { apiVersion: 1 });
}

export async function OPTIONS(request: NextRequest) {
  return handleParseReceiptOptions(request);
}
