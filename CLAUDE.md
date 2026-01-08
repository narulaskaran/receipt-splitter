# CLAUDE.md

This file provides guidance to Claude Code when working with this codebase.

## Project Overview

Receipt Splitter is a Next.js web application for splitting receipts among friends and groups. It uses AI-powered receipt parsing via the Anthropic Claude API and provides flexible item assignment with Venmo payment integration.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui with Radix UI primitives
- **State Management**: React hooks with localStorage persistence
- **Validation**: Zod schemas
- **Testing**: Jest + React Testing Library
- **AI**: Anthropic Claude API for receipt parsing

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/parse-receipt/  # Receipt parsing API endpoint
│   ├── split/              # Split sharing page for recipients
│   ├── page.tsx            # Main application page
│   └── layout.tsx          # Root layout with providers
├── components/             # React components
│   ├── ui/                 # shadcn/ui base components
│   ├── receipt-uploader.tsx    # Drag & drop receipt upload
│   ├── people-manager.tsx      # Add/remove people
│   ├── group-manager.tsx       # Create groups with emoji
│   ├── item-assignment.tsx     # Assign items to people
│   ├── results-summary.tsx     # Final calculations
│   ├── payment-card.tsx        # Individual payment display
│   └── ...
├── lib/                    # Utility functions
│   ├── receipt-utils.ts    # Tax/tip calculations
│   ├── split-sharing.ts    # URL serialization/deserialization
│   ├── venmo-utils.ts      # Payment link generation
│   ├── emoji-utils.ts      # Group emoji management
│   └── utils.ts            # General utilities (cn helper)
├── types/                  # TypeScript type definitions
│   └── index.ts            # Core types: Receipt, Person, Group, etc.
└── test/                   # Test utilities
    └── test-utils.ts       # Shared test helpers
```

## Common Commands

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run lint      # Run ESLint
npm test          # Run Jest tests
npm run test:watch # Run tests in watch mode
```

## Key Types

The core data types are defined in `src/types/index.ts`:

- `Receipt`: Parsed receipt with items, subtotal, tax, tip, total
- `ReceiptItem`: Individual item with name, price, quantity
- `Person`: Person with assigned items and calculated totals
- `Group`: Named group with emoji and member IDs
- `PersonItemAssignment`: Tracks item-to-person assignments with share percentages

## Architecture Patterns

### Path Aliases

Use `@/*` for imports from `src/`:
```typescript
import { Receipt } from '@/types';
import { calculateTotals } from '@/lib/receipt-utils';
```

### Component Patterns

- Components use shadcn/ui primitives from `@/components/ui/`
- State is managed with React hooks and persisted to localStorage
- Forms use react-hook-form with Zod validation
- Toast notifications use the Sonner library

### Testing Patterns

- Test files are co-located with source files (`*.test.tsx`, `*.test.ts`)
- Use `@testing-library/react` for component tests
- Mock external dependencies (localStorage, fetch, etc.)
- Test utilities are in `src/test/test-utils.ts`

## Environment Variables

Required for development:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## Development Guidelines

1. **Money Calculations**: Use `Decimal.js` for all monetary calculations to avoid floating point errors
2. **Type Safety**: Project uses strict TypeScript - ensure all types are properly defined
3. **Testing**: Write tests for new functionality; tests live next to source files
4. **Components**: Prefer composition using existing shadcn/ui components
5. **Styling**: Use Tailwind CSS classes; avoid inline styles
