// Order service: sends one order request to Café and returns Café's
// acknowledgement. Retry policy and clientRequestId handling live in the
// checkout hook (see domain/checkoutAttempt.ts); this function never retries on
// its own, so a request is never silently duplicated.

import type { OrderAcknowledgement, SubmitOrderRequest } from '../types/order';
import { getCafeTransport } from '../integration';
import { parseAcknowledgement } from '../integration/parsers';

export async function submitOrder(request: SubmitOrderRequest, signal?: AbortSignal): Promise<OrderAcknowledgement> {
  const transport = await getCafeTransport();
  return parseAcknowledgement(await transport.submitOrder(request, signal));
}
