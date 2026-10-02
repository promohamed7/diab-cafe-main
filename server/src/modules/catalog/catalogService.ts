// Catalog projection + digital-menu presentation.
//
//   INBYTE Café ──(connector snapshot)──▶ catalog_* tables   (operational truth: names, prices, availability, modifiers)
//   INBYTE Admin ─────────────────────▶ menu_*_presentation  (visibility, featured, order, marketing copy, image)
//
// The public catalog is the projection filtered and decorated by presentation.
// Presentation can hide or highlight an item; it can never change its price,
// make an unavailable item available, or show an item Café doesn't sell online.

import { z } from 'zod';
import type { CafeCatalog, CatalogCategory, CatalogModifierGroup, CatalogProduct } from '../../../../src/types/catalog.ts';
import type { DbClient, Queryable } from '../../db/pool.ts';
import { badRequest } from '../../http/errors.ts';
import { zHttpUrl } from '../../http/validate.ts';
import type { TenantRecord } from '../tenants/tenantService.ts';

const cafeId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const name = z.string().trim().min(1).max(120);
const money = z.number().int().min(-100_000_000).max(100_000_000);

/** What a connector may push. Unknown fields (cost prices, stock counts, barcodes…) are dropped, never stored. */
export const catalogSnapshotSchema = z.object({
  version: z.string().trim().max(100).nullable().optional(),
  categories: z
    .array(
      z.object({
        id: cafeId,
        name,
        sortOrder: z.number().int().min(-1_000_000).max(1_000_000).default(0),
        isActive: z.boolean(),
        isAvailableOnline: z.boolean()
      })
    )
    .max(500),
  modifierGroups: z
    .array(
      z.object({
        id: cafeId,
        name,
        isRequired: z.boolean(),
        allowMultiple: z.boolean(),
        options: z
          .array(z.object({ id: cafeId, name, priceDeltaCents: money, sortOrder: z.number().int().default(0) }))
          .max(100)
      })
    )
    .max(2000),
  products: z
    .array(
      z.object({
        id: cafeId,
        categoryId: cafeId,
        name,
        description: z.string().trim().max(500).nullable().optional(),
        priceCents: money.refine((v) => v >= 0),
        isActive: z.boolean(),
        isAvailableOnline: z.boolean(),
        availability: z.enum(['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN']).default('UNKNOWN'),
        modifierGroupIds: z.array(cafeId).max(30).default([])
      })
    )
    .max(5000)
});

export type CatalogSnapshot = z.infer<typeof catalogSnapshotSchema>;

/** Replaces a café's projection atomically. Referential integrity is checked before writing. */
export async function replaceCatalogSnapshot(client: DbClient, tenantUuid: string, snapshot: CatalogSnapshot, now: Date) {
  const categoryIds = new Set(snapshot.categories.map((c) => c.id));
  const groupIds = new Set(snapshot.modifierGroups.map((g) => g.id));
  const optionIds = new Set<number>();
  const issues: string[] = [];
  if (categoryIds.size !== snapshot.categories.length) issues.push('categories.id');
  if (groupIds.size !== snapshot.modifierGroups.length) issues.push('modifierGroups.id');
  for (const g of snapshot.modifierGroups) {
    for (const o of g.options) {
      if (optionIds.has(o.id)) issues.push('modifierGroups.options.id');
      optionIds.add(o.id);
    }
  }
  const productIds = new Set<number>();
  for (const p of snapshot.products) {
    if (productIds.has(p.id)) issues.push('products.id');
    productIds.add(p.id);
    if (!categoryIds.has(p.categoryId)) issues.push('products.categoryId');
    if (p.modifierGroupIds.some((g) => !groupIds.has(g))) issues.push('products.modifierGroupIds');
  }
  if (issues.length) throw badRequest('VALIDATION_FAILED', [...new Set(issues)]);

  for (const table of [
    'catalog_product_modifier_groups',
    'catalog_products',
    'catalog_modifier_options',
    'catalog_modifier_groups',
    'catalog_categories'
  ]) {
    await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantUuid]);
  }

  const c = snapshot.categories;
  await client.query(
    `INSERT INTO catalog_categories (tenant_id, cafe_category_id, name, sort_order, is_active, is_available_online)
     SELECT $1, * FROM unnest($2::bigint[], $3::text[], $4::int[], $5::bool[], $6::bool[])`,
    [tenantUuid, c.map((x) => x.id), c.map((x) => x.name), c.map((x) => x.sortOrder), c.map((x) => x.isActive), c.map((x) => x.isAvailableOnline)]
  );
  const g = snapshot.modifierGroups;
  await client.query(
    `INSERT INTO catalog_modifier_groups (tenant_id, cafe_group_id, name, is_required, allow_multiple)
     SELECT $1, * FROM unnest($2::bigint[], $3::text[], $4::bool[], $5::bool[])`,
    [tenantUuid, g.map((x) => x.id), g.map((x) => x.name), g.map((x) => x.isRequired), g.map((x) => x.allowMultiple)]
  );
  const o = g.flatMap((group) => group.options.map((opt) => ({ ...opt, groupId: group.id })));
  await client.query(
    `INSERT INTO catalog_modifier_options (tenant_id, cafe_option_id, cafe_group_id, name, price_delta_cents, sort_order)
     SELECT $1, * FROM unnest($2::bigint[], $3::bigint[], $4::text[], $5::bigint[], $6::int[])`,
    [tenantUuid, o.map((x) => x.id), o.map((x) => x.groupId), o.map((x) => x.name), o.map((x) => x.priceDeltaCents), o.map((x) => x.sortOrder)]
  );
  const p = snapshot.products;
  await client.query(
    `INSERT INTO catalog_products (tenant_id, cafe_product_id, cafe_category_id, name, description, price_cents, is_active, is_available_online, availability)
     SELECT $1, * FROM unnest($2::bigint[], $3::bigint[], $4::text[], $5::text[], $6::bigint[], $7::bool[], $8::bool[], $9::text[])`,
    [
      tenantUuid,
      p.map((x) => x.id),
      p.map((x) => x.categoryId),
      p.map((x) => x.name),
      p.map((x) => x.description ?? null),
      p.map((x) => x.priceCents),
      p.map((x) => x.isActive),
      p.map((x) => x.isAvailableOnline),
      p.map((x) => x.availability)
    ]
  );
  const links = p.flatMap((prod) => prod.modifierGroupIds.map((gid, i) => ({ pid: prod.id, gid, i })));
  const seen = new Set<string>();
  const uniqueLinks = links.filter((l) => !seen.has(`${l.pid}:${l.gid}`) && seen.add(`${l.pid}:${l.gid}`));
  await client.query(
    `INSERT INTO catalog_product_modifier_groups (tenant_id, cafe_product_id, cafe_group_id, sort_order)
     SELECT $1, * FROM unnest($2::bigint[], $3::bigint[], $4::int[])`,
    [tenantUuid, uniqueLinks.map((l) => l.pid), uniqueLinks.map((l) => l.gid), uniqueLinks.map((l) => l.i)]
  );
  await client.query(
    `INSERT INTO catalog_sync_state (tenant_id, cafe_version, synced_at, category_count, product_count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id) DO UPDATE SET cafe_version = EXCLUDED.cafe_version, synced_at = EXCLUDED.synced_at,
       category_count = EXCLUDED.category_count, product_count = EXCLUDED.product_count`,
    [tenantUuid, snapshot.version ?? null, now, c.length, p.length]
  );
  return { categories: c.length, products: p.length, modifierGroups: g.length };
}

// ---- Reading -----------------------------------------------------------------

export interface ProductPresentation {
  visible: boolean;
  featured: boolean;
  displayOrder: number | null;
  marketingDescription: string | null;
  imageUrl: string | null;
}

export interface ProjectedProduct extends CatalogProduct {
  presentation: ProductPresentation;
}

export interface ProjectedCategory extends CatalogCategory {
  presentation: { visible: boolean; displayOrder: number | null };
}

export interface CatalogProjection {
  syncedAt: string | null;
  cafeVersion: string | null;
  categories: ProjectedCategory[];
  products: ProjectedProduct[];
  /** Presentation rows whose Café item no longer exists (kept, harmless, shown in the admin). */
  orphanedPresentation: { categories: number[]; products: number[] };
}

const DEFAULT_PRESENTATION: ProductPresentation = { visible: true, featured: false, displayOrder: null, marketingDescription: null, imageUrl: null };

export async function loadProjection(db: Queryable, tenantUuid: string): Promise<CatalogProjection> {
  const [sync, cats, prods, groups, options, links, catPres, prodPres] = await Promise.all([
    db.query('SELECT cafe_version, synced_at FROM catalog_sync_state WHERE tenant_id = $1', [tenantUuid]),
    db.query('SELECT * FROM catalog_categories WHERE tenant_id = $1', [tenantUuid]),
    db.query('SELECT * FROM catalog_products WHERE tenant_id = $1', [tenantUuid]),
    db.query('SELECT * FROM catalog_modifier_groups WHERE tenant_id = $1', [tenantUuid]),
    db.query('SELECT * FROM catalog_modifier_options WHERE tenant_id = $1 ORDER BY sort_order, cafe_option_id', [tenantUuid]),
    db.query('SELECT * FROM catalog_product_modifier_groups WHERE tenant_id = $1 ORDER BY sort_order, cafe_group_id', [tenantUuid]),
    db.query('SELECT * FROM menu_category_presentation WHERE tenant_id = $1', [tenantUuid]),
    db.query('SELECT * FROM menu_product_presentation WHERE tenant_id = $1', [tenantUuid])
  ]);

  const groupById = new Map<number, CatalogModifierGroup>();
  for (const r of groups.rows) {
    groupById.set(r.cafe_group_id, { id: r.cafe_group_id, name: r.name, isRequired: r.is_required, allowMultiple: r.allow_multiple, options: [] });
  }
  for (const r of options.rows) {
    groupById.get(r.cafe_group_id)?.options.push({ id: r.cafe_option_id, name: r.name, priceDeltaCents: r.price_delta_cents });
  }
  const groupsByProduct = new Map<number, CatalogModifierGroup[]>();
  for (const r of links.rows) {
    const grp = groupById.get(r.cafe_group_id);
    if (!grp) continue;
    const list = groupsByProduct.get(r.cafe_product_id) ?? [];
    list.push(grp);
    groupsByProduct.set(r.cafe_product_id, list);
  }
  const catPresById = new Map(catPres.rows.map((r) => [r.cafe_category_id as number, r]));
  const prodPresById = new Map(prodPres.rows.map((r) => [r.cafe_product_id as number, r]));

  const categories: ProjectedCategory[] = cats.rows.map((r) => {
    const pres = catPresById.get(r.cafe_category_id);
    return {
      id: r.cafe_category_id,
      name: r.name,
      sortOrder: r.sort_order,
      isActive: r.is_active,
      isAvailableOnline: r.is_available_online,
      presentation: { visible: pres ? pres.visible : true, displayOrder: pres?.display_order ?? null }
    };
  });
  const products: ProjectedProduct[] = prods.rows.map((r) => {
    const pres = prodPresById.get(r.cafe_product_id);
    return {
      id: r.cafe_product_id,
      categoryId: r.cafe_category_id,
      name: r.name,
      description: r.description,
      imageUrl: null,
      priceCents: r.price_cents,
      isActive: r.is_active,
      isAvailableOnline: r.is_available_online,
      availability: r.availability,
      modifierGroups: groupsByProduct.get(r.cafe_product_id) ?? [],
      presentation: pres
        ? {
            visible: pres.visible,
            featured: pres.featured,
            displayOrder: pres.display_order,
            marketingDescription: pres.marketing_description,
            imageUrl: pres.image_url
          }
        : { ...DEFAULT_PRESENTATION }
    };
  });

  const catIds = new Set(categories.map((c) => c.id));
  const prodIds = new Set(products.map((p) => p.id));
  return {
    syncedAt: sync.rows[0] ? sync.rows[0].synced_at.toISOString() : null,
    cafeVersion: sync.rows[0]?.cafe_version ?? null,
    categories,
    products,
    orphanedPresentation: {
      categories: [...catPresById.keys()].filter((id) => !catIds.has(id)),
      products: [...prodPresById.keys()].filter((id) => !prodIds.has(id))
    }
  };
}

const byDisplayOrder = (a: { order: number | null; fallback: number; id: number }, b: { order: number | null; fallback: number; id: number }) =>
  (a.order ?? a.fallback) - (b.order ?? b.fallback) || a.id - b.id;

/**
 * The website's catalog: only items Café marks active + online, minus anything
 * hidden in the admin, decorated with presentation. Prices are Café's.
 */
export function toPublicCatalog(tenant: TenantRecord, projection: CatalogProjection): CafeCatalog & { tenantId: string; syncedAt: string | null } {
  const categories = projection.categories
    .filter((c) => c.isActive && c.isAvailableOnline && c.presentation.visible)
    .map((c) => ({ c, order: c.presentation.displayOrder, fallback: c.sortOrder, id: c.id }))
    .sort(byDisplayOrder)
    .map(({ c }, index) => ({ id: c.id, name: c.name, sortOrder: index, isActive: true, isAvailableOnline: true }));
  const visibleCategories = new Set(categories.map((c) => c.id));

  const products = projection.products
    .filter((p) => p.isActive && p.isAvailableOnline && p.presentation.visible && visibleCategories.has(p.categoryId))
    .map((p) => ({ p, order: p.presentation.featured ? -1_000_000 + (p.presentation.displayOrder ?? 0) : p.presentation.displayOrder, fallback: 0, id: p.id }))
    .sort(byDisplayOrder)
    .map(({ p }) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      description: p.presentation.marketingDescription ?? p.description,
      imageUrl: p.presentation.imageUrl,
      priceCents: p.priceCents,
      isActive: true,
      isAvailableOnline: true,
      availability: p.availability,
      isFeatured: p.presentation.featured,
      modifierGroups: p.modifierGroups
    }));

  return {
    tenantId: tenant.tenantId,
    store: { name: tenant.displayName, phone: (tenant.contact.phone as string | null) ?? null, address: (tenant.contact.address as string | null) ?? null },
    categories,
    products,
    version: projection.cafeVersion,
    syncedAt: projection.syncedAt
  };
}

// ---- Presentation edits ------------------------------------------------------

export const productPresentationSchema = z
  .object({
    visible: z.boolean(),
    featured: z.boolean(),
    displayOrder: z.number().int().min(-100_000).max(100_000).nullable(),
    marketingDescription: z.string().trim().max(400).nullable().transform((v) => v || null),
    imageUrl: zHttpUrl.nullable()
  })
  .strict();

export const categoryPresentationSchema = z
  .object({ visible: z.boolean(), displayOrder: z.number().int().min(-100_000).max(100_000).nullable() })
  .strict();

export async function saveProductPresentation(db: Queryable, tenantUuid: string, productId: number, v: z.infer<typeof productPresentationSchema>) {
  await db.query(
    `INSERT INTO menu_product_presentation (tenant_id, cafe_product_id, visible, featured, display_order, marketing_description, image_url, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (tenant_id, cafe_product_id) DO UPDATE SET visible = EXCLUDED.visible, featured = EXCLUDED.featured,
       display_order = EXCLUDED.display_order, marketing_description = EXCLUDED.marketing_description,
       image_url = EXCLUDED.image_url, updated_at = now()`,
    [tenantUuid, productId, v.visible, v.featured, v.displayOrder, v.marketingDescription, v.imageUrl]
  );
}

export async function saveCategoryPresentation(db: Queryable, tenantUuid: string, categoryId: number, v: z.infer<typeof categoryPresentationSchema>) {
  await db.query(
    `INSERT INTO menu_category_presentation (tenant_id, cafe_category_id, visible, display_order, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (tenant_id, cafe_category_id) DO UPDATE SET visible = EXCLUDED.visible, display_order = EXCLUDED.display_order, updated_at = now()`,
    [tenantUuid, categoryId, v.visible, v.displayOrder]
  );
}
