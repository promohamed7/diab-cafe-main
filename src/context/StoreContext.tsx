import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { OrderType, CartItem, Order, UserProfile, NavigationTab, Product, SavedAddress } from '../types';
import { DEFAULT_USER } from '../data/menuData';

const CART_KEY = 'inbyte_cafe_cart';
const MODE_KEY = 'inbyte_cafe_order_mode';
const ORDERS_KEY = 'inbyte_cafe_orders';
const ACTIVE_ORDER_ID_KEY = 'inbyte_active_order_id';
const THEME_KEY = 'inbyte-cafe-theme';
const USER_KEY = 'inbyte_cafe_user';

interface StoreContextType {
  orderMode: OrderType;
  tableNumber: string;
  cart: CartItem[];
  cartCount: number;
  cartTotalCents: number;
  activeTab: NavigationTab;
  theme: 'dark' | 'light';
  user: UserProfile | null;
  orders: Order[];
  activeOrder: Order | null;
  toastMessage: string | null;
  // Search state
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
  // Modals
  isTableModalOpen: boolean;
  isAuthModalOpen: boolean;
  isModifierModalOpen: boolean;
  selectedProductForModifier: Product | null;
  isQuickCatModalOpen: boolean;
  selectedCategory: string;
  hasAutoOpenedCategories: boolean;
  setHasAutoOpenedCategories: (val: boolean) => void;
  animatingCategory: string | null;
  setAnimatingCategory: (catId: string | null) => void;
  isHeroTitleDocked: boolean;
  setIsHeroTitleDocked: (docked: boolean) => void;
  // Actions
  setOrderMode: (mode: OrderType, tableNum?: string) => void;
  setTableNumber: (num: string) => void;
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateCartItemQty: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  setActiveTab: (tab: NavigationTab) => void;
  toggleTheme: () => void;
  showToast: (msg: string) => void;
  openModifierModal: (product: Product) => void;
  closeModifierModal: () => void;
  openTableModal: () => void;
  closeTableModal: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openQuickCatModal: () => void;
  closeQuickCatModal: () => void;
  setSelectedCategory: (cat: string) => void;
  loginUser: (name: string, phone: string) => void;
  logoutUser: () => void;
  addSavedAddress: (addr: Omit<SavedAddress, 'id'>) => void;
  deleteSavedAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  submitOrder: (details: {
    fullName: string;
    phone: string;
    deliveryAddress?: string;
    customerNotes?: string;
    paymentMethod: 'CASH' | 'VODAFONE_CASH' | 'CARD';
  }) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: Order['orderStatus']) => void;
  orderUsual: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  // Order mode & table
  const [orderMode, setOrderModeState] = useState<OrderType>(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'DINE_IN' || saved === 'PICKUP' || saved === 'DELIVERY') return saved;
    } catch {}
    return 'DINE_IN';
  });

  const [tableNumber, setTableNumberState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('inbyte_cafe_table_num');
      return saved || '03';
    } catch {
      return '03';
    }
  });

  // Active Tab
  const [activeTab, setActiveTabState] = useState<NavigationTab>('home');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Flying Hero Title state
  const [isHeroTitleDocked, setIsHeroTitleDocked] = useState(false);

  // Quick categories modal & auto-open on entering menu
  const [hasAutoOpenedCategories, setHasAutoOpenedCategories] = useState(false);
  const [animatingCategory, setAnimatingCategory] = useState<string | null>(null);

  const setActiveTab = useCallback((tab: NavigationTab) => {
    setActiveTabState(tab);
    if (tab === 'menu' && !hasAutoOpenedCategories) {
      // Auto open quick categories modal on first menu visit
      setTimeout(() => {
        setIsQuickCatModalOpen(true);
        setHasAutoOpenedCategories(true);
      }, 250);
    }
  }, [hasAutoOpenedCategories]);

  const toggleSearch = useCallback(() => {
    if (activeTab !== 'menu') {
      setActiveTab('menu');
      setIsSearchOpen(true);
    } else {
      setIsSearchOpen(prev => !prev);
    }
  }, [activeTab, setActiveTab]);

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // User
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch {}
  }, [user]);

  // Orders
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(ORDERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    } catch {}
  }, [orders]);

  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_ORDER_ID_KEY) || (orders.length > 0 ? orders[0].orderId : null);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (activeOrderId) {
        localStorage.setItem(ACTIVE_ORDER_ID_KEY, activeOrderId);
      } else {
        localStorage.removeItem(ACTIVE_ORDER_ID_KEY);
      }
    } catch {}
  }, [activeOrderId]);

  // Modals state
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [selectedProductForModifier, setSelectedProductForModifier] = useState<Product | null>(null);
  const [isQuickCatModalOpen, setIsQuickCatModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('espresso');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setOrderMode = useCallback((mode: OrderType, tableNum?: string) => {
    setOrderModeState(mode);
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {}
    if (tableNum) {
      setTableNumberState(tableNum);
      try {
        localStorage.setItem('inbyte_cafe_table_num', tableNum);
      } catch {}
    }
  }, []);

  const setTableNumber = useCallback((num: string) => {
    setTableNumberState(num);
    try {
      localStorage.setItem('inbyte_cafe_table_num', num);
    } catch {}
  }, []);

  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    const newItem: CartItem = {
      ...item,
      id: 'item_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now()
    };
    setCart(prev => [newItem, ...prev]);
    showToast(`تمت إضافة "${item.productName}" إلى السلة`);
  }, [showToast]);

  const updateCartItemQty = useCallback((id: string, delta: number) => {
    setCart(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...item,
            quantity: newQty,
            totalCents: item.unitPriceCents * newQty
          };
        }
        return item;
      }).filter(Boolean) as CartItem[];
      return updated;
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
    showToast('تم حذف الصنف من السلة');
  }, [showToast]);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const openModifierModal = useCallback((product: Product) => {
    setSelectedProductForModifier(product);
    setIsModifierModalOpen(true);
  }, []);

  const closeModifierModal = useCallback(() => {
    setIsModifierModalOpen(false);
    setSelectedProductForModifier(null);
  }, []);

  const openTableModal = useCallback(() => {
    setIsTableModalOpen(true);
  }, []);

  const closeTableModal = useCallback(() => {
    setIsTableModalOpen(false);
  }, []);

  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const openQuickCatModal = useCallback(() => {
    setIsQuickCatModalOpen(true);
  }, []);

  const closeQuickCatModal = useCallback(() => {
    setIsQuickCatModalOpen(false);
  }, []);

  const loginUser = useCallback((name: string, phone: string) => {
    const updated: UserProfile = {
      id: 'usr_' + Math.random().toString(36).substring(2, 8),
      name,
      phone,
      authMethod: 'PHONE_OTP',
      loyaltyPoints: user?.loyaltyPoints || 750,
      savedAddresses: user?.savedAddresses || [
        {
          id: 'addr_1',
          label: 'المنزل',
          city: 'سيدي سالم',
          street: 'شارع التجاري الرئيسي',
          building: 'عمارة دياب رقم ٤',
          isDefault: true
        }
      ],
      usualOrder: user?.usualOrder || DEFAULT_USER.usualOrder
    };
    setUser(updated);
    closeAuthModal();
    showToast(`مرحباً بك، ${name}!`);
  }, [user, closeAuthModal, showToast]);

  const logoutUser = useCallback(() => {
    setUser(null);
    closeAuthModal();
    showToast('تم تسجيل الخروج بنجاح');
  }, [closeAuthModal, showToast]);

  const addSavedAddress = useCallback((addr: Omit<SavedAddress, 'id'>) => {
    if (!user) return;
    const newAddr: SavedAddress = {
      ...addr,
      id: 'addr_' + Date.now()
    };
    setUser(prev => {
      if (!prev) return null;
      return {
        ...prev,
        savedAddresses: [newAddr, ...(prev.savedAddresses || [])]
      };
    });
    showToast('تمت إضافة العنوان بنجاح');
  }, [user, showToast]);

  const deleteSavedAddress = useCallback((id: string) => {
    setUser(prev => {
      if (!prev) return null;
      return {
        ...prev,
        savedAddresses: prev.savedAddresses.filter(a => a.id !== id)
      };
    });
    showToast('تم حذف العنوان');
  }, [showToast]);

  const setDefaultAddress = useCallback((id: string) => {
    setUser(prev => {
      if (!prev) return null;
      return {
        ...prev,
        savedAddresses: prev.savedAddresses.map(a => ({
          ...a,
          isDefault: a.id === id
        }))
      };
    });
    showToast('تم تعيين العنوان كعنوان افتراضي');
  }, [showToast]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const cartTotalCents = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalCents, 0);
  }, [cart]);

  const activeOrder = useMemo(() => {
    if (!orders || orders.length === 0) return null;
    if (activeOrderId) {
      const found = orders.find(o => o.orderId === activeOrderId);
      if (found) return found;
    }
    return orders[0];
  }, [orders, activeOrderId]);

  const submitOrder = useCallback(async (details: {
    fullName: string;
    phone: string;
    deliveryAddress?: string;
    customerNotes?: string;
    paymentMethod: 'CASH' | 'VODAFONE_CASH' | 'CARD';
  }) => {
    const orderId = 'ord_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const orderNumber = 'WEB-' + (1000 + orders.length + 1);
    const createdAt = new Date().toISOString();

    const deliveryFeeCents = orderMode === 'DELIVERY' ? 2500 : 0;
    const authoritativeTotalCents = cartTotalCents + deliveryFeeCents;

    const newOrder: Order = {
      orderId,
      orderNumber,
      orderSecret: Math.random().toString(36).substring(2, 15),
      storeCode: 'DIAB-SIDI-SALEM',
      orderType: orderMode,
      orderChannel: 'WEB',
      tableToken: orderMode === 'DINE_IN' ? `tbl_${tableNumber}` : null,
      tableNumber: orderMode === 'DINE_IN' ? tableNumber : null,
      items: [...cart],
      customerInfo: {
        fullName: details.fullName,
        phone: details.phone,
        deliveryAddress: details.deliveryAddress,
        customerNotes: details.customerNotes
      },
      paymentMethod: details.paymentMethod,
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      subtotalCents: cartTotalCents,
      deliveryFeeCents,
      loyaltyDiscountCents: 0,
      authoritativeTotalCents,
      estimatedMinutesRemaining: orderMode === 'DINE_IN' ? 8 : orderMode === 'PICKUP' ? 15 : 30,
      createdAt,
      updatedAt: createdAt
    };

    setOrders(prev => [newOrder, ...prev]);
    setActiveOrderId(newOrder.orderId);
    setCart([]);
    showToast(`تم إرسال طلبك بنجاح! رقم الطلب: ${newOrder.orderNumber}`);

    // Post to local api server if reachable
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder)
    }).catch(() => {});

    return newOrder;
  }, [cart, cartTotalCents, orderMode, tableNumber, orders.length, showToast]);

  const updateOrderStatus = useCallback((orderId: string, status: Order['orderStatus']) => {
    setOrders(prev => prev.map(o => {
      if (o.orderId === orderId) {
        return {
          ...o,
          orderStatus: status,
          estimatedMinutesRemaining: (status === 'COMPLETED' || status === 'READY') ? 0 : 6,
          updatedAt: new Date().toISOString()
        };
      }
      return o;
    }));
  }, []);

  const orderUsual = useCallback(() => {
    const usual = user?.usualOrder || DEFAULT_USER.usualOrder;
    if (!usual || !usual.items || usual.items.length === 0) return;

    usual.items.forEach(it => {
      addToCart({
        productId: it.productId,
        productName: it.productName,
        productNameEn: it.productNameEn,
        quantity: it.quantity || 1,
        unitPriceCents: it.unitPriceCents,
        totalCents: it.totalCents,
        modifiersSummary: it.modifiersSummary || '',
        modifiers: it.modifiers || {}
      });
    });
    setOrderMode(usual.mode);
    setActiveTab('cart');
  }, [user, addToCart, setOrderMode, setActiveTab]);

  return (
    <StoreContext.Provider
      value={{
        orderMode,
        tableNumber,
        cart,
        cartCount,
        cartTotalCents,
        activeTab,
        theme,
        user,
        orders,
        activeOrder,
        toastMessage,
        searchQuery,
        setSearchQuery,
        isSearchOpen,
        setIsSearchOpen,
        toggleSearch,
        isTableModalOpen,
        isAuthModalOpen,
        isModifierModalOpen,
        selectedProductForModifier,
        isQuickCatModalOpen,
        selectedCategory,
        hasAutoOpenedCategories,
        setHasAutoOpenedCategories,
        animatingCategory,
        setAnimatingCategory,
        isHeroTitleDocked,
        setIsHeroTitleDocked,
        setOrderMode,
        setTableNumber,
        addToCart,
        updateCartItemQty,
        removeFromCart,
        clearCart,
        setActiveTab,
        toggleTheme,
        showToast,
        openModifierModal,
        closeModifierModal,
        openTableModal,
        closeTableModal,
        openAuthModal,
        closeAuthModal,
        openQuickCatModal,
        closeQuickCatModal,
        setSelectedCategory,
        loginUser,
        logoutUser,
        addSavedAddress,
        deleteSavedAddress,
        setDefaultAddress,
        submitOrder,
        updateOrderStatus,
        orderUsual
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
