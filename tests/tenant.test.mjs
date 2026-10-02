// Tenant resolution, configuration, policy, storage isolation and theming.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTenant, resolveTenantAsync, parseHostMap } from '../src/tenant/tenantResolver.ts';
import { parseTenantConfig, TenantConfigError } from '../src/tenant/parseTenantConfig.ts';
import {
  canAcceptOrders,
  enabledOutsideOrderTypes,
  isDineInEnabled,
  isOrderTypeEnabled,
  meetsMinimumOrder,
  offeredPaymentMethods
} from '../src/tenant/tenantPolicy.ts';
import { createScopedStorage } from '../src/tenant/scopedStorage.ts';
import { isolateTenantSwitch } from '../src/tenant/tenantSwitch.ts';
import { themeVariables, readableOn } from '../src/tenant/tenantTheme.ts';
import { createMockTransport } from '../src/integration/mock/mockTransport.ts';

// ---------------- Resolution ----------------

const base = { strategy: 'fixed', fixedTenantId: null, baseDomain: null, pathPrefix: 't', hostMap: {}, allowQueryOverride: false };
const loc = (url) => {
  const u = new URL(url);
  return { hostname: u.hostname, pathname: u.pathname, search: u.search };
};

test('resolver: fixed tenant per deployment', () => {
  assert.deepEqual(resolveTenant(loc('https://menu.cafe-a.com/'), { ...base, fixedTenantId: 'cafe-a' }), { tenantId: 'cafe-a', source: 'fixed' });
  assert.equal(resolveTenant(loc('https://x.com/'), base), null, 'no tenant → unresolved, never a default café');
});

test('resolver: subdomain strategy', () => {
  const opts = { ...base, strategy: 'subdomain', baseDomain: 'menu.inbyte.app' };
  assert.deepEqual(resolveTenant(loc('https://cafe-b.menu.inbyte.app/?table=x'), opts), { tenantId: 'cafe-b', source: 'subdomain' });
  assert.equal(resolveTenant(loc('https://a.b.menu.inbyte.app/'), opts), null, 'nested subdomains are not tenants');
  assert.equal(resolveTenant(loc('https://menu.inbyte.app/'), opts), null);
  assert.equal(resolveTenant(loc('https://evil-menu.inbyte.app.attacker.com/'), opts), null);
});

test('resolver: path strategy', () => {
  const opts = { ...base, strategy: 'path' };
  assert.deepEqual(resolveTenant(loc('https://menu.example.com/t/cafe-c/?table=abc'), opts), { tenantId: 'cafe-c', source: 'path' });
  assert.equal(resolveTenant(loc('https://menu.example.com/x/cafe-c/'), opts), null);
  assert.deepEqual(resolveTenant(loc('https://m.example.com/cafe-d'), { ...opts, pathPrefix: '' }), { tenantId: 'cafe-d', source: 'path' });
});

test('resolver: custom domains via host map take priority', () => {
  const opts = { ...base, strategy: 'subdomain', baseDomain: 'menu.inbyte.app', hostMap: parseHostMap('{"diab.example":"cafe-e","bad host":"x","ok.example":"Not Valid!"}') };
  assert.deepEqual(opts.hostMap, { 'diab.example': 'cafe-e' });
  assert.deepEqual(resolveTenant(loc('https://diab.example/'), opts), { tenantId: 'cafe-e', source: 'host-map' });
  assert.deepEqual(parseHostMap('not json'), {});
});

test('resolver: ?tenant= only works when explicitly allowed (development)', () => {
  const url = loc('https://menu.cafe-a.com/?tenant=harbor-roast');
  assert.equal(resolveTenant(url, { ...base, fixedTenantId: 'cafe-a' }).tenantId, 'cafe-a');
  assert.equal(resolveTenant(url, { ...base, fixedTenantId: 'cafe-a', allowQueryOverride: true }).tenantId, 'harbor-roast');
  assert.equal(resolveTenant(loc('https://x/?tenant=../etc'), { ...base, allowQueryOverride: true }), null);
});

// ---------------- Configuration ----------------

const minimal = (o = {}) => ({
  tenantId: 'cafe-x',
  identity: { displayName: 'Café X' },
  branding: { colors: { primary: '#123456' } },
  currency: { code: 'EGP', symbol: 'ج.م' },
  ...o
});

test('config: ordering is OFF unless explicitly enabled', () => {
  const c = parseTenantConfig(minimal(), 'cafe-x');
  assert.deepEqual(c.features, { onlineOrdering: false, pickup: false, delivery: false, dineInQr: false });
  assert.deepEqual(c.paymentMethods, []);
  assert.equal(canAcceptOrders(c), false);
});

test('config: a config for another tenant is never applied', () => {
  assert.throws(() => parseTenantConfig(minimal(), 'cafe-y'), (e) => e instanceof TenantConfigError && e.code === 'TENANT_MISMATCH');
});

test('config: required fields and value validation', () => {
  assert.throws(() => parseTenantConfig(minimal({ identity: {} }), 'cafe-x'), TenantConfigError);
  assert.throws(() => parseTenantConfig(minimal({ branding: { colors: { primary: 'red' } } }), 'cafe-x'), TenantConfigError);
  assert.throws(() => parseTenantConfig(minimal({ currency: {} }), 'cafe-x'), TenantConfigError);
  assert.throws(() => parseTenantConfig(minimal({ tenantId: 'Bad Id!' }), 'Bad Id!'), TenantConfigError);
});

test('config: unsafe or unknown values are dropped (allow-list)', () => {
  const c = parseTenantConfig(minimal({
    identity: { displayName: 'Café X', logoUrl: 'javascript:alert(1)', faviconUrl: '/icons/x.png' },
    contact: { phone: '01012345678<script>', website: 'ftp://x', mapsUrl: 'https://maps.example/x', social: [{ label: 'IG', url: 'javascript:x' }] },
    paymentMethods: ['CASH', 'BITCOIN', 'CASH', 'INSTAPAY'],
    branding: { colors: { primary: '#123456' }, fontStylesheetUrl: 'http://insecure.example/font.css', fontFamily: 'Cairo"; color:red' },
    apiKey: 'secret',
    content: { about: { title: 'About', sections: [{ title: 'S', icon: 'bad icon!', paragraphs: ['p', 42] }] } }
  }), 'cafe-x');
  assert.equal(c.identity.logoUrl, null);
  assert.equal(c.identity.faviconUrl, '/icons/x.png');
  assert.equal(c.contact.phone, null);
  assert.equal(c.contact.website, null);
  assert.equal(c.contact.mapsUrl, 'https://maps.example/x');
  assert.deepEqual(c.contact.social, []);
  assert.deepEqual(c.paymentMethods, ['CASH', 'INSTAPAY']);
  assert.equal(c.branding.fontStylesheetUrl, undefined, 'only https stylesheets');
  assert.equal(c.branding.fontFamily, 'Cairo colorred');
  assert.equal('apiKey' in c, false);
  assert.equal(c.content.about.sections[0].icon, null);
  assert.deepEqual(c.content.about.sections[0].paragraphs, ['p']);
});

test('config: both sample tenants parse and differ in every customer-visible area', async () => {
  const mock = createMockTransport();
  const a = parseTenantConfig(await mock.getTenantConfig('inbyte-demo'), 'inbyte-demo');
  const b = parseTenantConfig(await mock.getTenantConfig('harbor-roast'), 'harbor-roast');
  for (const path of [
    (c) => c.identity.displayName, (c) => c.identity.logoUrl, (c) => c.branding.colors.primary,
    (c) => c.contact.phone, (c) => c.contact.address, (c) => c.businessHoursText, (c) => c.currency.symbol,
    (c) => c.content.heroTitle, (c) => JSON.stringify(c.features), (c) => JSON.stringify(c.paymentMethods),
    (c) => c.branding.defaultTheme
  ]) {
    assert.notEqual(path(a), path(b), path.toString());
  }
});

// ---------------- Policy ----------------

test('policy: payment methods = tenant ∩ website-supported', async () => {
  const mock = createMockTransport();
  const a = parseTenantConfig(await mock.getTenantConfig('inbyte-demo'), 'inbyte-demo');
  const b = parseTenantConfig(await mock.getTenantConfig('harbor-roast'), 'harbor-roast');
  assert.deepEqual(offeredPaymentMethods(a), ['CASH', 'CREDIT_CARD']);
  assert.deepEqual(offeredPaymentMethods(b), ['CREDIT_CARD'], 'INSTAPAY is listed but not offered (needs Café reference support)');
});

test('policy: ordering modes follow the tenant features', async () => {
  const mock = createMockTransport();
  const a = parseTenantConfig(await mock.getTenantConfig('inbyte-demo'), 'inbyte-demo');
  const b = parseTenantConfig(await mock.getTenantConfig('harbor-roast'), 'harbor-roast');
  assert.deepEqual(enabledOutsideOrderTypes(a), ['PICKUP', 'DELIVERY']);
  assert.deepEqual(enabledOutsideOrderTypes(b), ['PICKUP']);
  assert.equal(isOrderTypeEnabled(b, 'DELIVERY'), false);
  assert.equal(isDineInEnabled(b), true);
  const off = { ...b, features: { ...b.features, onlineOrdering: false } };
  assert.deepEqual(enabledOutsideOrderTypes(off), []);
  assert.equal(isDineInEnabled(off), false, 'master switch disables every journey');
  assert.equal(canAcceptOrders(off), false);
  assert.equal(meetsMinimumOrder(b, 4999), false);
  assert.equal(meetsMinimumOrder(b, 5000), true);
  assert.equal(meetsMinimumOrder(a, 1), true);
});

// ---------------- Storage isolation ----------------

function memoryArea() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    dump: () => Object.fromEntries(m)
  };
}

test('storage: one café never sees another café\'s cart', () => {
  const areas = { local: memoryArea(), session: memoryArea() };
  const a = createScopedStorage('cafe-a', areas);
  const b = createScopedStorage('cafe-b', areas);
  a.writeJson('cart', [{ lineId: 'x', productId: 107, quantity: 1, modifierOptionIds: [] }]);
  assert.equal(b.readJson('cart'), null);
  assert.equal(a.readJson('cart').length, 1);
  b.writeJson('cart', []);
  assert.equal(a.readJson('cart').length, 1, 'writing B does not touch A');
});

test('switching café clears the previous café\'s cart, table and settled checkout — but keeps an unresolved one', () => {
  const areas = { local: memoryArea(), session: memoryArea() };
  const unresolved = (raw) => !!raw && raw.status === 'OUTCOME_UNKNOWN';
  const a = createScopedStorage('cafe-a', areas);

  isolateTenantSwitch('cafe-a', areas, unresolved);
  a.writeJson('cart', [1]);
  a.writeJson('table_session', { token: 't' }, 'session');
  a.writeJson('checkout_attempt', { status: 'REJECTED' });

  assert.equal(isolateTenantSwitch('cafe-a', areas, unresolved).switched, false, 'same café: nothing cleared');
  assert.deepEqual(a.readJson('cart'), [1]);

  const r = isolateTenantSwitch('cafe-b', areas, unresolved);
  assert.deepEqual(r, { previousTenantId: 'cafe-a', switched: true });
  assert.equal(a.readJson('cart'), null);
  assert.equal(a.readJson('table_session', 'session'), null);
  assert.equal(a.readJson('checkout_attempt'), null);

  // An attempt whose outcome is unknown stays in café A's scope (deleting it could cause a duplicate order).
  isolateTenantSwitch('cafe-a', areas, unresolved);
  a.writeJson('checkout_attempt', { status: 'OUTCOME_UNKNOWN' });
  isolateTenantSwitch('cafe-b', areas, unresolved);
  assert.deepEqual(a.readJson('checkout_attempt'), { status: 'OUTCOME_UNKNOWN' });
  assert.equal(createScopedStorage('cafe-b', areas).readJson('checkout_attempt'), null, 'and is invisible to café B');
});

// ---------------- Theming ----------------

test('theme: tenant colours become CSS variables for each mode, with readable text', async () => {
  const mock = createMockTransport();
  const b = parseTenantConfig(await mock.getTenantConfig('harbor-roast'), 'harbor-roast');
  const dark = themeVariables(b.branding, 'dark');
  const light = themeVariables(b.branding, 'light');
  assert.equal(dark['--primary'], '#4fc3c7');
  assert.equal(dark['--brand-rgb'], '79, 195, 199');
  assert.equal(light['--primary'], '#1f7a80', 'light theme uses lightColors');
  assert.equal(dark['--background'], '#0e1518');
  assert.equal(light['--background'], '#f4fafa');
  assert.equal(readableOn('#f4bd61'), '#120F0D');
  assert.equal(readableOn('#1f7a80'), '#FFFFFF');
  const noLight = themeVariables({ colors: { primary: '#ff0000' }, defaultTheme: 'dark' }, 'light');
  assert.equal(noLight['--primary'], '#ff0000', 'falls back to the main colours');
  assert.ok(noLight['--brand-deep-rgb'], 'deep shade derived when absent');
});

test('platform strategy: /t/<id>/ paths first, then the backend maps the host; no default café', async () => {
  const opts = { strategy: 'platform', fixedTenantId: null, baseDomain: null, pathPrefix: 't', hostMap: {}, allowQueryOverride: false };
  let lookups = 0;
  const lookup = (answer) => async () => {
    lookups += 1;
    return answer;
  };
  const at = (url) => { const u = new URL(url); return { hostname: u.hostname, pathname: u.pathname, search: u.search }; };
  assert.deepEqual(await resolveTenantAsync(at('https://menu.inbyte.app/t/cafe-x/?table=abc'), opts, lookup('other')), { tenantId: 'cafe-x', source: 'path' });
  assert.equal(lookups, 0, 'a path needs no host lookup');
  assert.deepEqual(await resolveTenantAsync(at('https://cafe-x.com/'), opts, lookup('cafe-x')), { tenantId: 'cafe-x', source: 'platform-host' });
  assert.equal(await resolveTenantAsync(at('https://unknown.example/'), opts, lookup(null)), null);
  assert.equal(await resolveTenantAsync(at('https://evil.example/'), opts, lookup('../../etc')), null, 'backend answers are validated too');
  assert.equal(await resolveTenantAsync(at('https://x.example/?tenant=cafe-y'), opts, lookup(null)), null, '?tenant= is ignored outside dev');
});
