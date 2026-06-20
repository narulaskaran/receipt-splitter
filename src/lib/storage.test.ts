import { safeSetItem, safeGetItem } from "./storage";

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
