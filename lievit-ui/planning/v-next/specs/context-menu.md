<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — context-menu

- **tier**: WIRE + ENH (`collection-nav.enhancer.ts` shared roving/typeahead + `context-menu-trigger.enhancer.ts` net-new for right-click interception and positioning)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of existing `registry/jte/context-menu.jte` or equivalent)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Menu pattern (https://www.w3.org/WAI/ARIA/apg/patterns/menu/) — context-menu
      variant (right-click / `contextmenu` event triggers a `role="menu"` panel; keyboard map sourced from
      the APG Menu pattern, verified 2026-06-24); focus management = APG: focus moves to first item on open,
      Escape returns focus to the invoking element. react-aria `useMenu` / `useMenuItem` interaction model
      as secondary pattern reference for typeahead, rover, and disabled-item handling (transcribed into
      ORIGINAL `collection-nav` + the net-new trigger enhancer; no react-aria source copied).
    - inventory: Ant Design Dropdown as inventory reference for item variants (danger item, divider,
      groups/sections, icon+label, sub-menus, disabled items). Context-specific: browser native
      `contextmenu` override + keyboard equivalent (`Apps` / `Shift+F10`).
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

---

## 1. What it is

A context menu is a floating `role="menu"` panel that appears at the pointer position (or keyboard-invoked
at the target) when the user right-clicks (or uses the `Apps` / `Shift+F10` key) on a designated trigger
region. The set of available actions, the open/closed state, and which items are checked or disabled are
all SERVER facts — making this WIRE: the server renders the menu items and their current checked/disabled
state; the client never synthesises action options.

The two irreducible CLIENT behaviors are:
1. **Right-click interception + positioning** — the `context-menu-trigger.enhancer.ts` (net-new, small)
   intercepts the `contextmenu` DOM event on the trigger region, calls `preventDefault()` (suppresses the
   browser native menu), records the pointer coordinates, and fires the `open` wire action. After the
   server-morph the menu panel is present in the DOM; the enhancer then positions it at the recorded
   coordinates using the shared popover/anchor seam (CSS anchor positioning or a JS coordinate fallback for
   the right-click-at-pointer case, since CSS anchor positioning targets an element, not a point).
2. **Menu keyboard navigation** — the shared `collection-nav.enhancer.ts` owns arrow-key roving, typeahead,
   Home/End, and Enter/Space commit. Same enhancer that `dropdown-menu`, `select`, and `command` compose;
   zero hand-rolling.

Server-first works because: (a) the menu's action SET changes with domain state (e.g. "Rename" is present
only if the user has write permission — the server knows that; the client does not); (b) the checked state
of toggle items is a server-owned boolean; (c) every item activation is a wire round-trip anyway. The only
irreducible client bit is the gesture interception + coordinate-based placement, both cleanly confined to
one small enhancer.

---

## 2. API — the WIRE surface + template params

**Java (`ContextMenuComponent`)**:

| member | kind | meaning |
|---|---|---|
| `open` `boolean` | `@Wire` | panel open-state; `false` = panel absent from DOM |
| `x` `int` | `@Wire` | viewport X of the pointer at open time (pixels); passed to the trigger enhancer for positioning; 0 when closed |
| `y` `int` | `@Wire` | viewport Y of the pointer at open time (pixels); same |
| `items` `List<MenuItem>` | `@Wire @LievitProperty(locked=true)` | the full item set — the server owns which actions exist; a client cannot inject items. Locked: the set is set by the controller, not mutable via wire |
| `triggerSelector` `String` | `@Wire @LievitProperty(locked=true)` | CSS selector of the DOM region that listens for `contextmenu`; the trigger enhancer binds to it at init |
| `open(int x, int y)` | `@LievitAction` | sets `open=true`, records `x`/`y`, re-renders the panel; authz checked here: unavailable actions are suppressed BEFORE state mutates |
| `close()` | `@LievitAction` | sets `open=false`, clears `x`/`y`; the enhancer calls this on Escape / outside-click / item activation |
| `activate(String itemId)` | `@LievitAction` | dispatches the selected action; validates `itemId` ∈ items (defensive), then delegates to the registered handler for that item; closes on success |
| `toggleCheck(String itemId)` | `@LievitAction` | flips the `checked` boolean on a `CHECKBOX` item; validates kind; fires the domain side-effect; re-renders |

**`MenuItem` value type (server-side, read-only from the template)**:

| field | type | meaning |
|---|---|---|
| `id` | `String` | stable identifier; used in `data-item-id` (escaped) and for wire args |
| `kind` | `MenuItemKind` enum | `ACTION` \| `CHECKBOX` \| `RADIO` \| `SEPARATOR` \| `GROUP_HEADER` \| `SUBMENU` |
| `label` | `String` | visible label; used as accessible name |
| `icon` | `String` | optional Lucide icon name; rendered via `@template.lievit.icon` |
| `shortcut` | `String` | optional keyboard shortcut hint text (display only; actual binding is the adopter's concern) |
| `checked` | `boolean` | for `CHECKBOX` / `RADIO` items — the current checked state |
| `disabled` | `boolean` | item is visible but not activatable |
| `danger` | `boolean` | renders in the destructive token palette (confirm-before patterns) |
| `children` | `List<MenuItem>` | non-empty only for `SUBMENU` kind; the nested item set |

**Template params** (one `@param` per `@Wire` field + standard WIRE params):

| param | type | meaning |
|---|---|---|
| `open` | `boolean` | reflects `@Wire open` |
| `x` | `int` | reflects `@Wire x` |
| `y` | `int` | reflects `@Wire y` |
| `items` | `List<MenuItem>` | reflects `@Wire items` |
| `triggerSelector` | `String` | reflects `@Wire triggerSelector` |
| `_component` | `ComponentMetadata` | standard WIRE metadata (id, snapshot, FQN) |
| `_instance` | `ContextMenuComponent` | access to any derived view methods if needed |

No `Content` slot: WIRE templates own their markup (server-first refactor blueprint §1.b).

---

## 3. Variants / sizes / states

### Variants

Context menus carry no `variant` param of their own — they are always neutral/surface.
Item-level intent is expressed via the `MenuItem.danger` flag (maps to `--lv-color-destructive` / `-fg`
token pair) and `MenuItem.disabled`. There is no `primary` or `secondary` item: a context menu's visual
hierarchy comes from structure (separators, group headers, submenus), not intent variants.

### Sizes

| size | applies to | token |
|---|---|---|
| `sm` | item row height + icon size | `--lv-space-8` (32 px) |
| `md` | default | `--lv-space-9` (36 px) |
| `lg` | item row height + icon size | `--lv-space-10` (40 px) |

`size` is a `@Wire @LievitProperty(locked=true)` param: the adopter sets it once at component
instantiation; it is not mutable per item. The menu panel min-width is fixed (`--lv-context-menu-min-width`,
see §5). All `role="menuitem"` rows of the same size align flush — the toolbar-alignment discipline
(architecture contract §5.b).

### States (item-level)

| state | mechanism | ARIA |
|---|---|---|
| default | — | — |
| active / focused | `collection-nav` sets `data-active` + `aria-activedescendant` on the `role="menu"` | item `id` is the activedescendant target |
| disabled | `MenuItem.disabled=true` → `aria-disabled="true"` on the item | `aria-disabled`; item is in the DOM (screen reader reads it) but not activatable; `collection-nav` skips it |
| checked (checkbox) | `MenuItem.checked` → `aria-checked="true\|false"` | `role="menuitemcheckbox" aria-checked` |
| checked (radio) | `MenuItem.checked` → `aria-checked="true\|false"` | `role="menuitemradio" aria-checked` |
| danger | `MenuItem.danger=true` → `data-danger="true"` → destructive token classes | no ARIA change; visual only |
| submenu open | `ContextMenuComponent` of the nested submenu has `open=true` | `aria-expanded="true"` on the parent `role="menuitem"` that owns the submenu |
| panel open | `open=true` → panel present in DOM, `aria-hidden` absent | `role="menu"` visible |
| panel closed | `open=false` → panel not rendered (JTE boolean conditional → `hidden`/absent) | entire subtree absent from a11y tree |

### Slots / regions

Context menus have no `Content` slot (WIRE rule). Internal regions are OWNED markup:

| region | element | purpose |
|---|---|---|
| trigger wrapper | `data-slot="context-menu-trigger"` | the adopter's content that binds the `contextmenu` event |
| panel root | `data-slot="context-menu-panel"` | the floating `role="menu"` panel |
| item row | `data-slot="context-menu-item"` | one `role="menuitem\|menuitemcheckbox\|menuitemradio"` |
| group header | `data-slot="context-menu-group"` | `role="group" aria-labelledby` → the header element |
| separator | `data-slot="context-menu-separator"` | `role="separator"` |
| submenu panel | (recursive) | nested `role="menu"`, same structure |

---

## 4. The a11y contract (the heart — non-negotiable, fully specified)

**WAI-ARIA pattern**: APG Menu (right-click / context menu variant).
Source verified: https://www.w3.org/WAI/ARIA/apg/patterns/menu/ (fetched 2026-06-24).

### Roles + ARIA attributes

| element | role / attribute | value | notes |
|---|---|---|---|
| Menu panel root | `role="menu"` | — | the container; the a11y tree entry point for the menu |
| Menu panel root | `aria-label` | the region description (e.g. `"Row actions"`) OR | use `aria-labelledby` pointing to an offscreen / visible label |
| Menu panel root | `aria-labelledby` | id of the label element | one of `aria-label` / `aria-labelledby` is REQUIRED; prefer `aria-labelledby` if a visible context is available |
| Menu panel root | `aria-orientation` | `"vertical"` | a context menu is always vertical |
| Standard action item | `role="menuitem"` | — | every plain action |
| Standard action item | `id` | stable item id (scoped to the component instance) | targeted by `aria-activedescendant` on the panel |
| Standard action item | `aria-disabled` | `"true"` when disabled | item stays in DOM + a11y tree; `collection-nav` skips it for roving |
| Standard action item | `aria-keyshortcuts` | e.g. `"Control+Z"` | when `shortcut` is set; informs AT of the keyboard shortcut |
| Checkbox item | `role="menuitemcheckbox"` | — | toggleable item |
| Checkbox item | `aria-checked` | `"true"\|"false"` | reflects `MenuItem.checked` |
| Radio item | `role="menuitemradio"` | — | mutually exclusive item in a group |
| Radio item | `aria-checked` | `"true"\|"false"` | reflects `MenuItem.checked`; only one per group = `"true"` |
| Group | `role="group"` | — | groups a set of items under a labelled section |
| Group | `aria-labelledby` | id of the group header element | the header element itself is `role="presentation"` (visual label only, not a menu item) |
| Separator | `role="separator"` | — | visual + semantic divider between groups or single items |
| Submenu trigger item | `role="menuitem"` | — | the item that opens the nested menu |
| Submenu trigger item | `aria-haspopup` | `"menu"` | signals that activating opens a nested menu |
| Submenu trigger item | `aria-expanded` | `"true"\|"false"` | reflects the nested `ContextMenuComponent.open` |
| Submenu trigger item | `aria-controls` | id of the nested `role="menu"` | links trigger to the submenu panel |
| Nested submenu panel | `role="menu"` | — | same structure, recursive |
| Trigger wrapper | no role (structural) | — | the adopter content; the trigger enhancer binds `contextmenu` on it |

### Keyboard interaction map

Sourced from WAI-ARIA APG Menu pattern (https://www.w3.org/WAI/ARIA/apg/patterns/menu/), verified 2026-06-24. `collection-nav.enhancer.ts` owns all non-platform keys.

| key | action | who supplies it |
|---|---|---|
| `contextmenu` event (right-click or `Apps` / `Shift+F10`) | open the panel at pointer coordinates (or at keyboard-invoked position); focus moves to the FIRST non-disabled item | `context-menu-trigger.enhancer.ts` intercepts the event; fires `open(x, y)` wire action; `collection-nav` sets initial focus on morph |
| `ArrowDown` | move focus to the NEXT non-disabled item; wraps to first from last | `collection-nav` |
| `ArrowUp` | move focus to the PREVIOUS non-disabled item; wraps to last from first | `collection-nav` |
| `Home` | move focus to the FIRST non-disabled item | `collection-nav` |
| `End` | move focus to the LAST non-disabled item | `collection-nav` |
| `Enter` | activate the focused item: if `ACTION` → fires `activate(itemId)` wire action; if `CHECKBOX` → fires `toggleCheck(itemId)`; if `RADIO` → fires `activate(itemId)`; if `SUBMENU` → opens submenu, focus moves to submenu's first item | `collection-nav` fires the wire action; platform `<button>` if item is a real button |
| `Space` | same as `Enter` for `ACTION`, `CHECKBOX`, `RADIO`; optional for `SUBMENU` | `collection-nav` |
| `ArrowRight` | if the focused item is a `SUBMENU` trigger: open submenu, move focus to its first non-disabled item | `collection-nav` |
| `ArrowLeft` | if inside a submenu: close submenu, return focus to the parent item in the parent menu | `collection-nav` |
| `Escape` | close the menu (and all open submenus); return focus to the element that triggered the menu (the target of the `contextmenu` event) | `context-menu-trigger.enhancer.ts` (listens while panel is open); fires `close()` wire action |
| `Tab` / `Shift+Tab` | close the menu and all open submenus; move focus out per normal tab order (do NOT cycle within the menu — context menus are not tab-trapped) | `collection-nav` / platform; fires `close()` wire action then releases focus |
| Printable character (typeahead) | move focus to the next item whose `label` begins with the typed character (case-insensitive); wraps | `collection-nav` typeahead |
| Click outside the panel | close the menu; return focus to the trigger target | `context-menu-trigger.enhancer.ts` (document click listener while open) |

### Focus management

- **Initial focus**: on open (after the server-morph renders the panel), `collection-nav` moves DOM focus to
  the first non-disabled `role="menuitem\|menuitemcheckbox\|menuitemradio"` in the panel. This is the APG
  requirement: "focus is moved to the first item".
- **Active item tracking**: `collection-nav` manages a roving `aria-activedescendant` on the `role="menu"`
  element — focus stays ON the menu panel element; the visually highlighted item is communicated to AT via
  `aria-activedescendant`. This follows the APG listbox/menu model (same as `select` and `dropdown-menu`).
- **No focus trap**: a context menu is NOT modal. Tab / Shift+Tab exit the menu and close it (APG: "Tab or
  Shift+Tab moves focus to next/previous focusable element in page, closing the menu"). There is no
  `focus-trap` enhancer here (contrast with `dialog` / `drawer`).
- **Focus restore on close**: when the menu closes (Escape, item activation, outside click, Tab), focus
  returns to the ELEMENT that was focused when the `contextmenu` event fired (the trigger target or the
  last keyboard-focused element within the trigger region). `context-menu-trigger.enhancer.ts` records the
  active element at `contextmenu` time and restores it on close.
- **Submenu focus**: opening a submenu moves focus to the submenu's first item (ArrowRight / Enter on a
  SUBMENU item). Closing a submenu (Escape or ArrowLeft) returns focus to the parent item in the parent menu.
- **Keyboard-invoked position**: when the context menu is opened via `Apps` / `Shift+F10` (keyboard), the
  panel is positioned adjacent to the focused element (or a fallback: top-left of the trigger region), NOT
  at pointer coordinates. `context-menu-trigger.enhancer.ts` detects keyboard invocation via the
  `contextmenu` event's `detail === 0` / no pointer coordinates and uses element-relative positioning.

### Live region

None. A context menu does not announce counts or status. If an item activation triggers an async operation
whose result needs announcement (e.g. "File deleted"), that announcement belongs to the `toast` /
`notification-bell` component, not to the context menu itself.

### Shared mechanisms composed

- **`context-menu-trigger.enhancer.ts`** (net-new, small): intercepts `contextmenu` on the trigger region,
  `preventDefault()`, records pointer coords + the focused element, fires `open(x, y)` wire action; after
  morph: positions the panel via the popover seam; on close: restores focus; on outside-click / Escape: fires
  `close()`. Lives in this component's enhancer file; is NOT a general-purpose enhancer. It is too
  specific (it knows the `open(x, y)` action signature and the component's `triggerSelector`).
- **`collection-nav.enhancer.ts`** (shared, same as `select` / `dropdown-menu`): after the panel mounts,
  the trigger enhancer hands off keyboard navigation to `collection-nav`; it owns: arrow roving, Home/End,
  typeahead, Enter/Space commit, ArrowRight/Left for submenus, Tab to close. NOT hand-rolled.
- **Popover/anchor seam** (shared): the floating panel is positioned via the seam — CSS anchor positioning
  for the element-relative (keyboard-invoked) case; a `transform: translate(x, y)` CSS custom property
  injection (CSP-clean: no inline style; instead `data-menu-x` + `data-menu-y` attributes on the panel root
  drive a `[data-menu-x]` CSS rule) for the pointer-coordinate case. The seam also supplies light-dismiss
  (click outside closes); the trigger enhancer registers the additional `contextmenu` override.

Do NOT re-implement roving, typeahead, or outside-click dismiss from scratch. These three shared pieces are
the single-source-a11y rule (architecture contract §2.b) applied.

---

## 5. Tokens

### Existing tokens consumed

| token | usage |
|---|---|
| `--lv-color-popover` | panel background |
| `--lv-color-popover-fg` | panel text / icon color |
| `--lv-color-border` | panel border + separator |
| `--lv-color-accent` | item hover/active background |
| `--lv-color-accent-fg` | item hover/active text |
| `--lv-color-destructive` | danger item text + icon (when `MenuItem.danger=true`) |
| `--lv-color-destructive-fg` | danger item text on a filled hover |
| `--lv-color-muted` | group header text, shortcut hint text, disabled item text |
| `--lv-color-fg` | default item text |
| `--lv-space-2` | icon+label gap, horizontal padding internal |
| `--lv-space-3` | item vertical padding (sm) |
| `--lv-space-4` | item vertical padding (md/lg), panel internal padding (top/bottom) |
| `--lv-space-8` | sm item height |
| `--lv-space-9` | md item height (default) |
| `--lv-space-10` | lg item height |
| `--lv-radius-md` | panel border radius |
| `--lv-shadow-md` | panel elevation (same shadow as `dropdown-menu` and `select` popover) |
| `--lv-z-popover` | panel z-index (stacks above page content, below dialogs) |
| `--lv-ring` | focus-visible ring on the menu panel (keyboard-visible focus outline on the panel element) |
| `--lv-text-sm` | item label font size (default) |
| `--lv-text-xs` | shortcut hint font size; group header font size |
| `--lv-font-sans` | item label font family |

### Net-new tokens proposed

| token | light value (OKLCH) | dark value (OKLCH) | justification |
|---|---|---|---|
| `--lv-context-menu-min-width` | `12rem` (192 px) | same | structural spacing; a context menu should never collapse narrower than this. Not a colour token — pure structural. ADDITIVE. |

`--lv-context-menu-min-width` is a structural token (not a colour), so it has no dark-mode variant.
It goes in `:root` only. This is the single net-new addition; the rest reuse the existing vocabulary.

Colour tokens are authored in OKLCH (architecture contract §4, D1 DECIDED). No literal colour values
appear in the component markup.

---

## 6. Wire / island integration

### Server-rendered JTE structure

The template renders two top-level regions:

**1. Trigger wrapper** (`data-slot="context-menu-trigger"`):
An element that wraps the adopter-provided content (OWNED markup in the WIRE template — no `Content` slot).
The trigger enhancer binds the `contextmenu` event to this element via `triggerSelector`.
Emits:
- `data-lievit-component="<FQN>"` — the root WIRE mount attribute
- `data-lievit-id="<cid>"` — component instance id
- `data-lievit-snapshot="<signed>"` — the signed snapshot for wire calls
- `data-trigger-selector="<escaped>"` — consumed by the trigger enhancer to locate the trigger region

**2. Panel** (`data-slot="context-menu-panel"`):
Conditionally rendered: absent (hidden / not emitted) when `open=false`; present when `open=true`.
Emits when open:
- `role="menu"` `aria-label` or `aria-labelledby` (one REQUIRED)
- `aria-orientation="vertical"`
- `id="<cid>-panel"` — referenced by `aria-controls` on the trigger if applicable
- `data-menu-x="<x>"` `data-menu-y="<y>"` — the pointer coordinates; the trigger enhancer reads these
  to apply CSS translate positioning (CSP-clean: no inline style; the CSS rule is
  `[data-menu-x] { --_menu-x: attr(data-menu-x type(<number>), 0); transform: translate(calc(var(--_menu-x) * 1px), calc(var(--_menu-y) * 1px)); }`)
- `tabindex="-1"` — the panel receives programmatic focus; `collection-nav` manages `aria-activedescendant`

**3. Items** (inside the panel, rendered by `!{for MenuItem item : items}`):

For `SEPARATOR`:
- `<hr role="separator" data-slot="context-menu-separator" aria-hidden="true" />`

For `GROUP_HEADER` (followed by items with the group's `role="group"` wrapper):
- Group wrapper: `<div role="group" aria-labelledby="<cid>-group-<groupIdx>" data-slot="context-menu-group">`
- Header: `<span role="presentation" id="<cid>-group-<groupIdx>" data-slot="context-menu-group-header">`

For `ACTION` | `CHECKBOX` | `RADIO` | `SUBMENU`:
- `<button role="menuitem|menuitemcheckbox|menuitemradio"`
  (real `<button>` element: platform gives keyboard + click for free; the `role` overrides `role=button`)
- `id="<cid>-item-<item.id escaped>"` — the `aria-activedescendant` target
- `data-item-id="${Escape.htmlAttribute(item.id)}"` — SAFE escaped; used by `collection-nav` to read the
  item id when firing the wire action
- `aria-disabled="true"` when `item.disabled` (item stays in DOM, `collection-nav` skips it)
- `aria-checked="true|false"` for `CHECKBOX` / `RADIO`
- `aria-haspopup="menu"` + `aria-expanded="true|false"` + `aria-controls="<submenu-panel-id>"` for `SUBMENU`
- `aria-keyshortcuts="<shortcut>"` when `item.shortcut` is non-null
- `data-danger="true"` when `item.danger` (drives CSS destructive token classes)
- `data-variant="danger"` when `item.danger` (styling hook)
- `data-slot="context-menu-item"`
- Wire directives: `l:click="activate" data-item-id="<escaped>"` for ACTION/RADIO/SUBMENU;
  `l:click="toggleCheck" data-item-id="<escaped>"` for CHECKBOX.
  These are SAFE wired through `data-item-id`, never through `attrs` (the XSS escaping rule).

**Submenu rendering**: when `item.kind == SUBMENU`, the nested `ContextMenuComponent` instance is
mounted as a nested WIRE component within the parent's panel. The parent's template emits the nested
component's root element with its own `data-lievit-component` / `data-lievit-id` / `data-lievit-snapshot`.
The nested component's `triggerSelector` points to the parent item's button element (by id). The
`collection-nav` of the parent recognizes `aria-haspopup=menu` on the focused item and delegates
ArrowRight to open the nested menu (by firing the nested component's `open` action).

### Typed-TS enhancer responsibilities

**`context-menu-trigger.enhancer.ts`** (net-new, registered via the lifecycle registry — `onComponentInit`):

1. At init: bind a `contextmenu` listener on `document.querySelector(triggerSelector)` (the selector is
   read from `data-trigger-selector`).
2. On `contextmenu` event:
   - `event.preventDefault()` (suppresses native browser context menu).
   - Record `event.clientX`, `event.clientY` (pointer coordinates).
   - Record `document.activeElement` (for focus restore on close).
   - Detect keyboard-invocation: if `event.detail === 0` (keyboard-generated `contextmenu`), use the
     bounding rect of the focused element (or the trigger region) for positioning instead of pointer coords.
   - Fire the `open(x, y)` wire action via the lievit runtime call API.
3. After morph (panel present): the panel's `data-menu-x` / `data-menu-y` drive CSS translate positioning.
   For keyboard-invocation, set `data-menu-x` / `data-menu-y` to the element-relative position.
4. While panel is open: bind a `click` listener on `document` (outside-click light-dismiss); if the click
   target is outside the panel, fire `close()` wire action.
5. While panel is open: bind a `keydown` listener for `Escape` → fire `close()` wire action.
6. On `close()` completion (panel absent from DOM after morph): restore focus to the recorded element.
7. On `componentDestroy` / re-trigger: clean up all bound listeners (no leaks).

**`collection-nav.enhancer.ts`** (shared, already defined by `dropdown-menu` / `select`):

Configured with:
- container selector: `[role="menu"]` within the component root
- item selector: `[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]` (excludes
  `aria-disabled="true"` items from the rover stop set)
- activedescendant mode (focus stays on the panel; active item tracked via `aria-activedescendant`)
- ArrowRight → open submenu (delegate to nested component's open action on items with `aria-haspopup=menu`)
- ArrowLeft → close submenu (fire parent menu's `close()` action from the submenu context)
- typeahead: match `item.textContent.trim()` prefix, case-insensitive
- Enter / Space: fire the item's `l:click` handler (activate or toggleCheck)
- Tab: fire `close()` then release (do not trap)

The trigger enhancer activates `collection-nav` by calling the runtime's directive registration API after
the panel mounts (lifecycle hook). When the panel is removed from DOM on close, `collection-nav` cleans up.

### Round-trip summary

```
right-click on trigger region
  → context-menu-trigger.enhancer.ts intercepts contextmenu event
  → preventDefault(); records x, y, activeElement
  → fire open(x, y) wire action
  → server: sets open=true, x, y; re-renders template
  → morph: panel appears in DOM with data-menu-x, data-menu-y
  → trigger enhancer reads coordinates; CSS translate positions panel
  → collection-nav activates; moves DOM focus to panel; sets aria-activedescendant = first item

ArrowDown / Up / Home / End / typeahead
  → collection-nav moves aria-activedescendant (NO wire round-trip; client-only cursor move)

Enter / Space on focused item
  → collection-nav fires item's l:click (activate or toggleCheck)
  → server: executes the action; sets open=false (for activate); or flips checked (for toggleCheck)
  → morph: panel removed (activate) or panel re-renders with updated aria-checked (toggleCheck)
  → trigger enhancer detects panel absent; restores focus to recorded activeElement

Escape / outside-click
  → trigger enhancer fires close() wire action
  → server: sets open=false
  → morph: panel removed
  → trigger enhancer restores focus to recorded activeElement
```

---

## 7. Acceptance tests

The gate is ALL of the following passing. The substrate rule applies everywhere: test on a REAL
`LievitRuntime` + real enhancers — NOT a mocked `$lievit` (the client-island-fidelity lesson from gest
CLAUDE.md: "a test that exercises a fake substrate certifies nothing about the real interaction").

### 7.1 Render tests (jsdom, real `LievitRuntime`, real enhancers mounted)

- **panel-absent-when-closed**: mount the component with `open=false`; assert no element with
  `role="menu"` exists in the rendered DOM (the panel is absent, not hidden).
- **panel-present-when-open**: set `open=true`; assert a `role="menu"` element is present; assert
  `aria-label` or `aria-labelledby` is set on it (no accessible-name violation).
- **items-render-correct-roles**: for a fixture set containing one `ACTION`, one `CHECKBOX` (checked),
  one `RADIO` (checked), one `SEPARATOR`, one `SUBMENU` item, and one disabled `ACTION`:
  - the `ACTION` renders `role="menuitem"`.
  - the `CHECKBOX` renders `role="menuitemcheckbox" aria-checked="true"`.
  - the `RADIO` renders `role="menuitemradio" aria-checked="true"`.
  - the `SEPARATOR` renders `role="separator"`.
  - the `SUBMENU` item renders `role="menuitem" aria-haspopup="menu" aria-expanded="false"`.
  - the disabled item renders `aria-disabled="true"` and is still present in the DOM.
- **danger-item-gets-data-danger**: a `MenuItem` with `danger=true` emits `data-danger="true"` and
  `data-variant="danger"` on the item element.
- **shortcut-rendered-and-aria-keyshortcuts**: a `MenuItem` with `shortcut="Ctrl+Z"` renders the hint
  text visually AND emits `aria-keyshortcuts="Ctrl+Z"` on the item element.
- **group-structure**: a `GROUP_HEADER` item followed by group members renders as `role="group"` wrapper
  with `aria-labelledby` pointing to the group header span.
- **data-slot-attributes**: the panel root has `data-slot="context-menu-panel"`, each item row has
  `data-slot="context-menu-item"`.

### 7.2 axe-core assertions (zero violations on rendered DOM)

- **axe-menu-open**: run axe-core on the DOM when the panel is open; assert zero violations of:
  - `aria-required-attr` (menu has a name; items have required attributes)
  - `aria-valid-attr-value` (all aria-* values are valid strings)
  - `aria-allowed-role` (no mismatched role on the container element)
  - `aria-prohibited-attr` (no prohibited attributes on menu roles)
  - `button-name` (each item has an accessible name via its label text)
  - `aria-activedescendant-refers-to-active-element-owned` (activedescendant references a valid item id)
- **axe-menu-closed**: run axe-core when panel is absent; assert zero violations (the trigger wrapper
  region must not itself introduce a11y violations when no menu is visible).

### 7.3 Keyboard interaction tests (real enhancers on real LievitRuntime)

Each key assertion fires the real `KeyboardEvent` into the jsdom and asserts the OBSERVABLE outcome
(DOM state or wire action fired), not an internal flag.

- **arrow-down-moves-focus**: open panel; dispatch `ArrowDown`; assert `aria-activedescendant` on the
  panel changes to the second non-disabled item's id.
- **arrow-up-wraps**: open panel; focus last item (via ArrowDown × n); dispatch `ArrowUp`; wraps past
  first to last (or vice versa, per collection-nav wrap config).
- **home-end**: dispatch `Home` → assert activedescendant = first non-disabled item; `End` → last
  non-disabled item.
- **disabled-items-skipped**: fixture with disabled second item; dispatch `ArrowDown` twice from first;
  assert activedescendant skips the disabled item and lands on the third.
- **typeahead-jumps**: items labelled "Rename", "Delete", "Copy"; open panel; focus first item; dispatch
  `KeyboardEvent` for `'D'`; assert activedescendant = the "Delete" item id.
- **enter-fires-activate**: focus an ACTION item via ArrowDown; dispatch `Enter`; assert that the
  `activate` wire action was fired with `itemId` = the item's id.
- **space-fires-togglecheck**: focus a CHECKBOX item; dispatch `Space`; assert `toggleCheck` was fired
  with the correct `itemId`.
- **escape-fires-close**: open panel; dispatch `Escape`; assert `close()` wire action was fired.
- **tab-fires-close-and-releases**: open panel; dispatch `Tab`; assert `close()` was fired; assert focus
  moves to the next focusable element in the page (not trapped inside the menu).
- **arrow-right-opens-submenu**: focus a `SUBMENU` item; dispatch `ArrowRight`; assert the nested
  component's `open` action was fired (observable: the nested panel's `open=true` reflects in the re-rendered DOM).
- **arrow-left-closes-submenu**: with a submenu open, dispatch `ArrowLeft` from within the submenu;
  assert the nested component's `close()` was fired; assert focus returns to the parent item.

### 7.4 Focus management tests (real LievitRuntime, real enhancers)

- **initial-focus-on-open**: mount with `open=false`; simulate `contextmenu` event on trigger;
  after wire round-trip + morph, assert `document.activeElement` is the menu panel element OR a
  menu item element (the first non-disabled item is focused or `aria-activedescendant` is set).
- **focus-restore-on-close**: ensure a button inside the trigger wrapper has DOM focus before opening
  the menu; simulate open then Escape; after close, assert `document.activeElement === that button`.
- **activedescendant-on-roving**: open panel; arrow around; assert `aria-activedescendant` on the panel
  tracks the active item at every step and never points to a disabled or absent element.
- **no-focus-escape-while-open**: open panel; assert that Tab closes and does NOT cycle focus within
  the panel (context menu has NO focus trap — verify Tab moves focus OUT after firing close).

### 7.5 Variant and size tests

- **size-sm-height-token**: render with `size="sm"`; assert each item row has the `--lv-space-8`-based
  height class (or Tailwind height utility that resolves to `--lv-space-8`); assert `data-size="sm"` on
  the panel.
- **size-md-default**: render with no `size` param; assert `data-size="md"` + `--lv-space-9` height.
- **size-lg-height-token**: render with `size="lg"`; assert `data-size="lg"` + `--lv-space-10` height.
- **danger-token-classes**: render a danger item; assert the item element carries the destructive-palette
  token classes (via `data-danger="true"` or a computed class).

### 7.6 Wire round-trip IT (lievit-kit, real runtime, CollapsibleComponentIT pattern)

- **open-close-round-trip-IT**: mount the component in the lievit-kit IT harness; fire `open(100, 200)`;
  assert re-rendered DOM contains `role="menu"` with `data-menu-x="100"` `data-menu-y="200"`; fire
  `close()`; assert `role="menu"` panel is absent from DOM.
- **activate-closes-panel-IT**: open; fire `activate(itemId)` where `itemId` matches a valid `ACTION`
  item; assert panel is absent after re-render; assert the registered domain handler was invoked (a
  test double or a counter field on the component).
- **togglecheck-updates-aria-checked-IT**: open; fire `toggleCheck(itemId)` for a `CHECKBOX` item with
  `checked=false`; assert re-rendered item has `aria-checked="true"`.
- **invalid-itemid-rejected-IT**: fire `activate("__hostile__")` where the id is not in `items`; assert
  the action throws / returns an error response and the panel remains in a valid state (defensive
  validation in Java BEFORE state mutates).

### 7.7 Escaping (XSS abuse cases)

- **data-item-id-escaped**: a `MenuItem` with `id = "\"><script>alert(1)</script>"` is rendered; assert
  the `data-item-id` attribute value is HTML-escaped and the script tag does not appear as markup (the
  SAFE `Escape.htmlAttribute` channel, not `attrs`).
- **label-escaped**: a `MenuItem` with `label = "<img src=x onerror=alert(1)>"` is rendered; assert the
  label text content is escaped and the img tag does not appear as markup.

### 7.8 Playwright (gesture fidelity, legacy-VM oracle)

- **real-right-click-opens-panel**: on the real running app (against the legacy-VM oracle), right-click
  on a designated trigger element; assert the context menu panel appears in the DOM with visible item
  labels (NOT a fake substrate — real `contextmenu` event, real wire round-trip, real morph).
- **keyboard-nav-and-activate-playwright**: open via right-click; use real `page.keyboard.press('ArrowDown')`
  twice; `page.keyboard.press('Enter')`; assert the domain effect occurred (e.g. a panel elsewhere
  shows the result) — the end-to-end guard, not just DOM assertion.
- **esc-closes-and-focus-returns-playwright**: open via right-click; assert panel visible; `page.keyboard.press('Escape')`; assert panel gone AND that the trigger element is focused again.

### 7.9 JTE compile + render gate

Covered by the `test/jte-compile` real-compiler gate (pre-commit hook + CI). No additional setup needed;
the template must pass the compile gate before any of the above tests run.

---

## 8. Non-goals / anti-patterns

- **Do not re-implement roving tabindex or typeahead** in the trigger enhancer. Delegate entirely to
  `collection-nav`. The whole point of the single-source-a11y rule is that a context menu and a
  dropdown-menu share the same keyboard behavior without code duplication.
- **Do not use a focus trap** (`focus-trap.enhancer.ts`). A context menu is NOT modal. The APG Menu
  pattern is explicit: Tab / Shift+Tab close the menu and move focus out. If you trap focus you break
  keyboard accessibility.
- **Do not position the panel with inline `style="..."` from JS**. Inline styles violate the strict CSP
  (`style-src 'self'`, no `'unsafe-inline'`). Use `data-menu-x` / `data-menu-y` attributes driven by a
  CSS `attr()` rule, as described in §6.
- **Do not let the client decide which items exist**. The menu item set (`items`) is `@LievitProperty(locked=true)`.
  A wire call cannot change the available actions. The server decides which actions the current user may
  see; the client only activates them. This is an authz boundary, not a convenience default.
- **Do not use `role="button"` or `role="option"` for menu items**. The correct roles are `role="menuitem"`,
  `role="menuitemcheckbox"`, and `role="menuitemradio"`. Using the wrong role breaks AT announcement.
- **Do not put a `<div>` or `<span>` as the item element**. Use a real `<button>` with the appropriate
  `role` override so the platform supplies keyboard activation (Enter/Space) for free. A `<div role="menuitem">`
  requires a manual `keydown` handler for Enter/Space — a hand-roll that `collection-nav` would have to
  duplicate.
- **Do not use `display: none` or `visibility: hidden` to hide the panel**. The panel must be ABSENT from
  the DOM when `open=false` — removed from the DOM entirely so it is absent from the a11y tree and not
  reachable by AT navigation. The JTE boolean conditional (`${open ? ... : ""}` or a conditional block)
  implements this. A `hidden` attribute is acceptable only if the runtime morph removes the element on
  close; a `display:none` CSS class leaves the element in the a11y tree on some AT + browser combinations.
- **Do not suppress the native `contextmenu` event on the whole document**. Suppress it only on the
  designated `triggerSelector` region. Users must still be able to right-click on other parts of the page
  and get the native browser context menu.
- **Do not implement submenus as a separate page-level component instance**. Submenus are nested WIRE
  components WITHIN the same wire tree. They are not independently mounted components at the page root.
  This keeps the snapshot + authz chain intact and avoids stale state.
- **Do not re-implement the popover / outside-click seam**. Compose the shared seam. Re-implementing it
  per component is the failure mode the architecture contract §2.b exists to prevent.
- **Do not accept `wireArgs` or `attrs` for item ids from a per-row unknown source without escaping**.
  All item ids go through the `Escape.htmlAttribute` channel in `data-item-id`. The `attrs` channel
  (trusted raw, `$unsafe`) must NEVER carry a per-row item id value.

---

## Agent instructions

Generate ORIGINAL code over `--lv-*` tokens (OKLCH source of truth). You MAY read the WAI-ARIA APG Menu
pattern (https://www.w3.org/WAI/ARIA/apg/patterns/menu/), react-aria `useMenu`/`useMenuItem` SPEC, and
Ant Design Dropdown feature set from training as references for PATTERN and LOOK. You MUST NOT paste
literal source from any of them (no react-aria / ant-design / Tailwind-UI code or class strings) — the
output is always original generation. (The one bright line, `02-licensing.md`.)

Compose the THREE shared mechanisms — `context-menu-trigger.enhancer.ts` (new, small), `collection-nav`
(shared), and the popover seam — do NOT hand-roll roving, typeahead, outside-click dismiss, or positioning.

Mirror `button.jte` house conventions exactly: header doc-comment with the labelled sections (including
`STRUCTURE:` citing APG + react-aria), typed `@param`, `data-slot="context-menu-*"` on every structural
element, the TWO escaping channels (`attrs` trusted raw vs `dataAttrs`/`wireArgs`/`data-item-id` escaped),
zero `<script>`, zero inline `on*=`.

The panel MUST be ABSENT from the DOM when `open=false` (JTE conditional, not CSS hide). The
render test MUST assert the panel BODY is VISIBLE after open (the projection assertion from the dialog
exemplar — not optional, because the bug class this prevents is the silent empty panel).

Validate `itemId ∈ items` in BOTH `activate()` and `toggleCheck()` in Java BEFORE state mutates.
Validate `item.kind` in `toggleCheck()` (only `CHECKBOX` is valid; a client-side call with a
`RADIO` id or an `ACTION` id is a bug or an attack, reject it).

Minimal code to GREEN against the acceptance tests. The keyboard map in §4 is the contract — assert
ALL of it. No acceptance test may run against a mocked `$lievit` runtime; every test that asserts an
interaction runs on the real LievitRuntime + real enhancers (the client-island-fidelity rule).
