<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — cascader (WIRE + ENH: multi-level select, tree/listbox hybrid)

- **tier**: WIRE + ENH (`collection-nav.enhancer.ts`, the shared collection roving/typeahead mechanism,
  parameterised for multi-panel cascading navigation; the popover seam for positioning + light-dismiss)
- **build sequence**: S2
- **status (current)**: NET-NEW
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Tree View pattern (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) + APG
      Listbox pattern (https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) as joint references —
      **BUILT against raw APG** (react-aria has no `useCascader`; this is a Radix-gap case per `03`
      §legend). The keyboard model is the APG Tree keyboard map (Right/Left to enter/exit a level,
      Up/Down to navigate within a level, Enter to select, typeahead) with the popover seam for
      positioning. Focus management via `collection-nav` (multi-panel roving + typeahead), NOT a
      hand-roll. No react-aria source copied.
    - inventory: Ant Design Cascader as inventory reference (multi-level drill-down, searchable,
      single-select + multi-select with `checkable`, custom option render, async lazy-load, `changeOnSelect`
      for intermediate selection). Feature set translated to ORIGINAL template + WIRE; no AD source copied.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI (NO
      code copied)

---

## 1. What it is

A **cascader** is a multi-level hierarchical selector: the user drills through a sequence of panels
(one panel per depth level), choosing an option at each level, until a terminal leaf is selected (or,
with `changeOnSelect`, any intermediate node can also be the selection).
It surfaces as a **trigger button** that shows the current selection path (e.g. "Province / City /
District") and, when activated, opens a horizontally-arrayed panel stack — level-0 options in the
first panel, clicking/arrowing into a parent node opens a sibling panel for its children, and so on.

**Why WIRE**: the full option tree and the active selection path are server facts. The server holds the
tree, resolves which nodes are expanded, tracks the committed value, and re-renders the trigger label.
**Why +ENH**: the irreducible client work — roving focus across panels, typeahead within a panel,
keyboard expansion of child panels, focus transfer between panels on Left/Right — cannot survive a
server round-trip without unacceptable UX latency. The `collection-nav` enhancer (the single shared
source for all collection keyboard patterns in this library) is extended/parameterised to handle the
multi-panel, inter-panel navigation characteristic of a cascader. **Why popover seam**: the panel
stack is positioned relative to the trigger (anchored, light-dismiss on outside click/Esc); all
overlays in this library compose the ONE popover seam.

Server-first works because: the COMMITTED selection (`value`) is a server fact rendered into the
trigger; the tree structure is locked server config; the drill-down path (`expandedIds`) is a `@Wire`
field the server tracks; the visual re-render after commit (trigger label update) is a morph. Only the
transient intra-panel navigation (arrow keys, typeahead highlight) is client-only and stays in the
enhancer without a wire round-trip.

---

## 2. API — the WIRE surface + template params

### Java (`CascaderComponent`)

| member | kind | meaning |
|---|---|---|
| `options` `List<CascaderNode>` | `@Wire @LievitProperty(locked=true)` | the full node tree (id + label + children + disabled + leaf flag); locked — a client cannot inject or modify nodes |
| `value` `List<String>` | `@Wire` | the selected path as an ordered list of node ids from root to the committed node (e.g. `["guangdong", "shenzhen", "longhua"]`); empty list = nothing selected |
| `expandedIds` `List<String>` | `@Wire` | the ids of the currently drill-expanded nodes (one per panel column, left to right); drives which panel columns the template renders and which child panel is open |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | trigger label when `value` is empty |
| `multiple` `boolean` | `@Wire @LievitProperty(locked=true)` | enables multi-select with checkboxes at every level; `value` is then `List<List<String>>` — a list of committed paths |
| `checkable` `boolean` | `@Wire @LievitProperty(locked=true)` | (only relevant when `multiple=true`) enables parent-level checkboxes that cascade-check all children; default `false` when `multiple=false` |
| `changeOnSelect` `boolean` | `@Wire @LievitProperty(locked=true)` | allow committing an intermediate (non-leaf) node; default `false` (only leaf commits) |
| `searchable` `boolean` | `@Wire @LievitProperty(locked=true)` | shows a search input that flattens the tree into a filtered list of leaf paths matching the query |
| `query` `String` | `@Wire` | live search text (when `searchable`); `l:model.debounce`; the server recomputes `flatMatchedPaths()` |
| `open` `boolean` | `@Wire` | popover open state |
| `disabled` `boolean` | `@Wire @LievitProperty(locked=true)` | renders the trigger disabled; all interaction blocked |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `sm \| md \| lg`; height-based, aligns with button/input of same size |
| `expandTrigger` `String` | `@Wire @LievitProperty(locked=true)` | `"click"` (default) \| `"hover"` — whether hovering a parent node auto-drills into its children (hover wires a debounced wire action) |
| `open()` | `@LievitAction` | sets `open=true`; resets `expandedIds` to the path of the current `value` (so re-opening re-drills to the current selection) |
| `close()` | `@LievitAction` | sets `open=false`; discards in-flight drill (does NOT clear `value`) |
| `expand(String nodeId)` | `@LievitAction` | drills into a parent node: appends `nodeId` to `expandedIds`; validates `nodeId` ∈ `options` tree and is a non-leaf; truncates `expandedIds` to the depth of `nodeId` + 1 (so drilling into a sibling replaces the child panel) |
| `commit(List<String> path)` | `@LievitAction` | commits a selection path; validates every id in `path` ∈ `options` tree and path is valid root-to-node; sets `value` (replaces for single, appends/removes for multi); closes if `!multiple` |
| `removeValue(List<String> path)` | `@LievitAction` | (multi only) removes one committed path from `value`; validates path ∈ current `value` |
| `clearAll()` | `@LievitAction` | clears `value` to empty; `open=false` |
| `visiblePanels()` | getter on `_instance` | list of `CascaderPanel` (one per depth level visible given `expandedIds`); read by the template; `@LievitProperty(serialize=false)` |
| `flatMatchedPaths()` | getter on `_instance` | (searchable only) list of `List<CascaderNode>` — full paths matching `query`; read by the template; `@LievitProperty(serialize=false)` |
| `triggerLabel()` | getter on `_instance` | resolved display string: e.g. `"Province / City"` from the current `value`; `@LievitProperty(serialize=false)` |

**`CascaderNode`** (inner value type, locked server config):

| field | type | meaning |
|---|---|---|
| `id` | `String` | stable unique identifier for this node across the whole tree |
| `label` | `String` | display text |
| `children` | `List<CascaderNode>` | child nodes; empty list = leaf |
| `disabled` | `boolean` | node cannot be selected or expanded |
| `leaf` | `boolean` | explicit leaf marker (for async lazy-load: `children` may be empty but `leaf=false` means "children exist, fetch them") |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param CascaderComponent _instance` (for `visiblePanels()`, `flatMatchedPaths()`, `triggerLabel()`).
No `Content` slot (WIRE has none — the template owns all markup).

---

## 3. Variants / sizes / states

### Sizes
Height-based (toolbar-aligned, the library-wide contract):
- `sm` → trigger height `--lv-space-8` (32 px); panel row height `--lv-space-8`; text `--lv-text-sm`
- `md` → trigger height `--lv-space-9` (36 px, default); panel row height `--lv-space-9`; text `--lv-text-sm`
- `lg` → trigger height `--lv-space-10` (40 px); panel row height `--lv-space-10`; text `--lv-text-base`

Horizontal padding and the trigger's internal icon size scale with the height token.

### State matrix

| State | How triggered | ARIA + visual |
|---|---|---|
| **closed** | default | trigger visible; popover absent from DOM |
| **open** | `open=true` | popover present; `aria-expanded="true"` on trigger |
| **drilling** | a parent node is highlighted | the highlight class applied; `aria-selected` on the active row; child panel renders beside it |
| **selected** | `value` non-empty | trigger shows `triggerLabel()`; the committed path nodes carry `aria-selected="true"` in the panels when open |
| **disabled** | `disabled=true` | trigger has native `disabled`; `aria-disabled`; all interaction blocked |
| **node disabled** | `CascaderNode.disabled=true` | the row gets `aria-disabled="true"`; skipped by arrow-nav enhancer; click/Enter inert |
| **aria-invalid** | set by the consuming `field` wrapper | destructive border + ring on trigger |
| **aria-busy** | runtime `beforeCall`/`afterCall` during wire round-trip | runtime-managed; spinner on trigger |
| **searchable — filtering** | `query` non-empty | flat matched-paths panel renders instead of drill panels |
| **multiple — checked** | `value` contains the path | row checkbox `aria-checked="true"`; parent rows show `aria-checked="mixed"` when some children are selected |

### Variants
The cascader is a form-control; it has no `variant` intent dimension of its own (no primary/destructive).
The `field` wrapper supplies the surrounding intent (error state via `aria-invalid`). The trigger inherits
the `outline` button look from the button partial with no extra variant param.

---

## 4. The a11y contract (the heart — the overlay + tree/listbox hybrid)

### WAI-ARIA pattern
**APG Tree View** (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) for the panel-level keyboard
model (Right/Left across levels, Up/Down within a level, typeahead, expand/collapse) plus **APG Listbox**
(https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) for each individual panel column (a flat ordered
list of options within one depth level). This is a **BUILT** case (no react-aria `useCascader` exists;
the pattern is derived from the raw APG tree model, adapted to the side-by-side panel layout).

### Roles + ARIA

| Element | Role / attribute | Value / meaning |
|---|---|---|
| Trigger `<button>` | `role="combobox"` | it is the popover trigger AND shows the current value |
| Trigger | `aria-haspopup="tree"` | the popup is a tree-structured panel stack |
| Trigger | `aria-expanded="${open}"` | reflects the open state |
| Trigger | `aria-controls="<panelStackId>"` | points to the popover root |
| Trigger | `aria-label` / visible text | `triggerLabel()` or `placeholder`; the accessible name of the control |
| Trigger | `aria-disabled` | when `disabled=true` (native `disabled` used; `aria-disabled` on any `<a>`-trigger fallback) |
| Trigger | `aria-invalid` | set externally by the `field` wrapper if validation fails |
| Panel stack root | `role="tree"` id=`<panelStackId>` | the composite tree widget; `aria-label` = the field label (via `aria-labelledby` → trigger or `<label>`) |
| Panel stack root | `aria-multiselectable="${multiple}"` | `"true"` when `multiple=true` |
| Each panel column | `role="group"` `aria-label="Level N"` | groups sibling options at one depth level; rendered as a visual column |
| Each option row | `role="treeitem"` | each selectable / expandable node |
| Expandable option | `aria-expanded="${nodeIsExpanded}"` | `"true"` when the node's child panel is currently open |
| Leaf or selected node | `aria-selected="${nodeInValuePath}"` | `"true"` when this node is in the committed value path (single-select) |
| Checked node (multi) | `aria-checked="${checkState}"` | `"true"` / `"false"` / `"mixed"` for multi + checkable |
| Option row | `aria-disabled="${node.disabled}"` | for disabled individual nodes |
| Option row | `aria-level="${depth+1}"` | 1-based depth within the tree (APG Tree attribute) |
| Option row | `aria-setsize="${siblingsCount}"` | count of siblings at this level |
| Option row | `aria-posinset="${positionInParent}"` | 1-based position among siblings |
| Expand chevron | `aria-hidden="true"` | decorative; the row's `aria-expanded` carries the semantics |
| Search input (searchable) | `role="searchbox"` | distinct from `combobox` — it filters, not selects from an autocomplete |
| Search input | `aria-controls="<panelStackId>"` | the filtered results appear in the tree |
| Search result item | `role="treeitem"` | each matched path row in the flat results list |
| Trigger (multi — chips) | each chip has `aria-label="Remove <path>"` | the remove ×  button on each selected-path chip |
| Active node (virtual) | `aria-activedescendant="<activeRowId>"` on tree root | the enhancer sets this; DOM focus stays on the tree root (APG virtual-focus model) |

### Keyboard interaction map

The APG Tree keyboard model applies within the open panel stack. Arrow navigation is managed by
`collection-nav.enhancer.ts` (multi-panel mode). Platform handles Tab and the trigger activation.

| Key | Does | Who |
|---|---|---|
| Enter / Space (trigger, closed) | opens the popover; focus moves to the active/selected node, or first node at root level | enhancer (fires `open()` wire action, then initialises focus) |
| Right Arrow | if on a parent node: expands it (fires `expand(nodeId)`) and moves focus to its first child in the new panel; if already expanded: moves focus to first child; if on a leaf node: no-op | enhancer → wire (`expand`) |
| Left Arrow | if focus is inside a child panel: collapses that panel and returns focus to the parent node in the previous panel; if focus is at the root level: no-op | enhancer (client navigate; no wire — `expandedIds` stays until commit or close) |
| Down Arrow | moves focus to the next visible `treeitem` within the same panel column (does NOT expand/collapse); wraps if `expandedIds` makes a child panel present, the Down from the last node of a parent panel does NOT enter the child panel (Left/Right own cross-panel nav) | enhancer |
| Up Arrow | moves focus to the previous `treeitem` in the same panel column | enhancer |
| Home | moves focus to the first `treeitem` in the current panel column | enhancer |
| End | moves focus to the last `treeitem` in the current panel column | enhancer |
| typeahead (printable char) | moves focus to the next `treeitem` in the current panel column whose label starts with the typed character; cycles | enhancer |
| Enter (on a leaf treeitem, or non-leaf when `changeOnSelect=true`) | commits the selection: fires `commit(pathToActiveNode)` wire action | enhancer → wire (`commit`) |
| Enter (on a non-leaf when `changeOnSelect=false`) | same as Right Arrow: expands + moves to first child | enhancer → wire (`expand`) |
| Space (multi + checkable) | toggles the `aria-checked` state of the active node (fires `commit` or `removeValue` for the path); for a parent node, also cascade-checks all descendants | enhancer → wire (`commit` / `removeValue`) |
| Esc | closes the popover (fires `close()`) and returns focus to the trigger; discards in-flight drill | enhancer → wire (`close`) |
| Tab | closes the popover (no trap — a cascader is non-modal) and advances focus to the next focusable element in the page | enhancer + platform |
| Shift+Tab | closes the popover and moves focus to the previous focusable element | enhancer + platform |
| * (asterisk) — optional | expands all sibling parent nodes at the current panel level | enhancer → wire (fires `expand` for each sibling) |

**Searchable mode keyboard** (when `searchable=true` and `query` non-empty, the flat results list
replaces the panel stack):

| Key | Does | Who |
|---|---|---|
| Down Arrow / Up Arrow | moves focus among matched-path result rows | enhancer (collection-nav flat mode) |
| Home / End | first / last result row | enhancer |
| typeahead | jumps to next result whose leaf label starts with the character | enhancer |
| Enter | commits the highlighted result path: fires `commit(matchedPath)` | enhancer → wire |
| Esc | closes the popover | enhancer → wire |

### Focus management

- **Virtual focus model**: DOM focus stays on the `role="tree"` root element at all times while the
  popover is open. The active `treeitem` is indicated via `aria-activedescendant` on the tree root,
  managed by `collection-nav`. This is the APG-specified model for tree widgets and avoids
  focus-loss-on-morph during wire round-trips.
- **Initial focus on open**: on `open()`, the enhancer sets `aria-activedescendant` to the id of the
  deepest node in the current `value` path (so re-opening re-drills to the current selection visually
  AND in keyboard focus). If `value` is empty, initial focus = first root node.
- **Panel change on Right/expand**: focus (aria-activedescendant) moves to the first child node in
  the newly revealed panel; the tree root already has DOM focus so no focus movement is needed.
- **Panel collapse on Left**: focus (aria-activedescendant) moves back to the parent node that was
  expanded; no DOM focus movement.
- **Focus restore on close**: on Esc / Tab / commit-close, DOM focus returns to the trigger button
  (the element that opened the popover). The enhancer records the trigger before opening and restores it.
- **No focus trap**: a cascader is non-modal. Tab escapes. The popover seam handles light-dismiss
  (click outside, Esc). The `focus-trap` enhancer is NOT composed here (only modal overlays trap).
- **Scroll into view**: when `aria-activedescendant` changes, the enhancer scrolls the active row
  into view within its panel column (the panel columns can be individually scrollable for deep trees).

### Live region

When `searchable`: after a `query` change, the re-rendered flat list count is announced via the
shared live-region announcer ("N results" or "No results"). Uses `role="status"` (polite).

### Shared mechanisms composed

- `collection-nav.enhancer.ts`: multi-panel mode (roving `aria-activedescendant` across panel
  columns with Left/Right cross-panel transfers, typeahead within a panel, scroll-into-view). This
  is a new parameterisation of the same shared enhancer (not a new hand-roll). Do NOT re-implement.
- **Popover seam**: native `popover` attribute + CSS Anchor Positioning for the panel stack panel;
  light-dismiss on outside-click and Esc. Shared with `select`, `combobox`, `dropdown-menu`, etc.
  Do NOT re-implement positioning.
- **Shared announcer**: result-count live region (same as `select` searchable mode).

---

## 5. Tokens

### Consumed tokens

| Token | Used for |
|---|---|
| `--lv-color-input` | trigger button background |
| `--lv-color-border` | trigger border, panel borders |
| `--lv-color-popover` | panel background |
| `--lv-color-popover-fg` | panel option label text |
| `--lv-color-accent` | hovered / active-descendant option row background |
| `--lv-color-accent-fg` | hovered / active-descendant option row text |
| `--lv-color-primary` | selected-path option row left accent bar |
| `--lv-color-primary-fg` | selected-path option label text |
| `--lv-color-muted` | placeholder text, disabled option text |
| `--lv-color-muted-fg` | expand chevron icon, node count badge |
| `--lv-color-fg` | default trigger label text |
| `--lv-color-destructive` | `aria-invalid` trigger border + ring |
| `--lv-color-overlay` | not used (cascader is non-modal, no scrim) |
| `--lv-ring` | focus-visible ring on trigger |
| `--lv-space-2` | option row icon gap, chip gap |
| `--lv-space-3` | option row horizontal padding |
| `--lv-space-4` | panel vertical padding top/bottom |
| `--lv-space-8` | sm trigger + row height |
| `--lv-space-9` | md trigger + row height (default) |
| `--lv-space-10` | lg trigger + row height |
| `--lv-radius-md` | trigger border-radius |
| `--lv-radius-lg` | panel stack border-radius |
| `--lv-shadow-md` | panel stack elevation |
| `--lv-z-popover` | panel stack z-index |
| `--lv-text-sm` | sm/md option label size |
| `--lv-text-base` | lg option label size |
| `--lv-text-xs` | result-count badge, chip remove button |
| `--lv-font-sans` | all text |

### NET-NEW tokens proposed

| Token | OKLCH value (`:root`) | Dark re-point | Justification |
|---|---|---|---|
| `--lv-cascader-panel-width` | `12rem` | (structural, no re-point) | each panel column has a fixed minimum width; an adopter can widen all columns by overriding one token rather than targeting the internal class; structural, not a colour |
| `--lv-cascader-panel-max-height` | `16rem` | (structural, no re-point) | caps the scrollable height of each panel column for deep trees; structural token, theme-invariant |

Both are structural (sizing) tokens, not colour tokens — they require no dark-mode block.
No new colour tokens are introduced; the cascader composes existing semantic colour pairs.
These two tokens are additive (new namespace `--lv-cascader-*`), do not collide with existing
tokens, and reduce the adopter's override surface compared to magic numbers baked into classes.

---

## 6. Wire actions / enhancer integration

### `l:*` directives on the template

| Directive | Element | Meaning |
|---|---|---|
| `l:click="open"` | trigger `<button>` | opens the popover; enhancer takes over keyboard after open |
| `l:click="close"` | trigger `<button>` (when open, the trigger acts as a toggle) | closes popover |
| `l:click="expand" data-id="<escaped nodeId>"` | each expandable option row | drills into the node; id goes through the SAFE `wireArgs` / `dataAttrs` channel (Escape.htmlAttribute) |
| `l:click="commit" data-path="<escaped JSON path>"` | each leaf option row (or any row when `changeOnSelect`) | commits the full path; the path is escaped as a JSON array string via Escape.htmlAttribute |
| `l:click="removeValue" data-path="<escaped JSON path>"` | chip remove button (multi) | removes one committed path |
| `l:click="clearAll"` | clear-all × button (when value non-empty) | clears all selections |
| `l:model.debounce.200ms="query"` | search input (searchable) | debounced query → triggers re-render of `flatMatchedPaths()` |
| `l:mouseenter="expand" data-id="<escaped nodeId>"` | expandable row (when `expandTrigger="hover"`) | hover-expands; debounced on the wire side (expand action can be a no-op if already expanded or if another expand is in flight) |

### Server action signatures

```java
// opens the popover; resets expandedIds to the current value path
void open() {
    this.open = true;
    this.expandedIds = pathOf(this.value);  // resolve ids from root to current value
}

// closes the popover without changing value
void close() {
    this.open = false;
    // expandedIds intentionally NOT reset here; open() re-seeds from value on next open
}

// drills into a parent node: validates id ∈ options tree + is non-leaf;
// truncates expandedIds at the depth of nodeId and appends nodeId
void expand(String nodeId) {
    CascaderNode node = findNode(options, nodeId)
        .orElseThrow(() -> new LievitActionException("Unknown node: " + nodeId));
    if (node.isLeaf()) return;  // safe no-op for leaves
    List<String> newExpanded = pathOf(nodeId);  // ids from root to nodeId
    this.expandedIds = newExpanded;
}

// commits a leaf (or intermediate when changeOnSelect) selection path
void commit(List<String> path) {
    validatePath(path, options);  // every id ∈ tree + consecutive parent→child
    if (multiple) {
        // toggle: if path already in value, remove it; otherwise add it
        if (containsPath(this.value, path)) {
            removePath(this.value, path);
        } else {
            this.value.add(path);
        }
    } else {
        this.value = List.of(path);  // replace
        this.open = false;  // auto-close on single-select commit
    }
}

// removes one committed path (multi only)
void removeValue(List<String> path) {
    validatePath(path, options);
    removePath(this.value, path);
}

// clears all committed values
void clearAll() {
    this.value = List.of();
    this.open = false;
}
```

Validation happens in Java BEFORE state mutates. An invalid `nodeId` / `path` (injected by a
hostile client) throws `LievitActionException`; the runtime surfaces it as an error response without
mutating state.

### Round-trip narrative

1. **Open**: click trigger → `open()` → server sets `open=true`, resolves `expandedIds` from `value`
   → re-render → morph mounts the panel stack → enhancer lifecycle hook (`onComponentInit` or a
   `l:cascader` directive on the panel root) initialises `aria-activedescendant` + DOM focus on tree root.
2. **Drill**: Right Arrow / click on a parent row → enhancer fires `expand(nodeId)` wire action →
   server appends to `expandedIds` → re-render → morph adds a new panel column → enhancer updates
   `aria-activedescendant` to the first child node.
3. **Navigate within a panel**: Down/Up/Home/End/typeahead → pure client (`aria-activedescendant`
   update, scroll-into-view) — **no wire round-trip**. This is the "irreducible client bit" the enhancer
   owns.
4. **Left (collapse)**: Left Arrow → enhancer updates `aria-activedescendant` to the parent node;
   does NOT fire a wire action (the visual panel is still present until next Right/expand or close).
   The server's `expandedIds` keeps the expanded path until commit or close — the ephemeral column
   collapse is handled client-only by hiding the child panel via a CSS class toggled by the enhancer
   (no morph needed).
5. **Commit**: Enter on a leaf → enhancer fires `commit(path)` wire action → server sets `value`,
   closes if single → re-render → morph: trigger now shows `triggerLabel()`, panel stack removed
   (if closed) → focus restores to trigger.
6. **Search** (searchable): type in search input → `l:model.debounce` → `query` updates → server
   recomputes `flatMatchedPaths()` → re-render → morph: panel stack replaced by flat results list →
   enhancer re-initialises in flat-list mode.
7. **Close without commit**: Esc / Tab / click outside → enhancer fires `close()` → server sets
   `open=false` → morph removes panel stack → focus restores to trigger.

### Enhancer responsibilities

The `collection-nav.enhancer.ts` is parameterised with a `mode: "cascader"` flag (new mode alongside
the existing `listbox` and `menu` modes). In cascader mode it:
- registers on the `role="tree"` root element (via a `l:cascader` directive or the lifecycle hook
  `onComponentInit`);
- maintains `aria-activedescendant` on the tree root, tracking which `[role="treeitem"]` is active;
- maps the full keyboard table in §4 (Right→expand wire, Left→client-collapse, Down/Up/Home/End/typeahead
  within a column, Enter→commit wire, Esc→close wire, Space→commit/remove in multi mode);
- scrolls the active row into view within its containing panel column;
- detects when the component re-renders (morph) via the lifecycle `onComponentUpdate` hook and
  re-anchors `aria-activedescendant` to the preserved active-row id (the morph preserves node identity,
  so the id survives the patch);
- fires wire actions via `$lievit.call(actionName, args)` (CSP-clean, no eval);
- on close/commit (when DOM focus needs to return to the trigger), reads the trigger element from
  `data-lievit-trigger-id` stamped on the panel-stack root by the template, and calls `trigger.focus()`.

---

## 7. Acceptance tests

Every test runs on a **real substrate** (no mocked `$lievit` / no fake enhancer). This is the
client-island-fidelity lesson: a cascader test on a mocked runtime certifies nothing about real
panel rendering or real keyboard behaviour.

### 7.a Render tests (real `LievitRuntime` + jsdom, REAL `collection-nav` enhancer mounted)

| Test name | What it asserts |
|---|---|
| `renders trigger with placeholder when value is empty` | trigger text = `placeholder`; `aria-expanded="false"` |
| `renders trigger with resolved path label when value is set` | `triggerLabel()` appears verbatim in the trigger |
| `opens panel stack on trigger click` | after `open()` morph: panel stack present in DOM; `role="tree"` present; `aria-expanded="true"` on trigger |
| `renders first-level options as treeitems` | root panel column contains `[role="treeitem"]` for each root node |
| `renders child panel after expand action` | after `expand(parentId)`: second panel column present with `[role="treeitem"]` for children; parent row has `aria-expanded="true"` |
| `selected value path nodes carry aria-selected` | after `commit([a,b,c])`: on re-open, nodes `a`, `b`, `c` all have `aria-selected="true"` in their respective panels |
| `disabled node carries aria-disabled` | a node with `disabled=true` has `aria-disabled="true"` on its row |
| `closes panel stack after commit (single)` | after `commit()`: `open=false`, panel stack absent from DOM, trigger shows new label |
| `multi: chip rendered per committed path` | after two commits in multi mode: two chips in trigger area with correct labels |
| `chip remove fires removeValue` | clicking chip × fires `removeValue(path)` wire action; chip disappears after morph |
| `searchable: flat results render on query` | with `searchable=true` and `query="foo"`: panel stack replaced by flat results; each result is `[role="treeitem"]` showing full path label |
| `searchable: no results shows empty state` | when `flatMatchedPaths()` is empty: renders "No results" text; result-count announcer says "0 results" |
| `panel stack has correct ARIA structure` | `role="tree"` root → `role="group"` per column → `role="treeitem"` per option; `aria-level`, `aria-setsize`, `aria-posinset` correct |

### 7.b axe-core assertions

| Test name | What it asserts |
|---|---|
| `axe: open cascader panel stack has zero violations` | run axe on the open panel stack DOM with `aria-expanded="true"`; zero violations of the tree/treeitem rules |
| `axe: closed trigger has zero violations` | run axe on the trigger in closed state; zero violations |
| `axe: multi cascader chips have accessible names` | each chip's remove button has `aria-label="Remove <path>"`; axe sees no unnamed interactive element |
| `axe: disabled node does not violate a11y` | axe sees `aria-disabled="true"` and no focusability violation on disabled treeitems |

### 7.c Keyboard tests (real enhancer, asserted via DOM observable outcomes)

| Test name | What it asserts |
|---|---|
| `Enter on trigger opens panel and sets activedescendant` | Enter on trigger → panel open; `aria-activedescendant` on tree root set to first root node id |
| `ArrowDown moves activedescendant within panel` | Down × 2 → `aria-activedescendant` = third root node |
| `ArrowUp moves activedescendant within panel` | Up after Down → returns to previous node |
| `Home moves activedescendant to first node` | Home from middle → first root node |
| `End moves activedescendant to last node` | End → last root node |
| `typeahead jumps to matching node` | press "S" → first node whose label starts with "S" becomes active |
| `ArrowRight on parent fires expand and moves to first child` | Right on parent → `expand()` fired; after morph child panel present; `aria-activedescendant` = first child id |
| `ArrowLeft returns focus to parent from child panel` | Right to enter child panel, then Left → `aria-activedescendant` = parent node; child panel hidden (client-only) |
| `Enter on leaf fires commit and closes (single)` | navigate to leaf, Enter → `commit(path)` fired; after morph panel stack absent; trigger label updated |
| `Esc closes popover without committing` | open, drill, Esc → `close()` fired; panel stack gone; focus on trigger; value unchanged |
| `Tab closes popover` | open, Tab → popover gone; focus advances to next page element |
| `Space toggles selection in multi+checkable mode` | multi+checkable, navigate to parent, Space → `aria-checked` changes; commit fired for all children |
| `disabled node is skipped by arrow navigation` | Down past a disabled node → activedescendant skips it to next enabled node |
| `disabled node: Enter is inert` | navigate to disabled node, Enter → no wire action fired |
| `searchable: typing filters and Down navigates results` | type query, Down → activedescendant moves among flat results |
| `searchable: Enter on result fires commit` | navigate to a result row, Enter → `commit(matchedPath)` fired |

### 7.d Focus tests

| Test name | What it asserts |
|---|---|
| `DOM focus stays on tree root while navigating` | after open + ArrowDown × 3: `document.activeElement` is always the `role="tree"` root, not the individual rows |
| `focus restores to trigger on Esc` | open → Esc → `document.activeElement === trigger` |
| `focus restores to trigger on commit (single)` | open → navigate → Enter commit → `document.activeElement === trigger` |
| `re-open re-seeds activedescendant to current value path` | commit a leaf, re-open → `aria-activedescendant` = the committed leaf node id |
| `no focus trap: Tab leaves the popover` | open → Tab → popover closed, focus NOT on trigger, focus on next focusable element |

### 7.e Variants / sizes

| Test name | What it asserts |
|---|---|
| `sm: trigger height token class applied` | `data-size="sm"` present; computed height class references `--lv-space-8` |
| `md: trigger height token class applied (default)` | `data-size="md"` present |
| `lg: trigger height token class applied` | `data-size="lg"` present |
| `panel rows match trigger size` | all `[role="treeitem"]` rows use the same height token as the trigger |

### 7.f Wire round-trip IT (lievit-kit, real runtime, `CollapsibleComponentIT` pattern)

| Test name | What it asserts |
|---|---|
| `mount → open → renders panel stack with correct nodes` | real Java component mounted; `open()` called; re-rendered HTML contains correct `role="tree"` structure |
| `expand → adds child panel in re-rendered HTML` | `expand(parentId)` called; re-rendered HTML contains a second `role="group"` column with child nodes |
| `commit → value updated, panel closed in re-rendered HTML` | `commit(["a","b","c"])` called; re-rendered trigger contains `triggerLabel()` for the committed path; `aria-expanded="false"` |
| `multi commit → value accumulates, chips render` | two `commit()` calls; re-rendered trigger area contains two chip elements |
| `removeValue → chip disappears` | `removeValue(path)` called; re-rendered HTML has one fewer chip |
| `clearAll → value empty, trigger shows placeholder` | `clearAll()` called; re-rendered trigger shows placeholder text |
| `invalid nodeId in expand → rejected, state unchanged` | `expand("injected-unknown-id")` → action throws; value/expandedIds unchanged |
| `invalid path in commit → rejected, state unchanged` | `commit(["x","y","z"])` with non-existent ids → action throws; value unchanged |

### 7.g Security / escaping

| Test name | What it asserts |
|---|---|
| `hostile nodeId in data-id renders inert` | a node whose id contains `"><script>alert(1)</script>` has its id run through `Escape.htmlAttribute`; the rendered `data-id` attribute is escaped; no script injected |
| `hostile path in data-path renders inert` | a commit path containing a hostile JSON fragment is HTML-escaped; the attribute value is inert |
| `locked options cannot be injected by client` | `options` is `@LievitProperty(locked=true)`; a wire request that includes a modified `options` payload is rejected by the runtime before the action runs |

### 7.h JTE compile + render gate

Covered by the library-wide `test/jte-compile` real-compiler gate that runs `cascader.jte` through the
JTE compiler and renders it with representative `CascaderComponent` instances (open/closed,
single/multi, searchable, various depths). No hand-maintained render snapshot; the compiler gate
certifies the template is valid JTE.

### 7.i Playwright (gesture fidelity, legacy-VM oracle)

| Test name | What it asserts |
|---|---|
| `real click opens panel stack` | `page.click(trigger)` → panel stack visible in the real browser; not a jsdom approximation |
| `real ArrowRight enters child panel` | `page.keyboard.press("ArrowRight")` on a parent → child panel appears; parent row shows chevron rotated |
| `real Enter commits a leaf` | navigate to leaf, `page.keyboard.press("Enter")` → panel closes; trigger label updates to the committed path |
| `real Esc closes without committing` | open + drill + `page.keyboard.press("Escape")` → panel gone; value unchanged; focus on trigger |
| `real chip remove works` | multi: click × on chip → chip gone from trigger; underlying value updated |

---

## 8. Non-goals / anti-patterns

- **No Lit, no Alpine, no React**: the enhancer is typed-TS vanilla; the template is server-rendered JTE.
  The ADR-0012 "no framework" rule holds unconditionally.
- **No hand-rolled roving focus**: `collection-nav.enhancer.ts` is the ONE shared source for all
  collection keyboard patterns (APG Tree model in multi-panel mode). Adding a second independent
  implementation of roving + typeahead for the cascader is the failure mode the single-source-a11y
  rule was designed to prevent.
- **No hand-rolled popover positioning**: the popover seam (native `popover` + CSS Anchor Positioning)
  is the ONE positioning + light-dismiss mechanism. Cascader DOES NOT implement its own absolute
  positioning or z-index stacking.
- **No client-side option tree**: `options` is `@LievitProperty(locked=true)`. The client cannot
  inject, modify, or extend the option set. Async lazy-load of children is a wire action
  (`expand(nodeId)` triggers a server lookup for that node's children, re-rendering the new panel).
  This is a deliberate security boundary.
- **No client-side state for the committed value**: `value` is a `@Wire` field, the server's truth.
  The enhancer does NOT maintain a shadow selection; it only fires wire actions and updates
  `aria-activedescendant`. There is exactly one owner of the committed selection state.
- **No `<slot>` for the panel body**: this is WIRE — the template owns all markup (the "no slot in
  WIRE" rule from the server-first refactor blueprint §1.b). A consumer that needs a custom option
  render copies the template (opt-out distribution, RFC 0036) and edits their copy.
- **No `changeOnSelect` as default**: intermediate-node selection is an opt-in escape hatch for
  address-form use cases. Default behaviour is leaf-only commit, which is safer and less surprising.
- **Not a tree-view / tree-select**: the cascader is a FORM CONTROL (picks a value, submits a path).
  It does NOT display a persistent navigable tree with multi-select expand/collapse visible at all
  times. Use `tree-view` for display, `tree-select` for a tree embedded in a combobox-style trigger
  with checkboxes. The cascader is the "drill-down path selector" — its panels are transient overlays.
- **Not a multi-step wizard**: a cascader picks a hierarchical classification value. It does NOT drive
  a multi-step form workflow. Use `wizard` for that.
- **No imperative open/close API**: there is no JS API to open the cascader programmatically. The
  trigger button + wire actions are the only surface. This keeps the component within the wire
  discipline (server owns the open state; the client only requests changes via wire actions).

---

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens (OKLCH colour values). You MAY read the WAI-ARIA APG
Tree View pattern (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) and Listbox pattern
(https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) + Ant Design Cascader feature set + Tailwind UI
look-and-feel as references for PATTERN (a11y semantics, inventory) and LOOK. You MUST NOT paste
literal source from any of them — the output is always original generation (the one bright line,
`02-licensing.md`).

Compose the ONE shared a11y mechanism: `collection-nav.enhancer.ts` in cascader/multi-panel mode for
all keyboard navigation and `aria-activedescendant` management; the popover seam for anchor positioning
and light-dismiss. Do NOT hand-roll either. Extending `collection-nav` with a `mode: "cascader"`
parameter is the correct approach — not a new separate enhancer.

The WIRE conventions (server-first refactor blueprint §1.b) are non-negotiable: no `Content` slot,
all body markup is owned by the template, `@param` for every `@Wire` field plus `_component` and
`_instance`, boolean states as JTE boolean attributes, `aria-expanded` computed directly from the
`@Wire boolean` field.

The SAFE escaping channels are non-negotiable: `nodeId` values and `path` arrays emitted into
`data-*` attributes MUST go through `Escape.htmlAttribute`; never trust a client-supplied id without
re-validation in Java before mutating state.

Mirror `button.jte` house conventions exactly: header doc-comment with credits, typed `@param`,
`data-slot="cascader"`, `data-size`, the two escaping channels documented, zero `<script>`, zero
inline `on*=`.

The acceptance tests in §7 are the gate — implement ALL of them. The keyboard map in §4 is the
contract — assert ALL keys. A test on a mocked `$lievit` does NOT count (the client-island-fidelity
lesson). Minimal code to GREEN; refactor only while green.
