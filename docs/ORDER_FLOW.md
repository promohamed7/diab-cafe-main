# Order Flow

Journeys: `ONLINE + PICKUP`, `ONLINE + DELIVERY`, `TABLE_QR + DINE_IN` (Café's unified order model; nothing else).

## Responsibilities

| Step | Customer (browser) | Platform | INBYTE Café |
|---|---|---|---|
| Build order | items, modifiers, contact, payment method, `clientRequestId` | — | — |
| Validate | UX hints | structure, café, journey enabled, payment offered, contact data, table token (this café), products/modifiers against the last sync, minimum order, expected total, connectivity | **everything again**, authoritative |
| Price | shows estimate | computes estimate from Café's synced prices | **authoritative total** (rejects `PriceTamperedMismatch` if it differs) |
| Create | — | stores the intent + public reference, queues it | **creates the order, ORD-number, status** |
| Stock | — | — | deducted only at acceptance |
| Status / payment | reads | stores Café's reports | **owns every transition** |

The request schema has no field for price, discount, order number, status, cashier or shift; such fields are dropped if sent and cannot influence anything.

## Lifecycle

```
customer POST /orders
   │  validation fails ───────────────▶ 4xx, nothing stored
   │  café not connected / offline+REJECT ─▶ 503 SERVICE_UNAVAILABLE / STORE_OFFLINE, nothing stored
   ▼
QUEUED  (deliveryState AWAITING_CAFE, orderStatus PENDING, orderNumber null)
   │  connector leases
   ▼
LEASED  (attempt n, lease 60 s; re-leased with the same clientRequestId if not reported)
   │ Café create_order
   ├── CREATED  ─▶ DELIVERED (RECEIVED_BY_CAFE): ORD-number, Café totals, Café status
   │                   └── status reports: ACCEPTED → PREPARING → READY → COMPLETED (or REJECTED/CANCELLED)
   └── REJECTED ─▶ REJECTED_BY_CAFE (orderStatus REJECTED, code stored for the admin)

QUEUED and never leased before deliver_before ─▶ NOT_DELIVERED (orderStatus CANCELLED):
   "the café did not receive your order; it was not placed; nothing is owed"
```

`deliver_before = created + queue time` (per café, default 15 min). A **leased** order is never expired by the platform — the café may have created it; only the connector's report settles it (it shows "awaiting café" until then).

## Café offline (offline-first POS)

Per café (Admin → Ordering):
- **REJECT** (default): while the connector has not been seen for 90 s, new orders get `503 STORE_OFFLINE`; the website says ordering is temporarily unavailable and keeps the attempt so a later retry is safe.
- **QUEUE**: orders are accepted as `AWAITING_CAFE` and delivered when the café reconnects, or closed as `NOT_DELIVERED` at the deadline.

A café that was never paired, or whose catalog was never synced, cannot take orders at all (`503`).

## Idempotency

- Key: `clientRequestId` (UUID v4 from the browser's CSPRNG, persisted before sending, reused only for a retry of the same payload — see [WEBSITE_INTEGRATION.md §6](WEBSITE_INTEGRATION.md)).
- Namespace: per café — `UNIQUE (tenant_id, client_request_id)`.
- Fingerprint: SHA-256 of the canonical request (minus the key), option IDs normalised.
- Same café + key + fingerprint → the original acknowledgement, `200`, `replayed: true` (also after the café went offline or the menu changed).
- Same café + key, different fingerprint → `409 IDEMPOTENCY_KEY_CONFLICT`.
- Concurrent duplicates race on the unique index; the loser returns the winner's answer. Exactly one order (tested with 8 concurrent submissions).
- Towards Café, the same `clientRequestId` is sent on every delivery attempt.

## Tracking

`GET /api/public/v1/tenants/{id}/orders/{publicReference}` — reference `INB-XXXX-XXXX-XXXX-XXXX` (80 random bits, Crockford base32), scoped to the café. Response fields are allow-listed: reference, Café order number, type, status, payment status, delivery state, estimate, Café total, Café's rejection reason, updated time. No internal IDs, cashier, shift, cost, contact data or history. Unknown and malformed references give the same `404 ORDER_NOT_FOUND`.

## Retention

Customer contact data (name, phone, address, notes) on settled orders is erased after `CUSTOMER_DATA_RETENTION_DAYS` (30) by the maintenance job; the order and its history stay.
