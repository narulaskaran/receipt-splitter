import { test, expect, type Page } from "@playwright/test";

/**
 * v1 of this harness waited for "Split Validation Issues" on a single-receipt
 * session with incomplete assignments. After multi-receipt Results gating, that
 * copy never appears: unassigned items bounce off Results, and a complete
 * 2-receipt day shows Day total / By receipt instead.
 */
const MOCK_COFFEE_ID = "receipt-coffee";
const MOCK_LUNCH_ID = "receipt-lunch";

const MOCK_STATE = {
  version: 2,
  state: {
    receipts: [
      {
        id: MOCK_COFFEE_ID,
        receipt: {
          restaurant: "Coffee",
          date: "2024-01-15",
          subtotal: 10.0,
          tax: 1.0,
          tip: 2.0,
          total: 13.0,
          currency: "USD",
          items: [
            { name: "Latte", price: 5.0, quantity: 1 },
            { name: "Muffin", price: 5.0, quantity: 1 },
          ],
        },
      },
      {
        id: MOCK_LUNCH_ID,
        receipt: {
          restaurant: "Lunch",
          date: "2024-01-15",
          subtotal: 20.0,
          tax: 2.0,
          tip: 4.0,
          total: 26.0,
          currency: "USD",
          items: [
            { name: "Burger", price: 10.0, quantity: 1 },
            { name: "Fries", price: 10.0, quantity: 1 },
          ],
        },
      },
    ],
    people: [
      {
        id: "p1",
        name: "Alice",
        items: [],
        totalBeforeTax: 15,
        tax: 1.5,
        tip: 3,
        finalTotal: 19.5,
      },
      {
        id: "p2",
        name: "Bob",
        items: [],
        totalBeforeTax: 15,
        tax: 1.5,
        tip: 3,
        finalTotal: 19.5,
      },
    ],
    assignedItems: [
      [
        MOCK_COFFEE_ID,
        [
          [0, [{ personId: "p1", sharePercentage: 100 }]],
          [1, [{ personId: "p2", sharePercentage: 100 }]],
        ],
      ],
      [
        MOCK_LUNCH_ID,
        [
          [0, [{ personId: "p1", sharePercentage: 100 }]],
          [1, [{ personId: "p2", sharePercentage: 100 }]],
        ],
      ],
    ],
    groups: [],
    isLoading: false,
    error: null,
  },
  activeTab: "results",
};

async function seedResultsSession(page: Page) {
  await page.addInitScript((value) => {
    window.localStorage.setItem(
      "receiptSplitterSession",
      JSON.stringify(value),
    );
  }, MOCK_STATE);
}

async function expectGatedMultiReceiptResults(page: Page) {
  await expect(page.getByRole("tab", { name: /results/i })).toHaveAttribute(
    "data-state",
    "active",
    { timeout: 10000 },
  );
  await expect(page.getByRole("heading", { name: "Day total" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "By receipt" })).toBeVisible();
}

test("Capture validation screenshots", async ({ page }) => {
  await seedResultsSession(page);
  await page.goto("/");
  await expectGatedMultiReceiptResults(page);

  const dayTotal = page.getByTestId("day-total");
  await dayTotal.screenshot({ path: "screenshots/validation-errors-desktop.png" });

  await page.screenshot({ path: "screenshots/full-results-desktop.png", fullPage: true });

  const shareSection = page
    .locator("text=Your Phone Number")
    .locator("..")
    .locator("..");
  // Share Split stays disabled until a 10-digit Venmo phone is entered.
  const shareButton = page.getByRole("button", { name: "Share Split" });
  await expect(shareButton).toBeDisabled();
  await shareSection.screenshot({ path: "screenshots/share-section-disabled.png" });

  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expectGatedMultiReceiptResults(page);
  await page.getByTestId("day-total").screenshot({
    path: "screenshots/validation-errors-dark.png",
  });
});

test("Capture mobile screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });

  await seedResultsSession(page);
  await page.goto("/");
  await expectGatedMultiReceiptResults(page);

  await page.getByTestId("day-total").screenshot({
    path: "screenshots/validation-errors-mobile.png",
  });
});
