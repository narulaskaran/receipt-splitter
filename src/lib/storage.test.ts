import { safeSetItem, safeGetItem, measureStorageUsage, formatBytes } from "./storage";

// Store original handlers to restore after tests that override them
let originalSetItem: typeof localStorage.setItem;
let originalGetItem: typeof localStorage.getItem;

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
