import { z } from 'zod';
import { badRequest } from './errors.ts';

/** Parses with a zod schema; failures become VALIDATION_FAILED with field paths only. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((i) => i.path.join('.') || '(root)'))].slice(0, 20);
    throw badRequest('VALIDATION_FAILED', fields);
  }
  return result.data;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export const zHex = z.string().regex(HEX);
export const zHttpUrl = z
  .string()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'must be an http(s) URL');
/** Asset URLs may also be site-relative paths or small inline images. */
export const zAssetUrl = z
  .string()
  .max(200_000)
  .refine((v) => v.startsWith('/') && !v.startsWith('//') ? true : v.startsWith('data:image/') ? true : zHttpUrl.safeParse(v).success, 'unsupported asset URL');
export const zText = (max: number) => z.string().trim().min(1).max(max);
export const zOptText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
export const zPhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,24}$/)
  .nullable()
  .optional()
  .transform((v) => v ?? null);
export const zTenantKey = z.string().regex(/^[a-z0-9][a-z0-9_-]{1,62}$/);
