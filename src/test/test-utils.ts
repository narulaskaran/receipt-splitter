/**
 * Centralized test utilities and mock data
 *
 * Browser API mocks (localStorage, fetch, clipboard, etc.) are configured
 * globally in jest.setup.ts. This file provides:
 * - Mock data factories for common test scenarios
 * - Helper functions for setting up specific test conditions
 * - Re-exports of testing-library for convenience
 */
import { type Person, type Receipt, type PersonItemAssignment, type Group } from "@/types";

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

/** Create a person with custom properties */
export function createMockPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: crypto.randomUUID(),
    name: "Test Person",
    items: [],
    totalBeforeTax: 0,
    tax: 0,
    tip: 0,
    finalTotal: 0,
    ...overrides,
  };
}

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

/** Create an assignment map for testing */
export function createMockAssignments(
  assignments: Array<{ itemIndex: number; personId: string; sharePercentage?: number }>
): Map<number, PersonItemAssignment[]> {
  const map = new Map<number, PersonItemAssignment[]>();
  for (const { itemIndex, personId, sharePercentage = 100 } of assignments) {
    const existing = map.get(itemIndex) || [];
    existing.push({ personId, sharePercentage });
    map.set(itemIndex, existing);
  }
  return map;
}

// =============================================================================
// Mock Data: Groups
// =============================================================================

export const mockGroups: Group[] = [
  { id: "g1", name: "Team A", emoji: "🍕", memberIds: ["a"] },
  { id: "g2", name: "Team B", emoji: "🍔", memberIds: ["b"] },
];

/** Create a group with custom properties */
export function createMockGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: crypto.randomUUID(),
    name: "Test Group",
    emoji: "🎉",
    memberIds: [],
    ...overrides,
  };
}

// =============================================================================
// Fetch Mock Helpers
// =============================================================================

/** Configure fetch to return a successful JSON response */
export function mockFetchSuccess<T>(data: T, status = 200): void {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  });
}

/** Configure fetch to return an error response */
export function mockFetchError(status = 500, message = "Internal Server Error"): void {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: message,
    json: jest.fn().mockResolvedValue({ error: message }),
    text: jest.fn().mockResolvedValue(message),
  });
}

/** Configure fetch to reject with a network error */
export function mockFetchNetworkError(message = "Network error"): void {
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(message));
}

// =============================================================================
// Toast Mock Helpers (sonner is auto-mocked via __mocks__/sonner.ts)
// =============================================================================

/** Get the mocked toast functions for assertions */
export function getToastMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { toast } = require("sonner");
  return toast as {
    error: jest.Mock;
    success: jest.Mock;
    info: jest.Mock;
    warning: jest.Mock;
  };
}

// =============================================================================
// File Mock Helpers
// =============================================================================

/** Create a mock File object for upload testing */
export function createMockFile(
  name = "test.jpg",
  type = "image/jpeg",
  size = 1024
): File {
  const content = new Array(size).fill("a").join("");
  return new File([content], name, { type });
}

/** Create a mock FileList for input testing */
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };

  // Add indexed access
  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, { value: file });
  });

  return fileList as unknown as FileList;
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export * from "@testing-library/react";
