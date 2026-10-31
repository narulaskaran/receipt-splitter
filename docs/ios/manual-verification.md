# Device checklist

Run this on a physical iPhone with a signed build. A simulator can cover some rows and cannot cover the camera, a real StoreKit sandbox renewal, or Venmo. Nothing here was run. Every row is UNVERIFIED.

Test on iOS 26 and on the latest iOS the current Xcode SDK supports. Browser tests do not exercise the native plugins.

- [ ] UNVERIFIED: Camera permission — Allow. A photo of a receipt parses.
- [ ] UNVERIFIED: Camera permission — Don't Allow. The app explains the denial. PDF import and link paste still work.
- [ ] UNVERIFIED: Camera permission — cancel the system sheet. No crash, no half-saved image.
- [ ] UNVERIFIED: Photo library — Allow, Limited, and Don't Allow. Limited access only offers the selected photos.
- [ ] UNVERIFIED: HEIC from the camera and from the library, including a sideways shot. The preview is upright and the parsed items match the page.
- [ ] UNVERIFIED: Import a PDF receipt.
- [ ] UNVERIFIED: Paste a public receipt URL. Paste a login-walled URL and confirm the error tells you to upload a screenshot.
- [ ] UNVERIFIED: Two receipts in one sitting. The second replaces or stacks the way the UI says it does, and totals stay in one currency.
- [ ] UNVERIFIED: Edit items, tax, and tip. Per-person totals add up to the receipt total within the usual rounding tolerance.
- [ ] UNVERIFIED: Share with a US Venmo phone number on a USD split. The link opens and shows a Venmo action.
- [ ] UNVERIFIED: Share without a phone number. The link still opens and shows the amount, with no Venmo button required.
- [ ] UNVERIFIED: Venmo is not installed. Sharing or the payment handoff fails visibly and the amount is still readable.
- [ ] UNVERIFIED: Tips, sandbox — buy the same consumable twice. Both purchases complete.
- [ ] UNVERIFIED: Tips, sandbox — leave a purchase pending (Ask to Buy or the StoreKit delayed state) and confirm the UI does not grant anything and does not charge twice on resume.
- [ ] UNVERIFIED: Tips, sandbox — cancel the payment sheet. No error loop.
- [ ] UNVERIFIED: Tips, sandbox — force a failed transaction. The app reports the failure and the split is unchanged.
- [ ] UNVERIFIED: Airplane Mode after a successful parse. Reopen the app. Edit assignments. Totals still update.
- [ ] UNVERIFIED: Force-quit and relaunch. The same split, people, and tab come back.
- [ ] UNVERIFIED: Background the app for several minutes, then return. Edits made before backgrounding are still there.
- [ ] UNVERIFIED: Install a newer build over an older one. Saved splits remain. Safari data does not need to appear inside the app.
- [ ] UNVERIFIED: Privacy consent — decline, and confirm no receipt is uploaded. Accept, and a parse request succeeds. After `CONSENT_VERSION` changes, the prompt shows again.
- [ ] UNVERIFIED: VoiceOver reaches the camera, people, assignment, share, and tip controls, and the names match the visible labels.
- [ ] UNVERIFIED: Larger Dynamic Type does not clip the totals or the primary buttons.
- [ ] UNVERIFIED: Repeat a short pass on the newest iOS you can install, not only on iOS 26.0.
