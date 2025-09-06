import { test, expect } from '@playwright/test';

const query = 'names=I%2CK%2Cp%2Cs&amounts=15.25%2C21.75%2C15.25%2C15.25&total=67.52&note=Love+Mama&phone=4259749530&date=2025-09-05';

test('split page renders for provided query params and shows totals', async ({ page, baseURL }) => {
  await page.goto(`/split?${query}`);

  // Should not show the error heading
  await expect(page.getByText('Unable to Load Split')).toHaveCount(0);

  // Should render title and total
  await expect(page.getByText('Receipt Split')).toBeVisible();
  await expect(page.getByText('Total Bill')).toBeVisible();
  await expect(page.getByText('$67.52')).toBeVisible();

  // Should list names
  for (const name of ['I', 'K', 'p', 's']) {
    await expect(page.getByText(name)).toBeVisible();
  }
});

