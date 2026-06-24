<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — tags-input (token entry, removable chips, optional suggestion popup)

- **tier**: WIRE + ENH (`tags-input.enhancer.ts`, the chip keyboard-nav + removal + paste
  splitter; the existing enhancer is RE-FORGED, not replaced, against this spec)
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of the existing `tags-input` enhancer + its template;
  the v-next delta is: pinned a11y to the BUILT model below, spec-documented keyboard map,
  optional suggestion popup via `collection-nav`, strict CSP-clean enhancer conventions)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: **WAI-ARIA APG BUILT** — no APG page for token entry exists (verified 2026-06-23
      against https://www.w3.org/WAI/ARIA/apg/patterns/ and the example index); the keyboard model
      is constructed from three APG sources: APG Keyboard Interface practices (roving-tabindex focus
      management after deletion; https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/),
      APG Combobox pattern (the optional suggestion listbox popup;
      https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), and raw WAI-ARIA `group` + `option`
      role semantics. The chip-removal focus-restore rule ("focus moves to the next chip, or to
      the input when the last chip is removed") derives from the APG focus-persistence guidance.
      This BUILT model is the single source for tags-input keyboard in this library.
    - inventory: Ant Design Select (mode="tags") + Select (mode="multiple") as inventory reference
      (free-entry vs suggestion-only modes, clear-all, max-tag-count, tag color intents); also
      informed by the react-aria `useTagGroup` + `useTagGroupItem` interaction model as a pattern
      reference for chip roving-tabindex (no source copied)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI
      tag-list patterns (NO code copied)

---

## 1. What it is

A multi-value token-entry field: the user types text (or picks from an optional suggestion popup)
and each confirmed value becomes a removable chip (token) displayed inline inside the input well.
The **tag set** (the ordered list of current tag values) is the server fact — this is WIRE: the
server owns `tags`, validates additions, persists them, and re-renders after every mutation.

The irreducible CLIENT behavior — chip keyboard navigation via roving tabindex, Backspace-removal
of the last chip, Delete/Backspace removal of the focused chip, paste splitting on delimiter,
auto-advance focus after removal — is the `tags-input.enhancer.ts`. When `suggestionsEnabled`
is true, the suggestion popup's listbox keyboard is the shared `collection-nav.enhancer.ts`
(the same one used by `select`, `combobox`, `dropdown-menu`); `tags-input` composes it rather
than re-implementing it.

Server-first works for tags-input because the tag set is not ephemeral view state — it is a
persisted multi-value field that the server validates (duplicate check, max count, allowlist when
`mode=suggestions-only`), re-renders as a chip list, and owns completely. The only parts that
are irreducibly client are: (a) focus routing between chips and the input without a round-trip
per keystroke; (b) paste splitting; (c) the active-chip visual highlight during keyboard
traversal. Everything else is a server fact.

---

## 2. API — the WIRE surface + template params

### Java (`TagsInputComponent`)

| member | kind | meaning |
|---|---|---|
| `tags` `List<Tag>` | `@Wire` | the ordered list of current tags; each `Tag` has `id` (String, server-assigned) + `label` (String) + optional `intent` (String) |
| `inputValue` `String` | `@Wire` | the live text in the entry input (the in-progress label before commit) |
| `mode` `String` | `@Wire @LievitProperty(locked=true)` | `free` (any text) \| `suggestions` (type filters suggestions, but free text also allowed) \| `suggestions-only` (must pick from the list; free text rejected) |
| `suggestions` `List<Suggestion>` | `@Wire @LievitProperty(locked=true)` | the static suggestion set for `suggestions` / `suggestions-only` modes; empty for `free` mode; each has `id` + `label`. For async suggestions, leave empty and enable `asyncSuggestions` |
| `asyncSuggestions` `boolean` | `@Wire @LievitProperty(locked=true)` | when true, `inputChange` triggers an HTMX swap of the suggestion listbox fragment (async server search); overrides the static `suggestions` list |
| `popupOpen` `boolean` | `@Wire` | the suggestion popup open-state (only meaningful when mode ≠ `free`) |
| `activeQuery` `String` | `@Wire` | the current search query for async suggestion lookup (debounced, set by the wire action) |
| `disabled` `boolean` | `@Wire @LievitProperty(locked=true)` | disables the entire control |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | placeholder on the entry input when there are no tags |
| `maxTags` `int` | `@Wire @LievitProperty(locked=true)` | maximum tag count (0 = unlimited); addition is blocked when reached |
| `delimiter` `String` | `@Wire @LievitProperty(locked=true)` | the paste-split delimiter char(s), default `,` |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `sm` \| `md` \| `lg` — toolbar-aligned height |
| `addTag(String label)` | `@LievitAction` | validates (not duplicate, not empty, in allowlist if suggestions-only, maxTags not exceeded), assigns a server-side id, appends to `tags`, clears `inputValue`. Rejects silently (or via `aria-live` error) on violation. |
| `removeTag(String id)` | `@LievitAction` | removes the tag with the given id from `tags`; no-op when `disabled` |
| `clearAll()` | `@LievitAction` | empties `tags`; no-op when `disabled` |
| `inputChange(String value)` | `@LievitAction` | updates `inputValue` + optionally opens the popup (non-free modes) + triggers HTMX if `asyncSuggestions` |
| `selectSuggestion(String suggestionId)` | `@LievitAction` | in `suggestions`/`suggestions-only` modes, adds the suggestion as a tag + clears input + closes popup |
| `togglePopup()` | `@LievitAction` | opens/closes the suggestion popup |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param TagsInputComponent _instance` (for the filtered suggestion view). No `Content` slot
(WIRE has none).

### Enhancer data-* hooks (the typed surface the enhancer reads from the DOM)

| attribute | on element | meaning |
|---|---|---|
| `data-slot="tags-input"` | root container | the enhancer mounts here |
| `data-lievit-component` / `data-lievit-snapshot` / `data-lievit-id` | root | standard wire root attributes |
| `data-slot="chip"` | each chip | a focusable chip; the roving-tabindex set |
| `data-tag-id="<escaped-id>"` | each chip | the server-assigned tag id, passed to `removeTag` |
| `data-slot="chip-remove"` | the remove `<button>` inside each chip | the platform-native activation target |
| `data-slot="entry-input"` | the `<input type="text">` | the entry input; the enhancer reads value + fires `addTag`/`inputChange` |
| `data-slot="clear-all"` | the clear-all `<button>` | present only when `clearable` and `tags` non-empty |
| `data-slot="suggestions-popup"` | the suggestion listbox popup | the `collection-nav` enhancer mounts here (when mode ≠ free) |
| `data-disabled` | root | present (any value) when `disabled=true`; the enhancer reads this to block keyboard actions |
| `data-max-reached` | root | present when `tags.size() >= maxTags && maxTags > 0`; the enhancer disables the input |
| `data-delimiter="<escaped>"` | root | the paste-split delimiter; the enhancer reads on paste |

---

## 3. Variants / sizes / states

### Modes (the primary behavioral axis)
- `free` — any text can be added; no popup; the entry input is a plain text field.
- `suggestions` — typing filters a suggestion list in a popup; the user can also add free-text
  not in the list (Enter on the raw input value).
- `suggestions-only` — typing filters suggestions; free-text is rejected by `addTag`; the popup
  is the only source of values. The entry input still accepts typing (for filtering) but commit
  on raw text is silently ignored (or announced via the live region as an error).

### Tag intents (per-chip color signal — shared library vocabulary)
Each `Tag` carries an optional `intent`: `default | info | success | warning | destructive`.
The chip renders the intent as a token-class on `data-intent`, mapped to `--lv-color-{intent}` /
`--lv-color-{intent}-fg` token pair. This is the same intent vocabulary the `badge` partial uses.

### Sizes
`size` = `sm | md | lg`, height-based, toolbar-aligned:
- `sm` → well height `--lv-space-8` (32px); chip height `--lv-space-6`; text `--lv-text-xs`
- `md` → well height `--lv-space-9` (36px, default); chip height `--lv-space-7`; text `--lv-text-sm`
- `lg` → well height `--lv-space-10` (40px); chip height `--lv-space-8`; text `--lv-text-base`

When there are many chips, the well expands vertically (wrapping chips); the height above is
the MINIMUM (single-row, no chips / single-row baseline). The well never clips chips by
overflow-hiding them — Ant Design's `maxTagCount` collapse is a future variant (S2), not S1 scope.

### States
- `disabled` — the entire control is inert: chips are non-interactive (no remove buttons, no
  roving), the entry input has `disabled`, the clear-all button is absent. The root gets
  `aria-disabled="true"` and `data-disabled`. Chips remain visible (display-only).
- `focus-within` — the well gains the `--lv-ring` focus ring when any child element is focused
  (the CSS `:focus-within` selector on the well container); mimics the single-input focus ring.
- `aria-invalid` — on the root/well, recolours the ring to `--lv-color-destructive-ring` +
  the border to `--lv-color-destructive`; set by the controller when the field has a validation
  error. The entry input also gets `aria-invalid`.
- `aria-busy` — on the root during a wire round-trip (runtime-managed, the component does nothing).
- `max-reached` — the entry input is `disabled` + `aria-disabled` when `maxTags > 0` and
  `tags.size() >= maxTags`; the enhancer also blocks Enter/comma-add.
- `popup-open` — the suggestion popup has `aria-expanded="true"` on the trigger input and
  `data-slot="suggestions-popup"` is rendered in the DOM.

---

## 4. The a11y contract (the heart — BUILT against raw APG; no dedicated APG pattern)

### WAI-ARIA pattern
**BUILT** — the W3C WAI-ARIA APG has no dedicated token-entry pattern (verified 2026-06-23;
https://www.w3.org/WAI/ARIA/apg/patterns/ lists 32 patterns; none are token/tags-input).
This spec constructs the keyboard and ARIA model from three APG sources:
1. APG Keyboard Interface practices (roving tabindex, focus restoration after DOM removal):
   https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
2. APG Combobox pattern (suggestion popup keyboard + ARIA, when `mode ≠ free`):
   https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
3. Raw WAI-ARIA role semantics: `group`, `option`, `button`, `listbox`.

The model below IS the single source for tags-input a11y in this library. Every chip keyboard
rule and ARIA attribution here is derived from those three sources, not invented.

### Roles + ARIA (what the server-rendered template emits)

| element | role / attribute | value / rule |
|---|---|---|
| root container | `role="group"` | groups the whole field; `aria-labelledby` → the `<label>` id |
| root container | `aria-disabled="true"` | when `disabled` |
| root container | `aria-invalid="true"` | when the field has a validation error |
| well (inner wrapping div) | `data-slot="tags-input-well"` | the visual outer border; no ARIA role of its own |
| each chip | `role="option"` | a selected value, expressed as an option in the selection; `tabindex="-1"` by default (roving sets one chip to `tabindex="0"` at a time) |
| each chip | `aria-label="<label>, press Delete or Backspace to remove"` | or `aria-label` composed from the tag label + remove instruction; ensures screen readers announce the chip AND its affordance |
| each chip | `aria-selected="true"` | always true for a chip (it IS selected — that is what a chip means) |
| remove button inside chip | `<button aria-label="Remove <label>"` | a real platform `<button>`; the accessible name explicitly names the tag; `tabindex="-1"` (the chip itself is the roving item, not the button inside it; the button is activated via Enter/Space/Delete on the focused chip — see keyboard map) |
| entry input | `<input type="text" role="combobox"` (mode ≠ free) \| `<input type="text">` (free) | when mode ≠ free: `aria-haspopup="listbox" aria-expanded="${popupOpen}" aria-controls="<listboxId>" aria-autocomplete="list"` (combobox ARIA, per APG Combobox); when free: plain `<input>`, no combobox role |
| entry input | `aria-label` or `aria-labelledby` | labelled by the field `<label>` via `aria-labelledby`; or standalone `aria-label` if no visible label |
| entry input | `placeholder` | the `placeholder` param value; only shown when `tags` is empty (CSS: hide when well has `.has-tags`) |
| suggestion popup | `role="listbox" id="<listboxId>"` | `aria-label="Suggestions"` or `aria-labelledby` → the entry input id |
| each suggestion option | `role="option" aria-selected` | `aria-selected="true"` if the suggestion's id is already in `tags` (prevents re-adding) |
| clear-all button | `<button aria-label="Clear all tags">` | real `<button>`; only present when `clearable` and `tags` non-empty |
| live region | `role="status" aria-live="polite" aria-atomic="true"` | announces: "Tag removed", "Tag added: <label>", "No matches", count when async results arrive; hidden from layout (`position:absolute; clip-path:inset(100%)`) |

### Keyboard map (the load-bearing table — `tags-input.enhancer.ts` owns all non-platform rows)

| key | context | does | who |
|---|---|---|---|
| Tab | anywhere | moves focus in / out per normal tab order; when entering the field, focuses the FIRST chip (if any) or the entry input | platform + enhancer (roving entry) |
| Shift+Tab | anywhere | reverse tab order; when inside the field, leaves to the previous focusable outside | platform + enhancer |
| ArrowLeft | chip focused | moves to the previous chip; wraps to entry input at the first chip | enhancer (roving tabindex) |
| ArrowRight | chip focused | moves to the next chip; wraps to entry input after the last chip | enhancer (roving tabindex) |
| ArrowLeft | entry input, cursor at position 0 | moves focus to the LAST chip (if any) | enhancer |
| ArrowRight | entry input, cursor at end | no effect (already at the end of the row) | enhancer |
| Backspace | entry input, cursor at position 0, input empty | removes the LAST tag (`removeTag(lastId)` wire action); focus stays on the entry input | enhancer → wire |
| Backspace / Delete | chip focused | removes THIS chip (`removeTag(chip.dataset.tagId)` wire action); focus moves to the next chip, or to the previous chip if this was the last, or to the entry input if no chips remain | enhancer → wire |
| Enter | entry input, mode=free or mode=suggestions | commits the current `inputValue` as a new tag (`addTag` wire action); clears the input; stays on the entry input | enhancer → wire |
| Enter | entry input, popup open, active suggestion | selects the active suggestion (`selectSuggestion` wire action); closes popup | enhancer → wire (delegates to `collection-nav`) |
| Enter | chip focused | activates the remove button (same as clicking the chip's remove button; fires `removeTag`) | enhancer → wire |
| Space | chip focused | activates the remove button (same as Enter on chip) | enhancer → wire |
| , (comma) or the configured `delimiter` | entry input | same as Enter: commits the in-progress text as a new tag | enhancer → wire |
| Escape | popup open | closes the suggestion popup; returns focus to the entry input | enhancer (delegates to `collection-nav`) |
| Escape | no popup | clears `inputValue` (does NOT remove chips); focus stays on entry input | enhancer → wire (`inputChange("")`) |
| Home | chip area focused | moves focus to the first chip | enhancer (roving tabindex) |
| End | chip area focused | moves focus to the last chip, or to the entry input | enhancer (roving tabindex) |
| ArrowDown / ArrowUp | entry input, popup open | moves active suggestion in the popup (roving via `aria-activedescendant`) | `collection-nav` enhancer |
| ArrowDown | entry input, popup closed, mode ≠ free | opens the popup | enhancer → wire (`togglePopup`) |
| Ctrl+A / Cmd+A | inside the well | selects all text in the entry input (native); does NOT select/highlight chips | platform (native browser select-all in the `<input>`) |
| printable character | entry input | types into the input; fires `inputChange` (debounced, updates `inputValue`; in non-free modes, filters suggestions) | platform typing + enhancer debounce → wire |
| paste | entry input | pastes + splits on the `delimiter`; each split segment is committed as a tag via `addTag` | enhancer (paste handler → wire) |

### Focus management

**Roving tabindex on chips** (APG Keyboard Interface, roving-tabindex model):
the enhancer maintains exactly one chip with `tabindex="0"` at any time; all others have
`tabindex="-1"`. The entry input always has its own native `tabindex` (never removed from
tab order). This means Tab from outside enters the FIRST chip (not the entry input) when
chips are present, mirroring the behavior of a select-all-items focus target.

**Focus after removal** (APG guidance: "authors must manage focus" when the active element is
removed from the DOM):
- if the removed chip had a NEXT chip → focus moves to that next chip.
- if the removed chip was the LAST chip and there is a PREVIOUS chip → focus moves to that
  previous chip.
- if the removed chip was the only chip → focus moves to the entry input.
The wire round-trip re-renders the chip list; the bespoke morph preserves DOM node identity
where possible, but a removed chip is gone; the enhancer fires the focus-move BEFORE the
round-trip completes (on the now-stale DOM), and the morph preserves focus on the surviving
chip by identity. If the surviving chip's DOM node is replaced rather than morphed, the
enhancer re-roots focus after the morph (lifecycle `onComponentUpdate`).

**Suggestion popup focus**: the popup is non-modal (no trap). Focus stays on the entry input;
the active suggestion is virtual (`aria-activedescendant` on the entry input), not DOM focus.
This is the same APG Combobox model used by `select` and `combobox`. On popup close (Esc or
selection), focus stays on the entry input (already there).

**No focus trap**: tags-input is a non-modal form control. Tab always moves out.

**Scroll**: the well scrolls internally (horizontally in single-row mode, vertically in wrap
mode) to keep the focused chip visible; the enhancer calls `chip.scrollIntoView({block:"nearest"})`.

### Live region
`role="status" aria-live="polite"` (shared announcer, or a local `role=status` div in the
component root). Announces:
- "Tag added: {label}" on successful `addTag`.
- "Tag removed: {label}" on successful `removeTag`.
- "Maximum {n} tags reached" when `addTag` rejects due to `maxTags`.
- "{n} suggestions" when the popup opens or the result set changes (when mode ≠ free).
- "No matches" when the filtered suggestion list is empty.

### Shared mechanisms composed
- **`collection-nav.enhancer.ts`** — the suggestion popup's listbox keyboard (ArrowUp/Down,
  Home/End, typeahead, `aria-activedescendant`, scroll-into-view). DO NOT re-implement; the
  `tags-input` enhancer composes it by mounting it on `data-slot="suggestions-popup"` when
  the popup is present in the DOM.
- **Popover seam** — the suggestion popup uses the native `popover` attribute + CSS Anchor
  Positioning for positioning + light-dismiss (click outside closes). Same seam as `select`,
  `combobox`, `dropdown-menu`. DO NOT re-implement positioning.

---

## 5. Tokens

### Consumed tokens (all `var(--lv-*)`, never a literal)

| token | used for |
|---|---|
| `--lv-color-input` | well background |
| `--lv-color-border` | well border |
| `--lv-color-fg` | entry input text, chip default label text |
| `--lv-color-muted` | placeholder text, disabled text |
| `--lv-color-primary` / `--lv-color-primary-fg` | chip default intent (or `default` intent) |
| `--lv-color-info` / `--lv-color-info-fg` | chip `info` intent |
| `--lv-color-success` / `--lv-color-success-fg` | chip `success` intent |
| `--lv-color-warning` / `--lv-color-warning-fg` | chip `warning` intent |
| `--lv-color-destructive` / `--lv-color-destructive-fg` | chip `destructive` intent; `aria-invalid` border |
| `--lv-color-accent` / `--lv-color-accent-fg` | chip hover background (the default-intent chip hover) |
| `--lv-color-popover` / `--lv-color-popover-fg` | suggestion popup background/text |
| `--lv-color-overlay` | not needed (no modal overlay) |
| `--lv-ring` | focus ring on the well (`:focus-within`) and on focused chips |
| `--lv-ring-offset` | focus ring offset |
| `--lv-space-1` | chip remove button icon size (tight) |
| `--lv-space-2` | chip internal horizontal padding |
| `--lv-space-3` | chip internal horizontal padding (md) |
| `--lv-space-4` | well internal padding |
| `--lv-space-6` | chip height (sm mode) |
| `--lv-space-7` | chip height (md mode); NET-NEW — see below |
| `--lv-space-8` | well minimum height (sm); chip height (lg mode) |
| `--lv-space-9` | well minimum height (md, default) |
| `--lv-space-10` | well minimum height (lg) |
| `--lv-text-xs` | chip text (sm) |
| `--lv-text-sm` | chip text (md, default); entry input text |
| `--lv-text-base` | chip text (lg); entry input text (lg) |
| `--lv-radius-full` | chip border-radius (pill shape, the canonical chip form) |
| `--lv-radius-md` | well border-radius |
| `--lv-radius-md` | suggestion popup border-radius |
| `--lv-shadow-md` | suggestion popup elevation |
| `--lv-z-popover` | suggestion popup z-index |
| `--lv-font-sans` | all text |
| `--lv-transition-colors` | chip hover color transition |

### Net-new tokens proposed

**`--lv-space-7`** (intermediate chip height, 28px): the chip height scale needs an intermediate
size between `--lv-space-6` (24px, too tight for md) and `--lv-space-8` (32px, too tall for
the md chip inside the md well). This is the same gap noted in the architecture contract (§4):
"a denser `--lv-space-7`" is explicitly called out as a candidate additive token. Added to
`:root` as `--lv-space-7: 1.75rem` (28px) and to `.dark, [data-theme="dark"]` (structural
token, theme-invariant — only stated in `.dark` for completeness; spacing tokens do not change
with theme). NOT a new colour; purely a spacing unit.

---

## 6. Wire actions (the round-trip map)

### Directives the template binds

| directive | on element | fires |
|---|---|---|
| `l:keydown.enter="addTag"` | entry input (free / suggestions mode) | `addTag(inputValue)` |
| `l:model.debounce.200ms="inputValue"` | entry input | `inputChange(value)` with 200ms debounce; updates `inputValue`; in non-free modes also updates `activeQuery` and toggles `popupOpen` |
| `l:click="removeTag" data-tag-id="<escaped>"` | chip remove `<button>` | `removeTag(id)` via the per-chip escaped `data-tag-id` channel (SAFE, through `Escape.htmlAttribute`) |
| `l:click="clearAll"` | clear-all `<button>` | `clearAll()` |
| `l:click="togglePopup"` | entry input or the well (click anywhere not on a chip/button) | `togglePopup()` |
| `l:click="selectSuggestion" data-suggestion-id="<escaped>"` | each suggestion option | `selectSuggestion(id)` via escaped `data-suggestion-id` |

### Enhancer wire-action wiring (the client-side side of the same round-trips)

The enhancer does NOT call wire actions directly for chip navigation (pure client, no round-trip).
It fires wire actions on:
- **Backspace on empty input** → `removeTag(lastTag.dataset.tagId)` (reads `data-tag-id` from
  the last chip DOM node, then fires the wire action via the runtime's `callAction` API).
- **Delete/Backspace on focused chip** → `removeTag(chip.dataset.tagId)` + focus-move logic
  (the focus move happens client-side immediately; the server re-renders; the morph reconciles).
- **Enter on focused chip** → same as above (a chip Enter/Space is a remove activation).
- **Paste** → splits the pasted text on `data-delimiter`, then queues a `addTag(segment)`
  wire call for each non-empty segment sequentially (or as a batch if the server supports a
  `addTags(List<String>)` action — see below).
- **Comma / delimiter key** → same as Enter: `addTag(inputValue)`.

### Server actions (what they mutate)

| action | validates | mutates | re-renders |
|---|---|---|---|
| `addTag(label)` | `label` is non-empty; not already in `tags`; `mode=suggestions-only` → label must match a suggestion label (exact, case-insensitive); `tags.size() < maxTags` OR `maxTags==0` | appends `Tag(id=uuid, label=trimmed, intent=default)` to `tags`; clears `inputValue` | the chip list + entry input + live region announcement |
| `removeTag(id)` | id is in `tags` | removes the `Tag` with `id` from `tags` | the chip list + live region announcement |
| `clearAll()` | `!disabled` | empties `tags` | the chip list + clear-all button (gone) |
| `inputChange(value)` | — | sets `inputValue = value`; if `asyncSuggestions`, sets `activeQuery = value` + schedules an HTMX suggestions-fragment swap; if static suggestions, the template filters `_instance.filteredSuggestions()` | the entry input value + (in non-free modes) the suggestion popup content |
| `selectSuggestion(suggestionId)` | id is in `suggestions`; not already in `tags`; `maxTags` check | calls `addTag(suggestion.label)` internally; closes popup | chip list + popup closed |
| `togglePopup()` | mode ≠ free | flips `popupOpen` | the popup visibility |

**Batch-add** (optional, for paste): if the adopter wires `addTags(List<String> labels)` as an
extra `@LievitAction`, the enhancer can fire a single round-trip for a pasted multi-segment
value. The base spec requires only `addTag` (sequential single-calls are correct, just slower
for large pastes). The `addTags` variant is an OPTIONAL adopter extension; it is not in the
base `TagsInputComponent`.

### The round-trip flow (canonical sequence)

```
User types "paris" → Enter (or comma)
  → enhancer fires l:keydown.enter → runtime POST /lievit/{id}/call action=addTag value=paris
  → server: validates, appends Tag{id="t7", label="paris"}, clears inputValue
  → server re-renders the template → response: HTML + rotated snapshot
  → morph patches the chip list (new chip "paris" appears) + clears the input
  → enhancer's onComponentUpdate: re-roots roving tabindex to include the new chip
  → live region: "Tag added: paris"
```

---

## 7. Acceptance tests (gate — refute-by-default; all must pass on REAL substrate)

The client-island-fidelity lesson is load-bearing here: the chip keyboard and paste tests
MUST run the REAL `LievitRuntime` + the REAL enhancer mounted — no mocked `$lievit`, no jsdom
with a fake chip container that doesn't actually mount the enhancer's event listeners.

### Render (real `LievitRuntime` + jsdom, REAL enhancer mounted)

- **render-well**: the well renders `data-slot="tags-input"` on the root; the entry input is
  present; `data-slot="chip"` elements match `tags.size()`; each chip shows its `tag.label`.
- **render-chip-roles**: each chip has `role="option" aria-selected="true"`; each chip's remove
  button has `aria-label="Remove <label>"` matching the chip label.
- **render-root-group**: the root has `role="group"` + `aria-labelledby` resolving to the
  field label's id.
- **render-combobox-input** (mode ≠ free): the entry input has `role="combobox"
  aria-haspopup="listbox" aria-expanded="false"` when popup is closed; `aria-expanded="true"`
  after `togglePopup`.
- **render-disabled**: when `disabled=true`, the entry input has `disabled`; chip remove buttons
  are absent from the DOM (not just invisible); root has `aria-disabled="true"`.
- **render-intent**: a chip with `intent="destructive"` has `data-intent="destructive"` and
  renders the destructive token class (the XSS escaping channel test: a hostile `label` value
  like `"><script>` is HTML-escaped in both the chip text and `aria-label`; renders inert).
- **render-max-reached**: when `tags.size() == maxTags > 0`, the entry input has `disabled` +
  `aria-disabled`; root has `data-max-reached`.
- **render-placeholder**: placeholder text is visible when `tags` is empty; hidden (CSS) when
  at least one chip is present.
- **render-clear-all**: the clear-all button is present when `tags` non-empty; absent when empty.
- **render-live-region**: a `role="status"` element is present in the DOM (hidden from layout).

### Accessibility (axe-core, zero violations)

- **axe-open-state**: zero APG violations on the DOM when popup is closed.
- **axe-popup-open**: zero violations on the DOM when the suggestion popup is open (mode=suggestions).
- **axe-chip-accessible-names**: every chip has a non-empty accessible name (the `aria-label`
  includes the tag label; the axe "button-name" rule on the remove button, the "aria-label"
  rule on the chip). Missing accessible names → the test FAILS (same rule as the iconOnly
  button test).
- **axe-group-labelled**: `role="group"` has an accessible name (`aria-labelledby` → the label
  element; axe "group" rule).

### Keyboard (each key in the §4 map asserted on the REAL enhancer, REAL jsdom + runtime)

- **key-arrowleft-cursor-zero**: focus on entry input at position 0 → ArrowLeft → assert focus
  moves to the last chip (`document.activeElement === lastChip`).
- **key-arrowleft-between-chips**: focus on chip[1] → ArrowLeft → assert focus on chip[0].
- **key-arrowright-to-input**: focus on last chip → ArrowRight → assert focus on entry input.
- **key-home-end**: focus on chip[2] → Home → assert chip[0]; End → assert entry input.
- **key-backspace-removes-last**: focus on entry input with empty value → Backspace → assert
  `removeTag` wire action fired with the last chip's id; after morph, that chip is gone.
- **key-delete-removes-focused**: focus on chip[1] → Delete → assert `removeTag` fired; after
  morph, chip[1] is gone; assert focus moved to what was chip[2] (or chip[0] if it was last).
- **key-enter-adds-tag**: focus on entry input, input value = "berlin" → Enter → assert
  `addTag("berlin")` fired; after morph, a chip "berlin" appears; input is cleared.
- **key-comma-adds-tag**: same as Enter but with the comma key.
- **key-enter-on-chip**: focus on chip[0] → Enter → assert `removeTag(chip[0].tagId)` fired.
- **key-escape-clears-input** (no popup): focus on input, value = "par" → Esc → assert
  `inputChange("")` fired; after morph, input is empty.
- **key-escape-closes-popup** (popup open): Esc → assert `togglePopup()` fired; after morph,
  `aria-expanded="false"` on the entry input.
- **key-arrowdown-opens-popup** (mode=suggestions, popup closed): ArrowDown on entry input →
  assert `togglePopup()` fired; after morph, popup is open.
- **key-tab-exits-field**: Tab on the last interactive child (entry input or last chip) → focus
  moves to the next element OUTSIDE the well (assert `document.activeElement` is outside the
  tags-input root).

### Focus management (REAL substrate)

- **focus-roving-init**: on first Tab into a component with 3 chips, exactly one chip has
  `tabindex="0"` and the others have `tabindex="-1"`.
- **focus-after-remove-next**: remove chip[1] of [0,1,2] → focus lands on what was chip[2]
  (now chip[1] after re-index).
- **focus-after-remove-last**: remove the only chip → focus lands on the entry input.
- **focus-after-remove-last-of-many**: remove the last chip of 3 → focus lands on what was
  chip[1] (the new last).
- **focus-chip-scrolls-into-view**: in a wrapped well with many chips, focusing chip[N] via
  ArrowLeft calls `scrollIntoView`; the chip is not clipped.
- **focus-popup-stays-on-input**: open the suggestion popup → ArrowDown moves `aria-activedescendant`
  on the entry input; `document.activeElement` remains the entry input (NOT the popup option).

### Paste (REAL enhancer paste handler)

- **paste-single**: paste "london" → `addTag("london")` fired once.
- **paste-multi**: paste "london,paris,rome" (delimiter=`,`) → `addTag` fired 3 times, in order;
  3 chips appear after morph.
- **paste-trims**: paste " london , paris " → chips are "london" and "paris" (trimmed).
- **paste-empty-segments**: paste ",,berlin," → only `addTag("berlin")` fired; no empty tags.

### Wire round-trip IT (lievit-kit, real LievitRuntime, `CollapsibleComponentIT` pattern)

- **rt-add-tag**: mount with `tags=[]` → submit `inputValue="london"` → re-render asserts one
  chip with label "london"; `tags.size() == 1`.
- **rt-remove-tag**: mount with `tags=[{id:"t1",label:"london"}]` → fire `removeTag("t1")` →
  re-render asserts chip list is empty.
- **rt-clear-all**: mount with 3 tags → fire `clearAll()` → re-render asserts `tags` is empty +
  clear-all button is absent.
- **rt-max-tags-rejects**: mount with `maxTags=2, tags=[t1,t2]` → fire `addTag("london")` →
  re-render asserts still 2 tags (the third was rejected); `data-max-reached` present.
- **rt-duplicate-rejects**: mount with `tags=[{label:"london"}]` → fire `addTag("london")` →
  re-render asserts still 1 tag.
- **rt-suggestions-only-rejects-free**: mount with `mode=suggestions-only, suggestions=[{id:s1,label:"London"}]`
  → fire `addTag("paris")` → re-render asserts `tags` unchanged.
- **rt-select-suggestion**: mount with `mode=suggestions, suggestions=[{id:s1,label:"London"}]`
  → fire `selectSuggestion("s1")` → re-render asserts chip "London" present + `popupOpen=false`.

### JTE compiles + renders

Covered by the `test/jte-compile` real-compiler + render gate (all modes: free / suggestions /
suggestions-only; all sizes: sm / md / lg; disabled; all intents on chips; popup open + closed).

### Escaping (the XSS abuse-cases)

- **xss-tag-label**: a `Tag` with `label = '"><script>alert(1)</script>'` renders the label
  text as inert escaped HTML in the chip; the `data-tag-id` attribute is HTML-escaped via
  `Escape.htmlAttribute`; no script executes.
- **xss-suggestion-id**: a `Suggestion` with `id = '"><script>x</script>'` renders the
  `data-suggestion-id` attribute escaped; no script executes.
- **xss-input-value**: a hostile `inputValue` from the server round-trip is rendered in the
  `<input value="...">` attribute via JTE's default escaping; no raw injection.

### Playwright (gesture fidelity, legacy-VM oracle)

- **e2e-add-and-remove**: real `page.keyboard.type("london")` + `page.keyboard.press("Enter")` →
  chip "london" appears in the DOM; real click on remove button → chip gone.
- **e2e-paste**: real `page.keyboard.insertText("london,paris,rome")` → 3 chips appear.
- **e2e-arrow-nav**: real `page.keyboard.press("ArrowLeft")` from the entry input navigates to
  the last chip (assert `document.activeElement` via Playwright's `evaluateHandle`).
- **e2e-suggestions-popup**: real `page.keyboard.press("ArrowDown")` on a non-free mode
  tags-input opens the popup; real ArrowDown navigates options; Enter adds the tag.

---

## 8. Non-goals / anti-patterns

- **No framework (Lit, Alpine, React) inside the enhancer.** The enhancer is typed-vanilla-TS
  that reads the server-rendered DOM and fires wire actions. It does not re-render chips
  client-side; the server owns the chip list.
- **No client-only chip state.** Adding a tag is a wire round-trip; the chip does not appear
  optimistically before the server confirms. The server validates (duplicate, maxTags,
  suggestions-only), and the morph is the source of truth.
- **No drag-reorder of chips** (S1 scope). The builder + repeater handle ordered drag; tags-input
  treats its tag set as unordered (or insertion-ordered by the server). Drag-reorder would be a
  separate WIRE action + drag-enhancer, deferred to S2.
- **No maxTagCount collapse ("+N more" overflow)** in S1. The well wraps chips vertically.
  The Ant Design `maxTagCount` truncation mode (show N chips + "+3 more" badge) is a future S2
  variant; it is not in this spec.
- **No inline chip editing** (double-click to edit a chip). The chip label is read-only once
  committed; removal + re-addition is the edit flow.
- **No color-picker per chip.** The `intent` is a server-assigned semantic signal, not a
  user-chosen colour. An adopter who needs user-chosen chip colours extends `Tag.intent` with
  a custom value + custom CSS; the component does not ship a colour-picker UI inline.
- **No re-implementation of `collection-nav`.** The suggestion popup listbox keyboard MUST
  compose the shared `collection-nav.enhancer.ts`. Any attempt to hand-roll ArrowUp/Down +
  typeahead in the tags-input enhancer is the anti-pattern the single-source rule prevents.
- **No `<script>` in the template.** All interactivity is in the typed-TS enhancer; the JTE
  template is strictly HTML + Tailwind utilities + `--lv-*` tokens. The CSP refuses inline
  scripts silently.
- **No data hardcoded in the partial.** Chip labels, suggestion labels, intents, and the
  delimiter all arrive via `@param` from the WIRE Java component; never hardcoded in the JTE.
- **No ARIA roles on non-semantic divs when a native element fits.** The remove button is a
  real `<button>`, not a `<div role="button">`. The entry input is a real `<input type="text">`.
  The chip group is `role="group"` on a plain container (no interactive role on the container
  itself). Prefer native elements; the architecture contract §2.a is explicit on this.

---

## 8a. Agent instructions (the discipline reminders, verbatim)

- Generate ORIGINAL code over `--lv-*` tokens. You MAY read Ant Design Select (tags mode) +
  react-aria `useTagGroup` SPEC + Tailwind UI tag-list examples as references for PATTERN
  (a11y, inventory) and LOOK. You MUST NOT paste literal source from ANY of them (no
  react-aria / ant-design / Tailwind-UI code or class strings) — the output is always original
  generation. (The one bright line, `02-licensing.md`.)
- The BUILT a11y model in §4 IS the source of truth. Do not re-derive it; implement it.
  The keyboard map in the table is the contract — assert ALL of it in the acceptance tests.
- Compose `collection-nav.enhancer.ts` for the suggestion popup (do NOT hand-roll roving +
  typeahead inside the tags-input enhancer — that is the failure mode the single-source rule
  prevents). Compose the popover seam for the suggestion popup positioning.
- Mirror `button.jte` house conventions exactly: header doc-comment with credits, typed `@param`,
  `data-slot`, the two escaping channels (`attrs` trusted-raw, `dataAttrs`/`wireArgs` SAFE
  escaped via `Escape.htmlAttribute`), zero `<script>`, zero inline `on*=`.
- The tag id written into `data-tag-id` on each chip comes from `tag.id()` via `wireArgs`/
  `dataAttrs` — SAFE channel only. It must never go through the `attrs` (trusted-raw) channel.
  Same for `data-suggestion-id`.
- Focus management after removal is the hardest part. Implement the three-case rule (next /
  previous / entry-input) in the enhancer's `onComponentUpdate` lifecycle hook, AFTER the
  morph, not before. The chip DOM nodes change after a morph; re-root the roving tabindex
  from the fresh `querySelectorAll('[data-slot="chip"]')` result every time.
- The render test MUST assert the chip body is VISIBLE after add and ABSENT after remove
  (the projection assertion is the lesson — from the client-island-fidelity rule).
- Minimal code to GREEN against the acceptance tests; refactor only while green.
