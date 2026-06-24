<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — transfer (dual-list)

- **tier**: WIRE + ENH (`collection-nav.enhancer.ts`, the shared listbox roving/typeahead/activedescendant
  mechanism; one instance per listbox panel, two instances mounted per component)
- **build sequence**: S2
- **status (current)**: NET-NEW
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Listbox pattern (BUILT: two independent listboxes + move-action buttons, multi-select
      recommended model; rearrangeable-listbox APG example as interaction reference for the toolbar buttons +
      bulk-move keyboard semantics); `collection-nav.enhancer.ts` reused as pattern reference for roving
      `aria-activedescendant` + typeahead within each listbox panel. No react-aria source copied.
    - inventory: Ant Design Transfer as inventory reference (search both sides, bulk move, custom render,
      one-way / two-way mode, pagination-on-large-lists, disabled items)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual layout inspired by Tailwind UI (NO
      code copied)

## 1. What it is

A dual-list transfer widget: two labelled listboxes (a "source" panel and a "target" panel) separated by a
column of action buttons that move selected items between them.
The component is used when the user must compose an ordered or unordered subset from a larger known set —
assigning permissions to a role, picking report columns, curating a playlist.
It is WIRE because the canonical selection sets (which items are in source vs. target) are server facts: the
server owns both lists, validates every move, and re-renders the full component on each action.
The irreducible client behavior — keyboard roving within each listbox, typeahead, `aria-activedescendant`
tracking, and multi-item selection extension via Shift+Arrow — is the shared `collection-nav.enhancer.ts`,
instantiated independently on the source and target listbox roots.
Server-first works: the server renders both listbox panels with their current membership, the morph patches
them in place after each move, and the enhancer re-binds its state from the updated DOM without loss of
focus or scroll position (the identity-preserving morph, ADR-0019).

---

## 2. API — the WIRE surface + template params

**Java (`TransferComponent`)**:

| member | kind | meaning |
|---|---|---|
| `sourceItems` `List<TransferItem>` | `@Wire @LievitProperty(locked=true)` | the INITIAL full item set; the server splits them into source/target on init; client cannot inject items |
| `sourceSelected` `Set<String>` | `@Wire` | ids of items checked in the source listbox (the multi-select state) |
| `targetSelected` `Set<String>` | `@Wire` | ids of items checked in the target listbox |
| `sourceList` `List<TransferItem>` | `@Wire` | items currently in the source panel (derived from `sourceItems` minus `targetList`; server-maintained) |
| `targetList` `List<TransferItem>` | `@Wire` | items currently in the target panel |
| `sourceQuery` `String` | `@Wire` | live search text in the source panel (filters `visibleSourceItems()`) |
| `targetQuery` `String` | `@Wire` | live search text in the target panel |
| `sourceTitle` `String` | `@Wire @LievitProperty(locked=true)` | accessible label for the source listbox panel |
| `targetTitle` `String` | `@Wire @LievitProperty(locked=true)` | accessible label for the target listbox panel |
| `searchable` `boolean` | `@Wire @LievitProperty(locked=true)` | show search inputs above each panel |
| `oneWay` `boolean` | `@Wire @LievitProperty(locked=true)` | when true, hides the "← move left" button; items may only move source → target |
| `disabled` `boolean` | `@Wire @LievitProperty(locked=true)` | disables the whole component |
| `moveRight()` | `@LievitAction` | move all items in `sourceSelected` to `targetList`; validates ids ∈ sourceList; clears `sourceSelected` |
| `moveLeft()` | `@LievitAction` | move all items in `targetSelected` to `sourceList`; validates ids ∈ targetList; clears `targetSelected`; no-op when `oneWay` |
| `moveAllRight()` | `@LievitAction` | move ALL visible (non-filtered) source items to target |
| `moveAllLeft()` | `@LievitAction` | move ALL visible target items to source; no-op when `oneWay` |
| `toggleSourceItem(String id)` | `@LievitAction` | toggle id in `sourceSelected`; validates id ∈ sourceList |
| `toggleTargetItem(String id)` | `@LievitAction` | toggle id in `targetSelected`; validates id ∈ targetList |
| `setSourceQuery(String q)` | `@LievitAction` | update `sourceQuery`; bound via `l:model.debounce` |
| `setTargetQuery(String q)` | `@LievitAction` | update `targetQuery` |
| `visibleSourceItems()` | getter on `_instance` | `sourceList` filtered by `sourceQuery` (case-insensitive label match); `@LievitProperty(serialize=false)` |
| `visibleTargetItems()` | getter on `_instance` | `targetList` filtered by `targetQuery` |

**`TransferItem` (value record)**:

| field | type | meaning |
|---|---|---|
| `id` | `String` | stable unique key; MUST be HTML-attribute safe (server validates) |
| `label` | `String` | display text; also the typeahead match target |
| `description` | `String` | optional secondary line |
| `disabled` | `boolean` | item cannot be selected or moved; rendered with `aria-disabled` |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param TransferComponent _instance` (for `visibleSourceItems()`, `visibleTargetItems()`). No `Content`
slot (WIRE has none — server-first refactor blueprint §1.b; owned markup owns the panels).

---

## 3. Variants / sizes / states

**Variants**:
The component has no `variant` param in the intent-vocabulary sense (it is not a button-like control).
The panel layout is always: `[source panel] [button column] [target panel]` in a row.

**Sizes**:
- `size` param: `sm | md | lg` — controls the HEIGHT of each item row and the search inputs (toolbar-aligned
  with `button` and `input` of the same size): `sm → --lv-space-8` (32 px), `md → --lv-space-9` (36 px,
  default), `lg → --lv-space-10` (40 px).
- Panel height is NOT size-controlled (it is a scrollable list; height is set by the adopter via CSS on the
  host element or a `panelHeight` utility class param — see `cssClass`).

**States**:

| state | how expressed |
|---|---|
| `disabled` (component) | `aria-disabled="true"` on both listbox roots + `disabled` on all buttons; dims the whole component; no items selectable; no moves possible |
| item `disabled` | `aria-disabled="true"` on the `role="option"` element; `collection-nav` skips disabled items during roving; `toggleSourceItem`/`toggleTargetItem` server-validates and rejects disabled ids |
| item selected (checked) | `aria-selected="true"` on the `role="option"` element; item gets the selection accent background |
| panel "select all" checkbox | indeterminate when some (not all) visible items are selected; checked when all visible selected; synced server-side via the `@Wire` sets |
| `aria-busy` | set by the runtime `beforeCall`/`afterCall` hook on the component root during wire round-trips; components do nothing extra |
| search active | the filtered count is reflected in the panel subtitle aria-live region ("Showing N of M items") |
| empty panel | a zero-item panel renders a placeholder region (`role="status"`) with "No items" or "No results" (filtered) text |

---

## 4. The a11y contract (the heart — the dual-listbox model)

- **WAI-ARIA pattern**: APG Listbox — applied TWICE (once per panel), multi-select recommended model
  (`aria-multiselectable="true"`, Space to toggle, Shift+Arrow to extend).
  Authoritative source: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
  Rearrangeable-listbox example (keyboard + button idiom):
  https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-rearrangeable/

- **roles + ARIA** (template-emitted, server-rendered):

  *Each panel root*:
  ```
  role="listbox"
  aria-multiselectable="true"
  aria-labelledby="<panelTitleId>"
  aria-activedescendant="<activeOptionId>"   ← managed by collection-nav enhancer
  tabindex="0"                               ← listbox takes focus as a unit
  data-lv-transfer-panel="source|target"     ← data hook for enhancer + tests
  ```

  *Each item*:
  ```
  role="option"
  id="<cid>-<panel>-<itemId>"               ← stable id for aria-activedescendant
  aria-selected="${selected ? 'true' : 'false'}"
  aria-disabled="${item.disabled ? 'true' : 'false'}"
  data-item-id="<escaped itemId>"           ← SAFE escaped channel for wire action
  ```

  *Select-all checkbox above each panel*:
  ```
  role="checkbox"   (a real <input type="checkbox">)
  aria-label="Select all <sourceTitle|targetTitle> items"
  aria-checked="true|false|mixed"           ← server emits the tristate
  ```

  *Move buttons (between panels)*:
  ```
  <button> (real native button) with aria-label:
    "Move selected to <targetTitle>"  (→)
    "Move all to <targetTitle>"       (→→)
    "Move selected to <sourceTitle>"  (←)
    "Move all to <sourceTitle>"       (←←)
  disabled when the relevant selected set is empty (or when oneWay for ← buttons)
  ```

  *Search inputs (when searchable)*:
  ```
  <input type="search" role="searchbox">
  aria-label="Search <sourceTitle|targetTitle>"
  aria-controls="<listboxId>"
  ```

  *Panel header region* (title + count):
  ```
  id="<panelTitleId>"   ← referenced by aria-labelledby on the listbox
  ```

  *Filtered-count live region*:
  ```
  role="status" aria-live="polite" aria-atomic="true"
  ```

  *Empty-state placeholder* (zero visible items):
  ```
  role="status"
  aria-live="polite"
  ```

- **keyboard map** (verified against the APG listbox pattern page + rearrangeable example):

  | key | context | does | who |
  |---|---|---|---|
  | Tab | anywhere | move focus to the next focusable: search input → listbox → move buttons → other panel search → other listbox | platform |
  | Shift+Tab | anywhere | reverse focus order | platform |
  | Down Arrow | listbox focused | move `aria-activedescendant` to the next option (wraps to first); skips disabled items | `collection-nav` |
  | Up Arrow | listbox focused | move `aria-activedescendant` to the previous option (wraps to last); skips disabled | `collection-nav` |
  | Home | listbox focused | move `aria-activedescendant` to first non-disabled option | `collection-nav` |
  | End | listbox focused | move `aria-activedescendant` to last non-disabled option | `collection-nav` |
  | Space | listbox focused | toggle `aria-selected` of the active option → fires `toggleSourceItem`/`toggleTargetItem` wire action | `collection-nav` → wire |
  | Shift+Down Arrow | listbox focused | extend selection: move active to next option AND toggle its selected state | `collection-nav` → wire (per-item toggle) |
  | Shift+Up Arrow | listbox focused | extend selection: move active to prev option AND toggle its selected state | `collection-nav` → wire |
  | Ctrl+Shift+Home | listbox focused | select from active option to first option (inclusive) | `collection-nav` → wire (bulk toggle) |
  | Ctrl+Shift+End | listbox focused | select from active option to last option (inclusive) | `collection-nav` → wire |
  | Ctrl+A (or Cmd+A) | listbox focused | select all visible (non-disabled) options in this panel | `collection-nav` → wire (`toggleSourceItem` / `toggleTargetItem` each) |
  | typeahead (printable char) | listbox focused | move `aria-activedescendant` to the next option whose label starts with the typed char | `collection-nav` |
  | Enter | move button focused | activate the button (fires `moveRight` / `moveLeft` / `moveAllRight` / `moveAllLeft`) | platform (native `<button>`) |
  | Space | move button focused | same as Enter | platform |
  | Enter | search input focused | no-op (search is live via `l:model.debounce`; Enter does not trigger a separate action) | platform |
  | Escape | search input focused | clear the search query → fires `setSourceQuery("")` / `setTargetQuery("")` | `collection-nav` (registers the Esc handler on the search input) |

  **Note on focus vs. active-descendant**: DOM focus stays on the `role="listbox"` root (a `<div tabindex="0">`
  or `<ul tabindex="0">`); the ACTIVE option is virtual, tracked via `aria-activedescendant`. This is the
  canonical APG listbox model. `collection-nav` owns this virtual-focus mechanism; lievit's morph preserves
  the DOM focus on the listbox root across re-renders.

- **focus management**:
  - **Initial focus on mount**: no auto-focus. The first Tab into the component lands on the source search
    input (if `searchable`) or the source listbox root.
  - **Within-panel order** (Tab sequence inside one panel): search input (if visible) → listbox root →
    [Tab exits to the button column]. Focus does NOT enter individual `role="option"` elements (they are
    virtual via `aria-activedescendant`, not in the tab order — `tabindex="-1"` on each option).
  - **Button column order**: → button → →→ button → ← button (if !oneWay) → ←← button (if !oneWay).
  - **After a move action**: after `moveRight()` or `moveLeft()`, the server re-renders, the morph patches,
    and focus returns to the move button that was activated (the morph preserves the button identity). The
    `collection-nav` enhancer reinitialises `aria-activedescendant` to the first non-disabled option in the
    affected panel on the next time the listbox receives focus.
  - **After a search clear**: when the Esc handler fires `setSourceQuery("")`, the server re-renders the
    source panel, focus returns to the source search input (identity preserved by morph).
  - **No focus trap**: the transfer is non-modal; Tab freely exits the component.
  - **Scroll management**: `collection-nav` scrolls the active option into view within the listbox panel
    whenever `aria-activedescendant` changes (the same mechanism as select/combobox).
  - **Two `collection-nav` instances**: one is mounted on the source listbox root, one on the target. They
    are independent (moving focus from one panel's listbox to the other via Tab is handled by platform Tab,
    not by `collection-nav`). Each instance is identified by its panel's `data-lv-transfer-panel` hook.

- **live regions**:
  - Filtered-count announcement: `role="status"` region above each panel updates when `sourceQuery` /
    `targetQuery` changes ("Showing 5 of 20 items"). `aria-live="polite"`.
  - Empty-state: `role="status"` when the filtered list is zero items ("No results for 'xyz'").
  - After bulk move: a `role="status"` announcement fires: "3 items moved to <targetTitle>". Uses the
    shared announcer (reused from toast/notification-bell).

- **shared mechanisms composed**:
  - `collection-nav.enhancer.ts` — two instances (source + target listbox roots); supplies roving
    `aria-activedescendant`, typeahead, Home/End, Space-toggle, Shift+Arrow extension, Ctrl+Shift boundary,
    Ctrl+A all-select, Esc-to-clear-search. Do NOT re-implement any of these.
  - The shared announcer (live-region; reused from toast/notification-bell) — fires the move-count message.
  - No popover seam (the transfer is not an overlay).
  - No focus-trap (the transfer is non-modal).

---

## 5. Tokens

**Colour tokens consumed** (all OKLCH source-of-truth):

| token | usage |
|---|---|
| `--lv-color-bg` | panel background |
| `--lv-color-border` | panel border + item divider |
| `--lv-color-fg` | item label primary text |
| `--lv-color-muted` | item description secondary text, count subtitle |
| `--lv-color-accent` | selected item background tint |
| `--lv-color-accent-fg` | selected item label text (when accent bg contrasts) |
| `--lv-color-primary` | select-all checkbox checked fill |
| `--lv-color-primary-fg` | select-all checkbox check mark |
| `--lv-color-input` | search input background |
| `--lv-color-input-fg` | search input text |
| `--lv-color-destructive` | N/A for transfer itself; inherited by disabled destructive-intent callers |
| `--lv-color-disabled` | disabled item label + background tint |
| `--lv-color-overlay` | not used (no modal) |

**Structural tokens consumed**:

| token | usage |
|---|---|
| `--lv-space-8` | sm item row height |
| `--lv-space-9` | md item row height (default) |
| `--lv-space-10` | lg item row height |
| `--lv-space-2` | item horizontal padding (tight) |
| `--lv-space-3` | item horizontal padding (default) |
| `--lv-space-4` | panel padding (inner) |
| `--lv-space-6` | gap between panel and button column |
| `--lv-radius-md` | panel border-radius |
| `--lv-radius-sm` | item hover/selected border-radius |
| `--lv-ring` | focus-visible ring on listbox root + move buttons |
| `--lv-shadow-xs` | panel shadow (subtle elevation) |
| `--lv-text-sm` | item label size |
| `--lv-text-xs` | item description + count |
| `--lv-font-sans` | panel typography |
| `--lv-z-base` | no z stacking needed (non-overlay) |

**NET-NEW tokens proposed**: none. The transfer surface composes existing panel + accent + input tokens.
No new colour or structural token is needed; the two-panel layout is achieved with flex/grid utilities over
existing spacing tokens.

---

## 6. Wire actions (WIRE + ENH)

**`l:*` directives the template binds**:

```
source listbox root:
  data-lv-transfer-panel="source"
  data-lv-collection-nav        ← collection-nav mounts here
  l:keydown.space="..."         ← collection-nav intercepts; fires toggleSourceItem with active id
  l:keydown.ctrl+a="..."        ← collection-nav intercepts; fires bulk-select

target listbox root:
  data-lv-transfer-panel="target"
  data-lv-collection-nav
  (symmetric)

each source option:
  l:click="toggleSourceItem"    ← SAFE channel: item id via data-item-id (escaped)
  data-item-id="<escaped id>"

each target option:
  l:click="toggleTargetItem"
  data-item-id="<escaped id>"

select-all checkbox (source):
  l:change="moveAllRight"       ← simplified: the server resolves "check all visible" semantics
  (actually bound as a named wire action with a query param; see below)

search input (source):
  l:model.debounce.250ms="sourceQuery"   ← debounced morph
  (Esc handler registered by collection-nav; fires setSourceQuery(""))

search input (target):
  l:model.debounce.250ms="targetQuery"

move → button:
  l:click="moveRight"

move →→ button:
  l:click="moveAllRight"

move ← button:
  l:click="moveLeft"

move ←← button:
  l:click="moveAllLeft"
```

**Server action signatures (Java)**:

```java
@LievitAction
public void toggleSourceItem(@LievitParam("id") String id) {
    // validate id ∈ sourceList and !item.disabled BEFORE mutating
    if (sourceSelected.contains(id)) sourceSelected.remove(id);
    else sourceSelected.add(id);
}

@LievitAction
public void toggleTargetItem(@LievitParam("id") String id) {
    // symmetric; validates id ∈ targetList
}

@LievitAction
public void moveRight() {
    // validate ALL ids in sourceSelected ∈ sourceList (reject any stale/injected ids)
    targetList.addAll(sourceList.removeIf(item -> sourceSelected.contains(item.id())));
    sourceSelected.clear();
}

@LievitAction
public void moveLeft() {
    if (oneWay) return;    // server-enforced, not just UI-hidden
    // symmetric
    targetSelected.clear();
}

@LievitAction
public void moveAllRight() {
    // moves all visibleSourceItems() (filtered); respects disabled (skips them)
    sourceSelected.clear();
}

@LievitAction
public void moveAllLeft() {
    if (oneWay) return;
    sourceSelected.clear(); targetSelected.clear();
}

@LievitAction
public void setSourceQuery(@LievitParam("q") String q) {
    this.sourceQuery = q;   // re-renders; visibleSourceItems() filters on next render
}

@LievitAction
public void setTargetQuery(@LievitParam("q") String q) {
    this.targetQuery = q;
}
```

**Escaping contract** (the XSS rule):
Item ids from `TransferItem.id()` are treated as SAFE when emitted as `data-item-id` only through
the `wireArgs`/`dataAttrs` escaped channel (`Escape.htmlAttribute`), NEVER via `attrs` (trusted-raw).
The server validates every incoming id against its list BEFORE mutating state, so a hostile id is
rejected at the action level even if it somehow arrives.

**Round-trip anatomy**:

1. User Arrows to an option → `collection-nav` updates `aria-activedescendant` (client only, no round-trip).
2. User presses Space → `collection-nav` fires `toggleSourceItem` wire action with the active id.
3. Server validates id, toggles `sourceSelected`, re-renders the panel → morph patches options'
   `aria-selected` attributes + the select-all checkbox tristate. Focus stays on the listbox root (morph
   preserves).
4. User clicks → button → `moveRight` wire action fires.
5. Server moves items, clears selection, re-renders BOTH panels → morph patches both list contents. The →
   button becomes `disabled` (nothing selected in source now). The announcement fires: "N items moved to
   <targetTitle>".
6. Morph returns focus to the → button (identity-preserving); `collection-nav` on the target listbox will
   set its `aria-activedescendant` to the first option on next keyboard entry.

**Enhancer responsibilities** (`collection-nav`, two instances):
- Mount: scan `[role="option"]` children of the listbox root; set `aria-activedescendant` on the listbox
  to the first non-disabled option (or the first `aria-selected` if any).
- Arrow keys: update `aria-activedescendant` + scroll into view. NO wire call.
- Space: read the active option's `data-item-id`; fire the matching `toggle*` wire action via the runtime
  directive. Validate the id is non-null and the option is not `aria-disabled`.
- Shift+Arrow: move active + queue a `toggle*` for the new active item (fires one wire call per step).
- Ctrl+A: collect all `[role="option"]:not([aria-disabled])` ids; fire one `toggleSourceItem`/
  `toggleTargetItem` per id (or a dedicated `selectAllVisible` action if the server provides one — the
  implementation may batch via a future `@LievitAction List<String>` overload).
- Ctrl+Shift+Home/End: same pattern — one toggle per item between active and boundary.
- Typeahead: jump `aria-activedescendant` to the next option whose `textContent` starts with the char.
- Esc on the search input: fire `setSourceQuery("")` / `setTargetQuery("")` via the wire.
- After a morph: the runtime lifecycle hook (`onComponentMorph`) re-scans `[role="option"]` to rebuild the
  internal list; `aria-activedescendant` is re-pointed to the same id if it still exists, or reset to
  first option.

---

## 7. Acceptance tests (the gate — refute-by-default)

The component is DONE only when ALL tests pass on a REAL substrate. Mocked substrates certify nothing about
the actual interaction (the client-island-fidelity lesson — CLAUDE.md §client-island-test-fidelity).

**render** (real `LievitRuntime` + jsdom, REAL `collection-nav` mounted — not a mocked `$lievit`):
- `transfer-renders-both-panels`: mount with source=[A,B,C], target=[D,E]; assert two `role="listbox"`
  elements present; source contains A,B,C with `role="option"`; target contains D,E.
- `transfer-renders-panel-labels`: `aria-labelledby` on each listbox root resolves to the correct panel
  title text.
- `transfer-renders-aria-selected`: items in `sourceSelected` have `aria-selected="true"`; others
  `aria-selected="false"`.
- `transfer-renders-select-all-tristate`: select-all checkbox is `indeterminate` when some (not all) items
  selected; `checked` when all; unchecked when none.
- `transfer-renders-move-buttons-disabled-when-nothing-selected`: the → and ← buttons have `disabled` attr
  when their respective selected set is empty.
- `transfer-renders-oneway-hides-left-buttons`: when `oneWay=true`, the ← and ←← buttons are absent from
  the DOM.
- `transfer-renders-disabled-item`: a disabled `TransferItem` has `aria-disabled="true"` on its option
  element.
- `transfer-renders-search-inputs`: when `searchable=true`, each panel has an `<input type="search">` with
  `aria-label` citing the panel title.
- `transfer-renders-empty-state`: when source is empty (or filtered to zero), the empty-state `role="status"`
  region is present with non-empty text content.
- `transfer-renders-count-live-region`: the filtered-count `role="status"` region is present above each panel.

**axe-core**:
- `transfer-axe-source-panel`: zero axe violations on the rendered source listbox subtree (cites:
  `listbox`, `aria-required-children`, `aria-activedescendant-refers-to-descendant`, `scrollable-region-focusable`).
- `transfer-axe-target-panel`: zero axe violations on the rendered target listbox subtree.
- `transfer-axe-move-buttons`: zero axe violations on all four move buttons (no icon-only button without
  `aria-label`).
- `transfer-axe-full-component`: zero axe violations on the full component DOM.

**keyboard** (each key in the §4 map asserted on the REAL `collection-nav` enhancer):
- `transfer-keyboard-arrow-down-moves-active`: focus source listbox, press ArrowDown → assert
  `aria-activedescendant` changes to the next option id.
- `transfer-keyboard-arrow-up-wraps`: focus on first option, press ArrowUp → assert active wraps to last.
- `transfer-keyboard-home-end`: Home → first non-disabled option active; End → last.
- `transfer-keyboard-space-toggles-selection`: active option not selected; press Space → `toggleSourceItem`
  fires → morph → option now has `aria-selected="true"`.
- `transfer-keyboard-shift-arrow-extends-selection`: select option 0; Shift+ArrowDown → option 1 becomes
  active AND toggled selected (fires wire action; after morph option 1 `aria-selected="true"`).
- `transfer-keyboard-ctrl-a-selects-all`: Ctrl+A on source → all visible non-disabled options become
  `aria-selected="true"` (asserted after morph).
- `transfer-keyboard-ctrl-shift-end-selects-to-end`: active on option 1; Ctrl+Shift+End → all options from
  1 to last become `aria-selected="true"`.
- `transfer-keyboard-typeahead-jumps`: source has items ["Alpha", "Beta", "Gamma"]; press 'G' → active
  moves to "Gamma".
- `transfer-keyboard-esc-clears-search`: focus search input, type "foo" → `sourceQuery="foo"`; press Esc
  → `setSourceQuery("")` fires → morph → search input value is empty, all source items visible.
- `transfer-keyboard-tab-exits-listbox`: Tab while source listbox focused → focus moves to the first move
  button (not another option).

**focus**:
- `transfer-focus-activedescendant-tracks-arrow`: `aria-activedescendant` on the listbox root updates
  on every Arrow press without moving DOM focus off the root element.
- `transfer-focus-skips-disabled`: ArrowDown past a disabled item → skips it; disabled item is never the
  `aria-activedescendant` value.
- `transfer-focus-morph-preserves-listbox-focus`: source listbox has DOM focus; Space fires toggle; morph
  completes; DOM focus is still on the source listbox root.
- `transfer-focus-after-move-returns-to-button`: click → button, fire `moveRight`; morph completes; assert
  DOM focus is on the → button (identity-preserving morph).
- `transfer-focus-collection-nav-reinitialises-after-morph`: after a move morph, press ArrowDown into
  target listbox; `aria-activedescendant` is a valid option id present in the updated target list.

**variants / sizes**:
- `transfer-size-sm-renders-space-8`: `size="sm"` → item rows carry the `--lv-space-8` height token class;
  search input matches.
- `transfer-size-md-default`: no `size` param → `data-size="md"` present on the root; md height token class.
- `transfer-size-lg-renders-space-10`: `size="lg"` → item rows carry the `--lv-space-10` class.
- `transfer-data-attributes`: root carries `data-slot="transfer"`, `data-size`, and (if relevant)
  `data-disabled="true"` when the component is disabled.

**wire round-trip IT** (lievit-kit, real `LievitRuntime`, CollapsibleComponentIT pattern):
- `transfer-IT-move-right`: mount with source=[A,B,C] target=[]; toggle-select A and B (two wire calls);
  fire `moveRight`; assert re-rendered target contains A,B; source contains only C; `sourceSelected` empty.
- `transfer-IT-move-left`: mount with source=[] target=[X,Y]; toggle-select X; fire `moveLeft`; assert
  source now contains X; target contains Y.
- `transfer-IT-oneway-move-left-is-noop`: `oneWay=true`, fire `moveLeft`; assert target unchanged.
- `transfer-IT-move-all-right`: mount source=[A,B,C] target=[]; fire `moveAllRight`; assert target=[A,B,C],
  source=[].
- `transfer-IT-disabled-item-not-moved`: source has item A (disabled), B; fire `moveAllRight`; assert
  target contains only B (disabled item A stays in source).
- `transfer-IT-search-filters-visible`: set `sourceQuery="b"`; assert `visibleSourceItems()` contains only
  items whose label contains "b" (case-insensitive); fire `moveAllRight`; assert only the filtered items
  moved.
- `transfer-IT-hostile-id-rejected`: call `toggleSourceItem("injected-id")` where "injected-id" is not in
  `sourceList`; assert no state mutation (server rejects); no exception propagated (safe no-op or 400).

**JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate; the transfer
template must compile with all `@param` variants (searchable/non, oneWay, disabled, empty panels).

**escaping** (the XSS abuse-case):
- `transfer-escaping-hostile-item-id`: a `TransferItem` with `id = '"><script>alert(1)</script>'`; assert
  the rendered `data-item-id` attribute value is HTML-escaped and does not inject a script element;
  assert the option renders inert (no event fires from the injected string).

**Playwright** (gesture fidelity, real substrate, legacy-VM oracle):
- `transfer-playwright-click-selects-item`: real `page.click()` on an option → the option gets the
  selected accent style + `aria-selected="true"` (assert after morph).
- `transfer-playwright-move-button-moves-items`: click option, then click → button; assert target panel
  now contains the item (panel body visible with item label — the projection assertion).
- `transfer-playwright-keyboard-full-flow`: `page.keyboard.press('ArrowDown')` through a listbox;
  `Space` to select; Tab to → button; Enter to move; assert the item appears in the target panel body
  with its label resolved (not a fake substrate — the client-island-fidelity lesson).

---

## 8. Non-goals / anti-patterns

- **No imperative JS API** (no `transfer.moveAll()` or similar): moves are server actions, triggered only
  via wire calls from the UI or from other WIRE components.
- **No client-side virtualization at this tier**: for lists of 10k+ items, use the data-grid's
  virtualization enhancer (separate component) or server-side pagination with HTMX; transfer is not the
  right component for very-large datasets.
- **No drag-and-drop reordering within a panel at this tier**: the transfer moves items between panels only;
  intra-panel reorder is the repeater/builder concern. Drag-between-panels is a possible future +ENH
  enhancement (not in this spec).
- **No framework (no Lit, no Alpine)**: `collection-nav.enhancer.ts` is a typed-vanilla-TS enhancer. The
  server renders the panel contents; the enhancer adds only the keyboard interaction.
- **No per-item Turbo Frame**: moves are whole-component wire re-renders, not Turbo Stream swaps
  (ADR-0012: delivery boundary is lievit's own morph, not Turbo).
- **No duplicating `collection-nav`**: the roving, typeahead, and Shift-extension logic MUST come from the
  shared `collection-nav.enhancer.ts`. Implementing any of these inline in the transfer template or in a
  transfer-specific enhancer is the single-source-a11y violation that this spec explicitly prevents.
- **No client-side state for selection sets**: `sourceSelected` and `targetSelected` are `@Wire` fields;
  the client never maintains a parallel selection set. After every Space/click the server is the
  authoritative state and the morph reflects it. A naive client-only checkbox-toggle would drift on any
  re-render (the projection-fidelity lesson from the calendar and dialog bugs).
- **No `<script>` or inline `on*=` in the template**: the strict CSP refuses them; all interaction goes
  through `l:*` directives and the runtime.
- **No literal colour values in the template**: all styling via `var(--lv-*)` tokens only.

---

## 9. Agent instructions (the discipline reminders)

- Generate ORIGINAL code over `--lv-*` tokens. You MAY read the WAI-ARIA APG Listbox pattern page
  (https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) and the rearrangeable-listbox example
  (https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-rearrangeable/) as keyboard-map
  references, and Ant Design Transfer as inventory reference. You MUST NOT paste literal source from
  any of them (no APG example code, no Ant Design source, no Tailwind UI code) — the output is always
  original generation. (The one bright line, `02-licensing.md`.)
- Compose `collection-nav.enhancer.ts` for BOTH listbox panels — two instances, each scoped to its
  panel root via `data-lv-transfer-panel`. Do NOT hand-roll roving, typeahead, Shift-extend, or
  `aria-activedescendant` management (that is exactly the failure mode the single-source-a11y rule
  prevents and will produce two divergent implementations when future components add a third consumer).
- The TWO `collection-nav` instances are INDEPENDENT. Cross-panel navigation (source ↔ target) is
  handled by platform Tab, not by `collection-nav`. Ensure the enhancer mount logic does not leak
  event listeners from one panel onto the other.
- Mirror the WIRE conventions (server-first refactor blueprint §1.b): owned template markup; no
  `Content` slot; `@Wire` boolean state as JTE boolean-attribute conditionals; component body is OWNED
  server-rendered markup, not a slot.
- Validate EVERY incoming action param server-side BEFORE mutating `@Wire` state: id ∈ sourceList /
  targetList; `!item.disabled`; `!oneWay` for left-move actions. Validation in Java is not optional
  (the wire protocol signs the snapshot but a client can still craft a wire call with a bad id).
- The select-all checkbox must reflect server-computed tristate (`checked` / `indeterminate` / `unchecked`)
  derived from `sourceSelected.size()` vs `visibleSourceItems().size()`. Do not compute this client-side.
- The move buttons MUST be `disabled` when the corresponding selected set is empty (server renders the
  `disabled` attribute conditionally). A disabled move button with no items selected is a real UX + a11y
  requirement (a screen reader must hear "Move selected to Target — dimmed" not "Move selected to Target").
- Emit the move-count announcement via the shared announcer after every `moveRight`/`moveLeft`/
  `moveAllRight`/`moveAllLeft` action ("N items moved to <targetTitle>").
- The render tests MUST assert the BODY content of each panel is VISIBLE and contains the expected items
  (the projection assertion — never just "the template has a listbox div"). Empty panels must render their
  `role="status"` placeholder, never a silent blank region.
- Minimal code to GREEN against the acceptance tests; refactor only while green.
