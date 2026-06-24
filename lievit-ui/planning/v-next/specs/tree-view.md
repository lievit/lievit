<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — tree-view (NET-NEW: hierarchical data display with keyboard navigation)

- **tier**: PARTIAL + ENH (`tree-view.enhancer.ts`, consuming `collection-nav.enhancer.ts` for arrow navigation and roving tabindex; `tree-view-virtual.enhancer.ts` for virtual-scroll when `virtual=true`)
- **build sequence**: S2 (long-tail, heaviest-client; `03-component-inventory.md`)
- **status (current)**: NET-NEW (no equivalent in the 68-template set; `registry/jte/` has no tree widget)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Tree View (BUILT: `role=tree`, arrow-nav, expand/collapse, `aria-expanded`,
      `aria-level`, `aria-setsize`, `aria-posinset`; `collection-nav.enhancer.ts` owns the roving tabindex
      and typeahead; no react-aria reference for this pattern — built directly against the raw APG at
      https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
    - inventory: Ant Design Tree as inventory reference (checkable, draggable, async load,
      virtual scroll, multiple selection, custom node render, line guides; trim: drag-and-drop deferred
      to a future `+ENH` extension, not in this spec)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

---

## 1. What it is

A hierarchical data display that renders a tree of nodes — each optionally expandable to reveal
children — where the server provides the node data and (in WIRE-composed flows) the expand/collapse
state. The component itself is a **PARTIAL**: it is a pure presentational renderer, receiving the full
tree structure (nodes + their expanded/collapsed state) from the controller's typed model; it does not
own open-state itself. Server-first works correctly here because:
- A tree whose full data fits in a page render is best rendered server-side (JTE recurse over a typed
  node list) and patched by the lievit morph on state change — no client re-render overhead, no
  hydration, no stale subtree.
- The one irreducible client behavior — roving tabindex across items (arrow-nav, typeahead, expand/
  collapse keyboard) — is the shared `collection-nav.enhancer.ts`, which already owns this exact
  interaction model. This spec is a consumer of that mechanism, not a hand-roll.
- Async-lazy loading of a subtree (clicking a node with unloaded children) is the **HTMX** pattern:
  an `hx-get` on the node's toggle fires a server fragment swap; this spec documents the HTMX seam
  explicitly so the implementation does not invent a bespoke wire round-trip.

When the adopter needs virtual scrolling for very large trees (10k+ nodes), they opt into the
`tree-view-virtual.enhancer.ts` extension, which composes the same PARTIAL shell and manages
DOM recycling client-side. The static-tree PARTIAL is always the baseline; virtual is opt-in.

The `tree-select` component (a tree inside a combobox trigger) is a SEPARATE spec that COMPOSES this
PARTIAL for its popup body. Do not conflate.

---

## 2. API — params (the typed surface)

### 2.a JTE @param list (PARTIAL surface)

| param | type | default | meaning |
|---|---|---|---|
| `nodes` | `List<TreeNode>` | *(required)* | The full tree data model. `TreeNode` is a typed Java record carrying at minimum `id`, `label`, optional `icon`, optional `children`, `expanded` (current expand-state), `selected` (selection state for multi-select or last-selection), `disabled`, `checkable`, `checked`, `indeterminate`, and `loadable` (has children but they are not yet loaded — triggers the async seam). |
| `selectionMode` | `String` | `"none"` | `none` \| `single` \| `multiple` — whether and how nodes can be selected. `single` uses `aria-selected`; `multiple` adds `aria-multiselectable="true"` on the tree root and uses `aria-selected` per node. |
| `checkable` | `boolean` | `false` | When `true`, renders a checkbox inside every node row (uses `aria-checked` on the `treeitem`; `aria-selected` is then NOT set — the APG rule). Supports indeterminate state (`checked=null` → `aria-checked="mixed"`). |
| `showLine` | `boolean` | `false` | Renders vertical guide lines connecting sibling nodes (purely CSS; no semantic impact). |
| `showIcon` | `boolean` | `true` | Whether to render the `icon` field of each `TreeNode` if present. |
| `draggable` | `boolean` | `false` | Reserved param (renders `data-draggable` on each `treeitem`); actual drag logic is a future `+ENH` extension and is NOT in scope for this spec. The param exists so the template does not need to change when that extension lands. |
| `virtual` | `boolean` | `false` | Signals to the runtime that the `tree-view-virtual.enhancer.ts` will manage DOM recycling. Changes the container sizing markup (fixed-height wrapper, a `data-virtual` flag). The PARTIAL renders the initial window of nodes; the enhancer takes over on mount. |
| `virtualItemHeight` | `int` | `32` | (Only used when `virtual=true`) The fixed pixel height of each visible node row — required for the virtual scroller's height math. |
| `emptyLabel` | `String` | `"No items"` | Text shown when `nodes` is empty; rendered inside the tree root so assistive technology hears it (not aria-hidden). |
| `loadingLabel` | `String` | `"Loading…"` | Text announced via the shared live-region announcer when an async subtree fetch is in flight (the HTMX seam). |
| `ariaLabel` | `String` | `null` | `aria-label` on the tree root. Provide when no visible heading labels the tree. Exactly one of `ariaLabel` or `ariaLabelledBy` must be set for a non-empty tree. |
| `ariaLabelledBy` | `String` | `null` | `aria-labelledby` pointing to an external heading `id`. Mutually exclusive with `ariaLabel`. |
| `cssClass` | `String` | `""` | Extra utility classes on the root `<ul role="tree">`. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `id="my-tree"`, `data-testid="org-tree"`). Never feed per-node DB values here. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` on the root (value via `Escape.htmlAttribute`). |
| `nodeAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** `data-*` merged onto EVERY node row element. Use for top-level wire hooks (e.g. `hx-target` for the HTMX lazy-load seam). Per-node wire args are in `TreeNode.wireArgs`. |

### 2.b TreeNode record (the typed model shape)

The controller constructs and passes `List<TreeNode>`; the JTE template recurses over it.
`TreeNode` is a value record, not a wire component field. Its shape (all fields are readable by the
JTE template via normal record accessors):

| field | Java type | meaning |
|---|---|---|
| `id` | `String` | Unique, stable node identifier — used as the DOM `id` of the `treeitem` (for `aria-activedescendant` and for the HTMX fragment target). MUST be unique per page. |
| `label` | `String` | Visible node text; also the accessible name of the `treeitem`. |
| `icon` | `String` | Optional Lucide icon name passed to `@template.lievit.icon(...)` when `showIcon=true`. |
| `children` | `List<TreeNode>` | Nested children; empty list = leaf node (no `aria-expanded`). |
| `expanded` | `boolean` | Whether this node's children group is currently open. Reflected into `aria-expanded`. |
| `selected` | `boolean` | Whether this node is in the selection set. Reflected into `aria-selected` (or suppressed when `checkable`). |
| `checked` | `Boolean` | Null = `aria-checked="mixed"` (indeterminate); `true` = checked; `false` = unchecked. Only meaningful when `checkable=true`. |
| `disabled` | `boolean` | Dims the node; the `treeitem` gets `aria-disabled="true"` and is excluded from keyboard navigation by the enhancer. |
| `loadable` | `boolean` | `true` = has children not yet fetched; renders a collapsed node with the HTMX lazy-load seam (no `<ul role="group">` yet). |
| `depth` | `int` | Zero-based depth in the tree (root nodes = 0). Used to set `aria-level="${node.depth + 1}"` and to compute the left-padding indentation token multiply. |
| `setSize` | `int` | Total number of sibling nodes at this level. Passed as `aria-setsize` (required by APG when the DOM does not hold the full tree, e.g. virtual mode). |
| `posInSet` | `int` | One-based position among siblings. Passed as `aria-posinset`. |
| `wireArgs` | `Map<String,String>` | **SAFE escaped** per-node wire data (e.g. `{nodeId: node.id()}`) passed as escaped `data-*` on the node row element. Used by HTMX expand or by a consuming WIRE template's action. |

### 2.c Enhancer configuration attributes (data-* on the tree root, read by the enhancer)

These are set by the JTE template automatically (not by the adopter):

| attribute | value | meaning |
|---|---|---|
| `data-slot="tree-view"` | (present) | Structural identity for tests and styling hooks. |
| `data-selection-mode` | `none` \| `single` \| `multiple` | Read by the enhancer to decide selection keyboard behavior. |
| `data-checkable` | `true` \| `false` | Read by the enhancer to dispatch check vs select actions. |
| `data-virtual` | `true` \| `false` | Signals the virtual enhancer to take over DOM recycling. |
| `data-lievit-tree` | `""` | Sentinel for the enhancer's mount query. |

---

## 3. Variants / Sizes / States

### Variants

Tree-view has no `variant` param in the intent-vocabulary sense (it is a data display, not an action
control). The node intent IS carried by the data: a `selected` node renders with the accent token pair;
a `disabled` node renders dimmed. The `showLine` boolean is the only structural variant.

There is no primary/secondary/destructive surface on the tree itself. A consuming template may wrap
the tree in a `card` partial (section + card partial composition) for visual containment, but the
tree itself is unstyled at the outer boundary.

### Sizes

Tree-view does not expose a `size` param (it is not a toolbar-aligned control). Node row height is
fixed by the token `--lv-tree-row-height` (defaults to `--lv-space-9`, 36px, matching `md` form
controls so a tree inside a panel feels proportional). The `virtualItemHeight` param mirrors this
for the virtual scroller's math; if an adopter changes the token, they MUST update the param too.
Icon size tracks `--lv-text-sm` (16px), indentation per depth level is `--lv-tree-indent` (20px
default).

### States

| State | How triggered | ARIA reflection | Visual |
|---|---|---|---|
| `expanded` | `node.expanded = true` | `aria-expanded="true"` on the `treeitem` | Chevron rotates 90° (CSS `data-expanded` attr selector) |
| `collapsed` | `node.expanded = false` | `aria-expanded="false"` on the `treeitem` | Chevron points right |
| `leaf` | `node.children.isEmpty() && !node.loadable` | No `aria-expanded` attribute (absent = leaf, per APG) | No chevron |
| `loadable` (lazy) | `node.loadable = true` | `aria-expanded="false"` (treated as collapsed, not yet fetched) | Collapsed chevron; HTMX fetch fires on first expand |
| `selected` | `node.selected = true` | `aria-selected="true"` (when `selectionMode != none`) | Accent background `--lv-color-accent` / `--lv-color-accent-fg` |
| `checked` | `node.checked = true` | `aria-checked="true"` (when `checkable=true`) | Checkbox checked |
| `indeterminate` | `node.checked = null` | `aria-checked="mixed"` | Checkbox in native indeterminate state (`indeterminate` property set by enhancer) |
| `disabled` | `node.disabled = true` | `aria-disabled="true"` | `--lv-color-muted-fg` opacity; excluded from keyboard nav by enhancer |
| `focus-visible` | Keyboard nav lands on node | `:focus-visible` on the `treeitem` | `--lv-ring` outline |
| `loading` (async) | HTMX request in-flight | `aria-busy="true"` on the expanding node row | Spinner in place of chevron; announced via live-region |

### Slots

Tree-view is a PARTIAL with no `gg.jte.Content` children slot: the node tree IS the content and it
comes from the typed `nodes` model. There is one optional extension point:

| slot | type | meaning |
|---|---|---|
| `nodeLeading` | `gg.jte.Content` | When set, rendered before the label on EVERY node row (e.g. a custom icon block). Takes precedence over the built-in `icon` rendering. |
| `nodeTrailing` | `gg.jte.Content` | When set, rendered after the label on every node row (e.g. a row action menu trigger). The slot receives no per-node context (it is static markup); per-node wiring uses `wireArgs` on the TreeNode. |

The node structure itself is OWNED by the recursive JTE template — no slot for the label row, the
chevron, or the checkbox. That ownership is intentional (it prevents the "silent slot" projection bug
class the server-first pivot eliminated).

---

## 4. The a11y contract (the load-bearing section)

**APG source**: https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
(BUILT against the raw APG — react-aria does not publish a `useTree` hook; `collection-nav` covers
the roving tabindex and typeahead sub-patterns that ARE specced by react-aria's `useList`/`useMenu`
shape, adapted for the tree's hierarchical structure.)

### 4.a Roles + ARIA

| Element | Role / attribute | Rule |
|---|---|---|
| Root `<ul>` | `role="tree"` | The single tree container. One per component instance. |
| Root `<ul>` | `aria-label` OR `aria-labelledby` | Exactly one MUST be present (enforced by the axe rule). |
| Root `<ul>` | `aria-multiselectable="true"` | Set when `selectionMode="multiple"`. Absent for single-select and none. |
| Each node row `<li>` | `role="treeitem"` | Every node regardless of depth or parent/leaf status. |
| Each node row `<li>` | `aria-level="${node.depth + 1}"` | Depth-in-hierarchy (1-based). Always set (not optional) so screen readers announce depth even in a fully-rendered DOM. |
| Each node row `<li>` | `aria-setsize="${node.setSize}"` | Total siblings at this level. Always set; required in virtual mode, good hygiene in static. |
| Each node row `<li>` | `aria-posinset="${node.posInSet}"` | Position among siblings (1-based). Always set. |
| Each node row `<li>` | `aria-expanded="true"` OR `aria-expanded="false"` | Set on PARENT nodes only (children is non-empty or `loadable=true`). ABSENT on leaf nodes. This is the APG rule: a missing `aria-expanded` signals a leaf to assistive technology. |
| Each node row `<li>` | `aria-selected="true"` OR `aria-selected="false"` | Set when `selectionMode != none` AND `checkable=false`. Absent entirely when `selectionMode="none"`. |
| Each node row `<li>` | `aria-checked="true"` OR `aria-checked="false"` OR `aria-checked="mixed"` | Set when `checkable=true`. `aria-selected` is then ABSENT (the APG rule: do not mix both on the same node). |
| Each node row `<li>` | `aria-disabled="true"` | Set when `node.disabled = true`. |
| Each node row `<li>` | `tabindex="0"` (active item) OR `tabindex="-1"` (all others) | Roving tabindex model. Exactly ONE `treeitem` has `tabindex="0"` at any time. Managed by `collection-nav`. |
| Each node row `<li>` | `id="${node.id}"` | Required for `aria-activedescendant` if using the activedescendant model. This spec uses roving tabindex (DOM focus moves), so `id` is still set for HTMX fragment targeting and test hooks — not for activedescendant. |
| Children `<ul>` | `role="group"` | The container for a node's direct children. Rendered when `node.expanded = true` and children are present. Absent (not `hidden`) when collapsed — the APG recommendation for trees is to REMOVE the group from the DOM when collapsed rather than `hidden`-hiding it, so the AT does not walk a large hidden subtree. |
| Chevron button | `<button aria-hidden="true" tabindex="-1">` | The expand/collapse affordance. `aria-hidden` because the `treeitem` itself carries `aria-expanded`; `tabindex="-1"` because the `treeitem` row is the keyboard target, not the chevron separately. The click area of the chevron is a real `<button>` for pointer/touch users but is hidden from the accessibility tree. |
| Checkbox (checkable) | `<input type="checkbox" aria-hidden="true" tabindex="-1">` inside the `treeitem` | The visual checkbox. `aria-hidden` because the `treeitem` itself carries `aria-checked`; indeterminate state set via the `indeterminate` DOM property by the enhancer on mount/morph. |
| Loading spinner (async) | `aria-busy="true"` on the `treeitem`; `role="status"` live-region via the shared announcer | The loading label is announced when the fetch begins; `aria-busy` clears on the morph after the subtree fragment arrives. |

### 4.b Keyboard interaction map

Source: https://www.w3.org/WAI/ARIA/apg/patterns/treeview/ (verified 2026-06-24, BUILT).

The `collection-nav.enhancer.ts` owns all non-platform keys in this map. Platform = the native
`tabindex` roving mechanism.

| Key | Action | Who |
|---|---|---|
| `ArrowDown` | Move focus to the NEXT focusable node (post-order traversal: if current is expanded, goes to first child; otherwise goes to next sibling; then to parent's next sibling, etc.). Does not open or close any node. | `collection-nav` (tree mode) |
| `ArrowUp` | Move focus to the PREVIOUS focusable node (reverse post-order). Does not open or close any node. | `collection-nav` (tree mode) |
| `ArrowRight` | On a COLLAPSED parent: expand it (fires the expand action / HTMX trigger). On an EXPANDED parent: move focus to its FIRST child. On a LEAF node: no action. | enhancer |
| `ArrowLeft` | On an EXPANDED parent: collapse it (fires the collapse action). On a COLLAPSED node or LEAF: move focus to the node's PARENT (or no action if already at a root node). | enhancer |
| `Home` | Move focus to the FIRST node in the tree (the very first root node), without expanding or collapsing. | `collection-nav` |
| `End` | Move focus to the LAST FOCUSABLE node in the tree (the last visible, non-collapsed leaf or parent), without expanding. | `collection-nav` |
| `Enter` | Activate the focused node: if the node is activatable (the adopter's tree has node actions), fires the node's wire action. For parent nodes, also TOGGLES expand/collapse (same as `ArrowRight`/`ArrowLeft`). In single-select trees, also SELECTS the node. | enhancer → wire / HTMX |
| `Space` | (Only when `selectionMode != "none"` or `checkable=true`) TOGGLE selection / check state of the focused node WITHOUT affecting focus position. In multi-select, toggles this node without clearing others. | enhancer |
| `Shift + ArrowDown` | (Only when `selectionMode="multiple"`) Move focus to next node AND add it to the selection set. | enhancer |
| `Shift + ArrowUp` | (Only when `selectionMode="multiple"`) Move focus to previous node AND add it to the selection set. | enhancer |
| `Shift + Space` | (Only when `selectionMode="multiple"`) Select all nodes from the last-selected node to the current focused node (contiguous range). | enhancer |
| `Ctrl + A` | (Only when `selectionMode="multiple"`) Select ALL visible (non-disabled) nodes. If all are already selected, deselect all. | enhancer |
| Typeahead (printable character) | Move focus to the NEXT node whose label starts with the typed character(s). Case-insensitive. Wraps from end back to the start of the tree. | `collection-nav` (same typeahead mechanism as listbox) |
| `*` (asterisk, optional) | Expand ALL sibling nodes at the same level as the currently focused node. Does not collapse. | enhancer (optional, gated by `data-expand-all-allowed` if the adopter opts in) |
| `Tab` | Move focus OUT of the tree entirely (to the next focusable element in the page tab order). The roving tabindex ensures exactly one `treeitem` carries `tabindex="0"` at exit, so re-entering the tree with Shift+Tab returns to the last focused node. | Platform |
| `Shift + Tab` | Move focus OUT of the tree to the previous focusable element. | Platform |

### 4.c Focus management

**Model**: roving tabindex (DOM focus moves among `treeitem` elements), NOT `aria-activedescendant`.
Rationale: the APG explicitly supports both; the roving model is simpler to implement correctly with
the server-rendered + morph substrate because `aria-activedescendant` requires the `id`-to-option
map to survive morphs without drift. The morph already preserves DOM identity (focus node keeps
`tabindex="0"` across a morph), making roving tabindex the natural fit.

**Initial focus**: when the tree first receives Tab focus from the page:
- If `selectionMode != "none"` and at least one node is `selected=true`: focus goes to the first
  selected node.
- Otherwise: focus goes to the first root node (the first `treeitem` in DOM order).
- `collection-nav` sets `tabindex="0"` on the initial node and `-1` on all others on mount.

**Focus during expand/collapse**: when the user arrows into expanding/collapsing, the focus node
(the `treeitem` that received the key) RETAINS focus after the morph. The lievit morph preserves
the `tabindex="0"` node's DOM identity, so focus stays without any enhancer-side save/restore.
Exception: if the focused node's parent is collapsed (ArrowLeft on a child), focus moves to the
parent BEFORE the collapse wire action fires, so the morph's focus-on-parent is correct.

**Focus return after async load (HTMX)**: when a `loadable` node fires its HTMX expand fetch,
the `tree-view.enhancer.ts` sets a `data-restore-focus` marker on the expanding `treeitem` before
the request. The HTMX `htmx:afterSwap` event clears the marker and re-applies `tabindex="0"` to
that node. The enhancer does NOT hand-roll `aria-busy`; the template sets it as a JTE conditional
on the `loadable` node when an in-flight marker is present.

**Multi-select focus**: focus and selection are INDEPENDENT in the multi-select model (the APG
"recommended model"). Arrow keys move focus without changing selection; Space/Shift+Arrow change
selection without necessarily moving focus. The enhancer tracks a `lastSelectedId` for the
Shift+Space range operation.

**No focus trap**: tree-view is non-modal. Tab exits the tree freely.

**Shared mechanism**: `collection-nav.enhancer.ts` owns the roving tabindex, typeahead, and
linear (ArrowDown/Up/Home/End) traversal. The `tree-view.enhancer.ts` composes it and adds the
hierarchical (ArrowRight/Left, expand/collapse) and selection (Space/Shift) layers on top. Do NOT
re-implement collection-nav's traversal or typeahead inside the tree-view enhancer.

### 4.d Live region

When an async subtree is loading (HTMX fetch in-flight), the shared live-region announcer fires
the `loadingLabel` string (e.g. "Loading…"). When the fetch completes and the morph lands, the
announcer fires a completion message (e.g. "Subtree loaded, 5 items"). The announcer is the shared
`role="status"` region from the live-region mechanism — do NOT add a new `aria-live` attribute
inside the tree template.

---

## 5. Tokens

### Existing tokens consumed

| Token | Used for |
|---|---|
| `--lv-color-fg` | Node label text |
| `--lv-color-muted-fg` | Disabled node label; guide line color |
| `--lv-color-accent` | Selected node background |
| `--lv-color-accent-fg` | Selected node label |
| `--lv-color-border` | Guide lines (`showLine=true`); checkbox border |
| `--lv-color-popover` | Tree container background (inherits; no explicit background set on the tree root itself — the container provides it) |
| `--lv-space-2` | Chevron / checkbox icon gap inside the node row |
| `--lv-space-3` | Vertical padding of a node row (top + bottom, half each) |
| `--lv-space-4` | Horizontal padding at the deepest nesting (minimum left gutter) |
| `--lv-text-sm` | Node label font size; icon size |
| `--lv-font-sans` | Label font family |
| `--lv-radius-sm` | Selected-node background pill rounding |
| `--lv-ring` | Focus-visible ring on the focused `treeitem` |
| `--lv-motion-duration-fast` | Chevron rotation transition |
| `--lv-motion-easing-default` | Chevron rotation easing |

### Net-new tokens (additive, go in `:root` + `.dark`)

| Token | Value (OKLCH) | Justification |
|---|---|---|
| `--lv-tree-row-height` | `var(--lv-space-9)` (36px) | The canonical per-row height for the virtual scroller's math AND for consistent density. Using an alias means a single token override resets both the visual height and the JS measurement. No literal value; resolves through the existing space scale. |
| `--lv-tree-indent` | `20px` | Per-depth horizontal indentation step. Not an alias of a space token because it is a tree-specific density parameter, not a general spacing unit. OKLCH not applicable (not a colour). Value `20px` is the Ant Design Tree default, chosen for readability at the gestionale's typical 3–5 depth. |
| `--lv-color-tree-guide` | `oklch(0.78 0.00 0 / 0.25)` | The guide-line colour (`showLine=true`). A semi-transparent neutral that works on both light and dark backgrounds without a separate `.dark` re-point (alpha handles both). Net-new because no existing border/muted token has the right opacity for a structural line at this weight. Dark re-point: same value (alpha-based; theme-invariant). |

---

## 6. Wire / island integration

### 6.a Static + PARTIAL rendering (the default path, no WIRE component)

The tree is a PARTIAL. The controller builds the `List<TreeNode>` (including `expanded` states, which
are tracked however the adopter chooses — session attribute, query param, or a WIRE component that
WRAPS the tree partial) and passes it to the JTE template. The JTE recurses:

```
<ul role="tree" data-lievit-tree data-slot="tree-view" …>
  @for (TreeNode node : nodes)
    ${template.lievit.tree_view_node(node, selectionMode, checkable, showLine, showIcon, nodeLeading, nodeTrailing)}
  @endfor
</ul>
```

The recursive helper `tree-view-node.jte` renders one `<li role="treeitem">` and, if
`node.expanded && !node.children.isEmpty()`, recursively calls itself for the children inside a
`<ul role="group">`. The depth-tracking indentation is handled by `--lv-tree-indent` × `node.depth`
as a CSS custom property override on the node element:

```
style="--_depth: ${node.depth}; padding-left: calc(var(--_depth) * var(--lv-tree-indent) + var(--lv-space-4));"
```

The `style` attribute is used here for the single computed padding-left value (a structural layout
measurement, not a colour or design-intent value) — this is the canonical Tailwind-UI-grade approach
for variable-depth indentation. It is NOT a violation of the "no literal colours" rule.

### 6.b Expand / collapse (two seams; the adopter chooses one)

**Seam A — WIRE wrapper** (when the consuming page already has a WIRE component): the consuming
`@Wire boolean[] expandedSet` field (or a `Set<String> expandedIds`) is toggled by a
`@LievitAction toggleNode(String id)` on the wrapping WIRE component. The tree partial is re-rendered
inside the WIRE template's region on each morph. The toggle click is wired via `wireArgs` on each
`TreeNode` + `l:click="toggleNode"` on the node row. No HTMX needed.

**Seam B — HTMX lazy load** (`loadable=true` nodes): the node row carries:
```html
hx-get="/api/tree-fragment/{nodeId}"
hx-target="#${node.id}-group"
hx-trigger="click from:closest [data-lievit-tree-expand]"
hx-swap="outerHTML"
```
The server returns a `<ul role="group">` fragment. The fragment target `id="${node.id}-group"` is
rendered as an empty sentinel div by the PARTIAL when `node.loadable=true && !node.expanded`. On
swap, the morph replaces it with the real children. The `tree-view.enhancer.ts` handles the
`htmx:beforeRequest` (sets `aria-busy` via dataset mutation) and `htmx:afterSwap` (clears busy,
refocuses, fires the live-region announcer). HTMX is used ONLY for the async lazy-load seam; it is
NOT the expand/collapse mechanism for fully-rendered trees (Seam A handles that).

### 6.c Enhancer responsibilities (`tree-view.enhancer.ts`)

Registered via the directive registry as `l:tree` on the `[data-lievit-tree]` root. Mount fires
on `onComponentInit` (lifecycle registry). The enhancer:

1. **Initialises `collection-nav`** in tree mode: passes the node traversal function (ArrowDown/Up/
   Home/End are hierarchical post-order, not flat-list linear) and the typeahead label extractor
   (`treeitem.textContent.trim()`). The tree-mode traversal is the NEW parameter added to
   `collection-nav` for this component (the API extension is in the `collection-nav` spec's
   responsibility; this spec is the first consumer that proves it).
2. **Binds ArrowRight / ArrowLeft**: expand/collapse or focus-move to child/parent, calling the
   server-side toggle (Seam A) or HTMX fetch (Seam B) depending on `data-loadable` on the node.
3. **Binds Space / Shift+Arrow / Shift+Space / Ctrl+A**: selection + check state mutations,
   firing the consuming WIRE component's `selectNode(id)` / `checkNode(id)` wire actions.
4. **Sets checkbox `indeterminate`**: on mount and after every morph (`onComponentUpdate`
   lifecycle hook), iterates `[aria-checked="mixed"]` nodes and sets their inner
   `<input type="checkbox">.indeterminate = true` (the `indeterminate` property cannot be set via
   HTML attribute; it requires JS, hence the enhancer responsibility).
5. **Handles HTMX events** for the lazy-load seam: `htmx:beforeRequest` → set `aria-busy`;
   `htmx:afterSwap` → clear busy, restore focus, announce via live-region.
6. **Manages the `*` (expand-all-siblings) optional key** when `data-expand-all-allowed` is present.

The enhancer does NOT manage routing, URL state, or scroll position — those are the consuming
application's concern.

### 6.d Virtual mode (`tree-view-virtual.enhancer.ts`)

When `virtual=true`, this SEPARATE enhancer (not shipped in S2 base; scheduled for the same S2 wave
after the static PARTIAL is green) takes over DOM recycling:

1. The PARTIAL renders the initial viewport slice of nodes (the controller computes the visible
   window from a `virtualOffset` param).
2. The virtual enhancer measures `--lv-tree-row-height`, sets the container height to
   `totalNodes × rowHeight`, and creates a position-absolute inner node that it scrolls into the
   visible window by replacing the rendered DOM on scroll (requestAnimationFrame-gated).
3. Focus is maintained across virtual scrolls by the same roving-tabindex model; the enhancer
   ensures the focused `treeitem` is always in the DOM window (if the user arrows past the viewport
   edge, the enhancer triggers a window shift via a `scrollIntoView`-equivalent dataset update that
   signals the next server render or a client-managed DOM patch, TBD in the virtual-enhancer spec).
4. The `collection-nav` integration remains unchanged; the virtual enhancer composes it.

---

## 7. Acceptance tests (the gate — refute-by-default)

The component is DONE only when ALL of the following pass on REAL substrates. Each row names the
observable assertion.

### 7.a Render (jsdom + real PARTIAL compile)

| Test | Assertion |
|---|---|
| `renders_root_with_role_tree` | The `<ul>` root has `role="tree"` and either `aria-label` or `aria-labelledby` (never both, never neither). |
| `renders_treeitem_for_every_node` | Every `TreeNode` in `nodes` produces exactly one `<li role="treeitem">` in the DOM. |
| `parent_node_has_aria_expanded` | A node with non-empty `children` has `aria-expanded="true"` (when `expanded=true`) or `aria-expanded="false"` (when `expanded=false`). |
| `leaf_node_has_no_aria_expanded` | A node with `children.isEmpty() && !loadable` has NO `aria-expanded` attribute. |
| `loadable_node_has_aria_expanded_false` | A `loadable=true` node has `aria-expanded="false"` (not absent). |
| `aria_level_matches_depth` | A root node (`depth=0`) has `aria-level="1"`; a grandchild (`depth=2`) has `aria-level="3"`. |
| `aria_setsize_and_posinset_correct` | A node with `setSize=3 posInSet=2` renders `aria-setsize="3" aria-posinset="2"`. |
| `selected_node_has_aria_selected_true` | When `selectionMode="single"` and `node.selected=true`, the node has `aria-selected="true"`. |
| `unselected_node_has_aria_selected_false` | When `selectionMode="single"` and `node.selected=false`, the node has `aria-selected="false"`. |
| `no_aria_selected_when_mode_none` | When `selectionMode="none"`, no `aria-selected` attribute appears anywhere in the tree. |
| `multiselectable_set_when_multiple` | When `selectionMode="multiple"`, the tree root has `aria-multiselectable="true"`. |
| `checkable_uses_aria_checked_not_selected` | When `checkable=true`, nodes carry `aria-checked` and NO `aria-selected`. `node.checked=null` → `aria-checked="mixed"`. |
| `disabled_node_has_aria_disabled` | `node.disabled=true` → `aria-disabled="true"` on the `treeitem`. |
| `expanded_children_rendered_in_group` | When `node.expanded=true`, a `<ul role="group">` containing the children treeitems is present in the DOM. |
| `collapsed_children_absent_from_dom` | When `node.expanded=false` and `children.size > 0`, NO `<ul role="group">` with those children is in the DOM (removed, not hidden). |
| `empty_tree_renders_empty_label` | When `nodes` is empty, the `emptyLabel` text is visible inside the tree root element. |
| `show_line_renders_guide_css_class` | When `showLine=true`, a CSS class that maps to `--lv-color-tree-guide` is present on the tree root or node rows. |
| `indentation_depth_token_set` | A node at `depth=2` has `--_depth: 2` in its inline style and the computed padding-left equals `2 × var(--lv-tree-indent) + var(--lv-space-4)`. |
| `chevron_aria_hidden` | The chevron `<button>` inside a parent `treeitem` has `aria-hidden="true"` and `tabindex="-1"`. |
| `data_slot_present` | The root element has `data-slot="tree-view"`. |

### 7.b axe-core (on the rendered DOM, real substrate)

| Test | Assertion |
|---|---|
| `axe_zero_violations_static_tree` | `axe.run` on a rendered 3-level static tree (no empty, no dynamic) reports zero violations. |
| `axe_zero_violations_empty_tree` | `axe.run` on the empty state reports zero violations (the empty label is accessible). |
| `axe_zero_violations_checkable_tree` | `axe.run` on a `checkable=true` tree with a mix of checked/unchecked/indeterminate nodes reports zero violations. |
| `axe_zero_violations_multiselect` | `axe.run` with `selectionMode="multiple"` and multiple `aria-selected="true"` nodes reports zero violations. |
| `axe_fails_without_accessible_name` | Rendering with `ariaLabel=null` AND `ariaLabelledBy=null` produces an axe violation (the accessible-name rule) — the test asserts the FAILURE to guard against regressions in the template's required-param logic. |

### 7.c Keyboard (real `tree-view.enhancer.ts` + `collection-nav` mounted on jsdom, NOT mocked)

One test per key in the §4.b map. Each asserts the OBSERVABLE DOM outcome.

| Test | Assertion |
|---|---|
| `arrow_down_moves_focus_to_next_node` | ArrowDown from node A moves `tabindex="0"` to the next focusable node in post-order; node A gets `tabindex="-1"`. |
| `arrow_down_descends_into_expanded_children` | ArrowDown from an expanded parent moves focus to its FIRST child (not its next sibling). |
| `arrow_up_moves_focus_to_prev_node` | ArrowUp from node B moves focus to the previous node; B gets `tabindex="-1"`. |
| `home_moves_to_first_root_node` | Home from any depth moves focus to the first root `treeitem`. |
| `end_moves_to_last_visible_node` | End moves focus to the last visible (non-collapsed) `treeitem`. |
| `arrow_right_expands_collapsed_parent` | ArrowRight on a collapsed parent fires the expand action; after the morph the `treeitem` has `aria-expanded="true"` and the children group is in the DOM. |
| `arrow_right_moves_to_first_child_if_open` | ArrowRight on an already-expanded parent moves focus to its first child without toggling expand. |
| `arrow_right_noop_on_leaf` | ArrowRight on a leaf node produces no DOM change and no action. |
| `arrow_left_collapses_expanded_parent` | ArrowLeft on an expanded parent fires the collapse action; after the morph `aria-expanded="false"` and children group is absent. |
| `arrow_left_moves_to_parent_if_collapsed` | ArrowLeft on a collapsed child (depth > 0) moves focus to its parent `treeitem` without collapsing it. |
| `arrow_left_noop_on_root_collapsed` | ArrowLeft on a collapsed root node (depth=0) produces no DOM change. |
| `enter_toggles_expand_on_parent` | Enter on a collapsed parent expands it; Enter again collapses it. |
| `enter_selects_node_in_single_select` | Enter on a node in `selectionMode="single"` fires the select action; the node gets `aria-selected="true"`. |
| `space_toggles_selection_without_moving_focus` | Space on a node in `selectionMode="single"` toggles `aria-selected` and focus remains on the same node. |
| `space_toggles_check_in_checkable_tree` | Space on a node in a `checkable=true` tree fires the check action; `aria-checked` flips. |
| `shift_arrow_down_extends_selection` | In `selectionMode="multiple"`, Shift+ArrowDown moves focus to next node AND adds it to the selection (both original and next have `aria-selected="true"`). |
| `shift_space_selects_range` | In `selectionMode="multiple"`, Space on node A, then ArrowDown+ArrowDown, then Shift+Space — asserts all three nodes have `aria-selected="true"`. |
| `ctrl_a_selects_all` | In `selectionMode="multiple"`, Ctrl+A selects all non-disabled visible nodes. |
| `ctrl_a_deselects_all_if_all_selected` | Ctrl+A when all nodes are already selected deselects all. |
| `typeahead_jumps_to_matching_node` | Typing "F" jumps focus to the next node whose label starts with "F" (case-insensitive). |
| `typeahead_wraps_from_end` | Typing "A" when the last matching node is already focused wraps to the first matching node. |
| `tab_exits_tree` | Tab from inside the tree moves focus OUT to the next page element; no `treeitem` traps Tab. |

### 7.d Focus

| Test | Assertion |
|---|---|
| `initial_focus_lands_on_first_root_node` | Tab into a tree with `selectionMode="none"` puts focus (`tabindex="0"`) on the first root `treeitem`. |
| `initial_focus_lands_on_selected_node` | Tab into a single-select tree where node B is `selected=true` puts focus on node B, not the first root node. |
| `focus_stays_on_toggling_node_after_morph` | After ArrowRight expands a node (server morph fires), the `treeitem` that received the key still has `tabindex="0"` (morph preserved focus identity). |
| `disabled_nodes_skipped_in_roving` | ArrowDown/Up skips nodes with `aria-disabled="true"` — the next/previous non-disabled `treeitem` receives focus. |
| `only_one_treeitem_has_tabindex_0` | At any point in time, exactly ONE `treeitem` in the tree has `tabindex="0"`; all others have `tabindex="-1"`. |
| `indeterminate_checkbox_set_by_enhancer` | After mount, an `aria-checked="mixed"` node's inner `<input type="checkbox">` has `indeterminate === true` (the DOM property, not an attribute). |

### 7.e Variants / structural

| Test | Assertion |
|---|---|
| `show_line_attr_sets_data_attribute` | `showLine=true` produces a CSS-targeting attribute on the root. |
| `node_trailing_slot_renders_on_every_row` | When `nodeTrailing` is set, every `treeitem` row contains the trailing slot markup. |
| `safe_wireargs_escaped` | A `TreeNode.wireArgs` value containing `"><script>` renders as an inert escaped string in the data attribute; no `<script>` tag in the DOM. |

### 7.f Wire round-trip (HTMX lazy-load seam, real HTMX substrate)

| Test | Assertion |
|---|---|
| `lazy_load_fires_htmx_on_expand` | A `loadable=true` node with `hx-get` present — triggering expand — fires an HTMX GET request. |
| `lazy_load_sets_aria_busy_before_swap` | Before the swap completes, the expanding `treeitem` has `aria-busy="true"`. |
| `lazy_load_clears_aria_busy_after_swap` | After `htmx:afterSwap`, `aria-busy` is absent; the children group is in the DOM with `role="group"`. |
| `lazy_load_focus_restored_after_swap` | After the swap, `tabindex="0"` is on the `treeitem` that triggered the load (not the first root node). |
| `lazy_load_announces_completion` | After the swap, the shared live-region `role="status"` contains the completion message. |

### 7.g JTE compile + render gate

| Test | Assertion |
|---|---|
| `jte_compiles_cleanly` | `tree-view.jte` and `tree-view-node.jte` pass the `test/jte-compile` real-compiler gate with no errors. |
| `renders_without_null_params` | Passing only the required `nodes` param (all others at their defaults) produces valid HTML; no NullPointerException. |

---

## 8. Non-goals / anti-patterns

- **No drag-and-drop in this spec.** The `draggable` param is a reserved stub. Reorder-by-drag is a
  future `+ENH` extension that adds a `tree-view-drag.enhancer.ts`; it is NOT implemented here.
  Implementing drag in this spec would scope-creep S2 and conflict with the single-responsibility
  of the static-tree PARTIAL.
- **No inline node editing.** Clicking a label to rename it in-place is not part of this spec.
  Inline edit belongs to a row action (`nodeTrailing` slot + a separate input field wired via the
  consuming WIRE component).
- **No tree-select conflation.** `tree-view` renders a tree as a standalone data display.
  `tree-select` (a separate S2 component) places a tree inside a combobox trigger and composes this
  PARTIAL. Do not add combobox trigger logic here.
- **No client-side expand state.** The enhancer fires a wire action or HTMX fetch to toggle
  expand; it does NOT toggle the DOM classes / children presence itself (that is a client-only state
  that diverges from the server on morph). The server owns `expanded` state.
- **No framework-managed virtual scroll.** Virtual scrolling is the `tree-view-virtual.enhancer.ts`,
  a separate typed-TS module. Do not import a third-party virtual-scroll library. Do not use
  `IntersectionObserver` as a virtual scroll shim (it is an infinite-scroll pattern, not a virtual
  window).
- **No `aria-activedescendant` model.** This spec uses roving tabindex (DOM focus moves). Do not mix
  both models; the morph substrate makes roving tabindex simpler and more correct.
- **No hand-rolling of roving tabindex or typeahead.** These are owned by `collection-nav.enhancer.ts`.
  Any tree-view enhancer code that re-implements ArrowDown/Up traversal or character typeahead is a
  violation of the single-source-a11y rule (architecture contract §2.b). Compose; do not duplicate.
- **No `hidden` on collapsed children groups.** The APG recommendation for trees is to remove the
  `<ul role="group">` from the DOM when collapsed, not to hide it. A large hidden subtree stays in
  the a11y tree and bloats screen-reader navigation. The PARTIAL achieves removal via JTE conditional
  rendering (`!{if (node.expanded && !node.children.isEmpty())}`); the enhancer does not `hidden`-toggle.
- **No `aria-expanded` on leaf nodes.** A leaf with `aria-expanded="false"` looks like a collapsed
  parent to assistive technology. The template must conditionally omit `aria-expanded` for leaf
  nodes (no children, not loadable). This is a hard correctness rule from the APG; the test
  `leaf_node_has_no_aria_expanded` is the guard.
- **No literal colours in the template or enhancer.** All colours are `var(--lv-*)` tokens, OKLCH
  in the `:root` block. The single exception is the `--_depth` computed inline style value
  (a unitless integer, not a colour).
