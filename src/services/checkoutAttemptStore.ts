// Persistence for the current checkout attempt (payload + clientRequestId) of
// ONE café. The store is bound to a tenant scope: it reads and writes only that
// café's storage and only accepts attempts whose tenantId matches, so a
// clientRequestId can never be restored or retried under another café.

import type { CheckoutAttempt } from '../domain/checkoutAttempt';
import { sanitizeStoredAttempt } from '../domain/checkoutAttempt';
import type { TenantScope } from '../tenant/tenantScope';

const NAME = 'checkout_attempt';

export interface CheckoutAttemptStore {
  readonly tenantId: string;
  load(): CheckoutAttempt | null;
  save(attempt: CheckoutAttempt | null): void;
}

/**
 * Dine-in snapshots carry the table token, so they live in sessionStorage with
 * the table session itself and never outlive the QR visit. Outside orders use
 * localStorage so a lost response can still be retried after a browser restart.
 */
function areaFor(attempt: CheckoutAttempt): 'local' | 'session' {
  return attempt.request.orderType === 'DINE_IN' ? 'session' : 'local';
}

export function createCheckoutAttemptStore(scope: TenantScope): CheckoutAttemptStore {
  const { storage, tenantId } = scope;
  return {
    tenantId,
    load() {
      const dineIn = sanitizeStoredAttempt(storage.readJson(NAME, 'session'), tenantId);
      if (dineIn && dineIn.request.orderType === 'DINE_IN') return dineIn;
      const outside = sanitizeStoredAttempt(storage.readJson(NAME, 'local'), tenantId);
      return outside && outside.request.orderType !== 'DINE_IN' ? outside : null;
    },
    save(attempt) {
      storage.remove(NAME, 'local');
      storage.remove(NAME, 'session');
      if (attempt && attempt.tenantId === tenantId) storage.writeJson(NAME, attempt, areaFor(attempt));
    }
  };
}
