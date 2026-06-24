<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — navigation-menu

- **tier**: WIRE + ENH (`collection-nav.enhancer.ts` — optional arrow-key navigation + Esc dismiss)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/navigation-menu.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG **Disclosure Navigation** pattern
      (`https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/`) —
      the authoritative reference for a `<nav>` of disclosure-button triggers + panel regions;
      the pattern explicitly does NOT use `role=menu`/`role=menubar` (those are for application-widget
      menus, not site navigation); `collection-nav.enhancer.ts` supplies the OPTIONAL arrow-key
      supplemental navigation (Tab-primary per APG, arrow-key supplemental per same), matching
      the react-aria navigation interaction model as cross-reference; no react-aria source copied
    - inventory: Ant Design Menu (mode=horizontal + SubMenu rich panels) as inventory reference
      for variant surface (horizontal / vertical / icon-only labels / badge decoration / item groups
      inside panels); shadcn/ui NavigationMenu as styling inspiration for the rich flyout panel look
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI /
      shadcn NavigationMenu (NO code copied)

---

## 1. What it is

A navigation menu is the primary wayfinding control of a page or application shell: a `<nav>` landmark
containing a horizontal (or vertical) list of top-level items, where items that have children reveal a
rich **panel** (a full-width or positioned flyout containing links, grouped links, descriptions, or any
arbitrary content) via a `<button aria-expanded aria-controls>` disclosure trigger.

**When to use**: application sidebars (vertical), admin topbar wayfinding (horizontal), docs site
top nav with rich category panels. The component owns the disclosure open/close state (`@Wire boolean`)
per top-level item; the LINKS inside a panel are plain `<a>` elements and carry no additional role.

**Decision rule for WIRE**: the open-state of each flyout panel is server-state (the server knows
which panel is open, can restrict panels by role, and re-renders the panel content on demand). This
is the same argument as the sidebar and the select: the truth lives server-side. The one irreducible
CLIENT behavior — optional arrow-key roving among triggers + Esc to close — is the shared
`collection-nav.enhancer.ts`, used in a simpler mode than in a full listbox (no `aria-activedescendant`;
real DOM focus moves among `<button>` / `<a>` elements).

**Server-first works here because**: the panel body is OWNED server-rendered markup (links, badges,
descriptions all derive from the controller's route model). There is no client-side template; the
morph patches what the server renders. The disclosure pattern's "only two states" (open / closed per
item) map trivially to a `@Wire boolean` — exactly as the accordion does it.

---

## 2. API — the WIRE surface + template params

### Java (`NavigationMenuComponent`)

| member | kind | meaning |
|---|---|---|
| `items` `List<NavItem>` | `@Wire @LievitProperty(locked=true)` | the top-level item list (locked — a client cannot inject items); each `NavItem` carries `id`, `label`, `href` (null when has children), `icon` (optional Lucide name), `badge` (optional), `disabled` (boolean), `children` `List<NavItemGroup>` (empty = leaf link item) |
| `openItemId` `String` | `@Wire` | the id of the currently-open panel, or `null` when all closed |
| `orientation` `String` | `@Wire @LievitProperty(locked=true)` | `horizontal` \| `vertical` — layout axis; determines trigger row vs column + panel placement |
| `activeHref` `String` | `@Wire @LievitProperty(locked=true)` | the current page href; the template marks the matching leaf `<a>` with `aria-current="page"` |
| `collapsible` `boolean` | `@Wire @LievitProperty(locked=true)` | vertical only: top-level leaf items can be collapsed into icon-only labels (uses `sidebar` behaviour); default `false` |
| `toggle(String id)` | `@LievitAction` | opens the panel for item `id` if closed; closes if the same `id` is already open (accordion behaviour); validates `id` ∈ `items` (authz/validation in Java BEFORE mutate) |
| `closeAll()` | `@LievitAction` | sets `openItemId = null`; called by the Esc/backdrop handler |
| `openItemGroups()` | getter on `_instance` | returns the `List<NavItemGroup>` for the currently-open item, read by the panel template region |

#### `NavItem` value object (server-typed)

| field | type | meaning |
|---|---|---|
| `id` | `String` | stable unique id; also used as the panel element id (`panel-<id>`) |
| `label` | `String` | the visible text label |
| `href` | `String \| null` | if non-null, the item is a plain `<a>` leaf link; if null, it is a disclosure trigger |
| `icon` | `String \| null` | Lucide icon name (optional; the template composes `@template.lievit.icon`) |
| `badge` | `String \| null` | optional badge text (e.g. "New", "3") |
| `disabled` | `boolean` | dims + blocks activation; `aria-disabled` on an `<a>`, `disabled` on `<button>` |
| `children` | `List<NavItemGroup>` | groups of child links inside the panel; non-empty triggers the disclosure behaviour |

#### `NavItemGroup` value object

| field | type | meaning |
|---|---|---|
| `label` | `String \| null` | optional visible group heading inside the panel |
| `links` | `List<NavLink>` | the links in this group |

#### `NavLink` value object

| field | type | meaning |
|---|---|---|
| `label` | `String` | visible link text |
| `href` | `String` | the `<a href>` |
| `description` | `String \| null` | optional sub-description rendered beneath the label (the "rich panel" look) |
| `icon` | `String \| null` | optional Lucide icon name |
| `badge` | `String \| null` | optional badge |
| `disabled` | `boolean` | `aria-disabled` + no href |

### Template params

One `@param` per `@Wire` field, plus `@param ComponentMetadata _component` and
`@param NavigationMenuComponent _instance` (for `openItemGroups()`). No `Content` slot (WIRE has none —
server-first refactor blueprint §1.b: the panel body is OWNED template markup, not a slot).

### PARTIAL escape-hatch: `navigation-menu-static`

For a navigation bar whose items are compile-time-static (CMS-driven docs nav, no role-based
panel gating, no open-state server round-trip), a companion PARTIAL `navigation-menu-static.jte` is
also specified. Its API is a pure `@param` surface — no `@Wire`, no round-trip, no Java component.
The disclosure open/close is purely client-side, driven by the `collection-nav` enhancer writing
`aria-expanded` locally (no server state). This is the correct tier for a static nav: PARTIAL + ENH.

PARTIAL params (only the subset relevant to static use):

| param | type | default | meaning |
|---|---|---|---|
| `items` | `List<NavItem>` | — | same `NavItem` shape (locked by template structure, not by `@LievitProperty`) |
| `orientation` | `String` | `"horizontal"` | `horizontal` \| `vertical` |
| `activeHref` | `String` | `""` | current page href for `aria-current="page"` marking |
| `cssClass` | `String` | `""` | extra utility classes on the `<nav>` root |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed attributes only |

---

## 3. Variants / sizes / states

### Variants (orientation-based)

| variant | what | notes |
|---|---|---|
| `horizontal` | triggers in a row; panels open BELOW the trigger row as positioned popover regions | default for topbar / header nav |
| `vertical` | triggers stacked in a column; children expand inline (accordion-style) pushing content down, NOT as overlays | default for sidebar nav |

Within the horizontal variant, the panel can render as:

| panel style | trigger | notes |
|---|---|---|
| full-width (mega-menu) | `panelFull=true` on the NavItem | the panel stretches the full container width; link groups side by side |
| positioned (dropdown-like) | `panelFull=false` (default) | the panel is anchored to its trigger via the popover seam (CSS Anchor Positioning fallback) |

### Item-level variants

| item type | trigger element | rendered when |
|---|---|---|
| leaf link | `<a href>` | `NavItem.href` non-null (no children) |
| disclosure trigger | `<button>` | `NavItem.children` non-empty |
| separator | `<li role="separator">` | `NavItem` is a sentinel separator value |

### Sizes

| size | token | use |
|---|---|---|
| `sm` | `--lv-space-8` (32 px) height | compact topbar (sub-nav) |
| `md` | `--lv-space-9` (36 px) height | default |
| `lg` | `--lv-space-10` (40 px) height | prominent app header |

Height is toolbar-aligned (same scale as `button` / `input` of the same size — architecture contract §5.b).
The size controls trigger height; link group font size scales proportionally via `--lv-text-{sm,base}`.

### States

| state | ARIA | token effect | notes |
|---|---|---|---|
| panel closed (default) | `aria-expanded="false"` on trigger | trigger at rest | panel element is `hidden` |
| panel open | `aria-expanded="true"` on trigger | trigger accent underline / elevated bg | panel element visible |
| item active (current page) | `aria-current="page"` on the matching leaf `<a>` | accent underline / accent text | set via `activeHref` comparison |
| item disabled | `disabled` on `<button>`, `aria-disabled="true"` on `<a>` | `--lv-color-fg-muted` + cursor-not-allowed | no activation |
| wire round-trip in progress | `aria-busy="true"` on the root (runtime `beforeCall`) | optional spinner overlay (the runtime hook) | auto-cleared by `afterCall` |
| vertical + `collapsible` | icon-only triggers collapse to `--lv-space-8` width | sidebar-collapse alignment | same as sidebar component |

---

## 4. The a11y contract (the heart — non-negotiable, fully specified)

### WAI-ARIA pattern

**APG Disclosure Navigation** (`https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/`).

This pattern is intentionally NOT `role=menu` / `role=menubar`. Those roles describe APPLICATION-WIDGET
menus (toolbar File/Edit menus, context menus, select listboxes). A NAVIGATION menu is a landmark (`<nav>`)
containing real `<a>` links; it uses disclosure semantics (button + `aria-expanded` + `aria-controls`) on
triggers that open link panels. Screen readers treat them differently: a `role=menu` announces "menu" and
expects arrow-key navigation; a `<nav>` announces "navigation" and Tab-navigates to real links. The APG is
explicit on this distinction.

### Roles + ARIA attributes (every attribute the template emits)

| element | role / attribute | value | when |
|---|---|---|---|
| `<nav>` root | implicit landmark `navigation` | — | always |
| `<nav>` root | `aria-label` | the nav name (e.g. "Main navigation") | always; required for the landmark to be uniquely named when multiple navs are on the page |
| `<ul>` (trigger list) | `role="list"` (default for `<ul>`) | — | always |
| `<li>` (each item) | `role="listitem"` (default for `<li>`) | — | always |
| leaf `<a>` | no extra role | `href` always set | when `NavItem.href` non-null |
| leaf `<a>` (current page) | — | `aria-current="page"` | when `href == activeHref` |
| leaf `<a>` (disabled) | — | `aria-disabled="true"` + no `href` | when `NavItem.disabled` |
| disclosure `<button>` | no extra role (native button) | — | when `NavItem.children` non-empty |
| disclosure `<button>` | — | `aria-expanded="true"/"false"` | reflects `openItemId == item.id` |
| disclosure `<button>` | — | `aria-controls="panel-<id>"` | references the panel region |
| disclosure `<button>` (disabled) | — | `disabled` (native) | when `NavItem.disabled` |
| panel `<div>` / `<ul>` | `id="panel-<id>"` | — | always present on the panel element |
| panel `<div>` | — | `hidden` | when `openItemId != item.id` |
| group heading `<p>` / `<strong>` | `aria-hidden="false"` (informational, not a heading level) | — | when `NavItemGroup.label` present |
| separator `<li>` | `role="separator"` | — | sentinel item |
| panel link `<a>` | — | `aria-current="page"` | when link href matches `activeHref` |
| panel link `<a>` (disabled) | — | `aria-disabled="true"` + no `href` | when `NavLink.disabled` |
| badge `<span>` | `aria-hidden="true"` | — | decorative badge; badge text is NOT the accessible name; the link label provides it |
| icon `<svg>` | `aria-hidden="true"` | — | all icons here are decorative |
| chevron icon (on trigger) | `aria-hidden="true"` | — | visual affordance only; state conveyed by `aria-expanded` |

### Keyboard map (authoritative — matches APG Disclosure Navigation + optional arrow-key supplement)

| key | action | who |
|---|---|---|
| `Tab` | move focus forward among top-level triggers/links; when a panel is open, Tab continues INTO the panel links, then out the bottom | platform (Tab order follows DOM order; no trap) |
| `Shift+Tab` | move focus backward | platform |
| `Enter` / `Space` (on disclosure `<button>`) | toggle the panel open/closed (`toggle(id)` wire action) | platform (native `<button>` activates on Enter + Space) |
| `Enter` (on leaf `<a>`) | navigate to the href | platform (native link) |
| `Esc` (when a panel is open) | close all panels (`closeAll()` wire action) + return focus to the trigger that opened it | `collection-nav` enhancer (registers a `keydown` listener on the `<nav>`) |
| `ArrowRight` / `ArrowDown` (on a trigger/link in horizontal/vertical mode) | move focus to the next top-level trigger or leaf link (wraps); supplemental, does NOT replace Tab | `collection-nav` enhancer (optional, matches APG "optional arrow-key" note) |
| `ArrowLeft` / `ArrowUp` (on a trigger/link) | move focus to the previous top-level trigger or leaf link (wraps) | `collection-nav` enhancer (optional) |
| `ArrowDown` (on open horizontal panel trigger) | move focus to the first focusable link inside the open panel | `collection-nav` enhancer |
| `ArrowUp` (on last link in open panel) | return focus to the panel's trigger | `collection-nav` enhancer |
| `Home` | move to the first top-level trigger / leaf link | `collection-nav` enhancer (when wrapping not supported) |
| `End` | move to the last top-level trigger / leaf link | `collection-nav` enhancer (when wrapping not supported) |
| Printable character (a–z) | move to the next top-level trigger/link whose label starts with that character (type-ahead) | `collection-nav` enhancer |

**Important distinction from menubar**: arrow keys here are SUPPLEMENTAL (Tab is primary). The APG
Disclosure Navigation document states that arrow-key navigation is optional enhancement. An AT user
is expected to Tab through; the arrow-key layer is a power-user UX affordance, not a mandatory roving
`tabindex` regime. Therefore:
- All top-level triggers/links keep `tabindex="0"` (all in natural Tab order).
- The enhancer does NOT set `tabindex="-1"` on non-focused items (that is the menubar/listbox model, not the disclosure model).
- `aria-activedescendant` is NOT used; real DOM focus moves via arrow keys (simpler, correct for the pattern).

### Focus management

- **No focus trap**: panels are non-modal overlays (like a dropdown, not a dialog). Tab naturally exits.
- **Panel links in Tab order**: when a panel is open, its links are DOM-present with `tabindex="0"` (default)
  and `hidden` is removed; Tab reaches them naturally. When closed, `hidden` removes them from the Tab order.
- **Focus restore on Esc**: the enhancer records the trigger element that was focused when the panel opened;
  on `closeAll()` completion (post-morph), it returns focus to that trigger.
- **Focus restore on morph**: the runtime morph preserves node identity and uncontrolled focus state; the
  component does nothing special after a wire re-render — focus stays wherever it was.
- **Vertical (accordion-style)**: no positional overlay; opened children expand inline via the morph;
  focus stays on the trigger after toggle (the expand does not move focus).

### Live region

None for the disclosure itself. If the panel contains async-loaded content (HTMX swap), the HTMX pattern
injects the content and the browser's natural focus flow handles discovery. A `role="status"` live region
is NOT added to the navigation component — it is not a status announcer.

### Shared mechanisms composed

- **`collection-nav.enhancer.ts`**: supplies optional arrow-key roving (NOT in full listbox/roving-tabindex
  mode; in "nav" mode where real DOM focus moves and `tabindex` is not managed). Also supplies Esc-close
  and type-ahead. Do NOT hand-roll these; this component is a consumer of the shared enhancer, parameterised
  to the "nav" mode (distinct from the "listbox" mode used by `select` and `dropdown-menu`).
- **Popover seam** (horizontal positioned panels): the flyout panel for `panelFull=false` items anchors via
  CSS Anchor Positioning + `popover` attribute (the shared seam, already built in Wave 3). Light-dismiss
  fires `closeAll()`. Do NOT hand-roll positioning.
- **No `focus-trap`**: navigation panels are non-modal; the `focus-trap` enhancer is explicitly NOT composed.

---

## 5. Tokens

### Tokens consumed

| token | used for |
|---|---|
| `--lv-color-bg` | `<nav>` background (usually transparent; the adopter sets the shell bg) |
| `--lv-color-fg` | trigger + link text default |
| `--lv-color-fg-muted` | disabled item text, group headings, descriptions |
| `--lv-color-accent` | active / current-page item accent underline + hover background |
| `--lv-color-accent-fg` | text on accent-bg hover (triggers) |
| `--lv-color-border` | panel border, separator |
| `--lv-color-popover` | panel flyout background (horizontal positioned panels) |
| `--lv-color-popover-fg` | panel flyout text |
| `--lv-color-overlay` | optional backdrop for full-width mega-menu (transparent-ish scrim) |
| `--lv-ring` | focus-visible ring on triggers + links |
| `--lv-space-{2,3,4,6,8,9,10}` | trigger padding, panel padding, group spacing |
| `--lv-text-{xs,sm,base}` | label size (size-scaled), description size (`xs`), badge size (`xs`) |
| `--lv-radius-md` | trigger hover bg radius; panel border-radius |
| `--lv-shadow-md` | positioned panel elevation |
| `--lv-z-popover` | panel z-index (positioned variant; composes popover seam) |
| `--lv-font-sans` | all text |
| `--lv-motion-duration-fast` | panel open/close transition |
| `--lv-motion-easing-out` | panel open easing |

### NET-NEW tokens proposed

None. The full token vocabulary above is already in the v2 token set. The panel-as-popover elevation
and positioning reuse `--lv-shadow-md` + `--lv-z-popover` (same as `select` listbox and `dropdown-menu`).

---

## 6. Wire actions

### Directives the template binds

| directive | element | action |
|---|---|---|
| `l:click="toggle" data-id="<escaped id>"` | disclosure `<button>` (per top-level item with children) | fires `toggle(id)` on the server; validates `id ∈ items` in Java BEFORE mutating `openItemId` |
| (none on leaf `<a>`) | leaf `<a href>` | plain navigation; no wire action needed |

The item id is DB/config-derived and MUST flow through the safe escaping channel:
each trigger emits `data-id="<Escape.htmlAttribute(item.id())>"` (not via `attrs`).
The server action reads `dataset.id` from the request parameters.

### `closeAll()` — Esc / backdrop

The `collection-nav` enhancer registers a `keydown` listener on the `<nav>` root.
On `Esc` (when `openItemId != null`), it fires the `closeAll` wire action.
For the horizontal positioned-panel variant, the popover seam's light-dismiss also fires `closeAll`.
`closeAll` is a no-op when all panels are already closed.

### Round-trip (horizontal panel open)

1. User clicks a disclosure trigger → `l:click="toggle" data-id="item-2"`.
2. Server `toggle("item-2")`: validates id, sets `openItemId = "item-2"` (or null if already open).
3. Server re-renders: the trigger for `item-2` gets `aria-expanded="true"`; the panel `div` for
   `item-2` loses `hidden`; all other panels remain `hidden`.
4. Client morphs: the DOM patches, `hidden` is removed on the panel, the links become Tab-reachable.
5. The `collection-nav` enhancer observes the DOM change (via its lifecycle `onComponentUpdate` hook)
   and records the opener trigger for Esc-restore.

### Round-trip (close via Esc)

1. Enhancer fires `closeAll()` wire action.
2. Server sets `openItemId = null`.
3. Re-render: all triggers `aria-expanded="false"`, all panels `hidden`.
4. Morph patches. Enhancer's `onComponentUpdate` hook restores focus to the recorded opener.

### Vertical (accordion inline)

Toggle is the same wire action; the panel is an inline `<ul>` below the trigger in the DOM (no popover
seam, no light-dismiss). The expand/collapse is purely the `hidden` attribute on the panel `<ul>`.

### Static variant (`navigation-menu-static.jte`)

No wire actions. The enhancer manages `aria-expanded` locally via DOM mutation (sets
`button.setAttribute("aria-expanded", "true/false")`) — the client owns the open/close state entirely.
The `closeAll` is handled in the enhancer's Esc listener, also via DOM mutation + `hidden`. This is the
correct escape hatch: no server state, no round-trip, client truth only (the panel content is static
markup, not role-gated server data).

---

## 7. Acceptance tests

All tests run on REAL substrates — the client-island-fidelity lesson (a fake `$lievit` or a mocked
morph cannot catch projection bugs):

### Render tests (real `LievitRuntime` + jsdom for WIRE; jsdom + real `collection-nav` for STATIC)

- **panels-hidden-by-default**: on initial render, all disclosure triggers have `aria-expanded="false"`;
  all panel elements have `hidden`; no link inside a panel is in the Tab order.
- **panel-opens-on-toggle**: after `toggle("item-2")` fires and the morph completes, the trigger for
  `item-2` has `aria-expanded="true"`, the panel `div#panel-item-2` is present without `hidden`, and its
  links are reachable (not hidden from a11y tree).
- **panel-closes-on-second-toggle**: a second `toggle("item-2")` sets `aria-expanded="false"` + `hidden`
  back on the panel — accordion close.
- **only-one-panel-open**: toggling `item-3` while `item-2` is open closes `item-2` and opens `item-3`
  (assert both `aria-expanded` states + `hidden` attributes).
- **aria-current-on-active-link**: when `activeHref` matches a leaf link's href, that `<a>` has
  `aria-current="page"`; no other link has it.
- **disabled-leaf-a11y**: a disabled `NavItem` with `href` renders `<a aria-disabled="true">` with no
  `href`; a disabled `NavItem` with children renders `<button disabled>`.
- **badge-aria-hidden**: badge `<span>` elements carry `aria-hidden="true"`.
- **icon-aria-hidden**: all icon `<svg>` elements carry `aria-hidden="true"`.
- **panel-body-visible**: after open, the `OWNED` panel content (group headings + links) is
  VISIBLE in the rendered DOM (the projection assertion — equivalent to the dialog body test that was
  the key lesson; do not skip this).
- **nav-aria-label**: the `<nav>` root carries an `aria-label` attribute (accessible landmark name).

### Axe-core (zero violations)

- **axe-closed**: axe on the rendered DOM with all panels closed — zero violations; landmark is properly
  labelled; no orphaned `aria-controls` targets (panel elements are present, just `hidden`).
- **axe-open**: axe on the DOM with one panel open — zero violations; expanded trigger correct; panel
  links are valid link elements with accessible names.
- **axe-disabled-items**: axe with disabled items present — `aria-disabled` usage is valid.

### Keyboard tests (REAL `collection-nav` enhancer, real DOM focus)

Tests use `document.activeElement` assertions, NOT mocked event handlers:

- **esc-closes**: open a panel, send `Keydown Escape` on the `<nav>` — assert `openItemId` becomes null
  (wire action fired) and focus returns to the trigger after morph.
- **arrow-right-moves-focus** (horizontal): focus on trigger-1, send `ArrowRight` — assert
  `document.activeElement` is trigger-2.
- **arrow-left-wraps**: focus on trigger-1, send `ArrowLeft` — assert focus wraps to the last trigger.
- **arrow-down-into-panel**: focus on an open trigger (horizontal), send `ArrowDown` — assert focus
  moves to the first link in the open panel.
- **arrow-up-returns-to-trigger**: focus on the first link in an open panel, send `ArrowUp` — assert
  focus returns to the panel's trigger.
- **home-end**: `Home` moves to the first trigger; `End` moves to the last.
- **typeahead**: focus on trigger-1 (`"Reports"`), type `"d"` — assert focus jumps to `"Dashboard"` trigger.
- **tab-order-panel-links**: Tab from an open-panel trigger moves into the panel links in DOM order,
  then exits out the bottom of the nav.
- **all-triggers-in-tab-order**: assert that all disclosure `<button>` and leaf `<a>` elements have
  `tabindex` unset (natural tab order, NOT `tabindex="-1"`) — this is the key distinction from menubar.

### Focus tests

- **focus-restore-after-esc**: record the opener trigger; fire Esc; after the wire morph, assert
  `document.activeElement === openerTrigger`.
- **vertical-inline-expand-focus-unchanged**: toggle a vertical item; assert focus remains on the
  trigger (the expand does not steal focus).

### Variant / size tests

- **horizontal-layout**: orientation=horizontal renders triggers in a flex row; panel opens below.
- **vertical-layout**: orientation=vertical renders triggers in a column; children expand inline (no popover).
- **size-tokens**: each of sm/md/lg emits the correct height token class (`--lv-space-8/9/10`).
- **data-variant-data-size**: `data-variant` and `data-size` attributes present on the root for styling hooks.
- **full-width-panel**: a `panelFull=true` item renders the panel without anchor positioning classes
  (full-width layout vs the positioned-popover layout).

### Wire round-trip IT (lievit-kit, real runtime — `CollapsibleComponentIT` pattern)

- **toggle-opens-and-closes**: mount `NavigationMenuComponent` with 3 items (item-2 has children) →
  wire call `toggle("item-2")` → assert rendered HTML has `aria-expanded="true"` on item-2 trigger +
  no `hidden` on `panel-item-2` → wire call `toggle("item-2")` again → assert `aria-expanded="false"` +
  `hidden` is back.
- **unknown-id-rejected**: wire call `toggle("nonexistent")` → assert the action throws / leaves state
  unchanged (id validation in Java before mutate).
- **close-all-clears-state**: open item-2 → wire call `closeAll()` → assert `openItemId == null` in
  re-rendered DOM.

### Playwright (gesture fidelity, legacy-VM oracle)

- **click-opens-panel**: real `page.click` on a trigger → assert the panel is VISIBLE and contains
  the expected links (real data from the controller, not a mocked substrate).
- **click-again-closes-panel**: second `page.click` → panel hidden.
- **keyboard-open-close**: `page.keyboard.press("Enter")` on a focused trigger → panel opens;
  `page.keyboard.press("Escape")` → panel closes; focus returns to the trigger.
- **aria-current-updates**: navigate to a route whose link is in a panel → assert `aria-current="page"`
  is on the correct `<a>` (server-set `activeHref` — not a client-side update).

### JTE compile + render

Covered by `test/jte-compile` for both `navigation-menu.jte` and `navigation-menu-static.jte`.

### Escaping (XSS abuse case)

- **hostile-id-escaping**: a `NavItem` whose `id` contains `"><script>alert(1)</script>` must render
  the `data-id` attribute inert (HTML-escaped via `Escape.htmlAttribute`); the script must NOT execute.
- **hostile-label-escaping**: a `NavLink.label` containing `<b>` renders escaped plain text, not a
  bold element.

---

## 8. Non-goals / anti-patterns

**NOT `role=menu` / `role=menubar`**: the navigation-menu is a site/app NAVIGATION landmark, not
an application-widget menu. Using `role=menu` on a navigation would mislead screen readers into
announcing "menu" and expecting the full arrow-key roving `tabindex` regime. The APG is explicit:
`role=menu` is for application menus (actions, functions), NOT for landmark-navigation. If you need
a full application menubar (desktop File/Edit/View style), use the `menubar` component (S2, separate spec).

**NOT a `role=menubar` horizontal variant**: the fact that this renders horizontally does NOT make it
a menubar. It is a `<nav>` with disclosure buttons.

**NOT a focus trap**: the panels are non-modal. Tab exits freely. Do NOT compose `focus-trap.enhancer.ts`
here.

**No client-side routing**: links in panels are plain `<a href>` elements; navigation is a real browser
navigation (or Turbo Drive page visit). There is no `pushState` or SPA routing in lievit.

**No `aria-activedescendant`**: the disclosure-nav pattern uses real DOM focus, NOT virtual-focus via
`aria-activedescendant`. That is the listbox/combobox model. Do not conflate them.

**No option-list data hardcoded in the template**: item lists, link lists, group labels, hrefs — all
come from `@param` / `@Wire` fields populated by the controller. The "no data in a partial" rule
(architecture contract §3) applies here: the template reads the typed `NavItem` model, it does not
contain strings.

**No inline `<script>` or `on*=` attributes**: the CSP refuses them. All behaviour is in
`collection-nav.enhancer.ts` registered via the directive/lifecycle registries.

**Not for mega-menu full-page takeover**: the horizontal panel variant is a flyout within the page
layout, not a full-page overlay. For a full-page overlay, compose `drawer` / `sheet`.

**Not for breadcrumb**: breadcrumb is a separate `PARTIAL` component (APG Breadcrumb pattern, uses
`aria-label="Breadcrumb"` + `aria-current="page"`, entirely different semantics).
