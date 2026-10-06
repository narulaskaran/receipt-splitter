/**
 * @jest-environment node
 *
 * Shared behaviour every ReceiptExtractor adapter must satisfy. When adding an
 * adapter, mock its SDK below and add an entry to `adapters`.
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
jest.mock("openai", () => {
  const createMock = jest.fn();
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
  }
  return { __esModule: true, default: OpenAI };
});

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createAnthropicExtractor } from "./anthropic";
import { createOpenAICompatibleExtractor } from "./openai-compatible";
import { LLMError, type ReceiptExtractor } from "../types";

type APIErrorCtor = new (status: number, message: string) => Error;

interface AdapterHarness {
  name: string;
  create: () => ReceiptExtractor;
  mockCreate: jest.Mock;
  respondWithText: (text: string) => unknown;
  apiError: APIErrorCtor;
}

const adapters: AdapterHarness[] = [
  {
    name: "anthropic",
    create: () => createAnthropicExtractor({ apiKey: "k" }),
    mockCreate: new Anthropic().messages.create as jest.Mock,
    respondWithText: (text) => ({ content: [{ type: "text", text }] }),
    apiError: Anthropic.APIError as unknown as APIErrorCtor,
  },
  {
    name: "openai-compatible",
    create: () => createOpenAICompatibleExtractor({ provider: "openai", apiKey: "k", model: "m" }),
    mockCreate: new OpenAI().chat.completions.create as unknown as jest.Mock,
    respondWithText: (text) => ({ choices: [{ message: { content: text } }] }),
    apiError: OpenAI.APIError as unknown as APIErrorCtor,
  },
];

const receiptJson = '{"restaurant": "Cafe", "items": []}';
const input = (mimeType: string) => ({
  data: Buffer.from("fake-bytes"),
  mimeType,
  prompt: "Parse this receipt",
  jsonSchema: { type: "object" },
});

describe.each(adapters)("$name adapter contract", (adapter) => {
  beforeEach(() => adapter.mockCreate.mockReset());

  it("accepts images and PDFs", () => {
    const { supportedMimeTypes } = adapter.create();
    for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(supportedMimeTypes).toContain(type);
    }
  });

  it.each(["image/png", "application/pdf"])("returns parsed JSON for %s", async (mimeType) => {
    adapter.mockCreate.mockResolvedValue(adapter.respondWithText(receiptJson));
    await expect(adapter.create().extract(input(mimeType))).resolves.toEqual({
      restaurant: "Cafe",
      items: [],
    });
  });

  it("forwards the prompt and schema to the provider", async () => {
    adapter.mockCreate.mockResolvedValue(adapter.respondWithText(receiptJson));
    await adapter.create().extract(input("image/png"));

    const request = JSON.stringify(adapter.mockCreate.mock.calls[0][0]);
    expect(request).toContain("Parse this receipt");
    expect(request).toContain('{"type":"object"}');
  });

  it("strips code fences", async () => {
    adapter.mockCreate.mockResolvedValue(adapter.respondWithText("```json\n" + receiptJson + "\n```"));
    await expect(adapter.create().extract(input("image/png"))).resolves.toEqual({
      restaurant: "Cafe",
      items: [],
    });
  });

  it.each([
    [429, "rate_limit"],
    [400, "bad_request"],
    [503, "api_error"],
  ] as const)("maps HTTP %i to %s", async (status, kind) => {
    adapter.mockCreate.mockRejectedValue(new adapter.apiError(status, "boom"));
    await expect(adapter.create().extract(input("image/png"))).rejects.toMatchObject({
      kind,
      status,
      message: "boom",
    });
  });

  it("maps network errors to unknown", async () => {
    adapter.mockCreate.mockRejectedValue(new Error("socket hang up"));
    await expect(adapter.create().extract(input("image/png"))).rejects.toMatchObject({
      kind: "unknown",
      message: "socket hang up",
    });
  });

  it("maps non-JSON output to invalid_json", async () => {
    adapter.mockCreate.mockResolvedValue(adapter.respondWithText("not json"));
    const promise = adapter.create().extract(input("image/png"));
    await expect(promise).rejects.toBeInstanceOf(LLMError);
    await expect(promise).rejects.toMatchObject({ kind: "invalid_json" });
  });
});
