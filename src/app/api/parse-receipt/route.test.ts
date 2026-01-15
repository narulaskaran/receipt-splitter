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
