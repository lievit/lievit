<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — checkbox

- **tier**: PARTIAL (`l:model`)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/checkbox.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Checkbox (both two-state and tri-state / mixed patterns) sourced from
      https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/ and the two worked examples;
      the native `<input type="checkbox">` carries `role=checkbox` + `aria-checked` + Space/Tab for
      free, so no react-aria reference is needed — the platform supplies the complete interaction
    - inventory: Ant Design Checkbox as inventory reference (indeterminate, checkbox-group,
      disabled, sizes); the checkbox-group / select-all pattern maps to the `checkbox-list` PARTIAL+ENH
      (a separate component); single checkbox and checkbox-with-indeterminate live here
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A styled native `<input type="checkbox">` (two-state: checked / unchecked) or a native checkbox
with an `indeterminate` DOM property set (tri-state: checked / unchecked / indeterminate), used to
capture a boolean or partially-determined choice. PARTIAL: the CHECKED state is expressed via the
native `checked` attribute (server-rendered from the bound model field via `l:model`) and, for the
indeterminate variant, via an ENHANCER that sets the `indeterminate` DOM property after hydration
(the DOM property is not an HTML attribute and cannot be set server-side, so this is the one
irreducible client bit). The partial renders the styled control; the consuming WIRE template wires
the value with `l:model="field"`. Server-first works naturally: checked/unchecked is a boolean the
server renders into `checked`; the only client-side work is the indeterminate DOM property and
a focus-visible ring upgrade.

The checkbox is a SINGLE control. A list of checkboxes with a select-all (the mixed-state parent
pattern) belongs to `checkbox-list` (PARTIAL+ENH, separate component in the inventory).

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | `null` | the `name` attribute on the `<input>` (required for plain form submission; `l:model` can substitute in a WIRE form) |
| `value` | `String` | `"on"` | the `value` submitted when checked (standard HTML checkbox value attribute) |
| `checked` | `boolean` | `false` | initial checked state (rendered as the `checked` HTML attribute; overridden by `l:model`) |
| `indeterminate` | `boolean` | `false` | when `true`, renders `data-indeterminate="true"` so the enhancer can set the `indeterminate` DOM property after hydration; does NOT imply checked |
| `disabled` | `boolean` | `false` | disables the control (native `disabled` attribute + visual dims) |
| `required` | `boolean` | `false` | HTML `required` attribute; used when a checkbox must be checked to submit a form |
| `size` | `String` | `"md"` | `sm \| md \| lg` — the visual size of the control box (height-based, toolbar-aligned) |
| `id` | `String` | `null` | explicit `id` to wire a `<label for>` from the `field` PARTIAL; auto-generated if null |
| `ariaLabel` | `String` | `null` | `aria-label` for standalone checkboxes with no associated `<label>` element; **REQUIRED when no visible label is present** |
| `ariaDescribedBy` | `String` | `null` | `aria-describedby` referencing hint/error text (usually supplied by the wrapping `field` PARTIAL) |
| `ariaInvalid` | `boolean` | `false` | `aria-invalid="true"` — recolours to the destructive token pair; used by the `field` PARTIAL |
| `cssClass` | `String` | `""` | extra utility classes added to the wrapper `<span>` |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (data-testid, `l:model="field"`, `l:change="action"`) |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` values (each value through `Escape.htmlAttribute`) |

**Escaping note**: `attrs` is the TRUSTED channel for the `l:model` / `l:change` directives (they are
author-typed, static strings). A per-row, DB-derived identifier goes through `dataAttrs` → escaped,
never `attrs`. Same two-channel rule as `button.jte`.

**No `content` / `leading` / `trailing` slots**: a checkbox has no inner-label projection; the visible
label sits in a sibling `<label for>` (composed by the `field` PARTIAL or authored inline). Giving the
checkbox a `Content` slot would conflate the control and its label, breaking the native `<label for>`
association.

## 3. Variants / sizes / states

### Variants
The checkbox has no INTENT variant (it is not an action button); visual differentiation is by STATE,
not by a `variant` param. The one stylistic option is `size`.

### Sizes (height-based, toolbar-aligned)
The SIZE governs the box dimensions (width = height = the lievit space token at that tier):

| size | box dimension | token |
|---|---|---|
| `sm` | 16 px | `--lv-space-4` |
| `md` | 20 px | `--lv-space-5` (default) |
| `lg` | 24 px | `--lv-space-6` |

`data-size="<value>"` on the root `<span>` for styling hooks + test targets. At every size the control
aligns flush with a `button` or `input` of the same `size` (the Filament toolbar-alignment contract).

### States

| state | how expressed |
|---|---|
| unchecked | native (no `checked` attr) → `aria-checked="false"` via the browser |
| checked | native `checked` attr → `aria-checked="true"` |
| indeterminate | `data-indeterminate="true"` on the `<input>` → enhancer sets `el.indeterminate = true` → browser exposes `aria-checked="mixed"` |
| disabled | native `disabled` attr + `disabled:opacity-50 disabled:cursor-not-allowed` utilities; removed from activation |
| focus-visible | `focus-visible:` utilities → `--lv-ring` token (the shared focus ring) |
| `aria-invalid` | recolours border and check mark to `--lv-color-destructive`; ring to `--lv-ring-destructive` |
| `aria-busy` | not applicable (checkboxes carry no async action of their own; `aria-busy` is only set by the runtime on a WIRE component during a round-trip, and checkbox is PARTIAL) |

`data-slot="checkbox"` on the root element. `data-state="checked|unchecked|indeterminate"` derived
server-side and stamped for CSS-selectable styling hooks (mirrors the shadcn convention, original
derivation).

## 4. The a11y contract

- **WAI-ARIA pattern**: APG Checkbox (two-state) and APG Checkbox (tri-state / mixed) as applicable.
  Cited sources:
  - https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
  - https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox/
  - https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/

- **roles + ARIA**:
  - `<input type="checkbox">` carries `role="checkbox"` natively; no manual `role` attribute ever.
  - `aria-checked`: supplied by the browser from the native `checked` + `indeterminate` DOM properties.
    The three values are: `"false"` (unchecked), `"true"` (checked), `"mixed"` (indeterminate = DOM
    `indeterminate` property is `true`, regardless of the `checked` property). The server cannot emit
    `aria-checked="mixed"` as a static attribute reliably; the enhancer sets `.indeterminate` on the
    DOM node after hydration so the browser derives `aria-checked="mixed"` correctly.
  - `aria-label`: from `ariaLabel` param — **mandatory when no visible `<label>` is associated**.
  - `aria-describedby`: from `ariaDescribedBy` param — wires to hint/error text from the `field` PARTIAL.
  - `aria-invalid`: from `ariaInvalid` param — signals validation failure.
  - `aria-disabled`: NOT used; the native `disabled` attribute is sufficient and preferred (the platform
    handles both keyboard removal + ARIA semantics). An `<a>` cannot be natively disabled; a
    `<input>` can. No `aria-disabled` workaround needed here.
  - The WRAPPING GROUP: when multiple checkboxes share a logical question, they are wrapped in a
    `<fieldset><legend>` (the `field` / `form` PARTIAL handles this grouping). The `checkbox` PARTIAL
    itself emits only the single control; it does not emit a group.

- **keyboard map** (the load-bearing table, verified against APG):
  | key | does | who |
  |---|---|---|
  | `Tab` | moves keyboard focus to the checkbox (includes it in the page tab sequence) | platform (native `<input>`) |
  | `Shift+Tab` | moves focus back out of the checkbox | platform |
  | `Space` | toggles: unchecked → checked → unchecked; on indeterminate → cycles to checked | platform (native `<input>`) |

  The APG Checkbox pattern defines exactly these two keys (Tab + Space). There are no arrow keys,
  no Home/End, no typeahead. The native `<input type="checkbox">` supplies the complete interaction
  with zero enhancer keyboard code.

- **focus management**: platform. `focus-visible:` ring via `--lv-ring` token. No trap, no roving
  tabindex, no focus-restore obligation. The `<input>` is in the natural tab sequence at its DOM
  position; no `tabindex` manipulation needed or allowed.

- **live region**: none. A checkbox state change is self-describing (the screen reader announces the
  new state via the native `role=checkbox` + `aria-checked` update). No separate live region or
  announcer is warranted.

- **indeterminate and the platform contract**: the DOM `indeterminate` property is write-only from JS
  (the HTML parser ignores the `indeterminate` attribute; it is not an HTML attribute). The enhancer
  reads `data-indeterminate="true"` on the `<input>` and sets `el.indeterminate = true` after the
  element mounts. The browser then reflects `aria-checked="mixed"` automatically. This is a
  one-line enhancer, NOT a framework; it lives in `checkbox.enhancer.ts` (see §6).

- **shared mechanism composed**: none from the shared mechanism table (no popover, no focus-trap,
  no collection-nav). The checkbox is the simplest interactive tier: the platform supplies every
  behavior. The enhancer is a four-line lifecycle hook, not a shared structural mechanism.

## 5. Tokens

**Reads** (all via `var(--lv-*)`, no literals):

| token | used for |
|---|---|
| `--lv-color-primary` | checked / indeterminate fill background |
| `--lv-color-primary-fg` | check mark / dash colour on a filled background |
| `--lv-color-border` | unchecked border colour |
| `--lv-color-input` | unchecked background (matches input background for form cohesion) |
| `--lv-color-destructive` | border + fill when `aria-invalid="true"` |
| `--lv-color-muted-fg` | disabled check mark |
| `--lv-ring` | focus-visible ring (the shared interactive focus token) |
| `--lv-ring-destructive` | focus-visible ring when `aria-invalid` |
| `--lv-space-4` | box size at `sm` (16 px) |
| `--lv-space-5` | box size at `md` (20 px, default) |
| `--lv-space-6` | box size at `lg` (24 px) |
| `--lv-radius-sm` | box corner radius (slightly rounded, not pill) |
| `--lv-transition-colors` | smooth checked/unchecked fill transition |

**Dark mode**: no new rules; all token pairs re-point in the single `.dark, [data-theme="dark"]`
block in `lievit-tokens.css`. The checkbox reads semantic tokens (`--lv-color-primary`,
`--lv-color-border`, etc.) that already have dark-mode values.

**NET-NEW tokens proposed**: none. The checkbox surface is fully covered by the existing token
vocabulary. The `--lv-space-5` (20 px) slot may not exist in the current set if the scale jumps
from `--lv-space-4` (16 px) to `--lv-space-6` (24 px); if so, add `--lv-space-5: 1.25rem` as an
additive extension in `:root` (no dark twin needed — structural, not colour). This is the ONLY
candidate net-new token; it must be verified against the live `lievit-tokens.css` file before
adding. If `--lv-space-5` already exists, zero net-new.

## 6. Wire / island integration

### Server-rendered JTE structure

```
<span data-slot="checkbox" data-size="${size}" data-state="${state}"
      class="relative inline-flex items-center justify-center
             [size tokens] [radius] [transition]
             [focus-visible ring] [disabled:opacity] [aria-invalid:border]">
  <input type="checkbox"
         id="${resolvedId}"
         name="${name}"
         value="${value}"
         ${checked ? "checked" : ""}
         ${disabled ? "disabled" : ""}
         ${required ? "required" : ""}
         ${indeterminate ? "data-indeterminate=\"true\"" : ""}
         aria-label="${ariaLabel}"        <!-- null-dropped if null -->
         aria-describedby="${ariaDescribedBy}" <!-- null-dropped if null -->
         aria-invalid="${ariaInvalid ? "true" : null}" <!-- null-dropped -->
         class="sr-only peer"
         $unsafe{attrs}>
  <!-- visual box + check mark / dash, peer-driven CSS -->
  <span aria-hidden="true"
        class="pointer-events-none absolute inset-0
               rounded-[--lv-radius-sm]
               border border-[--lv-color-border]
               bg-[--lv-color-input]
               peer-checked:bg-[--lv-color-primary] peer-checked:border-[--lv-color-primary]
               peer-data-[indeterminate=true]:bg-[--lv-color-primary]
               peer-data-[indeterminate=true]:border-[--lv-color-primary]
               peer-focus-visible:ring-[--lv-ring]
               peer-disabled:opacity-50
               peer-aria-invalid:border-[--lv-color-destructive]
               transition-[--lv-transition-colors]">
    <!-- check mark SVG (visible when peer-checked) -->
    <!-- dash SVG (visible when peer-data-[indeterminate=true]) -->
  </span>
</span>
```

**Key structural decisions**:
- The `<input>` is `sr-only peer` (visually hidden, accessible, focus-managed by the platform).
  A visible custom box is built on top as an `aria-hidden` peer-driven sibling.
  This is the standard visually-custom-but-natively-accessible pattern: the screen reader sees
  the real `<input>`, not the decorative box.
- The check mark and dash are inline SVG within the `aria-hidden` visual box, driven by
  Tailwind `peer-checked:` / `peer-data-[indeterminate=true]:` utilities.
- `data-indeterminate` is set on the `<input>` itself so the Tailwind `peer-data-[indeterminate]`
  selector works; and so the enhancer has a stable hook without needing an extra wrapper attribute.
- `id` is resolved server-side: if `id` param is non-null, use it; otherwise emit a
  deterministic auto-id (e.g. `lv-checkbox-${hashCode}`). The `field` PARTIAL passes an explicit
  id and wires its `<label for>` to it.
- `null`-dropped ARIA attributes use JTE's boolean-attribute mechanism (emit the attribute only
  when the value is non-null / non-false); do not emit `aria-label=""` or `aria-invalid="false"`.

**`data-*` escaping**: `dataAttrs` values are emitted via `Escape.htmlAttribute` (the SAFE channel).
`attrs` is documented as TRUSTED-raw only; it carries `l:model="field"` (a static author-typed
directive), never a DB-derived value.

### Typed-TS enhancer: `checkbox.enhancer.ts`

The checkbox needs exactly ONE irreducible client behavior: setting the `indeterminate` DOM property
on `<input>` elements that have `data-indeterminate="true"`.

**Responsibilities**:
1. On component mount (lifecycle `onComponentInit` or a `l:init` directive on the wrapper span):
   query all `input[type="checkbox"][data-indeterminate="true"]` within the component root and set
   `el.indeterminate = true`.
2. After each morph (lifecycle `onAfterMorph`): repeat the same query+set so that a wire round-trip
   that changes an indeterminate state re-applies it to the new DOM node identity.
3. Nothing else. No custom keyboard handling. No state management. No event listeners beyond what
   the browser supplies natively.

The enhancer registers as a lifecycle extension via the lievit runtime registry (`ADR-0019`):

```typescript
// checkbox.enhancer.ts  (typed-vanilla-TS, CSP-clean, no framework)
import type { LievitLifecycle } from '@lievit/runtime';

function applyIndeterminate(root: Element): void {
  root.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"][data-indeterminate="true"]'
  ).forEach((el) => {
    el.indeterminate = true;
  });
}

export const checkboxLifecycle: LievitLifecycle = {
  onComponentInit(root) { applyIndeterminate(root); },
  onAfterMorph(root)    { applyIndeterminate(root); },
};
```

This enhancer is scoped to the component root; it does NOT reach outside. It fires after mount
and after every morph. It is idempotent (setting `indeterminate = true` twice is harmless).

**When `indeterminate` is NOT needed** (no tri-state): the enhancer still loads (it is always
bundled with the checkbox partial) but its `querySelectorAll` returns an empty list and it is a
no-op. No conditional loading is required.

**Bound by lievit runtime, NOT Turbo**: the lifecycle hooks integrate via the runtime registry
(ADR-0019), not via Turbo frame events. The partial is not a Turbo Stream. Page navigation uses
Turbo Drive; this enhancer's lifecycle fires on component init / morph, which are runtime
events, not Turbo events.

### The `l:model` wire-up (in the consuming WIRE template)
The consuming template (e.g. a WIRE form component) adds `l:model="agreedToTerms"` to the
`attrs` param when calling this partial. The runtime's `l:model` directive binds the native
`change` event of the `<input>` and fires a wire round-trip that updates the `@Wire boolean
agreedToTerms` field server-side, then morphs the re-rendered HTML. The checkbox partial itself
does not own the wire action; it only provides the styled, accessible `<input>` surface.

## 7. Acceptance tests

The component is DONE only when ALL of the following pass on a REAL substrate.

### Render (jsdom, real JTE compile + render)

- **two-state unchecked renders correctly**: the `<input type="checkbox">` is present with no
  `checked` attribute; `data-slot="checkbox"`, `data-size="md"`, `data-state="unchecked"` are
  on the root span; no `data-indeterminate` attribute on the input.
- **two-state checked renders correctly**: `checked` attribute is present on the `<input>`.
- **indeterminate renders `data-indeterminate`**: when `indeterminate=true`, the `<input>` has
  `data-indeterminate="true"` and does NOT have `checked` (indeterminate is an independent state).
- **disabled renders native disabled**: the `<input>` has the `disabled` attribute.
- **required renders native required**: the `<input>` has `required`.
- **aria-invalid emits `aria-invalid="true"`**: present on the `<input>` when `ariaInvalid=true`;
  absent (not emitted as `"false"`) when `ariaInvalid=false`.
- **ariaLabel emits aria-label**: present when non-null, absent when null (no empty-string attr).
- **ariaDescribedBy emits aria-describedby**: wired to the supplied id.
- **sizes emit data-size**: `sm`, `md`, `lg` each produce their respective `data-size` value on
  the root span; the `md` size is the default when `size` param is omitted.
- **id resolution**: when `id` is supplied, the `<input>` carries it; when omitted, an auto-id
  is emitted (non-empty, unique within the render).
- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate
  (cannot be mocked; this is the gate that caught the development-mode packaging bug).

### axe-core

- **zero violations on unchecked state**: render the checkbox in jsdom (real JTE output), attach
  to document, run axe-core; assert zero violations of the `checkbox` role and accessible-name
  rules.
- **zero violations on checked state**: same, with `checked=true`.
- **zero violations on indeterminate state**: render with `indeterminate=true` AND the enhancer
  applied (so `el.indeterminate` is `true` and the browser reflects `aria-checked="mixed"`);
  run axe-core.
- **missing accessible name fails**: a standalone checkbox (no `<label>`) rendered WITHOUT
  `ariaLabel` MUST produce an axe-core violation on the accessible-name rule (asserts the guard
  is in place, not bypassed).

### Enhancer (real `LievitRuntime` + jsdom, NOT a mocked `$lievit`)

- **indeterminate DOM property set on init**: mount the checkbox partial with `indeterminate=true`
  via the real `LievitRuntime`; after `onComponentInit`, assert `el.indeterminate === true` on
  the `<input>`.
- **indeterminate reflects `aria-checked="mixed"`**: after the enhancer runs, assert that the
  browser-computed `aria-checked` on the `<input>` is `"mixed"` (verifies the platform contract,
  not just the DOM property).
- **no-indeterminate is a no-op**: mount with `indeterminate=false`; assert `el.indeterminate ===
  false` after init (the enhancer must not erroneously set it).
- **morph re-applies indeterminate**: simulate a wire morph that replaces the DOM node; assert
  `onAfterMorph` restores `el.indeterminate = true` on the new node (idempotency + morph-safety).
- **morph does not set indeterminate when not flagged**: a morph that produces an input without
  `data-indeterminate` must leave `indeterminate` as `false`.

### Keyboard (platform — assert the native behavior in jsdom)

- **Space toggles unchecked → checked**: focus the `<input>`, dispatch a `Space` keyboard event;
  assert `el.checked === true` and `el.getAttribute('aria-checked')` resolves to `"true"` from
  the browser.
- **Space toggles checked → unchecked**: from checked state, Space → assert `el.checked === false`.
- **Tab includes the checkbox in tab sequence**: assert that the `<input>` is focusable (no
  negative `tabindex`; focusable via native).
- **disabled blocks Space activation**: focus a disabled `<input>`, dispatch Space; assert
  `el.checked` is unchanged and no `change` event fires.

### Variants / states (token-class assertions)

- **each size emits the expected token class** for the box dimensions (`--lv-space-4/5/6`);
  assert `data-size` and the computed Tailwind utility on the visual span.
- **`aria-invalid` recolours**: when `ariaInvalid=true`, the root span carries the destructive
  border token class; when false, it does not.
- **`data-state` values**: unchecked → `"unchecked"`, checked → `"checked"`, indeterminate →
  `"indeterminate"` (verifies server-side state derivation is correct for CSS hooks).

### Escaping (XSS abuse-case)

- **`dataAttrs` hostile value renders inert**: `dataAttrs={confirm: "\">|<script>alert(1)"}` →
  the rendered HTML escapes the value; assert no unescaped `<script>` tag in the output.
- **`attrs` is documented TRUSTED-only**: the acceptance test documents that `attrs` is never
  fed DB-derived data (review-enforced, not runtime-enforced — same contract as `button.jte`).

## 8. Non-goals / anti-patterns

- **Do NOT use `<div role="checkbox" tabindex="0">`**: the native `<input type="checkbox">` is
  always preferred. It gives role + keyboard + disabled + form integration for free. A div-based
  checkbox is only found in the APG worked examples to teach the ARIA model; the lievit
  implementation uses the real native element. (Verified: the APG examples use a `div` purely to
  demonstrate the JavaScript a11y model, not as a production recommendation.)
- **Do NOT emit `aria-checked` as a static HTML attribute**: the browser derives it from the
  native `checked` + `indeterminate` DOM properties. Setting both `aria-checked="mixed"` AND the
  indeterminate property leads to conflicts on state changes. Let the browser own `aria-checked`.
- **Do NOT manage the checkbox-group / select-all pattern here**: a list of checkboxes with a
  "select all" parent that shows `aria-checked="mixed"` is `checkbox-list` (PARTIAL+ENH, separate
  component). The mixed-state parent's `aria-controls` relationship + the group wiring belong to
  that component, not here. This component is a SINGLE control.
- **Do NOT add a `label` param or project a label inside the partial**: the label sits in a sibling
  `<label for>` element, wired by the `field` PARTIAL or authored inline. A label inside the
  control partial conflates two distinct semantic elements and breaks customization.
- **Do NOT hand-roll indeterminate via `aria-checked="mixed"` as a static attribute on the input**:
  the `aria-checked` attribute is ignored on a native `<input type="checkbox">` (the browser owns
  the property mapping). The only correct mechanism is `el.indeterminate = true` in the enhancer.
- **Do NOT set `l:model` or `l:change` inside the partial itself**: these are consuming-template
  concerns. The partial provides the styled surface; the WIRE form template wires the action. The
  `attrs` TRUSTED channel carries the directive string from the caller.
- **Do NOT add a `variant` param**: the checkbox has no intent variants (it is not an action button).
  Visual theming is done via token overrides in `:root`, not per-instance variant strings.
- **Do NOT skip the `sr-only peer` pattern in favour of styling the visible `<input>` directly**:
  cross-browser `<input type="checkbox">` appearance is inconsistent and cannot be reliably styled
  to Tailwind-UI grade. The visually-custom-but-natively-accessible pattern (sr-only input + peer
  visual box) is the correct approach and the one the architecture contract targets.
