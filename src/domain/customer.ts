// Client-side validation of customer input. This is UX only: Café must apply its
// own limits. The limits below keep free text reaching the POS reasonable.

import type { OrderType, PaymentMethod } from '../types/order.ts';

export const LIMITS = {
  nameMin: 2,
  nameMax: 60,
  phoneDigitsMin: 10,
  phoneDigitsMax: 15,
  addressMin: 10,
  addressMax: 300,
  notesMax: 200
} as const;

export interface CheckoutFormInput {
  fullName: string;
  phone: string;
  deliveryAddress: string;
  notes: string;
  paymentMethod: PaymentMethod;
}

export type CheckoutField = 'fullName' | 'phone' | 'deliveryAddress' | 'notes' | 'paymentMethod';

export interface NormalizedCustomer {
  fullName: string;
  phone: string;
  deliveryAddress: string;
  notes: string;
  paymentMethod: PaymentMethod;
}

export interface CheckoutValidation {
  values: NormalizedCustomer;
  errors: Partial<Record<CheckoutField, string>>;
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

export function toAsciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_INDIC.indexOf(ch);
    return String(a >= 0 ? a : PERSIAN.indexOf(ch));
  });
}

/** Removes control characters and collapses whitespace. */
export function cleanText(value: string, multiline = false): string {
  // eslint-disable-next-line no-control-regex
  const noControl = value.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ');
  if (multiline) {
    return noControl
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }
  return noControl.replace(/\s+/g, ' ').trim();
}

/** Keeps an optional leading + and the digits; returns '' if the shape is wrong. */
export function normalizePhone(value: string): string {
  const ascii = toAsciiDigits(value).trim();
  if (!/^\+?[\d\s\-()]+$/.test(ascii)) return '';
  const plus = ascii.startsWith('+') ? '+' : '';
  return plus + ascii.replace(/\D/g, '');
}

export function validateCheckoutInput(input: CheckoutFormInput, orderType: OrderType): CheckoutValidation {
  const errors: CheckoutValidation['errors'] = {};
  const contactRequired = orderType !== 'DINE_IN';

  const fullName = cleanText(input.fullName);
  if (fullName.length === 0) {
    if (contactRequired) errors.fullName = 'يرجى إدخال الاسم.';
  } else if (fullName.length < LIMITS.nameMin) {
    errors.fullName = 'الاسم قصير جداً.';
  } else if (fullName.length > LIMITS.nameMax) {
    errors.fullName = `الاسم يجب ألا يتجاوز ${LIMITS.nameMax} حرفاً.`;
  }

  const rawPhone = input.phone.trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : '';
  const digits = phone.replace(/\D/g, '').length;
  if (!rawPhone) {
    if (contactRequired) errors.phone = 'يرجى إدخال رقم الهاتف.';
  } else if (!phone || digits < LIMITS.phoneDigitsMin || digits > LIMITS.phoneDigitsMax) {
    errors.phone = 'رقم الهاتف غير صحيح. أدخل رقماً من 10 إلى 15 رقماً.';
  }

  let deliveryAddress = '';
  if (orderType === 'DELIVERY') {
    deliveryAddress = cleanText(input.deliveryAddress, true);
    if (deliveryAddress.length === 0) errors.deliveryAddress = 'يرجى إدخال عنوان التوصيل.';
    else if (deliveryAddress.length < LIMITS.addressMin) errors.deliveryAddress = 'يرجى كتابة العنوان بتفصيل أكثر.';
    else if (deliveryAddress.length > LIMITS.addressMax) {
      errors.deliveryAddress = `العنوان يجب ألا يتجاوز ${LIMITS.addressMax} حرف.`;
    }
  }

  const notes = cleanText(input.notes, true);
  if (notes.length > LIMITS.notesMax) errors.notes = `الملاحظات يجب ألا تتجاوز ${LIMITS.notesMax} حرف.`;

  if (input.paymentMethod !== 'CASH' && input.paymentMethod !== 'CREDIT_CARD') {
    errors.paymentMethod = 'يرجى اختيار طريقة الدفع.';
  }

  return { values: { fullName, phone, deliveryAddress, notes, paymentMethod: input.paymentMethod }, errors };
}
