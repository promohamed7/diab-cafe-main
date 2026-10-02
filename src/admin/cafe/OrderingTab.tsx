import React, { useState } from 'react';
import { amountToCents, api, centsToAmount } from '../api';
import { Card, Field, SaveBar, TextInput, Toggle, orNull, useSave } from '../ui';
import type { TabProps } from './types';
import { sectionPath } from './types';

const METHODS: { value: string; label: string; supported: boolean }[] = [
  { value: 'CASH', label: 'Cash (at handover)', supported: true },
  { value: 'CREDIT_CARD', label: 'Card (at handover)', supported: true },
  { value: 'INSTAPAY', label: 'InstaPay', supported: false },
  { value: 'WALLET', label: 'Mobile wallet', supported: false },
  { value: 'BANK_TRANSFER', label: 'Bank transfer', supported: false },
  { value: 'ONLINE_PAID', label: 'Online payment gateway', supported: false }
];

export const OrderingTab: React.FC<TabProps> = ({ tenant, reload }) => {
  const [features, setFeatures] = useState(tenant.features);
  const [methods, setMethods] = useState<string[]>(tenant.paymentMethods);
  const [minimum, setMinimum] = useState(centsToAmount(tenant.minimumOrderCents));
  const [deliveryArea, setDeliveryArea] = useState(tenant.deliveryAreaText ?? '');
  const [policy, setPolicy] = useState(tenant.offlineOrderPolicy);
  const [ttl, setTtl] = useState(String(tenant.queueTtlMinutes));
  const save = useSave();
  const setFeature = (k: keyof typeof features) => (v: boolean) => setFeatures({ ...features, [k]: v });

  return (
    <div className="tab-body">
      <form
        id="ordering-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = {
            ...features,
            paymentMethods: methods,
            minimumOrderCents: amountToCents(minimum),
            deliveryAreaText: orNull(deliveryArea),
            offlineOrderPolicy: policy,
            queueTtlMinutes: Math.min(240, Math.max(1, Number(ttl) || 15))
          };
          if (await save.run(() => api('PUT', sectionPath(tenant.tenantId, 'ordering'), body))) reload();
        }}
      >
        <Card title="Customer journeys">
          <Toggle
            label="Online ordering"
            name="onlineOrdering"
            checked={features.onlineOrdering}
            onChange={setFeature('onlineOrdering')}
            hint="Off = browse-only digital menu."
          />
          <Toggle label="Pickup (ONLINE + PICKUP)" name="pickup" checked={features.pickup} onChange={setFeature('pickup')} disabled={!features.onlineOrdering} />
          <Toggle label="Delivery (ONLINE + DELIVERY)" name="delivery" checked={features.delivery} onChange={setFeature('delivery')} disabled={!features.onlineOrdering} />
          <Toggle
            label="Dine-in from table QR (TABLE_QR + DINE_IN)"
            name="dineInQr"
            checked={features.dineInQr}
            onChange={setFeature('dineInQr')}
            disabled={!features.onlineOrdering}
            hint="Uses the table tokens issued by INBYTE Café."
          />
        </Card>
        <Card title="Payment methods">
          <p className="muted">The website offers only methods settled with staff at handover. Others can be recorded but are not offered until INBYTE Café supports them.</p>
          {METHODS.map((m) => (
            <Toggle
              key={m.value}
              name={`pay-${m.value}`}
              label={m.label}
              hint={m.supported ? undefined : 'Not offered on the website yet'}
              checked={methods.includes(m.value)}
              onChange={(on) => setMethods(on ? [...methods, m.value] : methods.filter((x) => x !== m.value))}
            />
          ))}
        </Card>
        <Card title="Rules">
          <div className="form-grid">
            <TextInput label={`Minimum order (${tenant.currencySymbol})`} name="minimumOrder" value={minimum} onChange={setMinimum} hint="Leave empty for none. Checked on the estimate." />
            <TextInput label="Delivery area" value={deliveryArea} onChange={setDeliveryArea} hint="Shown to customers (no zone logic, no fee)." wide />
          </div>
        </Card>
        <Card title="When the café’s POS is offline">
          <Field label="Policy">
            <select value={policy} name="offlinePolicy" onChange={(e) => setPolicy(e.target.value as 'REJECT' | 'QUEUE')}>
              <option value="REJECT">Refuse new orders (customer sees “temporarily unavailable”)</option>
              <option value="QUEUE">Accept and queue for a limited time</option>
            </select>
          </Field>
          <TextInput
            label="Queue time (minutes)"
            value={ttl}
            onChange={setTtl}
            hint="An order the café hasn’t picked up within this time is closed as “not delivered” — never silently placed later."
          />
        </Card>
        <SaveBar state={save.state} label="Save ordering" />
      </form>
    </div>
  );
};
