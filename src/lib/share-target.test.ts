/**
 * @jest-environment node
 */
import {
  receiveSharedFiles,
  storeSharedFiles,
  takeSharedFiles,
} from "./share-target";

// Minimal in-memory CacheStorage; Node has Request/Response/File but no caches.
class MemoryCache {
  entries = new Map<string, Response>();
  async put(key: string, response: Response) {
    this.entries.set(new URL(key, "http://localhost").href, response);
  }
  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
  async match(request: Request) {
    return this.entries.get(request.url)?.clone();
  }
}

class MemoryCacheStorage {
  private stores = new Map<string, MemoryCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new MemoryCache());
    return this.stores.get(name)!;
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async has(name: string) {
    return this.stores.has(name);
  }
}

function sharePost(files: File[], headers: Record<string, string> = {}) {
  const body = new FormData();
  files.forEach((file) => body.append("receipts", file));
  return new Request("https://example.com/share-target", {
    method: "POST",
    body,
    headers,
  });
}

const png = (name: string) => new File(["x"], name, { type: "image/png" });

describe("share target file hand-off", () => {
  beforeEach(() => {
    (globalThis as unknown as { caches: MemoryCacheStorage }).caches =
      new MemoryCacheStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { caches?: unknown }).caches;
  });

  it("returns nothing when no files were shared", async () => {
    expect(await takeSharedFiles()).toEqual([]);
  });

  it("round-trips files with their names, types and contents, in order", async () => {
    const files = Array.from({ length: 11 }, (_, i) =>
      new File([`receipt ${i}`], `receipt ${i} (€).png`, { type: "image/png" })
    );
    await storeSharedFiles(files);

    const taken = await takeSharedFiles();
    expect(taken.map((f) => f.name)).toEqual(files.map((f) => f.name));
    expect(taken.every((f) => f.type === "image/png")).toBe(true);
    expect(await taken[10].text()).toBe("receipt 10");
  });

  it("clears the files once they are taken", async () => {
    await storeSharedFiles([new File(["x"], "a.pdf", { type: "application/pdf" })]);
    expect(await takeSharedFiles()).toHaveLength(1);
    expect(await takeSharedFiles()).toEqual([]);
  });

  it("replaces files from an earlier share that was never taken", async () => {
    await storeSharedFiles([new File(["old"], "old.png", { type: "image/png" })]);
    await storeSharedFiles([new File(["new"], "new.png", { type: "image/png" })]);

    const taken = await takeSharedFiles();
    expect(taken.map((f) => f.name)).toEqual(["new.png"]);
  });

  it("clears the cache even when a stashed file can't be read", async () => {
    await storeSharedFiles([png("a.png")]);
    const cache = await caches.open("share-target");
    const broken = new Response("x");
    jest.spyOn(broken, "blob").mockRejectedValue(new Error("unreadable"));
    jest.spyOn(broken, "clone").mockReturnValue(broken);
    (cache as unknown as MemoryCache).entries.set(
      "http://localhost/share-target/files/0000",
      broken
    );

    await expect(takeSharedFiles()).rejects.toThrow("unreadable");
    expect(await (globalThis as unknown as { caches: MemoryCacheStorage }).caches.has("share-target")).toBe(false);
  });
});

describe("receiveSharedFiles", () => {
  beforeEach(() => {
    (globalThis as unknown as { caches: MemoryCacheStorage }).caches =
      new MemoryCacheStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { caches?: unknown }).caches;
    jest.restoreAllMocks();
  });

  it("stores shared receipts and points the page at them", async () => {
    const path = await receiveSharedFiles(
      sharePost([png("a.png"), png("b.png")]),
      "https://example.com"
    );
    expect(path).toBe("/?share-target=1");
    expect((await takeSharedFiles()).map((f) => f.name)).toEqual(["a.png", "b.png"]);
  });

  it("accepts a POST with no Origin or the opaque 'null' origin (the OS share sheet)", async () => {
    expect(await receiveSharedFiles(sharePost([png("a.png")]), "https://example.com")).toBe("/?share-target=1");
    expect(
      await receiveSharedFiles(sharePost([png("a.png")], { Origin: "null" }), "https://example.com")
    ).toBe("/?share-target=1");
  });

  it("accepts a POST from its own origin", async () => {
    const path = await receiveSharedFiles(
      sharePost([png("a.png")], { Origin: "https://example.com" }),
      "https://example.com"
    );
    expect(path).toBe("/?share-target=1");
  });

  it("ignores a POST from another site and stores nothing", async () => {
    const path = await receiveSharedFiles(
      sharePost([png("a.png")], { Origin: "https://evil.example" }),
      "https://example.com"
    );
    expect(path).toBe("/");
    expect(await takeSharedFiles()).toEqual([]);
  });

  it("drops files that aren't images or PDFs", async () => {
    const path = await receiveSharedFiles(
      sharePost([
        png("a.png"),
        new File(["x"], "notes.txt", { type: "text/plain" }),
        new File(["x"], "b.pdf", { type: "application/pdf" }),
      ]),
      "https://example.com"
    );
    expect(path).toBe("/?share-target=1");
    expect((await takeSharedFiles()).map((f) => f.name)).toEqual(["a.png", "b.pdf"]);
  });

  it("infers the type from the extension when the share source sends none", async () => {
    const path = await receiveSharedFiles(
      sharePost([
        new File(["x"], "IMG_0001.JPG", { type: "" }),
        new File(["x"], "scan.pdf", { type: "application/octet-stream" }),
      ]),
      "https://example.com"
    );
    expect(path).toBe("/?share-target=1");

    const taken = await takeSharedFiles();
    expect(taken.map((f) => [f.name, f.type])).toEqual([
      ["IMG_0001.JPG", "image/jpeg"],
      ["scan.pdf", "application/pdf"],
    ]);
  });

  it("drops untyped files with an unknown extension and files with a non-receipt type", async () => {
    const path = await receiveSharedFiles(
      sharePost([
        new File(["x"], "data.bin", { type: "" }),
        new File(["x"], "fake.png", { type: "text/plain" }),
      ]),
      "https://example.com"
    );
    expect(path).toBe("/?share-target=empty");
  });

  it("warns about a blocked cross-origin share", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await receiveSharedFiles(
      sharePost([png("a.png")], { Origin: "https://evil.example" }),
      "https://example.com"
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("https://evil.example"));
  });

  it("reports when nothing usable was shared", async () => {
    const path = await receiveSharedFiles(
      sharePost([new File(["x"], "notes.txt", { type: "text/plain" })]),
      "https://example.com"
    );
    expect(path).toBe("/?share-target=empty");
  });

  it("keeps no more than the per-split receipt limit", async () => {
    const files = Array.from({ length: 12 }, (_, i) => png(`r${i}.png`));
    await receiveSharedFiles(sharePost(files), "https://example.com");
    expect(await takeSharedFiles()).toHaveLength(10);
  });

  it("reports an error when the files can't be stored", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest
      .spyOn(
        (globalThis as unknown as { caches: MemoryCacheStorage }).caches,
        "open"
      )
      .mockRejectedValue(new Error("QuotaExceededError"));

    const path = await receiveSharedFiles(sharePost([png("a.png")]), "https://example.com");
    expect(path).toBe("/?share-target=error");
  });

  it("reports an error for a body that isn't form data", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("https://example.com/share-target", {
      method: "POST",
      body: "not multipart",
    });
    expect(await receiveSharedFiles(request, "https://example.com")).toBe(
      "/?share-target=error"
    );
  });
});
