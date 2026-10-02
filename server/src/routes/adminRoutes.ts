// INBYTE Admin API. Session cookie + CSRF token on every mutation.
//   INBYTE_SUPER_ADMIN — everything, incl. creating/activating cafés, connector
//                        credentials and admin accounts.
//   INBYTE_OPERATOR    — configure cafés (branding, website, ordering, menu
//                        presentation, tables), read orders and integration status.

import type { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { AppContext } from '../http/context.ts';
import { clientIp, rateLimit, requestOrigin } from '../http/context.ts';
import { ApiError, badRequest, notFound } from '../http/errors.ts';
import { parseBody } from '../http/validate.ts';
import { listAudit, writeAudit } from '../modules/audit/audit.ts';
import type { AdminRole } from '../modules/auth/authService.ts';
import {
  changePassword,
  createAdminUser,
  getAdminUser,
  listAdminUsers,
  login,
  revokeSession,
  revokeUserSessions
} from '../modules/auth/authService.ts';
import { ADMIN_COOKIE_PATH, SESSION_COOKIE, adminActor, adminAuthHook, principalOf, requireRole } from '../modules/auth/guard.ts';
import {
  categoryPresentationSchema,
  loadProjection,
  productPresentationSchema,
  saveCategoryPresentation,
  saveProductPresentation,
  toPublicCatalog
} from '../modules/catalog/catalogService.ts';
import { integrationOverview, issuePairingCode, revokeConnection } from '../modules/integration/integrationService.ts';
import { getOrderForAdmin, listOrdersForAdmin } from '../modules/orders/orderService.ts';
import { listTables, setTableQrEnabled, tableQrUrl } from '../modules/tables/tableService.ts';
import { SECTION_SCHEMAS, createTenantSchema, statusSchema } from '../modules/tenants/tenantSchemas.ts';
import type { SectionName } from '../modules/tenants/tenantSchemas.ts';
import {
  addDomain,
  buildPublicConfig,
  createTenant,
  listDomains,
  listTenants,
  removeDomain,
  requireTenant,
  setTenantStatus,
  siteUrlFor,
  updateSection
} from '../modules/tenants/tenantService.ts';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../security/passwords.ts';

export const ADMIN_PREFIX = '/api/admin/v1';

const SUPER: AdminRole = 'INBYTE_SUPER_ADMIN';
const ANY_ADMIN: AdminRole[] = ['INBYTE_SUPER_ADMIN', 'INBYTE_OPERATOR'];

const password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

type KeyParams = { tenantId: string };

export function registerAdminRoutes(app: FastifyInstance, ctx: AppContext): void {
  // ---- Session (no auth hook) -------------------------------------------------
  app.post(`${ADMIN_PREFIX}/auth/login`, { config: rateLimit(ctx, 10) }, async (req, reply) => {
    const body = parseBody(z.object({ email: z.string().max(254), password: z.string().max(PASSWORD_MAX_LENGTH) }).strict(), req.body);
    const result = await login(
      ctx.db,
      { ...body, ip: clientIp(req), userAgent: req.headers['user-agent'] ?? null, sessionHours: ctx.config.adminSessionHours },
      ctx.now()
    );
    reply.setCookie(SESSION_COOKIE, result.token, {
      path: ADMIN_COOKIE_PATH,
      httpOnly: true,
      secure: ctx.config.cookieSecure,
      sameSite: 'strict',
      expires: result.expiresAt
    });
    await writeAudit(ctx.db, { type: 'ADMIN', id: result.principal.user.id, label: result.principal.user.email, ip: clientIp(req) }, { action: 'admin.login' });
    return { user: result.principal.user, csrfToken: result.principal.csrfToken };
  });

  // Everything below requires an authenticated INBYTE admin.
  app.register(async (scope) => {
    scope.decorateRequest('admin', null);
    scope.addHook('preHandler', adminAuthHook(ctx));

    scope.get(`${ADMIN_PREFIX}/auth/me`, async (req) => {
      const p = principalOf(req);
      return { user: p.user, csrfToken: p.csrfToken };
    });

    scope.post(`${ADMIN_PREFIX}/auth/logout`, async (req, reply) => {
      await revokeSession(ctx.db, principalOf(req).sessionId, ctx.now());
      reply.clearCookie(SESSION_COOKIE, { path: ADMIN_COOKIE_PATH });
      return { ok: true };
    });

    scope.post(`${ADMIN_PREFIX}/auth/password`, async (req) => {
      const body = parseBody(z.object({ currentPassword: z.string().max(PASSWORD_MAX_LENGTH), newPassword: password }).strict(), req.body);
      await changePassword(ctx.db, principalOf(req), body.currentPassword, body.newPassword, ctx.now());
      await writeAudit(ctx.db, adminActor(req), { action: 'admin.password_changed', targetType: 'admin_user', targetId: principalOf(req).user.id });
      return { ok: true };
    });

    // ---- Dashboard ---------------------------------------------------------------
    scope.get(`${ADMIN_PREFIX}/dashboard`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const now = ctx.now();
      const tenants = await listTenants(ctx.db, ctx.config.connectorOfflineAfterSeconds, now);
      const orders = await ctx.db.query(
        `SELECT count(*) FILTER (WHERE created_at > $1::timestamptz - interval '24 hours')::int AS last24h,
                count(*) FILTER (WHERE delivery_state IN ('QUEUED', 'LEASED'))::int AS awaiting_cafe,
                count(*) FILTER (WHERE delivery_state = 'NOT_DELIVERED' AND updated_at > $1::timestamptz - interval '24 hours')::int AS not_delivered_24h
           FROM orders`,
        [now]
      );
      return {
        cafes: {
          total: tenants.length,
          active: tenants.filter((t) => t.status === 'ACTIVE').length,
          draft: tenants.filter((t) => t.status === 'DRAFT').length,
          disabled: tenants.filter((t) => t.status === 'DISABLED').length
        },
        integrations: {
          online: tenants.filter((t) => t.integration === 'ONLINE').length,
          offline: tenants.filter((t) => t.integration === 'OFFLINE').length,
          notConnected: tenants.filter((t) => t.integration === 'NOT_CONNECTED' || t.integration === 'PENDING_PAIRING').length
        },
        orders: {
          last24h: orders.rows[0].last24h,
          awaitingCafe: orders.rows[0].awaiting_cafe,
          notDelivered24h: orders.rows[0].not_delivered_24h
        },
        attention: tenants.filter((t) => t.status === 'ACTIVE' && t.integration !== 'ONLINE')
      };
    });

    // ---- Cafés -------------------------------------------------------------------
    scope.get(`${ADMIN_PREFIX}/tenants`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      return { tenants: await listTenants(ctx.db, ctx.config.connectorOfflineAfterSeconds, ctx.now()) };
    });

    scope.post(`${ADMIN_PREFIX}/tenants`, async (req, reply) => {
      requireRole(req, SUPER);
      const tenant = await createTenant(ctx.db, adminActor(req), parseBody(createTenantSchema, req.body));
      reply.code(201);
      return tenantView(tenant);
    });

    async function tenantView(tenant: Awaited<ReturnType<typeof requireTenant>>) {
      const { uuid: _internal, ...rest } = tenant;
      let configValid = true;
      try {
        buildPublicConfig(tenant);
      } catch {
        configValid = false;
      }
      return { ...rest, configValid };
    }

    scope.get<{ Params: KeyParams }>(`${ADMIN_PREFIX}/tenants/:tenantId`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      return {
        ...(await tenantView(tenant)),
        domains: await listDomains(ctx.db, tenant.uuid),
        siteUrl: await siteUrlFor(ctx.db, tenant, ctx.config.siteUrlTemplate, requestOrigin(req))
      };
    });

    scope.get<{ Params: KeyParams }>(`${ADMIN_PREFIX}/tenants/:tenantId/public-config`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      return buildPublicConfig(await requireTenant(ctx.db, req.params.tenantId));
    });

    scope.put<{ Params: KeyParams & { section: string } }>(`${ADMIN_PREFIX}/tenants/:tenantId/sections/:section`, { bodyLimit: 1024 * 1024 }, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const section = req.params.section;
      if (!(section in SECTION_SCHEMAS)) throw notFound();
      // Currency and naming affect every displayed price: super admin only.
      if (section === 'general') requireRole(req, SUPER);
      return tenantView(await updateSection(ctx.db, adminActor(req), req.params.tenantId, section as SectionName, req.body));
    });

    scope.put<{ Params: KeyParams }>(`${ADMIN_PREFIX}/tenants/:tenantId/status`, async (req) => {
      requireRole(req, SUPER);
      const { status } = parseBody(statusSchema, req.body);
      return tenantView(await setTenantStatus(ctx.db, adminActor(req), req.params.tenantId, status));
    });

    // ---- Domains -----------------------------------------------------------------
    scope.post<{ Params: KeyParams }>(`${ADMIN_PREFIX}/tenants/:tenantId/domains`, async (req) => {
      requireRole(req, SUPER);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      return { domains: await addDomain(ctx.db, adminActor(req), tenant, req.body) };
    });

    scope.delete<{ Params: KeyParams & { host: string } }>(`${ADMIN_PREFIX}/tenants/:tenantId/domains/:host`, async (req) => {
      requireRole(req, SUPER);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      return { domains: await removeDomain(ctx.db, adminActor(req), tenant, req.params.host) };
    });

    // ---- Menu presentation -----------------------------------------------------------
    scope.get<{ Params: KeyParams }>(`${ADMIN_PREFIX}/tenants/:tenantId/menu`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      const projection = await loadProjection(ctx.db, tenant.uuid);
      const publicCatalog = toPublicCatalog(tenant, projection);
      return { ...projection, publicProductCount: publicCatalog.products.length, currencySymbol: tenant.currencySymbol };
    });

    const cafeIdParam = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);

    scope.put<{ Params: KeyParams & { id: string } }>(`${ADMIN_PREFIX}/tenants/:tenantId/menu/products/:id`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      const id = parseBody(cafeIdParam, req.params.id);
      const body = parseBody(productPresentationSchema, req.body);
      await saveProductPresentation(ctx.db, tenant.uuid, id, body);
      await writeAudit(ctx.db, adminActor(req), { action: 'menu.product.presentation', tenantId: tenant.uuid, targetType: 'product', targetId: String(id), detail: { ...body } });
      return { ok: true };
    });

    scope.put<{ Params: KeyParams & { id: string } }>(`${ADMIN_PREFIX}/tenants/:tenantId/menu/categories/:id`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      const id = parseBody(cafeIdParam, req.params.id);
      const body = parseBody(categoryPresentationSchema, req.body);
      await saveCategoryPresentation(ctx.db, tenant.uuid, id, body);
      await writeAudit(ctx.db, adminActor(req), { action: 'menu.category.presentation', tenantId: tenant.uuid, targetType: 'category', targetId: String(id), detail: { ...body } });
      return { ok: true };
    });

    // ---- Tables / QR -------------------------------------------------------------------
    scope.get<{ Params: KeyParams }>(`${ADMIN_PREFIX}/tenants/:tenantId/tables`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      const siteUrl = await siteUrlFor(ctx.db, tenant, ctx.config.siteUrlTemplate, requestOrigin(req));
      const tables = await listTables(ctx.db, tenant.uuid);
      return { siteUrl, tables: tables.map((t) => ({ ...t, qrUrl: tableQrUrl(siteUrl, t.qrToken) })) };
    });

    scope.put<{ Params: KeyParams & { tableId: string } }>(`${ADMIN_PREFIX}/tenants/:tenantId/tables/:tableId`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      const tableId = parseBody(cafeIdParam, req.params.tableId);
      const { qrEnabled } = parseBody(z.object({ qrEnabled: z.boolean() }).strict(), req.body);
      if (!(await setTableQrEnabled(ctx.db, tenant.uuid, tableId, qrEnabled))) throw notFound();
      await writeAudit(ctx.db, adminActor(req), { action: qrEnabled ? 'table.qr_enabled' : 'table.qr_disabled', tenantId: tenant.uuid, targetType: 'table', targetId: String(tableId) });
      return { ok: true };
    });

    scope.get<{ Params: KeyParams & { tableId: string } }>(`${ADMIN_PREFIX}/tenants/:tenantId/tables/:tableId/qr.svg`, async (req, reply) => {
      requireRole(req, ...ANY_ADMIN);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      const tableId = parseBody(cafeIdParam, req.params.tableId);
      const table = (await listTables(ctx.db, tenant.uuid)).find((t) => t.tableId === tableId);
      if (!table) throw notFound();
      const siteUrl = await siteUrlFor(ctx.db, tenant, ctx.config.siteUrlTemplate, requestOrigin(req));
      const svg = await QRCode.toString(tableQrUrl(siteUrl, table.qrToken), { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
      reply.type('image/svg+xml').header('Cache-Control', 'no-store');
      return svg;
    });

    // ---- Orders (read-only: Café owns status) ----------------------------------------------
    scope.get<{ Params: KeyParams; Querystring: Record<string, string> }>(`${ADMIN_PREFIX}/tenants/:tenantId/orders`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      const q = parseBody(
        z.object({
          deliveryState: z.enum(['QUEUED', 'LEASED', 'DELIVERED', 'REJECTED_BY_CAFE', 'NOT_DELIVERED']).optional(),
          before: z.iso.datetime().optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50)
        }),
        req.query
      );
      return { orders: await listOrdersForAdmin(ctx.db, tenant.uuid, q) };
    });

    scope.get<{ Params: KeyParams & { reference: string } }>(`${ADMIN_PREFIX}/tenants/:tenantId/orders/:reference`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const tenant = await requireTenant(ctx.db, req.params.tenantId);
      const order = await getOrderForAdmin(ctx.db, tenant.uuid, req.params.reference);
      // Viewing customer contact data is audited.
      await writeAudit(ctx.db, adminActor(req), { action: 'order.viewed', tenantId: tenant.uuid, targetType: 'order', targetId: req.params.reference });
      return order;
    });

    // ---- Integration ----------------------------------------------------------------------
    scope.get<{ Params: KeyParams }>(`${ADMIN_PREFIX}/tenants/:tenantId/integration`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      return integrationOverview(ctx, await requireTenant(ctx.db, req.params.tenantId));
    });

    scope.post<{ Params: KeyParams }>(`${ADMIN_PREFIX}/tenants/:tenantId/integration/pairing-code`, async (req) => {
      requireRole(req, SUPER);
      return issuePairingCode(ctx, adminActor(req), await requireTenant(ctx.db, req.params.tenantId));
    });

    scope.post<{ Params: KeyParams }>(`${ADMIN_PREFIX}/tenants/:tenantId/integration/revoke`, async (req) => {
      requireRole(req, SUPER);
      await revokeConnection(ctx, adminActor(req), await requireTenant(ctx.db, req.params.tenantId));
      return { ok: true };
    });

    // ---- Audit log ------------------------------------------------------------------------
    scope.get<{ Querystring: Record<string, string> }>(`${ADMIN_PREFIX}/audit`, async (req) => {
      requireRole(req, ...ANY_ADMIN);
      const q = parseBody(
        z.object({
          tenantId: z.string().optional(),
          before: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().min(1).max(200).default(100)
        }),
        req.query
      );
      const tenantUuid = q.tenantId ? (await requireTenant(ctx.db, q.tenantId)).uuid : undefined;
      return { entries: await listAudit(ctx.db, { tenantUuid, before: q.before, limit: q.limit }) };
    });

    // ---- INBYTE admin accounts (super admin) ---------------------------------------------
    scope.get(`${ADMIN_PREFIX}/admin-users`, async (req) => {
      requireRole(req, SUPER);
      return { users: await listAdminUsers(ctx.db) };
    });

    scope.post(`${ADMIN_PREFIX}/admin-users`, async (req, reply) => {
      requireRole(req, SUPER);
      const body = parseBody(
        z
          .object({
            email: z.email().max(254),
            displayName: z.string().trim().min(1).max(80),
            role: z.enum(['INBYTE_SUPER_ADMIN', 'INBYTE_OPERATOR']),
            password
          })
          .strict(),
        req.body
      );
      try {
        const user = await createAdminUser(ctx.db, body);
        await writeAudit(ctx.db, adminActor(req), { action: 'admin_user.created', targetType: 'admin_user', targetId: user.id, detail: { email: user.email, role: user.role } });
        reply.code(201);
        return user;
      } catch (error) {
        if ((error as { code?: string }).code === '23505') throw new ApiError(409, 'CONFLICT');
        throw error;
      }
    });

    scope.patch<{ Params: { id: string } }>(`${ADMIN_PREFIX}/admin-users/:id`, async (req) => {
      const me = requireRole(req, SUPER);
      const id = parseBody(z.uuid(), req.params.id);
      const body = parseBody(
        z.object({ isActive: z.boolean().optional(), role: z.enum(['INBYTE_SUPER_ADMIN', 'INBYTE_OPERATOR']).optional(), unlock: z.boolean().optional() }).strict(),
        req.body
      );
      if (id === me.user.id && (body.isActive === false || (body.role && body.role !== SUPER))) throw badRequest('VALIDATION_FAILED', ['self']);
      const target = await getAdminUser(ctx.db, id);
      if (!target) throw notFound();
      await ctx.db.query(
        `UPDATE admin_users SET is_active = COALESCE($2, is_active), role = COALESCE($3, role),
                locked_until = CASE WHEN $4 THEN NULL ELSE locked_until END,
                failed_login_count = CASE WHEN $4 THEN 0 ELSE failed_login_count END, updated_at = now()
          WHERE id = $1`,
        [id, body.isActive ?? null, body.role ?? null, body.unlock === true]
      );
      if (body.isActive === false || body.role) await revokeUserSessions(ctx.db, id, ctx.now());
      await writeAudit(ctx.db, adminActor(req), { action: 'admin_user.updated', targetType: 'admin_user', targetId: id, detail: body });
      return getAdminUser(ctx.db, id);
    });
  });
}
