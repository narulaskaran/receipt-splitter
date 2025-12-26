/**
 * @jest-environment node
 */
import { POST } from "./route";
import Anthropic from "@anthropic-ai/sdk";

// Mock Anthropic SDK
jest.mock("@anthropic-ai/sdk");

// Mock Next.js Request and Response
const createMockFormData = (file: unknown): FormData => {
  const map = new Map();
  map.set("file", file);
  return {
    get: (key: string) => map.get(key),
  } as unknown as FormData;
};

const createMockRequest = (formData: FormData): Request => {
  return {
    formData: async () => formData,
  } as unknown as Request;
};

const createMockFile = (
  content: string,
  type: string,
  size: number,
  name = "test.jpg"
): File => {
  const buffer = Buffer.from(content);
  return {
    type,
    size,
    name,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as unknown as File;
};

describe("POST /api/parse-receipt", () => {
  const originalEnv = process.env;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_API_KEY = "test-api-key";

    // Setup Anthropic mock
    mockCreate = jest.fn();
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    } as unknown as Anthropic));

    // Reset console mocks
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("Configuration Validation", () => {
    it("should return 500 if ANTHROPIC_API_KEY is not set", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Server configuration error: API key not found");
    });
  });

  describe("File Upload Validation", () => {
    it("should return 400 if no file is provided", async () => {
      const formData = createMockFormData(null);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No file provided in the request");
    });

    it("should return 400 if file size exceeds 20MB", async () => {
      const largeSize = 21 * 1024 * 1024; // 21MB
      const file = createMockFile("test", "image/jpeg", largeSize);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("File size exceeds the maximum limit");
    });

    it("should return 400 if file is empty", async () => {
      const file = createMockFile("", "image/jpeg", 0);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Uploaded file is empty");
    });

    it("should return 400 for unsupported file types", async () => {
      const file = createMockFile("test", "text/plain", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Unsupported file format. Please use JPEG, PNG, GIF, WebP, or PDF."
      );
    });
  });

  describe("Supported File Types", () => {
    const validTypes: Array<[string, string]> = [
      ["image/jpeg", "test-image.jpg"],
      ["image/png", "test-image.png"],
      ["image/gif", "test-image.gif"],
      ["image/webp", "test-image.webp"],
      ["application/pdf", "test-doc.pdf"],
    ];

    validTypes.forEach(([mimeType, filename]) => {
      it(`should accept ${mimeType} files`, async () => {
        mockCreate.mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                restaurant: "Test Restaurant",
                date: "2024-01-01",
                total: 50.0,
                subtotal: 45.0,
                tax: 4.0,
                tip: 1.0,
                items: [{ name: "Test Item", price: 45.0, quantity: 1 }],
              }),
            },
          ],
        });

        const file = createMockFile("test content", mimeType, 100, filename);
        const formData = createMockFormData(file);
        const request = createMockRequest(formData);

        const response = await POST(request as Request);

        expect(response.status).toBe(200);
        expect(mockCreate).toHaveBeenCalled();
      });
    });
  });

  describe("Anthropic API Integration", () => {
    it("should successfully parse a valid receipt", async () => {
      const mockReceipt = {
        restaurant: "Test Restaurant",
        date: "2024-01-01",
        total: 50.0,
        subtotal: 45.0,
        tax: 4.0,
        tip: 1.0,
        items: [
          { name: "Burger", price: 15.0, quantity: 2 },
          { name: "Fries", price: 5.0, quantity: 3 },
        ],
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockReceipt),
          },
        ],
      });

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockReceipt);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 4096,
        })
      );
    });

    it("should handle rate limit errors (429)", async () => {
      const apiError = new Anthropic.APIError(
        429,
        {} as Response,
        "Rate limit exceeded",
        {} as Record<string, unknown>
      );

      mockCreate.mockRejectedValue(apiError);

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe(
        "Rate limit exceeded. Please try again in a few moments."
      );
    });

    it("should handle invalid request errors (400)", async () => {
      const apiError = new Anthropic.APIError(
        400,
        {} as Response,
        "Invalid request",
        {} as Record<string, unknown>
      );

      mockCreate.mockRejectedValue(apiError);

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid request format");
    });

    it("should handle general API errors", async () => {
      mockCreate.mockRejectedValue(new Error("Network error"));

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe(
        "Failed to process receipt. Please try again later."
      );
    });
  });

  describe("Response Parsing", () => {
    it("should return 500 if response has no text content", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "image",
            data: "base64data",
          },
        ],
      });

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to parse receipt. Please try again later.");
    });

    it("should return 500 if response is not valid JSON", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "This is not JSON",
          },
        ],
      });

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to parse receipt. Please try again later.");
    });

    it("should return 500 if receipt schema validation fails", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              restaurant: "Test",
              items: "not an array", // Invalid type
            }),
          },
        ],
      });

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to parse receipt. Please try again later.");
    });

    it("should handle receipts with null values", async () => {
      const mockReceipt = {
        restaurant: null,
        date: null,
        total: null,
        subtotal: 10.0,
        tax: null,
        tip: null,
        items: [{ name: "Item", price: 10.0 }],
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockReceipt),
          },
        ],
      });

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockReceipt);
    });

    it("should handle items with optional quantity field", async () => {
      const mockReceipt = {
        restaurant: "Test",
        date: "2024-01-01",
        total: 10.0,
        subtotal: 10.0,
        tax: 0,
        tip: null,
        items: [
          { name: "Item 1", price: 5.0 }, // No quantity
          { name: "Item 2", price: 5.0, quantity: 2 }, // With quantity
        ],
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockReceipt),
          },
        ],
      });

      const file = createMockFile("test", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      const response = await POST(request as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockReceipt);
    });
  });

  describe("Content Type Handling", () => {
    it("should include correct content type for images", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              restaurant: "Test",
              date: null,
              total: 10.0,
              subtotal: 10.0,
              tax: 0,
              tip: null,
              items: [{ name: "Item", price: 10.0 }],
            }),
          },
        ],
      });

      const file = createMockFile("image data", "image/jpeg", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      await POST(request as Request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: "image",
                  source: expect.objectContaining({
                    type: "base64",
                    media_type: "image/jpeg",
                  }),
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it("should include correct content type for PDFs", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              restaurant: "Test",
              date: null,
              total: 10.0,
              subtotal: 10.0,
              tax: 0,
              tip: null,
              items: [{ name: "Item", price: 10.0 }],
            }),
          },
        ],
      });

      const file = createMockFile("pdf data", "application/pdf", 100);
      const formData = createMockFormData(file);
      const request = createMockRequest(formData);

      await POST(request as Request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: "document",
                  source: expect.objectContaining({
                    type: "base64",
                    media_type: "application/pdf",
                  }),
                }),
              ]),
            }),
          ]),
        })
      );
    });
  });
});
