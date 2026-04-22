# Design System — Recipe & Meal Planning Agent

## Color Tokens

| Token | Value | Usage |
|---|---|---|
| `surface` | `#fefdf1` | App background (cream) |
| `surface-container-lowest` | `#ffffff` | Floating content cards |
| `surface-container` | — | Subtle inset sections |
| `surface-container-high` | — | Input backgrounds, inactive chips |
| `surface-container-highest` | — | Active input backgrounds |
| `surface-bright` | — | Focused input backgrounds |
| `primary` | `#297300` | Primary actions |
| `primary-container` | `#99f070` | Tag/chip backgrounds |
| `on-primary` | `#ffffff` | Text on primary buttons |
| `on-surface` | `#373830` | Body text, headings |
| `on-surface-variant` | — | Secondary text, labels |
| `outline-variant` | — | Dividers |

---

## Typography

- **Font:** Plus Jakarta Sans (variable weight)
- **Headings:** `text-xl font-semibold text-on-surface`
- **Section labels:** `text-sm font-semibold text-on-surface`
- **Body:** `text-sm text-on-surface`
- **Captions / meta:** `text-xs text-on-surface-variant`

---

## Elevation & Depth

### Card Shadow

All floating content cards (white `bg-surface-container-lowest` cards sitting on the cream `surface` background) **MUST** carry the ambient card shadow:

```
box-shadow: 0 8px 40px rgba(55, 56, 48, 0.06)
```

Use the Tailwind utility `shadow-card` (defined in `tailwind.config.ts`).

**Rules:**
- Shadow color is `on_surface` (#373830) tinted at 6% — never pure black.
- Blur must be ≥ 40px and opacity ≤ 6% to maintain a light, airy feel.
- Auth/modal floating cards use the same shadow — no exceptions.
- Cards embedded inside a dark/colored surface (e.g. a `surface-container` section within an already-elevated card) do **not** receive an additional shadow — shadow is applied once per elevation tier.

---

## Buttons

### Primary Button

Primary action buttons use a **flat solid background**. Gradients on buttons are prohibited.

```
bg-primary text-on-primary rounded-full
```

- Background: `primary` (`#297300`) — flat solid, no gradient
- Text: `on-primary` (`#ffffff`)
- Shape: fully rounded pill (`border-radius: 9999px`)
- Disabled state: `opacity-60` or `opacity-40`
- Hover/active: preserve existing states; do not add gradient overlays

**Sizes:**
- Full-width form submit: `w-full py-3`
- Inline action: `px-6 py-2.5 text-sm`
- Compact: `px-4 py-1.5 text-sm`

### Secondary / Filter Buttons

Inactive filter/chip buttons use `bg-surface-container-high` with `text-on-surface`. When active, they switch to `bg-primary text-on-primary` (same flat solid pattern).

### Accent / Accept Buttons (small)

Small contextual buttons (e.g. "Accept" in invite lists) use `bg-primary px-4 py-1.5 text-xs text-on-primary rounded-full`.

---

## Components

### Content Cards

```tsx
<section className="rounded-card bg-surface-container-lowest shadow-card p-6">
```

- Padding: `p-6` for standard sections, `p-5` for compact, `p-4` for dense, `p-3` for grid cells
- Corner radius: `rounded-card` (2rem = 32px)
- Shadow: `shadow-card` (required on all white cards on cream background)

### Auth / Modal Cards

```tsx
<div className="rounded-card bg-surface-container-lowest shadow-card p-8">
```

Same shadow as content cards. Auth cards are centered on the `surface` background.

### Input Fields

```tsx
<input className="rounded-[1rem] bg-surface-container-highest px-4 py-2.5 text-sm focus:bg-surface-bright focus:outline-none" />
```

### Tag / Chip (active)

```tsx
<span className="rounded-full bg-primary-container px-3 py-0.5 text-xs text-on-surface" />
```

---

## Signature Textures & Glassmorphism

The signature green gradient (`from-primary to-primary-container`) is reserved **exclusively** for:
- Hero banners
- Decorative background accents
- Illustration fills

It is **never** used on interactive action buttons. Buttons must always use the flat solid `primary` color.

Glassmorphism (`backdrop-blur` + semi-transparent surface) may be used for overlay dialogs (e.g. "Add to meal plan" modal) — not for standard content cards.

---

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use `shadow-card` on all white content cards | Skip the shadow on any card sitting on the cream background |
| Use flat `bg-primary` on all primary buttons | Use `bg-gradient-to-br` on action buttons |
| Use `on-surface` (#373830) as the shadow tint color | Use pure black (`rgba(0,0,0,...)`) for shadows |
| Keep button corners fully rounded (pill shape) | Square-corner or slightly-rounded buttons for primary actions |
| Reserve the green gradient for hero/decorative elements | Apply gradients to buttons — use flat solid colors only |
