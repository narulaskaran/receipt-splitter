import { test, expect } from "@playwright/test";

// ---- Mock data --------------------------------------------------------------
// Validated happy-path receipt: all math correct, all items fully assigned.
const MOCK_RECEIPT = {
  restaurant: "Test Diner",
  date: "2024-01-15",
  subtotal: 43.0,
  tax: 4.3,
  tip: 8.6,
  total: 55.9,
  currency: "USD",
  items: [
    { name: "Burger", price: 15.0, quantity: 1 },
    { name: "Fries", price: 5.0, quantity: 2 },
    { name: "Soda", price: 3.0, quantity: 2 },
    { name: "Salad", price: 12.0, quantity: 1 },
  ],
} as const;

// Pre-calculated people totals — matches MOCK_RECEIPT exactly.
// Alice: Burger 100% ($15) + Fries 50% ($5) + Salad 50% ($6) = $26.00 before tax
//   tax = 26/43 * 4.30 = 2.60, tip = 26/43 * 8.60 = 5.20, final = 33.80
// Bob: Fries 50% ($5) + Soda 100% ($6) + Salad 50% ($6) = $17.00 before tax
//   tax = 17/43 * 4.30 = 1.70, tip = 17/43 * 8.60 = 3.40, final = 22.10
const MOCK_PEOPLE = [
  {
    id: "p1",
    name: "Alice",
    items: [
      {
        itemId: 0,
        itemName: "Burger",
        originalPrice: 15.0,
        quantity: 1,
        sharePercentage: 100,
        amount: 15.0,
      },
      {
        itemId: 1,
        itemName: "Fries",
        originalPrice: 5.0,
        quantity: 1,
        sharePercentage: 50,
        amount: 5.0,
      },
      {
        itemId: 3,
        itemName: "Salad",
        originalPrice: 12.0,
        quantity: 1,
        sharePercentage: 50,
        amount: 6.0,
      },
    ],
    totalBeforeTax: 26.0,
    tax: 2.6,
    tip: 5.2,
    finalTotal: 33.8,
  },
  {
    id: "p2",
    name: "Bob",
    items: [
      {
        itemId: 1,
        itemName: "Fries",
        originalPrice: 5.0,
        quantity: 1,
        sharePercentage: 50,
        amount: 5.0,
      },
      {
        itemId: 2,
        itemName: "Soda",
        originalPrice: 3.0,
        quantity: 2,
        sharePercentage: 100,
        amount: 6.0,
      },
      {
        itemId: 3,
        itemName: "Salad",
        originalPrice: 12.0,
        quantity: 1,
        sharePercentage: 50,
        amount: 6.0,
      },
    ],
    totalBeforeTax: 17.0,
    tax: 1.7,
    tip: 3.4,
    finalTotal: 22.1,
  },
];

// assignedItems stored as serialized Map entries — every item 100 % assigned.
const MOCK_ASSIGNED_ITEMS = [
  [0, [{ personId: "p1", sharePercentage: 100 }]],
  [
    1,
    [
      { personId: "p1", sharePercentage: 50 },
      { personId: "p2", sharePercentage: 50 },
    ],
  ],
  [2, [{ personId: "p2", sharePercentage: 100 }]],
  [
    3,
    [
      { personId: "p1", sharePercentage: 50 },
      { personId: "p2", sharePercentage: 50 },
    ],
  ],
];

function buildMockSession(activeTab = "upload") {
  return {
    state: {
      originalReceipt: MOCK_RECEIPT,
      people: MOCK_PEOPLE,
      assignedItems: MOCK_ASSIGNED_ITEMS,
      unassignedItems: [] as number[],
      groups: [],
      isLoading: false,
      error: null,
    },
    activeTab,
  };
}

// ---- Test -------------------------------------------------------------------

test.describe("core flow", () => {
  test("walk Upload → People → Assign → Results and share split", async ({
    page,
    context,
  }) => {
    // Grant clipboard permissions for the Share Split flow.
    await context.grantPermissions(["clipboard-write"]);

    // 1. Mock the /api/parse-receipt endpoint so CI never needs an API key.
    await page.route("**/api/parse-receipt", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RECEIPT),
      }),
    );

    // 2. Preload valid session via localStorage (same mechanism as the
    //    screenshot harness) so the app starts with a fully-populated state
    //    and walks through the tabs without a network call.
    const mockSession = buildMockSession("upload");
    await page.addInitScript((data) => {
      window.localStorage.setItem(
        "receiptSplitterSession",
        JSON.stringify(data),
      );
    }, mockSession);

    // 3. Navigate to the app.
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // ---- Tab 1: Upload ------------------------------------------------------
    // The receipt card should be visible because we preloaded it.
    await expect(page.getByText("Test Diner")).toBeVisible({ timeout: 10000 });

    // Verify receipt financial figures are rendered.
    await expect(page.getByText("$43.00")).toBeVisible();
    await expect(page.getByText("$55.90")).toBeVisible();

    // "Next" should be enabled (receipt is loaded).
    // Use { exact: true } — the Next.js Dev Tools button also contains "Next".
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeEnabled();

    // ---- Tab 2: People ------------------------------------------------------
    await nextBtn.click();

    // Both people should be listed.
    // (toBeVisible retries for 5s so no manual wait needed.)
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();

    // ---- Tab 3: Assign Items ------------------------------------------------
    await nextBtn.click();

    // All four items should appear in the assignment table.
    // Use .first() because item names also appear in person item cards.
    await expect(page.getByText("Burger").first()).toBeVisible();
    await expect(page.getByText("Fries").first()).toBeVisible();
    await expect(page.getByText("Soda").first()).toBeVisible();
    await expect(page.getByText("Salad").first()).toBeVisible();

    // Progress bar should show 100 % (all items assigned).
    // The exact width depends on the UI, but we can assert the "100%" text.
    await expect(page.getByText("100%")).toBeVisible();

    // ---- Tab 4: Results -----------------------------------------------------
    await nextBtn.click();

    // Totals must render.  Look for the formatted dollar amounts.
    // (toBeVisible retries for 5s so no manual wait needed.)
    // Use .first() because amounts appear in both summary cards and detail rows.
    await expect(page.getByText("$33.80").first()).toBeVisible();
    await expect(page.getByText("$22.10").first()).toBeVisible();

    // ---- Share Split --------------------------------------------------------
    // Fill in a valid US phone number and click "Share Split".
    const phoneInput = page.locator("#venmo-phone");
    await phoneInput.fill("5551234567");

    const shareBtn = page.getByRole("button", { name: "Share Split" });
    await expect(shareBtn).toBeEnabled();
    await shareBtn.click();

    // After a successful copy the button text changes to "Copied!".
    await expect(page.getByText("Copied!")).toBeVisible({ timeout: 5000 });
  });
});
