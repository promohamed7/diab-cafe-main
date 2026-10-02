// Test harness: every test file gets its own PostgreSQL schema (real database,
// real constraints), a controllable clock and an in-process HTTP client.
//
// Requires PostgreSQL. DATABASE_URL_TEST defaults to the local test database.

import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { migrate } from '../src/db/migrate.ts';
import { createPool } from '../src/db/pool.ts';
import type { Db } from '../src/db/pool.ts';
import type { AppContext } from '../src/http/context.ts';
import { createAdminUser } from '../src/modules/auth/authService.ts';
import { FakeCafeEngine } from '../../connector/src/fakeCafeEngine.ts';
import type { WireCatalogLike } from '../../connector/src/fakeCafeEngine.ts';
import type { FetchLike } from '../../connector/src/referenceConnector.ts';
import { ReferenceConnector } from '../../connector/src/referenceConnector.ts';

export const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgres://inbyte:inbyte@localhost:5432/inbyte_test';
export const SUPER_EMAIL = 'super@inbyte.test';
export const OPERATOR_EMAIL = 'operator@inbyte.test';
export const PASSWORD = 'correct horse battery staple';

export interface Harness {
  app: FastifyInstance;
  db: Db;
  ctx: AppContext;
  clock: { now: Date; advance(ms: number): void };
  close(): Promise<void>;
}

export async function createHarness(overrides: Partial<AppContext['config']> = {}): Promise<Harness> {
  const schema = `t_${randomBytes(6).toString('hex')}`;
  const admin = createPool(TEST_DB_URL, { max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();

  const db = createPool(TEST_DB_URL, { schema, max: 8 });
  await migrate(db);
  const clock = {
    now: new Date('2026-10-02T10:00:00Z'),
    advance(ms: number) {
      this.now = new Date(this.now.getTime() + ms);
    }
  };
  const config = { ...loadConfig({ DATABASE_URL: TEST_DB_URL, NODE_ENV: 'test' }), rateLimitScale: 1000, ...overrides };
  const ctx: AppContext = { config, db, now: () => clock.now };
  const app = await buildApp(ctx);
  await createAdminUser(db, { email: SUPER_EMAIL, displayName: 'Super', role: 'INBYTE_SUPER_ADMIN', password: PASSWORD });
  await createAdminUser(db, { email: OPERATOR_EMAIL, displayName: 'Operator', role: 'INBYTE_OPERATOR', password: PASSWORD });

  return {
    app,
    db,
    ctx,
    clock,
    async close() {
      await app.close();
      await db.end();
      const drop = createPool(TEST_DB_URL, { max: 1 });
      await drop.query(`DROP SCHEMA ${schema} CASCADE`);
      await drop.end();
    }
  };
}

/** fetch-compatible adapter over app.inject (no network sockets). */
export function injectFetch(app: FastifyInstance): FetchLike {
  return async (url, init) => {
    const u = new URL(url, 'http://platform.test');
    const res = await app.inject({ method: init.method as 'GET', url: u.pathname + u.search, headers: init.headers, payload: init.body });
    return { status: res.statusCode, json: async () => res.json() };
  };
}

export interface AdminSession {
  cookie: string;
  csrf: string;
  request(method: string, url: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<{ status: number; body: any }>;
}

export async function login(app: FastifyInstance, email: string, password = PASSWORD): Promise<AdminSession> {
  const res = await app.inject({ method: 'POST', url: '/api/admin/v1/auth/login', payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  const cookie = res.cookies.find((c) => c.name === 'inbyte_admin');
  if (!cookie) throw new Error('no session cookie');
  const session: AdminSession = {
    cookie: `inbyte_admin=${cookie.value}`,
    csrf: res.json().csrfToken,
    async request(method, url, body, extraHeaders = {}) {
      const r = await app.inject({
        method: method as 'GET',
        url,
        headers: { cookie: session.cookie, 'x-csrf-token': session.csrf, ...extraHeaders },
        payload: body === undefined ? undefined : (body as object)
      });
      let parsed: any = null;
      try {
        parsed = r.json();
      } catch {
        parsed = r.body;
      }
      return { status: r.statusCode, body: parsed };
    }
  };
  return session;
}

export async function publicCall(app: FastifyInstance, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  const r = await app.inject({ method: method as 'GET', url, payload: body === undefined ? undefined : (body as object), headers });
  let parsed: any = null;
  try {
    parsed = r.json();
  } catch {
    parsed = r.body;
  }
  return { status: r.statusCode, body: parsed, headers: r.headers };
}

// ---- Café fixtures (Café-side data; deliberately overlapping IDs between cafés) ----

export function catalogA(): WireCatalogLike {
  const size = { id: 11, name: 'Size', isRequired: true, allowMultiple: false, options: [{ id: 1101, name: 'Regular', priceDeltaCents: 0 }, { id: 1102, name: 'Large', priceDeltaCents: 1500 }] };
  const extras = { id: 12, name: 'Extras', isRequired: false, allowMultiple: true, options: [{ id: 1201, name: 'Extra shot', priceDeltaCents: 1000 }, { id: 1202, name: 'Syrup', priceDeltaCents: 500 }] };
  return {
    version: 'a-1',
    categories: [
      { id: 1, name: 'Coffee', sortOrder: 1, isActive: true, isAvailableOnline: true },
      { id: 2, name: 'Bakery', sortOrder: 2, isActive: true, isAvailableOnline: true }
    ],
    products: [
      { id: 101, categoryId: 1, name: 'Latte', description: 'Espresso and milk', priceCents: 5000, isActive: true, isAvailableOnline: true, availability: 'AVAILABLE', modifierGroups: [size, extras] },
      { id: 102, categoryId: 2, name: 'Cookie', description: null, priceCents: 2500, isActive: true, isAvailableOnline: true, availability: 'AVAILABLE', modifierGroups: [] },
      { id: 103, categoryId: 1, name: 'Staff Brew', description: null, priceCents: 3000, isActive: true, isAvailableOnline: false, availability: 'AVAILABLE', modifierGroups: [] },
      { id: 104, categoryId: 2, name: 'Croissant', description: null, priceCents: 2000, isActive: true, isAvailableOnline: true, availability: 'UNAVAILABLE', modifierGroups: [] }
    ]
  };
}

export function catalogB(): WireCatalogLike {
  return {
    version: 'b-1',
    categories: [{ id: 1, name: 'Tea', sortOrder: 1, isActive: true, isAvailableOnline: true }],
    products: [{ id: 101, categoryId: 1, name: 'Mint Tea', description: null, priceCents: 3000, isActive: true, isAvailableOnline: true, availability: 'AVAILABLE', modifierGroups: [] }]
  };
}

export const TABLES_A = { tblA_window_0001: 'A1 — Window' };
export const TABLES_B = { tblB_terrace_001: 'B1 — Terrace' };

export interface CafeSetup {
  tenantId: string;
  engine: FakeCafeEngine;
  connector: ReferenceConnector;
  credential: string;
}

/**
 * Onboards a café exactly like an INBYTE admin would: create, configure
 * ordering, pair the café's connector, sync catalog + tables, activate.
 */
export async function onboardCafe(
  h: Harness,
  admin: AdminSession,
  tenantId: string,
  catalog: WireCatalogLike,
  tables: Record<string, string>,
  ordering: Partial<Record<string, unknown>> = {}
): Promise<CafeSetup> {
  const created = await admin.request('POST', '/api/admin/v1/tenants', { tenantId, displayName: `Café ${tenantId}`, currencyCode: 'EGP', currencySymbol: 'ج.م' });
  if (created.status !== 201) throw new Error(`create failed ${created.status} ${JSON.stringify(created.body)}`);
  const ord = await admin.request('PUT', `/api/admin/v1/tenants/${tenantId}/sections/ordering`, {
    onlineOrdering: true,
    pickup: true,
    delivery: true,
    dineInQr: true,
    paymentMethods: ['CASH', 'CREDIT_CARD'],
    minimumOrderCents: null,
    deliveryAreaText: null,
    offlineOrderPolicy: 'REJECT',
    queueTtlMinutes: 15,
    ...ordering
  });
  if (ord.status !== 200) throw new Error(`ordering failed ${ord.status} ${JSON.stringify(ord.body)}`);
  const pairing = await admin.request('POST', `/api/admin/v1/tenants/${tenantId}/integration/pairing-code`);
  const fetchImpl = injectFetch(h.app);
  const { credential } = await ReferenceConnector.pair('http://platform.test', pairing.body.pairingCode, `cafe-${tenantId}`, fetchImpl);
  const engine = new FakeCafeEngine(catalog, tables);
  const connector = new ReferenceConnector({ baseUrl: 'http://platform.test', credential, engine, fetchImpl });
  await connector.syncCatalog();
  await connector.syncTables();
  const act = await admin.request('PUT', `/api/admin/v1/tenants/${tenantId}/status`, { status: 'ACTIVE' });
  if (act.status !== 200) throw new Error(`activate failed ${act.status}`);
  return { tenantId, engine, connector, credential };
}

let seq = 0;
export function requestId(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

export function pickupOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderType: 'PICKUP',
    orderChannel: 'ONLINE',
    items: [{ productId: 101, quantity: 2, modifierOptionIds: [1102] }],
    customerInfo: { fullName: 'Mona Adel', phone: '01001234567' },
    paymentMethod: 'CASH',
    expectedTotalCents: 13000,
    clientRequestId: requestId(),
    ...overrides
  };
}
