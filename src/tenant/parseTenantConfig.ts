// Allow-list parser for tenant configuration.
//
// Tenant config is data that may come from a static file or, later, from the
// Café relay. Only known fields are copied, values are validated, and ordering
// features default to OFF unless a config explicitly enables them — a missing
// or partial config can never silently open online ordering.

import type {
  CafePaymentMethod,
  TenantAboutContent,
  TenantAboutSection,
  TenantColorSet,
  TenantConfig,
  TenantSurfaceSet
} from '../types/tenant.ts';

export class TenantConfigError extends Error {
  readonly code: 'INVALID_TENANT_CONFIG' | 'TENANT_MISMATCH';
  constructor(code: 'INVALID_TENANT_CONFIG' | 'TENANT_MISMATCH', detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'TenantConfigError';
    this.code = code;
  }
}

type Obj = Record<string, unknown>;

export const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,62}$/;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PAYMENT_METHODS: readonly CafePaymentMethod[] = ['CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'INSTAPAY', 'WALLET', 'ONLINE_PAID'];

function fail(detail: string): never {
  throw new TenantConfigError('INVALID_TENANT_CONFIG', detail);
}

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function objOrEmpty(v: unknown): Obj {
  return isObj(v) ? v : {};
}

function text(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function requiredText(v: unknown, field: string, max = 120): string {
  return text(v, max) ?? fail(`${field} is required`);
}

function color(v: unknown): string | undefined {
  return typeof v === 'string' && HEX_COLOR.test(v.trim()) ? v.trim() : undefined;
}

/** Links customers can open: http(s) only. */
function linkUrl(v: unknown): string | null {
  const s = text(v, 2000);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Images: http(s), same-origin absolute paths, or inline raster/SVG data URIs. */
export function assetUrl(v: unknown): string | null {
  const s = text(v, 200000);
  if (!s) return null;
  if (/^\/[^/]/.test(s)) return s;
  if (/^data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]/i.test(s)) return s;
  return linkUrl(s);
}

function phone(v: unknown): string | null {
  const s = text(v, 30);
  return s && /^\+?[0-9 ()-]{6,30}$/.test(s) ? s : null;
}

function bool(v: unknown): boolean {
  return v === true;
}

function colorSet(v: unknown, required: boolean): TenantColorSet | undefined {
  const o = objOrEmpty(v);
  const primary = color(o.primary);
  if (!primary) {
    if (required) fail('branding.colors.primary must be a #rrggbb colour');
    return undefined;
  }
  return { primary, primaryDeep: color(o.primaryDeep), secondary: color(o.secondary), accent: color(o.accent) };
}

function surfaceSet(v: unknown): TenantSurfaceSet | undefined {
  if (!isObj(v)) return undefined;
  const s = { background: color(v.background), surface: color(v.surface), text: color(v.text) };
  return s.background || s.surface || s.text ? s : undefined;
}

function aboutSection(v: unknown): TenantAboutSection | null {
  if (!isObj(v)) return null;
  const title = text(v.title, 160);
  if (!title) return null;
  const paragraphs = Array.isArray(v.paragraphs) ? v.paragraphs.map((p) => text(p, 2000)).filter((p): p is string => !!p) : [];
  const items = Array.isArray(v.items)
    ? v.items
        .filter(isObj)
        .map((i) => ({ title: text(i.title, 160), text: text(i.text, 600) ?? '' }))
        .filter((i): i is { title: string; text: string } => !!i.title)
    : [];
  const icon = text(v.icon, 40);
  return { icon: icon && /^[a-z0-9_]+$/.test(icon) ? icon : null, title, paragraphs, items };
}

function about(v: unknown): TenantAboutContent | null {
  if (!isObj(v)) return null;
  const title = text(v.title, 160);
  if (!title) return null;
  return {
    navLabel: text(v.navLabel, 30) ?? title.slice(0, 30),
    title,
    lead: text(v.lead, 160),
    intro: text(v.intro, 2000),
    sections: (Array.isArray(v.sections) ? v.sections : []).map(aboutSection).filter((s): s is TenantAboutSection => !!s)
  };
}

export function parseTenantConfig(raw: unknown, expectedTenantId: string): TenantConfig {
  if (!isObj(raw)) fail('config must be an object');

  const tenantId = requiredText(raw.tenantId, 'tenantId', 64);
  if (!TENANT_ID_PATTERN.test(tenantId)) fail('tenantId has an invalid format');
  // A config for another café must never be applied, even if a server mixes them up.
  if (tenantId !== expectedTenantId) throw new TenantConfigError('TENANT_MISMATCH');

  const identity = objOrEmpty(raw.identity);
  const branding = objOrEmpty(raw.branding);
  const contact = objOrEmpty(raw.contact);
  const features = objOrEmpty(raw.features);
  const ordering = objOrEmpty(raw.ordering);
  const currency = objOrEmpty(raw.currency);
  const content = objOrEmpty(raw.content);
  const surfaces = objOrEmpty(branding.surfaces);
  const minimum = ordering.minimumOrderCents;
  const fontStylesheet = linkUrl(branding.fontStylesheetUrl);

  const displayName = requiredText(identity.displayName, 'identity.displayName');

  return {
    tenantId,
    slug: text(raw.slug, 64) ?? tenantId,
    locale: text(raw.locale, 20) ?? 'ar-EG',
    identity: {
      businessName: text(identity.businessName, 160) ?? displayName,
      displayName,
      tagline: text(identity.tagline, 120),
      description: text(identity.description, 500),
      logoUrl: assetUrl(identity.logoUrl),
      faviconUrl: assetUrl(identity.faviconUrl)
    },
    branding: {
      colors: colorSet(branding.colors, true) as TenantColorSet,
      lightColors: colorSet(branding.lightColors, false),
      surfaces: { dark: surfaceSet(surfaces.dark), light: surfaceSet(surfaces.light) },
      defaultTheme: branding.defaultTheme === 'light' ? 'light' : 'dark',
      fontFamily: text(branding.fontFamily, 60)?.replace(/[^\p{L}\p{N} _-]/gu, '') || undefined,
      fontStylesheetUrl: fontStylesheet?.startsWith('https://') ? fontStylesheet : undefined
    },
    contact: {
      phone: phone(contact.phone),
      whatsapp: phone(contact.whatsapp),
      address: text(contact.address, 300),
      mapsUrl: linkUrl(contact.mapsUrl),
      website: linkUrl(contact.website),
      social: (Array.isArray(contact.social) ? contact.social : [])
        .filter(isObj)
        .map((s) => ({ label: text(s.label, 40), url: linkUrl(s.url) }))
        .filter((s): s is { label: string; url: string } => !!s.label && !!s.url)
    },
    businessHoursText: text(raw.businessHoursText, 200),
    features: {
      onlineOrdering: bool(features.onlineOrdering),
      pickup: bool(features.pickup),
      delivery: bool(features.delivery),
      dineInQr: bool(features.dineInQr)
    },
    ordering: {
      minimumOrderCents: typeof minimum === 'number' && Number.isSafeInteger(minimum) && minimum > 0 ? minimum : null,
      deliveryAreaText: text(ordering.deliveryAreaText, 300)
    },
    paymentMethods: [...new Set((Array.isArray(raw.paymentMethods) ? raw.paymentMethods : []).filter(
      (m): m is CafePaymentMethod => typeof m === 'string' && (PAYMENT_METHODS as readonly string[]).includes(m)
    ))],
    currency: {
      code: requiredText(currency.code, 'currency.code', 8),
      symbol: requiredText(currency.symbol, 'currency.symbol', 8)
    },
    content: {
      heroBadge: text(content.heroBadge, 120),
      heroTitle: text(content.heroTitle, 120),
      heroSubtitle: text(content.heroSubtitle, 300),
      heroImageUrl: assetUrl(content.heroImageUrl),
      heroImageMobileUrl: assetUrl(content.heroImageMobileUrl),
      about: about(content.about)
    }
  };
}
