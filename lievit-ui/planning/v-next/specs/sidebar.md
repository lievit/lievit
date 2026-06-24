<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — sidebar (compound, PARTIAL + ENH)

- **tier**: PARTIAL + ENH (`sidebar.enhancer.ts`, the collapse / off-canvas / keyboard-shortcut mechanism)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/sidebar.jte` + the six sub-partials
  `sidebar/{group,item,rail,inset,menu-action,group-action}.jte` + `registry/jte/sidebar.enhancer.ts`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Disclosure Navigation (`https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/`)
      + APG Landmarks (`<nav>` with `aria-label`). The collapse trigger follows the APG Disclosure button model
      (`aria-expanded` + `aria-controls`); leaf items are real `<a href aria-current="page">`; the collapsible
      sub-tree uses the native `<details>/<summary>` element (platform-supplied `aria-expanded` + Enter/Space
      for free). BUILT against the raw APG for the keyboard shortcut (Cmd/Ctrl+B) and mobile off-canvas Escape
      dismiss (no react-aria pattern covers these exact paths; both transcribed from shadcn Sidebar's model).
    - inventory: shadcn Sidebar anatomy (root / header-bar / content / footer; group / menu / menu-item /
      menu-sub / menu-action / group-action / rail / inset) as inventory reference. Ant Design Menu (side +
      inline modes, sub-menus, items, groups, disabled state) for variant/feature coverage.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look and anatomy inspired by
      shadcn Sidebar + Tailwind UI navigation sidebar (NO code copied)

---

## 1. What it is

The sidebar is the primary application navigation chrome: a docked `<nav>` landmark of real `<a href>`
entries organised into labelled groups, with optional collapsible sub-trees per item, trailing action
affordances per item and per group, a dedicated rail (a thin edge-docked collapse toggle), an optional
header region, an optional footer region, and a paired inset `<main>` for the content area.

It is a **compound component**: one root partial (`sidebar.jte`) plus seven focused sub-partials
(`sidebar/group.jte`, `sidebar/item.jte`, `sidebar/rail.jte`, `sidebar/inset.jte`,
`sidebar/menu-action.jte`, `sidebar/group-action.jte`) plus one typed-TS enhancer
(`sidebar.enhancer.ts`). The composing template (e.g. `kit/page.jte`) iterates a typed `List<NavGroup>`
from the server model, calling the sub-partials; no data is hardcoded in any partial.

**Why PARTIAL + ENH, not WIRE:** the nav itself is pure server projection — which item is current is a
route fact the controller already knows, passed as the `active` flag on each item. The COLLAPSE is pure
client cosmetic: there is nothing for the server to decide when the user narrows their own rail, so a
wire round-trip would be chat for no gain. The desktop choice persists to `localStorage`; the mobile
off-canvas open/close is transient. Both are managed by the typed-TS enhancer — the same escape-hatch
reasoning the input-otp and theme-switcher enhancers use. Server-first is preserved: the entire nav tree
is rendered as real HTML on every request; the enhancer only toggles CSS state and binds the keyboard
shortcut.

---

## 2. API — params / props (the typed surface)

### 2.a Root partial — `sidebar.jte`

| param | type | default | meaning |
|---|---|---|---|
| `content` | `gg.jte.Content` | — | **REQUIRED.** The groups (one or more `@template.lievit.sidebar.group(...)` calls). |
| `label` | `String` | `"Main"` | `aria-label` for the `<nav>` landmark — the accessible name. Required to be meaningful; "Main" is only a fallback. |
| `header` | `gg.jte.Content` | `null` | Optional logo / app-name region inside the header bar. When `null`, the bar renders with just the collapse trigger (the trigger is ALWAYS present; do NOT gate it on this slot). |
| `footer` | `gg.jte.Content` | `null` | Optional footer region (user chip / account actions). When `null`, the footer `<div>` is absent entirely. |
| `side` | `String` | `"left"` | `"left"` \| `"right"` — which viewport edge the sidebar docks to. Controls the `data-side` attribute and the enhancer's border/slide-in direction. |
| `variant` | `String` | `"sidebar"` | `"sidebar"` \| `"none"` \| `"floating"` \| `"inset"`. Visual treatment: `sidebar` = default flush rail with a border; `none` = borderless flush surface; `floating` = detached bordered+shadowed rounded card; `inset` = floating rail + the paired `sidebar.inset` `<main>` also floats as a card. Reflected on the root as `data-variant`; the enhancer's injected stylesheet keys visual rules on this attribute. |
| `collapsed` | `boolean` | `false` | SSR hint: render the initial DOM in the collapsed (icon rail) state. The enhancer overrides this on hydration if a persisted `localStorage` choice exists. |
| `triggerLabel` | `String` | `"Toggle sidebar"` | Accessible name for the collapse/expand `<button>` in the header bar. Also used as the rail button's `aria-label` by default when the rail partial is composed without an explicit label. |
| `storageKey` | `String` | `"lv-sidebar-state"` | `localStorage` key the enhancer persists the desktop collapse choice under. Change when multiple sidebars coexist on the same origin and need independent persistence. |
| `cssClass` | `String` | `""` | Extra utility classes on the `<nav>` element. |

### 2.b Sub-partial — `sidebar/group.jte`

| param | type | default | meaning |
|---|---|---|---|
| `label` | `String` | `""` | Optional section heading text. When non-empty, a `<div id="lv-sidebar-group-{slug}">` heading is rendered and the `<ul>` menu is `aria-labelledby` it. Hidden on the collapsed icon rail (`lv-sidebar-collapsible`). |
| `content` | `gg.jte.Content` | — | **REQUIRED.** The menu items (one or more `sidebar.item` calls). |
| `action` | `gg.jte.Content` | `null` | Optional trailing action affordance beside the heading (typically a `sidebar.group-action` partial). The group `<div>` is the positioning context (`position: relative`). |
| `cssClass` | `String` | `""` | Extra utility classes on the group `<div>`. |

### 2.c Sub-partial — `sidebar/item.jte`

| param | type | default | meaning |
|---|---|---|---|
| `key` | `String` | — | **REQUIRED.** A stable identifier; used to derive the `<details>` disclosure id for a parent item. |
| `label` | `String` | — | **REQUIRED.** Visible entry text. Hidden on the collapsed icon rail (`lv-sidebar-collapsible`). |
| `href` | `String` | `""` | Leaf destination URL. Required for a leaf item; ignored (unused) for a parent item. A blank `href` on a leaf renders `href=""` — callers must always supply a real URL for leaf items. |
| `icon` | `String` | `""` | Lucide icon name. Rendered decoratively (`aria-hidden="true"` via the icon partial). Doubles as the icon-rail glyph when the sidebar is collapsed. Items without an icon lose their visual identity on the collapsed rail; callers should supply icons for all top-level items. |
| `badge` | `String` | `""` | Short badge text (counts, "New"). Hidden on the collapsed icon rail (`lv-sidebar-collapsible`). |
| `active` | `boolean` | `false` | Marks the current page: adds `aria-current="page"` to the anchor / summary and applies the accent highlight. A server fact — the controller resolves the active key from the current route. |
| `disabled` | `boolean` | `false` | Dims the entry (`opacity: 0.5`), blocks pointer events, adds `aria-disabled="true"`, and removes the element from the tab order (`tabindex="-1"`). A `<a>` cannot be natively disabled; `aria-disabled` + `tabindex=-1` + `pointer-events: none` implement it. |
| `open` | `boolean` | `false` | Parent only: renders the `<details>` element open server-side. Use when a child of this item is the `active` route (so the subtree is visible without a click). |
| `content` | `gg.jte.Content` | `null` | Optional child items (nested `sidebar.item` entries). When non-null, this item renders as a **parent**: a `<details>/<summary>` disclosure, not a plain `<a>`. |
| `action` | `gg.jte.Content` | `null` | Optional trailing action affordance at the row's end (typically a `sidebar.menu-action` partial). The `<li>` is its positioning context (`position: relative`). |
| `cssClass` | `String` | `""` | Extra utility classes on the `<li>`. |

### 2.d Sub-partial — `sidebar/rail.jte`

| param | type | default | meaning |
|---|---|---|---|
| `label` | `String` | `"Toggle sidebar"` | Accessible name (and `title` hover hint) for the rail `<button>`. |
| `cssClass` | `String` | `""` | Extra utility classes on the rail `<button>`. |

The rail is a `<button tabindex="-1">` (mouse-only affordance; the header trigger is the keyboard path).
It is absolutely positioned inside the `<nav>` by the enhancer's injected stylesheet. It is hidden on
mobile (the backdrop + header trigger cover mobile there).

### 2.e Sub-partial — `sidebar/inset.jte`

| param | type | default | meaning |
|---|---|---|---|
| `content` | `gg.jte.Content` | — | **REQUIRED.** The page body content rendered inside the `<main>` landmark. |
| `cssClass` | `String` | `""` | Extra utility classes on the `<main>`. |

Required when `variant="inset"`. The `<main data-slot="sidebar-inset">` is a landmark; the enhancer's
stylesheet applies the floating-card treatment (margin, radius, shadow) via the `[data-variant="inset"] ~
.lv-sidebar-inset` sibling selector off the sidebar root.

### 2.f Sub-partial — `sidebar/menu-action.jte`

| param | type | default | meaning |
|---|---|---|---|
| `label` | `String` | `"More"` | Accessible name for the default `<button>`. Ignored when `content` is provided (the caller owns the accessible name of the custom control). |
| `icon` | `String` | `"ellipsis"` | Lucide glyph for the default button. Ignored when `content` is provided. |
| `showOnHover` | `boolean` | `false` | When `true`, adds `lv-sidebar-action-hover` to reveal the action only on row hover or focus-within, keeping the row clean at rest. |
| `content` | `gg.jte.Content` | `null` | Custom control in place of the default ellipsis button. When provided, the caller owns accessible naming. |
| `cssClass` | `String` | `""` | Extra utility classes. |

### 2.g Sub-partial — `sidebar/group-action.jte`

| param | type | default | meaning |
|---|---|---|---|
| `label` | `String` | `"Add"` | Accessible name for the default `<button>`. Ignored when `content` is provided. |
| `icon` | `String` | `"plus"` | Lucide glyph for the default button. Ignored when `content` is provided. |
| `content` | `gg.jte.Content` | `null` | Custom control in place of the default plus button. |
| `cssClass` | `String` | `""` | Extra utility classes. |

### 2.h Enhancer attributes (data-* surface the TS reads)

| attribute | owner element | meaning |
|---|---|---|
| `data-sidebar="root"` | wrapper `<div>` | enhancer mount point selector |
| `data-side="left\|right"` | wrapper `<div>` | controls slide-in direction on mobile |
| `data-variant="sidebar\|none\|floating\|inset"` | wrapper `<div>` | stylesheet variant selector |
| `data-state="expanded\|collapsed"` | wrapper `<div>` | current desktop collapse state (CSS class hook) |
| `data-storage-key="..."` | wrapper `<div>` | localStorage key for persistence |
| `data-mobile-open` | wrapper `<div>` | presence attribute: mobile off-canvas is open |
| `data-slot="sidebar-trigger"` | header collapse `<button>` | enhancer binds the click |
| `data-slot="sidebar-rail"` (+ `data-sidebar="rail"`) | rail `<button>` | enhancer binds the click |
| `data-sidebar="backdrop"` | mobile `<button>` backdrop | enhancer binds the click (close) |
| `data-slot="sidebar-menu-button"` | first focusable inside `<nav>` | focus target on mobile open |

---

## 3. Variants / Sizes / States / Slots

### 3.a Variants (the `variant` param on the root)

| variant | visual treatment | use case |
|---|---|---|
| `sidebar` (default) | flush rail, border on the docked edge, app-surface background | standard admin app layout |
| `none` | flush rail, no border, no elevation | sidebar floats inside an already-bordered container |
| `floating` | detached bordered + shadowed rounded card (margin + radius + shadow) | design-system showcase, card-in-card layouts |
| `inset` | floating card rail + the adjacent `sidebar.inset` `<main>` also floats as a card | Vercel-style layout where the content area is inset |

Each variant is reflected as `data-variant="..."` on the root `<div>`. The enhancer's injected stylesheet
(a `<style id="lv-sidebar-styles">` tag, injected once, idempotent) applies the correct CSS keyed on the
attribute. Changing the variant at runtime (if the server re-renders with a different value) is handled
automatically by the stylesheet selector — no JS reads the variant directly.

### 3.b Sizes

The sidebar itself does not expose a `size` param (its width is a fixed token, not a toolbar-aligned
height). The **collapse states** serve an analogous role:

| state | desktop width | mobile behaviour |
|---|---|---|
| expanded (default) | `--lv-w-sidebar` (16rem / 256px) | full-width off-canvas overlay |
| collapsed (icon rail) | `--lv-w-sidebar-collapsed` (3.25rem / 52px) | collapsed state is ignored on mobile; the rail is always full-width when open |

Items inside the sidebar DO vary by the presence/absence of an icon (icon-only rail vs labelled item).
Sub-item indentation is fixed at `--lv-space-4`.

### 3.c States

| state | how expressed | ARIA reflection |
|---|---|---|
| **expanded** | `data-state="expanded"` on root | trigger `aria-expanded="true"` |
| **collapsed** | `data-state="collapsed"` on root; CSS hides `.lv-sidebar-collapsible` elements; items centre their icon | trigger `aria-expanded="false"` |
| **mobile-open** | `data-mobile-open` attribute on root; nav slides in from the edge; backdrop becomes visible | none (cosmetic only) |
| **active item** | server-set `active=true` on `sidebar.item` | `aria-current="page"` on the `<a>` |
| **disabled item** | server-set `disabled=true` on `sidebar.item` | `aria-disabled="true"` + `tabindex="-1"` on the `<a>` |
| **sub-tree open** | server-set `open=true` on a parent `sidebar.item` | native `<details open>` — platform reflects `aria-expanded` on the `<summary>` for free |
| **sub-tree closed** | `<details>` without `open` | native platform `aria-expanded="false"` on `<summary>` |
| **action showOnHover** | `.lv-sidebar-action-hover` on the action affordance; CSS reveals on `:hover` / `:focus-within` of the `<li>` | none (cosmetic only) |

### 3.d Slots (the `data-slot` vocabulary)

| slot | element | purpose |
|---|---|---|
| `sidebar-wrapper` | root `<div>` | the component mount root; the enhancer's selector target |
| `sidebar` | `<nav>` | the landmark; receives `aria-label` |
| `sidebar-header` | `<div>` | header bar: always rendered; contains header content + the trigger |
| `sidebar-trigger` | `<button>` | the keyboard-reachable collapse/expand toggle |
| `sidebar-content` | `<div>` | scrollable groups area; receives the `content` slot |
| `sidebar-footer` | `<div>` | footer region; omitted when `footer` is null |
| `sidebar-group` | `<div>` | one labelled group section |
| `sidebar-group-label` | `<div>` | the group heading; hidden on collapsed rail |
| `sidebar-group-action` | `<button>` or custom `<span>` | trailing action beside the group heading |
| `sidebar-menu` | `<ul>` | the list of menu items in a group |
| `sidebar-menu-item` | `<li>` | one entry; positioning context for its action |
| `sidebar-menu-button` | `<a>` or `<summary>` | the interactive surface of a nav entry |
| `sidebar-menu-badge` | `<span>` | optional badge (count / "New"); hidden on collapsed rail |
| `sidebar-menu-sub` | `<ul>` | sub-item list inside a parent `<details>` |
| `sidebar-menu-action` | `<button>` or custom `<span>` | trailing action at the row end |
| `sidebar-rail` | `<button>` | edge-docked mouse-only collapse toggle |
| `sidebar-inset` | `<main>` | the paired content area (required for `variant="inset"`) |

---

## 4. The a11y contract (the heart — non-negotiable, fully specified)

**WAI-ARIA patterns**: APG Disclosure Navigation + APG Landmarks.

Authoritative sources:
- APG Disclosure (Show/Hide): `https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/`
- APG Disclosure Navigation example: `https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/`
- APG Landmarks: `https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/`

The sidebar does NOT use the APG Menu or Menubar pattern. Nav items are real `<a href>` links inside a
`<nav>` landmark — the browser navigates natively, JS-off correct. The collapsible sub-tree uses the
native `<details>/<summary>` element, which the platform already exposes with `aria-expanded` and
Enter/Space activation. There is no `role="menu"` or `role="menuitem"` in this component (those roles
carry a specific interaction contract — arrow-key roving focus — that is inappropriate for page navigation
where Tab is the correct traversal mode). This mirrors the APG Disclosure Navigation example's deliberate
choice to use landmarks + links + disclosure buttons rather than a menu widget.

### 4.a Roles + ARIA

| element | role | ARIA attributes | when |
|---|---|---|---|
| `<nav>` | `navigation` landmark (implicit from element) | `aria-label="${label}"` | always; the label distinguishes multiple nav landmarks on the same page |
| collapse/expand `<button>` in header bar | `button` (implicit from element) | `aria-expanded="${collapsed ? 'false' : 'true'}"` `aria-controls="${navId}"` `aria-label="${triggerLabel}"` | always; `aria-expanded` reflects the current `data-state` and is kept in sync by the enhancer |
| rail `<button>` | `button` (implicit from element) | `aria-label="${label}"` `tabindex="-1"` `title="${label}"` | when rail sub-partial is composed; `tabindex="-1"` keeps it out of the tab order (mouse-only affordance) |
| `<a href>` nav item (leaf) | `link` (implicit from element) | `aria-current="page"` (when `active=true`) `aria-disabled="true"` + `tabindex="-1"` (when `disabled=true`) | leaf items only; `aria-disabled` compensates for the lack of native disabled on `<a>` |
| parent item `<details>` | (no ARIA role; native element) | native `open` attribute drives AT | when `content` is non-null; the platform handles `aria-expanded` on the `<summary>` |
| parent item `<summary>` | `button` (browser-mapped from `<summary>` inside `<details>`) | `aria-current="page"` (when active) `aria-disabled="true"` (when disabled) | parent items only |
| group heading `<div>` | (no role; labelling only) | `id="lv-sidebar-group-{slug}"` | when group `label` is non-empty; used as `aria-labelledby` target |
| group `<ul>` | `list` (implicit from element) | `aria-labelledby="lv-sidebar-group-{slug}"` (when group has label) | always |
| `<li>` menu item wrapper | `listitem` (implicit from element) | none | always |
| mobile backdrop `<button>` | `button` | `aria-hidden="true"` `tabindex="-1"` | always; it is a cosmetic dismissal surface, not a meaningful action |
| sub-item `<ul>` | `list` (implicit from element) | none | inside a parent `<details>` |
| menu-action `<button>` (default) | `button` (implicit) | `aria-label="${label}"` | when menu-action rendered without `content` slot |
| group-action `<button>` (default) | `button` (implicit) | `aria-label="${label}"` | when group-action rendered without `content` slot |
| inset `<main>` | `main` landmark (implicit from element) | none | `sidebar.inset` partial |

### 4.b Keyboard interaction map

The keyboard contract for the sidebar follows the APG Disclosure Navigation model: Tab navigates the
elements in document order; there is no roving-tabindex / arrow-key widget. The nav item links and the
disclosure buttons remain in the natural tab sequence. The `collection-nav` enhancer is NOT composed here
(that enhancer is for menu/listbox widgets, not `<nav>` + `<a>` navigation landmarks).

| Key | Element in focus | Action | Who supplies it |
|---|---|---|---|
| `Tab` | anywhere in the sidebar | move focus to the next focusable element in document order (links, group-action buttons, menu-action buttons, trigger, sub-item links) | platform |
| `Shift+Tab` | anywhere in the sidebar | move focus to the previous focusable element | platform |
| `Enter` or `Space` | collapse/expand trigger `<button>` | toggle sidebar collapsed/expanded (desktop) or open/close off-canvas overlay (mobile) | platform (native `<button>`); state mutation by the enhancer |
| `Enter` | `<a>` nav item (leaf) | navigate to `href` | platform (native `<a>`) |
| `Enter` or `Space` | parent item `<summary>` | toggle the `<details>` open/closed, revealing or hiding the sub-item list | platform (native `<details>/<summary>`) |
| `Escape` | anywhere within the sidebar when `data-mobile-open` is set | close the mobile off-canvas overlay; return focus to the element that opened it (or the trigger if the opener is unknown) | enhancer (`sidebar.enhancer.ts` `keydown` listener on the root) |
| `Cmd+B` / `Ctrl+B` | anywhere on the document | toggle sidebar: off-canvas open/close on mobile, collapsed/expanded + localStorage persist on desktop | enhancer (document-level `keydown` listener, same as shadcn's `SIDEBAR_KEYBOARD_SHORTCUT`) |
| `Enter` or `Space` | rail `<button>` (when reachable via mouse / script focus) | toggle collapsed/expanded; same lever as the trigger | platform (native `<button>`); BUT: `tabindex="-1"` keeps the rail out of the normal tab sequence; it is a mouse-only affordance |
| `Enter` or `Space` | menu-action `<button>` | fires whatever is wired on the action (caller's concern; the sidebar defines only the affordance, not the action it executes) | platform (native `<button>`) |
| `Enter` or `Space` | group-action `<button>` | same as menu-action | platform (native `<button>`) |

**Optional arrow-key navigation (APG note):** The APG Disclosure Navigation example notes that arrow-key
navigation between buttons and links within the `<nav>` is OPTIONAL supplemental behaviour. This spec
does NOT require it and the enhancer does NOT implement it. The natural Tab sequence is the required
keyboard path, consistent with treating the nav as a landmark with real links rather than a menu widget.

### 4.c Focus management

**Initial focus (mobile open):** when the enhancer opens the mobile off-canvas overlay, focus moves to
the first focusable element inside the nav (`data-slot="sidebar-menu-button"` — the first nav item link
or the collapse trigger if no items are present). The enhancer records the element that had focus when
the overlay opened (`document.activeElement` stored on the root as `_lvReturnFocus`).

**Focus return (mobile close):** when the mobile overlay closes (backdrop click, Escape, or programmatic
close), focus returns to the element that opened it (`_lvReturnFocus`), falling back to the header trigger
if that element is unavailable or has left the DOM.

**No focus trap:** the sidebar is NOT a modal dialog. It is a navigation landmark. Focus is not trapped;
users may Tab out of the sidebar and into the main content freely. The `focus-trap` enhancer is NOT
composed here (contrast with the `dialog` component which IS modal). On mobile the off-canvas overlay is
visually full-screen but semantically non-modal — the rest of the document remains tabbable, which is
correct for a navigation region.

**Collapsed rail:** when collapsed on desktop, the labels and badges are hidden via CSS. The `<a>` links
and action buttons remain in the tab order with their icon as the only visual cue. Every item SHOULD have
an icon so it retains a visual identity in collapsed mode; the `aria-label` of the `<a>` is the `label`
text (the link's accessible name comes from its text content, which remains in the DOM but is visually
hidden via `lv-sidebar-collapsible` CSS — `display: none` — so AT still reads it from the DOM text).

**The header trigger is always present:** the trigger MUST NOT be gated on the `header` content slot.
Gating it on `header != null` would leave a `header=null` sidebar with no keyboard path to collapse on
desktop and no way to open the overlay on mobile. The header bar (`data-slot="sidebar-header"`) always
renders; it shows only the trigger when `header` is null.

### 4.d Live regions

None. The sidebar is a navigation landmark, not a status or alert announcer. Badge counts (e.g. "3 new
items") are visible text inside the landmark; AT reads them as part of the link label. If a badge updates
dynamically after the page loads and must be announced, the caller should add `aria-live="polite"` on the
specific badge element — this is outside the sidebar contract.

### 4.e Shared mechanisms composed

The sidebar composes NONE of the three shared overlay mechanisms:
- The **popover seam** is NOT used (the sidebar is a docked landmark, not a positioned overlay).
- The **focus-trap** enhancer is NOT used (the sidebar is non-modal).
- The **collection-nav** enhancer is NOT used (navigation uses Tab, not arrow-key roving).

This is deliberate and correct: the sidebar is one of the simplest a11y patterns in the library despite
its visual complexity. Its keyboard model is entirely platform-supplied (native `<a>`, `<details>`, and
`<button>` elements), plus two enhancer-supplied behaviours (Escape on mobile, Cmd/Ctrl+B shortcut) that
are not covered by any shared mechanism.

---

## 5. Design tokens

### 5.a Tokens consumed (reads only)

**Colour (OKLCH source-of-truth format per `00` §4):**

| token | used for |
|---|---|
| `--lv-color-sidebar` | nav background |
| `--lv-color-sidebar-fg` | nav text and icon colour |
| `--lv-color-sidebar-border` | border on the docked edge; group-label separator; sub-item indent line |
| `--lv-color-sidebar-accent` | hovered / active item background |
| `--lv-color-sidebar-accent-fg` | hovered / active item text |
| `--lv-color-overlay` | mobile backdrop background (semi-transparent) |
| `--lv-color-muted` | group heading label text (uppercase section label) |
| `--lv-color-bg` | inset `<main>` background (`sidebar.inset`) |

**Spacing:**

| token | used for |
|---|---|
| `--lv-space-1` | group-label top/bottom padding; sub-item vertical gap; small action padding |
| `--lv-space-2` | header bar gap; trigger padding; content padding; item gap; badge horizontal padding; rail width; group-action right offset |
| `--lv-space-3` | header bar padding; footer padding; content vertical padding |
| `--lv-space-4` | sub-item indent (border-left + padding-left) |

**Typography:**

| token | used for |
|---|---|
| `--lv-font-sans` | root font-family |
| `--lv-text-sm` | root font-size for item labels |
| `--lv-text-xs` | group heading label; badge text |

**Radii:**

| token | used for |
|---|---|
| `--lv-radius-md` | item hover/focus background; trigger hover |
| `--lv-radius-sm` | menu-action and group-action button corners |
| `--lv-radius-lg` | floating/inset variant rail card |
| `--lv-radius-full` | badge pill |

**Shadows / elevation:**

| token | used for |
|---|---|
| `--lv-shadow-sm` | floating and inset variant rail card shadow |
| `--lv-shadow-lg` | mobile off-canvas nav shadow |

**Z-index:**

| token | used for |
|---|---|
| `--lv-z-modal` | mobile backdrop and nav overlay z-index (uses `--lv-z-modal` + 1 for the nav, placing it above the backdrop) |

**Interaction:**

| token | used for |
|---|---|
| `--lv-ring` | focus-visible outline on trigger, item links, and action buttons |

**Motion:**

| token | used for |
|---|---|
| (implied from `0.2s ease` in the enhancer) | width transition (collapse) and mobile slide-in/out. Motion tokens from the token system apply if adopter overrides the base transition duration. |

### 5.b Sidebar-specific tokens (NET-NEW, additive)

The existing `--lv-*` token set contains the general colour vocabulary but not sidebar-specific
semantic colour tokens. These are NET-NEW additive tokens required for the sidebar to be independently
themeable without the adopter having to override multiple primitive tokens:

| token | light default (OKLCH) | dark default (OKLCH) | meaning |
|---|---|---|---|
| `--lv-color-sidebar` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` | nav panel background (near-white / near-black) |
| `--lv-color-sidebar-fg` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | nav text and icon foreground |
| `--lv-color-sidebar-border` | `oklch(0.88 0 0)` | `oklch(0.22 0 0)` | docked-edge border; group lines |
| `--lv-color-sidebar-accent` | `oklch(0.94 0 0)` | `oklch(0.22 0 0)` | item hover / active background |
| `--lv-color-sidebar-accent-fg` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | item hover / active foreground |

Two structural tokens for the sidebar width that consuming layouts need:

| token | value | meaning |
|---|---|---|
| `--lv-w-sidebar` | `16rem` | expanded sidebar width |
| `--lv-w-sidebar-collapsed` | `3.25rem` | collapsed icon-rail width |

All five colour tokens go in BOTH `:root` and `.dark, [data-theme="dark"]` blocks in
`registry/tokens/lievit-tokens.css`. The two width tokens are structural (theme-invariant). No new
dark-mode rule is added for structural tokens. The rebrand surface grows by exactly 5 colour tokens
(justified: a sidebar is commonly the most distinctly themed surface in an admin panel — Filament,
shadcn, and Ant Design all give it a dedicated colour palette precisely because adopters expect to
override it independently from the page surface).

---

## 6. Wire / island integration

The sidebar is PARTIAL + ENH: no wire round-trip, no `@Wire` fields, no `@LievitAction` methods.

### 6.a Server-rendered JTE structure (the nav projection)

The composing template (e.g. `shell.jte` / `kit/page.jte`) receives a typed `List<NavGroup>` (or
equivalent) from the controller, iterates it, and builds the `content` slot by calling the sub-partials:

```
@template.lievit.sidebar(
  label = "Primary",
  header = @`...logo + app-name...`,
  footer = @`...user chip...`,
  content = @`
    @for(var g : navGroups)
      @template.lievit.sidebar.group(
        label = g.label(),
        action = @`@template.lievit.sidebar.group-action(label = "New " + g.label())`,
        content = @`
          @for(var item : g.items())
            @template.lievit.sidebar.item(
              key    = item.key(),
              label  = item.label(),
              href   = item.href(),
              icon   = item.icon(),
              badge  = item.badge() != null ? String.valueOf(item.badge()) : "",
              active = item.key().equals(activeNav)
            )
          @endfor
        `
      )
    @endfor
  `
)
```

No data (option lists, labels, URLs, badge counts) is hardcoded in the partials. Every piece arrives via
typed `@param`. The `active` flag per item is a server-resolved boolean (the controller knows the current
route); it never flows from the client.

The rail is an opt-in sub-partial placed inside the sidebar's content (before the closing nav tag):

```
@template.lievit.sidebar(content = @`
  ...groups...
  @template.lievit.sidebar.rail()
`)
```

The rail partial renders a `<button tabindex="-1" data-slot="sidebar-rail">` that the enhancer binds.

### 6.b The typed-TS enhancer (`sidebar.enhancer.ts`)

The enhancer adds the three behaviours the server cannot supply:

**1. Desktop collapse toggle (+ localStorage persistence):**
- Binds a `click` listener on the header trigger (`[data-slot="sidebar-trigger"]`) and the rail button
  (`[data-slot="sidebar-rail"]`) to `toggleSidebar(root)`.
- `toggleSidebar` on desktop: reads `data-state`, flips it, writes the new state back to `data-state`,
  mirrors it on `aria-expanded` of the trigger, persists to `localStorage[data-storage-key]`.
- On hydration (`enhanceSidebar(root)` called at page load), the enhancer reads the persisted value from
  `localStorage` and applies it to `data-state` + the trigger's `aria-expanded`, overriding the SSR hint.

**2. Mobile off-canvas overlay (+ Escape dismiss):**
- `toggleSidebar` on mobile (below the `MOBILE_MAX` = 768px breakpoint): sets/removes `data-mobile-open`
  on the root instead of changing `data-state`.
- On open: stores `document.activeElement` as `_lvReturnFocus` on the root; moves focus into the nav
  (first `[data-slot="sidebar-menu-button"]`).
- On close (backdrop click or Escape): removes `data-mobile-open`; restores focus to `_lvReturnFocus` or
  falls back to the trigger.
- Escape key: a `keydown` listener on the root checks `data-mobile-open` and calls `closeMobile(root)`.
- Backdrop click: a `click` listener on `[data-sidebar="backdrop"]` calls `closeMobile(root)`.

**3. Cmd/Ctrl+B keyboard shortcut:**
- A document-level `keydown` listener checks `(e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")`.
- Calls `toggleSidebar(root)` (delegates to mobile or desktop path based on breakpoint).
- The listener is registered once per root; the `ENHANCED` marker prevents duplicate registration on
  re-runs (the idempotency invariant: `enhanceSidebar(root)` is a no-op if the root already has
  `data-sidebar-enhanced`).

**4. Stateful stylesheet injection:**
- `ensureStyles()` injects a `<style id="lv-sidebar-styles">` once per document (idempotent).
- The stylesheet contains all `data-state` and `@media` rules that cannot be expressed as inline styles:
  collapsed width, hidden `.lv-sidebar-collapsible` elements, mobile fixed-position slide-in, variant
  visual rules, hover/focus-visible states, `showOnHover` reveal rules, and the inset sibling selector.
- Injecting a stylesheet tag (not an inline `style=` handler) is CSP-compliant: `script-src: 'self'`
  does not restrict stylesheet injection; it restricts script execution.

**Directive bindings:** the enhancer does NOT use the lievit runtime's directive registry (no `l:*`
attributes). It binds listeners imperatively in `enhanceSidebar(root)` using `addEventListener`. This is
appropriate because the sidebar has no wire component and no server round-trip; the enhancer owns the full
interaction lifecycle without needing to coordinate with the wire protocol.

**API surface:**
- `enhanceSidebar(root: HTMLElement): void` — enhance one `[data-sidebar="root"]` element. No-op if
  already enhanced.
- `enhanceAllSidebars(scope: ParentNode = document): void` — enhance every root in scope. Called on
  page load + after DOM swaps (Turbo Drive navigation restores the page; the runtime's post-morph hook
  calls this to re-enhance any new sidebar instances in the morphed DOM).

---

## 7. Acceptance tests (the gate — refute-by-default)

A test is "done" only when it runs on a **real substrate** — the lesson the client-island-fidelity
section of the repo contract encodes. No mocked `$lievit`, no mocked enhancer, no fake DOM. Every test
below names what it ASSERTS, not just what it exercises.

### 7.a Rendered nav contract (jsdom, real DOM shaped like the partial output)

- **nav landmark present:** a `renderSidebar()` helper builds a DOM that matches the partial's server
  output exactly; asserts `<nav aria-label="Primary">` is present.
- **items are real `<a href>`:** asserts `a[data-slot="sidebar-menu-button"]` elements have `tagName="A"`
  and a real `href` attribute — NOT `<button>` elements (the nav navigates, it does not post).
- **active item carries `aria-current="page"`:** renders with `active="users"`, asserts the Users link
  has `aria-current="page"` and no other link does.
- **disabled item is `aria-disabled` + out of tab order:** the Logs `<a>` has `aria-disabled="true"` and
  `tabindex="-1"`.
- **group renders heading + labelled `<ul>`:** the `<div data-slot="sidebar-group-label">` has the text
  "Platform"; the `<ul data-slot="sidebar-menu">` has `aria-labelledby="lv-sidebar-group-platform"`.
- **parent item discloses sub-tree via `<details>`:** `<details data-sidebar="disclosure">` is present;
  its `<ul data-slot="sidebar-menu-sub">` has the correct child `<a>` links with real `href` values.
- **badge renders for items that declare one:** the Users link's text includes "3".
- **header bar always renders (trigger always present):** a sidebar rendered with `header=null` still has
  `[data-slot="sidebar-trigger"]`; the trigger's `aria-controls` points to the nav id.
- **inset variant pairs with a `<main>` landmark:** `renderSidebar({ variant: "inset" })` produces a
  `<main data-slot="sidebar-inset">` sibling; it is a real `<main>` element.
- **menu-action carries its accessible name + `showOnHover` reveal class:** a menu-action with
  `showOnHover=true` has `lv-sidebar-action-hover`; one without does not.
- **group-action carries its accessible name:** a group-action has `aria-label` matching the `label` param.

### 7.b axe-core (real DOM, `@axe-core/react` or `axe-core` directly on jsdom)

- **Zero axe violations on a fully rendered sidebar:** run `axe(root)` on the `renderSidebar()` output
  with a representative nav (groups, active item, disabled item, parent item, badges). Assert
  `violations.length === 0`. Rules that must pass include:
  - `landmark-one-main` / `landmark-unique` (the `<nav>` has a unique `aria-label`)
  - `link-name` (every `<a>` has an accessible name from its text content)
  - `button-name` (trigger, rail, menu-action, group-action all have accessible names)
  - `aria-valid-attr-value` (`aria-current="page"` is valid)
  - `aria-allowed-attr` (`aria-disabled` on `<a>` is valid)
- **Icon-only items (no label text) would fail `link-name`:** this is the expected failure — it surfaces
  that leaf items without labels MUST have visible text or a separate `aria-label`. The spec requires
  a text label via `label` param; the axe test confirms items with a blank label produce a violation.

### 7.c Enhancer: collapse state (real DOM + real enhancer)

- **Trigger click toggles `data-state` + `aria-expanded`:** start expanded, click trigger, assert
  `data-state="collapsed"` + `aria-expanded="false"`; click again, assert `data-state="expanded"` +
  `aria-expanded="true"`.
- **Desktop collapse persists to `localStorage` and rehydrates:** collapse via trigger → assert
  `localStorage.getItem("lv-sidebar-state") === "collapsed"`. Re-render a fresh DOM (SSR says expanded)
  → call `enhanceSidebar(fresh)` → assert `data-state="collapsed"` (the persisted choice wins).
- **Rail click toggles the same state as the trigger:** assert `data-state` changes on rail click; assert
  the trigger's `aria-expanded` mirrors the rail-driven change.
- **Rail is `tabindex="-1"` (mouse-only):** assert `rail.getAttribute("tabindex") === "-1"`.
- **Cmd/Ctrl+B toggles:** dispatch `KeyboardEvent("keydown", { key: "b", metaKey: true })` → assert
  `data-state="collapsed"`; dispatch with `ctrlKey` → assert expanded again. A plain "b" (no modifier)
  must NOT toggle.
- **Idempotency (the double-fire guard):** call `enhanceSidebar(root)` twice; click the trigger once;
  assert `data-state` changed exactly once (collapsed, not expanded again). Same for rail click and
  Cmd/Ctrl+B. Same via `enhanceAllSidebars()` called twice over two roots.
- **Stylesheet injected once:** call `enhanceSidebar(root)` twice; assert
  `document.querySelectorAll("#lv-sidebar-styles").length === 1`.
- **`enhanceAllSidebars` wires every root in scope:** two roots on the page, one call → both respond to
  trigger clicks.

### 7.d Enhancer: mobile off-canvas (real DOM + real enhancer + `matchMedia` stub)

- **Trigger click opens the overlay at mobile breakpoint:** stub `matchMedia` to return `true` for
  `(max-width: 768px)`; click the trigger; assert `data-mobile-open` is set on the root; assert focus
  is inside the nav (`document.activeElement` is `[data-slot="sidebar-menu-button"]`).
- **Backdrop click closes the overlay + restores focus:** open, then click the backdrop `<button>`; assert
  `data-mobile-open` is removed; assert focus returned to the element that triggered open.
- **Escape closes the overlay + restores focus:** open, dispatch `KeyboardEvent("keydown", { key: "Escape" })`
  on the root; assert `data-mobile-open` is removed + focus returned.
- **Mobile `data-state="collapsed"` is ignored:** on mobile, the sidebar always renders at full width
  when `data-mobile-open` is set; assert that the stylesheet's `data-state` collapsed width rule is
  overridden by the mobile media query (a CSS rule, not an enhancer assertion — document it as a manual
  visual test or Playwright assertion).

### 7.e Keyboard (real DOM, Tab order + platform behaviour)

- **Tab order is linear through the nav:** render a sidebar with two groups and three items; assert that
  `Tab` through the sidebar visits: trigger → (group-action if present) → item-1 link → (menu-action if
  present) → item-2 link → … in document order. No element with `tabindex="-1"` (rail, disabled items,
  backdrop) appears in the sequence.
- **Disabled item is skipped by Tab:** assert a disabled `<a tabindex="-1">` is NOT reachable by
  `document.activeElement` cycling via Tab.
- **`<details>` sub-tree expand/collapse (platform):** assert that a `<summary>` element responds to
  Enter/Space by toggling the `<details open>` attribute — this is platform behaviour, but the test
  confirms the correct element is used.

### 7.f Variants + data-* attributes (real DOM)

- **Each variant reflects correctly on `data-variant`:** render `sidebar`, `none`, `floating`, `inset`
  variants; assert `root.getAttribute("data-variant")` matches in each case.
- **`collapsed=true` SSR hint sets `data-state="collapsed"` and `aria-expanded="false"`** before the
  enhancer runs; assert both attributes on the rendered DOM.

### 7.g JTE compile + render gate

- **All seven partials compile without error:** the `test/jte-compile` real-compiler smoke asserts zero
  compilation errors on `sidebar.jte`, `sidebar/group.jte`, `sidebar/item.jte`, `sidebar/rail.jte`,
  `sidebar/inset.jte`, `sidebar/menu-action.jte`, `sidebar/group-action.jte`.
- **Source contract assertions (the `describe("sidebar partials: source contract")` block):**
  - `<nav aria-label="${label}">` is present in `sidebar.jte` (landmark, not a custom element).
  - `<a href="${href}">` and `aria-current="${active ? "page" : null}"` in `sidebar/item.jte`.
  - `<details>` + `<summary>` in `sidebar/item.jte` (the sub-tree disclosure is native).
  - No `<slot>` in any of the seven partials (the silent-slot bug class).
  - No `<script>` and no inline `on*=` handlers in any partial (strict-CSP contract).
  - No bare hex colour literals in any partial (token-driven assertion).
  - Icons go through `@template.lievit.icon(name = ...)`, no raw inline `<svg>`.
  - `@param gg.jte.Content content` present in `sidebar.jte`, `sidebar/group.jte`, `sidebar/item.jte`,
    `sidebar/inset.jte`.
  - `data-variant="${resolvedVariant}"` in `sidebar.jte` + all four variant strings gated in the source.

### 7.h Playwright (gesture fidelity, legacy-VM oracle)

- **A real click on the trigger collapses/expands the sidebar:** `page.click('[data-slot="sidebar-trigger"]')`,
  assert the nav width has changed (CSS `data-state` transition has fired); assert the trigger's
  `aria-expanded` value matches the new state.
- **A real click on a nav item navigates:** `page.click('[data-slot="sidebar-menu-button"][href="/users"]')`,
  assert `page.url()` ends with `/users`.
- **`<details>` sub-tree opens with a real click on `<summary>`:** `page.click('summary')`, assert the
  sub-item links become visible.
- **Cmd+B keyboard shortcut toggles from the keyboard:** `page.keyboard.press("Meta+b")`, assert collapse
  state changed.
- **`aria-current="page"` matches the current URL after navigation:** navigate to `/users`, assert the
  "Users" `<a>` has `aria-current="page"` (this is a server-rendered assertion — it validates the
  controller correctly sets `active` on the returned nav items, not just the partial itself).

---

## 8. Non-goals / anti-patterns

- **No `role="menu"` / `role="menuitem"` on nav items.** The sidebar is a navigation landmark with
  real `<a href>` links, not a menu widget. A menu widget requires arrow-key roving focus (via
  `collection-nav`) and implies a list of actions, not page navigation. Using menu roles here would be
  both semantically wrong and a keyboard UX anti-pattern (Tab is the correct traversal mode for a nav).
- **No WIRE / no server round-trip for the collapse state.** The collapse choice is pure client cosmetic.
  Round-tripping it to the server adds latency for zero benefit. The persisted `localStorage` choice is
  the correct mechanism — same as shadcn, same as every major admin framework.
- **No client-side rendering of nav items.** The nav items are real server-rendered HTML on every request.
  A JS-off user gets a fully functional navigation landmark. The enhancer adds collapse behaviour, not
  navigation capability.
- **No hardcoded data in any partial.** Group labels, item labels, href values, badge counts, and icon
  names MUST arrive via typed `@param` from the controller's model, never hardcoded in the JTE. This is
  the "no data in a partial" rule from the repo CLAUDE.md.
- **No `<slot>` elements.** Content flows through `gg.jte.Content` params only. `<slot>` is a
  web-components primitive; lievit's server-first partials use the JTE Content mechanism (the silent-slot
  bug the whole pivot killed).
- **No inline `<script>` or `on*=` handlers in any partial.** The strict CSP (`script-src: 'self'`)
  refuses them silently. All JS is in `sidebar.enhancer.ts`, loaded as a module, bound imperatively.
- **No raw inline `<svg>` for icons.** Icons go through `@template.lievit.icon(name = ..., size = ...)`
  (the Lucide partial). An inline SVG bypasses the icon system, breaks the token-driven sizing, and is
  harder to maintain.
- **No literal colour values in any partial.** All colours are `var(--lv-*)` tokens, including the
  NET-NEW `--lv-color-sidebar-*` tokens. A literal `#1e293b` in a partial is the anti-pattern the CI
  token-lint gate catches.
- **No focus trap.** The sidebar is a navigation landmark, not a modal overlay. Trapping focus in the
  sidebar — even on mobile — would prevent users from reaching the page content via keyboard, which is a
  serious a11y violation.
- **The rail does NOT replace the header trigger as a keyboard path.** The rail is `tabindex="-1"` (mouse-
  only). The header trigger is the ONLY keyboard-reachable collapse control. If a design requires a
  keyboard-reachable rail (e.g. for an extremely narrow sidebar with no header), add a visible trigger
  button inside the content; do NOT make the rail `tabindex="0"` (that would create a redundant tab stop
  with no benefit over the existing trigger).
- **The `sidebar.inset` partial is NOT optional when `variant="inset"`** (functionally optional in markup,
  but the inset visual treatment — the floating-card look on the content area — only applies with the
  `<main data-slot="sidebar-inset">` sibling in the DOM). Omitting it when using `variant="inset"` gives
  a floating sidebar with a flush non-floating content area, which is a visual inconsistency. Document
  this as a usage prerequisite, not a hard error.
- **Do NOT persist the mobile off-canvas state.** Mobile open/close is transient (the user opens the
  overlay to navigate, then closes it). Persisting it to `localStorage` would leave the overlay open on
  the next page load — the opposite of useful.

---

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read shadcn Sidebar, Ant Design Menu (inline/side
modes), and Tailwind UI sidebar navigation as references for PATTERN (anatomy, variants, feature inventory)
and LOOK (token values, spacing, rounded-card variant). You MUST NOT paste literal source from ANY of them
(no shadcn / ant-design / tailwind-ui class strings or template markup) — the output is always original
generation. (The one bright line, `02-licensing.md`.)

Mirror `button.jte`'s house conventions exactly across all seven partials: header doc-comment (Apache
block + `<%-- --%>` block) with TIER / STRUCTURE / A11y / Params / Usage sections; typed `@param` with
defaults; `data-slot` on every meaningful element; zero `<script>`; zero inline `on*=`; the two escaping
channels (`attrs` trusted-raw for static author strings, `dataAttrs`/`wireArgs` escaped for dynamic
per-row values — not applicable on most sidebar params but menu-action's `wireArgs` follows the button
pattern if the caller needs a per-row wire action).

The **header trigger is non-negotiable**: it renders in the header bar WITH OR WITHOUT the `header`
content slot. Do not gate it on `header != null` (this is the trigger-decoupling fix encoded in the
existing partial's comment — preserve it). The assertion `test("header bar always renders")` in §7.a
will catch a regression.

The **`ENHANCED` marker** (`data-sidebar-enhanced`) must be checked FIRST in `enhanceSidebar(root)` and
the function must return immediately if set. This prevents the double-listener stacking bug (listener
stacking = one click fires toggle twice = back to where it started = the bug the idempotency tests in
§7.c catch). The Cmd/Ctrl+B document-level listener MUST be registered only once per root, inside the
`if (root.hasAttribute(ENHANCED)) return;` guard.

The **stateful CSS** (collapse width, mobile slide-in, `data-state` selectors, `showOnHover` reveal) lives
in the injected `<style>` tag, NOT in inline `style=` attributes on the elements. Inline style attributes
cannot target pseudo-classes or `data-*` attribute selectors; the injected sheet can. This is the same
pattern the existing `sidebar.enhancer.ts` uses and the token-lint gate validates.

The NET-NEW sidebar colour tokens (`--lv-color-sidebar-*`) and the two width tokens must be added to
`registry/tokens/lievit-tokens.css` in BOTH the `:root` block (light defaults in OKLCH) and the
`.dark, [data-theme="dark"]` re-point block before the partial references them. A `var(--lv-color-sidebar)`
that resolves to the empty string (token not declared) renders transparently on all backgrounds — the
compile gate will not catch this; the visual smoke test will. Add the tokens first.

Minimal code to GREEN against the acceptance tests; refactor only while green. The keyboard map is
the contract — the Tab order, the Escape dismiss on mobile, and the Cmd/Ctrl+B shortcut are the three
key assertions; all must pass before the component is "done".
