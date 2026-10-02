import React, { useMemo, useState } from 'react';
import { api, centsToAmount, formatDateTime } from '../api';
import { Card, ErrorNote, useLoad, useSave } from '../ui';
import type { TabProps } from './types';

interface Presentation {
  visible: boolean;
  featured: boolean;
  displayOrder: number | null;
  marketingDescription: string | null;
  imageUrl: string | null;
}
interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  priceCents: number;
  isActive: boolean;
  isAvailableOnline: boolean;
  availability: string;
  modifierGroups: { id: number; name: string }[];
  presentation: Presentation;
}
interface Category {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  isAvailableOnline: boolean;
  presentation: { visible: boolean; displayOrder: number | null };
}
interface Menu {
  syncedAt: string | null;
  cafeVersion: string | null;
  categories: Category[];
  products: Product[];
  orphanedPresentation: { categories: number[]; products: number[] };
  publicProductCount: number;
  currencySymbol: string;
}

/** What INBYTE Café says about the item — the admin cannot override this. */
function cafeState(p: { isActive: boolean; isAvailableOnline: boolean; availability?: string }): string | null {
  if (!p.isActive) return 'Inactive in Café';
  if (!p.isAvailableOnline) return 'Not sold online (Café)';
  if (p.availability === 'UNAVAILABLE') return 'Out of stock (Café)';
  return null;
}

const ProductRow: React.FC<{ tenantId: string; product: Product; symbol: string; onSaved: () => void }> = ({ tenantId, product, symbol, onSaved }) => {
  const [p, setP] = useState({
    visible: product.presentation.visible,
    featured: product.presentation.featured,
    displayOrder: product.presentation.displayOrder === null ? '' : String(product.presentation.displayOrder),
    marketingDescription: product.presentation.marketingDescription ?? '',
    imageUrl: product.presentation.imageUrl ?? ''
  });
  const save = useSave();
  const blocked = cafeState(product);
  return (
    <tr data-product={product.id} className={blocked ? 'is-blocked' : ''}>
      <td>
        <strong>{product.name}</strong>
        <div className="muted mono">#{product.id}</div>
        {blocked && <span className="badge badge-bad">{blocked}</span>}
      </td>
      <td className="mono" title="Price set in INBYTE Café — read only">
        {centsToAmount(product.priceCents)} {symbol}
      </td>
      <td>
        <input type="checkbox" aria-label="Show on website" name="visible" checked={p.visible} onChange={(e) => setP({ ...p, visible: e.target.checked })} />
      </td>
      <td>
        <input type="checkbox" aria-label="Featured" name="featured" checked={p.featured} onChange={(e) => setP({ ...p, featured: e.target.checked })} />
      </td>
      <td>
        <input className="input-narrow" type="number" aria-label="Display order" value={p.displayOrder} onChange={(e) => setP({ ...p, displayOrder: e.target.value })} />
      </td>
      <td>
        <input
          type="text"
          aria-label="Marketing description"
          name="marketingDescription"
          placeholder={product.description ?? 'Café description'}
          value={p.marketingDescription}
          onChange={(e) => setP({ ...p, marketingDescription: e.target.value })}
        />
        <input type="url" aria-label="Image URL" placeholder="Image URL (https://…)" value={p.imageUrl} onChange={(e) => setP({ ...p, imageUrl: e.target.value })} />
      </td>
      <td>
        <button
          type="button"
          className="btn btn-small btn-primary"
          disabled={save.state.status === 'saving'}
          onClick={() =>
            save
              .run(() =>
                api('PUT', `/tenants/${tenantId}/menu/products/${product.id}`, {
                  visible: p.visible,
                  featured: p.featured,
                  displayOrder: p.displayOrder.trim() === '' ? null : Number(p.displayOrder),
                  marketingDescription: p.marketingDescription.trim() || null,
                  imageUrl: p.imageUrl.trim() || null
                })
              )
              .then((ok) => ok && onSaved())
          }
        >
          Save
        </button>
        {save.state.status === 'saved' && <span className="save-ok">✓</span>}
        {save.state.status === 'error' && <span className="save-error">{save.state.message}</span>}
      </td>
    </tr>
  );
};

const CategoryHeader: React.FC<{ tenantId: string; category: Category; count: number; onSaved: () => void }> = ({ tenantId, category, count, onSaved }) => {
  const [visible, setVisible] = useState(category.presentation.visible);
  const [order, setOrder] = useState(category.presentation.displayOrder === null ? '' : String(category.presentation.displayOrder));
  const save = useSave();
  const blocked = cafeState(category);
  return (
    <div className="category-head" data-category={category.id}>
      <h3>
        {category.name} <span className="muted">({count})</span> {blocked && <span className="badge badge-bad">{blocked}</span>}
      </h3>
      <label className="inline">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Show on website
      </label>
      <label className="inline">
        Order <input className="input-narrow" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
      </label>
      <button
        type="button"
        className="btn btn-small btn-ghost"
        onClick={() =>
          save
            .run(() => api('PUT', `/tenants/${tenantId}/menu/categories/${category.id}`, { visible, displayOrder: order.trim() === '' ? null : Number(order) }))
            .then((ok) => ok && onSaved())
        }
      >
        Save
      </button>
      {save.state.status === 'error' && <span className="save-error">{save.state.message}</span>}
    </div>
  );
};

export const MenuTab: React.FC<TabProps> = ({ tenant }) => {
  const { data, error, reload } = useLoad(() => api<Menu>('GET', `/tenants/${tenant.tenantId}/menu`), [tenant.tenantId]);
  const [query, setQuery] = useState('');
  const byCategory = useMemo(() => {
    const map = new Map<number, Product[]>();
    for (const p of data?.products ?? []) {
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) continue;
      map.set(p.categoryId, [...(map.get(p.categoryId) ?? []), p]);
    }
    return map;
  }, [data, query]);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div className="tab-body">
      <Card title="Menu source">
        {data.syncedAt ? (
          <p id="menu-sync-state">
            Synced from INBYTE Café {formatDateTime(data.syncedAt)} {data.cafeVersion && <span className="muted mono">(version {data.cafeVersion})</span>} —{' '}
            <strong>{data.products.length}</strong> Café products, <strong id="menu-public-count">{data.publicProductCount}</strong> on the website.
          </p>
        ) : (
          <p className="save-error" id="menu-sync-state">
            No menu yet. Connect this café’s INBYTE Café (Integration tab); its catalog syncs automatically.
          </p>
        )}
        <p className="muted">
          Names, prices, modifiers and availability come from INBYTE Café and can only be changed there. Here you control the website presentation: visibility,
          featured items, display order, marketing text and images. Café always wins — an item Café doesn’t sell online is never shown.
        </p>
      </Card>
      {data.categories.length > 0 && (
        <Card>
          <input type="search" placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
          {[...data.categories]
            .sort((a, b) => (a.presentation.displayOrder ?? a.sortOrder) - (b.presentation.displayOrder ?? b.sortOrder))
            .map((cat) => (
              <div key={cat.id} className="menu-category">
                <CategoryHeader tenantId={tenant.tenantId} category={cat} count={byCategory.get(cat.id)?.length ?? 0} onSaved={reload} />
                {(byCategory.get(cat.id)?.length ?? 0) > 0 && (
                  <table className="table table-compact">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Café price</th>
                        <th>Shown</th>
                        <th>Featured</th>
                        <th>Order</th>
                        <th>Website text / image</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory.get(cat.id)!.map((p) => (
                        <ProductRow key={p.id} tenantId={tenant.tenantId} product={p} symbol={data.currencySymbol} onSaved={reload} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
        </Card>
      )}
    </div>
  );
};
