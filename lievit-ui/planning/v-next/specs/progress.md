<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — progress

- **tier**: PARTIAL
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of `registry/jte/progress.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Progressbar (https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/progressbar_role
      + https://www.w3.org/TR/wai-aria-1.2/#progressbar) — no react-aria reference because this pattern has no
      keyboard interaction and no focus management; it is a static read-only widget, BUILT directly against the
      WAI-ARIA spec; the native `<progress>` element is the preferred implementation where custom styling is not
      required (but CSS-styled custom markup is standard practice for this component)
    - inventory: Ant Design Progress as inventory reference (line/circle/dashboard variants; striped + animated
      stripes; status intents; steps-style segmented bar)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI (NO code copied)

## 1. What it is

A visual indicator of how much of an operation is complete. The operation either has a known completion
percentage (determinate) or is in an unknown-duration state (indeterminate). The component is purely
presentational and holds no state: the percentage value arrives from the controller's typed model and the
partial renders the corresponding ARIA attributes + the visual fill. PARTIAL is the correct tier because there
is no interactive server state and no client interaction — the consumer re-renders the page (or swaps a
server fragment via HTMX) to update the value. Server-first is trivial for a static display widget.

Four visual forms are supported: `line` (the horizontal bar, the default), `circle` (SVG arc ring), `dashboard`
(the lower-half circle gauge), and `steps` (N discrete filled/empty segments). Each form composes the same
ARIA contract. The `circle` and `dashboard` forms are rendered as inline SVG — no `<img>`, no external
resource. The `steps` form is a sequence of short bar segments.

## 2. API — params (the typed surface)

| param | type | default | meaning |
|---|---|---|---|
| `value` | `Integer` | `null` | current progress, 0–`max`; **`null` = indeterminate** (omits `aria-valuenow`) |
| `max` | `int` | `100` | the maximum value (`aria-valuemax`); minimum is always 0 (`aria-valuemin="0"`) |
| `valueText` | `String` | `null` | human-readable label for the current value (`aria-valuetext`); overrides the default percentage announcement; e.g. `"15 of 30 files"` |
| `label` | `String` | `null` | accessible name via `aria-label`; use when no visible label element exists nearby |
| `labelledBy` | `String` | `null` | `id` of an external visible label element → rendered as `aria-labelledby`; takes precedence over `label` when both set |
| `variant` | `String` | `"default"` | INTENT: `default` \| `info` \| `success` \| `warning` \| `destructive`; maps to the shared status-intent token pair |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — controls the bar HEIGHT (line) or STROKE WIDTH (circle/dashboard) or segment HEIGHT (steps) |
| `form` | `String` | `"line"` | `line` \| `circle` \| `dashboard` \| `steps` |
| `striped` | `boolean` | `false` | renders diagonal stripe pattern over the fill (line form only) |
| `animated` | `boolean` | `false` | animates the stripes; **requires `striped=true`**; uses CSS animation only (CSP-clean, no inline `<style>`) |
| `showValue` | `boolean` | `false` | renders a visible percentage text label inside (circle/dashboard) or trailing (line/steps) the bar |
| `steps` | `int` | `0` | number of discrete segments (steps form only; 0 = continuous bar for line form) |
| `strokeWidth` | `int` | `0` | SVG stroke width override in pixels (circle/dashboard only); 0 = use the size-driven default |
| `cssClass` | `String` | `""` | extra utility classes on the root element |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `id="upload-progress"`) |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (value via `Escape.htmlAttribute`) |
| `trailing` | `gg.jte.Content` | — | optional slot rendered after the bar (line form): typically a status label or `<span>` with extra context; NOT used for circle/dashboard (content goes below the SVG instead — see `footer` slot) |
| `footer` | `gg.jte.Content` | — | optional slot rendered below the component (all forms): status text, retry button, descriptive note |

**Escaping discipline**: `attrs` is trusted-raw (`$unsafe`) and MUST contain only STATIC author-typed strings —
never a per-row DB-derived value. `dataAttrs` values flow through `Escape.htmlAttribute` (the XSS decision
rule from `00-architecture-contract` §3). If a consuming WIRE template needs to wire a progress bar to a
specific row (e.g. per-file upload), it passes the row id through `dataAttrs`, never `attrs`.

**The `value=null` contract**: when `value` is `null`, the template OMITS `aria-valuenow` entirely (not set to
empty, not set to `"0"`). WAI-ARIA 1.2 specifies that the absence of `aria-valuenow` signals the indeterminate
state to assistive technologies. The visual fill is replaced by the indeterminate animation.

## 3. Variants / sizes / states

### Variants (intent, not colour)

| variant | token pair | when |
|---|---|---|
| `default` | `--lv-color-primary` / `--lv-color-primary-fg` | neutral task progress (default) |
| `info` | `--lv-color-info` / `--lv-color-info-fg` | informational loading (e.g. syncing) |
| `success` | `--lv-color-success` / `--lv-color-success-fg` | completed or nearly complete |
| `warning` | `--lv-color-warning` / `--lv-color-warning-fg` | progress at risk or degraded |
| `destructive` | `--lv-color-destructive` / `--lv-color-destructive-fg` | failed or error state |

The mapping uses a `switch` on `variant` into a local `!{var variantClass}` — never a literal colour in the template
body. The `data-variant="${variant}"` attribute on the root element is the styling hook + test target.

### Sizes

Height-based, consistent with the shared size scale, but adapted for a non-interactive track:

| size | line bar height | circle/dashboard stroke | steps height | `data-size` |
|---|---|---|---|---|
| `sm` | `--lv-space-1` (4px) | 4px | `--lv-space-1` (4px) | `"sm"` |
| `md` | `--lv-space-2` (8px, default) | 8px | `--lv-space-2` (8px) | `"md"` |
| `lg` | `--lv-space-3` (12px) | 12px | `--lv-space-3` (12px) | `"lg"` |

The `data-size="${size}"` attribute on the root element is the styling hook + test target. Progress bars are NOT
toolbar-aligned (they are not form controls); these sizes are purely visual track thicknesses.

### States

| state | how expressed |
|---|---|
| **determinate** | `value` ∈ [0, max]; `aria-valuenow` present; fill width = `(value/max)*100%` |
| **indeterminate** | `value` is `null`; `aria-valuenow` OMITTED; fill uses CSS animation (a sliding gradient or expanding strip); `data-state="indeterminate"` |
| **complete** | `value == max`; typically rendered with `variant="success"`; `data-state="complete"` |
| **striped** | `striped=true` (line only); CSS `repeating-linear-gradient` diagonal stripes over the fill |
| **animated** | `animated=true` (requires `striped=true`); CSS `@keyframes` animates the stripe offset; no inline style |

`data-state` on the root element encodes `determinate | indeterminate | complete` for test targeting and
consumer CSS hooks. There is no `:focus` state because the component is not focusable (read-only, not in
the tab order).

### Steps form

When `form="steps"` and `steps > 0`, the bar is replaced by `steps` discrete segment elements. Each
segment that falls within `(value/max)*steps` rounds is rendered filled (with the variant colour); the
remainder are rendered in the track colour. The segments are `<span aria-hidden="true">` inside the
ARIA progressbar root — they are presentational children (WAI-ARIA specifies that all children of
`progressbar` are treated as presentational/`role=presentation`). The ARIA attributes (`aria-valuenow`,
`aria-valuemax`, `aria-valuetext`) remain on the container, as per the spec.

### Circle / dashboard forms

`form="circle"` renders a full SVG ring (360°). `form="dashboard"` renders a 270° arc anchored at the
bottom (a speedometer / gauge shape). Both use a `<svg>` with `aria-hidden="true"` inside the ARIA root —
the SVG is purely presentational; the ARIA semantics live on the container `<div role="progressbar">`. The
`strokeWidth` param overrides the stroke; otherwise the size-driven default applies. `showValue=true` renders
the percentage text as a `<text>` element inside the SVG with `aria-hidden="true"` (the value is already
exposed via `aria-valuenow` / `aria-valuetext`).

## 4. The a11y contract

- **WAI-ARIA pattern**: APG Progressbar, defined in WAI-ARIA 1.2 §5.3.22
  (https://www.w3.org/TR/wai-aria-1.2/#progressbar). MDN reference:
  https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/progressbar_role (the APG does not have
  a dedicated Progressbar pattern page as of June 2026; the canonical authority is the WAI-ARIA 1.2 role spec
  and the MDN ARIA guide, both verified for this spec).

- **roles + ARIA**:

  | element | role / attribute | value | note |
  |---|---|---|---|
  | root `<div>` | `role="progressbar"` | — | always present |
  | root | `aria-valuenow` | integer ∈ [0, max] | **OMITTED** when `value=null` (indeterminate) |
  | root | `aria-valuemin="0"` | `"0"` | always 0; always emitted (explicit = portable) |
  | root | `aria-valuemax` | `String.valueOf(max)` | always emitted |
  | root | `aria-valuetext` | `valueText` | emitted only when `valueText` is non-null; overrides the AT percentage announcement |
  | root | `aria-label` | `label` | emitted only when `labelledBy` is null and `label` is non-null |
  | root | `aria-labelledby` | `labelledBy` | emitted only when non-null; takes precedence over `aria-label` |
  | inner SVG (circle/dashboard) | `aria-hidden="true"` | — | SVG is purely presentational |
  | step segments, stripe divs | `aria-hidden="true"` | — | all decorative children are hidden from the a11y tree |
  | visible percentage text (showValue=true) | `aria-hidden="true"` | — | value is already exposed via `aria-valuenow` / `aria-valuetext` |

  Accessible name MUST be provided: either `aria-label` or `aria-labelledby`. When neither is provided,
  the axe-core `aria-progressbar-name` rule fires. The implementation nags with a JTE comment when both
  `label` and `labelledBy` are null, but still renders (the consuming template owns the labelling decision;
  standalone usage like a page-level loading bar may carry a nearby visible heading that is the label).

  WAI-ARIA 1.2 specifies that all descendants of `progressbar` are treated as presentational
  (`children presentational: True`), so inner markup (segments, SVG) MUST be `aria-hidden="true"` or it
  will be ignored anyway — marking them explicitly makes the intent clear and portable across AT versions.

- **keyboard map**:

  | key | does | who |
  |---|---|---|
  | (none) | — | — |

  The `progressbar` role defines **no keyboard interaction**. The element is not focusable (no `tabindex`).
  Screen readers encounter it in reading order (virtual cursor), not via keyboard focus. This is the
  complete keyboard contract per WAI-ARIA 1.2. No enhancer is needed.

- **focus management**: none. The component is read-only and NOT in the tab order. No `tabindex`, no focus
  trap, no focus restore. Screen readers traverse it via virtual cursor / reading order.

- **live region**: `progressbar` is NOT a live region role (it is not in WAI-ARIA's live-region-roles set:
  alert, log, marquee, status, timer). Periodic value updates (e.g. a file-upload counter updating every
  second) are NOT automatically announced — screen readers do not re-announce a progressbar on every
  `aria-valuenow` change. This is by design: continuous announcements would be disruptive.

  When the CONSUMER needs AT to announce completion or a state change (e.g. "upload complete"), the
  correct pattern is:
  1. Set `aria-busy="true"` on the REGION being loaded (not on the progressbar itself).
  2. Set `aria-describedby` on the region referencing the progressbar's `id`.
  3. When complete, set `aria-busy="false"` and optionally update a nearby `role="status"` region.
  The progressbar spec does NOT include a `role="status"` wrapper — that is the consumer's concern,
  not this component's. The component documents this in a JTE header comment so authors are not surprised.

- **screen-reader expectations**:
  - Determinate: AT announces `"<label>, progress bar, <N> percent"` (percentage derived from `aria-valuenow`
    / `aria-valuemax`).
  - With `aria-valuetext`: AT announces `"<label>, progress bar, <valueText>"` instead of the percentage.
  - Indeterminate (no `aria-valuenow`): AT announces `"<label>, progress bar"` (no percentage; most AT
    announce it as "indeterminate" or simply omit the value).
  - Role announced as "progress bar" (two words) in most AT.

- **shared mechanism composed**: none. This is a static display widget. No popover seam, no focus-trap, no
  collection-nav. The simplest a11y tier after `button`.

## 5. Tokens

### Consumed tokens

| token | used for |
|---|---|
| `--lv-color-primary` | default variant fill colour (OKLCH authored) |
| `--lv-color-info` | info variant fill |
| `--lv-color-success` | success variant fill |
| `--lv-color-warning` | warning variant fill |
| `--lv-color-destructive` | destructive variant fill |
| `--lv-color-muted` | track background (the unfilled rail) |
| `--lv-color-muted-fg` | text inside the bar when `showValue=true` and fill is light |
| `--lv-color-fg` | percentage text colour outside the bar (line trailing / circle centre) |
| `--lv-space-1` | sm track height (4px) |
| `--lv-space-2` | md track height (8px, default) |
| `--lv-space-3` | lg track height (12px) |
| `--lv-radius-full` | fully rounded rail + fill ends (the default pill shape for line form) |
| `--lv-text-xs` | size-sm value label text |
| `--lv-text-sm` | size-md/lg value label text |
| `--lv-font-sans` | value label typeface |
| `--lv-motion-duration-slow` | indeterminate animation duration |
| `--lv-motion-easing-in-out` | indeterminate animation easing |

### Net-new tokens proposed

| token | value (OKLCH) | dark re-point | justification |
|---|---|---|---|
| `--lv-color-progress-track` | `oklch(0.93 0.003 240)` | `oklch(0.22 0.003 240)` | the unfilled rail has a subtly tinted neutral that reads as "remaining" without being as stark as `--lv-color-muted`; composing `--lv-color-muted` directly is acceptable but the dedicated token lets adopters tune the track independently of general muted surfaces |

If Francesco prefers to reuse `--lv-color-muted` for the track and skip this token, the implementation
agent drops the net-new row and maps the track to `--lv-color-muted`. Mark this as `(OPTIONAL)` in the
implementation — confirm before adding to `lievit-tokens.css`.

The stripe pattern uses a `repeating-linear-gradient` referencing the fill colour at reduced opacity (via
`color-mix(in oklch, var(--lv-color-<variant>) 70%, transparent)`) — no new token, composed from existing.
The indeterminate sliding animation references `--lv-motion-duration-slow` + `--lv-motion-easing-in-out`
(already exist). No other net-new tokens are needed.

All colour tokens authored in OKLCH as the source-of-truth format (architecture contract §4, D1 DECIDED).
No literal hex/rgb in the component body.

## 6. Wire actions

**None.** This is a PARTIAL. It renders read-only and holds no state, fires no actions, and has no
`l:*` directives. The consuming WIRE component (e.g. a file-upload `UploadComponent`) owns the `value`
field as a `@Wire int uploadPercent` and passes it as the `value` param when calling
`@template.lievit.progress(value: _instance.uploadPercent(), ...)`.

For a page-level loading bar driven by HTMX (e.g. a long-running import), the pattern is:
1. The server fragment includes the `@template.lievit.progress(...)` call with the current value.
2. HTMX polls / receives a push that swaps the fragment (the outer container `hx-swap-oob` or a targeted
   swap).
3. The progress partial re-renders with the new `value`. No wire round-trip on the component itself.

No `wireClick`, `wireArgs`, or `dataAttrs` are expected to carry action payloads for this component.
`dataAttrs` may carry correlation metadata (e.g. `data-upload-id`) for the consumer's JS, but the
progressbar itself does not act on it.

## 7. Acceptance tests

All tests run on a REAL substrate (jsdom + JTE compile gate for the PARTIAL tier). No mocked rendering.

### Render

- **determinate render** (jsdom): `@template.lievit.progress(value: 60, max: 100)` renders a `<div
  role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100">`; `data-slot="progress"`,
  `data-variant="default"`, `data-size="md"`, `data-state="determinate"` all present; the fill element
  has an inline width of `"60%"` (or equivalent Tailwind utility) matching `(60/100)*100`.
- **indeterminate render**: `value=null` → `aria-valuenow` is ABSENT from the rendered HTML (assert
  `not(hasAttribute('aria-valuenow'))`); `data-state="indeterminate"` is set; the fill carries the
  animation class.
- **complete render**: `value=100, max=100` → `data-state="complete"`; `aria-valuenow="100"`.
- **custom max**: `value=150, max=200` → `aria-valuenow="150" aria-valuemax="200"`; fill width = 75%.
- **valueText**: `valueText="15 of 30 files"` → `aria-valuetext="15 of 30 files"` on the root.
- **label**: `label="Uploading"` → `aria-label="Uploading"` on the root; no `aria-labelledby`.
- **labelledBy**: `labelledBy="my-label"` → `aria-labelledby="my-label"`; `aria-label` ABSENT.
- **slots**: `trailing` slot content appears after the bar (line form); `footer` slot content appears
  below the component (all forms); both are absent from the DOM when not passed.

### Form variants

- **circle render**: `form="circle"` → the root carries `role="progressbar"` and ARIA attrs; inner `<svg>`
  has `aria-hidden="true"`; SVG arc stroke-dashoffset matches `(1 - value/max) * circumference`.
- **dashboard render**: `form="dashboard"` → root + ARIA correct; arc spans 270°.
- **steps render**: `form="steps", steps=5, value=3, max=5` → 5 segment `<span>` elements present; first 3
  carry the filled class; last 2 carry the unfilled class; all are `aria-hidden="true"`.
- **showValue=true** (line): percentage text element present AFTER the bar, carries `aria-hidden="true"`.
- **showValue=true** (circle/dashboard): `<text>` inside the SVG present, carries `aria-hidden="true"`.

### Variants / sizes

- **variant classes**: each of `default | info | success | warning | destructive` renders its token class on
  the fill element; `data-variant` matches.
- **size classes**: `sm | md | lg` renders the corresponding height token class; `data-size` matches.
- **striped**: `striped=true` → fill carries the stripe-pattern class; `animated=false` → no animation class.
- **animated**: `striped=true, animated=true` → fill carries both the stripe and the animation class; the
  animation class references a CSS `@keyframes` defined in `lievit-tokens.css` (or the component's CSS
  layer), NOT an inline `style=`.

### Axe-core

- **zero violations** on the determinate render with `label="Uploading"` (all APG progressbar rules pass).
- **`aria-progressbar-name` violation fires** when both `label=null` and `labelledBy=null` (assert that
  the axe rule DOES trigger — this validates the accessibility gate, not a regression to fix in the
  component; the spec documents that the consumer owns the accessible name).
- **`aria-hidden` on inner SVG and segments** passes (no hidden-element-with-content violation because the
  SVG children are purely presentational).
- **`color-contrast`** of visible `showValue` text against the fill background must pass WCAG AA (4.5:1
  for small text); assert with axe-core's `color-contrast` rule.

### Keyboard

- No keyboard assertions (the component has no keyboard interaction; assert that the root element has NO
  `tabindex` attribute, confirming it is not in the tab order).

### Focus

- Assert the root element is NOT focusable (`document.activeElement !== progressEl` after `progressEl.focus()`
  — it does not respond to programmatic focus attempts).

### Escaping (XSS)

- `dataAttrs` hostile value: `dataAttrs={"upload-id": "\">|<script>alert(1)</script>"}` → rendered
  attribute value is HTML-escaped; no `<script>` tag appears in the DOM.
- `attrs` is documented trusted-only; the test asserts its raw content is emitted verbatim (the safety
  contract: only use for STATIC strings).

### JTE compile + render gate

- Covered by the `test/jte-compile` real-compiler gate that runs all `registry/jte/*.jte` files. The four
  form branches (`line | circle | dashboard | steps`) must each be exercised with at least one param
  combination to confirm all JTE conditional paths compile clean.

## 8. Non-goals / anti-patterns

- **Not interactive**: the `progress` partial does not accept `l:click`, `l:model`, or any wire directive.
  If the user must be able to CANCEL a task via the progress bar UI, compose a `button` partial alongside
  it; do not make the progress bar itself clickable.
- **Not a live region**: do not wrap the component in `role="status"` or `aria-live="polite"` by default.
  The consumer decides whether completion needs an AT announcement, and adds a separate `role="status"`
  element. Baking a live region into every progress bar causes chatter for frequently-updating values.
- **Not a slider**: do not add `tabindex`, `role="slider"`, or any keyboard interaction. A progress bar
  is read-only; a user-adjustable value is a `<input type="range">` or the `slider` partial.
- **Not a meter**: do not use `role="meter"`. The distinction is semantic: `progressbar` = task completion
  over time (loading, uploading, processing); `meter` = a static measurement within a range (disk usage,
  fuel level). WAI-ARIA 1.2 and MDN both specify this split. lievit ships a separate `meter` partial for
  the measurement use-case.
- **No framework inside**: no Lit, no Alpine, no React in the implementation. The indeterminate animation
  is pure CSS. The SVG arc math is computed server-side in JTE (`!{var ...}`) or as a Tailwind v4 arbitrary
  value — not by a client-side script.
- **No `aria-busy` on the progress bar itself**: `aria-busy` belongs on the REGION whose content is
  loading (e.g. the data table being fetched), not on the progress bar widget. The component does not
  accept or render `aria-busy`. Document this in the JTE header comment.
- **No hardcoded colours or literals**: all colours from `--lv-*` tokens. The stripe gradient composes
  existing tokens via `color-mix`. No hex, rgb, or oklch literals in the component body — the token-lint CI
  gate enforces this.
- **No `showValue` text duplicated in the a11y tree**: the visible percentage text MUST carry
  `aria-hidden="true"`. The value is already exposed via `aria-valuenow` / `aria-valuetext`; duplicating it
  would cause screen readers to announce the value twice.
- **`animated=true` without `striped=true` is a no-op**: do not silently apply animation to a non-striped
  bar. The template emits a JTE warning comment and ignores `animated` when `striped=false`.

## 8b. Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH) tokens. You MAY read Ant Design Progress + Tailwind UI progress
examples as references for visual look and variant inventory. You MUST NOT paste literal source from any of
them (the one bright line, `02-licensing.md`) — the output is always original generation.

The WAI-ARIA contract (§4) is the load-bearing spec: implement `role="progressbar"`, the
conditional `aria-valuenow` omission for indeterminate, `aria-valuemin="0"`, `aria-valuemax`, and the
`aria-hidden="true"` on all inner presentational children EXACTLY as specified. Verify against
https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/progressbar_role.

Mirror `button.jte` house conventions exactly: header doc-comment with all labelled sections, typed `@param`
with defaults, `data-slot="progress"`, `data-variant`, `data-size`, `data-state`, the two escaping channels,
zero `<script>`, zero inline `on*=`.

The SVG arc math for `circle` / `dashboard` forms must be computed server-side in a JTE `!{var ...}` block:
`strokeDashoffset = circumference * (1 - (value != null ? value : 0) / (double) max)`. For the dashboard
form, the arc subtends 270° (from 135° to 405° on a unit circle). Compute `circumference` as
`2 * Math.PI * radius`.

The indeterminate animation CSS class references a `@keyframes` defined in the shared token CSS layer — do
NOT emit a `<style>` block or inline style (the CSP refuses them). If the `@keyframes` does not yet exist in
`lievit-tokens.css`, add it there as part of this component's delivery (it is a shared motion token, not a
per-component style).

Minimal code to GREEN against the §7 acceptance tests; refactor only while green. The four form branches are
independent JTE conditionals — implement and test each in isolation before composing.
