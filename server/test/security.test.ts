// Security boundaries: admin authentication, roles, CSRF, sessions, lockout,
// audit trail hygiene, rate limits, payload limits and safe error responses.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { Harness } from './helpers.ts';
import { OPERATOR_EMAIL, PASSWORD, SUPER_EMAIL, createHarness, login, publicCall } from './helpers.ts';

let h: Harness;

before(async () => {
  h = await createHarness();
});
after(async () => h.close());

describe('authentication', () => {
  test('admin endpoints require a session', async () => {
    for (const [method, url] of [['GET', '/api/admin/v1/tenants'], ['POST', '/api/admin/v1/tenants'], ['GET', '/api/admin/v1/audit'], ['GET', '/api/admin/v1/auth/me']]) {
      const res = await publicCall(h.app, method, url, method === 'POST' ? {} : undefined);
      assert.equal(res.status, 401, url);
      assert.equal(res.body.error.code, 'UNAUTHENTICATED');
    }
    const forged = await publicCall(h.app, 'GET', '/api/admin/v1/tenants', undefined, { cookie: 'inbyte_admin=forged-token' });
    assert.equal(forged.status, 401);
  });

  test('session cookie is HttpOnly, SameSite=Strict and scoped to the admin API', async () => {
    const res = await h.app.inject({ method: 'POST', url: '/api/admin/v1/auth/login', payload: { email: SUPER_EMAIL, password: PASSWORD } });
    const cookie = res.cookies.find((c) => c.name === 'inbyte_admin')!;
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Strict');
    assert.equal(cookie.path, '/api/admin');
    assert.ok(!res.body.includes(cookie.value), 'token only in the cookie');
  });

  test('wrong password and unknown e-mail look the same', async () => {
    const wrong = await publicCall(h.app, 'POST', '/api/admin/v1/auth/login', { email: SUPER_EMAIL, password: 'nope-nope-nope' });
    const unknown = await publicCall(h.app, 'POST', '/api/admin/v1/auth/login', { email: 'ghost@inbyte.test', password: 'nope-nope-nope' });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  test('five failures lock the account, even for the right password', async () => {
    const email = 'victim@inbyte.test';
    const { createAdminUser } = await import('../src/modules/auth/authService.ts');
    await createAdminUser(h.db, { email, displayName: 'V', role: 'INBYTE_OPERATOR', password: PASSWORD });
    for (let i = 0; i < 5; i += 1) await publicCall(h.app, 'POST', '/api/admin/v1/auth/login', { email, password: `wrong-${i}-xxxxxxx` });
    const locked = await publicCall(h.app, 'POST', '/api/admin/v1/auth/login', { email, password: PASSWORD });
    assert.equal(locked.status, 401);
    h.clock.advance(16 * 60_000);
    const later = await publicCall(h.app, 'POST', '/api/admin/v1/auth/login', { email, password: PASSWORD });
    assert.equal(later.status, 200);
  });

  test('logout revokes the session; idle sessions expire', async () => {
    const s = await login(h.app, SUPER_EMAIL);
    assert.equal((await s.request('POST', '/api/admin/v1/auth/logout')).status, 200);
    assert.equal((await s.request('GET', '/api/admin/v1/auth/me')).status, 401);
    const idle = await login(h.app, SUPER_EMAIL);
    h.clock.advance(121 * 60_000);
    assert.equal((await idle.request('GET', '/api/admin/v1/auth/me')).status, 401);
  });

  test('changing the password signs out the other sessions', async () => {
    const one = await login(h.app, OPERATOR_EMAIL);
    const two = await login(h.app, OPERATOR_EMAIL);
    const change = await one.request('POST', '/api/admin/v1/auth/password', { currentPassword: PASSWORD, newPassword: 'another long passphrase 42' });
    assert.equal(change.status, 200);
    assert.equal((await one.request('GET', '/api/admin/v1/auth/me')).status, 200);
    assert.equal((await two.request('GET', '/api/admin/v1/auth/me')).status, 401);
    await one.request('POST', '/api/admin/v1/auth/password', { currentPassword: 'another long passphrase 42', newPassword: PASSWORD });
  });
});

describe('CSRF', () => {
  test('mutations need the session CSRF token', async () => {
    const s = await login(h.app, SUPER_EMAIL);
    const body = { tenantId: 'csrf-cafe', displayName: 'X', currencyCode: 'EGP', currencySymbol: 'ج.م' };
    const missing = await h.app.inject({ method: 'POST', url: '/api/admin/v1/tenants', headers: { cookie: s.cookie }, payload: body });
    assert.equal(missing.statusCode, 403);
    assert.equal(missing.json().error.code, 'CSRF_FAILED');
    const wrong = await s.request('POST', '/api/admin/v1/tenants', body, { 'x-csrf-token': 'x'.repeat(32) });
    assert.equal(wrong.status, 403);
    const crossOrigin = await s.request('POST', '/api/admin/v1/tenants', body, { origin: 'https://evil.example' });
    assert.equal(crossOrigin.status, 403);
    const ok = await s.request('POST', '/api/admin/v1/tenants', body, { origin: 'http://localhost:80' });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
  });
});

describe('roles', () => {
  test('operators configure cafés but cannot create/activate them, manage credentials or admins', async () => {
    const op = await login(h.app, OPERATOR_EMAIL);
    const denied: [string, string, unknown][] = [
      ['POST', '/api/admin/v1/tenants', { tenantId: 'op-cafe', displayName: 'X', currencyCode: 'EGP', currencySymbol: 'ج.م' }],
      ['PUT', '/api/admin/v1/tenants/csrf-cafe/status', { status: 'ACTIVE' }],
      ['PUT', '/api/admin/v1/tenants/csrf-cafe/sections/general', { displayName: 'X', locale: 'ar-EG', currencyCode: 'USD', currencySymbol: '$' }],
      ['POST', '/api/admin/v1/tenants/csrf-cafe/integration/pairing-code', {}],
      ['POST', '/api/admin/v1/tenants/csrf-cafe/integration/revoke', {}],
      ['POST', '/api/admin/v1/tenants/csrf-cafe/domains', { host: 'x.example' }],
      ['GET', '/api/admin/v1/admin-users', undefined],
      ['POST', '/api/admin/v1/admin-users', { email: 'new@inbyte.test', displayName: 'N', role: 'INBYTE_SUPER_ADMIN', password: PASSWORD }]
    ];
    for (const [method, url, body] of denied) {
      const res = await op.request(method, url, body);
      assert.equal(res.status, 403, `${method} ${url}`);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    }
    const allowed = await op.request('PUT', '/api/admin/v1/tenants/csrf-cafe/sections/branding', { colors: { primary: '#123456' }, defaultTheme: 'dark' });
    assert.equal(allowed.status, 200);
  });

  test('a super admin cannot lock themselves out', async () => {
    const s = await login(h.app, SUPER_EMAIL);
    const me = (await s.request('GET', '/api/admin/v1/auth/me')).body.user;
    assert.equal((await s.request('PATCH', `/api/admin/v1/admin-users/${me.id}`, { isActive: false })).status, 400);
  });

  test('deactivating an admin ends their sessions', async () => {
    const s = await login(h.app, SUPER_EMAIL);
    const created = await s.request('POST', '/api/admin/v1/admin-users', { email: 'temp@inbyte.test', displayName: 'T', role: 'INBYTE_OPERATOR', password: PASSWORD });
    assert.equal(created.status, 201);
    assert.ok(!JSON.stringify(created.body).includes('scrypt'), 'no password hash in responses');
    const temp = await login(h.app, 'temp@inbyte.test');
    await s.request('PATCH', `/api/admin/v1/admin-users/${created.body.id}`, { isActive: false });
    assert.equal((await temp.request('GET', '/api/admin/v1/auth/me')).status, 401);
  });
});

describe('audit trail', () => {
  test('admin actions are audited without secrets', async () => {
    const s = await login(h.app, SUPER_EMAIL);
    const pairing = await s.request('POST', '/api/admin/v1/tenants/csrf-cafe/integration/pairing-code');
    const pair = await publicCall(h.app, 'POST', '/api/integration/v1/pair', { pairingCode: pairing.body.pairingCode, cafeInstanceId: 'i', connectorVersion: '1' });
    const audit = await s.request('GET', '/api/admin/v1/audit?limit=200');
    const actions = audit.body.entries.map((e: any) => e.action);
    for (const a of ['tenant.created', 'tenant.branding.updated', 'integration.pairing_issued', 'integration.paired', 'admin_user.created', 'admin.login', 'admin.locked']) {
      assert.ok(actions.includes(a), a);
    }
    const text = JSON.stringify(audit.body);
    for (const secret of [PASSWORD, pairing.body.pairingCode, pair.body.credential, 'scrypt$']) assert.ok(!text.includes(secret), 'secret leaked into the audit log');
  });
});

describe('limits and error hygiene', () => {
  test('login is rate limited per IP', async () => {
    const strict = await createHarness({ rateLimitScale: 1 });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 12; i += 1) {
        codes.push((await publicCall(strict.app, 'POST', '/api/admin/v1/auth/login', { email: 'x@inbyte.test', password: 'nope-nope-nope' })).status);
      }
      assert.ok(codes.includes(429));
      const last = await publicCall(strict.app, 'POST', '/api/admin/v1/auth/login', { email: 'x@inbyte.test', password: 'nope-nope-nope' });
      assert.equal(last.body.error.code, 'RATE_LIMITED');
    } finally {
      await strict.close();
    }
  });

  test('oversized order payloads are refused', async () => {
    const res = await publicCall(h.app, 'POST', '/api/public/v1/tenants/csrf-cafe/orders', { pad: 'x'.repeat(40 * 1024) });
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  test('errors never leak internals', async () => {
    const malformed = await h.app.inject({ method: 'POST', url: '/api/public/v1/tenants/csrf-cafe/orders', headers: { 'content-type': 'application/json' }, payload: '{"broken' });
    assert.equal(malformed.statusCode, 400);
    assert.deepEqual(Object.keys(malformed.json()), ['error']);
    const unknown = await publicCall(h.app, 'GET', '/api/nope');
    assert.equal(unknown.status, 404);
    for (const r of [malformed.body, JSON.stringify(unknown.body)]) {
      assert.ok(!/at .*\.ts|SELECT|postgres|stack/i.test(r));
    }
  });

  test('security headers are set', async () => {
    const res = await publicCall(h.app, 'GET', '/api/admin/v1/auth/me');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['x-frame-options'], 'DENY');
  });
});
