# App Store listing copy

Paste-ready metadata for Receipt Splitter 1.0. Nothing here has been entered in App Store Connect. Character counts are JavaScript string lengths of the paste text (not the surrounding label). Recount in Connect if a field rejects the paste; the limits below are Apple's published limits as of 2026-10-31.

Do not mention other platforms, the website as a second product, or any price. Tips are optional and splitting is free. There is no account.

Primary language: English (U.S.). No other localization for v1.

## Character counts

| Field | Limit | Count | Paste text |
| --- | ---: | ---: | --- |
| Name | 30 | 16 | Receipt Splitter |
| Subtitle | 30 | 25 | Split a bill with friends |
| Promotional text | 170 | 146 | Photograph a receipt, assign each item, and share what everyone owes. Splitting is free and needs no account. Optional tips never unlock features. |
| Description | 4000 | 1491 | See below. |
| Keywords | 100 | 98 | `bill,tab,tip,tax,dinner,restaurant,expense,share,friends,group,check,iou,roommate,itemize,currency` |
| What's New | 4000 | 166 | First release. Photograph or import a receipt, assign the items, and share what each person owes. No account. Splitting is free. Optional tips do not unlock anything. |
| Copyright | — | 17 | 2026 Karan Narula |

Keywords are comma-separated with no spaces. They do not repeat "receipt" or "splitter". They do not name other bill-splitting apps, and they do not include "venmo" (a trademark). The description may mention Venmo once because the app really opens it.

Copyright: confirm this is the legal name on the individual Apple Developer membership before you type it. The public seller name is that legal name. If the membership name differs, use the membership name.

Promotional text can be changed without a new binary. Description and What's New cannot.

## Description

```
Receipt Splitter turns a photo of a receipt into a split you can share.

Take a photo, choose one from your photo library, import a PDF, or paste a link to a public receipt page. After you agree, the receipt is sent to be read. You can correct the items, tax, and tip before anyone owes a share.

Add the people who were there. Group them if several people shared the same items. Assign each item to one person, to several people, or to a group. The app adds up what each person owes, including their share of tax and tip, in the receipt's currency.

Share a link. Each person opens it and sees their amount. On a US-dollar split you can add a US phone number so the link can open Venmo. You can leave the number blank. Other currencies show the amount as text. Venmo is optional. It is a way for one person to pay another for the meal. It is not a purchase inside the app.

Splitting is free. There is no account and no sign-up.

A network connection is required to read a new receipt. A split that is already on your iPhone can be edited without a connection, including people, assignments, tax, and tip, and you can share that link without a connection. The person you send it to needs a connection to open it.

Tips are optional in-app purchases. They do not unlock features, and you can keep using the app without tipping. You can tip more than once.

The camera is used only when you take a photo. Choosing an existing photo, importing a PDF, or pasting a link does not use the camera.
```

Claims this text does not make, because the code does not support them: offline parsing, an account, cloud sync, an incoming Share Extension (that is deferred), a price, or a second platform.

## URLs

| Field | URL |
| --- | --- |
| Support URL | https://split.narula.xyz/support |
| Marketing URL | https://split.narula.xyz |
| Privacy Policy URL | https://split.narula.xyz/privacy |

Both `/privacy` and `/support` must load on the production host before you submit, and they must show the copy in this repo (privacy policy effective October 31, 2026). Set `NEXT_PUBLIC_SUPPORT_EMAIL` on that deployment so the pages show a real address instead of "the contact address listed in the App Store listing". Put the same address in App Store Connect.

## Categories

| Slot | Suggestion | Why |
| --- | --- | --- |
| Primary | Finance | The app calculates what each person owes and can hand off a person-to-person payment. |
| Secondary | Utilities | It is a tool for one receipt, not a bank, card, or investment product. |

Confirm both names against the category list Connect shows on the day you submit. Do not use Food & Drink. The app is not a restaurant guide.

## Age rating

Answer from behavior in this repo. Apple's form (Age ratings values and definitions, checked 2026-10-31) asks which capabilities the app includes, then a frequency for each content descriptor: None, Infrequent, or Frequent. Record the rating Connect assigns. Do not type a rating here and do not override it. Do not select Made for Kids. The app sends receipt photos to a third party and is not a children's product.

In-app purchases and the receipt parser are not rows in that category list. They are answered underneath the table.

### In-app controls

| Question | Answer | Why |
| --- | --- | --- |
| Parental Controls | No | No parent-facing limits, content filters, or purchase restrictions beyond what iOS provides. |
| Age Assurance | No | No declared-age API, age estimation, or ID check. |

### Capabilities

| Question | Answer | Why |
| --- | --- | --- |
| Unrestricted Web Access | No | Apple's definition is an embedded browser or a browser app: the user can navigate to any webpage inside the app. This app does not do that. A pasted receipt link is sent to our server, which asks Firecrawl to fetch the page and return a screenshot. The user does not browse that page, follow links, or type a URL into an address bar. `Browser.open` (`@capacitor/browser`) is used only for addresses the app itself chooses: the privacy policy, the support page, and a Venmo link (`https` in the in-app browser, or `venmo://` via the system). There is no general-purpose web view. Selecting this row would rate the app 16+ (17+ on OS versions before 26). Do not select it to be cautious. If App Review later decides the Firecrawl fetch or `Browser.open` counts, change the answer then and accept the higher rating. |
| User-Generated Content | No | Apple's definition is broad distribution of user content as part of the experience (public photos, posts, video). There is no public feed, no profile, and no way for a stranger to post into the app. Names in a share link are text the sender typed, delivered only to people who have that link. That is not this row. Guideline 1.2 does not apply. See [review-notes.md](review-notes.md). |
| Social Media | No | No feed, likes, comments, or redistribution of other people's content. |
| Social Media Disabled for Users Under 13 | Not applicable | Only answer this if Social Media is Yes. |
| Messaging and Chat | No | People do not message each other inside the app. Sharing uses the system share sheet, which leaves the app. |
| Advertising | No | No ads. |

### Mature themes, medical, sexuality, violence, chance

Answer **None** for every frequency row:

| Question | Answer | Why |
| --- | --- | --- |
| Profanity or Crude Humor | None | The app ships no such copy. |
| Horror/Fear Themes | None | None. |
| Alcohol, Tobacco, or Drug Use or References | None | The app does not depict drinking, smoking, or drugs. A receipt the user photographs might name a drink. That string is the user's document, the same way a notes app does not declare profanity because a user might type it. The app does not add those references itself. |
| Medical or Treatment Information | None | No diagnosis or treatment guidance. |
| Health or Wellness Topics | None | No calorie, diet, or exercise advice. Splitting a restaurant bill is not a wellness feature. |
| Mature or Suggestive Themes | None | None. |
| Sexual Content or Nudity | None | None. |
| Graphic Sexual Content and Nudity | None | None. |
| Cartoon or Fantasy Violence | None | None. |
| Realistic Violence | None | None. |
| Prolonged Graphic or Sadistic Realistic Violence | None | None. |
| Guns or Other Weapons | None | None. |
| Gambling | None | No wagering. Person-to-person settlement of a bill is not gambling. |
| Simulated Gambling | None | None. |
| Contests | None | No rankings, prizes, or competitions. |
| Loot Boxes | None | The three tips are fixed consumable amounts. They are not randomized items. |

### Not age-rating rows, still declare them elsewhere

| Topic | What to enter | Why |
| --- | --- | --- |
| In-app purchases | Yes. Three consumable tips. | Optional, repeatable, no feature unlock. Declared as in-app purchases, not as loot boxes and not as a contest. |
| AI / generated content | The app sends a receipt image to a third-party model and shows the structured fields that come back (merchant, date, items, prices, tax, fees, tip, total). | Apple's age-rating news says to weigh AI by the sensitive content it can produce. This model is not a chatbot and does not write prose or images for other people to browse. Output is receipt fields the user can edit. It does not change any frequency row above to Infrequent or Frequent. The consent dialog and the privacy policy cover the data leaving the device (Guideline 5.1.2). |
| Made for Kids | No | Do not opt in, even if Connect calculates 4+. |
| Override to a higher rating | No | Unless a later review forces Unrestricted Web Access. |
| Age Suitability URL | Leave blank | No separate age-suitability site. |

If every capability above stays off and every frequency stays None, Connect's chart calculates 4+ globally. That is a prediction from the published chart, not a rating you should type in by hand. Write down the value Connect shows.

## Availability and localization

- English (U.S.) only for version 1.0. No other languages in the binary or in Connect.
- Worldwide, in every storefront that does not require a filing you will not complete. Do not default to the United States only.
- iPhone only. Turn Mac (Designed for iPhone) off and Apple Vision off, matching `TARGETED_DEVICE_FAMILY = 1` and the `SUPPORTS_*` flags in the Xcode project.
- China mainland: open the compliance information. If a filing is required and you will not file, remove only that storefront.

## Export compliance

`ITSAppUsesNonExemptEncryption` is `false` in `ios/App/App/Info.plist`. The app uses HTTPS (and StoreKit) provided by the system. It does not ship its own cryptography.

If Connect still asks:

1. Does your app use encryption? Yes. It uses HTTPS.
2. Does it qualify for the exemption in Category 5, Part 2 of the U.S. Export Administration Regulations (encryption limited to what the operating system provides, including HTTPS)? Yes.
3. The plist key is already `false`, so later uploads usually skip the question. Do not change the key unless you add non-exempt crypto.

This answer does not cover a future custom crypto library.

## Content rights

Does the app contain, show, or access third-party content (music, film, books, or other licensed catalogs)? No.

Receipt photos and PDFs are the user's own documents. The model reads those documents. That is not a third-party content catalog, and you do not need a content-rights document for it.

## EU Digital Services Act trader status

Individual Apple membership does not decide this. Optional tips do not decide it either. The account holder has to say whether they are a trader (offering the app in the EU in the course of a trade or business) or not.

This repo does not make that call. Do not submit until you have chosen one of these and entered it in Connect:

- Not a trader. Say so in the DSA form. No public postal address is required for that declaration.
- Trader. Publish the legal name, postal address, phone, and email. The email must be the same address `/support` shows (`NEXT_PUBLIC_SUPPORT_EMAIL`). The App Store trader contact details and the support page have to match.

## Screenshot captions

Burn these into the screenshots, or use them as the shot list. Connect does not have a separate caption field. Capture the iPhone sizes the form currently requires (recheck; recently the 6.9-inch and 6.5-inch classes). No iPad and no Mac shots. Use a sample receipt, not an empty state.

| # | Screen | Caption |
| --- | --- | --- |
| 1 | Upload, with a receipt chosen | Add a receipt |
| 2 | People | Add everyone |
| 3 | Assign | Assign each item |
| 4 | Results, amounts visible | What each person owes |
| 5 | Share, phone field empty | Share a link |
| 6 | Tip sheet, prices visible | Tips are optional |

Shot 6 is also the in-app purchase review screenshot. See below. Shot 5 should show that a Venmo number is optional (the field can be empty and sharing still works).

## Tip in-app purchases

Three consumables, submitted with version 1.0. Product IDs are `DEFAULT_TIP_PRODUCT_IDS` in `src/lib/tip-products.ts`. Display names and the description match `ios/App/Tips.storekit`. Prices in that file are local StoreKit test prices. Connect prices are what customers pay, and they can differ. Do not put these amounts in the app description.

| | Small | Medium | Large |
| --- | --- | --- | --- |
| Reference name (64) | Small tip (9) | Medium tip (10) | Large tip (9) |
| Product ID | `app.receiptsplitter.ios.tip.small` | `app.receiptsplitter.ios.tip.medium` | `app.receiptsplitter.ios.tip.large` |
| Type | Consumable | Consumable | Consumable |
| Display name, English (U.S.) (30) | Small tip (9) | Medium tip (10) | Large tip (9) |
| Description (45) | Optional tip. Does not unlock features. (39) | Optional tip. Does not unlock features. (39) | Optional tip. Does not unlock features. (39) |
| Suggested price | 0.99 USD | 2.99 USD | 4.99 USD |

Suggested prices match the local StoreKit file so a screenshot from that configuration is not surprising. Pick the closest Apple price point in each storefront. Availability should follow the app's storefronts. Family Sharing off. Not a subscription. Buying one does not unlock a feature, and the same product can be bought again.

Review screenshot: one image of the tip sheet with the buttons and the prices StoreKit returned. Take it on a simulator using `Tips.storekit`, or on a device with the sandbox products loaded, so the prices are real StoreKit prices and not a mock. Attach it to each consumable. If Connect insists on a different image per product, use the same sheet and make sure the product you are submitting is on screen with its price. A shot of the button row with no prices will be rejected.

The Paid Apps Agreement, banking, and tax have to be active before these can be submitted. See [tips.md](tips.md).
