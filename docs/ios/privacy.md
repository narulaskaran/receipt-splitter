# App Privacy label

Answers below are derived from the website and the iOS client as they behave in this repo. They are the answers to type into App Store Connect. The form itself was not filled in. UNVERIFIED.

Tracking is **none**. Do not add an App Tracking Transparency prompt. The app does not contact a data broker, does not combine data with other companies' data for ads, and does not share data for cross-app advertising. Analytics, if you add it later, does not by itself require ATT. Re-read [Apple's privacy guidance](https://developer.apple.com/app-store/user-privacy-and-data-use/) before submission.

There is no account. Receipt photos are not tied to an account.

## Data types

| Data | Collected | Linked to identity | Tracking | Purpose | Why |
| --- | --- | --- | --- | --- | --- |
| Photos or Videos | Yes | No | No | App Functionality | The receipt image or PDF is sent to the API when the user agrees to parse it. |
| Other User Content | Yes | No | No | App Functionality | Parsed line items, and the pasted receipt URL. |
| Coarse Location | Yes | No | No | Analytics | Vercel derives city, region, country, and coordinates from the request IP. It is included on operator webhook notifications. It is not GPS, and the app must not request location permission. A location-permission string would not disclose this. |
| Phone Number | Yes, only if the sender puts a US Venmo number in a share link | Yes | No | App Functionality | The number sits in the `/split` query string. Anyone with the link can read it. Opening the link sends it to the host in the URL. There is no account, but the number itself identifies a person, so answer **linked**. |
| Product Interaction | No, for the iOS app | — | — | — | `@vercel/analytics` and `@vercel/speed-insights` are mounted in `src/app/layout.tsx` (the Next.js website). They are not part of the static iOS bundle. Do not declare product interaction for the iPhone app unless you add analytics to that bundle. |

The session id sent with a parse request is a random id for that attempt, not an account id and not an advertising identifier. It leaves the device inside the parse request and the operator notification. Do not declare it as a user ID. If Connect's form has no better bucket, leave it under the receipt-content disclosure rather than inventing a device identifier.

Names and amounts in a share link are the same "other user content" case as the receipt text, and they are visible to anyone who has the link.

`ios/App/App/PrivacyInfo.xcprivacy` is marked DRAFT in the file. It currently lists Product Interaction and a coarse-location analytics purpose. Before upload, reconcile it with this table:

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

**Processor change means a new consent.** Switching the default from Anthropic to OpenAI or OpenRouter, adding a processor, or changing what is sent requires a bump of `CONSENT_VERSION` so a previous acceptance is not reused. Shipping the new provider behind the old version is a bug.

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

Receipt files in UploadThing are deleted after 90 days by the daily cron (`/api/cron/cleanup-old-receipts`, 03:00 UTC). The route lists at most 500 files per run. Confirm that cap is enough, or that pagination exists, before relying on it. See [backend-setup.md](backend-setup.md).

`CRON_SECRET` must be set in production. The handler checks the bearer token only when the variable is set. Unset, the route does not authenticate the caller.

Operator Slack or webhook messages follow that workspace's retention, not the 90-day job.

Deletion requests emailed to the address on `/privacy` are handled within 30 days for copies we still hold. Share-link contents cannot be recalled. On-device data is cleared with New Split or by deleting the app.
