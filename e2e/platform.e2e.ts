// End-to-end platform test: the real backend (server/src/main.ts) serving the
// built customer site and INBYTE Admin, a fresh PostgreSQL database, a real
// browser, and the reference café connector with a fake INBYTE Café engine.
//
// A café is onboarded ONLY through the admin UI (no code, no JSON files), then
// customers order through the website and the order reaches "INBYTE Café".
//
// Requirements: PostgreSQL (E2E_DATABASE_URL), `npm run build`, Playwright +
// Chromium resolvable as `playwright` (e.g. NODE_PATH=$(npm root -g)).
//   npm run build && npm run test:e2e

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import pg from 'pg';
import { FakeCafeEngine } from '../connector/src/fakeCafeEngine.ts';
import type { WireCatalogLike } from '../connector/src/fakeCafeEngine.ts';
import { ReferenceConnector } from '../connector/src/referenceConnector.ts';
import { createAdminUser } from '../server/src/modules/auth/authService.ts';
import { migrate } from '../server/src/db/migrate.ts';
import { createPool } from '../server/src/db/pool.ts';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright') as typeof import('playwright');

const ROOT = join(import.meta.dirname, '..');
const PORT = Number(process.env.E2E_PORT ?? 8090);
const BASE = `http://localhost:${PORT}`;
const ADMIN_URL = `${BASE}/admin/`;
const DB_ADMIN_URL = process.env.E2E_DATABASE_ADMIN_URL ?? 'postgres://inbyte:inbyte@localhost:5432/postgres';
const DB_NAME = 'inbyte_e2e';
const DB_URL = DB_ADMIN_URL.replace(/\/[^/]+$/, `/${DB_NAME}`);
const OUT = process.env.E2E_OUT ?? join(ROOT, '.e2e-output');
const SUPER = { email: 'super@inbyte.test', password: 'e2e super passphrase 1' };
const OPERATOR = { email: 'operator@inbyte.test', password: 'e2e operator passphrase 1' };

const results: { name: string; ok: boolean; detail: string }[] = [];
const pageErrors: string[] = [];

async function run(name: string, fn: () => Promise<string | void>) {
  try {
    results.push({ name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ name, ok: false, detail: (e as Error).stack ?? String(e) });
  }
}

// ---- Café-side data (what INBYTE Café would sync) --------------------------------
const nileCatalog: WireCatalogLike = {
  version: 'nile-1',
  categories: [
    { id: 1, name: 'قهوة', sortOrder: 1, isActive: true, isAvailableOnline: true },
    { id: 2, name: 'مخبوزات', sortOrder: 2, isActive: true, isAvailableOnline: true }
  ],
  products: [
    {
      id: 101, categoryId: 1, name: 'لاتيه', description: 'إسبريسو وحليب', priceCents: 5000, isActive: true, isAvailableOnline: true, availability: 'AVAILABLE',
      modifierGroups: [{ id: 11, name: 'الحجم', isRequired: true, allowMultiple: false, options: [{ id: 1101, name: 'عادي', priceDeltaCents: 0 }, { id: 1102, name: 'كبير', priceDeltaCents: 1500 }] }]
    },
    { id: 102, categoryId: 2, name: 'كوكيز', description: null, priceCents: 2500, isActive: true, isAvailableOnline: true, availability: 'AVAILABLE', modifierGroups: [] },
    { id: 103, categoryId: 1, name: 'قهوة الموظفين', description: null, priceCents: 1000, isActive: true, isAvailableOnline: false, availability: 'AVAILABLE', modifierGroups: [] },
    { id: 104, categoryId: 2, name: 'كرواسون', description: null, priceCents: 3000, isActive: true, isAvailableOnline: true, availability: 'AVAILABLE', modifierGroups: [] }
  ]
};
const nileTables = { nile_tbl_window_7f3a: 'طاولة النافذة' };
const twoCatalog: WireCatalogLike = {
  version: 'two-1',
  categories: [{ id: 1, name: 'شاي', sortOrder: 1, isActive: true, isAvailableOnline: true }],
  products: [{ id: 101, categoryId: 1, name: 'شاي بالنعناع', description: null, priceCents: 3000, isActive: true, isAvailableOnline: true, availability: 'AVAILABLE', modifierGroups: [] }]
};

async function resetDatabase() {
  const admin = new pg.Client({ connectionString: DB_ADMIN_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
  await admin.end();
  const db = createPool(DB_URL, { max: 1 });
  await migrate(db);
  await createAdminUser(db, { email: SUPER.email, displayName: 'E2E Super', role: 'INBYTE_SUPER_ADMIN', password: SUPER.password });
  await createAdminUser(db, { email: OPERATOR.email, displayName: 'E2E Operator', role: 'INBYTE_OPERATOR', password: OPERATOR.password });
  await db.end();
}

async function startServer() {
  const log = openSync(join(OUT, 'server.log'), 'w');
  const child = spawn(process.execPath, ['server/src/main.ts'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: DB_URL, PORT: String(PORT), STATIC_DIR: join(ROOT, 'dist'), CONNECTOR_OFFLINE_AFTER_SECONDS: '10' },
    stdio: ['ignore', log, log]
  });
  for (let i = 0; i < 100; i += 1) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error('server did not start (see server.log)');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!existsSync(join(ROOT, 'dist', 'index.html')) || !existsSync(join(ROOT, 'dist', 'admin', 'index.html'))) throw new Error('run `npm run build` first');
  mkdirSync(OUT, { recursive: true });
  await resetDatabase();
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP cafe-two.test 127.0.0.1, MAP unknown-cafe.test 127.0.0.1'] });
  const heartbeats: Map<string, ReturnType<typeof setInterval>> = new Map();
  const connectors: Record<string, { connector: ReferenceConnector; engine: FakeCafeEngine }> = {};
  const beat = (tenant: string, on: boolean) => {
    clearInterval(heartbeats.get(tenant));
    if (on) heartbeats.set(tenant, setInterval(() => void connectors[tenant].connector.heartbeat().catch(() => undefined), 2000));
  };

  try {
    const adminCtx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const admin = await adminCtx.newPage();
    admin.on('pageerror', (e) => pageErrors.push(`admin: ${e.message}`));

    const save = async (formId: string) => {
      await admin.click(`#${formId} button[type="submit"]`);
      await admin.waitForSelector(`#${formId} .save-ok, #${formId} .save-error`);
      const err = await admin.locator(`#${formId} .save-error`).count();
      assert.equal(err, 0, `${formId}: ${err ? await admin.textContent(`#${formId} .save-error`) : ''}`);
    };

    await run('E1 — INBYTE Admin login (wrong password refused, right one accepted)', async () => {
      await admin.goto(ADMIN_URL);
      await admin.fill('input[name="email"]', SUPER.email);
      await admin.fill('input[name="password"]', 'wrong password!!');
      await admin.click('button[type="submit"]');
      await admin.waitForSelector('#login-error');
      await admin.fill('input[name="password"]', SUPER.password);
      await admin.click('button[type="submit"]');
      await admin.waitForSelector('#stat-active-cafes');
      const cookies = await adminCtx.cookies();
      const session = cookies.find((c) => c.name === 'inbyte_admin');
      assert.ok(session?.httpOnly && session.sameSite === 'Strict', 'HttpOnly SameSite=Strict session cookie');
      assert.equal(await admin.evaluate(() => document.cookie.includes('inbyte_admin')), false, 'not readable by scripts');
    });

    await run('E2 — create a café from the admin (no code)', async () => {
      await admin.goto(`${ADMIN_URL}#/cafes`);
      await admin.click('#new-cafe-button');
      await admin.fill('#new-cafe-form input[name="displayName"]', 'مقهى النيل');
      await admin.fill('#new-cafe-form input[name="tenantId"]', 'cafe-nile');
      await admin.click('#new-cafe-form button[type="submit"]');
      await admin.waitForSelector('#cafe-title');
      assert.match(await admin.textContent('#cafe-title') ?? '', /مقهى النيل/);
      assert.match(await admin.textContent('#cafe-title') ?? '', /draft/);
      const pub = await fetch(`${BASE}/api/public/v1/tenants/cafe-nile/config`);
      assert.equal(pub.status, 404, 'draft café is invisible to customers');
    });

    await run('E3 — branding, website, contact and ordering configured in the admin', async () => {
      await admin.goto(`${ADMIN_URL}#/cafes/cafe-nile/branding`);
      await admin.fill('#branding-form input[name="dark-primary"]', '#0e7c66');
      await admin.selectOption('#branding-form select[name="defaultTheme"]', 'light');
      await save('branding-form');

      await admin.goto(`${ADMIN_URL}#/cafes/cafe-nile/website`);
      await admin.fill('#website-form input[name="heroTitle"]', 'قهوة على ضفاف النيل');
      await admin.fill('#website-form input[name="announcementText"]', 'نغلق مبكراً يوم الجمعة');
      await admin.click('#add-promotion');
      await admin.fill('#website-form input[name="promo-0-title"]', 'موسم القهوة المثلجة');
      await admin.fill('#website-form input[name="footerText"]', '© مقهى النيل');
      await save('website-form');
      await admin.fill('#contact-form input[name="phone"]', '+20 100 123 4567');
      await admin.fill('#contact-form input[name="businessHoursText"]', 'يومياً ٨ص – ١١م');
      await save('contact-form');

      await admin.goto(`${ADMIN_URL}#/cafes/cafe-nile/ordering`);
      for (const name of ['onlineOrdering', 'pickup', 'dineInQr', 'pay-CASH']) await admin.check(`#ordering-form input[name="${name}"]`);
      await admin.uncheck('#ordering-form input[name="delivery"]');
      await save('ordering-form');
    });

    await run('E4 — pair the café’s INBYTE Café (one-time code) and sync its catalog and tables', async () => {
      await admin.goto(`${ADMIN_URL}#/cafes/cafe-nile/integration`);
      await admin.click('#issue-pairing-code');
      const code = (await admin.textContent('#pairing-code'))!.trim();
      assert.match(code, /^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      const { tenantId, credential } = await ReferenceConnector.pair(BASE, code, 'nile-pos-1');
      assert.equal(tenantId, 'cafe-nile');
      const engine = new FakeCafeEngine(nileCatalog, nileTables);
      const connector = new ReferenceConnector({ baseUrl: BASE, credential, engine });
      connectors['cafe-nile'] = { connector, engine };
      await connector.syncCatalog();
      await connector.syncTables();
      beat('cafe-nile', true);
      await admin.reload();
      await admin.waitForSelector('#integration-status .badge[data-value="ONLINE"]');
      // The pairing code is single-use.
      await assert.rejects(ReferenceConnector.pair(BASE, code, 'attacker'));
    });

    await run('E5 — menu presentation: feature, describe and hide items (prices stay Café’s)', async () => {
      await admin.goto(`${ADMIN_URL}#/cafes/cafe-nile/menu`);
      await admin.waitForSelector('tr[data-product="102"]');
      assert.match(await admin.textContent('tr[data-product="102"]') ?? '', /25\.00/);
      await admin.check('tr[data-product="102"] input[name="featured"]');
      await admin.fill('tr[data-product="102"] input[name="marketingDescription"]', 'تُخبز كل صباح');
      await admin.click('tr[data-product="102"] button');
      await admin.waitForSelector('tr[data-product="102"] .save-ok');
      await admin.uncheck('tr[data-product="104"] input[name="visible"]');
      await admin.click('tr[data-product="104"] button');
      await admin.waitForSelector('tr[data-product="104"] .save-ok');
      assert.match(await admin.textContent('tr[data-product="103"]') ?? '', /Not sold online/);
    });

    let qrUrl = '';
    await run('E6 — tables/QR: Café-issued token, printable QR code', async () => {
      await admin.goto(`${ADMIN_URL}#/cafes/cafe-nile/tables`);
      await admin.waitForSelector('#tables-grid .qr-card');
      qrUrl = (await admin.textContent('#tables-grid .qr-card .mono'))!.trim();
      assert.equal(qrUrl, `${BASE}/t/cafe-nile/?table=nile_tbl_window_7f3a`);
      await admin.waitForFunction(() => (document.querySelector('#tables-grid img') as HTMLImageElement)?.naturalWidth > 0);
    });

    await run('E7 — activate the café', async () => {
      await admin.goto(`${ADMIN_URL}#/cafes/cafe-nile/overview`);
      await admin.click('#activate-cafe');
      await admin.waitForSelector('#cafe-title .badge[data-value="ACTIVE"]');
    });

    const customerCtx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar-EG' });
    const customer = await customerCtx.newPage();
    customer.on('pageerror', (e) => pageErrors.push(`customer: ${e.message}`));
    const closeQuickCats = async () => {
      await customer.waitForTimeout(400);
      const sheet = customer.locator('#quick-categories-modal');
      if (await sheet.isVisible().catch(() => false)) await customer.click('#quick-cat-close');
    };
    const cssVar = (name: string) => customer.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

    await run('E8 — customer website renders the configured café (branding, content, journeys, menu)', async () => {
      await customer.goto(`${BASE}/t/cafe-nile/`);
      await customer.waitForSelector('#brand-name');
      assert.equal(await customer.textContent('#brand-name'), 'مقهى النيل');
      assert.equal(await customer.getAttribute('html', 'data-theme'), 'light');
      assert.equal(await cssVar('--primary'), '#0e7c66');
      assert.match(await customer.textContent('#hero-title') ?? '', /قهوة على ضفاف النيل/);
      assert.match(await customer.textContent('#tenant-announcement') ?? '', /نغلق مبكراً/);
      assert.match(await customer.textContent('#tenant-promotions') ?? '', /موسم القهوة المثلجة/);
      assert.equal(await customer.textContent('#tenant-footer'), '© مقهى النيل');
      assert.equal(await customer.locator('#card-delivery').count(), 0, 'delivery switched off');
      await customer.click('#btn-takeaway');
      await customer.waitForSelector('.product-card');
      await closeQuickCats();
      const ids = new Set<number>();
      const chips = customer.locator('#sticky-category-bar .cat-chip');
      for (let i = 0; i < (await chips.count()); i += 1) {
        await chips.nth(i).click();
        for (const id of await customer.$$eval('.product-card', (cs) => cs.map((c) => Number((c as HTMLElement).dataset.productId)))) ids.add(id);
      }
      assert.deepEqual([...ids].sort(), [101, 102], 'not-online (103) and hidden (104) items are absent');
      await customer.screenshot({ path: join(OUT, 'e8-customer-menu.png') });
    });

    let reference = '';
    await run('E9 — pickup order: platform accepts honestly, INBYTE Café creates it, customer tracks Café status', async () => {
      const card = customer.locator('.product-card[data-product-id="101"]');
      if (!(await card.isVisible())) await customer.locator('#sticky-category-bar .cat-chip').first().click();
      await card.click();
      await customer.click('#modifier-modal [data-option-id="1102"]');
      await customer.click('#modal-submit-btn');
      await customer.waitForSelector('#modifier-modal', { state: 'detached' });
      await customer.click('#header-cart');
      await customer.getByRole('button', { name: 'متابعة إتمام الطلب' }).click();
      await customer.waitForSelector('#checkout-submit');
      await customer.fill('#checkout-name', 'منى علي');
      await customer.fill('#checkout-phone', '01055555555');
      await customer.click('#checkout-submit');
      await customer.waitForSelector('#order-confirmation');
      assert.equal(await customer.getAttribute('#confirmation-title', 'data-delivery'), 'AWAITING_CAFE');
      assert.match(await customer.textContent('#confirmation-order-number') ?? '', /يصدر من الكافيه/);
      reference = (await customer.textContent('#confirmation-reference'))!.trim();
      assert.match(reference, /^INB-/);
      await customer.screenshot({ path: join(OUT, 'e9-awaiting-cafe.png'), fullPage: true });

      const delivered = await connectors['cafe-nile'].connector.processOrders();
      const mine = delivered.find((d) => d.publicReference === reference);
      assert.equal(mine?.result.outcome, 'CREATED');
      const orderNumber = (mine!.result as { orderNumber: string }).orderNumber;
      for (const status of ['ACCEPTED', 'READY'] as const) {
        await connectors['cafe-nile'].connector.reportStatus(reference, connectors['cafe-nile'].engine.staff(orderNumber, status));
      }
      await customer.click('#order-confirmation .btn-primary');
      await customer.waitForSelector('#track-refresh-btn');
      await customer.click('#track-refresh-btn');
      await customer.waitForFunction((n) => document.querySelector('#track-order-number')?.textContent === n, orderNumber);
      assert.equal(await customer.getAttribute('#track-status-pill', 'data-status'), 'READY');
      assert.match(await customer.textContent('#track-total') ?? '', /65/, 'Café total: 50 + 15 (large)');
      await customer.screenshot({ path: join(OUT, 'e9-tracking-ready.png'), fullPage: true });
    });

    await run('E10 — dine-in from the printed QR URL (Café-issued table token)', async () => {
      const dine = await customerCtx.newPage();
      dine.on('pageerror', (e) => pageErrors.push(`dine-in: ${e.message}`));
      await dine.goto(qrUrl);
      await dine.waitForSelector('#table-session-banner');
      assert.equal(await dine.textContent('#table-session-label'), 'طاولة النافذة');
      assert.equal(new URL(dine.url()).searchParams.has('table'), false, 'token removed from the address bar');
      await dine.click('#btn-dinein').catch(() => undefined);
      await dine.waitForSelector('.product-card');
      await dine.waitForTimeout(400);
      if (await dine.locator('#quick-categories-modal').isVisible().catch(() => false)) await dine.click('#quick-cat-close');
      const chip = dine.locator('#sticky-category-bar .cat-chip').nth(1);
      await chip.click();
      await dine.click('.product-card[data-product-id="102"]');
      await dine.click('#modal-submit-btn');
      await dine.waitForSelector('#modifier-modal', { state: 'detached' });
      await dine.click('#header-cart');
      await dine.getByRole('button', { name: 'متابعة إتمام الطلب' }).click();
      await dine.click('#checkout-submit');
      await dine.waitForSelector('#order-confirmation');
      const ref = (await dine.textContent('#confirmation-reference'))!.trim();
      const delivered = await connectors['cafe-nile'].connector.processOrders();
      const mine = delivered.find((d) => d.publicReference === ref);
      assert.equal(mine?.result.outcome, 'CREATED', 'Café accepted the table token');
      await dine.close();
    });

    await run('E11 — the browser cannot set prices: a tampered request is refused by the server', async () => {
      const res = await customer.evaluate(async () => {
        const r = await fetch('/api/public/v1/tenants/cafe-nile/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderType: 'PICKUP', orderChannel: 'ONLINE', items: [{ productId: 101, quantity: 1, modifierOptionIds: [1101], priceCents: 1 }],
            customerInfo: { fullName: 'X Y', phone: '01000000000' }, paymentMethod: 'CASH', expectedTotalCents: 1, totalCents: 1,
            clientRequestId: crypto.randomUUID()
          })
        });
        return { status: r.status, body: await r.json() };
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PRICE_TAMPERED_MISMATCH');
    });

    await run('E12 — a second café on a custom domain: resolved by host, fully isolated', async () => {
      // Second café through the same admin API the UI uses (session cookie + CSRF).
      const csrf = await admin.evaluate(async () => (await (await fetch('/api/admin/v1/auth/me')).json()).csrfToken);
      const call = (method: string, path: string, body?: unknown) =>
        admin.evaluate(
          async ([m, p, b, t]) => {
            const r = await fetch(`/api/admin/v1${p}`, { method: m as string, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t as string }, body: JSON.stringify(b ?? {}) });
            return { status: r.status, body: await r.json() };
          },
          [method, path, body, csrf] as const
        );
      assert.equal((await call('POST', '/tenants', { tenantId: 'cafe-two', displayName: 'مقهى اثنين', currencyCode: 'EGP', currencySymbol: 'ج.م', primaryColor: '#7a2fd0' })).status, 201);
      await call('PUT', '/tenants/cafe-two/sections/ordering', {
        onlineOrdering: true, pickup: true, delivery: true, dineInQr: false, paymentMethods: ['CREDIT_CARD'],
        minimumOrderCents: null, deliveryAreaText: null, offlineOrderPolicy: 'REJECT', queueTtlMinutes: 15
      });
      assert.equal((await call('POST', '/tenants/cafe-two/domains', { host: 'cafe-two.test', isPrimary: true })).status, 200);
      const pairing = await call('POST', '/tenants/cafe-two/integration/pairing-code');
      const { credential } = await ReferenceConnector.pair(BASE, pairing.body.pairingCode, 'two-pos-1');
      const engine = new FakeCafeEngine(twoCatalog, {});
      connectors['cafe-two'] = { connector: new ReferenceConnector({ baseUrl: BASE, credential, engine }), engine };
      await connectors['cafe-two'].connector.syncCatalog();
      beat('cafe-two', true);
      assert.equal((await call('PUT', '/tenants/cafe-two/status', { status: 'ACTIVE' })).status, 200);

      const two = await customerCtx.newPage();
      two.on('pageerror', (e) => pageErrors.push(`cafe-two: ${e.message}`));
      await two.goto(`http://cafe-two.test:${PORT}/`);
      await two.waitForSelector('#brand-name');
      assert.equal(await two.textContent('#brand-name'), 'مقهى اثنين');
      assert.equal(await two.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()), '#7a2fd0');
      // Another café can't be shown through café two's domain.
      await two.goto(`http://cafe-two.test:${PORT}/t/cafe-nile/`);
      await two.waitForSelector('.tenant-screen[data-state="not-found"]');
      // Café two's catalog: same Café product ID 101, different café.
      const cat = await two.evaluate(async () => (await (await fetch('/api/public/v1/tenants/cafe-two/catalog')).json()).products.map((p: { name: string }) => p.name));
      assert.deepEqual(cat, ['شاي بالنعناع']);
      // Café nile's reference is unknown at café two.
      const cross = await two.evaluate(async (ref) => (await fetch(`/api/public/v1/tenants/cafe-two/orders/${ref}`)).status, reference);
      assert.equal(cross, 404);
      await two.close();
    });

    await run('E13 — unknown host / unknown café: “café not found”, never a default café', async () => {
      const page = await customerCtx.newPage();
      await page.goto(`http://unknown-cafe.test:${PORT}/`);
      await page.waitForSelector('.tenant-screen[data-state="not-found"]');
      await page.goto(`${BASE}/t/no-such-cafe/`);
      await page.waitForSelector('.tenant-screen[data-state="not-found"]');
      await page.close();
    });

    await run('E14 — POS offline: the customer is told honestly; retry succeeds once the café is back', async () => {
      beat('cafe-two', false);
      await sleep(11_000);
      const page = await customerCtx.newPage();
      page.on('pageerror', (e) => pageErrors.push(`offline: ${e.message}`));
      await page.goto(`http://cafe-two.test:${PORT}/`);
      await page.click('#btn-takeaway');
      await page.waitForSelector('.product-card');
      await page.waitForTimeout(400);
      if (await page.locator('#quick-categories-modal').isVisible().catch(() => false)) await page.click('#quick-cat-close');
      await page.click('.product-card[data-product-id="101"]');
      await page.click('#modal-submit-btn');
      await page.waitForSelector('#modifier-modal', { state: 'detached' });
      await page.click('#header-cart');
      await page.getByRole('button', { name: 'متابعة إتمام الطلب' }).click();
      await page.fill('#checkout-name', 'سارة');
      await page.fill('#checkout-phone', '01066666666');
      await page.click('#checkout-submit');
      await page.waitForFunction(() => /غير متاح الآن/.test(document.body.textContent ?? ''));
      assert.equal(await page.locator('#order-confirmation').count(), 0, 'no fake confirmation');
      await page.screenshot({ path: join(OUT, 'e14-offline.png'), fullPage: true });
      beat('cafe-two', true);
      await connectors['cafe-two'].connector.heartbeat();
      await page.click('#checkout-submit');
      await page.waitForSelector('#order-confirmation');
      await page.close();
    });

    await run('E15 — operator role: can configure, cannot create cafés or pair POS', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(ADMIN_URL);
      await page.fill('input[name="email"]', OPERATOR.email);
      await page.fill('input[name="password"]', OPERATOR.password);
      await page.click('button[type="submit"]');
      await page.waitForSelector('#stat-active-cafes');
      await page.goto(`${ADMIN_URL}#/cafes`);
      await page.waitForSelector('#cafes-table tr[data-tenant="cafe-nile"]');
      assert.equal(await page.locator('#new-cafe-button').count(), 0);
      await page.goto(`${ADMIN_URL}#/cafes/cafe-nile/integration`);
      await page.waitForSelector('#integration-status');
      assert.equal(await page.locator('#issue-pairing-code').count(), 0);
      await ctx.close();
    });

    await run('E16 — dashboard, orders and audit log reflect what happened', async () => {
      await admin.goto(`${ADMIN_URL}#/`);
      await admin.waitForSelector('#stat-active-cafes');
      assert.equal((await admin.textContent('#stat-active-cafes .stat-value'))?.trim(), '2');
      await admin.goto(`${ADMIN_URL}#/cafes/cafe-nile/orders`);
      await admin.waitForSelector(`#orders-table tr[data-reference="${reference}"]`);
      await admin.click(`#orders-table tr[data-reference="${reference}"]`);
      await admin.waitForSelector('#order-detail');
      assert.match(await admin.textContent('#order-detail') ?? '', /ORD-\d+/);
      await admin.goto(`${ADMIN_URL}#/audit`);
      await admin.waitForSelector('#audit-table tbody tr');
      const text = await admin.textContent('#audit-table');
      for (const action of ['tenant.created', 'tenant.branding.updated', 'integration.paired', 'tenant.status.active', 'order.viewed']) assert.ok(text?.includes(action), action);
      await admin.screenshot({ path: join(OUT, 'e16-audit.png'), fullPage: true });
    });
  } finally {
    for (const h of heartbeats.values()) clearInterval(h);
    await browser.close();
    server.kill();
  }

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n${r.detail}`}`);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed; page errors: ${pageErrors.length}`);
  for (const e of pageErrors) console.log(`  page error: ${e}`);
  if (results.some((r) => !r.ok) || pageErrors.length) process.exitCode = 1;
}

await main();
