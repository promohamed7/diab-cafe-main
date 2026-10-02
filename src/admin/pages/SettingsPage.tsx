import React, { useState } from 'react';
import { useSession } from '../session';
import type { AdminUser } from '../api';
import { api, formatDateTime } from '../api';
import { Badge, Card, ErrorNote, Field, SaveBar, TextInput, useLoad, useSave } from '../ui';

const ChangePassword: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const save = useSave();
  return (
    <Card title="Change my password">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await save.run(() => api('POST', '/auth/password', { currentPassword: current, newPassword: next }))) {
            setCurrent('');
            setNext('');
          }
        }}
      >
        <div className="form-grid">
          <TextInput label="Current password" type="password" value={current} onChange={setCurrent} />
          <TextInput label="New password" type="password" value={next} onChange={setNext} hint="At least 12 characters. Other sessions are signed out." />
        </div>
        <SaveBar state={save.state} label="Change password" />
      </form>
    </Card>
  );
};

const AdminUsers: React.FC = () => {
  const { user: me } = useSession();
  const { data, error, reload } = useLoad(() => api<{ users: AdminUser[] }>('GET', '/admin-users'), []);
  const [form, setForm] = useState({ email: '', displayName: '', role: 'INBYTE_OPERATOR', password: '' });
  const create = useSave();
  const update = useSave();
  return (
    <Card title="INBYTE administrators">
      <ErrorNote message={error} />
      {update.state.status === 'error' && <ErrorNote message={update.state.message} />}
      <table className="table" id="admin-users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last login</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.displayName}
                <div className="muted">{u.email}</div>
              </td>
              <td>{u.role === 'INBYTE_SUPER_ADMIN' ? 'Super admin' : 'Operator'}</td>
              <td>
                <Badge value={u.isActive ? 'ACTIVE' : 'DISABLED'} />
              </td>
              <td className="muted">{formatDateTime(u.lastLoginAt)}</td>
              <td>
                {u.id !== me.id && (
                  <>
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => update.run(() => api('PATCH', `/admin-users/${u.id}`, { isActive: !u.isActive })).then(reload)}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => update.run(() => api('PATCH', `/admin-users/${u.id}`, { unlock: true })).then(reload)}>
                      Unlock
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Add administrator</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await create.run(() => api('POST', '/admin-users', form))) {
            setForm({ email: '', displayName: '', role: 'INBYTE_OPERATOR', password: '' });
            reload();
          }
        }}
      >
        <div className="form-grid">
          <TextInput label="Name" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
          <TextInput label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Role">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="INBYTE_OPERATOR">Operator — configures cafés</option>
              <option value="INBYTE_SUPER_ADMIN">Super admin — everything</option>
            </select>
          </Field>
          <TextInput label="Initial password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} hint="At least 12 characters" />
        </div>
        <SaveBar state={create.state} label="Add administrator" />
      </form>
    </Card>
  );
};

export const SettingsPage: React.FC = () => {
  const { isSuper } = useSession();
  return (
    <>
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      <ChangePassword />
      {isSuper && <AdminUsers />}
    </>
  );
};
