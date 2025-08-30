# Receipt Splitter

A web application for easily splitting receipts among friends and groups. No app installation or account required.

## Features

- **Receipt Parsing**: Upload a receipt image to automatically parse items, subtotal, tax, and tip
- **Group Management**: Add people who shared the receipt
- **Item Assignment**: Assign items to individuals or split items among multiple people
- **Smart Calculations**: Calculate tax and tip proportionally based on item costs
- **Detailed Breakdown**: View detailed breakdown of what each person owes
- **Receipt Sharing**: Generate shareable links for group members to view and pay their amounts
- **Split Payment Page**: Dedicated page where everyone can see their amount and pay directly
- **Venmo Integration**: Direct payment links with pre-filled amounts and descriptions
- **Text Sharing**: Share results easily via native share API or copy to clipboard
- **Mobile-Optimized**: Responsive design with enhanced mobile UX and touch targets
- **Theme Support**: Automatic light/dark mode based on system preferences with manual override
- **Support the Project**: Ko-fi integration for donations

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

## How Receipt Sharing Works

1. **Create Split**: Upload a receipt and assign items to group members
2. **Enter Phone**: Add your phone number for Venmo payment functionality
3. **Share Link**: Click "Share Split" to generate a link with everyone's amounts
4. **Group Pays**: Members visit the link and pay their amount directly via Venmo
5. **Done**: No more collecting money or calculating who owes what!

### Example Shared URL
```
https://receipt-splitter.app/split?names=Alice,Bob&amounts=25.50,30.25&total=55.75&note=Dinner&phone=15551234567
```

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
