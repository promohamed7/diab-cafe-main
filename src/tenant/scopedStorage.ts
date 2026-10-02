// Tenant-scoped browser storage.
//
// Every piece of customer state (cart, checkout snapshot, table session, catalog
// cache, tracking references, theme preference) is stored through a
// ScopedStorage bound to one tenant, so one café's data is never visible to
// another even when they share an origin. Code never builds storage keys itself.

export interface StorageArea {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export type AreaName = 'local' | 'session';

export interface ScopedStorage {
  readonly tenantId: string;
  readJson(name: string, area?: AreaName): unknown;
  writeJson(name: string, value: unknown, area?: AreaName): void;
  readString(name: string, area?: AreaName): string | null;
  writeString(name: string, value: string, area?: AreaName): void;
  remove(name: string, area?: AreaName): void;
}

const PREFIX = 'inbyte';

function scopedKey(tenantId: string, name: string): string {
  return `${PREFIX}:${tenantId}:${name}`;
}

export function createScopedStorage(
  tenantId: string,
  areas: { local: StorageArea | null; session: StorageArea | null }
): ScopedStorage {
  const pick = (a: AreaName = 'local') => (a === 'local' ? areas.local : areas.session);
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return {
    tenantId,
    readJson: (name, area) =>
      safe(() => {
        const raw = pick(area)?.getItem(scopedKey(tenantId, name));
        return raw ? (JSON.parse(raw) as unknown) : null;
      }, null),
    writeJson: (name, value, area) => safe(() => pick(area)?.setItem(scopedKey(tenantId, name), JSON.stringify(value)), undefined),
    readString: (name, area) => safe(() => pick(area)?.getItem(scopedKey(tenantId, name)) ?? null, null),
    writeString: (name, value, area) => safe(() => pick(area)?.setItem(scopedKey(tenantId, name), value), undefined),
    remove: (name, area) => safe(() => pick(area)?.removeItem(scopedKey(tenantId, name)), undefined)
  };
}

/** Browser storage areas, or null where blocked (private mode, disabled site data). */
export function browserAreas(): { local: StorageArea | null; session: StorageArea | null } {
  const get = (fn: () => Storage): StorageArea | null => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  return { local: get(() => window.localStorage), session: get(() => window.sessionStorage) };
}

/** Names of per-tenant values that must not survive a switch to another tenant. */
export const VOLATILE_TENANT_STATE: readonly { name: string; area: AreaName }[] = [
  { name: 'cart', area: 'local' },
  { name: 'table_session', area: 'session' },
  { name: 'checkout_attempt', area: 'session' }
];
