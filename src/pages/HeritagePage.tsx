import React from 'react';
import { useUI } from '../context/UIContext';
import { useCatalog } from '../hooks/useCatalog';

export const HeritagePage: React.FC = () => {
  const { setActiveTab } = useUI();
  // Contact phone comes from Café's store settings; nothing is shown if Café doesn't publish one.
  const storePhone = useCatalog().index?.catalog.store.phone ?? null;

  return (
    <main className="page-content">
      <div className="content-inner">
        {/* 1. Hero Heritage Section */}
        <section className="heritage-hero animate-entrance">
          <span className="heritage-lead-tag">Artisanal Roastery Reserve</span>
          <h1 className="heritage-title">أصالة البن وسر التحميص اليدوي</h1>
          <p
            style={{
              fontFamily: 'var(--ff-arabic)',
              fontSize: '14px',
              lineHeight: 1.7,
              color: 'var(--on-surface-variant)',
              maxWidth: '26rem',
              margin: '0 auto'
            }}
          >
            في دياب كافيه، لا نقدّم مجرد فنجان قهوة؛ بل نصحبك في رحلة حسية تبدأ من جبال اليمن ومزارع إثيوبيا وحتى براميل
            التحميص النحاسية في سيدي سالم.
          </p>
        </section>

        {/* 2. The Story Behind Diab Roastery */}
        <article className="heritage-story-card animate-entrance">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--primary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
              history_edu
            </span>
            <h2 style={{ fontFamily: 'var(--ff-arabic)', fontSize: '18px', fontWeight: 800 }}>
              حكاية دياب: جسر بين التراث والموجة الثالثة
            </h2>
          </div>
          <p className="heritage-story-para">
            انطلقت محمصة دياب من شغف عميق بتراث القهوة الشرقية الأصيلة والتحميص المتقن. دمجنا بين عراقة الفنجان التركي المحوج
            بالمستكة والزعفران والهيل، وبين ثقافة الموجة الثالثة للقهوة المختصة التي تحتفي بحمضية الإسبريسو ونقاء المحاصيل
            العضوية الفردية (Single Origins).
          </p>
          <p className="heritage-story-para">
            كل دفعة حبوب يتم تحميصها يدوياً بعناية متناهية داخل فرعنا الرئيسي للوصول إلى ذروة استخلاص الزيوت العطرية والنكهات
            الكامنة داخل الحبة.
          </p>
        </article>

        {/* 3. Coffee Terroirs & Direct Trade */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
              <span className="material-symbols-outlined">public</span>
              <h2 style={{ fontFamily: 'var(--ff-arabic)', fontSize: '17px', fontWeight: 800 }}>
                محاصيلنا المنتقاة من بلاد المنشأ
              </h2>
            </div>
          </div>

          <div className="origins-grid">
            <div className="origin-card">
              <span className="origin-country">
                <span className="material-symbols-outlined">flag</span>
                <span>اليمن المطري (Yemen Matari)</span>
              </span>
              <p className="origin-notes">
                محصول نادر من مدرجات جبال بني مطر، معالج بالتجفيف الطبيعي ليعطي إيحاءات فاكهية معقدة ونفحات شوكولاتية عميقة.
              </p>
            </div>

            <div className="origin-card">
              <span className="origin-country">
                <span className="material-symbols-outlined">flag</span>
                <span>إثيوبيا يرجاشيف (Ethiopia Yirgacheffe)</span>
              </span>
              <p className="origin-notes">
                مهد القهوة الأسطوري، حبوب عضوية معالجة مائياً تفيض برائحة الياسمين وزهر البرتقال وحمضية التوت البري المتلألئة.
              </p>
            </div>

            <div className="origin-card">
              <span className="origin-country">
                <span className="material-symbols-outlined">flag</span>
                <span>كولومبيا سوبريمو (Colombia Supremo)</span>
              </span>
              <p className="origin-notes">
                من مرتفعات الأنديز، قوام متوازن مخملي بنكهات السكر البني المكرمل والتفاح الأحمر وحبوب الجوز المحمصة.
              </p>
            </div>

            <div className="origin-card">
              <span className="origin-country">
                <span className="material-symbols-outlined">flag</span>
                <span>البرازيل سانتوس (Brazil Santos)</span>
              </span>
              <p className="origin-notes">
                قوام شوكولاتي ممتلئ وحمضية هادئة ناعمة تشكل الأساس المثالي للإسبريسو والخلطات الفرنسية الغنية.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Traditional Aromatics Alchemy */}
        <article className="heritage-story-card animate-entrance">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--primary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
              spa
            </span>
            <h2 style={{ fontFamily: 'var(--ff-arabic)', fontSize: '17px', fontWeight: 800 }}>
              كيمياء التحييج العطري التراثي
            </h2>
          </div>
          <p className="heritage-story-para">
            نتميز بخلطات البن المحوج التي تجمع بين أربعة عناصر عطرية تقليدية أصيلة:
          </p>
          <div
            className="aromatics-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', marginTop: '0.5rem' }}
          >
            <div
              className="aromatic-card"
              style={{
                background: 'var(--surface-container-high)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: 'var(--border-card)'
              }}
            >
              <strong style={{ color: 'var(--primary)', fontFamily: 'var(--ff-arabic)', fontSize: '13px' }}>
                المسكة التركية الحرة
              </strong>
              <p style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '0.2rem' }}>
                تمنح الفنجان قواماً مخملياً فريداً وعطراً ساحراً.
              </p>
            </div>
            <div
              className="aromatic-card"
              style={{
                background: 'var(--surface-container-high)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: 'var(--border-card)'
              }}
            >
              <strong style={{ color: 'var(--primary)', fontFamily: 'var(--ff-arabic)', fontSize: '13px' }}>
                الزعفران الإيراني الأصلي
              </strong>
              <p style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '0.2rem' }}>
                لمسة ذهبية ملوكية ونكهة أرضية نبيلة.
              </p>
            </div>
            <div
              className="aromatic-card"
              style={{
                background: 'var(--surface-container-high)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: 'var(--border-card)'
              }}
            >
              <strong style={{ color: 'var(--primary)', fontFamily: 'var(--ff-arabic)', fontSize: '13px' }}>
                الهيل الهندي الأخضر (حب كامل)
              </strong>
              <p style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '0.2rem' }}>
                حبوب هيل درجة أولى تطحن مباشرة مع البن.
              </p>
            </div>
            <div
              className="aromatic-card"
              style={{
                background: 'var(--surface-container-high)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: 'var(--border-card)'
              }}
            >
              <strong style={{ color: 'var(--primary)', fontFamily: 'var(--ff-arabic)', fontSize: '13px' }}>
                الجنزبيل والقرنفل البلدي
              </strong>
              <p style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '0.2rem' }}>
                دفء وتوازن مثالي يوقظ الحواس.
              </p>
            </div>
          </div>
        </article>

        {/* 5. Location & Roastery Visit */}
        <section className="checkout-section-card animate-entrance">
          <div className="checkout-section-title">
            <span className="material-symbols-outlined">storefront</span>
            <span>زوروا محمصة وفرع دياب الرئيسي</span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              fontFamily: 'var(--ff-arabic)',
              fontSize: '13px',
              color: 'var(--on-surface)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                pin_drop
              </span>
              <span>
                <strong>الموقع:</strong> محافظة كفر الشيخ — سيدي سالم — الشارع التجاري الرئيسي.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                schedule
              </span>
              <span>
                <strong>ساعات العمل:</strong> يومياً من الساعة ٧:٠٠ صباحاً وحتى ٢:٠٠ صباحاً بعد منتصف الليل.
              </span>
            </div>
            {storePhone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                  phone
                </span>
                <span>
                  <strong>هاتف:</strong>{' '}
                  <a href={`tel:${storePhone}`} style={{ color: 'var(--primary)' }}>{storePhone}</a>
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab('menu')}
            className="btn-primary"
            style={{ textDecoration: 'none', justifyContent: 'center', height: '3.25rem', marginTop: '0.5rem', width: '100%' }}
            type="button"
          >
            <span>استكشف منيو المشروبات والبن</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              restaurant_menu
            </span>
          </button>
        </section>
      </div>
    </main>
  );
};
