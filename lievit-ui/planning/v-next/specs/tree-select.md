<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — tree-select

- **tier**: WIRE + ENH (`tree-nav.enhancer.ts`, a dedicated typed-TS enhancer; composes `collection-nav.enhancer.ts` for the search listbox path + the popover seam)
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: NET-NEW
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Tree (`https://www.w3.org/WAI/ARIA/apg/patterns/treeview/`) + APG Combobox
      (`https://www.w3.org/WAI/ARIA/apg/patterns/combobox/`) — BUILT against raw APG (no react-aria
      useTreeSelect exists; the keyboard map + ARIA wiring + focus order are transcribed from the two
      official APG specs into the ORIGINAL template + `tree-nav` enhancer; no APG source code copied)
    - inventory: Ant Design TreeSelect as inventory reference (checkable tree, search, async load,
      virtual scroll; the exact feature set for a gestionale context — keep all except imperative API)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI (NO code copied)

---

## 1. What it is

A field control that presents its options as a collapsible hierarchy (a TREE) instead of a flat list.
The user clicks a trigger, a popover opens showing the tree, and selecting a leaf (or an interior node
when `selectionMode` allows it) sets the value. An optional search input narrows the visible tree nodes
via client-side filtering or a server-side HTMX fetch.

Use `tree-select` when:
- the option domain is naturally hierarchical (e.g. org units, geographic regions, file categories,
  product families) and flattening it into a `select` loses meaningful structure;
- the hierarchy has 3+ levels or more than ~30 total nodes, making a flat list unwieldy;
- the user needs to expand, browse, and select at multiple depth levels.

Do NOT use `tree-select` when the hierarchy is at most 2 levels with a small node count — the
`select (rich)` with groups is simpler and sufficient in that case.

**Why WIRE**: the selection state (`value` / `checkedKeys`), the expanded-node set (`expandedKeys`),
and the search query are all server facts — they survive a page reload, they participate in form
validation, and the adopter's controller needs to act on them. The one irreducible client behavior —
tree keyboard navigation (arrow keys, expand/collapse, roving tabindex, typeahead) and the popover
lifecycle — is the `tree-nav` enhancer, the typed-TS escape-hatch. Everything else is server-rendered
HTML that the runtime morphs on each round-trip.

---

## 2. API — the WIRE surface + template params

### Java (`TreeSelectComponent`)

| member | kind | meaning |
|---|---|---|
| `nodes` `List<TreeNode>` | `@Wire @LievitProperty(locked=true)` | the FULL tree node list, flat with parent-id references; server config, client cannot inject nodes. `TreeNode` carries: `id String`, `label String`, `parentId String` (null for roots), `disabled boolean`, `leaf boolean` (true = no children), `checkable boolean` (only relevant in `MULTI_CHECK` mode) |
| `selectionMode` `SelectionMode` | `@Wire @LievitProperty(locked=true)` | `SINGLE` (default) — one node selected; `MULTI_CHECK` — checkboxes on every `checkable` node, parent state is indeterminate when partially checked |
| `value` `String` | `@Wire` | selected node id (SINGLE mode); null when nothing is selected |
| `checkedKeys` `Set<String>` | `@Wire` | ids of FULLY checked nodes (MULTI_CHECK mode); empty set when nothing is checked |
| `expandedKeys` `Set<String>` | `@Wire` | ids of nodes currently expanded; drives `aria-expanded` on every treeitem |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | trigger label shown when no selection |
| `searchable` `boolean` | `@Wire @LievitProperty(locked=true)` | shows a search input above the tree |
| `query` `String` | `@Wire` | live search text; when `searchable=true`, drives `visibleNodes()` |
| `asyncLoad` `boolean` | `@Wire @LievitProperty(locked=true)` | when true, children are loaded on expand via HTMX instead of pre-rendered |
| `open` `boolean` | `@Wire` | popover open-state |
| `select(String id)` | `@LievitAction` | SINGLE mode: validates `id ∈ nodes` + `!disabled`, sets `value`, closes popover |
| `toggleCheck(String id)` | `@LievitAction` | MULTI_CHECK mode: validates id, flips `checkedKeys` for `id` + cascades to/from parent (partial → indeterminate), re-renders trigger summary |
| `toggleExpand(String id)` | `@LievitAction` | adds/removes `id` from `expandedKeys`, re-renders that subtree |
| `toggleOpen()` | `@LievitAction` | opens/closes the popover |
| `clearSelection()` | `@LievitAction` | sets `value=null` / `checkedKeys={}`, stays open |
| `visibleNodes()` | computed getter on `_instance` | nodes filtered by `query` (label contains, case-insensitive); `@LievitProperty(serialize=false)` — read-only, computed for the template |
| `triggerLabel()` | computed getter on `_instance` | the string shown in the trigger: selected node label (SINGLE) or "{N} selected" (MULTI_CHECK); "placeholder" when empty; `@LievitProperty(serialize=false)` |
| `indeterminate(String id)` | computed getter on `_instance` | true when some but not all checkable descendants are in `checkedKeys` — needed by template to set `aria-checked="mixed"` |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param TreeSelectComponent _instance` (to call `visibleNodes()`, `triggerLabel()`, `indeterminate()`).
No `Content` slot (WIRE has none — server-first refactor blueprint §1.b).

### Enhancer attributes (data-* hooks the JTE template stamps; the enhancer reads them)

| attribute | element | meaning |
|---|---|---|
| `data-lievit-component` | component root | FQN, stamped by WIRE infrastructure |
| `data-lievit-id` | component root | component instance id |
| `data-lievit-snapshot` | component root | signed round-trip snapshot |
| `data-ts-trigger` | the trigger button/combobox | marks the popover trigger; enhancer binds open/close key gestures |
| `data-ts-search` | the search `<input>` | marks the search field; enhancer keeps `aria-activedescendant` updated as query changes |
| `data-ts-tree` | the `<ul role="tree">` | marks the tree root; enhancer scopes all keyboard events here |
| `data-ts-node="<id>"` | each `<li role="treeitem">` | the node id; the enhancer reads it to fire `toggleExpand` / `select` / `toggleCheck` |
| `data-ts-expandable` | parent `<li role="treeitem">` | present when the node has children; used by enhancer to decide Right/Left arrow semantics |

---

## 3. Variants / sizes / states

### Variants
Tree-select is a form control; it uses the same field-level intent vocabulary as `select (rich)` and
`input`. No `variant` param on the component itself — intent (error, invalid) is expressed via the
parent `field` partial which sets `aria-invalid` + the destructive ring on the trigger.

### Sizes
- `size`: `sm | md | lg` — height-based, toolbar-aligned (the §5.b architecture contract).
  - `sm` → trigger height `--lv-space-8` (32 px); tree row height `--lv-space-8`
  - `md` → trigger height `--lv-space-9` (36 px, default); tree row height `--lv-space-9`
  - `lg` → trigger height `--lv-space-10` (40 px); tree row height `--lv-space-10`
  Horizontal padding + text size scale with height. Trigger aligns flush with `button`/`input` of the
  same size in a toolbar row.

### States

| state | how expressed |
|---|---|
| `disabled` | native `disabled` on the trigger + `aria-disabled`; tree is not rendered while disabled |
| `open` | `aria-expanded="true"` on the trigger; the popover panel is present in the DOM |
| `closed` | `aria-expanded="false"` on the trigger; the popover panel is `hidden` |
| `aria-invalid` | set by the parent `field` on the trigger; destructive border + ring |
| `aria-busy` | set by the lievit runtime `beforeCall`/`afterCall` during any wire round-trip; not managed by the component |
| node selected (SINGLE) | `aria-selected="true"` on the corresponding `<li role="treeitem">` |
| node checked (MULTI_CHECK) | `aria-checked="true"` on the corresponding `<li role="treeitem">` |
| node partially checked | `aria-checked="mixed"` on the corresponding `<li role="treeitem">` (`indeterminate()` returns true) |
| node expanded | `aria-expanded="true"` on the `<li role="treeitem">`; child `<ul role="group">` is rendered |
| node collapsed | `aria-expanded="false"` on the `<li role="treeitem">`; child `<ul role="group">` is `hidden` |
| node disabled | `aria-disabled="true"` on the `<li role="treeitem">`; the enhancer skips it in roving tabindex + ignores Enter/Space on it |
| searchable + filtered | `visibleNodes()` drives a filtered tree rendering; ancestor nodes that contain a match are shown even if the query doesn't match their own label (so the user sees the matched node in context) |
| asyncLoad loading | the toggled node shows `aria-busy="true"` while the HTMX request is in-flight; the placeholder expander slot is replaced by a spinner |

### Slots
WIRE has no `Content` slot (server-first refactor blueprint §1.b). The tree structure is OWNED
template markup driven by the `nodes` list + `visibleNodes()`. The trigger label is derived from
`triggerLabel()`.

Optional adoptable regions (implemented as OWNED areas in the copied/owned template, not `gg.jte.Content`):
- **trigger leading**: an icon before the trigger label (hardcoded in the owned template; not a param).
- **node icon slot**: per-node icon driven by `TreeNode.iconName` (a `String` naming a Lucide icon);
  null → no icon rendered (no blank space).
- **empty state**: shown inside the popover when `visibleNodes()` is empty (search returns nothing or
  the tree has no nodes); owned static markup in the template.

---

## 4. The a11y contract (the heart — non-negotiable, fully specified)

### WAI-ARIA patterns cited
- **APG Tree** (`https://www.w3.org/WAI/ARIA/apg/patterns/treeview/`): the popup tree's roles,
  keyboard navigation, and multi-select model.
- **APG Combobox** (`https://www.w3.org/WAI/ARIA/apg/patterns/combobox/`): the trigger's `role="combobox"`
  with `aria-haspopup="tree"`, the `aria-expanded` state, `aria-controls` referencing the tree, and
  `aria-activedescendant` keeping virtual focus during keyboard navigation.

Both patterns are BUILT directly against the raw APG specs (react-aria does not ship a `useTreeSelect`;
this is flagged as BUILT in `03-component-inventory.md`). The keyboard map below derives from the two
spec pages; citations are inline.

### Roles + ARIA attributes emitted by the JTE template

**Trigger (the popover button)**:
```
<button
  role="combobox"
  aria-haspopup="tree"
  aria-expanded="${open ? "true" : "false"}"
  aria-controls="<treeId>"
  aria-labelledby="<fieldLabelId> <triggerId>"
  id="<triggerId>"
  data-ts-trigger
  tabindex="0"
>
  ${_instance.triggerLabel()}
  <!-- chevron icon, aria-hidden -->
</button>
```

**Search input (when `searchable=true`)** — rendered inside the popover, above the tree:
```
<input
  type="text"
  role="combobox"
  aria-autocomplete="list"
  aria-controls="<treeId>"
  aria-expanded="true"
  aria-activedescendant=""   <!-- managed by the tree-nav enhancer during keyboard nav -->
  aria-label="Search"
  data-ts-search
  l:model.debounce.200ms="query"
/>
```
When `searchable=true`, the trigger opens the popover and moves DOM focus to this search input.
This input also carries `role="combobox"` per APG Combobox §6 (`aria-haspopup="tree"` on the search
input itself is omitted; the tree it controls is already present and unconditionally `aria-expanded=
"true"` while the popover is open).

**Tree container** (inside the popover):
```
<ul
  role="tree"
  id="<treeId>"
  aria-multiselectable="${selectionMode == 'MULTI_CHECK' ? "true" : "false"}"
  aria-labelledby="<fieldLabelId>"
  data-ts-tree
>
  <!-- treeitem LIs rendered recursively -->
</ul>
```

**Each tree node** (`<li role="treeitem">`):
- Leaf node: `role="treeitem" aria-selected="${id == value}" aria-disabled="${node.disabled}"
  aria-level="${level}" aria-setsize="${siblingCount}" aria-posinset="${posInSiblings}"
  tabindex="-1"` (the active node gets `tabindex="0"` via roving tabindex; `data-ts-node="${id}"`).
- Parent node: all the above PLUS `aria-expanded="${id ∈ expandedKeys ? "true" : "false"}"` AND
  `data-ts-expandable`.
- MULTI_CHECK mode: replaces `aria-selected` with `aria-checked` (`"true"`, `"false"`, or `"mixed"`
  via `_instance.indeterminate(id)`); the checkbox visual is a rendered `<span aria-hidden="true">`.
- Child group: `<ul role="group">` wrapping the children; it has no additional ARIA attributes.

**Clear button** (shown inside the trigger when a selection exists and `!disabled`):
```
<button aria-label="Clear selection" tabindex="-1"><!-- X icon --></button>
```
`tabindex="-1"` keeps it out of the normal Tab sequence; it IS reachable by Tab when focus is on the
trigger (the enhancer adds it to the trigger's local focus ring). Alternative: include it in the normal
tab order for simpler implementation; the spec allows either approach provided the button has an
accessible name.

### Keyboard map

The keyboard map covers two focus surfaces: (A) the trigger (when the popover is closed) and (B) the
tree (when the popover is open and no search input has focus). A third surface (C) is the search input.
**Source: APG Tree `https://www.w3.org/WAI/ARIA/apg/patterns/treeview/` + APG Combobox
`https://www.w3.org/WAI/ARIA/apg/patterns/combobox/`.**

#### Surface A — Trigger (popover CLOSED)

| key | does | who |
|---|---|---|
| Enter / Space | opens the popover; if `searchable`, moves DOM focus to the search input; otherwise moves DOM focus (and roving tabindex) to the currently selected node or the first root node | `tree-nav` enhancer |
| ArrowDown | opens the popover, moves focus to the first tree node (same as Enter when not searchable) | `tree-nav` enhancer |
| ArrowUp | opens the popover, moves focus to the last visible tree node | `tree-nav` enhancer |
| Tab | moves focus out of the trigger (standard Tab, platform behaviour); popover stays closed | platform |
| Esc | no-op when closed | — |

#### Surface B — Tree (popover OPEN, focus on a treeitem)

| key | does | who |
|---|---|---|
| ArrowDown | moves focus to the NEXT visible node (depth-first; skips hidden collapsed children; skips `aria-disabled` nodes); wraps at bottom | `tree-nav` enhancer |
| ArrowUp | moves focus to the PREVIOUS visible node; wraps at top | `tree-nav` enhancer |
| ArrowRight | if the focused node is a parent AND COLLAPSED: fires `toggleExpand` wire action (expands); if EXPANDED: moves focus to its first child; if it is a leaf node: no-op (APG Tree §Keyboard) | `tree-nav` enhancer → wire |
| ArrowLeft | if the focused node is EXPANDED: fires `toggleExpand` wire action (collapses); if COLLAPSED or a leaf: moves focus to its parent node; if already at a root node: no-op (APG Tree §Keyboard) | `tree-nav` enhancer → wire |
| Home | moves focus to the first root node | `tree-nav` enhancer |
| End | moves focus to the last visible node in the tree | `tree-nav` enhancer |
| Enter | SINGLE mode: fires `select(id)` wire action on the focused node, closes the popover, returns focus to the trigger (disabled nodes ignored); MULTI_CHECK mode: fires `toggleCheck(id)`, popover stays open | `tree-nav` enhancer → wire |
| Space | SINGLE mode: same as Enter; MULTI_CHECK mode (recommended model, APG Tree §Multi-select): toggles `checkedKeys` for the focused node — fires `toggleCheck(id)` | `tree-nav` enhancer → wire |
| Esc | closes the popover WITHOUT changing the selection; returns DOM focus to the trigger | `tree-nav` enhancer |
| Tab | closes the popover (same as Esc for UX consistency; the popover is non-modal, no focus trap); moves DOM focus to the next element in the page | `tree-nav` enhancer + platform |
| Shift+Tab | closes the popover; moves DOM focus to the previous element | `tree-nav` enhancer + platform |
| typeahead (printable chars) | moves focus to the NEXT visible node whose label starts with the typed character; successive same-character presses cycle through matches; a multi-char string typed quickly jumps to the node matching the prefix (APG Tree §Type-ahead) | `tree-nav` enhancer |
| `*` (Asterisk) | expands ALL collapsed sibling nodes at the current level — fires `toggleExpand` for each collapsed sibling (APG Tree §Optional) | `tree-nav` enhancer → wire (batched: one action per node that needs expansion) |
| Shift+Down / Shift+Up | MULTI_CHECK mode only: moves focus AND toggles `checkedKeys` on each passed node (APG Tree §Multi-select recommended model) | `tree-nav` enhancer → wire |
| Ctrl+A | MULTI_CHECK mode only: checks ALL checkable nodes (or unchecks all if all are already checked) — fires `toggleCheck` for each; in SINGLE mode no-op | `tree-nav` enhancer → wire |

#### Surface C — Search input (popover OPEN, focus on search, `searchable=true`)

| key | does | who |
|---|---|---|
| ArrowDown | moves virtual focus (via `aria-activedescendant`) to the first visible tree node; DOM focus stays on the search input | `tree-nav` enhancer |
| ArrowUp | moves virtual focus to the last visible tree node | `tree-nav` enhancer |
| Enter | commits the virtually-focused tree node: fires `select(id)` (SINGLE) or `toggleCheck(id)` (MULTI_CHECK) | `tree-nav` enhancer → wire |
| Esc | closes the popover, clears the search query (fires `clearSelection()` if nothing was selected; does NOT clear an existing selection), returns focus to the trigger | `tree-nav` enhancer → wire |
| Tab | behaves as Esc + standard Tab: closes popover, moves focus forward | `tree-nav` enhancer + platform |
| printable chars | typed normally into the search input, `l:model.debounce.200ms` fires `query` update, tree re-renders | wire + platform (`<input>`) |

### Focus management

- **No focus trap**: the popover is NON-MODAL (it opens beneath the trigger, not as a dialog overlay).
  Tab navigates through the page; when Tab leaves the popover it closes (non-trapping close, same model
  as `select (rich)`). The `focus-trap` enhancer is NOT composed here.
- **Roving tabindex**: the tree uses ROVING TABINDEX (APG Tree pattern). Exactly ONE `<li role="treeitem">`
  has `tabindex="0"` at any time (the focused node); all others have `tabindex="-1"`. The `tree-nav`
  enhancer manages this: on ArrowDown/Up/Home/End/typeahead it sets the new active node's tabindex to 0
  and the previous to -1 BEFORE firing any wire action, so the morph preserves focus.
- **Initial focus on open**: when `searchable=true`, DOM focus moves to the search `<input>`. When
  not searchable, DOM focus moves to the tree node that is currently selected (SINGLE) / first checked
  (MULTI_CHECK) / first root node (nothing selected). The enhancer reads `data-ts-node` to find the
  right `<li>` and calls `.focus()`.
- **Focus return on close**: whenever the popover closes (Esc, Tab, Enter/select), DOM focus returns
  to the trigger button. The enhancer records the trigger reference on open and calls `trigger.focus()`
  on close.
- **Virtual focus during search**: when focus is on the search input and the user presses ArrowDown/Up,
  the enhancer moves `aria-activedescendant` on the `<input>` to point at the virtually-focused
  `<li role="treeitem">`. DOM focus does NOT leave the search input. This is the APG Combobox model:
  "DOM focus is maintained on the combobox and the assistive technology focus is moved within the
  [popup] using `aria-activedescendant`."
- **After morph**: the lievit runtime morph preserves node identity + `tabindex` attributes across
  re-renders (ADR-0019). The enhancer does NOT need to re-initialise after a round-trip; it reads the
  new DOM state from `data-ts-node` attributes.
- **Popover seam composition**: the popover anchors below the trigger using CSS Anchor Positioning +
  the native `popover` attribute (the Wave-3 seam). Light-dismiss (click-outside) is supplied by the
  seam; the enhancer additionally fires `toggleOpen()` on outside-click so the server `open` flag
  stays in sync.

### Screen-reader expectations

- A screen reader announces the trigger as "combobox, [triggerLabel], [expanded/collapsed]" plus the
  field label via `aria-labelledby`.
- Opening the popover: the SR moves to the tree (or to the search input). The tree is announced as
  "tree, [aria-label matching the field label], N nodes" (count from `aria-setsize` on roots).
- Each treeitem is announced as "[label], [level N], [N of M], [expanded/collapsed], [selected/checked/
  mixed/not selected]". The SR reads `aria-level`, `aria-posinset`, `aria-setsize` (required when the
  DOM does not expose the full node hierarchy, e.g. collapsed children are `hidden`; stamped by the
  template always).
- MULTI_CHECK: `aria-checked="mixed"` on a parent is announced as "mixed" by major SRs (NVDA, JAWS,
  VoiceOver); the template must emit "mixed" not "indeterminate".
- When the search input filters the tree, the result count is announced via the shared live-region
  announcer (`role="status"`, polite): "{N} results" after the debounce settles.
- `aria-busy="true"` on the trigger (during any wire round-trip) is announced by SRs that support it.

### Shared mechanisms composed

| mechanism | how composed here |
|---|---|
| **popover seam** (CSS Anchor Positioning + native `popover`) | the ONLY positioning + light-dismiss mechanism; the tree panel IS the popover; the component does NOT hand-roll positioning |
| **`collection-nav.enhancer.ts`** | NOT directly reused here; tree navigation differs from flat-list navigation (expand/collapse, level semantics). `tree-nav` is a SEPARATE enhancer that handles the tree-specific key map. For the search-input path, where the result list IS a flat filtered list, `tree-nav` internally delegates arrow-nav + activedescendant updates to the same roving logic used by `collection-nav` |
| **live-region announcer** | the shared `role="status"` announcer; used for search result count |
| **`focus-trap`** | NOT composed (non-modal popover, no trap) |

---

## 5. Tokens

### Consumed (all `var(--lv-*)`, no literals)

**Colour (OKLCH source-of-truth format):**
- `--lv-color-bg` — trigger background (neutral resting state)
- `--lv-color-input` — trigger background (form-control shade, lighter than page bg)
- `--lv-color-input-fg` — trigger text
- `--lv-color-border` — trigger border
- `--lv-color-border-input` — trigger border (form-control variant)
- `--lv-color-popover` — popup panel background
- `--lv-color-popover-fg` — popup panel text
- `--lv-color-accent` — hovered / virtually-active tree node background
- `--lv-color-accent-fg` — hovered / virtually-active tree node text
- `--lv-color-primary` — selected node highlight stripe (SINGLE) or checkbox fill (MULTI_CHECK)
- `--lv-color-primary-fg` — text on selected node fill
- `--lv-color-muted` — placeholder text; disabled node text; expand-chevron icon
- `--lv-color-muted-fg` — secondary information inside a node row
- `--lv-color-destructive` — trigger border + ring when `aria-invalid`
- `--lv-color-destructive-fg` — text when `aria-invalid`
- `--lv-color-overlay` — NOT used (non-modal popover, no scrim)

**Focus + Ring:**
- `--lv-ring` — focus-visible ring on trigger + on the active treeitem (roving tabindex target)
- `--lv-ring-offset` — ring offset gap (so the ring clears the border)

**Spacing:**
- `--lv-space-1` — checkbox / expand-icon gap within a node row
- `--lv-space-2` — horizontal inner padding of a node row (per-level indent adds `--lv-space-4` × level)
- `--lv-space-3` — vertical padding of a compact (sm) node row
- `--lv-space-4` — per-level indentation increment; also node row vertical padding (md)
- `--lv-space-5` — vertical padding of an lg node row
- `--lv-space-8` — trigger height (sm)
- `--lv-space-9` — trigger height (md, default)
- `--lv-space-10` — trigger height (lg)

**Radius:**
- `--lv-radius-md` — trigger border radius
- `--lv-radius-sm` — node row hover highlight radius
- `--lv-radius-lg` — popover panel border radius

**Shadow + Z:**
- `--lv-shadow-md` — popover panel elevation
- `--lv-z-popover` — popover stacking context

**Typography:**
- `--lv-text-sm` — node label text size (md/sm)
- `--lv-text-base` — node label text size (lg)
- `--lv-font-sans` — node label + trigger label font

**Motion:**
- `--lv-motion-duration-fast` — expand/collapse chevron rotation transition
- `--lv-motion-easing-standard` — same

### NET-NEW tokens proposed

| token | value (light / dark) | justification |
|---|---|---|
| `--lv-color-tree-indent-guide` | `oklch(0.87 0 0 / 0.5)` / `oklch(0.35 0 0 / 0.5)` | the vertical connecting line drawn beside indented levels (a subtle structural aid; no existing token covers a translucent structural stroke) |
| `--lv-space-tree-indent` | `calc(var(--lv-space-4))` i.e. 16 px | the per-level indentation unit; exposing it as a token lets an adopter tighten or loosen the tree density without touching component internals. It defaults to `--lv-space-4` (additive, no value change for existing adopters) |

Both tokens are additive, go in `:root` + `.dark`, and do not expand the rebrand surface (they are
structural, not brand-colour).

---

## 6. Wire actions + enhancer wiring

### l:* directives stamped by the JTE template

| element | directive | meaning |
|---|---|---|
| Trigger `<button>` | `l:click="toggleOpen"` | opens/closes the popover |
| Search `<input>` | `l:model.debounce.200ms="query"` | debounced text → server `query` field update → `visibleNodes()` re-rendered |
| Each treeitem `<li>` (clickable row area) | `l:click="select" data-id="<escaped id>"` (SINGLE) OR `l:click="toggleCheck" data-id="<escaped id>"` (MULTI_CHECK) | the SAFE per-node action channel: id travels through `data-id` (escaped via `Escape.htmlAttribute`) |
| Expander button `<button>` (chevron, inside each parent treeitem) | `l:click="toggleExpand" data-id="<escaped id>"` | expands/collapses this node; the button ALSO stops propagation so it does not also trigger `select`/`toggleCheck` on the row |
| Clear `<button>` | `l:click="clearSelection"` | clears the current selection; emitted only when `value != null` or `!checkedKeys.isEmpty()` |

**The two escaping channels**:
- `attrs` (TRUSTED raw, `$unsafe`): static author-supplied wire directives (`l:model`, `l:click`
  for the fixed built-in actions). NEVER fed per-node DB-derived data.
- `data-id="<escaped>"` (SAFE escaped): per-node id from `Escape.htmlAttribute`. This is the XSS
  boundary: a hostile node id (`"><script>...`) is HTML-escaped and renders inert as a data attribute.

### Server action signatures (Java)

```java
@LievitAction
public void select(@LievitParam String id) {
    // 1. validate id ∈ nodes (authz/validation BEFORE any state mutation)
    // 2. validate !nodes.get(id).disabled
    // 3. this.value = id; this.open = false;
}

@LievitAction
public void toggleCheck(@LievitParam String id) {
    // 1. validate id ∈ nodes + node.checkable + !node.disabled
    // 2. flip checkedKeys for id; cascade to parent (indeterminate/checked logic)
    // 3. (open stays true — multi-check keeps the popover open)
}

@LievitAction
public void toggleExpand(@LievitParam String id) {
    // 1. validate id ∈ nodes + !node.leaf
    // 2. expandedKeys.contains(id) ? remove : add
    // 3. (asyncLoad path: if expanding and node has no loaded children, set aria-busy, defer to HTMX)
}

@LievitAction
public void toggleOpen() {
    this.open = !this.open;
    if (!this.open) this.query = "";   // clear search on close
}

@LievitAction
public void clearSelection() {
    this.value = null;
    this.checkedKeys = new LinkedHashSet<>();
    // open state is preserved
}
```

Validation and authz happen in Java BEFORE any `@Wire` field is mutated. An invalid or unauthorized id
causes the action to return without mutation; the server re-renders the unchanged state.

### Round-trip flow (SINGLE mode, not searchable)

```
user opens trigger
  → l:click="toggleOpen"
  → server: open=true
  → re-render: popover visible, tree rendered
  → morph patches in the popover
  → tree-nav enhancer: focuses the selected node (or first root)

user presses ArrowDown (in tree)
  → enhancer: moves roving tabindex to next node (client, no round-trip)
  → aria-activedescendant updated on tree root (no round-trip)

user presses ArrowRight on a collapsed parent
  → enhancer: fires l:click="toggleExpand" data-id="<id>"
  → server: expandedKeys.add(id)
  → re-render: that node now has aria-expanded="true", children rendered
  → morph patches in the children; enhancer moves focus to first child

user presses Enter on a leaf
  → enhancer: fires l:click="select" data-id="<id>"
  → server: value=id; open=false
  → re-render: trigger label = node label; popover absent
  → morph: popover gone, focus returns to trigger (enhancer)
```

### Round-trip flow (MULTI_CHECK mode, searchable)

```
user opens trigger
  → toggleOpen → open=true
  → DOM focus → search input (enhancer)

user types "nord"
  → l:model.debounce → query="nord"
  → server: visibleNodes() = nodes whose label contains "nord" + their ancestors
  → re-render: filtered tree

user presses ArrowDown
  → enhancer: virtual focus via aria-activedescendant, DOM stays on <input>

user presses Enter
  → enhancer: fires toggleCheck for virtually-active id
  → server: checkedKeys updated, parent recomputed (indeterminate or checked)
  → re-render: aria-checked updated; trigger label = "3 selected"
  → popover stays OPEN (MULTI_CHECK keeps open)

user presses Esc
  → enhancer: fires toggleOpen
  → server: open=false, query=""
  → focus returns to trigger
```

### Async load path (`asyncLoad=true`)

When `asyncLoad=true`, toggling a parent node that has no preloaded children fires `toggleExpand` as
above, but the server response sets `aria-busy="true"` on the node and returns a placeholder spinner.
The rendered HTML includes an HTMX swap target: `hx-get="/lievit/{id}/tree-children?nodeId=<id>"
hx-trigger="load" hx-target="[data-ts-node='<id>'] > ul[role=group]"`. The children arrive via
HTMX swap; the `aria-busy` is cleared in the next re-render. The lievit wire action and HTMX work in
sequence: wire action expands the node + marks busy; HTMX loads the children + triggers a follow-up
re-render. This is the HTMX pattern tier composing into the WIRE tier.

---

## 7. Acceptance tests

The component is DONE only when ALL of the following pass on a REAL substrate (not a mocked one —
the client-island-fidelity lesson from the gest CLAUDE.md).

### Render tests (real `LievitRuntime` + jsdom, `tree-nav` enhancer mounted, NOT mocked)

- **`renders-trigger-closed`**: on initial mount the trigger is visible with `role="combobox"`,
  `aria-expanded="false"`, `aria-haspopup="tree"`, and shows the placeholder; the popover panel is
  absent from the DOM.
- **`renders-trigger-with-selection`**: when `value` is set to a valid node id, `triggerLabel()` returns
  that node's label and the trigger text matches it.
- **`renders-trigger-multi-count`**: in MULTI_CHECK mode with 3 checked nodes, the trigger label reads
  "3 selected" (or the configured locale string).
- **`renders-tree-on-open`**: after `toggleOpen()`, the popover is present; `<ul role="tree">` is
  visible; the nodes render as `<li role="treeitem">` with correct `aria-level`, `aria-setsize`,
  `aria-posinset`; selected node has `aria-selected="true"`.
- **`renders-expanded-node`**: after `toggleExpand("parent-id")`, the `<li>` for the parent has
  `aria-expanded="true"` and its `<ul role="group">` is rendered and visible.
- **`renders-collapsed-node`**: after a second `toggleExpand("parent-id")`, the parent has
  `aria-expanded="false"` and the child group is `hidden`.
- **`renders-search-input-when-searchable`**: with `searchable=true`, the search `<input>` is present
  inside the popover with `role="combobox"` and `aria-controls="<treeId>"`.
- **`renders-filtered-tree`**: with `query="north"`, `visibleNodes()` returns only matching nodes and
  their ancestors; the rendered tree contains only those `<li>` elements.
- **`renders-indeterminate-parent`**: in MULTI_CHECK mode with one child checked and one unchecked,
  the parent `<li>` has `aria-checked="mixed"` (not `aria-selected`).
- **`renders-disabled-node`**: a node with `disabled=true` has `aria-disabled="true"` on its `<li>`.
- **`renders-clear-button-when-selected`**: in SINGLE mode with a value set, a `<button
  aria-label="Clear selection">` is visible inside the trigger area.
- **`renders-node-icon`**: a `TreeNode` with a non-null `iconName` renders an `<svg aria-hidden=
  "true">` icon before the label text.

### axe-core assertions (run on the OPEN state rendered DOM)

- **`axe-tree-open-zero-violations`**: zero axe violations on the open popover DOM, scoped to the APG
  Tree rules (`aria-required-children`, `aria-required-parent`, `aria-treeitem-name`,
  `aria-expanded`, `aria-multiselectable`).
- **`axe-combobox-trigger-zero-violations`**: zero axe violations on the trigger element, scoped to
  combobox rules (`aria-haspopup`, `aria-controls`, `aria-expanded`, `combobox-popup-size`).
- **`axe-search-combobox-zero-violations`** (when `searchable=true`): zero violations on the search
  input (`role="combobox"`, `aria-controls`, `aria-autocomplete`, `aria-activedescendant`).
- **`axe-multiselectable-aria-checked`** (MULTI_CHECK): `aria-checked` used instead of
  `aria-selected`; no node carries both; parent with partial children has `aria-checked="mixed"`.
- **`axe-accessible-name-trigger`**: the trigger has an accessible name (from `aria-labelledby`
  pointing to the field label; axe rule `button-name`).
- **`axe-disabled-node-skipped`**: a disabled node has `aria-disabled="true"` and is NOT reachable
  via Tab (its `tabindex` is always -1 even when it is the roving-active node).

### Keyboard tests (REAL enhancer, real DOM — NOT a mocked `$lievit`)

- **`keyboard-enter-opens-closes`**: Enter on the trigger opens the popover; subsequent Esc closes it
  and returns focus to the trigger; asserts DOM presence/absence of the popover panel.
- **`keyboard-arrowdown-moves-focus`**: open the tree; ArrowDown moves roving tabindex (assert the
  previously-active `<li>` now has `tabindex="-1"` and the next `<li>` has `tabindex="0"`).
- **`keyboard-arrowup-wraps`**: at the first node, ArrowUp moves focus to the last visible node.
- **`keyboard-arrowright-expands`**: on a collapsed parent node, ArrowRight fires `toggleExpand`
  (assert the wire action was called with the correct id); after re-render the children are visible.
- **`keyboard-arrowright-descends`**: on an already-expanded parent, ArrowRight moves focus to the
  first child (no wire action fired).
- **`keyboard-arrowleft-collapses`**: on an expanded parent, ArrowLeft fires `toggleExpand` (collapse).
- **`keyboard-arrowleft-ascends`**: on a leaf (or collapsed child), ArrowLeft moves focus to the parent.
- **`keyboard-home-end`**: Home lands on the first root node; End lands on the last visible node.
- **`keyboard-enter-selects-single`**: Enter on a non-disabled leaf fires `select(id)`, popover closes,
  trigger label updates to the selected node label (assert after morph).
- **`keyboard-space-togglecheck-multi`**: Space on a non-disabled node in MULTI_CHECK mode fires
  `toggleCheck(id)`; popover stays open; the node's `aria-checked` flips.
- **`keyboard-typeahead-single-char`**: typing "n" in the tree moves focus to the next node whose
  label starts with "N" (case-insensitive).
- **`keyboard-typeahead-multi-char`**: typing "no" quickly in the tree moves focus to the first node
  whose label starts with "no".
- **`keyboard-asterisk-expands-siblings`**: pressing `*` on a node fires `toggleExpand` for every
  collapsed sibling at the same level; after re-render all siblings have `aria-expanded="true"`.
- **`keyboard-tab-closes-popover`**: Tab with focus on a tree node closes the popover (non-modal
  close) and moves DOM focus forward in the page; assert popover absent.
- **`keyboard-shift-tab-closes-popover`**: Shift+Tab with focus on the search input closes the
  popover and moves DOM focus backward.
- **`keyboard-search-arrowdown-virtual`**: with `searchable=true`, ArrowDown from the search input
  sets `aria-activedescendant` on the `<input>` to the first tree node's id; DOM focus stays on the
  input.
- **`keyboard-search-enter-selects`**: with virtual focus on a node in the search path, Enter fires
  `select(id)` (SINGLE) and closes the popover.
- **`keyboard-disabled-node-skipped`**: ArrowDown across a disabled node skips it (focus lands on the
  next non-disabled node); Enter on a disabled node does nothing.

### Focus tests

- **`focus-opens-to-selected-node`** (not searchable): open the tree when `value="node-3"`;
  assert the `<li data-ts-node="node-3">` has `tabindex="0"` and received `.focus()`.
- **`focus-opens-to-search`** (searchable): open the tree; assert the search `<input>` has received
  `.focus()`; `aria-activedescendant` is empty initially.
- **`focus-returns-to-trigger-on-close`**: close via Esc; assert `document.activeElement` is the
  trigger button.
- **`focus-returns-to-trigger-on-select`**: select a node via Enter; assert `document.activeElement`
  is the trigger.
- **`focus-roving-only-one-zero`**: at any time during keyboard navigation, exactly one `<li
  role="treeitem">` has `tabindex="0"`; all others have `tabindex="-1"` (assert after every navigation
  step in the keyboard tests above).
- **`focus-outside-click-closes`**: click outside the popover panel (the popover seam's light-dismiss);
  assert popover closes; focus returns to the trigger.

### Wire round-trip IT (lievit-kit, real LievitRuntime, CollapsibleComponentIT pattern)

- **`wire-it-open-close`**: mount → click trigger → assert `open=true` in rendered DOM; press Esc →
  assert `open=false`.
- **`wire-it-select-single`**: mount → open → fire `select("node-5")` action directly → re-render →
  assert `value="node-5"` in template params + trigger label = "Node 5" + `aria-selected="true"` on
  `<li data-ts-node="node-5">`.
- **`wire-it-toggle-check-cascade`**: mount (MULTI_CHECK) → fire `toggleCheck("leaf-1")` → re-render →
  assert `checkedKeys` contains "leaf-1"; fire `toggleCheck("leaf-2")` (sibling of leaf-1 under
  "parent-1") → re-render → assert parent "parent-1" has `aria-checked="mixed"`; fire
  `toggleCheck("leaf-3")` (completing the parent) → assert parent `aria-checked="true"`.
- **`wire-it-toggle-expand`**: mount → fire `toggleExpand("parent-2")` → re-render → assert
  `expandedKeys` contains "parent-2" + children `<li>` elements are present.
- **`wire-it-search`**: mount (searchable) → fire query update to "north" → re-render → assert
  `visibleNodes()` subset rendered; non-matching nodes absent from DOM.
- **`wire-it-clear`**: mount (value set) → fire `clearSelection()` → re-render → assert trigger
  label = placeholder; no `aria-selected="true"` in tree.
- **`wire-it-authz-invalid-id`**: fire `select("INJECTED_ID")` with an id not in `nodes` → action
  is a no-op; `value` unchanged (validation in Java BEFORE mutate).

### JTE compile + render gate

- `test/jte-compile`: the template compiles without errors under the real JTE compiler.
- `test/jte-render-closed`: renders the closed state; trigger is present, popover absent; no NPE.
- `test/jte-render-open`: renders the open state; `<ul role="tree">` present; all `aria-*` attributes
  emitted with correct values from test fixture data.
- `test/jte-render-searchable`: renders with `searchable=true`; search input present with
  `role="combobox"`.

### Escaping / XSS

- **`escaping-hostile-node-id`**: a `TreeNode` whose `id` is `"><script>alert(1)</script>` renders its
  `data-id` attribute as a properly escaped literal; the script tag does not appear in the DOM or
  execute. Assert via inspecting the raw HTML string from the JTE render.
- **`escaping-hostile-node-label`**: a node whose `label` contains `<b>bold</b>` renders as plain
  text inside the `<li>`, not as HTML (JTE output-escaping; assert the `<b>` tag is not in the DOM).

### Playwright (gesture fidelity — real browser, legacy-VM oracle)

- **`playwright-open-navigate-select`**: real `page.click(trigger)` opens the tree; `page.keyboard.
  press("ArrowDown")` twice; `page.keyboard.press("Enter")`; assert the trigger label changed to the
  selected node label (NOT a fake substrate — the client-island-fidelity lesson).
- **`playwright-search-and-select`**: type "nord" in the search input; assert filtered tree; click a
  visible node; assert selection.
- **`playwright-expand-collapse`**: click the chevron on a parent node; assert children visible;
  click again; assert children hidden.
- **`playwright-multi-check-cascade`**: in MULTI_CHECK mode, check a parent; assert all children
  become `aria-checked="true"`.
- **`playwright-esc-closes`**: open, press Esc, assert popover gone and focus on trigger.
- **`playwright-tab-closes`**: open, press Tab, assert popover gone and focus advanced past the trigger.
- **`playwright-outside-click-closes`**: open, `page.mouse.click` outside the panel, assert closed.

---

## 8. Non-goals / anti-patterns

- **NO multi-level selection that cascades by default in SINGLE mode.** SINGLE mode selects exactly one
  node; selecting a parent does NOT implicitly select all its children. That is MULTI_CHECK territory.
- **NO dragging or reordering of tree nodes.** `tree-select` is a SELECTION control, not a tree editor.
  For an editable tree (drag-to-reorder, rename, add/delete nodes) compose `tree-view` with the
  drag enhancer.
- **NO inline editing of node labels.** Labels come from the server via `TreeNode.label`; they are not
  editable within this component.
- **NO virtualization built-in.** For trees with hundreds of visible nodes the adopter composes the
  data-grid virtualization enhancer or paginates server-side via HTMX. `tree-select` is designed for
  trees up to ~200 total nodes; virtual scrolling is a separate concern and would require a dedicated
  virtual-scroll enhancer, not owned by this spec.
- **NO multiple simultaneous selection in SINGLE mode.** Use `MULTI_CHECK` for multi-selection.
- **NO `<slot>` or `gg.jte.Content` for body.** The tree structure is OWNED server-rendered template
  markup. This is the non-negotiable WIRE rule (server-first refactor blueprint §1.b); a `<slot>` would
  recreate the empty-body bug class the pivot eliminated.
- **NO Lit, Alpine, Vue, React, or any framework in the enhancer.** The `tree-nav` enhancer is
  typed vanilla TS, CSP-clean, strictly the irreducible keyboard + focus management layer. It fires
  wire actions for selection/expand; it does NOT own any application state client-side.
- **NO `aria-owns`.** The tree hierarchy is expressed via genuine DOM nesting (`<ul>/<li>` within the
  parent `<li>`), not via `aria-owns` referencing disconnected DOM nodes. APG notes that `aria-owns`
  is deprecated for this use; use real DOM hierarchy.
- **NO `<select multiple>` fallback.** There is no native-element that maps to a searchable tree
  picker; a `<select>` fallback is not meaningful. For no-JS environments, a plain text input + server
  search (HTMX) is the accessibility baseline.
- **NO hand-rolling of the popover/anchor positioning.** The popover seam (CSS Anchor Positioning +
  native `popover`) is the ONE mechanism for all overlays. `tree-select` composes it; it does not
  implement its own `position: absolute` math.
- **NO re-implementing `collection-nav`'s flat-list logic inside `tree-nav`.** For the search-result
  path (flat filtered results), `tree-nav` delegates to the shared roving + typeahead code in
  `collection-nav`. Adding a second copy of that logic in `tree-nav` defeats the single-source-a11y
  rule (`03-component-inventory.md §4`).

---

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens.
You MAY read:
- the APG Tree spec (`https://www.w3.org/WAI/ARIA/apg/patterns/treeview/`) for PATTERN (keyboard map,
  roles, ARIA attributes);
- the APG Combobox spec (`https://www.w3.org/WAI/ARIA/apg/patterns/combobox/`) for the trigger pattern
  and the virtual-focus via `aria-activedescendant` model;
- Ant Design TreeSelect for INVENTORY (feature list, searchable, checkable, async);
- Tailwind UI for VISUAL LOOK only.

You MUST NOT paste literal source code from any of those sources. The output is always ORIGINAL
generation over `--lv-*` tokens.

Discipline reminders:
- Compose the popover seam (one mechanism, not your own positioning).
- Compose `collection-nav` for the search-result flat-list path inside `tree-nav`.
- Do NOT compose `focus-trap` (non-modal popover, no trap).
- The tree body is OWNED template markup — NO `Content` slot, NO `gg.jte.Content` param.
- Validate every action param against the `nodes` list in Java BEFORE mutating any `@Wire` field.
- Every `data-id` attribute on a treeitem goes through `Escape.htmlAttribute`; never `attrs` (trusted
  raw) for per-node DB-derived values.
- `aria-checked` (NOT `aria-selected`) on every `<li role="treeitem">` in MULTI_CHECK mode.
- `aria-checked="mixed"` (not `aria-pressed` or `indeterminate` boolean) for the indeterminate parent.
- Roving tabindex: exactly one `<li role="treeitem">` has `tabindex="0"` at all times; the enhancer
  sets this BEFORE firing any wire action so the morph preserves the active node.
- Mirror `button.jte` house conventions exactly: header doc-comment with credits + tier + a11y +
  params + usage, typed `@param`, `data-slot="tree-select"`, `data-variant`, `data-size`, zero
  `<script>`, zero inline `on*=`.
- Minimal code to GREEN against the acceptance tests above. The keyboard map and the wire round-trip
  IT are the load-bearing gates; assert ALL of them.
