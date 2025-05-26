# Refactor: Centralize Test Utilities and Mock Data

This PR addresses [issue #20](https://github.com/narulaskaran/receipt-splitter/issues/20) by refactoring the test suite to improve maintainability and reduce duplication:

## Changes

- **Centralized mock data**: Created `src/test/test-utils.ts` to provide common mock `Person`, `Receipt`, and assignment data for all tests.
- **Global test setup**: Added global mocks for `crypto.randomUUID`, `sonner.toast`, and `window.matchMedia` in `setupGlobalMocks` (exported from `test-utils.ts`).
- **Barrel export**: Re-exported common test utilities (e.g., `render`, `screen`) from `@testing-library/react` for convenience.
- **Test file updates**: All test files now import shared mocks and utilities from `src/test/test-utils.ts` instead of duplicating mock data or setup.

## Benefits

- Reduces duplication of mock data and global setup across test files
- Makes tests easier to update and maintain
- Centralizes test setup and mock data for consistency
- Improves readability of the test suite

All tests pass after this refactor.

---

Closes #20
