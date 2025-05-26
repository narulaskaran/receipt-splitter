import {
  calculatePersonTotals,
  validateItemAssignments,
  formatCurrency,
  getUnassignedItems,
} from "./receipt-utils";
import { mockPeople, mockReceipt, mockAssignedItems } from "@/test/test-utils";
import { type PersonItemAssignment } from "@/types";

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
