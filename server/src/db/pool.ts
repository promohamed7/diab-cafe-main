import pg from 'pg';

// BIGINT (int8) columns hold minor-unit money and Café IDs. They are far below
// 2^53, so convert to number; refuse silently-imprecise values instead of rounding.
function safeBigint(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('BIGINT value outside the safe integer range');
  return n;
}
pg.types.setTypeParser(20, safeBigint);
// BIGINT[] (e.g. modifier option IDs).
const parseTextArray = pg.types.getTypeParser(1016) as (value: string) => (string | null)[];
pg.types.setTypeParser(1016, (value: string) => parseTextArray(value).map((v) => (v === null ? null : safeBigint(v))));

export type Db = pg.Pool;
export type DbClient = pg.PoolClient;
export type Queryable = pg.Pool | pg.PoolClient;

export function createPool(connectionString: string, options: { schema?: string; max?: number } = {}): Db {
  if (options.schema && !/^[a-z_][a-z0-9_]*$/.test(options.schema)) throw new Error('invalid schema name');
  return new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    options: options.schema ? `-c search_path=${options.schema}` : undefined
  });
}

/** Runs fn in a transaction. Errors roll back and propagate. */
export async function withTx<T>(db: Db, fn: (client: DbClient) => Promise<T>, isolation?: 'SERIALIZABLE'): Promise<T> {
  const client = await db.connect();
  try {
    await client.query(isolation ? `BEGIN ISOLATION LEVEL ${isolation}` : 'BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = error as { code?: string; constraint?: string };
  return e?.code === '23505' && (!constraint || e.constraint === constraint);
}
