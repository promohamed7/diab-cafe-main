// HTTP application factory. One modular monolith:
//   /api/public/v1/*       customer website (anonymous, rate limited)
//   /api/admin/v1/*        INBYTE Admin (session + CSRF + roles)
//   /api/integration/v1/*  café connectors (bearer credential per café)
//   everything else        the built customer website and admin SPA (if STATIC_DIR is set)

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from './http/context.ts';
import { ApiError } from './http/errors.ts';
import { ADMIN_PREFIX, registerAdminRoutes } from './routes/adminRoutes.ts';
import { registerConnectorRoutes } from './routes/connectorRoutes.ts';
import { PUBLIC_PREFIX, registerPublicRoutes } from './routes/publicRoutes.ts';

export interface BuildAppOptions {
  logger?: boolean;
}

const CUSTOMER_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // Café fonts/images are configured per café as https URLs (or inline data images).
  "style-src 'self' 'unsafe-inline' https:",
  "font-src 'self' https: data:",
  "img-src 'self' https: data:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https: data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'"
].join('; ');

export async function buildApp(ctx: AppContext, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger
      ? { level: ctx.config.env === 'production' ? 'info' : 'debug', redact: ['req.headers.authorization', 'req.headers.cookie'] }
      : false,
    // Trust exactly the configured number of reverse-proxy hops for client IP / protocol / host.
    trustProxy: ctx.config.trustProxy > 0 ? (_address: string, hop: number) => hop < ctx.config.trustProxy : false,
    bodyLimit: 256 * 1024
  });

  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, {
    global: false,
    errorResponseBuilder: () => new ApiError(429, 'RATE_LIMITED')
  });

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, req, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, ...(error.fields ? { fields: error.fields } : {}) } });
    }
    const status = error.statusCode ?? 500;
    if (status === 413) return reply.code(413).send({ error: { code: 'PAYLOAD_TOO_LARGE' } });
    if (status === 429) return reply.code(429).send({ error: { code: 'RATE_LIMITED' } });
    if (status >= 400 && status < 500) return reply.code(status).send({ error: { code: 'VALIDATION_FAILED' } });
    req.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR' } });
  });

  // Security headers for every response.
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (ctx.config.env === 'production') reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const type = String(reply.getHeader('content-type') ?? '');
    if (type.startsWith('text/html')) {
      const isAdmin = req.url.startsWith('/admin');
      reply.header('Content-Security-Policy', isAdmin ? ADMIN_CSP : CUSTOMER_CSP);
      reply.header('X-Frame-Options', isAdmin ? 'DENY' : 'SAMEORIGIN');
    }
    if (req.url.startsWith('/api/admin') || req.url.startsWith('/api/integration')) {
      reply.header('Cache-Control', 'no-store');
      reply.header('X-Frame-Options', 'DENY');
    }
    return payload;
  });

  // CORS: the website is served same-origin by default. Extra origins (e.g. a
  // separately hosted static site) may read the public API only, without credentials.
  const corsOrigins = new Set(ctx.config.publicCorsOrigins);
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && req.url.startsWith(PUBLIC_PREFIX) && corsOrigins.has(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
    }
  });
  app.options(`${PUBLIC_PREFIX}/*`, async (req, reply) => {
    const origin = req.headers.origin;
    if (!origin || !corsOrigins.has(origin)) return reply.code(404).send({ error: { code: 'NOT_FOUND' } });
    reply
      .header('Access-Control-Allow-Methods', 'GET, POST')
      .header('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key')
      .header('Access-Control-Max-Age', '600')
      .code(204)
      .send();
  });

  app.get('/api/health', async () => {
    await ctx.db.query('SELECT 1');
    return { ok: true };
  });

  registerPublicRoutes(app, ctx);
  registerConnectorRoutes(app, ctx);
  registerAdminRoutes(app, ctx);

  const staticDir = ctx.config.staticDir;
  const hasStatic = !!staticDir && existsSync(join(staticDir, 'index.html'));
  if (hasStatic) {
    await app.register(fastifyStatic, { root: staticDir, index: false, wildcard: false, serve: true, prefix: '/' });
    // Hashed build assets can be cached forever.
    app.get('/assets/*', (req, reply) => {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.sendFile(`assets/${(req.params as { '*': string })['*']}`);
    });
  }

  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    if (req.url.startsWith('/api/') || !hasStatic || (req.method !== 'GET' && req.method !== 'HEAD')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND' } });
    }
    const path = req.url.split('?')[0];
    // A missing static file is a 404, not the SPA (no HTML served in place of JSON or images).
    if (/\.[a-z0-9]{1,8}$/i.test(path)) return reply.code(404).send('Not found');
    reply.header('Cache-Control', 'no-cache');
    return path === '/admin' || path.startsWith('/admin/') ? reply.sendFile('admin/index.html') : reply.sendFile('index.html');
  });

  return app;
}

export { ADMIN_PREFIX };
