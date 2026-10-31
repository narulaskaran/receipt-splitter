# App Store checklist

Work through this on a Mac with the Apple account that will own the app. Nothing in this list was done in App Store Connect. Every item is UNVERIFIED.

Bundle id in the repo today: `app.receiptsplitter.ios` (`capacitor.config.ts` and `PRODUCT_BUNDLE_IDENTIFIER`). It is a placeholder until it is reserved. If you change it, change the Xcode target, `appId`, and the StoreKit product-id prefix together.

The Xcode project sets `TARGETED_DEVICE_FAMILY = 1` and sets `SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD`, `SUPPORTS_XROS_DESIGNED_FOR_IPHONE_IPAD`, and `SUPPORTS_MACCATALYST` to `NO`.

## Account and record

- [ ] UNVERIFIED: Enroll in the Apple Developer Program as an individual. The public seller name is your legal name. [Enrollment](https://developer.apple.com/programs/enroll/).
- [ ] UNVERIFIED: Turn on account recovery (a second factor and a reachable Apple ID email).
- [ ] UNVERIFIED: Reserve the bundle id `app.receiptsplitter.ios` (or the id you actually ship) as an explicit App ID, with In-App Purchase enabled.
- [ ] UNVERIFIED: Create the App Store Connect record for Receipt Splitter, English (U.S.) primary language, category something like Utilities or Finance. Confirm the category against the current list.
- [ ] UNVERIFIED: Worldwide availability in every storefront that does not need an extra filing. Do not default to US-only.
- [ ] UNVERIFIED: iPhone only. In pricing and availability, turn **Mac** (Designed for iPhone) **off** and **Apple Vision** **off**, matching the pbxproj flags above.
- [ ] UNVERIFIED: Declare EU Digital Services Act trader status. Individual membership does not decide this. If you are a trader, the public contact details must match `/support`. [EU trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/).
- [ ] UNVERIFIED: Open China mainland compliance information. If a filing is required and you will not file, remove the China mainland storefront only. [China requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/view-china-mainland-compliance-information/).
- [ ] UNVERIFIED: Complete the age-rating questionnaire from [listing.md](listing.md). Record the rating Connect assigns. Do not guess it, and do not select Made for Kids.
- [ ] UNVERIFIED: Export compliance. `ITSAppUsesNonExemptEncryption` is `false` in `Info.plist` because the app uses HTTPS only (exempt encryption). Answer Connect's encryption question the same way. This does not cover a future custom crypto library.
- [ ] UNVERIFIED: Set the privacy policy URL to `https://split.narula.xyz/privacy` and the support URL to `https://split.narula.xyz/support`; if the production host changes, update `DEFAULT_PUBLIC_ORIGIN`, `NEXT_PUBLIC_SHARE_ORIGIN` and `VITE_API_ORIGIN`/`VITE_PUBLIC_ORIGIN` together. Confirm both URLs load before you submit. `NEXT_PUBLIC_SUPPORT_EMAIL` should be set on that deployment so the pages show a real address.
- [ ] UNVERIFIED: Recheck Apple's minimum Xcode and SDK for upload. Deployment target 26.0 is not that requirement. They move independently. [Submission guide](https://developer.apple.com/app-store/submitting/).

## Icon, launch screen, screenshots

`node scripts/generate-ios-assets.mjs` writes an opaque 1024×1024 `AppIcon-512@2x.png` by flattening `assets/app-icon.png` onto `PWA_BACKGROUND_LIGHT` (`#f3f3f5` in `src/lib/pwa.ts`, the light `--background`). The Capacitor default icon and splash were replaced. Sharp's opacity check ran on Linux. The asset catalog was not opened in Xcode.

- [ ] UNVERIFIED: In Xcode, confirm the app icon has no alpha and no transparent corners, and that the launch screen (`LaunchScreen.storyboard`, image set `Splash`) shows the generated splash rather than the Capacitor default.
- [ ] UNVERIFIED: Capture the iPhone screenshot sizes App Store Connect lists as required for this version (recently the 6.9-inch and 6.5-inch classes; recheck the form). Use a sample receipt. Do not include a Mac or iPad screenshot.
- [ ] UNVERIFIED: Listing text pasted from [listing.md](listing.md), including the character counts. Promotional text, description, and keywords must match that file. Do not add a price or another platform.

## Review notes

- [ ] UNVERIFIED: Paste the Notes block from [review-notes.md](review-notes.md) into App Review Information. Attach `e2e/fixtures/sample-receipt.png`. Replace the contact placeholder with the same address `/support` shows. There is no demo account. The reviewer needs a network path to the production API for the whole review.

## Before you upload

- [ ] UNVERIFIED: `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` match the build you archive. See [release.md](release.md).
- [ ] UNVERIFIED: Privacy answers match [privacy.md](privacy.md), including the manifest reconciliation.
- [ ] UNVERIFIED: The three consumables from [tips.md](tips.md) are attached to this version, and the Paid Apps Agreement is active.
- [ ] UNVERIFIED: Archive, upload, and submit the app and the in-app purchases together. Fix any review findings with a new build. Release manually after approval. Install the live build once and run the short path in [manual-verification.md](manual-verification.md).

## Go / No-Go

Every box is open. None of this was done in App Store Connect, and this pass did not sign a build or run it on a device. Do not press Submit while any box is empty. "How to verify" is the check, not a claim that it passed.

### Karan (Apple Developer account)

- [ ] Enroll as an individual. The public seller name is the legal name on that membership. Verify: App Store Connect shows that name, and the copyright line in [listing.md](listing.md) matches it. If it does not, change the copyright line before you paste it.
- [ ] Account recovery is on (a second factor, and an Apple ID email you can still open). Verify: sign-in from a second device works.
- [ ] Paid Apps Agreement is Active, and banking and tax are complete. Verify: Business section in App Store Connect shows the agreement as Active. Tips cannot be submitted before that.
- [ ] Bundle id `app.receiptsplitter.ios` (or the id you actually ship) is an explicit App ID with In-App Purchase enabled. Verify: Certificates, Identifiers & Profiles shows that App ID, and the Xcode target, `appId`, and StoreKit product-id prefix are the same string.
- [ ] App Store Connect record exists. Primary language English (U.S.). Primary category Finance, secondary Utilities, unless the live category list uses different names. Verify: App Information shows those values.
- [ ] Availability is worldwide except a storefront you deliberately removed. iPhone only. Mac (Designed for iPhone) off. Apple Vision off. Verify: Pricing and Availability matches the pbxproj flags (`TARGETED_DEVICE_FAMILY = 1`, the three `SUPPORTS_*` flags `NO`).
- [ ] EU DSA trader status is chosen. This repo does not choose it. If you are a trader, the public contact details match the email on `/support`. Verify: the DSA form is saved, and a trader declaration uses the same email the production support page shows.
- [ ] China mainland compliance is opened. Either the filing is done, or only that storefront is removed. Verify: the compliance page has no unfinished blocker, and the availability list matches the decision.
- [ ] Age rating questionnaire is answered from [listing.md](listing.md). Made for Kids is not selected. No override. Verify: you wrote down the rating Connect calculated. Do not invent 4+.
- [ ] Export compliance matches `ITSAppUsesNonExemptEncryption` = false (HTTPS only). Verify: the upload was not held for a missing encryption answer, and you did not claim a custom crypto exemption you do not have.
- [ ] Content rights: the app does not use a third-party content catalog. Verify: the content-rights question is answered No.
- [ ] Name, subtitle, promotional text, description, keywords, What's New, and copyright are pasted from [listing.md](listing.md). Verify: Connect's counters match the table in that file (name 16, subtitle 25, promotional text 146, description 1491, keywords 98, What's New 166).
- [ ] Support URL `https://split.narula.xyz/support`, marketing URL `https://split.narula.xyz`, privacy URL `https://split.narula.xyz/privacy`. Verify: each URL loads in a browser that is not logged into Vercel, and `/privacy` says effective October 31, 2026.
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL` is set on the production deployment, and App Store Connect uses that same address. Verify: `/support` and `/privacy` show the address, not "the contact address listed in the App Store listing".
- [ ] The three consumables exist, with the product IDs, reference names, display names, and descriptions in [listing.md](listing.md), prices chosen, review screenshots attached, and the products added to this version. Verify: each product is Ready to Submit and the version page lists all three.
- [ ] App Privacy answers match [privacy.md](privacy.md) after the manifest reconciliation below. Tracking is off. No ATT prompt. Verify: the nutrition label preview matches the table, including phone number linked to identity, and Product Interaction is absent unless you actually shipped analytics in the iOS binary.
- [ ] Review notes are the Notes block from [review-notes.md](review-notes.md), with the contact address filled in, and `e2e/fixtures/sample-receipt.png` attached. Verify: the notes mention no login, the Cafe Mocha fixture, sandbox tips, and the consent dialog.
- [ ] Screenshots are the sizes Connect lists as required for this version, iPhone only, using a real receipt, with the captions in [listing.md](listing.md). Verify: the form has no missing-size warning, and no iPad or Mac image was uploaded.
- [ ] Icon and launch screen in the archive are the generated opaque assets, not the Capacitor defaults. Verify: Xcode's asset catalog shows no alpha on the 1024 icon, and the launch storyboard uses the generated splash.
- [ ] You will release manually after approval. Verify: the version is set to manual release before you submit. This box is the setting, not the later release itself.

### Engineering (the build you upload)

- [ ] `PrivacyInfo.xcprivacy` no longer lists Product Interaction, unless `@vercel/analytics` or Speed Insights was added to the iOS bundle on purpose and `/privacy` was updated in the same release. Verify: the plist and a grep of `dist-mobile` for `@vercel/analytics` and `@vercel/speed-insights`. Today the source imports those packages only from `src/app/layout.tsx`. This pass did not build `dist-mobile`.
- [ ] Coarse location in the manifest and in Connect is App Functionality and Analytics, not tracking, not linked. Phone number is declared if you follow [privacy.md](privacy.md). Verify: the two forms list the same types.
- [ ] Embedded SDK privacy manifests were opened on a Mac after `npx cap sync ios`. Verify: the checklist in [privacy.md](privacy.md) under required-reason APIs. This cannot be finished on Linux.
- [ ] `CONSENT_VERSION` is still 1, or it was bumped in the same change as any edit to what the consent dialog promises. The dialog still does not name Firecrawl, and it says the operator is notified even though that happens only when `WEBHOOK_URL` is set. Verify: read `src/components/ai-consent-dialog.tsx` against `/privacy`. Decide before submit whether that gap is acceptable because the dialog links to the policy. Do not ship a rewritten dialog on the old version.
- [ ] On a device, decline consent and confirm no parse request leaves the phone. Accept, and a parse succeeds. Verify: a proxy or the server log, not a guess.
- [ ] Ko-fi is absent on the iPhone build. The tip sheet is StoreKit only. Verify: the support banner on a signed build has "Leave a tip" and no `ko-fi.com` link. `showKofi` is false in `src/mobile/native/platform.ts`.
- [ ] Production has `CRON_SECRET` set. A call to `/api/cron/cleanup-old-receipts` without the bearer token returns 401. An unset secret in production returns 500 and does not delete. Verify: one unauthenticated request, and the Vercel env page shows the variable.
- [ ] The WAF rule covers `POST /api/parse-receipt` and `POST /api/v1/parse-receipt`. Verify: [backend-setup.md](backend-setup.md), then a burst from a phone that receives 429.
- [ ] `NATIVE_APP_ORIGINS` includes `capacitor://localhost`. `VITE_API_ORIGIN` and `VITE_PUBLIC_ORIGIN` on the mobile build are `https://split.narula.xyz` (or the host you actually ship). Verify: a parse from the iOS app succeeds, and a browser on another origin cannot call the v1 route.
- [ ] `UPLOADTHING_TOKEN` is set if you are telling users a server copy is kept for 90 days. `WEBHOOK_URL` points at a private channel. Verify: one successful parse produces a private notification, and the file URL in it is the one you expect.
- [ ] `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` match the archive, in both Debug and Release. `VITE_APP_VERSION` is that marketing version. Verify: the Xcode project and the `X-Client-Version` header on a parse from the app.
- [ ] TestFlight on a physical iPhone completed [manual-verification.md](manual-verification.md), including camera, offline reopen, sandbox tips bought twice, and Venmo missing. Verify: the checklist in that file, filled in by the person who held the phone. A simulator and a Linux test run do not check this box.
- [ ] `/privacy` and `/support` on production are the October 31, 2026 copy, including the reused session id, Firecrawl, the public file URL, the webhook fields, and that the iPhone app does not show Ko-fi. Verify: load both URLs after the production deploy.
