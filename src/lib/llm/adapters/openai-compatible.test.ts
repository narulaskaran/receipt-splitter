/**
 * @jest-environment node
 */
jest.mock("openai", () => {
  const createMock = jest.fn();
  const ctorMock = jest.fn();
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  class OpenAI {
    chat = { completions: { create: createMock } };
    static APIError = APIError;
    static ctorMock = ctorMock;
    constructor(options: unknown) {
      ctorMock(options);
    }
  }
  return { __esModule: true, default: OpenAI };
});

import OpenAI from "openai";
import { createOpenAICompatibleExtractor } from "./openai-compatible";
import { LLMError } from "../types";

// Each mocked client instance shares the same jest.fn() for chat.completions.create
const mockCreate = new OpenAI().chat.completions.create as unknown as jest.Mock;
const mockCtor = (OpenAI as unknown as { ctorMock: jest.Mock }).ctorMock;

const schema = { type: "object" };
const input = (mimeType = "image/png") => ({
  data: Buffer.from("fake-bytes"),
  mimeType,
  prompt: "Parse this receipt",
  jsonSchema: schema,
});
const base64 = Buffer.from("fake-bytes").toString("base64");
const completion = (message: Record<string, unknown>) => ({ choices: [{ message }] });

function createExtractor(overrides: Record<string, unknown> = {}) {
  return createOpenAICompatibleExtractor({
    provider: "openai",
    apiKey: "k",
    model: "gpt-test",
    ...overrides,
  });
}

async function extractError(promise: Promise<unknown>): Promise<LLMError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(LLMError);
    return error as LLMError;
  }
  throw new Error("expected extract to reject");
}

describe("createOpenAICompatibleExtractor", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCtor.mockReset();
  });

  it("passes base URL and headers through to the client", () => {
    createExtractor({
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "X-Title": "Receipt Splitter" },
    });
    expect(mockCtor).toHaveBeenCalledWith({
      apiKey: "k",
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "X-Title": "Receipt Splitter" },
    });
  });

  it("exposes provider, model and supported MIME types", () => {
    const extractor = createExtractor();
    expect(extractor.provider).toBe("openai");
    expect(extractor.model).toBe("gpt-test");
    expect(extractor.supportedMimeTypes).toContain("application/pdf");
    expect(createExtractor({ supportsPdf: false }).supportedMimeTypes).not.toContain(
      "application/pdf"
    );
  });

  it("sends images as data URLs with a strict json_schema response format", async () => {
    mockCreate.mockResolvedValue(completion({ content: '{"ok": true}' }));

    const result = await createExtractor().extract(input());

    expect(result).toEqual({ ok: true });
    expect(mockCreate).toHaveBeenCalledWith({
      model: "gpt-test",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } },
            { type: "text", text: "Parse this receipt" },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "receipt", strict: true, schema },
      },
    });
  });

  it("sends PDFs as file parts", async () => {
    mockCreate.mockResolvedValue(completion({ content: "{}" }));

    await createExtractor().extract(input("application/pdf"));

    const content = mockCreate.mock.calls[0][0].messages[0].content;
    expect(content[0]).toEqual({
      type: "file",
      file: { filename: "receipt.pdf", file_data: `data:application/pdf;base64,${base64}` },
    });
  });

  it("uses max_tokens when configured (OpenRouter)", async () => {
    mockCreate.mockResolvedValue(completion({ content: "{}" }));

    await createExtractor({ tokenLimitParam: "max_tokens" }).extract(input());

    const request = mockCreate.mock.calls[0][0];
    expect(request.max_tokens).toBe(4096);
    expect(request).not.toHaveProperty("max_completion_tokens");
  });

  it("rejects PDFs without calling the API when PDF input is disabled", async () => {
    const error = await extractError(
      createExtractor({ supportsPdf: false }).extract(input("application/pdf"))
    );
    expect(error.kind).toBe("bad_request");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("reports a refusal as empty_response with the refusal text", async () => {
    mockCreate.mockResolvedValue(completion({ content: null, refusal: "I can't help with that" }));

    const error = await extractError(createExtractor().extract(input()));
    expect(error.kind).toBe("empty_response");
    expect(error.message).toBe("No text content in openai response: I can't help with that");
  });

  it("reports a response with no choices as empty_response", async () => {
    mockCreate.mockResolvedValue({ choices: [] });

    const error = await extractError(createExtractor().extract(input()));
    expect(error.kind).toBe("empty_response");
  });
});
