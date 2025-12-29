import { test, expect, Page } from '@playwright/test';

const MOCK_STATE = {
  state: {
    originalReceipt: {
      id: "receipt-123",
      restaurant: "Screenshot Cafe",
      date: "2025-12-25",
      subtotal: 50.00,
      tax: 5.00,
      tip: 10.00,
      total: 65.00,
      items: [
        { name: "Burger", price: 15.00, quantity: 1 },
        { name: "Fries", price: -5.00, quantity: 1 }, // Negative price error
        { name: "Soda", price: 3.00, quantity: 2 },
        { name: "Salad", price: 12.00, quantity: 1 }
      ]
    },
    people: [
      { id: "p1", name: "Alice", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
      { id: "p2", name: "Bob", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 }
    ],
    // Mismatched assignments: Sum of splits won't match item price for Burger
    assignedItems: [
        [0, [{ personId: "p1", sharePercentage: 50 }]], // Only 50% assigned (Mismatch)
        [1, [{ personId: "p2", sharePercentage: 100 }]],
        [2, [{ personId: "p1", sharePercentage: 100 }]],
        [3, [{ personId: "p2", sharePercentage: 100 }]]
    ],
    unassignedItems: [],
    groups: [],
    isLoading: false,
    error: null,
  },
  activeTab: "results"
};

test('Capture validation screenshots', async ({ page }) => {
  // 1. Set up local storage with the invalid state
  await page.addInitScript((value) => {
    window.localStorage.setItem('receiptSplitterSession', JSON.stringify(value));
  }, MOCK_STATE);

  // 2. Go to the page (it should load directly into the results tab due to activeTab: "results")
  await page.goto('http://localhost:3000');
  
  // Wait for content to load
  await page.waitForSelector('text=Split Validation Issues');

  // --- Screenshot 1: Validation Errors Component (Desktop) ---
  const errorCard = page.locator('.border-yellow-500\/50');
  await errorCard.screenshot({ path: 'screenshots/validation-errors-desktop.png' });

  // --- Screenshot 2: Full Results View (Desktop) ---
  await page.screenshot({ path: 'screenshots/full-results-desktop.png', fullPage: true });

  // --- Screenshot 3: Disabled Share Button / Warning ---
  // We need to scroll to the share button or capture that specific area
  // The share button is in the ResultsSummary component
  const shareSection = page.locator('text=Your Phone Number').locator('..').locator('..');
  // Optional: Click it to trigger toast if possible, but static screenshot of disabled state is good.
  // In the current code, the button isn't disabled via attribute but shows an error on click if invalid.
  // Actually, looking at the code: disabled={!canShareSplit ...} 
  // and canShareSplit checks validationResult.isValid. So it SHOULD be disabled.
  // Let's check if it is disabled.
  const shareButton = page.getByRole('button', { name: 'Share Split' });
  await expect(shareButton).toBeDisabled();
  await shareSection.screenshot({ path: 'screenshots/share-section-disabled.png' });

  // --- Screenshot 4: Dark Mode ---
  // Toggle dark mode. Since I don't see a clear toggle in the snippets, I'll emulate media.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload(); // Reload to ensure theme applies if it's JS based, or just wait.
  // If the app uses 'next-themes' system preference might be enough.
  await page.waitForTimeout(1000); 
  await errorCard.screenshot({ path: 'screenshots/validation-errors-dark.png' });

});

test('Capture mobile screenshots', async ({ page }) => {
  // Set viewport to mobile
  await page.setViewportSize({ width: 375, height: 667 });

  await page.addInitScript((value) => {
    window.localStorage.setItem('receiptSplitterSession', JSON.stringify(value));
  }, MOCK_STATE);

  await page.goto('http://localhost:3000');
  await page.waitForSelector('text=Split Validation Issues');

  // --- Screenshot 5: Validation Errors (Mobile) ---
  const errorCard = page.locator('.border-yellow-500\/50');
  await errorCard.screenshot({ path: 'screenshots/validation-errors-mobile.png' });
});
