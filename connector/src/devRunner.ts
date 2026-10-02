// DEVELOPMENT ONLY: runs the reference connector with the fake café engine for
// every café in .dev/connectors.json (written by `npm run db:seed:dev`), or
// pairs a new café: node connector/src/devRunner.ts --pair XXXX-XXXX --fixture inbyte-demo
//
// Staff actions are simulated: every created order advances one step every few seconds.

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { MOCK_TENANTS } from '../../src/integration/mock/mockTenants.ts';
import { FakeCafeEngine } from './fakeCafeEngine.ts';
import type { CafeOrderStatus } from './protocol.ts';
import { ReferenceConnector } from './referenceConnector.ts';

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: process.env.PLATFORM_URL ?? 'http://localhost:8080' },
    pair: { type: 'string' },
    fixture: { type: 'string', default: 'inbyte-demo' },
    'no-progress': { type: 'boolean', default: false }
  }
});
const base = values.base as string;
const credentials: Record<string, string> = JSON.parse(await readFile('.dev/connectors.json', 'utf8').catch(() => '{}'));

if (values.pair) {
  const { tenantId, credential } = await ReferenceConnector.pair(base, values.pair, `dev-${values.fixture}`);
  credentials[`${tenantId}`] = credential;
  await writeFile('.dev/connectors.json', JSON.stringify(credentials, null, 2), { mode: 0o600 });
  console.log(`paired ${tenantId} (fixture ${values.fixture})`);
}

const NEXT: Partial<Record<CafeOrderStatus, CafeOrderStatus>> = { PENDING: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED' };

for (const [tenantId, credential] of Object.entries(credentials)) {
  const fixture = MOCK_TENANTS[tenantId] ?? MOCK_TENANTS[values.fixture as string];
  const engine = new FakeCafeEngine(fixture.buildCatalog({ priceDriftCents: 0, availability: {} }), fixture.tables);
  const connector = new ReferenceConnector({ baseUrl: base, credential, engine });
  const live = new Map<string, { ref: string; status: CafeOrderStatus }>();
  await connector.syncCatalog();
  await connector.syncTables();
  console.log(`[${tenantId}] catalog and tables synced`);

  setInterval(async () => {
    try {
      await connector.heartbeat();
      for (const { publicReference, result } of await connector.processOrders()) {
        console.log(`[${tenantId}] ${publicReference} → ${result.outcome === 'CREATED' ? result.orderNumber : result.errorCode}`);
        if (result.outcome === 'CREATED') live.set(result.orderNumber, { ref: publicReference, status: 'PENDING' });
      }
    } catch (err) {
      console.error(`[${tenantId}] ${(err as Error).message}`);
    }
  }, 3000);

  if (!values['no-progress']) {
    setInterval(async () => {
      for (const [orderNumber, o] of live) {
        const next = NEXT[o.status];
        if (!next) {
          live.delete(orderNumber);
          continue;
        }
        const update = engine.staff(orderNumber, next, next === 'COMPLETED' ? 'PAID' : undefined);
        await connector.reportStatus(o.ref, update).catch((err) => console.error(err.message));
        o.status = next;
        console.log(`[${tenantId}] ${orderNumber} ${next}`);
      }
    }, 8000);
  }
}
