import { test, expect } from '@playwright/test';

const MOCK_STATE = {
  state: {
    originalReceipt: {
      id: "receipt-123",
      restaurant: "Touch Target Cafe",
      date: "2026-01-08",
      subtotal: 50.00,
      tax: 5.00,
      tip: 10.00,
      total: 65.00,
      items: [
        { name: "Burger", price: 15.00, quantity: 1 },
        { name: "Fries", price: 5.00, quantity: 1 },
        { name: "Soda", price: 3.00, quantity: 2 },
        { name: "Salad", price: 12.00, quantity: 1 }
      ]
    },
    people: [
      { id: "p1", name: "Alice", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
      { id: "p2", name: "Bob", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 }
    ],
    assignedItems: [
      [0, [{ personId: "p1", sharePercentage: 100 }]],
      [1, [{ personId: "p2", sharePercentage: 100 }]],
      [2, [{ personId: "p1", sharePercentage: 100 }]],
      [3, [{ personId: "p2", sharePercentage: 100 }]]
    ],
    unassignedItems: [],
    groups: [],
    isLoading: false,
    error: null,
  },
  activeTab: "upload"
};

// Mobile device configurations from the issue
const mobileDevices = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'small-android', width: 360, height: 640 },
  { name: 'iphone-12', width: 390, height: 844 },
  { name: 'galaxy-s20', width: 412, height: 915 },
];

test.describe('Touch Target Accessibility Screenshots', () => {
  for (const device of mobileDevices) {
    test(`Capture ${device.name} screenshots with improved touch targets`, async ({ page }) => {
      // Set viewport to mobile
      await page.setViewportSize({ width: device.width, height: device.height });

      // Set up local storage with sample data
      await page.addInitScript((value) => {
        window.localStorage.setItem('receiptSplitterSession', JSON.stringify(value));
      }, MOCK_STATE);

      // Navigate to the app
      await page.goto('http://localhost:3000');

      // Wait for content to load
      await page.waitForTimeout(1000);

      // Screenshot 1: Initial tab view (Upload Receipt tab with tab navigation)
      await page.screenshot({
        path: `screenshots-touch-targets/${device.name}-00-initial.png`,
        fullPage: false
      });

      // Screenshot 2: Tab navigation buttons close-up
      const tabsList = page.locator('[role="tablist"]');
      await tabsList.screenshot({
        path: `screenshots-touch-targets/${device.name}-01-tabs-close-up.png`
      });

      // Navigate to "Add People" tab
      await page.click('button:has-text("Add People")');
      await page.waitForTimeout(500);

      // Screenshot 3: Add People tab with buttons
      await page.screenshot({
        path: `screenshots-touch-targets/${device.name}-02-people-tab.png`,
        fullPage: false
      });

      // Add some people
      const input = page.locator('input[placeholder="Add a person"]');
      await input.fill('Charlie');
      await page.click('button[title="Add person"]');
      await page.waitForTimeout(300);

      await input.fill('Diana');
      await page.click('button[title="Add person"]');
      await page.waitForTimeout(300);

      // Navigate to "Assign Items" tab
      await page.click('button:has-text("Assign Items")');
      await page.waitForTimeout(500);

      // Screenshot 4: Assign Items tab
      await page.screenshot({
        path: `screenshots-touch-targets/${device.name}-03-assign-tab.png`,
        fullPage: false
      });

      // Navigate to "Results" tab
      await page.click('button:has-text("Results")');
      await page.waitForTimeout(500);

      // Screenshot 5: Results tab with Share buttons
      await page.screenshot({
        path: `screenshots-touch-targets/${device.name}-04-results-tab.png`,
        fullPage: false
      });

      // Screenshot 6: Full page screenshot
      await page.screenshot({
        path: `screenshots-touch-targets/${device.name}-99-full-page.png`,
        fullPage: true
      });
    });
  }
});

test('Capture desktop screenshot showing touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.addInitScript((value) => {
    window.localStorage.setItem('receiptSplitterSession', JSON.stringify(value));
  }, MOCK_STATE);

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);

  // Desktop screenshot showing all tabs
  await page.screenshot({
    path: 'screenshots-touch-targets/desktop-tabs-and-buttons.png',
    fullPage: true
  });
});
