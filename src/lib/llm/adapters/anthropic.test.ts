/**
 * @jest-environment node
 */
jest.mock("@anthropic-ai/sdk", () => {
  const createMock = jest.fn();
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  class Anthropic {
    messages = { create: createMock };
    static APIError = APIError;
  }
  return { __esModule: true, default: Anthropic };
});

import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicExtractor, DEFAULT_ANTHROPIC_MODEL } from "./anthropic";
import { LLMError } from "../types";

// Each mocked client instance shares the same jest.fn() for messages.create
const mockCreate = new Anthropic().messages.create as jest.Mock;
const MockAPIError = Anthropic.APIError as unknown as new (status: number, message: string) => Error;

const schema = { type: "object" };
const input = (mimeType = "image/png") => ({
  data: Buffer.from("fake-bytes"),
  mimeType,
  prompt: "Parse this receipt",
  jsonSchema: schema,
});
const textResponse = (text: string) => ({ content: [{ type: "text", text }] });

async function extractError(promise: Promise<unknown>): Promise<LLMError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(LLMError);
    return error as LLMError;
  }
  throw new Error("expected extract to reject");
}

describe("createAnthropicExtractor", () => {
  beforeEach(() => mockCreate.mockReset());

  it("defaults to Haiku 4.5 and allows a model override", () => {
    expect(createAnthropicExtractor({ apiKey: "k" }).model).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(createAnthropicExtractor({ apiKey: "k", model: "claude-x" }).model).toBe("claude-x");
  });

  it("supports images and PDFs", () => {
    expect(createAnthropicExtractor({ apiKey: "k" }).supportedMimeTypes).toEqual([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ]);
  });

  it("sends images as base64 image blocks with structured output", async () => {
    mockCreate.mockResolvedValue(textResponse('{"ok": true}'));

    const result = await createAnthropicExtractor({ apiKey: "k" }).extract(input());

    expect(result).toEqual({ ok: true });
    expect(mockCreate).toHaveBeenCalledWith({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: Buffer.from("fake-bytes").toString("base64"),
              },
            },
            { type: "text", text: "Parse this receipt" },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema } },
    });
  });

  it("sends PDFs as document blocks", async () => {
    mockCreate.mockResolvedValue(textResponse("{}"));

    await createAnthropicExtractor({ apiKey: "k" }).extract(input("application/pdf"));

    const content = mockCreate.mock.calls[0][0].messages[0].content;
    expect(content[0]).toEqual(
      expect.objectContaining({
        type: "document",
        source: expect.objectContaining({ media_type: "application/pdf" }),
      })
    );
  });

  it("strips code fences from the response", async () => {
    mockCreate.mockResolvedValue(textResponse('```json\n{"ok": true}\n```'));

    await expect(createAnthropicExtractor({ apiKey: "k" }).extract(input())).resolves.toEqual({
      ok: true,
    });
  });

  it("rejects unsupported media types without calling the API", async () => {
    const error = await extractError(
      createAnthropicExtractor({ apiKey: "k" }).extract(input("text/plain"))
    );
    expect(error.kind).toBe("bad_request");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([
    [429, "rate_limit"],
    [400, "bad_request"],
    [500, "api_error"],
  ] as const)("maps API status %i to %s", async (status, kind) => {
    mockCreate.mockRejectedValue(new MockAPIError(status, "boom"));

    const error = await extractError(createAnthropicExtractor({ apiKey: "k" }).extract(input()));
    expect(error).toMatchObject({ kind, status, provider: "anthropic", message: "boom" });
  });

  it("maps non-API errors to unknown", async () => {
    mockCreate.mockRejectedValue(new Error("socket hang up"));

    const error = await extractError(createAnthropicExtractor({ apiKey: "k" }).extract(input()));
    expect(error).toMatchObject({ kind: "unknown", message: "socket hang up" });
  });

  it("reports a response with no text block as empty_response", async () => {
    mockCreate.mockResolvedValue({ content: [] });

    const error = await extractError(createAnthropicExtractor({ apiKey: "k" }).extract(input()));
    expect(error.kind).toBe("empty_response");
  });

  it("reports non-JSON text as invalid_json", async () => {
    mockCreate.mockResolvedValue(textResponse("not json"));

    const error = await extractError(createAnthropicExtractor({ apiKey: "k" }).extract(input()));
    expect(error.kind).toBe("invalid_json");
  });
});
