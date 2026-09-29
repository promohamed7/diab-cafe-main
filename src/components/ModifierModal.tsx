import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { DRINK_MODIFIERS, BEAN_MODIFIERS, formatEGP } from '../data/menuData';

export const ModifierModal: React.FC = () => {
  const { isModifierModalOpen, closeModifierModal, selectedProductForModifier, addToCart } = useStore();

  const product = selectedProductForModifier;

  // Drink states
  const [size, setSize] = useState('single');
  const [milk, setMilk] = useState('whole');
  const [sweetness, setSweetness] = useState('medium');
  const [extraShot, setExtraShot] = useState('none');
  const [syrup, setSyrup] = useState('none');

  // Bean states
  const [weight, setWeight] = useState('w125');
  const [grind, setGrind] = useState('whole-beans');
  const [roast, setRoast] = useState('medium');
  const [spicing, setSpicing] = useState('plain');
  const [selectedAromatics, setSelectedAromatics] = useState<string[]>([]);

  // Quantity
  const [quantity, setQuantity] = useState(1);

  // Reset defaults on open
  useEffect(() => {
    if (product) {
      setSize('single');
      setMilk('whole');
      setSweetness('medium');
      setExtraShot('none');
      setSyrup('none');

      setWeight('w125');
      setGrind('whole-beans');
      setRoast('medium');
      setSpicing('plain');
      setSelectedAromatics([]);
      setQuantity(1);
    }
  }, [product]);

  if (!isModifierModalOpen || !product) return null;

  // Calculate price
  let unitPriceCents = product.priceCents;
  const isRoastery = !!product.isRoastery;

  let modifiersSummaryList: string[] = [];

  if (!isRoastery) {
    const sizeObj = DRINK_MODIFIERS.sizes.find((s) => s.id === size);
    if (sizeObj) {
      unitPriceCents += sizeObj.deltaCents;
      if (sizeObj.deltaCents > 0) modifiersSummaryList.push(sizeObj.name);
    }
    const milkObj = DRINK_MODIFIERS.milks.find((m) => m.id === milk);
    if (milkObj) {
      unitPriceCents += milkObj.deltaCents;
      if (milkObj.id !== 'whole') modifiersSummaryList.push(milkObj.name);
    }
    const sweetObj = DRINK_MODIFIERS.sweetness.find((s) => s.id === sweetness);
    if (sweetObj && sweetObj.id !== 'medium') {
      modifiersSummaryList.push(sweetObj.name);
    }
    const shotObj = DRINK_MODIFIERS.extraShots.find((s) => s.id === extraShot);
    if (shotObj && shotObj.id !== 'none') {
      unitPriceCents += shotObj.deltaCents;
      modifiersSummaryList.push(shotObj.name);
    }
    const syrupObj = DRINK_MODIFIERS.syrups.find((s) => s.id === syrup);
    if (syrupObj && syrupObj.id !== 'none') {
      unitPriceCents += syrupObj.deltaCents;
      modifiersSummaryList.push(syrupObj.name);
    }
  } else {
    const weightObj = BEAN_MODIFIERS.weights.find((w) => w.id === weight) || BEAN_MODIFIERS.weights[0];
    unitPriceCents = product.priceCents * weightObj.multiplier;
    modifiersSummaryList.push(weightObj.label);

    const grindObj = BEAN_MODIFIERS.grinds.find((g) => g.id === grind);
    if (grindObj) modifiersSummaryList.push(grindObj.name);

    const roastObj = BEAN_MODIFIERS.roasts.find((r) => r.id === roast);
    if (roastObj) modifiersSummaryList.push(roastObj.name);

    const spiceObj = BEAN_MODIFIERS.spicing.find((s) => s.id === spicing);
    if (spiceObj && spiceObj.id !== 'plain') {
      unitPriceCents += spiceObj.deltaCents * weightObj.multiplier;
      modifiersSummaryList.push(spiceObj.name);
    }

    selectedAromatics.forEach((aromId) => {
      const aromObj = BEAN_MODIFIERS.aromatics.find((a) => a.id === aromId);
      if (aromObj) {
        unitPriceCents += aromObj.deltaCents;
        modifiersSummaryList.push(aromObj.name);
      }
    });
  }

  const totalCents = unitPriceCents * quantity;

  const toggleAromatic = (id: string) => {
    setSelectedAromatics((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      productName: product.name,
      productNameEn: product.nameEn,
      quantity,
      unitPriceCents,
      totalCents,
      modifiersSummary: modifiersSummaryList.join(' • '),
      modifiers: isRoastery
        ? { weight, grind, roast, spicing, aromatics: selectedAromatics }
        : { size, milk, sweetness, extraShot, syrup },
      isRoastery
    });
    closeModifierModal();
  };

  return (
    <div
      className={`modifier-modal-overlay ${isModifierModalOpen ? 'is-open' : ''}`}
      id="modifier-modal"
      role="dialog"
      aria-modal="true"
      aria-label="تخصيص الطلب"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModifierModal();
      }}
    >
      <div className="modifier-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-drag-handle" aria-hidden="true"></div>

        {/* Modal Header */}
        <div className="modal-sheet-header">
          <div className="modal-header-info">
            <h3 className="modal-product-name" id="modal-product-name">{product.name}</h3>
            <span className="modal-product-en" id="modal-product-en">{product.nameEn}</span>
          </div>
          <button className="modal-close-btn" id="modal-close" aria-label="إغلاق" onClick={closeModifierModal}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Customization Options Body */}
        <div className="modal-sheet-body" id="modal-body-content" style={{ overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '55vh' }}>
          {!isRoastery ? (
            /* DRINK OPTIONS */
            <>
              {/* Size */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  الحجم (Size)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {DRINK_MODIFIERS.sizes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`btn-secondary ${size === s.id ? 'is-active' : ''}`}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.5rem',
                        fontSize: '12.5px',
                        justifyContent: 'center',
                        borderColor: size === s.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        background: size === s.id ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                        color: size === s.id ? 'var(--primary)' : 'inherit'
                      }}
                      onClick={() => setSize(s.id)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Milk */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  نوع الحليب (Milk Option)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {DRINK_MODIFIERS.milks.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`btn-secondary ${milk === m.id ? 'is-active' : ''}`}
                      style={{
                        padding: '0.6rem 0.5rem',
                        fontSize: '12px',
                        justifyContent: 'center',
                        borderColor: milk === m.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        background: milk === m.id ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                        color: milk === m.id ? 'var(--primary)' : 'inherit'
                      }}
                      onClick={() => setMilk(m.id)}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sweetness */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  درجة السكر (Sweetness Level)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {DRINK_MODIFIERS.sweetness.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      className={`btn-secondary ${sweetness === sw.id ? 'is-active' : ''}`}
                      style={{
                        padding: '0.6rem 0.5rem',
                        fontSize: '12px',
                        justifyContent: 'center',
                        borderColor: sweetness === sw.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        background: sweetness === sw.id ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                        color: sweetness === sw.id ? 'var(--primary)' : 'inherit'
                      }}
                      onClick={() => setSweetness(sw.id)}
                    >
                      {sw.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra Shots */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  شوت إسبريسو إضافي
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {DRINK_MODIFIERS.extraShots.map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      className={`btn-secondary ${extraShot === sh.id ? 'is-active' : ''}`}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.5rem',
                        fontSize: '12px',
                        justifyContent: 'center',
                        borderColor: extraShot === sh.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        background: extraShot === sh.id ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                        color: extraShot === sh.id ? 'var(--primary)' : 'inherit'
                      }}
                      onClick={() => setExtraShot(sh.id)}
                    >
                      {sh.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Syrups */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  إضافة سيرب نكهة
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {DRINK_MODIFIERS.syrups.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`btn-secondary ${syrup === s.id ? 'is-active' : ''}`}
                      style={{
                        padding: '0.6rem 0.5rem',
                        fontSize: '12px',
                        justifyContent: 'center',
                        borderColor: syrup === s.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        background: syrup === s.id ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                        color: syrup === s.id ? 'var(--primary)' : 'inherit'
                      }}
                      onClick={() => setSyrup(s.id)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* COFFEE BEANS OPTIONS */
            <>
              {/* Weight */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  الوزن المطلوب (Weight)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {BEAN_MODIFIERS.weights.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className={`btn-secondary ${weight === w.id ? 'is-active' : ''}`}
                      style={{
                        padding: '0.6rem 0.5rem',
                        fontSize: '12.5px',
                        justifyContent: 'center',
                        borderColor: weight === w.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        background: weight === w.id ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                        color: weight === w.id ? 'var(--primary)' : 'inherit'
                      }}
                      onClick={() => setWeight(w.id)}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grind */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  درجة الطحن (Grind Level)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {BEAN_MODIFIERS.grinds.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`btn-secondary ${grind === g.id ? 'is-active' : ''}`}
                      style={{
                        padding: '0.6rem 0.85rem',
                        fontSize: '12px',
                        justifyContent: 'space-between',
                        borderColor: grind === g.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        background: grind === g.id ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                        color: grind === g.id ? 'var(--primary)' : 'inherit'
                      }}
                      onClick={() => setGrind(g.id)}
                    >
                      <span>{g.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>{g.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Roast */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  درجة التحميص (Roast Level)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {BEAN_MODIFIERS.roasts.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`btn-secondary ${roast === r.id ? 'is-active' : ''}`}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.5rem',
                        fontSize: '12px',
                        justifyContent: 'center',
                        borderColor: roast === r.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        background: roast === r.id ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                        color: roast === r.id ? 'var(--primary)' : 'inherit'
                      }}
                      onClick={() => setRoast(r.id)}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spicing */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  التحويجة (Spicing)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {BEAN_MODIFIERS.spicing.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      className={`btn-secondary ${spicing === sp.id ? 'is-active' : ''}`}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.5rem',
                        fontSize: '12px',
                        justifyContent: 'center',
                        borderColor: spicing === sp.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        background: spicing === sp.id ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                        color: spicing === sp.id ? 'var(--primary)' : 'inherit'
                      }}
                      onClick={() => setSpicing(sp.id)}
                    >
                      {sp.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aromatics */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: '13.5px', color: 'var(--on-surface)' }}>
                  إضافات شرقية فاخرة (اختياري)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {BEAN_MODIFIERS.aromatics.map((ar) => {
                    const isChecked = selectedAromatics.includes(ar.id);
                    return (
                      <button
                        key={ar.id}
                        type="button"
                        className={`btn-secondary ${isChecked ? 'is-active' : ''}`}
                        style={{
                          padding: '0.6rem 0.5rem',
                          fontSize: '11.5px',
                          justifyContent: 'center',
                          borderColor: isChecked ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                          background: isChecked ? 'rgba(200, 150, 62, 0.18)' : 'transparent',
                          color: isChecked ? 'var(--primary)' : 'inherit'
                        }}
                        onClick={() => toggleAromatic(ar.id)}
                      >
                        {ar.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sticky Footer CTA */}
        <div className="modal-sheet-footer">
          <div className="quantity-stepper">
            <button
              className="stepper-btn"
              id="modal-qty-minus"
              type="button"
              aria-label="تقليل الكمية"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              −
            </button>
            <span className="stepper-val" id="modal-qty-val">{quantity}</span>
            <button
              className="stepper-btn"
              id="modal-qty-plus"
              type="button"
              aria-label="زيادة الكمية"
              onClick={() => setQuantity((q) => q + 1)}
            >
              +
            </button>
          </div>
          <button className="modal-add-to-cart-cta" id="modal-submit-btn" type="button" onClick={handleAddToCart}>
            <span>إضافة إلى السلة</span>
            <span id="modal-total-price">{formatEGP(totalCents)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
