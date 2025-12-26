# End-to-End Tests

This directory contains end-to-end (E2E) tests for the Receipt Splitter application using [Playwright](https://playwright.dev/).

## Overview

E2E tests verify the application works correctly from a user's perspective by simulating real browser interactions. These tests complement the unit tests by ensuring all components work together properly.

## Test Coverage

### Homepage Tests (`homepage.spec.ts`)

**Basic Functionality:**
- Page title and metadata
- All tabs display correctly
- Upload tab is active by default
- Tabs are properly disabled/enabled based on state
- Navigation buttons (Back, Next, New Split)
- Ko-fi donation button

**Mobile Responsiveness:**
- Mobile viewport rendering
- Navigation on mobile devices

**Theme Support:**
- Dark/light mode functionality

## Running E2E Tests

### Prerequisites

Make sure you have Playwright browsers installed:

```bash
npx playwright install
```

### Run All Tests

```bash
npm run test:e2e
```

### Run Tests with UI

Opens Playwright's interactive UI mode:

```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode

See the browser while tests run:

```bash
npm run test:e2e:headed
```

### View Test Report

After running tests, view the HTML report:

```bash
npm run test:e2e:report
```

## Test Configuration

E2E tests are configured in `playwright.config.ts` with the following features:

- **Multiple Browsers**: Tests run on Chromium, Firefox, and WebKit
- **Mobile Testing**: Tests also run on mobile viewports (Pixel 5, iPhone 12)
- **Auto Server**: Automatically starts the dev server before tests
- **Retries**: Tests retry twice on CI to handle flakiness
- **Screenshots/Videos**: Captured on failure for debugging

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Your test code here
    await expect(page.getByRole('button', { name: /click me/i })).toBeVisible();
  });
});
```

### Best Practices

1. **Use Semantic Selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Wait for Elements**: Use Playwright's auto-waiting or explicit `await expect(...).toBeVisible()`
3. **Descriptive Test Names**: Test names should clearly describe what they verify
4. **Group Related Tests**: Use `test.describe()` to organize tests logically
5. **Test User Workflows**: Focus on complete user journeys, not individual functions

### Example: Testing a User Flow

```typescript
test('complete receipt splitting workflow', async ({ page }) => {
  await page.goto('/');

  // Upload receipt
  await page.setInputFiles('input[type="file"]', './test-fixtures/receipt.jpg');
  await expect(page.getByText(/receipt successfully parsed/i)).toBeVisible();

  // Add people
  await page.getByRole('tab', { name: /add people/i }).click();
  await page.getByPlaceholder(/add a person/i).fill('Alice');
  await page.getByRole('button', { name: /add person/i }).click();

  // Continue with more steps...
});
```

## Debugging Tests

### Debug a Specific Test

```bash
npx playwright test --debug homepage.spec.ts
```

### Trace Viewer

Playwright automatically captures traces on first retry. View them with:

```bash
npx playwright show-trace path/to/trace.zip
```

### Screenshots

Failed tests automatically capture screenshots in `test-results/`.

## CI Integration

E2E tests are configured to run in CI with:
- Automatic retries (2x) for flaky tests
- Serial execution to avoid port conflicts
- Automatic browser installation
- HTML report artifacts

## Test Fixtures

Store test data (sample receipts, images, etc.) in `e2e/fixtures/` for use in tests.

## Limitations

- **API Mocking**: Currently tests use real API calls. Consider mocking the Anthropic API for faster, more reliable tests.
- **File Upload**: File upload tests require actual image files or can be skipped in CI.
- **Session State**: Tests start fresh each time. Consider adding tests that restore from localStorage.

## Future Improvements

- Add tests for receipt parsing workflow (currently requires real API key)
- Add tests for split sharing URLs
- Add tests for Venmo payment link generation
- Add visual regression testing
- Add performance testing with Playwright's metrics
- Add accessibility testing with axe-core integration
