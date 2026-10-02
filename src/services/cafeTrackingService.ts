// Tracking service: read-only status lookup by the café's non-guessable public
// reference, always within the visitor's café. There is intentionally no
// function that changes an order.

import type { OrderStatusSnapshot } from '../types/order';
import type { TenantScope } from '../tenant/tenantScope';
import { getCafeTransport } from '../integration';
import { assertTenantEcho, parseStatusSnapshot } from '../integration/parsers';

export async function getOrderStatus(
  scope: TenantScope,
  publicReference: string,
  signal?: AbortSignal
): Promise<OrderStatusSnapshot> {
  const transport = await getCafeTransport();
  const raw = await transport.getOrderStatus(scope.tenantId, publicReference, signal);
  assertTenantEcho(raw, scope.tenantId);
  return parseStatusSnapshot(raw);
}
