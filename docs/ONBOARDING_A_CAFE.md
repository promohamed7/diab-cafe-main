# Onboarding a Café

No code, no copied project, no new CSS, no menu source file. Everything below happens in the INBYTE Admin (and in the café's INBYTE Café).

| # | Step | Where | Who |
|---|---|---|---|
| 1 | **Create café** — name, tenant ID (permanent, e.g. `cafe-x`), currency, brand colour. Starts as DRAFT (invisible). | Admin → Cafés → New café | super admin |
| 2 | **Connect INBYTE Café** — Generate pairing code; enter it in the café's INBYTE Café connector within 15 minutes. | Admin → Café → Integration | super admin + café |
| 3 | **Sync catalog and tables** — automatic after pairing (connector pushes them). Check counts and "last seen". | Admin → Café → Integration / Menu | — |
| 4 | **Branding** — colours, light/dark, font, logo, favicon. | Branding, Overview | operator |
| 5 | **Website** — hero, announcement, promotions, about page, footer, contact, social, opening hours. | Website | operator |
| 6 | **Ordering** — journeys (pickup / delivery / dine-in QR, or browse-only), payment methods, minimum order, delivery area, offline policy. | Ordering | operator |
| 7 | **Menu presentation** — hide items, feature items, order, marketing text, images. Prices and availability stay Café's. | Menu | operator |
| 8 | **Tables / QR** — check Café's tables, download each QR (SVG) and print. | Tables / QR | operator |
| 9 | **Domain** (optional) — point DNS at the platform, add the host, mark primary (QR codes then use it). | Overview → Domains | super admin |
| 10 | **Publish** — Activate. The site is live at `/t/cafe-x/` (or the domain). | Café header → Activate | super admin |

A second, third, … café: repeat. The automated end-to-end test (`npm run test:e2e`) performs steps 1–10 through the real UI and then places pickup and dine-in orders that reach the (fake) INBYTE Café; it also brings up a second café on a custom domain and checks isolation.

## Before activating — checklist

- Integration shows **ONLINE**; catalog synced; product count looks right.
- Ordering: at least one journey and one offered payment method (CASH / CREDIT_CARD) — otherwise the site is browse-only.
- Open the public link, place a test order, confirm it appears in INBYTE Café and that status changes show on the tracking page.

## Migrating a café from the static JSON release

`npm run tenant:import -- public/tenants/cafe-x.json` imports the old static configuration as a DRAFT café (validated by the same parser). Then continue from step 2. Static `/tenants/*.json` files are no longer used in production (`VITE_TENANT_CONFIG_SOURCE` defaults to `api`).

## Offboarding

Disable the café (invisible immediately; its connector can still settle queued orders), then revoke the integration.
