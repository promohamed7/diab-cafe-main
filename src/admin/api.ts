// INBYTE Admin API client. Session lives in an HttpOnly cookie (never readable
// here); every mutation carries the per-session CSRF token.

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'INBYTE_SUPER_ADMIN' | 'INBYTE_OPERATOR';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: string[];
  constructor(status: number, code: string, fields: string[] = []) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const BASE = '/api/admin/v1';
let csrfToken = '';
let onUnauthenticated: () => void = () => undefined;

export function setSession(csrf: string, onExpired: () => void): void {
  csrfToken = csrf;
  onUnauthenticated = onExpired;
}

export async function api<T = any>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = csrfToken;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body)
    });
  } catch {
    throw new AdminApiError(0, 'NETWORK_ERROR');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const code = json?.error?.code ?? 'UNKNOWN';
    if (res.status === 401 && code === 'UNAUTHENTICATED') onUnauthenticated();
    throw new AdminApiError(res.status, code, json?.error?.fields ?? []);
  }
  return json as T;
}

export async function login(email: string, password: string): Promise<{ user: AdminUser; csrfToken: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password })
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new AdminApiError(res.status, json?.error?.code ?? 'UNKNOWN');
  return json;
}

export async function currentSession(): Promise<{ user: AdminUser; csrfToken: string } | null> {
  const res = await fetch(`${BASE}/auth/me`, { credentials: 'same-origin', cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail or password is incorrect (or the account is locked for 15 minutes after 5 failed attempts).',
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again.',
  FORBIDDEN: 'Your role is not allowed to do this. Ask an INBYTE super admin.',
  CSRF_FAILED: 'Your session could not be verified. Reload the page.',
  VALIDATION_FAILED: 'Some values are invalid',
  CONFLICT: 'This already exists (ID, domain or e-mail is taken).',
  TENANT_NOT_FOUND: 'Café not found.',
  NETWORK_ERROR: 'Cannot reach the INBYTE platform.',
  UNAUTHENTICATED: 'Your session expired. Sign in again.',
  PAYLOAD_TOO_LARGE: 'Too large. Use image URLs instead of embedded images.'
};

export function errorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    const base = MESSAGES[error.code] ?? `Request failed (${error.code}).`;
    return error.fields.length ? `${base}: ${error.fields.join(', ')}` : base;
  }
  return 'Unexpected error.';
}

export const centsToAmount = (cents: number | null | undefined): string => (cents === null || cents === undefined ? '' : (cents / 100).toFixed(2));
export const amountToCents = (value: string): number | null => {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
export const formatDateTime = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleString() : '—');
