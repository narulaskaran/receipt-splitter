import {
  calculatePersonTotals,
  validateItemAssignments,
  formatCurrency,
  getUnassignedItems,
} from "./receipt-utils";
import { type Receipt, type Person, type PersonItemAssignment } from "@/types";

describe("receipt-utils", () => {
  const receipt: Receipt = {
    restaurant: "Testaurant",
    date: "2024-01-01",
    subtotal: 100,
    tax: 10,
    tip: 15,
    total: 125,
    items: [
      { name: "Burger", price: 50, quantity: 1 },
      { name: "Fries", price: 25, quantity: 2 },
    ],
  };
  const people: Person[] = [
    {
      id: "a",
      name: "Alice",
      items: [],
      totalBeforeTax: 0,
      tax: 0,
      tip: 0,
      finalTotal: 0,
    },
    {
      id: "b",
      name: "Bob",
      items: [],
      totalBeforeTax: 0,
      tax: 0,
      tip: 0,
      finalTotal: 0,
    },
  ];
  const assignedItems = new Map<number, PersonItemAssignment[]>([
    [0, [{ personId: "a", sharePercentage: 100 }]],
    [1, [{ personId: "b", sharePercentage: 100 }]],
  ]);

  it("calculatePersonTotals splits tax and tip proportionally", () => {
    const result = calculatePersonTotals(receipt, people, assignedItems);
    expect(result[0].finalTotal).toBeGreaterThan(50); // Alice gets Burger + share of tax/tip
    expect(result[1].finalTotal).toBeGreaterThan(50); // Bob gets Fries + share of tax/tip
  });

  it("validateItemAssignments returns true for fully assigned items", () => {
    expect(validateItemAssignments(receipt, assignedItems)).toBe(true);
  });

  it("validateItemAssignments returns false for incomplete assignments", () => {
    const incomplete = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 50 }]],
    ]);
    expect(validateItemAssignments(receipt, incomplete)).toBe(false);
  });

  it("formatCurrency formats USD", () => {
    expect(formatCurrency(12.5)).toMatch(/\$12\.50/);
  });

  it("getUnassignedItems returns indices of unassigned items", () => {
    const incomplete = new Map<number, PersonItemAssignment[]>([
      [0, [{ personId: "a", sharePercentage: 50 }]],
    ]);
    expect(getUnassignedItems(receipt, incomplete)).toContain(0);
  });
});
