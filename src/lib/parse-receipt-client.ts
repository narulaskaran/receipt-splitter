import { apiUrl, getAppConfig, PARSE_RECEIPT_PATH } from "@/lib/app-config";
import { MAX_FILE_SIZE_MB } from "@/lib/constants";
import { getSessionId } from "@/lib/session";
import { type Receipt } from "@/types";

/** Firecrawl screenshots plus the model call can approach the route's 60s limit. */
export const PARSE_RECEIPT_TIMEOUT_MS = 65_000;

const NETWORK_ERROR =
  "Couldn't reach the server. Check your connection and try again.";
const TIMEOUT_ERROR = "This is taking too long. Please try again.";
const RATE_LIMIT_ERROR = "Too many requests, try again in a few minutes.";
const GENERIC_ERROR = "Failed to parse receipt";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function messageFromErrorResponse(response: Response): Promise<string> {
  let raw = "";
  try {
    raw = await response.text();
  } catch {
    return GENERIC_ERROR;
  }

  const trimmed = raw.trim();
  if (!trimmed) return GENERIC_ERROR;

  try {
    const data = JSON.parse(trimmed) as { error?: unknown; code?: unknown };
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // HTML or plain text from a proxy — never show that to the user.
    return GENERIC_ERROR;
  }

  return GENERIC_ERROR;
}

/**
 * POST a receipt file or pasted link. The caller builds the FormData
 * (`file` or `url`); this adds the session id and client headers.
 */
export async function parseReceipt(formData: FormData): Promise<Receipt> {
  formData.append("sessionId", getSessionId());

  const { platform, appVersion } = getAppConfig();
  const headers: Record<string, string> = {
    "X-Client-Platform": platform,
  };
  if (appVersion) {
    headers["X-Client-Version"] = appVersion;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PARSE_RECEIPT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(apiUrl(PARSE_RECEIPT_PATH), {
      method: "POST",
      body: formData,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(TIMEOUT_ERROR);
    }
    // fetch rejects with a TypeError when the request never reached the server
    if (error instanceof TypeError) {
      console.error("Receipt upload request failed:", error);
      throw new Error(NETWORK_ERROR);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error(
        `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Please compress your image or use a smaller file.`
      );
    }
    if (response.status === 429) {
      throw new Error(RATE_LIMIT_ERROR);
    }
    throw new Error(await messageFromErrorResponse(response));
  }

  return response.json();
}
