# INBYTE Digital Menu Platform — Architecture

**Build once, configure per café. INBYTE Café remains the operational source of truth.**

The platform is one reusable, multi-tenant product operated by INBYTE:

| Part | Where | What it is |
|---|---|---|
| INBYTE Admin | `src/admin/`, served at `/admin/` | Internal INBYTE administration (cafés, branding, website, ordering, menu presentation, tables/QR, orders, integration, audit) |
| Backend / API | `server/` | Modular monolith: Node 22 + TypeScript + Fastify + PostgreSQL |
| Customer Digital Menu | `src/` (customer SPA), served at `/` and `/t/{tenantId}/` | Menu, cart, checkout, read-only tracking — every café, branded at runtime |
| Integration boundary | `server/src/modules/integration`, `/api/integration/v1` | Protocol through which each café's INBYTE Café connects |
| Reference connector | `connector/` | Running specification of the café side + fake Café engine for dev/tests |

```
                 INBYTE ADMIN (/admin)                CUSTOMER WEBSITE (/, /t/{id}/, custom domains)
                        │ session + CSRF                        │ anonymous, rate limited
                        ▼                                       ▼
            ┌───────────────────────────── INBYTE BACKEND (server/) ─────────────────────────────┐
            │ auth · tenants · branding/website · ordering · catalog projection · presentation   │
            │ tables/QR · orders (intake, idempotency, tracking) · integration · audit            │
            │                              PostgreSQL                                             │
            └───────────────────────────────────────▲─────────────────────────────────────────────┘
                                                    │ HTTPS, OUTBOUND from the café
                                                    │ bearer credential per café (/api/integration/v1)
                                       ┌────────────┴─────────────┐
                                       │ INBYTE CAFÉ CONNECTOR     │  (inside INBYTE Café — Café-side work)
                                       └────────────┬─────────────┘
                                                    │ in-process / localhost
                                       ┌────────────┴─────────────┐
                                       │ INBYTE CAFÉ DESKTOP POS   │  Rust · Tauri · SQLite (never exposed)
                                       └──────────────────────────┘
```

## Data ownership (source of truth)

| Data | Owner | Platform's copy |
|---|---|---|
| Products, prices, modifiers, availability, stock | **INBYTE Café** | Read-only projection (`catalog_*`), replaced by each connector sync |
| Authoritative order, ORD number, totals, status, payment, refunds, cashier/shift | **INBYTE Café** | Customer-facing projection on `orders` (what Café reported) |
| Tables and QR tokens | **INBYTE Café** issues them | Synced copy (`cafe_tables`) + a platform kill switch |
| Café identity, branding, website content, contact, journeys, payment offer, domains | **Platform** (INBYTE Admin) | — |
| Menu presentation: visibility, featured, display order, marketing text, image | **Platform** | No price or availability column exists |
| Customer order intent (until Café has it), idempotency, public reference | **Platform** | — |
| Admins, sessions, audit, integration connections | **Platform** | — |

Rules that keep one source of truth:
- The platform **never** stores an editable price. Estimates are computed from Café's synced prices and are labelled as estimates; Café re-prices every order.
- Presentation can only *narrow* what Café publishes (hide, reorder, describe) — never sell something Café marks inactive, not-online or out of stock.
- Status and payment change **only** through Café's reports.

## Request surfaces

| Prefix | Caller | Auth | Notes |
|---|---|---|---|
| `/api/public/v1` | Customer website | none (anonymous) | per-IP rate limits, 32 KB order bodies, café derived from the path and checked against the request host |
| `/api/admin/v1` | INBYTE Admin | HttpOnly SameSite=Strict session cookie + per-session CSRF header + Origin check; roles | 401/403 on violation; every change audited |
| `/api/integration/v1` | Café connector | `Authorization: Bearer inbc_…` (one per café, hashed at rest) | café derived from the credential only |

Full endpoint list: [MULTI_TENANCY.md](MULTI_TENANCY.md) (public), [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) (admin), [INTEGRATION_WITH_INBYTE_CAFE.md](INTEGRATION_WITH_INBYTE_CAFE.md) (connector).

## Backend modules (`server/src/modules`)

| Module | Responsibility |
|---|---|
| `auth` | scrypt passwords, server-side sessions, CSRF, lockout, role guards |
| `tenants` | cafés, configuration sections (validated by the website's own parser), domains, host → café, static-JSON import |
| `catalog` | connector snapshot → projection; presentation overlay; public catalog |
| `tables` | Café tables/tokens, token resolution within a café, QR URLs |
| `orders` | intake (validation, idempotency, connectivity policy), tracking projection, expiry, data retention |
| `integration` | pairing, credentials, heartbeat, sync, order lease/result/status, events |
| `audit` | append-only audit log |

Shared contract code: the backend imports the website's pure modules (`src/types`, `src/domain`, `src/tenant/parseTenantConfig.ts`) so client and server validate the same rules.

## Database

PostgreSQL, versioned SQL migrations (`server/src/db/migrations`, applied at start-up under an advisory lock). Every tenant-owned table carries `tenant_id`; every customer- or connector-addressable key is unique **per tenant** (`(tenant_id, client_request_id)`, `(tenant_id, qr_token)`, `(tenant_id, cafe_product_id)` …). Money is `BIGINT` minor units.

Why `pg` + SQL rather than Prisma: the guarantees that matter here — tenant-scoped unique keys, `INSERT … ON CONFLICT` idempotency, `FOR UPDATE SKIP LOCKED` order leases, `CHECK` constraints on states and channel/type combinations — are native SQL and stay explicit and reviewable. (Prisma's current npm release line was a release candidate at implementation time.)

Deliberately not created: a `customers` table (no CRM — contact data lives on the order and is erased after the retention period), separate outbox/inbox tables (an order's `delivery_state` *is* the outbox; Café's monotonic `statusVersion` is the inbox guard), separate settings/branding tables (validated JSON documents on `tenants`, query-relevant fields as columns).

## Deployment

One Node process (or several behind a load balancer — all state is in PostgreSQL; rate limits are per instance):

```
npm ci && npm run build          # customer SPA + admin SPA → dist/
DATABASE_URL=… STATIC_DIR=dist npm start   # migrates, serves dist/ and /api/*
ADMIN_PASSWORD=… npm run admin:create -- --email ops@inbyte.app --name "INBYTE Ops"
```

Environment: see `.env.example` (server section). Point custom domains / a wildcard platform domain at the service; TLS terminates at the proxy (`TRUST_PROXY_HOPS`). The previous static hosting (Vercel) can still serve a demo build, but production needs the backend.

## Related documents

[MULTI_TENANCY.md](MULTI_TENANCY.md) · [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) · [INTEGRATION_WITH_INBYTE_CAFE.md](INTEGRATION_WITH_INBYTE_CAFE.md) · [ORDER_FLOW.md](ORDER_FLOW.md) · [SECURITY.md](SECURITY.md) · [ONBOARDING_A_CAFE.md](ONBOARDING_A_CAFE.md) · [WEBSITE_INTEGRATION.md](WEBSITE_INTEGRATION.md) (website contract) · [WHITE_LABEL_ARCHITECTURE.md](WHITE_LABEL_ARCHITECTURE.md) (frontend theming/isolation)
