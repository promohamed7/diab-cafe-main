// DEVELOPMENT FIXTURE ONLY — second sample tenant "Harbor Roast Coffee".
//
// Exists to prove the platform is reusable: a different café with a different
// menu, modifiers, tables and (in mockTenants.ts) branding, contact details,
// enabled journeys and payment methods — with no change to React code.
// Mock IDs only; never imported by UI code.

import type { MockCatalogOverrides, WireCatalog, WireGroup, WireProduct } from './mockCatalog.ts';

const CUP_SIZE: WireGroup = {
  id: 61, name: 'حجم الكوب', isRequired: true, allowMultiple: false,
  options: [
    { id: 6101, name: 'صغير', priceDeltaCents: 0 },
    { id: 6102, name: 'وسط', priceDeltaCents: 1000 },
    { id: 6103, name: 'كبير', priceDeltaCents: 2000 }
  ]
};
const MILK: WireGroup = {
  id: 62, name: 'الحليب', isRequired: false, allowMultiple: false,
  options: [
    { id: 6201, name: 'حليب بقري', priceDeltaCents: 0 },
    { id: 6202, name: 'حليب شوفان', priceDeltaCents: 1800 },
    { id: 6203, name: 'حليب جوز الهند', priceDeltaCents: 1800 }
  ]
};
const EXTRAS: WireGroup = {
  id: 63, name: 'إضافات', isRequired: false, allowMultiple: true,
  options: [
    { id: 6301, name: 'شوت إسبريسو إضافي', priceDeltaCents: 1500 },
    { id: 6302, name: 'كريمة مخفوقة', priceDeltaCents: 1000 },
    { id: 6303, name: 'صوص شوكولاتة', priceDeltaCents: 1000 }
  ]
};
const BREW_METHOD: WireGroup = {
  id: 64, name: 'طريقة التحضير', isRequired: true, allowMultiple: false,
  options: [
    { id: 6401, name: 'V60', priceDeltaCents: 0 },
    { id: 6402, name: 'كيمكس', priceDeltaCents: 500 },
    { id: 6403, name: 'إيروبرس', priceDeltaCents: 500 }
  ]
};
const WARMING: WireGroup = {
  id: 65, name: 'التسخين', isRequired: false, allowMultiple: false,
  options: [{ id: 6501, name: 'تسخين قبل التقديم', priceDeltaCents: 0 }]
};

const CATEGORIES = [
  { id: 1, name: 'قهوة مقطرة' },
  { id: 2, name: 'مشروبات الإسبريسو' },
  { id: 3, name: 'مشروبات باردة' },
  { id: 4, name: 'مخبوزات' }
];

type RawHarborProduct = [id: number, categoryId: number, name: string, description: string, priceCents: number, groups: WireGroup[]];

const PRODUCTS: RawHarborProduct[] = [
  [5001, 1, 'كولومبيا هويلا', 'تحميص فاتح بنكهات الكراميل والتفاح الأحمر', 7500, [BREW_METHOD]],
  [5002, 1, 'إثيوبيا جوجي', 'إيحاءات توت أزرق وزهر الياسمين', 8500, [BREW_METHOD]],
  [5003, 1, 'كينيا AA', 'حموضة مشرقة ونفحات الجريب فروت', 9000, [BREW_METHOD]],
  [5101, 2, 'كورتادو المرفأ', 'دبل شوت مع حليب مبخر بنسبة متساوية', 6000, [CUP_SIZE, MILK]],
  [5102, 2, 'لاتيه بالعسل', 'إسبريسو وحليب حريري مع عسل نحل طبيعي', 7000, [CUP_SIZE, MILK, EXTRAS]],
  [5103, 2, 'موكا داكنة', 'شوكولاتة داكنة 70% مع إسبريسو', 7500, [CUP_SIZE, MILK, EXTRAS]],
  [5201, 3, 'كولد برو 18 ساعة', 'نقع بارد طويل لقوام ناعم وحلاوة طبيعية', 6500, [CUP_SIZE]],
  [5202, 3, 'إسبريسو تونك', 'شوت إسبريسو فوق ماء تونك وشريحة برتقال', 7000, [CUP_SIZE]],
  [5203, 3, 'آيس لاتيه بالفانيليا', 'فانيليا طبيعية مع حليب بارد وإسبريسو', 7000, [CUP_SIZE, MILK, EXTRAS]],
  [5301, 4, 'كرواسون زبدة', 'مخبوز يومياً بالزبدة الفرنسية', 4500, [WARMING]],
  [5302, 4, 'كوكيز الشوفان', 'شوفان وزبيب وقرفة', 3500, []],
  [5303, 4, 'بانانا بريد', 'خبز الموز مع الجوز', 5000, [WARMING]]
];

export function buildHarborCatalog(overrides: MockCatalogOverrides): WireCatalog {
  const products: WireProduct[] = PRODUCTS.map(([id, categoryId, name, description, price, groups]) => ({
    id,
    categoryId,
    name,
    description,
    imageUrl: null,
    priceCents: price + overrides.priceDriftCents,
    isActive: true,
    // The kenya filter is only sold in-store: hidden from the online menu.
    isAvailableOnline: id !== 5003,
    availability: overrides.availability[id] ?? 'AVAILABLE',
    modifierGroups: groups
  }));
  return {
    store: { name: 'Harbor Roast Coffee', phone: null, address: 'عنوان تجريبي — الكورنيش' },
    categories: CATEGORIES.map((c, i) => ({ ...c, sortOrder: i + 1, isActive: true, isAvailableOnline: true })),
    products,
    version: `harbor-${overrides.priceDriftCents}`
  };
}

/** Dev QR tokens for Harbor Roast. They mean nothing to any other tenant. */
export const HARBOR_TABLES: Record<string, string> = {
  'hr_tbl_8f2a71c4e9b3d605': 'طاولة A1 — الواجهة البحرية',
  'hr_tbl_31d9e0b7a6c4f218': 'بار القهوة — مقعد 3'
};
