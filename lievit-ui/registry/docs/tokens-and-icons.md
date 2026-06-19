<!--
Copyright 2026 Francesco Bilotta
Licensed under the Apache License, Version 2.0 (the "License").
-->

# Tokens and icons (lievit-ui v2)

The two foundation pieces every other lievit-ui component depends on: the `--lv-*` design
tokens and the Lucide icon partial.

## Design tokens (`registry/tokens/lievit-tokens.css`)

The token file is the brand-able seam. Components reference tokens by custom-property name,
never by literal value, so a rebrand is a token override, not a component edit.

### Install

Import the stylesheet once from your global CSS (or copy it in via `lievit add tokens`):

```css
@import "styles/lievit-tokens.css";
```

### The vocabulary

| Group | Tokens | Notes |
|---|---|---|
| Surfaces / text | `--lv-color-bg` `--lv-color-fg` `--lv-color-surface(-fg)` `--lv-color-card(-fg)` `--lv-color-popover(-fg)` `--lv-color-muted(-fg/-bg)` | page, raised, card, popover surfaces |
| Semantic intents | `--lv-color-{primary,secondary,accent,destructive,success,warning,info,danger}` each with a paired `-fg` | `destructive` is the shadcn name; `danger` is its alias (kept for the v0.1 components) |
| Borders / focus | `--lv-color-border` `--lv-color-input` `--lv-color-ring` `--lv-ring` | `--lv-ring` is the ready-made `box-shadow` focus ring |
| Data-viz / shell | `--lv-color-chart-1..5` `--lv-color-sidebar(-fg/-border/-accent/-accent-fg)` | charts + the app-shell sidebar |
| Radius | `--lv-radius` (base) `--lv-radius-{sm,md,lg,xl,full}` | override `--lv-radius` to round everything |
| Spacing | `--lv-space-{0,px,1..6,8,10,12,16}` | 0.25rem (4px) scale |
| Type | `--lv-font-{sans,mono}` `--lv-text-{xs,sm,base,lg,xl,2xl,3xl}` `--lv-font-{normal,medium,semibold,bold}` `--lv-leading{,-none,-tight,-normal,-relaxed}` | |
| Elevation | `--lv-shadow-{xs,sm,md,lg,xl}` | |
| Z-index | `--lv-z-{base,dropdown,sticky,overlay,modal,popover,toast}` | the overlay stacking contract |
| Motion | `--lv-duration{,-fast,-slow}` `--lv-ease{,-in,-out}` | |
| Icon | `--lv-icon-size` `--lv-icon-stroke` | consumed by the icon partial |

### Rebranding

Override the ~20 brand tokens in `:root` (in any colour format -- hex, OKLCH, hsl); every
component follows. The values default to a neutral professional palette mapped from shadcn's
new-york-v4 theme.

```css
:root {
  --lv-color-primary: #7c3aed;     /* your brand */
  --lv-color-primary-fg: #ffffff;
  --lv-radius: 0.75rem;            /* rounder */
  --lv-font-sans: "Inter", system-ui, sans-serif;
}
```

### Dark mode

A single `.dark, [data-theme="dark"]` block re-points the colour (and shadow) tokens; the
structural tokens (spacing, radius, type, z, motion) are theme-invariant and never repeated.
Toggle it by putting `class="dark"` or `data-theme="dark"` on `<html>`:

```html
<html class="dark"> ... </html>
```

## Icons (`registry/jte/icon.jte` + `registry/icons/`)

Icons are **Lucide** (ISC, https://lucide.dev), delivered **inline-per-name** (not a sprite):
the JTE partial renders the uniform `<svg>` wrapper styled by tokens, and the per-icon body
comes from a generated lookup that contains **only the icons you vendored** (tree-shaken).
This replaces Web Awesome's `<wa-icon>` -- no web component, no font, no extra request.

### Why inline-per-name (not a sprite)

Tree-shakeable by construction (ship only what you vendor), zero JS, zero extra HTTP request,
CSP-clean (no `<use href>`), and "add an icon" is a one-file drop. A sprite's only edge
(byte savings when one icon repeats many times) is marginal here and costs the copy-in
simplicity. See the rationale comment at the top of `icon.jte`.

### Use it (JTE)

```jte
@template.icon(name = "chevron-down")
@template.icon(name = "trash-2", cssClass = "text-[var(--lv-color-danger)]")
@template.icon(name = "search", size = "1.25rem")
@template.icon(name = "settings", label = "Open settings")   @* labelled: role=img *@
```

- `name` (required): a vendored Lucide icon name.
- `size` (default `var(--lv-icon-size)` = `1em`): width/height; the icon inherits text size.
- `cssClass` (default `""`): extra classes; Lucide strokes with `currentColor`, so any
  `text-*` Tailwind utility or `--lv-color-*` on a wrapping element tints it.
- `label` (default `null`): when omitted the icon is **decorative** (`aria-hidden="true"`,
  `focusable="false"`); pass a label to expose it to assistive tech (`role="img"`).

The partial imports the body lookup statically:
`@import static it.housetreespa.gest.ui.LievitIcons.body`. Adjust that package to your app
(re-run the generator after moving `LievitIcons.java`).

### Use it (Lit island)

For a light-DOM Lit component that needs an inline icon, import the TS map and inline the
body inside your own `<svg>` wrapper (same tokens, `currentColor`):

```ts
import { iconBody } from "../icons/icon-bodies.js";
// inside render(): unsafeSVG(iconBody("check")) inside an <svg viewBox="0 0 24 24" ...>
```

### Starter set

The vendored starter set (53 icons): chevrons (down/up/left/right + `chevrons-up-down`),
`check` `x` `search` `menu` `plus` `minus`, arrows (up/down/left/right + `arrow-up-right`),
`circle-check` `circle-x` `circle-alert` `circle-question-mark` `triangle-alert` `info`,
`eye` `eye-off` `calendar` `clock` `user` `users` `settings` `trash` `trash-2` `pencil`
`copy` `download` `upload` `external-link` `loader-circle` `ellipsis` `ellipsis-vertical`
`funnel` `sun` `moon` `bell` `mail` `house` `file` `folder` `lock` `log-out` `log-in`
`star` `heart` `refresh-cw`.

### Add an icon

1. Find it at https://lucide.dev and drop its SVG into `registry/icons/<name>.svg`
   (or copy from a Lucide checkout: `cp lucide/icons/<name>.svg registry/icons/`).
2. Regenerate the body maps:
   ```bash
   node registry/icons/generate-icon-map.mjs
   ```
   This rewrites `LievitIcons.java` (for JTE) and `icon-bodies.ts` (for Lit) from the
   vendored SVGs. The generator is deterministic; a test fails on drift.
3. Use it: `@template.icon(name = "<name>")`.
