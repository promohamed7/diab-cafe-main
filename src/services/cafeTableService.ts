// Table service: asks Café to resolve a QR table token. The website never
// constructs, edits or guesses tokens; it forwards exactly what the QR carried.

import type { ResolvedTable } from '../types/table';
import { getCafeTransport } from '../integration';
import { CafeIntegrationError } from '../integration/errors';
import { parseResolvedTable } from '../integration/parsers';

/** Basic shape guard so obviously broken values never leave the browser. */
export function looksLikeTableToken(token: string): boolean {
  return token.length >= 8 && token.length <= 256 && /^[A-Za-z0-9._~-]+$/.test(token);
}

export async function resolveTableToken(token: string, signal?: AbortSignal): Promise<ResolvedTable> {
  if (!looksLikeTableToken(token)) throw new CafeIntegrationError('INVALID_TABLE_TOKEN');
  const transport = await getCafeTransport();
  return parseResolvedTable(await transport.resolveTableToken(token, signal));
}
