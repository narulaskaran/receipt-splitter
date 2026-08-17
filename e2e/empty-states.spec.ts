import { test, expect } from "@playwright/test";
import {
  preloadSession,
  baseState,
  emptyPerson,
  usdReceipt,
  fullyAssignedState,
} from "./helpers";

test.describe("empty states", () => {
  test("People tab shows empty prompt and Next is disabled with no people", async ({
    page,
  }) => {
    await preloadSession(
      page,
      baseState({
        people: [],
        assignedItems: [],
        unassignedItems: [0, 1],
      }),
      "people",
    );

    await page.goto("/");

    await expect(
      page.getByText("Add people who shared this receipt"),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Groups")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("tab", { name: /assign items/i }),
    ).toBeDisabled();
  });

  test("Assign tab with no items shows an empty list and 100% progress", async ({
    page,
  }) => {
    await preloadSession(
      page,
      baseState({
        originalReceipt: usdReceipt({
          items: [],
          subtotal: 0,
          total: 0,
        }),
        unassignedItems: [],
      }),
      "assign",
    );

    await page.goto("/");

    await expect(page.getByRole("button", { name: /add item/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("row")).toHaveCount(1);
    await expect(page.getByText("100%")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next", exact: true }),
    ).toBeEnabled();
    await expect(page.getByRole("tab", { name: /results/i })).toBeEnabled();
  });

  test("Next stays disabled until all items are assigned", async ({ page }) => {
    await preloadSession(
      page,
      baseState({
        assignedItems: [[0, [{ personId: "p1", sharePercentage: 100 }]]],
        unassignedItems: [1],
        people: [
          {
            ...emptyPerson("p1", "Alice"),
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
            finalTotal: 10,
          },
          emptyPerson("p2", "Bob"),
        ],
      }),
      "assign",
    );

    await page.goto("/");

    await expect(page.getByText("50%")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
  });

  test("Next enables once every item is assigned", async ({ page }) => {
    await preloadSession(page, fullyAssignedState(), "assign");

    await page.goto("/");

    await expect(page.getByText("100%")).toBeVisible({ timeout: 10000 });
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await expect(page.getByRole("tab", { name: /results/i })).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(page.getByRole("cell", { name: "Alice" })).toBeVisible();
  });

  test("Groups card shows empty prompt when people exist but no groups", async ({
    page,
  }) => {
    await preloadSession(page, baseState(), "people");

    await page.goto("/");

    await expect(page.getByText("Alice")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Create groups to quickly assign items to multiple people"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create group/i }).first(),
    ).toBeVisible();
  });
});
