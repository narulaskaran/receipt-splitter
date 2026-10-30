# Parse Receipt API v1

Versioned HTTP API for parsing receipt images and pasted receipt links. Intended for the Capacitor iOS app and other native clients; the legacy web route remains at `POST /api/parse-receipt`.

## Endpoint

- **URL:** `POST /api/v1/parse-receipt`
- **Preflight:** `OPTIONS /api/v1/parse-receipt`
- **Max body size:** 4.5 MB (Vercel serverless limit)
- **Max duration:** 60 seconds (`maxDuration = 60`; pasted links may use Firecrawl before the LLM call)

## Request

`multipart/form-data` with one of:

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Receipt image (JPEG, PNG, GIF, WebP, HEIC) or PDF |
| `url` | string | Pasted receipt link (screenshot via Firecrawl); ignored if `file` is present |
| `sessionId` | string | Optional client session UUID; server generates one if omitted |

### Optional headers

| Header | Values | Description |
|--------|--------|-------------|
| `X-Client-Platform` | `web`, `ios` | Sanitized allowlist; unknown values ignored |
| `X-Client-Version` | string (max 64 chars) | App version for observability webhooks |
| `Origin` | see CORS | Required for browser CORS; native apps should send `capacitor://localhost` |

## Success response

**Status:** `200`

**Body:** Normalized receipt JSON (same shape as the legacy route):

```json
{
  "restaurant": "Example Cafe",
  "date": "2026-01-10",
  "subtotal": 20.0,
  "tax": 2.0,
  "fees": null,
  "tip": 3.0,
  "total": 25.0,
  "currency": "USD",
  "items": [
    { "name": "Burger", "price": 10.0, "quantity": 2 }
  ]
}
```

**Response headers (allowed origins only):**

- `X-API-Version: 1`
- `Access-Control-Allow-Origin: <echo allowed Origin>`
- `Access-Control-Expose-Headers: X-API-Version, Retry-After`
- `Vary: Origin`

## Error responses

Errors keep the legacy `{ "error": "..." }` shape and add a machine-readable `code` for v1 clients.

| HTTP | `code` | When |
|------|--------|------|
| 400 | `no_input` | No `file` or `url` |
| 400 | `file_too_large` | Over 4.5 MB |
| 400 | `empty_file` | Zero-byte upload |
| 400 | `unsupported_type` | MIME type not supported by the configured LLM |
| 400 | `bad_request` | Invalid multipart / LLM bad request |
| 422 | `no_priced_items` | All line items lacked prices |
| 429 | `rate_limited` | LLM rate limit (`Retry-After` may be set) |
| 500 | `llm_not_configured` | Missing or invalid LLM credentials |
| 500 | `parse_failed` | Validation or parse failure |
| 500 | `unexpected` | Unhandled server error |
| 4xx/5xx | *(ReceiptUrlError.code)* | Pasted link / Firecrawl failures (e.g. `service_unavailable`) |

All v1 error responses include the same CORS and `X-API-Version` headers as success when the `Origin` is allowed.

## CORS and origins

- Default allowed origin: `capacitor://localhost`
- Additional origins: comma-separated `NATIVE_APP_ORIGINS` env var
- Non-production (`NODE_ENV !== 'production'`): also `http://localhost:*` and `http://127.0.0.1:*`
- Never reflects `*` or an unlisted origin
- Disallowed preflight: `403` JSON `{ "error": "Origin not allowed" }` with no CORS headers

CORS and session IDs are not authentication.

## Rate limiting

Configure a **Vercel WAF** rule (manual dashboard step) for **both** paths:

- `POST /api/parse-receipt`
- `POST /api/v1/parse-receipt`

**Limit:** 10 requests / 10 minutes per IP (fixed window). Exceeded requests return **429** at the edge.

## Versioning policy

- v1 changes are **additive only** (new optional fields/headers/codes).
- The legacy route is not deprecated until installed native apps migrate to v1.
- Clients should send `X-API-Version` response header checks or pin to `/api/v1/`.

## Related environment variables

| Variable | Production | Description |
|----------|------------|-------------|
| `NATIVE_APP_ORIGINS` | Optional | Extra CORS origins (comma-separated) |
| `CRON_SECRET` | **Required** | Cron auth; cleanup fails closed if missing in production |
| `ANTHROPIC_API_KEY` / LLM vars | As today | Receipt parsing |
| `UPLOADTHING_TOKEN` | Optional | Receipt file storage (90-day retention) |

## File retention

UploadThing files are deleted by `/api/cron/cleanup-old-receipts` after **90 days**. The cron job **paginates** through all files (500 per page) before deleting in batches of 100; long runs may set `partial: true` if guard limits stop listing early.
