// Dine-in tables and their QR capabilities.
//
// INBYTE Café creates tables and issues their tokens; the connector syncs them
// here. The platform never invents a table or a token. The admin can only
// switch QR ordering off for a table (a platform-side kill switch) and print
// the QR link for the token Café issued.

import { z } from 'zod';
import type { DbClient, Queryable } from '../../db/pool.ts';
import { badRequest } from '../../http/errors.ts';

export const TABLE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export const tablesSnapshotSchema = z.object({
  tables: z
    .array(
      z.object({
        tableId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        label: z.string().trim().min(1).max(80),
        qrToken: z.string().regex(TABLE_TOKEN_PATTERN),
        isActive: z.boolean()
      })
    )
    .max(1000)
});

export async function replaceTables(client: DbClient, tenantUuid: string, snapshot: z.infer<typeof tablesSnapshotSchema>, now: Date) {
  const ids = new Set<number>();
  const tokens = new Set<string>();
  for (const t of snapshot.tables) {
    if (ids.has(t.tableId) || tokens.has(t.qrToken)) throw badRequest('VALIDATION_FAILED', ['tables']);
    ids.add(t.tableId);
    tokens.add(t.qrToken);
  }
  const t = snapshot.tables;
  await client.query('DELETE FROM cafe_tables WHERE tenant_id = $1 AND NOT (cafe_table_id = ANY($2::bigint[]))', [tenantUuid, [...ids]]);
  // Clear tokens first so a token moving between tables can't hit the unique index mid-update.
  await client.query(`UPDATE cafe_tables SET qr_token = 'mv_' || md5(random()::text) WHERE tenant_id = $1`, [tenantUuid]);
  await client.query(
    `INSERT INTO cafe_tables (tenant_id, cafe_table_id, label, qr_token, is_active, synced_at)
     SELECT $1, x.id, x.label, x.token, x.active, $6 FROM unnest($2::bigint[], $3::text[], $4::text[], $5::bool[]) AS x(id, label, token, active)
     ON CONFLICT (tenant_id, cafe_table_id) DO UPDATE SET label = EXCLUDED.label, qr_token = EXCLUDED.qr_token,
       is_active = EXCLUDED.is_active, synced_at = EXCLUDED.synced_at`,
    [tenantUuid, t.map((x) => x.tableId), t.map((x) => x.label), t.map((x) => x.qrToken), t.map((x) => x.isActive), now]
  );
  return { tables: t.length };
}

export interface ResolvedTableRow {
  tableId: number;
  label: string;
  token: string;
}

/** Café-issued token → table, within one café only. Inactive or switched-off tables don't resolve. */
export async function resolveTableToken(db: Queryable, tenantUuid: string, token: string): Promise<ResolvedTableRow | null> {
  if (!TABLE_TOKEN_PATTERN.test(token)) return null;
  const { rows } = await db.query(
    'SELECT cafe_table_id, label, qr_token FROM cafe_tables WHERE tenant_id = $1 AND qr_token = $2 AND is_active AND qr_enabled',
    [tenantUuid, token]
  );
  return rows[0] ? { tableId: rows[0].cafe_table_id, label: rows[0].label, token: rows[0].qr_token } : null;
}

export async function listTables(db: Queryable, tenantUuid: string) {
  const { rows } = await db.query('SELECT * FROM cafe_tables WHERE tenant_id = $1 ORDER BY label, cafe_table_id', [tenantUuid]);
  return rows.map((r) => ({
    tableId: r.cafe_table_id as number,
    label: r.label as string,
    qrToken: r.qr_token as string,
    isActive: r.is_active as boolean,
    qrEnabled: r.qr_enabled as boolean,
    syncedAt: r.synced_at.toISOString() as string
  }));
}

export async function setTableQrEnabled(db: Queryable, tenantUuid: string, tableId: number, enabled: boolean): Promise<boolean> {
  const res = await db.query('UPDATE cafe_tables SET qr_enabled = $3 WHERE tenant_id = $1 AND cafe_table_id = $2', [tenantUuid, tableId, enabled]);
  return (res.rowCount ?? 0) > 0;
}

export function tableQrUrl(siteUrl: string, token: string, param = 'table'): string {
  const url = new URL(siteUrl);
  url.searchParams.set(param, token);
  return url.toString();
}
