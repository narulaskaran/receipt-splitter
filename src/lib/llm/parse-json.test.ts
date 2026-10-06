import { parseModelJson } from "./parse-json";
import { LLMError } from "./types";
import { receiptSchema } from "@/lib/receipt-schema";

describe("parseModelJson", () => {
  it("strips ```json code fences from response", () => {
    const wrapped = '```json\n{"restaurant": "MONTESACRO", "items": []}\n```';
    expect(parseModelJson(wrapped, "test")).toEqual({ restaurant: "MONTESACRO", items: [] });
  });

  it("strips ``` code fences without json tag", () => {
    const wrapped = '```\n{"restaurant": "Test", "items": []}\n```';
    expect(parseModelJson(wrapped, "test")).toEqual({ restaurant: "Test", items: [] });
  });

  it("leaves plain JSON unchanged", () => {
    const plain = '{"restaurant": "Test", "items": []}';
    expect(parseModelJson(plain, "test")).toEqual({ restaurant: "Test", items: [] });
  });

  it("handles code fences with trailing whitespace", () => {
    const wrapped = '```json\n{"restaurant": "Test", "items": []}\n```  ';
    expect(parseModelJson(wrapped, "test")).toEqual({ restaurant: "Test", items: [] });
  });

  it("handles a full realistic Haiku 4.5 response with code fences", () => {
    const response = `\`\`\`json
{
  "restaurant": "MONTESACRO",
  "date": "2026-02-21",
  "total": 259.04,
  "subtotal": 201.00,
  "tax": 17.84,
  "tip": 40.20,
  "items": [
    { "name": "Carbonara", "price": 25.00, "quantity": 2 },
    { "name": "Garbatella", "price": 26.00, "quantity": 1 },
    { "name": "AGNOLOTTI", "price": 26.00, "quantity": 1 },
    { "name": "Maranella", "price": 25.00, "quantity": 1 },
    { "name": "INFERNETTO", "price": 25.00, "quantity": 1 },
    { "name": "Portonaccio", "price": 24.00, "quantity": 1 },
    { "name": "Carbonara", "price": 25.00, "quantity": 1 }
  ]
}
\`\`\``;
    const parsed = parseModelJson(response, "test") as Record<string, unknown>;

    expect(parsed.restaurant).toBe("MONTESACRO");
    expect(parsed.items).toHaveLength(7);
    expect(parsed.total).toBe(259.04);
    expect(receiptSchema.safeParse(parsed).success).toBe(true);
  });

  it("throws an invalid_json LLMError tagged with the provider", () => {
    expect.assertions(3);
    try {
      parseModelJson("Sorry, I can't read this receipt.", "openai");
    } catch (error) {
      expect(error).toBeInstanceOf(LLMError);
      expect((error as LLMError).kind).toBe("invalid_json");
      expect((error as LLMError).provider).toBe("openai");
    }
  });
});
