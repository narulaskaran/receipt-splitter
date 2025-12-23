import {
  calculatePersonTotals,
  validateItemAssignments,
  formatCurrency,
  getUnassignedItems,
} from "./receipt-utils";
import { mockPeople, mockReceipt, mockAssignedItems } from "@/test/test-utils";
import { type PersonItemAssignment } from "@/types";
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
