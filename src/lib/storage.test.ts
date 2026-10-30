import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  measureStorageUsage,
  formatBytes,
  setStorageMirror,
  type StorageMirror,
} from "./storage";

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

    expect(mirror.sets).toEqual([["receiptSplitterSession", "saved"]]);
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
    expect(mirror.sets).toEqual([["receiptSplitterThumbnails", "{}"]]);
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
