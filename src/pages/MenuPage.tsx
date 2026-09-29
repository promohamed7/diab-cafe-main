import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { CATEGORIES, PRODUCTS, formatEGP } from '../data/menuData';

export const MenuPage: React.FC = () => {
  const {
    setActiveTab,
    openModifierModal,
    openQuickCatModal,
    selectedCategory,
    setSelectedCategory,
    cartCount,
    cartTotalCents,
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    animatingCategory
  } = useStore();

  const [sectionMode, setSectionMode] = useState<'drinks' | 'roastery'>('drinks');
  const chipsContainerRef = useRef<HTMLDivElement | null>(null);

  // Filter categories by section mode
  const currentCategories = useMemo(() => {
    return CATEGORIES.filter((c) => (sectionMode === 'roastery' ? !!c.isRoastery : !c.isRoastery));
  }, [sectionMode]);

  // Ensure selected category is in the current section
  const activeCategory = useMemo(() => {
    const found = currentCategories.find((c) => c.id === selectedCategory);
    return found ? found.id : (currentCategories[0]?.id || 'espresso');
  }, [currentCategories, selectedCategory]);

  // Automatically scroll horizontal category bar to center the active category chip
  useEffect(() => {
    if (chipsContainerRef.current) {
      const activeEl = chipsContainerRef.current.querySelector<HTMLElement>(`[data-cat-id="${activeCategory}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeCategory]);

  // Filter products by search or active category
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return PRODUCTS.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.desc.toLowerCase().includes(q)
      );
    }
    return PRODUCTS.filter((p) => p.categoryId === activeCategory);
  }, [searchQuery, activeCategory]);

  const activeCategoryObj = useMemo(() => {
    return CATEGORIES.find((c) => c.id === activeCategory);
  }, [activeCategory]);

  return (
    <main className="page-content" style={{ paddingBottom: cartCount > 0 ? '7.5rem' : '5rem' }}>
      <div className="content-inner" style={{ gap: '0.85rem', paddingTop: '1.25rem' }}>

        {/* SEARCH BAR (Toggled or accessible) */}
        {(isSearchOpen || searchQuery) && (
          <div className="menu-search-anim-box" style={{ position: 'relative' }}>
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute',
                right: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--primary)',
                fontSize: '18px'
              }}
            >
              search
            </span>
            <input
              type="text"
              autoFocus={isSearchOpen}
              className="checkout-input"
              placeholder="ابحث في قائمة المشروبات وحبوب البن..."
              value={searchQuery}
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
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--on-surface-variant)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            )}
          </div>
        )}

        {/* SECTION TOGGLE: Drinks vs Roastery */}
        <div
          style={{
            display: 'flex',
            background: 'var(--surface-container-high)',
            padding: '0.25rem',
            borderRadius: '9999px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 700,
              background: sectionMode === 'drinks' ? 'var(--primary)' : 'transparent',
              color: sectionMode === 'drinks' ? '#120F0D' : 'var(--on-surface-variant)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem'
            }}
            onClick={() => {
              setSectionMode('drinks');
              setSelectedCategory('espresso');
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>local_cafe</span>
            <span>المشروبات والحلويات</span>
          </button>

          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 700,
              background: sectionMode === 'roastery' ? 'var(--primary)' : 'transparent',
              color: sectionMode === 'roastery' ? '#120F0D' : 'var(--on-surface-variant)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem'
            }}
            onClick={() => {
              setSectionMode('roastery');
              setSelectedCategory('beans-turkish');
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>grain</span>
            <span>محمصة حبوب البن</span>
          </button>
        </div>

        {/* STICKY CATEGORIES BAR ON SCROLL */}
        <div className="sticky-categories-wrapper" id="sticky-category-bar">
          {/* Shimmering "الأقسام" Button to Catch Customer Eye */}
          <button
            type="button"
            className="btn-categories-shimmer"
            id="btn-categories-shimmer"
            onClick={openQuickCatModal}
            title="فتح قائمة الأقسام السريعة"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
              apps
            </span>
            <span>الأقسام</span>
          </button>

          {/* Horizontal Scrolling Category Chips */}
          <div
            ref={chipsContainerRef}
            className="category-chips-scroll-area"
            style={{
              display: 'flex',
              gap: '0.45rem',
              overflowX: 'auto',
              paddingBottom: '2px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              flex: 1
            }}
          >
            {currentCategories.map((cat) => {
              const isSelected = activeCategory === cat.id;
              const isTargetAnimating = animatingCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  data-cat-id={cat.id}
                  type="button"
                  className={`cat-chip ${isSelected ? 'is-selected' : ''} ${
                    isTargetAnimating ? 'is-docking-pulse' : ''
                  }`}
                  style={{
                    flexShrink: 0,
                    padding: '0.45rem 0.85rem',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: isSelected ? 'var(--primary)' : 'var(--surface-container-high)',
                    color: isSelected ? '#120F0D' : 'var(--on-surface)',
                    border: isSelected
                      ? '1px solid var(--primary)'
                      : '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s ease',
                    boxShadow: isTargetAnimating ? '0 0 16px var(--primary)' : 'none'
                  }}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSearchQuery('');
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CATEGORY TITLE & PRODUCT COUNT */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--on-surface)' }}>
            {searchQuery ? `نتائج البحث عن: "${searchQuery}"` : activeCategoryObj?.name}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
            {filteredProducts.length} صنف متاح
          </span>
        </div>

        {/* PRODUCTS GRID */}
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', opacity: 0.5 }}>
              search_off
            </span>
            <p style={{ marginTop: '0.5rem', fontSize: '14px' }}>عذراً، لم نجد أي أصناف مطابقة للبحث.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem'
            }}
          >
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className="product-card"
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
                  cursor: p.inStock ? 'pointer' : 'default',
                  opacity: p.inStock ? 1 : 0.65
                }}
                onClick={() => {
                  if (p.inStock) openModifierModal(p);
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <div>
                      <h3 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--on-surface)', lineHeight: 1.3 }}>
                        {p.name}
                      </h3>
                      <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', display: 'block', marginTop: '2px' }}>
                        {p.nameEn}
                      </span>
                    </div>
                    {p.tag && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: 'rgba(200, 150, 62, 0.18)',
                          color: 'var(--primary)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          flexShrink: 0
                        }}
                      >
                        {p.tag}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginTop: '0.35rem' }}>
                    {p.desc}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '1rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', display: 'block' }}>السعر</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--primary)' }}>
                      {formatEGP(p.priceCents)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="product-add-btn"
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
                      if (p.inStock) openModifierModal(p);
                    }}
                  >
                    <span>تخصيص وإضافة</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FLOATING CART SUMMARY PILL */}
        {cartCount > 0 && (
          <div
            className="floating-cart-pill"
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
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  background: 'var(--primary)',
                  color: '#120F0D',
                  width: '28px',
                  height: '28px',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '13px'
                }}
              >
                {cartCount}
              </div>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--on-surface)' }}>
                سلة الطلب الحالية
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--primary)' }}>
                {formatEGP(cartTotalCents)}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>
                arrow_back
              </span>
            </div>
          </div>
        )}

      </div>
    </main>
  );
};
