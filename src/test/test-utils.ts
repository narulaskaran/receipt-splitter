/**
 * Centralized test utilities and mock data
 *
 * Browser API mocks (localStorage, fetch, clipboard, etc.) are configured
 * globally in jest.setup.ts. This file provides:
 * - Mock data factories for common test scenarios
 * - Re-exports of testing-library for convenience
 */
import { type Person, type Receipt, type PersonItemAssignment, type Group, type StoredReceipt } from "@/types";

// =============================================================================
// Mock Data: People
// =============================================================================

export const mockPeople: Person[] = [
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

// =============================================================================
// Mock Data: Receipts
// =============================================================================

export const mockReceipt: Receipt = {
  restaurant: "Testaurant",
  date: "2024-01-01",
  subtotal: 100,
  tax: 10,
  tip: 15,
  total: 125,
  currency: "USD",
  items: [
    { name: "Burger", price: 50, quantity: 1 },
    { name: "Fries", price: 25, quantity: 2 },
  ],
};

/** Create a receipt with custom properties */
export function createMockReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    restaurant: "Test Restaurant",
    date: "2024-01-01",
    subtotal: 100,
    tax: 10,
    tip: 15,
    total: 125,
    items: [{ name: "Test Item", price: 100, quantity: 1 }],
    currency: 'USD',
    ...overrides,
  };
}

// =============================================================================
// Mock Data: Item Assignments
// =============================================================================

export const mockAssignedItems = new Map<number, PersonItemAssignment[]>([
  [0, [{ personId: "a", sharePercentage: 100 }]],
  [1, [{ personId: "b", sharePercentage: 100 }]],
]);

/** Wrap a receipt as a session-level StoredReceipt */
export function createStoredReceipt(
  receipt: Receipt = mockReceipt,
  id = crypto.randomUUID()
): StoredReceipt {
  return { id, receipt };
}

// =============================================================================
// Mock Data: Groups
// =============================================================================

export const mockGroups: Group[] = [
  { id: "g1", name: "Team A", emoji: "🍕", memberIds: ["a"] },
  { id: "g2", name: "Team B", emoji: "🍔", memberIds: ["b"] },
];

// =============================================================================
// Re-exports for convenience
// =============================================================================

export * from "@testing-library/react";
