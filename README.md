# INBYTE Digital Menu Platform

A reusable, multi-tenant **digital menu and customer ordering platform** for cafés running INBYTE Café.
**Build once, configure per café. INBYTE Café remains the operational source of truth.**

منصة منيو رقمي وطلبات للعملاء متعددة المقاهي، تُدار من لوحة INBYTE Admin. كل مقهى يُضاف ويُخصص بالإعدادات فقط،
ونظام INBYTE Café في كل مقهى يبقى المرجع الوحيد للأسعار والمخزون وإنشاء الطلب وحالته والدفع.

| Part | Path |
|---|---|
| Backend / API (Node 22, Fastify, PostgreSQL) | `server/` |
| INBYTE Admin (internal) | `src/admin/` → `/admin/` |
| Customer digital menu (every café) | `src/` → `/`, `/t/{tenantId}/`, custom domains |
| Café connector protocol + reference connector | `server/src/modules/integration`, `connector/` |

Customer journeys per café: pickup (`ONLINE+PICKUP`), delivery (`ONLINE+DELIVERY`), dine-in from the café's table QR (`TABLE_QR+DINE_IN`).

## Run locally

Requires Node ≥ 22.18 and PostgreSQL.

```bash
npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/inbyte
npm run db:seed:dev          # two sample cafés, admin@inbyte.local / inbyte-dev-password, pre-paired fake connectors
npm run build
STATIC_DIR=dist npm run server      # http://localhost:8080/admin/  ·  http://localhost:8080/t/inbyte-demo/
npm run dev:connector               # fake INBYTE Café for the sample cafés (syncs menus, accepts and advances orders)
```

Frontend-only development without a database: `npm run dev` (in-browser mock, clearly flagged, never in production builds).

## Tests

```bash
npm run typecheck
npm test             # frontend unit tests
npm run test:server  # backend: tenancy, orders, integration, security — real PostgreSQL (DATABASE_URL_TEST)
npm run test:e2e     # full platform in a browser (needs `npm run build`, PostgreSQL, Playwright + Chromium)
npm run verify       # typecheck + unit + backend + build
```

## Production

```bash
npm ci && npm run build
DATABASE_URL=… STATIC_DIR=dist NODE_ENV=production npm start   # migrates on start
ADMIN_PASSWORD='…' npm run admin:create -- --email ops@inbyte.app --name "INBYTE Ops"
```

Configuration: `.env.example`. Onboarding a café: [docs/ONBOARDING_A_CAFE.md](docs/ONBOARDING_A_CAFE.md).

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — components, data ownership, deployment
- [MULTI_TENANCY.md](docs/MULTI_TENANCY.md) — isolation, configuration, resolution, public API
- [ADMIN_DASHBOARD.md](docs/ADMIN_DASHBOARD.md) — INBYTE Admin, roles, admin API
- [INTEGRATION_WITH_INBYTE_CAFE.md](docs/INTEGRATION_WITH_INBYTE_CAFE.md) — connector protocol and Café-side work
- [ORDER_FLOW.md](docs/ORDER_FLOW.md) — responsibilities, lifecycle, offline handling, idempotency, tracking
- [SECURITY.md](docs/SECURITY.md) — controls and how they are tested
- [ONBOARDING_A_CAFE.md](docs/ONBOARDING_A_CAFE.md) — step by step
- [WEBSITE_INTEGRATION.md](docs/WEBSITE_INTEGRATION.md), [WHITE_LABEL_ARCHITECTURE.md](docs/WHITE_LABEL_ARCHITECTURE.md) — customer website contract and theming
