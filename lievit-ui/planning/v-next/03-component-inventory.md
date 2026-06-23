<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 03 — Component inventory (COMPLETE, 100%, no MMP cut)

STATUS: blueprint, 2026-06-23. **DECIDED (Francesco): "no MMP ma completo al 100% non negoziabile" +
"ha senso clonare tutti i componenti".** The definitive v-next set is the COMPLETE library — the full
ant-design-equivalent surface, every component included (rich-text editor, virtualized data-grid,
mentions, transfer, cascader/tree-select, time-picker, the lot). There is NO cut list and NO P0-first
MMP slice. Priority survives ONLY as a build SEQUENCE (what to build first), never as a scope cut.

**Appropriate-complexity, reframed for a DEFINITIVE library**: for a component library whose whole
value proposition is "you adopt it because it has EVERYTHING you'll ever need", COMPLETENESS is the
right complexity. A half-set forces the adopter back to a second library for the long-tail, which
defeats the reason to adopt at all. The discipline is not "ship fewer components"; it is "ship every
component EXCELLENTLY, server-first, with pinned a11y" — restraint lives in HOW each is built (no
gratuitous variants, one shared a11y source), not in WHICH are built.

The current library already ships **68 JTE templates** (`registry/jte/*.jte`) + 12 enhancers + the
kit's 7 families. So v-next is mostly a RE-FORGE of an existing set (pin a11y to a source, upgrade
styling, re-scope variants) PLUS the genuinely-client widgets that were previously deferred and are now
IN (data-grid, rich-text, mentions, transfer, cascader/tree-select, time-picker, interactive
calendar). It is not a build-from-zero.

## 0. The scoping rule (everything an admin/gestionale surface can need is IN)

A component is IN the definitive set iff it is part of a COMPLETE admin/gestionale UI library — i.e. it
has an Ant-Design equivalent OR lievitKIT/gest composes it OR it is a primitive those compose. The old
two-gate "need test + server-first test" is RELAXED: the server-first TIER still decides HOW a component
is built (PARTIAL / WIRE / HTMX / +ENH), but a genuinely-client widget is no longer a reason to CUT —
it is built as a typed-TS enhancer over a server-rendered shell (the +ENH tier), the same escape-hatch
mechanism, now used as a first-class build path rather than a deferral.

The server-first thesis is NOT abandoned: a rich data-grid is still a server-sorted/paginated table
with a typed-TS virtualization enhancer for the irreducible client bit; a rich-text editor is a
server-persisted value with a typed-TS editing enhancer. "Genuinely-client" means "needs a typed-TS
enhancer", not "needs a framework" — no Lit, no React, no Alpine (ADR-0012 holds).

## 1. Legend for the table

- **a11y pattern** = the WAI-ARIA APG pattern + whether **react-aria** is the pattern reference (RA) or
  it is a **gap** built against the raw APG (BUILT). "platform" = a real native element supplies
  keyboard/focus, no enhancer needed.
- **AD features** = the Ant Design feature/variant set worth KEEPING vs trimming for a gestionale.
- **styling** = the Tailwind styling family (INSPIRATION-ONLY, original generation over `--lv-*`; never
  copied — `02-licensing.md`).
- **tier** = PARTIAL / WIRE / HTMX / +ENH (needs a typed-TS enhancer).
- **status** = COVERED (one of the 68 exists, re-forge) / NET-NEW.
- **Seq** = build SEQUENCE only (NOT a scope cut): **S0** golden-path (build first) · **S1** common
  admin · **S2** long-tail / heaviest-client (build last). Everything ships; this is just the order.

---

## 2. The definitive set — ALL of it is IN scope

### 2.a Form controls + inputs (the gestionale core)

| Component | a11y pattern | AD features keep / trim | styling | tier | status | Seq |
|---|---|---|---|---|---|---|
| button | APG Button (platform) | sizes, variants, icon-only, loading; block/shape-circle optional | Button | PARTIAL | COVERED | S0 |
| input | APG textbox (platform) | prefix/suffix, clearable; search-compound (compose) | Input | PARTIAL (`l:model`) | COVERED | S0 |
| textarea | APG textbox (platform) | autosize (enhancer), count | Textarea | PARTIAL+ENH | COVERED | S0 |
| native-select | APG listbox via native `<select>` (platform) | sizes | Select (native) | PARTIAL | COVERED | S0 |
| select (rich) | APG Listbox + RA `useSelect` (RA) | search, groups, custom option render | Select | WIRE/HTMX +ENH (`collection-nav`) | COVERED | S0 |
| combobox | APG Combobox + RA `useComboBox` (RA) | async search, free-typing | Select | WIRE/HTMX +ENH | COVERED | S0 |
| checkbox | APG Checkbox (platform) | indeterminate | Checkbox | PARTIAL (`l:model`) | COVERED | S0 |
| radio-group | APG Radio Group (platform roving) | button-style group | Radio | PARTIAL | COVERED | S0 |
| switch | APG Switch (platform `aria-checked`) | sizes, loading | Switch | PARTIAL | COVERED | S0 |
| label | native `<label>` (platform) | required marker | — | PARTIAL | COVERED | S0 |
| field | wrapper (label+control+error+hint) | inline/stacked, `aria-describedby` error region | Form item | PARTIAL | COVERED | S0 |
| form | `<form>` + error summary | — | Form | PARTIAL | COVERED | S0 |
| input-group | grouped control + addon | addon before/after | Input.Group | PARTIAL | COVERED | S1 |
| input-otp | APG (BUILT: segmented, auto-advance, paste) | — | — | WIRE+ENH | COVERED | S1 |
| date-picker | APG + RA `useDatePicker` (RA, the hard a11y one) | range; native fallback | DatePicker | +ENH / native fallback | COVERED | S0 |
| time-picker | APG (BUILT: time spinbuttons) + native `<input type=time>` baseline | rich time grid, step, 12/24h | TimePicker | +ENH | NET-NEW | S2 |
| slider | APG Slider (platform `<input range>`) | range (BUILT), marks | Slider | PARTIAL | COVERED | S1 |
| toggle / toggle-buttons | APG Toggle `aria-pressed` (platform) | group | — | PARTIAL/WIRE | COVERED | S1 |
| tags-input | APG (BUILT: token entry, remove, keyboard) | — | — | +ENH | COVERED | S1 |
| mentions | APG Combobox over a textarea (BUILT: trigger char, popup listbox) | `@`/`#` triggers, async suggest | Mentions | +ENH (`collection-nav`) | NET-NEW | S2 |
| checkbox-list | APG group (BUILT) | select-all | — | PARTIAL+ENH | COVERED | S1 |
| key-value-input | BUILT (dynamic row pairs) | — | — | +ENH | COVERED | S1 |
| color-picker | BUILT (`<input color>` + swatches) | — | — | +ENH | COVERED | S1 |
| file-upload | APG (BUILT: drag-drop, list) + `l:upload` | multi, progress | Upload | WIRE+ENH | COVERED (verify shipped) | S1 |
| rich-text editor | APG textbox + toolbar (BUILT: contenteditable + roving toolbar) | bold/italic/list/link/headings; server-persisted value | (no AD core; ProseMirror-shape) | WIRE +ENH | NET-NEW | S2 |
| cascader | APG tree/listbox (BUILT: multi-level select) | multi-level, search | Cascader | WIRE +ENH (`collection-nav`) | NET-NEW | S2 |
| tree-select | APG tree + combobox (BUILT) | checkable tree, search | TreeSelect | WIRE +ENH | NET-NEW | S2 |
| transfer (dual-list) | APG (BUILT: two listboxes + move buttons) | search both sides, bulk move | Transfer | WIRE +ENH (`collection-nav`) | NET-NEW | S2 |

### 2.b Overlays (all compose the ONE popover/focus-trap seam)

| Component | a11y pattern | AD features keep / trim | styling | tier | status | Seq |
|---|---|---|---|---|---|---|
| dialog / modal | APG Dialog (modal) + RA `useDialog` + focus-trap (RA ref + BUILT trap) | sizes, footer actions | Modal | WIRE +ENH (`focus-trap`, popover seam) | COVERED | S0 |
| alert-dialog | APG Alertdialog (RA) | — | — | PARTIAL over dialog | COVERED | S0 |
| drawer / slide-over | APG Dialog (non-modal/modal) + trap | side, sizes | Drawer | WIRE +ENH | COVERED | S0 |
| sheet | drawer variant w/ header+footer | — | — | WIRE | COVERED | S1 |
| popover | APG (native `popover` + anchor) — the SEAM | placement | Popover | WIRE/vanilla (the seam) | COVERED | S0 |
| dropdown-menu | APG Menu + RA `useMenu` roving (RA) | submenu, sections, danger item | Dropdown | WIRE/HTMX +ENH (`collection-nav`) | COVERED | S0 |
| context-menu | APG Menu (right-click) | — | — | WIRE +ENH | COVERED | S1 |
| menubar | APG Menubar (BUILT: desktop File/Edit, roving) | top-level + submenus | Menu (mode=horizontal) | WIRE +ENH (`collection-nav`) | NET-NEW | S2 |
| tooltip | APG Tooltip (platform `popover`/CSS) | placement | Tooltip | PARTIAL | COVERED | S1 |
| hover-card | content preview (CSS `:hover`/`popover`) | — | — | PARTIAL | COVERED | S1 |
| command (palette) | APG Combobox/listbox (RA) + BUILT filter | groups, recents | — | WIRE/HTMX +ENH | COVERED | S1 |

### 2.c Navigation + layout

| Component | a11y pattern | AD features keep / trim | styling | tier | status | Seq |
|---|---|---|---|---|---|---|
| tabs | APG Tabs (RA `useTabList` roving) | content swap (HTMX) | Tabs | WIRE/HTMX +ENH | COVERED | S0 |
| accordion | APG Accordion (platform `<button>`+region) | single/multiple | Collapse | WIRE | COVERED | S0 |
| breadcrumb | APG (nav of `<a>`) | — | Breadcrumb | PARTIAL | COVERED | S0 |
| pagination | APG (nav, `aria-current`) | numbered, jump | Pagination | PARTIAL | COVERED | S0 |
| sidebar | APG nav + collapse | collapse persist (enhancer) | — | PARTIAL+ENH | COVERED | S0 |
| navigation-menu | APG (nav + rich panels) | — | Menu | WIRE/PARTIAL | COVERED | S1 |
| section / card | container + header slot | collapsible (compose accordion) | Card | PARTIAL | COVERED | S0 |
| separator | `<hr role=separator>` (platform) | vertical | Divider | PARTIAL | COVERED | S0 |
| scroll-area | native scroll + ARIA (+ optional custom-scrollbar overlay enhancer) | overlay scrollbar | — | PARTIAL+ENH | COVERED | S1 |
| resizable panes | APG (BUILT: separator role, keyboard resize) | horizontal/vertical, persist | — | +ENH | NET-NEW | S2 |
| aspect-ratio | CSS only | — | — | PARTIAL | COVERED | S2 |
| loading-section / skeleton / spinner | `role=status` / `aria-busy` | — | Skeleton/Spin | PARTIAL | COVERED | S0 |

### 2.d Data display (the kit-facing set)

| Component | a11y pattern | AD features keep / trim | styling | tier | status | Seq |
|---|---|---|---|---|---|---|
| table / data-table | APG (table, sortable `aria-sort`, `scope`) | server sort/paginate/filter (HTMX), bulk-select, row actions | Table | HTMX (server) | COVERED (kit Table) | S0 |
| data-grid (virtualized) | APG grid (BUILT: `role=grid`, arrow-nav, virtualization enhancer) | client virtual rows/cols, frozen cols, inline edit; server-fetched | Table (virtual) | WIRE/HTMX +ENH | NET-NEW | S2 |
| tree-view | APG Tree (BUILT: `role=tree`, arrow-nav, expand) | server `<details>` baseline + client virtual tree enhancer | Tree | PARTIAL + (+ENH for virtual) | NET-NEW | S2 |
| data-list / description-list / key-value | APG list / `<dl>` | — | Descriptions | PARTIAL | COVERED | S1 |
| badge / chip | status pill (display) | dot, intents | Tag/Badge | PARTIAL | COVERED | S0 |
| avatar | display + `alt` | group/stack (kit) | Avatar | PARTIAL | COVERED | S0 |
| alert | banner, `role` by intent | closable | Alert | PARTIAL | COVERED | S0 |
| toast / notification-bell | `role=status` live region | auto-dismiss, queue | Notification | PARTIAL+ENH (vanilla) | COVERED | S0 |
| progress | APG progressbar | indeterminate | Progress | PARTIAL | COVERED | S1 |
| stat-card | display | trend | Statistic | PARTIAL | COVERED | S1 |
| empty | display | — | Empty | PARTIAL | COVERED | S1 |
| icon | `aria-hidden` / `aria-label` | Lucide set | — | PARTIAL | COVERED | S0 |
| item / kbd / link | display primitives | — | — | PARTIAL | COVERED | S1 |
| infolist-entry | kit display row | — | Descriptions | PARTIAL | COVERED | S1 |
| carousel | APG (BUILT: `aria-roledescription=carousel`, prev/next, autoplay pause) | autoplay, dots, swipe | Carousel | +ENH | NET-NEW | S2 |
| chart | server-rendered SVG from typed data + optional interactive enhancer | bar/line/area; interactive tooltips (enhancer) | (Recharts-shape) | PARTIAL (server SVG) +ENH | COVERED | S2 |

### 2.e Filament-grade composite builders + heavy-client surfaces

| Component | a11y pattern | AD features keep / trim | styling | tier | status | Seq |
|---|---|---|---|---|---|---|
| builder | BUILT (block builder, reorder) | — | — | +ENH | COVERED | S2 |
| repeater | BUILT (dynamic record rows, reorder) | — | — | +ENH | COVERED | S1 |
| wizard | APG (stepper, `aria-current`) | linear/skippable | Steps | WIRE | COVERED | S1 |
| theme-switcher | BUILT (light/dark, `data-theme`) | — | — | +ENH | COVERED | S1 |
| button-group / toggle-buttons | APG group | — | — | PARTIAL | COVERED | S1 |
| calendar (interactive month-grid) | APG Grid (BUILT: arrow-nav month grid) + typed-TS drag | month/week/day, drag-move/resize events | (FullCalendar-shape) | WIRE +ENH | NET-NEW | S2 |

---

## 3. No CUT list — everything ships

The previous draft CUT ~10 components on the old appropriate-complexity reading (carousel, menubar,
resizable, tree/data-grid client, transfer, cascader, tree-select, time-picker, rich-text, mentions,
interactive calendar). Under Francesco's ruling they are ALL back IN (see §2). They are not primitives
to avoid; they are the long-tail that MAKES the library definitive. The only discipline is the build
TIER: each genuinely-client widget is a server-rendered shell + a typed-TS enhancer for the irreducible
client bit (no framework, ADR-0012 holds) — the +ENH path, used as a first-class build, not a deferral.

The heaviest-client ones (data-grid virtualization, rich-text, interactive calendar) are sequenced LAST
(S2) because they earn their own careful phase, NOT because they are cut. Sequence ≠ scope. The exit
condition for v-next is the COMPLETE set green, not a P0 slice.

**Headline scope**: the definitive v-next set is the **COMPLETE library** — the ~60 server-first
components already in the surface PLUS the ~12 genuinely-client/long-tail components now promoted IN
(time-picker, mentions, rich-text, cascader, tree-select, transfer, menubar, resizable, data-grid,
tree-view, carousel, interactive calendar) ≈ **70+ components**, every one built. We ARE matching Ant
Design's completeness, server-first, because completeness is the value proposition of a definitive
library.

## 4. The single-source-a11y consolidation (cross-component, the convergence win)

Mapped from the table, the SHARED a11y mechanisms (built ONCE, reused — §2.b of the architecture
contract). With the full inventory IN, these shared mechanisms now serve EVEN MORE components, so the
leverage is higher, not lower:

| Shared mechanism | react-aria pattern reference | reused by |
|---|---|---|
| popover/anchor positioning + light-dismiss (the SEAM) | (native `popover` + CSS anchor; RA `useOverlayPosition` as pattern ref) | dialog, drawer, popover, dropdown-menu, context-menu, menubar, combobox, select, tooltip, hover-card, date-picker, time-picker, command, cascader, tree-select, mentions |
| focus-trap (`focus-trap.enhancer.ts`, NET-NEW) | RA `FocusScope` interaction pattern | dialog, modal, drawer, sheet, slide-over |
| collection roving + typeahead (`collection-nav.enhancer.ts`, NET-NEW) | RA `useListBox`/`useMenu`/`useTabList` | select, combobox, dropdown-menu, context-menu, menubar, command, navigation-menu, tabs, cascader, tree-select, transfer, mentions, data-grid, tree-view |
| live-region announcer | RA `useToast` / APG status | toast, notification-bell, form error summary, async loading |

Building these THREE shared pieces well (popover seam already exists from Wave 3; trap + collection-nav
are net-new) is the highest-leverage a11y work: ~30 components inherit correct keyboard/focus from 3
sources instead of 30 hand-rolls. This is the antidote to the "N agents each hand-roll a focus trap"
failure mode, and it is MORE valuable now that the inventory is complete.

## 5. Open decisions for Francesco (inventory)

- **D11 — DECIDED**: the definitive set is the COMPLETE library (100%, no MMP cut). Priority is a build
  SEQUENCE (S0→S1→S2), not a scope cut. S0 is still derived from gest's actual `<lv-*>` usage +
  lievitKIT's families (build those first); everything else still ships.
- **D12 — DECIDED**: the interactive calendar is IN (S2), built server-first-wire + typed-TS drag
  (refactor R1 resolution), NOT a re-introduced Lit/@event-calendar island. It is the hardest piece and
  earns its own S2 phase — but it ships.
- **D13 — DECIDED**: the previously-OUT widgets (rich-text, client data-grid, mentions, transfer,
  cascader, tree-select, time-picker, menubar, resizable, carousel, tree-view) are ALL IN, each built
  as a server-rendered shell + a typed-TS enhancer (+ENH tier), never a framework. The server-first
  thesis is preserved by the enhancer mechanism, not by cutting the component.
