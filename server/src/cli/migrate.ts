import { migrate } from '../db/migrate.ts';
import { createPool } from '../db/pool.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const db = createPool(url, { max: 1 });
const applied = await migrate(db, (m) => console.log(m));
console.log(applied.length ? `applied ${applied.length} migration(s)` : 'database is up to date');
await db.end();
