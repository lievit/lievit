<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — native-select (PARTIAL: platform-a11y, form-native, zero JS)

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/native-select.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Listbox (native `<select>` / `<optgroup>` — platform-supplied; no react-aria
      reference needed because the native element carries `role=listbox`, `role=option`, full keyboard
      interaction, and accessible-name binding for free; the APG pattern for listbox is transcribed into
      the spec only for the test-gate, not into a custom implementation)
    - inventory: Ant Design Select (native variant) as inventory reference (sizes, placeholder, groups,
      disabled options, required, invalid); shadcn `native-select` wrapper as the structural idiom
      (style the native element, do not replace it — the exact decision encoded in the current partial)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A token-styled wrapper around the platform `<select>` element: a `<div>` wrapper that carries the
focus ring + border + sizing, the `<select>` itself (`appearance-none` to suppress the OS chrome),
and a decorative `chevron-down` icon overlay that replaces the OS arrow. STATIC presentational →
PARTIAL: the native `<select>` carries its own role, keyboard, focus, and form submission for free;
there is no client state and no enhancer. This is the lightweight path — native form submission,
zero JS, full screen-reader compat out of the box. Use it for any enum / small-to-medium option
list where search, groups of arbitrary depth, custom option rendering, or multi-select are NOT
required. When those are required, use the `select` (rich) WIRE component instead (`03`).

Server-first works trivially: the option list is fixed or small enough that the server renders it
inline; `l:model` binds the native `change` event to a wire field without any enhancer, using the
lievit runtime's model directive.

## 2. API — params (the typed surface)

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | **required** | the `<select name>` attribute; doubles as the default `id` |
| `id` | `String` | `name` | the `<select id>` (for `<label for>` binding); defaults to `name` when blank/null |
| `options` | `List<String>` | `null` | simple flat option list where value == label; each becomes `<option value="${opt}">${opt}</option>`; ignored when `content` or `optionGroups` is set |
| `optionGroups` | `Map<String, List<String>>` | `null` | group label → list of option labels; renders as native `<optgroup label>`; overrides `options`; ignored when `content` is set |
| `content` | `gg.jte.Content` | `null` | hand-authored `<option>` / `<optgroup>` slot for value≠label, per-option disabled, or option metadata; wins over both `options` and `optionGroups` (precedence: `content` > `optionGroups` > `options`) |
| `value` | `String` | `null` | the currently selected option value; matched server-side against option values to emit `selected` on the matching `<option>` |
| `label` | `String` | `null` | when non-blank, renders a real `<label for="${selectId}">` above the control; the preferred accessible-name path |
| `ariaLabel` | `String` | `null` | `aria-label` on the `<select>`; **required when `label` is null** (no visible label → no accessible name otherwise); mutually exclusive with `label` in practice, but both are accepted and `label` wins for screen readers (`<label>` takes precedence) |
| `placeholder` | `String` | `null` | when non-blank, inserts a `disabled hidden` first `<option value="">` shown only when no `value` is set; the native "choose..." idiom |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — HEIGHT-based, toolbar-aligned with `button` and `input` of the same size; `"default"` is a back-compat alias for `"md"` |
| `disabled` | `boolean` | `false` | native `disabled` attr on `<select>` + `data-disabled` on wrapper → dims via `opacity-50` |
| `required` | `boolean` | `false` | native `required` attr on `<select>`; participates in HTML5 constraint validation |
| `invalid` | `boolean` | `false` | emits `aria-invalid="true"` on the `<select>` + `data-invalid` on the wrapper → destructive border + ring |
| `model` | `String` | `null` | `l:model` expression (`l:model="${model}"` on the `<select>`) to bind the native `change` event to a WIRE field; null = no wire binding (plain form submit) |
| `cssClass` | `String` | `""` | extra utility classes on the outer wrapper `<div>`; adopted by the wrapper, not the `<select>` (keeps the internal shape stable) |

**Escaping channels** (the XSS rule — follows `button.jte`):
- `label`, `ariaLabel`, `placeholder`, `size`, `cssClass`, `name`, `id`, `value`, `model` →
  standard JTE string interpolation (HTML-attribute-escaped by JTE's `${}`, safe for author-typed values).
- `options` / `optionGroups` → option labels and group labels pass through JTE `${}` (escaped).
- `content` → a `gg.jte.Content` slot, caller-authored markup; the calling template is responsible
  for its own escaping (JTE's content type system ensures no raw-injection path here).
- No `attrs` trusted-raw channel exists on this partial: the control carries no per-row dynamic
  wire action; the `model` param is the only lievit-runtime binding and it is `${}`-escaped.

## 3. Variants / sizes / states

### Variants
No visual `variant` param: `native-select` is a form control with a single presentation (the
`invalid` boolean triggers the destructive recolor, which is the only intent-driven visual change).
This aligns with `input`'s convention — form controls are not action-intent controls.

### Sizes (height-based, toolbar-aligned)
| size | height token | height | use |
|---|---|---|---|
| `sm` | `--lv-space-8` | 32px | compact toolbar, filter row |
| `md` (default) | `--lv-space-9` | 36px | standard form, the shadcn baseline |
| `lg` | `--lv-space-10` | 40px | prominent / standalone field |
| `default` | `--lv-space-9` | 36px | back-compat alias of `md` |

Padding, icon size, and text size scale with height (see §5 tokens). A `button`, `input`, and
`native-select` of the same `size` sit flush-aligned in a toolbar row — this is the load-bearing
toolbar-alignment invariant shared across every form control in the library.

### States
| state | trigger | visual effect | ARIA effect |
|---|---|---|---|
| default | — | border `--lv-color-input`, bg `--lv-color-bg` | — |
| focus-within | keyboard / mouse focus on the inner `<select>` | border → `--lv-color-ring`, ring shadow → `--lv-ring` on the WRAPPER (CSS `focus-within`) | platform announces focused element |
| disabled | `disabled=true` | `opacity-50`, `cursor-not-allowed`, `pointer-events-none` on the inner `<select>` | native `disabled` attr; removed from tab order and not announced as activatable |
| invalid | `invalid=true` | border → `--lv-color-destructive`, shadow → destructive ring (20% alpha) | `aria-invalid="true"` on `<select>`; screen readers announce "invalid entry" |
| required | `required=true` | no visual delta (a `field` wrapper adds the required marker via its own `label`); participates in HTML5 constraint validation | native `required` attr; screen readers announce "required" |

### Option-level states (via `content` slot)
- A `<option disabled>` renders dimmed and is not selectable (platform).
- A `<option selected>` marks the current value (server-rendered via the `value` param when using
  `options`/`optionGroups`; caller's responsibility in the `content` slot).
- `<optgroup label disabled>` disables a whole group (native feature, no extra work).

### Slots
| slot | type | meaning |
|---|---|---|
| `content` | `gg.jte.Content` | hand-authored `<option>`/`<optgroup>` markup; wins over `options`/`optionGroups` |

No `leading` / `trailing` / `footer` slots: the chevron icon is OWNED by the partial (decorative,
fixed position right-side); there is no leading slot because the native `<select>` OS dropdown does
not accommodate prefix icons in a cross-browser safe way.

## 4. The a11y contract

- **WAI-ARIA pattern**: APG Listbox (native `<select>` baseline) — the native HTML `<select>`
  element is itself a conformant listbox with full platform a11y; no custom `role` is emitted.
  APG reference verified: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
  (see also the scrollable listbox example at .../examples/listbox-scrollable/ for the keyboard map,
  which the native `<select>` implements identically at the platform level).

- **roles + ARIA**:
  | element | role / attribute | value | condition |
  |---|---|---|---|
  | `<select>` | implicit `role="listbox"` | (platform) | always |
  | `<option>` | implicit `role="option"` | (platform) | always |
  | `<optgroup>` | implicit `role="group"` with `aria-label` = the group label | (platform) | when `optionGroups` or `content` with `<optgroup>` |
  | `<select>` | `aria-label` | from `ariaLabel` param | when no visible `<label>` |
  | `<label>` | — | associated via `for="${selectId}"` | when `label` is set |
  | `<select>` | `aria-invalid` | `"true"` | when `invalid=true` |
  | `<select>` | `required` | native boolean | when `required=true` |
  | `<select>` | `disabled` | native boolean | when `disabled=true` |
  | `<span>` (chevron) | `aria-hidden` | `"true"` | always (decorative) |

  Accessible-name resolution order (the platform algorithm): `aria-labelledby` (not emitted here
  — the `<label for>` sets the name via the label element) → `aria-label` (from `ariaLabel`) →
  element content (not applicable for `<select>`). The `<label for>` path is the preferred,
  semantically richest option; `ariaLabel` is the fallback for label-free contexts.

- **keyboard map** (the complete table, verified against APG + the scrollable-listbox example):
  | key | action | who supplies it |
  |---|---|---|
  | Tab | moves focus into the `<select>` from the outside; Tab again moves focus out | platform |
  | Shift + Tab | moves focus backward, out of the `<select>` | platform |
  | Down Arrow | moves focus to (and selects, for single-select) the NEXT option | platform |
  | Up Arrow | moves focus to (and selects) the PREVIOUS option | platform |
  | Home | moves focus to and selects the FIRST option | platform |
  | End | moves focus to and selects the LAST option | platform |
  | Printable characters | type-ahead: moves focus to the next option whose label starts with the typed character(s); successive rapid typing searches the accumulated prefix | platform |
  | Space | on most platforms opens the dropdown popup (OS-dependent); inside the open dropdown, selects the focused option | platform |
  | Enter | confirms selection and closes the dropdown (OS-dependent, especially on macOS) | platform |
  | Esc | cancels / closes the dropdown without changing the selection (OS-dependent) | platform |
  | Alt + Down Arrow | opens the dropdown (Windows-specific, supported natively) | platform |

  All keys are platform-supplied: no enhancer is needed or created for `native-select`. This is
  the canonical PARTIAL exemplar for "prefer a real native element" (architecture contract §2.a).

- **focus management**:
  - Focus and blur are managed entirely by the platform; the partial does not touch `tabindex`.
  - The outer wrapper `<div>` is NOT in the tab order (no `tabindex`); it merely relays `focus-within`
    styling to the visible border/ring so keyboard users see the active field.
  - No focus trap (non-modal), no roving tabindex, no `aria-activedescendant` (the native element
    uses real DOM focus on options in its OS-rendered dropdown, not the `aria-activedescendant` model
    — the key difference from the custom-WIRE `select`).
  - Focus restore after a wire round-trip: the lievit runtime morph (ADR-0019) preserves the focused
    `<select>` identity across a DOM patch; no component action required.

- **live region**: none. The native `<select>` announces the selected option change through the
  platform accessibility API; no supplementary live region is needed.

- **shared mechanism composed**: none. Platform-only. This is the simplest tier after `button` —
  the exemplar of "the platform gives keyboard + focus + semantics for free, so we give it styling."

## 5. Tokens

The partial reads the following `--lv-*` tokens (no literal colours ever — the token-lint rule):

### Colour tokens (authored in OKLCH, ADR / architecture contract §4)
| token | usage |
|---|---|
| `--lv-color-bg` | background of the wrapper (the select field surface) |
| `--lv-color-input` | border colour in default state |
| `--lv-color-ring` | border colour in focus-within state |
| `--lv-color-fg` | text colour of the label + selected option text |
| `--lv-color-muted-fg` | chevron icon colour |
| `--lv-color-destructive` | border + ring colour in invalid state |

### Spacing tokens
| token | usage |
|---|---|
| `--lv-space-2` | label bottom margin (gap between label and control) |
| `--lv-space-3` | left padding of the `<select>` (leading text inset) |
| `--lv-space-8` | wrapper height for `size=sm` (32px) |
| `--lv-space-9` | wrapper height for `size=md` / `size=default` (36px) |
| `--lv-space-10` | wrapper height for `size=lg` (40px) |
| `--lv-space-8` (icon right) | right padding to make room for the chevron icon (also `--lv-space-8` = 2rem, used as `pr`) |

Note: the `<select>` right-padding (`pr-[var(--lv-space-8)]`) ensures the selected option text never
collides with the absolutely-positioned chevron overlay.

### Typography tokens
| token | usage |
|---|---|
| `--lv-text-sm` | option text size (consistent with `input` at the same size) |
| `--lv-font-sans` | font family on the `<select>` and `<label>` (override OS default) |
| `--lv-font-medium` | font-weight for the `<label>` text |

### Border + shadow tokens
| token | usage |
|---|---|
| `--lv-radius-md` | border-radius of the wrapper |
| `--lv-shadow-xs` | subtle elevation of the wrapper in default state |
| `--lv-ring` | focus ring box-shadow (the shared `focus-within` ring, same token as `button`/`input`) |

### NET-NEW tokens: none
All required tokens are present in the v2 token set (`registry/tokens/lievit-tokens.css`). The
destructive ring in the invalid state is expressed as `color-mix(in oklch, var(--lv-color-destructive)
20%, transparent)` inline (a structural expression, not a baked literal colour), which is consistent
with the existing invalid-state treatment on `input` and does not require a new named token.

## 6. Wire / island integration

`native-select` is a **PARTIAL with no island and no enhancer**. It is static, CSP-clean, and ships
zero JavaScript of its own.

### Server-rendered JTE structure

```
<label for="{selectId}" data-slot="native-select-label">          ← only when label is set
  {label}
</label>
<div data-slot="native-select-wrapper"                             ← the visible control surface
     data-disabled="{disabled}"
     data-invalid="{invalid}"
     data-size="{size}"
     class="... focus-within:... data-[size=sm]:h-[...] ...">
  <select data-slot="native-select"                                ← the real <select>
          id="{selectId}"
          name="{name}"
          disabled="{disabled}"
          required="{required}"
          aria-label="{ariaLabel}"
          aria-invalid="{invalid ? 'true' : null}"
          l:model="{model}"
          class="appearance-none ...">
    <option value="" disabled hidden selected="{!hasValue}">       ← only when placeholder set
      {placeholder}
    </option>
    {content}                                                      ← or <option> / <optgroup> loop
  </select>
  <span aria-hidden="true" data-slot="native-select-icon"         ← decorative chevron overlay
        class="pointer-events-none absolute right-[var(--lv-space-3)] ...">
    @template.lievit.icon(name = "chevron-down", size = "1rem")
  </span>
</div>
```

**`data-slot` values** (the stable test + styling hooks):
- `native-select-wrapper` — the outer `<div>` that carries sizing + border + focus-within ring
- `native-select-label` — the `<label>` element (only rendered when `label` is set)
- `native-select` — the `<select>` element itself
- `native-select-icon` — the decorative chevron `<span>`

**`data-variant` / `data-size`**: `data-size` is on the wrapper for Tailwind variant targeting
(`data-[size=sm]:h-[var(--lv-space-8)]` etc.). No `data-variant` (this control has no variant).
`data-disabled` and `data-invalid` are boolean data attributes for CSS and test targeting.

### Lievit runtime binding (`l:model`)

When `model` is non-null, `l:model="${model}"` is emitted on the `<select>`. The lievit runtime's
model directive listens to the native `change` event and fires the corresponding WIRE field setter,
triggering a server round-trip that re-renders the owning WIRE component. The partial itself does
nothing: `l:model` is just an HTML attribute the runtime picks up at mount time. CSP-clean (no
inline event handler, no eval, no inline script).

When `model` is null (plain-form mode), the `<select name>` submits its value in the standard HTML
form POST — zero JS, full graceful degradation.

### No enhancer

There is no `native-select.enhancer.ts`. The decision rule from the architecture contract: native
keyboard + focus + ARIA are platform-supplied by `<select>`, so there is no "one irreducible client
bit" that justifies an enhancer. Any attempt to add an enhancer here would duplicate what the
platform already provides correctly and would introduce a CSP surface that the platform does not need.

## 7. Acceptance tests

The partial is DONE only when ALL the following pass on a REAL substrate (not a mocked one):

### Render (jsdom, real JTE compile + render gate)

- **`renders-select-element`**: the output DOM contains a `<select data-slot="native-select">`
  with the correct `id`, `name`, and `class` (appearance-none present).
- **`renders-wrapper-div`**: the outer `<div data-slot="native-select-wrapper">` is present,
  carries `data-size`, `data-disabled`, `data-invalid`, `data-slot`.
- **`renders-label-when-set`**: when `label` is non-blank, a `<label data-slot="native-select-label"
  for="{selectId}">` is present with the correct `for` value.
- **`no-label-when-null`**: when `label=null`, no `<label>` element is in the DOM.
- **`renders-options-from-list`**: with `options=List.of("A","B","C")`, the DOM contains three
  `<option>` elements with matching value and text content.
- **`renders-optgroups`**: with `optionGroups=Map.of("G1", List.of("a","b"))`, a `<optgroup
  label="G1">` wrapping two `<option>` elements is present.
- **`content-slot-wins`**: when `content` is set alongside `options`, only the `content` slot
  renders (precedence: content > optionGroups > options).
- **`placeholder-option`**: with `placeholder="Choose..."` and `value=null`, the first `<option>`
  has `value=""`, `disabled`, `hidden`, and is `selected`; when `value` is set, it is NOT selected.
- **`selected-option-marked`**: with `options=List.of("A","B")` and `value="B"`, the second
  `<option>` has `selected` set and the first does not.
- **`chevron-is-aria-hidden`**: the `<span data-slot="native-select-icon">` has `aria-hidden="true"`.
- **`data-size-attribute`**: `size="sm"` → `data-size="sm"` on the wrapper; the wrapper carries the
  height token class `data-[size=sm]:h-[var(--lv-space-8)]`.
- **`id-defaults-to-name`**: when `id=null`, the `<select id>` == `name`; when `id` is explicit,
  the `<select id>` == that explicit value.
- **`back-compat-default-size`**: `size="default"` renders identically to `size="md"` (same height
  token class applied).

### Axe-core (zero violations)

- **`axe-with-label`**: render with `label="Stato"`, assert `axe.run()` returns zero violations
  (includes accessible-name rule: the `<label for>` provides it).
- **`axe-with-aria-label`**: render with `ariaLabel="Stato"` and no `label`, assert zero violations.
- **`axe-fails-without-name`**: render with NEITHER `label` NOR `ariaLabel`, assert that
  `axe.run()` reports a violation of the accessible-name rule (verifies the guard is real).
- **`axe-invalid-state`**: render with `invalid=true`, assert zero violations (the `aria-invalid`
  attribute is correctly formed).
- **`axe-optgroup`**: render with `optionGroups`, assert zero violations (the `<optgroup>` structure
  is correct).
- **`axe-disabled`**: render with `disabled=true`, assert zero violations.

### Keyboard (platform — asserted on real jsdom DOM, not a mocked event)

- **`tab-focuses-select`**: Tab into the component tree asserts `document.activeElement` is the
  `<select>` element (not the wrapper div).
- **`arrow-keys-change-selection`**: with the `<select>` focused and two options, dispatch a
  native `ArrowDown` keydown event; assert `<select>.selectedIndex` advances (platform behavior,
  confirmed by the jsdom event loop).
- **`disabled-is-not-focusable`**: with `disabled=true`, the `<select>` is not in the tab order
  (assert `tabIndex == -1` or that dispatching Tab does not land focus on it).

### States

- **`disabled-state`**: render with `disabled=true`; assert `<select>` carries the native
  `disabled` attribute, wrapper has `data-disabled="true"`, and the opacity-50 utility class is
  on the wrapper.
- **`invalid-state`**: render with `invalid=true`; assert `<select aria-invalid="true">`, wrapper
  has `data-invalid="true"`, and the destructive border class is applied.
- **`required-attribute`**: render with `required=true`; assert `<select required>` is present.

### Sizes

- **`size-sm`**: `size="sm"` → wrapper class includes the `data-[size=sm]:h-[var(--lv-space-8)]`
  variant and `data-size="sm"`.
- **`size-md`**: `size="md"` (the default) → `data-[size=md]:h-[var(--lv-space-9)]`.
- **`size-lg`**: `size="lg"` → `data-[size=lg]:h-[var(--lv-space-10)]`.

### Wire binding

- **`model-attr-emitted`**: with `model="stato"`, the rendered `<select>` carries `l:model="stato"`;
  without `model`, the attribute is absent.
- **`no-model-plain-form`**: with `model=null`, the `<select name>` submits its value in a plain
  HTML form POST (asserted by serializing the form to a `FormData` and checking the key is present).

### JTE compile + render gate

- **`jte-compiles`**: covered by the `test/jte-compile` real-compiler gate (already in CI); the
  partial must compile without error with all param combinations (null options, optionGroups, content).
- **`jte-renders-all-variants`**: the render gate calls the partial with at least one fixture per
  option-source path (flat list, optionGroups, content slot) and asserts non-empty HTML output.

### Escaping (no per-row wire action, but option data is escaped)

- **`option-label-xss`**: with `options=List.of("<script>alert(1)</script>")`, the rendered
  `<option>` text is HTML-escaped (`&lt;script&gt;...`) and does not inject a `<script>` tag.
- **`optgroup-label-xss`**: with `optionGroups=Map.of("<img onerror=x>", List.of("A"))`, the
  `<optgroup label>` attribute value is HTML-escaped by JTE's `${}` and is inert.
- **`css-class-xss`**: with `cssClass="\" onmouseover=\"alert(1)"`, the rendered wrapper class
  attribute is HTML-escaped (JTE `${}` escapes the quotes) and does not inject a handler.
- **`placeholder-xss`**: with `placeholder="</option><script>alert(1)</script>"`, the rendered
  placeholder option text is escaped and the injected tag is inert.

## 8. Non-goals / anti-patterns

- **Do NOT add JavaScript / an enhancer**: the native `<select>` supplies all interaction from
  the platform; any enhancer on this component re-implements what the platform already provides and
  adds a CSP attack surface for zero benefit. If more client behavior is needed, the caller should
  use the WIRE `select` (rich) component instead.
- **Do NOT use this component for multi-select**: multi-select (`<select multiple>`) is a distinct
  interaction pattern (shift-click, checkbox-style option UX) that belongs in a separate component
  (`checkbox-list` for the typical admin case, or a future `listbox-multi`). Adding `multiple` here
  would conflate two distinct UX patterns in a single partial.
- **Do NOT add a `leading` icon slot**: the native `<select>` OS dropdown cannot accommodate a
  leading icon in a cross-browser-safe way (the OS-rendered option list clips wrapper padding);
  and `appearance-none` only suppresses the OS ARROW, not the option list chrome. An input-group
  wrapping a `native-select` is the correct composition for icon-prefixed select fields.
- **Do NOT hardcode option lists inside the partial**: the "no data in a partial" rule
  (architecture contract §3 + repo CLAUDE.md). All option lists come in via `options`,
  `optionGroups`, or `content` from the controller's typed model.
- **Do NOT use this component when search, custom option markup, or server-side option filtering
  are required**: those are the use cases for the WIRE `select` (rich) component
  (`collection-nav.enhancer.ts` + listbox popover). Using `native-select` there would be a
  downgrade of the user experience that cannot be recovered by styling alone.
- **Do NOT emit `aria-expanded`, `aria-haspopup`, `aria-controls`, or `aria-activedescendant`**:
  these are COMBOBOX / custom-listbox attributes that describe a JS-managed overlay; the native
  `<select>` does not use them and their presence on a `<select>` element is invalid per ARIA 1.2.
- **Do NOT forward the `attrs` trusted-raw escape channel**: unlike `button`, this partial carries
  no per-row dynamic wire action, so the trusted-raw `attrs` param is not exposed. If a caller
  needs a custom attribute on the `<select>`, add it to `cssClass` or extend the param list with a
  properly escaped param. This removes the XSS footgun for the common case.

## 9. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens; you may read the WAI-ARIA APG Listbox pattern,
shadcn's `native-select` wrapper, and Ant Design Select (native variant) as references for
structural pattern and feature inventory; never paste literal source from any of them (the one
bright line, `02-licensing.md`) — the output is always original generation. Mirror the CURRENT
`registry/jte/native-select.jte` as the re-forge baseline: the spec is a COVERED re-forge, so the
delta is pinned a11y test gate + explicit escaping assertions + token-naming audit, NOT a rewrite.
Mirror `button.jte` house conventions (header doc-comment with TIER/STRUCTURE/A11y/Params/Usage
blocks, typed `@param` with defaults, `data-slot`, zero `<script>`, zero inline `on*=`). The JTE
`!{var selectId = ...}` local-var idiom for the id-defaults-to-name logic is the canonical approach
(see current partial). Minimal code to GREEN against the acceptance tests; the a11y test gate (axe +
keyboard + accessible-name guard) is the contract — assert ALL of it, including the failure case.
