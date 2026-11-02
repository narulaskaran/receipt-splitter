import { Preferences } from "@capacitor/preferences";

import { deserializeSession, serializeSession } from "@/lib/session-persistence";
import {
  MAX_PREFERENCES_VALUE_LENGTH,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
  setStorageMirror,
  consumeDurableStorageNotice,
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
  it("keeps the localStorage value when both stores have the key", async () => {
    memory.set("receiptSplitterSession", "stale-native");
    localStorage.setItem("receiptSplitterSession", "from-web");

    await hydrateStorageFromPreferences();
    await flush();

    expect(localStorage.getItem("receiptSplitterSession")).toBe("from-web");
    expect(memory.get("receiptSplitterSession")).toBe("from-web");
  });

  it("copies prefixed localStorage keys up on first launch", async () => {
    localStorage.setItem("receiptSplitterSession", "from-web");
    localStorage.setItem("receiptSplitterThumbnails", "{\"r1\":\"data:image/jpeg\"}");

    await hydrateStorageFromPreferences();
    await flush();

    expect(memory.get("receiptSplitterSession")).toBe("from-web");
    expect(memory.get("receiptSplitterThumbnails")).toBe("{\"r1\":\"data:image/jpeg\"}");
  });

  it("recovers a session that the WebView evicted", async () => {
    memory.set("receiptSplitterSession", "still-here");
    expect(localStorage.getItem("receiptSplitterSession")).toBeNull();

    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("receiptSplitterSession")).toBe("still-here");
    expect(Preferences.set).not.toHaveBeenCalled();
  });

  it("ignores keys that do not start with receiptSplitter", async () => {
    memory.set("theme", "dark");
    localStorage.setItem("theme", "light");
    localStorage.setItem("other", "1");

    await hydrateStorageFromPreferences();
    await flush();

    expect(localStorage.getItem("theme")).toBe("light");
    expect(memory.has("other")).toBe(false);
    expect(memory.get("theme")).toBe("dark");
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
    expect(consumeDurableStorageNotice()).not.toBeNull();
  });

  it("does not apply a partial Preferences read or install the mirror", async () => {
    (Preferences.keys as jest.Mock).mockResolvedValue({
      keys: ["receiptSplitterSession", "receiptSplitterThumbnails"],
    });
    (Preferences.get as jest.Mock).mockImplementation(async ({ key }: { key: string }) => {
      if (key === "receiptSplitterThumbnails") throw new Error("read failed");
      return { value: "from-native" };
    });

    await hydrateStorageFromPreferences();

    expect(localStorage.getItem("receiptSplitterSession")).toBeNull();
    safeSetItem("receiptSplitterSession", "next");
    await flush();
    expect(Preferences.set).not.toHaveBeenCalled();
  });

  it("fails closed when Preferences hangs", async () => {
    jest.useFakeTimers();
    try {
      localStorage.setItem("receiptSplitterSession", "keep");
      (Preferences.keys as jest.Mock).mockImplementation(() => new Promise(() => {}));

      const pending = hydrateStorageFromPreferences();
      await jest.advanceTimersByTimeAsync(HYDRATION_TIMEOUT_MS);
      await pending;

      expect(localStorage.getItem("receiptSplitterSession")).toBe("keep");
      safeSetItem("receiptSplitterSession", "after");
      await flush();
      expect(memory.has("receiptSplitterSession")).toBe(false);
      expect(consumeDurableStorageNotice()).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("restores a v2 session, including assignment maps, when localStorage was evicted", async () => {
    memory.set("receiptSplitterSession", v2Session("Native Diner"));

    await hydrateStorageFromPreferences();

    const restored = deserializeSession(localStorage.getItem("receiptSplitterSession") ?? "");
    expect(restored).not.toBeNull();
    expect(restored!.state.receipts[0].receipt.restaurant).toBe("Native Diner");
    expect(restored!.state.assignedItems.get("receipt-1")?.get(0)).toEqual([
      { personId: "a", sharePercentage: 100 },
    ]);
    expect(restored!.activeTab).toBe("assign");
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
