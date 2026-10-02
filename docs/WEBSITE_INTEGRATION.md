# INBYTE Café Digital Menu ↔ INBYTE Café — Integration Contract (website side)

This document describes what the website implements and what it expects from
the INBYTE Café side. It does **not** claim that any Café capability exists:
every Café-side item marked *dependency* is not implemented in INBYTE Café today
(see the INBYTE Café Website Integration Specification).

> **Platform (current architecture):** the website now talks to the **INBYTE
> platform backend** (`server/`, same origin, base `/api/public/v1`). The backend
> is the relay: it owns tenants, the catalog projection, order intake and
> tracking, and reaches each café's INBYTE Café through the connector protocol in
> [INTEGRATION_WITH_INBYTE_CAFE.md](INTEGRATION_WITH_INBYTE_CAFE.md). Start with
> [ARCHITECTURE.md](ARCHITECTURE.md). This document remains the website-side contract.

> **Multi-café:** the website serves many cafés (tenants). Every endpoint below
> is scoped under `{base}/tenants/{tenantId}`, and every café's data must stay
> isolated. See [WHITE_LABEL_ARCHITECTURE.md](WHITE_LABEL_ARCHITECTURE.md).

> The files in `Restricted instraction must follow/` describe an earlier
> Supabase-based plan. Several statements there do not match the current Café
> code (inbox import, `idx_inv_online_deduct` dedup, catalog filtering, POS-side
> modifier validation). Use this document and the Café specification instead.

---

## 1. Website role

The website is a **digital menu and customer ordering channel**. INBYTE Café
(the desktop POS) remains the system of record and the only authority for
product/option IDs, prices, modifier deltas, availability, inventory, order
numbers, order status, payment status, discounts, tables, staff and cash.

The website never: computes an authoritative price or total, marks anything as
paid, changes an order's status, cancels or refunds, chooses or invents a table,
generates an order number, or holds any Café credential.

## 2. Supported customer journeys

| Journey | Channel → type | Customer data | Entry |
|---|---|---|---|
| Delivery | `ONLINE` → `DELIVERY` | name, phone, address, notes | "توصيل" card |
| Pickup / takeaway (one journey) | `ONLINE` → `PICKUP` | name, phone, notes | "استلام من الفرع" card (default) |
| Dine-in | `TABLE_QR` → `DINE_IN` | name/phone optional, notes | **Only** by opening a Café table QR URL |

Normal visitors start in PICKUP (or their last outside choice). Dine-in cannot be
selected manually.

## 3. Catalog contract (Café → website)

`GET {base}/tenants/{tenantId}/catalog` returns the customer-facing projection:

```jsonc
{
  "store": { "name": "string", "phone": "string|null", "address": "string|null" },
  "categories": [{ "id": 1, "name": "string", "sortOrder": 1, "isActive": true, "isAvailableOnline": true }],
  "products": [{
    "id": 107, "categoryId": 1, "name": "string", "description": "string|null",
    "imageUrl": "https URL|null", "priceCents": 5500,
    "isActive": true, "isAvailableOnline": true,
    "availability": "AVAILABLE | UNAVAILABLE | UNKNOWN",
    "modifierGroups": [{
      "id": 11, "name": "string", "isRequired": true, "allowMultiple": false,
      "options": [{ "id": 1101, "name": "string", "priceDeltaCents": 0 }]
    }]
  }],
  "version": "string|null"
}
```

- All IDs are Café integer IDs, used unchanged.
- Money is integer minor units (piastres). Prices are **display previews**.
- `availability` is a hint; Café decides at acceptance time.
- The website filters again on `isActive && isAvailableOnline` (category and product).
- `src/integration/parsers.ts` is an **allow-list**: only the fields above are kept.
  Cost prices, barcodes, stock counts, supplier data etc. are dropped even if sent.
- The parsed catalog is cached per café in `localStorage` (≤24 h) for display only.

## 4. Cart contract

A cart line is `{ lineId, productId, quantity, modifierOptionIds[] }`. `lineId` is a
local UI key and is never sent. Names and prices are looked up from the current
catalog at render time. Limits: 20 per line, 25 distinct lines. Lines whose
product/options are no longer valid are flagged and block checkout.

## 5. Checkout contract (website → Café)

`POST {base}/tenants/{tenantId}/orders` with header `Idempotency-Key: <clientRequestId>`:

```jsonc
{
  "orderType": "PICKUP | DELIVERY | DINE_IN",
  "orderChannel": "ONLINE | TABLE_QR",
  "items": [{ "productId": 107, "quantity": 1, "modifierOptionIds": [1101, 1303] }],
  "customerInfo": {
    "fullName": "string",          // required for PICKUP/DELIVERY, optional DINE_IN
    "phone": "string",             // required for PICKUP/DELIVERY, optional DINE_IN
    "deliveryAddress": "string",   // DELIVERY only
    "customerNotes": "string"      // optional
  },
  "tableToken": "string",          // TABLE_QR / DINE_IN only, exactly as in the QR URL
  "paymentMethod": "CASH | CREDIT_CARD",
  "expectedTotalCents": 5500,      // client expectation only
  "clientRequestId": "uuid-v4"
}
```

Never sent: unit/line/final prices, discounts, delivery fees, order ID/number/
secret, order or payment status, cashier, shift, inventory.

`paymentReference` exists in the type for future transfer methods but is not sent
in the MVP.

Client-side validation (UX only — Café must validate too): name 2–60 chars, phone
10–15 digits (Arabic-Indic digits normalised), address 10–300 chars, notes ≤200,
control characters stripped.

**Response (public-safe acknowledgement):**

```jsonc
{
  "tenantId": "cafe-x",
  "publicReference": "INB-7K4M-92QX-…",     // 80 random bits, the tracking credential
  "orderNumber": null,                      // Café's ORD-…, once INBYTE Café created the order
  "orderStatus": "PENDING",
  "paymentStatus": "PENDING",
  "deliveryState": "AWAITING_CAFE",         // AWAITING_CAFE | RECEIVED_BY_CAFE | NOT_DELIVERED
  "estimatedTotalCents": 5500,              // platform estimate from the last catalog sync
  "subtotalCents": null, "discountCents": null, "totalCents": null,  // Café's authoritative values, later
  "createdAt": "…",
  "replayed": false
}
```

The platform accepts the order *for the café*; INBYTE Café creates it
asynchronously (see [ORDER_FLOW.md](ORDER_FLOW.md)). The confirmation screen
therefore says "received — waiting for the café" until Café has it, shows the
estimate labelled as such, and shows Café's order number and total once known.
An integration that answers synchronously (order number present, no
`deliveryState`) is treated as `RECEIVED_BY_CAFE`. No cashier, shift or other
customer data may appear in this response.

## 6. clientRequestId lifecycle

Implemented in `src/domain/checkoutAttempt.ts` and `src/hooks/useCheckout.ts`:

1. Each new checkout attempt gets a v4 UUID from `crypto.getRandomValues` (never `Math.random`).
2. The id and the exact payload are saved **before** sending.
3. If the outcome is unknown (network error, timeout, invalid response, 5xx) the
   attempt stays `OUTCOME_UNKNOWN`; the cart is kept; retrying the same payload
   reuses the same id — including after a page reload ("إعادة إرسال نفس الطلب").
4. Any change to cart, quantities, modifiers, order type, table token, name,
   phone, address, notes, payment method or expected total produces a new id.
5. After Café acknowledges (or definitively rejects) an attempt, its id is never
   reused. The cart is cleared only after acknowledgement.
6. Outside-order snapshots live in `localStorage`; dine-in snapshots live in
   `sessionStorage` with the table session and can only be retried for the same,
   unexpired table.
   All snapshots are stored in the café's own scope and carry the `tenantId`; an
   attempt is never reused, restored or sent under another café.
7. Unknown attempts older than 12 h are not reused automatically.

## 7. DINE_IN QR flow

```
Printed QR → https://<site>/?table=<Café token>      (parameter name: VITE_TABLE_QR_PARAM, default "table")
  → website removes the token from the address bar
  → POST {base}/tenants/{tenantId}/tables/resolve { "token": "<token>" } → { "tableLabel": "طاولة 4" }
  → banner "تطلب الآن من طاولة 4"; order type locked to DINE_IN / TABLE_QR
  → order carries tableToken unchanged; Café associates the table
```

- No table picker, no typed table numbers, no generated `tbl_NN` tokens.
- Invalid tokens show an error and never enable dine-in; network failures show a retry.
- The table session is stored in `sessionStorage` only and expires after 3 h, so
  an old table can't be attached to a later order. A new scan replaces it.
- The customer can leave table mode ("إنهاء طلب الطاولة") but cannot change table.

## 8. Payment scope

MVP: `CASH` and `CREDIT_CARD`, both settled with staff ("pay on pickup/delivery",
"pay staff in the café" for dine-in). The website shows Café's payment status
read-only and has no payment, verification or refund controls.
InstaPay / wallet / bank transfer and online gateways are future extensions.

## 9. Tracking contract

`GET {base}/tenants/{tenantId}/orders/{publicReference}` →

```jsonc
{ "publicReference": "...", "orderNumber": "ORD-1042|null", "orderType": "PICKUP",
  "orderStatus": "PENDING|ACCEPTED|PREPARING|READY|COMPLETED|REJECTED|CANCELLED",
  "paymentStatus": "PENDING|SUBMITTED|VERIFICATION_REQUIRED|VERIFIED|PAID|FAILED|REFUNDED|PARTIALLY_REFUNDED",
  "deliveryState": "AWAITING_CAFE|RECEIVED_BY_CAFE|NOT_DELIVERED",
  "estimatedTotalCents": 5500, "totalCents": "5500|null", "rejectionReason": "string|null", "updatedAt": "string|null" }
```

`NOT_DELIVERED` means the café never picked the order up before its deadline:
it was not placed and nothing is owed (shown as such, with orderStatus `CANCELLED`).

- Read-only; polled every 10 s while in progress and visible, backing off on errors,
  stopping at COMPLETED/REJECTED/CANCELLED.
- Lookup is **only** by the non-guessable public reference, never by order number.
- The device keeps up to 10 references plus a snapshot of what was ordered.
- No ETA is shown (Café does not provide one).
- Zone-less Café timestamps (`YYYY-MM-DD HH:MM:SS`) are treated as UTC.

## 10. Error contract

Errors are `{ "error": { "code": "..." } }` with a non-2xx status, or Café's
`ApiResponse { success: false, error }` envelope. Codes are matched in Rust
variant or snake form:

| Code | Customer outcome |
|---|---|
| `InvalidModifierOption` | review cart |
| `ProductInactive`, `ProductUnavailable` | review cart (line flagged after menu refresh) |
| `CustomerDataRequired` | complete contact details |
| `InsufficientStock` | out of stock, review cart |
| `PriceTamperedMismatch` | menu refreshed, customer confirms new total (new id) |
| `IdempotencyKeyConflict` | resubmit (new id) |
| `InvalidTableToken` | table session cleared, rescan QR |
| network / timeout / 5xx / invalid response | outcome unknown → safe retry with same id |
| not configured | "online ordering unavailable" |

Server messages are never displayed or logged; customers see local Arabic text.

## 11. Environment configuration

All variables are public build-time values (`.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_CAFE_TRANSPORT` | `http` (default in production builds) or `mock` (default in `npm run dev`) |
| `VITE_CAFE_API_BASE_URL` | Base URL of the platform public API. Default `/api/public/v1` (same origin); `none` disables ordering |
| `VITE_CAFE_API_TIMEOUT_MS` | Request timeout (default 15000) |
| `VITE_TABLE_QR_PARAM` | Query parameter carrying the table token (default `table`) |
| `VITE_TENANT_ID` | Café for the `fixed` strategy (and fallback for others) |
| `VITE_TENANT_STRATEGY` | `platform` (production default: `/t/{id}/` paths, then the backend maps the hostname), `fixed`, `subdomain` or `path` |
| `VITE_TENANT_BASE_DOMAIN` | Parent domain for the `subdomain` strategy |
| `VITE_TENANT_PATH_PREFIX` | Path segment before the tenant id for `path` (default `t`) |
| `VITE_TENANT_HOST_MAP` | JSON map of custom domains → tenant ids |
| `VITE_TENANT_CONFIG_SOURCE` | `api` (default: `{base}/tenants/{tenantId}/config`, managed in the INBYTE Admin) or `static` (`/tenants/{tenantId}.json`, bootstrap/demo only) |

Never put secrets in `VITE_*` variables. Any machine credential for Café belongs
to the relay/adapter, not the browser.

## 12. Café dependencies (not implemented in Café today)

> **Status update (platform):** items 1, 3 (projection), 5, 6, 7, 8, 9 and 10 are
> now implemented **by the INBYTE platform backend** for the website. What remains
> on the Café side is the connector inside INBYTE Café and defence-in-depth
> validation in `create_order` — see
> [INTEGRATION_WITH_INBYTE_CAFE.md §9](INTEGRATION_WITH_INBYTE_CAFE.md). The
> original list is kept below for traceability.

1. A transport: relay or adapter reachable by the website (topology undecided).
2. Machine authentication between relay/adapter and Café.
3. Safe public catalog projection (without cost, barcode, stock counts).
4. Enforcement in `create_order` of required/single-select modifier rules,
   duplicate options, `is_available_online`, quantity and text limits.
5. Idempotency hardening for external callers: scoped key namespace, full
   payload fingerprint (incl. customer info, channel, table, notes), no PII on
   replay, `replayed` flag.
6. Non-guessable public order reference and public-safe acknowledgement/status DTOs.
7. Table-token resolution for public callers that accepts tokens only (not raw `tableId`).
8. Structured, machine-readable error codes.
9. Tenant-scoped routing and enforcement: `/tenants/{tenantId}/…` reaches the
   right café; table tokens, public references and idempotency keys are valid only
   within their own café; unknown tenants answer `TENANT_NOT_FOUND`. Responses may
   echo `tenantId` — the website rejects a mismatching echo.
10. Optional: `GET {base}/tenants/{tenantId}/config` (tenant configuration served by the relay).

## 13. Mock vs production transport

| | Production (`http`) | Development (`mock`) |
|---|---|---|
| Code | `src/integration/httpTransport.ts` | `src/integration/mock/*` |
| Included in bundle | always | only when built with `VITE_CAFE_TRANSPORT=mock` (dev server default) |
| Data | Café | two sample tenants (`inbyte-demo`, `harbor-roast`) with isolated catalogs, tables and orders |
| UI marker | none | striped "بيئة تطوير" banner |

The mock imitates the *target* Café behaviour so the UI can be built against it;
it is not the contract. Orders placed there never reach a café. Dev-console hooks
(`window.__INBYTE_DEV_MOCK__`, bound to the current tenant;
`__INBYTE_DEV_MOCK__.forTenant(id)` for another) exist only in mock builds:
`failNextSubmit('NETWORK_ERROR'|'TIMEOUT_AFTER_COMMIT'|'SERVICE_UNAVAILABLE')`,
`setOrderStatus(ref, status, reason)`, `setPriceDrift(cents)`,
`setProductAvailability(id, state)`, `receivedRequestIds()`, `listOrders()`,
`tableTokens()`, `tenantIds()`, `reset()`.

Mock QR tokens — `inbyte-demo`: `qr_7c1e4b9a2f6d4e08`, `qr_a93f02d6c8b14e7f`,
`qr_5e8b71c0d4a2493b`, `qr_d20c6f9e1b7a4c55`, `qr_0b4e8a7d3c9f4161`;
`harbor-roast`: `hr_tbl_8f2a71c4e9b3d605`, `hr_tbl_31d9e0b7a6c4f218`.
E.g. `http://localhost:3000/?table=qr_7c1e4b9a2f6d4e08` or
`http://localhost:3000/?tenant=harbor-roast&table=hr_tbl_8f2a71c4e9b3d605`.

## Code map

```
src/types/          catalog.ts, order.ts, table.ts, tenant.ts
src/tenant/         TenantContext (provider, useTenant, useMoney), tenantResolver, parseTenantConfig,
                    tenantPolicy, tenantTheme, scopedStorage, tenantSwitch, tenantScope
src/domain/         pure logic: cart, modifiers, pricing (display), customer validation,
                    checkoutAttempt (payload + clientRequestId), orderStatus (presentation)
src/integration/    transport interface, http + unconfigured transports, errors, allow-list parsers, mock/
src/services/       tenantConfigService, cafeCatalogService, cafeTableService, cafeOrderService,
                    cafeTrackingService, checkoutAttemptStore, trackedOrdersStore, storage (legacy cleanup)
src/hooks/          useCatalog, useOrderContext (outside mode + QR table), useCart,
                    useCheckout, useOrderTracking
src/context/        UIContext (navigation, theme + tenant theme variables, toasts, modals)
tests/              node:test unit tests (`npm test`, Node ≥ 22.18)
```
