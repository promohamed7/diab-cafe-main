import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { OrderType, OutsideOrderType } from '../types/order';
import type { TableContext } from '../types/table';
import { appConfig } from '../config/env';
import { toCafeError } from '../integration/errors';
import { resolveTableToken } from '../services/cafeTableService';
import { useUI } from '../context/UIContext';
import { useTenant } from '../tenant/TenantContext';
import { enabledOutsideOrderTypes, isDineInEnabled, isOrderTypeEnabled } from '../tenant/tenantPolicy';

// Ordering context for the three customer journeys, within the current café:
//   - outside: ONLINE + PICKUP or ONLINE + DELIVERY, whichever the café enables;
//   - inside:  TABLE_QR + DINE_IN, only after the café resolves the token from the QR URL
//     (and only if the café enables dine-in).
//
// The table session lives in the café's own sessionStorage scope (this tab only),
// records which café it belongs to, and expires — so a table can never be
// attached to a later order, or to another café's order, by accident.
// Customers can leave table mode but can never pick, type or change a table.

export type TableStatus = 'none' | 'resolving' | 'active' | 'invalid' | 'unverified' | 'disabled';

const OUTSIDE_TYPE_NAME = 'outside_order_type';
const TABLE_NAME = 'table_session';
export const TABLE_SESSION_TTL_MS = 3 * 60 * 60 * 1000;

interface StoredTableSession extends TableContext {
  tenantId: string;
}

interface OrderContextValue {
  orderType: OrderType;
  outsideType: OutsideOrderType;
  /** Outside journeys this café enables (may be empty). */
  availableOutsideTypes: OutsideOrderType[];
  /** False when the current journey is not enabled by the café (browse-only). */
  orderTypeEnabled: boolean;
  /** Returns false when a table session is active (dine-in is locked) or the type is disabled. */
  setOutsideType: (type: OutsideOrderType) => boolean;
  table: TableContext | null;
  tableStatus: TableStatus;
  isTableExpired: () => boolean;
  leaveTable: () => void;
  retryTableResolution: () => void;
  invalidateTable: () => void;
}

const OrderContext = createContext<OrderContextValue | null>(null);

/** Reads the token from the QR URL and removes it from the address bar. */
function takeTokenFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get(appConfig.tableQrParam);
    if (token === null) return null;
    url.searchParams.delete(appConfig.tableQrParam);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    return token.trim();
  } catch {
    return null;
  }
}

export const OrderContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setActiveTab, showToast } = useUI();
  const { tenant, scope } = useTenant();
  const storage = scope.storage;
  const availableOutsideTypes = useMemo(() => enabledOutsideOrderTypes(tenant), [tenant]);
  const dineInEnabled = isDineInEnabled(tenant);

  const [outsideType, setOutsideTypeState] = useState<OutsideOrderType>(() => {
    const saved = storage.readString(OUTSIDE_TYPE_NAME);
    const preferred = saved === 'DELIVERY' || saved === 'PICKUP' ? saved : null;
    return preferred && availableOutsideTypes.includes(preferred) ? preferred : availableOutsideTypes[0] ?? 'PICKUP';
  });
  const [table, setTable] = useState<TableContext | null>(null);
  const [tableStatus, setTableStatus] = useState<TableStatus>('none');
  const pendingToken = useRef<string | null>(null);

  const clearTableSession = useCallback(() => storage.remove(TABLE_NAME, 'session'), [storage]);

  const restoreTableSession = useCallback((now = Date.now()): TableContext | null => {
    const raw = storage.readJson(TABLE_NAME, 'session') as StoredTableSession | null;
    if (
      !raw ||
      raw.tenantId !== scope.tenantId ||
      typeof raw.token !== 'string' ||
      typeof raw.tableLabel !== 'string' ||
      typeof raw.resolvedAt !== 'number' ||
      now - raw.resolvedAt > TABLE_SESSION_TTL_MS
    ) {
      clearTableSession();
      return null;
    }
    return { token: raw.token, tableLabel: raw.tableLabel, resolvedAt: raw.resolvedAt };
  }, [storage, scope.tenantId, clearTableSession]);

  const resolve = useCallback(
    async (token: string) => {
      pendingToken.current = token;
      setTableStatus('resolving');
      try {
        // The token is only ever sent to the café this visit belongs to.
        const resolved = await resolveTableToken(scope, token);
        const ctx: TableContext = { token, tableLabel: resolved.tableLabel, resolvedAt: Date.now() };
        pendingToken.current = null;
        storage.writeJson(TABLE_NAME, { ...ctx, tenantId: scope.tenantId } satisfies StoredTableSession, 'session');
        setTable(ctx);
        setTableStatus('active');
        setActiveTab('menu');
      } catch (error) {
        const code = toCafeError(error).code;
        clearTableSession();
        setTable(null);
        if (code === 'INVALID_TABLE_TOKEN') {
          pendingToken.current = null;
          setTableStatus('invalid');
        } else {
          setTableStatus('unverified');
        }
      }
    },
    [scope, storage, setActiveTab, clearTableSession]
  );

  useEffect(() => {
    const fromUrl = takeTokenFromUrl();
    if (!dineInEnabled) {
      clearTableSession();
      if (fromUrl !== null) setTableStatus('disabled');
      return;
    }
    if (fromUrl !== null) {
      // A new QR scan always replaces any earlier table session.
      clearTableSession();
      void resolve(fromUrl);
      return;
    }
    const restored = restoreTableSession();
    if (restored) {
      setTable(restored);
      setTableStatus('active');
    }
  }, [dineInEnabled, resolve, restoreTableSession, clearTableSession]);

  const setOutsideType = useCallback(
    (type: OutsideOrderType) => {
      if (table || !availableOutsideTypes.includes(type)) return false;
      setOutsideTypeState(type);
      storage.writeString(OUTSIDE_TYPE_NAME, type);
      return true;
    },
    [table, availableOutsideTypes, storage]
  );

  const leaveTable = useCallback(() => {
    clearTableSession();
    pendingToken.current = null;
    setTable(null);
    setTableStatus('none');
    showToast('تم إنهاء الطلب من الطاولة.', 'info');
  }, [showToast, clearTableSession]);

  const invalidateTable = useCallback(() => {
    clearTableSession();
    setTable(null);
    setTableStatus('invalid');
  }, [clearTableSession]);

  const retryTableResolution = useCallback(() => {
    if (pendingToken.current) void resolve(pendingToken.current);
  }, [resolve]);

  const isTableExpired = useCallback(
    () => table !== null && Date.now() - table.resolvedAt > TABLE_SESSION_TTL_MS,
    [table]
  );

  const orderType: OrderType = table ? 'DINE_IN' : outsideType;

  const value = useMemo<OrderContextValue>(
    () => ({
      orderType,
      outsideType,
      availableOutsideTypes,
      orderTypeEnabled: isOrderTypeEnabled(tenant, orderType),
      setOutsideType,
      table,
      tableStatus,
      isTableExpired,
      leaveTable,
      retryTableResolution,
      invalidateTable
    }),
    [orderType, outsideType, availableOutsideTypes, tenant, setOutsideType, table, tableStatus, isTableExpired, leaveTable, retryTableResolution, invalidateTable]
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
};

export function useOrderContext(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrderContext must be used within OrderContextProvider');
  return ctx;
}
