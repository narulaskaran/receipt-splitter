# CLAUDE.md

This file provides guidance to Claude Code when working with this codebase.

## Project Overview

Receipt Splitter is a Next.js web application for splitting receipts among friends and groups. It uses AI-powered receipt parsing via the Anthropic Claude API and provides flexible item assignment with Venmo payment integration.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 7 (strict mode; TypeScript 6 nested for ESLint)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui with Radix UI primitives
- **State Management**: React hooks with localStorage persistence
- **Validation**: Zod schemas
- **Testing**: Jest + React Testing Library
- **AI**: Anthropic Claude API for receipt parsing by default; swappable via `src/lib/llm/` (OpenAI, OpenRouter)

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
│   ├── receipt-link-paste.tsx  # "Paste receipt link" button / URL field
│   ├── people-manager.tsx      # Add/remove people
│   ├── group-manager.tsx       # Create groups with emoji
│   ├── item-assignment.tsx     # Assign items to people
│   ├── results-summary.tsx     # Final calculations
│   ├── payment-card.tsx        # Individual payment display
│   └── ...
├── lib/                    # Utility functions
│   ├── currency.ts          # Multi-currency support (20 currencies)
│   ├── receipt-utils.ts     # Tax/tip calculations
│   ├── split-sharing.ts     # URL serialization/deserialization
│   ├── receipt-url.ts       # Pasted receipt links: URL validation (client + server)
│   ├── receipt-screenshot.ts # Pasted receipt links: Firecrawl screenshot of the page
│   ├── llm/                 # Provider-agnostic receipt parsing (adapters + registry)
│   ├── venmo-utils.ts       # Payment link generation (USD only)
│   ├── emoji-utils.ts       # Group emoji management
│   ├── uploadthing-storage.ts  # UploadThing file upload/delete/list
│   ├── webhook-notifications.ts # Slack/JSON webhook notifications
│   └── utils.ts             # General utilities (cn helper)
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

## Visual Change Workflow

When making visual changes to components, follow this workflow to ensure changes are validated across all viewports:

### 1. Capture Baseline Screenshots

Before making any visual changes:

```bash
npm run dev                                    # Start dev server
npm run screenshots -- --mock-data --tab all  # Capture baseline across all tabs
```

### 2. Make Changes & Write Tests

- Update component file(s)
- Add or update unit tests for functionality (not just visual)
- Ensure all tests pass: `npm test`

### 3. Capture Updated Screenshots

After making changes:

```bash
npm run screenshots -- --mock-data --tab all  # Capture updated state
```

### 4. Manual Visual Review

- Compare screenshots in `/screenshots` directory before/after changes
- Check all 7 viewports (mobile-small → desktop-large) for regressions
- Verify no unintended visual changes in other components/tabs
- Test responsive behavior across viewport sizes

### 5. Commit Changes

- Commit component and test files
- Screenshots are gitignored (used for manual review only)
- Document visual changes in commit message

### When to Use Each Testing Tool

- **Unit Tests (Jest + RTL)**: Component logic, state management, user interactions, accessibility
- **Screenshot Harness**: Visual review across viewports before/after visual changes
- **Playwright E2E**: Multi-page flows, integration scenarios, complex user journeys

### Screenshot Naming Convention

Screenshots follow this pattern: `{route}_{tab}_{viewport}_{timestamp}.png`

Examples:
- `home_results_mobile_2026-01-10T17-14-30.png`
- `home_assign_desktop-large_2026-01-10T17-15-02.png`
- `split_desktop_2026-01-10T17-20-45.png`

## Key Types

The core data types are defined in `src/types/index.ts`:

- `Receipt`: Parsed receipt with items, subtotal, tax, tip, total, and currency (ISO 4217 code)
- `ReceiptItem`: Individual item with name, price, quantity
- `Person`: Person with assigned items and calculated totals
- `Group`: Named group with emoji and member IDs
- `PersonItemAssignment`: Tracks item-to-person assignments with share percentages
- `CurrencyInfo`: Currency metadata (code, name, symbol, locale, minorUnits)

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

Optional (LLM provider selection, see "LLM Providers"):
```
RECEIPT_LLM_PROVIDER=anthropic          # anthropic (default) | openai | openrouter
RECEIPT_LLM_MODEL=...                   # Override the provider's default model
OPENAI_API_KEY=...                      # Required when provider is openai
OPENROUTER_API_KEY=...                  # Required when provider is openrouter
```

`ANTHROPIC_API_KEY` is only required when the provider is `anthropic`.

Optional (pasted receipt links, see "Pasted Receipt Links"):
```
FIRECRAWL_API_KEY=fc-...                # Firecrawl screenshots; keyless requests have lower limits
FIRECRAWL_API_URL=...                   # Override https://api.firecrawl.dev (self-hosted, tests)
```

Optional (for observability features):
```
UPLOADTHING_TOKEN=your_token_here      # File storage for receipts
WEBHOOK_URL=https://hooks.slack.com/...  # Slack/webhook notifications
CRON_SECRET=your_secret_here            # Cron job authentication (required in production)
NATIVE_APP_ORIGINS=                       # Extra CORS origins for POST /api/v1/parse-receipt (comma-separated)
```

## LLM Providers

Receipt parsing goes through the `ReceiptExtractor` interface in `src/lib/llm/types.ts`: file + prompt + JSON schema in, parsed JSON out. The parse route never imports a provider SDK.

- `src/lib/llm/index.ts`: registry + `getReceiptExtractor()`, selected by `RECEIPT_LLM_PROVIDER` / `RECEIPT_LLM_MODEL`
- `src/lib/llm/adapters/anthropic.ts`: Anthropic Messages API (default: Claude Haiku 5.5, `claude-haiku-5-5`; adaptive thinking is on by default and counts toward `max_tokens`)
- `src/lib/llm/adapters/openai-compatible.ts`: any OpenAI Chat Completions API with `json_schema` structured outputs. Registered as `openai` (default `gpt-6-luna`) and `openrouter` (default `openai/gpt-6-luna`; any OpenRouter model id works via `RECEIPT_LLM_MODEL`)
- `src/lib/llm/receipt-prompt.ts`: the shared prompt

Adapters throw `LLMError` (`rate_limit | bad_request | api_error | empty_response | invalid_json | unknown`), which the route maps to HTTP statuses and `llm_*` webhook error types. Zod validation and normalization stay in the route so every provider gets the same safety nets.

**Adding a provider:** for OpenAI-compatible APIs (DeepSeek, Groq, etc.), add a registry entry with a `baseURL`. Otherwise write an adapter implementing `ReceiptExtractor`, register it, and add it to `src/lib/llm/adapters/contract.test.ts`. The selected model must accept image input (and PDF, unless the adapter sets `supportsPdf: false`) and support JSON-schema structured outputs (the `openrouter` registration sends `provider.require_parameters: true` so requests only route to upstreams that honor `strict` json_schema).

Non-Anthropic providers send receipt images (which may include names or partial card numbers) to that provider; OpenRouter forwards them to the routed upstream.

`RECEIPT_LLM_MODEL` is not namespaced per provider: when changing `RECEIPT_LLM_PROVIDER`, update or unset it, or the old model id is sent to the new provider and fails with a 400.

## Observability Architecture

The application includes optional observability features that are designed to fail gracefully:

### File Upload Flow
1. User uploads receipt → file is uploaded to UploadThing (`uploadthing-storage.ts`) **before** the AI parses it, so the file URL is available to both success and error webhooks
2. AI parses the receipt
3. Success or error webhook is sent with the file URL
4. If upload fails, parsing continues and webhooks send with `fileUrl: null`

### Pasted Receipt Links
`POST /api/parse-receipt` also accepts a `url` form field in place of `file` (an uploaded file wins if both are sent). The server asks Firecrawl for a full-page screenshot of the link, then everything downstream is identical to an uploaded image: LLM parse, UploadThing, webhooks, rate limit. The route sets `maxDuration = 60` because the Firecrawl call can take a while.

- `src/lib/receipt-url.ts`: `normalizeReceiptUrl()`, shared by the client (arrow enable/disable) and the server. Typed links may omit the scheme; the paste-anywhere shortcut requires `http(s)://`.
- `src/lib/receipt-screenshot.ts`: `screenshotReceiptUrl()` calls Firecrawl `POST /v2/scrape` with `formats: [{ type: "screenshot", fullPage: true, quality: 80 }]`, then downloads the returned image (Firecrawl's URL expires after 24h, so it is fetched immediately, https only, image types only, capped at `MAX_FILE_SIZE_BYTES`). Firecrawl's servers open the user's URL; this server never does, so there is no SSRF surface here. `FIRECRAWL_API_KEY` is sent when set (Firecrawl also answers keyless requests at lower limits); `FIRECRAWL_API_URL` overrides the base URL (self-hosted Firecrawl, tests).
- Failures throw `ReceiptUrlError`: `message` is shown to users, `detail` (private: bad key, out of credits, Firecrawl error text) goes only to logs and the `url_<code>` error webhook. Key and credit problems surface to users as a generic "unavailable, upload a screenshot instead". The page's own status (`data.metadata.statusCode`) is checked, since Firecrawl answers 200 even when the target returned 404.
- Webhooks carry `sourceUrl` (Slack footer `Source: ...`, JSON `file.sourceUrl`) for link receipts, on both success and error notifications. The screenshot is uploaded to UploadThing as `{host}.png`, so Slack inlines it like a photo.
- Cost: each pasted link is one Firecrawl scrape (1 credit); the free tier is limited, and the WAF rate limit below is the guard. Pages needing a login, or very tall pages (the model rejects images over its size limits), won't work; the error tells the user to upload a screenshot.
- UI: `ReceiptLinkPaste` has a "Paste receipt link" button (reads the clipboard; a phone has no shortcut) that falls back to a URL field when the clipboard is blocked or holds no link. The field's arrow is disabled until the text is a valid link. A `paste` listener on the page reads a pasted `http(s)` link (Ctrl/Cmd+V) unless the paste target is a text field. Link field state lives in `ReceiptUploader` because the component unmounts while parsing.

### Webhook Notifications
- Triggered after successful receipt parsing, and on parse failures via `sendErrorNotification` (`webhook-notifications.ts`)
- Supports Slack-formatted messages (detected via `hooks.slack.com` URL)
- Supports generic JSON webhooks for other integrations
- Includes receipt details, file URL (if available), session ID, geolocation data, and the LLM provider/model that parsed it
- Geolocation data (city, region, country, lat/long) is extracted from Vercel headers (`extractGeolocation()` in `parse-receipt/route.ts`)
- Returns `null` in local development when Vercel headers are unavailable
- PDF receipts are handled differently than images in Slack webhooks (linked vs. inlined)

### Cron Job (File Cleanup)
- Endpoint: `/api/cron/cleanup-old-receipts` (`maxDuration = 300`)
- Runs daily at 3 AM UTC (configured in `vercel.json`)
- Paginates UploadThing `listFiles` (500/page), collects keys older than 90 days, then deletes in batches of 100
- `CRON_SECRET` is **required** in production (`VERCEL_ENV` or `NODE_ENV`); optional in dev/test
- Response JSON includes `pages` and `partial` when listing guards stop early

### Rate Limiting (parse-receipt)
`POST /api/parse-receipt` and `POST /api/v1/parse-receipt` are public and proxy paid LLM calls. Inbound limiting is a **Vercel WAF custom rule**, not application code — extend the rule to **both** paths (see `docs/api/parse-receipt-v1.md`):

- **Rule name:** Rate limit parse-receipt
- **Match:** path equals `/api/parse-receipt` OR `/api/v1/parse-receipt` AND method is `POST`
- **Limit:** 10 requests / 10 minutes per IP (fixed window)
- **Exceeded action:** HTTP 429 (blocked at the edge, before the function or Anthropic runs)
- **Config:** Vercel dashboard Firewall, or `npx vercel@latest firewall` (global CLI 48.x does not include this command)

There is no default per-endpoint rate limit. Platform DDoS mitigation is always on, but it does not cap a slow script that burns API credit. WAF counters are per-region.

### Key Files
- `src/lib/uploadthing-storage.ts` - Upload, delete, list files
- `src/lib/webhook-notifications.ts` - Slack/JSON webhook sender
- `src/app/api/cron/cleanup-old-receipts/route.ts` - Cleanup cron job
- `vercel.json` - Cron schedule configuration

## PWA

### Service worker
Built with Serwist's Turbopack integration (`@serwist/turbopack`), so `next dev` and `next build` both run on Turbopack. `src/app/sw.ts` is the worker source; the route handler in `src/app/serwist/[path]/route.ts` bundles it with esbuild at build time and injects the precache manifest, and `SerwistProvider` in `layout.tsx` registers `/serwist/sw.js` with scope `/` (the route sends `Service-Worker-Allowed: /`). Precached: `.next/static` JS/CSS/fonts (`globPatterns` in the route) plus the `/`, `/split` and `/offline` HTML (`additionalPrecacheEntries`, versioned by commit SHA); everything else is cached at runtime by Serwist's `defaultCache`.

### Offline behavior
- Uncached navigations fall back (see `fallbacks` in `sw.ts`) to the precached `/split` shell for `/split?...` links, which carry their data in the query string and render client-side, to the precached `/` shell for `/?...` (e.g. the share-target redirect), or to `/offline` (`src/app/offline/page.tsx`) for anything else. The list is in `src/lib/offline-fallbacks.ts`; the first match wins, so keep the specific entries first.
- `/api/parse-receipt` needs the network. `ReceiptUploader` shows an offline notice and disables upload via `useOnlineStatus` (`src/lib/use-online-status.ts`), and a request that never reaches the server shows a connection error.

- The worker is **not registered in development**, so test service worker changes with `npm run build && npm start`.
- `reloadOnOnline` is off on purpose: reloading when the connection returns would discard unsaved edits.
- Old `/sw.js` and `workbox-*.js` files from the previous `@ducanh2912/next-pwa` setup are no longer produced.

### Icons
The icon set is generated from `assets/app-icon.png` (1024px, rounded square with transparent corners) by `npm run generate-icons`. It writes `public/icon-{192,512}.png` (purpose `any`, transparent corners), `public/icon-maskable-{192,512}.png` and `public/apple-touch-icon.png` (opaque, full-bleed), and `src/app/favicon.ico` (16/32/48). The output is committed; generation is **not** part of the build, so rerun the script and commit after changing the source image. `src/lib/pwa-assets.test.ts` checks sizes and opacity.

### Manifest and theme color
`src/app/manifest.ts` is the typed web app manifest (served at `/manifest.webmanifest`, linked automatically). Don't set `orientation`; the app works in landscape. Manifest colors and `viewport.themeColor` come from `src/lib/pwa.ts`, which mirrors `--background` in `globals.css` (the manifest has no dark variant, so the browser UI color follows the color scheme via `viewport.themeColor`; it does not follow the in-app theme toggle). Don't set `viewportFit: "cover"` without handling safe-area insets: the `min-h-screen` wrappers would add scroll inside a padded body, and fixed elements (dialogs, toasts) ignore body padding. `public/screenshots/` feeds the manifest's `screenshots` (Chrome's richer install dialog); retake them with the screenshot harness' mock data when the UI changes noticeably.

### Share target
The manifest's `share_target` lets the installed Android/Chromium app receive receipt photos and PDFs from the system share sheet. The multipart POST to `/share-target` is answered by the service worker (`registerCapture` in `src/app/sw.ts`, logic in `receiveSharedFiles` in `src/lib/share-target.ts`). It ignores POSTs whose `Origin` is another site (the OS share sheet sends none or `null`; this blocks other sites' forms, not every cross-site submission), keeps only the types the uploader reads (JPEG, PNG, WebP, HEIC/HEIF, PDF; the file extension is used when the source sends no usable MIME type; at most one split's worth), stashes them in the Cache API and redirects to `/?share-target=<status>`: `1` (files waiting), `empty` (nothing usable) or `error` (storing failed, or the POST reached the server). `Home` clears the param, shows a toast for `empty`/`error`, and for `1` takes the files out (`takeSharedFiles` clears the cache even if reading fails, and ignores files stashed more than 10 minutes ago) and passes them to `ReceiptUploader` through `incomingFiles`. The uploader waits until it is idle, then processes them like a drop (or asks the user to share again if offline). `src/app/share-target/route.ts` only redirects with `error` if the POST reaches the server. Next types `share_target.params.files` as `File | File[]`, so `manifest.ts` casts the spec's `{ name, accept }` shape. Like the rest of the worker, this only works in production builds.

## Multi-Currency Support

Receipt Splitter supports 20 international currencies with automatic AI detection and manual override.

**Important**: Each receipt/split uses a **single currency**. All items, calculations, and payments are in the same currency. Mixed-currency splits are not supported.

### Supported Currencies
- **Americas**: USD, CAD, MXN, BRL
- **Europe**: EUR, GBP, CHF, SEK, NOK, DKK, PLN, TRY
- **Asia-Pacific**: JPY, CNY, INR, KRW, SGD, HKD, AUD, NZD

### Currency Module (`src/lib/currency.ts`)
- **Auto-Detection**: AI detects currency from receipt context (country, region, language)
- **Manual Override**: Users can change currency via receipt edit dialog
- **Proper Formatting**: Uses Intl API for browser-native formatting
- **Zero-Decimal Support**: Handles JPY, KRW correctly (no cents)
- **Minor Units**: `toMinorUnits()`/`fromMinorUnits()` use Decimal.js for precision
- **Lazy Loading**: Proxy-based caching for performance

### Venmo Integration
- **USD Only**: Venmo payment button only appears for USD receipts
- **Currency Validation**: `generateVenmoLink()` rejects non-USD currencies
- **User Clarity**: Non-USD amounts display as formatted text instead of payment button

### Currency in Components
- **Receipt Details**: Shows "CODE - Name (Symbol)" format (e.g., "JPY - Japanese Yen (¥)")
- **Split Sharing**: Currency preserved in shareable URLs with proper minor unit conversion
- **Format Currency**: All `formatCurrency()` calls accept optional `currencyCode` parameter

### Testing
- Currency utilities: 28 tests covering formatting, conversion, validation
- Split sharing: 300+ multi-currency tests (JPY, KRW, EUR round-trip)
- Venmo validation: Tests for non-USD currency rejection
- Cache verification: Tests for Proxy-based lazy loading

## Development Guidelines

1. **Money Calculations**: Use `Decimal.js` for all monetary calculations to avoid floating point errors
2. **Type Safety**: Project uses strict TypeScript 7 for `tsc`, with TypeScript 6 as the `typescript` package name so ESLint can use the JS API. Keep `jest.config.js` as JavaScript.
3. **Testing**: Write tests for new functionality; tests live next to source files
4. **Components**: Prefer composition using existing shadcn/ui components
5. **Styling**: Use Tailwind CSS classes; avoid inline styles

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
