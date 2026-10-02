# INBYTE Café Digital Menu — White-Label / Multi-Café Architecture

**Principle: build once, configure per café.** The same codebase and the same
build serve any café. Onboarding a café means adding its *data* (a tenant
configuration and its INBYTE Café catalog), never editing React components.

Related: [WEBSITE_INTEGRATION.md](WEBSITE_INTEGRATION.md) (Café contract) ·
[tenant-config.example.json](tenant-config.example.json) (complete example).

---

## 1. Product vision

A reusable digital menu + customer ordering channel for cafés using INBYTE
Café. Each café gets its own branding, menu, journeys, payment options and
contact details. The website stays a customer channel: digital menu, cart,
checkout, read-only tracking. INBYTE Café (the POS) remains every café's system
of record for prices, stock, orders, payment status and staff operations.

Supported journeys per café (each can be switched on/off): `ONLINE + PICKUP`,
`ONLINE + DELIVERY`, `TABLE_QR + DINE_IN`.

## 2. Tenant concept

A **tenant** is one café/business. It has a stable `tenantId`
(`^[a-z0-9][a-z0-9_-]{1,62}$`, e.g. `cafe-x`). The tenant id:

- selects the café's configuration,
- prefixes every integration request (`/tenants/{tenantId}/…`),
- scopes every value stored in the browser (`inbyte:{tenantId}:{name}`),
- is recorded inside checkout attempts, table sessions and tracking records.

```
CUSTOMER UI (React, café-agnostic)
   ↓  useTenant() / hooks
TENANT CONTEXT  ── tenantResolver → tenantConfigService → TenantConfig + TenantScope
   ↓  services receive the TenantScope explicitly
cafeCatalogService · cafeTableService · cafeOrderService · cafeTrackingService
   ↓  every call names its tenant
CafeTransport (http | mock | unconfigured)  →  Café adapter / relay  →  INBYTE Café
```

## 3. Tenant configuration

Type: `src/types/tenant.ts`. Parser: `src/tenant/parseTenantConfig.ts`
(allow-list; unknown fields dropped; unsafe URLs, phones and colours rejected).

| Area | Fields |
|---|---|
| Identity | `tenantId`, `slug`, `locale`, `identity.{businessName, displayName, tagline, description, logoUrl, faviconUrl}` |
| Branding | `branding.colors.{primary, primaryDeep, secondary, accent}`, optional `lightColors`, `surfaces.{dark,light}.{background, surface, text}`, `defaultTheme`, `fontFamily`, `fontStylesheetUrl` (https) |
| Contact | `contact.{phone, whatsapp, address, mapsUrl, website, social[]}` |
| Business | `businessHoursText` (display only — the site never claims "open now") |
| Features | `features.{onlineOrdering, pickup, delivery, dineInQr}` — **all default to `false`** |
| Ordering | `ordering.{minimumOrderCents, deliveryAreaText}` |
| Payment | `paymentMethods[]` (Café enum) |
| Currency | `currency.{code, symbol}` (required; Café stores no currency) |
| Content | `content.{heroBadge, heroTitle, heroSubtitle, heroImageUrl, heroImageMobileUrl, about}` |

Rules:

- A config whose `tenantId` differs from the requested tenant is rejected (`TENANT_MISMATCH`).
- Missing `features` means a **browse-only** digital menu, never accidental online ordering.
- Not configurable on purpose: delivery fee and preparation time (INBYTE Café
  doesn't provide them), opening/closed state (not computed), anything the POS owns.
- `minimumOrderCents` is a client-side UX check only; Café does not enforce it today.

**Config sources** (`src/services/tenantConfigService.ts`):

| Source | When | Location |
|---|---|---|
| `static` (default for http builds) | production today | `/tenants/{tenantId}.json` deployed next to the site (e.g. `public/tenants/` or the host's file store) |
| `api` (`VITE_TENANT_CONFIG_SOURCE=api`) | when the relay serves configs | `GET {VITE_CAFE_API_BASE_URL}/tenants/{tenantId}/config` |
| mock | development | `src/integration/mock/mockTenants.ts` |

## 4. Tenant resolution

`src/tenant/tenantResolver.ts` — `resolveTenant(location, options)`, configured by env:

| Strategy | Env | Example |
|---|---|---|
| `fixed` (default) | `VITE_TENANT_ID=cafe-x` | one deployment per café |
| `subdomain` | `VITE_TENANT_STRATEGY=subdomain`, `VITE_TENANT_BASE_DOMAIN=menu.inbyte.app` | `cafe-x.menu.inbyte.app` |
| `path` | `VITE_TENANT_STRATEGY=path`, `VITE_TENANT_PATH_PREFIX=t` | `menu.example.com/t/cafe-x/` (host must rewrite unknown paths to `index.html`) |
| custom domains | `VITE_TENANT_HOST_MAP={"cafe-x.com":"cafe-x"}` (checked first) | `cafe-x.com` |
| dev override | `?tenant=cafe-x` — **mock/dev builds only** | |

Unresolvable or unknown tenant → "café not found" screen. There is no default
café in production builds. Switching strategy later is configuration only; when
a relay can map hostnames to tenants, the host map can move server-side.

## 5. Branding

One stylesheet for all cafés. `src/styles/tokens.css` defines the design tokens,
including brand channels `--brand-rgb`, `--brand-deep-rgb` and `--on-brand`. All
former hard-coded brand colours (about 350 `rgba()`/hex literals in the CSS and inline
styles) now reference these variables.

`src/tenant/tenantTheme.ts → themeVariables(branding, mode)` maps the tenant's
colours to token values (primary, containers, readable on-colours by contrast,
surfaces, text, font). `UIContext` applies them on `<html>` for the current
light/dark mode; `TenantProvider` sets title, description, favicon, theme-color
and the optional font stylesheet. The visitor's explicit light/dark choice is
remembered per café; otherwise the café's `defaultTheme` applies.

Platform vs café brand: INBYTE appears only in the neutral shell (`index.html`
title before a tenant loads, package metadata). Everything a customer sees comes
from the tenant.

## 6. Catalog

Unchanged contract, now per café: `GET /tenants/{tenantId}/catalog` →
categories, products, modifier groups/options with Café integer IDs (see
WEBSITE_INTEGRATION.md §3). The UI is fully data-driven: category chips, product
cards, modifier groups (required/single/multi), prices with the café's currency
symbol. No menu exists in application code; development fixtures live only in
`src/integration/mock/` and are excluded from production bundles.

## 7. Cart isolation

The cart is stored under `inbyte:{tenantId}:cart` and contains only Café IDs.
Café B cannot read café A's cart. When the same browser moves to another café on
the same origin (`src/tenant/tenantSwitch.ts`), the previous café's cart, table
session and settled checkout snapshot are deleted — nothing is migrated.

## 8. Dine-in QR isolation

`QR → tenant context → table token → that café's integration → table resolution`.

- The token is resolved with `POST /tenants/{tenantId}/tables/resolve`; a token
  issued by café A is invalid at café B (the integration must enforce this; the
  mock does).
- The table session is stored in the café's **sessionStorage** scope with its
  `tenantId`, expires after 3 h and is cleared on a tenant switch.
- If a café disables `dineInQr`, scanned tokens are ignored ("dine-in not available").
- The website still never builds, edits or guesses table tokens or IDs.

## 9. Order isolation

Every order request is sent to `/tenants/{tenantId}/orders`. A checkout attempt
records its `tenantId`, which is part of the attempt fingerprint
(`fingerprintAttempt(tenantId, draft)`). `createCheckoutAttemptStore(scope)` only
loads/saves attempts of its own café, and `resolveAttempt(existing, draft,
{ tenantId })` never reuses an attempt from another café — so a clientRequestId
can't be replayed across cafés even if storage were tampered with.

Exception (deliberate): when switching cafés, a snapshot whose outcome is still
**unknown** is kept in the previous café's scope, because deleting it would lose
the only safe retry key and risk a duplicate order there. It is invisible to
other cafés and reachable again from the empty cart of its own café.

## 10. Tracking isolation

Tracked orders are stored per café (`inbyte:{tenantId}:tracked_orders`); records
carry `tenantId` and foreign records are ignored. Status is read with
`GET /tenants/{tenantId}/orders/{publicReference}`. A reference from café A
queried at café B must return not-found (enforced by the mock; required of the
integration). Responses that echo a different `tenantId` are rejected
(`assertTenantEcho`).

## 11. Payment configuration

`offeredPaymentMethods(tenant) = tenant.paymentMethods ∩ {CASH, CREDIT_CARD}`.
The checkout renders only those. `INSTAPAY`, `WALLET`, `BANK_TRANSFER` and
`ONLINE_PAID` may be listed by a café but are not offered until INBYTE Café can
store payment references / verify gateway payments. A café with no offerable
method can't take online orders (browse-only).

## 12. Integration architecture

`src/integration/transport.ts` — every method takes `tenantId` explicitly:
`getTenantConfig`, `getCatalog`, `resolveTableToken`, `submitOrder`,
`getOrderStatus`. Services receive a `TenantScope` (`{ tenantId, storage }`) and
there is no global "current tenant" a service could read by mistake.
`TenantProvider` keys the app tree by `tenantId`, so no React state survives a
switch. Production builds contain no mock code and no sample tenants.

## 13. Development fixtures

`src/integration/mock/` (bundled only in mock builds):

| Tenant | Branding | Journeys | Payment | Menu |
|---|---|---|---|---|
| `inbyte-demo` — INBYTE Demo Café | gold, dark default | pickup, delivery, dine-in | CASH, CREDIT_CARD | 146 online products (fixtureMenu.ts) |
| `harbor-roast` — Harbor Roast | teal, light default, custom surfaces | pickup, dine-in (no delivery), min. order 50 | CREDIT_CARD (+INSTAPAY listed, not offered) | 11 online products, different modifiers |

Switch with `?tenant=harbor-roast` in `npm run dev`. Dev console hooks:
`window.__INBYTE_DEV_MOCK__` (bound to the current tenant) and
`__INBYTE_DEV_MOCK__.forTenant('other-id')`.

## 14. Adding a new café

1. **INBYTE Café side:** the café's POS is connected to the integration
   adapter/relay under its `tenantId` (catalog projection, table tokens, orders).
2. **Configuration:** write `cafe-x.json` following `docs/tenant-config.example.json`
   and deploy it at `/tenants/cafe-x.json` (or serve it from the relay with
   `VITE_TENANT_CONFIG_SOURCE=api`). Logos/images are URLs.
3. **Routing:** either a deployment with `VITE_TENANT_ID=cafe-x`, or add the café
   to the shared deployment's subdomain/path/host map — no code change.
4. **QR codes:** print Café-issued table tokens as
   `https://<café's site>/?table=<token>` (path strategy: `/t/cafe-x/?table=…`).

That's all. No React component, CSS file or service changes. The browser test
"WHITE-LABEL" proves it: a production build shows a café that exists only as a
JSON file, and editing only that file changes name, colours, theme, journeys and
contact details on reload.

## 15. What requires backend / Café changes

The website is ready; these must exist on the Café / relay side:

1. Transport (relay or adapter) and machine authentication (unchanged).
2. **Tenant-scoped routing**: `/tenants/{tenantId}/…` mapped to the right café's
   INBYTE Café instance; unknown tenants → `TENANT_NOT_FOUND`.
3. **Tenant-scoped enforcement**: table tokens, public order references and
   idempotency keys are only valid within their own café.
4. Optionally serving tenant configuration (`GET /tenants/{tenantId}/config`)
   and hostname → tenant mapping for custom domains.
5. Everything already listed in WEBSITE_INTEGRATION.md §12 (safe catalog
   projection, modifier/online enforcement, hardened idempotency, public order
   reference, safe responses, table-token resolution, structured errors).

Known limits of this frontend:

- The UI language is Arabic/RTL for every café (`locale` only affects date
  formatting). Multi-language support would be a separate i18n feature.
- Social-preview tags (`og:*`) are set at runtime; crawlers that don't run
  JavaScript see the neutral shell. Per-café previews need SSR or per-café
  HTML at the host.
- Hero/order-card photos are platform defaults unless a café provides
  `heroImageUrl`; the order-card photos are not yet configurable.
