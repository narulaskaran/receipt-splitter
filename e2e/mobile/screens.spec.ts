import { expect, test, type Page } from "@playwright/test";
import {
  auditScreen,
  assertAxe,
  assertFocusInDialog,
  assertInputFontSize,
  assertNoPageOverflow,
  assertNoWideElements,
  assertTabLabels,
  assertTotalColumnVisible,
  assertTouchTargets,
  screenshot,
} from "./audit";
import { baseState, fullyAssignedState, TINY_PNG } from "../helpers";

const VIEWPORTS = [
  { name: "iphone-14", width: 390, height: 844 },
  { name: "iphone-17", width: 402, height: 874 },
  { name: "iphone-17-pro-max", width: 440, height: 956 },
  { name: "iphone-se", width: 375, height: 667 },
] as const;

const SCHEMES = ["light", "dark"] as const;

const SPLIT_WITH_PHONE =
  "/#/split?names=Alice,Bob&amounts=10.00,10.00&total=20.00&note=Test%20Diner&phone=5551234567";
const SPLIT_NO_PHONE =
  "/#/split?names=Alice,Bob&amounts=10.00,10.00&total=20.00&note=Test%20Diner";

function receipt(restaurant: string, item: string) {
  return {
    restaurant,
    date: "2024-01-15",
    subtotal: 10,
    tax: 0,
    tip: 0,
    total: 10,
    currency: "USD",
    items: [{ name: item, price: 10, quantity: 1 }],
  };
}

function multiReceiptState() {
  return {
    receipts: [
      { id: "r1", receipt: receipt("Cafe", "Latte") },
      { id: "r2", receipt: receipt("Diner", "Burger") },
    ],
    people: [
      {
        id: "p1",
        name: "Alice",
        items: [
          {
            itemId: 0,
            itemName: "Latte",
            originalPrice: 10,
            quantity: 1,
            sharePercentage: 100,
            amount: 10,
            receiptId: "r1",
            receiptName: "Cafe",
          },
        ],
        totalBeforeTax: 10,
        tax: 0,
        tip: 0,
        finalTotal: 10,
      },
      {
        id: "p2",
        name: "Bob",
        items: [
          {
            itemId: 0,
            itemName: "Burger",
            originalPrice: 10,
            quantity: 1,
            sharePercentage: 100,
            amount: 10,
            receiptId: "r2",
            receiptName: "Diner",
          },
        ],
        totalBeforeTax: 10,
        tax: 0,
        tip: 0,
        finalTotal: 10,
      },
    ],
    groups: [] as unknown[],
    assignedItems: [
      ["r1", [[0, [{ personId: "p1", sharePercentage: 100 }]]]],
      ["r2", [[0, [{ personId: "p2", sharePercentage: 100 }]]]],
    ],
    isLoading: false,
    error: null,
  };
}

function peopleState() {
  return {
    ...baseState(),
    groups: [
      { id: "g1", name: "Friends", emoji: "🍕", memberIds: ["p1", "p2"] },
    ],
  };
}

async function applyTheme(page: Page, scheme: (typeof SCHEMES)[number]) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript((theme) => {
    localStorage.setItem("theme", theme);
  }, scheme);
}

async function openHome(
  page: Page,
  scheme: (typeof SCHEMES)[number],
  state: object | null,
  tab = "upload",
) {
  await applyTheme(page, scheme);
  await page.addInitScript(
    ({ sessionState, activeTab, consent }) => {
      if (sessionState) {
        localStorage.setItem(
          "receiptSplitterSession",
          JSON.stringify({ state: sessionState, activeTab }),
        );
      } else {
        localStorage.removeItem("receiptSplitterSession");
      }
      if (consent) {
        localStorage.setItem(
          "receiptSplitterAiConsent",
          JSON.stringify({ version: 1 }),
        );
      } else {
        localStorage.removeItem("receiptSplitterAiConsent");
      }
    },
    { sessionState: state, activeTab: tab, consent: true },
  );
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "Receipt Splitter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Support" })).toBeVisible();
}

async function openSplit(page: Page, scheme: (typeof SCHEMES)[number], hashPath: string) {
  await applyTheme(page, scheme);
  await page.goto(hashPath);
  await expect(page.getByRole("heading", { name: "Test Diner" })).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    test(`${viewport.name} ${scheme} upload empty`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openHome(page, scheme, null);
      const shot = `${viewport.name}-${scheme}`;
      await auditScreen(page, `${shot}-upload-empty`, { tabs: true });

      await page.getByRole("button", { name: "Paste receipt link" }).click();
      await expect(page.getByRole("textbox", { name: "Receipt link" })).toBeVisible();
      await auditScreen(page, `${shot}-upload-link`);
    });

    test(`${viewport.name} ${scheme} upload with receipt`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openHome(page, scheme, baseState(), "upload");
      const shot = `${viewport.name}-${scheme}`;
      await auditScreen(page, `${shot}-upload-receipt`, { tabs: true });
      await page.getByRole("button", { name: /^Test Diner/ }).click();
      await page.getByRole("button", { name: "Edit" }).click();
      await assertFocusInDialog(page);
      await auditScreen(page, `${shot}-edit-receipt`);
    });

    test(`${viewport.name} ${scheme} people`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openHome(page, scheme, peopleState(), "people");
      const shot = `${viewport.name}-${scheme}`;
      await auditScreen(page, `${shot}-people`, { tabs: true });
      await page.getByRole("button", { name: "Create Group" }).click();
      await assertFocusInDialog(page);
      await auditScreen(page, `${shot}-create-group`);
    });

    test(`${viewport.name} ${scheme} assign`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openHome(page, scheme, fullyAssignedState(), "assign");
      const shot = `${viewport.name}-${scheme}`;
      await auditScreen(page, `${shot}-assign`, { tabs: true });
      await page.getByRole("button", { name: "Edit split for Burger" }).click();
      await assertFocusInDialog(page);
      await auditScreen(page, `${shot}-edit-split`);
    });

    test(`${viewport.name} ${scheme} results`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openHome(page, scheme, fullyAssignedState(), "results");
      await expect(page.getByRole("columnheader", { name: "Total" }).first()).toBeVisible();
      await auditScreen(page, `${viewport.name}-${scheme}-results`, {
        tabs: true,
        totals: true,
      });
    });

    test(`${viewport.name} ${scheme} results multi`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openHome(page, scheme, multiReceiptState(), "results");
      await expect(page.getByRole("heading", { name: "Day total" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "By receipt" })).toBeVisible();
      await auditScreen(page, `${viewport.name}-${scheme}-results-multi`, {
        tabs: true,
        totals: true,
      });
    });

    test(`${viewport.name} ${scheme} split with Venmo`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openSplit(page, scheme, SPLIT_WITH_PHONE);
      await expect(page.getByRole("link", { name: /Pay/ }).first()).toBeVisible();
      await auditScreen(page, `${viewport.name}-${scheme}-split-venmo`);
    });

    test(`${viewport.name} ${scheme} split without Venmo`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openSplit(page, scheme, SPLIT_NO_PHONE);
      await expect(page.getByText("Payment details weren't included")).toBeVisible();
      await expect(page.getByRole("link", { name: /Pay/ })).toHaveCount(0);
      await auditScreen(page, `${viewport.name}-${scheme}-split-plain`);
    });
  }
}

test("consent dialog keeps focus and passes axe", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await applyTheme(page, "light");
  await page.addInitScript(() => {
    localStorage.removeItem("receiptSplitterAiConsent");
    localStorage.removeItem("receiptSplitterSession");
  });
  await page.goto("/#/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  await expect(page.getByRole("heading", { name: "Send this receipt to be read?" })).toBeVisible();
  await assertFocusInDialog(page);
  await auditScreen(page, "iphone-17-light-consent");
});

test("document language, title, and meta are set", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await applyTheme(page, "light");
  await page.goto("/#/");
  await expect(page).toHaveTitle("Receipt Splitter");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /width=device-width.*viewport-fit=cover/,
  );
  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description && description.length > 10).toBe(true);
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
    "content",
    /light dark/,
  );
});

test("safe-area insets pad fixed chrome", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await applyTheme(page, "light");
  await page.goto("/#/");
  const css = await page.evaluate(() => {
    const chunks: string[] = [];
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of rules) chunks.push(rule.cssText);
    }
    return chunks.join("\n");
  });
  for (const token of [
    "env(safe-area-inset-top)",
    "env(safe-area-inset-right)",
    "env(safe-area-inset-bottom)",
    "env(safe-area-inset-left)",
  ]) {
    expect(css, token).toContain(token);
  }
  expect(css).toContain('[data-slot="dialog-content"]');
  expect(css).toContain("[data-sonner-toaster]");
  expect(css).toContain('[data-slot="sheet-content"]');
});

test("reduced motion shortens transitions", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("theme", "light");
  });
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "Receipt Splitter" })).toBeVisible();
  const duration = await page.getByRole("button", { name: "New Split" }).evaluate((el) => {
    return getComputedStyle(el).transitionDuration;
  });
  const longestMs = Math.max(
    ...duration.split(",").map((part) => {
      const value = part.trim();
      const amount = Number.parseFloat(value);
      if (value.endsWith("ms")) return amount;
      if (value.endsWith("s")) return amount * 1000;
      return amount;
    }),
  );
  expect(longestMs).toBeLessThanOrEqual(0.02);
});

test("large text does not clip key screens", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openHome(page, "light", fullyAssignedState(), "results");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await assertNoPageOverflow(page);
  await assertNoWideElements(page);
  await assertTabLabels(page);
  await assertTotalColumnVisible(page);
  await assertTouchTargets(page);
  await assertInputFontSize(page);
  await screenshot(page, "iphone-se-light-results-200");

  await page.goto(SPLIT_WITH_PHONE);
  await expect(page.getByRole("heading", { name: "Test Diner" })).toBeVisible();
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await assertNoPageOverflow(page);
  await assertNoWideElements(page);
  await assertTouchTargets(page);
  await screenshot(page, "iphone-se-light-split-200");
});

test("native tip sheet lists products", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.emulateMedia({ colorScheme: "light" });
  const session = JSON.stringify({
    state: fullyAssignedState(),
    activeTab: "results",
  });
  await page.addInitScript((serialized) => {
    const host = window as Window & {
      webkit?: { messageHandlers: { bridge: { postMessage: () => void } } };
      Capacitor?: {
        PluginHeaders: unknown[];
        nativePromise: (pluginName: string, methodName: string) => Promise<unknown>;
        nativeCallback: () => Promise<string>;
      };
    };
    host.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
    host.Capacitor = {
      PluginHeaders: [
        {
          name: "TipJar",
          methods: [
            { name: "getProducts", rtype: "promise" },
            { name: "purchase", rtype: "promise" },
          ],
        },
      ],
      nativePromise(pluginName: string, methodName: string) {
        if (pluginName === "TipJar" && methodName === "getProducts") {
          return Promise.resolve({
            products: [
              {
                id: "app.receiptsplitter.ios.tip.small",
                displayName: "Small tip",
                displayPrice: "$1.99",
              },
              {
                id: "app.receiptsplitter.ios.tip.medium",
                displayName: "Medium tip",
                displayPrice: "$4.99",
              },
              {
                id: "app.receiptsplitter.ios.tip.large",
                displayName: "Large tip",
                displayPrice: "$9.99",
              },
            ],
          });
        }
        return Promise.resolve({ status: "success" });
      },
      nativeCallback() {
        return Promise.resolve("cb");
      },
    };
    localStorage.setItem("theme", "light");
    localStorage.setItem("receiptSplitterAiConsent", JSON.stringify({ version: 1 }));
    localStorage.setItem("receiptSplitterSession", serialized);
  }, session);

  await page.goto("/#/");
  await expect(page.getByRole("button", { name: "Leave a tip" })).toBeVisible();
  await page.getByRole("button", { name: "Leave a tip" }).click();
  await expect(page.getByRole("heading", { name: "Leave a tip" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Small tip/ })).toBeVisible();
  await assertFocusInDialog(page);
  await auditScreen(page, "iphone-17-light-tip-sheet");
});

test("dark scheme keeps muted text contrasted on results", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await openHome(page, "dark", fullyAssignedState(), "results");
  await assertAxe(page);
});
