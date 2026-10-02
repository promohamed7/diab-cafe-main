// Turns a tenant's branding into CSS custom properties on top of the shared
// design tokens (src/styles/tokens.css). One stylesheet serves every café; only
// variable values change. No per-café CSS exists anywhere.

import type { TenantBranding, TenantColorSet, TenantSurfaceSet } from '../types/tenant.ts';

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
}

/** Linear mix: weight 0 → a, 1 → b. */
export function mix(a: string, b: string, weight: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * weight) as Rgb);
}

function channels(hex: string): string {
  return hexToRgb(hex).join(', ');
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Dark or light text, whichever contrasts better with `background`. */
export function readableOn(background: string): string {
  return luminance(background) > 0.35 ? '#120F0D' : '#FFFFFF';
}

/**
 * CSS variables for one theme mode. Every variable listed here exists in
 * tokens.css; the tenant only changes values.
 */
export function themeVariables(branding: TenantBranding, mode: 'dark' | 'light'): Record<string, string> {
  const colors: TenantColorSet = mode === 'light' ? branding.lightColors ?? branding.colors : branding.colors;
  const primary = colors.primary;
  const deep = colors.primaryDeep ?? mix(primary, '#000000', 0.2);
  const vars: Record<string, string> = {
    '--primary': primary,
    '--primary-fixed-dim': primary,
    '--surface-tint': primary,
    '--amber-gold': mode === 'dark' ? deep : primary,
    '--primary-container': mode === 'dark' ? deep : mix(primary, '#ffffff', 0.9),
    '--on-primary': readableOn(primary),
    '--on-primary-container': mode === 'dark' ? readableOn(deep) : mix(primary, '#000000', 0.6),
    '--brand-rgb': channels(primary),
    '--brand-deep-rgb': channels(deep),
    '--on-brand': readableOn(primary)
  };
  if (colors.secondary) {
    vars['--secondary'] = colors.secondary;
    vars['--toasted-kraft'] = colors.secondary;
  }
  if (colors.accent) {
    vars['--tertiary'] = colors.accent;
    vars['--foliage-green'] = colors.accent;
  }

  const surfaces: TenantSurfaceSet | undefined = branding.surfaces?.[mode];
  if (surfaces?.background) {
    const bg = surfaces.background;
    Object.assign(vars, {
      '--background': bg,
      '--surface': bg,
      '--surface-dim': bg,
      '--canvas-deep': bg,
      '--surface-container-lowest': bg
    });
  }
  if (surfaces?.surface) {
    const sf = surfaces.surface;
    const towards = mode === 'dark' ? '#ffffff' : '#000000';
    Object.assign(vars, {
      '--surface-container-low': sf,
      '--surface-container': sf,
      '--surface-raised': sf,
      '--surface-container-high': mix(sf, towards, 0.05),
      '--surface-container-highest': mix(sf, towards, 0.1),
      '--surface-variant': mix(sf, towards, 0.1)
    });
  }
  if (surfaces?.text) {
    const tx = surfaces.text;
    const against = surfaces.background ?? (mode === 'dark' ? '#161311' : '#FDFBF7');
    Object.assign(vars, {
      '--on-surface': tx,
      '--on-background': tx,
      '--text-primary': tx,
      '--on-surface-variant': mix(tx, against, 0.28),
      '--text-muted': mix(tx, against, 0.4)
    });
  }
  if (branding.fontFamily) {
    const font = `'${branding.fontFamily}', 'Cairo', sans-serif`;
    vars['--ff-arabic'] = font;
    vars['--ff-body'] = font;
  }
  return vars;
}
