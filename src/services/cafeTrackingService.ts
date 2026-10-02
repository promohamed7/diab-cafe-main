// Tracking service: read-only status lookup by Café's non-guessable public
// reference. There is intentionally no function that changes an order.

import type { OrderStatusSnapshot } from '../types/order';
import { getCafeTransport } from '../integration';
import { parseStatusSnapshot } from '../integration/parsers';

export async function getOrderStatus(publicReference: string, signal?: AbortSignal): Promise<OrderStatusSnapshot> {
  const transport = await getCafeTransport();
  return parseStatusSnapshot(await transport.getOrderStatus(publicReference, signal));
}
