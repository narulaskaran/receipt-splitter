import { type Page } from "@playwright/test";

export async function preloadSession(
  page: Page,
  state: Record<string, unknown>,
  activeTab = "upload",
) {
  const session = { state, activeTab };
  await page.addInitScript((data) => {
    window.localStorage.setItem(
      "receiptSplitterSession",
      JSON.stringify(data),
    );
  }, session);
}

/** Seed localStorage after the origin is loaded so later reloads are not overwritten by addInitScript. */
export async function seedSessionViaReload(
  page: Page,
  state: Record<string, unknown>,
  activeTab = "upload",
) {
  await page.goto("/");
  await page.evaluate(
    ({ sessionState, tab }) => {
      window.localStorage.setItem(
        "receiptSplitterSession",
        JSON.stringify({ state: sessionState, activeTab: tab }),
      );
    },
    { sessionState: state, tab: activeTab },
  );
  await page.reload();
}

/** 1x1 transparent PNG — enough to satisfy the receipt uploader. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function uploadTinyReceipt(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
}

export function parseMoney(text: string | null | undefined): number {
  if (!text) return NaN;
  const numeric = text.replace(/[^0-9,.-]/g, "");
  if (numeric.includes(",") && numeric.includes(".")) {
    return parseFloat(numeric.replace(/,/g, ""));
  }
  if (numeric.includes(",")) {
    return parseFloat(numeric.replace(",", "."));
  }
  return parseFloat(numeric);
}

export function emptyPerson(id: string, name: string) {
  return {
    id,
    name,
    items: [] as unknown[],
    totalBeforeTax: 0,
    tax: 0,
    tip: 0,
    finalTotal: 0,
  };
}

export function usdReceipt(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    restaurant: "Test Diner",
    date: "2024-01-15",
    subtotal: 20,
    tax: 0,
    tip: 0,
    total: 20,
    currency: "USD",
    items: [
      { name: "Burger", price: 10, quantity: 1 },
      { name: "Fries", price: 10, quantity: 1 },
    ],
    ...overrides,
  };
}

export function baseState(overrides: Record<string, unknown> = {}) {
  return {
    originalReceipt: usdReceipt(),
    people: [emptyPerson("p1", "Alice"), emptyPerson("p2", "Bob")],
    assignedItems: [] as unknown[],
    unassignedItems: [0, 1],
    groups: [] as unknown[],
    isLoading: false,
    error: null,
    ...overrides,
  };
}

/** Alice owns Burger, Bob owns Fries — $10 each before tax. */
export function fullyAssignedState(overrides: Record<string, unknown> = {}) {
  const receipt = usdReceipt();
  return baseState({
    originalReceipt: receipt,
    people: [
      {
        id: "p1",
        name: "Alice",
        items: [
          {
            itemId: 0,
            itemName: "Burger",
            originalPrice: 10,
            quantity: 1,
            sharePercentage: 100,
            amount: 10,
          },
        ],
        totalBeforeTax: 10,
        tax: 0,
        tip: 0,
        finalTotal: 10,
      },
      {
        id: "p2",
        name: "Bob",
        items: [
          {
            itemId: 1,
            itemName: "Fries",
            originalPrice: 10,
            quantity: 1,
            sharePercentage: 100,
            amount: 10,
          },
        ],
        totalBeforeTax: 10,
        tax: 0,
        tip: 0,
        finalTotal: 10,
      },
    ],
    assignedItems: [
      [0, [{ personId: "p1", sharePercentage: 100 }]],
      [1, [{ personId: "p2", sharePercentage: 100 }]],
    ],
    unassignedItems: [],
    ...overrides,
  });
}
