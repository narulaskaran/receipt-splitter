// Centralized test utilities and mock data for tests
import { type Person, type Receipt, type PersonItemAssignment } from "@/types";

// Common mock people
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

// Common mock receipt
export const mockReceipt: Receipt = {
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

// Common assigned items
export const mockAssignedItems = new Map<number, PersonItemAssignment[]>([
  [0, [{ personId: "a", sharePercentage: 100 }]],
  [1, [{ personId: "b", sharePercentage: 100 }]],
]);

// Global mocks for tests
export function setupGlobalMocks() {
  // Mock crypto.randomUUID
  if (!global.crypto) {
    global.crypto = {} as Crypto;
  }
  global.crypto.randomUUID = jest.fn(
    () => "00000000-0000-4000-8000-000000000000"
  ) as unknown as Crypto["randomUUID"];

  // Mock sonner.toast
  jest.mock("sonner", () => ({
    toast: { error: jest.fn(), success: jest.fn() },
  }));

  // Mock window.matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Barrel export for common test imports
export * from "@testing-library/react";
