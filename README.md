# INBYTE Café Digital Menu — White-Label Customer Ordering

منصة **منيو رقمي وقناة طلب للعملاء** قابلة لإعادة الاستخدام لأي مقهى يستخدم نظام INBYTE Café.
كل مقهى (Tenant) له هويته وألوانه وقائمته وطرق الطلب والدفع الخاصة به — بالإعدادات والبيانات فقط، دون تعديل الكود.
نظام نقاط البيع في كل مقهى هو المرجع الوحيد للأسعار والمخزون وحالة الطلب والدفع؛ الموقع لا يعمل ككاشير.

A reusable, white-label digital menu and customer ordering channel for any café
running INBYTE Café. **Build once, configure per café.** Each café's POS stays its
system of record for prices, stock, order status and payment.

## Customer journeys (each switchable per café)
- **Pickup / takeaway** — `ONLINE` + `PICKUP`
- **Delivery** — `ONLINE` + `DELIVERY`
- **Dine-in** — `TABLE_QR` + `DINE_IN`, only from the café's table QR (`/?table=<Café token>`)

## Development
```bash
npm install
npm run dev          # http://localhost:3000 — development mock with two sample cafés
npm test             # unit tests (Node ≥ 22.18, no extra dependencies)
npm run typecheck
npm run build        # static production build in dist/
npm run verify       # typecheck + tests + build
```

Sample cafés in development: `http://localhost:3000/` (INBYTE Demo Café) and
`http://localhost:3000/?tenant=harbor-roast` (Harbor Roast). Dine-in:
`http://localhost:3000/?table=qr_7c1e4b9a2f6d4e08`.

## Onboarding a café
1. Connect the café's INBYTE Café to the integration adapter/relay under a `tenantId`.
2. Deploy its configuration as `/tenants/<tenantId>.json` (see `docs/tenant-config.example.json`).
3. Point a deployment, subdomain, path or custom domain at that tenant (env configuration).

No React, CSS or service code changes. See:
- [docs/WHITE_LABEL_ARCHITECTURE.md](docs/WHITE_LABEL_ARCHITECTURE.md) — tenants, branding, isolation, onboarding
- [docs/WEBSITE_INTEGRATION.md](docs/WEBSITE_INTEGRATION.md) — INBYTE Café integration contract and dependencies

## Production
`dist/` is a static site for any static host. Configure the `VITE_*` variables in
`.env.example`. Until the INBYTE Café adapter exists, a production build shows each
café's branding and menu state honestly ("online ordering unavailable") instead of
accepting fake orders.
