<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — button-group / toggle-buttons

- **tier**: PARTIAL (two sibling templates: `button-group.jte` + `toggle-buttons.jte`)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/button-group.jte` + `registry/jte/toggle-buttons.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Toolbar (https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) for the
      `button-group` layout surface; WAI-ARIA APG Radio Group
      (https://www.w3.org/WAI/ARIA/apg/patterns/radio/) + APG Button `aria-pressed` pattern
      (https://www.w3.org/WAI/ARIA/apg/patterns/button/) for `toggle-buttons`; platform-native
      elements (`<fieldset>`, `<input type=radio|checkbox>`) supply keyboard, focus, and selection
      semantics — no react-aria reference needed because the platform covers all of it
    - inventory: Ant Design Button Group + Segmented + Radio.Button as inventory reference (sizes,
      orientation, single/multiple selection, icon segments, disabled segments, invalid state)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO
      code copied)

---

## 1. What it is

Two PARTIAL templates that together cover the full "joined segmented control" surface:

**`button-group`** — a pure layout/styling wrapper that collapses inner border-radius and merges
adjacent borders on any children (buttons, inputs, selects, icon buttons).
It carries `role="group"` and an optional `aria-label` so assistive technology announces the set
as one labelled unit.
It holds NO selection state; the click wiring is the consuming WIRE template's concern.
Server-first works trivially: there is nothing interactive about a layout container.

**`toggle-buttons`** — a segmented form control (the "pill row" or "toolbar toggle row") where
one segment (single mode) or several segments (multiple mode) can be pressed.
It is a FORM control: the pressed state is server-owned and POSTs natively with zero JavaScript.
The trick: segments are native `<input type="radio">` (single) or `<input type="checkbox">`
(multiple) styled to look like joined buttons — the platform supplies selection semantics,
roving-arrow focus (for radio), Tab/Space (for checkbox), `aria-checked` state via `:checked`,
and form submission, all for free.
Server-first is the natural tier: the pressed state is a server fact (the controller renders
which value is selected); the platform handles every interaction without a byte of JS.

The two templates share the joined-border CSS and the size/orientation vocabulary; they are
separate files because they carry different HTML roots (`<div role=group>` vs `<fieldset>`)
and different param surfaces.

---

## 2. API — params

### 2.a `button-group.jte`

| param | type | default | meaning |
|---|---|---|---|
| content | `gg.jte.Content` | — | **REQUIRED.** The children to join (buttons, inputs, a select, a nested group). Rendered verbatim inside the wrapper. |
| orientation | `String` | `"horizontal"` | `"horizontal"` \| `"vertical"` — axis of the joined row. Controls flex direction + which radii/borders to collapse. |
| label | `String` | `null` | `aria-label` on the root `div`. Provide when the group purpose is not obvious from surrounding context. `null` → unlabelled group (role=group still present). |
| cssClass | `String` | `""` | Extra utility classes appended to the root element. |
| attrs | `String` | `""` | **TRUSTED raw** (`$unsafe`): STATIC author-typed strings only (e.g. `data-testid="toolbar"`). Never feed user/DB data here. |

### 2.b `toggle-buttons.jte`

| param | type | default | meaning |
|---|---|---|---|
| name | `String` | — | **REQUIRED.** The shared `name` attribute. In single mode the radio group submits the chosen value under this key; in multiple mode each checkbox submits its value under the repeated key. |
| options | `Map<String,String>` | `null` | Ordered `value → label` map for auto-generated segments. Takes precedence is superseded by `content` (see below). Null only when `content` is provided. |
| content | `gg.jte.Content` | `null` | Hand-authored segment markup slot. Wins over `options` when non-null. Use for custom icon+label segments or deeply composed segments not expressible as a plain string label. Each segment must be a `<div data-slot="toggle-button">` wrapper containing a sibling input + label pair (see §6). |
| multiple | `boolean` | `false` | `false` = radio segments (single selection); `true` = checkbox segments (multi-select). |
| value | `String` | `null` | The currently selected value in single (`radio`) mode. Compared against each option key; matching input renders with `checked`. Ignored when `multiple=true`. |
| values | `List<String>` | `null` | The currently selected values in multiple (`checkbox`) mode. Compared against each option key. Ignored when `multiple=false`. |
| label | `String` | `null` | Visible `<legend>` text for the fieldset. Provides the accessible group name via the native legend element. When null, `ariaLabel` must be set for accessibility. |
| ariaLabel | `String` | `null` | `aria-label` on the `<fieldset>` when no visible legend exists. One of `label` or `ariaLabel` is **required** for a valid accessible group name. |
| describedBy | `String` | `null` | `id` of an external hint or error element; emitted as `aria-describedby` on the `<fieldset>`. |
| size | `String` | `"md"` | `"sm"` \| `"md"` \| `"lg"` — segment HEIGHT, toolbar-aligned with button/input of the same size. |
| orientation | `String` | `"horizontal"` | `"horizontal"` \| `"vertical"` — axis of the segment row. |
| disabled | `boolean` | `false` | Disables the entire fieldset (`disabled` native attr + `data-disabled`). Each individual segment is then non-interactive. |
| required | `boolean` | `false` | Marks the group required (applied to radio inputs in single mode; ignored in multiple mode). |
| invalid | `boolean` | `false` | Sets `aria-invalid="true"` on the fieldset + `data-invalid`; applies a destructive border+ring to the whole group. |
| cssClass | `String` | `""` | Extra utility classes on the `<fieldset>` root. |

No `attrs` / `wireArgs` / `dataAttrs` escaping surface on `toggle-buttons`: it is a pure form
control; per-row dynamic wiring is not a use case (the consuming WIRE template wires `name`
statically; the values come from the server model).

---

## 3. Variants / sizes / states

### Variants

**`button-group`** has no `variant` param: it is variant-agnostic.
Each child button carries its own `variant`.
Useful combinations: all-primary (a split button), all-secondary (a content-toolbar row), mixed
(one primary "confirm" + one ghost "cancel" joined).

**`toggle-buttons`** has no free `variant` param: the segment appearance is FIXED by convention
(matches the `outline` + `accent-pressed` look of the `toggle` partial).
The visual language is: unselected = border + neutral bg, selected = primary fill + primary-fg
text.
This is intentional: a toggle-buttons control is always a form control, never a decorative
row; its visual must be consistent so users learn "selected = filled".

### Sizes (toolbar-aligned, both templates)

| size | height token | h-px | padding | text token |
|---|---|---|---|---|
| `sm` | `--lv-space-8` | 32 px | `px-[--lv-space-2]` | `--lv-text-xs` |
| `md` (default) | `--lv-space-9` | 36 px | `px-[--lv-space-3]` | `--lv-text-sm` |
| `lg` | `--lv-space-10` | 40 px | `px-[--lv-space-4]` | `--lv-text-base` |

A `toggle-buttons` and a `button` of the same `size` are pixel-height-aligned; they can sit in
the same toolbar row flush.

### States

**`button-group`** (layout only; children carry their own states):
- children's `disabled` state: each child manages its own `disabled` / `aria-disabled` independently.
- children's `focus-visible`: the wrapper applies `[&>*:focus-visible]:relative [&>*:focus-visible]:z-10` so the focus ring is never clipped by an adjacent border.

**`toggle-buttons`**:
- `disabled` (whole group): native `<fieldset disabled>` propagates to all child inputs; `disabled:` utilities dim segments; `peer-disabled:cursor-not-allowed peer-disabled:opacity-50` on labels.
- `disabled` (per-segment, via `content` slot): individual `<input disabled>` disables only that segment. Dimmed label, excluded from keyboard sequence.
- `invalid`: `aria-invalid="true"` on the fieldset; a destructive ring wraps the group container; segments get a `data-invalid`-driven red border tint.
- `:checked` (pressed/selected state): `peer-checked:` utilities on the sibling label flip the segment to primary fill + primary-fg text. The `:checked` state is the native form control's own; no JS sets it.
- `focus-visible`: `peer-focus-visible:z-10 peer-focus-visible:shadow-[--lv-ring]` on the label so the focus ring raises above the joined neighbours. Uses `--lv-ring`.
- `hover`: `hover:bg-[--lv-color-muted]` on unselected segments; pressed segments are already filled, hover leaves them unchanged.
- `required` (single mode): the radio inputs carry `required`; browser-native form validation fires if nothing is selected before submit.

### Slots (`button-group`)

| slot name | type | meaning |
|---|---|---|
| `content` | `gg.jte.Content` | The joined children. Render any combination of `@template.lievit.button`, `@template.lievit.input`, a `<button>`, etc. |

### Slots (`toggle-buttons` via `content`)

| slot name | usage |
|---|---|
| `content` | Hand-authored segments: each is a `<div data-slot="toggle-button">` containing a sibling `<input type="radio|checkbox">` + `<label>` pair. The label must reference the input's id. See §6. |

---

## 4. The a11y contract

### `button-group` a11y

**WAI-ARIA pattern**: APG Toolbar (https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) — the
`button-group` maps to the STRUCTURAL half of the toolbar pattern (`role="group"` with a label)
without imposing roving tabindex, because it wraps ARBITRARY controls (not a homogeneous set of
buttons). The toolbar roving-tabindex model would be over-engineering a layout wrapper; Tab
between children is correct and expected when the children are heterogeneous.

**Roles + ARIA**:
- Root: `<div role="group" aria-label="${label}">` when `label` is set; `<div role="group">` when
  unset (unlabelled group is valid; label is recommended when the group purpose is not obvious).
- Children carry their own roles (native `<button>`, `<input>`, `<a>`).
- No `aria-orientation` needed: this is a layout group, not a toolbar with roving focus.

**Keyboard map**:

| Key | Action | Who supplies it |
|---|---|---|
| Tab | Move focus to the next interactive child | Platform (each child is a tab stop) |
| Shift+Tab | Move focus to the previous interactive child | Platform |
| Enter / Space (on a child button) | Activate the button | Platform (native `<button>`) |
| Enter / Space (on a child link) | Follow the link | Platform (native `<a>`) |

No additional key handling is implemented. Disabled children are removed from the tab sequence by
the platform (native `disabled` attribute).

**Focus management**: platform. Each child is an independent tab stop. No roving tabindex, no
focus trap. Focus-visible ring of each child is raised above its neighbours via `z-10` so it is
never clipped by the collapsed border.

**Live region**: none.

**Shared mechanism composed**: none. This is the simplest tier: a layout primitive that delegates
all keyboard and focus behavior to its children.

---

### `toggle-buttons` a11y

**WAI-ARIA pattern**:
- Single mode (`multiple=false`): APG Radio Group
  (https://www.w3.org/WAI/ARIA/apg/patterns/radio/).
  The native `<fieldset>` with `<input type="radio">` elements IS the radiogroup pattern:
  `<fieldset>` carries the implicit `role="group"` semantics, the `<legend>` is the accessible
  name, each `<input type="radio">` carries `role="radio"` and `aria-checked` automatically via
  the `:checked` state.
  The platform supplies roving tabindex, single-selection, and all keyboard behavior.
- Multiple mode (`multiple=true`): APG Checkbox Group (no single APG pattern page; uses APG
  Checkbox semantics — https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/ — in a `<fieldset>`
  group).
  Each `<input type="checkbox">` carries `role="checkbox"` and `aria-checked` automatically.
  Each segment is an independent tab stop.

**Roles + ARIA** (emitted by the server-rendered template):

| Element | Role | State / property |
|---|---|---|
| `<fieldset>` | implicit `group` | `aria-label` (when no legend); `aria-describedby` (hint/error id); `aria-invalid="true"` (when invalid); `disabled` propagates to all children |
| `<legend>` | (labels the fieldset) | visible text; omitted when `label` param is null |
| `<input type="radio">` | `radio` | `aria-checked` is implicit from `:checked`; `disabled`; `required` (single mode) |
| `<input type="checkbox">` | `checkbox` | `aria-checked` is implicit from `:checked`; `disabled` |
| `<label>` | (labels its input) | `for` → input `id`; the visible segment text |
| inner `role="group"` div | group | structural sub-group for the joined-look row; no label (the fieldset legend labels the whole thing) |

`aria-invalid` on the fieldset propagates the error signal to the group; individual inputs also
carry `aria-invalid="true"` when the whole group is invalid (for per-input error association).

**Keyboard map** (the load-bearing table):

*Single mode (radio — the platform roving model):*

| Key | Action | Who supplies it |
|---|---|---|
| Tab | Move focus INTO the group: focuses the checked radio, or the first radio if none are checked | Platform |
| Shift+Tab | Move focus OUT OF the group | Platform |
| Right Arrow / Down Arrow | Move focus to the next radio segment; selects it; unchecks the previous; wraps from last to first | Platform (native radio roving) |
| Left Arrow / Up Arrow | Move focus to the previous radio segment; selects it; wraps from first to last | Platform (native radio roving) |
| Space | Checks the focused radio if unchecked (no-op if already checked) | Platform |

*Multiple mode (checkbox — independent tab stops):*

| Key | Action | Who supplies it |
|---|---|---|
| Tab | Move focus to the next checkbox segment (each is an independent tab stop) | Platform |
| Shift+Tab | Move focus to the previous checkbox segment | Platform |
| Space | Toggle the focused checkbox (check ↔ uncheck) | Platform |

No additional keyboard handling is implemented in either mode.
The platform gives everything for free because we use real native form inputs.

**Focus management**:
- Single mode: roving tabindex is built into `<input type="radio">` by all browsers. The group
  counts as ONE tab stop: Tab enters the checked option (or first if none checked); arrow keys
  move within; Tab exits.
- Multiple mode: each checkbox is an independent tab stop. No roving tabindex.
- Focus-visible ring: `peer-focus-visible:z-10 peer-focus-visible:shadow-[--lv-ring]` on the
  label raises the ring above adjacent borders. The ring never clips.
- Disabled segments: excluded from keyboard sequence by the native `disabled` attribute.

**Screen-reader expectations**:
- Single mode: AT announces the fieldset legend (or `aria-label`) as the group name, announces
  each radio as "Segmento X, radio button, N of M" and announces checked/unchecked state. On
  arrow key, it announces the newly selected option name and its group context.
- Multiple mode: AT announces the fieldset legend, each checkbox as "Segmento X, checkbox,
  checked/unchecked". Toggling announces "checked" or "unchecked".
- Invalid state: `aria-invalid="true"` on the fieldset; AT announces "invalid" or equivalent
  on the group. The `describedBy` param should point to an error message `<span>` for full
  error context.
- Disabled state: native `<fieldset disabled>` causes AT to announce the group as "dimmed" or
  "unavailable"; individual segments are skipped in navigation.

**Live region**: none (status/error announcements are handled by the `field` partial that wraps
this control and owns the `aria-live` error region — NOT this component's concern).

**Shared mechanisms composed**: none. Platform-supplied entirely. This is the canonical
demonstration of §2.a of the architecture contract: "prefer a real `<button>`/`<a>`/`<input>`
over a div-with-role; the platform gives keyboard + focus for free."

---

## 5. Tokens

### `button-group.jte` tokens

The `button-group` template itself reads NO `--lv-*` tokens: it is a pure flex layout with
border-collapse CSS applied to its children via descendant selectors.
Its children carry their own token consumption.

NET-NEW tokens: none.

### `toggle-buttons.jte` tokens

| token | usage |
|---|---|
| `--lv-color-input` | segment border (unselected state) |
| `--lv-color-bg` | segment background (unselected state) |
| `--lv-color-fg` | segment text (unselected state) |
| `--lv-color-muted` | segment background on hover (unselected) |
| `--lv-color-primary` | selected segment fill + selected segment border |
| `--lv-color-primary-fg` | selected segment text |
| `--lv-color-destructive` | invalid state border + ring tint |
| `--lv-color-ring` | focus-visible border highlight on the label |
| `--lv-ring` | focus-visible box-shadow (`shadow-[--lv-ring]`) |
| `--lv-radius-md` | corner radius on segment labels |
| `--lv-space-1` | icon-label gap within a segment |
| `--lv-space-2` | `sm` horizontal padding |
| `--lv-space-3` | `md` horizontal padding |
| `--lv-space-4` | `lg` horizontal padding |
| `--lv-space-8` | `sm` segment height (32 px) |
| `--lv-space-9` | `md` segment height (36 px, default) |
| `--lv-space-10` | `lg` segment height (40 px) |
| `--lv-text-xs` | `sm` text size |
| `--lv-text-sm` | `md` text size |
| `--lv-text-base` | `lg` text size |
| `--lv-font-sans` | segment font family (via inline `style` on fieldset) |
| `--lv-font-medium` | segment font weight |

NET-NEW tokens: none. All tokens are drawn from the existing v2 vocabulary.

---

## 6. Wire / island integration

### `button-group` — static, no enhancer

`button-group` is a PARTIAL with ZERO interactivity of its own.
Server renders:

```
<div
  role="group"
  aria-label="<label>"
  data-slot="button-group"
  data-orientation="<orientation>"
  class="inline-flex w-fit items-stretch <axis> <joinReset> <cssClass>"
>
  <!-- content slot: the children -->
</div>
```

The joined-border effect: computed in JTE via `!{var joinReset = ...}`:
- horizontal: `[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none`
- vertical: `[&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none`

Focus-ring guard: `[&>*:focus-visible]:relative [&>*:focus-visible]:z-10` on the wrapper raises
focused children's z-index so their focus ring is never obscured by a neighbour.

The consuming WIRE template wires actions on the children (e.g. `l:click="save"` on a button
inside the group); the group wrapper is transparent to the wire protocol.

No `data-lievit-*` attributes. No enhancer. No JS.

---

### `toggle-buttons` — static, no enhancer

`toggle-buttons` is a PARTIAL that renders native form inputs.
No JS, no wire, no enhancer. It POSTs natively.

**Server-rendered structure** (options mode, single):

```
<fieldset
  data-slot="toggle-buttons"
  data-orientation="<orientation>"
  aria-label="<ariaLabel>"          ← when no legend
  aria-describedby="<describedBy>"  ← when set
  aria-invalid="true"               ← when invalid
  data-invalid="true"               ← when invalid (CSS hook)
  data-disabled="true"              ← when disabled (CSS hook)
  disabled                          ← when disabled
  class="m-0 min-w-0 border-0 p-0 <cssClass>"
  style="font-family:var(--lv-font-sans);"
>
  <legend data-slot="toggle-buttons-label">Stato</legend>    ← when label set

  <div role="group" data-slot="toggle-buttons-group"
       class="inline-flex w-fit items-stretch <axis> <joinReset>">

    <!-- per option (generated from Map<String,String>): -->
    <div data-slot="toggle-button" class="contents">
      <input
        type="radio"                              ← "checkbox" in multiple mode
        data-slot="toggle-button-control"
        id="<name>-<value>"
        name="<name>"
        value="<value>"
        checked                                   ← when this option is selected
        disabled                                  ← when disabled
        required                                  ← when required + single mode
        aria-invalid="true"                       ← when group is invalid
        class="peer sr-only"
      >
      <label
        for="<name>-<value>"
        data-slot="toggle-button-label"
        class="<segLabelClass>"
      >Option Label</label>
    </div>

  </div>
</fieldset>
```

**`content` slot** (hand-authored segments): when `content` is non-null it is rendered verbatim
inside the inner `<div role="group">` instead of the generated options loop. Each segment must
follow the `<div data-slot="toggle-button"><input ...><label ...></label></div>` structure so
that the `peer-*` CSS utilities work and the a11y contract holds. The consuming template is
responsible for setting correct `type`, `id`, `name`, `value`, `checked`, `aria-invalid` on the
input and `for` on the label.

**How the form POST works**: on form submit, the browser includes:
- Single mode: one `name=value` pair for the checked radio.
- Multiple mode: one `name=value` pair for EACH checked checkbox (the repeated-key pattern;
  unchecked checkboxes are absent from the POST body, consistent with native checkbox behavior).
  Spring MVC binds repeated keys as `List<String>` automatically.

**No wire directives on `toggle-buttons` itself**. The surrounding `<form>` or the consuming
WIRE template owns the submit action (`l:submit` on the form, or a separate submit button wired
with `l:click`). `toggle-buttons` is the CONTROL; it does not carry the submit action.

**Consuming WIRE example** (how a WIRE template uses `toggle-buttons`):

```
@template.lievit.toggle-buttons(
  name = "stato",
  label = "Stato contatto",
  value = _instance.stato(),
  options = _instance.statoOptions(),
  size = "md"
)
```

The controller sets the `@Wire String stato` field; the template renders the matching radio
as `checked`; the user selects another segment and submits the surrounding form; the wire action
receives `stato` as a form-bound parameter.

---

## 7. Acceptance tests

All tests run on a REAL substrate — jsdom (PARTIAL render gate) or the real JTE compiler — never
a mocked partial. The substrate rule is mandatory after the client-island-fidelity lesson.

### `button-group.jte` tests

- **render (jsdom + JTE compiler)**: renders a `<div role="group">` root; `data-slot="button-group"`;
  `data-orientation="horizontal"` (default); `aria-label` attribute present and equal to the
  `label` param when set; absent when `label=null`.
- **vertical orientation**: `data-orientation="vertical"` present; the join-reset classes are the
  vertical variants (checking for `rounded-t-none` / `border-t-0`).
- **focus-ring guard**: the wrapper class list contains `[&>*:focus-visible]:relative` and
  `[&>*:focus-visible]:z-10`.
- **axe-core**: zero violations on the rendered DOM. An unlabelled group (no `aria-label`) is
  tested: axe must NOT fail on `role="group"` without a label (role=group does not mandate a
  label; role=region does — this is the intended distinction).
- **content projection**: children rendered as the `content` slot are present in the DOM inside
  the group div.
- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate.

### `toggle-buttons.jte` tests

- **render — single mode (jsdom + JTE compiler)**: renders a `<fieldset data-slot="toggle-buttons">`;
  `<legend>` present when `label` set; `<legend>` absent when `label=null`; `aria-label` set when
  `ariaLabel` provided; inner `<div role="group">` present; three `<input type="radio">` with
  matching `name`, `id="name-value"`, and correct `value`; the option matching `value` param has
  `checked`; others do not; each has a sibling `<label for="name-value">` with the option label text.
- **render — multiple mode**: `<input type="checkbox">` elements; options in `values` list have
  `checked`; others do not; no `required` attr (multiple mode ignores `required`).
- **selected-state correctness**: change `value` param, assert exactly one input is `checked` and
  its label renders with the primary-fill token classes (`peer-checked:bg-[--lv-color-primary]`
  in the label class string).
- **disabled (whole group)**: `<fieldset disabled>` present; `data-disabled="true"` present; no
  individual segment has `checked` changed (disabled is layout, not selection).
- **disabled (per-segment via content slot)**: a single `<input disabled>` inside the content slot
  renders disabled; other segments are unaffected.
- **invalid state**: `aria-invalid="true"` on the `<fieldset>`; `data-invalid="true"` present;
  each `<input>` has `aria-invalid="true"` (for per-input error association); the label class
  includes the destructive ring token.
- **required (single mode)**: `<input type="radio" required>` on radio inputs when `required=true`.
  NOT present in multiple mode.
- **aria-describedby**: `aria-describedby="hint-id"` on the fieldset when `describedBy="hint-id"`.
- **sizes**: each size value (sm/md/lg) emits the matching height/padding/text token class on the
  segment labels; assert the `h-[var(--lv-space-8|9|10)]` substring.
- **orientation**: vertical mode emits `flex-col` on the inner group and the vertical join-reset
  classes; horizontal (default) emits `flex-row` and horizontal join-reset.
- **content slot wins over options**: when both `content` and `options` are provided, the content
  slot markup is rendered and the options loop is NOT run.
- **axe-core — single mode**: zero violations on the rendered fieldset+radios DOM. Assert: the
  fieldset has an accessible name (via legend or aria-label); each radio has an accessible name
  (via for/label association); the radiogroup is correctly announced (axe `radiogroup` rule).
- **axe-core — multiple mode**: zero violations; each checkbox has an accessible name.
- **axe-core — invalid state**: `aria-invalid` placement is valid per axe rules.
- **keyboard — single mode (real browser or Playwright)**: Tab moves focus into the group onto
  the checked radio; ArrowRight moves to the next radio and auto-selects it (assert `:checked`
  on the new input); ArrowLeft moves back; ArrowRight from last wraps to first; Tab exits the
  group to the next form element.
- **keyboard — multiple mode (real browser or Playwright)**: Tab moves through each checkbox
  individually; Space toggles the focused checkbox (checked ↔ unchecked); Tab exits after last.
- **form POST fidelity (Playwright or real form submit)**: single mode — submit with second option
  selected → request body contains `name=value2` exactly once; multiple mode — submit with first
  and third selected → body contains `name=value1` and `name=value3` (repeated key), `value2`
  absent.
- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate.
- **escaping (XSS)**: option key containing `"><script>alert(1)</script>` is passed as a map
  entry; assert the rendered `id`, `value`, and `for` attributes contain the HTML-escaped string
  and no literal `<script>` tag appears in the output. (Values flow through JTE's automatic
  expression escaping, not a trusted `$unsafe` channel.)

---

## 8. Non-goals / anti-patterns

- **`button-group` is NOT a toolbar with roving tabindex.** Do not add roving tabindex to it.
  When you need a homogeneous keyboard-navigable toolbar (e.g. a rich-text formatting bar),
  compose `button-group` INSIDE a `role="toolbar"` WIRE component that owns the roving logic via
  `collection-nav.enhancer.ts`. `button-group` is the VISUAL primitive; the toolbar semantics +
  roving belong to the WIRE wrapper.
- **`toggle-buttons` is NOT a WIRE component.** Do not give it `@Wire` fields, `l:click`
  directives on the segments, or JS state. It is a native form control. If you need real-time
  UI updates on segment click (e.g. live preview of a filter), the consuming WIRE template adds
  `l:submit` on the surrounding form, or a separate submit button fires a wire action that
  re-renders the affected region. The segments themselves never carry wire directives.
- **Do not use `<div role="radio">` or `<div role="checkbox">`.** Real `<input type="radio">` and
  `<input type="checkbox">` give you role, state, keyboard, form submission, and browser-native
  validity for free. A div with a role is a worse version of the real thing, always.
- **Do not re-implement the roving tabindex for `toggle-buttons`.** In single mode the platform
  gives roving focus on `<input type="radio">` for free. Adding JS to manage `tabindex` is
  redundant and fragile.
- **Do not hardcode option labels or values inside the template.** Options come in via the `options`
  Map param (from the controller's typed model) or via the `content` slot. The "no data in a
  partial" rule (architecture contract §3, repo CLAUDE.md) is absolute.
- **`button-group` does not accept a `variant` param.** Each child button carries its own variant.
  A uniform variant is applied by setting the same `variant` param on each child button, not by
  a group-level override. This keeps the component variant-agnostic and composable.
- **Do not use `aria-label` AND `<legend>` simultaneously on `toggle-buttons`.** When a visible
  `<legend>` is present it IS the accessible name; an additional `aria-label` creates a naming
  conflict. Use `label` (visible legend) OR `ariaLabel` (screen-reader-only), never both.
- **Do not expose a `content` slot on `button-group` AND a per-child WIRE action channel.** The
  group is transparent to the wire protocol. The consuming WIRE template sets `l:click` on the
  individual buttons; the group does not participate. `attrs` on `button-group` is for static
  author-typed attributes only (e.g. `data-testid`), never for per-item dynamic data.
- **A `toggle-buttons` group that carries an icon segment must still have a text label or
  `ariaLabel` on the fieldset AND a text label in each segment's `<label>`.** Icon-only segments
  alone produce an inaccessible control (the label text IS the accessible name for each radio /
  checkbox). If segments must be icon-only in the visual, add visually-hidden text via `sr-only`
  inside the `<label>`.

---

## Agent instructions

Generate ORIGINAL code over `--lv-*` tokens.
You MAY read WAI-ARIA APG Toolbar + Radio Group + Button (toggle) pattern pages, Ant Design Button
Group + Segmented + Radio.Button feature sets, and Tailwind UI / shadcn toggle-group visual look
as REFERENCES for pattern and look.
You MUST NOT paste literal source from any of them (the one bright line, `02-licensing.md`) — the
output is always original generation.

**`button-group`**: Mirror `button.jte`'s house conventions exactly (header doc-comment with TIER /
STRUCTURE / A11y / Params / Usage sections, typed `@param` with defaults, `data-slot`, zero
`<script>`). The ONLY logic in the template is the `!{var ...}` switch on orientation for the axis
and join-reset class strings. Do not add any `l:*` directives or `data-lievit-*` attributes; the
group is invisible to the wire protocol.

**`toggle-buttons`**: The sr-only input + sibling label pattern (the `peer-*` CSS channel) is the
load-bearing mechanism — do not replace it with `aria-pressed` buttons or JS. Validate: (a) each
generated input's `id` is globally unique per page — use `name + "-" + key` as the ID; (b) the
`checked` boolean attribute is emitted only when the option is selected (JTE boolean attribute,
never `checked="false"`); (c) `aria-invalid` is on BOTH the fieldset AND each individual input
when `invalid=true` (the fieldset-level attribute covers the group announcement; the input-level
attribute covers per-input browser styling and axe rules). The `content` slot check (`@if(content
!= null)`) must come BEFORE the `options` loop so hand-authored segments win.

Minimal code to GREEN against the acceptance tests.
The keyboard map is supplied entirely by the platform — assert it, but implement nothing for it.
The projection assertion (§7 "render — single mode": the option matching `value` has `checked`;
others do not) is the load-bearing correctness test; it is not optional.
