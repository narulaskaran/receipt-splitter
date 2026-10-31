import { Preferences } from "@capacitor/preferences";

import { deserializeSession, serializeSession } from "@/lib/session-persistence";
import {
  MAX_PREFERENCES_VALUE_LENGTH,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
  setStorageMirror,
  clearAllLocalData,
} from "@/lib/storage";
import { mockPeople, mockReceipt } from "@/test/test-utils";
import { type ReceiptState } from "@/types";

import {
  flush,
  HYDRATION_TIMEOUT_MS,
  hydrateStorageFromPreferences,
  resetPreferencesQueueForTests,
} from "./storage";

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
  resetPreferencesQueueForTests();
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

  it("installs the mirror when localStorage writes throw and serves Preferences from memory", async () => {
    memory.set("receiptSplitterSession", "from-native");
    const setItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error("quota");
    }) as typeof localStorage.setItem;

    try {
      await hydrateStorageFromPreferences();
      expect(safeGetItem("receiptSplitterSession")).toBe("from-native");
      expect(localStorage.getItem("receiptSplitterSession")).toBeNull();
      safeSetItem("receiptSplitterThumbnails", "x");
      await flush();
      expect(memory.get("receiptSplitterThumbnails")).toBe("x");
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
      if (key !== "receiptSplitterSession") {
        memory.set(key, value);
        return Promise.resolve();
      }
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
      if (key !== "receiptSplitterSession") {
        memory.set(key, value);
        return Promise.resolve();
      }
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
    let failedSession = false;
    (Preferences.set as jest.Mock).mockImplementation(async ({ key, value }: { key: string; value: string }) => {
      if (key === "receiptSplitterSession" && !failedSession) {
        failedSession = true;
        throw new Error("disk");
      }
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

  it("skips an oversized Preferences write without throwing", async () => {
    await hydrateStorageFromPreferences();
    const oversized = "x".repeat(MAX_PREFERENCES_VALUE_LENGTH + 1);
    expect(() => safeSetItem("receiptSplitterThumbnails", oversized)).not.toThrow();
    await flush();
    expect(localStorage.getItem("receiptSplitterThumbnails")).toBe(oversized);
    expect(memory.has("receiptSplitterThumbnails")).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it("clears Preferences when New Split removes the session and thumbnails", async () => {
    await hydrateStorageFromPreferences();
    safeSetItem("receiptSplitterSession", "session");
    safeSetItem("receiptSplitterThumbnails", "{\"r1\":\"data:image/jpeg;base64,aa\"}");
    safeSetItem("receiptSplitterImage", "data:image/jpeg;base64,bb");
    await flush();

    safeRemoveItem("receiptSplitterSession");
    safeRemoveItem("receiptSplitterImage");
    safeRemoveItem("receiptSplitterThumbnails");
    await flush();

    expect(memory.has("receiptSplitterSession")).toBe(false);
    expect(memory.has("receiptSplitterThumbnails")).toBe(false);
    expect(memory.has("receiptSplitterImage")).toBe(false);
    expect(localStorage.getItem("receiptSplitterSession")).toBeNull();
  });
});

function v2Session(restaurant: string): string {
  const receiptId = "receipt-1";
  const assigned = new Map([
    [
      receiptId,
      new Map([[0, [{ personId: "a", sharePercentage: 100 }]]]),
    ],
  ]);
  const state: ReceiptState = {
    receipts: [{ id: receiptId, receipt: { ...mockReceipt, restaurant } }],
    people: mockPeople,
    groups: [],
    assignedItems: assigned,
    isLoading: false,
    error: null,
  };
  return serializeSession(state, "assign");
}

describe("session restore from Preferences", () => {
  it("restores a v2 session, including assignment maps, when localStorage was evicted", async () => {
    const blob = v2Session("Native Diner");
    memory.set("receiptSplitterSession", blob);

    await hydrateStorageFromPreferences();

    const restored = deserializeSession(localStorage.getItem("receiptSplitterSession") ?? "");
    expect(restored).not.toBeNull();
    expect(restored!.state.receipts[0].receipt.restaurant).toBe("Native Diner");
    expect(restored!.state.assignedItems.get("receipt-1")?.get(0)).toEqual([
      { personId: "a", sharePercentage: 100 },
    ]);
    expect(restored!.activeTab).toBe("assign");
  });

  it("prefers a legacy Preferences blob when both stores differ and neither has metadata", async () => {
    memory.set("receiptSplitterSession", v2Session("Native Diner"));
    localStorage.setItem("receiptSplitterSession", v2Session("Web Cafe"));

    await hydrateStorageFromPreferences();

    const restored = deserializeSession(safeGetItem("receiptSplitterSession") ?? "");
    expect(restored!.state.receipts[0].receipt.restaurant).toBe("Native Diner");
    const inner = restored!.state.assignedItems.get("receipt-1");
    expect(inner).toBeInstanceOf(Map);
    expect(inner?.get(0)).toEqual([{ personId: "a", sharePercentage: 100 }]);
  });
});

describe("revision reconciliation across relaunch", () => {
  it("keeps a newer local edit when the Preferences write failed, then re-syncs it", async () => {
    await hydrateStorageFromPreferences();
    safeSetItem("receiptSplitterSession", "A");
    await flush();
    expect(memory.get("receiptSplitterSession")).toBe("A");

    (Preferences.set as jest.Mock).mockImplementation(async ({ key, value }: { key: string; value: string }) => {
      if (key === "receiptSplitterSession") throw new Error("quota");
      memory.set(key, value);
    });
    safeSetItem("receiptSplitterSession", "B");
    await flush();
    expect(localStorage.getItem("receiptSplitterSession")).toBe("B");
    expect(memory.get("receiptSplitterSession")).toBe("A");

    (Preferences.set as jest.Mock).mockImplementation(async ({ key, value }: { key: string; value: string }) => {
      memory.set(key, value);
    });
    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("receiptSplitterSession")).toBe("B");
    expect(memory.get("receiptSplitterSession")).toBe("B");
  });

  it("does not resurrect a cleared split when the Preferences remove failed", async () => {
    await hydrateStorageFromPreferences();
    safeSetItem("receiptSplitterSession", "A");
    await flush();

    let removeFails = true;
    (Preferences.remove as jest.Mock).mockImplementation(async ({ key }: { key: string }) => {
      if (removeFails && key === "receiptSplitterSession") {
        removeFails = false;
        throw new Error("disk");
      }
      memory.delete(key);
    });
    safeRemoveItem("receiptSplitterSession");
    await flush();
    expect(localStorage.getItem("receiptSplitterSession")).toBeNull();
    expect(memory.get("receiptSplitterSession")).toBe("A");

    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("receiptSplitterSession")).toBeNull();
    expect(memory.has("receiptSplitterSession")).toBe(false);
  });

  it("retries a failed clear-all so Preferences cannot restore the cleared session", async () => {
    await hydrateStorageFromPreferences();
    safeSetItem("receiptSplitterSession", "A");
    safeSetItem("receiptSplitterSessionId", "sid");
    await flush();

    (Preferences.remove as jest.Mock).mockRejectedValue(new Error("disk"));
    clearAllLocalData();
    await flush();
    expect(localStorage.getItem("receiptSplitterSession")).toBeNull();
    expect(memory.get("receiptSplitterSession")).toBe("A");

    (Preferences.remove as jest.Mock).mockImplementation(async ({ key }: { key: string }) => {
      memory.delete(key);
    });
    await hydrateStorageFromPreferences();
    expect(safeGetItem("receiptSplitterSession")).toBeNull();
    expect(memory.has("receiptSplitterSession")).toBe(false);
    expect(memory.has("receiptSplitterSessionId")).toBe(false);
  });
});

describe("hydration timeout and partial reads", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("fails closed when Preferences hangs, and a late result cannot change localStorage", async () => {
    jest.useFakeTimers();
    localStorage.setItem("receiptSplitterSession", "keep");
    let resolveKeys: (value: { keys: string[] }) => void = () => {};
    (Preferences.keys as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveKeys = resolve;
        }),
    );
    const writesBefore = (localStorage.setItem as jest.Mock).mock.calls.length;

    const pending = hydrateStorageFromPreferences();
    await jest.advanceTimersByTimeAsync(HYDRATION_TIMEOUT_MS);
    await pending;

    expect(localStorage.getItem("receiptSplitterSession")).toBe("keep");
    expect(console.warn).toHaveBeenCalled();

    (Preferences.get as jest.Mock).mockResolvedValue({ value: "late-native" });
    resolveKeys({ keys: ["receiptSplitterSession"] });
    await Promise.resolve();
    await Promise.resolve();

    expect(localStorage.getItem("receiptSplitterSession")).toBe("keep");
    expect((localStorage.setItem as jest.Mock).mock.calls.length).toBe(writesBefore);
    safeSetItem("receiptSplitterSession", "after");
    await flush();
    expect(memory.has("receiptSplitterSession")).toBe(false);
  });

  it("does not install the mirror or apply a partial Preferences read", async () => {
    localStorage.setItem("receiptSplitterSession", "keep");
    (Preferences.keys as jest.Mock).mockResolvedValue({
      keys: ["receiptSplitterSession", "receiptSplitterThumbnails"],
    });
    (Preferences.get as jest.Mock).mockImplementation(async ({ key }: { key: string }) => {
      if (key === "receiptSplitterThumbnails") throw new Error("read failed");
      return { value: "from-native" };
    });

    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("receiptSplitterSession")).toBe("keep");
    safeSetItem("receiptSplitterSession", "next");
    await flush();
    expect(Preferences.set).not.toHaveBeenCalled();
  });

  it("does not let an in-flight hydration overwrite a write that landed first", async () => {
    let resolveKeys: (value: { keys: string[] }) => void = () => {};
    (Preferences.keys as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveKeys = resolve;
        }),
    );
    const pending = hydrateStorageFromPreferences();
    await Promise.resolve();
    safeSetItem("receiptSplitterSession", "during");
    (Preferences.get as jest.Mock).mockResolvedValue({ value: "from-native" });
    resolveKeys({ keys: ["receiptSplitterSession"] });
    await pending;

    expect(localStorage.getItem("receiptSplitterSession")).toBe("during");
    expect(memory.get("receiptSplitterSession")).toBe("during");
  });
});
