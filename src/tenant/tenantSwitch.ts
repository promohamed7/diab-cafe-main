// When the same browser moves from one café to another on the same origin
// (path-based tenants, development switching), the previous café's in-progress
// state is cleared instead of being carried over. Each café's data is already
// stored under its own scope; this additionally drops the previous café's cart,
// table session and checkout snapshot so nothing half-finished lingers.
//
// One deliberate exception: a checkout snapshot whose outcome is still unknown
// (the order may already exist at the café) is kept in the previous café's
// scope. Deleting it would lose the only safe retry key and risk a duplicate
// order if the customer returns. It can never be used by another café.

import type { StorageArea } from './scopedStorage.ts';
import { createScopedStorage, VOLATILE_TENANT_STATE } from './scopedStorage.ts';

const LAST_TENANT_KEY = 'inbyte:last_tenant';

export interface TenantSwitchResult {
  previousTenantId: string | null;
  switched: boolean;
}

export function isolateTenantSwitch(
  currentTenantId: string,
  areas: { local: StorageArea | null; session: StorageArea | null },
  isUnresolvedAttempt: (raw: unknown, tenantId: string) => boolean
): TenantSwitchResult {
  let previous: string | null = null;
  try {
    previous = areas.local?.getItem(LAST_TENANT_KEY) ?? null;
  } catch {
    previous = null;
  }
  const switched = previous !== null && previous !== currentTenantId;
  if (switched && previous) {
    const prev = createScopedStorage(previous, areas);
    for (const { name, area } of VOLATILE_TENANT_STATE) prev.remove(name, area);
    if (!isUnresolvedAttempt(prev.readJson('checkout_attempt', 'local'), previous)) {
      prev.remove('checkout_attempt', 'local');
    }
  }
  try {
    areas.local?.setItem(LAST_TENANT_KEY, currentTenantId);
  } catch {
    // Storage unavailable: nothing to isolate.
  }
  return { previousTenantId: previous, switched };
}
