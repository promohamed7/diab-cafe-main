import React, { useState } from 'react';
import { api, centsToAmount, formatDateTime } from '../api';
import { Badge, Card, ErrorNote, useLoad } from '../ui';
import type { TabProps } from './types';

interface OrderRow {
  publicReference: string;
  orderType: string;
  tableLabel: string | null;
  paymentMethod: string;
  estimatedTotalCents: number;
  totalCents: number | null;
  orderNumber: string | null;
  orderStatus: string;
  paymentStatus: string;
  deliveryState: string;
  deliveryAttempts: number;
  createdAt: string;
}

const OrderDetail: React.FC<{ tenantId: string; reference: string; symbol: string; onClose: () => void }> = ({ tenantId, reference, symbol, onClose }) => {
  const { data, error } = useLoad(() => api<any>('GET', `/tenants/${tenantId}/orders/${encodeURIComponent(reference)}`), [reference]);
  return (
    <Card title={`Order ${reference}`} actions={<button type="button" className="btn btn-ghost btn-small" onClick={onClose}>Close</button>} id="order-detail">
      <ErrorNote message={error} />
      {data && (
        <div className="detail-grid">
          <div>
            <h3>Café</h3>
            <p>
              Order number: <strong>{data.cafe.orderNumber ?? '— (not created in Café yet)'}</strong>
            </p>
            <p>
              Café total: {data.cafe.totalCents === null ? '—' : `${centsToAmount(data.cafe.totalCents)} ${symbol}`} · estimate {centsToAmount(data.estimatedTotalCents)} {symbol}
            </p>
            <p>
              <Badge value={data.deliveryState} /> <Badge value={data.orderStatus} /> payment {data.paymentStatus.toLowerCase()}
            </p>
            {data.rejectionCode && <p className="save-error">Rejected by Café: {data.rejectionCode}</p>}
            <h3>Items</h3>
            <ul className="plain-list">
              {data.items.map((i: any) => (
                <li key={`${i.productId}-${i.modifierOptionIds.join(',')}`}>
                  {i.quantity} × {i.productName} <span className="muted mono">#{i.productId}{i.modifierOptionIds.length ? ` +[${i.modifierOptionIds.join(', ')}]` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Customer</h3>
            {data.customer ? (
              <p>
                {data.customer.fullName ?? '—'} · {data.customer.phone ?? '—'}
                {data.customer.deliveryAddress && <><br />{data.customer.deliveryAddress}</>}
                {data.customer.notes && <><br /><em>{data.customer.notes}</em></>}
              </p>
            ) : (
              <p className="muted">Erased after the retention period.</p>
            )}
            <h3>History</h3>
            <ol className="plain-list">
              {data.history.map((h: any, i: number) => (
                <li key={i}>
                  <span className="muted">{formatDateTime(h.at)}</span> {h.source.toLowerCase()} — {h.deliveryState.toLowerCase()} / {h.orderStatus.toLowerCase()}
                  {h.note && <span className="muted"> ({h.note})</span>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Card>
  );
};

export const OrdersTab: React.FC<TabProps> = ({ tenant }) => {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const { data, error, reload } = useLoad(
    () => api<{ orders: OrderRow[] }>('GET', `/tenants/${tenant.tenantId}/orders${filter ? `?deliveryState=${filter}` : ''}`),
    [tenant.tenantId, filter]
  );
  return (
    <div className="tab-body">
      <Card
        title="Orders"
        actions={
          <>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by delivery state">
              <option value="">All</option>
              <option value="QUEUED">Queued</option>
              <option value="LEASED">Being delivered</option>
              <option value="DELIVERED">In Café</option>
              <option value="REJECTED_BY_CAFE">Rejected by Café</option>
              <option value="NOT_DELIVERED">Not delivered</option>
            </select>
            <button type="button" className="btn btn-ghost btn-small" onClick={reload}>
              Refresh
            </button>
          </>
        }
      >
        <p className="muted">Read only. Order status and payment are controlled by staff in INBYTE Café; this view shows what Café reported.</p>
        <ErrorNote message={error} />
        <table className="table" id="orders-table">
          <thead>
            <tr>
              <th>Placed</th>
              <th>Reference</th>
              <th>Café #</th>
              <th>Type</th>
              <th>Delivery</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data?.orders.map((o) => (
              <tr key={o.publicReference} className="clickable" onClick={() => setSelected(o.publicReference)} data-reference={o.publicReference}>
                <td>{formatDateTime(o.createdAt)}</td>
                <td className="mono">{o.publicReference}</td>
                <td className="mono">{o.orderNumber ?? '—'}</td>
                <td>
                  {o.orderType.toLowerCase()}
                  {o.tableLabel && <div className="muted">{o.tableLabel}</div>}
                </td>
                <td>
                  <Badge value={o.deliveryState} />
                </td>
                <td>
                  <Badge value={o.orderStatus} />
                </td>
                <td className="mono">
                  {o.totalCents !== null ? centsToAmount(o.totalCents) : <span className="muted">~{centsToAmount(o.estimatedTotalCents)}</span>} {tenant.currencySymbol}
                </td>
              </tr>
            ))}
            {data && data.orders.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No orders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {selected && <OrderDetail tenantId={tenant.tenantId} reference={selected} symbol={tenant.currencySymbol} onClose={() => setSelected(null)} />}
    </div>
  );
};
