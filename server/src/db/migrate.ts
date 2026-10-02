// Applies server/src/db/migrations/*.sql in name order, once each, under an
// advisory lock so concurrent deploys can't race.

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Db } from './pool.ts';
import { withTx } from './pool.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));
const LOCK_KEY = 4_215_220_001;

export async function migrate(db: Db, log: (msg: string) => void = () => undefined): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
  const applied: string[] = [];
  await withTx(db, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
    const done = new Set((await client.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
    for (const file of files) {
      if (done.has(file)) continue;
      await client.query(await readFile(MIGRATIONS_DIR + file, 'utf8'));
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      applied.push(file);
      log(`applied ${file}`);
    }
  });
  return applied;
}
