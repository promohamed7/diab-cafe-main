export interface TenantDetail {
  tenantId: string;
  status: 'DRAFT' | 'ACTIVE' | 'DISABLED';
  displayName: string;
  locale: string;
  currencyCode: string;
  currencySymbol: string;
  identity: Record<string, any>;
  branding: Record<string, any>;
  contact: Record<string, any>;
  content: Record<string, any>;
  businessHoursText: string | null;
  features: { onlineOrdering: boolean; pickup: boolean; delivery: boolean; dineInQr: boolean };
  paymentMethods: string[];
  minimumOrderCents: number | null;
  deliveryAreaText: string | null;
  offlineOrderPolicy: 'REJECT' | 'QUEUE';
  queueTtlMinutes: number;
  configVersion: number;
  configValid: boolean;
  domains: { host: string; isPrimary: boolean; createdAt: string }[];
  siteUrl: string;
  updatedAt: string;
}

export interface TabProps {
  tenant: TenantDetail;
  reload: () => void;
}

export const sectionPath = (tenantId: string, section: string) => `/tenants/${encodeURIComponent(tenantId)}/sections/${section}`;
