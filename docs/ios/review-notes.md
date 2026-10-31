# App Review notes

Paste the block under "Notes" into App Review Information. Attach `e2e/fixtures/sample-receipt.png` from this repo. There is no demo account. The build must be able to reach the production API at `https://split.narula.xyz` for the whole time the app is in review.

Replace `CONTACT` with the same address you set as `NEXT_PUBLIC_SUPPORT_EMAIL`. Until that variable is set, `/privacy` and `/support` show the words "the contact address listed in the App Store listing" instead of an email. Do not submit while that placeholder is what the pages show.

## Notes

```
No login. Splitting is free and does not require an account.

Sample receipt (attached): e2e/fixtures/sample-receipt.png in the repository.
It is a short Cafe Mocha receipt dated 2024-01-15: Latte 5.00, Muffin 5.00,
subtotal 10.00, tax 1.00, total 13.00. There is no tip line on the image.
You can photograph the attached image, or import it from Photos.

1. Allow the camera, or choose the attached receipt from Photos. You can also
   import a PDF, or paste a public receipt link. The first time, the app asks
   before it sends the receipt. If you tap "Don't send", nothing is uploaded.
   Tap "Agree and continue" to read this receipt.
2. Check the items. Add two people. Assign Latte to one and Muffin to the other.
   Open Results. The two shares plus tax should add up to the total.
3. Share without a phone number. Open the link. Both amounts are visible.
   Venmo is not required.
4. On a US-dollar split, share again with a US Venmo test number. The link
   shows a Venmo action. If Venmo is not installed, the app says so. The amount
   is still readable.
5. Turn on Airplane Mode, force-quit, and reopen. The split is still there.
   Edit the tip. Totals update. Trying to read a new photo fails with a clear
   offline message.
6. Tips are optional consumable in-app purchases (Small, Medium, Large). They
   do not change the split and do not unlock anything. In sandbox, sign in
   with a Sandbox Apple ID (Settings > Developer or App Store > Sandbox
   Account). Buy the small tip, then buy it again. Both should complete.
   Cancel the payment sheet and confirm the app still works. A pending
   purchase (Ask to Buy) shows "Waiting for approval…" and unlocks nothing.

The consent dialog ("Send this receipt to be read?") is the permission step
before a receipt image, PDF, or pasted link leaves the device. Declining
sends nothing. The privacy policy linked from that dialog is the full list
of recipients.

Privacy: https://split.narula.xyz/privacy
Support: https://split.narula.xyz/support
Contact: CONTACT
```

## How to try the sample

The image is `e2e/fixtures/sample-receipt.png`. It is a generated fixture, not a photo of a real card or a real person. Attach that file to the review notes so the reviewer does not have to find a receipt. Two people and one item each is enough.

Pasted links are optional. A reviewer does not need one. If they try a link, it has to be a public page. The server asks Firecrawl for a screenshot. A login page will fail, and the app tells them to upload a screenshot instead.

## Sandbox tips

The three product IDs are in `src/lib/tip-products.ts`:

- `app.receiptsplitter.ios.tip.small`
- `app.receiptsplitter.ios.tip.medium`
- `app.receiptsplitter.ios.tip.large`

They are consumables, so a second purchase of the same product is the success case, not a bug. The iPhone app does not show Ko-fi. The website does. A reviewer on the iPhone build should not see an external tip link.

Local `ios/App/Tips.storekit` prices (0.99 / 2.99 / 4.99 USD) are for Xcode. Sandbox charges whatever you set in App Store Connect.

## What the consent dialog is

`src/components/ai-consent-dialog.tsx` asks "Send this receipt to be read?" before a parse. Agree stores `receiptSplitterAiConsent` with `CONSENT_VERSION` (currently 1) and the request proceeds. Don't send, or dismissing the dialog, stores nothing and uploads nothing. A later parse on the same install reuses that acceptance until `CONSENT_VERSION` is increased.

The dialog says the image, PDF, or pasted link goes to our server and an AI provider (Anthropic by default), that the server may keep a copy for about 90 days, that the operator is notified, and that an approximate location comes from the IP address. It links to `/privacy` and `/support`. The privacy policy is the complete recipient list, including Firecrawl for pasted links. The dialog itself does not say the name Firecrawl. See [privacy.md](privacy.md).

## Anticipated questions

### 4.2 Minimum functionality

This is a bundled Capacitor app. It does not load the website in a web view as the product, and `capacitor.config.ts` has no `server.url`. Native behavior in this build:

- Camera capture through Capacitor Camera, only after the user taps to take a photo (`NSCameraUsageDescription`). HEIC is converted and orientation is corrected.
- Photo library import through `Camera.pickImages` (`NSPhotoLibraryUsageDescription`).
- PDF import through the system document picker (the file input). It does not use the camera permission.
- Outgoing system share sheet through Capacitor Share, for the split link and for a text summary. An incoming Share Extension is not in this version. Do not describe one. It is deferred.
- Offline editing of a split that is already on the device. Parsing a new receipt needs the network.
- StoreKit consumable tips. They do not unlock features.
- On-device persistence. Keys prefixed `receiptSplitter` are mirrored to Capacitor Preferences (UserDefaults) so a cleared web view does not drop a saved split. The app does not read Safari's data.

Parsing, tax and tip math, and the share link are all in the app. The server is used to read a new receipt image.

### 5.1.1 and 5.1.2 Data use and AI consent

There is no account. The app asks before a receipt is sent. Decline and no parse request is made.

Recipients, when the user agrees: the API host (Vercel), the configured model provider (Anthropic by default; OpenAI or OpenRouter only if the operator switches), Firecrawl when the user pasted a link, UploadThing when file storage is configured, and a Slack or JSON webhook when the operator configured one. The webhook can include the receipt contents, a public file URL, the session id, IP-derived location, the model name, the pasted URL, and the client platform and version. Details are on `/privacy`.

The iPhone binary does not include Vercel Web Analytics or Speed Insights. Those run on the website only. Do not add an App Tracking Transparency prompt. There is no ad tracking.

Location is coarse and derived from the request IP by Vercel. The app does not request location permission. A location purpose string would not disclose this.

Before upload, the privacy manifest must match [privacy.md](privacy.md). The committed `PrivacyInfo.xcprivacy` still lists Product Interaction. The iOS bundle does not collect that. Do not submit until that entry is removed or analytics are actually added to the iOS binary and the privacy page is updated in the same release.

The consent dialog names Anthropic and says the operator is notified. A webhook is sent only when `WEBHOOK_URL` is set, and a pasted link is also sent to Firecrawl, which the dialog does not name. The dialog links to the privacy policy, which does name Firecrawl. If you change the dialog to name Firecrawl, bump `CONSENT_VERSION` in the same change so a previous acceptance is not reused.

### 3.1.1 Payments

Tips are consumable in-app purchases. They are the only way to pay the developer inside the iPhone app. Ko-fi is hidden on iOS (`showKofi` is false on the native platform adapter). The website still shows Ko-fi. The iPhone UI does not link to it.

Venmo is not a purchase of digital goods or features. On a US-dollar split the sender can put a US phone number in the share link. The recipient can open Venmo to pay that person for the meal. The app does not take a fee, does not sell the split, and does not unlock anything when Venmo opens. Other currencies show the amount as text and do not offer Venmo. Leaving the phone number blank still shares the link.

### 1.2 User-generated content

Not applicable. Users do not post content for other people to browse inside the app. There is no feed, no profile, no comments, and no in-app messaging. A share link is a URL the sender creates and sends themselves. It contains names, amounts, a note, the currency, an optional date, an optional phone number, and, for more than one receipt, per-receipt labels and amounts. People who do not have the link cannot see it. No filtering, reporting, or blocking mechanism is required for that, and adding one would describe a product this app is not.
