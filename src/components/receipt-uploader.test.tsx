import { render, screen, waitFor } from "@testing-library/react";
import { ReceiptUploader } from "./receipt-uploader";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

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

  it("rejects files larger than 4.5MB", async () => {
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

    // Create a file larger than 4.5MB (5MB)
    const largeFile = new File([new ArrayBuffer(5 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });

    const input = screen.getByRole("presentation").querySelector("input");
    if (input) {
      await userEvent.upload(input, largeFile);

      // Should show error toast without calling API
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/File is too large.*Maximum size is 4\.5MB.*Your file is 5\.0MB/)
        );
      });
      expect(mockSetIsLoading).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    }
  });
});
