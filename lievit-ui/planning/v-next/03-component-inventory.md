<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 03 — Component inventory (PRIORITIZED, appropriate-complexity, NOT all of Ant Design)

STATUS: blueprint, 2026-06-23. The definitive v-next component set, scoped by what lievitKIT + gest
actually need FIRST, not by "Ant Design has it so we clone it". The discipline is the Appropriate Complexity
manifesto: ship the RIGHT set excellently, not the largest set (`~/knowledge/entities/libro-appropriate-complexity-manifesto.md`).

The current library already ships **68 JTE templates** (`registry/jte/*.jte`) + 12 enhancers + the kit's 7
families — the server-first refactor produced a Filament/shadcn-grade surface. So v-next is mostly a
RE-FORGE of an existing set (pin a11y to a source, upgrade styling, re-scope variants), with a small set of
NET-NEW components and a deliberate CUT list. It is NOT a 60-from-zero build.

## 0. The scoping rule (what gets in, what gets cut)

A component is IN the v-next definitive set iff it passes BOTH:
1. **Need test**: lievitKIT consumes it OR gest renders it OR it is a primitive those compose (the
   golden-path set). Long-tail "it exists in Ant Design" is NOT a reason.
2. **Server-first test**: it can be PARTIAL / WIRE / HTMX / (rarely) a typed-TS-enhanced server component
   without shipping a framework. A genuinely-client-only widget (rich data-grid with client virtualization,
   a WYSIWYG editor) is NOT in scope — it stays an adopter escape-hatch.

Everything else is CUT (or deferred to a long-tail wave) with the reason stated. Cutting is the point: a
copy-in/import registry rewards a curated owned set, not breadth (ADR-0009: "win on the model, not the
catalog"; the Vaadin-catalog game is a loser).

## 1. Legend for the table

- **a11y pattern** = the WAI-ARIA APG pattern + whether **react-aria** covers it (RA) or it is a
  **Radix-gap** needing a built implementation against the raw APG (BUILT). "platform" = a real native
  element supplies keyboard/focus, no enhancer needed.
- **AD features** = the Ant Design feature/variant set worth KEEPING vs CUT for a gestionale.
- **styling** = the Tailwind styling family (INSPIRATION-ONLY, original impl over `--lv-*`; never copied).
- **tier** = PARTIAL / WIRE / HTMX / +ENH (needs a typed-TS enhancer).
- **status** = COVERED (one of the 68 exists, re-forge) / NET-NEW / CUT / DEFER.
- **P** = priority: **P0** golden-path (lievitKIT + gest need first) · **P1** common admin · **P2** long-tail.

---

## 2. The definitive set (P0 + P1) — IN scope

### 2.a Form controls + inputs (the gestionale core — P0)

| Component | a11y pattern | AD features keep / cut | styling | tier | status | P |
|---|---|---|---|---|---|---|
| button | APG Button (platform) | sizes, variants, icon-only, loading; CUT block/shape-circle | Button | PARTIAL | COVERED | P0 |
| input | APG textbox (platform) | prefix/suffix, clearable; CUT search-compound (compose) | Input | PARTIAL (`l:model`) | COVERED | P0 |
| textarea | APG textbox (platform) | autosize (enhancer), count | Textarea | PARTIAL+ENH | COVERED | P0 |
| native-select | APG listbox via native `<select>` (platform) | sizes; CUT custom-render (that's combobox) | Select (native) | PARTIAL | COVERED | P0 |
| select (rich) | APG Listbox + RA `useSelect` (RA) | search, groups, custom option render | Select | WIRE/HTMX +ENH (`collection-nav`) | COVERED (combobox/rich) | P0 |
| combobox | APG Combobox + RA `useComboBox` (RA) | async search, free-typing | WIRE/HTMX +ENH | COVERED | P0 |
| checkbox | APG Checkbox (platform) | indeterminate | Checkbox | PARTIAL (`l:model`) | COVERED | P0 |
| radio-group | APG Radio Group (platform roving) | button-style group | Radio | PARTIAL | COVERED | P0 |
| switch | APG Switch (platform `aria-checked`) | sizes, loading | Switch | PARTIAL | COVERED | P0 |
| label | native `<label>` (platform) | required marker | — | PARTIAL | COVERED | P0 |
| field | wrapper (label+control+error+hint) | inline/stacked, error region `aria-describedby` | Form item | PARTIAL | COVERED | P0 |
| form | `<form>` + error summary | — | Form | PARTIAL | COVERED | P0 |
| input-group | grouped control + addon | addon before/after | Input.Group | PARTIAL | COVERED | P1 |
| input-otp | APG (BUILT: segmented, auto-advance, paste) | — | — | WIRE+ENH | COVERED | P1 |
| date-picker | APG + RA `useDatePicker` (RA, the hard a11y one) | range; native fallback; CUT time-only for now | DatePicker | +ENH / native fallback | COVERED | P0 |
| slider | APG Slider (platform `<input range>`) | range (BUILT), marks | Slider | PARTIAL | COVERED | P1 |
| toggle / toggle-buttons | APG Toggle `aria-pressed` (platform) | group (toggle-buttons) | — | PARTIAL/WIRE | COVERED | P1 |
| tags-input | APG (BUILT: token entry, remove, keyboard) | — | — | +ENH | COVERED | P1 |
| checkbox-list | APG group (BUILT) | select-all | — | PARTIAL+ENH | COVERED | P1 |
| key-value-input | BUILT (dynamic row pairs) | — | — | +ENH | COVERED | P2 |
| color-picker | BUILT (`<input color>` + swatches) | — | — | +ENH | COVERED | P2 |
| file-upload | APG (BUILT: drag-drop, list) + `l:upload` | multi, progress | Upload | WIRE+ENH | NET-NEW (refactor blueprint named it; verify shipped) | P1 |

### 2.b Overlays (all compose the ONE popover/focus-trap seam — P0)

| Component | a11y pattern | AD features keep / cut | styling | tier | status | P |
|---|---|---|---|---|---|---|
| dialog / modal | APG Dialog (modal) + RA `useDialog` + focus-trap (RA + BUILT trap) | sizes, footer actions; CUT confirm-as-static (compose) | Modal | WIRE +ENH (`focus-trap`, popover seam) | COVERED (modal) | P0 |
| alert-dialog | APG Alertdialog (RA) | — | — | PARTIAL over dialog | COVERED | P0 |
| drawer / slide-over | APG Dialog (non-modal/modal) + trap | side, sizes | Drawer | WIRE +ENH | COVERED | P0 |
| sheet | drawer variant w/ header+footer | — | — | WIRE | COVERED | P1 |
| popover | APG (native `popover` + anchor) — the SEAM | placement | Popover | WIRE/vanilla (the seam) | COVERED | P0 |
| dropdown-menu | APG Menu + RA `useMenu` roving (RA) | submenu, sections, danger item | Dropdown | WIRE/HTMX +ENH (`collection-nav`) | COVERED | P0 |
| context-menu | APG Menu (right-click) | — | — | WIRE +ENH | COVERED | P1 |
| tooltip | APG Tooltip (platform `popover`/CSS) | placement | Tooltip | PARTIAL | COVERED | P1 |
| hover-card | content preview (CSS `:hover`/`popover`) | — | — | PARTIAL | COVERED | P2 |
| command (palette) | APG Combobox/listbox (RA) + BUILT filter | groups, recents | — | WIRE/HTMX +ENH | COVERED | P1 |

### 2.c Navigation + layout (P0/P1)

| Component | a11y pattern | AD features keep / cut | styling | tier | status | P |
|---|---|---|---|---|---|---|
| tabs | APG Tabs (RA `useTabList` roving) | content swap (HTMX) | Tabs | WIRE/HTMX +ENH | COVERED | P0 |
| accordion | APG Accordion (platform `<button>`+region) | single/multiple | Collapse | WIRE | COVERED | P0 |
| breadcrumb | APG (nav of `<a>`) | — | Breadcrumb | PARTIAL | COVERED | P0 |
| pagination | APG (nav, `aria-current`) | numbered, jump | Pagination | PARTIAL | COVERED | P0 |
| sidebar | APG nav + collapse | collapse persist (enhancer) | — | PARTIAL+ENH | COVERED | P0 |
| navigation-menu | APG (nav + rich panels) | — | Menu | WIRE/PARTIAL | COVERED | P1 |
| section / card | container + header slot | collapsible (compose accordion) | Card | PARTIAL | COVERED | P0 |
| separator | `<hr role=separator>` (platform) | vertical | Divider | PARTIAL | COVERED | P0 |
| scroll-area | native scroll + ARIA | — | — | PARTIAL | COVERED | P2 |
| aspect-ratio | CSS only | — | — | PARTIAL | COVERED | P2 |
| loading-section / skeleton / spinner | `role=status` / `aria-busy` | — | Skeleton/Spin | PARTIAL | COVERED | P0 |

### 2.d Data display (the kit-facing set — P0)

| Component | a11y pattern | AD features keep / cut | styling | tier | status | P |
|---|---|---|---|---|---|---|
| table / data-table | APG (table, sortable `aria-sort`, `scope`) | server sort/paginate/filter (HTMX), bulk-select, row actions; CUT client-virtual-grid (escape-hatch) | Table | HTMX (server) | COVERED (kit Table) | P0 |
| data-list / description-list / key-value | APG list / `<dl>` | — | Descriptions | PARTIAL | COVERED | P1 |
| badge / chip | status pill (display) | dot, intents | Tag/Badge | PARTIAL | COVERED | P0 |
| avatar | display + `alt` | group/stack (kit) | Avatar | PARTIAL | COVERED | P0 |
| alert | banner, `role` by intent | closable | Alert | PARTIAL | COVERED | P0 |
| toast / notification-bell | `role=status` live region | auto-dismiss, queue | Notification | PARTIAL+ENH (vanilla) | COVERED | P0 |
| progress | APG progressbar | indeterminate | Progress | PARTIAL | COVERED | P1 |
| stat-card | display | trend | Statistic | PARTIAL | COVERED | P1 |
| empty | display | — | Empty | PARTIAL | COVERED | P1 |
| icon | `aria-hidden` / `aria-label` | Lucide set | — | PARTIAL | COVERED | P0 |
| item / kbd / link | display primitives | — | — | PARTIAL | COVERED | P1 |
| infolist-entry | kit display row | — | Descriptions | PARTIAL | COVERED | P1 |
| chart | server-rendered SVG from typed data | bar/line/area; CUT interactive (escape-hatch) | (Recharts-shape) | PARTIAL (server SVG) | COVERED | P2 |

### 2.e Filament-grade composite builders (the kit's reason to exist — P1)

| Component | a11y pattern | AD features keep / cut | styling | tier | status | P |
|---|---|---|---|---|---|---|
| builder | BUILT (block builder, reorder) | — | — | +ENH | COVERED | P2 |
| repeater | BUILT (dynamic record rows, reorder) | — | — | +ENH | COVERED | P1 |
| wizard | APG (stepper, `aria-current`) | linear/skippable | Steps | WIRE | COVERED | P1 |
| theme-switcher | BUILT (light/dark, `data-theme`) | — | — | +ENH | COVERED | P1 |
| button-group / toggle-buttons | APG group | — | — | PARTIAL | COVERED | P1 |

---

## 3. The CUT list (NOT shipped — appropriate-complexity in action)

The server-first refactor already DROPPED carousel, menubar, resizable, scroll-area-custom, light-dom. v-next
keeps them cut and adds:

| Cut | Why (the appropriate-complexity reason) |
|---|---|
| carousel | autoplay slider, no gestionale use, heavy-client with no server value (already dropped) |
| menubar | desktop File/Edit menubar; no admin use |
| resizable panes | drag-resize, heavy-client, no admin need |
| custom scrollbar overlay | native scroll is fine; pointer-only value |
| tree-view (client) | DEFER P2: a server-rendered tree (`<details>` nesting) covers most; a client virtual tree is an escape-hatch |
| transfer (dual-list) | DEFER P2: composes two listboxes + buttons; build only if a real screen needs it |
| mentions / rich-text editor | OUT: a WYSIWYG is a genuinely-client widget → adopter escape-hatch, never a lievit primitive |
| client data-grid (virtualized) | OUT: the server-sorted/paginated kit Table covers admin; a client grid is the escape-hatch |
| cascader, tree-select | DEFER P2: niche; combobox + grouped options covers the common case |
| time-picker (standalone) | DEFER: native `<input type=time>` covers it; rich time-picker only if a screen needs it |
| calendar (interactive month-grid) | server-first wire grid + typed-TS drag (per refactor R1 resolution); NOT a Lit/@event-calendar island. Heavy; its own careful phase, P2. |

**Headline scope**: the definitive v-next set is **~60 components** (the ~68 current minus the dropped/merged
duplicates, plus file-upload + a few kit composites), of which **~32 are P0 golden-path**, ~22 P1, the rest
P2/long-tail. The CUT/DEFER list is ~10 components we deliberately do NOT build (or defer) — that restraint
IS the appropriate-complexity discipline. We are NOT cloning Ant Design's ~70-component catalog.

## 4. The single-source-a11y consolidation (cross-component, the convergence win)

Mapped from the table, the SHARED a11y mechanisms (built ONCE, reused — §2.b of the architecture contract):

| Shared mechanism | react-aria spec source | reused by |
|---|---|---|
| popover/anchor positioning + light-dismiss (the SEAM) | (native `popover` + CSS anchor; RA `useOverlayPosition` as spec ref) | dialog, drawer, popover, dropdown-menu, context-menu, combobox, select, tooltip, hover-card, date-picker, command |
| focus-trap (`focus-trap.enhancer.ts`, NET-NEW) | RA `FocusScope` interaction spec | dialog, modal, drawer, sheet, slide-over |
| collection roving + typeahead (`collection-nav.enhancer.ts`, NET-NEW) | RA `useListBox`/`useMenu`/`useTabList` | select, combobox, dropdown-menu, context-menu, command, navigation-menu, tabs |
| live-region announcer | RA `useToast` / APG status | toast, notification-bell, form error summary, async loading |

Building these THREE shared pieces well (popover seam already exists from Wave 3; trap + collection-nav are
net-new) is the highest-leverage a11y work: ~20 components inherit correct keyboard/focus from 3 sources
instead of 20 hand-rolls. This is the antidote to the "10 agents each hand-roll a focus trap" failure mode.

## 5. Open decisions for Francesco (inventory)

- **D11 — confirm the P0 set of ~32** is the right golden-path (it is derived from gest's actual `<lv-*>`
  usage + lievitKIT's families). Anything gest needs that's marked P1/P2 should be promoted. Flag.
- **D12 — calendar**: confirm it stays P2 + server-first-wire + typed-TS drag (refactor R1 resolution), NOT
  a re-introduced client island, even under the v-next "import-by-default" framing. Recommendation: hold the
  server-first line; it is the hardest piece and earns its own phase.
- **D13 — the OUT list (rich-text, client-grid, mentions)**: confirm these stay adopter escape-hatches, not
  lievit primitives. Recommendation: yes — they are genuinely-client widgets; owning them would betray the
  server-first thesis + appropriate-complexity.
