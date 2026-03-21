import { z } from "zod";
import { correctMultiQuantityPrices } from "@/lib/receipt-utils";

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

describe("correctMultiQuantityPrices", () => {
  it("corrects multi-quantity items when sum exceeds subtotal (issue #106)", () => {
    // "7 Guinness Dft $91.00" - model outputs price=91 qty=7 (sum=637)
    // but receipt means price=13 qty=7 (sum=91)
    const items = [
      { name: "7 Guinness Dft", price: 91, quantity: 7 },
      { name: "Burger", price: 15, quantity: 1 },
    ];
    const subtotal = 106; // 91 + 15

    const result = correctMultiQuantityPrices(items, subtotal);

    expect(result[0].price).toBe(13); // 91 / 7
    expect(result[0].quantity).toBe(7);
    expect(result[1].price).toBe(15); // unchanged
    expect(result[1].quantity).toBe(1);
  });

  it("does not correct when items sum already matches subtotal", () => {
    const items = [
      { name: "Beer", price: 13, quantity: 7 },
      { name: "Burger", price: 15, quantity: 1 },
    ];
    const subtotal = 106; // 91 + 15

    const result = correctMultiQuantityPrices(items, subtotal);

    expect(result[0].price).toBe(13);
    expect(result[1].price).toBe(15);
  });

  it("does not correct single-quantity items", () => {
    const items = [
      { name: "Expensive Wine", price: 200, quantity: 1 },
      { name: "Salad", price: 12, quantity: 1 },
    ];
    const subtotal = 100; // mismatch, but all qty=1 so can't correct

    const result = correctMultiQuantityPrices(items, subtotal);

    expect(result[0].price).toBe(200);
    expect(result[1].price).toBe(12);
  });

  it("handles multiple multi-quantity items", () => {
    const items = [
      { name: "Beer", price: 91, quantity: 7 },   // line total 91, per-unit 13
      { name: "Wings", price: 30, quantity: 3 },   // line total 30, per-unit 10
      { name: "Fries", price: 8, quantity: 1 },
    ];
    const subtotal = 129; // 91 + 30 + 8

    const result = correctMultiQuantityPrices(items, subtotal);

    expect(result[0].price).toBe(13);   // 91 / 7
    expect(result[1].price).toBe(10);   // 30 / 3
    expect(result[2].price).toBe(8);    // unchanged
  });

  it("returns original items when subtotal is 0", () => {
    const items = [{ name: "Beer", price: 91, quantity: 7 }];
    const result = correctMultiQuantityPrices(items, 0);

    expect(result[0].price).toBe(91);
  });

  it("returns empty array for empty items", () => {
    const result = correctMultiQuantityPrices([], 100);
    expect(result).toEqual([]);
  });

  it("does not correct if correction makes the sum worse", () => {
    // Items: price=20 qty=2 → sum=40. If corrected: price=10 qty=2 → sum=20
    // Subtotal=35. Original overshoot=5, corrected diff=15. Keep original.
    const items = [
      { name: "Item A", price: 20, quantity: 2 },
    ];
    const subtotal = 35;

    const result = correctMultiQuantityPrices(items, subtotal);

    expect(result[0].price).toBe(20);
  });

  it("tolerates small differences within 5%", () => {
    // Items sum slightly exceeds subtotal but within 5%
    const items = [
      { name: "Beer", price: 13.5, quantity: 7 },
    ];
    const subtotal = 91; // items sum = 94.5, diff = 3.5, 5% of 91 = 4.55

    const result = correctMultiQuantityPrices(items, subtotal);

    expect(result[0].price).toBe(13.5); // within tolerance, not corrected
  });

  it("handles decimal prices correctly", () => {
    const items = [
      { name: "Cocktail", price: 45.5, quantity: 2 },
      { name: "Appetizer", price: 14, quantity: 1 },
    ];
    const subtotal = 59.5; // 45.5 + 14

    const result = correctMultiQuantityPrices(items, subtotal);

    expect(result[0].price).toBe(22.75); // 45.5 / 2
    expect(result[0].quantity).toBe(2);
    expect(result[1].price).toBe(14);
  });

  it("handles realistic receipt from issue #106 scenario", () => {
    // Simulating a Toast receipt where model misreads prices
    const items = [
      { name: "Guinness Dft", price: 91, quantity: 7 },   // should be 13 each
      { name: "Club Soda", price: 16, quantity: 4 },       // should be 4 each
      { name: "Wings", price: 29, quantity: 1 },
      { name: "Loaded Fries", price: 16, quantity: 1 },
    ];
    // Correct subtotal: 91 + 16 + 29 + 16 = 152
    const subtotal = 152;

    const result = correctMultiQuantityPrices(items, subtotal);

    expect(result[0].price).toBe(13);   // 91 / 7
    expect(result[1].price).toBe(4);    // 16 / 4
    expect(result[2].price).toBe(29);   // unchanged
    expect(result[3].price).toBe(16);   // unchanged
  });
});
