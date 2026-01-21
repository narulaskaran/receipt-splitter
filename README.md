# Receipt Splitter

A web application for easily splitting receipts among friends and groups. No app installation or account required.

## Features

- **AI-Powered Receipt Parsing**: Upload a receipt image to automatically parse items, subtotal, tax, and tip using Claude AI
- **Advanced People Management**: Add people who shared the receipt with unique names and IDs
- **Group Organization**: Create named groups with emoji identifiers for better organization
- **Flexible Item Assignment**:
  - Assign items to individuals
  - Split items among multiple people with percentage-based splitting
  - Assign items to entire groups
- **Intelligent Calculations**: Calculate tax and tip proportionally based on item costs
- **Enhanced Receipt Sharing**:
  - Generate shareable URLs with comprehensive split data
  - Include names, amounts, totals, notes, phone numbers, and dates
  - Advanced validation with detailed error reporting
- **Split Payment Page**: Dedicated `/split` route where recipients can view their individual amounts
- **Venmo Integration**: Direct payment links for each person with phone number validation
- **Mobile-First Design**: Responsive design optimized for all devices with touch-friendly interface
- **Session Persistence**: Automatic saving and restoration of your split session
- **Theme Support**: Automatic light/dark mode based on system preferences with manual override
- **Ko-fi Integration**: Support the project via donations

## Technology Stack

- **Framework**: Next.js 15.3.1 with App Router
- **Language**: TypeScript with strict type checking
- **Styling**: Tailwind CSS with custom CSS variables
- **UI Components**: shadcn/ui component library
- **AI Integration**: Anthropic Claude API for receipt parsing
- **State Management**: React hooks with localStorage persistence
- **Validation**: Custom validation with detailed error reporting
- **Payment Integration**: Venmo payment link generation
- **Testing**: Jest with React Testing Library, Playwright for visual testing
- **Deployment**: Vercel with automatic deployments
- **Analytics**: Vercel Web Analytics and SpeedInsights

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Anthropic API key for receipt parsing

### Setup

1. Clone the repository

```bash
git clone https://github.com/yourusername/receipt-splitter.git
cd receipt-splitter
```

2. Install dependencies

```bash
npm install
```

3. Create a `.env.local` file in the root directory with your Anthropic API key:

```
ANTHROPIC_API_KEY=your_api_key_here
```

4. Start the development server

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Testing

Run the test suite with:

```bash
npm test
```

Run linting checks:

```bash
npm run lint
```

Build for production:

```bash
npm run build
```

### Visual Testing

The project includes a screenshot harness for capturing UI states across multiple viewports:

```bash
# Requires dev server running (npm run dev)

# Screenshot all tabs with mock data
npm run screenshots -- --mock-data --tab all

# Screenshot specific tab
npm run screenshots -- --mock-data --tab results

# Screenshot /split route
npm run screenshots -- --route /split --mock-data
```

Screenshots are saved to the `/screenshots` directory (gitignored) and include 7 viewport sizes: mobile-small (320px), mobile (375px), mobile-large (414px), tablet (768px), tablet-landscape (1024px), desktop (1280px), and desktop-large (1920px).

## Key Components

### Core Application

- **Main Page**: Tabbed interface with session management and responsive design
- **Receipt Uploader**: Drag & drop image upload with AI parsing
- **People Manager**: Add/remove people with validation
- **Group Manager**: Create and manage groups with emoji identifiers
- **Item Assignment**: Flexible assignment with an intuitive touch-friendly interface
- **Results Summary**: Final calculations with sharing and Venmo integration

### Split Sharing

- **URL Generation**: Create shareable links from the results page
- **Split Page**: Dedicated route for recipients to view their amounts
- **Payment Cards**: Individual payment display with Venmo integration
- **Validation**: Comprehensive data validation and error handling

### Utilities

- **Receipt Utils**: Tax/tip calculations and person totals
- **Split Sharing**: URL serialization/deserialization with validation
- **Venmo Utils**: Payment link generation and validation
- **Emoji Utils**: Group emoji management system

## Deployment

The application is configured for automatic deployment on Vercel. Just connect your GitHub repository to Vercel and it will automatically deploy when changes are pushed to the main branch.

Make sure to add your Anthropic API key as an environment variable in your Vercel project settings.

## Observability (Optional)

The application includes optional observability features for monitoring uploads and debugging.

### File Storage (UploadThing)

Receipt files are automatically uploaded to UploadThing after successful parsing, providing:
- Public URLs for files that can be displayed in webhook notifications
- Automatic 90-day retention with daily cleanup via Vercel Cron

**Setup:**
1. Create an UploadThing account at https://uploadthing.com
2. Create a new project and copy your API token
3. Add to Vercel environment variables:
   ```
   UPLOADTHING_TOKEN=your_token_here
   ```

### Webhook Notifications

Get notified when receipts are parsed via Slack or generic JSON webhooks:

**Slack Setup:**
1. Create a Slack webhook: https://api.slack.com/messaging/webhooks
2. Add to Vercel environment variables:
   ```
   WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

Notifications include restaurant name, items, totals, a link to the uploaded receipt file (image or PDF), and geolocation data (if available).

#### Privacy & Data Collection

When webhook notifications are enabled, the following data may be collected and transmitted:
- **Receipt parsing metadata**: Restaurant name, items, subtotals, tax, tip, and totals
- **File upload URLs**: Public URLs for uploaded receipt files (90-day retention)
- **Geolocation data**: Approximate location (city, region, country, latitude/longitude) based on IP address via Vercel's geolocation headers

Geolocation data is collected server-side using Vercel's IP geolocation service and is only included when:
- Webhooks are configured (opt-in feature via `WEBHOOK_URL` environment variable)
- The application is deployed on Vercel (local development returns no geolocation data)

This data is sent to your configured webhook endpoint and is not stored by the Receipt Splitter application itself.

### Automatic File Cleanup

A Vercel Cron job runs daily at 3 AM UTC to delete files older than 90 days:
- Endpoint: `/api/cron/cleanup-old-receipts`
- Schedule: `0 3 * * *` (configured in `vercel.json`)

**Optional Security:**
Add `CRON_SECRET` to your Vercel environment variables to protect the endpoint from unauthorized manual invocations. Vercel automatically includes this in the Authorization header for scheduled cron runs.

### Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for receipt parsing |
| `UPLOADTHING_TOKEN` | No | UploadThing API token for file storage |
| `WEBHOOK_URL` | No | Slack or generic webhook URL for notifications |
| `CRON_SECRET` | No | Secret for cron job authentication |

## License

MIT

## Acknowledgements

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Anthropic Claude](https://www.anthropic.com/) for the receipt parsing capabilities
- [Tab](https://www.tabapp.co/) for inspiration
