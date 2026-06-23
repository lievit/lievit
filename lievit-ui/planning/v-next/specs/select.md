<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — select (rich) (EXEMPLAR: complex-a11y, WIRE + collection-nav enhancer)

- **tier**: WIRE (+ HTMX for async option fetch) + ENH (`collection-nav.enhancer.ts`, the shared listbox
  roving/typeahead mechanism)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/combobox.jte` + `select`/`native-select`; the
  rich custom-rendered select, distinct from the platform `native-select` PARTIAL)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Listbox + Combobox + **react-aria `useSelect` / `useListBox` interaction model**
      as the pattern reference (the keyboard map + ARIA wiring + focus order, transcribed into ORIGINAL
      template + `collection-nav` enhancer; no react-aria source copied)
    - inventory: Ant Design Select as inventory reference (search, groups, custom option render; tags-mode
      lives in `tags-input`; a virtualized 10k-option list composes the data-grid virtualization enhancer)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is
A custom-rendered single-select: a trigger button + a popover listbox of options (token-styled, optionally
searchable + grouped), where the NATIVE `<select>` is insufficient (custom option markup, search, groups).
The SELECTION is a server fact (a `@Wire` field), so it is WIRE: the server holds the chosen value, renders
the trigger label + the listbox, and the client morphs on change. The one irreducible CLIENT behavior — the
listbox keyboard interaction (arrow roving, typeahead, Home/End, Esc) — is the shared `collection-nav`
enhancer, NOT a hand-roll and NOT a framework. (For a plain enum with no search/groups, use the
`native-select` PARTIAL instead; this rich select earns its complexity only when those features are needed.)

## 2. API — the WIRE surface + template params
**Java (`SelectComponent`)**:
| member | kind | meaning |
|---|---|---|
| `options` `List<Option>` | `@Wire @LievitProperty(locked=true)` | id+label(+group) option set — locked server config, a client cannot inject options |
| `value` `String` | `@Wire` | the selected option id (the single piece of selection state) |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | shown when value is blank |
| `searchable` `boolean` | `@Wire @LievitProperty(locked=true)` | enables the search box (filters via the enhancer client-side, or HTMX for async) |
| `query` `String` | `@Wire` | the live search text (when searchable; `l:model.debounce`) |
| `open` `boolean` | `@Wire` | listbox open-state |
| `select(String id)` | `@LievitAction` | sets `value`, closes; validates id ∈ options (authz/validation in Java BEFORE mutate) |
| `toggleOpen()` | `@LievitAction` | opens/closes the listbox |
| `visibleOptions()` | getter on `_instance` | options filtered by `query` (read by the template; `@LievitProperty(serialize=false)`) |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param SelectComponent _instance` (for `visibleOptions()`). No `Content` slot (WIRE has none).

## 3. Variants / sizes / states
- size: sm|md|lg, height-based — the trigger aligns flush with `button`/`input` of the same size.
- states: `disabled`; `aria-invalid` → destructive border+ring; `aria-expanded` reflects `open`;
  `aria-busy` during the wire round-trip (runtime). The selected option shows `aria-selected="true"`.

## 4. The a11y contract (the heart)
- **WAI-ARIA pattern**: APG Listbox (collapsible, single-select) with a button trigger; when `searchable`,
  the APG Combobox pattern (the search input is a `combobox`, the list is its `listbox`).
- **roles + ARIA**:
    - trigger: `<button role="combobox"` (when searchable) `aria-haspopup="listbox" aria-expanded="${open}"
      aria-controls="<listboxId>"`; the accessible name = the selected label or placeholder.
    - listbox: `role="listbox"` id=`<listboxId>` `aria-labelledby`→ the field label; each option
      `role="option" id=... aria-selected="${id == value}"`; the active descendant via
      `aria-activedescendant="<activeOptionId>"` on the trigger/search input (managed by `collection-nav`).
    - groups: `role="group" aria-labelledby` → a `role="presentation"` group header.
    - search input (searchable): `role="combobox" aria-autocomplete="list" aria-controls="<listboxId>"`.
- **keyboard map** (the load-bearing table — `collection-nav` owns the non-platform keys):
  | key | does | who |
  |---|---|---|
  | Enter / Space (on trigger) | open the listbox, focus active option | enhancer |
  | ArrowDown / ArrowUp | move active option (roving via `aria-activedescendant`); opens if closed | enhancer |
  | Home / End | first / last option | enhancer |
  | typeahead (a-z) | jump to the option whose label starts with the typed prefix | enhancer |
  | Enter (option active) | `select(activeId)` → fires the wire action | enhancer → wire |
  | Esc | close the listbox, return focus to the trigger | enhancer |
  | Tab | close + move focus on (no trap — a listbox is non-modal) | enhancer + platform |
  | (searchable) typing | filters; `l:model.debounce` updates `query`; list re-renders | wire + enhancer keeps active in view |
- **focus management**: focus stays on the trigger (or search input); the ACTIVE option is virtual
  (`aria-activedescendant`), NOT DOM focus — this is the APG listbox model, supplied by `collection-nav`.
  On open, the active option = the selected one (or first). On close, focus returns to the trigger. No trap
  (non-modal); composes the **popover seam** for positioning + light-dismiss.
- **live region**: optional — announce the result count when searchable ("12 results"), via the shared announcer.
- **shared mechanisms composed**: `collection-nav.enhancer.ts` (roving + typeahead + activedescendant) +
  the popover seam (anchor + light-dismiss). Do NOT re-implement either; this component is the canonical
  CONSUMER that proves both.

## 5. Tokens
Reads `--lv-color-{popover,popover-fg,border,input,accent,accent-fg,primary,ring,fg,muted}`,
`--lv-space-{2,3,4,9,…}`, `--lv-radius-md`, `--lv-shadow-md` (the popover elevation), `--lv-z-popover`,
`--lv-ring`. NET-NEW: none (the listbox surface reuses popover + accent tokens).

## 6. Wire actions
- `l:click="toggleOpen"` on the trigger; `l:click="$set('...')"`-style arming is NOT used (selection carries
  an id → use the SAFE per-option channel: each option emits `l:click="select" data-id="<escaped id>"`, the
  enhancer/handler reads `dataset.id`; or the enhancer calls `select(activeId)` directly on Enter).
- searchable: `l:model.debounce.200ms="query"` on the search input → re-renders `visibleOptions()`. For
  ASYNC options (server-side fetch), the HTMX variant swaps the listbox fragment on input (debounced).
- round-trip: open → render listbox → arrow/typeahead (client, no round-trip) → Enter/click → `select(id)`
  wire call → server sets `value` + `open=false` → re-render → morph (trigger now shows the chosen label).
- the enhancer registers a directive that maps the keyboard map to `aria-activedescendant` updates (client,
  no round-trip) and fires the `select` wire action only on commit (Enter/click).

## 7. Acceptance tests
- **render** (real LievitRuntime + jsdom, the REAL enhancer mounted — NOT a mocked `$lievit`): open the
  listbox, assert the options render with `role=option` + correct `aria-selected`; select one, assert the
  trigger label + `value` changed after the morph.
- **axe-core**: zero violations of the Listbox/Combobox rules on the open listbox DOM.
- **keyboard** (the §4 map, each asserted on the REAL enhancer): ArrowDown moves activedescendant; typeahead
  jumps; Enter selects + fires the wire action; Esc closes + restores focus; Home/End hit the ends.
- **focus**: on open, active = selected; on close, focus returns to the trigger; activedescendant (not DOM
  focus) tracks the active option.
- **search**: typing filters `visibleOptions()`; the active option stays in view; result-count announced.
- **wire round-trip IT** (lievit-kit, real runtime, CollapsibleComponentIT pattern): mount → select →
  re-render asserts the new value + closed state in the rendered DOM.
- **escaping**: an option whose id contains a hostile string renders inert via the escaped `data-id` channel.
- **Playwright** (gesture fidelity): real `page.keyboard` arrow+Enter selects on the legacy-VM oracle; the
  panel body shows resolved option labels (not a fake substrate — the client-island-fidelity lesson).

## 8. Agent instructions
Style ORIGINALLY over `--lv-*`; read public APG Listbox/Combobox + React Aria `useSelect` SPEC + Ant Design
Select feature set from training; never paste literal source from react-aria / ant-design / Tailwind UI
(the one bright line, `02`) — generate original code. Compose `collection-nav` + the popover
seam — do NOT hand-roll roving, typeahead, or positioning (that is the failure mode this whole single-source
rule prevents). Validate the selected id ∈ options in the Java action BEFORE mutating `value`. Mirror the
WIRE conventions (server-first refactor blueprint §1.b): owned template markup, boolean state as JTE boolean
attribute, no `Content` slot. Minimal code to GREEN; the keyboard map is the contract — assert ALL of it.
