// Production entry point: migrate, serve, run maintenance jobs.
//   node server/src/main.ts      (Node ≥ 22.18 runs TypeScript directly)

import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { migrate } from './db/migrate.ts';
import { createPool } from './db/pool.ts';
import type { AppContext } from './http/context.ts';
import { expireUndeliveredOrders, redactExpiredCustomerData } from './modules/orders/orderService.ts';

const config = loadConfig();
const db = createPool(config.databaseUrl, { max: 20 });
const ctx: AppContext = { config, db, now: () => new Date() };

await migrate(db, (msg) => console.log(`[migrate] ${msg}`));
const app = await buildApp(ctx, { logger: true });

// Maintenance: close orders no café picked up in time; erase old customer contact data.
const maintenance = setInterval(() => {
  const now = new Date();
  expireUndeliveredOrders(db, now)
    .then(() => redactExpiredCustomerData(db, now, config.customerDataRetentionDays))
    .catch((err) => app.log.error({ err }, 'maintenance job failed'));
}, 30_000);
maintenance.unref();

const shutdown = async () => {
  clearInterval(maintenance);
  await app.close();
  await db.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: config.host, port: config.port });
