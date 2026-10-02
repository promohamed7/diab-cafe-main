// DEVELOPMENT ONLY. Builds a Café-shaped catalog projection (wire format) from
// the prototype's menu content so the website can be developed before the Café
// adapter exists. IDs here are mock integers, not real Café IDs.
//
// Bean weights are modelled as additive per-product options because Café prices
// lines as base + Σ option deltas. How Café will really model weight-based
// products is an open Café catalog decision.

import { RAW_CATEGORIES, RAW_PRODUCTS } from './fixtureMenu.ts';

export interface WireOption { id: number; name: string; priceDeltaCents: number }
export interface WireGroup { id: number; name: string; isRequired: boolean; allowMultiple: boolean; options: WireOption[] }
export interface WireCategory { id: number; name: string; sortOrder: number; isActive: boolean; isAvailableOnline: boolean }
export interface WireProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  isActive: boolean;
  isAvailableOnline: boolean;
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
  modifierGroups: WireGroup[];
}
export interface WireCatalog {
  store: { name: string; phone: string | null; address: string | null };
  categories: WireCategory[];
  products: WireProduct[];
  version: string;
}

const SIZE: WireGroup = {
  id: 11, name: 'الحجم', isRequired: true, allowMultiple: false,
  options: [
    { id: 1101, name: 'سينجل / عادي', priceDeltaCents: 0 },
    { id: 1102, name: 'دبل / كبير', priceDeltaCents: 1500 }
  ]
};
const MILK: WireGroup = {
  id: 12, name: 'نوع الحليب', isRequired: false, allowMultiple: false,
  options: [
    { id: 1201, name: 'حليب كامل الدسم', priceDeltaCents: 0 },
    { id: 1202, name: 'حليب خالي الدسم', priceDeltaCents: 0 },
    { id: 1203, name: 'حليب شوفان', priceDeltaCents: 1500 },
    { id: 1204, name: 'حليب لوز', priceDeltaCents: 1500 }
  ]
};
const SUGAR: WireGroup = {
  id: 13, name: 'درجة السكر', isRequired: true, allowMultiple: false,
  options: [
    { id: 1301, name: 'بدون سكر', priceDeltaCents: 0 },
    { id: 1302, name: 'سكر خفيف', priceDeltaCents: 0 },
    { id: 1303, name: 'سكر مظبوط', priceDeltaCents: 0 },
    { id: 1304, name: 'سكر زيادة', priceDeltaCents: 0 }
  ]
};
const EXTRA_SHOT: WireGroup = {
  id: 14, name: 'شوت إسبريسو إضافي', isRequired: false, allowMultiple: false,
  options: [{ id: 1401, name: 'شوت إضافي', priceDeltaCents: 2000 }]
};
const SYRUPS: WireGroup = {
  id: 15, name: 'سيرب النكهة', isRequired: false, allowMultiple: true,
  options: [
    { id: 1501, name: 'فانيليا', priceDeltaCents: 1500 },
    { id: 1502, name: 'كراميل', priceDeltaCents: 1500 },
    { id: 1503, name: 'بندق', priceDeltaCents: 1500 },
    { id: 1504, name: 'لوتس', priceDeltaCents: 2000 },
    { id: 1505, name: 'بستاشيو', priceDeltaCents: 2500 }
  ]
};
const GRIND: WireGroup = {
  id: 16, name: 'درجة الطحن', isRequired: true, allowMultiple: false,
  options: [
    { id: 1601, name: 'حبوب كاملة بدون طحن', priceDeltaCents: 0 },
    { id: 1602, name: 'طحن تركي ناعم', priceDeltaCents: 0 },
    { id: 1603, name: 'طحن إسبريسو', priceDeltaCents: 0 },
    { id: 1604, name: 'طحن خشن (فلتر / فرنش برس)', priceDeltaCents: 0 }
  ]
};
const ROAST: WireGroup = {
  id: 17, name: 'درجة التحميص', isRequired: true, allowMultiple: false,
  options: [
    { id: 1701, name: 'فاتح', priceDeltaCents: 0 },
    { id: 1702, name: 'وسط', priceDeltaCents: 0 },
    { id: 1703, name: 'غامق', priceDeltaCents: 0 }
  ]
};
const SPICING: WireGroup = {
  id: 18, name: 'التحويجة', isRequired: false, allowMultiple: false,
  options: [{ id: 1801, name: 'تحويجة دياب (هيل ومستكة)', priceDeltaCents: 1000 }]
};
const AROMATICS: WireGroup = {
  id: 19, name: 'إضافات شرقية', isRequired: false, allowMultiple: true,
  options: [
    { id: 1901, name: 'مستكة', priceDeltaCents: 1500 },
    { id: 1902, name: 'زعفران', priceDeltaCents: 2500 },
    { id: 1903, name: 'هيل مضاعف', priceDeltaCents: 1500 },
    { id: 1904, name: 'جنزبيل', priceDeltaCents: 1000 }
  ]
};

function weightGroup(productId: number, basePrice: number): WireGroup {
  const groupId = 100000 + productId;
  return {
    id: groupId, name: 'الوزن', isRequired: true, allowMultiple: false,
    options: [
      { id: groupId * 10 + 1, name: '125 جم', priceDeltaCents: 0 },
      { id: groupId * 10 + 2, name: '250 جم', priceDeltaCents: basePrice },
      { id: groupId * 10 + 3, name: '500 جم', priceDeltaCents: basePrice * 3 },
      { id: groupId * 10 + 4, name: '1 كجم', priceDeltaCents: basePrice * 7 }
    ]
  };
}

const GROUPS_BY_CATEGORY: Record<string, WireGroup[]> = {
  espresso: [SIZE, MILK, SUGAR, EXTRA_SHOT, SYRUPS],
  'iced-espresso': [SIZE, MILK, SUGAR, EXTRA_SHOT, SYRUPS],
  frappe: [SIZE, MILK, SUGAR, SYRUPS],
  turkish: [SIZE, SUGAR],
  french: [SIZE, SUGAR, SYRUPS],
  'hot-drinks': [SIZE, SUGAR],
  milkshake: [SIZE],
  smoothie: [SIZE],
  'fresh-juice': [SIZE, SUGAR],
  'iced-tea': [SIZE],
  mojito: [SIZE]
};

const BEAN_CATEGORIES = new Set(['beans-turkish', 'beans-single', 'beans-espresso', 'beans-french', 'beans-arabic']);
const SPICED_BEAN_CATEGORIES = new Set(['beans-turkish', 'beans-arabic']);

/** Standalone add-ons that the mock marks as not sold online, to exercise the online filter. */
const NOT_ONLINE_PRODUCT_IDS = new Set([1301, 1302]);

function groupsFor(categorySlug: string, productId: number, basePrice: number): WireGroup[] {
  if (BEAN_CATEGORIES.has(categorySlug)) {
    const groups = [weightGroup(productId, basePrice), GRIND, ROAST];
    if (SPICED_BEAN_CATEGORIES.has(categorySlug)) groups.push(SPICING, AROMATICS);
    return groups;
  }
  return GROUPS_BY_CATEGORY[categorySlug] ?? [];
}

export interface MockCatalogOverrides {
  /** Added to every base price, to simulate Café changing its menu prices. */
  priceDriftCents: number;
  availability: Record<number, 'AVAILABLE' | 'UNAVAILABLE'>;
}

export function buildMockCatalog(overrides: MockCatalogOverrides): WireCatalog {
  const categoryIds = new Map<string, number>();
  const categories: WireCategory[] = RAW_CATEGORIES.map((c, i) => {
    categoryIds.set(c.id, i + 1);
    return { id: i + 1, name: c.name, sortOrder: i + 1, isActive: true, isAvailableOnline: true };
  });

  const products: WireProduct[] = RAW_PRODUCTS.map((p) => {
    const price = p.priceCents + overrides.priceDriftCents;
    const override = overrides.availability[p.id];
    return {
      id: p.id,
      categoryId: categoryIds.get(p.categoryId) ?? 0,
      name: p.name,
      description: p.desc || null,
      imageUrl: null,
      priceCents: price,
      isActive: true,
      isAvailableOnline: !NOT_ONLINE_PRODUCT_IDS.has(p.id),
      availability: override ?? (p.inStock ? 'AVAILABLE' : 'UNAVAILABLE'),
      modifierGroups: groupsFor(p.categoryId, p.id, price)
    };
  });

  return {
    store: { name: 'دياب كافيه — فرع سيدي سالم', phone: null, address: 'سيدي سالم، كفر الشيخ' },
    categories,
    products,
    version: `mock-${overrides.priceDriftCents}`
  };
}

/** Dev QR tokens. Real tokens are issued by Café; these only exist in the mock. */
export const MOCK_TABLES: Record<string, string> = {
  'qr_7c1e4b9a2f6d4e08': 'طاولة 1 — الصالة الرئيسية',
  'qr_a93f02d6c8b14e7f': 'طاولة 2 — ركن العائلات',
  'qr_5e8b71c0d4a2493b': 'طاولة 3 — بجوار النافذة',
  'qr_d20c6f9e1b7a4c55': 'طاولة 4 — ركن الباريستا',
  'qr_0b4e8a7d3c9f4161': 'التراس — طاولة 1'
};
