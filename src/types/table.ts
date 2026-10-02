// Dine-in table context. The token comes from the Café-issued QR URL and is
// carried through the order unchanged. The label comes from Café.

export interface ResolvedTable {
  /** Customer-facing table name/number as published by Café. */
  tableLabel: string;
}

export interface TableContext extends ResolvedTable {
  /** Opaque Café-issued capability token. Never built or edited by the website. */
  token: string;
  /** Epoch ms when Café confirmed the token. Used to expire stale dine-in sessions. */
  resolvedAt: number;
}
