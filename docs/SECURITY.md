# Security

The backend is internet-facing. Zones: **untrusted** (browsers), **INBYTE staff** (admin sessions), **café machines** (connector credentials). INBYTE Café's database is never reachable from any of them.

| Control | Implementation | Tested in |
|---|---|---|
| Tenant authorization | café from path (public) / credential (connector); every query scoped by café UUID; host binding for custom domains | `tenancy.test.ts` |
| Admin authentication | scrypt (N=32768) passwords ≥12 chars; server-side sessions (256-bit token, hashed at rest); 12 h absolute / 120 min idle; same error for unknown e-mail, wrong password, disabled or locked account | `security.test.ts` |
| Lockout | 5 failed logins → 15 min lock; super admin can unlock | `security.test.ts` |
| Session cookie | `HttpOnly`, `SameSite=Strict`, `Path=/api/admin`, `Secure` in production | `security.test.ts`, e2e E1 |
| CSRF | per-session token in `X-CSRF-Token` on every mutation + Origin check (`ADMIN_ORIGINS` for extra origins) | `security.test.ts` |
| Role authorization | super admin vs operator checked per route on the server | `security.test.ts`, e2e E15 |
| Session hygiene | logout revokes; password change revokes other sessions; deactivation/role change revokes the user's sessions | `security.test.ts` |
| Connector auth | one-time hashed pairing code (15 min, single use, 10/min/IP); 256-bit bearer credential stored as SHA-256; revocation immediate | `integration.test.ts` |
| Input validation | zod schemas; admin bodies strict (unknown fields rejected); public order schema has no price/status fields; connector snapshots allow-listed; tenant config re-validated with the website parser; URL fields http(s)/relative/data-image only; colours hex only | all suites |
| Price authority | server recomputes estimate from Café's synced prices; mismatching `expectedTotalCents` → 409; Café recomputes again | `orders.test.ts`, e2e E11 |
| Rate limits | per IP per minute: login 10, pairing 10, orders 20, table resolve 30, tracking 60, reads 240 (`RATE_LIMIT_SCALE` multiplies) | `security.test.ts` |
| Size limits | 256 KB default, 32 KB orders, 1 MB admin config sections, 4 MB catalog snapshots | `security.test.ts` |
| Non-enumerable references | 80-bit random public references; malformed = unknown = 404 | `orders.test.ts` |
| No internal leakage | errors are `{error:{code, fields?}}` only; public responses allow-listed; no DB IDs, cashier, shift, cost, contact data | `orders.test.ts`, `security.test.ts` |
| Secrets | `DATABASE_URL` and credentials only in server env; nothing secret in `VITE_*`; audit log never stores passwords, codes, credentials | `security.test.ts` |
| Audit | admin and connector actions (create, configure, status, domains, presentation, tables, pairing, revocation, admin accounts, logins, lockouts, order views) | `security.test.ts`, e2e E16 |
| CORS | same-origin by default; `PUBLIC_CORS_ORIGINS` may read the public API only, without credentials; no CORS on admin/connector | — |
| Headers | `nosniff`, `Referrer-Policy`, CSP for customer site and admin, `X-Frame-Options` (admin `DENY`), HSTS in production, `no-store` on admin/connector | `security.test.ts` |
| Privacy | contact data erased after retention; viewing it in the admin is audited | `orders.test.ts` |

## Operating notes

- Run behind TLS; set `TRUST_PROXY_HOPS` to the exact number of proxies so client IPs (rate limits, audit) are correct.
- Rate limits are per process; for several instances add a shared store or limit at the proxy.
- Rotate a café's connector by issuing a new pairing code (revokes the old credential).
- Images and fonts are referenced by URL (https); the customer CSP allows https images/styles/fonts so cafés can use their own assets.

## Known limits

No MFA for admins yet; no IP allow-listing for `/admin`; rate limiting is in-memory; table tokens are stored in plain text (they are printed on tables, scoped to one café and switchable off per table).
