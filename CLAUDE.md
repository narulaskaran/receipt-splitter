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
│   ├── api/
│   │   ├── parse-receipt/  # Receipt parsing API endpoint
│   │   └── cron/
│   │       └── cleanup-old-receipts/  # Daily file cleanup cron job
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
│   ├── uploadthing-storage.ts  # UploadThing file upload/delete/list
│   ├── webhook-notifications.ts # Slack/JSON webhook notifications
│   └── utils.ts            # General utilities (cn helper)
├── types/                  # TypeScript type definitions
│   └── index.ts            # Core types: Receipt, Person, Group, etc.
└── test/                   # Test utilities
    └── test-utils.ts       # Shared test helpers
```

## Common Commands

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run lint          # Run ESLint
npm test              # Run Jest tests
npm run test:watch    # Run tests in watch mode
npm run screenshots   # Take screenshots at multiple viewports
```

### Screenshot Harness

The project includes a Playwright-based screenshot tool for visual testing and documentation:

```bash
# Basic usage (requires dev server running: npm run dev)
npm run screenshots -- --mock-data

# Screenshot all tabs (upload, people, assign, results)
npm run screenshots -- --mock-data --tab all

# Screenshot specific tab
npm run screenshots -- --mock-data --tab people

# Screenshot /split route
npm run screenshots -- --route /split --mock-data

# Custom output directory
npm run screenshots -- --mock-data --output ./my-screenshots
```

Options:
- `--route <path>`: Route to screenshot (default: `/`)
- `--tab <name>`: Which tab to show: `upload`, `people`, `assign`, `results`, or `all` (default: `results`)
- `--mock-data`: Inject synthetic localStorage data
- `--params <query>`: URL query parameters
- `--output <dir>`: Output directory (default: `screenshots`)

Screenshots are saved in the `/screenshots` directory (gitignored) and include 7 viewport sizes from mobile to desktop.

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
- Playwright configuration in `playwright.config.ts` for e2e tests
- Screenshot harness in `scripts/screenshot-harness.js` for visual testing

## Environment Variables

Required:
```
ANTHROPIC_API_KEY=your_api_key_here
```

Optional (for observability features):
```
UPLOADTHING_TOKEN=your_token_here      # File storage for receipts
WEBHOOK_URL=https://hooks.slack.com/...  # Slack/webhook notifications
CRON_SECRET=your_secret_here            # Cron job authentication
```

## Observability Architecture

The application includes optional observability features that are designed to fail gracefully:

### File Upload Flow
1. User uploads receipt → AI parses it
2. After successful parse, file is uploaded to UploadThing (`uploadthing-storage.ts`)
3. Upload is awaited before webhook is sent (ensures URL is available)
4. If upload fails, webhook still sends with `fileUrl: null`

### Webhook Notifications
- Triggered after successful receipt parsing (`webhook-notifications.ts`)
- Supports Slack-formatted messages (detected via `hooks.slack.com` URL)
- Supports generic JSON webhooks for other integrations
- Includes receipt details, file URL (if available), and session ID

### Cron Job (File Cleanup)
- Endpoint: `/api/cron/cleanup-old-receipts`
- Runs daily at 3 AM UTC (configured in `vercel.json`)
- Deletes files older than 90 days from UploadThing
- Protected by optional `CRON_SECRET` authentication

### Key Files
- `src/lib/uploadthing-storage.ts` - Upload, delete, list files
- `src/lib/webhook-notifications.ts` - Slack/JSON webhook sender
- `src/app/api/cron/cleanup-old-receipts/route.ts` - Cleanup cron job
- `vercel.json` - Cron schedule configuration

## Development Guidelines

1. **Money Calculations**: Use `Decimal.js` for all monetary calculations to avoid floating point errors
2. **Type Safety**: Project uses strict TypeScript - ensure all types are properly defined
3. **Testing**: Write tests for new functionality; tests live next to source files
4. **Components**: Prefer composition using existing shadcn/ui components
5. **Styling**: Use Tailwind CSS classes; avoid inline styles
