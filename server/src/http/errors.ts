// Structured API errors. Responses carry a stable code only — never SQL,
// stack traces, internal IDs or another tenant's data.

export type ApiErrorCode =
  // shared
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  // public / ordering (wire names the website already understands)
  | 'TENANT_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'ORDERING_DISABLED'
  | 'ORDER_TYPE_DISABLED'
  | 'PAYMENT_METHOD_UNAVAILABLE'
  | 'CUSTOMER_DATA_REQUIRED'
  | 'INVALID_TABLE_TOKEN'
  | 'PRODUCT_INACTIVE'
  | 'PRODUCT_UNAVAILABLE'
  | 'INVALID_MODIFIER_OPTION'
  | 'PRICE_TAMPERED_MISMATCH'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'MENU_NOT_SYNCED'
  | 'STORE_OFFLINE'
  | 'SERVICE_UNAVAILABLE'
  // admin
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CSRF_FAILED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'CONFLICT'
  // connector
  | 'INVALID_CREDENTIAL'
  | 'INVALID_PAIRING_CODE'
  | 'CONNECTION_REVOKED'
  | 'INVALID_TRANSITION'
  | 'RESULT_CONFLICT';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  /** Safe, field-level hints (field names only, no values). */
  readonly fields: string[] | undefined;

  constructor(statusCode: number, code: ApiErrorCode, fields?: string[]) {
    super(code);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

export const notFound = (code: ApiErrorCode = 'NOT_FOUND') => new ApiError(404, code);
export const badRequest = (code: ApiErrorCode = 'VALIDATION_FAILED', fields?: string[]) => new ApiError(400, code, fields);
export const forbidden = (code: ApiErrorCode = 'FORBIDDEN') => new ApiError(403, code);
export const conflict = (code: ApiErrorCode = 'CONFLICT') => new ApiError(409, code);
export const unprocessable = (code: ApiErrorCode) => new ApiError(422, code);
