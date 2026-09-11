import { test, expect } from "@playwright/test";
import path from "path";

const SAMPLE_RECEIPT = path.join(__dirname, "fixtures", "sample-receipt.png");

const PARSED_RECEIPT = {
  restaurant: "Cafe Mocha",
  date: "2024-01-15",
  subtotal: 10,
  tax: 1,
  tip: 2,
  total: 13,
  currency: "USD",
  items: [
    { name: "Latte", price: 5, quantity: 1 },
    { name: "Muffin", price: 5, quantity: 1 },
  ],
};

test.describe("upload another receipt affordance", () => {
  test("empty dropzone is large; after parse it shrinks and the image moves to details", async ({
    page,
  }) => {
    await page.route("**/api/parse-receipt", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PARSED_RECEIPT),
      }),
    );

    await page.goto("/");
    await expect(page.getByText("Upload your receipts")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText("Click or drag to add another receipt"),
    ).toHaveCount(0);

    await page.locator('input[type="file"]').setInputFiles(SAMPLE_RECEIPT);

    await expect(
      page.getByText("Click or drag to add another receipt"),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Upload your receipts")).toHaveCount(0);
    await expect(page.getByText("Receipts (1/10)")).toBeVisible();
    await expect(page.getByText("Cafe Mocha").first()).toBeVisible();

    // The large preview lives in the details card, not the dropzone.
    const detailsImage = page.getByAltText("Cafe Mocha receipt image");
    await expect(detailsImage).toBeVisible();
    await expect(detailsImage).toHaveAttribute("src", /^data:image\//);

    const dropzone = page.getByRole("presentation");
    await expect(dropzone.getByAltText("Cafe Mocha receipt image")).toHaveCount(
      0,
    );
    await expect(dropzone.getByAltText("Receipt preview")).toHaveCount(0);
  });
});
