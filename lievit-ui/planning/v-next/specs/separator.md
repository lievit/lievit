<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — separator

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/separator.jte`, formerly known as `divider`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA 1.2 `separator` role (non-focusable document-structure variant) + HTML-ARIA `<hr>`
      implicit role mapping (`https://www.w3.org/TR/html-aria/#el-hr`); the focusable/widget variant
      (resizable window splitter) is NOT this component — see the `resizable-panes` spec (S2) which is
      BUILT against the APG Window Splitter pattern (`https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/`).
      No react-aria reference needed: a static separator is platform-native (`<hr>` carries role=separator
      for free, zero JS required).
    - inventory: Ant Design Divider as inventory reference (orientation, label/title in the middle,
      line style variants, dashed/solid)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A visual and semantic dividing line that separates sections of content.
Rendered as an `<hr>` element, which carries `role="separator"` implicitly in all browsers and assistive
technologies — zero JS, zero manual ARIA.
The component's job is purely presentational: it receives token-driven styling, an optional orientation
(`horizontal` | `vertical`), an optional label rendered centred in the line, and optional line-style
variants (solid | dashed | dotted).

STATIC display → PARTIAL: there is no client state, no open/close, no selection, nothing to compute
server-side beyond what a `@param`-typed JTE template already covers.
Server-first works trivially — an `<hr>` is the purest possible server-rendered semantic element.

Scope boundary: this component is the NON-FOCUSABLE, NON-INTERACTIVE separator (a typographic/layout
divider).
The FOCUSABLE separator — the keyboard-resizable pane splitter (`role="separator"` + `tabindex="0"` +
`aria-valuenow`/`aria-valuemin`/`aria-valuemax`) — is a distinct component (`resizable-panes`, S2, +ENH
tier) that composes the APG Window Splitter keyboard interaction.
The two share the WAI-ARIA `separator` role name but are entirely different in interaction model; this
spec covers ONLY the non-focusable variant.

## 2. API — params (the typed surface)

| param | type | default | meaning |
|---|---|---|---|
| `orientation` | `String` | `"horizontal"` | `horizontal` \| `vertical` — the axis the line runs along; sets `aria-orientation` + controls layout (horizontal=full-width line, vertical=full-height inline line) |
| `variant` | `String` | `"default"` | `default` \| `dashed` \| `dotted` — the line-stroke style; maps to a CSS border-style token class |
| `decorative` | `boolean` | `false` | when `true`, renders `role="presentation"` instead of `role="separator"`, removing it from the accessibility tree; use when the separation is purely visual and the page structure already communicates the grouping |
| `label` | `String` | `null` | optional centred text label (the Ant Design Divider `children` use case — e.g. "OR", "Section A"); when set, the `<hr>` is replaced by the `label` variant markup (see §6) |
| `labelPosition` | `String` | `"center"` | `left` \| `center` \| `right` — horizontal alignment of the label text; ignored when `label` is null or when `orientation=vertical` |
| `cssClass` | `String` | `""` | extra utility classes passed to the root element |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `id="section-break-1"`); never feed per-row DB-derived values through this channel |

**No `content`/`leading`/`trailing` slots** (a separator has no children beyond the optional `label`
string param; a label is a simple typed string, not a content slot, because arbitrary markup inside a
separator line is an anti-pattern).

**No `wireClick`/`wireArgs`/`dataAttrs`**: the separator is entirely non-interactive; no wire surface.

## 3. Variants / sizes / states

### Variants (line style)
- `default` → solid line, `border-style: solid`, maps to `--lv-color-border`
- `dashed` → dashed line, `border-style: dashed`, maps to `--lv-color-border` with `--lv-dash-array`
- `dotted` → dotted line, `border-style: dotted`, maps to `--lv-color-border`

The variant controls stroke style only, never colour intent: a separator carries no success/warning/
destructive semantic.
Colour belongs to the adopter's theme via the `--lv-color-border` token.

### Orientation
- `horizontal` (default): renders as a full-width block line, `display: block`, `width: 100%`,
  `border-top` of `--lv-border-width` thickness; `aria-orientation="horizontal"`.
- `vertical`: renders as a full-height inline line, `display: inline-block`, `height: 100%` (or
  `height: 1em` in inline flow), `border-left` of `--lv-border-width` thickness;
  `aria-orientation="vertical"`.
  The adopter controls the container height (flex row, inline context); the component does not
  impose a fixed height.

### Label variant
When `label` is non-null the `<hr>` is replaced by a flex row:
```
[line] [label text] [line]
```
Both flanking lines are rendered as `<span>` border-top/bottom elements with `flex: 1`.
The label text lives in a `<span>` with appropriate horizontal padding.
`labelPosition` shifts the flex ratios so the label appears left, centre, or right.
The outer container carries `role="separator" aria-orientation="horizontal"` (label variant is
horizontal-only; vertical separators do not carry a label).

### Decorative variant
When `decorative=true`: the element carries `role="presentation"` (erases it from the a11y tree).
Use only when the surrounding page structure (heading hierarchy, landmark regions) already communicates
the grouping AND the dividing line is purely cosmetic.
Default is `false` (semantic) because erasing the role when in doubt is a worse error than preserving it.

### Sizes
The separator has NO `size` param.
Its visual weight is entirely controlled by the `--lv-border-width` token and the adopter's surrounding
spacing utilities.
There is no sm/md/lg axis: a line is a line; height-based toolbar alignment does not apply here.

### States
- No interactive states: no `:hover`, no `:focus-visible`, no `disabled`, no `aria-invalid`, no `aria-busy`.
- The separator is always non-focusable (`tabindex` is never set).
- The one state variant is `decorative` (changes the role).

## 4. The a11y contract

- **WAI-ARIA role**: `separator` (non-focusable, document structure role).
  Source: WAI-ARIA 1.2 specification `https://www.w3.org/TR/wai-aria-1.2/#separator` and
  HTML-ARIA mapping `https://www.w3.org/TR/html-aria/#el-hr`.
  The `<hr>` element carries `role="separator"` implicitly in all conformant browsers and AT —
  no `role` attribute needed in markup.
  When `decorative=true` the template emits `role="presentation"` explicitly, overriding the implicit
  role to remove the element from the accessibility tree.

- **roles + ARIA attributes emitted by the template**:

  | element | role | aria-* emitted | notes |
  |---|---|---|---|
  | `<hr>` (non-decorative, horizontal) | `separator` (implicit, from `<hr>`) | `aria-orientation="horizontal"` | default; the `horizontal` value is actually the implicit default per spec, but we emit it explicitly for clarity |
  | `<hr>` (non-decorative, vertical) | `separator` (implicit) | `aria-orientation="vertical"` | required: vertical is a non-default orientation that AT must announce |
  | `<hr>` (decorative) | `presentation` (explicit attr) | none | erases semantic; no `aria-*` needed |
  | label-variant outer `<div>` | `separator` (explicit attr) | `aria-orientation="horizontal"` `aria-label="${label}"` | the `<hr>` is replaced; the container carries the role; the label text provides the accessible name |

  `aria-valuenow` / `aria-valuemin` / `aria-valuemax` are intentionally ABSENT: those properties are
  required only on the FOCUSABLE, widget separator (the resizable pane splitter, per APG Window Splitter
  `https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/`).
  A static, non-focusable separator carries no positional value state.

- **keyboard map**:

  | key | action | who |
  |---|---|---|
  | (none) | the separator is not focusable and receives no keyboard interaction | — |

  This is the complete keyboard map for the non-focusable separator.
  There are zero keys: the element is inert in keyboard navigation, as required by the WAI-ARIA
  non-focusable document-structure role.
  This is NOT a gap — it is correct.
  The focusable/resizable variant (arrow keys for resize, Enter for collapse, Home/End for limits) lives
  in `resizable-panes` (+ENH, S2), NOT here.

- **focus management**: none.
  The separator is never in the tab order.
  `tabindex` is never set on this component.
  No initial focus, no focus trap, no focus restore, no roving tabindex.

- **live region**: none.
  A separator does not announce anything; it is a static structural element.

- **screen-reader expectations**:
  - A horizontal `<hr>` is announced by NVDA/JAWS/VoiceOver as "separator" or "horizontal separator"
    when the virtual cursor passes over it.
  - A vertical separator with `aria-orientation="vertical"` is announced as "vertical separator".
  - A label-variant separator with `aria-label="${label}"` is announced as e.g. "OR, separator".
  - A decorative separator (`role="presentation"`) is silently skipped by all AT — no announcement.

- **shared mechanisms composed**: none.
  The separator composes no shared enhancer, no popover seam, no focus-trap, no collection-nav.
  It is the simplest possible a11y tier: a native element whose role is implicit and whose keyboard
  contract is empty.
  This is the canonical exemplar of "prefer a real native element with its own semantics over a
  div-with-role" for structural/display components.

## 5. Tokens

The separator reads the following `--lv-*` tokens:

| token | use |
|---|---|
| `--lv-color-border` | the line colour (OKLCH source-of-truth; both light and dark resolved via the dark-mode re-point block) |
| `--lv-border-width` | the stroke thickness of the line (1px by default) |
| `--lv-space-4` | default vertical margin above/below a horizontal separator (block flow spacing) |
| `--lv-space-2` | default horizontal margin left/right of a vertical separator (inline flow spacing) |
| `--lv-space-3` | horizontal padding around the label text in the label variant |
| `--lv-text-sm` | label text size |
| `--lv-color-muted` | label text colour (lower contrast than body text; the label is secondary) |
| `--lv-font-sans` | label text font |

**NET-NEW tokens**: none.
All tokens already exist in the v2 token set.
The separator is among the least token-hungry components in the library; no new token is warranted.

**Colour authored in OKLCH** (architecture contract §4): `--lv-color-border` and `--lv-color-muted` are
OKLCH-sourced in the token file; the separator does not introduce or bake any literal colour.

## 6. Wire / island integration

**Static, no enhancer.**

The separator is a PARTIAL with zero client-side behaviour.
No `l:*` directives, no wire actions, no round-trips, no typed-TS enhancer, no lifecycle hooks.
The lievit runtime does not touch it after render.

### JTE template structure

**Horizontal (no label)**:
```html
<hr
  class="block w-full border-t [--lv-border-width] [margin block --lv-space-4] ${cssClass}"
  aria-orientation="horizontal"
  ${decorative ? "role=\"presentation\"" : ""}
  $unsafe{attrs}
/>
```

**Vertical**:
```html
<hr
  class="inline-block h-full border-l [--lv-border-width] [margin inline --lv-space-2] self-stretch ${cssClass}"
  aria-orientation="vertical"
  ${decorative ? "role=\"presentation\"" : ""}
  $unsafe{attrs}
/>
```

**Label variant** (horizontal only, `label` is non-null):
```html
<div
  class="flex items-center gap-[--lv-space-3] [margin block --lv-space-4] ${cssClass}"
  role="separator"
  aria-orientation="horizontal"
  aria-label="${label}"
  $unsafe{attrs}
>
  <span class="flex-1 border-t [--lv-border-width] [--lv-color-border]" aria-hidden="true"></span>
  <span class="[--lv-text-sm] [--lv-color-muted] [--lv-font-sans] shrink-0
               ${labelPosition == "left" ? "[flex-basis: 0% / grow-0 on left span]" :
                 labelPosition == "right" ? "[flex-basis: 0% / grow-0 on right span]" : ""}">
    ${label}
  </span>
  <span class="flex-1 border-t [--lv-border-width] [--lv-color-border]" aria-hidden="true"></span>
</div>
```

The two flanking `<span>` elements carry `aria-hidden="true"` because they are purely decorative lines;
the accessible name comes from `aria-label` on the container.
The label text `<span>` renders the `label` param value as a JTE expression (auto-escaped by JTE,
no `$unsafe` needed here; no XSS surface).

**Variant (dashed/dotted)**: a `!{var variantClass = ...}` switch in the template maps the `variant`
param to a Tailwind utility class that sets `border-style`:
```
default → border-solid
dashed  → border-dashed
dotted  → border-dotted
```
These classes compose with the `border-t` / `border-l` stroke direction class already on the element.

**`data-slot` + data attributes** (the house convention):
```html
data-slot="separator"
data-orientation="${orientation}"
data-variant="${variant}"
data-decorative="${decorative}"
```
These attributes live on the root element and serve as CSS styling hooks + test targets.
The implementation agent MUST follow the JTE house convention (architecture contract §3) and
emit these exactly.

**Zero `<script>`, zero inline `on*=`**: the component is fully server-rendered markup with no
client execution. The strict CSP is satisfied trivially.

## 7. Acceptance tests

The separator is DONE only when ALL of the following pass on a REAL substrate.

### 7.1 Render tests (jsdom, real JTE compiler via the `test/jte-compile` gate)

- **`renders-horizontal-hr`**: the default render produces a single `<hr>` element; `data-slot="separator"`;
  `data-orientation="horizontal"`; `aria-orientation="horizontal"` present; no `role` attribute (the
  implicit `<hr>` role is relied upon).
- **`renders-vertical-hr`**: `orientation="vertical"` produces `<hr aria-orientation="vertical">` with
  `data-orientation="vertical"`; no `role` attribute.
- **`renders-dashed-variant`**: `variant="dashed"` produces `data-variant="dashed"` and the element
  carries the `border-dashed` utility class (or equivalent); no `border-solid`.
- **`renders-dotted-variant`**: `variant="dotted"` analogous to dashed.
- **`renders-decorative`**: `decorative=true` produces `role="presentation"` on the element and removes
  `aria-orientation` (a presentation element carries no ARIA state properties).
- **`renders-label-variant`**: `label="OR"` produces a `<div>` container (not `<hr>`); the container
  has `role="separator"`, `aria-orientation="horizontal"`, `aria-label="OR"`; exactly two flanking
  `<span aria-hidden="true">` elements surround the label `<span>`; the label text "OR" is visible in
  the DOM.
- **`label-position-left`**: `label="OR" labelPosition="left"` — assert the label `<span>` is the first
  child after the container open (or that the flex classes skew the left line to zero width); the label
  appears at the left edge visually.
- **`label-position-right`**: analogous for `labelPosition="right"`.
- **`cssClass-forwarded`**: a custom `cssClass="my-custom"` appears on the root element.
- **`attrs-forwarded`**: `attrs='id="my-sep"'` appears verbatim on the root element (trusted raw channel).
- **`label-xss-safe`**: `label='<script>alert(1)</script>'` renders the label text HTML-escaped
  (`&lt;script&gt;...`) in the DOM; no script executes. (JTE auto-escaping; assert the inert text.)

### 7.2 Accessibility tests (axe-core on the rendered DOM)

- **`axe-horizontal`**: run axe-core on the default horizontal `<hr>` render; zero violations.
- **`axe-vertical`**: run axe-core on the vertical `<hr>` render; zero violations.
- **`axe-label-variant`**: run axe-core on the label variant render; zero violations (the `aria-label`
  on the `role="separator"` container provides the accessible name the role requires when using a `<div>`
  instead of `<hr>`).
- **`axe-decorative`**: run axe-core on `decorative=true` render; zero violations (the
  `role="presentation"` is valid on `<hr>`).

### 7.3 Keyboard tests

- **`not-focusable`**: assert the rendered separator element is NOT in the tab order; `tabIndex` is
  `-1` or not set; a synthetic Tab keydown does not land focus on the separator.
  (This is the COMPLETE keyboard contract for the non-focusable separator.)

### 7.4 Variants / data attributes gate

- **`data-attrs-all-variants`**: for each `variant` value (`default`, `dashed`, `dotted`) and each
  `orientation` value (`horizontal`, `vertical`): assert `data-variant` and `data-orientation` are
  correctly emitted on the root.

### 7.5 JTE compile gate

- **covered by the `test/jte-compile` real-compiler gate** that runs on every pre-commit; no
  separate test needed — the gate fails if the template has a syntax error.

## 8. Non-goals / anti-patterns

- **NOT a resizable/focusable splitter**: do NOT set `tabindex="0"`, `aria-valuenow`, `aria-valuemin`,
  or `aria-valuemax` on this component. Those attributes belong on the focusable widget separator
  (`resizable-panes`, S2). Adding them here would expose a non-interactive element as a widget and
  confuse AT users expecting keyboard resize behaviour.
- **NOT a section heading**: if the visual break also needs to communicate a section title with
  heading semantics, use an `<h*>` element alongside or instead of the separator.
  The `label` param is a supplementary annotation, never a structural heading.
- **NOT for vertical rules inside form controls**: the separator is a standalone layout element,
  not a divider inside an `<input>` group (that role belongs to the `input-group` component's
  internal chrome).
- **NOT for navigation links**: a separator inside a `<menu>` or `<nav>` list uses the native
  `<li role="separator">` pattern managed by the parent menu component, not a standalone
  `<lv-separator>` embedded mid-list.
- **NO `size` param**: the separator intentionally omits the sm/md/lg height-based size axis.
  Its visual weight is controlled by `--lv-border-width` (a token-level concern) and surrounding
  spacing classes passed through `cssClass`.
  Adding a size axis would imply the separator participates in toolbar-height alignment, which it
  does not — it is orthogonal to controls.
- **NO hardcoded colour literals**: the separator never writes `border-gray-200` or any literal
  Tailwind colour class.
  All colour comes from `var(--lv-color-border)` so the adopter's theme (including dark mode) applies
  without component edits.
- **NO `<script>` or inline `on*=`**: the separator is the simplest case of the CSP-clean rule.
  There is zero JS anywhere near it.
- **NO arbitrary `Content` slot**: the separator does not accept arbitrary child markup.
  The optional `label` is a typed `String` param.
  Accepting a `gg.jte.Content` slot would allow arbitrary nested interactive elements inside a
  separator line, which is a semantic anti-pattern.
