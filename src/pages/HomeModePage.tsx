import React, { useEffect, useRef } from 'react';
import { useUI } from '../context/UIContext';
import { useOrderContext } from '../hooks/useOrderContext';
import { useCatalog } from '../hooks/useCatalog';
import type { OutsideOrderType } from '../types/order';
import dineinHero from '../assets/images/dinein-hero.webp';
import pickupHero from '../assets/images/pickup-hero.webp';
import deliveryHero from '../assets/images/delivery-hero.webp';
import heroBannerImage from '../assets/images/hero-banner.webp';
import heroMobileBannerImage from '../assets/images/hero-banner-mobile.webp';

export const HomeModePage: React.FC = () => {
  const { setActiveTab, setIsHeroTitleDocked, showToast } = useUI();
  const { table, setOutsideType } = useOrderContext();
  const { index } = useCatalog();
  const store = index?.catalog.store ?? null;

  const heroTitleRef = useRef<HTMLHeadingElement | null>(null);
  const flyingTitleRef = useRef<HTMLDivElement | null>(null);

  // Responsive scroll-driven flight & docking animation (Desktop side-dock & Mobile sub-line dock)
  useEffect(() => {
    const heroTitle = heroTitleRef.current;
    const flyingTitle = flyingTitleRef.current;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (!heroTitle || !flyingTitle) return;

      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const isMobile = window.innerWidth <= 640;

      // Continuous natural scroll distance across the hero area
      const maxScrollRange = 140;

      if (scrollY < 10) {
        // At top: hero title rests in hero banner, flying actor is hidden
        heroTitle.style.opacity = '1';
        heroTitle.style.visibility = 'visible';
        flyingTitle.style.display = 'none';
        flyingTitle.style.opacity = '0';
        setIsHeroTitleDocked(false);
        document.body.classList.remove('is-hero-title-docked');
      } else if (scrollY >= maxScrollRange) {
        // Fully scrolled: dock securely into header
        heroTitle.style.opacity = '0';
        heroTitle.style.visibility = 'hidden';
        flyingTitle.style.display = 'none';
        flyingTitle.style.opacity = '0';
        setIsHeroTitleDocked(true);
        document.body.classList.add('is-hero-title-docked');
      } else {
        // In-flight: animate on responsive trajectory (desktop = diagonal right, mobile = smooth upward sub-dock)
        setIsHeroTitleDocked(false);
        document.body.classList.remove('is-hero-title-docked');

        const rawProgress = Math.min(Math.max((scrollY - 10) / (maxScrollRange - 10), 0), 1);
        
        // Vertical easing curve (smooth continuous ascent)
        const easeY = 1 - Math.pow(1 - rawProgress, 2.2);
        // Horizontal easing curve: early rightward on desktop, centered on mobile
        const easeX = isMobile ? (1 - Math.pow(1 - rawProgress, 2.2)) : Math.pow(rawProgress, 0.75);

        const heroRect = heroTitle.getBoundingClientRect();
        const brandEl = document.querySelector('.header-brand');
        const brandRect = brandEl
          ? brandEl.getBoundingClientRect()
          : { top: 16, left: window.innerWidth / 2 - 60, width: 120, height: 28, right: window.innerWidth / 2 + 60, bottom: 44 };

        const heroFontSize = parseFloat(window.getComputedStyle(heroTitle).fontSize) || 28;
        const targetFontSize = isMobile ? 11.5 : 13.5;
        const scaleRatio = targetFontSize / heroFontSize;
        const currentScale = 1 + (scaleRatio - 1) * easeY;

        const heroCenterX = heroRect.left + heroRect.width / 2;
        const heroCenterY = heroRect.top + heroRect.height / 2;

        let targetCenterX: number;
        let targetCenterY: number;

        if (isMobile) {
          // On mobile: docks directly in the center of the entire header width under the header row
          const headerEl = document.getElementById('site-header');
          const headerRect = headerEl ? headerEl.getBoundingClientRect() : { bottom: 58 };
          targetCenterX = window.innerWidth / 2;
          targetCenterY = headerRect.bottom + 10;
        } else {
          // On desktop: docks on the RIGHT side of DIAB CAFE
          targetCenterX = brandRect.right - 92;
          targetCenterY = brandRect.top + brandRect.height / 2;
        }

        // Trajectory calculation
        const currentCenterX = heroCenterX + (targetCenterX - heroCenterX) * easeX;
        const currentCenterY = heroCenterY + (targetCenterY - heroCenterY) * easeY;

        // Position flying title fixed in viewport coordinates
        flyingTitle.style.top = '0px';
        flyingTitle.style.left = '0px';
        flyingTitle.style.width = heroRect.width + 'px';
        flyingTitle.style.fontSize = heroFontSize + 'px';
        flyingTitle.style.display = 'block';
        flyingTitle.style.opacity = '1';

        const translateX = currentCenterX - heroRect.width / 2;
        const translateY = currentCenterY - heroRect.height / 2;

        // Subtle dynamic angle tilt during diagonal flight on desktop
        const angleTilt = isMobile ? 0 : (1 - rawProgress) * rawProgress * 2.5;

        flyingTitle.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${currentScale}) rotate(${angleTilt}deg)`;

        heroTitle.style.opacity = '0';
        heroTitle.style.visibility = 'hidden';
      }
    };

    const onScrollThrottled = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    };

    window.addEventListener('scroll', onScrollThrottled, { passive: true });
    window.addEventListener('resize', onScrollThrottled, { passive: true });
    window.addEventListener('orientationchange', onScrollThrottled, { passive: true });
    handleScroll();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollThrottled);
      window.removeEventListener('resize', onScrollThrottled);
      window.removeEventListener('orientationchange', onScrollThrottled);
      setIsHeroTitleDocked(false);
      document.body.classList.remove('is-hero-title-docked');
    };
  }, [setIsHeroTitleDocked]);

  const chooseOutside = (type: OutsideOrderType) => {
    if (!setOutsideType(type)) {
      // Dine-in is locked while a Café table session is active.
      showToast(`أنت تطلب الآن من ${table?.tableLabel ?? 'طاولتك'}. اضغط "إنهاء طلب الطاولة" أولاً للطلب خارج الكافيه.`, 'info');
      return;
    }
    setActiveTab('menu');
  };
  const handleTakeaway = () => chooseOutside('PICKUP');
  const handleDelivery = () => chooseOutside('DELIVERY');

  // Dine-in starts only from the QR code on the table. Without a Café-resolved
  // table the card just explains how to start; it never offers a table picker.
  const handleDineIn = () => {
    if (table) setActiveTab('menu');
    else showToast('امسح كود QR الموجود على طاولتك بكاميرا هاتفك لبدء الطلب من الطاولة.', 'info');
  };

  return (
    <main className="page-content">
      <div className="content-inner">
        {/* Dedicated Flying Title Actor for Scroll Docking Animation */}
        <div
          id="hero-flying-title"
          ref={flyingTitleRef}
          className="hero-flying-title"
          aria-hidden="true"
        >
          أين تود الاستمتاع <span className="gold-gradient-text">بقهوتك اليوم؟</span>
        </div>

        {/* HERO WELCOME SECTION (Original Precise Compact Container with Image) */}
        <section
          className="hero-welcome animate-entrance"
          id="hero-section"
          aria-label="اختيار نوع الطلب"
        >
          {/* Authentic WebP Banner Image (Responsive: Portrait on Mobile, Landscape on Desktop) */}
          <div className="hero-banner-image-container" aria-hidden="true">
            <picture>
              <source media="(max-width: 640px)" srcSet={heroMobileBannerImage} />
              <img
                src={heroBannerImage}
                alt="أجواء محمصة دياب كافيه"
                className="hero-banner-fit-img"
                referrerPolicy="no-referrer"
              />
            </picture>
          </div>

          {/* Center Content: Luxury Badge, Heading & Subtitle */}
          <div className="hero-content" style={{ position: 'relative', zIndex: 10, maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
            <div className="hero-luxury-badge">
              <span className="badge-sparkle">✦</span>
              <span>DIAB ARTISANAL ROASTERY • تجربة استثنائية</span>
              <span className="badge-sparkle">✦</span>
            </div>
            <h1 className="hero-title" id="hero-title" ref={heroTitleRef}>
              أين تود الاستمتاع <span className="gold-gradient-text">بقهوتك اليوم؟</span>
            </h1>
            <p className="hero-subtitle">
              اختر وسيلتك المفضلة لتصفح المنيو وبدء طلبك بأعلى معايير الجودة والسرعة
            </p>
          </div>
        </section>

        {/* 3 ORDER MODE CARDS */}
        <div className="order-cards">
          {/* CARD 1: Dine-In QR Table Order */}
          <article className="order-card animate-entrance" id="card-dinein" onClick={handleDineIn}>
            <div className="card-image-wrapper">
              <img
                className="card-image"
                src={dineinHero}
                alt="أجواء كافيه دافئة مع إضاءة أنيقة وماكينة إسبريسو"
                loading="eager"
                decoding="async"
              />
              <div className="card-image-overlay"></div>
              <span className="card-badge">
                <span className="material-symbols-outlined">table_restaurant</span>
                <span>داخل الفرع</span>
              </span>
            </div>
            <div className="card-body">
              <h2 className="card-title">
                <span>طلب من داخل الكافيه</span>
                <span className="material-symbols-outlined icon-filled" style={{ color: 'var(--primary)' }}>
                  verified
                </span>
              </h2>
              <p className="card-description">
                {table
                  ? `أنت متصل الآن بـ ${table.tableLabel}. تصفح المنيو وأرسل طلبك مباشرة للكافيه.`
                  : 'جالس على طاولتك؟ امسح كود QR الموجود على الطاولة بكاميرا هاتفك لتفتح المنيو وتطلب مباشرة.'}
              </p>
              <div className="card-features">
                <div className="feature-badge">
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                    qr_code_scanner
                  </span>
                  <span>دعم المسح بـ QR</span>
                </div>
                <div className="feature-badge">
                  <span className="material-symbols-outlined" style={{ color: 'var(--secondary)' }}>
                    menu_book
                  </span>
                  <span>تصفح المنيو الكامل</span>
                </div>
              </div>
              <button
                className="btn-primary btn-order-action"
                id="btn-dinein"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDineIn();
                }}
              >
                <span>{table ? `متابعة الطلب — ${table.tableLabel}` : 'امسح كود الطاولة للبدء'}</span>
                <span className="material-symbols-outlined btn-icon-arrow">arrow_back</span>
              </button>
            </div>
          </article>

          {/* CARD 2: Takeaway / Pickup */}
          <article className="order-card animate-entrance" id="card-takeaway" onClick={handleTakeaway}>
            <div className="card-image-wrapper">
              <img
                className="card-image"
                src={pickupHero}
                alt="أكواب قهوة سفري وأكياس بن محمص جاهزة للاستلام"
                loading="eager"
                decoding="async"
              />
              <div className="card-image-overlay"></div>
              <span className="card-badge">
                <span className="material-symbols-outlined">takeout_dining</span>
                <span>استلام سريع</span>
              </span>
            </div>
            <div className="card-body">
              <h2 className="card-title">
                <span>استلام من الفرع (تيك أواي)</span>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                  store
                </span>
              </h2>
              <p className="card-description">
                اطلب مشروباتك المفضلة مسبقاً واستلمها من الفرع، وادفع عند الاستلام كاش أو بالبطاقة.
              </p>
              <div className="card-features">
                <div className="feature-badge">
                  <span className="material-symbols-outlined" style={{ color: 'var(--tertiary)' }}>
                    timer
                  </span>
                  <span>طلب مسبق</span>
                </div>
                <div className="feature-badge">
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                    bolt
                  </span>
                  <span>دون طابور</span>
                </div>
              </div>
              <button
                className="btn-primary btn-order-action"
                id="btn-takeaway"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTakeaway();
                }}
              >
                <span>اطلب تيك أواي واستلم من الفرع</span>
                <span className="material-symbols-outlined btn-icon-arrow">arrow_back</span>
              </button>
            </div>
          </article>

          {/* CARD 3: Delivery */}
          <article className="order-card animate-entrance" id="card-delivery" onClick={handleDelivery}>
            <div className="card-image-wrapper">
              <img
                className="card-image"
                src={deliveryHero}
                alt="بوكسات توصيل قهوة وبن محمص طازج مجهزة للتوصيل"
                loading="eager"
                decoding="async"
              />
              <div className="card-image-overlay"></div>
              <span className="card-badge">
                <span className="material-symbols-outlined">moped</span>
                <span>توصيل منزلي وسريع</span>
              </span>
            </div>
            <div className="card-body">
              <h2 className="card-title">
                <span>توصيل (Delivery)</span>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                  local_shipping
                </span>
              </h2>
              <p className="card-description">
                تصفح المنيو بالكامل واطلب مشروباتك الساخنة والباردة والحلويات لمكانك أينما كنت بعناية تامة.
              </p>
              <div className="card-features">
                <div className="feature-badge">
                  <span className="material-symbols-outlined" style={{ color: 'var(--secondary)' }}>
                    near_me
                  </span>
                  <span>متوفر في نفس اليوم</span>
                </div>
                <div className="feature-badge">
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                    payments
                  </span>
                  <span>الدفع عند الاستلام</span>
                </div>
              </div>
              <button
                className="btn-primary btn-order-action"
                id="btn-delivery"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelivery();
                }}
              >
                <span>طلب دليفري وتوصيل منزلي</span>
                <span className="material-symbols-outlined btn-icon-arrow">arrow_back</span>
              </button>
            </div>
          </article>
        </div>

        {/* STORE INFO FOOTER STRIP */}
        <section className="store-info animate-entrance" id="store-info" aria-label="معلومات الفرع">
          <div className="store-header">
            <div className="store-icon-wrap">
              <span className="material-symbols-outlined icon-md">storefront</span>
            </div>
            <div className="store-details">
              <div className="store-name-row">
                <span className="store-name">{store?.name || 'فرع سيدي سالم الرئيسي'}</span>
              </div>
              <span className="store-hours">يومياً من ٧:٠٠ ص حتى ٢:٠٠ ص (خدمة متواصلة)</span>
              {store?.address && <span className="store-hours">{store.address}</span>}
              {store?.phone && (
                <a className="store-hours" href={`tel:${store.phone}`} style={{ color: 'var(--primary)' }}>
                  {store.phone}
                </a>
              )}
            </div>
          </div>
          <div className="coverage-notice">
            <span className="material-symbols-outlined">moped</span>
            <p>
              فرع سيدي سالم الرئيسي ومناطق أخرى لخدمتكم
              <span className="highlight"> يومياً من ٧ ص حتى ٢ ص</span> مع الحفاظ على درجة حرارة المشروب وعبق التحميص.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};
