# INBYTE CAFÉ — FEATURE SPECIFICATION

> **Feature Status Tracker & Functional Blueprint**  
> **Status:** ACTIVE

---

## 1. Feature Status Matrix

| Module | Feature Area | Status | Target Phase | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Catalog** | Category CRUD & Sort Order | `IMPLEMENTED` | Phase 2 | Soft-delete protection on active products. |
| **Catalog** | Product CRUD & Barcode Lookup | `IMPLEMENTED` | Phase 2 | Integer cents pricing, unique barcode index. |
| **Catalog** | High-Performance Arabic Search | `IMPLEMENTED` | Phase 2 | Single-pass normalization pre-indexed tokens. |
| **Catalog** | Modifier Groups & Options | `IMPLEMENTED` | Phase 2 | Required/optional, price delta calculations. |
| **POS** | Authoritative Cart Pricing | `IMPLEMENTED` | Phase 2 | Rejects client price tampering. |
| **POS** | Shift Open / Float Recording | `IMPLEMENTED` | Phase 2 | Requires float $\ge 0$, single active shift per station. |
| **POS** | Atomic Checkout (BEGIN IMMEDIATE) | `IMPLEMENTED` | Phase 2 | Multi-tender split payments (Cash, Card). |
| **POS** | Shift Reconciliation & Drawer Balance | `IMPLEMENTED` | Phase 2 | Exact deterministic formula, zero float drift. |
| **Inventory** | Low Stock Threshold Alerts | `IMPLEMENTED` | Phase 3 | Configurable per product, filterable catalog. |
| **Inventory** | Authoritative Stock Adjustments | `IMPLEMENTED` | Phase 3 | Non-negative constraint `CHECK(stock >= 0)`. |
| **Inventory** | Append-Only Movement Ledger | `IMPLEMENTED` | Phase 3 | Records `SALE`, `RETURN`, `ADJUSTMENT`, etc. |
| **Inventory** | Periodic Stocktaking (Cycle Count) | `IMPLEMENTED` | Phase 3 | Draft snapshot, physical count, atomic commit. |
| **Inventory** | Strict Order Returns & Capping | `IMPLEMENTED` | Phase 3 | Capped at originally sold quantity, drawer integration. |
| **Tables & QR** | Table Management (CRUD & Numbering) | `IMPLEMENTED` | Phase 4 | Unique numbers, safe deactivation. |
| **Tables & QR** | Table Status Lifecycle | `IMPLEMENTED` | Phase 4 | `AVAILABLE`, `ORDERING`, `ACTIVE`, `PREPARING`, `READY`. |
| **Tables & QR** | Table QR Identity & Tokens | `IMPLEMENTED` | Phase 4 | Stable tokens, base URL configuration. |
| **Orders** | Unified Order Engine | `IMPLEMENTED` | Phase 4 | Common domain model for Counter, Dine-In, Online. |
| **Orders** | Order Types (COUNTER, DINE_IN, PICKUP, DELIVERY) | `IMPLEMENTED` | Phase 4 | Strongly typed enum representation. |
| **Orders** | Order Channels (COUNTER, TABLE_QR, ONLINE) | `IMPLEMENTED` | Phase 4 | Source channel tracking. |
| **Orders** | Centralized Order Inbox & Counters | `IMPLEMENTED` | Phase 4 | Real-time pending DINE_IN and ONLINE counters. |
| **Orders** | Order Lifecycle State Machine | `IMPLEMENTED` | Phase 4 | `PENDING` $\rightarrow$ `ACCEPTED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`. |
| **Customer Web** | Customer Ordering Web Foundation | `IMPLEMENTED` | Phase 4 | Dine-in QR entry & external pickup/delivery UX. |
| **Printing** | ESC/POS Thermal Receipt Printing | `IMPLEMENTED` | Phase 5 | Win32 Spooler integration, 4-second watchdog. |
| **Printing** | Barista Order Tickets | `IMPLEMENTED` | Phase 5 | Auto-print on order acceptance. |
| **Recipes & BOM** | Raw Materials & Multi-Item Recipes | `IMPLEMENTED` | Phase 6 | BOM versioning, integer milli-costing. |
| **Recipes & BOM** | Ingredient Consumption on Order | `IMPLEMENTED` | Phase 6 | Pre-flight shortage check, atomic deduction. |
| **Purchasing & AP**| Supplier Master & Accounts Payable Subledger | `IMPLEMENTED` | Phase 7 | Subledger, atomic receiving, WAC $i128$ math. |
| **Purchasing & AP**| Purchase Invoices & Strict Payment Matrix | `IMPLEMENTED` | Phase 7 | Cash drawer vs Safe vs Bank/Check. |
| **Cloud Sync** | Supabase Bi-Directional Sync | `PLANNED` | Phase 8 | Idempotent inbox/outbox, offline queue. |
| **Cloud Sync** | Customer Web Cloud Backend | `PLANNED` | Phase 8 | Public ordering website hosted on Supabase. |
| **Security** | Hardware Fingerprint Licensing | `PLANNED` | Phase 9 | Ed25519 signed activation token. |
| **RMS / ERP** | Table Reservations / Booking | `DEFERRED` | N/A | Excluded: not applicable to café domain. |
| **RMS / ERP** | Kitchen Display System (KDS) | `DEFERRED` | N/A | Excluded: counter ticket workflow prioritized. |
| **RMS / ERP** | Waiter Table Assignments & Tip Pooling | `NOT_IMPLEMENTED` | N/A | Excluded: counter/self-service focus. |
