import type { FastifyRequest } from 'fastify';
import type { ServerConfig } from '../config.ts';
import type { Db } from '../db/pool.ts';

export interface AppContext {
  config: ServerConfig;
  db: Db;
  /** Injectable clock (tests move time forward to exercise expiry rules). */
  now: () => Date;
}

/** Client IP as seen through the configured number of trusted proxies. */
export function clientIp(req: FastifyRequest): string | null {
  return req.ip || null;
}

/** Origin of the current request, e.g. https://cafe-x.com (honours trusted proxies). */
export function requestOrigin(req: FastifyRequest): string {
  return `${req.protocol}://${req.host}`;
}

/** Route-level rate limit (per client IP), scaled by configuration. */
export function rateLimit(ctx: AppContext, max: number) {
  return { rateLimit: { max: max * ctx.config.rateLimitScale, timeWindow: '1 minute' } };
}
