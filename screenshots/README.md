# PR Screenshots Directory

This directory contains visual screenshots for PRs with UI changes.

## Current Screenshots Needed:

### PR #27 - Split Page Route
- `split-page-loading-mobile.png` - Loading state on mobile
- `split-page-success-mobile.png` - Success state with full data on mobile  
- `split-page-error-mobile.png` - Error state on mobile
- `split-page-success-desktop.png` - Success state on desktop
- `split-page-minimal-desktop.png` - Minimal data (no date) on desktop

### PR #28 - SplitSummary Component  
- `split-summary-component.png` - Component in isolation
- `split-summary-responsive.png` - Mobile vs desktop comparison

### PR #29 - Payment Cards
- `payment-cards-list.png` - Multiple payment cards
- `payment-card-single.png` - Individual card detail

## How to Generate Screenshots

1. Start dev server: `npm run dev`
2. Navigate to test URLs in browser
3. Take screenshots manually or run: `node capture_screenshots.js`
4. Add images to this directory
5. Reference in PR descriptions like: `![Description](screenshots/filename.png)`