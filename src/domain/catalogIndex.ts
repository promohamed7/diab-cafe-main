import type {
  CafeCatalog,
  CafeId,
  CatalogCategory,
  CatalogModifierGroup,
  CatalogModifierOption,
  CatalogProduct
} from '../types/catalog.ts';

export interface OptionRef {
  option: CatalogModifierOption;
  group: CatalogModifierGroup;
}

export interface CatalogIndex {
  catalog: CafeCatalog;
  /** Visible categories (active + online, with at least one visible product), sorted. */
  categories: CatalogCategory[];
  /** Visible products only. */
  products: CatalogProduct[];
  productsById: Map<CafeId, CatalogProduct>;
  productsByCategory: Map<CafeId, CatalogProduct[]>;
}

/**
 * Café should publish only active, online products. The website filters again
 * anyway so a misconfigured projection never shows hidden items.
 */
export function buildCatalogIndex(catalog: CafeCatalog): CatalogIndex {
  const visibleCategoryIds = new Set(
    catalog.categories.filter((c) => c.isActive && c.isAvailableOnline).map((c) => c.id)
  );

  const products = catalog.products.filter(
    (p) => p.isActive && p.isAvailableOnline && visibleCategoryIds.has(p.categoryId)
  );

  const productsById = new Map<CafeId, CatalogProduct>();
  const productsByCategory = new Map<CafeId, CatalogProduct[]>();
  for (const p of products) {
    productsById.set(p.id, p);
    const list = productsByCategory.get(p.categoryId) ?? [];
    list.push(p);
    productsByCategory.set(p.categoryId, list);
  }

  const categories = catalog.categories
    .filter((c) => visibleCategoryIds.has(c.id) && productsByCategory.has(c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  return { catalog, categories, products, productsById, productsByCategory };
}

export function findOption(product: CatalogProduct, optionId: CafeId): OptionRef | null {
  for (const group of product.modifierGroups) {
    const option = group.options.find((o) => o.id === optionId);
    if (option) return { option, group };
  }
  return null;
}

export function isOrderable(product: CatalogProduct): boolean {
  return product.availability !== 'UNAVAILABLE';
}
