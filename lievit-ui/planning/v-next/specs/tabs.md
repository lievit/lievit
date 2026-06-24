<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — tabs (WIRE/HTMX + ENH: roving tablist, HTMX panel swap)

- **tier**: WIRE + HTMX (panel content swap) + ENH (`collection-nav.enhancer.ts`, the shared tablist
  roving mechanism — the same enhancer as select/combobox/dropdown-menu; no hand-roll)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of the existing `registry/jte/tabs.jte` surface)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Tabs (`https://www.w3.org/WAI/ARIA/apg/patterns/tabs/`) + **react-aria
      `useTabList` / `useTab` / `useTabPanel` interaction model** as the pattern reference (the roving
      tabindex + automatic/manual activation + ARIA wiring, transcribed into ORIGINAL template +
      `collection-nav` enhancer; no react-aria source copied)
    - inventory: Ant Design Tabs as inventory reference (sizes, card/line/editable types, icon tabs,
      extra content slot, lazy/eager panel loading, closable tabs, add-tab; the add/close mutation path
      lives in the WIRE component; the panel content is server-rendered via HTMX swap)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      (NO code copied)

---

## 1. What it is

A tabbed interface: a horizontal (or vertical) `tablist` of `tab` triggers, each controlling the
visibility of its associated `tabpanel`. The ACTIVE TAB is a server fact (`@Wire String activeTab`);
the server renders the correct panel and the tablist's `aria-selected` state on every round-trip.
WIRE is the right tier because the active tab determines which content to load and which business
logic executes — it is not a client-only view toggle. The irreducible CLIENT behavior — roving
tabindex within the tablist, arrow-key navigation, and keyboard activation — is the shared
`collection-nav.enhancer.ts`, parameterised for the `tablist` role. Content panels are:

- **eager**: the server renders ALL panels in the HTML, hiding inactive ones via `hidden` (simple,
  no round-trip after initial render, fine for small panel content);
- **lazy / HTMX**: the server renders only the active panel; inactive panel slots carry a
  `hx-get="/tabs/{id}/panel/{tabId}"` that swaps in content when a tab becomes active (zero
  unnecessary server work for heavy panels; the canonical HTMX-pattern composition).

The spec covers BOTH modes; the adopter chooses at instantiation time via `lazyLoad`. Server-first
works here because the active-tab decision is always a server round-trip anyway (the panel's data
is server-fetched regardless). The client roving is the only irreducible client piece.

---

## 2. API — the WIRE surface + template params

**Java (`TabsComponent`)**:

| member | kind | meaning |
|---|---|---|
| `tabs` `List<TabItem>` | `@Wire @LievitProperty(locked=true)` | ordered list of tab definitions (id, label, icon?, closable?, disabled?); locked server config — a client cannot inject or reorder tabs |
| `activeTab` `String` | `@Wire` | the id of the currently active tab |
| `orientation` `String` | `@Wire @LievitProperty(locked=true)` | `horizontal` (default) \| `vertical`; controls arrow-key axis and layout |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `sm` \| `md` (default) \| `lg` — tab height, toolbar-aligned |
| `type` `String` | `@Wire @LievitProperty(locked=true)` | `line` (default, bottom-border indicator) \| `card` (raised tab cards) \| `pill` (filled active tab) |
| `lazyLoad` `boolean` | `@Wire @LievitProperty(locked=true)` | `false` = eager (all panels in DOM, hidden); `true` = HTMX swap per activation |
| `addable` `boolean` | `@Wire @LievitProperty(locked=true)` | shows the "add tab" `+` button; triggers the `addTab()` action |
| `extraContent` | OWNED template region | optional trailing slot in the tablist bar (search, actions); OWNED markup in the adopted template, NOT a `Content` slot (WIRE has none — see §blueprint 1.b) |
| `activate(String id)` | `@LievitAction` | sets `activeTab = id`; validates id ∈ tabs and !disabled; if `lazyLoad`, re-renders with only the new active panel; if eager, re-renders full DOM |
| `closeTab(String id)` | `@LievitAction` | removes tab from `tabs`; if closed tab was active, activates predecessor (or successor if first); validates closable flag; authz in Java BEFORE mutating |
| `addTab()` | `@LievitAction` | adopter-provided hook (abstract in the base class) that adds a new `TabItem` to `tabs` and activates it; business logic lives in the overriding component |
| `visibleTabs()` | computed getter on `_instance` | `tabs` filtered to non-hidden entries (read by the template; `@LievitProperty(serialize=false)`) |

**`TabItem` record** (server-side Java, locked, part of the component model):

| field | type | meaning |
|---|---|---|
| `id` | `String` | unique within this component instance; used as DOM id anchor |
| `label` | `String` | visible text label |
| `icon` | `String` \| `null` | optional icon name (rendered via `@template.lievit.icon`) |
| `closable` | `boolean` | shows the per-tab ✕ close button |
| `disabled` | `boolean` | tab is rendered but not activatable |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param TabsComponent _instance` (for `visibleTabs()` + per-panel HTMX URL derivation). No
`Content` slot (WIRE has none — server-first refactor blueprint §1.b; body content is OWNED markup
in the adopted template).

---

## 3. Variants / sizes / states

**Sizes** (height-based, toolbar-aligned — same `--lv-space` scale as `button`/`input`):

| size | tab height token | use |
|---|---|---|
| `sm` | `--lv-space-8` (32 px) | dense toolbars, nested tab sets |
| `md` | `--lv-space-9` (36 px, default) | standard admin panels |
| `lg` | `--lv-space-10` (40 px) | prominent top-level navigation |

Horizontal padding and text size scale proportionally with the height token (same rule as `button`).

**Types** (visual style of the tab indicator):

| type | look | token expression |
|---|---|---|
| `line` (default) | bottom border indicator under active tab; tab bar has a divider below it | `--lv-color-primary` border-bottom on `aria-selected=true`; `--lv-color-border` bottom divider on the strip |
| `card` | each tab is a raised card; active tab merges into the panel surface (no bottom border on active card, panel border starts at card bottom) | `--lv-color-card` background; `--lv-shadow-xs` on inactive; border unification on active |
| `pill` | active tab has a filled background pill; no strip divider | `--lv-color-accent`/`-fg` background on `aria-selected=true`; ghost background on inactive |

**States per tab**:

| state | ARIA expression | token / visual |
|---|---|---|
| active (`activeTab == tab.id`) | `aria-selected="true"` on `<button role=tab>` | indicator color `--lv-color-primary`, label weight `--lv-font-medium` |
| inactive | `aria-selected="false"` | `--lv-color-muted-fg` label, no indicator |
| focused | `:focus-visible` | `--lv-ring` outline, same rule as all interactive primitives |
| disabled | `aria-disabled="true"` on `<button role=tab>` (NOT native `disabled` — a disabled tab still receives focus in the roving order per APG; `aria-disabled` signals non-activatability while keeping it tabbable) | `--lv-color-muted-fg` + reduced opacity via `opacity-50` |
| `aria-busy` | set by the runtime `beforeCall`/`afterCall` hook during the wire round-trip on the tab strip root | loading spinner overlaid on the active tab indicator |

**Panel state**:

- eager mode: inactive panels carry `hidden` (removed from a11y tree and layout); active panel has no `hidden`.
- lazy mode: inactive panel placeholders carry `hx-get` + `hx-swap="outerHTML"` + `hx-trigger="tabs-activate"`; the active panel is fully rendered by the server.

---

## 4. The a11y contract (the heart — the roving tablist model)

**WAI-ARIA pattern**: APG Tabs (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
Verified against the W3C APG pattern page on 2026-06-24.

**Roles + ARIA** (all emitted server-side by the JTE template; none set by JS after load):

| element | role + attributes | note |
|---|---|---|
| tab strip container | `role="tablist"` `aria-label="<tabsLabel>"` (or `aria-labelledby` → a visible heading) `aria-orientation="horizontal"` \| `"vertical"` | the label disambiguates multiple tab sets on the same page |
| each tab button | `role="tab"` `id="tab-{cid}-{tabId}"` `aria-selected="true"\|"false"` `aria-controls="panel-{cid}-{tabId}"` `aria-disabled="true"` (disabled only) `tabindex="0"` (active tab) \| `tabindex="-1"` (inactive) | real `<button>` element carrying `role=tab` overrides native `button` role; the `tabindex` roving is managed by `collection-nav` |
| each tab panel | `role="tabpanel"` `id="panel-{cid}-{tabId}"` `aria-labelledby="tab-{cid}-{tabId}"` `tabindex="0"` (when panel contains no focusable child) | `tabindex="0"` on the panel itself is mandatory when the panel body is pure text/display (so it enters the page tab sequence); omit it when the panel contains interactive children (the first focusable child is the tab stop) |
| tab strip wrapper | `data-slot="tabs"` `data-orientation` `data-type` `data-size` | data attributes for styling hooks + test targets |
| close button (per closable tab) | `<button aria-label="Close {tab.label}"` inside the tab element | icon-only → aria-label is REQUIRED (button spec rule) |
| add button (addable) | `<button aria-label="Add tab"` trailing the tablist | icon-only → aria-label is REQUIRED |

**Keyboard interaction map** (APG Tabs, verified):

| key | context | action | who supplies it |
|---|---|---|---|
| `Tab` | anywhere on page → tablist | moves focus to the ACTIVE tab (the `tabindex=0` one); subsequent Tab exits the tablist and enters the active tabpanel (or the first focusable element in it) | platform (roving tabindex managed by `collection-nav`) |
| `Tab` | inside tabpanel | normal sequential focus through panel content, then exits panel | platform |
| `ArrowRight` | focus on any tab, horizontal orientation | moves focus to the NEXT tab (wraps to first); in automatic-activation mode also activates it | `collection-nav` enhancer |
| `ArrowLeft` | focus on any tab, horizontal orientation | moves focus to the PREVIOUS tab (wraps to last); auto-activates in automatic mode | `collection-nav` enhancer |
| `ArrowDown` | focus on any tab, vertical orientation | same as ArrowRight in horizontal (next tab) | `collection-nav` enhancer |
| `ArrowUp` | focus on any tab, vertical orientation | same as ArrowLeft in horizontal (previous tab) | `collection-nav` enhancer |
| `Home` | focus on any tab | moves focus to the FIRST tab; auto-activates in automatic mode | `collection-nav` enhancer |
| `End` | focus on any tab | moves focus to the LAST tab; auto-activates in automatic mode | `collection-nav` enhancer |
| `Enter` / `Space` | focus on a tab (manual-activation mode only) | activates the focused tab — fires the `activate(id)` wire action | `collection-nav` enhancer → wire |
| `Delete` | focus on a closable tab | closes the tab — fires `closeTab(id)` wire action; focus moves to the successor tab (or predecessor if last) | `collection-nav` enhancer → wire |
| `Shift+F10` | focus on a tab with `aria-haspopup` | opens the associated context menu (for tab-specific actions; optional, fires the `tabMenu(id)` wire action) | `collection-nav` enhancer → wire |

**Activation mode**:

- **Automatic** (default, recommended by APG when panel loads without noticeable latency): arrow
  focus + activation fire together; `activate(id)` fires on every arrow move. Suitable for eager
  panels and fast HTMX swaps.
- **Manual** (for slow/lazy panels where an immediate round-trip would cause noticeable latency):
  arrow keys move focus only (no `activate`); Enter/Space then fires `activate(id)`. Enabled via
  `manualActivation=true` on the component.
- The `manualActivation` flag is a `@Wire @LievitProperty(locked=true)` field; `collection-nav` reads
  it from a `data-manual-activation` attribute on the tablist element.

**Focus management**:

- **Roving tabindex**: only the active tab has `tabindex="0"`; all others have `tabindex="-1"`. The
  `collection-nav` enhancer updates `tabindex` on arrow-key navigation and on activation. This is the
  APG-mandated focus model for a tablist — NOT DOM focus following `aria-activedescendant` (which is
  the listbox/menu model; tabs use true DOM focus roving per APG).
- **Initial focus**: when Tab brings focus into the tablist, focus lands on the `tabindex="0"` tab
  (the active one). There is no trap; the user Tabs naturally into the panel after the active tab.
- **Panel focus**: after Tab exits the tablist, focus enters the tabpanel. If the panel has
  `tabindex="0"` (no focusable children), the panel itself is focused; if it has interactive
  children, focus lands on the first one naturally.
- **No focus trap**: tabs are non-modal; focus is never trapped.
- **Close-tab focus**: when `closeTab(id)` is called and the closed tab was focused, `collection-nav`
  moves focus to the successor tab (or the new active tab if the closed tab was active).
- **Disabled tabs**: receive focus in the roving order (APG: disabled tabs remain focusable) but
  `activate()` is a no-op for them (the Java action validates `!disabled` before mutating); the
  enhancer skips disabled tabs on arrow navigation optionally (flag `skipDisabled`, default `true`
  for UX clarity — the adopter can set `data-skip-disabled="false"` if they want disabled in the
  arrow sequence per raw APG).
- **Shared mechanism**: `collection-nav.enhancer.ts` — the SAME enhancer as select/combobox/
  dropdown-menu, parameterised with `role=tab` semantics (roving tabindex vs. `aria-activedescendant`,
  arrow axis from `aria-orientation`). Do NOT re-implement; this is the single-source rule in action.

**Live region**: none required by the APG Tabs pattern itself. If HTMX panel loading is in progress,
the `aria-busy="true"` on the tablist root (set by the runtime `beforeCall`/`afterCall` hook) signals
the loading state to screen readers. A loading-specific announcement ("Loading {tab.label}...") is
optional and, if needed, uses the shared announcer, not an inline `aria-live` div.

**Shared mechanisms composed**:

- `collection-nav.enhancer.ts` (roving tabindex + arrow navigation + Home/End + Delete + Enter/Space
  in manual mode). Parameterised for `role=tablist` / `role=tab` + `aria-orientation`. Do NOT
  re-implement roving or keyboard navigation.
- HTMX panel swap (the lazy-load path): the `hx-get` / `hx-swap` / `hx-trigger` attributes on panel
  placeholders; the server endpoint `/tabs/{cid}/panel/{tabId}` returns only the panel fragment. This
  is the HTMX-pattern tier, not a bespoke fetch.
- No focus-trap (tabs are non-modal; `focus-trap` is NOT composed here).
- No popover seam (no floating overlay; `popover seam` is NOT composed here).

---

## 5. Tokens

**Reads** (no literals, all via `var(--lv-*)`):

| token | use |
|---|---|
| `--lv-color-primary` | active tab indicator (line type: border-bottom; pill type: background) |
| `--lv-color-primary-fg` | active tab label (pill type only) |
| `--lv-color-accent` | hover tint on inactive tabs |
| `--lv-color-accent-fg` | hover label on inactive tabs |
| `--lv-color-muted-fg` | inactive + disabled tab label |
| `--lv-color-border` | tablist strip divider (line type); card borders |
| `--lv-color-card` | card-type tab background |
| `--lv-color-bg` | active card tab background (merges with panel surface) |
| `--lv-color-fg` | active tab label (line type) |
| `--lv-space-8` | sm tab height (32 px) |
| `--lv-space-9` | md tab height (36 px, default) |
| `--lv-space-10` | lg tab height (40 px) |
| `--lv-space-2` | close button icon padding inside the tab |
| `--lv-space-3` | horizontal gap between icon and label within a tab |
| `--lv-space-4` | horizontal padding within each tab (sm) |
| `--lv-space-6` | horizontal padding within each tab (md/lg) |
| `--lv-space-4` | tabpanel internal padding (top/sides) |
| `--lv-text-sm` | tab label text size (sm tabs) |
| `--lv-text-base` | tab label text size (md/lg tabs) |
| `--lv-font-medium` | active tab label weight |
| `--lv-font-sans` | tab label font family |
| `--lv-radius-md` | card-type tab border-radius (top corners only) |
| `--lv-radius-full` | pill-type active tab background border-radius |
| `--lv-shadow-xs` | card-type inactive tab subtle elevation |
| `--lv-ring` | focus-visible ring on tabs and close/add buttons |
| `--lv-transition-fast` | tab indicator transition (border/background slide) |

**NET-NEW tokens**: none. The tab indicator slide uses `--lv-transition-fast` (existing). The card
surface reuses `--lv-color-card` + `--lv-color-bg` (existing). The active-indicator underline is a
`border-bottom` utility driven by `--lv-color-primary` (existing). No new token is needed.

**Dark mode**: no new rules — the existing `.dark` re-point block already covers `--lv-color-primary`,
`--lv-color-card`, `--lv-color-border`, `--lv-color-muted-fg`. Structural tokens (space, radius,
transition) are theme-invariant.

---

## 6. Wire actions + HTMX integration

**`l:*` directives the template binds**:

| directive | on element | purpose |
|---|---|---|
| `l:click="activate" data-id="<escaped tabId>"` | each `<button role=tab>` | fires `activate(id)` on click; `collection-nav` also fires this on Enter/Space (manual mode) and on arrow key (automatic mode) |
| `l:click="closeTab" data-id="<escaped tabId>"` | each per-tab close `<button>` | fires `closeTab(id)` on click or Delete key (via enhancer) |
| `l:click="addTab"` | add-tab `<button>` | fires `addTab()` |

**Wire action signatures + Java contract**:

```
// TabsComponent.java (sketch — not implementation, just the contract)
@LievitAction
public void activate(String id) {
    // validate: id must be in tabs list AND !disabled — validate BEFORE mutating
    TabItem target = tabs.stream().filter(t -> t.id().equals(id)).findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown tab id: " + id));
    if (target.disabled()) return; // no-op; enhancer blocks it but server is the authority
    this.activeTab = id;
    // if lazyLoad, the template re-renders with the new active panel fully populated
}

@LievitAction
public void closeTab(String id) {
    // validate: tab must be closable AND exist — validate BEFORE mutating
    TabItem toClose = tabs.stream().filter(t -> t.id().equals(id))
        .filter(TabItem::closable)
        .findFirst().orElseThrow();
    int idx = tabs.indexOf(toClose);
    tabs.remove(toClose);
    if (activeTab.equals(id)) {
        // activate successor (or predecessor if last)
        activeTab = idx < tabs.size() ? tabs.get(idx).id() : tabs.get(idx - 1).id();
    }
}

@LievitAction
public abstract void addTab(); // adopter implements; adds a new TabItem to tabs + activates it
```

**Per-row escaping**: `data-id` on each tab button is a DB-derived / server-supplied value; it MUST go
through the escaped `dataAttrs` / `wireArgs` channel (`Escape.htmlAttribute`), never raw `attrs`. The
tab id is user-influenced (e.g., a slug derived from user input); treat it as untrusted.

**Round-trip flows**:

- **Click to activate (eager)**: click `<button role=tab data-id="settings">` → `activate("settings")`
  → server sets `activeTab="settings"`, re-renders full template → morph patches the DOM (old active
  tab's `aria-selected` → `false` + `tabindex=-1`; new active tab → `true` + `tabindex=0`; inactive
  panels get `hidden`; new active panel loses `hidden`). The `collection-nav` enhancer retains focus
  on the newly active tab after the morph (morph preserves focus by design).

- **Click to activate (lazy HTMX)**: click `<button role=tab data-id="reports">` → wire `activate`
  round-trip re-renders the tablist (aria-selected state) + the NEW active panel fragment → morph
  patches the tablist + swaps the panel region (the panel placeholder `<div hx-get="...">` is replaced
  by the real panel HTML). Previously rendered lazy panels that are now hidden get `hidden` added (not
  removed from DOM, so back-navigation is instant).

- **Close tab**: click ✕ on a closable tab → `closeTab(id)` → server removes from `tabs`, possibly
  changes `activeTab` → full re-render → morph removes the closed tab button and its panel region.
  `collection-nav` is informed by the DOM change (mutation observer or lifecycle hook) to update focus
  to the new active tab.

- **Add tab**: click `+` → `addTab()` → adopter logic adds a new `TabItem` to `tabs`, sets
  `activeTab` to the new tab's id → full re-render → morph appends the new tab button + its panel.

**HTMX panel endpoint contract**: `GET /tabs/{cid}/panel/{tabId}` returns `text/html` — the panel
fragment only (the `<div role=tabpanel ...>` and its children, no surrounding layout). The server
validates `cid` corresponds to an active `TabsComponent` instance and `tabId` is active. This endpoint
is NOT served by the WIRE round-trip; it is a plain `@GetMapping` on an adopter controller (the
HTMX-pattern tier, not the wire tier). Lazy panels use this endpoint on first activation; after the
first load, the panel is in the DOM (hidden) and subsequent activations just toggle `hidden`.

**The enhancer's wire-action wiring**:

The `collection-nav` enhancer, parameterised for `[role=tablist]`, registers on mount via the runtime
lifecycle registry. It:

1. Reads `aria-orientation` from the tablist element to determine arrow axis (horizontal → Left/Right;
   vertical → Up/Down).
2. Reads `data-manual-activation` to determine automatic vs manual activation mode.
3. On `ArrowRight` / `ArrowLeft` (or Down/Up for vertical): updates `tabindex` on tab buttons (roving
   — DOM focus moves), and in automatic mode fires the `activate` wire action on the newly focused tab.
4. On `Home` / `End`: focuses first/last tab; auto-activates.
5. On `Enter` / `Space` (manual mode only): fires `activate` on the currently focused tab.
6. On `Delete`: fires `closeTab` on the currently focused tab (only if it has `aria-disabled` absent
   and the close button exists).
7. On `Shift+F10`: triggers a context menu if the tab has `data-has-menu="true"`.
8. Never mutates ARIA state client-side — that is the server's job after the wire round-trip.

---

## 7. Acceptance tests (the gate — refute-by-default)

The component is DONE only when ALL pass, on a REAL substrate (not a mocked one — the
client-island-fidelity lesson from the gest calendar slide-over and drag-move bugs).

**Render (real LievitRuntime + jsdom, REAL `collection-nav` mounted — NOT a mocked `$lievit`)**:

- `tabs-render-structure`: mount a 3-tab eager component → assert `role=tablist`, three
  `role=tab` buttons, three `role=tabpanel` divs; `aria-selected=true` on the first tab; the
  first panel visible (no `hidden`); the other two panels have `hidden`; `aria-controls` on each
  tab points to the correct panel id; `aria-labelledby` on each panel points back to its tab id.
- `tabs-render-inactive-panel-hidden`: mount 3-tab eager → assert panels 2 and 3 have `hidden`;
  activate tab 2 via wire round-trip → assert panel 2 visible, panels 1 and 3 have `hidden`;
  panel 2 has `aria-labelledby` → tab 2's id.
- `tabs-render-card-type`: mount with `type=card` → assert the tablist container has
  `data-type="card"` and the active tab element has the card-active token class (no bottom border
  indicator applied).
- `tabs-render-pill-type`: mount with `type=pill` → assert active tab has pill background token
  class; no strip divider rendered.
- `tabs-render-vertical`: mount with `orientation=vertical` → assert `aria-orientation="vertical"`
  on the tablist root; `data-orientation="vertical"` on `data-slot="tabs"`.
- `tabs-render-disabled-tab`: mount with tab 2 disabled → assert `aria-disabled="true"` on tab 2
  button; NO native `disabled` attribute (disabled tabs must remain in the roving focus order per APG).
- `tabs-render-closable-tab`: mount with tab 2 closable → assert a `<button aria-label="Close …">`
  inside tab 2's element.
- `tabs-render-addable`: mount with `addable=true` → assert an `<button aria-label="Add tab">`
  trailing the tablist.
- `tabs-render-tabpanel-tabindex`: mount with a panel whose body is pure text (no focusable child) →
  assert `tabindex="0"` on that panel; mount a panel with a focusable child → assert NO `tabindex`
  on the panel itself.
- `tabs-render-lazy-placeholder`: mount with `lazyLoad=true`, tabs 2+3 inactive → assert the
  inactive panel placeholders carry `hx-get` attributes pointing to `/tabs/{cid}/panel/{tabId}`;
  tab 1's panel is fully rendered (not a placeholder).

**axe-core (zero violations on the cited APG rules)**:

- `tabs-axe-eager`: run axe on the mounted eager DOM → zero violations including `aria-required-*`,
  `button-name` (close/add buttons), `tablist` structure rules.
- `tabs-axe-open-lazy`: run axe after lazy tab 2 has loaded its panel → zero violations.
- `tabs-axe-disabled`: run axe with a disabled tab present → zero violations (aria-disabled vs.
  disabled attribute verified).
- `tabs-axe-without-label`: run axe on a tablist with no `aria-label` and no `aria-labelledby` →
  MUST FAIL the `aria-required-attr` rule for `tablist` (validates that the label is enforced).

**Keyboard (REAL `collection-nav` mounted; each key asserts the observable outcome)**:

- `tabs-key-tab-into-tablist`: page Tab → assert focus lands on the active tab (the `tabindex=0`
  one), NOT on an inactive tab.
- `tabs-key-arrow-right-automatic`: focus on tab 1 → ArrowRight → assert focus moves to tab 2 AND
  the `activate("tab2")` wire action fires (automatic mode); repeat wrap: from last tab → ArrowRight
  → assert focus wraps to tab 1.
- `tabs-key-arrow-left-automatic`: focus on tab 2 → ArrowLeft → assert focus moves to tab 1 AND
  activate fires; wrap from first → ArrowLeft → wraps to last.
- `tabs-key-arrow-vertical`: mount with `orientation=vertical` → focus on tab 1 → ArrowDown →
  assert focus moves to tab 2 (not ArrowRight); ArrowUp → moves back.
- `tabs-key-home-end`: focus on tab 2 (of 4) → Home → assert focus on tab 1 AND activate fires;
  End → assert focus on tab 4 AND activate fires.
- `tabs-key-manual-activation`: mount with `manualActivation=true` → ArrowRight → assert focus
  moves to tab 2 BUT `activate` does NOT fire; then Enter → assert `activate("tab2")` fires.
- `tabs-key-manual-space`: same manual setup → ArrowRight then Space → assert activate fires.
- `tabs-key-skip-disabled`: mount with tab 2 disabled, `skipDisabled=true` (default) → ArrowRight
  from tab 1 → assert focus jumps to tab 3 (skips disabled tab 2).
- `tabs-key-disabled-no-activate`: mount with tab 2 disabled → direct DOM focus on tab 2 button →
  Enter → assert `activate` does NOT fire; the Java action is the authority but also assert the
  enhancer suppresses it.
- `tabs-key-delete-closable`: focus on a closable tab → Delete → assert `closeTab(id)` fires.
- `tabs-key-delete-not-closable`: focus on a non-closable tab → Delete → assert `closeTab` does NOT
  fire (key is inert).
- `tabs-key-tab-after-tablist`: Tab from the active tab → assert focus moves INTO the active panel
  (to `tabindex=0` on the panel, or to the first focusable child within it).

**Focus management**:

- `tabs-focus-roving-tabindex`: after ArrowRight moves focus to tab 2, assert `tabindex="0"` on
  tab 2 AND `tabindex="-1"` on all other tabs.
- `tabs-focus-activate-wire-updates-roving`: activate tab 3 via wire action (not keyboard) → assert
  morph updates `tabindex` so tab 3 = `0`, others = `-1`.
- `tabs-focus-close-moves-to-successor`: focus on closable tab 2 → Delete → `closeTab` fires →
  re-render removes tab 2 → assert focus is now on tab 3 (successor).
- `tabs-focus-close-last-moves-to-predecessor`: focus on the last closable tab → Delete → assert
  focus moves to the new last tab (predecessor).
- `tabs-focus-no-trap`: Tab from last tab in the tablist → assert focus moves OUT of the tablist
  (into the panel, then the rest of the page); no trap.

**Variants / sizes / state tokens**:

- `tabs-size-sm`: mount `size=sm` → assert `data-size="sm"` on root + the active tab height token
  class references `--lv-space-8`.
- `tabs-size-lg`: mount `size=lg` → assert `data-size="lg"` + `--lv-space-10` height token class.
- `tabs-state-aria-busy`: simulate wire round-trip in flight → assert `aria-busy="true"` on the
  tablist root (runtime hook).

**Wire round-trip IT** (lievit-kit, REAL runtime, the CollapsibleComponentIT pattern — not a mock):

- `TabsComponentIT.activate_changes_active_panel`: mount a 3-tab eager `TabsComponent` → invoke
  `activate("tab2")` via the real wire endpoint → assert the re-rendered HTML has `aria-selected=true`
  on tab 2 button, `hidden` absent on panel 2, `hidden` present on panels 1 and 3.
- `TabsComponentIT.close_tab_updates_tab_list`: mount with a closable tab 2 → invoke `closeTab("tab2")`
  → assert the re-rendered HTML has no tab 2 button and no panel 2; if tab 2 was active, assert
  `activeTab` moved to successor.
- `TabsComponentIT.activate_disabled_tab_is_noop`: invoke `activate("disabledTabId")` → assert
  `activeTab` is unchanged in the re-rendered HTML.
- `TabsComponentIT.close_nonclosable_tab_throws`: invoke `closeTab("nonClosableId")` → assert a
  `400 Bad Request` or equivalent rejection (Java validates before mutating).

**JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate (runs on
every pre-commit via the pre-commit framework).

**Escaping (the XSS abuse-case)**:

- `tabs-escaping-hostile-tab-id`: a `TabItem` whose id contains `"><script>alert(1)</script>` →
  render → assert the rendered `data-id`, `id`, `aria-controls`, `aria-labelledby` attributes are
  HTML-escaped; the hostile string never forms a new tag or attribute boundary.

**Playwright (gesture fidelity, real browser, legacy-VM oracle)**:

- `tabs.spec.ts / activate-on-click`: real page load → click tab 2 → assert panel 2 content is
  VISIBLE and panel 1 is hidden (not a fake substrate — asserts the RENDERED body, not just a URL
  parameter).
- `tabs.spec.ts / keyboard-arrow-navigate`: real keyboard ArrowRight from tab 1 → assert tab 2
  becomes the visible active panel.
- `tabs.spec.ts / lazy-load-panel-renders`: HTMX lazy mode → click tab 2 → assert the HTMX swap
  completes and the panel body contains real server-rendered data (not a placeholder).

---

## 8. Non-goals / anti-patterns

- **No client-side tab state.** `activeTab` is always a `@Wire` field on the Java component; it
  is never toggled by toggling a CSS class from JS. A JS-only tab toggle is the exact pattern the
  whole WIRE tier exists to prevent (state has one owner: the server).
- **No `role=tab` on `<div>` or `<a>`.** Every tab is a `<button role="tab">`. A `<button>` carries
  native keyboard support; a `<div>` does not. The only reason to deviate would be a keyboard-driven
  router link (if tabs navigate to URLs, use the `<a>` pattern with `aria-current="page"` — that is
  a DIFFERENT component, `navigation-menu`, not this one).
- **No `aria-activedescendant` model.** The APG Tabs pattern uses ROVING TABINDEX (DOM focus moves to
  each tab on arrow keys), NOT `aria-activedescendant` (which is the listbox/menu model). Do not
  apply the listbox pattern here; `collection-nav` is parameterised per pattern and will use the
  correct model for `[role=tablist]`.
- **No hardcoded option lists or content in the template.** `tabs` is always a `@param` from the
  Java model; panel content is OWNED markup in the adopter's template (WIRE has no `Content` slot).
  No data is ever baked into the partial.
- **No inline `<script>` or `on*=` attributes** in any `.jte` output. The strict CSP refuses them
  silently; all behavior is in the `collection-nav` enhancer registered via the runtime directive
  registry.
- **No hand-rolled roving tabindex or typeahead.** That is what `collection-nav` is for. The single-
  source rule exists precisely to prevent 60 components each having a slightly wrong keyboard handler.
- **Not a router.** Tabs with `lazyLoad` swap a panel FRAGMENT; they do not navigate to a new URL or
  manage browser history. If the product requires URL-addressable tabs (deep linking), that is an
  HTMX-pushState recipe documented separately, not a built-in API of this component.
- **Not a wizard / stepper.** Tabs are non-linear navigation (any tab is reachable at any time).
  A linear multi-step flow with mandatory ordering uses `wizard`, not `tabs`.
- **No `focus-trap`.** Tabs are non-modal; `focus-trap.enhancer.ts` is NOT composed here (unlike
  `dialog` / `drawer`). Tab focus is entirely managed by roving tabindex + the natural page Tab order.
- **No popover seam.** Tabs have no floating overlay. `popover seam` is NOT composed here.

---

## Agent instructions

Generate ORIGINAL code over `--lv-*` tokens.
You MAY read the W3C APG Tabs pattern (`https://www.w3.org/WAI/ARIA/apg/patterns/tabs/`), React Aria
`useTabList`/`useTab`/`useTabPanel` SPEC (interaction model only, not the hooks), and Ant Design Tabs
feature set as references for PATTERN (a11y, inventory) and LOOK.
You MUST NOT paste literal source from ANY of them (no react-aria / ant-design / Tailwind UI code or
class strings) — the output is always original generation (`02-licensing.md` is the one bright line).

Compose `collection-nav.enhancer.ts` for the tablist roving — do NOT hand-roll roving tabindex,
arrow-key navigation, or Home/End handling (that is the failure mode the single-source rule prevents).
`collection-nav` must be parameterised for `[role=tablist]` + roving tabindex (vs. aria-activedescendant
which it uses for listbox/menu). Verify the parameterisation is in the enhancer's design before use.

Mirror `button.jte` and `dialog.jte` house conventions exactly:
- header doc-comment with TIER, STRUCTURE (cite the APG URL), A11y (roles + keys), Params, Usage;
- typed `@param` for every WIRE field + `_component` + `_instance`;
- `data-slot="tabs"` on root, `data-variant`/`data-type`/`data-size`/`data-orientation` for styling hooks;
- the two escaping channels: `attrs` = TRUSTED raw (static only) · `dataAttrs`/`wireArgs` = SAFE escaped
  for all per-tab ids;
- zero `<script>`, zero inline `on*=`.

Activation mode is AUTOMATIC by default (APG recommendation); manual mode is available via
`manualActivation=true`. The `collection-nav` enhancer reads `data-manual-activation` from the tablist
element to switch modes without a code branch in the template.

Disabled tabs: emit `aria-disabled="true"`, do NOT emit native `disabled` attribute. A disabled tab
must remain in the roving tab order (APG); the Java action and the enhancer both enforce no-activation.

Every panel with no focusable child gets `tabindex="0"` (required by APG to keep it in the page tab
sequence). Omit `tabindex` on panels that have focusable children.

Minimal code to GREEN against the acceptance tests. The keyboard map and the focus management tests are
the contract — assert ALL of them. The escaping test is not optional; hostile tab ids MUST render inert.
