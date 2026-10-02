import React, { useEffect, useMemo, useRef } from 'react';
import { useUI } from '../context/UIContext';
import { useCatalog } from '../hooks/useCatalog';
import { useCart } from '../hooks/useCart';
import { isOrderable } from '../domain/catalogIndex';
import { formatMoney } from '../domain/pricing';
import { CUSTOMER_ERROR_MESSAGES } from '../integration/errors';
import type { CatalogProduct } from '../types/catalog';
import { categoryIcon } from '../components/categoryIcon';

function hasPricedOptions(p: CatalogProduct): boolean {
  return p.modifierGroups.some((g) => g.options.some((o) => o.priceDeltaCents > 0));
}

export const MenuPage: React.FC = () => {
  const {
    setActiveTab,
    openModifierModal,
    openQuickCatModal,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    animatingCategoryId
  } = useUI();
  const { status, index, source, errorCode, reload } = useCatalog();
  const { itemCount, estimatedTotalCents } = useCart();
  const chipsContainerRef = useRef<HTMLDivElement | null>(null);

  const categories = index?.categories ?? [];
  const activeCategoryId = useMemo(() => {
    if (selectedCategoryId !== null && categories.some((c) => c.id === selectedCategoryId)) return selectedCategoryId;
    return categories[0]?.id ?? null;
  }, [categories, selectedCategoryId]);

  // Automatically scroll horizontal category bar to center the active category chip
  useEffect(() => {
    if (chipsContainerRef.current && activeCategoryId !== null) {
      const activeEl = chipsContainerRef.current.querySelector<HTMLElement>(`[data-cat-id="${activeCategoryId}"]`);
      activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategoryId]);

  const filteredProducts = useMemo(() => {
    if (!index) return [];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return index.products.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
      );
    }
    return activeCategoryId === null ? [] : index.productsByCategory.get(activeCategoryId) ?? [];
  }, [index, searchQuery, activeCategoryId]);

  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  if (status === 'loading' && !index) {
    return (
      <main className="page-content">
        <div className="content-inner">
          <div className="catalog-state-card" role="status">
            <span className="material-symbols-outlined catalog-state-icon is-spinning" aria-hidden="true">progress_activity</span>
            <p>جارٍ تحميل المنيو من الكافيه...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!index) {
    return (
      <main className="page-content">
        <div className="content-inner">
          <div className="catalog-state-card" role="alert">
            <span className="material-symbols-outlined catalog-state-icon" aria-hidden="true">cloud_off</span>
            <h2>تعذر تحميل المنيو</h2>
            <p>{CUSTOMER_ERROR_MESSAGES[errorCode ?? 'UNKNOWN']}</p>
            <button type="button" className="btn-primary" onClick={() => void reload()}>
              <span>إعادة المحاولة</span>
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-content" style={{ paddingBottom: itemCount > 0 ? '7.5rem' : '5rem' }}>
      <div className="content-inner" style={{ gap: '0.85rem', paddingTop: '1.25rem' }}>
        {source === 'cache' && errorCode && (
          <div className="inline-notice is-warning" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">history</span>
            <span>تعرض نسخة محفوظة من المنيو وقد تكون الأسعار تغيرت. سيؤكد الكافيه الإجمالي عند الطلب.</span>
            <button type="button" className="inline-notice-action" onClick={() => void reload()}>تحديث</button>
          </div>
        )}

        {/* SEARCH BAR (Toggled or accessible) */}
        {(isSearchOpen || searchQuery) && (
          <div className="menu-search-anim-box" style={{ position: 'relative' }}>
            <span
              className="material-symbols-outlined"
              style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: '18px' }}
            >
              search
            </span>
            <input
              type="search"
              autoFocus={isSearchOpen}
              className="checkout-input"
              placeholder="ابحث في المنيو..."
              aria-label="ابحث في المنيو"
              value={searchQuery}
              maxLength={60}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingRight: '2.5rem',
                paddingLeft: searchQuery ? '2.5rem' : '1rem',
                height: '2.85rem',
                fontSize: '13px',
                border: '1px solid rgba(244, 189, 97, 0.4)',
                background: 'var(--surface-container-high)'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="مسح البحث"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            )}
          </div>
        )}

        {/* STICKY CATEGORIES BAR ON SCROLL */}
        <div className="sticky-categories-wrapper" id="sticky-category-bar">
          <button
            type="button"
            className="btn-categories-shimmer"
            id="btn-categories-shimmer"
            onClick={openQuickCatModal}
            title="فتح قائمة الأقسام السريعة"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>apps</span>
            <span>الأقسام</span>
          </button>

          <div
            ref={chipsContainerRef}
            className="category-chips-scroll-area"
            style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none', msOverflowStyle: 'none', flex: 1 }}
          >
            {categories.map((cat) => {
              const isSelected = activeCategoryId === cat.id;
              const isTargetAnimating = animatingCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  data-cat-id={cat.id}
                  type="button"
                  className={`cat-chip ${isSelected ? 'is-selected' : ''} ${isTargetAnimating ? 'is-docking-pulse' : ''}`}
                  style={{
                    flexShrink: 0,
                    padding: '0.45rem 0.85rem',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: isSelected ? 'var(--primary)' : 'var(--surface-container-high)',
                    color: isSelected ? '#120F0D' : 'var(--on-surface)',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s ease',
                    boxShadow: isTargetAnimating ? '0 0 16px var(--primary)' : 'none'
                  }}
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setSearchQuery('');
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{categoryIcon(cat.name)}</span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CATEGORY TITLE & PRODUCT COUNT */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--on-surface)' }}>
            {searchQuery ? `نتائج البحث عن: "${searchQuery}"` : activeCategory?.name}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{filteredProducts.length} صنف</span>
        </div>

        {/* PRODUCTS GRID */}
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', opacity: 0.5 }}>search_off</span>
            <p style={{ marginTop: '0.5rem', fontSize: '14px' }}>عذراً، لم نجد أي أصناف مطابقة.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '1rem' }}>
            {filteredProducts.map((p) => {
              const orderable = isOrderable(p);
              return (
                <div
                  key={p.id}
                  className="product-card"
                  data-product-id={p.id}
                  role="button"
                  tabIndex={orderable ? 0 : -1}
                  aria-disabled={!orderable}
                  style={{
                    background: 'var(--surface-container)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '18px',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-tier1)',
                    transition: 'all 0.2s ease',
                    cursor: orderable ? 'pointer' : 'default',
                    opacity: orderable ? 1 : 0.65
                  }}
                  onClick={() => orderable && openModifierModal(p.id)}
                  onKeyDown={(e) => {
                    if (orderable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openModifierModal(p.id);
                    }
                  }}
                >
                  <div>
                    {p.imageUrl && (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="product-card-image"
                      />
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <h3 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--on-surface)', lineHeight: 1.3 }}>{p.name}</h3>
                      {!orderable && <span className="product-unavailable-tag">غير متاح حالياً</span>}
                    </div>
                    {p.description && (
                      <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginTop: '0.35rem' }}>{p.description}</p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', display: 'block' }}>
                        {hasPricedOptions(p) ? 'يبدأ من' : 'السعر'}
                      </span>
                      <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--primary)' }}>{formatMoney(p.priceCents)}</span>
                    </div>

                    <button
                      type="button"
                      className="product-add-btn"
                      disabled={!orderable}
                      style={{
                        background: 'rgba(200, 150, 62, 0.18)',
                        color: 'var(--primary)',
                        border: '1px solid rgba(200, 150, 62, 0.35)',
                        borderRadius: '9999px',
                        padding: '0.45rem 0.85rem',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (orderable) openModifierModal(p.id);
                      }}
                    >
                      <span>{p.modifierGroups.length > 0 ? 'تخصيص وإضافة' : 'إضافة'}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FLOATING CART SUMMARY PILL */}
        {itemCount > 0 && (
          <div
            className="floating-cart-pill"
            role="button"
            tabIndex={0}
            style={{
              position: 'fixed',
              bottom: '5.25rem',
              left: '1rem',
              right: '1rem',
              zIndex: 40,
              maxWidth: '480px',
              margin: '0 auto',
              background: 'linear-gradient(135deg, #2A221C 0%, #171311 100%)',
              border: '1.5px solid var(--primary)',
              borderRadius: '9999px',
              padding: '0.65rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(244, 189, 97, 0.25)',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('cart')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('cart')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: 'var(--primary)', color: '#120F0D', width: '28px', height: '28px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '13px' }}>
                {itemCount}
              </div>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#F4EDE4' }}>سلة الطلب الحالية</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--primary)' }}>{formatMoney(estimatedTotalCents)}</span>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>arrow_back</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
