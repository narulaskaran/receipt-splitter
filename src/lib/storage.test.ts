import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  measureStorageUsage,
  formatBytes,
  setStorageMirror,
  clearAllLocalData,
  MIRROR_META_STORAGE_KEY,
  reconcileMirroredStores,
  type MirrorMetaFile,
  type StorageMirror,
} from "./storage";
import { AI_CONSENT_STORAGE_KEY } from "./ai-consent";

// Store original handlers to restore after tests that override them
let originalSetItem: typeof localStorage.setItem;
let originalGetItem: typeof localStorage.getItem;

afterEach(() => {
  setStorageMirror(null);
  if (originalSetItem) {
    localStorage.setItem = originalSetItem;
    originalSetItem = undefined as never;
  }
  if (originalGetItem) {
    localStorage.getItem = originalGetItem;
    originalGetItem = undefined as never;
  }
});

describe("safeSetItem", () => {
  beforeEach(() => {
    // Restore originals if they were overridden
    if (originalSetItem) localStorage.setItem = originalSetItem;
    if (originalGetItem) localStorage.getItem = originalGetItem;
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("returns true and persists value on success", () => {
    const result = safeSetItem("testKey", "testValue");
    expect(result).toBe(true);
    expect(localStorage.getItem("testKey")).toBe("testValue");
  });

  it("returns false when setItem throws QuotaExceededError", () => {
    originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    const result = safeSetItem("testKey", "testValue");
    expect(result).toBe(false);
    expect(localStorage.getItem("testKey")).toBeNull();
  });

  it("returns false when setItem throws any error", () => {
    originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error("Some other error");
    });

    const result = safeSetItem("testKey", "testValue");
    expect(result).toBe(false);
  });

  it("returns false when measuring storage usage throws", () => {
    const setItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error("Storage unavailable");
    });
    const originalKey = localStorage.key;
    localStorage.key = jest.fn(() => {
      throw new Error("Storage unavailable");
    }) as typeof localStorage.key;

    try {
      expect(safeSetItem("testKey", "testValue")).toBe(false);
    } finally {
      localStorage.setItem = setItem;
      localStorage.key = originalKey;
    }
  });

  it("integrated: safeSetItem then safeGetItem roundtrip", () => {
    const ok = safeSetItem("roundtripKey", "roundtripValue");
    expect(ok).toBe(true);
    expect(safeGetItem("roundtripKey")).toBe("roundtripValue");
  });
});

describe("safeGetItem", () => {
  beforeEach(() => {
    if (originalGetItem) localStorage.getItem = originalGetItem;
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("returns the stored value on success", () => {
    localStorage.setItem("testKey", "testValue");
    expect(safeGetItem("testKey")).toBe("testValue");
  });

  it("returns null when getItem throws", () => {
    originalGetItem = localStorage.getItem;
    localStorage.getItem = jest.fn(() => {
      throw new Error("Access denied");
    });

    const result = safeGetItem("testKey");
    expect(result).toBeNull();
  });
});

describe("safeRemoveItem", () => {
  it("returns true and removes the value on success", () => {
    localStorage.setItem("testKey", "testValue");
    expect(safeRemoveItem("testKey")).toBe(true);
    expect(localStorage.getItem("testKey")).toBeNull();
  });

  it("returns false when removeItem throws", () => {
    const removeItem = localStorage.removeItem;
    localStorage.removeItem = jest.fn(() => {
      throw new Error("Storage unavailable");
    }) as typeof localStorage.removeItem;

    try {
      expect(safeRemoveItem("testKey")).toBe(false);
    } finally {
      localStorage.removeItem = removeItem;
    }
  });
});

describe("measureStorageUsage", () => {
  beforeEach(() => {
    // Restore getItem if it was mocked by a previous test
    if (originalGetItem) localStorage.getItem = originalGetItem;
    localStorage.clear();
  });

  it("returns 0 when localStorage is empty", () => {
    expect(measureStorageUsage()).toBe(0);
  });

  it("counts key and value bytes (UTF-16 = 2 bytes per char)", () => {
    localStorage.setItem("abc", "xyz");     // (3 + 3) * 2 = 12
    expect(measureStorageUsage()).toBe(12);
  });

  it("returns combined size of multiple entries", () => {
    localStorage.setItem("k1", "v1");       // (2 + 2) * 2 = 8
    localStorage.setItem("key2", "val2");   // (4 + 4) * 2 = 16
    expect(measureStorageUsage()).toBe(24);
  });

  it("does not count the key parameter of setItem, only stored keys", () => {
    localStorage.setItem("a", "aaaa");      // (1 + 4) * 2 = 10
    localStorage.setItem("bb", "bb");       // (2 + 2) * 2 = 8
    expect(measureStorageUsage()).toBe(18);
  });
});

describe("storage mirror", () => {
  function recordingMirror(): StorageMirror & { sets: Array<[string, string]>; removes: string[] } {
    const mirror = {
      sets: [] as Array<[string, string]>,
      removes: [] as string[],
      set(key: string, value: string) {
        mirror.sets.push([key, value]);
      },
      remove(key: string) {
        mirror.removes.push(key);
      },
    };
    return mirror;
  }

  beforeEach(() => {
    setStorageMirror(null);
    localStorage.clear();
  });

  it("mirrors prefixed writes and removals after localStorage succeeds", () => {
    const mirror = recordingMirror();
    setStorageMirror(mirror);

    expect(safeSetItem("receiptSplitterSession", "saved")).toBe(true);
    expect(safeRemoveItem("receiptSplitterSession")).toBe(true);

    const dataSets = mirror.sets.filter(([key]) => key === "receiptSplitterSession");
    const metaSets = mirror.sets.filter(([key]) => key === MIRROR_META_STORAGE_KEY);
    expect(dataSets).toEqual([["receiptSplitterSession", "saved"]]);
    expect(metaSets).toHaveLength(2);
    const tombstone = JSON.parse(metaSets[1][1]) as MirrorMetaFile;
    expect(tombstone.keys.receiptSplitterSession).toMatchObject({ rev: 2, deleted: true });
    expect(mirror.removes).toEqual(["receiptSplitterSession"]);
  });

  it("ignores keys outside the receiptSplitter prefix", () => {
    const mirror = recordingMirror();
    setStorageMirror(mirror);

    safeSetItem("theme", "dark");
    safeRemoveItem("theme");

    expect(mirror.sets).toEqual([]);
    expect(mirror.removes).toEqual([]);
  });

  it("still mirrors a prefixed write when localStorage throws", () => {
    const mirror = recordingMirror();
    setStorageMirror(mirror);
    originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    expect(safeSetItem("receiptSplitterThumbnails", "{}")).toBe(false);
    expect(mirror.sets).toEqual([
      [MIRROR_META_STORAGE_KEY, expect.any(String)],
      ["receiptSplitterThumbnails", "{}"],
    ]);
    expect(safeGetItem("receiptSplitterThumbnails")).toBe("{}");
  });

  it("still mirrors a prefixed removal when localStorage throws", () => {
    const mirror = recordingMirror();
    setStorageMirror(mirror);
    const removeItem = localStorage.removeItem;
    localStorage.removeItem = jest.fn(() => {
      throw new Error("Storage unavailable");
    }) as typeof localStorage.removeItem;

    try {
      expect(safeRemoveItem("receiptSplitterSession")).toBe(false);
      expect(mirror.removes).toEqual(["receiptSplitterSession"]);
    } finally {
      localStorage.removeItem = removeItem;
    }
  });

  it("keeps the localStorage result when the mirror throws", () => {
    setStorageMirror({
      set() {
        throw new Error("mirror down");
      },
      remove() {
        throw new Error("mirror down");
      },
    });

    expect(safeSetItem("receiptSplitterSession", "ok")).toBe(true);
    expect(localStorage.getItem("receiptSplitterSession")).toBe("ok");
    expect(safeRemoveItem("receiptSplitterSession")).toBe(true);
  });
});

describe("clearAllLocalData", () => {
  beforeEach(() => {
    localStorage.clear();
    setStorageMirror(null);
  });

  it("removes split data and leaves theme in place", () => {
    localStorage.setItem("receiptSplitterSession", "session");
    localStorage.setItem("receiptSplitterThumbnails", "{}");
    localStorage.setItem("receiptSplitterImage", "data:image/jpeg;base64,abc");
    localStorage.setItem(AI_CONSENT_STORAGE_KEY, "{\"version\":1}");
    localStorage.setItem("receiptSplitterSessionId", "sid");
    localStorage.setItem("theme", "dark");

    clearAllLocalData();

    expect(localStorage.getItem("receiptSplitterSession")).toBeNull();
    expect(localStorage.getItem("receiptSplitterThumbnails")).toBeNull();
    expect(localStorage.getItem("receiptSplitterImage")).toBeNull();
    expect(localStorage.getItem(AI_CONSENT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("receiptSplitterSessionId")).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("tombstones mirrored keys so a mirror sees the removals", () => {
    const mirror = {
      sets: [] as Array<[string, string]>,
      removes: [] as string[],
      set(key: string, value: string) {
        mirror.sets.push([key, value]);
      },
      remove(key: string) {
        mirror.removes.push(key);
      },
    };
    setStorageMirror(mirror);
    localStorage.setItem("receiptSplitterSession", "session");
    localStorage.setItem("theme", "light");

    clearAllLocalData();

    expect(mirror.removes).toEqual(["receiptSplitterSession"]);
    expect(localStorage.getItem("theme")).toBe("light");
    const meta = localStorage.getItem(MIRROR_META_STORAGE_KEY);
    expect(meta).not.toBeNull();
    expect(JSON.parse(meta as string).keys.receiptSplitterSession.deleted).toBe(true);
  });
});

describe("reconcileMirroredStores", () => {
  const meta = (rev: number, deleted = false): MirrorMetaFile => ({
    v: 1,
    updatedAt: rev,
    keys: {
      receiptSplitterSession: {
        rev,
        updatedAt: rev,
        ...(deleted ? { deleted: true } : {}),
      },
    },
  });

  it("keeps a newer local edit when Preferences still has the previous value", () => {
    const result = reconcileMirroredStores(
      { values: new Map([["receiptSplitterSession", "A"]]), meta: meta(1) },
      { values: new Map([["receiptSplitterSession", "B"]]), meta: meta(2) },
    );
    expect(result.local).toEqual([]);
    expect(result.remote).toEqual([{ key: "receiptSplitterSession", value: "B" }]);
  });

  it("does not resurrect a key whose newest revision is a tombstone", () => {
    const result = reconcileMirroredStores(
      { values: new Map([["receiptSplitterSession", "A"]]), meta: meta(1) },
      { values: new Map(), meta: meta(2, true) },
    );
    expect(result.local).toEqual([]);
    expect(result.remote).toEqual([{ key: "receiptSplitterSession", value: null }]);
  });

  it("lets Preferences win a legacy conflict that has no metadata", () => {
    const result = reconcileMirroredStores(
      { values: new Map([["receiptSplitterSession", "native"]]), meta: null },
      { values: new Map([["receiptSplitterSession", "local"]]), meta: null },
    );
    expect(result.local).toEqual([{ key: "receiptSplitterSession", value: "native" }]);
    expect(result.remote).toEqual([]);
  });

  it("lets Preferences fill a key that localStorage is missing, even without metadata", () => {
    const result = reconcileMirroredStores(
      { values: new Map([["receiptSplitterSession", "native"]]), meta: null },
      { values: new Map(), meta: null },
    );
    expect(result.local).toEqual([{ key: "receiptSplitterSession", value: "native" }]);
  });

  it("keeps local on a metadata tie when local still has a value", () => {
    const tied = meta(3);
    const result = reconcileMirroredStores(
      { values: new Map([["receiptSplitterSession", "native"]]), meta: tied },
      { values: new Map([["receiptSplitterSession", "local"]]), meta: tied },
    );
    expect(result.local).toEqual([]);
    expect(result.remote).toEqual([{ key: "receiptSplitterSession", value: "local" }]);
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });
});
