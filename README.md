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
- **Testing**: Jest with React Testing Library
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

## Key Components

### Core Application
- **Main Page**: Tabbed interface with session management and responsive design
- **Receipt Uploader**: Drag & drop image upload with AI parsing
- **People Manager**: Add/remove people with validation
- **Group Manager**: Create and manage groups with emoji identifiers
- **Item Assignment**: Flexible assignment with drag & drop and touch support
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

## License

MIT

## Acknowledgements

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Anthropic Claude](https://www.anthropic.com/) for the receipt parsing capabilities
- [Tab](https://www.tabapp.co/) for inspiration
