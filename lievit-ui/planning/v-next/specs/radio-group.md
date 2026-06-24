<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — radio-group

- **tier**: PARTIAL + ENH (`radio-group.enhancer.ts` for the roving-tabindex keyboard navigation;
  the native `<input type="radio">` variant requires NO enhancer — platform-supplied)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/radio-group.jte` / radio partial family)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Radio Group (https://www.w3.org/WAI/ARIA/apg/patterns/radio/) — the complete
      keyboard map, roving-tabindex focus model, and `radiogroup`/`radio` role wiring; verified against
      the official APG example (https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio/);
      react-aria `useRadioGroup` / `useRadio` consulted as pattern reference for the ARIA wiring and
      state management transcription into ORIGINAL template + enhancer
    - inventory: Ant Design Radio as inventory reference (sizes, button-style group, vertical/horizontal
      layout, disabled per-option, disabled whole group)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A group of mutually exclusive options rendered as radio controls: only one option in the group can be
selected at a time. Two rendering modes exist: **default** (custom `role="radio"` divs with roving
tabindex, styled token-driven controls) and **native** (real `<input type="radio">` elements, no
enhancer needed, platform supplies all keyboard behavior). A third visual mode, **button-style**, wraps
the options in a segmented button-bar appearance while keeping the same ARIA semantics.

PARTIAL because the SELECTED VALUE is passed in as a param from the server (the controller owns the
current selection, reads it from the model, and passes it as `value`); the radio group itself carries
no server-side mutable `@Wire` state. When the selection must round-trip to the server on change, the
consuming template wraps this partial in a form and uses `l:submit`, or wires an `l:change` on the
outer element. (If instant server round-trip on every click is required — e.g. a live filter — a
WIRE wrapper is the right layer; this PARTIAL is the pure presentation slice.)

Server-first works cleanly: the checked state is a boolean comparison (`option.id() == value`) emitted
as `aria-checked` in the server-rendered markup; no client holds the truth. The one irreducible CLIENT
behavior in the default/button-style modes is the roving-tabindex keyboard navigation (arrow keys move
focus AND selection, wrapping, per APG) — this is the `radio-group.enhancer.ts` escape-hatch.
The native `<input type="radio">` mode requires no enhancer: the platform implements roving focus and
arrow-key navigation natively.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | — | **REQUIRED.** The HTML `name` attribute shared by all options in the group. Drives form submission grouping. |
| `options` | `List<RadioOption>` | — | **REQUIRED.** The option set. `RadioOption` carries: `id()` (the value submitted), `label()` (visible text), `description()` (optional hint rendered below the label), `disabled()` (per-option disabled state). Passed from the controller's typed model — never hardcoded in the partial. |
| `value` | `String` | `null` | The currently selected option id. `null` = nothing selected. Compared server-side to emit `aria-checked`/`checked`. |
| `variant` | `String` | `"default"` | `default` (stacked radio pills) \| `button` (segmented button-bar, horizontal by default) \| `button-vertical` (segmented, stacked) |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — height-based, toolbar-aligned (same scale as `button`/`input`) |
| `layout` | `String` | `"vertical"` | `vertical` \| `horizontal` — applies to the `default` variant only; the `button` variants are always inline by nature |
| `disabled` | `boolean` | `false` | Disables the entire group (all options). Per-option `disabled()` is additive. |
| `required` | `boolean` | `false` | Adds `aria-required="true"` to the `radiogroup` element. |
| `labelledby` | `String` | `null` | `id` of an external label element → `aria-labelledby`. Use this when the group's visible label is rendered outside the partial (e.g. inside a `field` partial). **Required** when `groupLabel` is not set. |
| `groupLabel` | `String` | `null` | Inline label text rendered as a `<legend>`-equivalent header inside the partial and referenced via `aria-labelledby`. **Required** when `labelledby` is not set. |
| `groupLabelId` | `String` | auto-generated | `id` stamped on the inline group label element so the `aria-labelledby` reference is stable across morphs. Auto-generated from `name` when not set: `"rg-label-" + name`. |
| `describedby` | `String` | `null` | `id`(s) of external elements that describe the group (hint, error) → `aria-describedby` on the `radiogroup`. Composable with the `field` partial's error region. |
| `nativeInputs` | `boolean` | `false` | Render real `<input type="radio">` elements instead of `role="radio"` divs. No enhancer needed. Preferred for plain forms without custom styling requirements; mandatory for mobile-first contexts where native controls are required. |
| `cssClass` | `String` | `""` | Extra utility classes on the root `radiogroup` element. |
| `optionCssClass` | `String` | `""` | Extra utility classes applied to each option item wrapper. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `l:change="handleSelection"`, `data-testid="..."` for test targeting). Never fed per-row or DB-derived data. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` values (each value through `Escape.htmlAttribute`). For per-group dynamic attributes. |
| `optionAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** `data-*` values propagated to each option element. |

`RadioOption` is a sealed interface (or record) owned by the consuming module's model layer, not by
lievit. The partial accepts any type that satisfies `id()`, `label()`, `description()`, `disabled()`.
A controller passes a typed `List<RadioOption>` from domain data; the partial renders it. This is the
"no data in a partial" rule applied to option lists.

## 3. Variants / sizes / states

### Variants

| variant | visual form | ARIA form | when to use |
|---|---|---|---|
| `default` | Each option: a circular indicator + label text + optional description, stacked or horizontal. The custom indicator is styled via tokens (not a native radio dot). | `role="radiogroup"` wrapping `role="radio"` divs with roving tabindex + `aria-checked`. Needs the enhancer. | When custom styling, per-option descriptions, or rich label content are required |
| `button` | Options appear as a contiguous segmented button bar (horizontal). The selected option shows as "pressed" / filled. No individual radio indicators visible. | Same ARIA structure as `default` (`role="radiogroup"` + `role="radio"` + `aria-checked`). Needs the enhancer. | Compact horizontal selection (e.g. size picker, view toggle, period selector) |
| `button-vertical` | Same as `button` but stacked vertically. | Same ARIA structure. | Vertical segmented picker when horizontal space is constrained |
| `native` (`nativeInputs=true`) | Real `<input type="radio">` elements with a styled `<label>`. Indicator is the platform's radio circle (can be CSS-overridden with `appearance:none` + token-styled pseudo-element). | `<fieldset>` + `<legend>` + `<input type="radio" name="..." value="...">` + `<label>`. Platform supplies all keyboard behavior. No enhancer. | Plain forms, accessibility-first deployments, mobile where native controls are required |

### Sizes (height-based, toolbar-aligned)

The `size` param governs the TOUCH TARGET height for each option row and the font size:

| size | height token | text size | use |
|---|---|---|---|
| `sm` | `--lv-space-8` (32 px) | `--lv-text-xs` | Compact toolbars, filter bars |
| `md` | `--lv-space-9` (36 px) | `--lv-text-sm` | Default (same as `button` / `input` md) |
| `lg` | `--lv-space-10` (40 px) | `--lv-text-base` | Prominent form sections, touch-primary UIs |

For the `button` / `button-vertical` variants the size governs the button pill height (flush with a
`button` of the same size). For the `default` variant the size governs the minimum touch-target height
of each option row (the indicator circle scales proportionally).

### States

| state | how expressed | ARIA reflection |
|---|---|---|
| unchecked | default rendering | `aria-checked="false"` (custom) / `checked` absent (native) |
| checked | filled indicator / pressed button | `aria-checked="true"` (custom) / `checked` present (native) |
| focused | `--lv-ring` focus-visible ring on the focused option | `:focus-visible` on the option element |
| disabled (per-option) | dimmed, `pointer-events:none`, excluded from tab sequence | `aria-disabled="true"` on `role="radio"` / `disabled` on `<input>` |
| disabled (whole group) | all options dimmed, group inert | `aria-disabled="true"` on `role="radiogroup"` + on each option / `disabled` on each `<input>` |
| invalid | destructive border + ring on the group container | `aria-invalid="true"` on the `radiogroup` (set by the field partial via `describedby` + the error region) |

## 4. The a11y contract

**WAI-ARIA pattern**: APG Radio Group.
Source verified: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
Example verified: https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio/

### Roles + ARIA (custom / default + button variants)

| element | role / attribute | value | notes |
|---|---|---|---|
| Group container (`<div>`) | `role="radiogroup"` | — | Wraps all options. |
| Group container | `aria-labelledby` | `groupLabelId` or `labelledby` | One of the two is always set; both is valid for composite labels. |
| Group container | `aria-describedby` | `describedby` | Set when the field partial supplies a hint/error id. |
| Group container | `aria-required` | `"true"` when `required` | Signals that a selection is required. |
| Group container | `aria-disabled` | `"true"` when `disabled` | Marks the whole group as disabled; individual options also carry it. |
| Group container | `aria-invalid` | `"true"` when invalid | Driven by the consuming `field` partial. |
| Option element (`<div>`) | `role="radio"` | — | One per option. |
| Option element | `aria-checked` | `"true"` / `"false"` | Server-computed: `option.id() == value`. Always present (never omitted). |
| Option element | `aria-disabled` | `"true"` when `option.disabled()` or `disabled` | Disabled options remain in DOM but are inert. |
| Option element | `aria-describedby` | `optionDescId` | Set when `option.description()` is non-blank; points to the description span's id. |
| Option element | `tabindex` | `"0"` (one active) / `"-1"` (all others) | Roving tabindex. The tabindex-0 option is: the checked one if one is checked; otherwise the first non-disabled option. |
| Inline group label | `id` | `groupLabelId` | Referenced by `aria-labelledby` on the container. |
| Option description span | `id` | `optionDescId` | Unique per option; referenced by `aria-describedby` on the option element. |

### Roles + ARIA (native variant, `nativeInputs=true`)

| element | attribute | value | notes |
|---|---|---|---|
| `<fieldset>` | — | — | Groups the controls semantically; pairs with `<legend>`. |
| `<legend>` | — | group label text | Provides the accessible name for the field group. |
| `<input type="radio">` | `name` | same `name` for all | Browser enforces single-select per name. |
| `<input type="radio">` | `value` | `option.id()` | Submitted form value. |
| `<input type="radio">` | `checked` | present when `option.id() == value` | Server-rendered boolean attribute. |
| `<input type="radio">` | `disabled` | present when `option.disabled()` or `disabled` | Platform disables the control. |
| `<input type="radio">` | `required` | present on the first option when `required` | Browser enforces the field-level required rule. |
| `<input type="radio">` | `aria-describedby` | `optionDescId` | Set when `option.description()` is non-blank. |
| `<label>` | `for` | input `id` | Associates the label with the input. |

### Keyboard interaction map (custom variant — the enhancer owns all non-platform keys)

Sourced verbatim from APG Radio Group (https://www.w3.org/WAI/ARIA/apg/patterns/radio/), table verified 2026-06-24.

| key | action | who supplies it |
|---|---|---|
| `Tab` | Moves focus INTO the group. Lands on the checked option if one is checked; otherwise on the first non-disabled option. Takes focus OUT of the group when pressed on the tabindex-0 option. | Platform (roving tabindex; the enhancer sets up the tabindex values, platform Tab moves between tabindex-0 elements) |
| `Shift+Tab` | Moves focus OUT of the group in reverse. Lands on the tabindex-0 option when arriving from after the group. | Platform (same roving mechanism) |
| `Space` | Checks the focused option if it is not already checked. No change if already checked. | Enhancer (maps Space keydown → checks the focused option via `aria-checked` update → fires a change event for `l:change`/form submission) |
| `ArrowDown` / `ArrowRight` | Moves focus to the NEXT option (wraps to first after last); checks the newly focused option; unchecks the previously checked option. Skips disabled options. | Enhancer (roving tabindex shift + `aria-checked` update) |
| `ArrowUp` / `ArrowLeft` | Moves focus to the PREVIOUS option (wraps to last after first); checks the newly focused option; unchecks the previously checked option. Skips disabled options. | Enhancer (roving tabindex shift + `aria-checked` update) |

Note (APG verbatim): in some browsers, native radio groups focus the LAST button on Shift+Tab when
none is selected. The APG model (and this enhancer) always focus the FIRST non-disabled option when
none is selected on forward Tab, regardless of Tab direction. This is a deliberate spec choice.

### Keyboard interaction (native variant, `nativeInputs=true`)

No enhancer. The platform implements the IDENTICAL behavior (roving among `<input type="radio">` in a
named group, Arrow keys move + check, Space checks if unchecked). The keyboard map is the same table
above — fulfilled by the browser's native radio implementation.

### Focus management

- **Roving tabindex**: exactly one option in the group has `tabindex="0"` at any time. All others
  have `tabindex="-1"`. The `tabindex="0"` option is the checked one (if any is checked) or the
  first non-disabled option (if none is checked). The enhancer maintains this invariant on every
  arrow-key move and on `aria-checked` change.
- **No focus trap**: a radio group is NOT a modal; Tab exits the group normally.
- **Initial focus**: Tab into the group lands on the `tabindex="0"` element (checked or first).
- **Focus restore**: not applicable (no overlay/modal open-close cycle).
- **Disabled options**: `tabindex="-1"`, skipped by arrow navigation. A group where ALL options are
  disabled preserves `tabindex="0"` on the first option for structural reachability (the option is
  `aria-disabled` and inert to activation, but Tab can still reach the group).
- **Shared mechanism composed**: the roving-tabindex model here is simpler than `collection-nav`
  (which manages `aria-activedescendant` for listbox/menu). Radio group uses DIRECT focus movement
  (the focused element IS the active option, not a virtual `aria-activedescendant` pointer).
  Therefore this component does NOT compose `collection-nav`; it has its own small
  `radio-group.enhancer.ts` (roving focus + `aria-checked` sync + Space/arrow key map).
  The implementation is ~50 lines; the single-source-a11y rule still applies within this enhancer
  (one canonical implementation, shared if a future component needs the same pattern).

### Live region

None. A radio group is not a status announcer. Screen readers announce the option label +
`aria-checked` state automatically when focus moves to an option (the `role="radio"` contract). No
supplemental live region is needed.

## 5. Tokens

### Consumed tokens

| token | purpose |
|---|---|
| `--lv-color-primary` | Checked indicator fill / checked button background |
| `--lv-color-primary-fg` | Checked indicator dot / checked button text |
| `--lv-color-border` | Unchecked indicator ring / unchecked button border |
| `--lv-color-input` | Unchecked indicator background / unchecked button background |
| `--lv-color-fg` | Label text color |
| `--lv-color-muted` | Description / hint text color |
| `--lv-color-muted-fg` | Muted text (description) foreground |
| `--lv-color-accent` | Hover state on unchecked options |
| `--lv-color-accent-fg` | Hover text on accent background |
| `--lv-color-destructive` | `aria-invalid` border + ring on the group |
| `--lv-ring` | Focus-visible ring on the focused option |
| `--lv-space-8` | sm option height / indicator touch target |
| `--lv-space-9` | md option height (default) |
| `--lv-space-10` | lg option height |
| `--lv-space-1` | Indicator dot inner radius offset |
| `--lv-space-2` | Option internal gap (indicator to label) |
| `--lv-space-3` | Option internal padding (button variant) |
| `--lv-space-4` | Gap between stacked options |
| `--lv-text-xs` | sm label text |
| `--lv-text-sm` | md label text (default) |
| `--lv-text-base` | lg label text |
| `--lv-radius-full` | Circular indicator dot |
| `--lv-radius-md` | Button variant pill radius (outer corners of the segmented bar) |
| `--lv-radius-sm` | Button variant inner segment radius |
| `--lv-font-sans` | Label + description typography |

### NET-NEW tokens

None. The radio group's visual surface is fully covered by existing tokens. The custom circular
indicator is constructed from `--lv-color-border` (ring) + `--lv-color-primary` (fill on checked)
+ `--lv-radius-full` (circle). The segmented button-bar reuses `--lv-color-input` / `--lv-color-border`
for unchecked segments and `--lv-color-primary` / `--lv-color-primary-fg` for the checked one, the
same token pairs the `button` partial uses.

## 6. Wire / island integration

### Server-rendered JTE structure (default / button variants)

```
<div
  role="radiogroup"
  id="rg-${name}"
  aria-labelledby="${groupLabelId}"           ← set when groupLabel is non-null
  aria-labelledby="${labelledby}"              ← set when labelledby is non-null (mutually exclusive)
  aria-describedby="${describedby}"            ← set when describedby is non-null
  aria-required="${required}"                  ← set only when required=true
  aria-disabled="${disabled}"                  ← set only when disabled=true
  aria-invalid="..."                           ← set by consuming field partial
  data-slot="radio-group"
  data-variant="${variant}"
  data-size="${size}"
  data-layout="${layout}"
  data-lievit-enhancer="radio-group"           ← signals the enhancer to mount
  ${attrs}                                     ← TRUSTED raw (STATIC author strings only)
  ... data-* from dataAttrs (escaped)
>
  <!-- inline group label (only when groupLabel is non-null) -->
  <span id="${groupLabelId}" data-slot="radio-group-label" aria-hidden="true">
    ${groupLabel}
  </span>

  <!-- option list -->
  !{for option in options}
  <div
    role="radio"
    id="rg-${name}-${option.id()}"
    aria-checked="${option.id() == value ? "true" : "false"}"
    aria-disabled="${(option.disabled() || disabled) ? "true" : "false"}"
    aria-describedby="${hasDescription(option) ? "rg-desc-${name}-${option.id()}" : null}"
    tabindex="${isTabStop(option, value, options) ? "0" : "-1"}"
    data-slot="radio-option"
    data-value="${Escape.htmlAttribute(option.id())}"
    ... data-* from optionAttrs (escaped)
  >
    <!-- custom indicator (default variant only) -->
    <span data-slot="radio-indicator" aria-hidden="true">
      <span data-slot="radio-indicator-dot"></span>
    </span>

    <!-- label + optional description -->
    <span data-slot="radio-label">${option.label()}</span>
    !{if option.description() != null}
    <span id="rg-desc-${name}-${option.id()}" data-slot="radio-description">
      ${option.description()}
    </span>
    !{/if}
  </div>
  !{/for}
</div>
```

### Server-rendered JTE structure (native variant, `nativeInputs=true`)

```
<fieldset data-slot="radio-group" data-variant="native" data-size="${size}" data-layout="${layout}">
  <legend data-slot="radio-group-label">${groupLabel}</legend>   ← or a visually-hidden legend when
                                                                     labelledby is used externally

  !{for option in options}
  <div data-slot="radio-option">
    <input
      type="radio"
      id="rg-${name}-${option.id()}"
      name="${name}"
      value="${Escape.htmlAttribute(option.id())}"
      ${option.id() == value ? "checked" : ""}
      ${(option.disabled() || disabled) ? "disabled" : ""}
      ${required && firstOption(option, options) ? "required" : ""}
      ${hasDescription(option) ? "aria-describedby=\"rg-desc-" + Escape.htmlAttribute(name) + "-" + Escape.htmlAttribute(option.id()) + "\"" : ""}
    >
    <label for="rg-${name}-${option.id()}" data-slot="radio-label">
      ${option.label()}
      !{if option.description() != null}
      <span id="rg-desc-${name}-${option.id()}" data-slot="radio-description">
        ${option.description()}
      </span>
      !{/if}
    </label>
  </div>
  !{/for}
</fieldset>
```

### `radio-group.enhancer.ts` responsibilities

The enhancer mounts on any element carrying `data-lievit-enhancer="radio-group"` (i.e. the root
`role="radiogroup"` div). It is NOT mounted for the native variant (`nativeInputs=true`).

**Responsibilities:**

1. **Roving tabindex maintenance**: on mount, verify the `tabindex` values are correct (the server
   already emits them; the enhancer re-confirms and corrects any morph-induced drift). The invariant:
   exactly one option has `tabindex="0"` — the `aria-checked="true"` one, or the first non-disabled
   option if none is checked.

2. **Arrow key navigation**: listen for `keydown` on the `radiogroup` element (event delegation).
   - `ArrowDown` / `ArrowRight`: move to the next non-disabled option (wrapping). Set `tabindex="-1"`
     on the current, `tabindex="0"` on the next, move DOM focus to the next, set `aria-checked="true"`
     on the next, set `aria-checked="false"` on the previously checked option, dispatch a synthetic
     `change` event from the group element (for `l:change` / form-level listeners).
   - `ArrowUp` / `ArrowLeft`: same, moving backwards.
   - Skips options with `aria-disabled="true"`.
   - Wraps at the ends (last → first on ArrowDown/Right, first → last on ArrowUp/Left).

3. **Space key**: if the focused option has `aria-checked="false"`, check it and dispatch `change`.
   If already `aria-checked="true"`, no-op.

4. **`aria-checked` synchronization with `l:change`**: after any arrow or Space action, dispatch a
   `CustomEvent` of type `lievit:radio-change` on the root element, with `detail: { name, value:
   optionId }`. The consuming template can bind `l:change="..."` on the root to trigger a wire call.
   The event is also a standard DOM `change` event so plain `<form>` submissions pick it up.

5. **Post-morph reconciliation**: after the lievit runtime morphs the component (following a wire
   round-trip in a consuming template), the enhancer re-validates the roving tabindex (the server may
   have changed which option is checked). Registered via the `lifecycle` registry (`onComponentUpdate`
   / `onMorphEnd`).

6. **Keyboard guard**: `Enter` has no defined action in APG Radio Group (Space is the activator).
   The enhancer does NOT bind Enter.

**Not the enhancer's job:**
- Rendering option labels or indicators (server owns the markup).
- Managing the `checked` attribute on `<input>` elements (native variant has no enhancer).
- Validating that the chosen id is a member of the option set (that belongs to the consuming wire
  component's Java action or the form submission handler).

### `l:*` directive surface (on the consuming template, not in this partial)

This partial is a PARTIAL — it does not own any `l:*` directives itself. The consuming template adds:

```
@template.lievit.radio_group(
  name="priority",
  options="${priorityOptions}",
  value="${form.priority()}",
  groupLabel="Priorità",
  attrs="l:change=\"updatePriority\""   ← TRUSTED raw, STATIC string
)
```

Or, for a plain form:

```
<form l:submit="save">
  @template.lievit.radio_group(
    name="role",
    options="${roleOptions}",
    value="${form.role()}",
    groupLabel="Ruolo"
  )
  @template.lievit.button(type="submit", content="Salva")
</form>
```

## 7. Acceptance tests

All tests run on a REAL substrate. No mocked `$lievit`. The client-island-fidelity lesson applies:
an interaction test that does not mount the real enhancer certifies nothing about real behavior.

### Render tests (jsdom + real partial render, no LievitRuntime needed for the static render)

- **`renders_radiogroup_role_and_labelledby`**: renders the root `<div role="radiogroup">` with
  `aria-labelledby` pointing to the inline label element when `groupLabel` is set; asserts the label
  element exists with the correct `id`.
- **`renders_all_options_with_radio_role`**: for a 3-option list, asserts 3 `role="radio"` elements,
  each carrying `data-slot="radio-option"` and `data-value` equal to the option's id.
- **`renders_checked_option_aria_checked_true`**: when `value="b"` and options are `[a, b, c]`,
  asserts `aria-checked="true"` on the `b` option and `aria-checked="false"` on `a` and `c`.
- **`renders_no_option_checked_when_value_is_null`**: when `value=null`, asserts all options have
  `aria-checked="false"`.
- **`renders_tabindex_zero_on_checked_option`**: the checked option has `tabindex="0"`; all others
  have `tabindex="-1"`.
- **`renders_tabindex_zero_on_first_option_when_none_checked`**: when `value=null`, the first
  non-disabled option has `tabindex="0"`.
- **`renders_disabled_option_with_aria_disabled`**: when `option.disabled()=true`, asserts
  `aria-disabled="true"` on that option element.
- **`renders_whole_group_disabled`**: when `disabled=true`, asserts `aria-disabled="true"` on the
  root `radiogroup` element AND on each option.
- **`renders_option_description_with_aria_describedby`**: when an option has a non-null description,
  asserts the description span exists with its id and the option has `aria-describedby` pointing to it.
- **`renders_required_aria_required`**: when `required=true`, asserts `aria-required="true"` on
  the `radiogroup` element.
- **`renders_button_variant_data_variant`**: when `variant="button"`, asserts `data-variant="button"`
  on the root; no `data-slot="radio-indicator"` elements (button variant omits the dot indicator).
- **`renders_size_data_attribute`**: asserts `data-size="sm"` / `"md"` / `"lg"` matches the `size` param.
- **`renders_native_variant_fieldset_and_inputs`**: when `nativeInputs=true`, asserts a `<fieldset>`
  root with a `<legend>`, one `<input type="radio">` per option with matching `name`/`value`/`id`,
  and paired `<label for="...">` elements.
- **`renders_native_variant_checked_input`**: when `nativeInputs=true` and `value="b"`, asserts the
  `b` input has the `checked` boolean attribute; `a` and `c` do not.

### Axe-core assertion

- **`axe_zero_violations_default_variant`**: run axe-core on the rendered default variant (with a
  group label set and one option checked); assert zero violations. Cited rules: `radiogroup`,
  `aria-allowed-attr`, `aria-required-children`, `aria-valid-attr-value`, `label`, `color-contrast`.
- **`axe_zero_violations_button_variant`**: same check on the button variant.
- **`axe_zero_violations_native_variant`**: run axe-core on the native fieldset/input render; assert
  zero violations. Cited rules: `radiogroup` (or `label`, `input-button-name`), `color-contrast`.
- **`axe_fails_on_missing_group_label`**: render without `groupLabel` and without `labelledby`; assert
  axe-core reports a violation on the missing group label (the test documents the REQUIRED constraint).

### Keyboard tests (real enhancer mounted in jsdom, `installAllFeatures`)

- **`arrow_down_moves_focus_to_next_option`**: with focus on option `a`, dispatch `ArrowDown`; assert
  `document.activeElement` is now option `b`.
- **`arrow_down_checks_next_option`**: after `ArrowDown` from `a`, assert option `b` has
  `aria-checked="true"` and option `a` has `aria-checked="false"`.
- **`arrow_down_wraps_to_first_from_last`**: focus on the last option, `ArrowDown`; assert focus moves
  to the first option and it becomes `aria-checked="true"`.
- **`arrow_up_moves_focus_to_previous_option`**: focus on `b`, `ArrowUp`; assert focus lands on `a`.
- **`arrow_up_wraps_to_last_from_first`**: focus on first option, `ArrowUp`; assert focus moves to
  the last option.
- **`arrow_right_behaves_like_arrow_down`**: same assertion as `ArrowDown` but for `ArrowRight`.
- **`arrow_left_behaves_like_arrow_up`**: same as `ArrowUp` for `ArrowLeft`.
- **`space_checks_unchecked_focused_option`**: focus option `a` (unchecked), dispatch `Space`; assert
  `a` becomes `aria-checked="true"`.
- **`space_no_op_on_already_checked_option`**: focus the checked option, dispatch `Space`; assert no
  state change and no duplicate event fired.
- **`arrow_skips_disabled_option`**: with a disabled middle option `b` in `[a, b, c]`, focus `a`,
  `ArrowDown`; assert focus lands on `c` (disabled `b` is skipped).
- **`enter_has_no_action`**: dispatch `Enter` on the group; assert no `aria-checked` change and no
  event fired.
- **`arrow_nav_dispatches_lievit_radio_change_event`**: after `ArrowDown`, assert a `lievit:radio-change`
  `CustomEvent` was dispatched on the root element with `detail.value === nextOptionId`.

### Focus tests

- **`tab_into_group_lands_on_checked_option`**: simulate Tab; assert `document.activeElement` is the
  option with `aria-checked="true"`.
- **`tab_into_group_lands_on_first_when_none_checked`**: with `value=null`, simulate Tab into the group;
  assert focus lands on the first non-disabled option.
- **`roving_tabindex_maintained_after_arrow_nav`**: after `ArrowDown` moves to option `b`, assert
  `b` has `tabindex="0"` and all others have `tabindex="-1"`.
- **`disabled_option_excluded_from_tabindex_zero`**: when the first option is disabled, assert the
  first non-disabled option holds `tabindex="0"` on initial render.

### Wire round-trip test (consuming WIRE template, real LievitRuntime, the CollapsibleComponentIT pattern)

- **`selecting_an_option_via_wire_change_updates_checked_state`**: mount a WIRE component that
  embeds the `radio-group` partial and binds `l:change="setPriority"` on it; dispatch `ArrowDown`
  to move to the next option; the enhancer fires `lievit:radio-change`; the `l:change` handler
  fires the wire call; assert the re-rendered component's `aria-checked` reflects the new selection.

### Playwright (gesture fidelity, legacy-VM oracle)

- **`keyboard_selects_option_on_real_page`**: navigate to a page rendering the component; use
  `page.keyboard.press("Tab")` to enter the group; press `ArrowDown`; assert the second option is
  visually selected (checked state visible in the DOM) and the form value reflects the new option
  when submitted.
- **`mouse_click_selects_option`**: click on an unchecked option; assert it becomes `aria-checked="true"`
  and the previously checked one becomes `aria-checked="false"`.
- **`disabled_option_not_clickable`**: click on a `disabled` option; assert it stays `aria-checked="false"`.

### Escaping (XSS abuse-case)

- **`hostile_option_id_in_data_value_renders_inert`**: an option whose `id()` returns
  `"></div><script>alert(1)</script>`; assert the rendered `data-value` attribute is
  HTML-escaped and does not break the DOM structure or execute.
- **`hostile_option_id_in_description_id_renders_inert`**: same option id used in the description
  span's `id` and the `aria-describedby`; assert both are escaped via `Escape.htmlAttribute` and
  form a valid, inert attribute value.

### JTE compile + render gate

- **`jte_compile_gate`**: covered by the `test/jte-compile` real-compiler gate that runs on every
  partial; no separate test needed here, but the radio-group templates MUST be included in the gate's
  scan path.

## 8. Non-goals / anti-patterns

- **Not a WIRE component itself.** The radio group is PARTIAL: it renders current selection state
  from `value` but does not own a `@Wire boolean selected` field. When instant server state mutation
  on selection change is needed (e.g. a live filter that must re-query the server on every pick), the
  consuming template is WIRE and wraps this partial with `l:change="..."`.

- **Not a multi-select.** A radio group is mutually exclusive by definition. For multi-select,
  use `checkbox-list`. The `button` variant of the radio group is NOT a multi-toggle group; for
  that, use `toggle-buttons`.

- **Not a navigation component.** Do not use a radio group to drive tab-panel switching or page
  navigation. Use `tabs` for tab switching or real `<a>` links for navigation. The visual similarity
  of a `button-style` radio group and a tab bar is intentional (both use a segmented appearance) but
  the ARIA semantics are distinct: `radiogroup`/`radio` vs `tablist`/`tab`.

- **No hand-rolled roving tabindex.** The enhancer owns roving tabindex for the custom variants.
  Do not copy the logic per-screen or per-page. If a new component needs roving focus with direct
  DOM focus (not `aria-activedescendant`), it reuses this enhancer parameterised, or the pattern
  is extracted to a shared utility.

- **No option data hardcoded in the partial.** The partial never contains a hard-coded list of
  option labels, ids, or values. Option data ALWAYS arrives via the `options` param from the
  controller's typed model. This is the "no data in a partial" rule.

- **No `<script>` or inline `on*=` handlers in the JTE template.** The strict CSP (`script-src self`,
  no `unsafe-inline`) refuses them. All behavior is in the enhancer (loaded as a module) and wired
  via `data-lievit-enhancer` attribute recognition in the runtime.

- **No `aria-activedescendant` for radio groups.** The APG Radio Group pattern uses DIRECT focus
  movement (the focused element IS the active option). `aria-activedescendant` (the virtual pointer
  pattern) is correct for listboxes and menus, but incorrect here. Do not conflate the two; do not
  compose `collection-nav` for this component.

- **No `Enter` to activate.** APG Radio Group defines `Space` as the activation key for an unchecked
  option. `Enter` has no role. Do not bind it.

- **No loading/async state within the radio group itself.** If the option list is loaded asynchronously,
  the HTMX pattern (swap the group fragment) or a WIRE wrapper handles the fetch. The radio group
  partial renders a static option list; it does not manage its own loading state.

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read the APG Radio Group spec, react-aria
`useRadioGroup`/`useRadio` docs, Ant Design Radio, and Tailwind UI as references for PATTERN (a11y
semantics, variant inventory, visual look). You MUST NOT paste literal source from ANY of them
(no react-aria / ant-design / Tailwind-UI code or class strings) — the output is always original
generation. (The one bright line, `02-licensing.md`.)

Mirror `button.jte`'s house conventions exactly: header doc-comment citing this spec + WAI-ARIA APG
source, typed `@param`, `data-slot`, the two escaping channels (`attrs` trusted-raw vs `dataAttrs` /
`data-value` escaped), zero `<script>`, zero inline `on*=`.

The roving-tabindex enhancer (`radio-group.enhancer.ts`) is a plain typed-TS module (~50 lines),
CSP-clean, registered via the runtime's directive registry (NOT the `collection-nav` enhancer — see
non-goals). Keep it minimal: only the five responsibilities listed in §6.

Build the native variant (`nativeInputs=true`) first: it is the simplest path (no enhancer, platform
keyboard, real semantic elements). Use it to validate the render gate, axe assertions, and the
`data-slot` conventions. Then build the custom variant + enhancer against the keyboard tests.

Validate that `data-value` on each option is always escaped via `Escape.htmlAttribute` — the id is
potentially DB-derived and must never be set via the `attrs` (trusted-raw) channel. The XSS test
(`hostile_option_id_in_data_value_renders_inert`) is not optional.

Minimal code to GREEN against the acceptance tests; refactor only while green. The keyboard map is
the contract — assert ALL rows of the §4 table, not a subset.
