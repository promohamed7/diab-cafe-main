// Public customer API — anonymous, internet-facing, rate limited.
// Paths match the website's HTTP transport: {base}/tenants/{tenantId}/…

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../http/context.ts';
import { rateLimit } from '../http/context.ts';
import { badRequest, notFound } from '../http/errors.ts';
import { parseBody } from '../http/validate.ts';
import { loadProjection, toPublicCatalog } from '../modules/catalog/catalogService.ts';
import { getOrderStatus, submitOrder, submitOrderSchema } from '../modules/orders/orderService.ts';
import { resolveTableToken } from '../modules/tables/tableService.ts';
import type { TenantRecord } from '../modules/tenants/tenantService.ts';
import { buildPublicConfig, ownerOfHost, requirePublicTenant, tenantForHost } from '../modules/tenants/tenantService.ts';

export const PUBLIC_PREFIX = '/api/public/v1';

type TenantParams = { tenantId: string };

export function registerPublicRoutes(app: FastifyInstance, ctx: AppContext): void {
  /**
   * Resolves the café for a request. If the request arrives on a domain that
   * belongs to a café, only that café can be addressed through it — a café's
   * custom domain can't be used to show or order from another café.
   */
  async function tenantFor(req: FastifyRequest<{ Params: TenantParams }>): Promise<TenantRecord> {
    const owner = await ownerOfHost(ctx.db, req.hostname);
    if (owner && owner !== req.params.tenantId) throw notFound('TENANT_NOT_FOUND');
    return requirePublicTenant(ctx.db, req.params.tenantId);
  }

  const readLimit = rateLimit(ctx, 240);

  app.get(`${PUBLIC_PREFIX}/domains/resolve`, { config: readLimit }, async (req) => {
    const tenantId = await tenantForHost(ctx.db, req.hostname);
    if (!tenantId) throw notFound('TENANT_NOT_FOUND');
    return { tenantId };
  });

  app.get<{ Params: TenantParams }>(`${PUBLIC_PREFIX}/tenants/:tenantId/config`, { config: readLimit }, async (req, reply) => {
    const tenant = await tenantFor(req);
    reply.header('Cache-Control', 'public, max-age=30');
    return buildPublicConfig(tenant);
  });

  app.get<{ Params: TenantParams }>(`${PUBLIC_PREFIX}/tenants/:tenantId/catalog`, { config: readLimit }, async (req, reply) => {
    const tenant = await tenantFor(req);
    reply.header('Cache-Control', 'public, max-age=15');
    return toPublicCatalog(tenant, await loadProjection(ctx.db, tenant.uuid));
  });

  app.post<{ Params: TenantParams }>(
    `${PUBLIC_PREFIX}/tenants/:tenantId/tables/resolve`,
    { config: rateLimit(ctx, 30) },
    async (req) => {
      const tenant = await tenantFor(req);
      const { token } = parseBody(z.object({ token: z.string().max(200) }), req.body);
      const table = tenant.features.onlineOrdering && tenant.features.dineInQr ? await resolveTableToken(ctx.db, tenant.uuid, token) : null;
      if (!table) throw notFound('INVALID_TABLE_TOKEN');
      // Only the customer-facing label: no table id, status or other tables.
      return { tenantId: tenant.tenantId, tableLabel: table.label };
    }
  );

  app.post<{ Params: TenantParams }>(
    `${PUBLIC_PREFIX}/tenants/:tenantId/orders`,
    { config: rateLimit(ctx, 20), bodyLimit: 32 * 1024 },
    async (req, reply) => {
      const tenant = await tenantFor(req);
      const input = parseBody(submitOrderSchema, req.body);
      const header = req.headers['idempotency-key'];
      if (header !== undefined && header !== input.clientRequestId) throw badRequest('VALIDATION_FAILED', ['Idempotency-Key']);
      const { ack, created } = await submitOrder(ctx, tenant, input);
      reply.code(created ? 201 : 200);
      return ack;
    }
  );

  app.get<{ Params: TenantParams & { reference: string } }>(
    `${PUBLIC_PREFIX}/tenants/:tenantId/orders/:reference`,
    { config: rateLimit(ctx, 60) },
    async (req, reply) => {
      const tenant = await tenantFor(req);
      reply.header('Cache-Control', 'no-store');
      return getOrderStatus(ctx, tenant, req.params.reference);
    }
  );
}
