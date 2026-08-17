import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

function harnessSession(activeTab: string, multiReceipt = false) {
  const output = execFileSync(
    "node",
    [
      "-e",
      `const { buildMockSession } = require("./scripts/screenshot-fixtures"); console.log(JSON.stringify(buildMockSession(${JSON.stringify(activeTab)}, ${JSON.stringify({ multiReceipt })})));`,
    ],
    { encoding: "utf8", cwd: process.cwd() },
  );
  return JSON.parse(output) as Record<string, unknown>;
}

async function seedHarnessSession(page: Page, session: Record<string, unknown>) {
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
    await seedHarnessSession(page, harnessSession("results"));
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
    await seedHarnessSession(page, harnessSession("results", true));
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
