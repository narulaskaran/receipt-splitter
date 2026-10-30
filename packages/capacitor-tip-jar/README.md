# capacitor-tip-jar

Local Capacitor 8 plugin that sells **consumable** StoreKit 2 tips for Receipt Splitter. The JavaScript API lives in `src/mobile/native/tip-jar.ts` (`registerPlugin('TipJar')`). This package is the iOS implementation `npx cap sync ios` discovers from the `"capacitor"` field in `package.json`.

**This Swift has not been compiled.** There is no Xcode, Apple SDK, or simulator in the environment that added it. Treat `ios/Sources/TipJarPlugin/TipJarPlugin.swift` as uncompiled source until the checks below pass on a Mac.

## What to verify in Xcode

1. From a checkout that has run `npm install`, run `npx cap sync ios`. Confirm `ios/App/CapApp-SPM/Package.swift` depends on the `CapacitorTipJar` product, and that the gitignored `ios/App/App/capacitor.config.json` `packageClassList` includes `TipJarPlugin` (the `@objc` name). Without that sync, `NSClassFromString` will not register the plugin.
2. Open `ios/App/App.xcodeproj`, select a signing team, and build the App target for an iOS 26 simulator or device. Fix any StoreKit or Swift concurrency errors the Linux review could not see.
3. Add a StoreKit Configuration with the consumable product ids in `src/lib/tip-products.ts` (or `VITE_TIP_PRODUCT_IDS`). Products must be consumables. Confirm `getProducts` returns `displayName` and `displayPrice` in the requested id order and omits unknown ids.
4. Purchase in the StoreKit test environment:
   - Success: the transaction is `.verified`, then `Transaction.finish()` runs, and the promise resolves `{ status: "success" }`. Repeat the same product; nothing is unlocked.
   - Cancel: `{ status: "cancelled" }` and no finish.
   - Ask to Buy / pending: `{ status: "pending" }`. Approve it later and confirm `Transaction.updates` verifies, finishes, and emits `tipCompleted`.
   - Unverified result: `{ status: "failed", message: "unverified" }` and the transaction is **not** finished.
   - Launch with an unfinished verified transaction: `Transaction.unfinished` finishes it on `load()`.
5. Start two purchases quickly and confirm the second waits until the first `Product.purchase()` returns (one at a time).
6. Confirm the Paid Apps agreement and the App Store Connect products exist before TestFlight. Sandbox and a StoreKit Configuration file are not a substitute for that.

`cap sync` rewrites `ios/App/CapApp-SPM/Package.swift`. Do not hand-edit that file; change this package and sync again.
