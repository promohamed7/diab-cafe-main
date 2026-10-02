// Structured errors for the Café integration boundary.
//
// Café-side messages are never shown to customers: they may contain internal
// details. The UI only ever renders the local message for a known code.

export type CafeErrorCode =
  | 'INVALID_MODIFIER_OPTION'
  | 'PRODUCT_INACTIVE'
  | 'PRODUCT_UNAVAILABLE'
  | 'CUSTOMER_DATA_REQUIRED'
  | 'INSUFFICIENT_STOCK'
  | 'PRICE_TAMPERED_MISMATCH'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'INVALID_TABLE_TOKEN'
  | 'ORDER_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVICE_UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

/** Wire codes Café (or the relay) may send, in Rust variant or snake form. */
const WIRE_CODE_MAP: Record<string, CafeErrorCode> = {
  INVALIDMODIFIEROPTION: 'INVALID_MODIFIER_OPTION',
  PRODUCTINACTIVE: 'PRODUCT_INACTIVE',
  PRODUCTUNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  PRODUCTNOTAVAILABLEONLINE: 'PRODUCT_UNAVAILABLE',
  CUSTOMERDATAREQUIRED: 'CUSTOMER_DATA_REQUIRED',
  INSUFFICIENTSTOCK: 'INSUFFICIENT_STOCK',
  PRICETAMPEREDMISMATCH: 'PRICE_TAMPERED_MISMATCH',
  IDEMPOTENCYKEYCONFLICT: 'IDEMPOTENCY_KEY_CONFLICT',
  INVALIDTABLETOKEN: 'INVALID_TABLE_TOKEN',
  TABLEINACTIVEORINVALID: 'INVALID_TABLE_TOKEN',
  ORDERNOTFOUND: 'ORDER_NOT_FOUND',
  VALIDATIONFAILED: 'VALIDATION_FAILED',
  VALIDATIONERROR: 'VALIDATION_FAILED',
  SERVICEUNAVAILABLE: 'SERVICE_UNAVAILABLE',
  STOREOFFLINE: 'SERVICE_UNAVAILABLE'
};

/** Outcome of the request is unknown: the same clientRequestId must be reused on retry. */
const OUTCOME_UNKNOWN_CODES: ReadonlySet<CafeErrorCode> = new Set<CafeErrorCode>([
  'NETWORK_ERROR',
  'TIMEOUT',
  'SERVICE_UNAVAILABLE',
  'INVALID_RESPONSE',
  'UNKNOWN'
]);

export class CafeIntegrationError extends Error {
  readonly code: CafeErrorCode;
  readonly httpStatus: number | null;

  constructor(code: CafeErrorCode, httpStatus: number | null = null) {
    // The message is the code only, so no server text ever reaches the UI or logs.
    super(code);
    this.name = 'CafeIntegrationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }

  /**
   * True when Café may or may not have stored the order. Retrying is safe only
   * with the same clientRequestId.
   */
  get outcomeUnknown(): boolean {
    return OUTCOME_UNKNOWN_CODES.has(this.code);
  }
}

export function normalizeWireErrorCode(raw: unknown): CafeErrorCode {
  if (typeof raw !== 'string' || !raw) return 'UNKNOWN';
  const key = raw.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return WIRE_CODE_MAP[key] ?? 'UNKNOWN';
}

export function codeFromHttpStatus(status: number): CafeErrorCode {
  if (status === 404) return 'ORDER_NOT_FOUND';
  if (status === 409) return 'IDEMPOTENCY_KEY_CONFLICT';
  if (status === 400 || status === 422) return 'VALIDATION_FAILED';
  if (status === 408 || status === 504) return 'TIMEOUT';
  if (status >= 500) return 'SERVICE_UNAVAILABLE';
  return 'UNKNOWN';
}

export function toCafeError(error: unknown): CafeIntegrationError {
  if (error instanceof CafeIntegrationError) return error;
  return new CafeIntegrationError('UNKNOWN');
}

/** Customer-facing Arabic messages. Never include server text, IDs or internals. */
export const CUSTOMER_ERROR_MESSAGES: Record<CafeErrorCode, string> = {
  INVALID_MODIFIER_OPTION: 'أحد الاختيارات المحددة لم يعد متاحاً. يرجى مراجعة تخصيص الأصناف في السلة.',
  PRODUCT_INACTIVE: 'أحد الأصناف في سلتك لم يعد متوفراً في المنيو. يرجى حذفه والمتابعة.',
  PRODUCT_UNAVAILABLE: 'أحد الأصناف غير متاح للطلب أونلاين حالياً. يرجى حذفه والمتابعة.',
  CUSTOMER_DATA_REQUIRED: 'يرجى استكمال بيانات التواصل المطلوبة لهذا النوع من الطلبات.',
  INSUFFICIENT_STOCK: 'عذراً، الكمية المطلوبة من أحد الأصناف غير متوفرة حالياً.',
  PRICE_TAMPERED_MISMATCH: 'تم تحديث أسعار بعض الأصناف. راجع الإجمالي الجديد ثم أكد الطلب مرة أخرى.',
  IDEMPOTENCY_KEY_CONFLICT: 'حدث تعارض في محاولة الإرسال. راجع طلبك وأرسله مرة أخرى.',
  INVALID_TABLE_TOKEN: 'رمز الطاولة غير صالح أو منتهي. يرجى مسح كود QR الموجود على طاولتك مرة أخرى.',
  ORDER_NOT_FOUND: 'لم نتمكن من العثور على هذا الطلب.',
  VALIDATION_FAILED: 'بعض بيانات الطلب غير صحيحة. يرجى مراجعتها والمحاولة مرة أخرى.',
  INVALID_RESPONSE: 'لم نتمكن من التأكد من استلام الكافيه لطلبك. يمكنك إعادة المحاولة بأمان.',
  NETWORK_ERROR: 'تعذر الاتصال بالكافيه. تحقق من اتصالك بالإنترنت وأعد المحاولة — لن يتكرر طلبك.',
  TIMEOUT: 'استغرق الرد وقتاً أطول من المعتاد. أعد المحاولة بأمان — لن يتكرر طلبك.',
  SERVICE_UNAVAILABLE: 'نظام الطلبات في الكافيه غير متاح الآن. أعد المحاولة بعد قليل — لن يتكرر طلبك.',
  NOT_CONFIGURED: 'الطلب أونلاين غير متاح حالياً. يمكنك التواصل مع الكافيه مباشرة.',
  UNKNOWN: 'حدث خطأ غير متوقع. يمكنك إعادة المحاولة بأمان.'
};
