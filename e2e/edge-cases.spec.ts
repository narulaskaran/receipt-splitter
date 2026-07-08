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
// Test 1 — Zero total receipt
// =============================================================================

const ZERO_RECEIPT = {
  restaurant: "Free Cafe",
  date: "2024-06-01",
  subtotal: 0,
  tax: 0,
  tip: 0,
  total: 0,
  currency: "USD",
  items: [{ name: "Complimentary Water", price: 0, quantity: 1 }],
};

const ZERO_PEOPLE = [
  {
    id: "p1",
    name: "Alice",
    items: [
      {
        itemId: 0,
        itemName: "Complimentary Water",
        originalPrice: 0,
        quantity: 1,
        sharePercentage: 100,
        amount: 0,
      },
    ],
    totalBeforeTax: 0,
    tax: 0,
    tip: 0,
    finalTotal: 0,
  },
];

const ZERO_ASSIGNED = [[0, [{ personId: "p1", sharePercentage: 100 }]]];

const ZERO_UNASSIGNED: number[] = [];

// =============================================================================
// Test 2 — Single line item
// =============================================================================

const SINGLE_RECEIPT = {
  restaurant: "Corner Bistro",
  date: "2024-06-15",
  subtotal: 12.5,
  tax: 1.25,
  tip: 2.5,
  total: 16.25,
  currency: "USD",
  items: [{ name: "Burger", price: 12.5, quantity: 1 }],
};

const SINGLE_PEOPLE = [
  {
    id: "p1",
    name: "Alice",
    items: [
      {
        itemId: 0,
        itemName: "Burger",
        originalPrice: 12.5,
        quantity: 1,
        sharePercentage: 100,
        amount: 12.5,
      },
    ],
    totalBeforeTax: 12.5,
    tax: 1.25,
    tip: 2.5,
    finalTotal: 16.25,
  },
];

const SINGLE_ASSIGNED = [[0, [{ personId: "p1", sharePercentage: 100 }]]];

const SINGLE_UNASSIGNED: number[] = [];

// =============================================================================
// Test 3 — 20+ items (receipt with 25 items split among 4 people)
// =============================================================================

function buildManyItemsData() {
  const itemNames = [
    "Wings", "Nachos", "Burger", "Pizza", "Pasta",
    "Salad", "Soup", "Steak", "Ribs", "Fish",
    "Shrimp", "Tacos", "Quesadilla", "Wrap", "Sushi",
    "Ramen", "Curry", "Fried Rice", "Noodles", "Dumplings",
    "Spring Roll", "Garlic Bread", "Onion Rings", "Mozzarella Sticks", "Brownie",
  ];

  const items = itemNames.map((name) => ({
    name,
    price: 10.0,
    quantity: 1,
  }));

  const peopleIds = [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bob" },
    { id: "p3", name: "Charlie" },
    { id: "p4", name: "Dana" },
  ];

  const personItems = peopleIds.map((person) => ({
    ...person,
    items: items.map((_, i) => ({
      itemId: i,
      itemName: items[i].name,
      originalPrice: 10.0,
      quantity: 1,
      sharePercentage: 25,
      amount: 2.5,
    })),
    totalBeforeTax: 62.5,
    tax: 6.25,
    tip: 12.5,
    finalTotal: 81.25,
  }));

  const assignedItems = items.map((_, i) => [
    i,
    peopleIds.map((p) => ({ personId: p.id, sharePercentage: 25 })),
  ]);

  return {
    state: {
      originalReceipt: {
        restaurant: "Large Party Hall",
        date: "2024-07-01",
        subtotal: 250.0,
        tax: 25.0,
        tip: 50.0,
        total: 325.0,
        currency: "USD",
        items,
      },
      people: personItems,
      assignedItems,
      unassignedItems: [] as number[],
      groups: [] as unknown[],
      isLoading: false,
      error: null,
    },
  };
}

// =============================================================================
// Test 4 — Non-USD currency: GBP, EUR, JPY
// =============================================================================

function buildCurrencyReceipt(
  currency: string,
  restaurant: string,
) {
  const isJpy = currency === "JPY";
  const subtotal = isJpy ? 3000 : 29.99;
  const tax = isJpy ? 300 : 3.0;
  const tip = isJpy ? 600 : 6.0;
  const total = isJpy ? 3900 : 38.99;

  return {
    receipt: {
      restaurant,
      date: "2024-08-01",
      subtotal,
      tax,
      tip,
      total,
      currency,
      items: [{ name: "Espresso", price: subtotal, quantity: 1 }],
    },
    people: [
      {
        id: "p1",
        name: "Alice",
        items: [
          {
            itemId: 0,
            itemName: "Espresso",
            originalPrice: subtotal,
            quantity: 1,
            sharePercentage: 100,
            amount: subtotal,
          },
        ],
        totalBeforeTax: subtotal,
        tax,
        tip,
        finalTotal: total,
      },
    ],
    assignedItems: [[0, [{ personId: "p1", sharePercentage: 100 }]]],
  };
}

// =============================================================================
// Tests
// =============================================================================

test.describe("edge-case receipt values", () => {
  // ---------------------------------------------------------------------------
  // Zero total receipt
  // ---------------------------------------------------------------------------
  test("zero total receipt ($0.00) renders gracefully without errors", async ({
    page,
  }) => {
    await test.step("preload zero-total receipt session", async () => {
      await preloadSession(page, {
        originalReceipt: ZERO_RECEIPT,
        people: ZERO_PEOPLE,
        assignedItems: ZERO_ASSIGNED,
        unassignedItems: ZERO_UNASSIGNED,
        groups: [],
        isLoading: false,
        error: null,
      });
    });

    await page.route("**/api/parse-receipt", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ZERO_RECEIPT),
      }),
    );

    await test.step("Upload tab — receipt card shows all-zero values", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("Free Cafe")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("$0.00").first()).toBeVisible();
    });

    await test.step("Next button is enabled with a receipt loaded", async () => {
      const nextBtn = page.getByRole("button", { name: "Next", exact: true });
      await expect(nextBtn).toBeEnabled();
    });

    await test.step("People tab — person renders with $0 total", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText("Alice")).toBeVisible();
    });

    await test.step("Assign tab — item renders and can be assigned", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText("Complimentary Water").first()).toBeVisible();
      await expect(page.getByText("100%")).toBeVisible();
    });

    await test.step("Results tab — totals render and Share button is disabled (no positive amount)", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();

      // Scope to the Total column so assertion is visibility-based, not DOM-order-dependent.
      // The Total value is wrapped in <span className="font-bold ..."> — unique to the final column.
      await expect(page.locator("span.font-bold", { hasText: "$0.00" }).first()).toBeVisible();
      await expect(page.getByRole("cell", { name: "Alice" })).toBeVisible();

      const shareBtn = page.getByRole("button", { name: "Share Split" });
      await expect(shareBtn).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Single line item
  // ---------------------------------------------------------------------------
  test("single line item has no layout issues", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-write"]);

    await test.step("preload single-item session", async () => {
      await preloadSession(page, {
        originalReceipt: SINGLE_RECEIPT,
        people: SINGLE_PEOPLE,
        assignedItems: SINGLE_ASSIGNED,
        unassignedItems: SINGLE_UNASSIGNED,
        groups: [],
        isLoading: false,
        error: null,
      });
    });

    await page.route("**/api/parse-receipt", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SINGLE_RECEIPT),
      }),
    );

    await test.step("Upload tab — receipt card renders cleanly", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("Corner Bistro")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("$12.50")).toBeVisible();
      await expect(page.getByText("$16.25")).toBeVisible();
    });

    await test.step("People tab — single person added", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText("Alice")).toBeVisible();
    });

    await test.step("Assign tab — one item appears without overflow/truncation", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText("Burger").first()).toBeVisible();
      await expect(page.getByText("100%")).toBeVisible();
    });

    await test.step("Results tab — one person total renders correctly", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();

      await expect(page.getByText("$16.25").first()).toBeVisible();

      const phoneInput = page.locator("#venmo-phone");
      await phoneInput.fill("5551234567");
      const shareBtn = page.getByRole("button", { name: "Share Split" });
      await expect(shareBtn).toBeEnabled();
      await shareBtn.click();
      await expect(page.getByText("Copied!")).toBeVisible({ timeout: 5000 });
    });
  });

  // ---------------------------------------------------------------------------
  // 20+ items
  // ---------------------------------------------------------------------------
  test("receipt with 20+ items handles scroll and overflow", async ({
    page,
  }) => {
    const manyItemsData = buildManyItemsData();

    await test.step("preload 25-item session", async () => {
      await preloadSession(page, manyItemsData.state);
    });

    await page.route("**/api/parse-receipt", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(manyItemsData.state.originalReceipt),
      }),
    );

    await test.step("Upload tab — receipt card shows all items", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("Large Party Hall")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("$250.00")).toBeVisible();
      await expect(page.getByText("$325.00")).toBeVisible();
    });

    await test.step("People tab — all four people visible", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText("Alice")).toBeVisible();
      await expect(page.getByText("Bob")).toBeVisible();
      await expect(page.getByText("Charlie")).toBeVisible();
      await expect(page.getByText("Dana")).toBeVisible();
    });

    await test.step("Assign tab — scroll to verify all 25 items are accessible", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();

      // Check that first item in list is visible
      await expect(page.getByText("Wings").first()).toBeVisible();
      // Scroll to the last item (Brownie) to verify the container actually scrolls
      const brownieItem = page.getByText("Brownie").first();
      await brownieItem.scrollIntoViewIfNeeded();
      await expect(brownieItem).toBeVisible();
      await expect(page.getByText("100%")).toBeVisible();
    });

    await test.step("Results tab — all people totals render", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();

      await expect(page.getByText("$81.25").first()).toBeVisible();
      await expect(page.getByRole("cell", { name: "Alice" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "Bob" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "Charlie" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "Dana" })).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Non-USD currency: GBP
  // ---------------------------------------------------------------------------
  test("non-USD currency: GBP (£)", async ({ page }) => {
    const { receipt, people, assignedItems } = buildCurrencyReceipt(
      "GBP",
      "London Cafe",
    );

    await test.step("preload GBP session", async () => {
      await preloadSession(page, {
        originalReceipt: receipt,
        people,
        assignedItems,
        unassignedItems: [],
        groups: [],
        isLoading: false,
        error: null,
      });
    });

    await test.step("upload tab — receipt shows GBP formatting", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("London Cafe")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("GBP - British Pound")).toBeVisible();
      await expect(page.getByText("£29.99").first()).toBeVisible();
      await expect(page.getByText("£38.99").first()).toBeVisible();
    });

    await test.step("People tab — person visible", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText("Alice")).toBeVisible();
    });

    await test.step("Assign tab — item shows GBP amount", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText("Espresso").first()).toBeVisible();
      await expect(page.getByText("100%")).toBeVisible();
    });

    await test.step("Results tab — GBP total renders with £ formatting", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText("£38.99").first()).toBeVisible();
      await expect(page.getByRole("cell", { name: "Alice" })).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Non-USD currency: EUR
  // ---------------------------------------------------------------------------
  test("non-USD currency: EUR (€)", async ({ page }) => {
    const { receipt, people, assignedItems } = buildCurrencyReceipt(
      "EUR",
      "Paris Bistro",
    );

    await test.step("preload EUR session", async () => {
      await preloadSession(page, {
        originalReceipt: receipt,
        people,
        assignedItems,
        unassignedItems: [],
        groups: [],
        isLoading: false,
        error: null,
      });
    });

    await test.step("upload tab — receipt shows EUR formatting", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("Paris Bistro")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("EUR - Euro")).toBeVisible();
      await expect(page.getByText("EUR - Euro (€)")).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Non-USD currency: JPY
  // ---------------------------------------------------------------------------
  test("non-USD currency: JPY (¥)", async ({ page }) => {
    const { receipt, people, assignedItems } = buildCurrencyReceipt(
      "JPY",
      "Tokyo Ramen",
    );

    await test.step("preload JPY session", async () => {
      await preloadSession(page, {
        originalReceipt: receipt,
        people,
        assignedItems,
        unassignedItems: [],
        groups: [],
        isLoading: false,
        error: null,
      });
    });

    await test.step("upload tab — receipt shows JPY formatting", async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("Tokyo Ramen")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(/JPY - Japanese Yen/)).toBeVisible();
    });
  });
});
