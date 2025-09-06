## Fix: Split validation fails for valid shared links with rounding differences

### Summary
This PR fixes an issue where the `/split` route rejected some valid shared links with a validation error: "Unable to Load Split". The root cause was an overly strict total-vs-sum validation tolerance of exactly $0.01. When multiple participants are involved, per-person rounding can accumulate beyond one cent, causing false negatives.

### Root Cause
- Validation allowed only a flat 0.01 tolerance (`AMOUNT_TOLERANCE`).
- Example failing URL (now passes):
  - `names=I,K,p,s`
  - `amounts=15.25,21.75,15.25,15.25` (sum = 67.50)
  - `total=67.52` (difference = 0.02)
  - Difference came from cumulative rounding across participants.

### What Changed
- Implemented dynamic tolerance: up to 1 cent per person.
  - `dynamicTolerance = max(0.01, peopleCount * 0.01)`
  - This accounts for compounding rounding differences while keeping strict bounds.
- Improved validation error message to include the allowed tolerance.

#### Files
- `src/lib/split-sharing.ts`
  - Use dynamic tolerance in `validateSplitDataDetailed`.
  - Clarified comments for tolerance config.
- `src/lib/split-sharing.test.ts`
  - Added tests for the provided URL and for tolerance boundaries.
- `e2e/split-route.spec.ts` and `playwright.config.ts`
  - Basic E2E test that loads the split page with the provided query and asserts the page renders without the error and shows the expected total.

### Tests
- Unit tests: 133 passing (suite total), including new cases:
  - Allows provided URL (difference 0.02 with 4 people → tolerance 0.04).
  - Rejects when difference exceeds per-person tolerance (e.g., 0.06 with 5 people → tolerance 0.05).
- Lint passes. Production build succeeds.

### Manual Verification
- Ran the dev server and confirmed the route responds and hydrates locally. The E2E test is included; it can be run in CI or a dev machine with Playwright browsers installed.

### Follow-ups / Refactors
- Consider extracting the dynamic tolerance calculation into a small helper in `src/lib/utils.ts` if we reuse it elsewhere.
- If CI environment lacks Playwright system dependencies, run `npx playwright install --with-deps` in CI, or skip the E2E project there.

### Screenshots
N/A

