# Receipt Splitter

A web app for easily splitting receipts among friends. No app installation or account required.

## Features

- **AI Receipt Parsing**: Upload a receipt photo or PDF, or paste a receipt link, and an LLM will parses line items, subtotal, tax, and tip.
- **Flexible Item Assignment**: Assign items to individuals or groups of people. Split by percentage or amount.
- **Proportional Tax and Tip**: Calculated from each person's costs.
- **Receipt Sharing**: Share a link of the split receipt with your friends so they can see how much they owe.
- **Venmo Integration**: Deep links into Venmo to prefill payment amount, receipient, and details.

## Development

### Setup

```bash
git clone https://github.com/yourusername/receipt-splitter.git && cd receipt-splitter
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

### Visual Testing

There is a screenshots command to help quickly audit visual changes. With `npm run dev` running, `npm run screenshots -- --mock-data --tab all` to inject synthetic data into the web app and capture screenshots of each tab at different viewport sizes. 

## Configuration

Environment variables are documented in [`.env.example`](.env.example), including which are required. Set them in `.env.local` for development and in your Vercel project settings for deployment.

## iOS app

The iPhone app (iOS 26 and later) is a Capacitor project that bundles the same splitting UI and calls this site's API. Building, signing, and uploading need a Mac and an Apple Developer account. Those steps are documented in [docs/ios/README.md](docs/ios/README.md) and have not been run here.

On Linux you can check the committed native project:

```bash
npm run ios:check
```

The asset build and Xcode sync, on a machine that has the mobile scripts, are:

```bash
npm run mobile:build
npx cap sync ios
```

Then open `ios/App/App.xcodeproj` on a Mac. Do not commit a `server.url` development setting.

Public privacy and support pages, also used as the App Store links, are `/privacy` and `/support`.

## Observability 

### File Storage (UploadThing)

Receipt files are uploaded to UploadThing for up to 90 days for observability and debugging.

### Webhook Notifications

Get notified when receipts are parsed (or fail to parse) via Slack or a generic JSON webhook. For Slack, [create a webhook](https://api.slack.com/messaging/webhooks) and set `WEBHOOK_URL` to its `https://hooks.slack.com/services/...` URL.

Notifications include restaurant name, items, totals, a link to the uploaded receipt file (image or PDF), and approximate location (if available).

Location info captures city and country. It is pulled from the photo's GPS metadata when present and otherwise falls back to Vercel's IP geolocation service. Photo GPS metadata is rounded to a 1 km radius to obfuscate precise coordinates. 

### Automatic File Cleanup

A daily Vercel Cron job (`/api/cron/cleanup-old-receipts`) deletes files on UploadThing that are older than 90 days. `CRON_SECRET` is required in production (the job returns 500 without it); Vercel sends it in the `Authorization` header on scheduled runs.

## License

MIT
