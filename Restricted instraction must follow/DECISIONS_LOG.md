# INBYTE CAFÉ — ARCHITECTURAL DECISIONS LOG (ADR)

> **Architectural Decision Records**  
> **Status:** ACTIVE

---

### ADR-001: Local SQLite Authority
- **Status:** Accepted (Phase 1)
- **Context:** Cafés experience network outages. Service must never halt because the internet or cloud provider is unavailable.
- **Decision:** The local disk-backed SQLite database is the primary authority for in-store café operations, catalog management, cashier shifts, inventory tracking, and point-of-sale transactions.
- **Consequences:** All core business logic is implemented locally in Rust and persisted directly to SQLite. Cloud synchronization serves as a replica/inbox, not a prerequisite for local operation.

---

### ADR-002: Unified Order Engine
- **Status:** Accepted (Phase 4)
- **Context:** Orders originate from cashier POS, table QR scans, and remote online channels. Building separate ordering pipelines leads to duplicated logic, inconsistent inventory deductions, and pricing vulnerabilities.
- **Decision:** All channels submit through a single, unified Order Engine. All orders create the same canonical `orders` and `order_items` records and use the same authoritative price recalculation and inventory deduction logic.
- **Consequences:** Eliminates divergent ordering behavior and provides a unified Order Inbox.

---

### ADR-003: Table QR Ordering
- **Status:** Accepted (Phase 4)
- **Context:** Dine-in customers desire self-service ordering from their phones without waiting for a cashier.
- **Decision:** Each café table is assigned a stable, unique public QR token. Scanning the QR opens the customer web ordering app with pre-bound table context.
- **Consequences:** Enhances customer experience and accelerates ordering throughput during peak hours.

---

### ADR-004: Dine-In vs. External Order Flow
- **Status:** Accepted (Phase 4)
- **Context:** Dine-in guests are seated inside and should not be burdened with entering delivery addresses or phone numbers. External pickup/delivery customers must provide contact and delivery details.
- **Decision:** The ordering application branches based on entry mode: `DINE_IN` requires a valid table context and collects zero delivery data; `PICKUP` requires customer name and phone; `DELIVERY` requires customer name, phone, and delivery address.
- **Consequences:** Minimizes friction for dine-in guests while capturing essential delivery metadata.

---

### ADR-005: Order Type vs. Order Channel Separation
- **Status:** Accepted (Phase 4)
- **Context:** Conflating service type (`DINE_IN`, `COUNTER`, `DELIVERY`) with submission channel (`COUNTER`, `TABLE_QR`, `ONLINE`) leads to schema confusion and brittle UI conditions.
- **Decision:** Explicitly separate `order_type` (what service is rendered) from `order_channel` (how the order reached the system).
- **Consequences:** Enables clear analytics and exact operational behavior (e.g. a cashier entering a `DINE_IN` order at the counter vs. a customer ordering `DINE_IN` via `TABLE_QR`).

---

### ADR-006: Payment Method vs. Payment Status Separation
- **Status:** Accepted (Phase 4)
- **Context:** Selecting a payment method (e.g., InstaPay or Bank Transfer) does not mean the payment has cleared. Marking transfer orders as `PAID` without verification creates fraud risks.
- **Decision:** Explicitly decouple `payment_method` (`CASH`, `CREDIT_CARD`, `BANK_TRANSFER`, `INSTAPAY`, `WALLET`) from `payment_status` (`PENDING`, `SUBMITTED`, `VERIFICATION_REQUIRED`, `VERIFIED`, `PAID`, `FAILED`, `REFUNDED`).
- **Consequences:** Manual transfers remain in `VERIFICATION_REQUIRED` until staff verify the external transfer and explicitly approve the transaction.

---

### ADR-007: Cashier-Created Orders Use the Same Order Engine
- **Status:** Accepted (Phase 4)
- **Context:** Some dine-in or pickup customers prefer ordering directly with the cashier.
- **Decision:** The cashier POS interface can create any order type (`COUNTER`, `DINE_IN` with table selection, `PICKUP`, or `DELIVERY`) through the same unified Order Engine.
- **Consequences:** Complete operational parity regardless of whether the customer used QR or the counter.

---

### ADR-008: Table QR Does Not Expose Sensitive Secrets
- **Status:** Accepted (Phase 4)
- **Context:** Public QR codes printed on physical tables can be inspected or manipulated by any patron.
- **Decision:** Table QR URLs encode only an opaque random alphanumeric `qr_token`. They never contain database IDs, passwords, API secrets, or pricing parameters.
- **Consequences:** Prevents enumeration attacks, unauthorized database inspection, and URL tampering.

---

### ADR-009: Customer Website Never Accesses Desktop SQLite Directly
- **Status:** Accepted (Phase 4 / Reinforced in Phase 8)
- **Context:** Exposing the local SQLite database to the public web introduces severe security risks and firewall challenges.
- **Decision:** The customer ordering web foundation communicates through an explicit service/API boundary. In Phase 8, cloud sync will bridge this boundary via Supabase outbox/inbox. Desktop SQLite is never directly accessible over the internet.
- **Consequences:** Maintains local POS network security and zero attack surface on desktop database files.

---

### ADR-010: Cloud/Supabase Synchronization is Deferred to Phase 8
- **Status:** Accepted (Phase 4 / Rescheduled to Phase 8 after Back Office Phases 6 & 7)
- **Context:** Prematurely coupling local ordering architecture to cloud database infrastructure delays core POS hardening and increases testing complexity.
- **Decision:** Phase 4 focused entirely on local table management, QR token resolution, unified order structures, and order inbox workflows. Following completion of Back Office Foundations (Phase 6 Raw Materials & Phase 7 Purchasing), Cloud sync, Supabase Edge Functions, and cloud RLS are scheduled for Phase 8.
- **Consequences:** Ensures a bulletproof local ordering engine before introducing cloud networking complexity.

---

### ADR-011: Safe SQLite Schema Evolution via Table Recreation
- **Status:** Accepted (Phase 4)
- **Context:** SQLite does not support `ALTER TABLE ... ALTER COLUMN` (such as dropping NOT NULL or modifying CHECK constraints). Attempting naive alter statements fails or leads to data loss.
- **Decision:** Schema updates requiring constraint adjustments (such as making `shift_id` and `cashier_id` nullable for remote customer orders) utilize the standard SQLite table recreation pattern: disable foreign keys, create temporary table, copy data, drop old table, rename, recreate indexes, and re-enable foreign keys.
- **Consequences:** Safe, non-destructive, transaction-wrapped migrations preserving 100% of historical production data.

---

### ADR-012: Multi-Order TableStatus Aggregate Resolution
- **Status:** Accepted (Phase 4)
- **Context:** In busy cafés, multiple independent orders can exist simultaneously for the same physical table (e.g. initial drinks, later food, add-ons). Simply mirroring one order's status causes table states to jitter or prematurely reset to AVAILABLE.
- **Decision:** Table operational status is computed from the aggregate state of all active orders for that table (priority: `PREPARING` > `READY` > `ACTIVE` > `AVAILABLE`).
- **Consequences:** Floor visibility accurately reflects the highest-priority operational state across all orders at a table.

---

### ADR-013: Server-Authoritative Exactly-Once Inventory Deduction
- **Status:** Accepted (Phase 4)
- **Context:** For remote Table QR and online orders, stock must not be deducted before the order is accepted by the barista, but must never be deducted more than once.
- **Decision:** When an order is moved to `ACCEPTED`, the engine verifies whether ledger movements for `reference_type = 'ORDER'` already exist. If not, it executes an atomic deduction inside the state transition transaction.
- **Consequences:** Eliminates phantom deductions from unaccepted orders and guarantees exactly-once stock subtraction.

---

### ADR-014: Immutable Print Snapshot vs. Current-State Reprint
- **Status:** Accepted (Phase 5)
- **Context:** If a print job fails due to paper depletion or temporary hardware disconnect, retrying must not introduce phantom mutations or reflect subsequent order alterations made after the initial print request.
- **Decision:** Persisted `print_jobs.raw_payload` is an immutable snapshot. Automatic retries strictly re-transmit the exact persisted byte payload without re-querying or re-rendering order state. Conversely, explicit manual reprint requests generate a brand-new print job record (`reprint_of_id`) that renders the current authoritative order state.
- **Consequences:** Ensures physical receipt audit integrity while providing clear operational reprint capabilities.

---

### ADR-015: Software-Side Arabic Text Shaping & BiDi Reordering
- **Status:** Accepted (Phase 5)
- **Context:** Standard ESC/POS receipt printers do not possess native Arabic font microcode or right-to-left line breaking engines. Raw UTF-8 Arabic text prints disconnected and left-to-right.
- **Decision:** Implement a pure Rust contextual shaper utilizing Unicode Presentation Forms-B (`\u{FE80}`–`\u{FEFC}`), authoritative Lam-Alef ligatures (`\u{FEF5}`–`\u{FEFC}`), bidirectional word reversal for Arabic text, and left-to-right preservation for Latin text and numbers.
- **Consequences:** High-fidelity Arabic printing on commodity ESC/POS hardware without third-party graphics rasterizers or cloud dependencies.

---

### ADR-016: Direct Windows Spooler API (`winspool.drv`) with 4-Second Watchdog
- **Status:** Accepted (Phase 5)
- **Context:** Shelling out to `lpr.exe` or raw pipe streaming causes compatibility issues across Windows editions. Direct calls to `winspool.drv` can hang indefinitely if a printer driver deadlocks.
- **Decision:** Bind directly to `winspool.drv` native FFI (`OpenPrinterW`, `StartDocPrinterW`, `WritePrinter`, `EndDocPrinterW`, `ClosePrinter`) executed in an isolated OS thread monitored by a strict 4-second watchdog timer (`mpsc::recv_timeout`).
- **Consequences:** Flawless Windows driver integration with zero risk of locking the desktop UI message pump.

---

### ADR-017: Print Queue Isolation from Order, Shift, and Inventory Transactions
- **Status:** Accepted (Phase 5)
- **Context:** Physical hardware failures (paper out, jam, disconnected USB) must never jeopardize committed customer orders, shift cash accounting, or inventory balances.
- **Decision:** Database transactions commit first; print jobs are persisted into `print_jobs` in `QUEUED` state. The print worker executes outside transaction boundaries. If a print job fails, the order and payments remain fully valid.
- **Consequences:** Eliminates POS lockups and prevents data loss caused by peripheral hardware malfunctions.

---

### ADR-018: Bounded Retries and Crash Recovery via PRINTING to FAILED Transition
- **Status:** Accepted (Phase 5)
- **Context:** Infinite print loops waste paper and jam spools. Power outages or application terminations during active printing can leave jobs orphaned in `PRINTING` state. Automatically moving `PRINTING` → `QUEUED` upon restart risks dispensing duplicate physical receipts or duplicate kitchen/bar tickets if the printer hardware had already accepted or printed the bytes prior to the crash.
- **Decision:** Print attempts are strictly bounded to `max_attempts = 3`. On startup, `recover_interrupted_jobs` automatically transitions any orphaned `PRINTING` jobs to `FAILED` with a diagnostic note (`'Interrupted by unexpected application shutdown / crash'`). Re-dispatch strictly requires an explicit manual cashier retry or reprint action.
- **Consequences:** Eliminates accidental physical duplicate printing after application crashes, while ensuring complete audit visibility in print logs.

---

### ADR-019: Dynamic Station Routing for Receipts, Kitchen, and Bar
- **Status:** Accepted (Phase 5)
- **Context:** Cafés have distinct preparation stations (barista bar vs. kitchen/bakery) requiring filtered ticket output, alongside cashier receipt printers.
- **Decision:** Printers are assigned roles (`RECEIPT`, `KITCHEN`, `BAR`, `REPORT`). Orders automatically route beverage items to `BAR` printers, food items to `KITCHEN` printers, and financial totals to `RECEIPT` printers.
- **Consequences:** Streamlines kitchen/bar workflow and prevents station ticket cross-contamination.

---

### ADR-020: Hardware Honesty Standard in CI / Automated Environments
- **Status:** Accepted (Phase 5)
- **Context:** Continuous integration and development workstations rarely have physical ESC/POS hardware attached. Claiming physical hardware verification without attached hardware is misleading.
- **Decision:** Byte-level accuracy, ESC/POS builder sequences, and queue state transitions are verified 100% in automated tests. Physical paper output, thermal darkness, cut alignment, and cash drawer kick solenoids are formally documented as "NOT PHYSICALLY VERIFIED" until validated on an in-situ workstation.
- **Consequences:** Ensures uncompromising engineering honesty and transparent hardware deployment boundaries.

---

### ADR-021: Unified Back Office, POS, and Web Commerce Architecture
- **Status:** Accepted (Strategic Architecture)
- **Context:** Food and beverage businesses suffer from fragmented systems where Back Office, Cashier POS, and Web Ordering operate as disconnected silos with duplicate menus, unsynchronized inventory, and manual transcription.
- **Decision:** Architect INBYTE Café as a single unified system of record spanning three operational pillars: Back Office (Purchasing, Inventory, Recipes, Costing, Expenses), POS / Store (Dine-in, Counter, Delivery, Tables, Printing), and Web Commerce (Website, Online Menu, QR Ordering, Order Tracking, Customer Accounts). Local desktop SQLite is the authoritative master.
- **Consequences:** Eliminates menu maintenance duplication; any catalog or price update instantly reflects across POS, Web, and QR. Web orders route seamlessly into local kitchen/bar queues and shift reconciliation.

---

### ADR-022: Recipe-Based Inventory & Raw Material Costing (BOM)
- **Status:** Accepted (Strategic Architecture)
- **Context:** Cafés purchase raw commodities (beans, milk, syrups, packaging) rather than finished beverages. Tracking inventory strictly at the product level prevents accurate stock control and distorts financial reporting.
- **Decision:** Establish a relational Bill of Materials (BOM) engine linking saleable products and modifier options to raw materials (`raw_materials`, `product_recipes`, `modifier_recipes`). Stock deductions occur at the raw material level upon order acceptance. Raw material costs are tracked via Weighted Average Cost (WAC) to compute instantaneous COGS and gross profit margins.
- **Consequences:** Eliminates stockout surprises for essential ingredients, enables true café inventory control, and provides real-time unit economics for every menu item.

---

### ADR-023: Native Web Commerce as Primary Strategic Differentiator
- **Status:** Accepted (Strategic Architecture)
- **Context:** Aggregators charge 15%–30% commissions, withhold customer data, and force manual order re-entry. Generic e-commerce platforms do not integrate with kitchen printers or physical drawer shifts.
- **Decision:** Deliver Web Commerce as a first-class native channel of the INBYTE Café engine. The customer website shares the same live catalog, respects real-time stockouts, prints directly to native kitchen/bar spoolers, and reconciles into active cashier shifts at 0% commission.
- **Consequences:** Creates a formidable competitive advantage over fragmented POS and aggregator setups, giving café owners complete customer ownership and operational efficiency.

---

### ADR-024: Deterministic Stock Source Separation (No Dual Stock Source Invariant)
- **Status:** Accepted (Phase 6)
- **Context:** A product in a café could theoretically be configured with both a finished goods stock level and a recipe. Deducting both on sale would cause duplicate inventory depletion and financial distortions.
- **Decision:** Enforce a strict, mutually exclusive stock source rule:
  - IF an active recipe exists for the sold product $\rightarrow$ deduce exclusively from `raw_materials` via `RecipeConsumptionService`. The `products.stock` field and `inventory_movements` table remain untouched.
  - IF no active recipe exists for the sold product $\rightarrow$ deduce exclusively from `products.stock` via `InventoryService` and log to `inventory_movements`.
  - A single item sale must NEVER deduct from both sources.
- **Consequences:** Eliminates double-deduction risks and provides a clean, predictable transition path as items are gradually migrated to recipe-based tracking.

---

### ADR-025: Immutable Recipe Versioning with Historical Audit Snapshots
- **Status:** Accepted (Phase 6)
- **Context:** Cafés frequently refine drink preparation formulas (e.g. changing espresso dose from 18g to 20g) or experience raw material price changes. Updating recipe rows in-place corrupts historical COGS calculations and invalidates previous shift margin audits.
- **Decision:** Recipe formulas are strictly immutable. Updating a product's recipe inserts a new row with `version + 1` and `is_active = 1`, and atomically supersedes the existing recipe by marking it `is_active = 0` with a `superseded_at` timestamp. Historical movements and orders snapshot the specific `recipe_id` active at sale time.
- **Consequences:** Complete mathematical auditability and zero retrospective corruption of historical margins.

---

### ADR-026: Integer Minor Units for Quantities (Milli) and Costs (Milli-Cents) with Checked Math
- **Status:** Accepted (Phase 6)
- **Context:** Raw materials are consumed in fractional amounts (e.g. 18.5g of coffee, 220ml of milk, 0.5 pump of vanilla). Floating-point representations suffer from rounding drift that accumulates across thousands of transactions.
- **Decision:**
  - Quantities are stored in integer milli-units (`quantity_milli: i64`, $1\text{ unit} = 1,000\text{ milli}$).
  - Raw material unit costs are stored in integer milli-cents (`cost_per_base_unit_milli_cents: i64`, $1\text{ cent} = 1,000\text{ milli-cents}$).
  - Unit conversions and division use deterministic integer half-up rounding `div_half_up(N, D) = (N + (D / 2)) / D`.
  - All operations use checked arithmetic to prevent runtime overflow panics.
- **Consequences:** 100% deterministic, zero-float financial and inventory precision guaranteed across all platforms.

---

### ADR-027: Prepared Food and Beverage Non-Restoration Domain Rule
- **Status:** Accepted (Phase 6)
- **Context:** When a customer returns a brewed cup of coffee (e.g. beverage was cold or wrong milk preference), issuing a refund must be tracked financially. However, restoring coffee beans and milk to physical inventory is physically impossible and fabricates phantom stock.
- **Decision:** On customer returns of products with active recipes, cash/card refunds are processed and logged to drawer movements (`CASH_RETURN`), but **raw materials are NOT restored to inventory**. Unopened retail packaged goods without recipes (e.g. cans of soda) continue to restore finished goods `products.stock`.
- **Consequences:** Prevents phantom stock accumulation, aligns digital inventory with physical kitchen reality, and maintains drawer reconciliation integrity.

---

### ADR-028: Authoritative Supplier Payables Subledger with Materialized Balance Invariant
- **Status:** Accepted (Phase 7)
- **Context:** Cafés maintain rolling trade credit with multiple food/beverage and packaging suppliers. Maintaining only an operational balance field without an immutable ledger creates untraceable discrepancies, while a full double-entry General Ledger (GL) is excessive and out of scope for Phase 7.
- **Decision:** Implement a dedicated **Supplier Payables Subledger (`supplier_ledger`)**. The operational balance `suppliers.current_balance_cents` is a materialized summary, but `supplier_ledger` remains the authoritative financial history. An explicit invariant is enforced: $\sum \text{amount\_cents} \equiv \text{current\_balance\_cents}$. The system is explicitly scoped as an Accounts Payable subledger, not a full GL.
- **Consequences:** Guaranteed auditability of all supplier invoices and disbursements without the overhead of full enterprise double-entry accounting.

---

### ADR-029: Moving Weighted Average Cost (WAC) with Intermediate i128 Arithmetic and Non-Capitalized Tax
- **Status:** Accepted (Phase 7)
- **Context:** Each new shipment of raw materials may arrive at different purchase prices due to market fluctuations. Revaluing inventory on a Moving Weighted Average Cost basis requires division that could suffer from rounding drift or numeric overflow. Furthermore, sales tax on raw material purchases in Egypt/local regulations may affect liability without directly capitalizing into per-gram recipe costing.
- **Decision:**
  - Upon receiving a purchase invoice, WAC is recomputed for each line item using deterministic integer arithmetic:
    $$\text{New Cost} = \frac{(\text{Current Stock} \times \text{Current Unit Cost}) + (\text{Batch Qty} \times \text{Batch Unit Cost})}{\text{Current Stock} + \text{Batch Qty}}$$
  - Intermediate products and additions use $i128$ to guarantee overflow freedom across high-volume batches.
  - Division uses integer half-up rounding `div_half_up`.
  - Tax handling: Invoice `tax_cents` enters invoice totals and the AP subledger liability, but is **NOT capitalized into raw material valuation or WAC** (inventory tax allocation deferred).
- **Consequences:** Provides exact, drift-free inventory valuation for COGS calculation and menu margin engineering.

---

### ADR-030: Strict Tender Source Matrix for Supplier AP Disbursements
- **Status:** Accepted (Phase 7)
- **Context:** Paying a supplier in cash can occur from the active cashier drawer (reducing cashier shift cash) or from an external management safe/corporate petty cash. Bank transfers and checks never touch the physical drawer. Ambiguity in tender source creates severe drawer shift variances at shift closing.
- **Decision:** Enforce a strict, validated tender matrix:
  - `CASH + CASHIER_DRAWER`: Requires an active open shift; logs an atomic `PAY_OUT_EXPENSE` entry in `cash_drawer_movements` within the same transaction.
  - `CASH + EXTERNAL_SAFE`: Valid disbursement from outside the POS; creates zero drawer movements.
  - `CASH + NULL`: Rejected by validation (`InvalidPaymentConfiguration`).
  - `BANK_TRANSFER + NULL` or `CHECK + NULL`: Valid non-cash disbursement; creates zero drawer movements.
  - `BANK_TRANSFER + source` or `CHECK + source`: Rejected by validation (`InvalidPaymentConfiguration`).
  - Prepayments (`purchase_invoice_id = NULL`) are supported as supplier credit without automatic allocation to future invoices.
- **Consequences:** Eliminates cash drawer discrepancies and guarantees complete clarity over cash origins.

---

### ADR-031: Dual Database-Level Idempotency Protection for Receiving
- **Status:** Accepted (Phase 7)
- **Context:** Concurrent requests or rapid double-clicks on the "Receive Invoice" button could execute duplicate raw material movements and ledger additions if concurrency controls fail.
- **Decision:** In addition to immediate transactional boundaries (`BEGIN IMMEDIATE`), enforce dual partial unique indexes in SQLite:
  - `idx_supplier_ledger_purchase_unique`: `UNIQUE(reference_type, reference_id) WHERE reference_type = 'PURCHASE'`
  - `idx_rm_movements_purchase_unique`: `UNIQUE(reference_type, reference_id, raw_material_id) WHERE reference_type = 'PURCHASE'`
- **Consequences:** SQLite engine strictly forbids duplicate receiving at the storage layer, guaranteeing exactly-once inventory and subledger updates.



