# Receipt Splitter: iOS launch and maintenance

Scope agreed 2026-10-24. Work plan only; no native implementation exists yet.

## Scope

- **Capacitor with bundled assets; iPhone only; iOS 26+.** Share React UI/state/calculations with web; keep Next.js/Vercel hosting web and the API. Revisit Swift only for a compelling limitation.
- **Maintain parity:** existing receipt workflows, PDF import, Venmo, storage/webhooks, and analytics remain. Add native camera/photo import; retain URL paste and offline editing. Replace Ko-fi with optional StoreKit tips in iOS; retain Ko-fi on web. Adapt device behavior without a broader redesign.
- **Worldwide launch** in eligible App Store regions, with the existing English UI. Resolve specific regional requirements; exclude affected storefronts only if necessary. No identified reason to default to US-only.
- **Individual Apple membership:** your legal name is the public seller name. Develop on Linux; use the network-accessible MacBook Air for native builds when needed, with manually initiated builds/releases. Occasional GitHub Releases mark iOS updates; web keeps automatic deployments. [Enrollment](https://developer.apple.com/programs/enroll/)
- **Deferred:** incoming native Share Extension in v2; Android, translations, and build automation later. No accounts, cloud sync, subscriptions, or additional payment providers.

## Existing offline behavior

Source inspection confirms parsed receipts, people/groups, assignments, and active tab persist locally through [page.tsx](src/app/page.tsx) and [session-persistence.ts](src/lib/session-persistence.ts); thumbnails also use localStorage. Editing/calculation is local; new receipt/URL parsing requires connectivity. Optional server receipt storage/webhooks remain separate from local session data.

The [production precache](src/app/serwist/[path]/route.ts) includes page shells, scripts, styles, and fonts: web can reopen offline after successful caching. Bundled assets supply that shell on iOS. Preserve this behavior and verify it on devices; no offline parsing/sync system is needed. Use a small native-backed persistence adapter because WebView storage can be evicted; preserve migrations and load saved data before autosave. Safari data does not automatically transfer into the app. [Storage guidance](https://capacitorjs.com/docs/guides/storage)

## Build work

- [ ] **Shared client:** extract React screens/state from Next pages; add a static mobile entrypoint importing shared modules/styles/assets. Adapt Next routing/fonts at entrypoints; keep Serwist/PWA share-target code on web and server modules/secrets out of mobile. No UI rewrite or monorepo required.
- [ ] **API boundary:** centralize fetches: same-origin web, configured HTTPS backend on mobile. Expose/document `/api/v1/parse-receipt`, retain the old route, and reuse handler/schema. Add native-origin CORS/preflight/error headers. Extend the external WAF rule to both paths; verify native access, limits, URL safety, timeouts, and errors. CORS/session IDs are not authentication.
- [ ] **International sharing:** use the public web domain instead of `window.location.origin` for `/split` links. Current UI/serialization/parsing requires a US-format Venmo phone number: permit links without payment details on both platforms while reading old links. Keep Venmo optional and retain supported-currency calculations. [Venmo availability](https://help.venmo.com/cs/articles/signing-up-for-a-personal-account-faq-vhel187)
- [ ] **Native foundation:** add Capacitor/iOS/plugins, commit native configuration, set deployment target **26.0**, and document asset build → `cap sync ios` → Xcode. Bundle release assets; remove development server settings. [Capacitor configuration](https://capacitorjs.com/docs/config)
- [ ] **Device workflows:** native camera/photos, HEIC/orientation/compression handling, permission descriptions, cancellation/denial; retain PDF import and URL paste. Add native sharing/clipboard and external Venmo/browser handoff, including missing-app handling.
- [ ] **Polish/storage:** safe areas, keyboard/scroll behavior, status bar, touch targets, VoiceOver/text scaling, themes, durable sessions/thumbnails, clear-local-data behavior, and background/relaunch recovery. Preserve offline editing and web behavior.
- [ ] **Tip jar:** consumable StoreKit products via a Capacitor bridge; optional repeatable tips, no feature unlocks. Configure product availability and localized prices; handle verified transaction completion, pending/cancelled/failed purchases, and unavailable products. Test repeated tips in sandbox/TestFlight; submit initial products with the app. Complete Paid Apps Agreement, banking, and tax setup. [IAP setup](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/)

Main technical costs: sharing UI across entrypoints, native integrations/persistence, StoreKit, and compatibility with older installed clients.

## Privacy, approval, and regional checks

- [ ] **AI/data:** retain configured backend features; publish in-app privacy/support links describing processors, receipts/URLs, webhooks, IP-derived location, analytics, share-link contents, retention/deletion, and recipients. Obtain explicit permission before third-party AI receives personal data; keep processor changes consistent with consent. [Guideline 5.1.2](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)
- [ ] **Retention/access:** review public receipt URLs and receipt-content notifications; document existing 90-day retention, fix cleanup's single 500-file listing, configure `CRON_SECRET`, and avoid sensitive diagnostic payloads. Disclose IP-derived location; GPS permissions do not address server-side collection.
- [ ] **Analytics/privacy metadata:** verify/adapt current Vercel integrations for the static entrypoint. Audit SDK privacy manifests/required-reason APIs and complete App Privacy answers. Determine ATT from actual tracking behavior; analytics alone does not imply an ATT prompt. [Apple privacy guidance](https://developer.apple.com/app-store/user-privacy-and-data-use/)
- [ ] **Tips/utility:** remove Ko-fi from iOS; keep splitting free/accountless. Demonstrate capture → split → share and offline editing; Capacitor/plugins alone do not guarantee approval. Apple permits developer tips through IAP. [Guidelines 3.1.1 and 4.2](https://developer.apple.com/app-store/review/guidelines/)
- [ ] **Regions:** declare EU DSA trader status and verify public contact details if applicable; individual membership does not settle trader status. Check storefront-specific filings, including China mainland. Restrict only affected storefronts if necessary. [EU requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/), [China requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/view-china-mainland-compliance-information/)

## Launch acceptance

- [ ] Enroll individually, reserve bundle ID, create App Store Connect record, configure signing/account recovery, and install compatible Xcode/macOS. Configure iPhone and Mac/Vision Pro availability explicitly. Recheck SDK upload requirements separately from deployment target 26.0.
- [ ] Extend CI for shared logic, API contracts, and web/mobile asset builds. Cover rounding/currencies, session migrations, old/new share links, and adapters. Test signed builds on iPhone/simulators covering iOS 26 and latest supported iOS: imports, multiple receipts, edits/calculations, sharing with/without Venmo, tips, permissions, network/API failures, offline reopening, relaunch, and upgrades retaining data. Verify web/PWA parity; browser tests cannot verify native plugins.
- [ ] Run TestFlight; resolve feedback. Prepare opaque icon/launch assets, required screenshots, listing text/category, privacy/support URLs, age rating, export compliance, regional information, accessibility claims, and sample receipt/review steps. Archive/sign/upload, submit app/IAPs, address findings, manually release after approval, and verify live installation. [Submission guide](https://developer.apple.com/app-store/submitting/)

## Release and maintenance

1. Merge tested changes to main; web deploys and provides early feedback while remaining usable production software. **Shared API changes affect installed apps immediately**, so freezing mobile UI does not freeze its backend.
2. When ready, set version/build numbers and tag the candidate commit (`ios-v1.0.0-rc.1`). From Linux, check out that revision in a dedicated Mac build directory over SSH, install dependencies, build/sync assets, and invoke Xcode's command-line tools; test through TestFlight. Fixes get new candidate tags/builds; do not move tested tags.
3. Submit manually; record commit, build, toolchain, and notes in a draft GitHub Release. Once approved/available, publish it with a final tag (`ios-v1.0.0`) pointing to the tested commit. Releases do not automatically build/submit anything. [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
4. Keep v1 API changes additive; deploy support before mobile features. Check the oldest supported app against staging. Preserve stored sessions/link formats; define eventual deprecation without blocking saved offline splits. Web/backend rollback must remain compatible; faulty installed binaries need corrective releases.
5. Monitor parsing failures/cost, native crashes, retention, and dependencies. Even during quiet months, retain alerts/reminders for membership, credentials, SDK/policy deadlines, and OS compatibility. Those may require maintenance releases without new features.

Verify the Mac's SSH hostname/user, connectivity, Xcode, and signing access before relying on remote builds. The laptop must be awake/reachable during builds; initial signing/Keychain setup and interactive debugging may need local attention. Routine work stays on Linux. Hosted macOS CI remains an optional later replacement for the laptop. [Command-line builds](https://developer.apple.com/library/archive/technotes/tn2339/_index.html)

**Linux alternative tested 2026-10-30:** xtool 1.24.0 runs on Beelink; Capacitor 8.6 and camera/share/preferences/app dependencies resolve, including a separate SwiftPM app wrapper. Native compilation remains unverified: Apple's SDK download needs sign-in, deferred for now. The stock Xcode app is not direct xtool input, and xtool's built-in signer creates development profiles. Treat it as an optional experiment until compilation, device/StoreKit behavior, and distribution signing/TestFlight are verified. [Signing implementation](https://github.com/xtool-org/xtool/blob/1.24.0/Sources/XKit/DeveloperServices/Profiles/DeveloperServicesFetchProfileOperation.swift)

## Parallel handoff

**Initial deliverable:** implement the repository work end to end and open a draft PR using available Linux checks. Xcode/Apple SDK, signing credentials, and device access are unavailable for now; do not block the draft on them. List native compilation, physical-device/StoreKit checks, Apple account setup, and store submission as unverified/manual follow-ups. Do not claim a production-ready or submitted app.

Agree API/platform-adapter contracts first; assign separate worktrees and clear ownership:

- **Shared client:** extraction, static build, adapter interfaces, non-Venmo sharing, browser regressions.
- **Backend:** API/CORS, WAF coordination, retention/access, contract tests; can proceed alongside extraction.
- **iOS:** project, device/storage adapters, StoreKit; consumes shared contracts/build. Coordinate root dependency/lockfile edits with client owner.
- **Store/release:** privacy/listing materials, Apple checklist, release instructions; can proceed alongside engineering. Account-holder actions and signed device/TestFlight checks remain manual.

One integrator resolves overlaps and validates both platforms. Later Android reuses these boundaries; its native project, signing/Play setup, navigation/permissions, and device/store checks remain deferred.
