# Tips (StoreKit)

Tips are optional consumable in-app purchases. They do not unlock features. The iPhone app uses StoreKit. The website keeps Ko-fi. Product IDs are the defaults in `src/lib/tip-products.ts`:

| Product | Product ID | Local StoreKit price |
| --- | --- | --- |
| Small tip | `app.receiptsplitter.ios.tip.small` | 0.99 USD |
| Medium tip | `app.receiptsplitter.ios.tip.medium` | 2.99 USD |
| Large tip | `app.receiptsplitter.ios.tip.large` | 4.99 USD |

The 0.99 / 2.99 / 4.99 figures are placeholders inside `ios/App/Tips.storekit` for local Xcode testing. App Store Connect prices are chosen there and can differ. Nothing has been purchased outside a local StoreKit test session.

## App Store Connect

Create three **consumable** in-app purchases on the app record. The product IDs must match the table, unless you override them (next section). Submit them with the first version of the app.

- [ ] UNVERIFIED: Create the three consumables in App Store Connect with those product IDs, a display name, and a description that says the tip is optional and does not unlock features.
- [ ] UNVERIFIED: Set the real prices and the storefronts. Availability should follow the app's storefronts.
- [ ] UNVERIFIED: Add the review screenshot App Store Connect requires for each product (a shot of the tip buttons, with the amount visible).
- [ ] UNVERIFIED: Accept the Paid Apps Agreement and complete banking and tax. Tips cannot be submitted until that agreement is active.

Reference: [Apple's in-app purchase overview](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/).

## Overriding IDs

`VITE_TIP_PRODUCT_IDS` is a comma-separated list read at the mobile build. Example:

```bash
VITE_TIP_PRODUCT_IDS=app.receiptsplitter.ios.tip.small,app.receiptsplitter.ios.tip.medium,app.receiptsplitter.ios.tip.large
```

`parseTipProductIds` in `src/lib/tip-products.ts` trims entries, drops anything that is not a short product-id token, and de-duplicates. An empty or fully invalid value keeps the three defaults. Order is the display order. If you change IDs, create the same IDs in App Store Connect and in the StoreKit file before shipping that build.

## Local StoreKit file

`ios/App/Tips.storekit` is a StoreKit configuration file in the version-3 schema Xcode writes (the same shape as other public `.storekit` files: `products[].type` of `Consumable`, localizations, and a `settings._storeKitErrors` list). It loads in `SKTestSession` on Xcode 27.1 and an iOS 27.0 simulator. In that session the plugin returned all three products, and buying the small tip twice succeeded through the app's tip sheet.

On a simulator, the first launch after installing the app can return no products from a StoreKit test session. Launch it again before reading anything into that.

- [ ] UNVERIFIED: Open the file in Xcode. If Xcode rewrites it, commit that rewrite.
- [ ] UNVERIFIED: Add it to the project if the navigator does not show it. Product, Scheme, Edit Scheme, Run, Options, StoreKit Configuration: select `Tips.storekit`.
- [ ] UNVERIFIED: Confirm pending, cancel, and failed paths (StoreKit testing can force a failure from the transaction manager).

Sandbox and TestFlight repeat purchases are on the device checklist in [manual-verification.md](manual-verification.md). The local file is not a substitute for a sandbox purchase against the real products.

If the schema is rejected when Xcode opens it, create the file from the template instead of hand-editing: File, New, File from Template, StoreKit Configuration File. Add three consumables with the product IDs above, then point the scheme at that file.
