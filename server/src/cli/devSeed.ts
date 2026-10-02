// DEVELOPMENT ONLY: loads the two sample cafés into the local database, creates
// a local admin and pre-paired connectors for the fake café engine
// (npm run dev:connector). Refuses to run with NODE_ENV=production.

import { mkdir, writeFile } from 'node:fs/promises';
import { MOCK_TENANTS } from '../../../src/integration/mock/mockTenants.ts';
import { migrate } from '../db/migrate.ts';
import { createPool } from '../db/pool.ts';
import { SYSTEM_ACTOR } from '../modules/audit/audit.ts';
import { createAdminUser } from '../modules/auth/authService.ts';
import { importTenantConfig } from '../modules/tenants/importConfig.ts';
import { setTenantStatus } from '../modules/tenants/tenantService.ts';
import { newConnectorCredential, sha256 } from '../security/tokens.ts';

if (process.env.NODE_ENV === 'production') throw new Error('devSeed must never run in production');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const DEV_ADMIN_EMAIL = 'admin@inbyte.local';
const DEV_ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD ?? 'inbyte-dev-password';

const db = createPool(url, { max: 2 });
await migrate(db);
const actor = { ...SYSTEM_ACTOR, label: 'dev-seed' };

const existingAdmin = await db.query('SELECT 1 FROM admin_users WHERE email = $1', [DEV_ADMIN_EMAIL]);
if (!existingAdmin.rows[0]) {
  await createAdminUser(db, { email: DEV_ADMIN_EMAIL, displayName: 'Local admin', role: 'INBYTE_SUPER_ADMIN', password: DEV_ADMIN_PASSWORD });
}

const connectors: Record<string, string> = {};
for (const [tenantId, fixture] of Object.entries(MOCK_TENANTS)) {
  const tenant = await importTenantConfig(db, actor, fixture.config, tenantId);
  await setTenantStatus(db, actor, tenantId, 'ACTIVE');
  const { credential, prefix } = newConnectorCredential();
  await db.query(`UPDATE integration_connections SET status = 'REVOKED', revoked_at = now() WHERE tenant_id = $1 AND status <> 'REVOKED'`, [tenant.uuid]);
  await db.query(
    `INSERT INTO integration_connections (tenant_id, status, credential_hash, credential_prefix, cafe_instance_id, connector_version, paired_at, last_seen_at)
     VALUES ($1, 'ACTIVE', $2, $3, 'dev-fake-cafe', 'reference-1.0', now(), now())`,
    [tenant.uuid, sha256(credential), prefix]
  );
  connectors[tenantId] = credential;
}

await mkdir('.dev', { recursive: true });
await writeFile('.dev/connectors.json', JSON.stringify(connectors, null, 2), { mode: 0o600 });
console.log(`seeded ${Object.keys(connectors).join(', ')}; admin ${DEV_ADMIN_EMAIL} / ${process.env.DEV_ADMIN_PASSWORD ? '(DEV_ADMIN_PASSWORD)' : DEV_ADMIN_PASSWORD}`);
console.log('connector credentials written to .dev/connectors.json — start them with: npm run dev:connector');
await db.end();
