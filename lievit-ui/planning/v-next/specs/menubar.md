<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — menubar

- **tier**: WIRE + ENH (`collection-nav.enhancer.ts`, the shared collection roving/typeahead mechanism)
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: NET-NEW
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Menubar (BUILT against raw APG — react-aria has no `useMenuBar` in its public
      surface; the keyboard map + ARIA wiring + roving-tabindex model are transcribed from the APG directly
      into ORIGINAL template + `collection-nav` enhancer; no APG example source copied). APG URL verified:
      https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ (keyboard example:
      https://www.w3.org/WAI/ARIA/apg/patterns/menubar/examples/menubar-navigation/)
    - inventory: Ant Design Menu (mode=horizontal) as inventory reference for top-level items + submenu
      structure + item groups + icons + disabled items + danger intent; Ant Design `mode=inline` is NOT
      this component (that is sidebar/navigation-menu)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      navigation bar conventions (NO code copied)

## 1. What it is

A horizontal persistent navigation bar of top-level menu items where each item either activates directly
or reveals a vertical dropdown submenu.
The canonical use case is the application-level command bar (File / Edit / View / Help) or a top-level
navigation bar where each heading triggers a structured menu of links or actions.

**Why WIRE**: the OPEN SUBMENU state (which top-level item is currently expanded) is a server fact — the
server renders the correct `aria-expanded` / `aria-current` state; the client morphs.
Submenus whose items link to pages use Turbo Drive for navigation; submenus whose items fire actions use
wire round-trips. The irreducible client behavior — roving tabindex across the menubar row, vertical
arrow navigation within a submenu, typeahead, Esc to close, Right/Left to hop between sibling top-level
items while keeping a submenu open — is the shared `collection-nav` enhancer, parameterised for the
two-axis menubar model (horizontal bar + vertical dropdown), NOT a hand-roll.

**Server-first works here** because the menubar structure (items, labels, icons, disabled states, which
submenu is open, which item is `aria-current`) is entirely server-known. There is no client-only state
that must live in the browser; open/close is a server toggle, the morph updates the DOM, and the enhancer
re-homes focus after each morph without any client state duplication.

**Distinction from neighbouring components**:
- `dropdown-menu` — a single trigger button that opens one contextual menu; no persistent bar.
- `navigation-menu` — rich panel menus (mega-menu style) with arbitrary content regions; horizontal nav
  with full-width panels. `menubar` is command-bar / file-menu style: compact, items only, no rich panels.
- `sidebar` / `navigation-menu` (mode=inline) — vertical nav, a different pattern entirely.
- `context-menu` — right-click triggered; shares the submenu markup/enhancer but has no persistent bar.

## 2. API — the WIRE surface + template params

**Java (`MenubarComponent`)**:

| member | kind | meaning |
|---|---|---|
| `items` `List<MenubarItem>` | `@Wire @LievitProperty(locked=true)` | the complete item tree (top-level items + their submenus); locked — a client cannot inject items |
| `openItemId` `String` | `@Wire` | id of the currently-expanded top-level item, or `null` when all closed |
| `activeItemId` `String` | `@Wire` | id of the currently-highlighted leaf item (for `aria-current`); set by navigation, `null` when none |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `sm \| md \| lg` — height of the menubar bar row (toolbar-aligned) |
| `ariaLabel` `String` | `@Wire @LievitProperty(locked=true)` | accessible name for the `role=menubar` container; required |
| `openItem(String id)` | `@LievitAction` | sets `openItemId = id`; validates `id` is a top-level item with a submenu (authz + validation in Java BEFORE mutate); no-op if item is disabled |
| `closeMenu()` | `@LievitAction` | sets `openItemId = null` |
| `activateItem(String id)` | `@LievitAction` | sets `activeItemId = id`; fires navigation or domain action for the leaf; validates `id` ∈ known leaf items |

**`MenubarItem` value type (server-owned, not a client type)**:

| field | type | meaning |
|---|---|---|
| `id` | `String` | stable, unique; used in `data-item-id` (escaped) and ARIA id fragments |
| `label` | `String` | visible text label |
| `icon` | `String \| null` | Lucide icon name; rendered via `@template.lievit.icon` with `aria-hidden` |
| `href` | `String \| null` | when set, the item is a link (`<a href>`), navigation via Turbo Drive; when null, it fires `activateItem` |
| `disabled` | `boolean` | item is inert; rendered with `aria-disabled="true"` |
| `danger` | `boolean` | destructive intent; recolours to `--lv-color-destructive` |
| `checked` | `Boolean \| null` | when non-null, renders as `menuitemcheckbox` (`true`/`false` → `aria-checked`) |
| `radioGroup` | `String \| null` | when set, renders as `menuitemradio` in the named group |
| `separator` | `boolean` | when true, item is a `<li role="separator">` (no label/id) |
| `children` | `List<MenubarItem> \| null` | submenu items; when non-null this item is a parent; top-level parents get `aria-haspopup="menu" aria-expanded` |
| `groupLabel` | `String \| null` | when set, this item heads an `aria-label`-ed group within its submenu (rendered as `role="group"` wrapper) |

**Template params** (the JTE `@param` surface): one `@param` per `@Wire` field + `@param ComponentMetadata _component` + `@param MenubarComponent _instance`. No `Content` slot (WIRE has none; the menu structure is fully OWNED server markup built from `items`).

**The two escaping channels** apply to every per-item data attribute:

- `data-item-id`, `data-href`, `data-group` values → **SAFE escaped** via `Escape.htmlAttribute` (per-row,
  DB-or-model-derived strings; the `wireArgs`/`dataAttrs` channel).
- wire directive strings (`l:click="openItem"`, `l:keydown.*`) are STATIC author-typed strings → **TRUSTED
  raw** (`$unsafe`), never fed per-row data.

## 3. Variants / sizes / states

### Variants

The menubar has no `variant` param of its own (it is not an intent-coloured control). Individual items
carry intent via:

- `danger=true` → leaf item colour from `--lv-color-destructive` / `--lv-color-destructive-fg` (the
  shared destructive intent token pair, same as `button variant=destructive`).
- `checked` / `radioGroup` → renders the checked/radio dot marker using `--lv-color-primary`.
- `disabled=true` → `--lv-color-muted-fg` + `aria-disabled="true"`; pointer-events none.

The bar background + top-level item hover/active colours are token-driven and fully adopter-overridable
(no hardcoded colour).

### Sizes

`size` controls the height of the menubar bar row (toolbar-aligned, shared scale):

| size | height token | default text | usage |
|---|---|---|---|
| `sm` | `--lv-space-8` (32 px) | `--lv-text-xs` | dense toolbars |
| `md` | `--lv-space-9` (36 px) | `--lv-text-sm` | default — aligns flush with `button md` / `input md` |
| `lg` | `--lv-space-10` (40 px) | `--lv-text-base` | prominent top bars |

Submenus are not height-controlled by `size`; they use `--lv-space-9` as their fixed item height
(submenu items are always `md`-equivalent for readability).

### States

| state | how expressed |
|---|---|
| top-level item expanded | `aria-expanded="true"` on the `<button role="menuitem">` (or `<a role="menuitem">`); the submenu `<ul role="menu">` is present in DOM |
| top-level item collapsed | `aria-expanded="false"`; the submenu `<ul>` is `hidden` / absent |
| leaf item active / current | `aria-current="page"` (link items) or `aria-current="true"` (action items) when `id == activeItemId` |
| item disabled | `aria-disabled="true"` on the item; no `href` stripped (native `disabled` on non-`<button>` would drop semantics); item excluded from roving focus by the enhancer |
| item focused (roving) | `tabindex="0"` on the currently-focused item; all others `tabindex="-1"` (roving-tabindex model, managed by `collection-nav`) |
| menuitemcheckbox checked | `aria-checked="true"` |
| menuitemcheckbox unchecked | `aria-checked="false"` |
| menuitemradio checked | `aria-checked="true"` |
| menuitemradio unchecked | `aria-checked="false"` |
| aria-busy during wire round-trip | set by the lievit runtime's `beforeCall`/`afterCall` hook on the component root; the component does not manage this |

## 4. The a11y contract (the heart — load-bearing, fully specified)

**WAI-ARIA pattern**: APG Menubar (BUILT — see §credits; verified against
https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ and the navigation example
https://www.w3.org/WAI/ARIA/apg/patterns/menubar/examples/menubar-navigation/).

### Roles + ARIA emitted by the template

| element | role / attributes | condition |
|---|---|---|
| bar container `<nav>` or `<div>` | `role="menubar"` `aria-label="${ariaLabel}"` `aria-orientation="horizontal"` | always |
| top-level item, no submenu, link | `<a href role="menuitem" tabindex="-1\|0" aria-current aria-disabled>` | `href` set, `children == null` |
| top-level item, no submenu, action | `<button type="button" role="menuitem" tabindex="-1\|0" aria-disabled>` | `href == null`, `children == null` |
| top-level item, has submenu | `<button type="button" role="menuitem" aria-haspopup="menu" aria-expanded="${open}" aria-controls="<submenuId>" tabindex="-1\|0" aria-disabled>` | `children != null` |
| submenu container | `<ul role="menu" id="<submenuId>" aria-label="<parentLabel>"` [hidden when closed]`>` | parent item has `children` |
| group wrapper inside submenu | `<li role="none"><ul role="group" aria-label="<groupLabel>">` | `groupLabel` set |
| submenu leaf item, link | `<a href role="menuitem" tabindex="-1" aria-current aria-disabled>` | `href` set, no `children` |
| submenu leaf item, action | `<button type="button" role="menuitem" tabindex="-1" aria-disabled>` | `href == null`, no `children` |
| submenu item, has nested submenu | `<button type="button" role="menuitem" aria-haspopup="menu" aria-expanded tabindex="-1" aria-disabled>` | `children != null` (nested; max depth = 2) |
| submenu item, checkbox | `<button type="button" role="menuitemcheckbox" aria-checked="${checked}" tabindex="-1" aria-disabled>` | `checked != null` |
| submenu item, radio | `<button type="button" role="menuitemradio" aria-checked="${checked}" tabindex="-1" aria-disabled>` | `radioGroup` set |
| separator | `<li role="separator">` | `separator=true` |
| icon inside any item | `@template.lievit.icon(name=..., ariaHidden=true)` | `icon != null` |

The first top-level menuitem gets `tabindex="0"` on initial render (the roving-tabindex seed). All others
get `tabindex="-1"`. The enhancer manages which item owns `tabindex="0"` as focus moves.

### Keyboard map (the complete contract — `collection-nav` owns all non-platform keys)

Verified against https://www.w3.org/WAI/ARIA/apg/patterns/menubar/examples/menubar-navigation/.

**Context: focus is on a TOP-LEVEL menubar item**

| key | does | who |
|---|---|---|
| Right Arrow | move focus to the next top-level item (wrap to first at end) | `collection-nav` |
| Left Arrow | move focus to the previous top-level item (wrap to last at start) | `collection-nav` |
| Down Arrow | open the focused item's submenu (if any) and focus its FIRST item | `collection-nav` |
| Up Arrow | open the focused item's submenu (if any) and focus its LAST item | `collection-nav` |
| Enter | open submenu and focus first item (if parent); or activate item + fire `activateItem` (if leaf) | `collection-nav` → wire |
| Space | same as Enter | `collection-nav` → wire |
| Home | move focus to the FIRST top-level item | `collection-nav` |
| End | move focus to the LAST top-level item | `collection-nav` |
| printable character (typeahead) | move focus to the next top-level item whose label starts with the typed character | `collection-nav` |
| Tab | move focus OUT of the menubar to the next focusable on the page (no trap — menubar is non-modal) | platform |
| Shift+Tab | move focus OUT of the menubar to the previous focusable on the page | platform |
| Esc | close the open submenu (if any) and keep focus on the top-level item; no-op if all closed | `collection-nav` |

**Context: focus is inside an OPEN SUBMENU**

| key | does | who |
|---|---|---|
| Down Arrow | move to the next submenu item (wrap to first at end) | `collection-nav` |
| Up Arrow | move to the previous submenu item (wrap to last at start) | `collection-nav` |
| Home | move focus to the FIRST submenu item | `collection-nav` |
| End | move focus to the LAST submenu item | `collection-nav` |
| Enter | open nested submenu and focus its first item (if parent); or activate item + fire `activateItem` / follow `href` (if leaf); toggle `aria-checked` and fire `activateItem` for checkbox/radio items | `collection-nav` → wire / platform |
| Space | same as Enter for checkbox/radio; same as Enter for others | `collection-nav` → wire |
| Esc | close this submenu and return focus to the top-level item that owns it | `collection-nav` |
| Right Arrow | if focused item has a nested submenu: open it and focus its first item; else: close the current submenu, advance focus to the NEXT top-level item (wrapping), open ITS submenu if it has one | `collection-nav` |
| Left Arrow | if inside a nested submenu: close the nested submenu, return focus to the parent submenu item; if at the top-level submenu: close it, move to the PREVIOUS top-level item (wrapping), open ITS submenu if it has one | `collection-nav` |
| Tab | close ALL open submenus, move focus OUT of the menubar to the next focusable | `collection-nav` (close) + platform (Tab) |
| Shift+Tab | close ALL open submenus, move focus OUT of the menubar to the previous focusable | `collection-nav` (close) + platform |
| printable character (typeahead) | move focus to the next item in the CURRENT submenu whose label starts with the typed character | `collection-nav` |

### Focus management

**Roving tabindex** (APG Menubar model): at any moment exactly ONE element in the menubar
holds `tabindex="0"`; all others hold `tabindex="-1"`. The `collection-nav` enhancer updates
`tabindex` as focus moves. This keeps the entire menubar a single Tab stop for users who are
not navigating within it.

**Initial focus on Tab-into-menubar**: focus lands on the element with `tabindex="0"` (the
previously-focused item, or the first item on first entry).

**Submenu focus**: when a submenu opens, DOM focus moves INTO the submenu to the first (or last)
item. This is REAL DOM focus (not `aria-activedescendant`) because the APG Menubar example uses
the roving-tabindex approach with real focus movement, not the virtual `activedescendant` approach
used by listboxes. The `collection-nav` enhancer is parameterised for this mode.

**Focus return on Esc / close**: focus returns to the top-level menubar item that owns the submenu.
The enhancer records the opener before moving focus into the submenu.

**No focus trap**: the menubar is non-modal. Tab exits the menubar entirely.

**Disabled items**: excluded from the roving sequence; the enhancer skips them when arrowing through.

**Live region**: none. The menubar does not announce item count or selection state through an ARIA
live region; the role semantics (`menuitem`, `aria-expanded`, `aria-checked`) carry the information
to assistive technology directly.

**Shared mechanisms composed**:
- `collection-nav.enhancer.ts` — the ONE roving-tabindex + typeahead + arrow-navigation enhancer,
  parameterised with `axis: "horizontal"` for the menubar row and `axis: "vertical"` for each submenu,
  plus the two-axis "hop" behavior (Right Arrow in a submenu = close + advance menubar + open next). Do
  NOT hand-roll this. This is the same enhancer `select`, `dropdown-menu`, `tabs`, and `combobox` use.
- The **popover/overlay seam** (native `popover` attribute + CSS Anchor Positioning) for submenu
  positioning and light-dismiss (click outside = `closeMenu()`). Do NOT hand-roll positioning.

## 5. Tokens

### Consumed tokens

| token | used for |
|---|---|
| `--lv-color-bg` | menubar bar background |
| `--lv-color-fg` | default item text |
| `--lv-color-muted-fg` | disabled item text |
| `--lv-color-accent` | top-level item hover / active background |
| `--lv-color-accent-fg` | top-level item hover / active text |
| `--lv-color-primary` | checked indicator dot (checkbox/radio items) |
| `--lv-color-destructive` | danger item text |
| `--lv-color-destructive-fg` | danger item text on hover (when accent bg) |
| `--lv-color-popover` | submenu panel background |
| `--lv-color-popover-fg` | submenu item text |
| `--lv-color-border` | submenu panel border + separator colour |
| `--lv-space-8` | bar height at `size=sm` |
| `--lv-space-9` | bar height at `size=md` (default); submenu item height |
| `--lv-space-10` | bar height at `size=lg` |
| `--lv-space-2` | icon gap within item; separator padding |
| `--lv-space-3` | item horizontal padding (sm) |
| `--lv-space-4` | item horizontal padding (md/lg) |
| `--lv-space-6` | submenu min-width (derived from a multiple) |
| `--lv-text-xs` | item label at `size=sm` |
| `--lv-text-sm` | item label at `size=md` (default) |
| `--lv-text-base` | item label at `size=lg` |
| `--lv-radius-md` | submenu panel corner radius |
| `--lv-shadow-md` | submenu panel elevation |
| `--lv-z-popover` | submenu z-index (above content, below modal) |
| `--lv-ring` | focus-visible ring on focused menubar item |
| `--lv-font-sans` | item typeface |

### NET-NEW tokens

None. The menubar composes the existing popover + accent + border + ring token vocabulary.
No new token is required; the `--lv-color-bg` / `--lv-color-accent` pair already covers the
bar background + hover surface, and the popover token set covers the submenu panel.

### Dark-mode

Covered by the single `.dark, [data-theme="dark"]` re-point block in `lievit-tokens.css`. No
component-level dark-mode rules are added (all referenced tokens already have dark values).

## 6. Wire actions + enhancer integration

### Wire directives on the template

```
// top-level item WITH submenu
l:click="openItem" data-item-id="<escaped id>"

// top-level item WITHOUT submenu (action)
l:click="activateItem" data-item-id="<escaped id>"

// top-level item WITHOUT submenu (link) — no wire directive; plain <a href> + Turbo Drive

// submenu leaf item (action)
l:click="activateItem" data-item-id="<escaped id>"

// submenu leaf item (checkbox)
l:click="activateItem" data-item-id="<escaped id>"   // server toggles checked + re-renders

// close on scrim / outside click (light-dismiss from the popover seam)
l:click="closeMenu"   // wired on the popover backdrop / overlay

// keyboard-driven close (enhancer fires this wire action on Esc / Tab-out)
// the enhancer calls: $lievit.call('closeMenu')
// the enhancer calls: $lievit.call('openItem', { 'item-id': id }) for arrow hops
// the enhancer calls: $lievit.call('activateItem', { 'item-id': id }) for Enter/Space on a leaf
```

The `data-item-id` value is ALWAYS routed through `Escape.htmlAttribute` (the `dataAttrs` / `wireArgs`
escaping channel). The `l:click` directive string is a STATIC author-typed literal (`$unsafe` / `attrs`).

### Round-trip flows

**Open submenu**: user clicks or arrows Down on a top-level parent item →
enhancer fires `openItem(id)` → server sets `openItemId = id` → re-renders the bar with
`aria-expanded="true"` on that item + the submenu `<ul>` present and visible → morph patches the DOM →
enhancer receives the `onComponentUpdated` lifecycle signal, moves DOM focus to the first submenu item.

**Close submenu**: user presses Esc / clicks outside / tabs out → enhancer fires `closeMenu()` →
server sets `openItemId = null` → re-renders with all submenus absent → morph removes them → enhancer
returns focus to the top-level item that was open.

**Hop between top-level items with open submenu**: user presses Right/Left Arrow while a submenu is open →
enhancer fires `openItem(nextId)` (a single wire call that closes the old submenu and opens the new one in
one round-trip) → server sets `openItemId = nextId` → morph updates → enhancer moves focus to the first
item of the newly-opened submenu.

**Activate leaf item (action)**: user presses Enter or clicks a leaf → enhancer fires `activateItem(id)` →
server validates `id`, mutates domain state (or emits domain event), sets `activeItemId = id`, optionally
sets `openItemId = null` → re-renders → morph + enhancer return focus to the triggering top-level item (or
the activated item if the bar stays open).

**Activate leaf item (link)**: user presses Enter or clicks a leaf `<a href>` → Turbo Drive navigates
(no wire round-trip needed); the `href` is the primary mechanism. The enhancer allows the default on link
items.

**Checkbox / radio item**: same as action leaf; server toggles `checked` on the `MenubarItem` record and
re-renders the submenu; the morph updates `aria-checked` in the DOM.

### Enhancer responsibilities (`collection-nav`, menubar parameterisation)

The `collection-nav` enhancer is instantiated TWICE per menubar component: once for the menubar row
(horizontal axis, items = top-level `[role=menuitem]`) and once per open submenu (vertical axis, items =
the submenu's `[role=menuitem][role=menuitemcheckbox][role=menuitemradio]`). The enhancer is parameterised
at init via `data-collection-nav` on the container:

```html
<!-- bar container -->
<nav role="menubar" data-collection-nav='{"axis":"horizontal","wrap":true,"typeahead":true}' ...>

<!-- open submenu container -->
<ul role="menu" data-collection-nav='{"axis":"vertical","wrap":true,"typeahead":true}' ...>
```

The enhancer:
- manages roving `tabindex` (0 / -1) across the items in its container;
- handles arrow keys, Home/End, typeahead within its axis;
- on Right Arrow in a vertical submenu: fires `openItem(nextTopLevelId)` (the hop);
- on Left Arrow at the top submenu level: fires `openItem(prevTopLevelId)` (the hop);
- on Esc in a submenu: fires `closeMenu()` + returns focus to the parent top-level item;
- on Tab / Shift+Tab: fires `closeMenu()` + allows Tab to proceed to the platform;
- on Enter / Space on a parent item (bar or submenu): fires `openItem(id)`;
- on Enter / Space on a leaf item: fires `activateItem(id)` (or allows the link default for `<a>`);
- skips `aria-disabled="true"` items in roving navigation;
- records focus before moving into a submenu so it can restore on close.

The enhancer registers itself via the `data-collection-nav` directive in the lievit runtime's directive
registry (`lifecycle: onComponentInit`). It re-initialises on each `onComponentUpdated` signal (after
morph) so newly-opened submenus are picked up without stale references.

## 7. Acceptance tests (the gate — refute-by-default)

All tests run on a REAL substrate (not mocked `$lievit` — the client-island-fidelity lesson). A test
that exercises a fake `$lievit` certifies nothing about the real menubar interaction.

### Render tests (real `LievitRuntime` + jsdom, real `collection-nav` enhancer mounted)

| test name | assertion |
|---|---|
| `renders menubar with role and label` | the bar container has `role="menubar"` and `aria-label` matching `ariaLabel` param |
| `renders top-level items with menuitem role` | every top-level item has `role="menuitem"` |
| `renders parent item with aria-haspopup and aria-expanded=false when closed` | a top-level item with `children` has `aria-haspopup="menu"` + `aria-expanded="false"` + submenu `<ul>` absent or `hidden` |
| `renders submenu with role=menu when open` | after `openItem(id)`, the submenu `<ul>` is present in DOM with `role="menu"` + `aria-label`; parent has `aria-expanded="true"` |
| `renders submenu items with menuitem role` | each submenu leaf has `role="menuitem"` |
| `renders checkbox item with role=menuitemcheckbox and aria-checked` | a `checked=true` item has `role="menuitemcheckbox"` + `aria-checked="true"` |
| `renders radio item with role=menuitemradio and aria-checked` | a `radioGroup` item has `role="menuitemradio"` + matching `aria-checked` |
| `renders disabled item with aria-disabled=true` | disabled items carry `aria-disabled="true"` |
| `renders separator as role=separator` | `separator=true` items render `<li role="separator">` |
| `renders active item with aria-current` | when `activeItemId` matches a leaf, that item has `aria-current="page"` (link) or `aria-current="true"` (action) |
| `renders group with role=group and aria-label` | `groupLabel` items wrap their children in `role="group"` + `aria-label` |
| `renders danger item with destructive token class` | `danger=true` items carry the `--lv-color-destructive` token utility |
| `renders size sm/md/lg with correct height token class` | each size maps to its `--lv-space-8/9/10` height class |
| `body content is visible after submenu open — the projection assertion` | submenu item labels are visible in the rendered DOM after `openItem` (not absent, not inside `hidden`); this is the server-first projection test |

### axe-core tests

| test name | assertion |
|---|---|
| `axe: closed menubar passes` | zero violations on `role=menubar` with all submenus closed (axe rules: `aria-required-children`, `aria-allowed-attr`, `button-name`, `link-name`) |
| `axe: open submenu passes` | zero violations with one submenu open (axe checks `role=menu` + `role=menuitem` + `aria-haspopup` + `aria-expanded` wiring) |
| `axe: checkbox item passes` | zero violations on a `menuitemcheckbox` with `aria-checked` |
| `axe: radio group passes` | zero violations on a group of `menuitemradio` items |
| `axe: disabled item passes` | zero violations with `aria-disabled="true"` items present |
| `axe: icon-only label check` | an icon with no sibling text and no `aria-label` on the item FAILS axe (asserts the accessible-name requirement) |

### Keyboard tests (real enhancer; assert observable DOM outcome after each keypress)

| test name | assertion |
|---|---|
| `Right Arrow moves focus to next top-level item` | after Right Arrow, `document.activeElement` is the next menubar item |
| `Left Arrow moves focus to previous top-level item (wraps)` | at the first item, Left Arrow focuses the last |
| `Down Arrow opens submenu and focuses first item` | Down Arrow on a parent item: submenu is present, `aria-expanded=true`, `document.activeElement` is the first submenu item |
| `Up Arrow opens submenu and focuses last item` | Up Arrow on a parent item: `document.activeElement` is the last submenu item |
| `Enter on parent top-level item opens submenu` | submenu present + first item focused |
| `Space on parent top-level item opens submenu` | same |
| `Home moves to first top-level item` | `document.activeElement` is the first menubar item regardless of starting position |
| `End moves to last top-level item` | `document.activeElement` is the last menubar item |
| `typeahead on menubar jumps to matching item` | pressing `"e"` focuses the top-level item whose label starts with "E" |
| `Down Arrow in submenu moves to next item (wraps)` | at last submenu item, Down Arrow focuses the first |
| `Up Arrow in submenu moves to previous item (wraps)` | at first submenu item, Up Arrow focuses the last |
| `Home in submenu focuses first item` | regardless of current position |
| `End in submenu focuses last item` | regardless of current position |
| `typeahead in submenu jumps to matching item` | pressing `"s"` focuses the submenu item whose label starts with "S" |
| `Esc in submenu closes it and returns focus to top-level item` | submenu absent or `hidden`; `document.activeElement` is the top-level parent item; `aria-expanded=false` |
| `Esc on menubar with no open submenu is a no-op` | no state change; focus remains on current top-level item |
| `Right Arrow in submenu (no nested) closes submenu and moves to next top-level item` | current submenu closes, next top-level item focused (and its submenu opens if it has one) |
| `Left Arrow at top submenu level closes and moves to previous top-level item` | previous top-level item focused |
| `Enter on leaf item fires activateItem wire action` | `$lievit.call('activateItem', ...)` called with correct item id |
| `Enter on leaf link item follows href (no wire call)` | the default action is allowed; no `activateItem` call fired |
| `Enter on checkbox item fires activateItem and re-renders with toggled aria-checked` | after morph, `aria-checked` has flipped |
| `Tab closes all open submenus and exits menubar` | `closeMenu` called; focus moves to next page element |
| `disabled items are skipped by arrow navigation` | arrowing past a disabled item lands on the next enabled item |
| `disabled items cannot be activated` | Enter/Space on a disabled item does not fire wire actions |

### Focus tests

| test name | assertion |
|---|---|
| `roving tabindex: only one item has tabindex=0 at a time` | after any arrow move, exactly one `[role=menuitem]` in the menubar has `tabindex="0"`; all others have `tabindex="-1"` |
| `focus returns to top-level item on submenu close` | `document.activeElement` is the top-level parent after Esc |
| `Tab-into-menubar lands on tabindex=0 item` | tabbing into the bar from outside focuses the item with `tabindex="0"` |
| `no focus trap: Tab exits the menubar` | `document.activeElement` is NOT inside the menubar after Tab |

### Wire round-trip IT (lievit-kit, real runtime, `CollapsibleComponentIT` pattern)

| test name | assertion |
|---|---|
| `openItem round-trip renders open submenu` | mount → call `openItem(id)` → re-rendered DOM has `aria-expanded=true` + submenu visible + submenu items in DOM |
| `closeMenu round-trip collapses submenu` | from open → call `closeMenu()` → submenu absent/hidden + `aria-expanded=false` |
| `activateItem round-trip sets activeItemId` | call `activateItem(id)` → re-render has `aria-current` on the correct item |
| `activateItem validates unknown id` | call `activateItem("injected-unknown-id")` → action throws / is a no-op; no state mutation |
| `openItem with disabled item is a no-op` | call `openItem(disabledParentId)` → `openItemId` remains unchanged |
| `checkbox activateItem toggles checked state` | call `activateItem(checkboxItemId)` twice → `aria-checked` flips true/false/true across two re-renders |

### Variants/sizes tests

| test name | assertion |
|---|---|
| `size=sm renders --lv-space-8 height class` | bar element carries the `sm` height token utility |
| `size=md renders --lv-space-9 height class` (default) | bar element carries the `md` height token utility |
| `size=lg renders --lv-space-10 height class` | bar element carries the `lg` height token utility |
| `danger item carries destructive token class` | `danger=true` item element carries the `--lv-color-destructive` utility |

### Escaping tests (the XSS abuse-case)

| test name | assertion |
|---|---|
| `hostile item id is HTML-escaped in data-item-id` | an item whose id contains `"><script>alert(1)</script>` renders the `data-item-id` attribute inert (value is escaped, no tag injected) |
| `hostile href is HTML-escaped` | an item whose href contains a javascript: URL or hostile characters renders the attribute inert via `Escape.htmlAttribute` |

### JTE + Playwright

| test name | assertion |
|---|---|
| `JTE compiles and renders without exception` | covered by the `test/jte-compile` real-compiler + render gate |
| `Playwright: click opens submenu on real page` | real `page.click` on a top-level parent item opens its submenu; submenu body contains resolved item labels (not absent, not empty — the projection assertion) |
| `Playwright: keyboard nav selects leaf item on real page` | real `page.keyboard` Down+Down+Enter navigates to a leaf item and fires the wire action; the bar re-renders with `aria-current` on the activated item |
| `Playwright: Esc closes submenu on real page` | keyboard Esc while a submenu is open closes it; focus is on the top-level item |

## 8. Non-goals / anti-patterns

- **No mega-menu / rich panel**: the menubar contains `menuitem` elements, not arbitrary content panels.
  For full-width panels with images, grids, or rich content, use `navigation-menu` instead.
- **No vertical / inline menubar**: this component is HORIZONTAL only (`aria-orientation="horizontal"`).
  For a vertical sidebar navigation tree, use `sidebar` or `navigation-menu` (mode=inline / accordion).
- **No hand-rolled roving tabindex**: the `collection-nav` enhancer owns ALL roving + arrow + typeahead.
  Copying its logic into this component is the exact failure mode the single-source-a11y rule prevents.
- **No hand-rolled submenu positioning**: the popover seam (native `popover` + CSS Anchor Positioning)
  owns positioning + light-dismiss. No custom `getBoundingClientRect()` + absolute-position JS.
- **No client-side state duplication**: the open submenu id and active item id are `@Wire` fields.
  The enhancer does NOT track these in JS variables; it reads the current DOM state (the `aria-expanded`
  attribute) to know what is open. State has one owner: the server.
- **No `aria-activedescendant` pattern for menubar**: the APG Menubar example uses roving tabindex
  (real DOM focus movement), not virtual `aria-activedescendant`. Do not substitute the listbox focus
  model here; menus receive real DOM focus, which is what the APG pattern requires.
- **No framework islands**: no Lit, no Alpine, no React inside this component. The enhancer is a
  typed-vanilla-TS module, CSP-clean, registered via the lievit runtime directive registry.
- **No inline `<script>` or `on*=` event handlers** in the JTE template. The strict CSP refuses them
  and the anti-pattern grep will catch them. All behavior goes through the enhancer + wire directives.
- **No literal colour values** in the template or tokens. Every colour is a `var(--lv-*)` OKLCH token.
  Hex / rgb literals in the component body are a CI lint failure.
- **No more than 2 levels of submenu depth**: the APG pattern and the two-axis `collection-nav`
  parameterisation support parent items in both the bar and a submenu; a third level of nesting
  (sub-sub-submenu) is not supported and must not be rendered by the template. Validate this in the
  Java `@Wire @LievitProperty` setter and/or the `openItem` action.
- **No Turbo Stream responses**: this component re-renders via the lievit wire protocol
  (`POST /lievit/{id}/call` + `Lievit-Snapshot` round-trip + bespoke morph), not Turbo Streams.
  The Turbo Stream tier is a separate HTMX pattern recipe, not this component's concern.

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens.
You MAY read the WAI-ARIA APG Menubar pattern (https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
and the navigation example (https://www.w3.org/WAI/ARIA/apg/patterns/menubar/examples/menubar-navigation/)
as the definitive a11y reference for keyboard map + roles + ARIA attributes.
You MAY read Ant Design Menu (mode=horizontal) as the inventory reference for item structure + features.
You MAY read Tailwind UI navigation bar components as visual inspiration for the look.
You MUST NOT paste literal source code from ANY of these (the one bright line, `02-licensing.md`) —
the output is always original generation.

Compose the ONE shared `collection-nav.enhancer.ts` (do NOT hand-roll roving, typeahead, or the two-axis
hop behavior) and the ONE popover seam (do NOT hand-roll submenu positioning or light-dismiss).
Mirror `button.jte`'s JTE house conventions exactly (header doc-comment with all labelled sections,
typed `@param`, `data-slot="menubar"` on the root, `data-size`, the two escaping channels, zero `<script>`).
The WIRE template has NO `Content` slot (server-first refactor blueprint §1.b); the item tree is fully
OWNED markup built from `items`.
Escape EVERY per-item dynamic value (`id`, `href`, `data-item-id`) through `Escape.htmlAttribute`;
the `l:click` directive strings are STATIC author-typed literals only.
The render test MUST assert that submenu body content is VISIBLE after `openItem` (the projection
assertion — this is the contract, not optional).
The keyboard map in §4 is the complete contract — assert ALL rows.
Minimal code to GREEN; refactor only while green.
