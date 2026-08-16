import { test, expect, type Page } from "@playwright/test";
import { preloadSession, fullyAssignedState } from "./helpers";

declare global {
  interface Window {
    __copiedTexts?: string[];
  }
}

async function disableNativeShare(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });
}

async function stubClipboardCapture(page: Page) {
  await page.addInitScript(() => {
    window.__copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          window.__copiedTexts = window.__copiedTexts || [];
          window.__copiedTexts.push(text);
        },
      },
    });
  });
}

async function stubClipboardDenied(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
}

async function stubClipboardMissing(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
}

async function openShareReadyResults(page: Page) {
  await preloadSession(page, fullyAssignedState(), "results");
  await page.goto("/");
  await expect(page.getByRole("cell", { name: "Alice" })).toBeVisible();
  await page.locator("#venmo-phone").fill("5551234567");
}

test.describe("Share Split clipboard", () => {
  test("copies a share URL and shows Copied! when clipboard write succeeds", async ({
    page,
  }) => {
    await disableNativeShare(page);
    await stubClipboardCapture(page);
    await openShareReadyResults(page);

    const shareBtn = page.getByRole("button", { name: "Share Split" });
    await expect(shareBtn).toBeEnabled();
    await shareBtn.click();

    await expect(page.getByText("Copied!")).toBeVisible();

    const copied = await page.evaluate(() => window.__copiedTexts || []);
    expect(copied.length).toBeGreaterThan(0);
    expect(copied[0]).toContain("/split?");
    expect(copied[0]).toContain("names=");
    expect(copied[0]).toContain("amounts=");
  });

  test("shows an error toast when clipboard write is denied", async ({
    page,
  }) => {
    await disableNativeShare(page);
    await stubClipboardDenied(page);
    await openShareReadyResults(page);

    await page.getByRole("button", { name: "Share Split" }).click();

    await expect(
      page.getByText("Failed to copy share link. Please try again."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share Split" }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "Alice" })).toBeVisible();
  });

  test("shows the same fallback when the Clipboard API is missing", async ({
    page,
  }) => {
    await disableNativeShare(page);
    await stubClipboardMissing(page);
    await openShareReadyResults(page);

    await page.getByRole("button", { name: "Share Split" }).click();

    await expect(
      page.getByText("Failed to copy share link. Please try again."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share Split" }),
    ).toBeVisible();
  });
});
