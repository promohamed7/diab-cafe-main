# دياب كافيه — DIAB CAFE | Digital Menu & Ordering

الموقع هو **منيو رقمي وقناة طلب للعملاء** متصلة بنظام نقاط البيع INBYTE Café.
نظام الكافيه هو المرجع الوحيد للأسعار والمخزون وحالة الطلب والدفع؛ الموقع لا يعمل ككاشير.

The website is a digital menu and customer ordering channel for INBYTE Café.
The Café POS stays the system of record for prices, inventory, order status and payment.

## Customer journeys
- **Pickup / takeaway** — `ONLINE` + `PICKUP` (default for visitors).
- **Delivery** — `ONLINE` + `DELIVERY`.
- **Dine-in** — `TABLE_QR` + `DINE_IN`, only by scanning the Café table QR code
  (`/?table=<Café token>`). There is no manual table selection.

## Development
```bash
npm install
npm run dev          # http://localhost:3000 — uses the development mock (clearly bannered)
npm test             # unit tests (Node ≥ 22.18, no extra dependencies)
npm run typecheck
npm run build        # static production build in dist/
npm run verify       # typecheck + tests + build
```

Try dine-in locally: `http://localhost:3000/?table=qr_7c1e4b9a2f6d4e08`.

## Production
The output in `dist/` is a static site; host it on any static host. Configure
`VITE_CAFE_API_BASE_URL` (see `.env.example`). Until INBYTE Café provides its
integration adapter, a production build shows "online ordering unavailable"
instead of accepting fake orders.

See **[docs/WEBSITE_INTEGRATION.md](docs/WEBSITE_INTEGRATION.md)** for the
integration contract, the `clientRequestId` lifecycle, the QR flow and the list
of Café-side dependencies.
