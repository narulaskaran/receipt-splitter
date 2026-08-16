import { test, expect } from "@playwright/test";
import {
  preloadSession,
  fullyAssignedState,
  parseMoney,
} from "./helpers";

async function openItemPriceEditor(page: import("@playwright/test").Page, itemName: string) {
  const row = page.getByRole("row").filter({ hasText: itemName });
  await row.getByTitle(/edit price and quantity/i).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function saveItemPrice(page: import("@playwright/test").Page, price: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Item Price").fill(price);
  await dialog.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function gotoAssignTab(page: import("@playwright/test").Page) {
  await preloadSession(page, fullyAssignedState(), "assign");
  await page.goto("/");
  await expect(page.getByRole("row").filter({ hasText: "Burger" })).toBeVisible({
    timeout: 10000,
  });
}

test.describe("edit receipt", () => {
  test("changing an item price updates the line total and person total", async ({
    page,
  }) => {
    await gotoAssignTab(page);

    await openItemPriceEditor(page, "Burger");
    await saveItemPrice(page, "15");

    const burgerRow = page.getByRole("row").filter({ hasText: "Burger" });
    await expect(burgerRow.getByTitle(/edit price and quantity/i)).toContainText(
      "$15.00",
    );

    await page.getByRole("tab", { name: /results/i }).click();
    const aliceRow = page.getByRole("row").filter({ hasText: "Alice" });
    await expect(aliceRow).toContainText("$15.00");
    const bobRow = page.getByRole("row").filter({ hasText: "Bob" });
    await expect(bobRow).toContainText("$10.00");
  });

  test("adding a named item shows that name on the Assign tab", async ({
    page,
  }) => {
    await gotoAssignTab(page);

    await page.getByRole("button", { name: /add item/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Add New Item")).toBeVisible();
    await dialog.getByLabel("Item Name").fill("Milkshake");
    await dialog.getByLabel("Price").fill("6");
    await dialog.getByRole("button", { name: /^Add Item$/i }).click();

    const milkshakeRow = page.getByRole("row").filter({ hasText: "Milkshake" });
    await expect(milkshakeRow).toBeVisible();
    await expect(
      milkshakeRow.getByTitle(/edit price and quantity/i),
    ).toContainText("$6.00");
  });

  test("removing an item updates assignments and results totals", async ({
    page,
  }) => {
    await gotoAssignTab(page);

    const friesRow = page.getByRole("row").filter({ hasText: "Fries" });
    await friesRow.getByRole("button", { name: /delete fries/i }).click();

    await expect(page.getByRole("row").filter({ hasText: "Fries" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("row").filter({ hasText: "Burger" })).toBeVisible();

    await page.getByRole("tab", { name: /results/i }).click();
    await expect(page.getByRole("row").filter({ hasText: "Alice" })).toContainText(
      "$10.00",
    );
    await expect(page.getByRole("row").filter({ hasText: "Bob" })).toContainText(
      "$0.00",
    );
  });

  test("editing two items in sequence keeps both new prices", async ({
    page,
  }) => {
    await gotoAssignTab(page);

    await openItemPriceEditor(page, "Burger");
    await saveItemPrice(page, "20");

    await openItemPriceEditor(page, "Fries");
    await saveItemPrice(page, "8");

    await expect(
      page.getByRole("row").filter({ hasText: "Burger" }).getByTitle(
        /edit price and quantity/i,
      ),
    ).toContainText("$20.00");
    await expect(
      page.getByRole("row").filter({ hasText: "Fries" }).getByTitle(
        /edit price and quantity/i,
      ),
    ).toContainText("$8.00");

    await page.getByRole("tab", { name: /results/i }).click();
    const aliceTotal = parseMoney(
      await page
        .getByRole("row")
        .filter({ hasText: "Alice" })
        .getByRole("cell")
        .last()
        .textContent(),
    );
    const bobTotal = parseMoney(
      await page
        .getByRole("row")
        .filter({ hasText: "Bob" })
        .getByRole("cell")
        .last()
        .textContent(),
    );
    expect(aliceTotal).toBeCloseTo(20, 2);
    expect(bobTotal).toBeCloseTo(8, 2);
  });

  test("changing currency reformats totals on Upload and Results", async ({
    page,
  }) => {
    await preloadSession(page, fullyAssignedState(), "upload");
    await page.goto("/");

    await expect(page.getByText("Test Diner")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /^Edit$/ }).click();
    await expect(page.getByText("Edit Receipt Details")).toBeVisible();

    await page.getByLabel("Currency").click();
    const eurOption = page.getByRole("option", { name: /EUR - Euro/ });
    await expect(eurOption).toBeVisible();
    await eurOption.click();
    await page.getByRole("button", { name: /save changes/i }).click();

    await expect(page.getByText(/EUR - Euro/)).toBeVisible();

    await page.getByRole("tab", { name: /results/i }).click();
    const aliceRow = page.getByRole("row").filter({ hasText: "Alice" });
    await expect(aliceRow).toBeVisible();
    await expect(aliceRow.getByRole("cell").last()).toHaveText(/€|EUR/);
  });
});
