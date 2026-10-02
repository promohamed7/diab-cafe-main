// DEVELOPMENT FIXTURES ONLY — the sample tenants served by the mock transport.
//
// Each entry is exactly what a real café would provide as data: a tenant
// configuration (same JSON shape as public/tenants/<id>.json or the future
// relay endpoint), a catalog, and its table QR tokens. Onboarding a real café
// means producing the same data for it — not editing React components.

import type { MockCatalogOverrides, WireCatalog } from './mockCatalog.ts';
import { buildDemoCatalog, DEMO_TABLES } from './mockCatalog.ts';
import { buildHarborCatalog, HARBOR_TABLES } from './harborRoastFixture.ts';

export interface MockTenantFixture {
  /** Tenant configuration in wire form (parsed by parseTenantConfig like any other source). */
  config: Record<string, unknown>;
  buildCatalog(overrides: MockCatalogOverrides): WireCatalog;
  tables: Record<string, string>;
}

function svgLogo(background: string, foreground: string, letters: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="16" fill="${background}"/>` +
    `<text x="32" y="41" font-family="Arial, sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="${foreground}">${letters}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DEMO_CONFIG = {
  tenantId: 'inbyte-demo',
  slug: 'inbyte-demo',
  locale: 'ar-EG',
  identity: {
    businessName: 'INBYTE Demo Café (sample tenant)',
    displayName: 'INBYTE Demo Café',
    tagline: 'مقهى تجريبي • Specialty Coffee',
    description: 'مقهى تجريبي لعرض منصة INBYTE للمنيو الرقمي والطلب أونلاين.',
    logoUrl: svgLogo('#c8963e', '#1a1209', 'ID'),
    faviconUrl: svgLogo('#c8963e', '#1a1209', 'ID')
  },
  branding: {
    colors: { primary: '#f4bd61', primaryDeep: '#c8963e', secondary: '#f0bd8b', accent: '#b4cdb0' },
    lightColors: { primary: '#b37824', primaryDeep: '#965f25', secondary: '#965f25', accent: '#5d7053' },
    defaultTheme: 'dark'
  },
  contact: {
    phone: '+20 100 000 0000',
    whatsapp: '+20 100 000 0000',
    address: 'عنوان تجريبي — شارع النموذج، مبنى 1',
    mapsUrl: null,
    website: null,
    social: [{ label: 'Instagram', url: 'https://social.example.com/inbyte-demo-cafe' }]
  },
  businessHoursText: 'يومياً من ٨ صباحاً حتى ١٢ منتصف الليل',
  features: { onlineOrdering: true, pickup: true, delivery: true, dineInQr: true },
  ordering: { minimumOrderCents: null, deliveryAreaText: 'التوصيل داخل نطاق تجريبي حول الفرع.' },
  paymentMethods: ['CASH', 'CREDIT_CARD'],
  currency: { code: 'EGP', symbol: 'ج.م' },
  content: {
    heroBadge: 'INBYTE DEMO CAFÉ • تجربة استثنائية',
    heroTitle: 'أين تود الاستمتاع بقهوتك اليوم؟',
    heroSubtitle: 'اختر وسيلتك المفضلة لتصفح المنيو وبدء طلبك',
    about: {
      navLabel: 'قصتنا',
      title: 'أصالة البن وسر التحميص اليدوي',
      lead: 'Specialty Coffee',
      intro: 'لا نقدّم مجرد فنجان قهوة؛ بل نصحبك في رحلة حسية تبدأ من جبال اليمن ومزارع إثيوبيا وحتى براميل التحميص.',
      sections: [
        {
          icon: 'history_edu',
          title: 'حكايتنا: جسر بين التراث والموجة الثالثة',
          paragraphs: [
            'بدأنا من شغف عميق بتراث القهوة الشرقية الأصيلة والتحميص المتقن، ودمجنا بين الفنجان التركي المحوج بالمستكة والزعفران والهيل وثقافة القهوة المختصة.',
            'كل دفعة حبوب تُحمّص يدوياً بعناية للوصول إلى ذروة الزيوت العطرية والنكهات الكامنة داخل الحبة.'
          ],
          items: []
        },
        {
          icon: 'public',
          title: 'محاصيل منتقاة من بلاد المنشأ',
          paragraphs: [],
          items: [
            { title: 'اليمن المطري', text: 'محصول نادر معالج بالتجفيف الطبيعي بإيحاءات فاكهية ونفحات شوكولاتة.' },
            { title: 'إثيوبيا يرجاشيف', text: 'حبوب معالجة مائياً تفيض برائحة الياسمين وزهر البرتقال.' },
            { title: 'كولومبيا سوبريمو', text: 'قوام متوازن بنكهات السكر البني المكرمل والتفاح الأحمر.' },
            { title: 'البرازيل سانتوس', text: 'قوام شوكولاتي ممتلئ وحمضية هادئة، أساس مثالي للإسبريسو.' }
          ]
        }
      ]
    }
  }
};

const HARBOR_CONFIG = {
  tenantId: 'harbor-roast',
  slug: 'harbor-roast',
  locale: 'ar-EG',
  identity: {
    businessName: 'Harbor Roast Coffee (sample tenant)',
    displayName: 'Harbor Roast',
    tagline: 'قهوة مختصة على الواجهة البحرية',
    description: 'مقهى تجريبي ثانٍ لإثبات أن المنصة قابلة لإعادة الاستخدام.',
    logoUrl: svgLogo('#2a8f94', '#ffffff', 'HR'),
    faviconUrl: svgLogo('#2a8f94', '#ffffff', 'HR')
  },
  branding: {
    colors: { primary: '#4fc3c7', primaryDeep: '#2a8f94', secondary: '#f2a65a', accent: '#9fd3c7' },
    lightColors: { primary: '#1f7a80', primaryDeep: '#155a5e', secondary: '#c46b1c', accent: '#2f6f62' },
    surfaces: {
      dark: { background: '#0e1518', surface: '#16232a', text: '#e6f1f2' },
      light: { background: '#f4fafa', surface: '#ffffff', text: '#0f2a2e' }
    },
    defaultTheme: 'light'
  },
  contact: {
    phone: '+20 100 000 0001',
    whatsapp: null,
    address: 'عنوان تجريبي — الكورنيش، رصيف 7',
    mapsUrl: 'https://maps.example.com/harbor-roast',
    website: 'https://harbor-roast.example.com',
    social: []
  },
  businessHoursText: 'من السبت إلى الخميس، ٧ صباحاً – ٧ مساءً',
  // Different journeys from the demo café: no delivery.
  features: { onlineOrdering: true, pickup: true, delivery: false, dineInQr: true },
  ordering: { minimumOrderCents: 5000, deliveryAreaText: null },
  // INSTAPAY is listed but the website cannot handle transfer references yet,
  // so only CREDIT_CARD is offered.
  paymentMethods: ['CREDIT_CARD', 'INSTAPAY'],
  currency: { code: 'EGP', symbol: 'جنيه' },
  content: {
    heroBadge: 'HARBOR ROAST • SINCE 2026',
    heroTitle: 'قهوتك المقطرة على الواجهة البحرية',
    heroSubtitle: 'اطلب مسبقاً واستلم من البار، أو امسح كود طاولتك',
    about: null
  }
};

export const MOCK_TENANTS: Record<string, MockTenantFixture> = {
  'inbyte-demo': { config: DEMO_CONFIG, buildCatalog: buildDemoCatalog, tables: DEMO_TABLES },
  'harbor-roast': { config: HARBOR_CONFIG, buildCatalog: buildHarborCatalog, tables: HARBOR_TABLES }
};

export const DEFAULT_MOCK_TENANT_ID = 'inbyte-demo';
