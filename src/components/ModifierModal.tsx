import React, { useEffect, useMemo, useState } from 'react';
import { useMoney } from '../tenant/TenantContext';
import { useUI } from '../context/UIContext';
import { useCatalog } from '../hooks/useCatalog';
import { useCart } from '../hooks/useCart';
import type { CafeId, CatalogModifierGroup } from '../types/catalog';
import { isOrderable } from '../domain/catalogIndex';
import { toggleModifierOption, validateModifierSelection } from '../domain/modifiers';
import { estimateUnitCents } from '../domain/pricing';
import { MAX_QUANTITY_PER_LINE } from '../domain/cart';
import { useOrderContext } from '../hooks/useOrderContext';
import { useTenant } from '../tenant/TenantContext';
import { canAcceptOrders } from '../tenant/tenantPolicy';

function groupHint(group: CatalogModifierGroup): string {
  if (group.isRequired && !group.allowMultiple) return 'مطلوب • اختر واحداً';
  if (group.isRequired) return 'مطلوب • اختر واحداً أو أكثر';
  if (group.allowMultiple) return 'اختياري • يمكنك اختيار أكثر من واحد';
  return 'اختياري • اختر واحداً';
}

function optionPriceLabel(delta: number, money: (cents: number) => string): string | null {
  if (delta === 0) return null;
  return delta > 0 ? `+${money(delta)}` : money(delta);
}

export const ModifierModal: React.FC = () => {
  const money = useMoney();
  const { modifierProductId, closeModifierModal, showToast } = useUI();
  const { index } = useCatalog();
  const { addItem } = useCart();
  const { tenant } = useTenant();
  const { orderTypeEnabled } = useOrderContext();
  // Browse-only when the café has online ordering off (or the current journey disabled).
  const orderingOpen = canAcceptOrders(tenant) && orderTypeEnabled;

  const product = modifierProductId !== null ? index?.productsById.get(modifierProductId) ?? null : null;
  const [selected, setSelected] = useState<CafeId[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [showErrors, setShowErrors] = useState(false);

  // Nothing is pre-selected: the customer makes every required choice explicitly.
  useEffect(() => {
    setSelected([]);
    setQuantity(1);
    setShowErrors(false);
  }, [modifierProductId]);

  const issues = useMemo(() => (product ? validateModifierSelection(product, selected) : []), [product, selected]);
  const missingGroupIds = useMemo(
    () => new Set(issues.filter((i) => i.kind === 'REQUIRED_MISSING').map((i) => i.groupId)),
    [issues]
  );

  if (modifierProductId === null) return null;
  if (!product) {
    // The product disappeared from the Café menu while the sheet was open.
    return null;
  }

  const unitCents = estimateUnitCents(product, selected);
  const orderable = isOrderable(product);
  const canAdd = orderingOpen && orderable && issues.length === 0;

  const handleAdd = () => {
    if (!orderingOpen) {
      showToast('الطلب أونلاين غير متاح حالياً. يمكنك تصفح المنيو فقط.', 'info');
      return;
    }
    if (!canAdd) {
      setShowErrors(true);
      return;
    }
    const result = addItem(product.id, selected, quantity);
    if (!result.ok) {
      showToast(
        result.reason === 'CART_FULL'
          ? 'وصلت السلة للحد الأقصى من الأصناف المختلفة.'
          : `الحد الأقصى ${MAX_QUANTITY_PER_LINE} قطعة من نفس الصنف.`,
        'error'
      );
      return;
    }
    showToast(`تمت إضافة "${product.name}" إلى السلة`);
    closeModifierModal();
  };

  return (
    <div
      className="modifier-modal-overlay is-open"
      id="modifier-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-product-name"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModifierModal();
      }}
    >
      <div className="modifier-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-drag-handle" aria-hidden="true"></div>

        <div className="modal-sheet-header">
          <div className="modal-header-info">
            <h3 className="modal-product-name" id="modal-product-name">{product.name}</h3>
            {product.description && <span className="modal-product-en">{product.description}</span>}
          </div>
          <button className="modal-close-btn" id="modal-close" aria-label="إغلاق" onClick={closeModifierModal}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div
          className="modal-sheet-body"
          id="modal-body-content"
          style={{ overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '55vh' }}
        >
          {!orderable && (
            <div className="inline-notice is-error" role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">block</span>
              <span>هذا الصنف غير متاح للطلب حالياً.</span>
            </div>
          )}

          {product.modifierGroups.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>لا توجد اختيارات إضافية لهذا الصنف.</p>
          )}

          {product.modifierGroups.map((group) => {
            const isMissing = showErrors && missingGroupIds.has(group.id);
            return (
              <fieldset key={group.id} className={`modifier-group ${isMissing ? 'has-error' : ''}`} data-group-id={group.id}>
                <legend className="modifier-group-legend">
                  <span>{group.name}</span>
                  <span className={`modifier-group-hint ${group.isRequired ? 'is-required' : ''}`}>{groupHint(group)}</span>
                </legend>
                <div className="modifier-options-grid">
                  {group.options.map((option) => {
                    const isOn = selected.includes(option.id);
                    const price = optionPriceLabel(option.priceDeltaCents, money);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role={group.allowMultiple ? 'checkbox' : 'radio'}
                        aria-checked={isOn}
                        data-option-id={option.id}
                        className={`btn-secondary modifier-option ${isOn ? 'is-active' : ''}`}
                        onClick={() => setSelected((cur) => toggleModifierOption(product, cur, option.id))}
                      >
                        <span>{option.name}</span>
                        {price && <span className="modifier-option-price">{price}</span>}
                      </button>
                    );
                  })}
                </div>
                {isMissing && <p className="field-error">يرجى اختيار {group.name}.</p>}
              </fieldset>
            );
          })}
        </div>

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
            <span className="stepper-val" id="modal-qty-val" aria-live="polite">{quantity}</span>
            <button
              className="stepper-btn"
              id="modal-qty-plus"
              type="button"
              aria-label="زيادة الكمية"
              disabled={quantity >= MAX_QUANTITY_PER_LINE}
              onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY_PER_LINE, q + 1))}
            >
              +
            </button>
          </div>
          <button
            className="modal-add-to-cart-cta"
            id="modal-submit-btn"
            type="button"
            aria-disabled={!canAdd}
            data-ready={canAdd}
            onClick={handleAdd}
          >
            <span>{!orderingOpen ? 'تصفح فقط' : orderable ? 'إضافة إلى السلة' : 'غير متاح'}</span>
            <span id="modal-total-price">{money(unitCents * quantity)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
