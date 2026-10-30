import { configureApp, PARSE_RECEIPT_PATH } from "@/lib/app-config";
import {
  PARSE_RECEIPT_TIMEOUT_MS,
  parseReceipt,
} from "@/lib/parse-receipt-client";

function mockResponse(partial: Partial<Response> & { ok: boolean }): Response {
  return partial as Response;
}

describe("parseReceipt", () => {
  afterEach(() => {
    configureApp(null);
    jest.useRealTimers();
  });

  it("POSTs multipart to the versioned API with client headers and no Content-Type", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({
        ok: true,
        json: async () => ({ restaurant: "Cafe", total: 1, items: [] }),
      })
    );

    const formData = new FormData();
    formData.append("file", new File(["x"], "receipt.png", { type: "image/png" }));
    const receipt = await parseReceipt(formData);

    expect(receipt).toEqual({ restaurant: "Cafe", total: 1, items: [] });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(PARSE_RECEIPT_PATH);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(formData);
    expect((init.body as FormData).get("sessionId")).toEqual(expect.any(String));
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Client-Platform"]).toBe("web");
    expect(headers["X-Client-Version"]).toBeUndefined();
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["content-type"]).toBeUndefined();
  });

  it("sends the iOS platform, version, and absolute API origin", async () => {
    configureApp({
      platform: "ios",
      apiOrigin: "https://receipt-splitter.app",
      appVersion: "1.2.3",
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({
        ok: true,
        json: async () => ({ restaurant: "Cafe", total: 1, items: [] }),
      })
    );

    await parseReceipt(new FormData());

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`https://receipt-splitter.app${PARSE_RECEIPT_PATH}`);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Client-Platform"]).toBe("ios");
    expect(headers["X-Client-Version"]).toBe("1.2.3");
  });

  it("maps a network failure to a connection message", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(parseReceipt(new FormData())).rejects.toThrow(
      "Couldn't reach the server. Check your connection and try again."
    );
  });

  it("maps 413 and 429 to friendly messages", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({ ok: false, status: 413, text: async () => "too big" })
    );
    await expect(parseReceipt(new FormData())).rejects.toThrow(/maximum size is 4\.5MB/i);

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: "slow down", code: "rate_limit" }),
      })
    );
    await expect(parseReceipt(new FormData())).rejects.toThrow(
      "Too many requests, try again in a few minutes."
    );
  });

  it("uses the backend error string and hides non-JSON bodies", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 422,
        text: async () =>
          JSON.stringify({ error: "That link needs a login.", code: "needs_login" }),
      })
    );
    await expect(parseReceipt(new FormData())).rejects.toThrow(
      "That link needs a login."
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 502,
        text: async () => "<html>bad gateway</html>",
      })
    );
    await expect(parseReceipt(new FormData())).rejects.toThrow(
      "Failed to parse receipt"
    );
  });

  it("aborts after 65s with a timeout message", async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    const pending = parseReceipt(new FormData());
    const assertion = expect(pending).rejects.toThrow(
      "This is taking too long. Please try again."
    );
    await jest.advanceTimersByTimeAsync(PARSE_RECEIPT_TIMEOUT_MS);
    await assertion;
  });
});
