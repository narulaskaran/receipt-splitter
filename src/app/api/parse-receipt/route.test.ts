import { z } from "zod";

// Re-create the schemas here for testing (they're not exported from route.ts)
// This tests the schema validation logic independently of the API endpoint
const receiptItemSchema = z.object({
  name: z.string(),
  price: z.number().nullable(),
  quantity: z.number().optional(),
});

const receiptSchema = z.object({
  restaurant: z.string().nullable(),
  date: z.string().nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  tip: z.number().nullable(),
  total: z.number().nullable(),
  items: z.array(receiptItemSchema),
});

// Mirror of the fixMultiQuantityPrices function in route.ts (not exported, so re-implemented here)
function fixMultiQuantityPrices(
  items: Array<{ name: string; price: number; quantity: number }>,
  subtotal: number
): { items: Array<{ name: string; price: number; quantity: number }>; corrected: boolean } {
  if (subtotal <= 0) return { items, corrected: false };

  const hasMultiQty = items.some((item) => (item.quantity || 1) > 1);
  if (!hasMultiQty) return { items, corrected: false };

  const currentTotal = items.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );
  const currentDiff = Math.abs(currentTotal - subtotal);

  if (currentDiff <= subtotal * 0.1) return { items, corrected: false };

  const corrected = items.map((item) => {
    const qty = item.quantity || 1;
    if (qty > 1) {
      return { ...item, price: item.price / qty };
    }
    return item;
  });

  const correctedTotal = corrected.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );
  const correctedDiff = Math.abs(correctedTotal - subtotal);

  if (correctedDiff < currentDiff * 0.5) {
    return { items: corrected, corrected: true };
  }

  return { items, corrected: false };
}

// Helper function that mirrors the normalization logic in route.ts
function normalizeReceipt(data: z.infer<typeof receiptSchema>) {
  const allItems = data.items;
  const validItems = allItems.filter(
    (item): item is typeof item & { price: number } => item.price !== null
  );

  const filteredItems = allItems.filter((item) => item.price === null);

  return {
    normalizedReceipt: {
      ...data,
      subtotal: data.subtotal ?? 0,
      tax: data.tax ?? 0,
      total: data.total ?? 0,
      items: validItems.map((item) => ({
        ...item,
        quantity: item.quantity ?? 1,
      })),
    },
    filteredItems,
    allItemsFiltered: validItems.length === 0 && allItems.length > 0,
  };
}

describe("parse-receipt schema validation", () => {
  describe("receiptItemSchema", () => {
    it("validates item with valid price", () => {
      const item = { name: "Burger", price: 10.99, quantity: 1 };
      const result = receiptItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it("validates item with null price (modifier without price)", () => {
      const item = { name: "ADD CHEESE", price: null, quantity: 1 };
      const result = receiptItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBeNull();
      }
    });

    it("validates item without quantity (defaults handled later)", () => {
      const item = { name: "Fries", price: 5.99 };
      const result = receiptItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it("rejects item with invalid price type", () => {
      const item = { name: "Bad Item", price: "ten dollars", quantity: 1 };
      const result = receiptItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it("rejects item without name", () => {
      const item = { price: 10.99, quantity: 1 };
      const result = receiptItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });
  });

  describe("receiptSchema", () => {
    it("validates complete receipt with mixed null and valid prices", () => {
      const receipt = {
        restaurant: "Stout Grand Central",
        date: "2026-01-14",
        subtotal: 277.0,
        tax: 24.61,
        tip: 55.4,
        total: 357.01,
        items: [
          { name: "Club Soda", price: 8.0, quantity: 2 },
          { name: "Uber Bavarian Pretzel", price: 17.0, quantity: 1 },
          { name: "ADD CHEESE", price: null, quantity: 1 }, // Modifier without price
          { name: "Dogfish Head 90 Minute IPA", price: 11.0, quantity: 1 },
        ],
      };

      const result = receiptSchema.safeParse(receipt);
      expect(result.success).toBe(true);
    });

    it("validates receipt with all null prices", () => {
      const receipt = {
        restaurant: "Test",
        date: null,
        subtotal: 0,
        tax: 0,
        tip: null,
        total: 0,
        items: [
          { name: "ADD CHEESE", price: null },
          { name: "EXTRA SAUCE", price: null },
        ],
      };

      const result = receiptSchema.safeParse(receipt);
      expect(result.success).toBe(true);
    });
  });
});

describe("receipt normalization", () => {
  describe("filtering items with null prices", () => {
    it("filters out items with null prices", () => {
      const data = {
        restaurant: "Test Restaurant",
        date: "2026-01-14",
        subtotal: 27.0,
        tax: 2.0,
        tip: 5.0,
        total: 34.0,
        items: [
          { name: "Burger", price: 10.0, quantity: 1 },
          { name: "ADD CHEESE", price: null, quantity: 1 },
          { name: "Fries", price: 7.0, quantity: 1 },
          { name: "EXTRA SAUCE", price: null, quantity: 1 },
          { name: "Drink", price: 10.0, quantity: 1 },
        ],
      };

      const { normalizedReceipt, filteredItems } = normalizeReceipt(data);

      expect(normalizedReceipt.items).toHaveLength(3);
      expect(normalizedReceipt.items.map((i) => i.name)).toEqual([
        "Burger",
        "Fries",
        "Drink",
      ]);
      expect(filteredItems).toHaveLength(2);
      expect(filteredItems.map((i) => i.name)).toEqual([
        "ADD CHEESE",
        "EXTRA SAUCE",
      ]);
    });

    it("retains all items when none have null prices", () => {
      const data = {
        restaurant: "Test",
        date: null,
        subtotal: 20.0,
        tax: 2.0,
        tip: 3.0,
        total: 25.0,
        items: [
          { name: "Item 1", price: 10.0, quantity: 1 },
          { name: "Item 2", price: 10.0, quantity: 1 },
        ],
      };

      const { normalizedReceipt, filteredItems } = normalizeReceipt(data);

      expect(normalizedReceipt.items).toHaveLength(2);
      expect(filteredItems).toHaveLength(0);
    });

    it("handles receipt with only null-priced items", () => {
      const data = {
        restaurant: "Test",
        date: null,
        subtotal: 0,
        tax: 0,
        tip: null,
        total: 0,
        items: [
          { name: "ADD CHEESE", price: null },
          { name: "EXTRA SAUCE", price: null },
          { name: "NO ONIONS", price: null },
        ],
      };

      const { normalizedReceipt, filteredItems, allItemsFiltered } =
        normalizeReceipt(data);

      expect(normalizedReceipt.items).toHaveLength(0);
      expect(filteredItems).toHaveLength(3);
      expect(allItemsFiltered).toBe(true);
    });

    it("handles empty items array", () => {
      const data = {
        restaurant: "Test",
        date: null,
        subtotal: 0,
        tax: 0,
        tip: null,
        total: 0,
        items: [],
      };

      const { normalizedReceipt, filteredItems, allItemsFiltered } =
        normalizeReceipt(data);

      expect(normalizedReceipt.items).toHaveLength(0);
      expect(filteredItems).toHaveLength(0);
      expect(allItemsFiltered).toBe(false); // Empty array is not "all filtered"
    });
  });

  describe("normalizing nullable fields", () => {
    it("defaults null subtotal to 0", () => {
      const data = {
        restaurant: "Test",
        date: null,
        subtotal: null,
        tax: 5.0,
        tip: 3.0,
        total: 8.0,
        items: [],
      };

      const { normalizedReceipt } = normalizeReceipt(data);
      expect(normalizedReceipt.subtotal).toBe(0);
    });

    it("defaults null tax to 0", () => {
      const data = {
        restaurant: "Test",
        date: null,
        subtotal: 10.0,
        tax: null,
        tip: 3.0,
        total: 13.0,
        items: [],
      };

      const { normalizedReceipt } = normalizeReceipt(data);
      expect(normalizedReceipt.tax).toBe(0);
    });

    it("defaults null total to 0", () => {
      const data = {
        restaurant: "Test",
        date: null,
        subtotal: 10.0,
        tax: 1.0,
        tip: 2.0,
        total: null,
        items: [],
      };

      const { normalizedReceipt } = normalizeReceipt(data);
      expect(normalizedReceipt.total).toBe(0);
    });

    it("defaults missing quantity to 1", () => {
      const data = {
        restaurant: "Test",
        date: null,
        subtotal: 10.0,
        tax: 1.0,
        tip: 2.0,
        total: 13.0,
        items: [{ name: "Item without quantity", price: 10.0 }],
      };

      const { normalizedReceipt } = normalizeReceipt(data);
      expect(normalizedReceipt.items[0].quantity).toBe(1);
    });
  });

  describe("real-world receipt scenario (Stout Grand Central)", () => {
    it("correctly handles the receipt that caused the original 500 error", () => {
      // This simulates the data Claude returned for the Stout Grand Central receipt
      const claudeResponse = {
        restaurant: "Stout Grand Central",
        date: "2026-01-14",
        subtotal: 277.0,
        tax: 24.61,
        tip: 55.4,
        total: 357.01,
        items: [
          { name: "Club Soda", price: 8.0, quantity: 2 },
          { name: "MUM'S THE WORD", price: 36.0, quantity: 2 },
          { name: "Guinness Draught", price: 33.0, quantity: 3 },
          { name: "Uber Bavarian Pretzel", price: 17.0, quantity: 1 },
          { name: "ADD CHEESE", price: null, quantity: 1 }, // Index 4 - caused error
          { name: "Dogfish Head 90 Minute IPA", price: 11.0, quantity: 1 },
          { name: "Brooklyn Brewery - Lager Draft", price: 19.0, quantity: 2 },
          { name: "Heart Of Glass", price: 13.0, quantity: 1 },
          { name: "Dozen Wings", price: 29.0, quantity: 1 },
          { name: "Salt & Pepper Calamari", price: 20.0, quantity: 1 },
          {
            name: "Warm Artichoke, Spinach & Cheese Dip",
            price: 17.0,
            quantity: 1,
          },
          { name: "Loaded Fries", price: 16.0, quantity: 1 },
          { name: "Uber Bavarian Pretzel", price: 17.0, quantity: 1 },
          { name: "ADD CHEESE", price: null, quantity: 1 }, // Index 13 - caused error
          { name: "Club Soda", price: 16.0, quantity: 4 },
          { name: "Bud Light Draft", price: 16.0, quantity: 2 },
          { name: "Fiddlehead IPA (Can)", price: 9.0, quantity: 1 },
        ],
      };

      // First, validate it passes schema validation
      const schemaResult = receiptSchema.safeParse(claudeResponse);
      expect(schemaResult.success).toBe(true);

      // Then, normalize it
      const { normalizedReceipt, filteredItems, allItemsFiltered } =
        normalizeReceipt(claudeResponse);

      // Should have filtered out the 2 "ADD CHEESE" items
      expect(filteredItems).toHaveLength(2);
      expect(filteredItems.every((i) => i.name === "ADD CHEESE")).toBe(true);

      // Should have 15 valid items (17 - 2)
      expect(normalizedReceipt.items).toHaveLength(15);

      // All remaining items should have numeric prices
      expect(normalizedReceipt.items.every((i) => typeof i.price === "number")).toBe(true);

      // Should not trigger the "all items filtered" error
      expect(allItemsFiltered).toBe(false);

      // Verify the normalized receipt has proper structure
      expect(normalizedReceipt.restaurant).toBe("Stout Grand Central");
      expect(normalizedReceipt.subtotal).toBe(277.0);
      expect(normalizedReceipt.tax).toBe(24.61);
      expect(normalizedReceipt.tip).toBe(55.4);
      expect(normalizedReceipt.total).toBe(357.01);
    });
  });
});

describe("JSON code fence stripping (mirrors route.ts fallback logic)", () => {
  // This must match the stripping logic applied before JSON.parse in route.ts
  function stripCodeFences(text: string): string {
    return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  }

  it("strips ```json code fences from response", () => {
    const wrapped = '```json\n{"restaurant": "MONTESACRO", "items": []}\n```';
    const result = stripCodeFences(wrapped);
    expect(JSON.parse(result)).toEqual({ restaurant: "MONTESACRO", items: [] });
  });

  it("strips ``` code fences without json tag", () => {
    const wrapped = '```\n{"restaurant": "Test", "items": []}\n```';
    const result = stripCodeFences(wrapped);
    expect(JSON.parse(result)).toEqual({ restaurant: "Test", items: [] });
  });

  it("leaves plain JSON unchanged", () => {
    const plain = '{"restaurant": "Test", "items": []}';
    const result = stripCodeFences(plain);
    expect(JSON.parse(result)).toEqual({ restaurant: "Test", items: [] });
  });

  it("handles code fences with trailing whitespace", () => {
    const wrapped = '```json\n{"restaurant": "Test", "items": []}\n```  ';
    const result = stripCodeFences(wrapped);
    expect(JSON.parse(result)).toEqual({ restaurant: "Test", items: [] });
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
    const result = stripCodeFences(response);
    const parsed = JSON.parse(result);

    expect(parsed.restaurant).toBe("MONTESACRO");
    expect(parsed.items).toHaveLength(7);
    expect(parsed.total).toBe(259.04);

    // Also validate against receipt schema
    const schemaResult = receiptSchema.safeParse(parsed);
    expect(schemaResult.success).toBe(true);
  });
});

describe("fixMultiQuantityPrices", () => {
  describe("core bug fix: line total returned instead of per-unit price", () => {
    it("fixes the reported bug: 7 Guinness Dft parsed as $637 instead of $91", () => {
      // Simulates the LLM returning price=91 (line total) for qty=7 item
      // Frontend would compute 91 * 7 = $637 — this should be caught and fixed
      const items = [
        { name: "Guinness Dft", price: 91.0, quantity: 7 }, // line total, not per-unit
        { name: "Burger", price: 15.0, quantity: 1 },
      ];
      // Subtotal reflects correct math: 13*7 + 15 = 106
      const subtotal = 106.0;

      const { items: fixed, corrected } = fixMultiQuantityPrices(items, subtotal);

      expect(corrected).toBe(true);
      expect(fixed[0].price).toBeCloseTo(13.0, 2); // 91 / 7 = 13
      expect(fixed[0].quantity).toBe(7);
      expect(fixed[1].price).toBe(15.0); // qty=1 items unchanged
    });

    it("fixes multiple multi-quantity items all returning line totals", () => {
      // 2 Club Soda total $16 (should be $8 each), 3 Beer total $36 (should be $12 each)
      const items = [
        { name: "Club Soda", price: 16.0, quantity: 2 },
        { name: "Beer", price: 36.0, quantity: 3 },
        { name: "Fries", price: 10.0, quantity: 1 },
      ];
      // Correct subtotal: 8*2 + 12*3 + 10 = 16 + 36 + 10 = 62
      const subtotal = 62.0;

      const { items: fixed, corrected } = fixMultiQuantityPrices(items, subtotal);

      expect(corrected).toBe(true);
      expect(fixed[0].price).toBeCloseTo(8.0, 2);
      expect(fixed[1].price).toBeCloseTo(12.0, 2);
      expect(fixed[2].price).toBe(10.0); // single-qty item unchanged
    });
  });

  describe("does not modify already-correct prices", () => {
    it("leaves items unchanged when items total matches subtotal", () => {
      const items = [
        { name: "Guinness Dft", price: 13.0, quantity: 7 }, // already per-unit
        { name: "Burger", price: 15.0, quantity: 1 },
      ];
      const subtotal = 106.0; // 13*7 + 15 = 91 + 15 = 106

      const { items: result, corrected } = fixMultiQuantityPrices(items, subtotal);

      expect(corrected).toBe(false);
      expect(result[0].price).toBe(13.0);
      expect(result[1].price).toBe(15.0);
    });

    it("leaves items unchanged within 10% tolerance (minor rounding/discounts)", () => {
      const items = [
        { name: "Item A", price: 10.0, quantity: 2 }, // 20 total
        { name: "Item B", price: 5.0, quantity: 1 },
      ];
      // Subtotal is 5% less than items total (e.g. a small discount was applied)
      const subtotal = 23.75; // within 10% of 25

      const { corrected } = fixMultiQuantityPrices(items, subtotal);

      expect(corrected).toBe(false);
    });

    it("leaves items with only single-quantity items unchanged", () => {
      const items = [
        { name: "Burger", price: 15.0, quantity: 1 },
        { name: "Fries", price: 5.0, quantity: 1 },
      ];
      const subtotal = 18.0; // mismatch but no multi-qty items to fix

      const { corrected } = fixMultiQuantityPrices(items, subtotal);

      expect(corrected).toBe(false);
    });

    it("returns corrected=false when correction does not improve the match", () => {
      // Items where dividing by qty actually makes things worse
      const items = [
        { name: "Bundle Deal", price: 50.0, quantity: 2 }, // $50 each, not $25 each
        { name: "Drink", price: 5.0, quantity: 1 },
      ];
      // Subtotal = 105 (50*2 + 5), correction would give 25*2 + 5 = 55 — further from 105
      const subtotal = 105.0;

      const { corrected } = fixMultiQuantityPrices(items, subtotal);

      expect(corrected).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns unchanged when subtotal is 0", () => {
      const items = [{ name: "Item", price: 100.0, quantity: 3 }];
      const { corrected } = fixMultiQuantityPrices(items, 0);
      expect(corrected).toBe(false);
    });

    it("returns unchanged for empty items array", () => {
      const { corrected } = fixMultiQuantityPrices([], 50.0);
      expect(corrected).toBe(false);
    });

    it("handles items where quantity defaults to 1 (falsy qty guard)", () => {
      // quantity=1 items should never be divided
      const items = [
        { name: "Single Item", price: 20.0, quantity: 1 },
        { name: "Multi Item", price: 30.0, quantity: 3 }, // line total
      ];
      // Correct subtotal: 20 + 10*3 = 50
      const subtotal = 50.0;

      const { items: fixed, corrected } = fixMultiQuantityPrices(items, subtotal);

      expect(corrected).toBe(true);
      expect(fixed[0].price).toBe(20.0); // unchanged
      expect(fixed[1].price).toBeCloseTo(10.0, 2); // 30/3
    });
  });
});
