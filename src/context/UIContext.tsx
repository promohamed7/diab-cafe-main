import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CafeId } from '../types/catalog';
import { useTenant } from '../tenant/TenantContext';
import { themeVariables } from '../tenant/tenantTheme';

// Presentation-only state: navigation, theme, toasts, search and modals.
// Catalog, cart, ordering context, checkout and tracking live in their own
// providers/hooks under src/hooks.

export type NavigationTab = 'home' | 'menu' | 'cart' | 'checkout' | 'order' | 'about';
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

const THEME_NAME = 'theme';
const UIContext = createContext<UIContextValue | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant, scope } = useTenant();
  // The visitor's light/dark choice is remembered per café; the café picks the default.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = scope.storage.readString(THEME_NAME);
    return saved === 'light' || saved === 'dark' ? saved : tenant.branding.defaultTheme;
  });
  const appliedVars = useRef<string[]>([]);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    // Tenant branding = CSS variable values on top of the shared design tokens.
    for (const name of appliedVars.current) root.style.removeProperty(name);
    const vars = themeVariables(tenant.branding, theme);
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    appliedVars.current = Object.keys(vars);
  }, [theme, tenant.branding, scope]);
  // Only an explicit choice is remembered; otherwise the café's current default applies.
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      scope.storage.writeString(THEME_NAME, next);
      return next;
    });
  }, [scope]);

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
