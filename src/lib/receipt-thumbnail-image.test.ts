import {
  THUMBNAIL_MAX_BYTES,
  createReceiptThumbnail,
  persistReceiptThumbnail,
} from "./receipt-thumbnail-image";
import imageCompression from "browser-image-compression";
import { RECEIPT_THUMBNAILS_STORAGE_KEY, getThumbnails } from "./receipt-thumbnails";

jest.mock("browser-image-compression", () => jest.fn());

const THUMB_BLOB = new Blob([new ArrayBuffer(512)], { type: "image/jpeg" });

function fakeReadAsDataUrl(result: string | null) {
  const OriginalFileReader = global.FileReader;
  class FakeFileReader {
    result: string | ArrayBuffer | null = null;
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
    readAsDataURL() {
      this.result = result;
      queueMicrotask(() => {
        if (result) this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
        else this.onerror?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      });
    }
  }
  global.FileReader = FakeFileReader as unknown as typeof FileReader;
  return () => {
    global.FileReader = OriginalFileReader;
  };
}

describe("receipt-thumbnail-image", () => {
  beforeEach(() => {
    localStorage.clear();
    (imageCompression as unknown as jest.Mock).mockReset();
  });

  describe("createReceiptThumbnail", () => {
    it("compresses an image to a small data URL", async () => {
      (imageCompression as unknown as jest.Mock).mockResolvedValueOnce(THUMB_BLOB);
      const restore = fakeReadAsDataUrl("data:image/jpeg;base64,thumb");

      try {
        const thumb = await createReceiptThumbnail(
          new File([new ArrayBuffer(1024)], "r.jpg", { type: "image/jpeg" })
        );
        expect(thumb).toBe("data:image/jpeg;base64,thumb");
        expect(imageCompression).toHaveBeenCalledWith(expect.anything(), {
          maxSizeMB: THUMBNAIL_MAX_BYTES / (1024 * 1024),
          maxWidthOrHeight: expect.any(Number),
          useWebWorker: true,
        });
      } finally {
        restore();
      }
    });

    it("returns null for non-image files (PDFs keep the placeholder)", async () => {
      const thumb = await createReceiptThumbnail(
        new File(["pdf"], "r.pdf", { type: "application/pdf" })
      );
      expect(thumb).toBeNull();
      expect(imageCompression).not.toHaveBeenCalled();
    });

    it("returns null when compression fails", async () => {
      (imageCompression as unknown as jest.Mock).mockRejectedValueOnce(new Error("boom"));
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const thumb = await createReceiptThumbnail(
        new File([new ArrayBuffer(1024)], "r.jpg", { type: "image/jpeg" })
      );
      expect(thumb).toBeNull();
      warn.mockRestore();
    });

    it("returns null when the encoded thumbnail exceeds the size cap", async () => {
      (imageCompression as unknown as jest.Mock).mockResolvedValueOnce(THUMB_BLOB);
      const restore = fakeReadAsDataUrl(
        "data:image/jpeg;base64," + "R".repeat(THUMBNAIL_MAX_BYTES)
      );
      try {
        const thumb = await createReceiptThumbnail(
          new File([new ArrayBuffer(1024)], "r.jpg", { type: "image/jpeg" })
        );
        expect(thumb).toBeNull();
      } finally {
        restore();
      }
    });
  });

  describe("persistReceiptThumbnail", () => {
    it("stores the thumbnail under the receipt id", () => {
      expect(persistReceiptThumbnail("r1", "data:image/png;base64,AA")).toBe(true);
      expect(getThumbnails()).toEqual({ r1: "data:image/png;base64,AA" });
    });

    it("evicts older thumbnails on quota failure instead of dropping the newest", () => {
      persistReceiptThumbnail("old1", "data:image/png;base64,1");
      persistReceiptThumbnail("old2", "data:image/png;base64,2");
      const originalSetItem = localStorage.setItem;
      let failedOnce = false;
      localStorage.setItem = jest.fn((key: string, value: string) => {
        if (
          key === RECEIPT_THUMBNAILS_STORAGE_KEY &&
          value.includes('"newest"') &&
          !failedOnce
        ) {
          // First write of the newest entry fails (quota), then succeeds once old1 is gone.
          failedOnce = true;
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return originalSetItem.call(localStorage, key, value);
      }) as typeof localStorage.setItem;

      try {
        expect(persistReceiptThumbnail("newest", "data:image/png;base64,N")).toBe(true);
        const thumbs = getThumbnails();
        expect(thumbs["newest"]).toBe("data:image/png;base64,N");
        expect(thumbs["old2"]).toBeDefined();
        expect(thumbs["old1"]).toBeUndefined();
      } finally {
        localStorage.setItem = originalSetItem;
      }
    });
  });
});
