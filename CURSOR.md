# Receipt Splitter - Cursor Project Guide

This project is a receipt splitting web application built with Next.js, TypeScript, and shadcn/ui components. It allows users to upload a photo of a receipt, parse it using Claude AI, and split expenses among multiple people.

## Project Structure

- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components
- `src/lib/` - Utility functions
- `src/types/` - TypeScript type definitions

## Key Files

- `src/app/page.tsx` - Main application page
  - Implements session caching in localStorage. The receipt split state and current tab are saved to localStorage on any change, and restored on page load. A 'New Split' button is shown next to the heading, which clears the session and resets the app. The button is only enabled if session data exists.
- `src/app/api/parse-receipt/route.ts` - Anthropic API integration for receipt parsing
- `src/components/receipt-uploader.tsx` - Receipt image upload component
- `src/components/item-assignment.tsx` - UI for assigning items to people
- `src/components/people-manager.tsx` - UI for managing people in the split
- `src/components/person-items.tsx` - UI for displaying items assigned to a person
- `src/components/receipt-details.tsx` - UI for displaying receipt information
- `src/components/results-summary.tsx` - UI for displaying the final split results
- `src/components/theme-provider.tsx` - Theme management for light/dark mode
- `src/components/kofi-button.tsx` - Ko-fi integration for donations
- `src/lib/receipt-utils.ts` - Utility functions for receipt calculations
- `src/lib/utils.ts` - General utility functions

## Environment Setup

The application requires an Anthropic API key to function. Add this to your `.env.local` file:

```
ANTHROPIC_API_KEY=your_api_key_here
```

## Core Functionality

1. **Receipt Parsing**

   - Upload receipt images
   - Parse receipt items, totals, and metadata using Claude API

2. **People Management**

   - Add and remove people
   - Track individual expenses

3. **Item Assignment**

   - Assign items to specific people
   - Split items proportionally among multiple people

4. **Expense Calculation**

   - Calculate tax and tip proportionally
   - Compute final amounts owed by each person

5. **Session & Image Persistence**

   - The app automatically saves the current session (receipt, people, assignments, and tab) to localStorage. If the user navigates away or reloads, the session is restored. The 'New Split' button allows clearing the session and starting over. The button is disabled if there is no session data.
   - The uploaded receipt image is also saved in localStorage as a Base64 string under the key `receiptSplitterImage`. The image preview is restored on mount in the uploader. When 'New Split' is clicked, a parent-managed `resetImageTrigger` prop is incremented and passed to the uploader, which clears the preview and removes the image from localStorage only when the trigger changes (not on initial mount). This ensures correct restoration and clearing of the image preview in all flows.

## Analytics

Vercel Web Analytics is integrated using the `@vercel/analytics` package. The `<Analytics />` component is included in the root layout (`src/app/layout.tsx`) to enable privacy-friendly, cookieless analytics and page view tracking. Analytics data is viewable in the Vercel dashboard under the Analytics tab for the project.

**Vercel SpeedInsights** is also integrated using the `@vercel/speed-insights` package. The `<SpeedInsights />` component is included in the root layout (`src/app/layout.tsx`) after `<Analytics />` to provide real user performance metrics. SpeedInsights data is available in the Vercel dashboard under the Speed Insights tab for the project.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server

## Technology Stack

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Anthropic Claude API
- Vercel Deployment

## Deployment

The application is configured for automatic deployment on Vercel. Any code pushed to the main branch will be automatically deployed.

Environment variables need to be configured in the Vercel dashboard.

## Continuous Integration

A GitHub Actions workflow is set up in `.github/workflows/ci.yml` to run on every push and pull request to `main`, `add/*`, `ci/*`, and `feature/*` branches. The workflow performs the following steps:

- Checks out the code
- Sets up Node.js 20 with npm caching
- Installs dependencies with `npm ci`
- Runs lint checks (`npm run lint`)
- Builds the project (`npm run build`)
- Runs tests (`npm test`)

This ensures code quality and build integrity for all contributions.

## Test Utilities and Mock Data

- `src/test/test-utils.ts` - Centralized test utilities and mock data for tests. Provides common mock Person, Receipt, and assignment data, as well as global mocks for crypto.randomUUID, sonner.toast, and window.matchMedia. All test files now import from this file to reduce duplication and improve maintainability.
