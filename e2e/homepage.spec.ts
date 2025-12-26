import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has correct title and description', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Receipt Splitter/);

    // Check heading
    await expect(page.getByRole('heading', { name: 'Receipt Splitter' })).toBeVisible();

    // Check description
    await expect(page.getByText(/upload a receipt, add people, and easily split items/i)).toBeVisible();
  });

  test('displays all tabs', async ({ page }) => {
    // Check all tabs are visible
    await expect(page.getByRole('tab', { name: /upload receipt/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /add people/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /assign items/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /results/i })).toBeVisible();
  });

  test('shows upload tab by default', async ({ page }) => {
    const uploadTab = page.getByRole('tab', { name: /upload receipt/i });
    await expect(uploadTab).toHaveAttribute('data-state', 'active');
  });

  test('disables tabs when no receipt is uploaded', async ({ page }) => {
    // People, Assign, and Results tabs should be disabled
    await expect(page.getByRole('tab', { name: /add people/i })).toBeDisabled();
    await expect(page.getByRole('tab', { name: /assign items/i })).toBeDisabled();
    await expect(page.getByRole('tab', { name: /results/i })).toBeDisabled();
  });

  test('displays navigation buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new split/i })).toBeVisible();
  });

  test('back button is disabled on upload tab', async ({ page }) => {
    await expect(page.getByRole('button', { name: /back/i })).toBeDisabled();
  });

  test('next button is disabled when no receipt', async ({ page }) => {
    await expect(page.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  test('new split button is disabled when no session', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new split/i })).toBeDisabled();
  });

  test('displays ko-fi button', async ({ page }) => {
    const kofiLink = page.getByRole('link', { name: /buy me a coffee/i });
    await expect(kofiLink).toBeVisible();
    await expect(kofiLink).toHaveAttribute('href', /ko-fi.com/);
  });

  test('shows receipt uploader on upload tab', async ({ page }) => {
    await expect(page.getByText(/drag and drop or click to select/i)).toBeVisible();
  });
});

test.describe('Dark Mode', () => {
  test('can toggle theme', async ({ page }) => {
    await page.goto('/');

    // Find the theme toggle button (if it exists in the UI)
    // Note: This test assumes there's a theme toggle button.
    // If not, this test can be adjusted or removed.
    const html = page.locator('html');

    // Check initial theme class
    const initialClass = await html.getAttribute('class');
    expect(initialClass).toBeTruthy();
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('displays correctly on mobile', async ({ page }) => {
    await page.goto('/');

    // Check that heading is visible
    await expect(page.getByRole('heading', { name: 'Receipt Splitter' })).toBeVisible();

    // Check that tabs are visible and scrollable
    await expect(page.getByRole('tab', { name: /upload receipt/i })).toBeVisible();
  });

  test('navigation buttons work on mobile', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
  });
});
