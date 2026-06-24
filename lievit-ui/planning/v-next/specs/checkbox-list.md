<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — checkbox-list

- **tier**: PARTIAL + ENH (`checkbox-list.enhancer.ts` — owns the select-all tri-state logic + indeterminate DOM sync)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of existing `registry/jte/checkbox-list.jte` + existing `checkbox-list` enhancer)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Checkbox Group (BUILT against raw APG + mixed-state example
      https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/ —
      no react-aria reference because RA does not expose a distinct CheckboxGroup-with-select-all
      interaction model; the pattern is built directly from the APG `role="group"` +
      `aria-checked="mixed"` specification)
    - inventory: Ant Design Checkbox.Group + Checkbox (indeterminate / select-all) as inventory
      reference (select-all row, disabled options, column/row layout, check-on-label-click)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

---

## 1. What it is

A labelled group of checkboxes — optionally with a "select all" control — that manages a
multi-valued boolean selection. The CHECK STATE of every checkbox is a server fact carried via
`@param` (server-rendered HTML `checked` attributes), so this is a **PARTIAL**: the server
renders the full group markup including the correct `checked` / `indeterminate` state of the
select-all row, and the client morphs on a wire round-trip when the consuming WIRE template
fires an action via `l:change` or `l:click`.

The ONE irreducible client behavior is the **select-all tri-state DOM sync**: when the user
clicks the select-all `<input type="checkbox">`, the enhancer must (a) immediately set the
`indeterminate` property on the select-all input (a JS-only DOM property, not an HTML
attribute, so the server cannot author it), and (b) fire a wire action so the server re-renders
all child checkboxes to match. The enhancer also handles the reverse: when child checkboxes
are toggled, it recomputes the select-all state from the child checked-count and sets the DOM
`indeterminate` property before the wire round-trip returns. This is the ONLY client logic;
everything else (which options are checked, the final state, validation) is server-owned.

Server-first works cleanly for this component: the initial render is pure HTML (`checked`
attribute on the `<input>` elements), and the indeterminate property is restored by the enhancer
on every morph via the lifecycle `onComponentInit` hook. There is no client-side selection
state to reconcile — the server is the only source of truth.

---

## 2. API — params (the typed PARTIAL surface)

The template is a PARTIAL (not WIRE), so the API is the `@param` surface. The consuming WIRE
component passes typed model data via its controller; nothing is hardcoded inside the partial.

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | — | The `name` attribute on every child `<input type="checkbox">` (forms the field key in POST body). **Required.** |
| `options` | `List<CheckboxOption>` | — | The ordered list of checkbox items to render. `CheckboxOption` carries `id`, `label`, `checked`, `disabled`, and an optional `description`. **Required.** |
| `label` | `String` | `null` | The group label rendered as a `<legend>` inside the `<fieldset>` (or as a `<span>` with `id` when `inline=true`). Null → no visible label (the group still needs `aria-label` via `attrs`). |
| `showSelectAll` | `boolean` | `false` | Renders the select-all tri-state control above the option list. When true, the partial computes the initial `selectAllState` from `options`. |
| `selectAllLabel` | `String` | `"Select all"` | Visible label for the select-all control. Rendered as the `<label>` text adjacent to the select-all `<input>`. |
| `layout` | `String` | `"vertical"` | `vertical` (one per row) \| `horizontal` (flex-wrap row) \| `grid` (responsive CSS grid, column-count from `columns`). |
| `columns` | `int` | `2` | Column count for `layout="grid"`. Ignored for other layouts. |
| `size` | `String` | `"md"` | `sm \| md \| lg` — scales the checkbox hit-area and label text size. |
| `disabled` | `boolean` | `false` | Disables ALL inputs in the group (individual `CheckboxOption.disabled` remains respected per-item). |
| `required` | `boolean` | `false` | Adds `aria-required="true"` to the `<fieldset>` and a required marker on the label. Does NOT add the `required` attribute to individual inputs (group-required is not expressible via the native attribute on checkboxes). |
| `errorId` | `String` | `null` | When non-null: an `aria-describedby` pointing to this id is added to the `<fieldset>` (the containing `field` partial renders the error message element at that id). |
| `hintId` | `String` | `null` | Same as `errorId` but for a hint/help-text region. Both `errorId` and `hintId` are joined into a single `aria-describedby` value when both are present. |
| `invalid` | `boolean` | `false` | Adds `aria-invalid="true"` to the `<fieldset>` and recolours the group border to `--lv-color-destructive`. |
| `groupId` | `String` | `null` | An explicit `id` for the `<fieldset>` (or the `role="group"` `<div>`). Auto-derived from `name` if null. Used by the enhancer's data hooks. |
| `cssClass` | `String` | `""` | Extra utility classes applied to the outer `<fieldset>` / group wrapper. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (wire directives on the group root, `form="..."` association, `data-*` for the consuming WIRE template). NOT fed user-derived data. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** — dynamic `data-*` values (each through `Escape.htmlAttribute`). |
| `wireChange` | `String` | `null` | **SAFE** wire action name → emitted as `l:change="${wireChange}"` on each child `<input>`. The consuming WIRE template wires its toggle action here. |
| `wireSelectAll` | `String` | `null` | **SAFE** wire action name → emitted as `l:click="${wireSelectAll}"` on the select-all `<input>`. The consuming WIRE template wires its select-all toggle action here. |
| `wireArgs` | `Map<String,String>` | `{}` | **SAFE** per-option args merged into the escaped `data-*` fragment on each `<input>` (e.g. `{groupKey: "permissions"}`). |

**`CheckboxOption` record** (passed by the consuming controller, typed Java/JTE):

| field | type | meaning |
|---|---|---|
| `id` | `String` | The `value` attribute on the `<input>`. Also used as the `for`/`id` linkage between `<input>` and `<label>`. |
| `label` | `String` | Visible option label text. |
| `checked` | `boolean` | Whether this option is currently selected (the server-owned state). |
| `disabled` | `boolean` | Whether this individual option is non-interactive (additive with group-level `disabled`). |
| `description` | `String` | Optional secondary description line below the label (hint text per-option, not the group hint). |

---

## 3. Variants / sizes / states

### Variants
There is no `variant` param: the checkbox-list is a form control, not an action control, so
the intent vocabulary (`primary | destructive | ghost | ...`) does not apply. The visual
intent is expressed entirely through state (invalid → destructive border+ring; disabled →
muted; checked → primary accent tick). This matches the `checkbox` PARTIAL and the `radio-group`
PARTIAL: form controls share the implicit "default" intent.

### Sizes
`size` scales the checkbox hit-area and label text together (toolbar-alignment is not the primary
concern for a list, but the same scale tokens apply for consistency):

| size | checkbox hit-area | label text | spacing between items |
|---|---|---|---|
| `sm` | `--lv-space-4` (16 px) | `--lv-text-sm` | `--lv-space-2` |
| `md` (default) | `--lv-space-5` (20 px) | `--lv-text-base` | `--lv-space-3` |
| `lg` | `--lv-space-6` (24 px) | `--lv-text-base` (label stays base; extra hit-area) | `--lv-space-4` |

### Layout variants
- `vertical` (default): each option on its own row; full-width group.
- `horizontal`: options in a `flex-wrap` row; useful for short labels / small sets.
- `grid`: responsive CSS grid with `columns` columns; adapts at `--lv-breakpoint-sm`.

### States

**Group-level:**
- `disabled` (group): all inputs get `disabled` native attribute; labels use `--lv-color-muted-fg`;
  group border dims to `--lv-color-muted`.
- `invalid`: `aria-invalid="true"` on the `<fieldset>`; group border + focus ring recolour to
  `--lv-color-destructive`; the error region (at `errorId`) is linked via `aria-describedby`.
- `required`: `aria-required="true"` on the `<fieldset>`; the visible label gets a required marker
  (a `*` styled with `--lv-color-destructive`, `aria-hidden="true"`).

**Per-option:**
- `checked`: native `checked` attribute on `<input>`; the tick is `--lv-color-primary` fill.
- `disabled` (per-option): native `disabled`; label dims to `--lv-color-muted-fg`.
- `:focus-visible` on `<input>`: the standard `--lv-ring` focus ring (shared with every
  interactive control).
- `:hover` (enabled): subtle `--lv-color-accent` background on the label row.

**Select-all control:**
- `checked` (all children checked): `aria-checked="true"`; `indeterminate` DOM property = false.
- `mixed` (some children checked): `aria-checked="mixed"`; `indeterminate` DOM property = true
  (set by the enhancer — this is the irreducible client bit; the HTML attribute alone cannot
  express indeterminate).
- `unchecked` (no children checked): `aria-checked="false"`; `indeterminate` DOM property = false.

**During a wire round-trip:**
- `aria-busy="true"` is set on the group wrapper by the runtime `beforeCall` / `afterCall` hook;
  the component does nothing special — the runtime manages it.

### Slots
This is a PARTIAL; it does NOT use the `gg.jte.Content` slot mechanism for the option list (the
options arrive via `@param List<CheckboxOption>`, not as a content slot, because the partial needs
to iterate them to compute the select-all state). An optional `header` Content slot is provided
for a prefix region above the group label (e.g. a badge or an icon):

| slot | type | meaning |
|---|---|---|
| `header` | `gg.jte.Content` | Optional region above the group label / `<legend>`. Not used in most cases. Null-safe. |

---

## 4. The a11y contract

- **WAI-ARIA pattern**: APG Checkbox Group (BUILT — the pattern is the "Two-State Checkbox" +
  "Mixed-State Checkbox" examples from the APG Checkbox pattern page).
  Authoritative source: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
  Mixed-state example: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/

### Roles + ARIA

**Group wrapper (`<fieldset>`):**
- `<fieldset>` with `<legend>` is the preferred markup: it provides a native `role="group"`
  (implicit), accessible name from the `<legend>` content, and correct grouping without a
  redundant `aria-labelledby`. No explicit `role="group"` attribute is needed on a `<fieldset>`.
- When the group label is null (consumer provides none), the `<fieldset>` must receive an
  `aria-label` via the `attrs` trusted-raw channel; without either a `<legend>` or an
  `aria-label`, the group has no accessible name and fails axe `aria-required-attr`.
- `aria-describedby`: space-joined `errorId` + `hintId` when non-null.
- `aria-invalid="true"` when `invalid`.
- `aria-required="true"` when `required`.
- `aria-busy` is runtime-managed, not templated.
- `data-slot="checkbox-list"` on the `<fieldset>` root.
- `data-size="${size}"`, `data-layout="${layout}"` for styling hooks and test targets.
- `data-lievit-enhancer="checkbox-list"` when `showSelectAll=true` (signals the enhancer to mount).

**Select-all control (`<div data-slot="select-all">`, when `showSelectAll=true`):**
- Rendered ABOVE the `<fieldset>`'s option list, inside the `<fieldset>` but before the item rows,
  so it is in the natural reading + tab order first.
- `<input type="checkbox" id="<groupId>-select-all" aria-controls="<space-joined child input ids>"
  aria-checked="<true|false|mixed>" tabindex="0">`.
- The `aria-checked` attribute is server-rendered from the computed initial state:
  all-checked → `"true"`, none-checked → `"false"`, mixed → `"mixed"`.
- The `indeterminate` DOM property is a JS-only property (not an HTML attribute): the enhancer
  sets it on mount and on every child toggle event before the wire round-trip returns.
- `<label for="<groupId>-select-all">` with `selectAllLabel` text.
- `aria-controls` references the `id` of each child `<input>` (space-separated list), establishing
  the programmatic relationship between the tri-state control and its controlled checkboxes. This
  is the APG-specified wiring for a mixed-state checkbox controlling a group.

**Per-option rows:**
- Each row is a `<div role="presentation">` wrapper (layout only, no semantics).
- `<input type="checkbox" id="<groupId>-<option.id>" name="${name}" value="${option.id}"
  ${option.checked ? "checked" : ""} ${(option.disabled || disabled) ? "disabled" : ""}>`
- `<label for="<groupId>-<option.id>">` with `option.label` text.
- When `option.description` is set: a `<span id="<groupId>-<option.id>-desc" class="...">` with
  the description text, and `aria-describedby="<groupId>-<option.id>-desc"` on the `<input>`.
- `l:change="${wireChange}"` on each `<input>` when `wireChange` is non-null (the consuming WIRE
  template's toggle action).
- `data-id="${Escape.htmlAttribute(option.id)}"` on each `<input>` — the SAFE escaped per-option
  value the wire action reads from `dataset.id`.

### Keyboard interaction map

The WAI-ARIA APG Checkbox pattern specifies a minimal keyboard model: every checkbox is a
standalone tab stop, and Space toggles it. The checkboxes are NOT a roving-tabindex collection
(unlike radio groups); each `<input type="checkbox">` is independently tabbable by default, and
the native element supplies the keyboard interaction.

| key | action | who |
|---|---|---|
| `Tab` / `Shift+Tab` | Move focus to the next / previous focusable element (each checkbox is a tab stop; the select-all control is the first tab stop in the group when present) | Platform (native `<input type="checkbox">`) |
| `Space` | Toggle the focused checkbox between checked and unchecked; for the select-all control: cycles unchecked → checked → mixed OR unchecked → checked depending on prior state (see note below) | Platform for the toggle event; enhancer intercepts to sync `indeterminate` + fire `wireSelectAll` |
| `Enter` | No effect on checkboxes (checkboxes do not activate on Enter — APG specified, platform behaviour) | Platform (no action) |

**Select-all Space-bar note**: The APG mixed-state example specifies that pressing Space on the
tri-state select-all checkbox cycles through states. Lievit's model: the server owns the state,
so the enhancer fires the `wireSelectAll` wire action on the `change` event; the server computes
the next state (toggle all on/off) and re-renders. The enhancer immediately sets `indeterminate`
to the optimistic value before the round-trip returns (so the UI doesn't flicker). The server is
the source of truth; the client only fast-tracks the DOM property.

### Focus management

- **No focus trap**: the checkbox-list is a form control group, not a modal overlay. Tab moves
  in and out of the group naturally.
- **No roving tabindex**: unlike a radio group, each checkbox is its own tab stop. The platform
  supplies this without any enhancer involvement.
- **Focus preservation through morph**: the lievit bespoke morph (ADR-0019) is identity-preserving —
  focus on a specific `<input>` survives the DOM patch after a wire round-trip, because the morph
  matches by node identity. No special focus-restore logic is needed in the enhancer.
- **Initial focus**: no special initial-focus directive (the component is not an overlay and does
  not capture focus on mount).
- **Shared mechanisms composed**: NONE of the three shared mechanisms (popover seam, `focus-trap`,
  `collection-nav`) are used. The checkbox-list is a form control group, not an overlay or a
  roving collection. The platform supplies all the keyboard and focus behaviour; the enhancer adds
  only the JS-only `indeterminate` property sync.

### Screen-reader expectations

- The `<fieldset>` + `<legend>` grouping causes screen readers to announce the group name when
  focus enters the group (e.g. "Permissions group").
- Each `<input type="checkbox">` announces its label, its checked state ("checked" / "unchecked"),
  and any `aria-describedby` description.
- The select-all control, when present, announces: `"<selectAllLabel>, checkbox, mixed"` (or
  checked/unchecked). The `aria-controls` list is announced by some screen readers as additional
  information ("controls N items").
- When `invalid=true`: the error message at `errorId` is announced as a description on the
  `<fieldset>` (via `aria-describedby`). Note: `aria-invalid` on a `<fieldset>` is not universally
  exposed by all SRs — the visible error text at `errorId` is the primary communication channel;
  `aria-invalid` is a progressive enhancement.

### Live regions
None. The checkbox-list does not announce selection changes as live-region announcements. If the
consuming page needs to announce a bulk-select count ("12 items selected"), that is a responsibility
of the consuming WIRE template, which may compose the shared announcer — it is NOT this component's
concern.

---

## 5. Tokens

The checkbox-list reads the following `--lv-*` tokens:

**Colour (OKLCH source-of-truth format, `00` §4):**
| token | role |
|---|---|
| `--lv-color-primary` | checked-state fill on the checkbox tick/background |
| `--lv-color-primary-fg` | tick mark colour inside a checked checkbox |
| `--lv-color-border` | unchecked checkbox border |
| `--lv-color-bg` | checkbox background (unchecked) |
| `--lv-color-fg` | option label text |
| `--lv-color-muted-fg` | disabled label text; description/hint text |
| `--lv-color-muted` | disabled checkbox border |
| `--lv-color-destructive` | invalid border, required marker, invalid ring |
| `--lv-color-accent` | hover background on an option row (subtle tint) |

**Focus:**
| token | role |
|---|---|
| `--lv-ring` | focus-visible ring on each `<input>` (the shared ring token, consistent with every interactive control) |

**Spacing:**
| token | role |
|---|---|
| `--lv-space-2` | gap between items (sm) |
| `--lv-space-3` | gap between items (md, default) |
| `--lv-space-4` | gap between items (lg); also checkbox hit-area (sm) |
| `--lv-space-5` | checkbox hit-area (md, default) |
| `--lv-space-6` | checkbox hit-area (lg) |
| `--lv-space-1` | internal padding within an option row (checkbox-to-label gap) |
| `--lv-space-4` | group border padding (fieldset inner padding) |

**Typography:**
| token | role |
|---|---|
| `--lv-text-sm` | option label text (sm size) |
| `--lv-text-base` | option label text (md + lg sizes) |
| `--lv-text-xs` | per-option description text |
| `--lv-font-sans` | font family |

**Radius + border:**
| token | role |
|---|---|
| `--lv-radius-sm` | checkbox corner radius |
| `--lv-radius-md` | group wrapper border radius (when the fieldset shows a card-like border) |

**NET-NEW tokens**: none. The checkbox-list is a form control group that reuses the existing
token vocabulary. The `--lv-ring` token, `--lv-color-primary`, and `--lv-color-destructive` are
already present in the v2 token set and cover all states. No new colour or structural token is
needed; the Tailwind-UI-grade upgrade is achieved through the markup structure and token composition,
not new tokens.

---

## 6. Wire / island integration

### Server-rendered JTE structure

The template renders a `<fieldset>` with a `<legend>` (group label), an optional select-all row,
and one option row per `CheckboxOption`. Idiomatic element structure:

```
<fieldset data-slot="checkbox-list" data-size="${size}" data-layout="${layout}"
          [aria-describedby="errorId[ hintId]"] [aria-invalid="true"] [aria-required="true"]
          [data-lievit-enhancer="checkbox-list"]
          [${attrs}$unsafe]>

  <legend>                          ← group accessible name
    [${header content}]             ← optional header slot
    ${label}
    [<span aria-hidden="true">*</span>]   ← required marker when required=true
  </legend>

  <!-- select-all row (when showSelectAll=true) -->
  <div data-slot="select-all-row">
    <input type="checkbox"
           id="${groupId}-select-all"
           aria-controls="${space-joined child ids}"
           aria-checked="${selectAllState}"   ← "true"|"false"|"mixed", server-computed
           tabindex="0"
           [l:click="${wireSelectAll}"]
           [${dataAttrs escaped}]>
    <label for="${groupId}-select-all">${selectAllLabel}</label>
  </div>

  <!-- option rows -->
  <div data-slot="options" role="presentation">
    @for(CheckboxOption opt : options)
      <div data-slot="option" role="presentation" data-id="${Escape.htmlAttribute(opt.id)}">
        <input type="checkbox"
               id="${groupId}-${Escape.htmlAttribute(opt.id)}"
               name="${name}"
               value="${Escape.htmlAttribute(opt.id)}"
               ${opt.checked ? "checked" : ""}
               ${(opt.disabled || disabled) ? "disabled" : ""}
               [aria-describedby="${groupId}-${opt.id}-desc"]  ← only when opt.description set
               [l:change="${wireChange}"]
               data-id="${Escape.htmlAttribute(opt.id)}"
               [${wireArgs escaped}]>
        <label for="${groupId}-${Escape.htmlAttribute(opt.id)}">${opt.label}</label>
        @if(opt.description != null)
          <span id="${groupId}-${Escape.htmlAttribute(opt.id)}-desc" ...>${opt.description}</span>
        @endif
      </div>
    @endfor
  </div>

</fieldset>
```

**The two escaping channels** (the XSS decision rule):
- `attrs`: TRUSTED raw (`$unsafe`) — static, author-typed strings only (e.g. `l:submit`,
  `form="my-form"`, `data-testid="perms-list"`). Never fed `opt.id` or any DB-derived value.
- `option.id`, `option.label`, `name`, `wireChange`, `wireSelectAll`, `groupId` → all through
  `Escape.htmlAttribute()` before emission as attribute values (or via JTE's built-in escaping
  for text content). The `data-id` attribute on each `<input>` is the SAFE per-option channel
  the wire action reads via `dataset.id`.

### Enhancer responsibilities (`checkbox-list.enhancer.ts`)

The enhancer is mounted ONLY when `showSelectAll=true` (signalled by
`data-lievit-enhancer="checkbox-list"` on the `<fieldset>`). When `showSelectAll=false`, the
component is a pure PARTIAL — zero client JS involved.

The enhancer is a typed-TS module, CSP-clean (no eval, no inline handlers), registered via the
lievit directive/lifecycle registry (ADR-0019). It does NOT fire wire actions autonomously; it
only fires the wire action wired by the consuming template (`wireSelectAll` / `wireChange`).

**On mount (`onComponentInit` lifecycle hook):**
1. Find the select-all `<input>` by `[data-slot="select-all-row"] input[type=checkbox]`.
2. Read its `aria-checked` attribute (set by the server to `"true"`, `"false"`, or `"mixed"`).
3. Set the DOM `indeterminate` property: `input.indeterminate = (ariaChecked === "mixed")`.
4. Attach a `change` listener on each child checkbox `<input>` to recompute the select-all
   state client-side before the wire round-trip returns (optimistic UI).

**On child checkbox `change` event (before the wire re-render):**
1. Count total child checkboxes and currently-checked count (read from `.checked` DOM property).
2. Determine optimistic tri-state:
   - all checked → set `selectAll.checked = true`, `selectAll.indeterminate = false`,
     `selectAll.setAttribute("aria-checked", "true")`.
   - none checked → `checked = false`, `indeterminate = false`, `aria-checked = "false"`.
   - mixed → `checked = false`, `indeterminate = true`, `aria-checked = "mixed"`.
3. The wire `l:change` on the child `<input>` fires the `wireChange` action (server re-renders
   the full group); the enhancer's optimistic update makes the select-all row respond without
   waiting for the round-trip.

**On select-all `change` event:**
1. Set `indeterminate = false` on the select-all input immediately (the browser may toggle it
   to checked; the enhancer syncs the DOM property).
2. The wire `l:click` on the select-all input fires the `wireSelectAll` action.
3. After the morph (the `onComponentInit` hook re-runs on every morph), re-sync `indeterminate`
   from the server-authoritative `aria-checked`.

**After every morph (the `onComponentInit` hook re-runs — this is the idempotency guarantee):**
- Re-read `aria-checked` from the server-rendered select-all input.
- Re-set `indeterminate` accordingly.
- Re-attach the `change` listeners (the morph may have replaced the child input nodes).

**What the enhancer does NOT do:**
- It does not maintain a client-side selection list.
- It does not filter or sort options.
- It does not fire wire actions on its own initiative (only in response to user gestures that are
  already wired via `wireChange` / `wireSelectAll`).
- It does not implement keyboard navigation beyond what the platform native `<input>` supplies.

---

## 7. Acceptance tests

The component is DONE only when ALL pass on a REAL substrate (no mocked `$lievit`, no mocked
change events — the client-island-fidelity lesson from the CLAUDE.md).

### Render tests (jsdom, real JTE compile + render)

- **`renders-fieldset-with-legend`**: a `CheckboxOption` list rendered via `checkbox-list.jte`
  produces a `<fieldset>` root with `data-slot="checkbox-list"`, a `<legend>` containing
  `label`, and one `<input type="checkbox">` + `<label>` pair per option.
- **`checked-options-have-checked-attribute`**: options whose `checked=true` render with the
  `checked` HTML attribute present on their `<input>`; unchecked options do not.
- **`disabled-group-disables-all-inputs`**: `disabled=true` renders all `<input>` elements with
  the native `disabled` attribute.
- **`per-option-disabled-is-respected`**: a single `CheckboxOption` with `disabled=true` renders
  that `<input>` disabled while others remain enabled.
- **`invalid-state-aria`**: `invalid=true` renders `aria-invalid="true"` on the `<fieldset>`;
  `errorId="err-1"` renders `aria-describedby` containing `"err-1"`.
- **`required-adds-aria-required`**: `required=true` renders `aria-required="true"` on the
  `<fieldset>` and the visible required marker in the `<legend>`.
- **`no-label-requires-attrs-aria-label`**: rendering with `label=null` and no `attrs` containing
  `aria-label` FAILS the axe `aria-required-attr` rule (this is an intentional negative test
  documenting the contract: the consuming template is responsible for providing the accessible
  name via `attrs`).
- **`layout-variants-render-data-layout`**: each of `vertical`, `horizontal`, `grid` renders
  `data-layout` attribute set correctly on the root.
- **`size-variants-render-data-size`**: each of `sm`, `md`, `lg` renders `data-size` correctly.
- **`option-description-links-aria-describedby`**: an option with a `description` renders the
  description `<span>` with its `id` and the `<input>` with `aria-describedby` pointing to it.

### Select-all render tests (jsdom)

- **`no-select-all-row-when-disabled`**: `showSelectAll=false` (default) renders NO element with
  `data-slot="select-all-row"`.
- **`select-all-renders-with-aria-checked-true`**: all options `checked=true` → select-all input
  renders `aria-checked="true"`.
- **`select-all-renders-with-aria-checked-false`**: all options `checked=false` → `aria-checked=
  "false"`.
- **`select-all-renders-with-aria-checked-mixed`**: some options `checked=true`, some `false` →
  `aria-checked="mixed"`.
- **`select-all-has-aria-controls-all-child-ids`**: `aria-controls` on the select-all input
  contains the ids of every child `<input>` as a space-separated list.

### Axe-core a11y tests (real render, zero violations)

- **`axe-zero-violations-basic`**: a standard `checkbox-list` with a label and 3 options (one
  checked, one disabled) passes `axe.run()` with zero violations. Rules verified: `label`,
  `checkboxgroup`, `aria-required-attr`, `aria-valid-attr-value`, `color-contrast` (with default
  tokens).
- **`axe-zero-violations-with-select-all`**: with `showSelectAll=true` and mixed state, zero axe
  violations. Verifies the `aria-controls` referencing valid child ids is accepted by axe.
- **`axe-zero-violations-invalid-state`**: `invalid=true` + `errorId` set — zero violations.
- **`axe-name-from-legend`**: the `<fieldset>`'s accessible name is derived from the `<legend>`
  content (asserted via the accessible-name computation, not just the DOM attribute).

### Enhancer tests (real `LievitRuntime` mounted in jsdom — NOT a mocked `$lievit`)

- **`enhancer-sets-indeterminate-on-mount-mixed`**: with `aria-checked="mixed"` on the select-all
  input, after enhancer mount, `selectAllInput.indeterminate === true`.
- **`enhancer-sets-indeterminate-false-on-mount-checked`**: with `aria-checked="true"`, after
  mount, `indeterminate === false` and `checked === true`.
- **`enhancer-sets-indeterminate-false-on-mount-unchecked`**: with `aria-checked="false"`, after
  mount, `indeterminate === false` and `checked === false`.
- **`enhancer-recomputes-select-all-optimistic-to-mixed`**: starting with all checked, simulate a
  `change` event on one child checkbox (uncheck it); before the wire round-trip returns, assert
  that `selectAllInput.indeterminate === true` and `aria-checked === "mixed"`.
- **`enhancer-recomputes-select-all-optimistic-to-unchecked`**: uncheck all children one by one;
  after the last change event, `indeterminate === false`, `selectAllInput.checked === false`,
  `aria-checked === "false"`.
- **`enhancer-recomputes-select-all-optimistic-to-checked`**: check all children; after the last
  event, `indeterminate === false`, `selectAllInput.checked === true`, `aria-checked === "true"`.
- **`enhancer-syncs-indeterminate-after-morph`**: simulate a morph (replace the DOM subtree with
  `aria-checked="mixed"` on the select-all input); the enhancer's `onComponentInit` re-run sets
  `indeterminate = true`.
- **`no-enhancer-mounted-when-no-select-all`**: when `showSelectAll=false`, the enhancer is NOT
  mounted (no `data-lievit-enhancer` attribute on the root); assert no listeners are attached
  and no JS error is thrown.

### Keyboard tests (real enhancer, keyboard events in jsdom)

- **`space-toggles-child-checkbox`**: focus a child `<input>`, dispatch `Space` keydown; assert
  the `change` event fires and the `wireChange` action is triggered (or if testing without a live
  wire: assert `input.checked` flipped). This is platform behavior — the assertion confirms the
  native element works within the rendered markup (no attributes accidentally blocking it).
- **`space-on-select-all-fires-wire-select-all-action`**: focus the select-all `<input>`, dispatch
  `Space`; assert the `wireSelectAll` wire action is invoked.
- **`tab-moves-focus-across-all-checkboxes`**: Tab from the first child `<input>` moves focus to
  the next `<input>` in DOM order; Shift+Tab reverses. All checkboxes are individually tabbable
  (no roving tabindex). Assert focus lands on the correct `<input>` after each Tab.
- **`enter-on-checkbox-has-no-effect`**: focus a child `<input>`, dispatch Enter keydown; assert
  no `change` event fires and `checked` did not change (platform: checkboxes ignore Enter).

### Wire-consuming integration test (lievit-kit IT, real runtime, CollapsibleComponentIT pattern)

This test requires a consuming WIRE component (e.g. a `PermissionsComponent` with `@Wire
Set<String> checkedIds` + `@LievitAction void toggle(String id)` + `@LievitAction void
selectAll()`). The test verifies the round-trip:

- **`wire-roundtrip-toggle-item`**: mount the consuming component → find a child checkbox →
  fire `l:change` → assert the server re-renders with the toggled option's `checked` attribute
  flipped and the select-all `aria-checked` updated to reflect the new state.
- **`wire-roundtrip-select-all`**: mount → click select-all input → fire `l:click=wireSelectAll`
  → assert all child inputs render with `checked` attribute present and `aria-checked="true"`.
- **`wire-roundtrip-deselect-all`**: from all-checked state → click select-all → assert all
  child inputs render without `checked` and `aria-checked="false"`.

### Escaping test (XSS abuse-case)

- **`hostile-option-id-renders-inert`**: an option with `id = '"><script>alert(1)</script>'`
  renders the `value` attribute and `data-id` attribute HTML-escaped (the hostile string appears
  as a literal text value, never breaks out of the attribute context). The `attrs` channel is
  documented trusted-only and is NOT fed option ids in this test.

### JTE compile test

- **`jte-compile-and-render-gate`**: covered by the existing `test/jte-compile` real-compiler +
  render gate; no additional test needed here.

---

## 8. Non-goals / anti-patterns

- **Not a data-fetching component.** The option list arrives via `@param List<CheckboxOption>` from
  the server-side controller. The partial does NOT fetch options asynchronously or via HTMX. If
  async option loading is needed, the consuming WIRE template swaps the checkbox-list fragment via
  an HTMX pattern — the checkbox-list partial is the fragment being swapped in, not the swapper.
- **Not a roving-tabindex collection.** Checkboxes are each their own tab stop. Do NOT apply the
  `collection-nav` enhancer to this component — the APG Checkbox pattern specifies independent tab
  stops, not roving. Only radio groups use roving tabindex among native form controls.
- **Not responsible for announcing selection counts.** The live-region announcer ("12 items selected")
  is the responsibility of the consuming WIRE template, not this component.
- **Not a tree-select or cascader.** Nested checkbox hierarchies (parent → child category →
  sub-item) belong to `cascader` or `tree-select`. This component is flat: one level of options,
  one select-all.
- **No client-side filter / search.** If the option list needs filtering, the consuming WIRE template
  adds a search `<input>` wired to a server action that re-renders the checkbox-list with the
  filtered `options` list. The checkbox-list partial does not filter client-side.
- **No `Content` slot for options.** Options are typed `CheckboxOption` records, not freeform markup
  slots. Custom option rendering (icon + label + badge) goes into `CheckboxOption.label` as safe
  server-rendered markup — the partial does not open a slot hole that could silently not fill (the
  projection-failure lesson).
- **No standalone tri-state checkbox.** The `aria-checked="mixed"` tri-state is ONLY valid in the
  select-all context (a control managing a group of two-state checkboxes, per APG). A standalone
  tri-state checkbox with three semantic values is a different pattern; it is not what this
  component provides, and `indeterminate` must never be set on a regular child checkbox.
- **No JS-only initialisation flow.** The rendered DOM is fully meaningful without JS (the `checked`
  attributes are correct, the group is grouped via `<fieldset>`, all options are interactive via
  native `<input>`). JS (the enhancer) adds only the `indeterminate` property — a progressive
  enhancement, not a dependency for basic function.
- **Do not inline `<script>` or `on*=` handlers.** The strict CSP refuses them. All interactivity
  goes through the lievit directive registry (`l:change`, `l:click`) and the typed-TS enhancer.

---

## Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH) tokens. You MAY read the WAI-ARIA APG Checkbox
pattern + mixed-state example (https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/ and
https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/) + Ant Design
Checkbox.Group feature set as references for PATTERN (a11y, inventory) and LOOK. You MUST NOT
paste literal source from ANY of them — the output is always original generation. (The one bright
line, `02-licensing.md`.)

Do NOT compose `collection-nav` (this is a checkbox group, not a roving collection — that is the
explicit anti-pattern for this component). Do NOT compose `focus-trap` (not a modal). The enhancer
you write is minimal: `indeterminate` DOM property sync on mount + optimistic recompute on child
change. That is the complete enhancer surface; resist scope creep.

Mirror `button.jte`'s house conventions exactly: header doc-comment with the credits line, typed
`@param`, `data-slot`, the two escaping channels (per-option `data-id` goes through
`Escape.htmlAttribute`, never through `attrs`), zero `<script>`, zero inline `on*=` handlers.

The `<fieldset>` + `<legend>` is the correct grouping markup — do NOT use a `<div role="group">`
unless you have a specific reason (a `<fieldset>` already carries the implicit group role and the
legend association; an explicit `role` attribute would be redundant and confusing). Document the
reason in the header comment if you ever deviate.

Validate that the `selectAllState` computation in the template is correct: iterate `options`,
count checked vs total, emit `"true"` / `"false"` / `"mixed"` — not a client-computed default.
The server owns the initial select-all state.

Minimal code to GREEN against the acceptance tests; refactor only while green. The keyboard map
is the contract (Space toggles, Tab moves, Enter is inert) — assert ALL of it, even the
platform-supplied parts, because the test documents the expected behavior regardless of who
supplies it.
