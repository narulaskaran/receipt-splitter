import {
  calculatePersonTotals,
  validateItemAssignments,
  formatCurrency,
  getUnassignedItems,
  validateReceiptInvariants,
  AmountValidationError,
  calculateSubtotal,
  remapAssignmentsAfterDelete,
  distributeEqualShares,
  sessionCurrency,
  validateReceiptCurrency,
  calculateSessionPersonTotals,
  calculatePerReceiptPersonTotals,
  sessionShareNote,
  sessionShareDate,
  validateSessionAssignments,
  getSessionUnassigned,
  validateSessionInvariants,
} from "./receipt-utils";
import { mockPeople, mockReceipt, mockAssignedItems } from "@/test/test-utils";
import { type PersonItemAssignment, type Receipt, type Person, type StoredReceipt, type ItemAssignments } from "@/types";
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

  it("validateItemAssignments is true for a receipt with no items", () => {
    expect(
      validateItemAssignments({ ...mockReceipt, items: [] }, new Map())
    ).toBe(true);
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

  it("distributes equal shares with the remainder on the last person", () => {
    expect(distributeEqualShares(["a", "b", "c"])).toEqual([
      { personId: "a", sharePercentage: 33.33 },
      { personId: "b", sharePercentage: 33.33 },
      { personId: "c", sharePercentage: 33.34 },
    ]);
    expect(distributeEqualShares(["a", "b", "c", "d", "e", "f", "g"]))
      .toEqual([
        { personId: "a", sharePercentage: 14.29 },
        { personId: "b", sharePercentage: 14.29 },
        { personId: "c", sharePercentage: 14.29 },
        { personId: "d", sharePercentage: 14.29 },
        { personId: "e", sharePercentage: 14.29 },
        { personId: "f", sharePercentage: 14.29 },
        { personId: "g", sharePercentage: 14.26 },
      ]);
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

describe("calculateSubtotal", () => {
  it("calculates subtotal for single item", () => {
    const items = [{ name: "Burger", price: 10.50, quantity: 1 }];
    expect(calculateSubtotal(items)).toBe(10.50);
  });

  it("calculates subtotal for multiple items with quantities", () => {
    const items = [
      { name: "Burger", price: 10.50, quantity: 2 },
      { name: "Fries", price: 3.25, quantity: 1 }
    ];
    expect(calculateSubtotal(items)).toBe(24.25);
  });

  it("handles floating point precision correctly", () => {
    const items = [
      { name: "Item1", price: 0.1, quantity: 1 },
      { name: "Item2", price: 0.2, quantity: 1 }
    ];
    expect(calculateSubtotal(items)).toBe(0.3); // Not 0.30000000000000004
  });

  it("handles zero-priced items", () => {
    const items = [
      { name: "Free Item", price: 0, quantity: 5 },
      { name: "Paid Item", price: 10, quantity: 1 }
    ];
    expect(calculateSubtotal(items)).toBe(10);
  });

  it("handles high-precision decimals correctly", () => {
    const items = [{ name: "Item", price: 10.999, quantity: 1 }];
    expect(calculateSubtotal(items)).toBe(10.999);
  });

  it("handles empty items array", () => {
    expect(calculateSubtotal([])).toBe(0);
  });

  it("handles quantity defaulting to 1 when undefined", () => {
    const items = [{ name: "Item", price: 5, quantity: 0 }];
    // quantity || 1 should make it 1
    expect(calculateSubtotal(items)).toBe(5);
  });
});

describe("remapAssignmentsAfterDelete", () => {
  it("removes assignment for deleted item", () => {
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 100 }]],
      [1, [{ personId: "b", sharePercentage: 100 }]],
    ]);

    const result = remapAssignmentsAfterDelete(assignments, 1);

    expect(result.size).toBe(1);
    expect(result.get(0)).toEqual([{ personId: "a", sharePercentage: 100 }]);
    expect(result.has(1)).toBe(false);
  });

  it("shifts down assignments after deleted index", () => {
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 100 }]],
      [1, [{ personId: "b", sharePercentage: 100 }]],
      [2, [{ personId: "c", sharePercentage: 100 }]],
    ]);

    const result = remapAssignmentsAfterDelete(assignments, 1);

    expect(result.size).toBe(2);
    expect(result.get(0)).toEqual([{ personId: "a", sharePercentage: 100 }]);
    expect(result.get(1)).toEqual([{ personId: "c", sharePercentage: 100 }]); // Was index 2
    expect(result.has(2)).toBe(false);
  });

  it("preserves assignments before deleted index", () => {
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 50 }]],
      [1, [{ personId: "b", sharePercentage: 100 }]],
      [2, [
        { personId: "a", sharePercentage: 50 },
        { personId: "b", sharePercentage: 50 }
      ]],
    ]);

    const result = remapAssignmentsAfterDelete(assignments, 2);

    expect(result.get(0)).toEqual([{ personId: "a", sharePercentage: 50 }]);
    expect(result.get(1)).toEqual([{ personId: "b", sharePercentage: 100 }]);
    expect(result.has(2)).toBe(false);
  });

  it("handles deleting first item", () => {
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 100 }]],
      [1, [{ personId: "b", sharePercentage: 100 }]],
    ]);

    const result = remapAssignmentsAfterDelete(assignments, 0);

    expect(result.size).toBe(1);
    expect(result.get(0)).toEqual([{ personId: "b", sharePercentage: 100 }]); // Was index 1
    expect(result.has(1)).toBe(false);
  });

  it("handles deleting last item", () => {
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 100 }]],
      [1, [{ personId: "b", sharePercentage: 100 }]],
    ]);

    const result = remapAssignmentsAfterDelete(assignments, 1);

    expect(result.size).toBe(1);
    expect(result.get(0)).toEqual([{ personId: "a", sharePercentage: 100 }]);
    expect(result.has(1)).toBe(false);
  });

  it("handles empty assignments map", () => {
    const assignments = new Map<number, PersonItemAssignment[]>();
    const result = remapAssignmentsAfterDelete(assignments, 0);
    expect(result.size).toBe(0);
  });

  it("handles deleting item with shared assignment", () => {
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [
        { personId: "a", sharePercentage: 50 },
        { personId: "b", sharePercentage: 50 }
      ]],
      [1, [{ personId: "c", sharePercentage: 100 }]],
    ]);

    const result = remapAssignmentsAfterDelete(assignments, 0);

    expect(result.size).toBe(1);
    expect(result.get(0)).toEqual([{ personId: "c", sharePercentage: 100 }]);
    expect(result.has(1)).toBe(false);
  });

  it("handles sparse assignment map (gaps in indices)", () => {
    const assignments = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 100 }]],
      [2, [{ personId: "b", sharePercentage: 100 }]],
      // No assignment for index 1
    ]);

    const result = remapAssignmentsAfterDelete(assignments, 0);

    expect(result.size).toBe(1);
    expect(result.get(1)).toEqual([{ personId: "b", sharePercentage: 100 }]); // Was index 2, shifted to 1
    expect(result.has(2)).toBe(false);
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
        currency: "USD",
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
        currency: "USD",
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

  describe("negative amounts", () => {
    it.each([
      // Receipt-level fields
      {
        label: "receipt subtotal",
        receipt: { ...mockReceipt, subtotal: -10 } as Receipt,
        people: [] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Receipt subtotal cannot be negative' },
      },
      {
        label: "receipt tax",
        receipt: { ...mockReceipt, tax: -5 } as Receipt,
        people: [] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Receipt tax cannot be negative' },
      },
      {
        label: "receipt tip",
        receipt: { ...mockReceipt, tip: -2 } as Receipt,
        people: [] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Receipt tip cannot be negative' },
      },
      {
        label: "receipt total",
        receipt: { ...mockReceipt, total: -100 } as Receipt,
        people: [] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Receipt total cannot be negative' },
      },
      // Item-level fields
      {
        label: "item price",
        receipt: { ...mockReceipt, items: [{ name: "Bad Item", price: -10, quantity: 1 }] } as Receipt,
        people: [] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Item "Bad Item" has negative price', itemName: 'Bad Item' },
      },
      {
        label: "item quantity",
        receipt: { ...mockReceipt, items: [{ name: "Bad Quantity", price: 10, quantity: -2 }] } as Receipt,
        people: [] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Item "Bad Quantity" has negative quantity', itemName: 'Bad Quantity' },
      },
      // Person-level fields
      {
        label: "person totalBeforeTax",
        receipt: mockReceipt,
        people: [{ id: "test", name: "Test Person", items: [], totalBeforeTax: -10, tax: 0, tip: 0, finalTotal: 0 }] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Person "Test Person" has negative total before tax' },
      },
      {
        label: "person tax",
        receipt: mockReceipt,
        people: [{ id: "test", name: "Test Person", items: [], totalBeforeTax: 10, tax: -1, tip: 0, finalTotal: 9 }] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Person "Test Person" has negative tax' },
      },
      {
        label: "person tip",
        receipt: mockReceipt,
        people: [{ id: "test", name: "Test Person", items: [], totalBeforeTax: 10, tax: 1, tip: -2, finalTotal: 9 }] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Person "Test Person" has negative tip' },
      },
      {
        label: "person finalTotal",
        receipt: mockReceipt,
        people: [{ id: "test", name: "Test Person", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: -10 }] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Person "Test Person" has negative final total' },
      },
      {
        label: "person item amount",
        receipt: mockReceipt,
        people: [{
          id: "test",
          name: "Test Person",
          items: [{ itemId: 0, itemName: "Bad Item", originalPrice: 10, quantity: 1, sharePercentage: 100, amount: -10 }],
          totalBeforeTax: 0,
          tax: 0,
          tip: 0,
          finalTotal: 0,
        }] as Person[],
        expectedError: { type: AmountValidationError.NEGATIVE_AMOUNT, message: 'Person "Test Person" has negative amount for item "Bad Item"', itemName: 'Bad Item' },
      },
    ])("detects negative $label", ({ receipt, people, expectedError }) => {
      const result = validateReceiptInvariants(receipt, new Map(), people);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining(expectedError));
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
        currency: "USD",
        items: [
          { name: "Item 1", price: 25, quantity: 1 },
          { name: "Item 2", price: 25, quantity: 1 },
        ],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: AmountValidationError.ITEMS_SUBTOTAL_MISMATCH,
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
        currency: "USD",
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
        currency: "USD",
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
          type: AmountValidationError.ITEM_SPLITS_MISMATCH,
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
        currency: "USD",
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
        currency: "USD",
        items: [
          { name: "Unassigned Item", price: 100, quantity: 1 },
        ],
      };
      const assignments = new Map<number, PersonItemAssignment[]>();
      const result = validateReceiptInvariants(receipt, assignments, []);
      // Should not fail on splits mismatch for unassigned items
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({
          type: AmountValidationError.ITEM_SPLITS_MISMATCH,
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
        currency: "USD",
        items: [
          { name: "Bad Item", price: -5, quantity: -1 }, // Both negative
        ],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(6);
      expect(result.errors).toContainEqual(expect.objectContaining({ type: AmountValidationError.NEGATIVE_AMOUNT }));
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
        currency: "USD",
        items: [],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: AmountValidationError.RECEIPT_TOTAL_MISMATCH,
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
        currency: "USD",
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
        currency: "USD",
        items: [],
      };
      const result = validateReceiptInvariants(receipt, new Map(), []);
      expect(result.isValid).toBe(true);
    });
  });
});

describe("calculatePersonTotals receipt metadata", () => {
  it("sets receiptName from the restaurant and omits receiptId without a 4th arg", () => {
    const result = calculatePersonTotals(mockReceipt, mockPeople, mockAssignedItems);
    expect(result[0].items[0].receiptName).toBe("Testaurant");
    expect(result[0].items[0].receiptId).toBeUndefined();
  });

  it("sets receiptId when the optional 4th argument is provided", () => {
    const result = calculatePersonTotals(
      mockReceipt,
      mockPeople,
      mockAssignedItems,
      "receipt-1"
    );
    expect(result[0].items[0].receiptId).toBe("receipt-1");
    expect(result[0].items[0].receiptName).toBe("Testaurant");
  });
});

describe("session-level receipt helpers", () => {
  const receiptA: Receipt = {
    restaurant: "Cafe A",
    date: "2024-01-01",
    subtotal: 50,
    tax: 5,
    tip: 5,
    total: 60,
    currency: "USD",
    items: [{ name: "Burger", price: 50, quantity: 1 }],
  };
  const receiptB: Receipt = {
    restaurant: "Cafe B",
    date: "2024-01-02",
    subtotal: 40,
    tax: 4,
    tip: 6,
    total: 50,
    currency: "USD",
    items: [{ name: "Fries", price: 40, quantity: 1 }],
  };
  const storedA: StoredReceipt = { id: "rec-a", receipt: receiptA };
  const storedB: StoredReceipt = { id: "rec-b", receipt: receiptB };
  const innerA: ItemAssignments = new Map([
    [0, [{ personId: "a", sharePercentage: 100 }]],
  ]);
  const innerB: ItemAssignments = new Map([
    [0, [{ personId: "a", sharePercentage: 100 }]],
  ]);
  const bothAssigned = new Map<string, ItemAssignments>([
    ["rec-a", innerA],
    ["rec-b", innerB],
  ]);

  it("sessionCurrency returns the first receipt's currency", () => {
    expect(sessionCurrency([storedA, storedB])).toBe("USD");
    expect(sessionCurrency([])).toBeUndefined();
  });

  it("validateReceiptCurrency rejects EUR vs USD and accepts a match", () => {
    const eurReceipt: Receipt = { ...receiptA, currency: "EUR" };
    expect(validateReceiptCurrency(eurReceipt, "USD")).toBe(false);
    expect(validateReceiptCurrency(receiptA, "USD")).toBe(true);
    expect(validateReceiptCurrency(receiptA, " usd ")).toBe(true);
    expect(validateReceiptCurrency(receiptA, "usd")).toBe(true);
    expect(validateReceiptCurrency(receiptA, undefined)).toBe(true);
  });

  it("calculateSessionPersonTotals sums Alice's per-receipt totals", () => {
    const perA = calculatePersonTotals(receiptA, mockPeople, innerA, "rec-a");
    const perB = calculatePersonTotals(receiptB, mockPeople, innerB, "rec-b");
    const session = calculateSessionPersonTotals(
      [storedA, storedB],
      mockPeople,
      bothAssigned
    );

    const alice = session[0];
    expect(alice.finalTotal).toBe(perA[0].finalTotal + perB[0].finalTotal);
    expect(alice.totalBeforeTax).toBe(perA[0].totalBeforeTax + perB[0].totalBeforeTax);
    expect(alice.tax).toBe(perA[0].tax + perB[0].tax);
    expect(alice.tip).toBe(perA[0].tip + perB[0].tip);
    expect(alice.items).toHaveLength(2);
    expect(alice.items.map((item) => item.receiptId)).toEqual(["rec-a", "rec-b"]);
    expect(alice.items.map((item) => item.receiptName)).toEqual(["Cafe A", "Cafe B"]);

    // Bob has no assignments across either receipt
    expect(session[1].finalTotal).toBe(0);
    expect(session[1].items).toHaveLength(0);
  });

  it("validateSessionAssignments is false when receipt B is incomplete", () => {
    const incompleteB = new Map<string, ItemAssignments>([
      ["rec-a", innerA],
      ["rec-b", new Map()],
    ]);
    expect(validateSessionAssignments([storedA, storedB], bothAssigned)).toBe(true);
    expect(validateSessionAssignments([storedA, storedB], incompleteB)).toBe(false);
    expect(validateSessionAssignments([], bothAssigned)).toBe(false);
  });

  it("getSessionUnassigned lists incomplete items with receipt ids", () => {
    const incompleteB = new Map<string, ItemAssignments>([
      ["rec-a", innerA],
      ["rec-b", new Map()],
    ]);
    expect(getSessionUnassigned([storedA, storedB], incompleteB)).toEqual([
      { receiptId: "rec-b", itemIndex: 0 },
    ]);
  });

  it("validateSessionAssignments treats a 0-item receipt as complete", () => {
    const emptyStored: StoredReceipt = {
      id: "empty",
      receipt: { ...receiptA, restaurant: "Empty Place", items: [] },
    };
    const assigned = new Map<string, ItemAssignments>([
      ["rec-a", innerA],
      ["empty", new Map()],
    ]);
    expect(validateSessionAssignments([storedA, emptyStored], assigned)).toBe(
      true
    );
  });

  it("calculatePerReceiptPersonTotals Alice totals sum to the session total", () => {
    const perReceipt = calculatePerReceiptPersonTotals(
      [storedA, storedB],
      mockPeople,
      bothAssigned
    );
    const session = calculateSessionPersonTotals(
      [storedA, storedB],
      mockPeople,
      bothAssigned
    );

    expect(perReceipt).toHaveLength(2);
    expect(perReceipt[0].stored).toBe(storedA);
    expect(perReceipt[1].stored).toBe(storedB);

    const aliceSum =
      perReceipt[0].people[0].finalTotal + perReceipt[1].people[0].finalTotal;
    expect(session[0].finalTotal).toBe(aliceSum);
    expect(aliceSum).toBeGreaterThan(0);
  });

  it("sessionShareNote uses defaults, joins names, and truncates to MAX_NOTE_LENGTH", () => {
    expect(sessionShareNote([])).toBe("Receipt Split");
    expect(sessionShareNote([storedA])).toBe("Cafe A");
    expect(
      sessionShareNote([{ id: "x", receipt: { ...receiptA, restaurant: null } }])
    ).toBe("Receipt Split");
    expect(sessionShareNote([storedA, storedB])).toBe("Cafe A, Cafe B");
    expect(
      sessionShareNote([
        { id: "x", receipt: { ...receiptA, restaurant: null } },
        storedB,
      ])
    ).toBe("Untitled, Cafe B");

    const longA = "A".repeat(60);
    const longB = "B".repeat(60);
    const truncated = sessionShareNote([
      { id: "a", receipt: { ...receiptA, restaurant: longA } },
      { id: "b", receipt: { ...receiptB, restaurant: longB } },
    ]);
    expect(truncated.length).toBe(100);
    expect(truncated.endsWith("...")).toBe(true);
    expect(truncated.startsWith("A")).toBe(true);
  });

  it("sessionShareDate keeps identical dates and returns null when dates disagree", () => {
    expect(sessionShareDate([])).toBeNull();
    expect(sessionShareDate([storedA])).toBe("2024-01-01");
    expect(
      sessionShareDate([
        storedA,
        { id: "rec-c", receipt: { ...receiptB, date: "2024-01-01" } },
      ])
    ).toBe("2024-01-01");
    expect(sessionShareDate([storedA, storedB])).toBeNull();
    expect(
      sessionShareDate([
        { id: "a", receipt: { ...receiptA, date: null } },
        { id: "b", receipt: { ...receiptB, date: null } },
      ])
    ).toBeNull();
  });

  it("validateSessionInvariants concatenates per-receipt errors and treats empty as valid", () => {
    expect(validateSessionInvariants([], new Map(), []).isValid).toBe(true);

    const badB: StoredReceipt = {
      id: "rec-b",
      receipt: { ...receiptB, subtotal: -40, total: 10 },
    };
    const result = validateSessionInvariants(
      [storedA, badB],
      bothAssigned,
      mockPeople
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.type === AmountValidationError.NEGATIVE_AMOUNT)).toBe(true);
  });
});
