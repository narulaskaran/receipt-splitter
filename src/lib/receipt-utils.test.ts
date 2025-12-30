import {
  calculatePersonTotals,
  validateItemAssignments,
  formatCurrency,
  getUnassignedItems,
  validateReceiptInvariants,
  ReceiptValidationErrorType,
} from "./receipt-utils";
import { mockPeople, mockReceipt, mockAssignedItems } from "@/test/test-utils";
import { type PersonItemAssignment, type Receipt, type Person } from "@/types";
import { formatAmount } from "./utils";

describe("receipt-utils", () => {
  it("calculatePersonTotals splits tax and tip proportionally", () => {
    const result = calculatePersonTotals(
      mockReceipt,
      mockPeople,
      mockAssignedItems
    );
    expect(result[0].finalTotal).toBeGreaterThan(50); // Alice gets Burger + share of tax/tip
    expect(result[1].finalTotal).toBeGreaterThan(50); // Bob gets Fries + share of tax/tip
  });

  it("validateItemAssignments returns true for fully assigned items", () => {
    expect(validateItemAssignments(mockReceipt, mockAssignedItems)).toBe(true);
  });

  it("validateItemAssignments returns false for incomplete assignments", () => {
    const incomplete = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 50 }]],
    ]);
    expect(validateItemAssignments(mockReceipt, incomplete)).toBe(false);
  });

  it("formatCurrency formats USD", () => {
    expect(formatCurrency(12.5)).toMatch(/\$12\.50/);
  });

  it("getUnassignedItems returns indices of unassigned items", () => {
    const incomplete = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 50 }]],
    ]);
    expect(getUnassignedItems(mockReceipt, incomplete)).toContain(0);
  });
});

describe("minor-unit formatting (pre-implementation tests)", () => {
  it("formats 303 cents as $3.03", () => {
    // formatAmount takes minor units (cents)
    expect(formatAmount(303)).toBe("$3.03");
  });
});

describe("$0 item handling", () => {
  it("handles a single $0 item assigned to one person", () => {
    const receiptWithZeroItem = {
      ...mockReceipt,
      subtotal: 0,
      tax: 0,
      tip: 0,
      total: 0,
      items: [{ name: "Free Sample", price: 0, quantity: 1 }],
    };
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 100 }]],
    ]);

    const result = calculatePersonTotals(receiptWithZeroItem, mockPeople, assignments);

    expect(result[0].totalBeforeTax).toBe(0);
    expect(result[0].tax).toBe(0);
    expect(result[0].tip).toBe(0);
    expect(result[0].finalTotal).toBe(0);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].amount).toBe(0);
  });

  it("handles a $0 item split between multiple people", () => {
    const receiptWithZeroItem = {
      ...mockReceipt,
      subtotal: 0,
      tax: 0,
      tip: 0,
      total: 0,
      items: [{ name: "Free Sample", price: 0, quantity: 1 }],
    };
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [
        { personId: "a", sharePercentage: 50 },
        { personId: "b", sharePercentage: 50 },
      ]],
    ]);

    const result = calculatePersonTotals(receiptWithZeroItem, mockPeople, assignments);

    // Both people should have $0
    expect(result[0].totalBeforeTax).toBe(0);
    expect(result[0].finalTotal).toBe(0);
    expect(result[0].items[0].amount).toBe(0);
    expect(result[1].totalBeforeTax).toBe(0);
    expect(result[1].finalTotal).toBe(0);
    expect(result[1].items[0].amount).toBe(0);
  });

  it("handles mixed $0 and regular items", () => {
    const receiptWithMixedItems = {
      ...mockReceipt,
      subtotal: 50,
      tax: 5,
      tip: 7.5,
      total: 62.5,
      items: [
        { name: "Burger", price: 50, quantity: 1 },
        { name: "Free Water", price: 0, quantity: 1 },
      ],
    };
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 100 }]],
      [1, [{ personId: "b", sharePercentage: 100 }]],
    ]);

    const result = calculatePersonTotals(receiptWithMixedItems, mockPeople, assignments);

    // Alice should have the burger ($50 + tax + tip)
    expect(result[0].totalBeforeTax).toBe(50);
    expect(result[0].tax).toBe(5);
    expect(result[0].tip).toBe(7.5);
    expect(result[0].finalTotal).toBe(62.5);

    // Bob should have the free water ($0, no tax/tip)
    expect(result[1].totalBeforeTax).toBe(0);
    expect(result[1].tax).toBe(0);
    expect(result[1].tip).toBe(0);
    expect(result[1].finalTotal).toBe(0);
    expect(result[1].items[0].amount).toBe(0);
  });

  it("handles all items being $0", () => {
    const receiptAllZero = {
      ...mockReceipt,
      subtotal: 0,
      tax: 0,
      tip: 0,
      total: 0,
      items: [
        { name: "Free Sample 1", price: 0, quantity: 1 },
        { name: "Free Sample 2", price: 0, quantity: 2 },
      ],
    };
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 100 }]],
      [1, [{ personId: "b", sharePercentage: 100 }]],
    ]);

    const result = calculatePersonTotals(receiptAllZero, mockPeople, assignments);

    // Both people should have $0 totals
    expect(result[0].finalTotal).toBe(0);
    expect(result[1].finalTotal).toBe(0);
    expect(result[0].items[0].amount).toBe(0);
    expect(result[1].items[0].amount).toBe(0);
  });

  it("handles $0 item with quantity > 1", () => {
    const receiptWithZeroItemMultiQty = {
      ...mockReceipt,
      subtotal: 0,
      tax: 0,
      tip: 0,
      total: 0,
      items: [{ name: "Free Mints", price: 0, quantity: 5 }],
    };
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [
        { personId: "a", sharePercentage: 60 },
        { personId: "b", sharePercentage: 40 },
      ]],
    ]);

    const result = calculatePersonTotals(receiptWithZeroItemMultiQty, mockPeople, assignments);

    // Even with different share percentages, $0 * anything = $0
    expect(result[0].totalBeforeTax).toBe(0);
    expect(result[0].finalTotal).toBe(0);
    expect(result[1].totalBeforeTax).toBe(0);
    expect(result[1].finalTotal).toBe(0);
  });

  it("validates $0 items can still be assigned correctly", () => {
    const receiptWithZeroItem = {
      ...mockReceipt,
      items: [{ name: "Free Item", price: 0, quantity: 1 }],
    };
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 100 }]],
    ]);

    expect(validateItemAssignments(receiptWithZeroItem, assignments)).toBe(true);
  });

  it("validates $0 items require 100% assignment like regular items", () => {
    const receiptWithZeroItem = {
      ...mockReceipt,
      items: [{ name: "Free Item", price: 0, quantity: 1 }],
    };
    const incompleteAssignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 50 }]], // Only 50%, should fail
    ]);

    expect(validateItemAssignments(receiptWithZeroItem, incompleteAssignments)).toBe(false);
  });
});

describe("validateReceiptInvariants", () => {
  describe("valid receipts", () => {
    it("returns valid for null receipt", () => {
      const result = validateReceiptInvariants(null, new Map(), []);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for properly structured receipt with valid splits", () => {
      const people = calculatePersonTotals(mockReceipt, mockPeople, mockAssignedItems);
      const result = validateReceiptInvariants(mockReceipt, mockAssignedItems, people);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for receipt with items that sum to subtotal within tolerance", () => {
      const receipt: Receipt = {
        restaurant: "Test Restaurant",
        date: "2024-01-01",
        subtotal: 10.00,
        tax: 1.00,
        tip: 2.00,
        total: 13.00,
        items: [
          { name: "Item 1", price: 3.33, quantity: 1 },
          { name: "Item 2", price: 3.33, quantity: 1 },
          { name: "Item 3", price: 3.34, quantity: 1 },
        ],
      };
      const assignments = new Map<number, PersonItemAssignment[]>([
        [0, [{ personId: "a", sharePercentage: 100 }]],
        [1, [{ personId: "b", sharePercentage: 100 }]],
        [2, [{ personId: "a", sharePercentage: 100 }]],
      ]);
      const people = calculatePersonTotals(receipt, mockPeople, assignments);
      const result = validateReceiptInvariants(receipt, assignments, people);
      expect(result.isValid).toBe(true);
    });

    it("returns valid for items with splits that sum to item price within tolerance", () => {
      const receipt: Receipt = {
        restaurant: "Test Restaurant",
        date: "2024-01-01",
        subtotal: 10.00,
        tax: 1.00,
        tip: 2.00,
        total: 13.00,
        items: [
          { name: "Shared Item", price: 10.00, quantity: 1 },
        ],
      };
      const assignments = new Map<number, PersonItemAssignment[]>([
        [0, [
          { personId: "a", sharePercentage: 33.33 },
          { personId: "b", sharePercentage: 33.33 },
          { personId: "c", sharePercentage: 33.34 },
        ]],
      ]);
      const people = calculatePersonTotals(receipt, mockPeople, assignments);
      const result = validateReceiptInvariants(receipt, assignments, people);
      expect(result.isValid).toBe(true);
    });
  });

  describe("negative amounts in receipt", () => {
    it("detects negative subtotal", () => {
      const receipt: Receipt = {
        ...mockReceipt,
        subtotal: -10,
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_SUBTOTAL,
          message: 'Receipt subtotal cannot be negative',
        })
      );
    });

    it("detects negative tax", () => {
      const receipt: Receipt = {
        ...mockReceipt,
        tax: -5,
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_TAX,
          message: 'Receipt tax cannot be negative',
        })
      );
    });

    it("detects negative tip", () => {
      const receipt: Receipt = {
        ...mockReceipt,
        tip: -2,
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_TIP,
          message: 'Receipt tip cannot be negative',
        })
      );
    });

    it("detects negative total", () => {
      const receipt: Receipt = {
        ...mockReceipt,
        total: -100,
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_TOTAL,
          message: 'Receipt total cannot be negative',
        })
      );
    });
  });

  describe("negative amounts in items", () => {
    it("detects negative item price", () => {
      const receipt: Receipt = {
        ...mockReceipt,
        items: [{ name: "Bad Item", price: -10, quantity: 1 }],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_ITEM_PRICE,
          message: 'Item "Bad Item" has negative price',
          itemName: 'Bad Item',
        })
      );
    });

    it("detects negative item quantity", () => {
      const receipt: Receipt = {
        ...mockReceipt,
        items: [{ name: "Bad Quantity", price: 10, quantity: -2 }],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_ITEM_QUANTITY,
          message: 'Item "Bad Quantity" has negative quantity',
          itemName: 'Bad Quantity',
        })
      );
    });
  });

  describe("items sum validation", () => {
    it("detects when items do not sum to subtotal", () => {
      const receipt: Receipt = {
        restaurant: "Test Restaurant",
        date: "2024-01-01",
        subtotal: 100.00, // Items sum to 50, but subtotal says 100
        tax: 10.00,
        tip: 15.00,
        total: 125.00,
        items: [
          { name: "Item 1", price: 25, quantity: 1 },
          { name: "Item 2", price: 25, quantity: 1 },
        ],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.ITEMS_SUBTOTAL_MISMATCH,
          message: 'Sum of item prices does not match subtotal',
          expected: 100.00,
          actual: 50.00,
        })
      );
    });

    it("allows small rounding differences within tolerance", () => {
      const receipt: Receipt = {
        restaurant: "Test Restaurant",
        date: "2024-01-01",
        subtotal: 10.00,
        tax: 1.00,
        tip: 2.00,
        total: 13.00,
        items: [
          { name: "Item 1", price: 3.33, quantity: 1 },
          { name: "Item 2", price: 3.34, quantity: 1 },
          { name: "Item 3", price: 3.33, quantity: 1 },
        ],
      };
      // Items sum to 10.00, subtotal is 10.00 - should be valid
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(true);
    });
  });

  describe("item splits validation", () => {
    it("detects when splits do not sum to item price", () => {
      const receipt: Receipt = {
        restaurant: "Test Restaurant",
        date: "2024-01-01",
        subtotal: 100.00,
        tax: 10.00,
        tip: 15.00,
        total: 125.00,
        items: [
          { name: "Shared Item", price: 100, quantity: 1 },
        ],
      };
      // Assignments only add up to 90%, not 100%
      const assignments = new Map<number, PersonItemAssignment[]>([
        [0, [
          { personId: "a", sharePercentage: 45 },
          { personId: "b", sharePercentage: 45 },
        ]],
      ]);
      const people = calculatePersonTotals(receipt, mockPeople, assignments);
      const result = validateReceiptInvariants(receipt, assignments, people);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.ITEM_SPLITS_MISMATCH,
          message: 'Sum of splits for item "Shared Item" does not match item price',
          itemName: 'Shared Item',
        })
      );
    });

    it("allows small rounding differences in splits within tolerance", () => {
      const receipt: Receipt = {
        restaurant: "Test Restaurant",
        date: "2024-01-01",
        subtotal: 10.00,
        tax: 1.00,
        tip: 2.00,
        total: 13.00,
        items: [
          { name: "Shared Item", price: 10.00, quantity: 1 },
        ],
      };
      // 33.33 + 33.33 + 33.34 = 100%, should be within tolerance
      const assignments = new Map<number, PersonItemAssignment[]>([
        [0, [
          { personId: "a", sharePercentage: 33.33 },
          { personId: "b", sharePercentage: 33.33 },
          { personId: "c", sharePercentage: 33.34 },
        ]],
      ]);
      const people = calculatePersonTotals(receipt, mockPeople, assignments);
      const result = validateReceiptInvariants(receipt, assignments, people);
      expect(result.isValid).toBe(true);
    });

    it("skips validation for unassigned items", () => {
      const receipt: Receipt = {
        restaurant: "Test Restaurant",
        date: "2024-01-01",
        subtotal: 100.00,
        tax: 10.00,
        tip: 15.00,
        total: 125.00,
        items: [
          { name: "Unassigned Item", price: 100, quantity: 1 },
        ],
      };
      const assignments = new Map<number, PersonItemAssignment[]>();
      const result = validateReceiptInvariants(receipt, assignments, []);
      // Should not fail on splits mismatch for unassigned items
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.ITEM_SPLITS_MISMATCH,
        })
      );
    });
  });

  describe("negative amounts in person data", () => {
    it("detects negative person totalBeforeTax", () => {
      const person: Person = {
        id: "test",
        name: "Test Person",
        items: [],
        totalBeforeTax: -10,
        tax: 0,
        tip: 0,
        finalTotal: 0,
      };
      const result = validateReceiptInvariants(mockReceipt, new Map(), [person]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_PERSON_TOTAL,
          message: 'Person "Test Person" has negative total before tax',
        })
      );
    });

    it("detects negative person tax", () => {
      const person: Person = {
        id: "test",
        name: "Test Person",
        items: [],
        totalBeforeTax: 10,
        tax: -1,
        tip: 0,
        finalTotal: 9,
      };
      const result = validateReceiptInvariants(mockReceipt, new Map(), [person]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_PERSON_TAX,
          message: 'Person "Test Person" has negative tax',
        })
      );
    });

    it("detects negative person tip", () => {
      const person: Person = {
        id: "test",
        name: "Test Person",
        items: [],
        totalBeforeTax: 10,
        tax: 1,
        tip: -2,
        finalTotal: 9,
      };
      const result = validateReceiptInvariants(mockReceipt, new Map(), [person]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_PERSON_TIP,
          message: 'Person "Test Person" has negative tip',
        })
      );
    });

    it("detects negative person finalTotal", () => {
      const person: Person = {
        id: "test",
        name: "Test Person",
        items: [],
        totalBeforeTax: 0,
        tax: 0,
        tip: 0,
        finalTotal: -10,
      };
      const result = validateReceiptInvariants(mockReceipt, new Map(), [person]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_PERSON_FINAL_TOTAL,
          message: 'Person "Test Person" has negative final total',
        })
      );
    });

    it("detects negative person item amount", () => {
      const person: Person = {
        id: "test",
        name: "Test Person",
        items: [
          {
            itemId: 0,
            itemName: "Bad Item",
            originalPrice: 10,
            quantity: 1,
            sharePercentage: 100,
            amount: -10,
          },
        ],
        totalBeforeTax: 0,
        tax: 0,
        tip: 0,
        finalTotal: 0,
      };
      const result = validateReceiptInvariants(mockReceipt, new Map(), [person]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.NEGATIVE_PERSON_ITEM_AMOUNT,
          message: 'Person "Test Person" has negative amount for item "Bad Item"',
          itemName: 'Bad Item',
        })
      );
    });
  });

  describe("multiple errors", () => {
    it("reports all validation errors found", () => {
      const receipt: Receipt = {
        restaurant: "Test Restaurant",
        date: "2024-01-01",
        subtotal: -10, // Negative
        tax: -1, // Negative
        tip: -2, // Negative
        total: -13, // Negative
        items: [
          { name: "Bad Item", price: -5, quantity: -1 }, // Both negative
        ],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(6);
      expect(result.errors).toContainEqual(expect.objectContaining({ type: ReceiptValidationErrorType.NEGATIVE_SUBTOTAL }));
      expect(result.errors).toContainEqual(expect.objectContaining({ type: ReceiptValidationErrorType.NEGATIVE_TAX }));
      expect(result.errors).toContainEqual(expect.objectContaining({ type: ReceiptValidationErrorType.NEGATIVE_TIP }));
      expect(result.errors).toContainEqual(expect.objectContaining({ type: ReceiptValidationErrorType.NEGATIVE_TOTAL }));
      expect(result.errors).toContainEqual(expect.objectContaining({ type: ReceiptValidationErrorType.NEGATIVE_ITEM_PRICE }));
      expect(result.errors).toContainEqual(expect.objectContaining({ type: ReceiptValidationErrorType.NEGATIVE_ITEM_QUANTITY }));
    });
  });

  describe("receipt total validation", () => {
    it("detects when total does not equal subtotal + tax + tip", () => {
      const receipt: Receipt = {
        restaurant: "Test",
        date: "2024-01-01",
        subtotal: 100,
        tax: 10,
        tip: 15,
        total: 200,  // Should be 125
        items: [],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: ReceiptValidationErrorType.RECEIPT_TOTAL_MISMATCH,
          expected: 125,
          actual: 200,
        })
      );
    });

    it("allows total that equals subtotal + tax + tip", () => {
      const receipt: Receipt = {
        restaurant: "Test",
        date: "2024-01-01",
        subtotal: 100,
        tax: 10,
        tip: 15,
        total: 125,  // Correct
        items: [],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(true);
    });

    it("allows small rounding differences in total within tolerance", () => {
      const receipt: Receipt = {
        restaurant: "Test",
        date: "2024-01-01",
        subtotal: 10.00,
        tax: 1.50,
        tip: 2.25,
        total: 13.75,  // Correct sum
        items: [],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(true);
    });
  });
});
