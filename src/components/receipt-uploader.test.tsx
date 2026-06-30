import { render, screen, waitFor } from "@testing-library/react";
import { ReceiptUploader } from "./receipt-uploader";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

jest.mock("browser-image-compression", () => jest.fn());

describe("ReceiptUploader", () => {
  let mockOnReceiptParsed: jest.Mock;
  let mockSetIsLoading: jest.Mock;

  beforeEach(() => {
    mockOnReceiptParsed = jest.fn();
    mockSetIsLoading = jest.fn();
  });

  function renderUploader() {
    return render(
      <ReceiptUploader
        onReceiptParsed={mockOnReceiptParsed}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
        resetImageTrigger={0}
      />
    );
  }

  function getFileInput() {
    const input = screen.getByRole("presentation").querySelector("input");
    expect(input).not.toBeNull();
    return input!;
  }

  it("renders upload prompt", () => {
    renderUploader();
    expect(screen.getByText(/upload your receipt/i)).toBeInTheDocument();
  });

  it("accepts PDF files", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ restaurant: "Test Restaurant", total: 100, items: [] }),
    });

    renderUploader();

    const pdfFile = new File(["mock pdf content"], "receipt.pdf", { type: "application/pdf" });
    await userEvent.upload(getFileInput(), pdfFile);

    await waitFor(() => {
      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
    });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/parse-receipt",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows PDF placeholder when PDF is uploaded", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ restaurant: "Test Restaurant", total: 100, items: [] }),
    });

    renderUploader();

    const pdfFile = new File(["mock pdf content"], "receipt.pdf", { type: "application/pdf" });
    await userEvent.upload(getFileInput(), pdfFile);

    await waitFor(() => {
      expect(document.querySelectorAll("svg").length).toBeGreaterThan(0);
    });
  });

  it("rejects non-image and non-PDF files", async () => {
    renderUploader();

    const txtFile = new File(["test content"], "test.txt", { type: "text/plain" });
    await userEvent.upload(getFileInput(), txtFile);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSetIsLoading).not.toHaveBeenCalled();
  });

  it("compresses images larger than 4.5MB before uploading", async () => {
    const compressedFile = new File([new ArrayBuffer(2 * 1024 * 1024)], "compressed.jpg", { type: "image/jpeg" });
    (imageCompression as unknown as jest.Mock).mockResolvedValueOnce(compressedFile);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ restaurant: "Test Restaurant", total: 100, items: [], subtotal: 100, tax: 0, tip: 0, currency: "USD" }),
    });

    renderUploader();

    const largeFile = new File([new ArrayBuffer(5 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" });
    await userEvent.upload(getFileInput(), largeFile);

    await waitFor(() => {
      expect(imageCompression).toHaveBeenCalledWith(largeFile, {
        maxSizeMB: 4,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Compressed from 5\.0MB to 2\.0MB/));
    });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it("rejects images over 50MB without attempting compression", async () => {
    renderUploader();

    const hugeFile = new File([new ArrayBuffer(60 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" });
    await userEvent.upload(getFileInput(), hugeFile);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/too large to compress.*60\.0MB.*Maximum is 50MB/)
      );
    });
    expect(imageCompression).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows single error when compression result still exceeds limit", async () => {
    const stillTooLargeFile = new File([new ArrayBuffer(4.8 * 1024 * 1024)], "still-large.jpg", { type: "image/jpeg" });
    (imageCompression as unknown as jest.Mock).mockResolvedValueOnce(stillTooLargeFile);

    renderUploader();

    const largeFile = new File([new ArrayBuffer(10 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" });
    await userEvent.upload(getFileInput(), largeFile);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/Compressed from.*still over the 4\.5MB limit/)
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects PDFs over the size limit without compressing", async () => {
    renderUploader();

    const largePdf = new File([new ArrayBuffer(5 * 1024 * 1024)], "large.pdf", { type: "application/pdf" });
    await userEvent.upload(getFileInput(), largePdf);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/too large.*4\.5MB/i));
    });
    expect(imageCompression).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows error when compression fails", async () => {
    (imageCompression as unknown as jest.Mock).mockRejectedValueOnce(new Error("Compression failed"));

    renderUploader();

    const largeFile = new File([new ArrayBuffer(5 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" });
    await userEvent.upload(getFileInput(), largeFile);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Compression failed/));
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("continues with preview when image caching fails due to QuotaExceededError", async () => {
    // Override setItem directly (not spyOn) so global clearAllMocks doesn't interfere
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn((key: string, value: string) => {
      if (key === "receiptSplitterImage") {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      return originalSetItem(key, value);
    }) as typeof localStorage.setItem;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ restaurant: "Test Restaurant", total: 100, items: [], subtotal: 100, tax: 0, tip: 0, currency: "USD" }),
    });

    renderUploader();

    const imageFile = new File([new ArrayBuffer(1024)], "test.jpg", { type: "image/jpeg" });
    await userEvent.upload(getFileInput(), imageFile);

    // Should still show preview and call fetch — caching is best-effort
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    // No error toast for caching failure
    expect(toast.error).not.toHaveBeenCalled();
  });
});
