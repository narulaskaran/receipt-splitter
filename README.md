# Receipt Splitter

A web application for easily splitting receipts among friends and groups. No app installation or account required.

## Features

- Upload a receipt image to automatically parse items, subtotal, tax, and tip
- Add people who shared the receipt
- Assign items to individuals or split items among multiple people
- Calculate tax and tip proportionally based on item costs
- View detailed breakdown of what each person owes
- Share results easily via native share API or copy to clipboard
- Responsive design that works on mobile and desktop
- Automatic light/dark mode based on system preferences with manual override
- Support the project via Ko-fi integration

## Technology Stack

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Anthropic Claude API for receipt parsing
- Decimal.js for precise financial calculations
- next-themes for theme management
- Ko-fi integration for donations
- Vercel for deployment and serverless functions

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

## Deployment

The application is configured for seamless deployment on Vercel. Just connect your GitHub repository to Vercel and it will automatically deploy when changes are pushed to the main branch.

Make sure to add your Anthropic API key as an environment variable in your Vercel project settings.

## License

MIT

## Acknowledgements

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Anthropic Claude](https://www.anthropic.com/) for the receipt parsing capabilities
- [Tab](https://www.tabapp.co/) for inspiration
