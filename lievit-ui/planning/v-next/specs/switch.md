<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — switch

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/switch.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Switch (https://www.w3.org/WAI/ARIA/apg/patterns/switch/) — the button-based
      example (https://www.w3.org/WAI/ARIA/apg/patterns/switch/examples/switch-button/) is the primary
      pattern reference; the checkbox-based form variant informs the fieldset/legend grouping pattern;
      platform `<button role="switch">` carries keyboard + toggle for free — no react-aria reference
      needed beyond the APG
    - inventory: Ant Design Switch as inventory reference (sizes, loading, inner label on/off, icons
      in the thumb, disabled)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A toggle control that represents a binary on/off setting: a styled `<button role="switch">` whose
`aria-checked` attribute reflects the current state. The switch is a PRESENTATIONAL primitive: it
holds NO state of its own. The consuming WIRE template (or form) owns the checked state and wires
the toggle action via `l:click="toggle"` on the rendered element, or a plain form submit carries the
value. Server-first works trivially here — there is nothing irreducibly client about a binary toggle.
The platform `<button>` gives role + Enter/Space + focus for free; no enhancer is needed.

Use a switch — not a checkbox — when the setting takes effect IMMEDIATELY on toggle (live, no form
submit needed to apply). Use a checkbox inside a `<form>` when the value is submitted with other
fields. This distinction is semantic and affects both the element choice and the ARIA pattern; both
variants are covered by this partial (controlled by the `asCheckbox` param, see §2).

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| checked | boolean | false | the current on/off state — REQUIRED (the template is always a snapshot of server truth; client never sets this) |
| size | String | "md" | sm \| md \| lg — HEIGHT-based, thumb-plus-track height; toolbar-aligned |
| disabled | boolean | false | dims + blocks activation; native `disabled` on `<button>`, `aria-disabled` on `<a>`-role variant |
| loading | boolean | false | shows a spinner in the thumb, sets `aria-busy="true"`, blocks activation (the round-trip is in-flight) |
| asCheckbox | boolean | false | when `true`, renders an `<input type="checkbox" role="switch">` instead of a `<button role="switch">` — use inside a `<form>` when submitting with other fields; the native `checked`/`name`/`value` attrs are then meaningful |
| name | String | null | `name` attribute for the `<input>` when `asCheckbox=true`; ignored when false |
| value | String | "on" | `value` attribute for the `<input>` when `asCheckbox=true` |
| ariaLabel | String | null | `aria-label` — REQUIRED when there is no adjacent visible `<label>` (e.g. a standalone icon-labelled switch); the accessible name MUST exist |
| ariaLabelledBy | String | null | `aria-labelledby` referencing an external element's id — alternative to `ariaLabel`; used when an external `<label>` or heading provides the name |
| ariaDescribedBy | String | null | `aria-describedby` referencing a hint/description element's id |
| onLabel | String | null | visible text rendered INSIDE the track when checked (e.g. "On") — hidden from AT via `aria-hidden` to avoid redundancy with `aria-checked`; optional, Ant Design inner-label style |
| offLabel | String | null | visible text rendered inside the track when NOT checked (e.g. "Off") — likewise `aria-hidden` |
| cssClass | String | "" | extra utility classes appended to the root track element |
| attrs | String | "" | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (wire directives, `form` attr) |
| dataAttrs | Map<String,String> | {} | **SAFE escaped** dynamic `data-*` attributes (each value via `Escape.htmlAttribute`) |
| wireClick | String | null | **SAFE** wire action name → `l:click="${wireClick}"` emitted on the rendered element |
| wireArgs | Map<String,String> | {} | **SAFE** per-row action args merged into the escaped `data-*` fragment (same channel as `button.jte`) |
| leading | gg.jte.Content | null | optional slot rendered BEFORE the track (e.g. an icon or label text in a labelled-inline layout) |
| trailing | gg.jte.Content | null | optional slot rendered AFTER the track (the most common position for a visible label like "Enable notifications") |

**Escaping contract** (verbatim from `button.jte`, the XSS rule):
`attrs` = TRUSTED raw (`$unsafe`) — STATIC author-typed strings ONLY.
`dataAttrs` / `wireArgs` = SAFE escaped: each value through `gg.jte.html.escape.Escape.htmlAttribute`.
A per-row, DB-derived value (e.g. `wireArgs={id: row.id()}`) goes through `wireArgs`, NEVER `attrs`.

## 3. Variants / sizes / states

### Variants
The switch has no `variant` param: it is a binary control, not an intent surface. The one semantic
distinction is expressed via params, not a variant:

| Dimension | Values | Token pair |
|---|---|---|
| checked track | `checked=true` | `--lv-color-primary` / `--lv-color-primary-fg` |
| unchecked track | `checked=false` | `--lv-color-input` / `--lv-color-border` |
| destructive context | (set `cssClass="lv-switch--destructive"` by the consuming template) | `--lv-color-destructive` / `--lv-color-destructive-fg` |

No separate `variant` param is needed: the checked/unchecked colour pair is the switch's one visual
state. A destructive override (e.g. "enable data deletion") is applied by the consumer via `cssClass`.

### Sizes (height-based, toolbar-aligned)

| size | track height | track width | thumb diameter | token |
|---|---|---|---|---|
| sm | 18px | 32px | 14px | `--lv-space-5` (thumb), track ratio 16:9 |
| md | 22px | 40px | 18px | `--lv-space-6` (thumb) — default + shadcn baseline |
| lg | 28px | 50px | 22px | `--lv-space-7` (thumb) |

Height drives alignment with `sm`/`md`/`lg` buttons and inputs in a toolbar row. The track is always
wider than tall (pill shape via `--lv-radius-full`). Thumb translates from left (off) to right (on)
via a CSS `translate` transition (`--lv-motion-switch-thumb`).

### States

| State | Visual | ARIA | Who |
|---|---|---|---|
| unchecked | dim track, thumb at left | `aria-checked="false"` | template |
| checked | primary track, thumb at right | `aria-checked="true"` | template |
| disabled | `opacity: --lv-opacity-disabled`; cursor not-allowed | native `disabled` (button) or `disabled` attr (input) | template |
| loading | spinner in thumb, activation blocked | `aria-busy="true"` | template |
| focus-visible | `--lv-ring` ring around track + thumb | none extra | platform + CSS `:focus-visible` |
| hover | subtle track brightness shift via `hover:` utility | none | CSS |
| aria-invalid | destructive ring + track colour | `aria-invalid="true"` (set by consumer) | CSS `[aria-invalid]` selector |
| grouped (radio-style) | mutual exclusion within a `role="group"` or `<fieldset>` | `aria-labelledby` on the group | consuming template |

The transition between checked/unchecked MUST respect `prefers-reduced-motion`: the thumb slide is
suppressed (instant swap) when the OS requests reduced motion (`@media (prefers-reduced-motion: reduce)`).

### Slots / layout combinations

| Layout | How to compose |
|---|---|
| Standalone (no visible label) | `ariaLabel` or `ariaLabelledBy` is REQUIRED |
| Label after track | `trailing` slot: `<span>Enable notifications</span>` |
| Label before track | `leading` slot: `<span>Enable notifications</span>` |
| Inner label (Ant-style) | `onLabel="On" offLabel="Off"` — text inside the track, `aria-hidden` |
| Icon in thumb | pass a `@template.lievit.icon` via `leading` or inside the track via the consumer template |
| Switch group (related toggles) | wrap multiple switch partials in a `role="group" aria-labelledby` div or a `<fieldset><legend>` when `asCheckbox=true` |

## 4. The a11y contract

- **WAI-ARIA pattern**: APG Switch.
  Primary reference: https://www.w3.org/WAI/ARIA/apg/patterns/switch/
  Button-based example: https://www.w3.org/WAI/ARIA/apg/patterns/switch/examples/switch-button/
  Checkbox-based example: https://www.w3.org/WAI/ARIA/apg/patterns/switch/examples/switch-checkbox/

- **roles + ARIA** (server-rendered by the JTE template):
    - root element (`asCheckbox=false`): `<button role="switch" aria-checked="${checked}">`
      — the `role="switch"` on a native `<button>` is the button-based APG example; it gives Enter +
        Space + focus for free from the platform.
    - root element (`asCheckbox=true`): `<input type="checkbox" role="switch">` with the native
      `checked` attribute when `checked=true`; the browser derives `aria-checked` from `checked`.
    - accessible name (precedence): `ariaLabel` > `ariaLabelledBy` > text content of `trailing`/`leading`
      slot (if present and non-empty). The SWITCH MUST have an accessible name — the JTE template
      MUST NOT render a switch without one (either `ariaLabel`, `ariaLabelledBy`, or a non-empty adjacent
      label; the acceptance test asserts this).
    - on/off inner labels: the `span.switch-on-label` / `span.switch-off-label` elements rendered inside
      the track carry `aria-hidden="true"` to avoid redundant announcements (the state is already conveyed
      by `aria-checked`; the APG button example documents this explicitly).
    - `aria-busy="true"` when `loading=true` (the round-trip is in-flight).
    - `aria-invalid` is NOT emitted by the switch itself — it is applied by the consuming `field` partial
      on the wrapping element and targeted via a CSS attribute selector. The switch inherits the visual
      treatment via `[aria-invalid] &` / the `field` wrapper convention.
    - `aria-describedby="${ariaDescribedBy}"` when the param is non-null.
    - **group semantics** (multi-switch groups): a set of related switches (e.g. notification preferences)
      is wrapped in a `<div role="group" aria-labelledby="<headingId>">` (`asCheckbox=false`) or a
      `<fieldset><legend>...</legend></fieldset>` (`asCheckbox=true`). The switch partial itself does NOT
      emit the group wrapper — the consuming template or `field` partial composes it, because the group
      boundary is a layout concern, not a single-control concern.

- **keyboard map** (the complete APG table; platform supplies all keys for the `<button>` variant):

  | key | action | who |
  |---|---|---|
  | Tab | moves keyboard focus to the switch | platform |
  | Shift+Tab | moves keyboard focus away (reverse) | platform |
  | Space | toggles the switch state (on ↔ off) | platform (native `<button>` fires `click` on Space) |
  | Enter | toggles the switch state (on ↔ off) | platform (native `<button>` fires `click` on Enter) |

  APG note: the APG Switch pattern lists Space as the PRIMARY toggle key and notes Enter as optional.
  The button-based example supports BOTH (native `<button>` fires `click` on either key without any JS).
  For `asCheckbox=true`, Space is the primary key (native checkbox behaviour); Enter submits the form if
  there is a submit button in scope, NOT the toggle — this difference is intentional and matches the
  platform contract. No roving tabindex, no arrow keys, no typeahead: the switch is a single-focus-stop
  control, not a collection. No enhancer is needed for keyboard behavior.

- **focus management**: platform-supplied.
  Focus-visible ring via `--lv-ring` on the track element (`:focus-visible` CSS pseudo-class; NOT
  `:focus`, to avoid showing the ring on mouse click per WCAG 2.5.3 guidance).
  No focus trap; no roving tabindex; no focus-restore beyond normal browser behavior.
  The `focus-trap` and `collection-nav` shared enhancers are NOT composed here — the switch is a
  single, non-modal, non-collection control.

- **live region**: none.
  The state change is communicated by `aria-checked` updating; AT reads the new value on re-focus or
  when the element receives an update notification. No `role="status"` or `aria-live` region is needed.

- **screen reader expectations**:
  A screen reader should announce the switch as `"<name> switch on"` / `"<name> switch off"` (the APG
  explicitly notes this is more user-friendly than `"<name> checkbox checked"`). The `role="switch"` +
  `aria-checked` combination produces this announcement in modern AT (NVDA, JAWS, VoiceOver, TalkBack).
  Inner on/off text labels (`onLabel`/`offLabel`) are `aria-hidden` to avoid announcing "On On" or
  "Off Off".

- **shared mechanisms composed**: none.
  The switch is the platform exemplar — a real `<button role="switch">` carries every required behavior
  without a JS enhancer. No `focus-trap`, no `collection-nav`, no popover seam.

## 5. Tokens

**Colour tokens** (all OKLCH, per architecture contract §4):

| token | usage |
|---|---|
| `--lv-color-primary` | checked track background |
| `--lv-color-primary-fg` | checked track thumb + inner-label text when checked |
| `--lv-color-input` | unchecked track background |
| `--lv-color-border` | unchecked track border |
| `--lv-color-fg` | unchecked thumb colour |
| `--lv-color-muted` | unchecked inner-label text |
| `--lv-color-destructive` | destructive context override (via `lv-switch--destructive`) |
| `--lv-color-destructive-fg` | destructive thumb / label in checked-destructive |
| `--lv-ring` | focus-visible ring (shared across all interactive primitives) |

**Structural tokens** (theme-invariant):

| token | usage |
|---|---|
| `--lv-space-5` | thumb diameter (sm) |
| `--lv-space-6` | thumb diameter (md, default) |
| `--lv-space-7` | thumb diameter (lg) |
| `--lv-radius-full` | pill track shape; thumb circle |
| `--lv-shadow-xs` | thumb elevation (subtle inset-shadow illusion for depth) |
| `--lv-text-xs` | inner on/off label font size (sm) |
| `--lv-text-sm` | inner on/off label font size (md/lg) |
| `--lv-font-sans` | inner label font family |
| `--lv-opacity-disabled` | dimming when disabled |

**Motion tokens** (prefers-reduced-motion aware):

| token | usage |
|---|---|
| `--lv-motion-switch-thumb` | thumb translate transition (`transform 120ms ease`) — suppressed by `@media (prefers-reduced-motion: reduce)` |

**NET-NEW tokens proposed**:

- `--lv-motion-switch-thumb`: a dedicated motion token for the thumb slide, distinct from the general
  `--lv-motion-fast` to allow component-specific timing without polluting the shared motion scale.
  Value: `transform 120ms ease` in light mode; same in dark; set to `none` in `prefers-reduced-motion`.
  Additive; goes in `:root` + `.dark, [data-theme="dark"]` + `@media (prefers-reduced-motion: reduce)`
  override block. Justified: the switch thumb slide is the component's primary affordance signal and
  benefits from a dedicated, tunable timing token.

No other net-new tokens are needed. The track width is derived from the thumb size via a fixed ratio
encoded in the template's utility classes; it is not a token (ratio is an invariant of the design).

## 6. Wire / island integration

The switch is a **PARTIAL** — it renders static HTML + is wired by the CONSUMING WIRE template.
It has no wire actions of its own. The integration follows the `button.jte` pattern exactly.

**Server-rendered JTE structure** (mental model; the template emits original markup):

```
<div data-slot="switch-root" data-size="${size}" class="... ${cssClass}">
  <!-- leading slot, if provided -->
  ${leading}

  <!-- the interactive track element -->
  <button
    role="switch"
    aria-checked="${checked}"
    ${disabled ? "disabled" : ""}
    ${loading ? "aria-busy=\"true\"" : ""}
    ${ariaLabel != null ? "aria-label=\"" + ariaLabel + "\"" : ""}
    ${ariaLabelledBy != null ? "aria-labelledby=\"" + ariaLabelledBy + "\"" : ""}
    ${ariaDescribedBy != null ? "aria-describedby=\"" + ariaDescribedBy + "\"" : ""}
    ${wireClick != null ? "l:click=\"" + wireClick + "\"" : ""}
    <!-- safe-escaped data-* from wireArgs + dataAttrs -->
    <!-- trusted-raw attrs from attrs -->
    data-slot="switch"
    class="switch-track ..."
  >
    <!-- thumb -->
    <span data-slot="switch-thumb" class="switch-thumb ...">
      ${loading ? "@template.lievit.spinner(...)" : ""}
    </span>

    <!-- inner on/off labels (only when onLabel/offLabel provided) -->
    ${onLabel != null ? "<span class=\"switch-on-label ...\" aria-hidden=\"true\">" + onLabel + "</span>" : ""}
    ${offLabel != null ? "<span class=\"switch-off-label ...\" aria-hidden=\"true\">" + offLabel + "</span>" : ""}
  </button>

  <!-- trailing slot, if provided -->
  ${trailing}
</div>
```

When `asCheckbox=true`, the `<button role="switch">` is replaced with
`<input type="checkbox" role="switch" name="${name}" value="${value}" ${checked ? "checked" : ""}>`.
All other attributes and the surrounding structure are identical.

**CSS-attribute-selector state sync** (no JS):
The thumb translate and track colour respond purely to CSS attribute selectors:
`[role="switch"][aria-checked="true"] .switch-thumb { transform: translateX(...) }`
`[role="switch"][aria-checked="false"] .switch-thumb { transform: translateX(0) }`
`input[type="checkbox"][role="switch"]:checked .switch-thumb { transform: translateX(...) }`
This is the APG example's documented approach and keeps the component CSP-clean with zero JS.

**data-slot hooks** (for test selectors and consumer overrides):
- `data-slot="switch-root"` on the outer wrapper div.
- `data-slot="switch"` on the `<button>` / `<input>` track element.
- `data-slot="switch-thumb"` on the thumb span.
- `data-size="sm|md|lg"` on the root for styling hooks.

**Wire integration pattern** (how a consuming WIRE template wires it):

```jte
@template.lievit.switch(
  checked = _instance.notificationsEnabled(),
  size = "md",
  ariaLabelledBy = "notifications-label",
  wireClick = "toggleNotifications",
  wireArgs = Map.of("userId", _instance.userId())
)
```

The wire action `toggleNotifications` lives in the WIRE Java component; it validates `userId` ∈
allowed set BEFORE mutating state. The switch partial only renders the snapshot of truth the server
has already computed.

**No enhancer** — the switch PARTIAL composes no typed-TS enhancer. The thumb animation is pure CSS;
the toggle is platform `<button>` + `l:click` directive from the runtime. This is the simplest tier.

## 7. Acceptance tests

The component is DONE only when ALL of the following pass on a REAL substrate (not a mocked one).

- **render — basic structure** (jsdom + JTE real-compiler render): the rendered HTML contains a
  `<button role="switch" aria-checked="false">` (when `checked=false`) with `data-slot="switch"`;
  the wrapper has `data-slot="switch-root"`; the thumb has `data-slot="switch-thumb"`.

- **render — checked state** (jsdom): when `checked=true`, the button has `aria-checked="true"`;
  when `checked=false`, `aria-checked="false"`. These are the ONLY two legal values — assert no other
  value is ever emitted (the APG does not allow `aria-checked="mixed"` on a switch).

- **render — asCheckbox variant** (jsdom): when `asCheckbox=true`, the element is
  `<input type="checkbox" role="switch">`; when `checked=true`, the native `checked` attribute is
  present; when `checked=false`, it is absent (not `checked="false"` — the absence is the signal).

- **render — inner labels hidden from AT** (jsdom): when `onLabel="On"` and `offLabel="Off"` are set,
  both span elements carry `aria-hidden="true"`. Assert the inner text is NOT part of the accessible
  name computation (the accessible name is derived from `ariaLabel` / `ariaLabelledBy`, NOT from
  the inner label text).

- **render — accessible name enforcement** (jsdom): a switch rendered WITHOUT `ariaLabel`,
  `ariaLabelledBy`, and WITHOUT a non-empty `leading`/`trailing` slot FAILS the accessible-name
  axe rule — assert this failure (the test documents the constraint, not a passing state).

- **render — loading state** (jsdom): when `loading=true`, the button has `aria-busy="true"` and the
  spinner partial is present inside the thumb (`data-slot="switch-thumb"` contains the spinner element).

- **render — disabled** (jsdom): when `disabled=true`, the `<button>` has the native `disabled`
  attribute; it does NOT have `aria-disabled` (that attribute is for `<a>` with `role="button"`, not
  native `<button>`). The `asCheckbox=true` variant has the native `disabled` attribute on the `<input>`.

- **render — sizes** (jsdom): each of `sm`, `md`, `lg` emits `data-size="sm"` / `"md"` / `"lg"` on
  the root and the corresponding Tailwind utility classes for thumb size.

- **render — no-script guard** (JTE template scan): the template file contains zero `<script>` tags and
  zero inline `on*=` attribute handlers (asserted by the existing anti-pattern grep, CI gate).

- **axe-core — passing** (jsdom, real render): a switch with a valid `ariaLabel` has ZERO axe violations
  against the rules: `aria-allowed-attr`, `aria-required-attr`, `aria-valid-attr-value`,
  `aria-roles`, `button-name` (or `label` for the input variant). Cite the specific axe rules asserted.

- **axe-core — missing name fails** (jsdom): a switch with NO accessible name produces at least one
  axe violation for `button-name` (button variant) or `label` (checkbox variant). This test documents
  the enforcement surface.

- **keyboard — Space toggles** (jsdom + UserEvent): dispatch a Space keypress on the focused button;
  assert the `click` event fires. (The native `<button>` fires `click` on Space — this is a platform
  test, not a JS test; the test confirms the platform contract is preserved by the template structure.)

- **keyboard — Enter toggles** (jsdom + UserEvent): dispatch an Enter keypress on the focused button;
  assert the `click` event fires. Same rationale.

- **keyboard — Tab focuses** (jsdom): the switch is reachable via Tab sequence; `tabIndex` is not
  manipulated to `-1` in any rendered variant (disabled is the only exception: disabled native elements
  are removed from the tab sequence by the platform).

- **keyboard — disabled blocks** (jsdom + UserEvent): when `disabled=true`, dispatch Space/Enter; assert
  NO `click` event fires (the native `disabled` attribute blocks activation).

- **wire integration — safe escaping** (jsdom): a hostile `wireArgs` value (`{"id": "\">|<script>alert(1)"}`)
  renders inert; the value appears as an escaped attribute string, never as markup. Assert the rendered
  attribute value equals the literal escaped string and no `<script>` tag is injected.

- **wire integration — attrs trusted only** (review + doc gate): `attrs` is documented in the template
  header as TRUSTED-AUTHOR-ONLY; the acceptance test documents that `wireArgs`/`dataAttrs` is the
  per-row-data channel. No automated test can enforce trust; the doc-comment lint enforces the presence
  of the channel documentation.

- **variants/states — CSS attribute selectors** (jsdom + CSS snapshot): assert the rendered CSS (via
  Tailwind class inspection or snapshot) includes selectors for `[aria-checked="true"]` and
  `[aria-checked="false"]` that drive the thumb translate. This guards against the silent-class-mismatch
  failure class.

- **reduced motion** (jsdom + CSS): assert the `--lv-motion-switch-thumb` token is set to `none` (or
  the transition property resolves to `none`) when `prefers-reduced-motion: reduce` media is active.

- **JTE compiles + renders** (real-compiler gate): covered by the `test/jte-compile` real-compiler +
  render gate that the library already runs; no new test needed here.

- **Playwright — gesture fidelity** (legacy-VM oracle, when the consuming gest page ships a switch):
  real `page.click()` on the switch track; assert the rendered DOM shows `aria-checked` flipped after
  the wire round-trip morph; assert the thumb has translated to the new position (visible assertion on
  CSS translate or snapshot). This is the end-to-end guard that prevents a switch that "works in tests"
  but silently fails morph projection (the client-island-fidelity lesson).

## 8. Non-goals / anti-patterns

- **No client-owned state.** The switch never tracks its own checked state in JS. A JS-toggled `aria-checked`
  that diverges from the server state is exactly the "state has two owners" anti-pattern. `checked` is always
  a server-rendered `@param`, always a WIRE field's reflection.

- **No `role="switch"` on a `<div>` or `<span>`.** The APG examples use `<button>` or `<input type="checkbox">`.
  A `<div role="switch">` requires manually adding `tabindex="0"` and keyboard handlers in JS — that is the
  anti-pattern the button tier eliminates. If the div-based APG example is in training data: ignore it; use
  the button variant.

- **No `aria-checked="mixed"`.** The WAI-ARIA spec for the `switch` role does NOT allow the `mixed` value (it
  is legal only on `checkbox`). A switch is binary. An indeterminate tri-state is a `checkbox`, not a switch.

- **No framework enhancer.** The animation (thumb slide) is CSS-attribute-driven, not JS-driven. Adding Alpine,
  Lit, or an IIFE to animate the thumb is a CSP violation and an architecture violation (ADR-0012). The
  transition belongs in `--lv-motion-switch-thumb`, resolved at render time.

- **Not a roving-tabindex group.** A set of switches is navigated by Tab (each switch is an independent
  focus stop), NOT by arrow keys. Arrow-key navigation is the radio-group / toolbar pattern; the switch
  group is neither. Wrapping switches in `collection-nav` would be wrong.

- **Not a checkbox replacement.** Do not use switch inside a `<form>` for settings that require a Save button
  to take effect. That is a checkbox's job (explicit commit semantics). A switch implies IMMEDIATE effect.
  The `asCheckbox=true` param exists only for the edge case where the toggle IS part of a larger form
  submission; even then, the UX contract should be reviewed.

- **No inner-label text as the accessible name.** The `onLabel`/`offLabel` text inside the track is
  decorative and `aria-hidden`. It is NOT the accessible name. The accessible name must come from
  `ariaLabel`, `ariaLabelledBy`, or a visible adjacent label via `leading`/`trailing` + `aria-labelledby`.

- **No per-component dark mode rules.** The switch inherits dark-mode token re-pointing from the shared
  `.dark, [data-theme="dark"]` block in `lievit-tokens.css`. It does not add its own dark-mode overrides
  (architecture contract §4).
