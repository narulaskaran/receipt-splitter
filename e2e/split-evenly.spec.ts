import { test, expect, type Page } from "@playwright/test";

// =============================================================================
// Helper: preload session via localStorage
// =============================================================================
async function preloadSession(
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

// =============================================================================
// Test 1 — 2 people, 2 items, $10 total → each gets $5
// =============================================================================

const RECEIPT_2P_2I = {
  restaurant: "Even Diner",
  date: "2024-01-15",
  subtotal: 10.0,
  tax: 0,
  tip: 0,
  total: 10.0,
  currency: "USD",
  items: [
    { name: "Burger", price: 5.0, quantity: 1 },
    { name: "Fries", price: 5.0, quantity: 1 },
  ],
};

const PEOPLE_2P_2I = [
  {
    id: "p1",
    name: "Alice",
    items: [],
    totalBeforeTax: 0,
    tax: 0,
    tip: 0,
    finalTotal: 0,
  },
  {
    id: "p2",
    name: "Bob",
    items: [],
    totalBeforeTax: 0,
    tax: 0,
    tip: 0,
    finalTotal: 0,
  },
];

const ASSIGNED_2P_2I: unknown[] = [];
const UNASSIGNED_2P_2I = [0, 1];

// =============================================================================
// Test 2 — 3 people, 2 items, $12 total → each gets $4
// =============================================================================

function buildThreePersonData() {
  const receipt = {
    restaurant: "Trio Cafe",
    date: "2024-03-01",
    subtotal: 12.0,
    tax: 0,
    tip: 0,
    total: 12.0,
    currency: "USD",
    items: [
      { name: "Pizza", price: 6.0, quantity: 1 },
      { name: "Salad", price: 6.0, quantity: 1 },
    ],
  };

  const people = [
    { id: "p1", name: "Alice", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
    { id: "p2", name: "Bob", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
    { id: "p3", name: "Charlie", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
  ];

  return {
    state: {
      originalReceipt: receipt,
      people,
      assignedItems: [] as unknown[],
      unassignedItems: [0, 1],
      groups: [] as unknown[],
      isLoading: false,
      error: null,
    },
  };
}

// =============================================================================
// Test 3 — Empty receipt (no items) → graceful no-op
// =============================================================================

const RECEIPT_EMPTY = {
  restaurant: "Empty Cafe",
  date: "2024-04-01",
  subtotal: 0,
  tax: 0,
  tip: 0,
  total: 0,
  currency: "USD",
  items: [] as { name: string; price: number; quantity: number }[],
};

const PEOPLE_EMPTY = [
  { id: "p1", name: "Alice", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
  { id: "p2", name: "Bob", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
];

// =============================================================================
// Test 4 — Some items already assigned → only unassigned items split
// =============================================================================

const RECEIPT_PRE_ASSIGNED = {
  restaurant: "PreSplit Grill",
  date: "2024-05-01",
  subtotal: 10.0,
  tax: 0,
  tip: 0,
  total: 10.0,
  currency: "USD",
  items: [
    { name: "Steak", price: 5.0, quantity: 1 },
    { name: "Wine", price: 5.0, quantity: 1 },
  ],
};

const PEOPLE_PRE_ASSIGNED = [
  {
    id: "p1",
    name: "Alice",
    items: [
      { itemId: 0, itemName: "Steak", originalPrice: 5.0, quantity: 1, sharePercentage: 100, amount: 5.0 },
    ],
    totalBeforeTax: 5.0,
    tax: 0,
    tip: 0,
    finalTotal: 5.0,
  },
  {
    id: "p2",
    name: "Bob",
    items: [],
    totalBeforeTax: 0,
    tax: 0,
    tip: 0,
    finalTotal: 0,
  },
];

// Item 0 already assigned to Alice, Item 1 unassigned
const ASSIGNED_PRE = [[0, [{ personId: "p1", sharePercentage: 100 }]]];
const UNASSIGNED_PRE = [1];

// =============================================================================
// Tests
// =============================================================================

test.describe("Split All Evenly flow", () => {
  // ---------------------------------------------------------------------------
  // 2 people, 2 items, $10 total → each gets $5
  // ---------------------------------------------------------------------------
  test("splits 2 items evenly between 2 people — $5 each", async ({
    page,
  }) => {
    await test.step("preload session with 2 items, $10 total, 2 people", async () => {
      await preloadSession(page, {
        originalReceipt: RECEIPT_2P_2I,
        people: PEOPLE_2P_2I,
        assignedItems: ASSIGNED_2P_2I,
        unassignedItems: UNASSIGNED_2P_2I,
        groups: [],
        isLoading: false,
        error: null,
      }, "assign");
    });

    await test.step("Assign tab — Split All Evenly button visible and enabled", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const splitBtn = page.getByRole("button", { name: /split evenly/i });
      await expect(splitBtn).toBeVisible({ timeout: 10000 });
      await expect(splitBtn).toBeEnabled();
    });

    await test.step("click Split All Evenly — toast confirms", async () => {
      await page.getByRole("button", { name: /split evenly/i }).click();
      // Wait for toast to appear
      await expect(page.getByText("All items split evenly among everyone!").first()).toBeVisible({ timeout: 5000 });
    });

    await test.step("progress shows 100% after split", async () => {
      await expect(page.getByText("100%")).toBeVisible({ timeout: 5000 });
    });

    await test.step("navigate to Results tab — both people show $5.00 total", async () => {
      // Click the Results tab trigger
      const resultsTab = page.getByRole("tab", { name: /results/i });
      await resultsTab.click();

      // Verify the total on each person's result row.
      const aliceRow = page.getByRole("row").filter({ hasText: "Alice" });
      const bobRow = page.getByRole("row").filter({ hasText: "Bob" });
      await expect(aliceRow).toContainText("$5.00");
      await expect(bobRow).toContainText("$5.00");
    });
  });

  // ---------------------------------------------------------------------------
  // 3 people, 2 items, $12 total → each gets $4 (rounding test)
  // ---------------------------------------------------------------------------
  test("splits 2 items evenly among 3 people — $4 each with rounding", async ({
    page,
  }) => {
    const threePersonData = buildThreePersonData();

    await test.step("preload session with 2 items, $12 total, 3 people", async () => {
      await preloadSession(page, threePersonData.state, "assign");
    });

    await test.step("Assign tab — Split All Evenly button visible", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const splitBtn = page.getByRole("button", { name: /split evenly/i });
      await expect(splitBtn).toBeVisible({ timeout: 10000 });
      await expect(splitBtn).toBeEnabled();
    });

    await test.step("click Split All Evenly", async () => {
      await page.getByRole("button", { name: /split evenly/i }).click();
      await expect(page.getByText("All items split evenly among everyone!").first()).toBeVisible({ timeout: 5000 });
    });

    await test.step("progress shows 100%", async () => {
      await expect(page.getByText("100%")).toBeVisible({ timeout: 5000 });
    });

    await test.step("Results tab — all three people show $4.00 total", async () => {
      await page.getByRole("tab", { name: /results/i }).click();

      const aliceRow = page.getByRole("row").filter({ hasText: "Alice" });
      const bobRow = page.getByRole("row").filter({ hasText: "Bob" });
      const charlieRow = page.getByRole("row").filter({ hasText: "Charlie" });
      await expect(aliceRow).toContainText("$4.00");
      await expect(bobRow).toContainText("$4.00");
      await expect(charlieRow).toContainText("$4.00");
    });
  });

  // ---------------------------------------------------------------------------
  // Empty receipt (no items) → graceful no-op
  // ---------------------------------------------------------------------------
  test("empty receipt — Split All Evenly is a no-op", async ({
    page,
  }) => {
    await test.step("preload session with empty receipt (0 items), 2 people", async () => {
      await preloadSession(page, {
        originalReceipt: RECEIPT_EMPTY,
        people: PEOPLE_EMPTY,
        assignedItems: [],
        unassignedItems: [],
        groups: [],
        isLoading: false,
        error: null,
      }, "assign");
    });

    await test.step("Assign tab — Split evenly button is visible and disabled", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const splitBtn = page.getByRole("button", { name: /split evenly/i });
      await expect(splitBtn).toBeVisible({ timeout: 10000 });
      await expect(splitBtn).toBeDisabled();
    });

    await test.step("progress stays at 100% (empty receipt rounds to 100%)", async () => {
      await expect(page.getByText("100%")).toBeVisible({ timeout: 5000 });
    });
  });

  // ---------------------------------------------------------------------------
  // Some items already assigned → only unassigned items split
  // ---------------------------------------------------------------------------
  test("with pre-assigned items — only unassigned items split evenly", async ({
    page,
  }) => {
    await test.step("preload session with Item 0 assigned to Alice, Item 1 unassigned", async () => {
      await preloadSession(page, {
        originalReceipt: RECEIPT_PRE_ASSIGNED,
        people: PEOPLE_PRE_ASSIGNED,
        assignedItems: ASSIGNED_PRE,
        unassignedItems: UNASSIGNED_PRE,
        groups: [],
        isLoading: false,
        error: null,
      }, "assign");
    });

    await test.step("Assign tab — button visible", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const splitBtn = page.getByRole("button", { name: /split evenly/i });
      await expect(splitBtn).toBeVisible({ timeout: 10000 });
      await expect(splitBtn).toBeEnabled();
    });

    await test.step("verify progress shows 50% (1 of 2 items assigned)", async () => {
      await expect(page.getByText("50%")).toBeVisible({ timeout: 5000 });
    });

    await test.step("click Split All Evenly", async () => {
      await page.getByRole("button", { name: /split evenly/i }).click();
      await expect(page.getByText("All items split evenly among everyone!").first()).toBeVisible({ timeout: 5000 });
    });

    await test.step("progress shows 100% after split", async () => {
      await expect(page.getByText("100%")).toBeVisible({ timeout: 5000 });
    });

    await test.step("Results tab — Alice $7.50, Bob $2.50", async () => {
      await page.getByRole("tab", { name: /results/i }).click();

      // Alice: $5.00 (item 0) + $2.50 (half of item 1) = $7.50
      await expect(page.getByRole("row").filter({ hasText: "Alice" })).toContainText("$7.50");
      // Bob: $2.50 (half of item 1)
      await expect(page.getByRole("row").filter({ hasText: "Bob" })).toContainText("$2.50");
    });
  });
});
