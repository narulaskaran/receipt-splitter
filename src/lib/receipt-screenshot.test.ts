/**
 * @jest-environment node
 */
import { screenshotReceiptUrl, ReceiptUrlError } from "./receipt-screenshot";

const LINK = "https://www.toasttab.com/receipts/J--Wt/nkthf";
const SHOT_URL = "https://storage.googleapis.com/firecrawl-scrape-media/shot.png?sig=abc";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const mockFetch = jest.fn();
const originalFetch = global.fetch;

function scrapeOk(data: Record<string, unknown> = {}, init: ResponseInit = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      data: { screenshot: SHOT_URL, metadata: { statusCode: 200 }, ...data },
    }),
    { status: 200, ...init }
  );
}

function imageResponse(body: Buffer = PNG, headers: Record<string, string> = {}) {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: { "content-type": "image/png", ...headers },
  });
}

/** Queue Firecrawl's scrape answer, then the screenshot download. */
function respond(scrape: Response | Error, download?: Response | Error) {
  mockFetch.mockResolvedValueOnce(scrape instanceof Error ? Promise.reject(scrape) : scrape);
  if (download) {
    mockFetch.mockResolvedValueOnce(download instanceof Error ? Promise.reject(download) : download);
  }
}

async function failure(promise: Promise<unknown>): Promise<ReceiptUrlError> {
  const error = (await promise.catch((e) => e)) as ReceiptUrlError;
  expect(error).toBeInstanceOf(ReceiptUrlError);
  return error;
}

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  delete process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_URL;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("screenshotReceiptUrl", () => {
  it("returns the downloaded screenshot", async () => {
    respond(scrapeOk(), imageResponse());

    const result = await screenshotReceiptUrl(LINK);

    expect(result.mimeType).toBe("image/png");
    expect(result.data.equals(PNG)).toBe(true);
  });

  it("asks Firecrawl for a full-page screenshot of the normalized link", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-secret";
    respond(scrapeOk(), imageResponse());

    await screenshotReceiptUrl("  toasttab.com/receipts/abc ");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer fc-secret" });
    expect(JSON.parse(init.body)).toEqual({
      url: "https://toasttab.com/receipts/abc",
      formats: [{ type: "screenshot", fullPage: true, quality: 80 }],
    });
    expect(mockFetch.mock.calls[1][0]).toBe(SHOT_URL);
  });

  it("works without an API key (Firecrawl's keyless tier)", async () => {
    respond(scrapeOk(), imageResponse());
    await screenshotReceiptUrl(LINK);
    expect(mockFetch.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });

  it("can point at another Firecrawl instance", async () => {
    process.env.FIRECRAWL_API_URL = "http://localhost:3002";
    respond(scrapeOk(), imageResponse());
    await screenshotReceiptUrl(LINK);
    expect(mockFetch.mock.calls[0][0]).toBe("http://localhost:3002/v2/scrape");
  });

  it.each(["image/jpeg", "image/webp"])("accepts %s screenshots", async (type) => {
    respond(scrapeOk(), imageResponse(PNG, { "content-type": `${type}; charset=binary` }));
    await expect(screenshotReceiptUrl(LINK)).resolves.toMatchObject({ mimeType: type });
  });

  it.each(["", "not a link", "ftp://example.com/x", "https://user:pw@example.com/x"])(
    "rejects %j before calling Firecrawl",
    async (input) => {
      const error = await failure(screenshotReceiptUrl(input));
      expect(error).toMatchObject({ code: "invalid_url", status: 400 });
      expect(mockFetch).not.toHaveBeenCalled();
    }
  );

  describe("Firecrawl failures", () => {
    it.each([
      [401, "rejected the API key"],
      [403, "rejected the API key"],
      [402, "out of credits"],
    ])("treats HTTP %i as a service problem, not the user's fault", async (status, detail) => {
      respond(new Response("{}", { status }));
      const error = await failure(screenshotReceiptUrl(LINK));
      expect(error).toMatchObject({ code: "service_unavailable", status: 503 });
      expect(error.detail).toContain(detail);
      // Users never see account details
      expect(error.message).not.toMatch(/key|credit|firecrawl/i);
    });

    it("maps HTTP 429 to a retry-later message", async () => {
      respond(new Response("{}", { status: 429 }));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({
        code: "rate_limited",
        status: 429,
      });
    });

    it("reports pages Firecrawl couldn't scrape", async () => {
      respond(
        new Response(JSON.stringify({ success: false, error: "Site not supported" }), {
          status: 200,
        })
      );
      const error = await failure(screenshotReceiptUrl(LINK));
      expect(error).toMatchObject({ code: "unreachable", status: 422 });
      expect(error.detail).toContain("Site not supported");
    });

    it("treats 5xx as a bad gateway", async () => {
      respond(new Response("oops", { status: 500 }));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({ status: 502 });
    });

    it("maps network errors to service_unavailable", async () => {
      respond(new TypeError("fetch failed"));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({
        code: "service_unavailable",
      });
    });

    it("maps a timeout to a slow-link message", async () => {
      respond(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({
        code: "unreachable",
        status: 504,
      });
    });
  });

  describe("the page's own status", () => {
    it.each([
      [404, "not_found", 404],
      [410, "not_found", 404],
      [401, "access_denied", 422],
      [403, "access_denied", 422],
      [500, "unreachable", 502],
    ])("maps page status %i to %s", async (pageStatus, code, status) => {
      respond(scrapeOk({ metadata: { statusCode: pageStatus } }));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({ code, status });
      // No point downloading an error page's screenshot
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("fails when Firecrawl returns no screenshot", async () => {
      respond(scrapeOk({ screenshot: undefined }));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({
        code: "no_screenshot",
        status: 422,
      });
    });
  });

  describe("downloading the screenshot", () => {
    it("refuses a non-https screenshot URL", async () => {
      respond(scrapeOk({ screenshot: "http://example.com/shot.png" }));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({
        code: "service_unavailable",
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("fails when the download fails or isn't an image", async () => {
      respond(scrapeOk(), new Response("gone", { status: 403 }));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({
        code: "service_unavailable",
      });

      respond(scrapeOk(), imageResponse(PNG, { "content-type": "text/html" }));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({
        code: "service_unavailable",
      });
    });

    it("rejects screenshots over the size limit, declared or actual", async () => {
      respond(scrapeOk(), imageResponse(PNG, { "content-length": String(10 * 1024 * 1024) }));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({
        code: "too_large",
        status: 413,
      });

      respond(scrapeOk(), imageResponse(Buffer.alloc(5 * 1024 * 1024)));
      expect(await failure(screenshotReceiptUrl(LINK))).toMatchObject({ code: "too_large" });
    });
  });
});
