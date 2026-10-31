# Production backend for the iOS app

The iPhone app calls the same Vercel deployment as the website. Parsing, file storage, webhooks, and the cleanup job are unchanged features. This list is what has to be true in production before TestFlight. It was not applied to a Vercel project from here. UNVERIFIED.

The versioned parse contract is [docs/api/parse-receipt-v1.md](../api/parse-receipt-v1.md) (written with the API work). The unversioned `POST /api/parse-receipt` stays for older clients. Both paths must be rate limited.

## Rate limit

The existing Vercel WAF custom rule is named "Rate limit parse-receipt". It matches `POST` and path equals `/api/parse-receipt`, at 10 requests per 10 minutes per IP, and returns 429 before the function runs. Counters are per region. There is no in-app rate limiter.

The iOS client uses `POST /api/v1/parse-receipt` (`PARSE_RECEIPT_PATH` in `src/lib/app-config.ts`). Extend the rule so both paths are limited. A path-equals rule that names only the old route does not cover the app.

- [ ] UNVERIFIED: Update the WAF rule so `POST /api/parse-receipt` and `POST /api/v1/parse-receipt` are both limited (10 requests / 10 minutes per IP, or a tighter cap if cost requires it).
- [ ] UNVERIFIED: From a phone on the cellular network, confirm a burst past the cap returns 429 and does not call the model. WAF counters are per region, so one region can be under its cap while another is not.

## Environment

| Variable | Production |
| --- | --- |
| `CRON_SECRET` | Required. The cleanup route checks `Authorization: Bearer $CRON_SECRET` only when the variable is set. If it is unset, anyone who can reach the route can run a cleanup. Vercel Cron sends the header when the variable exists. |
| `NATIVE_APP_ORIGINS` | Required for the app. Include `capacitor://localhost` (the origin the bundled WebView uses). Add any other native origin you actually ship. This is CORS, not a credential. |
| `NEXT_PUBLIC_SHARE_ORIGIN` | The public website origin, such as `https://split.narula.xyz`. Share links from the website use it in preference to the page origin. Preview deployments should leave it unset so links stay on the preview host. |
| `VITE_API_ORIGIN` | Mobile build only, not a Vercel runtime variable. HTTPS origin of this deployment. |
| `VITE_PUBLIC_ORIGIN` | Mobile build only. Same public origin as `NEXT_PUBLIC_SHARE_ORIGIN`. |
| `UPLOADTHING_TOKEN` | Required if you want receipt copies stored and the 90-day deletion job to have anything to delete. Parsing continues when upload fails, and the webhook then has no file URL. |
| `WEBHOOK_URL` | Optional. See the content warning below. |
| `FIRECRAWL_API_KEY` | Optional. Pasted receipt links work keyless at a lower limit. Each pasted link is one Firecrawl credit. |
| `ANTHROPIC_API_KEY` or the configured provider key | Required for parsing. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Set this on the production deployment so `/privacy` and `/support` show a real address instead of the App Store listing placeholder. |

- [ ] UNVERIFIED: Set the rows above on the production Vercel project, and set the `VITE_*` values in the environment where `npm run mobile:build` runs for a release.
- [ ] UNVERIFIED: Confirm a build of the app can `POST` a receipt to `/api/v1/parse-receipt` and that a browser on another origin cannot.

## Retention

The cron is `0 3 * * *` in `vercel.json`, hitting `/api/cron/cleanup-old-receipts`. Files older than 90 days are deleted. The route currently lists at most 500 files per run (`listReceiptFiles(500)`). If the bucket can hold more than that, older files past the page can survive. Treat pagination as a backend follow-up, and do not describe the job as complete until that is true.

- [ ] UNVERIFIED: Set `CRON_SECRET` and confirm a manual call without the bearer token returns 401.
- [ ] UNVERIFIED: Confirm the scheduled run deletes a file older than 90 days and leaves a newer one.
- [ ] UNVERIFIED: Confirm the 500-file listing is enough for the bucket, or that the route pages through every file.

## Webhooks

Success and failure notifications include receipt contents (merchant, items, amounts), the file URL when upload worked, the session id, and approximate location from Vercel's IP headers. That is the receipt itself, posted into Slack or whatever `WEBHOOK_URL` points at.

- [ ] UNVERIFIED: Point `WEBHOOK_URL` at a private channel, not a public one.
- [ ] UNVERIFIED: Set that workspace's retention so messages do not live longer than you are willing to keep receipt images and names. The 90-day UploadThing job does not delete Slack messages.
- [ ] UNVERIFIED: Read a sample payload and remove any field you do not want operators to see before TestFlight.

## Firecrawl

Each pasted link is one scrape. The free tier is small. The WAF cap above is what stops a loop from spending the balance. Pages that need a login fail. The user-facing error tells them to upload a screenshot.

- [ ] UNVERIFIED: Check the Firecrawl credit balance and decide whether production uses `FIRECRAWL_API_KEY` or keyless mode.
- [ ] UNVERIFIED: Paste one public receipt link from the iOS app and confirm the screenshot parses.

## Related docs

- [docs/api/parse-receipt-v1.md](../api/parse-receipt-v1.md) — request and response contract.
- [privacy.md](privacy.md) — what to declare because of the data this backend sees.
- [release.md](release.md) — do not deploy a breaking API change under an installed app.
