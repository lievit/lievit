<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — badge / chip

- **tier**: PARTIAL (both badge and chip are pure-presentational; chip's remove affordance is a
  platform-native `<a href>`, no JS required)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/badge.jte` + `registry/jte/chip.jte`;
  the two ship as a unified spec because they share the same variant vocabulary, token set, and
  visual identity — they differ only by the chip's remove affordance)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: no WAI-ARIA APG pattern (badge is decorative text, chip's remove link is a native `<a>`;
      both rely entirely on platform semantics — see §4 for the exact rationale); dot-indicator
      accessibility follows the colour-not-sole-signal rule from WCAG 1.4.1
    - inventory: Ant Design Tag/Badge as inventory reference (status colours, dot variant, closable tag,
      bordered vs filled, icon slot); shadcn Badge (variant vocabulary, asChild/link variant) as
      secondary reference; Filament Badge/Tag for the status + removable filter chip shape
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      (NO code copied)

## 1. What it is

**badge** is a small rounded-full status pill: a label (optionally preceded by a coloured dot or a leading
icon, optionally linkable via `href`) that communicates a state, count, category, or label at a glance.
It holds no client state and carries no interaction affordance of its own.
PARTIAL because variant-to-colour is a pure server function: the server picks the variant from the domain
model, renders the HTML, and the browser paints it.
Server-first works trivially — there is nothing client about a status label.

**chip** is a selection/filter tag: the same rounded-full visual as badge plus an optional trailing remove
affordance (a real `<a href>`) that navigates to a server URL that drops the selection.
The chip holds no client state: removal is a plain browser navigation, not JS.
PARTIAL for the same reason as badge.
The two are distinct components (not a single component with a prop) because their semantic contract
differs: a badge is always inert while a chip optionally carries a named interactive control.
Combining them into one would force the template to emit `<a>` + remove-link conditionals that obscure
the access contract for each — the "single component does two things" anti-pattern.

Decision rule for tier: pure display + no server-round-trip interaction → PARTIAL (architecture contract §1).
A chip with a remove that fires a wire action instead of navigating would be WIRE; that variant is a
non-goal (§8) because the server URL model is sufficient for the filter-chip use case and keeps JS at zero.

## 2. API — params

### badge.jte

| param | type | default | meaning |
|---|---|---|---|
| `variant` | `String` | `"neutral"` | INTENT: see §3 for the full vocabulary |
| `label` | `String` | `null` | pill text; used when no `content` slot is supplied |
| `dot` | `boolean` | `false` | renders a small coloured dot before the label (same colour as the variant fill/fg); the dot is `aria-hidden` |
| `leading` | `gg.jte.Content` | `null` | optional leading slot: an icon or any inline markup before the label; rendered before `dot` is irrelevant (only one of dot/leading should be used per call) |
| `content` | `gg.jte.Content` | `null` | optional rich children slot; takes precedence over `label` when supplied |
| `href` | `String` | `null` | non-blank → render the pill as a real `<a href>` (asChild); blank/null → inert `<span>` |
| `size` | `String` | `"md"` | `sm \| md \| lg` — text size + padding scale (NOT height-based like form controls; badges are inline, not block; see §3) |
| `cssClass` | `String` | `""` | extra utility classes on the pill root |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `target="_blank" rel="noopener"` on an `href` pill); NEVER fed per-row DB values |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (each value via `Escape.htmlAttribute`); use for per-row test hooks or JS targeting |

### chip.jte

| param | type | default | meaning |
|---|---|---|---|
| `variant` | `String` | `"neutral"` | INTENT: same vocabulary as badge |
| `label` | `String` | `null` | chip text; used when no `content` slot is supplied |
| `leading` | `gg.jte.Content` | `null` | optional leading slot: an icon before the label |
| `content` | `gg.jte.Content` | `null` | optional rich children slot; takes precedence over `label` |
| `removeHref` | `String` | `null` | non-blank → render a trailing remove button as a real `<a href>` that navigates to the URL (the server drops the selection); blank/null → no remove control |
| `removeLabel` | `String` | `null` | **REQUIRED when `removeHref` is set**: the `aria-label` on the remove link (e.g. "Rimuovi filtro Stato: Aperto"); the visible × glyph is `aria-hidden`, so without this the link has no accessible name |
| `size` | `String` | `"md"` | `sm \| md \| lg` — text + padding scale (same scale as badge) |
| `cssClass` | `String` | `""` | extra utility classes on the chip root |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes |

**The two escaping channels** (the XSS decision rule, per architecture contract §3):
`attrs` is `$unsafe` trusted raw — it must contain ONLY author-typed STATIC strings (wire directives,
`target`, `rel`).
`dataAttrs` entries are individually escaped via `Escape.htmlAttribute` — per-row, DB-derived values go
here and ONLY here.
Neither badge nor chip exposes `wireClick`/`wireArgs` because they are not action surfaces: badge is
inert, chip's remove is a plain `href` (no wire action needed).

## 3. Variants / sizes / states

### Variant vocabulary (shared between badge and chip)

The variant names an INTENT, never a colour.
Two families ship side by side under one `variant` param so the adopter can use whichever name fits their
domain model without needing two separate param types.

| variant | family | fill | foreground | border |
|---|---|---|---|---|
| `default` | shadcn | `--lv-color-primary` | `--lv-color-primary-fg` | transparent |
| `secondary` | shadcn | `--lv-color-secondary` | `--lv-color-secondary-fg` | transparent |
| `destructive` | shadcn | `--lv-color-destructive` | `--lv-color-destructive-fg` | transparent |
| `outline` | shadcn | transparent | `--lv-color-fg` | `--lv-color-border` |
| `ghost` | shadcn | transparent | `--lv-color-fg` | transparent |
| `link` | shadcn | transparent | `--lv-color-primary` | transparent (+ underline-offset; underlines on hover) |
| `neutral` | status (default) | `--lv-color-muted-bg` | `--lv-color-muted-fg` | transparent |
| `success` | status | `--lv-color-success` | `--lv-color-success-fg` | transparent |
| `warning` | status | `--lv-color-warning` | `--lv-color-warning-fg` | transparent |
| `info` | status | `--lv-color-info` | `--lv-color-info-fg` | transparent |
| `danger` | status | `--lv-color-danger` | `--lv-color-danger-fg` | transparent |

The variant is resolved in a `switch` → two local vars `bg` / `fg` (+ `border`) → inlined as CSS custom
properties on the element, never as Tailwind class strings, so a retheme overrides the token and every
pill retints with zero template change.
`link` adds the `underline-offset-4` utility class and `hover:underline`; all other variants use
`transition-colors hover:opacity-90` ONLY when the pill is rendered as `<a href>` (the hover affordance
mirrors the link affordance without hard-coding a colour).

### Sizes

Badge and chip are INLINE elements (not block-height-constrained form controls).
Their size scale governs text size + padding, not height, so they do not share the `--lv-space-8/9/10`
form-control height scale from the architecture contract §5.b.
The height-based scale is for controls that must align flush in a toolbar row; a badge inside a table cell
or next to a heading scales differently.

| size | text token | px padding (h/v) | use case |
|---|---|---|---|
| `sm` | `--lv-text-xs` (0.75rem) | `--lv-space-2` / `--lv-space-px` | dense tables, compact sidebars |
| `md` (default) | `--lv-text-sm` (0.875rem) | `--lv-space-2` / `--lv-space-1` | general use |
| `lg` | `--lv-text-base` (1rem) | `--lv-space-3` / `--lv-space-1` | hero stat, large cards |

The radius is always `--lv-radius-full` (9999px) regardless of size: the pill shape is the defining visual
of the component; it does not round-corner-scale with size.

### States

| state | how triggered | visual / ARIA effect |
|---|---|---|
| inert (badge span) | default (no href) | no hover affordance; no focus ring; `aria-hidden` dot if dot=true |
| link pill (badge href set) | `href != null && !href.isBlank()` | `transition-colors hover:opacity-90` (or `hover:underline` for `link`); focus-visible ring via `--lv-ring` |
| chip label (no remove) | `removeHref` blank/null | inert `<span>` at the chip root |
| chip removable | `removeHref != null && !removeHref.isBlank()` | trailing `<a href>` with `aria-label="${removeLabel}"` + focus-visible ring on the remove link |
| `link` variant on chip | variant="link" | no filled pill visual; primary-coloured text + underline on hover |

There are no `disabled`, `aria-invalid`, or `aria-busy` states: badge and chip are display-only.
They carry no validation role and are never `aria-busy` (they are not the output of a wire action, they
ARE the rendered state).

### Slots matrix

| slot param | badge | chip | meaning |
|---|---|---|---|
| `leading` | yes | yes | icon or inline markup before the label |
| `content` | yes | yes | rich children (takes precedence over `label`) |
| `dot` (boolean, not Content) | yes | no | coloured status dot (badge-specific display feature) |
| remove affordance | no | yes (`removeHref`) | trailing `<a href>` × link |

The `footer` and `trailing` slot names from the architecture contract §5.d are not applicable to these
inline primitives; the remove affordance on chip is a named first-class param, not a generic `trailing`
slot, because it carries a mandatory `removeLabel` coupling that a generic slot cannot enforce.

## 4. The a11y contract

- **WAI-ARIA pattern**: NONE — no APG pattern applies.
  WAI-ARIA APG patterns cover interactive widgets (menus, dialogs, tabs, comboboxes).
  A badge is decorative text; a chip's only interaction is a native anchor link.
  Both rely entirely on platform semantics.
  Source verified: https://www.w3.org/WAI/ARIA/apg/patterns/ — no "badge", "tag", "chip", or "status pill"
  pattern exists in the APG index.
  The closest APG concept is the "Link" pattern for the remove affordance and the link badge, which states:
  use a real `<a href>` element (the platform supplies `role=link` + Enter + Tab focus for free).

- **roles + ARIA**:
  - **badge (span)**: `<span>` — no explicit `role`.
    A status pill is flow content; it is read by screen readers as its text content in context.
    Adding `role="status"` or `role="note"` would imply a live region that announces on change — a badge
    does NOT do this; the surrounding page context (a table cell label, an alert header) provides any
    needed announcement.
    The dot (`dot=true`) is `aria-hidden="true"` because the label text already states the status; colour
    is never the only signal (WCAG 1.4.1 Non-text Contrast).
    The `leading` slot icon SHOULD be `aria-hidden="true"` by the call site (the icon partial already
    emits `aria-hidden` by default); the spec does not force it at the badge level because the call site
    controls whether the icon has semantic meaning.
  - **badge (link, href set)**: `<a href="...">` — platform supplies `role=link`.
    No manual role needed.
    The accessible name is the pill's text content (label or content slot).
    For `link` variant (primary underlined text), the accessible name is still the text; no additional
    label is needed because the pill's text describes the destination.
  - **chip (inert)**: `<span data-slot="chip">` — no explicit `role`.
    The chip label is flow content; screen readers read it in context.
  - **chip (removable)**: the outer `<span>` remains a non-interactive container.
    The trailing remove is `<a href="..." aria-label="${removeLabel}">`.
    The × SVG inside the link is `aria-hidden="true" focusable="false"` (the `aria-label` on the `<a>`
    provides the name; the SVG is decoration).
    `removeLabel` is REQUIRED when `removeHref` is set: the component emits an unlabelled interactive
    control when it is absent, which is an accessibility defect.
    The implementation MUST guard: if `removeHref` is set and `removeLabel` is null or blank, the
    template SHOULD emit a visible warning comment in dev mode (`<!-- WARNING: removeLabel required -->`)
    and fall through to an empty string to avoid a null render, but the spec-acceptance test MUST flag
    this as a failure (axe-core link-name rule).

- **keyboard map**:

  | key | element | does | who |
  |---|---|---|---|
  | Tab | badge `<a href>` | focuses the link pill | platform |
  | Enter | badge `<a href>` | navigates to `href` | platform |
  | Tab | chip remove `<a href>` | focuses the remove link | platform |
  | Enter | chip remove `<a href>` | navigates to `removeHref` (drops selection) | platform |
  | (no other keys) | badge/chip `<span>` | inert; no keyboard interaction | — |

  No keyboard interaction is defined for the inert span variants.
  The platform provides all keyboard behavior; no enhancer is needed.

- **focus management**: platform only.
  The `<a href>` variants receive focus-visible styling via `focus-visible:shadow-[var(--lv-ring)]`.
  No trap, no roving tabindex, no initial focus, no restore.
  The runtime morph preserves focus identity across re-renders (ADR-0019); badges and chips in a
  morphed list keep their DOM identity and do not lose focus.

- **live region**: none.
  A badge is NOT a live region.
  An adopter who needs to announce a count change (e.g. "3 unread notifications") uses the shared
  `announcer` pattern at the page level, not the badge.
  The badge/chip contract explicitly does not include `role="status"` or `aria-live`: these belong
  to the component that CHANGES the count, not to the display primitive.

- **WCAG 1.4.1 (non-text contrast) for the dot variant**: the coloured dot must have a colour contrast
  ratio ≥ 3:1 against its surrounding background.
  The token values chosen for `--lv-color-success`, `--lv-color-warning`, etc. meet this threshold
  against `--lv-color-bg` (the default page surface).
  The dot is `aria-hidden` — it is visual-only — so its contrast requirement is decorative-contrast
  (3:1), not text-contrast (4.5:1).
  A label MUST always accompany the dot (the spec does not support a dot-only badge with no label,
  because colour alone is never the only signal).

- **shared mechanism composed**: none.
  Both badge and chip are platform-only, no shared enhancer, no popover seam, no focus-trap, no
  collection-nav.
  This is the simplest a11y tier: native elements, platform semantics, done.

## 5. Tokens

### Tokens consumed (badge and chip share the same set)

**Colour** (all OKLCH in the v-next authored source; current token file still ships hex, migrated to
OKLCH as part of the token extension pass):

| token | role |
|---|---|
| `--lv-color-primary` / `-fg` | `default` variant fill + foreground |
| `--lv-color-secondary` / `-fg` | `secondary` variant fill + foreground |
| `--lv-color-destructive` / `-fg` | `destructive` variant fill + foreground |
| `--lv-color-fg` | `outline` + `ghost` foreground |
| `--lv-color-border` | `outline` variant border |
| `--lv-color-muted-bg` | `neutral` variant fill |
| `--lv-color-muted-fg` | `neutral` foreground |
| `--lv-color-success` / `-fg` | `success` variant |
| `--lv-color-warning` / `-fg` | `warning` variant |
| `--lv-color-info` / `-fg` | `info` variant |
| `--lv-color-danger` / `-fg` | `danger` variant |
| `--lv-ring` | focus-visible ring on `<a href>` badge and on chip remove link |

**Spacing** (text + padding scale by size):

| token | use |
|---|---|
| `--lv-space-px` | sm vertical padding |
| `--lv-space-1` | gap between dot/leading/label; md vertical padding |
| `--lv-space-2` | sm/md horizontal padding |
| `--lv-space-3` | lg horizontal padding |

**Radius**:

| token | use |
|---|---|
| `--lv-radius-full` | pill shape (always full-round) |

**Typography**:

| token | use |
|---|---|
| `--lv-text-xs` | sm size text |
| `--lv-text-sm` | md size text (default) |
| `--lv-text-base` | lg size text |
| `--lv-font-medium` | pill label weight |
| `--lv-font-sans` | font-family (inlined as CSS custom property on the element) |

**Motion**:

| token | use |
|---|---|
| `--lv-duration-fast` | `transition-colors` / `transition-opacity` on the `hover:opacity-90` and the chip remove `hover:opacity-100` |

### NET-NEW tokens proposed

None.
The full variant vocabulary (including the dot and size scale) is covered by existing tokens.
The `--lv-color-muted-bg` token (`#f3f4f6` light / `#262626` dark) already exists in `lievit-tokens.css`
(added in the v2 set for badge/skeleton background) and is the correct token for the `neutral` fill.
No new token is introduced by this spec.

## 6. Wire / island integration

Both badge and chip are **static, no enhancer**.

**badge.jte** renders one of two element shapes based on `href`:
- `<span data-slot="badge" data-variant="${variant}" data-size="${size}">` when inert.
- `<a href="${href}" data-slot="badge" data-variant="${variant}" data-size="${size}">` when `href` is set.

The element carries:
- inline `style` with `background`, `color`, `border-color` resolved from the variant switch (the current
  implementation pattern, kept because the token values are CSS custom properties, not literals — the
  `font-family` is also inlined here to avoid a cascade dependency on an adopter's base styles).
- `data-slot="badge"` (the root slot hook; lets the adopter target `.lv-badge` or `[data-slot=badge]`).
- `data-variant="${variant}"` (the CSS/test hook for variant-specific overrides).
- `data-size="${size}"` (the CSS/test hook for size-specific overrides; NET-NEW vs the current badge.jte
  which has no size param).
- a conditional `dot` `<span>` before the label, `aria-hidden="true"`, sized as a small circle tinted
  with `currentColor` at reduced opacity so it adapts to the variant foreground without a new token.
- an optional `leading` content slot rendered before the dot/label.

The legacy `lv-badge lv-badge--<variant>` class names are KEPT on the root element for backward
compatibility with any adopter stylesheet that targets them (the existing badge.jte ships them; removing
them breaks adopters).

**chip.jte** renders:
- `<span data-slot="chip" data-variant="${variant}" data-size="${size}">` as the outer container.
- `<span data-slot="chip-label">` wrapping the label / content slot.
- `<a href="${removeHref}" data-slot="chip-remove" aria-label="${removeLabel}">` as the trailing link,
  rendered only when `removeHref` is non-blank.
  The `<a>` contains an inline SVG × glyph (`aria-hidden="true" focusable="false"`).
  The legacy `lv-chip lv-chip--<variant>` class names are KEPT on the outer `<span>`.

Neither template emits `<script>`, inline `on*=`, nor any JS dependency.
The remove navigation is a plain browser GET to the `removeHref` URL — the server processes the request
and re-renders the page without the removed chip.
An adopter who needs JS-driven removal (e.g. `htmx` `hx-delete`) can delegate off `[data-slot="chip-remove"]`
from outside the template, consistent with the architecture contract's "zero inline script" rule.

No lifecycle hooks, no directive registry calls, no wire action.
These components are invisible to the lievit runtime — they are pure JTE markup.

## 7. Acceptance tests

All tests run on a REAL substrate — no mocked JTE renderer, no mocked adopter context.
The JTE compile-and-render gate (`test/jte-compile`) covers every template; the tests below go further.

### badge.jte

- **render — default span**: `badge(variant="neutral", label="Attivo")` renders a `<span>` with
  `data-slot="badge"`, `data-variant="neutral"`, `data-size="md"`, text "Attivo" visible; no `<a>` present.
- **render — link pill**: `badge(variant="success", label="Aperto", href="/issues/1")` renders `<a href="/issues/1">`
  with `data-slot="badge"`, the text "Aperto" visible; no `<span>` root present.
- **render — dot**: `badge(variant="warning", label="In attesa", dot=true)` renders a `[data-slot=badge]`
  containing a `<span aria-hidden="true">` dot element before the label text.
- **render — leading slot**: `badge(variant="info", leading=@@\`<svg …/>\`, label="Bozza")` renders the
  leading slot content before the label inside the pill.
- **render — content slot overrides label**: `badge(variant="secondary", label="ignored",
  content=@@\`<strong>Attivo</strong>\`)` renders `<strong>Attivo</strong>` in the pill body, not "ignored".
- **render — size sm/md/lg**: each size emits `data-size="sm"` / `"md"` / `"lg"` and the corresponding
  text-size token class; the md size is the default when `size` is omitted.
- **variants — all 11**: each variant renders with the correct `data-variant` attribute and the inline
  `style` string containing `var(--lv-color-<intent>)` for background and `var(--lv-color-<intent>-fg)`
  for color (assert the style string contains the expected custom property names, not literal hex).
- **axe-core — inert span**: `badge(variant="success", label="Attivo")` → zero axe violations.
- **axe-core — link pill**: `badge(variant="default", label="Ver 2.0", href="/v2")` → zero axe violations;
  the link has an accessible name (the text content).
- **axe-core — dot without label MUST FAIL**: `badge(variant="success", dot=true, label="")` → axe
  reports the accessible name is empty if label is blank and content is null (the colour-not-sole-signal
  invariant; the test asserts axe CATCHES this and the spec REQUIRES a non-empty label alongside the dot).
- **focus ring — link pill**: the `<a>` element has `focus-visible:shadow-[var(--lv-ring)]` in its class
  list; assert the class string is present (the focus ring is CSS-driven, not JS-managed).
- **escaping — dataAttrs**: `dataAttrs={"data-testid": "\">&lt;script>"}` renders the attribute value
  HTML-escaped, never as a raw injection (assert the rendered HTML contains the escaped form).
- **escaping — attrs is trusted, never DB-fed**: the test documents (not asserts) that `attrs` is
  STATIC-only; the acceptance test MUST NOT feed a per-row DB value through `attrs` (if it does, the
  XSS gate should fail).
- **JTE compiles + renders**: covered by `test/jte-compile`.

### chip.jte

- **render — inert chip (no removeHref)**: `chip(variant="neutral", label="Bozza")` renders `<span
  data-slot="chip">` containing `<span data-slot="chip-label">Bozza</span>`; no `<a>` present.
- **render — removable chip**: `chip(variant="info", label="Stato: Aperto", removeHref="/attivita?stato=",
  removeLabel="Rimuovi filtro Stato")` renders `<span data-slot="chip">` + `<span data-slot="chip-label">`
  + `<a data-slot="chip-remove" aria-label="Rimuovi filtro Stato" href="/attivita?stato=">` + inline SVG
  × with `aria-hidden="true"`; all three elements visible.
- **render — leading slot**: `chip(variant="success", leading=@@\`<svg …/>\`, label="Attivo")` renders the
  slot content before the label.
- **render — content slot overrides label**: `chip(label="ignored", content=@@\`<em>Attivo</em>\`)` renders
  the `<em>` in `chip-label`, not "ignored".
- **render — size sm/md/lg**: each size emits `data-size` and the correct text-size token class.
- **variants — all 11**: same assertion as badge; each variant emits the correct inline style custom
  property names.
- **axe-core — inert chip**: zero violations.
- **axe-core — removable chip with label**: `chip(removeHref="/drop", removeLabel="Rimuovi X")` → zero
  violations; the remove link has the accessible name from `aria-label`.
- **axe-core — removable chip WITHOUT removeLabel MUST FAIL**: `chip(removeHref="/drop", removeLabel=null)`
  → axe reports `link-name` violation (the test asserts axe CATCHES this, proving the required-label rule).
- **keyboard — remove link is a real `<a>`**: assert the `<a data-slot="chip-remove">` element has no
  `tabindex="-1"` and is in the natural tab order; pressing Enter on it navigates (assert via
  `element.click()` / `dispatchEvent`).
- **focus ring — remove link**: `focus-visible:shadow-[var(--lv-ring)]` in the remove link's class list.
- **escaping — dataAttrs**: same as badge; hostile value in `dataAttrs` renders inert.
- **JTE compiles + renders**: covered by `test/jte-compile`.

### Shared / visual regression

- **dark mode token swap**: with `class="dark"` on the root, the `--lv-color-*` tokens re-point to the
  dark palette; assert the inline `style` still reads `var(--lv-color-*)` (not literals) so the CSS
  variable resolution picks up the dark override automatically.
- **backward compatibility — class names**: `badge(variant="success", label="X")` renders with BOTH
  `lv-badge` and `lv-badge--success` in the class list (the compat classes kept from v0.1/v2; assert
  both are present so an adopter's existing CSS selectors do not break after the re-forge).
  Same for chip: `lv-chip lv-chip--<variant>` present on the outer `<span>`.

## 8. Non-goals / anti-patterns

- **No JS dismiss on chip**: the remove affordance is a plain `<a href>` (server navigation).
  An htmx-powered dismiss (hx-delete, hx-swap) is an ADOPTER concern, not built into the chip template.
  The chip exposes `[data-slot="chip-remove"]` as the delegation hook; the template itself emits no htmx
  or l:* directive.
- **No interactive badge with click handler**: a badge that fires a wire action on click is either a
  `button` (use the button partial) or a chip (use chip + removeHref).
  A click-wired badge (a div-with-role-button) is the anti-pattern the architecture contract explicitly
  bans: use a real `<button>` or a real `<a href>`.
- **No dot-only badge (no label)**: a dot without text label is colour-as-sole-signal, which violates
  WCAG 1.4.1.
  The spec requires `label` (or `content`) to be non-empty whenever `dot=true`.
  An icon-only badge (where the icon carries meaning without text) must supply `ariaLabel` on the leading
  slot's icon partial call.
- **No animated/pulsing dot**: motion with no user control violates WCAG 2.3.3 (Animation from
  Interactions, Level AAA) and 2.2.2 (Pause, Stop, Hide, Level AA) if the animation loops.
  The dot is static.
  An adopter who needs a "live" pulse indicator overrides via CSS with `prefers-reduced-motion` handled,
  outside the component.
- **No badge size that matches the form-control height scale**: badge/chip are inline elements, not form
  controls.
  Aligning a badge flush in a toolbar row is an ADOPTER layout concern (`flex items-center`), not
  something the badge's size param should solve.
  Adding `sm → --lv-space-8 (32px)` height to the badge would confuse the badge with a `button`, which
  is the intentional primitive for a clickable control that lives in a toolbar.
- **No multi-line badge**: a badge wrapping across lines signals a label that is too long.
  The call site should truncate with `text-ellipsis` via `cssClass` if needed; the badge itself sets
  `leading-none` and `whitespace-nowrap` by default.
- **No chip with wire-action remove** (WIRE chip): fire the wire action from an adopter-owned `<button>`
  with `l:click` instead; the chip template stays PARTIAL.
  The pattern "a chip row in a tags list where removal fires a wire action" is a WIRE component pattern
  (similar to `tags-input`), which is a separate component (`tags-input` already exists).
- **No tooltip on hover**: if a truncated badge needs a tooltip, compose the `tooltip` partial at the
  call site; the badge does not build tooltip behavior into itself.
- **Never feed a per-row DB value through `attrs`**: `attrs` is `$unsafe` trusted-raw.
  Per-row values go through `dataAttrs` (escaped).
  This is not just a recommendation — it is the XSS security boundary (architecture contract §3).

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens.
You MAY read Ant Design Tag/Badge, shadcn Badge, Filament Badge/Tag, and Tailwind UI badge patterns as
REFERENCES for the variant inventory, the dot feature, and the visual look.
You MUST NOT paste literal source from any of them (no react-aria / ant-design / Tailwind-UI class
strings or code) — the output is always original generation (`02-licensing.md`).

Mirror `button.jte` house conventions exactly: Apache header block + `<%-- --%>` doc comment with
`TIER:`, `STRUCTURE (scientific decision rule):`, `A11y:`, `Params:`, `Usage:` sections; typed `@param`
with defaults; `data-slot` on the root + `data-variant` + `data-size`; zero `<script>` zero inline `on*=`.

The two escaping channels are LOAD-BEARING: `attrs` = `$unsafe` trusted-raw for STATIC author strings
only; `dataAttrs` = safe escaped via `Escape.htmlAttribute` for per-row dynamic values.
Enforce the `removeLabel` required invariant in chip: a missing `removeLabel` with a present `removeHref`
must be visually flagged in the template (dev warning comment) and caught by the axe acceptance test.

Keep the `lv-badge lv-badge--<variant>` and `lv-chip lv-chip--<variant>` legacy class names on the root
element for backward compatibility (the gest codebase targets them; removing them breaks production).

Minimal code to GREEN against the acceptance tests.
The escaping test and the axe-core dot-without-label test are not optional: they are the security
boundary and the a11y invariant respectively.
