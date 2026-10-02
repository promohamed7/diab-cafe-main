// Order service: sends one order request to one café and returns its
// acknowledgement. Retry policy and clientRequestId handling live in the
// checkout hook (see domain/checkoutAttempt.ts); this function never retries on
// its own, so a request is never silently duplicated.

import type { OrderAcknowledgement, SubmitOrderRequest } from '../types/order';
import type { TenantScope } from '../tenant/tenantScope';
import { getCafeTransport } from '../integration';
import { assertTenantEcho, parseAcknowledgement } from '../integration/parsers';

export async function submitOrder(
  scope: TenantScope,
  request: SubmitOrderRequest,
  signal?: AbortSignal
): Promise<OrderAcknowledgement> {
  const transport = await getCafeTransport();
  const raw = await transport.submitOrder(scope.tenantId, request, signal);
  assertTenantEcho(raw, scope.tenantId);
  return parseAcknowledgement(raw);
}
