# Integration with INBYTE Café

INBYTE Café (Tauri v2 + Rust + SQLite, offline-first, no public API) stays the operational system of record. The platform never connects to the café, never sees its SQLite database, and never creates an authoritative order itself.

## Topology

```
INBYTE Café POS ── connector (inside Café) ──HTTPS, outbound only──▶ INBYTE platform /api/integration/v1
```

Why outbound polling: cafés are behind NAT on unreliable connections; an outbound client needs no open ports, survives disconnections, and lets Café decide when to accept work. Heartbeats + leases make delivery reliable without the platform ever reaching into the café.

## Authentication

1. A super admin clicks **Generate pairing code** (Admin → Café → Integration): `XXXX-XXXX`, 40 bits, single use, valid 15 minutes, stored hashed, `/pair` limited to 10/min per IP. Issuing a code revokes any previous connection of that café.
2. The connector calls `POST /pair {pairingCode, cafeInstanceId, connectorVersion}` → `{ tenantId, credential }`.
3. `credential` (`inbc_` + 256 random bits) is shown once; the platform stores only its SHA-256 and a 12-char prefix. Café must store it in its protected settings.
4. Every other call: `Authorization: Bearer <credential>`. **The café is derived from the credential** — the body never names a tenant. Revoking (admin) makes it fail immediately with `401 CONNECTION_REVOKED`.

## Protocol (`/api/integration/v1`)

| Call | Body → Response | Notes |
|---|---|---|
| `POST /heartbeat` | `{connectorVersion?, cafeAppVersion?}` → `{serverTime, tenantId, pendingOrders}` | Every ~5 s. Offline after `CONNECTOR_OFFLINE_AFTER_SECONDS` (90) without a call. |
| `PUT /catalog` | full snapshot (below) → counts | On start and whenever the POS catalog/availability changes. Replaced atomically; broken references rejected; unknown fields dropped. |
| `PUT /tables` | `{tables:[{tableId,label,qrToken,isActive}]}` | On start and on table changes. Tokens are Café-issued (`[A-Za-z0-9_-]{8,128}`). |
| `POST /orders/lease` | `{max}` → `{orders:[…]}` | Hands out queued orders for this café only; lease = `ORDER_LEASE_SECONDS` (60). |
| `POST /orders/{publicReference}/result` | `CREATED` or `REJECTED` → `{applied}` | After Café's `create_order`. Idempotent; contradicting reports → `409 RESULT_CONFLICT`. |
| `POST /orders/{publicReference}/status` | `{orderStatus, paymentStatus, statusVersion, rejectionReason?}` → `{applied}` | On every staff transition. |

Catalog snapshot (only these fields are kept — cost prices, barcodes, stock counts, recipes are dropped if sent):

```jsonc
{ "version": "string|null",
  "categories": [{ "id": 1, "name": "…", "sortOrder": 1, "isActive": true, "isAvailableOnline": true }],
  "modifierGroups": [{ "id": 11, "name": "…", "isRequired": true, "allowMultiple": false,
                       "options": [{ "id": 1101, "name": "…", "priceDeltaCents": 0, "sortOrder": 0 }] }],
  "products": [{ "id": 101, "categoryId": 1, "name": "…", "description": "…", "priceCents": 5000,
                 "isActive": true, "isAvailableOnline": true, "availability": "AVAILABLE|UNAVAILABLE|UNKNOWN",
                 "modifierGroupIds": [11] }] }
```

`availability` is Café's computed `in_stock` (finished-goods stock or recipe raw materials — ADR-024); the platform never sees quantities.

Leased order (shaped like Café's `CreateUnifiedOrderDto`):

```jsonc
{ "publicReference": "INB-…", "clientRequestId": "uuid", "attempt": 1, "leaseExpiresAt": "…", "createdAt": "…",
  "order": { "orderType": "PICKUP|DELIVERY|DINE_IN", "orderChannel": "ONLINE|TABLE_QR",
             "tableId": 3, "tableToken": "…",
             "items": [{ "productId": 101, "quantity": 2, "modifierOptionIds": [1102] }],
             "customerInfo": { "fullName": "…", "phone": "…", "deliveryAddress": null, "customerNotes": null },
             "paymentMethod": "CASH|CREDIT_CARD", "expectedTotalCents": 13000, "clientRequestId": "uuid" } }
```

Result:

```jsonc
{ "outcome": "CREATED", "orderNumber": "ORD-1042", "orderStatus": "PENDING", "paymentStatus": "PENDING",
  "subtotalCents": 13000, "discountCents": 0, "totalCents": 13000, "statusVersion": 1 }
{ "outcome": "REJECTED", "errorCode": "PriceTamperedMismatch|InsufficientStock|InvalidModifierOption|ProductInactive|ProductNotAvailableOnline|TableInactiveOrInvalid|…", "customerMessage": "optional" }
```

## Reliability and duplicates

- **Lease → create → report.** If the connector dies after Café created the order but before reporting, the lease expires and the order is handed out again **with the same `clientRequestId`**. Café's idempotency must return the original order (no second order). Tested end-to-end with the reference connector.
- **Status inbox.** `statusVersion` must increase with every change in Café. Older/duplicate reports are ignored (`applied: false`); impossible moves (backwards, leaving a final state) are refused (`409 INVALID_TRANSITION`). Skipping steps is allowed (updates made while offline arrive as one jump).
- **Offline café.** See [ORDER_FLOW.md](ORDER_FLOW.md): per café, either refuse new orders while offline or queue them for a bounded time; an order nobody leased before its deadline is closed as `NOT_DELIVERED`, an order that was leased is never expired by the platform.

## Price, stock and validation authority

The platform pre-validates against the last snapshot (unknown/hidden/not-online/unavailable products, modifier rules, expected total) to give customers immediate feedback. Café **must still** validate everything in `create_order` and recompute the total; if its authoritative total differs from `expectedTotalCents` (e.g. a price changed since the last sync) it rejects with `PriceTamperedMismatch` and the customer sees the order as rejected. Inventory deduction happens only in Café, at acceptance (ADR-013).

## Error codes

Café rejection codes are normalised (`PRICE_TAMPERED_MISMATCH`, `INSUFFICIENT_STOCK`, `INVALID_MODIFIER_OPTION`, `PRODUCT_INACTIVE`, `PRODUCT_UNAVAILABLE`, `CUSTOMER_DATA_REQUIRED`, `INVALID_TABLE_TOKEN`, `IDEMPOTENCY_KEY_CONFLICT`, `VALIDATION_FAILED`, otherwise `CAFE_REJECTED`) and stored on the order for the admin. Customers see only the café's optional `customerMessage` / `rejectionReason` (≤200 chars) and the website's own wording.

## Reference implementation

`connector/src/referenceConnector.ts` implements the café side of the protocol; `connector/src/fakeCafeEngine.ts` mimics Café's order engine (authoritative pricing, idempotency, ORD sequence, stock rejections, staff status changes) for tests and `npm run dev:connector`. Neither is production code for cafés.

## 9. What INBYTE Café must implement (not in this repository)

1. Connector module in INBYTE Café (Rust): pairing UI step, secure credential storage, heartbeat loop, catalog/table snapshot export, lease loop, result and status reporting with a persistent per-order `statusVersion`.
2. Mapping a leased order onto `UnifiedOrderService::create_order` with channel `ONLINE`/`TABLE_QR`, preserving `clientRequestId`.
3. Idempotency on `clientRequestId` (same id → same order; same id + different payload → conflict), within the café.
4. Defence-in-depth validation in `create_order`: required/single-select modifiers, duplicate options, `is_available_online`, quantity/text limits, table token ↔ table id.
5. A safe catalog export (no cost, barcode, stock quantities, recipes).
6. Machine-readable error codes in results.
7. Status change hooks so every staff transition (accept/prepare/ready/complete/reject/cancel/payment) is reported.

Until these exist, a café cannot receive real orders; the platform reports it as "not connected" and refuses orders honestly (`503`).
