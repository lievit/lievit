<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — combobox (WIRE + collection-nav enhancer)

- **tier**: WIRE (+ optional HTMX for async suggestion fetch) + ENH (`collection-nav.enhancer.ts`,
  the shared listbox roving/typeahead mechanism, the same one `select` consumes)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/combobox.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Combobox (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) +
      APG example "Editable Combobox with List Autocomplete"
      (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/) +
      **react-aria `useComboBox` interaction model** as the keyboard/focus pattern reference
      (transcribed into ORIGINAL template + `collection-nav` enhancer; no react-aria source copied)
    - inventory: Ant Design AutoComplete / Select with search as inventory reference (async fetch,
      free-type, groups, custom option render, clear button, loading state)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

---

## 1. What it is

A combobox is an editable text field paired with a collapsible listbox of suggestions.
The user can type freely (free-type mode, value = whatever they typed) or must select from the
list (select-only mode, value = a suggestion id), with the suggestions filtered as they type.
The distinction between combobox and rich `select` is the EDITABLE INPUT: the combobox exposes a
real `<input type="text">` (not a button-trigger), so typed text and partial matches are first-class.

The selected VALUE is a server fact (`@Wire`), so this is WIRE: the server holds the confirmed value
+ the suggestion set, renders them, and the client morphs on commit.
The irreducible CLIENT behavior — real-time list filtering as the user types, listbox keyboard
navigation (ArrowUp/Down, Home/End, typeahead), `aria-activedescendant` management while DOM focus
stays on the input, and light-dismiss — is the shared `collection-nav.enhancer.ts`, NOT a hand-roll.

Distinct from:
- `select (rich)`: trigger is a button, not a text input; no free-typing.
- `native-select`: the browser's `<select>`; use when no search/groups/custom render is needed.
- `tags-input`: multiple values; different APG pattern.
- `command`: a keyboard-driven palette with richer layout — composes the same `collection-nav`
  but has its own spec.

---

## 2. API — the WIRE surface + template params

**Java (`ComboboxComponent`)**:

| member | kind | meaning |
|---|---|---|
| `suggestions` `List<Suggestion>` | `@Wire @LievitProperty(locked=true)` | the full candidate set (id + label + optional group + optional metadata); locked: a client cannot inject suggestions |
| `value` `String` | `@Wire` | the committed value: an option id in `select-only` mode, or the free-typed text in `free-type` mode |
| `inputText` `String` | `@Wire` | the live text currently visible in the input field; may differ from `value` while the user is typing but has not committed |
| `open` `boolean` | `@Wire` | listbox open-state |
| `loading` `boolean` | `@Wire` | set true by the server while an async suggestion fetch is in flight; the template shows a spinner + `aria-busy` on the listbox region |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | shown in the input when `inputText` is blank |
| `mode` `String` | `@Wire @LievitProperty(locked=true)` | `"free-type"` (default) or `"select-only"` — controls whether the user may commit a value not in the list |
| `autocomplete` `String` | `@Wire @LievitProperty(locked=true)` | `"none"` \| `"list"` \| `"both"` — matches `aria-autocomplete`; drives inline completion rendering |
| `clearable` `boolean` | `@Wire @LievitProperty(locked=true)` | shows an × clear button when `inputText` is non-empty |
| `disabled` `boolean` | `@Wire @LievitProperty(locked=true)` | disables the input and the toggle button; reflected via native `disabled` on the input |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `"sm"` \| `"md"` \| `"lg"` — height-based, toolbar-aligned; default `"md"` |
| `name` `String` | `@Wire @LievitProperty(locked=true)` | the HTML `name` of the hidden `<input>` that carries `value` to a form POST |
| `type(String inputText)` | `@LievitAction` | debounced on `l:input.debounce`; updates `inputText`, filters `visibleSuggestions()`, opens the listbox; for async mode fires the HTMX fetch; validation: bare update only, no business rule |
| `commit(String id)` | `@LievitAction` | called by Enter/click on an option; sets `value` = id (select-only) or label (free-type); sets `inputText` = the label; closes listbox; validates id ∈ suggestions in `select-only` mode (Java, BEFORE mutate) |
| `commitFreeText()` | `@LievitAction` | called on blur in `free-type` mode when `inputText` does not match any suggestion; sets `value = inputText`; closes listbox |
| `clear()` | `@LievitAction` | sets `value = ""`, `inputText = ""`, reopens the listbox (ready for new input) |
| `toggleOpen()` | `@LievitAction` | opens / closes the listbox via the optional toggle button |
| `visibleSuggestions()` | instance getter | suggestions filtered by `inputText` (client-side in sync mode); `@LievitProperty(serialize=false)` |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param ComboboxComponent _instance` (for `visibleSuggestions()`). No `Content` slot (WIRE has none —
server-first refactor blueprint §1.b: the body is OWNED markup, never a slot).

**Hidden form value bridge**: a `<input type="hidden" name="${name}" value="${value}">` is always
rendered so the combobox participates in a plain HTML form POST without requiring a wire round-trip.
The `name` param is the form-field name; the visible `<input type="text">` carries `inputText`, not
the final `value`.

---

## 3. Variants / sizes / states

**Modes** (the fundamental behavioral split, not a visual variant):
- `free-type` (default): the user may type anything; on blur or Enter with no active option,
  `commitFreeText()` commits `inputText` as `value`. Use for free-form fields (city name,
  search queries, tagging with new entries).
- `select-only`: `value` must be an id from the suggestion list; on blur without a committed match,
  `inputText` reverts to the last committed label. Use when the field must resolve to a known entity.

**Autocomplete** (drives the `aria-autocomplete` attribute + inline suffix rendering):
- `"none"`: popup shows the full list regardless of typed text; `aria-autocomplete="none"`.
- `"list"` (default): popup filters to matching suggestions; `aria-autocomplete="list"`.
- `"both"`: same as `"list"` but additionally inserts the best-match label as an inline suffix after
  the cursor, with the untyped suffix selected (so the next keystroke replaces it);
  `aria-autocomplete="both"`.

**Popup type**: always `listbox` (APG Combobox with listbox popup); the `aria-haspopup="listbox"`
attribute is static. Grid, tree, and dialog popup types are out of scope for this component (those
compose the raw APG themselves when needed). `aria-haspopup="listbox"` is the default implicit value
per APG — the attribute is still emitted explicitly for clarity.

**Grouping**: when `suggestions` contain a non-null `group` field, the listbox renders
`role="group" aria-labelledby` group headers between option runs (same as `select`).

**Sizes** (height-based, toolbar-aligned — same scale as `button` / `input` / `select`):
- `sm` → `--lv-space-8` (32 px), `text-xs`
- `md` → `--lv-space-9` (36 px, default), `text-sm`
- `lg` → `--lv-space-10` (40 px), `text-base`

The text input AND the toggle button both honour the size. The listbox max-height is independent
(`--lv-combobox-listbox-max-h`, default `260px`; NET-NEW, see §5).

**States**:
- `disabled`: native `disabled` on the `<input>` + `disabled` on the toggle button; `disabled:`
  utilities; not interactive.
- `:hover` on the input wrapper: `--lv-color-border` brightens to `--lv-color-accent`.
- `:focus-visible` on the input: `--lv-ring` focus ring (the shared ring token).
- `aria-invalid` on the input (set by the consuming field/form on validation failure): destructive
  border + destructive ring.
- `aria-expanded` on the input reflects `open` (see §4).
- `aria-busy` on the listbox region set when `loading=true` (async fetch in flight): the enhancer
  reads this and the runtime's `beforeCall`/`afterCall` hook manages it during wire round-trips.
- active option in the listbox: `aria-activedescendant` on the input (managed by `collection-nav`);
  the active option `<li>` gets a visual accent highlight via `[data-active]` selector (the enhancer
  toggles this attribute; the server-rendered markup carries no `data-active`, the enhancer patches it
  locally without a wire round-trip because it is ephemeral view state).
- committed option: the matching `role="option"` carries `aria-selected="true"` (server-rendered from
  comparing the option id to `value`).
- `clearable` + `inputText` non-empty: the × button is rendered; when `inputText` is empty it is
  absent (not hidden, absent — no tab-stop for an inactive element).

---

## 4. The a11y contract (the heart)

- **WAI-ARIA pattern**: APG Combobox with listbox popup.
  Canonical source: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
  Example verified: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/

- **roles + ARIA** (what the JTE template emits, server-side; none of these are set by JS):
    - input: `<input type="text" role="combobox" aria-expanded="${open ? "true" : "false"}"
      aria-haspopup="listbox" aria-controls="<listboxId>" aria-autocomplete="${autocomplete}"
      aria-activedescendant="${activeOptionId ?? ""}" aria-label (or aria-labelledby → the wrapping
      `<label>`) aria-invalid (consuming form sets this via field wrapper) autocomplete="off"`
      (suppresses browser autocomplete dropdown, which would collide with the listbox).
      Note: `aria-activedescendant` is empty when no option is active; `collection-nav` updates it
      client-side as the user arrows through the list (local DOM attribute write, no wire round-trip).
    - listbox: `<ul role="listbox" id="<listboxId>" aria-labelledby="<labelId>"
      aria-busy="${loading ? "true" : "false"}"` — rendered always in the DOM (so `aria-controls`
      is always resolvable per APG) but visually hidden when `!open` via the popover seam's
      `popover` attribute + CSS (not `display:none` — the element must be present for `aria-controls`
      to resolve; it exits the visual viewport and is visually hidden, but not `hidden` in the HTML
      attribute sense).
      IMPLEMENTATION NOTE: the APG requires that `aria-controls` references a present element.
      The listbox is rendered in the DOM unconditionally; its visibility toggles via the popover seam
      (`popover` attribute + `[popover]` CSS anchor), NOT via `hidden` or `display:none`. When closed,
      it is `visibility:hidden` / `opacity:0` via CSS; it remains in the a11y tree as unexpanded.
    - each option: `<li role="option" id="opt-<id>" aria-selected="${optId == value ? "true" : "false"}">`;
      the label text is server-rendered from the `Suggestion.label()` field.
    - groups (when `Suggestion.group()` is non-null): `<li role="presentation">` wrapping a
      `<div id="grp-<n>" class="…">` group label, then `<ul role="group" aria-labelledby="grp-<n>">` for
      the options in that group. The group header `<div>` is `aria-hidden="true"` (it is presentation-only;
      the `aria-labelledby` association provides the semantic link).
    - toggle button (optional, the ▾ affordance): a `<button type="button" tabindex="-1"
      aria-label="Toggle suggestions" aria-hidden="true">` — removed from the tab sequence per APG
      (the input IS the tab-stop); present as a visual affordance for pointer users and touch AT.
    - clear button (when `clearable` and `inputText` non-empty): a `<button type="button"
      aria-label="Clear" l:click="clear">` — IS in the tab sequence (it is a distinct action, not
      a visual decoration). Absent (not just hidden) when `inputText` is empty.
    - loading spinner (when `loading=true`): inside the listbox, before the options, `role="status"`
      `aria-label="Loading suggestions"` — uses the shared announcer token pattern; `aria-live="polite"`.
    - no-results state: a single `<li role="option" aria-disabled="true">` with a "No results" label
      when `visibleSuggestions()` is empty and `!loading`. `aria-disabled` prevents it from being
      committed via Enter/click.

- **keyboard map** (the load-bearing table):
  Every non-platform key is owned by `collection-nav.enhancer.ts`.
  DOM focus stays on the `<input>` throughout — the active option is virtual (`aria-activedescendant`).
  This is the APG Combobox/listbox model; DO NOT move DOM focus into the listbox.

  | key | context | does | who |
  |---|---|---|---|
  | Tab | anywhere | moves focus out of the combobox; closes the listbox (calls `commitFreeText()` if free-type + text is non-empty and no option active; or reverts `inputText` if select-only and no match) | enhancer + platform (Tab is native; enhancer hooks `blur`) |
  | Shift+Tab | anywhere | same close behaviour + moves focus to previous element | enhancer + platform |
  | Down Arrow | input, listbox closed | opens the listbox; moves active option to the first option | enhancer |
  | Down Arrow | input, listbox open | moves active option to the next option; wraps to first when at last | enhancer |
  | Up Arrow | input, listbox closed | opens the listbox; moves active option to the last option (per APG optional — IMPLEMENTED) | enhancer |
  | Up Arrow | input, listbox open | moves active option to the previous option; wraps to last when at first | enhancer |
  | Alt + Down Arrow | input, listbox closed | opens the listbox WITHOUT moving the active option | enhancer |
  | Alt + Up Arrow | input, listbox open | closes the listbox, returns focus to the input (focus was already there; clears active option) | enhancer |
  | Home | listbox open | moves cursor to beginning of the text field; clears active option (returns "focus" to the input editing context) | enhancer (clears active) + platform (Home in input) |
  | End | listbox open | moves cursor to end of the text field; clears active option | enhancer (clears active) + platform (End in input) |
  | Enter | listbox open, option active | calls `commit(activeId)` wire action; closes the listbox | enhancer → wire |
  | Enter | listbox open, no active option, free-type | calls `commitFreeText()` wire action; closes the listbox | enhancer → wire |
  | Enter | listbox open, no active option, select-only | no-op (no value to commit; user must arrow or type to select) | enhancer |
  | Enter | listbox closed | no-op (standard form submit is the browser default if inside a `<form>`; the combobox does not intercept it when closed) | platform |
  | Escape | listbox open | closes the listbox; returns visual focus to the input (DOM focus was already there); does NOT clear `inputText` (per APG: optionally clears — decision: do NOT clear, to avoid data loss) | enhancer |
  | Escape | listbox closed | clears `inputText` and `value` (calls `clear()` wire action); a second Escape is a no-op | enhancer → wire |
  | Printable characters (a–z, 0–9, etc.) | input | typed into the input; `l:input.debounce.200ms` fires `type(inputText)` wire action; filters suggestions | platform (typing) + wire (filtering) |
  | Backspace / Delete | input | edits the text (platform); triggers `l:input.debounce` → `type(inputText)` | platform + wire |
  | Right Arrow / Left Arrow | listbox open, option active | clears active option (returns editing context to input); moves cursor one character | enhancer (clears active) + platform (cursor) |
  | Printable chars | listbox open, option active | clears active option; character typed into input; triggers filtering | enhancer (clears active) + platform (typing) + wire (filtering) |

- **focus management**:
    - DOM focus NEVER moves into the listbox. This is the APG Combobox model: the input is the
      single DOM focus target; the active option is communicated to AT via `aria-activedescendant`.
    - On open: the input keeps focus; the first option becomes active (or the currently-selected one
      if a value is committed) via `aria-activedescendant`. `collection-nav` manages this.
    - On close (any path): focus stays on the input; `aria-activedescendant` is cleared.
    - No focus trap (the combobox is non-modal). It composes the **popover seam** for positioning
      + light-dismiss (click outside → `collection-nav` fires close; no separate focus-trap enhancer
      is needed — that is the dialog/drawer pattern).
    - The clear button (when rendered) is in the tab sequence and receives DOM focus when tabbed to;
      this is intentional (it is a real distinct action, not a decoration).
    - Roving tabindex: not used (there is only one tab-stop — the input; the listbox never gets
      tabindex).

- **live region**:
    - Loading: `role="status" aria-label="Loading suggestions"` inside the listbox; polite.
    - Result count: after suggestions render (on `type()` re-render), the shared announcer emits
      "N results available" (`aria-live="polite"`, the shared announcer pattern from §4 of the
      architecture contract). This is the same mechanism `select` uses.
    - No-results: the `aria-disabled` "No results" option is announced by AT as the active
      descendant; the announcer also emits "No results" to cover AT that do not read disabled options.

- **shared mechanisms composed**:
    - `collection-nav.enhancer.ts` — ArrowUp/Down, Home/End, `aria-activedescendant` management,
      active-option `[data-active]` attribute toggle, commit-on-Enter, light-dismiss (click outside
      closes). Do NOT hand-roll any of this; it is the same instance `select` and `dropdown-menu`
      consume.
    - The **popover seam** — the listbox is positioned anchored to the input via CSS Anchor
      Positioning + `popover` attribute; this is the ONE shared overlay positioning mechanism
      (architecture contract §2.b). Do NOT hand-roll positioning.
    - The **live-region announcer** — result count + loading announcement via the shared
      `role="status"` / `aria-live="polite"` pattern.

---

## 5. Tokens

**Existing tokens consumed** (no literals, ever):

| token | used for |
|---|---|
| `--lv-color-input` | input background |
| `--lv-color-border` | input + listbox border |
| `--lv-color-accent` | hover border, active-option background |
| `--lv-color-accent-fg` | text on accent (active option text) |
| `--lv-color-popover` | listbox panel background |
| `--lv-color-popover-fg` | listbox text |
| `--lv-color-fg` | input text |
| `--lv-color-muted` | placeholder text, group header text |
| `--lv-color-destructive` | `aria-invalid` border + ring |
| `--lv-color-primary` | the committed-option highlight badge / checkmark |
| `--lv-color-primary-fg` | text on primary |
| `--lv-ring` | focus-visible ring on the input |
| `--lv-radius-md` | input border-radius |
| `--lv-radius-lg` | listbox panel border-radius |
| `--lv-shadow-md` | listbox panel elevation |
| `--lv-z-popover` | listbox z-index (above normal content, below modals) |
| `--lv-space-2` | option vertical padding (sm size) |
| `--lv-space-3` | option vertical padding (md/lg size) |
| `--lv-space-4` | input horizontal padding |
| `--lv-space-8` | input height (sm) |
| `--lv-space-9` | input height (md, default) |
| `--lv-space-10` | input height (lg) |
| `--lv-text-xs` | label text size (sm) |
| `--lv-text-sm` | label text size (md, default) |
| `--lv-text-base` | label text size (lg) |
| `--lv-font-sans` | input + option font |

**NET-NEW tokens proposed** (additive, justified, go in `:root` + `.dark` blocks):

| token | value (OKLCH, `:root`) | dark | justification |
|---|---|---|---|
| `--lv-combobox-listbox-max-h` | `260px` | same (structural) | controls the listbox scroll container height; structural (not a colour), theme-invariant; adopters override for dense UIs |

Only one net-new token needed. All colour surface reuses existing tokens — the combobox is
compositionally identical to `select` for the popover/listbox region.

The inline autocomplete suffix (when `autocomplete="both"`) is rendered as a `<span
aria-hidden="true">` inside the input label region using an `::after` CSS trick anchored
to a `<div>` overlay positioned absolutely over the input — it must NOT be an actual
`<input>` value (which would confuse AT) nor a second `<input>`. The suffix colour is
`--lv-color-muted` with a selected-range visual. No new token needed; the existing
muted + selection system tokens handle it.

---

## 6. Wire actions + enhancer wiring

**`l:*` directives the template binds**:
- `l:input.debounce.200ms="type"` on the `<input type="text">` → calls `type(inputText)` with the
  current input value; 200 ms debounce avoids a wire call per keystroke.
- `l:click="toggleOpen"` on the toggle button (the ▾ affordance); present only when toggle button
  is rendered.
- `l:click="clear"` on the clear button (the ×); present only when `clearable` and `inputText`
  non-empty.
- each option `<li>` emits `l:click="commit" data-id="<escaped id>"` via the SAFE `wireArgs`
  channel: `data-id` is escaped through `Escape.htmlAttribute`; the enhancer's click handler reads
  `li.dataset.id` and calls `commit(id)`. A per-row id is a DB-derived value → it MUST go through
  the `wireArgs`/`dataAttrs` escaped channel, NEVER `attrs` trusted-raw.

**Server action signatures** (all validate + authz in Java BEFORE mutating state):

```java
@LievitAction
public void type(String inputText) {
    // trim; update this.inputText; recompute visibleSuggestions(); open the listbox
    this.inputText = inputText.strip();
    this.open = true;
    // async mode: fire HTMX fetch for suggestions (see below)
}

@LievitAction
public void commit(String id) {
    // validate id ∈ suggestions (select-only); validate id non-null
    var match = suggestions.stream().filter(s -> s.id().equals(id)).findFirst();
    if (mode.equals("select-only")) {
        match.orElseThrow(() -> new LievitValidationException("Unknown option: " + id));
    }
    this.value = match.map(Suggestion::id).orElse(id);
    this.inputText = match.map(Suggestion::label).orElse(id);
    this.open = false;
}

@LievitAction
public void commitFreeText() {
    // free-type mode only; if inputText matches a suggestion, commit its id; else commit the text
    // select-only: revert to last committed label
    if (mode.equals("select-only")) {
        var last = suggestions.stream().filter(s -> s.id().equals(this.value)).findFirst();
        this.inputText = last.map(Suggestion::label).orElse("");
    } else {
        var match = suggestions.stream().filter(s -> s.label().equalsIgnoreCase(inputText)).findFirst();
        this.value = match.map(Suggestion::id).orElse(inputText);
    }
    this.open = false;
}

@LievitAction
public void clear() {
    this.value = "";
    this.inputText = "";
    this.open = true;
}

@LievitAction
public void toggleOpen() {
    this.open = !this.open;
}
```

**Round-trip flow**:
1. User types "Par" → `l:input.debounce.200ms` fires → `type("Par")` wire call → server filters
   `visibleSuggestions()` → re-renders listbox → morph patches the listbox HTML; active option
   reset (enhancer resets `aria-activedescendant`).
2. User arrows Down twice → `collection-nav` sets `aria-activedescendant="opt-parma"` + `data-active`
   on the "Parma" `<li>` — PURE client, no wire round-trip (ephemeral view state).
3. User presses Enter → enhancer reads `aria-activedescendant` → calls `commit("parma-id")` wire
   action → server sets `value="parma-id"`, `inputText="Parma"`, `open=false` → re-render → morph
   collapses listbox, input shows "Parma", hidden `<input type="hidden">` carries `parma-id`.

**Async suggestions** (HTMX variant): when `suggestions` are server-fetched on each keystroke
(too large to pre-load), `type()` action emits an HTMX trigger that swaps the `<ul role="listbox">`
fragment via a dedidated endpoint. The `ComboboxComponent` sets `loading=true` before the fetch +
`loading=false` after; the fragment endpoint returns only the `<ul>` inner HTML. This is the
HTMX VARIANT of the WIRE base: the same `ComboboxComponent` is used, the `type()` action triggers
the swap instead of in-memory filtering. No new API params needed; `loading` covers the in-flight
state. The `collection-nav` enhancer observes the listbox mutation (MutationObserver on the `<ul>`)
to reset `aria-activedescendant` after each swap.

**Enhancer responsibilities** (`collection-nav.enhancer.ts` parameterised for combobox):
- On listbox open: compute the initial active option (selected option if any, else no active option
  — per APG: ArrowDown moves to first, not auto-selected on open).
- Keyboard handler on the `<input>`: ArrowDown, ArrowUp, Alt+Down, Alt+Up, Home, End, Right, Left,
  Printable chars in listbox context, Escape, Enter — see §4 keyboard map.
- Active option management: writes `aria-activedescendant` on the `<input>` + toggles `[data-active]`
  attribute on `<li>` elements (purely local DOM writes, no wire round-trip).
- Scroll the active `<li>` into view within the listbox container (CSS `scrollIntoView` with
  `block: "nearest"`).
- Light-dismiss: `pointerdown` outside the combobox root fires `toggleOpen()` wire action (closing).
- Blur handler: if focus leaves the combobox entirely (not just between input and clear button),
  fire `commitFreeText()` (free-type) or the revert logic (select-only).
- MutationObserver on `<ul>`: resets the active option tracking after HTMX async suggestion swaps.
- The enhancer registers via the lifecycle `onComponentInit` hook + a `l:combobox` directive on the
  root element (consistent with the `collection-nav` parameterisation model used by `select`).

---

## 7. Acceptance tests (the gate — refute-by-default)

The component is DONE only when ALL of these pass on a REAL substrate (not a mocked `$lievit` —
the client-island-fidelity lesson: a fake substrate certifies nothing about the real interaction).

**Render (real `LievitRuntime` + jsdom, real `collection-nav` mounted)**:
- `render_emits_combobox_role`: the `<input>` has `role="combobox"`, `aria-haspopup="listbox"`,
  `aria-controls` pointing to the rendered `<ul>` id; `aria-expanded="false"` when closed.
- `render_listbox_in_dom_when_closed`: the `<ul role="listbox">` is present in the DOM even when
  `open=false` (required for `aria-controls` to resolve per APG); visually hidden via popover CSS.
- `render_options_with_aria_selected`: options render as `<li role="option">`; the option matching
  `value` carries `aria-selected="true"`; all others `aria-selected="false"`.
- `render_hidden_form_input_carries_value`: a `<input type="hidden">` with `name` and `value`
  attributes is rendered; its value is the committed id, not the `inputText`.
- `render_groups_with_group_role`: when suggestions carry a non-null group field, `<ul role="group">`
  elements are rendered with correct `aria-labelledby` pointing to the group header.
- `render_clear_button_absent_when_empty`: when `inputText=""`, no clear button is in the DOM (not
  `hidden`, absent) — zero tab-stops for an inactive action.
- `render_clear_button_present_when_text_nonempty`: when `inputText="Par"`, the clear button is
  rendered and has `aria-label="Clear"`.
- `render_loading_state_shows_aria_busy`: when `loading=true`, the listbox `<ul>` has
  `aria-busy="true"` and a `role="status"` spinner element is present before the options.
- `render_no_results_option_aria_disabled`: when `visibleSuggestions()` is empty and `!loading`,
  a single `<li role="option" aria-disabled="true">` with a "No results" label is rendered.
- `render_size_sm_md_lg_emits_data_size`: `data-size="sm"` / `"md"` / `"lg"` is on the root;
  the input height class uses the correct `--lv-space-{8,9,10}` token.
- `render_autocomplete_attribute_reflects_param`: `aria-autocomplete` on the `<input>` matches
  the `autocomplete` param value (`"none"`, `"list"`, or `"both"`).
- `render_disabled_state`: `disabled` on the `<input>` is present; toggle button is `disabled`;
  no `l:click` handlers are wired.

**axe-core (on the open-listbox DOM)**:
- `axe_open_listbox_zero_violations`: zero violations of the Combobox + Listbox axe rules on the
  rendered DOM with the listbox open; specifically: `aria-required-children`, `aria-allowed-attr`,
  `combobox-associated-element`, `label`, `button-name`, `aria-activedescendant-not-in-tab-sequence`
  all pass.
- `axe_closed_combobox_zero_violations`: zero violations on the closed-listbox DOM (listbox present
  but visually hidden).

**Keyboard (each key from the §4 map, asserted on the REAL enhancer)**:
- `keyboard_arrowdown_opens_and_moves_to_first_option`: ArrowDown when closed opens the listbox
  and sets `aria-activedescendant` to the first option's id.
- `keyboard_arrowdown_cycles_to_next_option`: ArrowDown when open and first option active moves
  active to the second option.
- `keyboard_arrowdown_wraps_at_last_option`: ArrowDown when open and last option active wraps
  to the first option.
- `keyboard_arrowup_opens_and_moves_to_last_option`: ArrowUp when closed opens and moves active
  to the last option.
- `keyboard_arrowup_wraps_at_first_option`: ArrowUp when open and first option active wraps to last.
- `keyboard_alt_arrowdown_opens_without_moving_active`: Alt+ArrowDown opens the listbox; no option
  becomes active (aria-activedescendant stays empty).
- `keyboard_alt_arrowup_closes_listbox`: Alt+ArrowUp when open fires `toggleOpen()`; listbox closes;
  input retains focus.
- `keyboard_home_clears_active_option`: Home when open clears `aria-activedescendant` (editing
  context returns to input); the platform moves the cursor.
- `keyboard_end_clears_active_option`: same for End.
- `keyboard_enter_with_active_option_commits`: Enter when an option is active calls `commit(activeId)`
  wire action; after the morph, the input shows the option label and `aria-expanded="false"`.
- `keyboard_enter_free_type_no_active_commits_text`: Enter in free-type mode with no active option
  calls `commitFreeText()`; value = inputText; listbox closes.
- `keyboard_enter_select_only_no_active_is_noop`: Enter in select-only mode with no active option
  does not fire a wire action; listbox stays open.
- `keyboard_escape_open_closes_only`: Escape when open closes the listbox; `inputText` is unchanged;
  `aria-expanded="false"`.
- `keyboard_escape_closed_clears`: Escape when closed fires `clear()` wire action; after the morph,
  `inputText=""` and the listbox opens.
- `keyboard_tab_blur_commits_free_text`: Tab away from the combobox in free-type mode fires
  `commitFreeText()`.
- `keyboard_tab_blur_reverts_select_only`: Tab away in select-only mode reverts `inputText` to the
  last committed label.
- `keyboard_right_left_in_listbox_clears_active`: Right/Left arrow when an option is active clears
  `aria-activedescendant` (returns editing context to input); the input cursor moves.
- `keyboard_printable_in_listbox_clears_active_and_types`: a printable key press when an option is
  active clears active option + the character appears in the input + `type()` debounce fires.

**Focus**:
- `focus_dom_never_leaves_input`: across all keyboard interactions (ArrowDown, Enter, Escape, option
  click), `document.activeElement` always remains the `<input>` — never an `<li>`.
- `focus_activedescendant_tracks_active_option`: after ArrowDown, `input.getAttribute(
  "aria-activedescendant")` matches the id of the `[data-active]` `<li>`.
- `focus_activedescendant_cleared_on_close`: after Escape or Enter commit, `aria-activedescendant`
  is `""`.
- `focus_clear_button_in_tab_sequence`: when `clearable` and `inputText` non-empty, Tab from the
  input moves focus to the clear button; Tab again leaves the combobox.

**Wire round-trip IT** (lievit-kit, real runtime, CollapsibleComponentIT pattern):
- `wire_type_action_filters_visible_suggestions`: mount with suggestions=[Parma, Pavia, Roma]; fire
  `type("pa")`; after the morph, the rendered listbox contains only [Parma, Pavia].
- `wire_commit_action_sets_value_and_closes`: fire `commit("parma-id")`; after the morph,
  `aria-expanded="false"`, the input shows "Parma", the hidden form field carries "parma-id".
- `wire_commit_rejects_unknown_id_select_only`: in select-only mode, fire `commit("hacked-id")`
  where "hacked-id" is not in suggestions; assert a `LievitValidationException` is thrown (the
  action does not mutate state).
- `wire_clear_action_empties_and_opens`: fire `clear()`; after the morph, `inputText=""`,
  `value=""`, `aria-expanded="true"`.
- `wire_commit_free_text_commits_typed_value`: in free-type mode, set `inputText="CustomCity"`;
  fire `commitFreeText()`; after the morph, `value="CustomCity"`, `open=false`.
- `wire_loading_state_renders_aria_busy`: set `loading=true` on the component; re-render asserts
  `aria-busy="true"` on the `<ul>` and the spinner `role="status"` is present.

**JTE compile + render**:
- Covered by `test/jte-compile` gate (real JTE compiler, no mocks). No separate test entry needed;
  CI fails if the template does not compile.

**Escaping (the XSS abuse-case)**:
- `escaping_option_id_hostile_string_renders_inert`: mount with a suggestion whose id is
  `"\"><img src=x onerror=alert(1)>"`. The rendered `<li data-id="...">` must have the id
  HTML-attribute-escaped (the `Escape.htmlAttribute` path via `wireArgs`); the rendered HTML must
  not contain an unescaped `onerror` attribute. The option is selected; `commit()` receives the
  hostile string as a plain Java `String` arg (not markup); the server validates it is in the
  suggestion set and rejects it (select-only) or stores it as plain text (free-type).

**Playwright** (gesture fidelity, legacy-VM oracle):
- `playwright_type_filters_and_arrow_selects`: real `page.keyboard.type("pa")` + real
  `page.keyboard.press("ArrowDown")` twice + `page.keyboard.press("Enter")` — assert the input
  value shows the correct label and the server state reflects the committed id (not a fake substrate).
- `playwright_escape_closes_and_second_escape_clears`: real `page.keyboard.press("Escape")` when
  open closes; second press when closed clears the field.
- `playwright_click_outside_closes`: `page.mouse.click` outside the combobox root closes the
  listbox (light-dismiss via the popover seam).

---

## 8. Agent instructions (the discipline reminders)

- Generate ORIGINAL code over `--lv-*` tokens. You MAY read WAI-ARIA APG Combobox
  (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), React Aria `useComboBox` spec, Ant Design
  AutoComplete / Select feature set, and Tailwind UI as references for PATTERN (a11y, inventory) and
  LOOK. You MUST NOT paste literal source from ANY of them — the output is always original generation
  (the one bright line, `02-licensing.md`).
- Compose `collection-nav.enhancer.ts` (roving, typeahead, `aria-activedescendant`) + the popover
  seam (positioning + light-dismiss). Do NOT hand-roll either. This is the canonical reason the
  single-source-a11y rule exists: the `select` spec already proved this consumer shape; the combobox
  is the second consumer.
- The listbox `<ul>` is ALWAYS in the DOM (even when closed) so `aria-controls` resolves per APG.
  Use the popover seam (CSS `popover` attribute + anchor positioning) for visibility toggling, NOT
  `hidden` / `display:none`.
- DOM focus NEVER leaves the `<input>`. The active option is virtual (`aria-activedescendant`).
  Any implementation that moves DOM focus into the `<li>` is WRONG and will fail the
  `focus_dom_never_leaves_input` test.
- The `commit()` action MUST validate id ∈ suggestions in select-only mode in Java BEFORE mutating
  `value`. The `type()` action is a bare state update (no validation beyond trim).
- The hidden `<input type="hidden">` carries `value` (the committed id / free-typed text) to form
  POSTs. The visible `<input type="text">` carries `inputText` only.
- Mirror WIRE conventions (server-first refactor blueprint §1.b): no `Content` slot, owned template
  markup, boolean state as JTE boolean conditional, `@LievitProperty(locked=true)` on everything
  that a client must not mutate at runtime.
- Mirror `button.jte` house conventions exactly: header doc-comment with the credits line, typed
  `@param`, `data-slot="combobox"` + `data-size` + `data-mode` on the root, the two escaping
  channels (`attrs` trusted-raw vs `wireArgs`/`dataAttrs` escaped), zero `<script>`, zero inline
  `on*=`.
- Minimal code to GREEN against the acceptance tests; refactor only while green.
  The keyboard map is the contract — assert ALL of it, both sides (what happens AND what does NOT).
