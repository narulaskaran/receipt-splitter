// Turns a pasted receipt link into an image with Firecrawl's scrape API. The
// screenshot then goes through the same path as an uploaded photo (LLM,
// UploadThing, webhooks). Firecrawl's servers open the page, so this server
// never connects to the user's URL itself; it only calls Firecrawl and
// downloads the image Firecrawl returns.

import { MAX_FILE_SIZE_BYTES } from "./constants";
import { normalizeReceiptUrl } from "./receipt-url";

const DEFAULT_API_URL = "https://api.firecrawl.dev";
const SCRAPE_TIMEOUT_MS = 45_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ReceiptUrlErrorCode =
  | "invalid_url"
  | "not_found"
  | "access_denied"
  | "unreachable"
  | "no_screenshot"
  | "too_large"
  | "rate_limited"
  | "service_unavailable";

/** A link that couldn't be turned into an image. `message` is safe to show users. */
export class ReceiptUrlError extends Error {
  constructor(
    readonly code: ReceiptUrlErrorCode,
    message: string,
    /** HTTP status the API should answer with */
    readonly status: number,
    /** Server-side detail for logs and webhooks; never shown to users */
    readonly detail?: string
  ) {
    super(message);
    this.name = "ReceiptUrlError";
  }
}

export interface ReceiptScreenshot {
  data: Buffer;
  mimeType: string;
}

function unavailable(detail: string): ReceiptUrlError {
  return new ReceiptUrlError(
    "service_unavailable",
    "Reading links is unavailable right now. Please upload a screenshot instead.",
    503,
    detail
  );
}

function isTimeout(error: unknown): boolean {
  // By name: errors from fetch internals can come from another realm (jest)
  const name = (error as { name?: string } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

interface ScrapeResponse {
  success?: boolean;
  error?: string;
  data?: {
    screenshot?: string;
    metadata?: { statusCode?: number; error?: string };
  };
}

async function requestScreenshotUrl(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const apiUrl = process.env.FIRECRAWL_API_URL || DEFAULT_API_URL;

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/v2/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Firecrawl also answers keyless requests, at lower rate limits
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        url,
        formats: [{ type: "screenshot", fullPage: true, quality: 80 }],
      }),
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new ReceiptUrlError("unreachable", "That link took too long to load.", 504);
    }
    throw unavailable(`Firecrawl request failed: ${String(error)}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw unavailable(`Firecrawl rejected the API key (${response.status})`);
  }
  if (response.status === 402) {
    throw unavailable("Firecrawl is out of credits (402)");
  }
  if (response.status === 429) {
    throw new ReceiptUrlError(
      "rate_limited",
      "Too many links are being read right now. Please try again in a minute.",
      429,
      "Firecrawl rate limit (429)"
    );
  }

  const body = (await response.json().catch(() => null)) as ScrapeResponse | null;

  if (!response.ok || !body?.success) {
    // Firecrawl reports pages it can't scrape (blocked sites, bad URLs) here
    throw new ReceiptUrlError(
      "unreachable",
      "Couldn't open that link.",
      response.status >= 500 ? 502 : 422,
      `Firecrawl error (${response.status}): ${body?.error ?? "no detail"}`
    );
  }

  // HTTP 200 + success only means Firecrawl ran; the page has its own status
  const pageStatus = body.data?.metadata?.statusCode;
  if (pageStatus === 404 || pageStatus === 410) {
    throw new ReceiptUrlError("not_found", "That link doesn't exist anymore.", 404);
  }
  if (pageStatus === 401 || pageStatus === 403) {
    throw new ReceiptUrlError(
      "access_denied",
      "That link needs a login or blocks automated access. Screenshot the receipt and upload it instead.",
      422
    );
  }
  if (pageStatus && pageStatus >= 400) {
    throw new ReceiptUrlError(
      "unreachable",
      `That link returned an error (${pageStatus}).`,
      502
    );
  }

  const screenshot = body.data?.screenshot;
  if (!screenshot) {
    throw new ReceiptUrlError(
      "no_screenshot",
      "Couldn't capture that page. Screenshot the receipt and upload it instead.",
      422,
      "Firecrawl returned no screenshot"
    );
  }
  return screenshot;
}

async function downloadScreenshot(screenshotUrl: string): Promise<ReceiptScreenshot> {
  if (!screenshotUrl.startsWith("https://")) {
    throw unavailable("Firecrawl returned a non-https screenshot URL");
  }

  let response: Response;
  try {
    response = await fetch(screenshotUrl, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    throw unavailable(`Screenshot download failed: ${String(error)}`);
  }
  if (!response.ok) {
    throw unavailable(`Screenshot download returned ${response.status}`);
  }

  const mimeType = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!IMAGE_TYPES.has(mimeType)) {
    throw unavailable(`Screenshot had unexpected content type: ${mimeType || "none"}`);
  }

  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_FILE_SIZE_BYTES) {
    throw new ReceiptUrlError("too_large", "That page is too long to capture.", 413);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > MAX_FILE_SIZE_BYTES) {
    throw new ReceiptUrlError("too_large", "That page is too long to capture.", 413);
  }
  return { data, mimeType };
}

/**
 * Screenshot the full page behind a pasted link. Throws ReceiptUrlError with a
 * user-facing message and HTTP status for anything that goes wrong.
 */
export async function screenshotReceiptUrl(rawUrl: string): Promise<ReceiptScreenshot> {
  const url = normalizeReceiptUrl(rawUrl);
  if (!url) {
    throw new ReceiptUrlError("invalid_url", "That doesn't look like a link.", 400);
  }
  return downloadScreenshot(await requestScreenshotUrl(url));
}
