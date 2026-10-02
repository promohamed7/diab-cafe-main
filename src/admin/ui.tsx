import React, { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './api';

export function useLoad<T>(load: () => Promise<T>, deps: React.DependencyList): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then((d) => active && (setData(d), setError(null)))
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, loading, reload: useCallback(() => setN((x) => x + 1), []) };
}

/** Runs a save action and tracks its state for a <SaveBar>. */
export function useSave(): { state: SaveState; run: (fn: () => Promise<unknown>) => Promise<boolean> } {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setState({ status: 'saving' });
    try {
      await fn();
      setState({ status: 'saved' });
      return true;
    } catch (e) {
      setState({ status: 'error', message: errorMessage(e) });
      return false;
    }
  }, []);
  return { state, run };
}

export type SaveState = { status: 'idle' | 'saving' | 'saved' } | { status: 'error'; message: string };

export const SaveBar: React.FC<{ state: SaveState; label?: string; disabled?: boolean; note?: string }> = ({ state, label = 'Save', disabled, note }) => (
  <div className="save-bar">
    <button type="submit" className="btn btn-primary" disabled={disabled || state.status === 'saving'}>
      {state.status === 'saving' ? 'Saving…' : label}
    </button>
    {state.status === 'saved' && <span className="save-ok" role="status">Saved</span>}
    {state.status === 'error' && <span className="save-error" role="alert">{state.message}</span>}
    {note && <span className="muted">{note}</span>}
  </div>
);

export const Card: React.FC<{ title?: string; actions?: React.ReactNode; children: React.ReactNode; id?: string }> = ({ title, actions, children, id }) => (
  <section className="card" id={id}>
    {(title || actions) && (
      <header className="card-head">
        {title && <h2>{title}</h2>}
        {actions && <div className="card-actions">{actions}</div>}
      </header>
    )}
    {children}
  </section>
);

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; wide?: boolean }> = ({ label, hint, children, wide }) => (
  <label className={`field ${wide ? 'field-wide' : ''}`}>
    <span className="field-label">{label}</span>
    {children}
    {hint && <span className="field-hint">{hint}</span>}
  </label>
);

export const TextInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
  disabled?: boolean;
  wide?: boolean;
  name?: string;
  placeholder?: string;
  required?: boolean;
}> = ({ label, value, onChange, hint, type = 'text', disabled, wide, name, placeholder, required }) => (
  <Field label={label} hint={hint} wide={wide}>
    <input type={type} value={value} name={name} placeholder={placeholder} required={required} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  </Field>
);

export const TextArea: React.FC<{ label: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number; name?: string }> = ({
  label,
  value,
  onChange,
  hint,
  rows = 3,
  name
}) => (
  <Field label={label} hint={hint} wide>
    <textarea value={value} name={name} rows={rows} onChange={(e) => onChange(e.target.value)} />
  </Field>
);

export const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean; name?: string }> = ({
  label,
  checked,
  onChange,
  hint,
  disabled,
  name
}) => (
  <label className={`toggle ${disabled ? 'is-disabled' : ''}`}>
    <input type="checkbox" name={name} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span>
      <strong>{label}</strong>
      {hint && <small>{hint}</small>}
    </span>
  </label>
);

export const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; optional?: boolean; name?: string }> = ({
  label,
  value,
  onChange,
  optional,
  name
}) => (
  <Field label={label} hint={optional ? 'Optional' : undefined}>
    <span className="color-input">
      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`} />
      <input type="text" name={name} value={value} placeholder={optional ? 'not set' : '#rrggbb'} onChange={(e) => onChange(e.target.value.trim())} />
      {optional && value && (
        <button type="button" className="btn btn-ghost btn-small" onClick={() => onChange('')}>
          Clear
        </button>
      )}
    </span>
  </Field>
);

const BADGE_TONES: Record<string, string> = {
  ACTIVE: 'ok',
  ONLINE: 'ok',
  DELIVERED: 'ok',
  COMPLETED: 'ok',
  DRAFT: 'muted',
  PENDING_PAIRING: 'warn',
  QUEUED: 'warn',
  LEASED: 'warn',
  OFFLINE: 'bad',
  DISABLED: 'bad',
  NOT_CONNECTED: 'bad',
  NOT_DELIVERED: 'bad',
  REJECTED_BY_CAFE: 'bad',
  REJECTED: 'bad',
  CANCELLED: 'bad'
};

export const Badge: React.FC<{ value: string; label?: string }> = ({ value, label }) => (
  <span className={`badge badge-${BADGE_TONES[value] ?? 'muted'}`} data-value={value}>
    {label ?? value.replaceAll('_', ' ').toLowerCase()}
  </span>
);

export const ErrorNote: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <p className="save-error" role="alert">
      {message}
    </p>
  ) : null;

/** Empty string → null, for optional text fields. */
export const orNull = (v: string): string | null => (v.trim() ? v.trim() : null);
