import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CafeId } from '../types/catalog';
import { readString, writeString } from '../services/storage';

// Presentation-only state: navigation, theme, toasts, search and modals.
// Catalog, cart, ordering context, checkout and tracking live in their own
// providers/hooks under src/hooks.

export type NavigationTab = 'home' | 'menu' | 'cart' | 'checkout' | 'order' | 'heritage';
export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

interface UIContextValue {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  toast: ToastMessage | null;
  showToast: (text: string, tone?: ToastTone) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
  modifierProductId: CafeId | null;
  openModifierModal: (productId: CafeId) => void;
  closeModifierModal: () => void;
  isQuickCatModalOpen: boolean;
  openQuickCatModal: () => void;
  closeQuickCatModal: () => void;
  selectedCategoryId: CafeId | null;
  setSelectedCategoryId: (id: CafeId | null) => void;
  animatingCategoryId: CafeId | null;
  setAnimatingCategoryId: (id: CafeId | null) => void;
  isHeroTitleDocked: boolean;
  setIsHeroTitleDocked: (docked: boolean) => void;
}

const THEME_KEY = 'inbyte-cafe-theme';
const UIContext = createContext<UIContextValue | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (readString(THEME_KEY) === 'light' ? 'light' : 'dark'));
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writeString(THEME_KEY, theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  const [activeTab, setActiveTabState] = useState<NavigationTab>('home');
  const [hasAutoOpenedCategories, setHasAutoOpenedCategories] = useState(false);
  const [isQuickCatModalOpen, setIsQuickCatModalOpen] = useState(false);

  const setActiveTab = useCallback(
    (tab: NavigationTab) => {
      setActiveTabState(tab);
      if (tab === 'menu' && !hasAutoOpenedCategories) {
        setHasAutoOpenedCategories(true);
        setTimeout(() => setIsQuickCatModalOpen(true), 250);
      }
    },
    [hasAutoOpenedCategories]
  );

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastSeq = useRef(0);
  const showToast = useCallback((text: string, tone: ToastTone = 'success') => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text, tone });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const toggleSearch = useCallback(() => {
    if (activeTab !== 'menu') {
      setActiveTab('menu');
      setIsSearchOpen(true);
    } else {
      setIsSearchOpen((v) => !v);
    }
  }, [activeTab, setActiveTab]);

  const [modifierProductId, setModifierProductId] = useState<CafeId | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<CafeId | null>(null);
  const [animatingCategoryId, setAnimatingCategoryId] = useState<CafeId | null>(null);
  const [isHeroTitleDocked, setIsHeroTitleDocked] = useState(false);

  const value = useMemo<UIContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      theme,
      toggleTheme,
      toast,
      showToast,
      searchQuery,
      setSearchQuery,
      isSearchOpen,
      setIsSearchOpen,
      toggleSearch,
      modifierProductId,
      openModifierModal: (id) => setModifierProductId(id),
      closeModifierModal: () => setModifierProductId(null),
      isQuickCatModalOpen,
      openQuickCatModal: () => setIsQuickCatModalOpen(true),
      closeQuickCatModal: () => setIsQuickCatModalOpen(false),
      selectedCategoryId,
      setSelectedCategoryId,
      animatingCategoryId,
      setAnimatingCategoryId,
      isHeroTitleDocked,
      setIsHeroTitleDocked
    }),
    [
      activeTab, setActiveTab, theme, toggleTheme, toast, showToast, searchQuery, isSearchOpen, toggleSearch,
      modifierProductId, isQuickCatModalOpen, selectedCategoryId, animatingCategoryId, isHeroTitleDocked
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
