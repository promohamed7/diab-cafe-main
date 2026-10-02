import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { OrderType, OutsideOrderType } from '../types/order';
import type { TableContext } from '../types/table';
import { appConfig } from '../config/env';
import { toCafeError } from '../integration/errors';
import { resolveTableToken } from '../services/cafeTableService';
import { readJson, readString, removeKey, writeJson, writeString } from '../services/storage';
import { useUI } from '../context/UIContext';

// Ordering context for the three customer journeys:
//   - outside: ONLINE + PICKUP (default) or ONLINE + DELIVERY, chosen by the visitor;
//   - inside:  TABLE_QR + DINE_IN, only after Café resolves the token from the QR URL.
//
// The table session lives in sessionStorage (this tab only) and expires, so an
// old table can never be attached to a later order by accident. Customers can
// leave table mode, but can never pick, type or change a table.

export type TableStatus = 'none' | 'resolving' | 'active' | 'invalid' | 'unverified';

const OUTSIDE_TYPE_KEY = 'inbyte_outside_order_type';
const TABLE_KEY = 'inbyte_table_session_v1';
export const TABLE_SESSION_TTL_MS = 3 * 60 * 60 * 1000;

interface OrderContextValue {
  orderType: OrderType;
  outsideType: OutsideOrderType;
  /** Returns false when a table session is active (dine-in is locked). */
  setOutsideType: (type: OutsideOrderType) => boolean;
  table: TableContext | null;
  tableStatus: TableStatus;
  /** True while a dine-in session exists but has passed its time limit. */
  isTableExpired: () => boolean;
  leaveTable: () => void;
  /** Retry resolving a token that could not be verified (e.g. offline). */
  retryTableResolution: () => void;
  /** Called when Café rejects the token at checkout. */
  invalidateTable: () => void;
}

const OrderContext = createContext<OrderContextValue | null>(null);

function restoreTableSession(now = Date.now()): TableContext | null {
  const raw = readJson(TABLE_KEY, 'session') as TableContext | null;
  if (
    !raw ||
    typeof raw.token !== 'string' ||
    typeof raw.tableLabel !== 'string' ||
    typeof raw.resolvedAt !== 'number' ||
    now - raw.resolvedAt > TABLE_SESSION_TTL_MS
  ) {
    removeKey(TABLE_KEY, 'session');
    return null;
  }
  return raw;
}

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
  const [outsideType, setOutsideTypeState] = useState<OutsideOrderType>(() =>
    readString(OUTSIDE_TYPE_KEY) === 'DELIVERY' ? 'DELIVERY' : 'PICKUP'
  );
  const [table, setTable] = useState<TableContext | null>(null);
  const [tableStatus, setTableStatus] = useState<TableStatus>('none');
  const pendingToken = useRef<string | null>(null);

  const resolve = useCallback(
    async (token: string) => {
      pendingToken.current = token;
      setTableStatus('resolving');
      try {
        const resolved = await resolveTableToken(token);
        const ctx: TableContext = { token, tableLabel: resolved.tableLabel, resolvedAt: Date.now() };
        pendingToken.current = null;
        writeJson(TABLE_KEY, ctx, 'session');
        setTable(ctx);
        setTableStatus('active');
        setActiveTab('menu');
      } catch (error) {
        const code = toCafeError(error).code;
        removeKey(TABLE_KEY, 'session');
        setTable(null);
        if (code === 'INVALID_TABLE_TOKEN') {
          pendingToken.current = null;
          setTableStatus('invalid');
        } else {
          setTableStatus('unverified');
        }
      }
    },
    [setActiveTab]
  );

  useEffect(() => {
    const fromUrl = takeTokenFromUrl();
    if (fromUrl !== null) {
      // A new QR scan always replaces any earlier table session.
      removeKey(TABLE_KEY, 'session');
      void resolve(fromUrl);
      return;
    }
    const restored = restoreTableSession();
    if (restored) {
      setTable(restored);
      setTableStatus('active');
    }
  }, [resolve]);

  const setOutsideType = useCallback(
    (type: OutsideOrderType) => {
      if (table) return false;
      setOutsideTypeState(type);
      writeString(OUTSIDE_TYPE_KEY, type);
      return true;
    },
    [table]
  );

  const leaveTable = useCallback(() => {
    removeKey(TABLE_KEY, 'session');
    pendingToken.current = null;
    setTable(null);
    setTableStatus('none');
    showToast('تم إنهاء الطلب من الطاولة. يمكنك الآن الطلب للاستلام أو التوصيل.', 'info');
  }, [showToast]);

  const invalidateTable = useCallback(() => {
    removeKey(TABLE_KEY, 'session');
    setTable(null);
    setTableStatus('invalid');
  }, []);

  const retryTableResolution = useCallback(() => {
    if (pendingToken.current) void resolve(pendingToken.current);
  }, [resolve]);

  const isTableExpired = useCallback(
    () => table !== null && Date.now() - table.resolvedAt > TABLE_SESSION_TTL_MS,
    [table]
  );

  const value = useMemo<OrderContextValue>(
    () => ({
      orderType: table ? 'DINE_IN' : outsideType,
      outsideType,
      setOutsideType,
      table,
      tableStatus,
      isTableExpired,
      leaveTable,
      retryTableResolution,
      invalidateTable
    }),
    [table, outsideType, setOutsideType, tableStatus, isTableExpired, leaveTable, retryTableResolution, invalidateTable]
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
};

export function useOrderContext(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrderContext must be used within OrderContextProvider');
  return ctx;
}
