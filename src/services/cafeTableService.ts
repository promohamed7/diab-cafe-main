// Table service: asks the café to resolve a QR table token. The website never
// constructs, edits or guesses tokens; it forwards exactly what the QR carried,
// and only to the café (tenant) the visitor is on.

import type { ResolvedTable } from '../types/table';
import type { TenantScope } from '../tenant/tenantScope';
import { getCafeTransport } from '../integration';
import { CafeIntegrationError } from '../integration/errors';
import { assertTenantEcho, parseResolvedTable } from '../integration/parsers';

/** Basic shape guard so obviously broken values never leave the browser. */
export function looksLikeTableToken(token: string): boolean {
  return token.length >= 8 && token.length <= 256 && /^[A-Za-z0-9._~-]+$/.test(token);
}

export async function resolveTableToken(scope: TenantScope, token: string, signal?: AbortSignal): Promise<ResolvedTable> {
  if (!looksLikeTableToken(token)) throw new CafeIntegrationError('INVALID_TABLE_TOKEN');
  const transport = await getCafeTransport();
  const raw = await transport.resolveTableToken(scope.tenantId, token, signal);
  assertTenantEcho(raw, scope.tenantId);
  return parseResolvedTable(raw);
}
