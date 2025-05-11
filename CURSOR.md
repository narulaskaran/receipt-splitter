# Receipt Splitter - Cursor Project Guide

This project is a receipt splitting web application built with Next.js, TypeScript, and shadcn/ui components. It allows users to upload a photo of a receipt, parse it using Claude AI, and split expenses among multiple people.

## Project Structure

- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components
- `src/lib/` - Utility functions
- `src/types/` - TypeScript type definitions

## Key Files

- `src/app/page.tsx` - Main application page
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

## Analytics

Vercel Web Analytics is integrated using the `@vercel/analytics` package. The `<Analytics />` component is included in the root layout (`src/app/layout.tsx`) to enable privacy-friendly, cookieless analytics and page view tracking. Analytics data is viewable in the Vercel dashboard under the Analytics tab for the project.

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
