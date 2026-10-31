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

/**
 * A parse that never reached a completed server response. `offlineLike`
 * covers WKWebView, where `navigator.onLine` can stay true. `retryable`
 * means the same file or link can be submitted again unchanged.
 *
 * The picked photo is not retained here. `FormData` may hold the only
 * `File`, and the caller (`ReceiptUploader`) drops it after showing this
 * error. A toast Retry action would have to live in that component and
 * resubmit the same `File`; it was left there so this module stays the
 * request boundary. Callers that still have the file can call `parseReceipt`
 * again.
 */
export class ParseReceiptError extends Error {
  readonly retryable: boolean;
  readonly offlineLike: boolean;

  constructor(
    message: string,
    options: { retryable: boolean; offlineLike: boolean },
  ) {
    super(message);
    this.name = "ParseReceiptError";
    this.retryable = options.retryable;
    this.offlineLike = options.offlineLike;
  }
}

export function isRetryableParseError(error: unknown): boolean {
  return error instanceof ParseReceiptError && error.retryable;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Failures that mean the upload was not accepted and can be tried again. */
function isOfflineLikeFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "NetworkError";
  }
  if (!(error instanceof Error)) return false;
  if (error.name === "NetworkError" || error.name === "TimeoutError") return true;
  return /failed to fetch|network error|internet connection appears to be offline|load failed/i.test(
    error.message,
  );
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
      throw new ParseReceiptError(TIMEOUT_ERROR, { retryable: true, offlineLike: true });
    }
    // fetch rejects when the request never reached the server. WKWebView
    // sometimes uses a TypeError ("Load failed") and sometimes a plain Error.
    if (isOfflineLikeFailure(error)) {
      console.error("Receipt upload request failed:", error);
      throw new ParseReceiptError(NETWORK_ERROR, { retryable: true, offlineLike: true });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 413) {
      throw new ParseReceiptError(
        `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Please compress your image or use a smaller file.`,
        { retryable: false, offlineLike: false },
      );
    }
    if (response.status === 429) {
      throw new ParseReceiptError(RATE_LIMIT_ERROR, { retryable: true, offlineLike: false });
    }
    throw new ParseReceiptError(await messageFromErrorResponse(response), {
      retryable: response.status >= 500,
      offlineLike: false,
    });
  }

  return response.json();
}
