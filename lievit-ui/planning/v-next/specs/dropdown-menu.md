<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — dropdown-menu (WIRE + ENH: menu-button overlay, collection-nav + popover seam)

- **tier**: WIRE + ENH (`collection-nav.enhancer.ts`, the shared menu roving/typeahead mechanism) + popover seam
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/dropdown-menu.jte` + related partials)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Menu + Menu Button patterns
      (https://www.w3.org/WAI/ARIA/apg/patterns/menu/ +
      https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) +
      **react-aria `useMenu` / `useMenuItem` / `useMenuTrigger` interaction model** as the
      pattern reference (the keyboard map, focus order, roving tabindex, typeahead, and ARIA
      wiring, transcribed into ORIGINAL template + `collection-nav` enhancer; no react-aria
      source copied)
    - inventory: Ant Design Dropdown as inventory reference (sections/groups, separator, icon
      items, keyboard shortcut labels, danger items, disabled items, nested submenus, loading
      state; the "button + menu" split follows APG Menu Button)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by
      Tailwind UI dropdown menus (NO code copied)

---

## 1. What it is

A **menu-button dropdown**: a trigger button (or any element) whose activation opens a
floating panel containing a vertical `role="menu"` list of actions.
Each action is a `role="menuitem"` (plain), `role="menuitemcheckbox"` (toggleable), or
`role="menuitemradio"` (radio-group choice).
Items may be grouped by section with a visible label and a `<separator>`, and one submenu
level is supported.

**When to use it**: a set of secondary or overflow actions anchored to a single trigger
(an "Actions" button on a table row, a "More" button in a toolbar, a user-account menu).
It is NOT a navigation-list (use `navigation-menu`) and NOT a form control that stores a
selection value (use `select` or `native-select`); those have distinct ARIA semantics and
different UX contracts.

**Why WIRE**: the OPEN-STATE is a server fact (`@Wire boolean open`).
The item SET is also a server fact (`@Wire @LievitProperty(locked=true)` — a client cannot
inject items or forge the action list).
The one irreducible CLIENT behavior — roving keyboard navigation between menu items,
typeahead, and Esc-to-close — is the shared `collection-nav.enhancer.ts`, NOT a hand-roll.
The popover/overlay seam handles positioning and light-dismiss (clicking outside).
This is the canonical S0 consumer of both `collection-nav` and the popover seam; every
context-menu and menubar component reuses the same pair.

---

## 2. API — the WIRE surface + template params

### 2.a Java (`DropdownMenuComponent`)

| member | kind | meaning |
|---|---|---|
| `open` `boolean` | `@Wire` | overlay open-state |
| `items` `List<MenuItem>` | `@Wire @LievitProperty(locked=true)` | the flat item list; each item carries: `id`, `label`, `type` (PLAIN \| CHECKBOX \| RADIO), `group` (nullable string, groups items under a visible section header + separator), `checked` (boolean, for CHECKBOX/RADIO), `disabled` (boolean), `danger` (boolean), `shortcutLabel` (nullable display string — NOT a binding, purely decorative), `icon` (nullable icon name), `href` (nullable, renders as `<a>` instead of button), `submenuItems` (nullable `List<MenuItem>`, one level deep) |
| `checkedIds` `Set<String>` | `@Wire` | ids of CHECKBOX/RADIO items currently checked; the server owns the checked state |
| `triggerLabel` `String` | `@Wire @LievitProperty(locked=true)` | accessible label for the trigger button when no visible text is supplied (i.e. icon-only trigger) |
| `placement` `String` | `@Wire @LievitProperty(locked=true)` | CSS Anchor Positioning placement hint: `bottom-start` (default) \| `bottom-end` \| `top-start` \| `top-end` — passed as `data-placement` to the popover seam |
| `toggleOpen()` | `@LievitAction` | flips `open`; validates the call is from a non-suspended session |
| `activate(String id)` | `@LievitAction` | validates `id ∈ items` AND `!disabled` AND not a submenu-parent, then executes the action (delegates to the adopter-provided handler via a `@LievitEvent` or an overridden method); closes the menu (`open=false`) |
| `toggleCheck(String id)` | `@LievitAction` | validates `id ∈ items` AND type is CHECKBOX or RADIO; for RADIO un-checks the group peers and sets the id checked; for CHECKBOX toggles; does NOT close the menu |
| `openSubmenu(String parentId)` | `@LievitAction` | sets the active submenu id; the template re-renders the submenu panel |
| `closeSubmenu()` | `@LievitAction` | clears the active submenu id |
| `activeSubmenuId` `String` | `@Wire` | which submenu is open (null if none) |

### 2.b `MenuItem` value object (server-side record)

```java
record MenuItem(
  String id,
  String label,
  MenuItemType type,        // PLAIN | CHECKBOX | RADIO
  String group,             // null = ungrouped
  boolean checked,
  boolean disabled,
  boolean danger,
  String shortcutLabel,     // display-only, e.g. "⌘K"
  String icon,              // Lucide icon name or null
  String href,              // null = button action; set = <a href>
  List<MenuItem> submenuItems // null = leaf; non-null = submenu parent
) {}
```

### 2.c Template params

One `@param` per `@Wire` field plus:

| param | type | meaning |
|---|---|---|
| `_component` | `ComponentMetadata` | standard WIRE metadata (id, snapshot, etc.) |
| `_instance` | `DropdownMenuComponent` | for calling `groupedItems()` and `activeSubmenu()` derived views |

No `Content` slot (WIRE has none — the server-first refactor blueprint §1.b: the trigger label
and item list are OWNED template markup driven by `@Wire` fields).

### 2.d Derived view helpers on `_instance` (not `@Wire`, `serialize=false`)

- `groupedItems()` — returns `items` partitioned by `group`, preserving insertion order within
  each group; ungrouped items go first under a null-key bucket.
- `activeSubmenu()` — returns the `MenuItem` whose `id == activeSubmenuId`, or null.

---

## 3. Variants / sizes / states

### Variants (trigger button)

The trigger is an `@template.lievit.button` with its own `variant` and `size`; the dropdown
component does not impose a variant of its own.
The menu panel itself has no variant axis — it is always the `--lv-color-popover` surface.

Item-level variant (the `danger` flag):

| flag | token applied | meaning |
|---|---|---|
| `danger=true` | `--lv-color-destructive` text + hover | destructive action (delete, revoke) |
| `danger=false` (default) | `--lv-color-fg` | neutral action |

### Sizes

The menu panel items follow a single size scale driven by `--lv-space-*` tokens; no external
`size` param on the panel.
The TRIGGER button accepts any size from the button spec (`sm | md | lg`).
Row height: `--lv-space-9` (36 px), matching the md button tier — this keeps trigger + first
item visually flush when the menu opens directly below.

### States

| state | how it appears | ARIA |
|---|---|---|
| `open=false` | panel absent from DOM (not just hidden — removed so items leave the a11y tree + tab order) | trigger: `aria-expanded="false"` |
| `open=true` | panel present, anchored via popover seam | trigger: `aria-expanded="true"`; menu: `role="menu"` present |
| item `disabled=true` | dimmed, pointer-events none, excluded from roving tabindex | `aria-disabled="true"` on the item |
| item `checked=true` (CHECKBOX/RADIO) | checkmark icon visible | `aria-checked="true"` |
| submenu open | submenu panel rendered adjacent to parent item | parent item: `aria-haspopup="menu" aria-expanded="true"` |
| `aria-busy` | set by the runtime `beforeCall`/`afterCall` on the trigger during a wire round-trip | managed by runtime, not the template |

### Slots

None (WIRE — no `Content` parameters; everything is owned markup templated from `@Wire`
fields). The trigger's label text comes from the item `triggerLabel` field or a composed
`@template.lievit.button` whose content is server-driven.

---

## 4. The a11y contract (the heart — non-negotiable, fully specified)

**WAI-ARIA patterns**: APG Menu (https://www.w3.org/WAI/ARIA/apg/patterns/menu/) +
APG Menu Button (https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/).
Both were fetched and verified against the live APG; the keyboard map below matches exactly.

### 4.a Roles + ARIA

| element | role / attributes | notes |
|---|---|---|
| Trigger `<button>` | `role="button"` (native), `aria-haspopup="menu"`, `aria-expanded="${open}"`, `aria-controls="<menuId>"` | native `<button>` gives Enter/Space + disabled for free; aria-expanded reflects `open` |
| Menu panel | `role="menu"`, `id="<menuId>"`, `aria-labelledby="<triggerId>"`, `aria-orientation="vertical"` (explicit, default per APG but stated) | present in DOM only when `open=true` |
| Section group wrapper | `role="group"`, `aria-labelledby="<groupLabelId>"` | wraps items of the same `group`; the group label element has the id |
| Group label | `role="presentation"` (decorative heading — the text is the label for the `<group>`, surfaced via `aria-labelledby`) | not a heading, not interactive |
| Separator | `role="separator"` (or `<hr>` which carries it natively), `aria-orientation="horizontal"` | between groups; not focusable |
| Plain menu item | `role="menuitem"`, `id="<itemId>"`, `tabindex="-1"` (roving, managed by `collection-nav`), `aria-disabled="true"` when disabled | rendered as `<button>` or `<a href>` depending on `MenuItem.href` |
| Checkbox item | `role="menuitemcheckbox"`, `aria-checked="${checked}"`, same roving + disabled rules | `<button>` |
| Radio item | `role="menuitemradio"`, `aria-checked="${checked}"`, same; peers in the same `group` form the implicit radio group | `<button>` |
| Submenu parent item | `role="menuitem"`, `aria-haspopup="menu"`, `aria-expanded="${id == activeSubmenuId}"`, `aria-controls="<submenuId>"` | renders a trailing chevron icon (aria-hidden) |
| Submenu panel | `role="menu"`, `id="<submenuId>"`, `aria-label="<parentItemLabel>"` (or `aria-labelledby` to the parent item) | structured identically to the root menu |
| Icon decoration | `aria-hidden="true"` | never carries meaning |
| Keyboard shortcut label | `aria-hidden="true"` | display-only; the actual shortcut is NOT bound by lievit — it is the application's responsibility |

The `aria-activedescendant` approach from APG is supported optionally by `collection-nav`
when DOM focus lives on the menu container; the default lievit approach is roving `tabindex`
(`tabindex="0"` on the active item, `tabindex="-1"` on all others) which is the react-aria
`useMenu` model and avoids the screenreader announce-lag that `aria-activedescendant` can
exhibit. The spec pins ROVING TABINDEX as the focus model.

### 4.b Keyboard map (verified against APG Menu + APG Menu Button)

The APG URL verified: https://www.w3.org/WAI/ARIA/apg/patterns/menu/
and https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/

| key | context | does | who supplies it |
|---|---|---|---|
| Enter | focus on trigger (menu closed) | opens the menu; focus moves to the FIRST non-disabled menu item | enhancer |
| Space | focus on trigger (menu closed) | opens the menu; focus moves to the FIRST non-disabled menu item | enhancer |
| Down Arrow | focus on trigger (menu closed) | opens menu; focus moves to FIRST non-disabled item (optional per APG, implemented) | enhancer |
| Up Arrow | focus on trigger (menu closed) | opens menu; focus moves to LAST non-disabled item (optional per APG, implemented) | enhancer |
| Down Arrow | focus inside menu | moves to the NEXT non-disabled item; wraps to first when at last | `collection-nav` enhancer |
| Up Arrow | focus inside menu | moves to the PREVIOUS non-disabled item; wraps to last when at first | `collection-nav` enhancer |
| Home | focus inside menu | moves focus to the FIRST non-disabled item | `collection-nav` enhancer |
| End | focus inside menu | moves focus to the LAST non-disabled item | `collection-nav` enhancer |
| Enter | focus on a plain `menuitem` | activates the item (fires `activate(id)` wire action); closes menu | enhancer → wire |
| Space | focus on a plain `menuitem` | activates the item; closes menu | enhancer → wire |
| Enter | focus on `menuitemcheckbox` | toggles checked state (fires `toggleCheck(id)`); DOES NOT close menu | enhancer → wire |
| Space | focus on `menuitemcheckbox` | toggles checked state; DOES NOT close menu | enhancer → wire |
| Enter | focus on `menuitemradio` | checks this, unchecks peers; fires `toggleCheck(id)`; DOES NOT close menu | enhancer → wire |
| Space | focus on `menuitemradio` | same as Enter on radio | enhancer → wire |
| Enter | focus on submenu-parent item | opens the submenu; focus moves to first item of submenu | enhancer → wire (`openSubmenu`) |
| Right Arrow | focus on submenu-parent item | opens the submenu; focus moves to first submenu item | enhancer → wire (`openSubmenu`) |
| Left Arrow | focus inside submenu | closes submenu (`closeSubmenu`); returns focus to the parent item | enhancer → wire |
| Esc | focus inside menu (no submenu open) | closes the menu; returns focus to the trigger | enhancer → wire (`toggleOpen`) |
| Esc | focus inside submenu | closes submenu only; focus returns to submenu-parent item | enhancer → wire (`closeSubmenu`) |
| Tab / Shift+Tab | focus inside menu | closes all menus; moves focus out of the menu to the next/previous focusable element in the page tab order | enhancer + platform (Tab is the "exit" key per APG) |
| Printable character (a-z, 0-9) | focus inside menu | typeahead: moves focus to next item whose label starts with the typed character; wraps | `collection-nav` enhancer |

Disabled items are SKIPPED by all keyboard navigation (roving tabindex never lands on them).
Separator elements are SKIPPED (they have `tabindex="-1"` and `role="separator"`, not
focusable).

### 4.c Focus management

- **Initial focus on open**: when the trigger fires Enter/Space (→ first item) or Up Arrow
  (→ last item), DOM focus moves INTO the menu panel to the designated first or last
  non-disabled item. This is the APG Menu Button requirement. The `collection-nav` enhancer
  owns this transition.
- **Roving tabindex**: exactly ONE item in the open menu has `tabindex="0"` at any time
  (the currently active item); all others have `tabindex="-1"`. This is the react-aria
  `useMenu` model (preferred over `aria-activedescendant` to avoid screenreader announce-lag).
  `collection-nav` maintains the roving tabindex without a DOM round-trip.
- **No focus trap**: a dropdown menu is NON-MODAL (APG Menu: menus are not dialogs; Tab
  moves focus out and closes the menu). Do NOT compose `focus-trap`; compose ONLY
  `collection-nav` + the popover seam.
- **Focus restore on close**: when the menu closes (Esc, Tab, item activation, light-dismiss),
  focus returns to the trigger button. The `collection-nav` enhancer records the opener and
  restores focus. The focus-trap enhancer is NOT involved (non-modal).
- **Submenu focus**: on submenu open, focus moves to the FIRST item of the submenu.
  On submenu close (Left Arrow / Esc), focus returns to the submenu's parent item.
  The submenu is treated as a child `collection-nav` context.
- **Light-dismiss**: clicking outside the open menu fires `toggleOpen()` and restores focus
  to the trigger. Managed by the popover seam's light-dismiss mechanism.

### 4.d Live region

None. A dropdown menu is a list of actions, not a status announcer.
If an action fires an async operation and the result needs announcing, the consuming
feature's WIRE component uses the shared live-region announcer — the dropdown itself does
not.

### 4.e Shared mechanisms composed

| mechanism | role here | do NOT re-implement |
|---|---|---|
| `collection-nav.enhancer.ts` | roving tabindex, typeahead, Arrow/Home/End/Esc/Tab keyboard map, focus-on-open, focus-restore | the single source; also used by select, combobox, tabs, command |
| popover seam (native `popover` + CSS Anchor Positioning) | panel positioning, light-dismiss on outside-click | already the seam used by select, combobox, tooltip; do not hand-roll |

---

## 5. Tokens

### Existing tokens consumed

| token | used for |
|---|---|
| `--lv-color-popover` | menu panel background |
| `--lv-color-popover-fg` | menu item text |
| `--lv-color-border` | panel border + separator |
| `--lv-color-accent` | item hover/focus-visible background |
| `--lv-color-accent-fg` | item hover/focus-visible text |
| `--lv-color-destructive` | `danger=true` item text + hover background tint |
| `--lv-color-muted` | group label text, shortcut label text, disabled item text |
| `--lv-color-fg` | checked icon, default item text |
| `--lv-space-1` | icon-to-label gap |
| `--lv-space-2` | item horizontal padding (icon well left) |
| `--lv-space-3` | item horizontal padding (main) |
| `--lv-space-4` | section vertical padding |
| `--lv-space-9` | item row height (36 px, md tier, toolbar-aligned) |
| `--lv-radius-md` | panel corner radius |
| `--lv-shadow-md` | panel elevation (popover tier) |
| `--lv-z-popover` | panel z-index layer |
| `--lv-ring` | focus-visible ring on the active item |
| `--lv-text-sm` | item label text size |
| `--lv-text-xs` | group label + shortcut label text size |
| `--lv-font-sans` | item font family |
| `--lv-motion-fade` | panel open/close fade transition |

### NET-NEW tokens proposed

None. The full surface is covered by existing popover + accent + destructive + muted tokens.
The submenu panel reuses the same token set as the root panel.

All colour tokens are authored in OKLCH (source-of-truth format, architecture contract §4,
D1 DECIDED). No literal colour values inside the component markup.

---

## 6. Wire actions + popover/enhancer integration

### 6.a `l:*` directives in the template

| directive | element | action fired | purpose |
|---|---|---|---|
| `l:click="toggleOpen"` | trigger `<button>` | `toggleOpen()` | open / close the panel |
| `l:click="activate" data-id="<escaped id>"` | each plain `menuitem` `<button>` or `<a>` | `activate(id)` | execute the action + close |
| `l:click="toggleCheck" data-id="<escaped id>"` | each `menuitemcheckbox` / `menuitemradio` | `toggleCheck(id)` | toggle without closing |
| `l:click="openSubmenu" data-id="<escaped id>"` | submenu-parent item | `openSubmenu(parentId)` | render the submenu panel |
| `l:click="closeSubmenu"` | (enhancer fires this; no direct template binding) | `closeSubmenu()` | close active submenu |
| `l:click="toggleOpen"` | scrim / outside-click (popover seam light-dismiss) | `toggleOpen()` | close on outside click |

**Escaping rule**: every `data-id` value on a per-item element goes through
`Escape.htmlAttribute` (the `dataAttrs` / `wireArgs` channel — a DB-derived id is never
`$unsafe`). The `activate` action validates `id ∈ items` server-side before any mutation
(the load-bearing Java validation that stops a forged id from executing an unlisted action).

### 6.b Server action signatures

```java
@LievitAction
public void toggleOpen() {
    this.open = !this.open;
    if (!this.open) this.activeSubmenuId = null; // closing root clears submenu
}

@LievitAction
public void activate(String id) {
    MenuItem item = requireNonDisabledLeaf(id);   // throws on unknown / disabled / submenu-parent
    onItemActivated(item);                         // adopter-overridden hook
    this.open = false;
    this.activeSubmenuId = null;
}

@LievitAction
public void toggleCheck(String id) {
    MenuItem item = requireCheckable(id);          // CHECKBOX or RADIO only
    if (item.type() == RADIO) {
        uncheckGroupPeers(item.group());
    }
    boolean nowChecked = !checkedIds.contains(id);
    if (nowChecked) checkedIds.add(id); else checkedIds.remove(id);
    // menu stays open
}

@LievitAction
public void openSubmenu(String parentId) {
    requireSubmenuParent(parentId);
    this.activeSubmenuId = parentId;
}

@LievitAction
public void closeSubmenu() {
    this.activeSubmenuId = null;
}
```

Validation (`requireNonDisabledLeaf`, `requireCheckable`, `requireSubmenuParent`) happens
BEFORE any state mutation. Authz (e.g. "is this user allowed to delete?") is checked in
`onItemActivated` by the adopter's override, not inside the WIRE base.

### 6.c Round-trip flows

**Open flow**: trigger click → `toggleOpen()` → `open=true`, re-render with panel in DOM →
morph inserts panel → `collection-nav` enhancer initialises on the panel's presence (via
lifecycle `onComponentUpdate`), sets `tabindex="0"` on first item, moves DOM focus to it.

**Activate flow**: Enter/Space on active item → enhancer fires `activate(id)` wire call →
Java validates + delegates + sets `open=false` → re-render without panel → morph removes
panel → enhancer restores focus to the trigger.

**CheckBox/Radio flow**: Enter/Space on active check item → enhancer fires `toggleCheck(id)` →
Java toggles `checkedIds` → re-render (panel stays, `aria-checked` updates on the morphed
item) → `collection-nav` preserves focus on the same item after morph (the runtime morph
preserves node identity).

**Submenu flow**: Right Arrow / Enter on submenu-parent → enhancer fires `openSubmenu(id)` →
`activeSubmenuId = parentId` → re-render with submenu panel adjacent to parent item → morph →
enhancer initialises a child `collection-nav` context on the submenu, moves focus to first
submenu item.

**Close-submenu flow**: Left Arrow / Esc inside submenu → enhancer fires `closeSubmenu()` →
`activeSubmenuId = null` → re-render without submenu panel → morph → enhancer returns focus
to the parent item in the root menu.

### 6.d Enhancer responsibilities (`collection-nav.enhancer.ts`, parameterised for menu context)

The enhancer is the SHARED `collection-nav` enhancer parameterised with:
- `role: "menu"` (vs `listbox` for select, `tablist` for tabs)
- `itemSelector: '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]'`
- `rovingTabindex: true`
- `wrapAround: true` (ArrowUp on first → last; ArrowDown on last → first)
- `typeahead: true`
- `activateAction: "activate"` (for PLAIN items) / `checkAction: "toggleCheck"` (for check items)
- `submenuAction: "openSubmenu"` / `closeSubmenuAction: "closeSubmenu"`
- `closeOnTab: true` (Tab exits the menu, focus moves to next page element)
- `restoreFocusOnClose: true` (focus returns to the trigger)

The enhancer binds via the lifecycle `onComponentUpdate` hook (fires after every morph),
scanning the component root for `role="menu"` descendants to initialise / re-initialise
after a re-render. It does NOT read internal lievit state directly; it reads from the
rendered DOM attributes (`aria-expanded`, `aria-disabled`, `tabindex`).

---

## 7. Acceptance tests (the gate — refute-by-default)

The component is DONE only when ALL tests pass on a REAL substrate (not a mocked one — the
client-island-fidelity lesson from gest's CLAUDE.md).

### 7.a Render (real LievitRuntime + jsdom, REAL `collection-nav` enhancer mounted)

- **panel absent when closed**: render with `open=false`; assert the `role="menu"` element is
  absent from the DOM entirely (not `hidden` — absent, so it leaves the a11y tree and tab order).
  Assert trigger has `aria-expanded="false"`.
- **panel present when open**: render with `open=true`; assert `role="menu"` is present,
  `aria-labelledby` → trigger id; all items render with correct roles (`menuitem` /
  `menuitemcheckbox` / `menuitemradio`).
- **checked state reflected**: render a CHECKBOX item with `checked=true`; assert
  `aria-checked="true"` on its element.
- **disabled item reflected**: render an item with `disabled=true`; assert `aria-disabled="true"`
  and `tabindex="-1"` (excluded from roving set).
- **danger item styling**: render with `danger=true`; assert `data-danger="true"` on the item
  (CSS hook for the destructive token — not a hardcoded class string).
- **grouped items**: render items with two groups; assert `role="group"` wrappers with
  `aria-labelledby` → their header ids; assert separator between groups.
- **submenu closed**: render with `activeSubmenuId=null`; assert submenu-parent item has
  `aria-expanded="false"` and no submenu panel in DOM.
- **submenu open**: render with `activeSubmenuId="<parentId>"`; assert `aria-expanded="true"`,
  submenu `role="menu"` panel present.
- **shortcut label aria-hidden**: render an item with `shortcutLabel="⌘K"`; assert the
  shortcut span carries `aria-hidden="true"`.

### 7.b axe-core

- Zero violations of the Menu + Menu Button rules on the open menu DOM (real `axe-core` run,
  not a mock): `aria-required-children`, `aria-required-parent`, `aria-allowed-attr`,
  `aria-valid-attr-value`, `button-name` (trigger must have an accessible name even when
  icon-only via `triggerLabel`).
- Run separately with a CHECKBOX item open and a RADIO group open; assert zero violations in
  both configurations.
- Run with a submenu open; assert zero violations.

### 7.c Keyboard (each key in the §4 map asserted on the REAL `collection-nav` enhancer)

- **Enter on trigger → opens → focus on first item**: trigger focus; simulate Enter; assert
  `open=true` re-render; assert DOM focus is on the first non-disabled item.
- **Up Arrow on trigger → focus on last item**: trigger focus; simulate Up Arrow; assert
  focus is on the LAST non-disabled item after open.
- **ArrowDown moves through items**: open; ArrowDown twice; assert focus is on item index 2.
- **ArrowDown wraps**: open; focus on last item; ArrowDown; assert focus wraps to first item.
- **ArrowUp wraps**: open; focus on first item; ArrowUp; assert focus wraps to last item.
- **Home**: open; focus on any middle item; Home; assert focus on first item.
- **End**: open; focus on any middle item; End; assert focus on last item.
- **Disabled items skipped**: items=[enabled, disabled, enabled]; Down from first; assert
  focus skips the disabled item and lands on the third.
- **Enter activates plain item + closes**: open; focus on plain item; Enter; assert
  `activate` wire call fired with correct id; `open=false` in re-render.
- **Enter on CHECKBOX toggles + stays open**: open; focus on checkbox item; Enter; assert
  `toggleCheck` fired; `open` remains `true`.
- **Space on RADIO checks + stays open**: open; focus on radio item; Space; assert
  `toggleCheck` fired; `open` remains `true`.
- **Right Arrow on submenu-parent opens submenu**: open; focus on submenu-parent item; Right
  Arrow; assert `openSubmenu` fired; submenu panel present; focus on first submenu item.
- **Left Arrow inside submenu closes it + returns focus**: open submenu; Left Arrow; assert
  `closeSubmenu` fired; focus returns to parent item in root menu.
- **Esc closes menu + focus returns to trigger**: open; any item focused; Esc; assert
  `toggleOpen` fired; `open=false`; DOM focus returns to trigger.
- **Esc inside submenu closes submenu only**: open submenu; Esc; assert `closeSubmenu` fired
  (not `toggleOpen`); root menu still open; focus on parent item.
- **Tab exits menu**: open; Tab; assert `open=false` re-render; DOM focus moves to next
  focusable element in page tab order (platform + enhancer cooperation).
- **Typeahead**: open; focus on first item; press 'd'; assert focus moves to the next item
  whose label starts with 'd' (case-insensitive).

### 7.d Focus

- **On open, focus is INSIDE the menu**: trigger Enter; assert `document.activeElement` is
  the first menu item (not the trigger, not any background element).
- **Roving tabindex invariant**: with menu open, assert exactly ONE item has `tabindex="0"`;
  all others (and the trigger) have `tabindex="-1"` or native-disabled.
- **On close, focus restores to trigger**: close via Esc; assert `document.activeElement ===
  triggerButton`.
- **No trap (Tab exits)**: open; Tab; assert focus leaves the menu and lands on the NEXT
  focusable page element (not cycling within the menu — the menu is non-modal, no trap).

### 7.e Wire round-trip IT (lievit-kit, real runtime — CollapsibleComponentIT pattern)

- Mount `DropdownMenuComponent` with 4 plain items → assert `open=false`, panel absent.
- Call `toggleOpen()` → assert `open=true`, re-rendered panel contains all 4 items.
- Call `activate("<id>")` → assert `open=false`, panel absent, `onItemActivated` received
  the correct item.
- Mount with a CHECKBOX item (unchecked) → call `toggleCheck("<id>")` → assert `checkedIds`
  contains the id; call again → assert `checkedIds` no longer contains it.
- Mount with a RADIO group (3 items) → `toggleCheck("b")` → assert `checkedIds={b}`;
  `toggleCheck("c")` → assert `checkedIds={c}` (b was unchecked).
- Mount with a submenu → `openSubmenu("<parentId>")` → assert `activeSubmenuId=parentId`,
  submenu panel present in re-render → `closeSubmenu()` → assert `activeSubmenuId=null`,
  submenu absent.
- Forge test: call `activate("<unknown-id>")` → assert an exception / error response (the
  validation gate fires before any mutation).
- Forge test: call `activate("<disabled-item-id>")` → assert rejected.

### 7.f Playwright (gesture fidelity, legacy-VM oracle)

- Real `page.click(trigger)` opens menu; real `page.keyboard.press("ArrowDown")` twice
  moves focus; real `page.keyboard.press("Enter")` activates the item; assert the panel
  closes AND the activated item's side-effect is observable (not a fake substrate — the
  client-island-fidelity lesson).
- Real `page.keyboard.press("Escape")` closes the menu; assert focus is back on the trigger.
- Real `page.keyboard.press("Tab")` exits the menu; assert focus lands on the next
  focusable element.

### 7.g Escaping (XSS gate)

- Render an item whose `id` contains `"><script>alert(1)</script>`; assert the rendered
  `data-id` attribute is HTML-escaped and inert (the `dataAttrs` channel escapes it;
  `attrs` is documented trusted-only and is never fed user/DB-derived item ids).
- Call `activate("<hostile-id>")` directly; assert the action rejects (id ∉ server-side
  `items` list → validation fires before any mutation).

### 7.h JTE compiles + renders

Covered by the `test/jte-compile` real-compiler + render gate. The gate asserts the template
compiles with Java 25's compiler and renders without runtime exceptions on a minimal
`DropdownMenuComponent` instance with at least one item of each type (PLAIN, CHECKBOX, RADIO)
and one grouped item.

---

## 8. Non-goals / anti-patterns

- **NOT a navigation list.** `dropdown-menu` is for ACTIONS, not page links in a nav tree.
  Links that navigate to pages belong in `navigation-menu` (APG navigation landmark +
  `role="link"`, not `role="menuitem"`). Mixing navigation and action semantics in a single
  `role="menu"` is a WCAG failure.
- **NOT a value-storing select.** If the user is CHOOSING a value that persists (filter,
  sort-order, option selection), use `select` or `native-select`. A dropdown-menu's
  CHECKBOX/RADIO items are for toggling boolean settings or selecting a mode for the CURRENT
  action (e.g. a split-button's mode), not for storing a form field value. The confusion
  leads to incorrect ARIA and no form submission.
- **NOT a context-menu.** Right-click triggering belongs in `context-menu` (S1), which
  composes the same `collection-nav` + popover seam but with a different trigger mechanism
  (the `contextmenu` event, not a button click) and different focus-return semantics.
- **NO focus trap.** Dropdown menus are non-modal (APG Menu). Do NOT compose
  `focus-trap.enhancer.ts` here. A focus trap would prevent Tab from exiting the menu,
  which is both a WCAG 2.1 SC 2.1.2 violation ("No Keyboard Trap") and a UX regression.
- **NO client-side-only open state.** The `open` boolean lives in `@Wire`, NOT in the
  enhancer's local JS state. Closing the menu is always a wire round-trip (the server owns
  the truth); the enhancer only initiates the action and manages focus/tabindex meanwhile.
  A purely-JS-toggled panel that bypasses the server is the exact failure mode the wire
  protocol prevents.
- **NO hand-rolled roving tabindex or typeahead.** These are the responsibilities of
  `collection-nav.enhancer.ts`. Writing them again per-component is the single-source
  anti-pattern this whole architecture is designed to prevent.
- **NO `aria-activedescendant` as the focus model.** This spec pins roving tabindex
  (react-aria `useMenu` model). `aria-activedescendant` is not wrong per APG, but it
  produces announce-lag in some screenreaders and is inconsistent with the focus model
  used by `select` and `tabs` in this library. All three must use the SAME model
  (single-source-a11y rule, architecture contract §2.b).
- **NO more than ONE level of submenu.** The spec supports exactly one nested submenu.
  Multi-level cascading menus belong in `cascader` (S2). Deeper nesting in a dropdown menu
  produces usability and a11y complexity that exceeds the component's appropriate scope.
- **NO inline shortcut binding.** The `shortcutLabel` field is a DISPLAY string only
  (`aria-hidden`). Binding the actual keyboard shortcut to fire the action is the
  CONSUMING APPLICATION's responsibility (via `document.addEventListener` or htmx), never
  this component's. Binding shortcuts inside a menu component violates separation of
  concerns and produces unpredictable conflicts.
- **NO hardcoded item lists in the template.** Item labels, ids, icons, and groups arrive
  via `@Wire @LievitProperty(locked=true)` from the server. No option list is hardcoded in
  the JTE markup (the "no data in a partial" rule, architecture contract §3 + repo CLAUDE.md).
- **NO `<script>` or inline `on*=` handlers in the JTE template.** The strict CSP refuses
  them silently. All interactivity goes through `l:*` directives and the `collection-nav`
  enhancer registered via the directive/lifecycle registry (ADR-0019).

---

## 8. Agent instructions (the discipline reminders, verbatim)

- Generate ORIGINAL code over `--lv-*` tokens.
  You MAY read the APG Menu + Menu Button patterns, react-aria `useMenu`/`useMenuItem`/
  `useMenuTrigger` public docs, Ant Design Dropdown, and Tailwind UI dropdowns as
  references for PATTERN (a11y, inventory) and LOOK.
  You MUST NOT paste literal source from ANY of them — the output is always original
  generation (the one bright line, `02-licensing.md`).
- Compose the ONE shared `collection-nav.enhancer.ts` for all keyboard/focus behavior.
  Compose the ONE popover seam for positioning + light-dismiss.
  Do NOT hand-roll either. Divergence from the single-source breaks every other component
  that depends on them.
- Do NOT compose `focus-trap.enhancer.ts` (the menu is non-modal; a trap is a WCAG
  SC 2.1.2 violation here).
- Mirror `button.jte` house conventions exactly: header doc-comment with all labelled
  sections, typed `@param`, `data-slot="dropdown-menu"`, `data-variant`, the two escaping
  channels (`attrs` trusted-raw vs `dataAttrs`/`wireArgs` escaped), zero `<script>`.
- Every `data-id` on a per-item element MUST go through the `dataAttrs`/`wireArgs`
  escaped channel. Never feed a DB-derived item id into `attrs` (`$unsafe`).
- The Java actions (`activate`, `toggleCheck`, `openSubmenu`) MUST validate their input
  against the server-side `items` list BEFORE any state mutation. This is the security
  invariant; the tests assert it with a forge test.
- Render the panel absent (not `hidden`) when `open=false`; present when `open=true`.
  Use a JTE boolean conditional, not a smart-attribute null-drop or a CSS `display:none`
  toggled by JS.
- The keyboard map in §4.b is the CONTRACT. Assert ALL of it in the acceptance tests.
  A keyboard test that exercises a mocked substrate is not an acceptance test.
- Minimal code to GREEN against the acceptance tests. Refactor only while green.
