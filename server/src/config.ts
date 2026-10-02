// Server configuration from environment variables. Secrets (DATABASE_URL) live
// only here, never in VITE_* variables or the browser bundle.

export interface ServerConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  /** Number of trusted reverse-proxy hops (X-Forwarded-*), 0 = none. */
  trustProxy: number;
  /** Secure cookies; always true in production. */
  cookieSecure: boolean;
  /** Extra browser origins allowed to call the public API cross-origin (same-origin needs none). */
  publicCorsOrigins: string[];
  /** Origins allowed to send admin mutations (Origin header check). Empty = same host only. */
  adminOrigins: string[];
  /** Built frontend (customer site + admin) served by the backend, if present. */
  staticDir: string | null;
  /** Public website URL for a café without a primary domain. `{tenantId}` and `{origin}` are replaced. */
  siteUrlTemplate: string;
  /** Café connector considered offline after this many seconds without a heartbeat. */
  connectorOfflineAfterSeconds: number;
  /** How long a connector holds a leased order before it can be redelivered. */
  orderLeaseSeconds: number;
  /** Customer contact data on finished orders is erased after this many days. */
  customerDataRetentionDays: number;
  adminSessionHours: number;
  adminSessionIdleMinutes: number;
  /** Multiplies every per-IP rate limit (load tests / integration test suites). */
  rateLimitScale: number;
}

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const mode = env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development';
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  return {
    env: mode,
    host: env.HOST?.trim() || '0.0.0.0',
    port: int(env.PORT, 8080, 1, 65535),
    databaseUrl,
    trustProxy: int(env.TRUST_PROXY_HOPS, 0, 0, 10),
    cookieSecure: mode === 'production' ? true : env.COOKIE_SECURE === 'true',
    publicCorsOrigins: list(env.PUBLIC_CORS_ORIGINS),
    adminOrigins: list(env.ADMIN_ORIGINS),
    staticDir: env.STATIC_DIR?.trim() || null,
    siteUrlTemplate: env.SITE_URL_TEMPLATE?.trim() || '{origin}/t/{tenantId}/',
    connectorOfflineAfterSeconds: int(env.CONNECTOR_OFFLINE_AFTER_SECONDS, 90, 10, 3600),
    orderLeaseSeconds: int(env.ORDER_LEASE_SECONDS, 60, 5, 3600),
    customerDataRetentionDays: int(env.CUSTOMER_DATA_RETENTION_DAYS, 30, 1, 3650),
    adminSessionHours: int(env.ADMIN_SESSION_HOURS, 12, 1, 168),
    adminSessionIdleMinutes: int(env.ADMIN_SESSION_IDLE_MINUTES, 120, 5, 1440),
    rateLimitScale: int(env.RATE_LIMIT_SCALE, 1, 1, 1000)
  };
}
