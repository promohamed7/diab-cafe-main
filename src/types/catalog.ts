// Customer-facing catalog projection published by INBYTE Café.
//
// Every ID here is a Café integer ID. The website never invents IDs and never
// treats prices as authoritative: they are display previews only. Café re-prices
// every order on its side.

export type CafeId = number;

/**
 * Availability is a hint for display. Café decides real availability when staff
 * accept an order, so an AVAILABLE product can still be rejected later.
 */
export type AvailabilityHint = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';

export interface CatalogStore {
  name: string;
  phone: string | null;
  address: string | null;
}

export interface CatalogModifierOption {
  id: CafeId;
  name: string;
  /** Price delta in minor units (piastres). Display only. */
  priceDeltaCents: number;
}

export interface CatalogModifierGroup {
  id: CafeId;
  name: string;
  isRequired: boolean;
  allowMultiple: boolean;
  options: CatalogModifierOption[];
}

export interface CatalogCategory {
  id: CafeId;
  name: string;
  sortOrder: number;
  isActive: boolean;
  isAvailableOnline: boolean;
}

export interface CatalogProduct {
  id: CafeId;
  categoryId: CafeId;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** Base selling price in minor units. Display only. */
  priceCents: number;
  isActive: boolean;
  isAvailableOnline: boolean;
  availability: AvailabilityHint;
  modifierGroups: CatalogModifierGroup[];
}

export interface CafeCatalog {
  store: CatalogStore;
  categories: CatalogCategory[];
  products: CatalogProduct[];
  /** Optional version/etag supplied by Café for cache invalidation. */
  version: string | null;
}
