import React, { useState } from 'react';
import type { AdminUser } from '../api';
import { errorMessage, login } from '../api';

export const LoginPage: React.FC<{ onSignedIn: (user: AdminUser, csrf: string) => void }> = ({ onSignedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="login-page">
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const res = await login(email, password);
            onSignedIn(res.user, res.csrfToken);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>INBYTE Admin</h1>
        <p className="muted">Internal administration of the INBYTE Digital Menu Platform.</p>
        <label className="field">
          <span className="field-label">E-mail</span>
          <input type="email" name="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <p className="save-error" role="alert" id="login-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
};
