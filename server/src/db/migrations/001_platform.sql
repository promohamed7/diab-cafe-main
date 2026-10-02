-- INBYTE Digital Menu Platform — initial schema.
--
-- Ownership rules encoded here:
--   * Every tenant-owned row carries tenant_id (tenants.id) and every unique key
--     that a customer or connector can name is scoped by tenant_id.
--   * The catalog_* tables are a read projection pushed by the café's connector.
--     INBYTE Café owns names, prices, availability and modifiers. The platform's
--     own menu data (menu_*_presentation) has no price column on purpose.
--   * Orders here are customer order *intents* plus the customer-facing
--     projection of what Café reports. Café creates the authoritative order,
--     numbers it and owns its status; the platform only stores what Café sends.
--   * Money is integer minor units (BIGINT). No floating point anywhere.

CREATE TABLE tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Public, stable café identifier ("harbor-roast"). Exposed in URLs as tenantId.
  tenant_key            TEXT NOT NULL UNIQUE CHECK (tenant_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  status                TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'DISABLED')),
  display_name          TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  locale                TEXT NOT NULL DEFAULT 'ar-EG',
  currency_code         TEXT NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  currency_symbol       TEXT NOT NULL CHECK (length(currency_symbol) BETWEEN 1 AND 12),
  -- Presentation documents, validated by the API before they are written.
  identity              JSONB NOT NULL DEFAULT '{}'::jsonb,
  branding              JSONB NOT NULL,
  contact               JSONB NOT NULL DEFAULT '{}'::jsonb,
  content               JSONB NOT NULL DEFAULT '{}'::jsonb,
  business_hours_text   TEXT,
  -- Ordering configuration (queried by order intake, so real columns).
  online_ordering       BOOLEAN NOT NULL DEFAULT false,
  pickup_enabled        BOOLEAN NOT NULL DEFAULT false,
  delivery_enabled      BOOLEAN NOT NULL DEFAULT false,
  dine_in_qr_enabled    BOOLEAN NOT NULL DEFAULT false,
  payment_methods       TEXT[] NOT NULL DEFAULT '{}'
    CHECK (payment_methods <@ ARRAY['CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'INSTAPAY', 'WALLET', 'ONLINE_PAID']),
  minimum_order_cents   BIGINT CHECK (minimum_order_cents IS NULL OR minimum_order_cents >= 0),
  delivery_area_text    TEXT,
  -- What happens when the café's POS is offline: refuse orders, or queue them briefly.
  offline_order_policy  TEXT NOT NULL DEFAULT 'REJECT' CHECK (offline_order_policy IN ('REJECT', 'QUEUE')),
  queue_ttl_minutes     INTEGER NOT NULL DEFAULT 15 CHECK (queue_ttl_minutes BETWEEN 1 AND 240),
  config_version        INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hostnames (custom domains / platform subdomains) that serve a café's website.
CREATE TABLE tenant_domains (
  host        TEXT PRIMARY KEY CHECK (host = lower(host) AND host ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_domains_tenant ON tenant_domains(tenant_id);
CREATE UNIQUE INDEX uq_tenant_domains_primary ON tenant_domains(tenant_id) WHERE is_primary;

-- ---------------------------------------------------------------------------
-- Catalog projection (pushed by the café connector; Café is authoritative)
-- ---------------------------------------------------------------------------

CREATE TABLE catalog_categories (
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cafe_category_id     BIGINT NOT NULL CHECK (cafe_category_id > 0),
  name                 TEXT NOT NULL,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL,
  is_available_online  BOOLEAN NOT NULL,
  PRIMARY KEY (tenant_id, cafe_category_id)
);

CREATE TABLE catalog_products (
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cafe_product_id      BIGINT NOT NULL CHECK (cafe_product_id > 0),
  cafe_category_id     BIGINT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  price_cents          BIGINT NOT NULL CHECK (price_cents >= 0),
  is_active            BOOLEAN NOT NULL,
  is_available_online  BOOLEAN NOT NULL,
  availability         TEXT NOT NULL CHECK (availability IN ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN')),
  PRIMARY KEY (tenant_id, cafe_product_id),
  FOREIGN KEY (tenant_id, cafe_category_id) REFERENCES catalog_categories(tenant_id, cafe_category_id) ON DELETE CASCADE
);

CREATE TABLE catalog_modifier_groups (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cafe_group_id   BIGINT NOT NULL CHECK (cafe_group_id > 0),
  name            TEXT NOT NULL,
  is_required     BOOLEAN NOT NULL,
  allow_multiple  BOOLEAN NOT NULL,
  PRIMARY KEY (tenant_id, cafe_group_id)
);

CREATE TABLE catalog_modifier_options (
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cafe_option_id     BIGINT NOT NULL CHECK (cafe_option_id > 0),
  cafe_group_id      BIGINT NOT NULL,
  name               TEXT NOT NULL,
  price_delta_cents  BIGINT NOT NULL,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, cafe_option_id),
  FOREIGN KEY (tenant_id, cafe_group_id) REFERENCES catalog_modifier_groups(tenant_id, cafe_group_id) ON DELETE CASCADE
);

CREATE TABLE catalog_product_modifier_groups (
  tenant_id        UUID NOT NULL,
  cafe_product_id  BIGINT NOT NULL,
  cafe_group_id    BIGINT NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, cafe_product_id, cafe_group_id),
  FOREIGN KEY (tenant_id, cafe_product_id) REFERENCES catalog_products(tenant_id, cafe_product_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, cafe_group_id) REFERENCES catalog_modifier_groups(tenant_id, cafe_group_id) ON DELETE CASCADE
);

CREATE TABLE catalog_sync_state (
  tenant_id       UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  cafe_version    TEXT,
  synced_at       TIMESTAMPTZ NOT NULL,
  category_count  INTEGER NOT NULL,
  product_count   INTEGER NOT NULL
);

-- Digital-menu presentation, owned by the platform. Keyed by Café IDs so it
-- survives catalog re-syncs. Deliberately no price/availability columns:
-- Café wins on operational truth.
CREATE TABLE menu_category_presentation (
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cafe_category_id  BIGINT NOT NULL,
  visible           BOOLEAN NOT NULL DEFAULT true,
  display_order     INTEGER,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, cafe_category_id)
);

CREATE TABLE menu_product_presentation (
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cafe_product_id        BIGINT NOT NULL,
  visible                BOOLEAN NOT NULL DEFAULT true,
  featured               BOOLEAN NOT NULL DEFAULT false,
  display_order          INTEGER,
  marketing_description  TEXT CHECK (marketing_description IS NULL OR length(marketing_description) <= 400),
  image_url              TEXT CHECK (image_url IS NULL OR image_url ~ '^https?://'),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, cafe_product_id)
);

-- ---------------------------------------------------------------------------
-- Tables / QR capabilities (issued by Café, synced by the connector)
-- ---------------------------------------------------------------------------

CREATE TABLE cafe_tables (
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cafe_table_id  BIGINT NOT NULL CHECK (cafe_table_id > 0),
  label          TEXT NOT NULL,
  -- Café-issued capability printed in the table QR. Unique per café only:
  -- lookups always include tenant_id, so café A's token is unknown to café B.
  qr_token       TEXT NOT NULL CHECK (qr_token ~ '^[A-Za-z0-9_-]{8,128}$'),
  is_active      BOOLEAN NOT NULL,          -- Café's own flag
  qr_enabled     BOOLEAN NOT NULL DEFAULT true, -- platform kill switch (admin)
  synced_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, cafe_table_id),
  UNIQUE (tenant_id, qr_token)
);

-- ---------------------------------------------------------------------------
-- Integration with each café's INBYTE Café installation
-- ---------------------------------------------------------------------------

CREATE TABLE integration_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status              TEXT NOT NULL CHECK (status IN ('PENDING_PAIRING', 'ACTIVE', 'REVOKED')),
  pairing_code_hash   TEXT,
  pairing_expires_at  TIMESTAMPTZ,
  credential_hash     TEXT UNIQUE,
  credential_prefix   TEXT,
  cafe_instance_id    TEXT,
  connector_version   TEXT,
  cafe_app_version    TEXT,
  paired_at           TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- At most one live (pending or active) connection per café.
CREATE UNIQUE INDEX uq_integration_live_connection ON integration_connections(tenant_id) WHERE status <> 'REVOKED';
CREATE INDEX idx_integration_pairing ON integration_connections(pairing_code_hash) WHERE status = 'PENDING_PAIRING';

CREATE TABLE integration_events (
  id             BIGSERIAL PRIMARY KEY,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id  UUID REFERENCES integration_connections(id) ON DELETE SET NULL,
  level          TEXT NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  kind           TEXT NOT NULL,
  detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_events_tenant ON integration_events(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Orders (customer intents + customer-facing projection of Café's order)
-- ---------------------------------------------------------------------------

CREATE TABLE orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Non-guessable customer tracking reference (80 random bits). Never sequential.
  public_reference       TEXT NOT NULL UNIQUE,
  -- Idempotency: the key is scoped to the café; the fingerprint detects payload changes.
  client_request_id      UUID NOT NULL,
  request_fingerprint    TEXT NOT NULL,
  order_type             TEXT NOT NULL CHECK (order_type IN ('PICKUP', 'DELIVERY', 'DINE_IN')),
  order_channel          TEXT NOT NULL CHECK (order_channel IN ('ONLINE', 'TABLE_QR')),
  cafe_table_id          BIGINT,
  table_token            TEXT,
  table_label            TEXT,
  customer_name          TEXT,
  customer_phone         TEXT,
  delivery_address       TEXT,
  customer_notes         TEXT,
  payment_method         TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CREDIT_CARD')),
  expected_total_cents   BIGINT,
  -- Platform estimate from the last catalog sync. Display only; Café re-prices.
  estimated_total_cents  BIGINT NOT NULL CHECK (estimated_total_cents >= 0),
  order_status           TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (order_status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED')),
  payment_status         TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (payment_status IN ('PENDING', 'SUBMITTED', 'VERIFICATION_REQUIRED', 'VERIFIED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
  -- Delivery of the intent to the café's POS (the platform's outbox state).
  delivery_state         TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK (delivery_state IN ('QUEUED', 'LEASED', 'DELIVERED', 'REJECTED_BY_CAFE', 'NOT_DELIVERED')),
  delivery_attempts      INTEGER NOT NULL DEFAULT 0,
  leased_by              UUID REFERENCES integration_connections(id) ON DELETE SET NULL,
  lease_expires_at       TIMESTAMPTZ,
  deliver_before         TIMESTAMPTZ NOT NULL,
  -- Authoritative values reported by Café.
  cafe_order_number      TEXT,
  cafe_subtotal_cents    BIGINT,
  cafe_discount_cents    BIGINT,
  cafe_total_cents       BIGINT,
  cafe_status_version    BIGINT NOT NULL DEFAULT 0,
  rejection_code         TEXT,
  rejection_reason       TEXT,
  delivered_at           TIMESTAMPTZ,
  customer_data_redacted_at TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_request_id),
  CHECK ((order_channel = 'TABLE_QR' AND order_type = 'DINE_IN') OR (order_channel = 'ONLINE' AND order_type IN ('PICKUP', 'DELIVERY'))),
  CHECK (order_type <> 'DINE_IN' OR cafe_table_id IS NOT NULL)
);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_delivery ON orders(tenant_id, delivery_state, created_at) WHERE delivery_state IN ('QUEUED', 'LEASED');

CREATE TABLE order_items (
  order_id               UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_no                SMALLINT NOT NULL,
  cafe_product_id        BIGINT NOT NULL,
  quantity               INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  modifier_option_ids    BIGINT[] NOT NULL DEFAULT '{}',
  product_name           TEXT NOT NULL,
  estimated_line_cents   BIGINT NOT NULL,
  PRIMARY KEY (order_id, line_no)
);

CREATE TABLE order_status_history (
  id              BIGSERIAL PRIMARY KEY,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('PLATFORM', 'CAFE', 'SYSTEM')),
  order_status    TEXT NOT NULL,
  payment_status  TEXT NOT NULL,
  delivery_state  TEXT NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_history_order ON order_status_history(order_id, id);

-- ---------------------------------------------------------------------------
-- INBYTE administration
-- ---------------------------------------------------------------------------

CREATE TABLE admin_users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT NOT NULL UNIQUE CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name         TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('INBYTE_SUPER_ADMIN', 'INBYTE_OPERATOR')),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  failed_login_count   INTEGER NOT NULL DEFAULT 0,
  locked_until         TIMESTAMPTZ,
  last_login_at        TIMESTAMPTZ,
  password_changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash     TEXT NOT NULL UNIQUE,
  csrf_token     TEXT NOT NULL,
  admin_user_id  UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  ip             TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ
);
CREATE INDEX idx_admin_sessions_user ON admin_sessions(admin_user_id);

CREATE TABLE audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('ADMIN', 'CONNECTOR', 'SYSTEM')),
  actor_id     TEXT,
  actor_label  TEXT,
  tenant_id    UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip           TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);
