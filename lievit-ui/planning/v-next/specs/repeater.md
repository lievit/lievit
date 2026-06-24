<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — repeater (dynamic record rows, add / remove / reorder)

- **tier**: PARTIAL + ENH (`repeater.enhancer.ts`; the existing enhancer is RE-FORGED and
  EXTENDED against this spec — the v-next delta adds reorder drag, the spec-documented keyboard
  map, and the strict acceptance-test gate)
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of `registry/jte/repeater.jte` +
  `registry/jte/repeater.enhancer.ts`; the partial and the enhancer already ship; this spec
  pins the a11y, documents the complete keyboard map, specifies the reorder extension, and
  defines the acceptance gate)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: **WAI-ARIA APG BUILT** — no dedicated APG pattern exists for repeating form-row
      groups (verified against https://www.w3.org/WAI/ARIA/apg/patterns/ — the 32 listed
      patterns cover widgets, overlays, navigation, and disclosure, but none address a
      form-field repeater / dynamic-row list). The ARIA and keyboard model below is
      constructed from three APG sources:
      (1) APG `group` / `fieldset` role semantics and labelling practices
      (https://www.w3.org/WAI/ARIA/apg/practices/structural-roles/);
      (2) APG Keyboard Interface practices — roving focus after DOM removal, managing focus
      when items are inserted or deleted
      (https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/);
      (3) APG Drag-and-Drop design pattern (sortable list with keyboard-accessible reorder:
      the `listbox` + `aria-grabbed` / Move-Up / Move-Down keyboard alternative,
      https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-rearrangeable/).
      This BUILT model is the single source for repeater a11y in this library.
    - inventory: Filament PHP `Repeater` as the primary inventory reference (repeatable
      card rows, recursive field slot, add / remove / reorder, min/max cardinality,
      collapsible cards, per-card labels); Ant Design `Form.List` as a secondary
      inventory reference (dynamic form items, add / remove, validation per item).
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired
      by Tailwind UI form-section and card-stack patterns (NO code copied)

---

## 1. What it is

A repeater renders an **ordered list of nested-schema item cards** — the same set of fields
repeated N times (e.g. "phone numbers", "tenants on a lease", "line items on an invoice"),
each in a card with an Add button and per-card Remove / Reorder controls.

**Why PARTIAL, not WIRE**: the repeater does not own the domain data. The fields INSIDE each
card are the form values that the adopter names (`name[i][campo]`); they POST as an indexed
array which the controller's Spring `@ModelAttribute` / `@RequestParam` binding rebuilds as
`List<Record>`. The server adds or removes a record by handling the `<name>__add` /
`<name>__remove` form submit and re-rendering with an updated `count`. There is no `@Wire`
state in the repeater itself — it is a pure presentation component that renders `count` cards
and lets the form do the work. This is the same reason `input` and `checkbox` are PARTIALs:
the value is not the component's to own.

**Progressive enhancement**: with JavaScript off, Add and Remove are ordinary form submits
(`type="submit"`) that round-trip to the server; the server re-renders with one more / fewer
card. With JavaScript on, the typed-TS enhancer adds and removes cards in-place (cloning a
hidden `<template>` element, re-indexing field names), and additionally supports drag-handle
reorder — without ever needing a wire round-trip for the structural edit itself.

**Why server-first works**: the form source of truth is always the native indexed inputs.
Whether JS ran or not, a POST sends `name[0][campo]=..., name[1][campo]=...`; the server
rebuilds the list from the indexed keys. The enhancer is cosmetic / UX lift; it cannot
silently corrupt the data even if it crashes.

**Reorder in v-next**: the v1 partial rendered the drag grip handle behind the `reorderable`
flag but deferred the wiring. v-next IMPLEMENTS the reorder: the grip handle initiates a
HTML5 drag (with a keyboard-accessible Move-Up / Move-Down alternative via dedicated controls)
and the enhancer re-indexes field names after a drop. No server round-trip is required for
reorder; the form captures the new order on the next submit.

---

## 2. API — params (the typed `@param` surface)

### PARTIAL `@param` list

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | — | **required.** The field prefix. Item fields POST as `<name>[<i>][fieldKey]`. Also written as `data-name` on the root for the enhancer to read. |
| `count` | `int` | `0` | How many existing item cards to render (the server supplies the current list length). |
| `itemContent` | `gg.jte.Content` | — | **required.** The recursive item BODY, rendered inside each card. The adopter authors this slot using the real per-item data, naming fields `<name>[<i>][key]` where `<i>` is the loop index. This is the content for EXISTING items. |
| `itemTemplate` | `gg.jte.Content` | `null` | The BLANK item body for the JS-on clone. Uses the `__i__` index token in field names (`<name>[__i__][key]`) so the enhancer can stamp the real index on add. Defaults to `itemContent` when `null` (safe: the enhancer re-indexes all `[<i>]` segments). Providing an explicit blank template (empty-value fields) avoids cloning existing-item values. |
| `label` | `String` | `null` | Visible `<legend>` for the fieldset. When `null` or blank, no legend is rendered. |
| `itemLabel` | `String` | `"Item"` | Per-card accessible-name stem: "Item 1", "Item 2", … Used also for control labels ("Remove Item 1", "Move Item 1 down"). |
| `addLabel` | `String` | `"Add"` | The add button's visible text. |
| `reorderable` | `boolean` | `false` | When true, renders the drag grip handle + Move-Up / Move-Down keyboard controls, and the enhancer enables drag-reorder. |
| `collapsible` | `boolean` | `false` | When true, each card can be collapsed to show only its header (toggle button per card). Collapsed state is client-side ephemeral; it does not post to the server. The first card is expanded by default; all others start expanded. |
| `minItems` | `int` | `0` | Minimum cardinality. When `count <= minItems`, the Remove button is hidden / `disabled` (enforced also server-side in the `__remove` handler). |
| `maxItems` | `int` | `0` | Maximum cardinality (`0` = unlimited). When `count >= maxItems > 0`, the Add button is hidden / `disabled`. |
| `disabled` | `boolean` | `false` | Disables Add, Remove, and Reorder controls. Item fields remain focusable (they carry their own `disabled` from the adopter's slot). |
| `cssClass` | `String` | `""` | Extra utility classes on the `<fieldset>` root. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. a wire directive on the root, an htmx attribute). Never feed dynamic / DB-derived values here. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** — dynamic `data-*` attributes, each value through `Escape.htmlAttribute`. Use this channel for any per-instance value derived from server data (e.g. a form-action URL fragment). |

### Enhancer `data-*` surface (the typed hooks the enhancer reads from the rendered DOM)

| attribute | on element | meaning |
|---|---|---|
| `data-lievit-repeater` | `<fieldset>` root | the enhancer mounts here via `enhanceAllRepeaters` |
| `data-name="<prefix>"` | root | the field prefix; the enhancer reads this to build the regex for re-indexing |
| `data-reorderable="true"` | root | present when `reorderable=true`; the enhancer enables drag + keyboard reorder |
| `data-disabled="true"` | root | present when `disabled=true`; the enhancer blocks add / remove / reorder clicks |
| `data-min="${minItems}"` | root | the enforced minimum; the enhancer hides Remove when card count would drop below it |
| `data-max="${maxItems}"` | root | the enforced maximum (`0` = unlimited); the enhancer hides Add when count would exceed it |
| `data-repeater-items` | items container `<div>` | the enhancer's card-list scope |
| `data-repeater-item` | each card `<div>` | one item card; the enhancer queries these to reindex |
| `data-index="<i>"` | each card | the current 0-based index; kept in sync by the enhancer after every add / remove / reorder |
| `data-repeater-template` | `<template>` element | the HTML5 template the enhancer clones for add |
| `data-repeater-add` | Add `<button>` | the enhancer intercepts click to add in-place |
| `data-repeater-remove` | per-card Remove `<button>` | the enhancer intercepts click to remove in-place |
| `data-repeater-reorder` | per-card grip `<button>` | the drag handle; the enhancer attaches `dragstart` / `dragover` / `drop` |
| `data-repeater-move-up` | per-card Move-up `<button>` | keyboard-accessible reorder: moves the card one position up |
| `data-repeater-move-down` | per-card Move-down `<button>` | keyboard-accessible reorder: moves the card one position down |
| `data-repeater-toggle` | per-card collapse toggle `<button>` | the enhancer toggles a CSS class on the card body; only present when `collapsible=true` |
| `data-repeater-live` | `<span aria-live="polite">` | the enhancer writes "Item added", "Item removed", "Item moved up / down" announcements here |

---

## 3. Variants / sizes / states

### The primary behavioral axes (replacing "variant")

The repeater has no intent-based visual variants (it is a structural form component, not an
action or status signal). Its axes are behavioral:

| axis | values | meaning |
|---|---|---|
| `reorderable` | `false` (default) / `true` | grip + Move-Up/Down controls present; drag-reorder wired |
| `collapsible` | `false` (default) / `true` | per-card expand/collapse toggle present |
| `minItems` | int ≥ 0 | Remove disabled when at/below minimum |
| `maxItems` | int ≥ 0; `0` = unlimited | Add disabled/hidden when at/above maximum |

### Size

The repeater has no `size` param: its card sizing is determined by the `itemContent` slot
(the fields inside use their own `size` param). The Add button is always `md` height
(`--lv-space-9`, 36px) to stay toolbar-aligned with other form controls at their default
size. If the adopter needs a denser repeater, they pass `size="sm"` into the fields inside
`itemContent`.

### States

| state | what it looks like | who controls it |
|---|---|---|
| `disabled` | Add / Remove / Reorder controls are `disabled` and visually dimmed (`opacity-50 cursor-not-allowed`); grip shows `cursor-not-allowed` instead of `grab` | `disabled` param → rendered `disabled` attr on the `<button>` elements; the enhancer also reads `data-disabled` |
| At `minItems` | Remove button is absent from the DOM (not just hidden) when removing would drop below `minItems`; the server also enforces this | The JTE template conditionally renders Remove based on `count > minItems`; the enhancer tracks live count |
| At `maxItems` | Add button is `disabled` + `aria-disabled="true"` when `count >= maxItems > 0` | JTE template + enhancer |
| JS-off Add / Remove | Add is `type="submit" name="<name>__add"`, Remove is `type="submit" name="<name>__remove" value="<i>"` — ordinary form submits that round-trip to the server | Platform (the form's native submit mechanism) |
| JS-on Add / Remove | The enhancer intercepts `click`, prevents the submit, clones / removes the card in-place, re-indexes field names | Enhancer |
| Card collapsed (collapsible) | Card body is `hidden` (CSS `display:none`); the toggle button shows an expand icon and `aria-expanded="false"` | Enhancer (client-ephemeral; not posted) |
| Card expanded | Card body visible; toggle shows a collapse icon and `aria-expanded="true"` | Enhancer |
| Drag in progress | The dragging card has `aria-grabbed="true"` and an `opacity-50` style; the drop target shows an insert-indicator line | Enhancer (the `dragging` CSS class) |
| `aria-busy` | Set by the lievit runtime `beforeCall`/`afterCall` on WIRE components; the repeater is PARTIAL, so this is not applicable — the form's `<button type="submit">` submits do not trigger `aria-busy` from the runtime. The adopter can set `aria-busy` on the containing form if needed. | Not the repeater's concern |

---

## 4. The a11y contract (the heart — BUILT against raw APG)

### WAI-ARIA pattern

**BUILT** — the W3C WAI-ARIA APG has no dedicated pattern for a dynamic form-row repeater
(verified against https://www.w3.org/WAI/ARIA/apg/patterns/ — 32 patterns listed, none
address repeating form groups). This spec builds the ARIA and keyboard model from three APG
sources:

1. **APG structural roles** (`group`, `fieldset` / `legend` semantics, per-region labelling):
   https://www.w3.org/WAI/ARIA/apg/practices/structural-roles/
2. **APG Keyboard Interface** (focus management after DOM insertion / removal, the
   "author must move focus" rule when the active element is removed):
   https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
3. **APG Listbox rearrangeable example** (the keyboard-accessible sort model — the
   "Move Up / Move Down" button pattern as the APG-recommended keyboard alternative to drag-
   and-drop reorder for lists of interactive items):
   https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-rearrangeable/

This BUILT model is the SINGLE source for repeater keyboard + ARIA in this library.

### Roles + ARIA (what the server-rendered JTE template emits)

| element | role / attribute | value / rule |
|---|---|---|
| `<fieldset data-slot="repeater">` | implicit `role="group"` (native fieldset) | groups the entire repeater; the `<legend>` is its accessible name when `label` is set |
| `<legend data-slot="repeater-label">` | implicit label for the fieldset | the value of the `label` param; absent when `label` is null/blank |
| items container `<div data-slot="repeater-items">` | no role (pure layout div) | the live region that changes as cards are added / removed |
| each card `<div data-slot="repeater-item" role="group">` | `role="group"` | groups one item's controls + fields; `aria-label="${itemLabel} ${i + 1}"` (e.g. "Item 1") gives each card a distinct accessible name so AT users can jump between cards |
| collapse toggle `<button data-slot="repeater-toggle">` (collapsible only) | native `<button>` | `aria-label="Collapse ${itemLabel} ${i + 1}"` / `"Expand …"` toggling; `aria-expanded="true"/"false"` reflecting the client-side collapsed state |
| card body `<div data-slot="repeater-item-body">` | no role | the slot that contains `${itemContent}`; `hidden` when collapsed |
| grip `<button type="button" data-slot="repeater-reorder">` (reorderable only) | native `<button>` | `aria-label="Reorder ${itemLabel} ${i + 1}"`; initiates drag (mouse) — **not** the keyboard-move button |
| Move-up `<button type="button" data-slot="repeater-move-up">` (reorderable only) | native `<button>` | `aria-label="Move ${itemLabel} ${i + 1} up"`; keyboard-accessible sort (no drag required) |
| Move-down `<button type="button" data-slot="repeater-move-down">` (reorderable only) | native `<button>` | `aria-label="Move ${itemLabel} ${i + 1} down"` |
| Remove `<button data-slot="repeater-remove">` | native `<button>` | `aria-label="Remove ${itemLabel} ${i + 1}"`; `type="submit"` (JS-off) in the server-rendered markup, downgraded to `type="button"` by the enhancer (JS-on) so it does not submit the form |
| Add `<button data-slot="repeater-add">` | native `<button>` | `aria-label` = the `addLabel` param (visible label + icon); `type="submit" name="<name>__add"` (JS-off); the enhancer overrides `type="button"` on mount |
| `<span data-slot="repeater-live" aria-live="polite">` | `aria-live="polite" aria-atomic="true"` | announces structural changes (add / remove / reorder); visually hidden (`sr-only`) |
| `<template data-repeater-template>` | no ARIA role | the HTML5 `<template>` element is not rendered in the a11y tree |

### Keyboard map (the load-bearing table)

All non-platform rows are owned by `repeater.enhancer.ts`.

| key | context | does | who |
|---|---|---|---|
| Tab | anywhere inside the repeater | standard tab order: cycles through all focusable elements in DOM order (card controls first, then the fields inside the card body) | platform |
| Shift+Tab | anywhere inside the repeater | reverse tab order | platform |
| Enter / Space | Add button focused | JS-on: adds a card in-place; JS-off: submits the form (platform) | enhancer (JS-on) / platform (JS-off) |
| Enter / Space | Remove button focused | JS-on: removes the card in-place + moves focus; JS-off: submits the form | enhancer (JS-on) / platform (JS-off) |
| Enter / Space | Move-up button focused | moves the card one position up; re-indexes; announces "moved up"; focus stays on the Move-up button (now at the new position) | enhancer |
| Enter / Space | Move-down button focused | moves the card one position down; re-indexes; announces "moved down"; focus stays on Move-down button | enhancer |
| Enter / Space | collapse toggle focused | toggles the card's collapsed/expanded state; updates `aria-expanded` | enhancer |
| Tab (on grip handle) | grip handle focused | moves focus to the next focusable (the grip handle does NOT trap focus or initiate keyboard mode) | platform |
| Drag (mousedown + mousemove on grip) | grip handle — mouse gesture | initiates HTML5 drag; `dragover` tracks the drop target; `drop` re-indexes + announces | enhancer (HTML5 drag API) |

**There is no ArrowUp / ArrowDown keyboard drag mode on the grip button itself.**
The keyboard-accessible alternative to drag-reorder is the dedicated Move-Up / Move-Down
buttons, per APG Listbox rearrangeable guidance. The grip button is mouse/touch only;
it is `aria-hidden="true"` in keyboard-only browsing (it has no keyboard role beyond
receiving Tab focus, which is low-value — the Move-Up / Move-Down buttons ARE the keyboard
interface). The grip is NOT `aria-hidden`; it is a real `<button>` (so it remains in the tab
order) but its `aria-label` ("Reorder Item N") explains its drag affordance for pointer users
and screen-reader users who use a pointing device.

### Focus management

**After Remove** (APG Keyboard Interface: "when a DOM element is removed, authors must move
focus"):
- If the removed card had a NEXT card: focus moves to the Remove button of the NEXT card
  (now renumbered to the removed card's index).
- If the removed card was the LAST card and there is a PREVIOUS card: focus moves to the
  Remove button of the PREVIOUS (now last) card.
- If the removed card was the ONLY card: focus moves to the Add button.

**After Add** (APG: focus moves into the new item so the user can immediately fill it):
- Focus moves to the FIRST focusable element inside the newly added card's body
  (the first `input`, `select`, `textarea`, or `button` that is not `disabled`).
- If the body has no focusable element, focus moves to the Remove button of the new card.

**After Move-Up / Move-Down**:
- Focus stays on the Move-Up / Move-Down button (now at the card's new position).
  The enhancer re-roots its event listeners on the re-ordered DOM after a reindex.

**After collapse / expand toggle**:
- Focus stays on the toggle button.

**No focus trap**: the repeater is not a modal overlay. Tab always moves out of the component.

**Drag focus**: the grip button initiates drag on `pointerdown`. During the drag gesture,
keyboard focus is not managed (a drag is a pointer gesture). The `drop` handler calls
`reindex()` and the next Tab cycle follows the new DOM order.

**Live region**: `data-slot="repeater-live"` with `aria-live="polite" aria-atomic="true"`.
The enhancer writes the following messages:
- "Item added" (or `"${addLabel} added"` if `addLabel` is set).
- `"${itemLabel} ${i + 1} removed"` (e.g. "Item 2 removed").
- `"${itemLabel} ${i + 1} moved up"` / `"moved down"`.

Screen-reader users rely on these announcements because the structural DOM changes
(a card appearing / disappearing / reordering) are not individually announced by the browser.

### Shared mechanisms composed

The repeater does NOT compose `focus-trap` (not a modal), `collection-nav` (not a listbox),
or the popover seam (not an overlay). It is a self-contained PARTIAL + its own enhancer.
The drag-reorder pattern is the one native HTML5 API interaction (not a shared lievit enhancer).

---

## 5. Tokens

### Consumed tokens (all `var(--lv-*)`, never a literal)

| token | used for |
|---|---|
| `--lv-color-bg` | card background (the surface the fields sit on) |
| `--lv-color-surface` | alternative card background when `--lv-color-bg` is too stark; pick whichever reads as "card on page" in the adopter's theme |
| `--lv-color-border` | card border + Add button dashed border |
| `--lv-color-input` | icon button border (Remove / Reorder controls) |
| `--lv-color-fg` | legend text; Add button text |
| `--lv-color-muted-fg` | icon button default icon color; grip handle icon |
| `--lv-color-destructive` | Remove button icon hover color (the destructive hover tint) |
| `--lv-color-muted` | Add button hover background |
| `--lv-color-accent` | drag-over drop-target indicator line + the "dragging" card border tint |
| `--lv-ring` | focus-visible ring on all interactive controls (Add, Remove, Move-Up/Down, grip, toggle) |
| `--lv-shadow-xs` | card shadow (subtle elevation to separate cards from the page) |
| `--lv-space-1` | icon size (used with `icon` partial: `1rem`) |
| `--lv-space-2` | gap between card header controls (Remove / grip / move buttons) |
| `--lv-space-3` | vertical gap between cards; horizontal padding inside card header |
| `--lv-space-4` | card internal padding (all sides) |
| `--lv-space-8` | icon button size (32px square, the sm control height) |
| `--lv-space-9` | Add button height (36px, md height — toolbar-aligned) |
| `--lv-radius-md` | icon button border-radius |
| `--lv-radius-lg` | card border-radius |
| `--lv-text-sm` | Add button text size; legend text size |
| `--lv-font-medium` | legend font-weight; Add button font-weight |
| `--lv-font-sans` | all text (inline `font-family: var(--lv-font-sans)` on the root, as `button.jte` does) |
| `--lv-transition-colors` | icon button color transition on hover |

### Net-new tokens proposed

**None.** All needed tokens exist in the current `registry/tokens/lievit-tokens.css`. The
drag-over indicator reuses `--lv-color-accent`; the card shadow reuses `--lv-shadow-xs`.
No new colour or structural token is required.

---

## 6. Wire / island integration

The repeater is **PARTIAL**, not WIRE. It has no wire round-trip of its own.

### Server-rendered JTE structure (the non-JS foundation)

The template renders a `<fieldset>` root containing:
1. An optional `<legend>` (when `label` is set).
2. A `<div data-repeater-items>` containing `count` item cards (the `@for` loop).
   Each card is a `<div role="group" aria-label="${itemLabel} ${i + 1}">` containing:
   - A card header `<div>` with: [grip button] [move-up button] [move-down button] (when
     `reorderable`); [toggle button] (when `collapsible`); [remove button] (always, unless
     `count <= minItems`). The grip and move buttons are only rendered when `reorderable=true`.
   - A card body `<div data-slot="repeater-item-body">${itemContent}</div>`.
3. A `<template data-repeater-template>` element with the blank item markup (using `__i__`
   and `__label__` tokens), containing `itemTemplate` (or `itemContent` when `itemTemplate`
   is null). This element is NOT rendered in the a11y tree (the HTML5 `<template>` spec).
4. An Add `<button type="submit" name="<name>__add">` button below the cards.
5. A `<span data-repeater-live aria-live="polite" aria-atomic="true" class="sr-only">`.

The JS-off form submission contract:
- **Add**: the Add button is `type="submit" name="<name>__add" value="1"`. The server
  handler detects this named submit button, appends a blank record to the list, and
  re-renders with `count + 1`.
- **Remove**: each Remove button is `type="submit" name="<name>__remove" value="${i}"`.
  The server detects this, removes the record at index `i`, re-renders with `count - 1`.
- Reorder has NO JS-off path. The grip handle and Move-Up / Move-Down buttons are
  `type="button"` (not submit). Reorder requires the enhancer. This is acceptable: reorder
  is a UX enhancement, not a data-integrity concern; a JS-off user can still add/remove rows.

### Typed-TS enhancer responsibilities (`repeater.enhancer.ts`)

The enhancer's lifecycle:
1. **Mount (`enhanceRepeater(root)`)**: idempotent (skips if `data-repeater-enhanced` present).
   - Reads `data-name`, `data-reorderable`, `data-disabled`, `data-min`, `data-max` from the root.
   - Changes Add button and Remove buttons from `type="submit"` to `type="button"` (prevents
     form submission when JS is on). This is the progressive-enhancement downgrade.
   - Attaches a click handler on the Add button.
   - Attaches a delegated click handler on the root for Remove / Move-Up / Move-Down / toggle buttons.
   - If `reorderable`, attaches `dragstart` / `dragover` / `drop` / `dragend` on the items container.
   - Calls `reindex()` once to synchronise the live DOM with the current count.

2. **Add (`addItem()`)**: clones `template.content`, appends to `data-repeater-items`, calls
   `reindex()`, moves focus to the first focusable in the new card's body, announces.

3. **Remove (`removeItem(card)`)**: records the focus target per §4 focus rules (next / prev /
   add button), removes the card, calls `reindex()`, moves focus, announces.

4. **Reindex (`reindex()`)**: walks every `[data-repeater-item]` in DOM order; for each, sets
   `data-index`, updates `aria-label` (card + all its controls), and rewrites every
   `[name]` descendant's `name` attribute from `<prefix>[old][...]` to `<prefix>[i][...]`
   using the exported `reindexFieldName(name, prefix, i)` pure function.
   Also rewrites `<label for="...">` attributes that reference indexed field ids (the
   `<label for="<name>[<i>][campo]">` idiom) — NET-NEW in v-next, deferred in v1.
   Also rewrites `id` attributes of form controls (to keep `<label for>` associations intact).

5. **Move-Up / Move-Down (`moveCard(card, direction)`)**: swaps the card with its predecessor
   (up) or successor (down) in the DOM, calls `reindex()`, moves focus to the
   corresponding Move-Up / Move-Down button at the new position, announces.

6. **Drag-reorder** (only when `reorderable`):
   - `dragstart` on grip button: sets `draggable="true"` on the card parent, sets
     `dataTransfer.effectAllowed="move"`, records the dragged card, adds the `dragging`
     CSS class (opacity hint).
   - `dragover` on items container: tracks which card the pointer is over, renders a
     CSS insert-indicator (a 2px accent-colored line above/below the target card via a
     `drag-target` CSS class).
   - `drop` on items container: inserts the dragged card before/after the target,
     removes `dragging` + `drag-target` classes, calls `reindex()`, announces.
   - `dragend`: clean-up fallback (removes all drag classes if `drop` never fired).

7. **Collapse toggle** (only when `collapsible`): toggles `hidden` on `[data-slot="repeater-item-body"]`
   and flips the toggle button's `aria-expanded` + icon (expand vs collapse).

8. **`enhanceAllRepeaters(scope)`**: queries `[data-lievit-repeater]` in `scope` (default
   `document`) and calls `enhanceRepeater` on each. Called once on page load and again after
   any server-driven DOM swap (the lievit runtime lifecycle hook or htmx `htmx:afterSwap`).

### The two escaping channels (the XSS decision rule)

The repeater has no per-row DB-derived action URL, so the primary escaping concern is the
content of `itemContent` — which the ADOPTER writes (they own the field names and values).
The adopter's responsibility is to escape their own data in the fields they pass via
`itemContent`. The repeater's own rendered content (item labels, add label, etc.) all comes
from `@param` String values, which JTE escapes by default.

The `attrs` param is TRUSTED RAW (`$unsafe`) — for static author-typed strings like
`hx-boost="true"` or `l:submit="saveAll"` on the fieldset root. Never feed a DB-derived
value through `attrs`.

The `dataAttrs` param is SAFE — dynamic key-value pairs are each run through
`Escape.htmlAttribute` before rendering as `data-*` attributes on the root.

---

## 7. Acceptance tests (the gate — refute-by-default; all must pass on REAL substrate)

The client-island-fidelity lesson is load-bearing: the enhancer tests MUST run the REAL
enhancer mounted on a REAL jsdom DOM that mirrors the server-rendered partial — no mocked
lievit runtime (the repeater is PARTIAL, not WIRE, so there is no `$lievit` call), but
the enhancer itself must be the real production module, not stubbed.

### Structural (parse the JTE source — verifying the template's shape, not a rendered DOM)

- **struct-recursive-slot**: the `itemContent` param is typed `gg.jte.Content` AND rendered
  inside `data-slot="repeater-item-body"` — the recursive content slot invariant.
- **struct-item-template**: the JTE source contains `<template data-repeater-template>` with
  the `__i__` token; the JTE template's `<template>` element is always emitted (even for
  `count=0`) so the enhancer can clone it.
- **struct-js-off-add**: the Add button has `type="submit"` and `name="${name}__add"` in the
  rendered source.
- **struct-js-off-remove**: each Remove button has `type="submit"` and `name="${name}__remove"`
  and `value="${i}"` (the index).
- **struct-live-region**: `aria-live="polite"` and `data-repeater-live` are present in the markup.
- **struct-no-script**: the JTE source contains no `<script` tag and no `on*=` attribute.
  (The CSP refuses them; this is the same check as `button.jte`.)
- **struct-reorderable-grip**: when `reorderable=true`, the grip button renders with
  `data-repeater-reorder` + `aria-label` containing the `itemLabel`; move-up and move-down
  buttons render with `data-repeater-move-up` / `data-repeater-move-down`.
- **struct-collapsible-toggle**: when `collapsible=true`, each card has a toggle button with
  `data-repeater-toggle` + `aria-expanded="true"` (expanded by default).

### Render (jsdom, REAL enhancer NOT mounted — pure server DOM assertions)

- **render-count**: passing `count=3` renders exactly 3 `[data-repeater-item]` elements.
- **render-card-roles**: each card has `role="group"` + `aria-label="Item N"` (1-based).
- **render-legend**: when `label="Phones"`, a `<legend>` with text "Phones" is present;
  when `label=null`, no `<legend>` is rendered.
- **render-remove-absent-at-min**: when `count=1, minItems=1`, no Remove button is rendered.
- **render-add-disabled-at-max**: when `count=3, maxItems=3`, the Add button has `disabled`
  and `aria-disabled="true"`.
- **render-disabled**: when `disabled=true`, Add + Remove buttons have `disabled`; the grip
  (when reorderable) has `disabled`; the move-up / move-down buttons have `disabled`.
- **render-data-slot**: `data-slot="repeater"` on the root, `data-slot="repeater-items"`,
  `data-slot="repeater-item"`, `data-slot="repeater-item-body"`, `data-slot="repeater-add"`,
  `data-slot="repeater-remove"`, `data-slot="repeater-live"` all present.

### Accessibility (axe-core, zero violations on the rendered jsdom DOM)

- **axe-base**: zero violations on a `count=2` repeater with label (the `fieldset` / `legend`
  grouping rule, the `button` accessible-name rule).
- **axe-no-label**: zero violations on a `count=2` repeater WITHOUT a `label` (a `<fieldset>`
  without `<legend>` is allowed; the cards are still individually named via `aria-label`).
- **axe-card-groups**: each card's `role="group"` has a non-empty `aria-label`; axe
  "group" rule.
- **axe-remove-names**: every Remove button has `aria-label` matching "Remove Item N"; axe
  "button-name" rule.
- **axe-add-name**: the Add button has a non-empty accessible name (the `addLabel` text);
  axe "button-name" rule.
- **axe-reorderable**: when `reorderable=true`, all grip / move-up / move-down buttons have
  non-empty `aria-label`; zero violations.

### `reindexFieldName` pure function (no DOM needed)

These tests are already in the existing test file; re-state them here as the spec gate:

- **reindex-basic**: `reindexFieldName("telefoni[3][numero]", "telefoni", 1)` → `"telefoni[1][numero]"`.
- **reindex-template-token**: `reindexFieldName("telefoni[__i__][numero]", "telefoni", 0)` → `"telefoni[0][numero]"`.
- **reindex-no-match**: `reindexFieldName("other[0][x]", "telefoni", 2)` → `"other[0][x]"` (unchanged).
- **reindex-regex-special**: `reindexFieldName("a.b[5][k]", "a.b", 0)` → `"a.b[0][k]"` (prefix is escaped).
- **reindex-nested-deep**: `reindexFieldName("tenants[2][address][street]", "tenants", 0)` →
  `"tenants[0][address][street]"` (only the first `[...]` segment after the prefix is rewritten;
  nested sub-keys like `[address][street]` are left intact).

### Enhancer DOM behaviour (REAL enhancer, REAL jsdom DOM that mirrors the partial)

- **enh-add-clones**: calling Add appends a new `[data-repeater-item]`; after `reindex()`, the
  new card has `data-index="N"` and its nested input's name is `telefoni[N][numero]`; the
  count is `prevCount + 1`.
- **enh-add-focus**: after add, `document.activeElement` is the first focusable inside the
  new card's body.
- **enh-add-announces**: the `data-repeater-live` span's `textContent` includes "added" after add.
- **enh-remove-middle**: removing card[1] of [0,1,2]: card count is 2; the survivors retain
  values "a" and "c"; their field names are `telefoni[0][numero]` and `telefoni[1][numero]`.
- **enh-remove-focus-next**: remove card[1] of [0,1,2]: focus lands on the Remove button of
  what was card[2] (now card[1]).
- **enh-remove-focus-last**: remove the last card of two: focus lands on the Remove button of
  the remaining (first) card.
- **enh-remove-focus-only**: remove the only card: focus lands on the Add button.
- **enh-remove-announces**: the live span includes "removed" after remove.
- **enh-reindex-aria-labels**: after removing card[1] of [0,1,2], card[0]'s `aria-label` =
  "Item 1"; card[1]'s (formerly card[2]) `aria-label` = "Item 2"; their Remove buttons' labels
  are "Remove Item 1" and "Remove Item 2".
- **enh-prevents-submit**: the Add button's click event is `defaultPrevented` after the enhancer
  mounts (confirming the form does not submit JS-on).
- **enh-idempotent**: calling `enhanceRepeater(root)` twice does not add duplicate listeners;
  `data-repeater-enhanced` is present; a single Add click adds exactly one card.
- **enh-enhance-all**: `enhanceAllRepeaters()` wires every `[data-lievit-repeater]` root in
  scope (test with two roots; both get `data-repeater-enhanced`).
- **enh-min-blocks-remove**: with `data-min="1"` and one card, the Remove button is absent
  (structural check); the enhancer does not add another Remove listener on top.
- **enh-max-blocks-add**: with `data-max="2"` and two cards, the Add button has `disabled`;
  after a JS-on add attempt (click), the card count stays at 2.

### Reorder (real enhancer, reorderable=true DOM)

- **reorder-move-up**: card[1] of [0,1,2] → click Move-up → DOM order is [0,2new,1new,…] wait
  — concrete: cards were ["a","b","c"]; Move-up on "b" → DOM order ["a" becomes index 1 → no,
  "b" moves up so DOM order is now ["b","a","c"]; field names are `[0]`=b, `[1]`=a, `[2]`=c.
- **reorder-move-up-focus**: after Move-up, `document.activeElement` is the Move-up button
  of the same card (now at its new position).
- **reorder-move-down**: cards ["a","b","c"]; Move-down on "b" → DOM order ["a","c","b"];
  field names `[0]`=a, `[1]`=c, `[2]`=b.
- **reorder-move-up-first-disabled**: the first card's Move-up button is `disabled` (there is
  nothing above it to swap with).
- **reorder-move-down-last-disabled**: the last card's Move-down button is `disabled`.
- **reorder-announces**: live span includes "moved" after a Move-up / Move-down action.
- **reorder-drag-drop**: simulate HTML5 drag: `dragstart` on the grip of card[0], `dragover`
  on card[2]'s container, `drop` → DOM order is now card[1], card[2], card[0]; field names
  are reindexed accordingly.

### Collapse (real enhancer, collapsible=true DOM)

- **collapse-toggle**: toggle button on card[0] → card body has `hidden` attribute;
  `aria-expanded="false"` on the toggle button.
- **collapse-expand**: toggle again → `hidden` removed; `aria-expanded="true"`.
- **collapse-focus-stays**: after toggle, `document.activeElement` is still the toggle button.

### JTE compiles + renders

Covered by the `test/jte-compile` real-compiler + render gate (all param combinations:
`count=0`, `count=2`; `label` set + null; `reorderable=true/false`; `collapsible=true/false`;
`disabled=true`; `minItems=1`; `maxItems=2`; `addLabel` custom).

### Escaping (the XSS abuse-cases)

- **xss-name**: the `name` param is rendered into `data-name="${name}"` and `name="${name}__add"`.
  JTE escapes attribute values by default. A hostile `name = '"><script>x</script>'` renders
  inert as an escaped HTML attribute; the `data-name` attribute value is sanitised.
- **xss-label**: a hostile `label = '"><script>x</script>'` renders as escaped `<legend>` text.
- **xss-itemlabel**: a hostile `itemLabel` value appears in `aria-label` attributes on cards and
  buttons; JTE attribute escaping renders it inert.
- **xss-dataattrs**: a hostile `dataAttrs = {confirm: '"><script>x</script>'}` renders as an
  escaped `data-confirm` attribute value (the SAFE channel via `Escape.htmlAttribute`).
- **xss-attrs-documented**: the `attrs` param is trusted-raw and explicitly documented in the
  header comment as "STATIC author-typed strings only". No test can make it safe for dynamic
  values; the contract is enforced by documentation + code review. A NOTE in the template's
  doc-comment warns: `attrs` trusts the caller; never pass user input here.

---

## 8. Non-goals / anti-patterns

- **No drag-reorder JS-off path.** Drag is a mouse/touch enhancement. The JS-off
  submit mechanism (Add / Remove submits) is the no-JS baseline; reorder is unavailable
  without JS. This is intentional and acceptable — reorder is a UX feature, not a
  data-collection requirement.
- **No WIRE round-trip for add / remove.** The repeater is PARTIAL: the form POST IS the
  round-trip. Adopters who need reactive server-side validation on add (e.g. checking an
  async constraint) can wrap the repeater in an htmx-powered form fragment. The repeater
  itself does not initiate wire calls.
- **No client-side validation per card.** Validation is the server's job. The enhancer does
  not check required fields, min-length, or max-items before add. The server's form binding
  validates; Spring's `BindingResult` errors re-render with the validation messages in the
  next server-rendered page.
- **No re-implementation of `focus-trap`, `collection-nav`, or the popover seam.** The
  repeater is self-contained and composes none of these. Do not add any of them.
- **No `<script>` in the JTE template.** All interactivity is in `repeater.enhancer.ts`,
  loaded via the standard lievit runtime bundle. The JTE is strictly HTML + Tailwind utilities
  + `--lv-*` tokens. The strict CSP refuses inline scripts silently.
- **No data hardcoded in the partial.** Item labels, add labels, and any option lists the
  adopter uses inside `itemContent` all come from `@param` or the adopter's slot content;
  never hardcoded in the repeater JTE.
- **No React/Lit/Alpine inside the enhancer.** The enhancer is typed-vanilla-TS that
  manipulates the real server-rendered DOM and re-indexes field names. It does not re-render
  card content client-side; the server owns the item schema.
- **No virtual DOM or client-side list management.** The enhancer clones a `<template>` for
  add and removes a DOM node for remove. The field names are strings in the real input elements.
  There is no client-side list model; the server form binding rebuilds the list on submit.
- **No `aria-grabbed` managed by the enhancer.** The APG drag-and-drop examples use
  `aria-grabbed` for AT announcements during drag; however, `aria-grabbed` is deprecated in
  ARIA 1.1 and removed from ARIA 1.2. The keyboard-accessible Move-Up / Move-Down buttons
  ARE the AT-accessible reorder path. The drag gesture has a live-region announcement on
  drop ("Item moved") as the screen-reader signal.
- **No optimistic add.** A card is added to the DOM immediately by the enhancer on JS-on;
  no server confirmation is needed (the form value is in the input, not in a server-owned
  field). The form captures the new card's values on the next submit.
- **No per-card "save" action.** The repeater is a form component; values are submitted with
  the containing form. Adopters who need per-card live persistence wire their own `l:submit`
  or htmx action on the card's form elements; that is out of scope for the repeater partial.
- **No label `for` rewrite outside the item-body.** The enhancer rewrites `id` and `for`
  attributes on form controls and labels ONLY inside `[data-slot="repeater-item-body"]`.
  Controls outside that slot (the card header buttons) do not carry indexed ids.

---

## 8a. Agent instructions (the discipline reminders, verbatim)

- Generate ORIGINAL code over `--lv-*` tokens. You MAY read Filament PHP Repeater and Ant
  Design Form.List as inventory references for FEATURES. You MAY read the APG rearrangeable
  listbox example as the PATTERN reference for Move-Up / Move-Down keyboard. You MUST NOT
  paste literal source from ANY of them (no Filament Blade / Ant Design / Tailwind UI code
  or class strings) — the output is always original generation. (The one bright line,
  `02-licensing.md`.)
- The BUILT a11y model in §4 IS the source of truth. Do not re-derive it; implement it.
  The keyboard map in the table is the contract — assert ALL rows in the acceptance tests.
- The exported `reindexFieldName(name, prefix, index)` pure function is the SINGLE
  re-indexing primitive. Call it for field `name`, for `id`, and for `aria-label`; never
  hand-roll the regex elsewhere in the enhancer.
- Focus management after Remove is the hardest part. Implement the three-case rule
  (next / previous / add button) by recording the focus target BEFORE removing the card
  from the DOM (because after `card.remove()`, querying the next sibling is stale).
  Move focus AFTER `reindex()` completes.
- The drag-reorder grip does NOT trap keyboard focus. The Move-Up / Move-Down buttons ARE
  the keyboard interface for reorder. Do not implement an arrow-key drag-mode on the grip.
- The `attrs` param is TRUSTED RAW (`$unsafe`). Document it in the template header comment.
  Never feed a dynamic / user-supplied value through this channel. The `dataAttrs` param is
  the SAFE channel for any dynamic root attributes.
- Mirror `button.jte` house conventions exactly: header doc-comment with the four labelled
  sections (TIER / STRUCTURE / A11y / Params / Usage), typed `@param` with defaults, the
  two escaping channels, zero `<script>`, zero inline `on*=`.
- The `<template data-repeater-template>` element MUST always be rendered (even for
  `count=0`) so the enhancer can clone it when the user clicks Add in an empty repeater.
- The JS-off path (Add / Remove as `type="submit"` buttons) MUST be preserved in the
  server-rendered markup. The enhancer changes them to `type="button"` on mount — the
  progressive-enhancement pattern. Never render them as `type="button"` from the JTE
  (that would break the JS-off path).
- Minimal code to GREEN against the acceptance tests; refactor only while green.
