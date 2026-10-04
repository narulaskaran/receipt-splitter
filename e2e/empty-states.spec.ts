import { test, expect } from "@playwright/test";
import {
  preloadSession,
  baseState,
  emptyPerson,
  usdReceipt,
  fullyAssignedState,
  nextStepButton,
  resultsPersonRow,
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
      page.getByText("No one yet. Add yourself too if you're paying a share."),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Groups")).toHaveCount(0);
    await expect(page.getByText("Add at least one person")).toBeVisible();
    await expect(nextStepButton(page)).toBeDisabled();
    await expect(page.getByRole("tab", { name: /assign/i })).toBeDisabled();
  });

  test("Assign tab with no items shows an empty list and counts as done", async ({
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
    await expect(page.getByTitle(/click to edit price/i)).toHaveCount(0);
    await expect(page.getByText("All items assigned")).toBeVisible();
    await expect(nextStepButton(page)).toBeEnabled();
    await expect(page.getByRole("tab", { name: /totals/i })).toBeEnabled();
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

    await expect(page.getByText("1 of 2 items left")).toBeVisible({
      timeout: 10000,
    });
    await expect(nextStepButton(page)).toBeDisabled();
  });

  test("Next enables once every item is assigned", async ({ page }) => {
    await preloadSession(page, fullyAssignedState(), "assign");

    await page.goto("/");

    await expect(page.getByText("All items assigned")).toBeVisible({
      timeout: 10000,
    });
    const nextBtn = nextStepButton(page);
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await expect(page.getByRole("tab", { name: /totals/i })).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(resultsPersonRow(page, "Alice")).toBeVisible();
  });

  test("Groups card shows empty prompt when people exist but no groups", async ({
    page,
  }) => {
    await preloadSession(page, baseState(), "people");

    await page.goto("/");

    await expect(page.getByText("Alice", { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText("Create groups to quickly assign items to multiple people"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create group/i }).first(),
    ).toBeVisible();
  });
});
