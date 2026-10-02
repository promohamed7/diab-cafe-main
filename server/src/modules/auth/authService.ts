// INBYTE administrator authentication: password login, server-side sessions,
// CSRF tokens and account lockout.

import type { Db, Queryable } from '../../db/pool.ts';
import { ApiError } from '../../http/errors.ts';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../../security/passwords.ts';
import { newCsrfToken, newSessionToken, sha256 } from '../../security/tokens.ts';

export type AdminRole = 'INBYTE_SUPER_ADMIN' | 'INBYTE_OPERATOR';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminPrincipal {
  user: AdminUser;
  sessionId: string;
  csrfToken: string;
}

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

function toUser(r: Record<string, any>): AdminUser {
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    isActive: r.is_active,
    lastLoginAt: r.last_login_at ? r.last_login_at.toISOString() : null,
    createdAt: r.created_at.toISOString()
  };
}

export async function createAdminUser(
  db: Queryable,
  input: { email: string; displayName: string; role: AdminRole; password: string }
): Promise<AdminUser> {
  const { rows } = await db.query(
    `INSERT INTO admin_users (email, display_name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.email.trim().toLowerCase(), input.displayName.trim(), input.role, await hashPassword(input.password)]
  );
  return toUser(rows[0]);
}

export async function listAdminUsers(db: Queryable): Promise<AdminUser[]> {
  const { rows } = await db.query('SELECT * FROM admin_users ORDER BY created_at');
  return rows.map(toUser);
}

export async function getAdminUser(db: Queryable, id: string): Promise<AdminUser | null> {
  const { rows } = await db.query('SELECT * FROM admin_users WHERE id = $1', [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export interface LoginResult {
  principal: AdminPrincipal;
  token: string;
  expiresAt: Date;
}

/**
 * Same response for unknown e-mail, wrong password, disabled and locked
 * accounts (INVALID_CREDENTIALS), with comparable timing, so the endpoint
 * can't be used to discover accounts.
 */
export async function login(
  db: Db,
  input: { email: string; password: string; ip: string | null; userAgent: string | null; sessionHours: number },
  now: Date
): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const { rows } = await db.query('SELECT * FROM admin_users WHERE email = $1', [email]);
  const row = rows[0];
  if (!row) {
    await verifyPassword(input.password, await dummyPasswordHash());
    throw new ApiError(401, 'INVALID_CREDENTIALS');
  }
  const ok = await verifyPassword(input.password, row.password_hash);
  const locked = row.locked_until && row.locked_until > now;
  if (!ok || locked || !row.is_active) {
    if (!ok && !locked) {
      const failures = row.failed_login_count + 1;
      const lockNow = failures >= MAX_FAILED_LOGINS;
      await db.query('UPDATE admin_users SET failed_login_count = $2, locked_until = $3 WHERE id = $1', [
        row.id,
        lockNow ? 0 : failures,
        lockNow ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) : row.locked_until
      ]);
      if (lockNow) {
        await db.query(
          `INSERT INTO audit_logs (actor_type, actor_id, actor_label, action, target_type, target_id, ip)
           VALUES ('SYSTEM', NULL, 'auth', 'admin.locked', 'admin_user', $1, $2)`,
          [row.id, input.ip]
        );
      }
    }
    throw new ApiError(401, 'INVALID_CREDENTIALS');
  }

  const token = newSessionToken();
  const csrfToken = newCsrfToken();
  const expiresAt = new Date(now.getTime() + input.sessionHours * 3_600_000);
  const session = await db.query(
    `INSERT INTO admin_sessions (token_hash, csrf_token, admin_user_id, ip, user_agent, created_at, last_seen_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6, $7) RETURNING id`,
    [sha256(token), csrfToken, row.id, input.ip, input.userAgent?.slice(0, 300) ?? null, now, expiresAt]
  );
  await db.query('UPDATE admin_users SET failed_login_count = 0, locked_until = NULL, last_login_at = $2 WHERE id = $1', [row.id, now]);
  return { principal: { user: toUser({ ...row, last_login_at: now }), sessionId: session.rows[0].id, csrfToken }, token, expiresAt };
}

export async function authenticate(db: Db, token: string, now: Date, idleMinutes: number): Promise<AdminPrincipal | null> {
  if (!token || token.length > 100) return null;
  const { rows } = await db.query(
    `SELECT s.id AS session_id, s.csrf_token, s.last_seen_at, u.*
       FROM admin_sessions s JOIN admin_users u ON u.id = s.admin_user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2
        AND s.last_seen_at > $2::timestamptz - make_interval(mins => $3) AND u.is_active`,
    [sha256(token), now, idleMinutes]
  );
  const row = rows[0];
  if (!row) return null;
  // Sliding idle timeout, written at most once a minute.
  if (now.getTime() - row.last_seen_at.getTime() > 60_000) {
    await db.query('UPDATE admin_sessions SET last_seen_at = $2 WHERE id = $1', [row.session_id, now]);
  }
  return { user: toUser(row), sessionId: row.session_id, csrfToken: row.csrf_token };
}

export async function revokeSession(db: Queryable, sessionId: string, now: Date): Promise<void> {
  await db.query('UPDATE admin_sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL', [sessionId, now]);
}

export async function revokeUserSessions(db: Queryable, userId: string, now: Date, exceptSessionId?: string): Promise<void> {
  await db.query(
    `UPDATE admin_sessions SET revoked_at = $2 WHERE admin_user_id = $1 AND revoked_at IS NULL AND ($3::uuid IS NULL OR id <> $3)`,
    [userId, now, exceptSessionId ?? null]
  );
}

export async function changePassword(db: Db, principal: AdminPrincipal, current: string, next: string, now: Date): Promise<void> {
  const { rows } = await db.query('SELECT password_hash FROM admin_users WHERE id = $1', [principal.user.id]);
  if (!rows[0] || !(await verifyPassword(current, rows[0].password_hash))) throw new ApiError(401, 'INVALID_CREDENTIALS');
  await db.query('UPDATE admin_users SET password_hash = $2, password_changed_at = $3, updated_at = $3 WHERE id = $1', [
    principal.user.id,
    await hashPassword(next),
    now
  ]);
  await revokeUserSessions(db, principal.user.id, now, principal.sessionId);
}
