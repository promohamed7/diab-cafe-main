import React, { useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { CATEGORIES, PRODUCTS } from '../data/menuData';

interface TravelerState {
  catId: string;
  name: string;
  icon: string;
  startCenterX: number;
  startCenterY: number;
  currentX: number;
  currentY: number;
  progress: number;
}

export const QuickCategoriesModal: React.FC = () => {
  const {
    isQuickCatModalOpen,
    closeQuickCatModal,
    setSelectedCategory,
    setActiveTab,
    setAnimatingCategory
  } = useStore();

  const [traveler, setTraveler] = useState<TravelerState | null>(null);
  const travelerElRef = useRef<HTMLDivElement | null>(null);

  if (!isQuickCatModalOpen && !traveler) return null;

  // Helper to query the live position of the target category chip (or category bar center)
  const getLiveTargetCoords = (catId: string): { x: number; y: number } => {
    const targetChip = document.querySelector(`[data-cat-id="${catId}"]`) as HTMLElement;
    const stickyBar = document.getElementById('sticky-category-bar') as HTMLElement;
    const shimmerBtn = document.getElementById('btn-categories-shimmer') as HTMLElement;

    if (targetChip) {
      const chipRect = targetChip.getBoundingClientRect();
      if (chipRect.width > 0 && chipRect.top > 0) {
        return {
          x: chipRect.left + chipRect.width / 2,
          y: chipRect.top + chipRect.height / 2
        };
      }
    }

    if (stickyBar) {
      const barRect = stickyBar.getBoundingClientRect();
      if (barRect.width > 0) {
        return {
          x: barRect.left + barRect.width / 2,
          y: barRect.top + barRect.height / 2
        };
      }
    }

    if (shimmerBtn) {
      const shimmerRect = shimmerBtn.getBoundingClientRect();
      if (shimmerRect.width > 0) {
        return {
          x: shimmerRect.left + shimmerRect.width / 2,
          y: shimmerRect.top + shimmerRect.height / 2
        };
      }
    }

    return {
      x: window.innerWidth / 2,
      y: 110
    };
  };

  const handleSelectCategory = (cat: typeof CATEGORIES[0], e: React.MouseEvent<HTMLButtonElement>) => {
    const cardEl = e.currentTarget;
    const cardRect = cardEl.getBoundingClientRect();

    // 1. Exact Starting Center Coordinates (moment of click)
    const startCenterX = cardRect.left + cardRect.width / 2;
    const startCenterY = cardRect.top + cardRect.height / 2;

    // 2. Immediately close modal sheet and switch active category
    closeQuickCatModal();
    setSelectedCategory(cat.id);
    setActiveTab('menu');
    setAnimatingCategory(cat.id);

    // 3. Initialize the floating category traveler
    const startObj: TravelerState = {
      catId: cat.id,
      name: cat.name,
      icon: cat.icon,
      startCenterX,
      startCenterY,
      currentX: startCenterX,
      currentY: startCenterY,
      progress: 0
    };
    setTraveler(startObj);

    // 4. Smooth dynamic flight trajectory (~540ms - 580ms)
    const isMobile = window.innerWidth <= 640;
    const duration = isMobile ? 520 : 560;
    const startTime = performance.now();

    const animateFlight = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const rawP = Math.min(elapsed / duration, 1);
      
      // Buttery smooth ease-in-out curve
      const easeP = rawP < 0.5 
        ? 4 * rawP * rawP * rawP 
        : 1 - Math.pow(-2 * rawP + 2, 3) / 2;

      // Real-time live destination tracking (follows chip as it scrolls into center/right)
      const liveTarget = getLiveTargetCoords(cat.id);
      const curX = startCenterX + (liveTarget.x - startCenterX) * easeP;
      const arcLift = Math.sin(easeP * Math.PI) * -18;
      const curY = startCenterY + (liveTarget.y - startCenterY) * easeP + arcLift;

      setTraveler({
        catId: cat.id,
        name: cat.name,
        icon: cat.icon,
        startCenterX,
        startCenterY,
        currentX: curX,
        currentY: curY,
        progress: easeP
      });

      if (rawP < 1) {
        requestAnimationFrame(animateFlight);
      } else {
        // Flight completed! Trigger slam impact & individual elements vibration
        setTraveler(null);

        // 1. Slam the targeted button/chip with impact & shockwave
        const arrivedEl = (document.querySelector(`[data-cat-id="${cat.id}"]`) || document.getElementById('btn-categories-shimmer')) as HTMLElement;
        if (arrivedEl) {
          arrivedEl.classList.remove('is-docking-pulse');
          void arrivedEl.offsetWidth;
          arrivedEl.classList.add('is-docking-pulse');
          setTimeout(() => {
            arrivedEl.classList.remove('is-docking-pulse');
          }, 700);
        }

        // 2. Individual Staggered Micro-jiggle on all visible items
        const itemsToJiggle = document.querySelectorAll('.product-card, .cat-chip, .order-card');
        itemsToJiggle.forEach((el, idx) => {
          const htmlEl = el as HTMLElement;
          htmlEl.classList.remove('item-slam-jiggle');
          htmlEl.style.animationDelay = `${(idx % 8) * 28}ms`;
          void htmlEl.offsetWidth;
          htmlEl.classList.add('item-slam-jiggle');
        });

        setTimeout(() => {
          itemsToJiggle.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.classList.remove('item-slam-jiggle');
            htmlEl.style.animationDelay = '';
          });
        }, 550);

        // 3. Optional subtle haptic feedback
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([25, 20, 15]);
          } catch {
            // ignore
          }
        }

        setTimeout(() => {
          setAnimatingCategory(null);
        }, 500);
      }
    };

    requestAnimationFrame(animateFlight);
  };

  return (
    <>
      {/* Category Traveler Actor (Dynamic Real-Time Flight) */}
      {traveler && (
        <div
          ref={travelerElRef}
          className="floating-category-traveler"
          style={{
            transform: `translate3d(calc(${traveler.currentX}px - 50%), calc(${traveler.currentY}px - 50%), 0) scale(${
              traveler.progress < 0.5
                ? 1 + 0.05 * (traveler.progress * 2)
                : 1.05 - 0.12 * ((traveler.progress - 0.5) * 2)
            })`,
            opacity: traveler.progress > 0.96 ? 1 - (traveler.progress - 0.96) / 0.04 : 1
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
            {traveler.icon}
          </span>
          <span>{traveler.name}</span>
        </div>
      )}

      {/* Main Categories Modal Sheet */}
      {isQuickCatModalOpen && (
        <div
          className={`quick-categories-overlay ${isQuickCatModalOpen ? 'is-open' : ''}`}
          id="quick-categories-modal"
          role="dialog"
          aria-modal="true"
          aria-label="أقسام قائمة المنيو"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeQuickCatModal();
          }}
        >
          <div className="quick-categories-sheet" onClick={(e) => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="sheet-drag-handle" aria-hidden="true"></div>

            {/* Header */}
            <div className="quick-cat-header">
              <div className="quick-cat-header-title-wrap">
                <div className="quick-cat-header-icon">
                  <span className="material-symbols-outlined">menu_book</span>
                </div>
                <div>
                  <h3 className="quick-cat-title">أقسام المنيو</h3>
                  <p className="quick-cat-subtitle">اختر القسم للانتقال الفوري إليه</p>
                </div>
              </div>
              <button
                className="quick-cat-close-btn"
                id="quick-cat-close"
                aria-label="إغلاق"
                onClick={closeQuickCatModal}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {/* Category Cards Grid */}
            <div className="quick-cat-grid" id="quick-categories-list">
              {CATEGORIES.map((cat) => {
                const count = PRODUCTS.filter((p) => p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    className="quick-cat-card"
                    type="button"
                    onClick={(e) => handleSelectCategory(cat, e)}
                  >
                    <div className="quick-cat-card-icon">
                      <span className="material-symbols-outlined">{cat.icon}</span>
                    </div>
                    <div className="quick-cat-card-info">
                      <h4 className="quick-cat-card-name">{cat.name}</h4>
                      <span className="quick-cat-card-count">{count} صنف</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
