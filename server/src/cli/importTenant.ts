// Imports a static tenant JSON (previous frontend-only release) into the database as a DRAFT café.
//   node server/src/cli/importTenant.ts public/tenants/cafe-x.json

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { migrate } from '../db/migrate.ts';
import { createPool } from '../db/pool.ts';
import { SYSTEM_ACTOR } from '../modules/audit/audit.ts';
import { importTenantConfig } from '../modules/tenants/importConfig.ts';

const file = process.argv[2];
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (!file) throw new Error('usage: importTenant.ts <tenant-config.json>');

const raw = JSON.parse(await readFile(file, 'utf8')) as { tenantId?: string };
const tenantId = raw.tenantId ?? basename(file, '.json');
const db = createPool(url, { max: 2 });
await migrate(db);
const tenant = await importTenantConfig(db, { ...SYSTEM_ACTOR, label: 'import-cli' }, raw, tenantId);
console.log(`imported ${tenant.tenantId} (status ${tenant.status}) — review it in the INBYTE Admin, then activate`);
await db.end();
