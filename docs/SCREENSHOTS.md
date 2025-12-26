# Required Screenshots for PR #64

The following screenshots are required to document the visual changes introduced in PR #64 (Validation Error UI).
Please verify that these screenshots are attached to the Pull Request description before merging.

## 1. Validation Errors Component
**Target:** `src/components/validation-errors.tsx`

*   [ ] **Validation Errors Displayed**: Show the component with sample errors (both mismatch and negative value types).
    *   *How to trigger:* Create a receipt where items do not sum to subtotal, or manually adjust amounts to be inconsistent.
*   [ ] **Mobile View**: Show the component on a mobile viewport (responsive design).
*   [ ] **Dark Mode**: Show the yellow/orange warning theme in dark mode.

## 2. Enhanced Share Button
**Target:** `src/components/results-summary.tsx`

*   [ ] **Disabled Share Button**: Show the "Share Split" button in a disabled state (or with error indication) when validation errors exist.
*   [ ] **Error Toast/Notification**: Capture the toast message that appears when attempting to share an invalid split.

## 3. Integration in Results Tab
**Target:** `src/components/results-summary.tsx` / `src/app/page.tsx`

*   [ ] **Full Results View**: Show the "Results" tab with the ValidationErrors component appearing above the ResultsSummary.

---

### How to Capture
1.  Run the application locally: `npm run dev`
2.  Navigate to the app (usually `http://localhost:3000`).
3.  Upload a receipt or create one manually.
4.  Intentionally introduce errors:
    *   **Mismatch**: Edit item prices so they don't sum to the subtotal.
    *   **Negative**: Enter a negative price or quantity.
5.  Navigate to the "Results" tab.
6.  Take screenshots of the alert banner and error details.
7.  Try to click "Share Split" to trigger the toast notification.
