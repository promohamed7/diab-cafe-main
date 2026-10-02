// Tenant = one café/business using the INBYTE Café Digital Menu platform.
//
// Everything that differs between cafés (identity, branding, contact, enabled
// journeys, payment methods, content) lives in TenantConfig, which is data —
// never React code. The menu itself is NOT part of tenant config: it always
// comes from the café's catalog integration.

/** Café PaymentMethod enum (INBYTE Café models.rs). */
export type CafePaymentMethod = 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'INSTAPAY' | 'WALLET' | 'ONLINE_PAID';

export interface TenantIdentity {
  /** Legal/business name (e.g. for metadata). */
  businessName: string;
  /** Name customers see in the header and page title. */
  displayName: string;
  /** Short line under the name (header subtitle, hero badge). */
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export interface TenantColorSet {
  /** Main brand colour (buttons, highlights). #rrggbb */
  primary: string;
  /** Darker companion used for gradients/borders. Derived from primary if absent. */
  primaryDeep?: string;
  secondary?: string;
  accent?: string;
}

export interface TenantSurfaceSet {
  background?: string;
  surface?: string;
  text?: string;
}

export interface TenantBranding {
  /** Colours for the dark theme (also used for light unless `lightColors` is set). */
  colors: TenantColorSet;
  lightColors?: TenantColorSet;
  surfaces?: { dark?: TenantSurfaceSet; light?: TenantSurfaceSet };
  defaultTheme: 'dark' | 'light';
  /** Optional font family name; it must be loaded by `fontStylesheetUrl` or already available. */
  fontFamily?: string;
  fontStylesheetUrl?: string;
}

export interface TenantSocialLink {
  label: string;
  url: string;
}

export interface TenantContact {
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  mapsUrl: string | null;
  website: string | null;
  social: TenantSocialLink[];
}

export interface TenantFeatures {
  /** Master switch. When false the site is a browse-only digital menu. */
  onlineOrdering: boolean;
  pickup: boolean;
  delivery: boolean;
  dineInQr: boolean;
}

export interface TenantOrdering {
  /**
   * Client-side UX check only. INBYTE Café does not enforce a minimum order
   * today, so this is advisory until Café supports it.
   */
  minimumOrderCents: number | null;
  /** Free-text description of the delivery area (display only, no zone logic). */
  deliveryAreaText: string | null;
}

export interface TenantCurrency {
  code: string;
  /** Symbol shown after amounts, e.g. "ج.م". */
  symbol: string;
}

export interface TenantAboutSection {
  icon: string | null;
  title: string;
  paragraphs: string[];
  items: { title: string; text: string }[];
}

export interface TenantAboutContent {
  navLabel: string;
  title: string;
  lead: string | null;
  intro: string | null;
  sections: TenantAboutSection[];
}

export interface TenantContent {
  heroBadge: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  heroImageMobileUrl: string | null;
  about: TenantAboutContent | null;
}

export interface TenantConfig {
  /** Stable identifier used to scope every request and every stored value. */
  tenantId: string;
  /** URL-friendly name (subdomain/path); may equal tenantId. */
  slug: string;
  locale: string;
  identity: TenantIdentity;
  branding: TenantBranding;
  contact: TenantContact;
  /** Human-readable opening hours. Display only; the site never claims "open now". */
  businessHoursText: string | null;
  features: TenantFeatures;
  ordering: TenantOrdering;
  /** Methods this café accepts. The site offers only those it can also handle. */
  paymentMethods: CafePaymentMethod[];
  currency: TenantCurrency;
  content: TenantContent;
}
