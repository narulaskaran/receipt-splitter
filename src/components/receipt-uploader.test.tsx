import { render, screen, waitFor } from "@testing-library/react";
import { ReceiptUploader } from "./receipt-uploader";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

jest.mock("browser-image-compression", () => jest.fn());

describe("ReceiptUploader", () => {

  it("renders upload prompt", () => {
    render(
      <ReceiptUploader
        onReceiptParsed={() => {}}
        isLoading={false}
        setIsLoading={() => {}}
        resetImageTrigger={0}
      />
    );
    expect(screen.getByText(/upload your receipt/i)).toBeInTheDocument();
  });

  it("accepts PDF files", async () => {
    const mockOnReceiptParsed = jest.fn();
    const mockSetIsLoading = jest.fn();

    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        restaurant: "Test Restaurant",
        total: 100,
        items: [],
      }),
    });

    render(
      <ReceiptUploader
        onReceiptParsed={mockOnReceiptParsed}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
        resetImageTrigger={0}
      />
    );

    // Create a mock PDF file
    const pdfFile = new File(["mock pdf content"], "receipt.pdf", {
      type: "application/pdf",
    });

    const input = screen.getByRole("presentation").querySelector("input");
    if (input) {
      await userEvent.upload(input, pdfFile);

      await waitFor(() => {
        expect(mockSetIsLoading).toHaveBeenCalledWith(true);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/parse-receipt",
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    }
  });

  it("shows PDF placeholder when PDF is uploaded", async () => {
    const mockOnReceiptParsed = jest.fn();
    const mockSetIsLoading = jest.fn();

    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        restaurant: "Test Restaurant",
        total: 100,
        items: [],
      }),
    });

    render(
      <ReceiptUploader
        onReceiptParsed={mockOnReceiptParsed}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
        resetImageTrigger={0}
      />
    );

    const pdfFile = new File(["mock pdf content"], "receipt.pdf", {
      type: "application/pdf",
    });

    const input = screen.getByRole("presentation").querySelector("input");
    if (input) {
      await userEvent.upload(input, pdfFile);

      // Wait for the FileText icon to be rendered (PDF placeholder)
      await waitFor(() => {
        // Check that a file icon is displayed (via the FileText component)
        const svgs = document.querySelectorAll("svg");
        expect(svgs.length).toBeGreaterThan(0);
      });
    }
  });

  it("rejects non-image and non-PDF files", async () => {
    const mockOnReceiptParsed = jest.fn();
    const mockSetIsLoading = jest.fn();

    render(
      <ReceiptUploader
        onReceiptParsed={mockOnReceiptParsed}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
        resetImageTrigger={0}
      />
    );

    const txtFile = new File(["test content"], "test.txt", {
      type: "text/plain",
    });

    const input = screen.getByRole("presentation").querySelector("input");
    if (input) {
      await userEvent.upload(input, txtFile);

      // Should not call the API
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSetIsLoading).not.toHaveBeenCalled();
    }
  });

  it("compresses images larger than 4.5MB before uploading", async () => {
    const mockOnReceiptParsed = jest.fn();
    const mockSetIsLoading = jest.fn();

    // Mock successful compression (returns a smaller file)
    const compressedFile = new File([new ArrayBuffer(2 * 1024 * 1024)], "compressed.jpg", {
      type: "image/jpeg",
    });
    (imageCompression as unknown as jest.Mock).mockResolvedValueOnce(compressedFile);

    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        restaurant: "Test Restaurant",
        total: 100,
        items: [],
        subtotal: 100,
        tax: 0,
        tip: 0,
        currency: "USD",
      }),
    });

    render(
      <ReceiptUploader
        onReceiptParsed={mockOnReceiptParsed}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
        resetImageTrigger={0}
      />
    );

    // Create a file larger than 4.5MB (5MB)
    const largeFile = new File([new ArrayBuffer(5 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });

    const input = screen.getByRole("presentation").querySelector("input");
    if (input) {
      await userEvent.upload(input, largeFile);

      // Should attempt compression and then upload
      await waitFor(() => {
        expect(imageCompression).toHaveBeenCalledWith(largeFile, {
          maxSizeMB: 4,
          maxWidthOrHeight: 2048,
          useWebWorker: true,
        });
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/Compressed from 5\.0MB to 2\.0MB/)
        );
      });

      // Should proceed to upload the compressed file
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    }
  });

  it("rejects images over 50MB without attempting compression", async () => {
    const mockOnReceiptParsed = jest.fn();
    const mockSetIsLoading = jest.fn();

    render(
      <ReceiptUploader
        onReceiptParsed={mockOnReceiptParsed}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
        resetImageTrigger={0}
      />
    );

    // Create a file larger than 50MB (60MB)
    const hugeFile = new File([new ArrayBuffer(60 * 1024 * 1024)], "huge.jpg", {
      type: "image/jpeg",
    });

    const input = screen.getByRole("presentation").querySelector("input");
    if (input) {
      await userEvent.upload(input, hugeFile);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/too large to compress.*60\.0MB.*Maximum is 50MB/)
        );
      });
      expect(imageCompression).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    }
  });

  it("shows single error when compression succeeds but result still exceeds limit", async () => {
    const mockOnReceiptParsed = jest.fn();
    const mockSetIsLoading = jest.fn();

    // Mock compression that returns a file still over 4.5MB
    const stillTooLargeFile = new File([new ArrayBuffer(4.8 * 1024 * 1024)], "still-large.jpg", {
      type: "image/jpeg",
    });
    (imageCompression as unknown as jest.Mock).mockResolvedValueOnce(stillTooLargeFile);

    render(
      <ReceiptUploader
        onReceiptParsed={mockOnReceiptParsed}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
        resetImageTrigger={0}
      />
    );

    const largeFile = new File([new ArrayBuffer(10 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });

    const input = screen.getByRole("presentation").querySelector("input");
    if (input) {
      await userEvent.upload(input, largeFile);

      // Should show a single descriptive error, not a success followed by an error
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/Compressed from.*still over the 4\.5MB limit/)
        );
      });
      expect(toast.success).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    }
  });

  it("shows error when compression fails", async () => {
    const mockOnReceiptParsed = jest.fn();
    const mockSetIsLoading = jest.fn();

    (imageCompression as unknown as jest.Mock).mockRejectedValueOnce(new Error("Compression failed"));

    render(
      <ReceiptUploader
        onReceiptParsed={mockOnReceiptParsed}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
        resetImageTrigger={0}
      />
    );

    const largeFile = new File([new ArrayBuffer(5 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });

    const input = screen.getByRole("presentation").querySelector("input");
    if (input) {
      await userEvent.upload(input, largeFile);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/Compression failed/)
        );
      });
      expect(global.fetch).not.toHaveBeenCalled();
    }
  });
});
