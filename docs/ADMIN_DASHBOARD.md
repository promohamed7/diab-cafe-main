# INBYTE Admin

Internal administration for INBYTE staff at `/admin/` (separate SPA bundle: `src/admin/`). It is not a café owner dashboard.

## Roles

| Capability | `INBYTE_SUPER_ADMIN` | `INBYTE_OPERATOR` |
|---|---|---|
| View dashboard, cafés, menu, tables, orders, integration, audit | ✓ | ✓ |
| Identity, branding, website, contact, ordering, menu presentation, table QR switches | ✓ | ✓ |
| Create café; activate / disable; name, locale, currency (`general`) | ✓ | — |
| Domains | ✓ | — |
| Issue pairing codes, revoke café connections | ✓ | — |
| Manage INBYTE admin accounts | ✓ | — |

Every role decision is enforced by the API (`403 FORBIDDEN`); the UI only hides what the role can't do.

## Areas

| Area | What it does |
|---|---|
| Dashboard | Active/draft/disabled cafés, POS connected/offline, orders (24 h), orders awaiting a café, not-delivered orders, active cafés needing attention |
| Cafés | List with status, POS connection health, menu sync, domain; create café (tenant ID, name, currency, brand colour) |
| Café → Overview | General settings, identity (logo, favicon, tagline), domains, status actions, public site link |
| Café → Branding | Brand colours (dark/light), surfaces, default theme, font; live preview |
| Café → Website | Hero, announcement, promotional sections, about page, footer; contact, social media, opening hours |
| Café → Ordering | Journeys (pickup / delivery / dine-in QR / browse-only), payment methods, minimum order, delivery-area text, offline policy and queue time |
| Café → Menu | Café's synced catalog (read-only names/prices/availability) with presentation controls: shown, featured, order, marketing description, image; category visibility/order |
| Café → Tables / QR | Café-issued tables and tokens, QR SVG (download), copy link, per-table QR switch |
| Café → Orders | Read-only list and detail (items, Café number/total, delivery state, history, customer contact until erased — viewing is audited) |
| Café → Integration | Connection health, versions, last seen, pairing code (shown once), revoke, sync state, queue, events |
| Audit log | Who did what, to which café, when, from where (no secrets) |
| Settings | Change own password; super admins manage administrators (create, role, deactivate, unlock) |

## Admin API (`/api/admin/v1`)

| Method & path | Role |
|---|---|
| `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/password` | any |
| `GET /dashboard` | any |
| `GET /tenants`, `GET /tenants/{id}`, `GET /tenants/{id}/public-config` | any |
| `POST /tenants`, `PUT /tenants/{id}/status` | super |
| `PUT /tenants/{id}/sections/{general|identity|branding|contact|website|ordering}` | any (`general`: super) |
| `POST /tenants/{id}/domains`, `DELETE /tenants/{id}/domains/{host}` | super |
| `GET /tenants/{id}/menu`, `PUT /tenants/{id}/menu/products/{cafeId}`, `PUT /tenants/{id}/menu/categories/{cafeId}` | any |
| `GET /tenants/{id}/tables`, `PUT /tenants/{id}/tables/{tableId}`, `GET /tenants/{id}/tables/{tableId}/qr.svg` | any |
| `GET /tenants/{id}/orders`, `GET /tenants/{id}/orders/{ref}` | any |
| `GET /tenants/{id}/integration` | any |
| `POST /tenants/{id}/integration/pairing-code`, `POST /tenants/{id}/integration/revoke` | super |
| `GET /audit` | any |
| `GET/POST /admin-users`, `PATCH /admin-users/{id}` | super |

Request bodies are strict: unknown fields (e.g. `priceCents` on a menu item) are rejected with `400 VALIDATION_FAILED` and the field names.

## First administrator

```
ADMIN_PASSWORD='a long passphrase' npm run admin:create -- --email ops@inbyte.app --name "INBYTE Ops"
```

There is no default account and no self-registration. Development only: `npm run db:seed:dev` creates `admin@inbyte.local`.

## Deliberately not included

Billing, subscriptions, café owner self-service, CRM/loyalty, reservations, kitchen screens, inventory or pricing editors — out of scope for this product.
