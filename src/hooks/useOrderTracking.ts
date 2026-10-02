import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { OrderStatusSnapshot } from '../types/order';
import { appConfig } from '../config/env';
import type { CafeErrorCode } from '../integration/errors';
import { toCafeError } from '../integration/errors';
import { isTerminalStatus } from '../domain/orderStatus';
import { getOrderStatus } from '../services/cafeTrackingService';
import { trackedOrdersStore } from '../services/trackedOrdersStore';
import { useTenant } from '../tenant/TenantContext';

/** Orders placed on this device at the current café only. */
export function useTrackedOrders() {
  const { scope } = useTenant();
  const store = useMemo(() => trackedOrdersStore(scope), [scope]);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

interface TrackingState {
  snapshot: OrderStatusSnapshot | null;
  loading: boolean;
  errorCode: CafeErrorCode | null;
  lastCheckedAt: number | null;
}

/**
 * Read-only status polling by Café's public reference. Polls while the order is
 * in progress and the page is visible; stops once Café reports a final state.
 */
export function useOrderTracking(publicReference: string | null) {
  const { scope } = useTenant();
  const [state, setState] = useState<TrackingState>({ snapshot: null, loading: false, errorCode: null, lastCheckedAt: null });
  const terminal = state.snapshot ? isTerminalStatus(state.snapshot.orderStatus) : false;
  const failures = useRef(0);

  const refresh = useCallback(async () => {
    if (!publicReference) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      // Looked up within the current café only; another café's reference is unknown here.
      const snapshot = await getOrderStatus(scope, publicReference);
      failures.current = 0;
      setState({ snapshot, loading: false, errorCode: null, lastCheckedAt: Date.now() });
    } catch (error) {
      failures.current += 1;
      setState((s) => ({ ...s, loading: false, errorCode: toCafeError(error).code, lastCheckedAt: Date.now() }));
    }
  }, [publicReference, scope]);

  useEffect(() => {
    setState({ snapshot: null, loading: false, errorCode: null, lastCheckedAt: null });
    failures.current = 0;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!publicReference || terminal) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      // Back off after repeated failures (max ~2 minutes between checks).
      const delay = Math.min(appConfig.trackingPollMs * 2 ** Math.min(failures.current, 4), 120000);
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await refresh();
        schedule();
      }, delay);
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [publicReference, terminal, refresh]);

  return { ...state, terminal, refresh };
}
