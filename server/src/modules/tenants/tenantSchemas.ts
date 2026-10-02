// Validation schemas for café configuration edited in the INBYTE Admin.
// Objects are strict: unknown keys (a "price" field, for instance) are rejected
// instead of being silently stored.

import { z } from 'zod';
import { zAssetUrl, zHex, zHttpUrl, zOptText, zPhone, zTenantKey, zText } from '../../http/validate.ts';

const colorSet = z
  .object({ primary: zHex, primaryDeep: zHex.optional(), secondary: zHex.optional(), accent: zHex.optional() })
  .strict();
const surfaceSet = z.object({ background: zHex.optional(), surface: zHex.optional(), text: zHex.optional() }).strict();

export const CAFE_PAYMENT_METHODS = ['CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'INSTAPAY', 'WALLET', 'ONLINE_PAID'] as const;

export const createTenantSchema = z
  .object({
    tenantId: zTenantKey,
    displayName: zText(80),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    currencySymbol: zText(12),
    locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('ar-EG'),
    primaryColor: zHex.default('#c8963e')
  })
  .strict();

export const generalSchema = z
  .object({
    displayName: zText(80),
    locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    currencySymbol: zText(12)
  })
  .strict();

export const identitySchema = z
  .object({
    businessName: zOptText(160),
    tagline: zOptText(120),
    description: zOptText(500),
    logoUrl: zAssetUrl.nullable().optional().transform((v) => v ?? null),
    faviconUrl: zAssetUrl.nullable().optional().transform((v) => v ?? null)
  })
  .strict();

export const brandingSchema = z
  .object({
    colors: colorSet,
    lightColors: colorSet.nullable().optional(),
    surfaces: z.object({ dark: surfaceSet.optional(), light: surfaceSet.optional() }).strict().optional(),
    defaultTheme: z.enum(['dark', 'light']),
    fontFamily: z.string().trim().regex(/^[\p{L}\p{N} _-]{1,60}$/u).nullable().optional(),
    fontStylesheetUrl: zHttpUrl.refine((v) => v.startsWith('https://'), 'must be https').nullable().optional()
  })
  .strict();

export const contactSchema = z
  .object({
    phone: zPhone,
    whatsapp: zPhone,
    address: zOptText(300),
    mapsUrl: zHttpUrl.nullable().optional().transform((v) => v ?? null),
    website: zHttpUrl.nullable().optional().transform((v) => v ?? null),
    social: z.array(z.object({ label: zText(40), url: zHttpUrl }).strict()).max(8).default([]),
    businessHoursText: zOptText(200)
  })
  .strict();

const aboutSchema = z
  .object({
    navLabel: zText(30),
    title: zText(160),
    lead: zOptText(160),
    intro: zOptText(2000),
    sections: z
      .array(
        z
          .object({
            icon: z.string().regex(/^[a-z0-9_]{1,40}$/).nullable().optional(),
            title: zText(160),
            paragraphs: z.array(zText(2000)).max(10).default([]),
            items: z.array(z.object({ title: zText(160), text: z.string().trim().max(600) }).strict()).max(12).default([])
          })
          .strict()
      )
      .max(10)
      .default([])
  })
  .strict();

export const websiteSchema = z
  .object({
    heroBadge: zOptText(120),
    heroTitle: zOptText(120),
    heroSubtitle: zOptText(300),
    heroImageUrl: zAssetUrl.nullable().optional().transform((v) => v ?? null),
    heroImageMobileUrl: zAssetUrl.nullable().optional().transform((v) => v ?? null),
    about: aboutSchema.nullable().optional().transform((v) => v ?? null),
    announcement: z
      .object({ text: zText(200), linkUrl: zHttpUrl.nullable().optional().transform((v) => v ?? null) })
      .strict()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    promotions: z
      .array(
        z
          .object({
            title: zText(80),
            text: zOptText(300),
            imageUrl: zAssetUrl.nullable().optional().transform((v) => v ?? null)
          })
          .strict()
      )
      .max(6)
      .default([]),
    footerText: zOptText(300)
  })
  .strict();

export const orderingSchema = z
  .object({
    onlineOrdering: z.boolean(),
    pickup: z.boolean(),
    delivery: z.boolean(),
    dineInQr: z.boolean(),
    paymentMethods: z.array(z.enum(CAFE_PAYMENT_METHODS)).max(6),
    minimumOrderCents: z.number().int().min(0).max(100_000_000).nullable(),
    deliveryAreaText: zOptText(300),
    offlineOrderPolicy: z.enum(['REJECT', 'QUEUE']),
    queueTtlMinutes: z.number().int().min(1).max(240)
  })
  .strict();

export const statusSchema = z.object({ status: z.enum(['DRAFT', 'ACTIVE', 'DISABLED']) }).strict();

export const domainSchema = z
  .object({
    host: z
      .string()
      .trim()
      .toLowerCase()
      .max(253)
      .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/),
    isPrimary: z.boolean().default(false)
  })
  .strict();

export const SECTION_SCHEMAS = {
  general: generalSchema,
  identity: identitySchema,
  branding: brandingSchema,
  contact: contactSchema,
  website: websiteSchema,
  ordering: orderingSchema
} as const;

export type SectionName = keyof typeof SECTION_SCHEMAS;
