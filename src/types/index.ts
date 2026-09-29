export type OrderType = 'DINE_IN' | 'PICKUP' | 'DELIVERY';

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  isRoastery?: boolean;
}

export interface Product {
  id: number;
  categoryId: string;
  name: string;
  nameEn: string;
  priceCents: number;
  desc: string;
  inStock: boolean;
  tag?: string;
  isRoastery?: boolean;
  unit?: string;
}

export interface DrinkModifiers {
  size: string;
  milk: string;
  sweetness: string;
  extraShots: string;
  syrup: string;
}

export interface BeanModifiers {
  weight: string;
  grind: string;
  roast: string;
  spicing: string;
  aromatics: string[];
}

export interface CartItem {
  id: string; // unique item uuid/key
  productId: number;
  productName: string;
  productNameEn: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  modifiersSummary: string;
  modifiers: Record<string, any>;
  isRoastery?: boolean;
}

export interface SavedAddress {
  id: string;
  label: string;
  city: string;
  street: string;
  building?: string;
  isDefault: boolean;
}

export interface UsualOrder {
  title: string;
  tag: string;
  mode: OrderType;
  items: CartItem[];
  totalCents: number;
  priceDisplay: string;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  authMethod: string;
  loyaltyPoints: number;
  savedAddresses: SavedAddress[];
  usualOrder?: UsualOrder;
}

export interface Order {
  orderId: string;
  orderNumber: string;
  orderSecret?: string;
  storeCode: string;
  orderType: OrderType;
  orderChannel: string;
  tableToken?: string | null;
  tableNumber?: string | null;
  items: CartItem[];
  customerInfo: {
    fullName: string;
    phone: string;
    deliveryAddress?: string | null;
    customerNotes?: string;
  };
  paymentMethod: 'CASH' | 'VODAFONE_CASH' | 'CARD';
  paymentStatus: 'PENDING' | 'PAID';
  orderStatus: 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  subtotalCents: number;
  deliveryFeeCents: number;
  loyaltyDiscountCents: number;
  authoritativeTotalCents: number;
  rejectionReason?: string | null;
  estimatedMinutesRemaining: number;
  createdAt: string;
  updatedAt: string;
}

export type NavigationTab = 'home' | 'menu' | 'cart' | 'checkout' | 'order' | 'heritage';
