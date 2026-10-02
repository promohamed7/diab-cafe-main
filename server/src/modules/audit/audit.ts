// Append-only audit trail for administrative and connector actions. Details
// never contain passwords, credentials, pairing codes or customer contact data.

import type { Queryable } from '../../db/pool.ts';

export type Actor =
  | { type: 'ADMIN'; id: string; label: string; ip: string | null }
  | { type: 'CONNECTOR'; id: string; label: string; ip: string | null }
  | { type: 'SYSTEM'; id: null; label: string; ip: null };

export const SYSTEM_ACTOR: Actor = { type: 'SYSTEM', id: null, label: 'system', ip: null };

export interface AuditEntry {
  action: string;
  tenantId?: string | null;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}

export async function writeAudit(db: Queryable, actor: Actor, entry: AuditEntry): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (actor_type, actor_id, actor_label, tenant_id, action, target_type, target_id, detail, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      actor.type,
      actor.id,
      actor.label,
      entry.tenantId ?? null,
      entry.action,
      entry.targetType ?? null,
      entry.targetId ?? null,
      JSON.stringify(entry.detail ?? {}),
      actor.ip
    ]
  );
}

export interface AuditRow {
  id: number;
  createdAt: string;
  actorType: string;
  actorLabel: string | null;
  tenantId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown>;
  ip: string | null;
}

export async function listAudit(
  db: Queryable,
  filter: { tenantUuid?: string; before?: number; limit: number }
): Promise<AuditRow[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (filter.tenantUuid) {
    params.push(filter.tenantUuid);
    where.push(`a.tenant_id = $${params.length}`);
  }
  if (filter.before) {
    params.push(filter.before);
    where.push(`a.id < $${params.length}`);
  }
  params.push(filter.limit);
  const { rows } = await db.query(
    `SELECT a.id, a.created_at, a.actor_type, a.actor_label, t.tenant_key, a.action, a.target_type, a.target_id, a.detail, a.ip
       FROM audit_logs a LEFT JOIN tenants t ON t.id = a.tenant_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.id DESC LIMIT $${params.length}`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at.toISOString(),
    actorType: r.actor_type,
    actorLabel: r.actor_label,
    tenantId: r.tenant_key,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    detail: r.detail,
    ip: r.ip
  }));
}
