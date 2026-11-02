/**
 * @jest-environment node
 */
jest.mock("@/lib/webhook-notifications", () => ({
  sendReceiptParsedNotification: jest.fn(),
  sendErrorNotification: jest.fn(),
}));
jest.mock("@/lib/uploadthing-storage", () => ({
  uploadReceiptFile: jest.fn(),
}));
jest.mock("@/lib/receipt-screenshot", () => ({
  ...jest.requireActual("@/lib/receipt-screenshot"),
  screenshotReceiptUrl: jest.fn(),
}));
jest.mock("@/lib/llm", () => ({
  ...jest.requireActual("@/lib/llm"),
  getReceiptExtractor: jest.fn(),
}));

import { POST, OPTIONS } from "@/app/api/v1/parse-receipt/route";
import { POST as legacyPOST } from "@/app/api/parse-receipt/route";
import {
  getReceiptExtractor,
  LLMConfigError,
  LLMError,
  RECEIPT_PROMPT,
} from "@/lib/llm";
import { receiptJsonSchema } from "@/lib/receipt-schema";
import { sendErrorNotification } from "@/lib/webhook-notifications";

const mockExtract = jest.fn();
const mockGetReceiptExtractor = getReceiptExtractor as jest.Mock;

function makeRequestWithFile(
  type = "image/png",
  headers: Record<string, string> = {}
) {
  const fd = new FormData();
  fd.append("file", new File(["fake-image-bytes"], "receipt.png", { type }));
  fd.append("sessionId", "test-session");
  return {
    formData: async () => fd,
    headers: new Headers(headers),
  } as unknown as Parameters<typeof POST>[0];
}

function modelResponse(overrides: Record<string, unknown> = {}) {
  return {
    restaurant: "Cafe de Paris",
    date: "2026-08-01",
    total: 24.5,
    subtotal: 20.0,
    tax: 2.0,
    tip: 2.5,
    currency: "EUR",
    items: [{ name: "Croissant", price: 4.0, quantity: 2 }],
    ...overrides,
  };
}

beforeEach(() => {
  delete process.env.NATIVE_APP_ORIGINS;
  mockExtract.mockReset();
  mockGetReceiptExtractor.mockReset().mockReturnValue({
    provider: "anthropic",
    model: "test-model",
    supportedMimeTypes: ["image/png", "application/pdf"],
    extract: mockExtract,
  });
  (sendErrorNotification as jest.Mock).mockReset().mockResolvedValue(undefined);
});

describe("v1 parse-receipt CORS preflight", () => {
  it("returns 204 with CORS headers for capacitor://localhost", async () => {
    const res = await OPTIONS({
      headers: new Headers({ Origin: "capacitor://localhost" }),
    } as unknown as Parameters<typeof OPTIONS>[0]);

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "capacitor://localhost"
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS"
    );
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "X-Client-Platform"
    );
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("allows extra origins from NATIVE_APP_ORIGINS", async () => {
    process.env.NATIVE_APP_ORIGINS = "myapp://custom";
    const res = await OPTIONS({
      headers: new Headers({ Origin: "myapp://custom" }),
    } as unknown as Parameters<typeof OPTIONS>[0]);

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "myapp://custom"
    );
  });

  it("returns 403 without CORS headers for disallowed origins", async () => {
    const res = await OPTIONS({
      headers: new Headers({ Origin: "https://evil.example" }),
    } as unknown as Parameters<typeof OPTIONS>[0]);

    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(await res.json()).toEqual({ error: "Origin not allowed" });
  });
});

describe("v1 parse-receipt POST", () => {
  it("returns success with v1 CORS and API version headers", async () => {
    mockExtract.mockResolvedValue(modelResponse());

    const res = await POST(
      makeRequestWithFile("image/png", {
        Origin: "capacitor://localhost",
        "X-Client-Platform": "ios",
        "X-Client-Version": "1.0.0",
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "capacitor://localhost"
    );
    expect(res.headers.get("X-API-Version")).toBe("1");
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
      "X-API-Version"
    );
    expect(res.headers.get("Vary")).toBe("Origin");
    expect((await res.json()).restaurant).toBe("Cafe de Paris");
  });

  it("includes machine-readable code on no_input errors", async () => {
    const res = await POST({
      formData: async () => new FormData(),
      headers: new Headers({ Origin: "capacitor://localhost" }),
    } as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "No file or link provided in the request",
      code: "no_input",
    });
    expect(res.headers.get("X-API-Version")).toBe("1");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "capacitor://localhost"
    );
  });

  it("maps LLM misconfiguration to llm_not_configured with CORS", async () => {
    mockGetReceiptExtractor.mockImplementation(() => {
      throw new LLMConfigError("missing key");
    });

    const res = await POST(
      makeRequestWithFile("image/png", {
        Origin: "capacitor://localhost",
      })
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Server configuration error: LLM provider is not configured",
      code: "llm_not_configured",
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "capacitor://localhost"
    );
  });

  it("maps rate limits to rate_limited with Retry-After exposed path", async () => {
    mockExtract.mockRejectedValue(
      new LLMError("rate_limit", "anthropic", "slow down")
    );

    const res = await POST(
      makeRequestWithFile("image/png", {
        Origin: "capacitor://localhost",
      })
    );

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: "rate_limited" });
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "capacitor://localhost"
    );
  });

  it("maps unsupported MIME type to unsupported_type", async () => {
    const res = await POST(
      makeRequestWithFile("application/zip", {
        Origin: "capacitor://localhost",
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("unsupported_type");
    expect(res.headers.get("X-API-Version")).toBe("1");
  });

  it("passes extractor contract on success", async () => {
    mockExtract.mockResolvedValue(modelResponse());

    await POST(
      makeRequestWithFile("image/png", { Origin: "capacitor://localhost" })
    );

    expect(mockExtract).toHaveBeenCalledWith({
      data: Buffer.from("fake-image-bytes"),
      mimeType: "image/png",
      prompt: RECEIPT_PROMPT,
      jsonSchema: receiptJsonSchema,
    });
  });
});

describe("legacy route CORS", () => {
  it("does not attach CORS headers on legacy POST", async () => {
    mockExtract.mockResolvedValue(modelResponse());

    const res = await legacyPOST(makeRequestWithFile());
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("X-API-Version")).toBeNull();
  });

  it("legacy errors omit code field", async () => {
    const res = await legacyPOST({
      formData: async () => new FormData(),
      headers: new Headers(),
    } as unknown as Parameters<typeof legacyPOST>[0]);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "No file or link provided in the request",
    });
  });
});
