import {
  RECEIPT_THUMBNAILS_STORAGE_KEY,
  clearThumbnails,
  getLatestThumbnailId,
  getThumbnails,
  migrateLegacyImage,
  pruneThumbnails,
  removeThumbnail,
  setThumbnail,
} from "./receipt-thumbnails";
import { RECEIPT_IMAGE_STORAGE_KEY } from "./storage";

const THUMB_A = "data:image/jpeg;base64,AAAA";
const THUMB_B = "data:image/png;base64,BBBB";
const LEGACY_FULL_SIZE = "data:image/jpeg;base64," + "R".repeat(1000);

describe("receipt-thumbnails", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  describe("persistence across a simulated refresh", () => {
    it("retains each receipt's thumbnail keyed by its own id", () => {
      expect(setThumbnail("r1", THUMB_A)).toBe(true);
      expect(setThumbnail("r2", THUMB_B)).toBe(true);

      // Simulate refresh: read back from localStorage only.
      const restored = getThumbnails();
      expect(restored).toEqual({ r1: THUMB_A, r2: THUMB_B });
      expect(getLatestThumbnailId()).toBe("r2");
    });

    it("keeps insertion order so the newest accepted receipt is last", () => {
      setThumbnail("r1", THUMB_A);
      setThumbnail("r2", THUMB_B);
      // Re-accepting r1 makes it the most recent.
      setThumbnail("r1", THUMB_B);
      expect(getLatestThumbnailId()).toBe("r1");
      // Both entries survive.
      expect(Object.keys(getThumbnails()).sort()).toEqual(["r1", "r2"]);
    });
  });

  describe("rejection protection", () => {
    it("does not let a non-image value replace an accepted thumbnail", () => {
      setThumbnail("r1", THUMB_A);
      expect(setThumbnail("r1", "pdf-placeholder")).toBe(false);
      expect(getThumbnails()["r1"]).toBe(THUMB_A);
    });

    it("ignores corrupted or hostile map contents on read", () => {
      localStorage.setItem(
        RECEIPT_THUMBNAILS_STORAGE_KEY,
        JSON.stringify({ r1: "javascript:alert(1)", r2: 42, r3: THUMB_A })
      );
      expect(getThumbnails()).toEqual({ r3: THUMB_A });
    });

    it("returns empty map on invalid JSON", () => {
      localStorage.setItem(RECEIPT_THUMBNAILS_STORAGE_KEY, "{not json");
      expect(getThumbnails()).toEqual({});
    });

    it("removes exactly one receipt's thumbnail and leaves others", () => {
      setThumbnail("r1", THUMB_A);
      setThumbnail("r2", THUMB_B);
      removeThumbnail("r1");
      expect(getThumbnails()).toEqual({ r2: THUMB_B });
    });
  });

  describe("cleanup", () => {
    it("clears all thumbnails", () => {
      setThumbnail("r1", THUMB_A);
      setThumbnail("r2", THUMB_B);
      clearThumbnails();
      expect(getThumbnails()).toEqual({});
      expect(
        localStorage.getItem(RECEIPT_THUMBNAILS_STORAGE_KEY)
      ).toBeNull();
    });

    it("prunes stale ids not present in the session", () => {
      setThumbnail("keep", THUMB_A);
      setThumbnail("stale", THUMB_B);
      pruneThumbnails(["keep"]);
      expect(getThumbnails()).toEqual({ keep: THUMB_A });
    });

    it("does not rewrite storage when nothing is stale", () => {
      setThumbnail("r1", THUMB_A);
      const before = localStorage.getItem(RECEIPT_THUMBNAILS_STORAGE_KEY);
      pruneThumbnails(["r1"]);
      expect(localStorage.getItem(RECEIPT_THUMBNAILS_STORAGE_KEY)).toBe(before);
    });
  });

  describe("legacy migration", () => {
    it("attaches the legacy full-size image to the newest receipt, then deletes the legacy key", () => {
      localStorage.setItem(RECEIPT_IMAGE_STORAGE_KEY, LEGACY_FULL_SIZE);
      const attachedTo = migrateLegacyImage("newest");
      expect(attachedTo).toBe("newest");
      expect(getThumbnails()).toEqual({ newest: LEGACY_FULL_SIZE });
      expect(localStorage.getItem(RECEIPT_IMAGE_STORAGE_KEY)).toBeNull();
    });

    it("deletes the legacy key even when there is no receipt to attach to", () => {
      localStorage.setItem(RECEIPT_IMAGE_STORAGE_KEY, LEGACY_FULL_SIZE);
      expect(migrateLegacyImage(null)).toBeNull();
      expect(localStorage.getItem(RECEIPT_IMAGE_STORAGE_KEY)).toBeNull();
      expect(getThumbnails()).toEqual({});
    });

    it("is a no-op when no legacy key exists", () => {
      expect(migrateLegacyImage("r1")).toBeNull();
      expect(getThumbnails()).toEqual({});
    });

    it("never writes N full-size data URLs — one bounded JSON map under a single key", () => {
      for (let i = 0; i < 10; i++) {
        setThumbnail(`r${i}`, `data:image/jpeg;base64,${"x".repeat(200)}`);
      }
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }
      expect(keys.filter((k) => k.startsWith("receiptSplitter"))).toEqual([
        RECEIPT_THUMBNAILS_STORAGE_KEY,
      ]);
    });
  });
});
