import { deleteLegacyCaches, isLegacyCacheName } from "./legacy-caches";

function fakeStorage(names: string[], failOn?: string) {
  const remaining = new Set(names);
  return {
    remaining,
    storage: {
      keys: async () => [...remaining],
      delete: async (name: string) => {
        if (name === failOn) throw new Error("delete failed");
        return remaining.delete(name);
      },
    } as unknown as CacheStorage,
  };
}

describe("isLegacyCacheName", () => {
  it("matches the old worker's Workbox precache and start-url cache", () => {
    expect(isLegacyCacheName("workbox-precache-v2-https://example.com/")).toBe(true);
    expect(isLegacyCacheName("start-url")).toBe(true);
  });

  it("leaves Serwist's caches and shared runtime cache names alone", () => {
    for (const name of [
      "serwist-precache-v2-https://example.com/",
      "pages",
      "next-image",
      "static-font-assets",
      "share-target",
    ]) {
      expect(isLegacyCacheName(name)).toBe(false);
    }
  });
});

describe("deleteLegacyCaches", () => {
  it("deletes only the legacy caches", async () => {
    const { storage, remaining } = fakeStorage([
      "workbox-precache-v2-x",
      "start-url",
      "serwist-precache-v2-x",
      "next-image",
    ]);
    await deleteLegacyCaches(storage);
    expect([...remaining]).toEqual(["serwist-precache-v2-x", "next-image"]);
  });

  it("never rejects, so a failure can't block service worker activation", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const { storage } = fakeStorage(["start-url"], "start-url");
    await expect(deleteLegacyCaches(storage)).resolves.toBeUndefined();
  });
});
