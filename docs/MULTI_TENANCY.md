# Multi-Tenancy

Every café is a **tenant** with a stable public `tenantId` (`^[a-z0-9][a-z0-9_-]{1,62}$`, e.g. `harbor-roast`) and an internal UUID that never leaves the backend.

## Isolation, layer by layer

| Layer | Mechanism |
|---|---|
| Database | Every tenant-owned row has `tenant_id`. Unique keys customers/connectors can name are per tenant: `(tenant_id, client_request_id)`, `(tenant_id, qr_token)`, `(tenant_id, cafe_product_id)`, `(tenant_id, cafe_category_id)` … Café IDs may overlap between cafés (tested). |
| Public API | The café comes from the path `/tenants/{tenantId}/…`; only `ACTIVE` cafés exist (draft/disabled/unknown → identical `404 TENANT_NOT_FOUND`). Every query includes the café's UUID. |
| Host binding | If the request's host is a domain registered to café X, only café X can be addressed through it (`cafe-x.com/t/cafe-y/` → not found). |
| Connector API | The café is derived from the bearer credential; request bodies cannot name a café. A connector of café A gets `404` for café B's orders. |
| Admin API | Admins are INBYTE staff (cross-café by design); every action is audited with the café it touched. Café-specific users can be added later (see below). |
| Browser | Storage keys `inbyte:{tenantId}:…`; cart/table/checkout cleared on café switch; React tree keyed by café ([WHITE_LABEL_ARCHITECTURE.md](WHITE_LABEL_ARCHITECTURE.md)). Browser state is never trusted for isolation — the server enforces it. |

Never possible (each covered by an automated test in `server/test/tenancy.test.ts`):
café A's table token at café B · café A's tracking reference at café B · a `clientRequestId` replaying across cafés · café B's connector leasing/acknowledging/updating café A's orders · café A's connector writing café B's catalog · café A's domain serving café B.

## Tenant lifecycle

`DRAFT` (created, invisible) → `ACTIVE` (public; requires a configuration the website parser accepts) → `DISABLED` (invisible again; queued orders can still be delivered and updated by its connector). Only `INBYTE_SUPER_ADMIN` changes status.

## Configuration model

Stored on `tenants` (validated per section by strict zod schemas, then re-validated by the website's own `parseTenantConfig` before saving):

| Section | Contents | Who |
|---|---|---|
| `general` | display name, locale, currency code/symbol | super admin |
| `identity` | business name, tagline, description, logo, favicon | operator+ |
| `branding` | colours (dark/light), surfaces, default theme, font | operator+ |
| `contact` | phone, WhatsApp, address, map, website, social, opening-hours text | operator+ |
| `website` | hero, about page, announcement, promotional sections, footer | operator+ |
| `ordering` | online ordering, pickup, delivery, dine-in QR, payment methods, minimum order, delivery area text, offline policy, queue time | operator+ |

The public document `GET /api/public/v1/tenants/{id}/config` is the same `TenantConfig` shape the website always used; the website did not change for the backend.

## Resolving the café for a visit

Production website strategy `platform`:
1. `/t/{tenantId}/…` path → that café (platform-hosted URLs and QR codes).
2. Otherwise `GET /api/public/v1/domains/resolve` → the café that owns the request's hostname (custom domains and platform subdomains registered in the admin).
3. Otherwise "café not found". There is no default café in production.

Custom domains: add the host in Admin → Café → Overview → Domains after its DNS points at the platform. One host belongs to exactly one café. The primary domain is used in QR codes; without one, `SITE_URL_TEMPLATE` (default `{origin}/t/{tenantId}/`) is used. DNS/TLS automation is out of scope (the resolution boundary is in place).

## Public API (customer website)

| Method & path | Purpose |
|---|---|
| `GET /api/public/v1/domains/resolve` | host → `{ tenantId }` |
| `GET /api/public/v1/tenants/{id}/config` | public café configuration |
| `GET /api/public/v1/tenants/{id}/catalog` | Café's projection filtered/decorated by presentation |
| `POST /api/public/v1/tenants/{id}/tables/resolve` | `{token}` → `{ tableLabel }` |
| `POST /api/public/v1/tenants/{id}/orders` | order intake (see [ORDER_FLOW.md](ORDER_FLOW.md)) |
| `GET /api/public/v1/tenants/{id}/orders/{publicReference}` | tracking |

## Future: café-specific users

`admin_users` carries a role; café users would be a new role plus a `tenant_memberships (admin_user_id, tenant_id, role)` table and a guard that checks membership in `requireTenant`. Routes already resolve the café first and check roles per route, so no redesign is needed.
