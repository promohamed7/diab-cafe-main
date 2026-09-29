---
name: Nocturne Reserve
colors:
  surface: '#161311'
  surface-dim: '#161311'
  surface-bright: '#3d3836'
  surface-container-lowest: '#110e0c'
  surface-container-low: '#1e1b19'
  surface-container: '#221f1d'
  surface-container-high: '#2d2927'
  surface-container-highest: '#383431'
  on-surface: '#e9e1dd'
  on-surface-variant: '#d3c4b2'
  inverse-surface: '#e9e1dd'
  inverse-on-surface: '#34302d'
  outline: '#9c8f7e'
  outline-variant: '#4f4537'
  surface-tint: '#f4bd61'
  primary: '#f4bd61'
  on-primary: '#432c00'
  primary-container: '#c8963e'
  on-primary-container: '#4a3100'
  inverse-primary: '#7e5700'
  secondary: '#f0bd8b'
  on-secondary: '#482904'
  secondary-container: '#65411a'
  on-secondary-container: '#e1af7e'
  tertiary: '#b4cdb0'
  on-tertiary: '#203520'
  tertiary-container: '#8da589'
  on-tertiary-container: '#263b25'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdead'
  primary-fixed-dim: '#f4bd61'
  on-primary-fixed: '#281900'
  on-primary-fixed-variant: '#604100'
  secondary-fixed: '#ffdcbd'
  secondary-fixed-dim: '#f0bd8b'
  on-secondary-fixed: '#2c1600'
  on-secondary-fixed-variant: '#623f18'
  tertiary-fixed: '#d0eacb'
  tertiary-fixed-dim: '#b4cdb0'
  on-tertiary-fixed: '#0b200d'
  on-tertiary-fixed-variant: '#364c35'
  background: '#161311'
  on-background: '#e9e1dd'
  surface-variant: '#383431'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Outfit
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Outfit
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.04em
  label-md:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Outfit
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2.5rem
  margin-mobile: 1.25rem
  space-xs: 0.375rem
  space-sm: 0.75rem
  space-md: 1.25rem
  space-lg: 2rem
  space-xl: 3rem
---

## Brand & Style
This design system captures the sensory intimacy of an artisanal evening roastery: natural cut-stone textures, illuminated patio canopies, deep shadows, and the tactile nostalgia of specialty kraft coffee packaging. It bridges classical Middle Eastern coffee traditions (such as single-origin Turkish roasts spiced with mastic and cardamom) with third-wave espresso culture.

The visual style blends **Atmospheric Dark Minimalism** with **Warm Tactile Skeuomorphism**. Rather than sterile flat dark tones, the interface relies on deep charred-wood and roasted-espresso backdrops (#120F0D) layered with soft amber lanterns, subtle brass-foil filigree borders, and parchment-inspired micro-surfaces. The emotional response is welcoming, nocturnal, and prestigious—reminiscent of sitting under a warm veranda string-light canopy savoring freshly pulled single-origin coffee.

## Colors
The palette derives directly from roasted beans, warm amber incandescent patio fixtures, and rich botanical greenery:

- **Primary (`#C8963E` - Warm Amber Gold):** Evokes the glowing patio canopy lanterns and warm architectural wall sconces. Used for primary calls to action, active selection states, price highlights, and key brand badges.
- **Secondary (`#D4A373` - Toasted Kraft / Ochre):** Echoes the printed kraft paper roastery bags and roast profile tags. Used for category chips, secondary badges, and subtle icon accents.
- **Tertiary (`#586F56` - Muted Foliage Green):** Drawn from the agave, ficus, and patio garden greenery seen in the roastery exterior. Used for origin provenance indicators (e.g., Organic, Fair-trade, Single Origin) and herbal/aromatic notes.
- **Neutral Surface Hierarchy:**
  - Canvas Deep: `#120F0D` (Charred espresso bean)
  - Surface Raised: `#1C1714` (Dark walnut timber)
  - Surface Overlay: `#28211C` (Milled roastery stone)
  - Border/Glow: `rgba(200, 150, 62, 0.22)`
  - Text Primary: `#F4EDE4` (Steamed cream parchment)
  - Text Muted: `#A69688` (Warm ash)

## Typography
The typographic hierarchy merges editorial refinement with modern digital clarity:

- **Display & Headlines (Playfair Display):** Conveys the heritage craft of traditional roasters. Italics are reserved for sensory descriptions (e.g., *Notes of roasted hazelnut & wild mastic*).
- **Body & Product Metadata (Outfit):** Provides a clean, modern geometric structure with open counters that remain sharp against high-contrast dark backgrounds.
- **Bilingual Typographic Harmony (Arabic & English):** When rendering Arabic content (such as single-origin labels like *حبشي*, *يمني*, *سبيشيال محوج*), the typeface transitions smoothly to **Cairo** or matches Outfit’s low-contrast geometry, set at a 10% larger font scale to match optical Latin cap-heights.
- Numeric pricing and bean weights (e.g., `1/8k`, `1/4k`, `1k`, `LE 180`) utilize lining figures with heightened letter spacing for instantaneous legibility across digital orders.

## Layout & Spacing
The layout follows an asymmetrical **12-column responsive fluid grid** with generous internal breathing room, mimicking an editorial menu catalog.

- **Desktop (>= 1024px):** 12-column layout with `margin: 2.5rem` and `gutter: 1.25rem`. Two-column ordering splits allow the menu categories and drink cards to sit on the left (8 cols) while an ambient order receipt / bag drawer stays pinned on the right (4 cols).
- **Tablet (768px - 1023px):** 8-column layout with `margin: 1.75rem`. Cards collapse into a dual-column masonry layout.
- **Mobile (< 768px):** 4-column layout with `margin: 1.25rem` and `gutter: 0.75rem`. Full-width modular cards with horizontal scroll chips for quick category hopping (e.g., *Turkish Blend*, *Single Organic*, *Espresso*, *Aromatics*).

## Elevation & Depth
Depth mimics ambient illumination in a dimly lit patio: surfaces are never pure black and rarely employ harsh dropshadows. Instead, elevation is achieved via **luminous amber underglows** and **tonal layering**:

- **Tier 0 (Canvas):** Deepest roast tone (`#120F0D`), non-reflective, grounding the application.
- **Tier 1 (Surface Cards & Items):** `#1C1714` bordered by a whisper of metallic edge lighting (`1px solid rgba(200, 150, 62, 0.16)`).
- **Tier 2 (Elevated & Active Items):** `#28211C` with warm tinted ambient backdrops: `box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.6), 0 0 20px 2px rgba(200, 150, 62, 0.08)`.
- **Tier 3 (Floating Drawers & Modals):** Semi-translucent charred tint (`rgba(22, 18, 15, 0.88)`) with `backdrop-filter: blur(16px)` and a subtle linear gradient border simulating brass framing.

## Shapes
A roundedness factor of `2` (`0.5rem` / `8px` base) delivers architectural solidity balanced with hospitality warmth:
- Product and roast cards use standard `rounded` (`0.5rem`) or `rounded-lg` (`1rem`).
- Specialty weight and size selection tabs (Single, Double, M, L) use `rounded` corners to emulate physical café tokens.
- Add-on tags (Mastic, Saffron, Cardamom) utilize pill forms (`rounded-full`) to differentiate modifiers from foundational items.

## Components

### 1. Drink & Bean Cards
- **Structure:** Encased in dark walnut containers (`#1C1714`) with a fine gold hairline outline. Top photographic zone displays rich coffee imagery with a warm vignette fade.
- **Metadata Layout:** English title in Playfair Display accompanied by its native Arabic title (e.g., *French Blend / فرنساوي كلاسيك*), with notes of roast degree (Light, Medium, Dark Roast) denoted in toasted kraft chips (`#D4A373`).
- **Footer:** Dynamic live price tally and an inline quick-add button that triggers customization drawers.

### 2. Segmented Selectors & Chips
- **Size & Dose (S, D / M, L):** Horizontal pill arrays. Unselected states display muted parchment outlines. Selected state transitions to warm amber background (`#C8963E`) with deep espresso typography (`#120F0D`) in bold.
- **Grind & Weight Chips (`1/8 kg`, `1/4 kg`, `1/2 kg`, `1 kg`):** Tactile segment controls that calculate fresh pricing instantly with smooth numeric cross-fades.

### 3. Traditional Aromatics & Add-on Checkboxes
- Custom circular check controls rimmed with brass gold.
- Aromatics list (e.g., *Mastic / مستكة*, *Saffron / زعفران*, *Cardamom / حبهان*, *Ginseng / جنسنج*) featuring discrete micro-illustrations and price deltas (`+ LE 15`).

### 4. Interactive Order Drawer (Shopping Bag)
- Slides out as a blurred dark glass panel (`rgba(22, 18, 15, 0.94)` with `backdrop-filter: blur(20px)`).
- Contains an itemized list styled like a classic kraft paper ledger, separating coffee origin, grind specifications, and bespoke aromatics.
- Sticky checkout action anchored at the bottom with illuminated warm gold glow.

### 5. Input Fields & Search
- Inputs feature sunken charcoal troughs (`#161210`) with inset shadows and warm gold focus rings (`rgba(200, 150, 62, 0.5)`). Placeholder text set in warm ash (`#A69688`).