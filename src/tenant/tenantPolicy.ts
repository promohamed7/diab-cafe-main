// What a tenant allows, derived from its configuration. Pure functions so the
// rules are the same everywhere (UI, checkout guard, tests).

import type { CafePaymentMethod, TenantConfig } from '../types/tenant.ts';
import type { OrderType, OutsideOrderType, PaymentMethod } from '../types/order.ts';

/**
 * Methods the website can offer today: both are settled with staff at handover.
 * Transfer methods (INSTAPAY, WALLET, BANK_TRANSFER) need a payment reference
 * that INBYTE Café currently discards, and ONLINE_PAID needs a gateway — they are
 * ignored even if a tenant lists them, until Café supports them.
 */
export const WEBSITE_SUPPORTED_PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'CREDIT_CARD'];

export function offeredPaymentMethods(tenant: TenantConfig): PaymentMethod[] {
  return tenant.paymentMethods.filter((m: CafePaymentMethod): m is PaymentMethod =>
    (WEBSITE_SUPPORTED_PAYMENT_METHODS as readonly string[]).includes(m)
  );
}

export function enabledOutsideOrderTypes(tenant: TenantConfig): OutsideOrderType[] {
  if (!tenant.features.onlineOrdering) return [];
  const types: OutsideOrderType[] = [];
  if (tenant.features.pickup) types.push('PICKUP');
  if (tenant.features.delivery) types.push('DELIVERY');
  return types;
}

export function isDineInEnabled(tenant: TenantConfig): boolean {
  return tenant.features.onlineOrdering && tenant.features.dineInQr;
}

export function isOrderTypeEnabled(tenant: TenantConfig, type: OrderType): boolean {
  if (type === 'DINE_IN') return isDineInEnabled(tenant);
  return enabledOutsideOrderTypes(tenant).includes(type);
}

/** Ordering is possible only with at least one journey and one payment method the site can offer. */
export function canAcceptOrders(tenant: TenantConfig): boolean {
  return (
    (enabledOutsideOrderTypes(tenant).length > 0 || isDineInEnabled(tenant)) &&
    offeredPaymentMethods(tenant).length > 0
  );
}

export function meetsMinimumOrder(tenant: TenantConfig, estimatedTotalCents: number | null): boolean {
  const min = tenant.ordering.minimumOrderCents;
  return min === null || (estimatedTotalCents !== null && estimatedTotalCents >= min);
}
