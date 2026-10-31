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
- [ ] UNVERIFIED: Complete the age-rating questionnaire from the real behavior: no ads, no unrestricted in-app browser as the product, user-generated names only inside a share link the sender creates, optional web handoff to Venmo. Record the rating Connect assigns. Do not guess it here.
- [ ] UNVERIFIED: Export compliance. `ITSAppUsesNonExemptEncryption` is `false` in `Info.plist` because the app uses HTTPS only (exempt encryption). Answer Connect's encryption question the same way. This does not cover a future custom crypto library.
- [ ] UNVERIFIED: Set the privacy policy URL to `https://split.narula.xyz/privacy` and the support URL to `https://split.narula.xyz/support`; if the production host changes, update `DEFAULT_PUBLIC_ORIGIN`, `NEXT_PUBLIC_SHARE_ORIGIN` and `VITE_API_ORIGIN`/`VITE_PUBLIC_ORIGIN` together. Confirm both URLs load before you submit. `NEXT_PUBLIC_SUPPORT_EMAIL` should be set on that deployment so the pages show a real address.
- [ ] UNVERIFIED: Recheck Apple's minimum Xcode and SDK for upload. Deployment target 26.0 is not that requirement. They move independently. [Submission guide](https://developer.apple.com/app-store/submitting/).

## Icon, launch screen, screenshots

`node scripts/generate-ios-assets.mjs` writes an opaque 1024×1024 `AppIcon-512@2x.png` by flattening `assets/app-icon.png` onto `PWA_BACKGROUND_LIGHT` (`#f3f3f5` in `src/lib/pwa.ts`, the light `--background`). The Capacitor default icon and splash were replaced. Sharp's opacity check ran on Linux. The asset catalog was not opened in Xcode.

- [ ] UNVERIFIED: In Xcode, confirm the app icon has no alpha and no transparent corners, and that the launch screen (`LaunchScreen.storyboard`, image set `Splash`) shows the generated splash rather than the Capacitor default.
- [ ] UNVERIFIED: Capture the iPhone screenshot sizes App Store Connect lists as required for this version (recently the 6.9-inch and 6.5-inch classes; recheck the form). Use a sample receipt. Do not include a Mac or iPad screenshot.
- [ ] UNVERIFIED: Listing text: what the app does (split a receipt, no account), that tips are optional, and that a network connection is required to read a new receipt.

## Review notes

Paste something in this shape, and attach a sample receipt image the reviewer can photograph or import. UNVERIFIED until it is actually submitted.

1. Allow the camera, or choose the attached receipt from Photos. A two-item restaurant receipt is enough (one item each for two people).
2. Add two people, assign both items, and open Results.
3. Share without a Venmo number. Open the link and confirm both amounts.
4. Share again with a US Venmo test number and confirm the Venmo button. If Venmo is not installed, the app should explain that rather than failing silently.
5. Turn on Airplane Mode, force-quit, reopen, and edit the tip. The split should still be there. Parsing a new photo should fail clearly.
6. The tip buttons are optional and do not change the split. Decline a purchase and confirm the app still works.
7. Privacy policy: `https://split.narula.xyz/privacy`. Support: `https://split.narula.xyz/support`.

There is no demo account. The reviewer needs a network path to the production API, or a TestFlight build pointed at a backend you can keep up during review.

## Before you upload

- [ ] UNVERIFIED: `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` match the build you archive. See [release.md](release.md).
- [ ] UNVERIFIED: Privacy answers match [privacy.md](privacy.md), including the manifest reconciliation.
- [ ] UNVERIFIED: The three consumables from [tips.md](tips.md) are attached to this version, and the Paid Apps Agreement is active.
- [ ] UNVERIFIED: Archive, upload, and submit the app and the in-app purchases together. Fix any review findings with a new build. Release manually after approval. Install the live build once and run the short path in [manual-verification.md](manual-verification.md).
