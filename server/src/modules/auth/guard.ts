// Request guards for the admin API: session cookie → principal, role checks,
// and CSRF protection (per-session token + Origin check) for every mutation.

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from '../../http/context.ts';
import { clientIp, requestOrigin } from '../../http/context.ts';
import { ApiError } from '../../http/errors.ts';
import { safeEqual } from '../../security/tokens.ts';
import type { Actor } from '../audit/audit.ts';
import type { AdminPrincipal, AdminRole } from './authService.ts';
import { authenticate } from './authService.ts';

export const SESSION_COOKIE = 'inbyte_admin';
export const ADMIN_COOKIE_PATH = '/api/admin';

declare module 'fastify' {
  interface FastifyRequest {
    admin: AdminPrincipal | null;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function adminAuthHook(ctx: AppContext) {
  return async function requireAdmin(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const token = req.cookies[SESSION_COOKIE];
    const principal = token ? await authenticate(ctx.db, token, ctx.now(), ctx.config.adminSessionIdleMinutes) : null;
    if (!principal) throw new ApiError(401, 'UNAUTHENTICATED');

    if (!SAFE_METHODS.has(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== requestOrigin(req) && !ctx.config.adminOrigins.includes(origin)) {
        throw new ApiError(403, 'CSRF_FAILED');
      }
      const header = req.headers['x-csrf-token'];
      if (typeof header !== 'string' || !safeEqual(header, principal.csrfToken)) throw new ApiError(403, 'CSRF_FAILED');
    }
    req.admin = principal;
  };
}

export function principalOf(req: FastifyRequest): AdminPrincipal {
  if (!req.admin) throw new ApiError(401, 'UNAUTHENTICATED');
  return req.admin;
}

export function requireRole(req: FastifyRequest, ...roles: AdminRole[]): AdminPrincipal {
  const principal = principalOf(req);
  if (!roles.includes(principal.user.role)) throw new ApiError(403, 'FORBIDDEN');
  return principal;
}

export function adminActor(req: FastifyRequest): Actor {
  const p = principalOf(req);
  return { type: 'ADMIN', id: p.user.id, label: p.user.email, ip: clientIp(req) };
}
