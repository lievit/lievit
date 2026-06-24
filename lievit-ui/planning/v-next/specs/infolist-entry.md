<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — infolist-entry

- **tier**: PARTIAL
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of the kit-facing display-row helper; aligns with the
  `data-list / description-list / key-value` family in `03-component-inventory.md`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: no WAI-ARIA APG interactive pattern (static display); the `<dl>`/`<dt>`/`<dd>` native
      semantic structure is the a11y mechanism — platform-supplied, no enhancer needed (the
      simplest tier: "prefer a real native element over a div-with-role")
    - inventory: Ant Design Descriptions as inventory reference (sizes, variants, bordered/plain,
      colon toggle, icon leading, colspan); Filament `InfolistEntry` field family as kit-usage reference
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A single labelled key-value row used inside a description list (`<dl>`), rendering one piece of
read-only structured data with a label and a value region. The canonical use is the
`infolist` / `descriptions` pattern: a grid of labelled facts about a record (name, status, address,
date) as part of a detail view or a form read-only summary.

STATIC display → PARTIAL: the component holds no interaction state. The server knows the label and
the value; it renders them once. The consuming template (a WIRE detail view, a HTMX-loaded panel, or a
plain JTE page) builds the `<dl>` container and fills it with `infolist-entry` partials. Server-first
works trivially: a key-value display row has nothing client-side.

**Decision rule**: "pure display → PARTIAL" (architecture contract §1). The value region accepts a
`gg.jte.Content` slot so the adopter can project any server-rendered value markup (a badge, an avatar,
a plain string, a formatted date), keeping the partial composable without hardcoding value-render logic
inside it. No enhancer, no WIRE round-trip.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `label` | `String` | — (required) | the human-readable field label; rendered inside `<dt>`; the accessible name for the entry; MUST NOT be blank |
| `variant` | `String` | `"default"` | `default` (label muted, value full-ink) \| `highlight` (value rendered with `--lv-color-primary` ink for emphasis) \| `destructive` (value in `--lv-color-destructive` ink, for error/critical facts) \| `success` (value in `--lv-color-success` ink) \| `warning` (value in `--lv-color-warning` ink) — INTENT vocabulary, shared library set |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — controls the vertical rhythm (padding, font sizes) of the label + value block; aligns with the toolbar-aligned height scale when `infolist-entry` is used in a row that also contains form controls |
| `orientation` | `String` | `"vertical"` | `vertical` (label above value, stacked) \| `horizontal` (label left, value right, inline — responsive: collapses to vertical at narrow width) |
| `bordered` | `boolean` | `false` | wraps the entry in a cell border (for use inside a bordered grid container); adds `--lv-border` around the `<dt>`/`<dd>` pair |
| `colon` | `boolean` | `true` | appends a colon glyph after the label text (the Descriptions convention; set `false` for clean list-style rendering) |
| `colspan` | `int` | `1` | the number of grid columns the entry spans when the parent `<dl>` is a CSS grid layout; rendered as `data-colspan="<n>"` on the root for the parent grid to consume via `grid-column: span <n>` |
| `empty` | `String` | `"—"` | fallback text rendered in `<dd>` when the `value` slot is not provided or its content is effectively empty; also used in screen-reader announcement so blank fields are not silent |
| `copyable` | `boolean` | `false` | NET-NEW: renders a small copy-to-clipboard icon button alongside the value; uses the native Clipboard API (CSP-clean, no eval/inline), fires a transient copied-state class; the copy trigger is a real `<button>` with `aria-label` |
| `loading` | `boolean` | `false` | replaces the value region with a skeleton pulse (`role="status" aria-label="Loading"`) while the parent WIRE component is fetching; `aria-busy` on the root |
| `cssClass` | `String` | `""` | extra utility classes appended to the root element |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `data-testid="..."`, `id="..."`); never feed a per-row DB value here |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (each value through `Escape.htmlAttribute`); for per-row dynamic identifiers |
| `leading` | `gg.jte.Content` | `null` | optional icon or avatar rendered before the label text inside `<dt>` (e.g. a Lucide icon to give the field a visual anchor) |
| `value` | `gg.jte.Content` | `null` | the value markup projected into `<dd>`; when omitted the `empty` string is rendered instead; accepts any server-rendered markup (a badge, a formatted date, a link) |

## 3. Variants / sizes / states

### Variants

Each variant maps to an INTENT token pair applied to the `<dd>` value region. The `<dt>` label
stays muted in all variants (it is structural, not the emphasis surface).

| variant | `<dd>` ink token | `<dd>` background | use-case |
|---|---|---|---|
| `default` | `--lv-color-fg` | transparent | standard fact display |
| `highlight` | `--lv-color-primary` | `--lv-color-primary` at `5%` opacity | a value the user's eye should land on first (a key identifier, an ID) |
| `destructive` | `--lv-color-destructive` | `--lv-color-destructive` at `8%` opacity | a critical or erroneous value (expired status, over-limit amount) |
| `success` | `--lv-color-success` | `--lv-color-success` at `8%` opacity | a confirmed/approved value |
| `warning` | `--lv-color-warning` | `--lv-color-warning` at `8%` opacity | a value requiring attention but not an error |

Rendered via `data-variant="<variant>"` on the root and a switch-driven token class in `!{var
variantClass = ...}` — the same pattern as `button.jte`.

### Sizes

The `size` param controls the font size and vertical padding of the label + value block. It does NOT
enforce a fixed element height (this is a display block, not a control), but the scale is calibrated
so that when `infolist-entry` appears in a mixed-content row alongside `button`/`input`, choosing the
same size produces visual baseline alignment.

| size | label font | value font | block padding-y |
|---|---|---|---|
| `sm` | `--lv-text-xs` | `--lv-text-sm` | `--lv-space-1` |
| `md` | `--lv-text-sm` | `--lv-text-base` | `--lv-space-2` |
| `lg` | `--lv-text-sm` | `--lv-text-lg` | `--lv-space-3` |

### Orientation

`vertical` (default): `<dt>` stacked above `<dd>`, single-column, full width of the grid cell.
`horizontal`: `<dt>` occupies a fixed label column (`--lv-space-32` = ~128px by default, adopter
overrides via `--lv-infolist-label-w`), `<dd>` fills the remainder. At narrow widths (below
`--lv-breakpoint-sm`) the horizontal orientation collapses to vertical automatically via a CSS
container query (no JS needed, CSP-clean).

### States

| state | visual | ARIA |
|---|---|---|
| `loading=true` | skeleton pulse replaces `<dd>` content | `aria-busy="true"` on root; `role="status" aria-label="Loading"` on the skeleton |
| `copyable=true` | copy icon button appears trailing the value; on activation: `aria-label` shifts to "Copied" for 1500ms | copy `<button>` has `aria-label="Copy <label>"` at rest; `aria-label="Copied"` during feedback |
| `bordered=true` | `--lv-border` ring around the root | no ARIA change (visual only) |
| empty value | `empty` fallback text rendered in `<dd>` | the `empty` string is the text content; screen readers read it as the value |

No interactive hover/focus state on the root (it is not a control). The `copyable` button gets
focus-visible treatment via `--lv-ring`.

### Slots

| slot param | type | what goes in |
|---|---|---|
| `leading` | `gg.jte.Content` | icon, avatar, or color swatch before the label |
| `value` | `gg.jte.Content` | the value markup: plain text, badge, link, avatar, formatted date — any server-rendered markup |

No `footer` or `trailing` slot at root level (the copyable button is generated internally; the
`value` slot is the value surface, adopter projects what they need there).

## 4. The a11y contract

- **WAI-ARIA pattern**: none — static display, no APG interactive pattern.
  The semantic mechanism is the native HTML `<dl>` / `<dt>` / `<dd>` description list, which is the
  correct native structure for key-value pairs and is already understood by all screen readers. The APG
  does not define a separate "descriptions" interaction pattern because the native elements supply the
  complete semantic model: the `<dt>` is the term, the `<dd>` is the definition/value, and the `<dl>`
  groups them. No `role` override is needed or correct.

  Reference: WHATWG HTML Living Standard §4.4.9 (the `dl`, `dt`, `dd` elements) and
  https://www.w3.org/WAI/ARIA/apg/patterns/ (no dedicated "key-value display" pattern; the APG
  correctly defers to native `<dl>` semantics for static description lists).

- **Roles + ARIA**:
  | element | role / attribute | condition |
  |---|---|---|
  | root `<div>` | `data-slot="infolist-entry"` `data-variant` `data-size` `data-orientation`; `aria-busy="true"` when `loading` | always |
  | `<dt>` | native `<dt>` (term role, implicit) | always; contains optional `leading` slot then label text; colon appended via CSS `::after { content: ":" }` (NOT a literal colon in the DOM — avoids a screen reader reading "label colon value" with a spoken colon character) |
  | `<dd>` | native `<dd>` (definition role, implicit) | always; contains `value` slot or `empty` fallback |
  | skeleton `<span>` | `role="status" aria-label="Loading"` | when `loading=true`; replaces `<dd>` content |
  | copy `<button>` | native `<button aria-label="Copy <label>">`; shifts to `aria-label="Copied"` during feedback | when `copyable=true` |
  | `leading` icon | `aria-hidden="true"` | always (it is decorative; the label text is the accessible name) |

- **Keyboard map**:
  | key | does | who |
  |---|---|---|
  | Tab | moves focus to the copy button (when `copyable=true`); otherwise no focusable elements | platform |
  | Enter / Space | activates the copy button | platform (native `<button>`) |

  No arrow-key or typeahead behavior: this is a static display component, not a collection. The
  platform handles tab-stop management for the copy button; no enhancer is needed.

- **Focus management**: platform. The copy `<button>` is the sole focusable element. Focus-visible
  ring via `--lv-ring`. No trap, no roving, no focus-return (non-interactive root). The temporary
  "Copied" `aria-label` change on the button is the only dynamic ARIA update; it reverts after 1500ms
  via a CSS animation + the native Clipboard API callback (no `setTimeout` in a CSP-strict
  environment — uses `transitionend` or `animationend` on the feedback class).

- **Live region**: none at component level. The copy feedback is on the button itself via
  `aria-label` mutation (sufficient for a single-element feedback; no separate `role="status"` needed
  for copy-to-clipboard per WCAG 4.1.3 Status Messages practice — the button IS the status surface).

- **Shared mechanism composed**: none. This is a platform-native display component; it composes no
  shared a11y enhancer. The `copyable` button uses the native Clipboard API directly (CSP-clean,
  no eval) and the platform for keyboard access. This is deliberately the simplest possible tier —
  the `button.jte` pattern applied to a display primitive.

- **Screen-reader expectation**: a screen reader navigating a `<dl>` containing `infolist-entry`
  partials announces each term-definition pair naturally ("label: value" where the colon is expressed
  via the CSS `::after` content, not in the DOM). The empty fallback ("—" by default) is read as the
  value for blank fields, so no silent gaps. Loading state is announced via `role="status"`.

## 5. Tokens

### Consumed tokens (reads only `var(--lv-*)`, never a literal)

| token | use |
|---|---|
| `--lv-color-fg` | default value ink; label-secondary ink for `default` variant |
| `--lv-color-muted` | `<dt>` label text (muted, structural) in all variants |
| `--lv-color-primary` | value ink + tinted background for `highlight` variant |
| `--lv-color-destructive` | value ink + tinted background for `destructive` variant |
| `--lv-color-success` | value ink + tinted background for `success` variant |
| `--lv-color-warning` | value ink + tinted background for `warning` variant |
| `--lv-color-border` | `bordered` cell border |
| `--lv-color-skeleton` | skeleton pulse background (the loading state animation) |
| `--lv-text-xs` | `sm` label font size |
| `--lv-text-sm` | `md` label font size + `sm` value font size |
| `--lv-text-base` | `md` value font size |
| `--lv-text-lg` | `lg` value font size |
| `--lv-font-sans` | base font family |
| `--lv-space-1` | `sm` block padding-y |
| `--lv-space-2` | `md` block padding-y |
| `--lv-space-3` | `lg` block padding-y |
| `--lv-space-2` | gap between `leading` icon and label text |
| `--lv-space-2` | gap between value and copy button |
| `--lv-radius-sm` | bordered cell radius; skeleton pulse radius |
| `--lv-ring` | focus-visible ring on the copy button |
| `--lv-motion-duration-fast` | skeleton animation duration; copy feedback transition |

### NET-NEW tokens proposed

| token | value (OKLCH) | justification |
|---|---|---|
| `--lv-color-skeleton` | `oklch(0.92 0 0)` (light) / `oklch(0.25 0 0)` (dark) | a neutral pulse background for the loading skeleton; distinct from `--lv-color-muted` (which is text) and `--lv-color-border` (which is a line); no existing token covers a fill-area neutral for skeletons. Additive, goes in `:root` + `.dark, [data-theme="dark"]` re-point block. |
| `--lv-infolist-label-w` | `8rem` | the label column width for `horizontal` orientation; a layout custom property (not a colour token), gives the adopter a single override point without editing the component. Additive, goes in `:root`. |

All colour tokens are OKLCH (source-of-truth format, architecture contract §4). No literal colours
inside the component body.

## 6. Wire / island integration

**Static, no enhancer** for the core display path.

The component is a PARTIAL that the adopter's JTE template stamps out in a loop or a set of explicit
`@template.lievit.infolistEntry(...)` calls. The consuming template supplies label, variant, value
slot, etc. from the Java model. The partial renders to plain HTML + `--lv-*` tokens — no client
script is needed for read-only key-value display.

### JTE structure (the server-rendered markup)

```
<div data-slot="infolist-entry"
     data-variant="${variant}"
     data-size="${size}"
     data-orientation="${orientation}"
     [aria-busy="true" when loading]
     [extra cssClass, attrs, dataAttrs]>

  <dt class="[muted label classes]">
    [leading slot — aria-hidden icon if provided]
    [label text]                          <!-- colon via CSS ::after, not in DOM -->
  </dt>

  <dd class="[value classes per variant]">
    [if loading]
      <span role="status" aria-label="Loading"
            class="[skeleton pulse classes]"></span>
    [else if value slot provided]
      [value slot content]
      [if copyable]
        <button type="button"
                aria-label="Copy ${label}"
                class="[copy icon button classes, focus-visible ring]">
          @template.lievit.icon(name="copy", ariaHidden=true)
        </button>
      [end]
    [else]
      ${empty}
    [end]
  </dd>

</div>
```

Key JTE conventions (mirror `button.jte` exactly):
- Header doc-comment with `TIER:`, `STRUCTURE:`, `A11y:`, `Params:`, `Usage:` labelled sections,
  citing Ant Design Descriptions + WHATWG `<dl>` as the source.
- All `@param` typed, no defaults hardcoded in the template body.
- The colon after the label is a CSS `<dt>::after { content: ": " }` (toggled off when `colon=false`
  via `data-colon="false"` on the root) — NEVER a literal `:` in the DOM string, which would be
  read aloud by screen readers as a punctuation character between term and definition.
- `data-slot="infolist-entry"` on the root for styling hooks + test targets.
- Zero `<script>`, zero inline `on*=` handlers (CSP-strict invariant).
- `attrs` = TRUSTED raw (`$unsafe`), STATIC author-typed strings only.
  `dataAttrs` = SAFE escaped (`Map<String,String>`, `Escape.htmlAttribute` per value).
- No per-row DB value flows through `attrs`; use `dataAttrs` for dynamic identifiers.

### Copyable button behavior (the one irreducible client interaction)

The copy-to-clipboard behavior is intentionally NOT a typed-TS enhancer — it is simple enough to
live as a minimal vanilla script in the lievit runtime's directive registry (a `l:copy` directive,
or a `data-lievit-copy="true"` marker that the runtime's lifecycle `onDomReady` picks up). It:
1. reads the text content of the sibling `<dd>` (or a `data-copy-value` override attribute).
2. calls `navigator.clipboard.writeText(...)`.
3. sets a `data-copied` attribute on the `<button>` for 1500ms (CSS drives the visual + `aria-label`
   swap via `[data-copied] { aria-label: "Copied" }` — not achievable with pure CSS `content`;
   the runtime sets `button.setAttribute('aria-label', 'Copied')` then reverts via `setTimeout` on
   the clipboard promise resolve, which IS CSP-clean since it is an evaluated-once registered
   callback in the runtime's own scope, not an inline handler).
4. If `navigator.clipboard` is unavailable (insecure context), the button is hidden via
   `data-clipboard-unsupported` and the feature degrades silently (the entry still displays its value).

This is NOT an enhancer file. It is a runtime directive (`data-lievit-action="copy"` or equivalent),
registered once in the runtime's directive registry and consumed by the partial's markup. The partial
emits the correct `data-*` hooks; the runtime binds the behavior. No `<script>` in the `.jte`.

## 7. Acceptance tests

The component is DONE only when ALL of the following pass on a REAL substrate (not a mocked one —
the client-island-fidelity lesson from the repo CLAUDE.md).

### Render tests (jsdom, real JTE compile + render)

- **renders label and value**: given `label="Status"` and a `value` slot containing `"Active"`,
  the rendered HTML contains a `<dt>` with text "Status" and a `<dd>` with text "Active";
  `data-slot="infolist-entry"` is present on the root.
- **renders empty fallback**: given `label="Note"` and no `value` slot, the `<dd>` contains the
  `empty` string (default `"—"`); a custom `empty="n/a"` param renders `"n/a"`.
- **colon via CSS, not DOM**: with `colon=true` (default), the `<dt>` text content does NOT include
  a literal colon character; the root carries no `data-colon="true"` that would cause a reader to
  inject a colon into the text node. With `colon=false`, `data-colon="false"` is set on the root.
- **leading slot projects**: when `leading` slot is provided (an `@template.lievit.icon(...)` call),
  the icon renders inside `<dt>` with `aria-hidden="true"`.
- **colspan attribute**: `colspan=2` renders `data-colspan="2"` on the root.
- **loading state**: `loading=true` renders `aria-busy="true"` on the root and a skeleton `<span>`
  with `role="status" aria-label="Loading"` inside `<dd>`; the `value` slot content is absent.
- **copyable button**: `copyable=true` renders a `<button type="button">` with
  `aria-label="Copy Status"` (substituting the actual label) inside `<dd>`, after the value.
- **escaping (XSS abuse-case)**: `dataAttrs={id: "\">|<script>alert(1)</script>"}` renders the
  value HTML-escaped in the `data-id` attribute, inert; `attrs` is documented TRUSTED-only and
  never fed a DB-derived value in this component.
- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate;
  the partial must compile without error under the precompiled JTE mode (`gg.jte.use-precompiled-templates=true`).

### Accessibility tests (axe-core, on the real rendered DOM)

- **axe-core — default state**: zero violations on a rendered `infolist-entry` with label + value,
  inside a `<dl>` container. Cited rules checked: `definition-list` (dl contains only dt/dd/script/
  template), `dlitem` (dt/dd are children of dl), `label` (not applicable, but checked for false
  positives), `aria-allowed-attr`, `aria-required-children`.
- **axe-core — loading state**: zero violations when `loading=true`; `role="status"` use is valid.
- **axe-core — copyable**: zero violations when `copyable=true`; the copy button has a non-empty
  accessible name (`aria-label="Copy Status"`).
- **axe-core — without `<dl>` wrapper (advisory)**: records but does not gate on the `dlitem`
  violation — the partial is designed for use inside a `<dl>`, and the violation is expected when
  tested in isolation; a composite `infolist` test (see below) covers the real usage context.
- **composite infolist axe-core**: a `<dl>` containing three `infolist-entry` partials (different
  variants, one loading, one copyable) produces zero violations.

### Keyboard tests (platform-level, no enhancer to test)

- **no focusable elements by default**: a rendered `infolist-entry` with `copyable=false` contains
  zero elements reachable by Tab (assert `querySelectorAll('[tabindex]:not([tabindex="-1"]), button, a, input')` is empty).
- **copy button is Tab-reachable**: with `copyable=true`, one `<button>` is present; Tab moves focus
  to it; Enter and Space both trigger the button's click event (platform — assert `click` fires).
- **copy button disabled context**: when `navigator.clipboard` is unavailable (mock in test), the
  copy button is absent or has `hidden` attribute (degradation test).

### Variant / size / orientation tests

- **all variants emit correct data-variant**: for each of `default | highlight | destructive | success | warning`,
  assert `data-variant="<v>"` on the root and that the `<dd>` carries the correct token utility
  classes (per the variant switch).
- **all sizes emit correct data-size**: `sm | md | lg` each set `data-size` and the expected
  padding + font size token classes.
- **horizontal orientation**: with `orientation="horizontal"`, `data-orientation="horizontal"` is
  set; the component renders a layout where `<dt>` and `<dd>` are siblings (not stacked) — assert
  the CSS class that drives the horizontal grid is present.
- **bordered**: `bordered=true` adds the border token class to the root.

### Copyable interaction test (real Clipboard API or mock in jsdom)

- **copy writes to clipboard**: mount with `copyable=true`, click the copy button, assert
  `navigator.clipboard.writeText` was called with the `<dd>` text content (jsdom mock).
- **feedback state**: after click, the button carries `data-copied` attribute; after 1500ms it
  is removed (use fake timers); the `aria-label` is `"Copied"` during the window.
- **clipboard unavailable degrades silently**: with `navigator.clipboard` undefined, the copy button
  is not rendered (or is hidden); no error thrown; value still displays.

### Composite / real-usage test (Playwright, legacy-VM oracle)

- **renders resolved value in a real detail panel**: open a record detail page that uses
  `infolist-entry` partials for display (via the WIRE panel that loads them); assert the `<dt>`
  labels and `<dd>` values are present and non-empty for known fields — proves real data flows
  from the server model into the partial (not a fake substrate; the client-island-fidelity lesson).
- **copy gesture in real browser**: Playwright grants clipboard permission; clicking the copy button
  results in the field value in the clipboard; the button shows the "Copied" state visually.

## 8. Non-goals / anti-patterns

- **NOT a form control**: `infolist-entry` does NOT render an `<input>`, `<select>`, or `<textarea>`.
  Editable key-value pairs belong to the form-control family (`field` + `input`). An edit flow
  replaces the `infolist-entry` with a form (a WIRE pattern), it does not extend this partial.
- **NOT a row in a data table**: tabular data with sortable columns belongs to `table / data-table`.
  `infolist-entry` is for record-detail display (a single record's named fields), not for multi-row
  comparisons across records. Placing it inside a `<table>` is an anti-pattern.
- **No data hardcoded inside the partial**: option sets, enum labels, status text — none of it.
  The adopter's controller derives the display value and passes it in via the `value` slot. The
  partial renders; it never decides what a field value means (repo CLAUDE.md: "no data in a partial").
- **No inline `<script>` or `on*=` handlers**: the copy behavior is a runtime directive, not an
  inline handler. Any deviation violates the strict CSP (`script-src 'self'`, no `'unsafe-inline'`)
  and will be silently refused by the browser without an error — the failure mode the CSP was
  designed to prevent.
- **No hardcoded literal colours**: every colour value is `var(--lv-*)`. A retheme is a token
  override in `:root`, not a component edit. The token-lint CI gate enforces this.
- **No `role` override on `<dt>` or `<dd>`**: the native elements already carry the correct implicit
  roles (`term` / `definition`). Adding `role="term"` or `role="definition"` explicitly is redundant
  and risks divergence if the native semantics evolve. The anti-pattern of `<div role="term">` is
  explicitly forbidden — use the real `<dt>`.
- **Not a value formatter**: currency formatting, date localisation, percent display — those happen
  in the controller or in a composed partial passed as the `value` slot. `infolist-entry` is the
  structural container, not the formatting layer.
- **No client-side state for the value**: the value is server-truth, rendered once. If the value can
  change (a live counter, a polling metric), the consuming WIRE component re-renders the whole entry
  via morph; the partial does not manage client-side reactive state. "State has one owner: the server."
