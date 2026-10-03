import { test, expect } from "@playwright/test";
import { preloadSession, emptyPerson, uploadTinyReceipt } from "./helpers";

const usdReceipt = {
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

const eurReceipt = {
  restaurant: "Paris Bistro",
  date: "2024-01-02",
  subtotal: 10,
  tax: 1,
  tip: 0,
  total: 11,
  currency: "EUR",
  items: [{ name: "Croissant", price: 10, quantity: 1 }],
};

function usdOnlyState() {
  return {
    receipts: [{ id: "r1", receipt: usdReceipt }],
    people: [emptyPerson("a", "Alice"), emptyPerson("b", "Bob")],
    assignedItems: [["r1", []]],
    groups: [] as unknown[],
    isLoading: false,
    error: null as string | null,
  };
}

test.describe("mixed-currency session", () => {
  test("shows per-currency results and hides Venmo sharing", async ({
    page,
  }) => {
    await preloadSession(
      page,
      {
        receipts: [
          { id: "r1", receipt: usdReceipt },
          { id: "r2", receipt: eurReceipt },
        ],
        people: [emptyPerson("a", "Alice"), emptyPerson("b", "Bob")],
        assignedItems: [
          [
            "r1",
            [
              [0, [{ personId: "a", sharePercentage: 100 }]],
              [1, [{ personId: "b", sharePercentage: 100 }]],
            ],
          ],
          ["r2", [[0, [{ personId: "a", sharePercentage: 100 }]]]],
        ],
        groups: [],
        isLoading: false,
        error: null,
      },
      "results",
    );

    await page.goto("/");

    await expect(page.getByText("Results Summary · USD")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Results Summary · EUR")).toBeVisible();
    await expect(
      page.getByText("Venmo sharing is available only for single-currency splits."),
    ).toHaveCount(2);
    await expect(page.locator("#venmo-phone")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /share split/i })).toHaveCount(0);
    await expect(page.getByText("$0.00")).toHaveCount(0);
    await expect(page.getByText("€0.00")).toHaveCount(0);
  });

  test("accepts a mismatched upload after confirmation", async ({ page }) => {
    await page.route("**/api/parse-receipt", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(eurReceipt),
      }),
    );
    await preloadSession(page, usdOnlyState());
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toBe(
        "This receipt is EUR but this split is USD — keep anyway?",
      );
      await dialog.accept();
    });

    await page.goto("/");
    await uploadTinyReceipt(page);

    await expect(page.getByText("Paris Bistro").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("rejects a mismatched upload when confirmation is cancelled", async ({
    page,
  }) => {
    await page.route("**/api/parse-receipt", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(eurReceipt),
      }),
    );
    await preloadSession(page, usdOnlyState());
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toBe(
        "This receipt is EUR but this split is USD — keep anyway?",
      );
      await dialog.dismiss();
    });

    await page.goto("/");
    await uploadTinyReceipt(page);

    await expect(page.getByText("Paris Bistro")).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(page.getByText("Testaurant").first()).toBeVisible();
  });
});
