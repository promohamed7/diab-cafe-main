# INBYTE CAFÉ — PROJECT CONTEXT

> **Product:** INBYTE Café  
> **Product Family:** INBYTE Systems  
> **Version:** 0.1.0 (Phase 4 in progress)  
> **Repository Root:** `d:\Work\INBYTE\INBYTE Systems\INBYTE PRODUCTS\INBYTE Cafe`  
> **Target Segment:** Specialized Cafés, Coffee Shops, Espresso Bars, and Bakeries

---

## 1. Domain & Scope Definition

INBYTE Café is a specialized point-of-sale (POS), local-first operations engine, and digital ordering platform designed exclusively for café environments.

### What INBYTE Café Is:
- A high-speed, barista-oriented counter POS.
- A product catalog with flexible modifiers (milks, syrups, sizes, sweetness levels).
- An offline-first, local SQLite relational database engine.
- An append-only inventory movement ledger preventing negative stock.
- A deterministic cash drawer shift management system with exact minor-unit reconciliation.
- A table management and QR code ordering system for dine-in guests.
- A unified order inbox processing counter orders, table QR orders, and external online orders.

### What INBYTE Café Is NOT:
- **NOT a generic Restaurant Management System (RMS)**: No table booking/reservations, no kitchen display system (KDS) stations, no multi-course meal pacing, no complex waiter shift tip pooling.
- **NOT a generic retail ERP**: No purchase requisition workflows, no multi-warehouse logistics, no supplier balance sheets.
- **NOT a cloud-only web app**: The local café POS operates autonomously without internet.

---

## 2. Technology Stack

- **Desktop Shell:** Tauri v2 (Rust backend + Webview frontend).
- **Core Engine:** Rust (`inbyte_cafe`), implementing Clean Architecture (Domain, Application, Infrastructure, Contracts).
- **Local Persistence:** Disk-backed SQLite with Write-Ahead Logging (`WAL`), `busy_timeout = 5000ms`, `foreign_keys = ON`, `synchronous = NORMAL`.
- **Concurrency Protection:** Multi-step transactions execute with `BEGIN IMMEDIATE`; all database I/O is offloaded via `tokio::task::spawn_blocking` to preserve Win32 UI thread responsiveness (`ThreadId(1)`).
- **Financial Arithmetic:** Integer minor units (`i64` cents/piastres) for all money amounts with zero floating-point math.
- **Desktop Frontend:** React 19 + TypeScript + Tailwind CSS, full Right-to-Left (RTL) Arabic support.
- **IPC Protocol:** Typed, schema-synchronized JSON commands with `ApiResponse<T>` wrappers.

---

## 3. Current Phase Status Summary

- **Phase 1 (Core Foundation & SQLite Engine):** `ACCEPTED` (12/12 tests passed).
- **Phase 2 (POS Core / Catalog / Sales Engine):** `ACCEPTED` (25/25 tests passed).
- **Phase 3 (Inventory / Stocktaking / Returns / Audit Engine):** `ACCEPTED` (38/38 tests passed).
- **Phase 4 (Tables + QR Ordering + Unified Order Engine + Order Inbox):** `ACCEPTED` (40/40 tests passed, 115/115 total).
- **Phase 5 (Thermal & Barista Printing Engine):** `ACCEPTED` (46/46 tests passed, 161/161 total).
- **Phase 6 (Raw Materials, Recipes BOM & Costing Foundation):** `ACCEPTED` (40/40 tests passed, 201/201 total).
- **Phase 7 (Back Office Purchasing, Suppliers & Accounts Payable):** `ACCEPTED` (40/40 tests passed, 241/241 total).
- **Phase 8 (Customer Web Commerce & Supabase Cloud Sync Platform):** `SPECIFIED` (Handoff in `docs/WEBSITE_ENGINEERING_HANDOFF.md`).
- **Phase 9 (Licensing, Security & Hardening):** `PLANNED`.
- **Phase 10 (Multi-Branch Multi-Tenant Architecture):** `PLANNED`.
