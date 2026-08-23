import { z } from "zod";

// Zod schema for receipt validation
// Note: price is nullable to handle item modifiers (e.g., "ADD CHEESE") that don't have
// their own price listed on the receipt. These items are filtered out during normalization.
export const receiptItemSchema = z.object({
  name: z.string(),
  price: z.number().nullable(),
  quantity: z.number().optional(),
});

export const receiptSchema = z.object({
  restaurant: z.string().nullable(),
  date: z.string().nullable(),
  total: z.number().nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  tip: z.number().nullable(),
  items: z.array(receiptItemSchema),
  // Optional with a default so the field is always present on validated data
  // (see src/types/index.ts: currency is always present after parsing).
  currency: z.string().optional().default("USD"),
});

/**
 * Structured-output JSON schema sent to the Anthropic API via
 * `output_config.format.schema`.
 *
 * IMPORTANT: this schema has `additionalProperties: false`, so every field the
 * prompt asks the model to return must be listed here AND in `required` —
 * otherwise the model is contractually barred from returning it. `currency`
 * must stay in `properties` and `required` or AI currency detection breaks
 * and every receipt silently falls back to USD.
 */
export const receiptJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    restaurant: { type: ["string", "null"] },
    date: { type: ["string", "null"] },
    total: { type: ["number", "null"] },
    subtotal: { type: ["number", "null"] },
    tax: { type: ["number", "null"] },
    tip: { type: ["number", "null"] },
    currency: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          price: { type: ["number", "null"] },
          quantity: { type: "number" },
        },
        required: ["name", "price", "quantity"],
      },
    },
  },
  required: [
    "restaurant",
    "date",
    "total",
    "subtotal",
    "tax",
    "tip",
    "currency",
    "items",
  ],
} as const;
