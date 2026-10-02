// Café connector API (machine-to-machine). Every call except /pair needs the
// connector's bearer credential; the café is derived from that credential.

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppContext } from '../http/context.ts';
import { clientIp, rateLimit } from '../http/context.ts';
import { parseBody } from '../http/validate.ts';
import { catalogSnapshotSchema } from '../modules/catalog/catalogService.ts';
import type { ConnectorPrincipal } from '../modules/integration/integrationService.ts';
import {
  authenticateConnector,
  heartbeat,
  heartbeatSchema,
  leaseOrders,
  leaseSchema,
  orderResultSchema,
  pairConnector,
  pairSchema,
  pushCatalog,
  pushTables,
  reportOrderResult,
  reportStatus,
  statusUpdateSchema
} from '../modules/integration/integrationService.ts';
import { tablesSnapshotSchema } from '../modules/tables/tableService.ts';

export const CONNECTOR_PREFIX = '/api/integration/v1';

export function registerConnectorRoutes(app: FastifyInstance, ctx: AppContext): void {
  const auth = (req: FastifyRequest): Promise<ConnectorPrincipal> => authenticateConnector(ctx.db, req.headers.authorization);
  const limit = (max: number) => rateLimit(ctx, max);

  // Pairing codes are short: strict per-IP limit against guessing.
  app.post(`${CONNECTOR_PREFIX}/pair`, { config: limit(10) }, async (req) => pairConnector(ctx, parseBody(pairSchema, req.body), clientIp(req)));

  app.post(`${CONNECTOR_PREFIX}/heartbeat`, { config: limit(120) }, async (req) => heartbeat(ctx, await auth(req), parseBody(heartbeatSchema, req.body ?? {})));

  app.put(`${CONNECTOR_PREFIX}/catalog`, { config: limit(30), bodyLimit: 4 * 1024 * 1024 }, async (req) =>
    pushCatalog(ctx, await auth(req), parseBody(catalogSnapshotSchema, req.body))
  );

  app.put(`${CONNECTOR_PREFIX}/tables`, { config: limit(30), bodyLimit: 512 * 1024 }, async (req) =>
    pushTables(ctx, await auth(req), parseBody(tablesSnapshotSchema, req.body))
  );

  app.post(`${CONNECTOR_PREFIX}/orders/lease`, { config: limit(240) }, async (req) => {
    const p = await auth(req);
    return leaseOrders(ctx, p, parseBody(leaseSchema, req.body ?? {}).max);
  });

  app.post<{ Params: { reference: string } }>(`${CONNECTOR_PREFIX}/orders/:reference/result`, { config: limit(600) }, async (req) =>
    reportOrderResult(ctx, await auth(req), req.params.reference, parseBody(orderResultSchema, req.body))
  );

  app.post<{ Params: { reference: string } }>(`${CONNECTOR_PREFIX}/orders/:reference/status`, { config: limit(600) }, async (req) =>
    reportStatus(ctx, await auth(req), req.params.reference, parseBody(statusUpdateSchema, req.body))
  );
}
