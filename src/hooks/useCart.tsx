import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CafeId } from '../types/catalog';
import type { CartAddResult, CartLine, ReconciledLine } from '../domain/cart';
import {
  addCartLine,
  cartItemCount,
  estimateCartTotal,
  reconcileCart,
  removeCartLine,
  sanitizeStoredCart,
  setCartLineQuantity
} from '../domain/cart';
import { generateRequestId } from '../domain/checkoutAttempt';
import { readJson, writeJson } from '../services/storage';
import { useCatalog } from './useCatalog';

const CART_KEY = 'inbyte_cart_v2';

interface CartContextValue {
  lines: CartLine[];
  reconciled: ReconciledLine[];
  itemCount: number;
  /** Display estimate only; null while any line can't be priced from the menu. */
  estimatedTotalCents: number | null;
  hasIssues: boolean;
  addItem: (productId: CafeId, modifierOptionIds: CafeId[], quantity: number) => CartAddResult;
  setQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { index } = useCatalog();
  const [lines, setLinesState] = useState<CartLine[]>(() => sanitizeStoredCart(readJson(CART_KEY)));
  // Mutations read the latest lines synchronously so callers get an immediate result.
  const linesRef = useRef(lines);

  useEffect(() => {
    writeJson(CART_KEY, lines);
  }, [lines]);

  const commit = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLinesState(next);
  }, []);

  const addItem = useCallback(
    (productId: CafeId, modifierOptionIds: CafeId[], quantity: number) => {
      const result = addCartLine(linesRef.current, productId, modifierOptionIds, quantity, generateRequestId);
      if (result.ok) commit(result.lines);
      return result;
    },
    [commit]
  );

  const setQuantity = useCallback(
    (lineId: string, quantity: number) => commit(setCartLineQuantity(linesRef.current, lineId, quantity)),
    [commit]
  );
  const removeLine = useCallback((lineId: string) => commit(removeCartLine(linesRef.current, lineId)), [commit]);
  const clear = useCallback(() => commit([]), [commit]);

  const value = useMemo<CartContextValue>(() => {
    const reconciled = reconcileCart(lines, index);
    return {
      lines,
      reconciled,
      itemCount: cartItemCount(lines),
      estimatedTotalCents: index ? estimateCartTotal(reconciled) : null,
      hasIssues: reconciled.some((r) => r.issue !== null),
      addItem,
      setQuantity,
      removeLine,
      clear
    };
  }, [lines, index, addItem, setQuantity, removeLine, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
