import { Preferences } from "@capacitor/preferences";

import { safeRemoveItem, safeSetItem, setStorageMirror } from "@/lib/storage";

import { flush, hydrateStorageFromPreferences } from "./storage";

jest.mock("@capacitor/preferences", () => ({
  Preferences: {
    keys: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

const memory = new Map<string, string>();

function useMemoryPreferences() {
  (Preferences.keys as jest.Mock).mockImplementation(async () => ({ keys: [...memory.keys()] }));
  (Preferences.get as jest.Mock).mockImplementation(async ({ key }: { key: string }) => ({
    value: memory.has(key) ? memory.get(key) : null,
  }));
  (Preferences.set as jest.Mock).mockImplementation(async ({ key, value }: { key: string; value: string }) => {
    memory.set(key, value);
  });
  (Preferences.remove as jest.Mock).mockImplementation(async ({ key }: { key: string }) => {
    memory.delete(key);
  });
}

beforeEach(() => {
  memory.clear();
  localStorage.clear();
  setStorageMirror(null);
  useMemoryPreferences();
});

afterEach(() => {
  setStorageMirror(null);
});

describe("hydrateStorageFromPreferences", () => {
  it("prefers Preferences over a stale localStorage value", async () => {
    memory.set("receiptSplitterSession", "from-native");
    localStorage.setItem("receiptSplitterSession", "from-web");

    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("receiptSplitterSession")).toBe("from-native");
    expect(memory.get("receiptSplitterSession")).toBe("from-native");
    expect(Preferences.set).not.toHaveBeenCalled();
  });

  it("copies prefixed localStorage keys up on first launch", async () => {
    localStorage.setItem("receiptSplitterSession", "from-web");
    localStorage.setItem("receiptSplitterThumbnails", "{\"r1\":\"data:image/jpeg\"}");

    await hydrateStorageFromPreferences();

    expect(memory.get("receiptSplitterSession")).toBe("from-web");
    expect(memory.get("receiptSplitterThumbnails")).toBe("{\"r1\":\"data:image/jpeg\"}");
    expect(localStorage.getItem("receiptSplitterSession")).toBe("from-web");
  });

  it("migrates only the local-only key when both stores have data", async () => {
    memory.set("receiptSplitterSession", "from-native");
    localStorage.setItem("receiptSplitterSession", "from-web");
    localStorage.setItem("receiptSplitterThumbnails", "thumbs");

    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("receiptSplitterSession")).toBe("from-native");
    expect(memory.get("receiptSplitterSession")).toBe("from-native");
    expect(memory.get("receiptSplitterThumbnails")).toBe("thumbs");
  });

  it("recovers a session that the WebView evicted", async () => {
    memory.set("receiptSplitterSession", "still-here");
    expect(localStorage.getItem("receiptSplitterSession")).toBeNull();

    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("receiptSplitterSession")).toBe("still-here");
  });

  it("ignores keys that do not start with receiptSplitter", async () => {
    memory.set("theme", "dark");
    localStorage.setItem("theme", "light");
    localStorage.setItem("other", "1");

    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("theme")).toBe("light");
    expect(memory.has("other")).toBe(false);
    expect(memory.has("theme")).toBe(true);
    expect(Preferences.set).not.toHaveBeenCalled();
  });

  it("does not install the mirror when hydration throws", async () => {
    localStorage.setItem("receiptSplitterSession", "keep-me");
    (Preferences.keys as jest.Mock).mockRejectedValue(new Error("preferences unavailable"));

    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("receiptSplitterSession")).toBe("keep-me");
    safeSetItem("receiptSplitterSession", "next");
    await flush();
    expect(Preferences.set).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not install the mirror when writing localStorage throws", async () => {
    memory.set("receiptSplitterSession", "from-native");
    const setItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error("quota");
    }) as typeof localStorage.setItem;

    try {
      await hydrateStorageFromPreferences();
      safeSetItem("receiptSplitterThumbnails", "x");
      await flush();
      expect(Preferences.set).not.toHaveBeenCalled();
    } finally {
      localStorage.setItem = setItem;
    }
  });
});

describe("preferences mirror", () => {
  it("writes a thumbnails key through after hydration", async () => {
    await hydrateStorageFromPreferences();
    safeSetItem("receiptSplitterThumbnails", "map");
    await flush();
    expect(memory.get("receiptSplitterThumbnails")).toBe("map");
  });

  it("removes a prefixed key from Preferences", async () => {
    memory.set("receiptSplitterSession", "saved");
    await hydrateStorageFromPreferences();
    (Preferences.set as jest.Mock).mockClear();
    safeRemoveItem("receiptSplitterSession");
    await flush();
    expect(memory.has("receiptSplitterSession")).toBe(false);
  });

  it("coalesces queued writes so the last value wins and earlier ones cannot overwrite it", async () => {
    await hydrateStorageFromPreferences();
    const calls: string[] = [];
    let releaseFirst: () => void = () => {};
    (Preferences.set as jest.Mock).mockImplementation(({ key, value }: { key: string; value: string }) => {
      calls.push(value);
      if (calls.length === 1) {
        return new Promise<void>((resolve) => {
          releaseFirst = () => {
            memory.set(key, value);
            resolve();
          };
        });
      }
      memory.set(key, value);
      return Promise.resolve();
    });

    safeSetItem("receiptSplitterSession", "A");
    safeSetItem("receiptSplitterSession", "B");
    safeSetItem("receiptSplitterSession", "C");
    expect(calls).toEqual(["A"]);

    let flushed = false;
    const waiting = flush().then(() => {
      flushed = true;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);

    releaseFirst();
    await waiting;

    expect(calls).toEqual(["A", "C"]);
    expect(memory.get("receiptSplitterSession")).toBe("C");
  });

  it("applies a removal queued behind an in-flight write", async () => {
    await hydrateStorageFromPreferences();
    let releaseFirst: () => void = () => {};
    let sets = 0;
    (Preferences.set as jest.Mock).mockImplementation(({ key, value }: { key: string; value: string }) => {
      sets += 1;
      return new Promise<void>((resolve) => {
        releaseFirst = () => {
          memory.set(key, value);
          resolve();
        };
      });
    });

    safeSetItem("receiptSplitterSession", "A");
    safeRemoveItem("receiptSplitterSession");
    const waiting = flush();
    releaseFirst();
    await waiting;

    expect(sets).toBe(1);
    expect(memory.has("receiptSplitterSession")).toBe(false);
  });

  it("swallows a Preferences error and still applies the next write", async () => {
    await hydrateStorageFromPreferences();
    (Preferences.set as jest.Mock)
      .mockRejectedValueOnce(new Error("disk"))
      .mockImplementation(async ({ key, value }: { key: string; value: string }) => {
        memory.set(key, value);
      });

    safeSetItem("receiptSplitterSession", "first");
    safeSetItem("receiptSplitterSession", "second");
    await flush();

    expect(memory.get("receiptSplitterSession")).toBe("second");
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not mirror a non-prefixed key after hydration", async () => {
    await hydrateStorageFromPreferences();
    (Preferences.set as jest.Mock).mockClear();
    safeSetItem("theme", "dark");
    await flush();
    expect(Preferences.set).not.toHaveBeenCalled();
    expect(memory.has("theme")).toBe(false);
  });
});
