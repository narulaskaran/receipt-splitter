import { expect, test } from "@playwright/test";

test.describe("legal pages", () => {
  test("privacy policy states what is processed and how to ask for deletion", async ({
    page,
  }) => {
    await page.goto("/privacy");

    await expect(
      page.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What we process" }),
    ).toBeVisible();
    await expect(page.getByText(/older than 90 days/)).toBeVisible();
    await expect(page.getByText(/third-party service providers/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "support page" }),
    ).toHaveAttribute("href", "/support");
  });

  test("support gives a contact and opens the privacy policy", async ({
    page,
  }) => {
    await page.goto("/support");

    await expect(
      page.getByRole("heading", { level: 1, name: "Support" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();

    await page.getByRole("link", { name: "privacy policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeVisible();
  });
});
