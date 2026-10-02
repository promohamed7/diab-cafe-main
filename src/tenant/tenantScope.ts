import type { ScopedStorage } from './scopedStorage.ts';

/**
 * Everything a service needs to act for one café: its id (sent with every
 * integration call) and its private storage. Services receive the scope
 * explicitly; there is no global "current tenant" they could read by mistake.
 */
export interface TenantScope {
  readonly tenantId: string;
  readonly storage: ScopedStorage;
}
