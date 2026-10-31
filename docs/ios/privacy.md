# App Privacy label

Answers below are derived from the website and the iOS client as they behave in this repo. They are the answers to type into App Store Connect. The form itself was not filled in. UNVERIFIED.

Tracking is **none**. Do not add an App Tracking Transparency prompt. The app does not contact a data broker, does not combine data with other companies' data for ads, and does not share data for cross-app advertising. Analytics, if you add it later, does not by itself require ATT. Re-read [Apple's privacy guidance](https://developer.apple.com/app-store/user-privacy-and-data-use/) before submission.

There is no account. Receipt photos are not tied to an account.

## Data types

| Data | Collected | Linked to identity | Tracking | Purpose | Why |
| --- | --- | --- | --- | --- | --- |
| Photos or Videos | Yes | No | No | App Functionality | The receipt image or PDF is sent to the API when the user agrees to parse it. |
| Other User Content | Yes | No | No | App Functionality | Parsed line items, and the pasted receipt URL. |
| Coarse Location | Yes | No | No | App Functionality and Analytics | Vercel derives city, region, country, and coordinates from the request IP on a parse request. The raw IP is not copied into the webhook. A JSON webhook includes the coordinates. A Slack webhook shows city, region, and country. Vercel's firewall also uses the IP to rate-limit parse requests. This is not GPS. The app must not request location permission. A location-permission string would not disclose this. The manifest lists both purposes. Match Connect to the manifest. This is the operator notification, not Vercel Web Analytics. |
| Phone Number | Yes, only if the sender puts a US Venmo number in a share link | Yes | No | App Functionality | The number sits in the `/split` query string. Anyone with the link can read it. Opening the link sends it to the host in the URL. There is no account, but the number itself identifies a person, so answer **linked**. |
| Product Interaction | No, for the iOS app | — | — | — | `@vercel/analytics` and `@vercel/speed-insights` are mounted in `src/app/layout.tsx` (the Next.js website). They are not part of the static iOS bundle. Do not declare product interaction for the iPhone app unless you add analytics to that bundle. |

The session id is not a fresh id per request. `getSessionId()` in `src/lib/session.ts` stores `receiptSplitterSessionId` on the first parse and sends that same id on later parses from the same install. New Split does not remove it. Deleting the app, or clearing the website's stored data, does. It is not an account id and not an advertising identifier (not IDFA, not IDFV). It does let operator notifications from one install be correlated until that storage is cleared. Do not declare it as a Device ID. Do not declare it as a User ID unless you decide the correlation itself needs that box: Apple's User ID examples are account identifiers, and this UUID is not tied to a person. The privacy policy describes it. If Connect has no better bucket, leave it under the receipt-content disclosure rather than inventing a device identifier.

Names, amounts, the total, the currency, the note, an optional date, an optional US Venmo phone number, and (when there is more than one receipt) per-receipt labels and amounts are in the share link. Item assignments are not. They are the same "other user content" case as the receipt text. Anyone with the link can read them, and opening the link sends that query string to the host. The Venmo phone number is the field to mark linked, because the number itself identifies a person. Friend names are not the app user's account name. Keep them under Other User Content unless you choose to also check Name. Checking both would double-count the same URL.

`ios/App/App/PrivacyInfo.xcprivacy` is marked DRAFT in the file. It currently lists Product Interaction, and coarse location with both App Functionality and Analytics. Before upload, reconcile it with this table. This pass did not edit the manifest (native project is owned elsewhere):

- [ ] UNVERIFIED: Remove Product Interaction from the privacy manifest if the iOS binary still has no analytics SDK.
- [ ] UNVERIFIED: Add a phone-number / contact-info entry if you declare the Venmo phone number as collected.
- [ ] UNVERIFIED: Confirm the manifest's collected-data types match the Connect form exactly.

## Analytics options

1. **None in the iOS app (current).** No product-interaction declaration. The website still runs Vercel Web Analytics and Speed Insights. Say that on `/privacy`, which this repo does.
2. **Vercel Web Analytics custom events from the static bundle.** Declare Product Interaction, not used for tracking, and add it to `PrivacyInfo.xcprivacy`. ATT is still not required unless the data is shared for cross-app tracking. Update `/privacy` in the same release.

After `npm run mobile:build`, confirm `dist-mobile` does not contain `@vercel/analytics` or `@vercel/speed-insights` unless you deliberately chose option 2.

- [ ] UNVERIFIED: Re-check the built `dist-mobile` on the release commit before answering the Connect form.

## Consent

Guideline 5.1.2: get permission before a third party receives personal data for AI processing.

The client stores the version of the disclosure the person accepted (`CONSENT_VERSION`). Sending a receipt is blocked until they accept the current version. If you decline, nothing is uploaded. Parsing still needs the server. There is no on-device parser.

**Processor change means a new consent.** Switching the default from Anthropic to OpenAI or OpenRouter, adding a processor, or changing what is sent requires a bump of `CONSENT_VERSION` so a previous acceptance is not reused. Shipping the new provider behind the old version is a bug. `CONSENT_VERSION` is 1.

The dialog (`src/components/ai-consent-dialog.tsx`) says the image, PDF, or pasted link goes to our server and an AI provider (Anthropic by default), that the server may keep a copy for about 90 days, that the operator is notified, and that location is derived from the IP address. It links to `/privacy` and `/support`. Two gaps, left in the dialog on purpose in this pass because that component is shared UI:

- A pasted link is also sent to Firecrawl. The dialog does not say that name. The privacy policy does.
- "Notifies the operator" is unconditional in the dialog. The webhook runs only when `WEBHOOK_URL` is set.

The privacy policy is the complete list. If you change the dialog so it names Firecrawl, or so the operator notification is described as optional, bump `CONSENT_VERSION` in the same change.

- [ ] UNVERIFIED: On a device, decline consent and confirm no parse request leaves the phone. Accept, parse, then bump `CONSENT_VERSION` and confirm the prompt returns.

## Required-reason APIs and SDK manifests

The app privacy manifest declares UserDefaults with reason **CA92.1** (read/write by the same app). Capacitor Preferences uses UserDefaults. CA92.1 matches that. Do not add a tracking domain.

On a Mac, after `npx cap sync ios` and a resolved Swift package graph, open each embedded privacy manifest and confirm the required-reason APIs:

- [ ] UNVERIFIED: Capacitor
- [ ] UNVERIFIED: CapacitorApp (`@capacitor/app`)
- [ ] UNVERIFIED: CapacitorBrowser
- [ ] UNVERIFIED: CapacitorCamera
- [ ] UNVERIFIED: CapacitorClipboard
- [ ] UNVERIFIED: CapacitorKeyboard
- [ ] UNVERIFIED: CapacitorPreferences (UserDefaults, CA92.1)
- [ ] UNVERIFIED: CapacitorShare
- [ ] UNVERIFIED: CapacitorStatusBar
- [ ] UNVERIFIED: CapacitorTipJar, once `packages/capacitor-tip-jar` is in the build
- [ ] UNVERIFIED: No extra required-reason categories (file timestamp, disk space, system boot time, active keyboards) without a declared reason

This audit cannot be finished on Linux. The manifests inside `node_modules` are not a substitute for the copies Xcode embeds.

## Retention

Receipt files in UploadThing are deleted once they are older than 90 days by the daily cron (`/api/cron/cleanup-old-receipts`, 03:00 UTC, `RETENTION_DAYS = 90`). The route pages with `listReceiptFiles` (`LIST_PAGE_SIZE = 500`), stops after `MAX_PAGES` (50) or `MAX_ELAPSED_MS` (240000), and returns `partial: true` when it stops early. It does not sort the listing. A later run starts again at offset 0, so a bucket larger than one run can scan is not guaranteed to drop every old file on day 90. `docs/ios/backend-setup.md` still says the job lists at most 500 files per run. That sentence is out of date. Follow this file.

`CRON_SECRET` is required when `VERCEL_ENV` or `NODE_ENV` is `production`. If it is missing there, the route returns 500 and does not delete anything. When the variable is set, the caller must send `Authorization: Bearer $CRON_SECRET`. Outside production, an unset secret does not authenticate the caller. Do not describe the production route as open.

UploadThing's returned address (`ufsUrl`) is a public URL. Anyone who has it can open the file. It is sent on the operator webhook. It is not put in the share link. If `UPLOADTHING_TOKEN` is unset, parsing continues and no server copy is stored.

Operator Slack or webhook messages follow that workspace's retention, not the 90-day job.

Deletion requests emailed to the address on `/privacy` are handled within 30 days for copies we still hold. Share-link contents cannot be recalled. New Split removes the saved split and thumbnails. It does not remove `receiptSplitterSessionId` or `receiptSplitterAiConsent`. Deleting the app, or clearing the website's stored data, removes those too.

## What a webhook actually sends

`src/lib/webhook-notifications.ts`. Nothing is sent unless `WEBHOOK_URL` is set. `WEBHOOK_TYPE` defaults to Slack.

Success payload:

- Merchant, date, subtotal, tax, fees when present, tip, total, and each item's name, price, and quantity.
- Slack formats amounts with the currency symbol. The JSON payload does not include the currency code. Do not tell a user the JSON body contains the currency code.
- File name, MIME type, and the UploadThing URL when the upload worked.
- Session id, LLM provider and model, pasted `sourceUrl` when the receipt came from a link, `clientPlatform` (`web` or `ios`), and `clientVersion` when the client sent one.
- Geolocation object (country, region, city, latitude, longitude). Slack renders city, region, and country only.

Error payload (`sendErrorNotification`): the comment at the top of the file matches the code. Parsed item names and prices are omitted. The file URL, session id, geolocation, provider/model, pasted URL, file name, MIME type, client platform, client version, and the error text can still be included. The file URL is the image or PDF.

The public privacy policy (effective October 31, 2026) states this. The in-app consent dialog does not. See Consent below.

## On-device keys

| Key | Contents | Cleared by New Split | Mirrored to Preferences on iOS |
| --- | --- | --- | --- |
| `receiptSplitterSession` | Current split: receipts, people, groups, assignments, tab | Yes | Yes (`receiptSplitter` prefix) |
| `receiptSplitterThumbnails` | Receipt thumbnails | Yes | Yes |
| `receiptSplitterImage` | Legacy full-size image; removed when thumbnails migrate | Yes, if present | Yes |
| `receiptSplitterSessionId` | Reused parse session id | No | Yes |
| `receiptSplitterAiConsent` | `{ version }` of the accepted disclosure | No | Yes |
| `theme` | `light`, `dark`, or `system` | No | No (prefix does not match) |

iOS copies prefixed keys through Capacitor Preferences (UserDefaults, reason CA92.1). Preferences wins over WebView localStorage on launch. Safari's website data is not imported.

## Code checked against this page

Checked 2026-10-31 in this worktree, by reading the handlers, not by submitting the form.

- Default model provider is Anthropic (`DEFAULT_PROVIDER` in `src/lib/llm/index.ts`, model `claude-haiku-5-5` unless `RECEIPT_LLM_MODEL` is set). OpenAI and OpenRouter are used only when `RECEIPT_LLM_PROVIDER` says so. OpenRouter forwards the image upstream.
- `@vercel/analytics` and `@vercel/speed-insights` are imported only from `src/app/layout.tsx`. `src/mobile/main.tsx` does not import them. A `dist-mobile` build was not produced in this pass. Re-check the built bundle before you answer Connect.
- Firecrawl (`src/lib/receipt-screenshot.ts`) receives the pasted URL. This server downloads the screenshot Firecrawl returns and does not open the user's URL itself.
- The parse client always sends `X-Client-Platform` (`web` or `ios`) and sends `X-Client-Version` when the mobile build has `VITE_APP_VERSION`.
- Ko-fi is not rendered on iOS (`showKofi: false` in `src/mobile/native/platform.ts`). The website still links to Ko-fi.
