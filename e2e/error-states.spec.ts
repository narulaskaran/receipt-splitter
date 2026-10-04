import { test, expect } from "@playwright/test";
import {
  seedSessionViaReload,
  uploadTinyReceipt,
  baseState,
  nextStepButton,
} from "./helpers";

test.describe("error states", () => {
  test("API 500 on receipt upload shows an error toast and clears loading", async ({
    page,
  }) => {
    await page.route("**/api/parse-receipt", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to parse receipt" }),
      }),
    );

    await page.goto("/");
    await expect(page.getByText("Upload a receipt")).toBeVisible({
      timeout: 10000,
    });

    await uploadTinyReceipt(page);

    await expect(page.getByText("Failed to parse receipt").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Parsing receipt...")).toHaveCount(0);
    await expect(page.getByText("Test Diner")).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toBeEnabled();
  });

  test("API timeout clears loading and leaves the dropzone usable", async ({
    page,
  }) => {
    await page.route("**/api/parse-receipt", (route) =>
      route.abort("timedout"),
    );

    await page.goto("/");
    await expect(page.getByText("Upload a receipt")).toBeVisible({
      timeout: 10000,
    });

    await uploadTinyReceipt(page);

    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Parsing receipt...")).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toBeEnabled();
  });

  test("corrupted localStorage recovers to the empty upload screen", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("receiptSplitterSession", "invalid json {");
    });

    await page.goto("/");

    await expect(page.getByText("Upload a receipt")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("tab", { name: /people/i })).toBeDisabled();
    await expect(page.getByRole("tab", { name: /assign/i })).toBeDisabled();
    await expect(page.getByRole("tab", { name: /totals/i })).toBeDisabled();
    // No step footer until a receipt exists
    await expect(
      page.getByRole("navigation", { name: "Step navigation" }),
    ).toHaveCount(0);
  });

  test("offline assignment is preserved after reconnecting", async ({
    page,
    context,
  }) => {
    await seedSessionViaReload(page, baseState(), "assign");

    await expect(
      page.getByRole("button", { name: /split evenly/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("2 of 2 items left")).toBeVisible();

    await context.setOffline(true);

    await page.getByRole("button", { name: /split evenly/i }).click({
      force: true,
    });
    await expect(
      page.getByText("Split remaining items on Test Diner.").first(),
    ).toBeVisible();
    await expect(page.getByText("All items assigned")).toBeVisible();

    await context.setOffline(false);
    await page.reload();

    await expect(page.getByText("All items assigned")).toBeVisible();
    await expect(nextStepButton(page)).toBeEnabled();
  });
});
