/**
 * @jest-environment node
 */
import {
  storeSharedFiles,
  takeSharedFiles,
} from "./share-target";

// Minimal in-memory CacheStorage; Node has Request/Response/File but no caches.
class MemoryCache {
  private entries = new Map<string, Response>();
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
});
