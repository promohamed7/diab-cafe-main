// Loads a café's configuration (branding, contact, enabled journeys, payment
// methods, content). It is data, so onboarding a café never touches React code.
//
// Sources:
//   mock   — development fixtures (src/integration/mock/mockTenants.ts)
//   static — `/tenants/<tenantId>.json` shipped with the deployment (default)
//   api    — `GET {relay}/tenants/<tenantId>/config` (future Café/relay source)

import type { TenantConfig } from '../types/tenant';
import { appConfig } from '../config/env';
import { getCafeTransport } from '../integration';
import { CafeIntegrationError } from '../integration/errors';
import { parseTenantConfig } from '../tenant/parseTenantConfig';

async function fetchStaticConfig(tenantId: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}tenants/${encodeURIComponent(tenantId)}.json`, {
      signal,
      cache: 'no-cache',
      credentials: 'omit'
    });
  } catch {
    throw new CafeIntegrationError('NETWORK_ERROR');
  }
  if (response.status === 404) throw new CafeIntegrationError('TENANT_NOT_FOUND', 404);
  if (!response.ok) throw new CafeIntegrationError('SERVICE_UNAVAILABLE', response.status);
  try {
    return await response.json();
  } catch {
    // An SPA fallback (index.html) instead of JSON means the file doesn't exist.
    throw new CafeIntegrationError('TENANT_NOT_FOUND', response.status);
  }
}

export async function loadTenantConfig(tenantId: string, signal?: AbortSignal): Promise<TenantConfig> {
  const transport = await getCafeTransport();
  const raw =
    transport.kind === 'mock' || appConfig.tenant.configSource === 'api'
      ? await transport.getTenantConfig(tenantId, signal)
      : await fetchStaticConfig(tenantId, signal);
  return parseTenantConfig(raw, tenantId);
}
