<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — key-value-input (editable indexed key/value rows, PARTIAL + ENH)

- **tier**: PARTIAL + ENH (`key-value-input.enhancer.ts`, the JS-on progressive enhancement)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/key-value-input.jte` +
  `registry/jte/key-value-input.enhancer.ts`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG — no dedicated APG pattern for a dynamic row editor; BUILT against raw
      ARIA authoring practices: `aria-label` per input (column-header association for screen readers
      in a non-`<table>` layout), `aria-live="polite"` for add/remove announcements, real `<button>`
      elements for add + remove (the APG Button pattern, platform-supplied keyboard). React-Aria
      has no `useKeyValueInput`; the interaction is BUILT from first principles (native inputs +
      `<template>` clone + reindex).
    - inventory: Filament `KeyValue` field (the Filament PHP admin panel) as inventory reference for
      the UX pattern (column headers, add row, remove row, ordered, posting as indexed array). No
      Ant Design equivalent for this exact control (Ant Design's `Form.List` is a React hook, not a
      component). The closest visual and functional reference is Filament's implementation.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI form
      controls (NO code copied)

## 1. What it is

An EDITABLE, repeatable key/value form control: a vertical list of row pairs — each row has a key text
input and a value text input — with an Add button and per-row Remove buttons. The rows POST as an
indexed form array (`<name>[0][key]`, `<name>[0][value]`, `<name>[1][key]`, …) so a Java/Spring binder
(or any server) can reconstruct an ordered `Map<String,String>` or `List<Pair>` without any custom
parsing.

The component is the EDITABLE FORM counterpart to the read-only `key-value` / `data-list` display
primitive — do not confuse them. It is named `key-value-INPUT` to make that distinction explicit.

**Why PARTIAL + ENH (not WIRE)**: the VALUE is not a server-managed Wire state; it is a standard HTML
form submission. The rows are native `<input type=text>` elements; they POST on the enclosing `<form>`
submit with zero JavaScript. JS-OFF, Add and Remove are `type=submit` buttons with distinct `name`
attributes — the server round-trips to add/remove a row then re-renders. JS-ON, the enhancer upgrades
to in-place: it intercepts the Add/Remove clicks, clones the hidden `<template>` row (Add) or removes
the row element (Remove), then RE-INDEXES every surviving row so the POSTed `[i]` indices are always
contiguous (0..n-1). The native inputs remain the source of truth. This is the canonical PARTIAL +
progressive-enhancement pattern from ADR-0012: the value plumbing is the platform; the ergonomic
upgrade is the enhancer.

## 2. API — params (the JTE `@param` surface)

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | — (**required**) | Field name prefix. Rows post as `<name>[i][key]` / `<name>[i][value]`. Must be a safe HTML-attribute value (server-controlled static string, no DB-derived data). |
| `entries` | `java.util.Map<String,String>` | `null` | Initial rows, insertion-ordered (a `LinkedHashMap` preserves round-trip order). `null` or empty → zero rows on load. |
| `label` | `String` | `null` | Visible group label rendered above the column headers. `null` or blank → omitted. |
| `keyLabel` | `String` | `"Key"` | Column header text for the key column + the `aria-label` stem for every key input ("Key, row N"). |
| `valueLabel` | `String` | `"Value"` | Column header text for the value column + the `aria-label` stem for every value input ("Value, row N"). |
| `keyPlaceholder` | `String` | `null` | `placeholder` for key inputs. `null` → no placeholder attribute. |
| `valuePlaceholder` | `String` | `null` | `placeholder` for value inputs. `null` → no placeholder attribute. |
| `addLabel` | `String` | `"Add row"` | Visible text for the Add button. |
| `size` | `String` | `"md"` | Control height: `sm` \| `md` \| `lg` — toolbar-aligned (architecture contract §5.b). The same size governs inputs + buttons in every row. |
| `disabled` | `boolean` | `false` | Disables every input and button in the widget. Both the native `disabled` attribute (so the browser omits them from form submission when disabled) and the `disabled:` Tailwind utilities apply. |
| `maxRows` | `Integer` | `null` | When set, hides / disables the Add button once `entries.size() >= maxRows`. `null` = unlimited. |
| `cssClass` | `String` | `""` | Extra utility classes on the root wrapper. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`). STATIC author-typed strings only — e.g. `data-testid="meta-editor"`. NEVER feed a DB-derived or user-supplied value here. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** (`Escape.htmlAttribute` per value). Dynamic `data-*` attributes on the root. Use this — not `attrs` — for any value that comes from the database or request parameters. |

**The `name` escaping rule**: `name` is stamped into the `<template>` row as a literal string (the
`__i__` placeholder approach). It MUST be a server-controlled static string (a property key, a field
path). It is rendered into `data-name="${name}"` and the `<template>` HTML; if it contained
user-controlled data it would be an XSS vector. The template guarantees this by typing it as a plain
`String` from the Java model, not from a query parameter.

## 3. Variants / sizes / states

### Sizes (height-based, toolbar-aligned)
- `sm` → input + buttons at `--lv-space-8` (32 px). Smaller padding + `--lv-text-xs`.
- `md` → `--lv-space-9` (36 px, default). Padding + `--lv-text-sm`.
- `lg` → `--lv-space-10` (40 px). Larger padding + `--lv-text-base`.
All three sizes align flush with a `button` or `input` of the same size in a toolbar row.

### No "variant" param
The component has no `variant` param: it is a form control, not an action. Its visual distinction comes
from `disabled` state and `aria-invalid` on the field wrapper.

### States
- **default**: two-column grid of text inputs + a dashed "Add row" button.
- **disabled** (`disabled=true`): all inputs + buttons carry the native `disabled` attribute; the
  `disabled:cursor-not-allowed disabled:opacity-50` utilities communicate the state visually. The Add
  button and per-row Remove buttons are also disabled.
- **focus-visible** (per input / per button): `focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)]` — the shared `--lv-ring` focus treatment, identical to every other interactive control.
- **`aria-invalid`** on the group wrapper: recolours the bottom border/hint to `--lv-color-destructive`
  and applies the destructive ring. Applied by the consuming `field` partial when the server-validated
  field carries an error.
- **empty** (zero rows): the rows region is present but empty; only the column headers + Add button are
  visible. This is NOT a hidden state — a user can add rows from the empty start state.
- **at max rows** (`maxRows` reached): the Add button is `disabled` (native + opacity). A tooltip or
  hint text from the consuming page can explain the limit; the component does not impose a label.
- **JS-OFF fallback**: Add and Remove buttons are `type=submit`; the form submits with the special
  `<name>__add` / `<name>__remove` names; the server re-renders with the updated row set. No visual
  difference from JS-ON other than a full-page round-trip.

### Column header row
A header row (`<div role="row"` or a styled `<div>`) renders the `keyLabel` and `valueLabel` column
titles above the input rows. These are VISUAL ONLY — the `aria-label` on each input carries the
accessible name, so screen readers do not depend on the header (the header does not use `scope` or
`role=columnheader` because this is not a `<table>`).

### No grouping / nesting
The component is a flat list of key/value pairs. Hierarchical or nested pairs are out of scope.

## 4. The a11y contract

### WAI-ARIA pattern
No dedicated WAI-ARIA APG pattern exists for a dynamic key/value row editor. The component is BUILT
from raw ARIA authoring practices:
- Each text input is accessible via an explicit `aria-label` (column-name + row number), because the
  column header is a visual `<div>`, not a `<th scope=col>` — a screenreader cannot infer the column
  association without the explicit label.
- Add and Remove are real `<button>` elements, so they receive role=button, Enter/Space activation, and
  disabled propagation from the platform with no extra ARIA.
- A `role="status"` live region (`aria-live="polite"`) announces row add/remove to screen readers.
- The group label (when present) is associated with the wrapper via `aria-labelledby` or a `<label>`
  adjacent to the group.

Reference consulted: WAI-ARIA 1.2 authoring practices for forms —
https://www.w3.org/WAI/ARIA/apg/patterns/ (the form controls section and the "Grids" pattern for
two-column layout rationale). The APG Listbox and Grid patterns were evaluated and rejected: the rows
are editable native inputs (not interactive cells in an ARIA grid), so the grid role would bring
arrow-navigation expectations that conflict with the text-editing intent of the inputs. The `textbox`
role (native `<input type=text>`) is the right primitive here.

### Roles + ARIA

| Element | Role | ARIA attributes | Notes |
|---|---|---|---|
| Root wrapper | (no explicit role; is a generic container) | `data-slot="key-value-input"` | The wrapper groups the label + headers + rows + add button. |
| Group label `<label>` or `<span>` | — | `id="<name>-label"` | Links to the wrapper via `aria-labelledby` when present. |
| Column header row | (presentational `<div>`) | `aria-hidden="true"` | Visual only; inputs carry their own `aria-label`. |
| Each key `<input type=text>` | `textbox` (platform) | `aria-label="<keyLabel>, row N"` | Accessible name derived from column + position. Updated by reindex on add/remove. |
| Each value `<input type=text>` | `textbox` (platform) | `aria-label="<valueLabel>, row N"` | Same pattern. |
| Per-row Remove `<button>` | `button` (platform) | `aria-label="Remove row N"` | Updated by reindex. `type=submit` (JS-off) or `type=button` (JS-on clone). |
| Add `<button>` | `button` (platform) | — (visible label = `addLabel`) | `type=submit` (JS-off); enhancer sets `type=button` and intercepts. `disabled` when `maxRows` reached. |
| Live region `<span>` | `status` (via `aria-live="polite"`) | `aria-live="polite"` `aria-atomic="true"` | Announces "Row added" / "Row removed" on enhancer actions. `class="sr-only"` — visually hidden, screen-reader accessible. |

### Keyboard interaction map

| Key | Target | Action | Supplied by |
|---|---|---|---|
| Tab | any focusable in widget | Move focus to the next focusable (key input → value input → remove button → next row … → add button) | Platform (native tab order) |
| Shift+Tab | any focusable | Move focus to the previous focusable | Platform |
| Enter | focused `<button>` (Add or Remove) | Activate the button (add row / remove row) | Platform (native button) |
| Space | focused `<button>` (Add or Remove) | Activate the button | Platform (native button) |
| Enter (inside a text input) | key or value `<input>` | Submits the enclosing `<form>` (standard browser behaviour). The enhancer does NOT intercept Enter on inputs — standard form submit is the correct UX. | Platform |
| (typing) | focused `<input>` | Edit text in the focused input | Platform (`textbox` native editing) |

No arrow-key navigation is defined: the rows are text-editing fields, not menu items or list options.
Arrow keys operate within a text input at the caret level (platform). This matches user mental model
(a table of text fields) and avoids the ARIA grid pattern whose arrow navigation would conflict with
caret movement.

### Focus management

- **After Add row**: focus moves to the KEY input of the newly added row. The enhancer calls
  `firstKeyInput.focus()` after appending and reindexing. This is the correct UX: the user just clicked
  Add and immediately wants to type the new key.
- **After Remove row**: no explicit focus move in the base case (the button is removed with the row;
  the browser returns focus to the body or the next focusable). When the implementation can detect the
  preceding Remove button, it should move focus there; if no rows remain, focus moves to the Add button.
  This is handled in the enhancer (see §6).
- **No focus trap**: the widget is non-modal; focus may leave freely via Tab.
- **No roving tabindex**: every focusable element is in the natural tab order (standard `tabindex=0`).
  A roving group would conflict with per-cell text editing.
- **Focus survives morph** (JS-on + Turbo Drive navigation): the lievit runtime morph
  (ADR-0019) preserves node identity; existing inputs that survive a re-render keep their focus +
  caret position + uncontrolled input state. No component-level focus management is needed for morphs.

### Live region

The `<span data-key-value-input-live aria-live="polite" aria-atomic="true" class="sr-only">` element
announces:
- `"Row added"` when the enhancer appends a new row.
- `"Row removed"` when the enhancer removes a row.
The live region is always in the DOM (it is server-rendered), so screen readers register it on page
load and will pick up subsequent text changes without the timing issues of dynamically inserted live
regions.

### Shared mechanisms composed
None from the three shared enhancers (focus-trap, collection-nav, popover seam): this component does
not trap focus, does not need a listbox/menu roving interaction, and does not open a popover. The
irreducible client behavior (clone template, reindex, announce, focus management) is self-contained in
`key-value-input.enhancer.ts`.

## 5. Tokens

The component reads these `--lv-*` tokens:

| Token | Used on |
|---|---|
| `--lv-color-fg` | Input text, column header text, add-button label |
| `--lv-color-muted-fg` | Remove button icon color (neutral, not destructive until hovered) |
| `--lv-color-destructive` | Remove button icon on hover; `aria-invalid` border/ring |
| `--lv-color-input` | Input border, remove-button border, add-button dashed border (default state) |
| `--lv-color-bg` | Input background, remove-button background |
| `--lv-color-muted` | Input + button hover background |
| `--lv-color-ring` | Focus border + shadow on input/button focus-visible |
| `--lv-ring` | Focus shadow value (the shared focus ring, `box-shadow`) |
| `--lv-shadow-xs` | Input + button resting box-shadow |
| `--lv-space-1` | Gap between icon and label in the Add button |
| `--lv-space-2` | Row-to-row gap; key-value gap within a row |
| `--lv-space-3` | Horizontal input padding (md size) |
| `--lv-space-4` | Horizontal input padding (lg size) |
| `--lv-space-8` | Control height for `sm` (32 px) |
| `--lv-space-9` | Control height for `md` (36 px, default) |
| `--lv-space-10` | Control height for `lg` (40 px) |
| `--lv-radius-md` | Border radius for inputs and buttons |
| `--lv-text-xs` | Input text size for `sm` |
| `--lv-text-sm` | Input text size for `md` (default); column header text |
| `--lv-text-base` | Input text size for `lg` |
| `--lv-font-sans` | Font family for inputs and buttons |
| `--lv-font-medium` | Font weight for column headers and add-button label |

**NET-NEW tokens**: none. Every token consumed is already in the v2 token set. The dashed-border style
on the Add button uses the same `--lv-color-input` token as other form controls (via Tailwind's
`border-dashed` utility on top of the existing border colour token); no new token is needed.

**Colour authoring**: all colour tokens are in OKLCH (the source-of-truth format per architecture
contract §4, D1). The component references them by name only — it never authors a colour literal.

## 6. Wire / island integration

### JTE template structure (server-rendered, the authoritative shape)

```
<div data-slot="key-value-input"
     data-lievit-key-value-input
     data-name="<name>"              ← prefix for the JS reindex; SAFE: always server-static
     data-disabled="true|absent"     ← drives the enhancer's disabled guard
     class="flex flex-col gap-[var(--lv-space-2)] <cssClass>"
     <!-- attrs goes here (trusted raw) -->
     <!-- dataAttrs entries go here (safe escaped) -->
>
  <!-- Optional group label -->
  <label id="<name>-label" ...> <labelText> </label>

  <!-- Column headers (visual only, aria-hidden) -->
  <div aria-hidden="true" class="grid grid-cols-[1fr_1fr_<removeColWidth>] gap-[var(--lv-space-2)]">
    <span class="...">keyLabel</span>
    <span class="...">valueLabel</span>
    <span></span>  <!-- spacer for the remove-button column -->
  </div>

  <!-- Row list -->
  <div data-key-value-input-rows class="flex flex-col gap-[var(--lv-space-2)]">
    <!-- repeated for each entry -->
    <div data-slot="key-value-input-row"
         data-key-value-input-row
         data-index="<i>"
         class="flex items-center gap-[var(--lv-space-2)]">
      <input data-slot="key-value-input-key"
             data-key-value-input-key
             type="text"
             name="<name>[<i>][key]"
             value="<entry.key>"
             placeholder="<keyPlaceholder|absent>"
             aria-label="<keyLabel>, row <i+1>"
             disabled="<disabled|absent>"
             class="<rowInputClass>">
      <input data-slot="key-value-input-value"
             data-key-value-input-value
             type="text"
             name="<name>[<i>][value]"
             value="<entry.value>"
             placeholder="<valuePlaceholder|absent>"
             aria-label="<valueLabel>, row <i+1>"
             disabled="<disabled|absent>"
             class="<rowInputClass>">
      <button type="submit"                   ← JS-off: submits with name + index
              data-slot="key-value-input-remove"
              data-key-value-input-remove
              name="<name>__remove"
              value="<i>"
              aria-label="Remove row <i+1>"
              disabled="<disabled|absent>"
              class="<removeBtnClass>">
        <!-- icon: trash-2 -->
      </button>
    </div>
  </div>

  <!-- Clone template (inert, never executed; JS-on only) -->
  <template data-key-value-input-template>
    <div data-slot="key-value-input-row" data-key-value-input-row data-index="__i__" ...>
      <input ... name="<name>[__i__][key]" aria-label="<keyLabel>, row __label__" ...>
      <input ... name="<name>[__i__][value]" aria-label="<valueLabel>, row __label__" ...>
      <button type="button" ... aria-label="Remove row __label__" ...></button>
    </div>
  </template>

  <!-- Add button -->
  <div>
    <button type="submit"                     ← JS-off: submits with name
            data-slot="key-value-input-add"
            data-key-value-input-add
            name="<name>__add"
            value="1"
            disabled="<disabled|maxReached|absent>"
            class="<addBtnClass>">
      <!-- icon: plus --> <addLabel>
    </button>
  </div>

  <!-- Live region (always in DOM, sr-only) -->
  <span data-slot="key-value-input-live"
        data-key-value-input-live
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"></span>
</div>
```

**The `<template>` element**: the browser never executes its content; it is a DocumentFragment in the
DOM. Its field name uses `__i__` as an index placeholder that the enhancer replaces on clone. The
`type="button"` on the template's Remove button is intentional: a cloned row is always JS-on (the
enhancer created it), so it never needs the submit fallback.

**The `name` attribute escaping**: `name` is stamped into the template HTML as a literal. It must be
a server-controlled static string — a field path from the Java model, not a query parameter. This is
enforced by convention (the `@param String name` is supplied by the controller, not the request).

**The `data-disabled` attribute**: set to `"true"` when `disabled=true`, absent when `false`. The
enhancer reads this attribute on mount to decide whether to skip wiring (a disabled widget stays inert
even if JS is on).

### Enhancer responsibilities (`key-value-input.enhancer.ts`)

The enhancer is NOT a Lit component. It is a typed vanilla-TS module, CSP-clean, no framework. It is
loaded by the lievit runtime's lifecycle/directive registry (ADR-0019) on page init and after each
Turbo Drive navigation.

**Functions exported**:
- `enhanceKeyValueInput(root: HTMLElement): void` — enhance one widget. Idempotent: marks the root
  with `data-key-value-input-enhanced` and skips if already marked. No-op if `data-disabled=true`.
- `enhanceAllKeyValueInputs(scope: ParentNode = document): void` — enhance every
  `[data-lievit-key-value-input]` root in `scope`. Called by the runtime on page load + Turbo
  navigation.
- `indexedName(prefix: string, index: number, field: "key" | "value"): string` — pure function
  returning `prefix[index][field]`. Exported for unit testing; contains zero DOM access.

**What the enhancer does on mount**:
1. Finds `[data-key-value-input-rows]`, `[data-key-value-input-template]`, `[data-key-value-input-add]`,
   and `[data-key-value-input-live]` inside `root`.
2. Intercepts Add button clicks: `e.preventDefault()` → clone the `<template>` fragment → stamp the
   correct `__i__` + `__label__` placeholders → append to rows host → call `reindex()` → focus the
   first key input of the new row → announce "Row added".
3. Intercepts Remove button clicks (delegated on `root`): `e.preventDefault()` → remove the row
   element → call `reindex()` → move focus to the previous row's Remove button (or the Add button if
   no rows remain) → announce "Row removed".
4. Calls `reindex()` once on mount to normalise an existing server-rendered set (guards against
   server/client index skew after a JS-off round-trip).

**`reindex()` implementation contract**:
- Queries all `[data-key-value-input-row]` elements in document order.
- For each row at position `i` (0-based):
  - Sets `data-index="${i}"`.
  - Sets the key input's `name` to `indexedName(prefix, i, "key")` and `aria-label` to
    `"<keyLabel>, row <i+1>"` (the `<keyLabel>` stem comes from the key input's current `aria-label`,
    trimmed after the comma).
  - Sets the value input's `name` to `indexedName(prefix, i, "value")` and `aria-label` to
    `"<valueLabel>, row <i+1>"`.
  - Sets the Remove button's `aria-label` to `"Remove row <i+1>"`.

**`relabel()` implementation contract**:
Strips the trailing `, row N` suffix from an existing `aria-label` using the pattern
`/,?\s*row\b.*$/i` and appends `, row <i+1>`. This is pure string manipulation, no DOM layout access.

**Type signatures** (the implementation must match):
```ts
export function indexedName(prefix: string, index: number, field: "key" | "value"): string;
export function enhanceKeyValueInput(root: HTMLElement): void;
export function enhanceAllKeyValueInputs(scope?: ParentNode): void;
```

**What the enhancer does NOT do**:
- Does not manage form state or values (the native inputs own their values).
- Does not prevent form submission on Enter (that is standard browser behaviour and is correct here).
- Does not call any wire action (this is a PARTIAL, not a WIRE component; there is no server state to
  mutate client-side).
- Does not validate key uniqueness (that is server-side business logic, surfaced via `aria-invalid`).

**Runtime binding**: the runtime calls `enhanceAllKeyValueInputs()` via the `componentDidMount`-style
lifecycle hook (or the equivalent directive registered with the lievit runtime's lifecycle registry).
On Turbo Drive page transitions, the runtime re-calls `enhanceAllKeyValueInputs(newBody)` on the
morphed subtree; idempotency (the `ENHANCED` attribute guard) prevents double-wiring of already-enhanced
roots that survived the morph.

## 7. Acceptance tests

A component is DONE only when ALL the tests below pass on a REAL substrate. The client-island-fidelity
lesson (gest CLAUDE.md) applies: a test that runs against a mocked enhancer or a faked DOM structure
certifies nothing about the real interaction.

### Partial structural tests (source-file assertions, substrate = the `.jte` source text)

- **`names-key-value-input`** — root `data-slot="key-value-input"` + `data-lievit-key-value-input`
  present; the component is named KEY-VALUE-INPUT (not `key-value`).
- **`indexed-form-array-names`** — the key input name is `<name>[${i}][key]` and the value input name
  is `<name>[${i}][value]` (the canonical form-array convention).
- **`js-off-add-submit`** — the Add button has `name="${name}__add"` and `type=submit`.
- **`js-off-remove-submit`** — the Remove button has `name="${name}__remove"` and `value="${i}"`.
- **`hidden-template-row`** — a `<template data-key-value-input-template>` is present; its HTML
  contains `__i__` as the index placeholder.
- **`aria-labels-present`** — every key input has `aria-label="${keyLabel}, row ${i + 1}"`; every
  value input has `aria-label="${valueLabel}, row ${i + 1}"`; every Remove button has
  `aria-label="Remove row ${i + 1}"`.
- **`live-region-present`** — `aria-live="polite"` + `data-key-value-input-live` present in the
  source (always server-rendered, so screen readers register it on load).
- **`entries-via-param`** — the `@param java.util.Map<String, String> entries` declaration is present;
  no option data is hardcoded inside the template.
- **`no-inline-script`** — no `<script` tag and no `on*=` handler in the rendered markup (live
  markup, excluding the inert `<template>` contents).
- **`size-param`** — a `@param String size` with default `"md"` is declared; the `sm`/`md`/`lg`
  control-height token is referenced conditionally.

### Enhancer unit tests (jsdom, real enhancer module)

- **`add-clones-and-reindexes`** — starting from a root with one row `[["a","1"]]`, click Add →
  assert 2 rows are present; assert key input names are `meta[0][key]` + `meta[1][key]`; assert the
  Add click was `preventDefault`-ed.
- **`remove-middle-reindexes`** — starting from 3 rows `[["a","1"],["b","2"],["c","3"]]`, click the
  Remove of row 1 (middle) → assert 2 rows remain; assert key names are `meta[0][key]` + `meta[1][key]`;
  assert surviving values are `"a"` and `"c"` in order; assert the Remove click was `preventDefault`-ed.
- **`add-focuses-new-key-input`** — after clicking Add, the document active element is the key input
  of the new last row.
- **`aria-labels-updated-after-reindex`** — after removing the first row of a 2-row widget, the
  surviving row's key input has `aria-label="Key, row 1"` and its Remove button has
  `aria-label="Remove row 1"`.
- **`live-region-announces-add`** — after clicking Add, the live region element's `textContent` is
  `"Row added"`.
- **`live-region-announces-remove`** — after clicking Remove, the live region element's `textContent`
  is `"Row removed"`.
- **`idempotency`** — calling `enhanceKeyValueInput(root)` twice does not double-wire; `data-key-value-input-enhanced` is set after the first call; a second Add click still adds exactly one row.
- **`enhanceAll-wires-every-root`** — `enhanceAllKeyValueInputs()` with two roots in the document
  → both are marked enhanced after the call.
- **`disabled-skipped`** — a root with `data-disabled="true"` is skipped by `enhanceKeyValueInput`;
  Add and Remove clicks do nothing.

### Pure-function unit tests (no DOM)

- **`indexedName-builds-correct-name`** — `indexedName("meta", 0, "key") === "meta[0][key]"`;
  `indexedName("meta", 2, "value") === "meta[2][value]"`.

### A11y tests (axe-core, real rendered DOM via jsdom)

- **`axe-default-state`** — render a widget with 2 initial entries; axe-core reports zero violations.
  Assertions: no `aria-label` violations (SC 4.1.2), no colour-contrast violations (SC 1.4.3), no
  label-in-name violations.
- **`axe-disabled-state`** — render with `disabled=true`; axe-core zero violations.
- **`axe-empty-state`** — render with zero entries; axe-core zero violations.
- **`axe-after-add`** — render + enhance + click Add; axe-core zero violations on the updated DOM
  (the new row's inputs have correct `aria-label` values).
- **`no-interactive-element-without-accessible-name`** — every Remove button has a non-empty
  `aria-label`; the Add button has a non-empty visible text label.

### Keyboard tests (jsdom, real enhancer)

- **`add-button-keyboard-activate`** — focus the Add button, dispatch `keydown` Enter → assert a new
  row was added (platform button activation; the `click` event fires from Enter on a focused
  `<button>`).
- **`remove-button-keyboard-activate`** — focus a Remove button, dispatch `keydown` Space → assert
  the row was removed.
- **`tab-order-within-row`** — in a 2-row widget, Tab from the key input lands on the value input,
  then Tab lands on the Remove button, then Tab lands on the key input of the next row (natural DOM
  order, platform-supplied).

### Render / variant / size tests (jsdom, partial source rendered)

- **`sizes-emit-correct-height-token`** — rendering with `size="sm"` references `--lv-space-8`;
  `size="md"` references `--lv-space-9`; `size="lg"` references `--lv-space-10`.
- **`label-rendered-when-set`** — with `label="Metadati"`, the rendered HTML contains the text
  `"Metadati"` and a `data-slot="key-value-input-label"` element.
- **`label-omitted-when-null`** — with `label=null`, no `data-slot="key-value-input-label"` element
  is present.
- **`max-rows-disables-add`** — rendering with `maxRows=2` and 2 initial entries → the Add button has
  the `disabled` attribute.

### JTE compile + render gate

- **`jte-compiles`** — covered by the existing `test/jte-compile` real-compiler gate in `lievit-ui`.
  The template must compile with JTE's Java 25-compatible parser without errors.

### Escaping / security test

- **`dataAttrs-hostile-value-renders-inert`** — passing `dataAttrs={confirm: "\">|<script>alert(1)</script>"}` to the partial source assertion shows the value HTML-escaped, never parsed as a tag. This is a source-inspection test (the escaping channel is `Escape.htmlAttribute`, not the template variable interpolation). The `attrs` param is documented trusted-only and is never tested with user-derived data (the test documents the boundary).

## 8. Non-goals / anti-patterns

- **NOT the read-only display primitive.** The `key-value` / `data-list` display (`<dl>/<dt>/<dd>`)
  is a separate component (`data-list` in the inventory). Using `key-value-input` for read-only
  display would render editable inputs where none are needed and pollute form submissions.
- **NOT a JSON editor or nested structure editor.** The component is a flat list of string pairs. Hierarchical values, typed values (numbers, booleans, dates), or nested objects are out of scope; use
  a rich-text or builder component for those.
- **NOT a WIRE component.** The value is in the native form inputs, not in a `@Wire` Java field. Do
  not introduce a `SelectComponent`-style Java class for this component. Doing so would break the
  progressive-enhancement / no-JS-fallback model — the rows POST as native form fields, independent
  of any Wire round-trip.
- **NOT a `<table>` or `role=grid`.** The two-column visual layout is achieved with CSS grid, not a
  semantic table. A `<table>` would demand `role=columnheader`, `scope`, and complex ARIA grid
  keyboard navigation that conflicts with typing in the text inputs.
- **NOT a drag-to-reorder list.** Row reordering is out of scope for this component. If reordering is
  needed, the `repeater` component (which has a typed-TS drag enhancer) is the right tool.
- **NOT responsible for key-uniqueness validation.** Duplicate key detection is server-side domain
  logic. The component may show `aria-invalid` on a field the server marks as invalid; it does not
  compute or enforce uniqueness client-side.
- **No framework.** The enhancer is vanilla typed TypeScript. No Lit, no Alpine, no React. The
  single-source-a11y rule and the no-framework rule (ADR-0012) both hold.
- **No inline `on*=` handlers.** The strict CSP (`script-src 'self'`, no `'unsafe-inline'`) refuses
  them. All event listeners are attached in the enhancer module, not in the template HTML.
- **No ARIA grid or `role=row`.** The rows are plain `<div>` containers. Adding `role=grid` or
  `role=row` would impose arrow-key navigation expectations that conflict with typing in the inputs
  and would require an enhancer that the use case does not justify (plain Tab-to-next-input is the
  correct interaction model for a form-control widget).

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read the existing `key-value-input.jte` +
`key-value-input.enhancer.ts` (the COVERED baseline) as the structural reference; the v-next delta is:
(a) the `size` param (sm/md/lg height-based scaling, currently hard-coded to `--lv-space-9` only),
(b) the `maxRows` param, (c) the focus-return-to-previous-remove-button behaviour on Remove,
(d) the `aria-labelledby` link between the group label and the wrapper, (e) the full axe-core + keyboard
test coverage. You MUST NOT paste literal source from react-aria, ant-design, Tailwind UI, or Filament
(the one bright line, `02`) — output is always original generation.

Do NOT compose `focus-trap`, `collection-nav`, or the popover seam — this component does not need any
of them. Its irreducible client behavior is self-contained: clone a `<template>`, reindex names +
aria-labels, manage focus on Add/Remove, announce via a pre-existing live region.

Mirror `button.jte` house conventions exactly: header doc-comment (with TIER / STRUCTURE / A11y /
Params / Usage sections), typed `@param` with defaults, `data-slot` on root + every significant
element, `data-variant`/`data-size` for the styling and test hooks, zero `<script>`, zero `on*=`.

The `name` param is a trusted static string — it goes into the `<template>` HTML as a literal. It is
never fed into `wireArgs` or `dataAttrs`. Document this in the template header comment.

Minimal code to GREEN against the §7 acceptance tests; refactor only while green. The `indexedName`
function must be exported and tested in isolation (pure, no DOM) — it is the one deterministic
building block that the rest of the enhancer composes.
