import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildMockSession } = require("../scripts/screenshot-fixtures.js") as {
  buildMockSession: (
    activeTab?: string,
    options?: { multiReceipt?: boolean },
  ) => Record<string, unknown>;
};

async function seedHarnessSession(
  page: Page,
  session: Record<string, unknown>,
) {
  await page.addInitScript((data) => {
    window.localStorage.setItem(
      "receiptSplitterSession",
      JSON.stringify(data),
    );
  }, session);
}

test.describe("screenshot harness fixtures on Results", () => {
  test("single-receipt mock has no item/subtotal validation banner", async ({
    page,
  }) => {
    await seedHarnessSession(page, buildMockSession("results"));
    await page.goto("/");

    await expect(page.getByText("Alice").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Split Validation Issues")).toHaveCount(0);
    await expect(
      page.getByText("Sum of item prices does not match subtotal"),
    ).toHaveCount(0);
  });

  test("Coffee + Lunch mock has no item/subtotal validation banner", async ({
    page,
  }) => {
    await seedHarnessSession(
      page,
      buildMockSession("results", { multiReceipt: true }),
    );
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Day total" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "By receipt" })).toBeVisible();
    await expect(page.getByText("Lunch").first()).toBeVisible();
    await expect(page.getByText("Coffee").first()).toBeVisible();
    await expect(page.getByText("Split Validation Issues")).toHaveCount(0);
    await expect(
      page.getByText("Sum of item prices does not match subtotal"),
    ).toHaveCount(0);
    await expect(page.getByText("Off by $2.00")).toHaveCount(0);
  });
});
