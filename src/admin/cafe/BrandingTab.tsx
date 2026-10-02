import React, { useState } from 'react';
import { api } from '../api';
import { Card, ColorInput, Field, SaveBar, TextInput, Toggle, useSave } from '../ui';
import type { TabProps } from './types';
import { sectionPath } from './types';

type Colors = { primary: string; primaryDeep: string; secondary: string; accent: string };
type Surface = { background: string; surface: string; text: string };

const colorsFrom = (c: Record<string, string> | undefined): Colors => ({
  primary: c?.primary ?? '#c8963e',
  primaryDeep: c?.primaryDeep ?? '',
  secondary: c?.secondary ?? '',
  accent: c?.accent ?? ''
});
const surfaceFrom = (s: Record<string, string> | undefined): Surface => ({ background: s?.background ?? '', surface: s?.surface ?? '', text: s?.text ?? '' });

/** Drop empty optional values so the API stores only what was set. */
function compact<T extends Record<string, string>>(o: T): Partial<T> | undefined {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as Partial<T>;
  return Object.keys(out).length ? out : undefined;
}

const ColorSetEditor: React.FC<{ value: Colors; onChange: (v: Colors) => void; prefix: string }> = ({ value, onChange, prefix }) => (
  <div className="form-grid">
    <ColorInput label="Primary" name={`${prefix}-primary`} value={value.primary} onChange={(v) => onChange({ ...value, primary: v })} />
    <ColorInput label="Primary (deep)" value={value.primaryDeep} onChange={(v) => onChange({ ...value, primaryDeep: v })} optional />
    <ColorInput label="Secondary" value={value.secondary} onChange={(v) => onChange({ ...value, secondary: v })} optional />
    <ColorInput label="Accent" value={value.accent} onChange={(v) => onChange({ ...value, accent: v })} optional />
  </div>
);

const SurfaceEditor: React.FC<{ value: Surface; onChange: (v: Surface) => void }> = ({ value, onChange }) => (
  <div className="form-grid">
    <ColorInput label="Background" value={value.background} onChange={(v) => onChange({ ...value, background: v })} optional />
    <ColorInput label="Cards / surfaces" value={value.surface} onChange={(v) => onChange({ ...value, surface: v })} optional />
    <ColorInput label="Text" value={value.text} onChange={(v) => onChange({ ...value, text: v })} optional />
  </div>
);

const Preview: React.FC<{ colors: Colors; surface: Surface; mode: 'dark' | 'light'; name: string }> = ({ colors, surface, mode, name }) => {
  const bg = surface.background || (mode === 'dark' ? '#161311' : '#fff8f3');
  const card = surface.surface || (mode === 'dark' ? '#221f1d' : '#ffffff');
  const text = surface.text || (mode === 'dark' ? '#e9e1dd' : '#1e1b19');
  return (
    <div className="brand-preview" style={{ background: bg, color: text }} aria-label={`${mode} preview`}>
      <strong style={{ color: colors.primary }}>{name}</strong>
      <div className="brand-preview-card" style={{ background: card }}>
        <span>Latte</span>
        <span style={{ color: colors.primary, fontWeight: 800 }}>55.00</span>
      </div>
      <button type="button" style={{ background: colors.primary, color: '#1b1209', border: 0, borderRadius: 999, padding: '6px 14px', fontWeight: 700 }}>
        Order now
      </button>
    </div>
  );
};

export const BrandingTab: React.FC<TabProps> = ({ tenant, reload }) => {
  const b = tenant.branding;
  const [colors, setColors] = useState(colorsFrom(b.colors));
  const [useLight, setUseLight] = useState(!!b.lightColors);
  const [lightColors, setLightColors] = useState(colorsFrom(b.lightColors ?? b.colors));
  const [dark, setDark] = useState(surfaceFrom(b.surfaces?.dark));
  const [light, setLight] = useState(surfaceFrom(b.surfaces?.light));
  const [defaultTheme, setDefaultTheme] = useState<'dark' | 'light'>(b.defaultTheme === 'light' ? 'light' : 'dark');
  const [fontFamily, setFontFamily] = useState<string>(b.fontFamily ?? '');
  const [fontStylesheetUrl, setFontStylesheetUrl] = useState<string>(b.fontStylesheetUrl ?? '');
  const save = useSave();

  return (
    <div className="tab-body">
      <form
        id="branding-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const surfaces = { dark: compact(dark), light: compact(light) };
          const body = {
            colors: compact(colors),
            lightColors: useLight ? compact(lightColors) : null,
            surfaces: surfaces.dark || surfaces.light ? surfaces : undefined,
            defaultTheme,
            fontFamily: fontFamily.trim() || null,
            fontStylesheetUrl: fontStylesheetUrl.trim() || null
          };
          if (await save.run(() => api('PUT', sectionPath(tenant.tenantId, 'branding'), body))) reload();
        }}
      >
        <Card title="Brand colours">
          <ColorSetEditor value={colors} onChange={setColors} prefix="dark" />
          <Toggle label="Different colours in light mode" checked={useLight} onChange={setUseLight} />
          {useLight && <ColorSetEditor value={lightColors} onChange={setLightColors} prefix="light" />}
        </Card>
        <Card title="Surfaces">
          <h3>Dark mode</h3>
          <SurfaceEditor value={dark} onChange={setDark} />
          <h3>Light mode</h3>
          <SurfaceEditor value={light} onChange={setLight} />
        </Card>
        <Card title="Theme and typography">
          <div className="form-grid">
            <Field label="Default theme" hint="Visitors can still switch.">
              <select value={defaultTheme} name="defaultTheme" onChange={(e) => setDefaultTheme(e.target.value as 'dark' | 'light')}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </Field>
            <TextInput label="Font family" value={fontFamily} onChange={setFontFamily} hint="Optional, e.g. Tajawal" />
            <TextInput label="Font stylesheet URL" value={fontStylesheetUrl} onChange={setFontStylesheetUrl} hint="https only, e.g. Google Fonts CSS URL" wide />
          </div>
        </Card>
        <Card title="Preview">
          <div className="preview-row">
            <Preview colors={colors} surface={dark} mode="dark" name={tenant.displayName} />
            <Preview colors={useLight ? lightColors : colors} surface={light} mode="light" name={tenant.displayName} />
          </div>
        </Card>
        <SaveBar state={save.state} label="Save branding" />
      </form>
    </div>
  );
};
