<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — mentions (BUILT: trigger-char combobox over a textarea, +ENH)

- **tier**: WIRE + ENH (`mentions.enhancer.ts` + `collection-nav.enhancer.ts` + popover seam)
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: NET-NEW (no existing `registry/jte/mentions.jte`; the existing `combobox.jte` is
  a separate, trigger-free component and is not reused as a base)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Combobox (BUILT: trigger-char variant — APG does not define a trigger-char
      specialisation, so this is built against the raw APG Combobox pattern + the editable-combobox
      keyboard model; `aria-activedescendant` + `listbox` popup; cite:
      https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ and
      https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/ )
    - inventory: Ant Design Mentions as inventory reference (`@`/`#`/custom triggers, async suggest,
      option groups, avatar + label rows, `placement`, `rows`, `maxLength`, `readonly`; confirm-key;
      `getPopupContainer`; form field integration)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code
      copied)

---

## 1. What it is

A mentions input: a **multi-line textarea** that watches what the user types and opens a **suggestion
listbox** when they type a configured trigger character (`@`, `#`, or a custom string). The user picks a
suggestion from the listbox; the component inserts a **mention token** (the trigger char + the selected
label + a trailing separator) into the textarea at the cursor, replacing the trigger-word prefix they
typed. The resulting raw text value (which includes the mention tokens) is the server-persisted field value.

**Why WIRE**: two pieces of state are server facts: (a) the **suggestion list** — it is always fetched
from the server (the mention candidates, e.g. users, tags, issues), either eagerly or async on each
trigger activation; and (b) the **value** of the textarea (the text with embedded mention tokens, the
field that gets submitted). The server owns both. The client's irreducible job is: detect the trigger
char, extract the typed prefix, open/navigate/close the suggestion popup, and insert the selected token —
the three ENH modules own that.

**Why not PARTIAL or native**: a `<textarea>` with trigger-char detection and a positioned popup
listbox cannot be expressed as a native platform element and cannot be driven purely by a server
round-trip without unacceptable UX cost (the popup must appear synchronously with the typed character;
a wire round-trip at 50 ms would not do). The ENH layer is the irreducible client bit.

**Server-first is preserved**: the suggestion candidates, the field value, and the final form submission
are all server-side facts. The ENH only reads the textarea's in-progress text to detect the trigger,
extracts the prefix, filters or requests candidates, drives the popup DOM, and on commit fires a wire
action to record the confirmed value. No client-side domain data is invented; the server renders the
suggestion list DOM and the initial field value; the client patches.

---

## 2. API — the WIRE surface + template params

### Java (`MentionsComponent`)

| member | kind | meaning |
|---|---|---|
| `value` `String` | `@Wire` | the textarea raw text value (mention tokens included, e.g. `"Hello @alice and #bug-123"`) |
| `triggers` `List<TriggerConfig>` | `@Wire @LievitProperty(locked=true)` | one entry per trigger character; each `TriggerConfig` carries `char` (the single char, e.g. `"@"`), `dataSourceId` (the server-side provider key), and optional `split` (the separator inserted after a chosen token, default `" "`) |
| `suggestions` `List<Suggestion>` | `@Wire` | the CURRENT rendered suggestion list for the ACTIVE trigger and prefix; populated by `loadSuggestions()`; empty when no popup is active |
| `activeTriggerChar` `String` | `@Wire` | which trigger char is currently active (`null` when popup is closed) |
| `activePrefix` `String` | `@Wire` | the text typed after the active trigger char so far (used server-side to filter) |
| `open` `boolean` | `@Wire` | whether the suggestion popup is visible |
| `placement` `String` | `@Wire @LievitProperty(locked=true)` | `"bottom-start"` (default) \| `"top-start"` — popup anchor direction |
| `rows` `int` | `@Wire @LievitProperty(locked=true)` | visible row count on the textarea (default `4`) |
| `maxLength` `Integer` | `@Wire @LievitProperty(locked=true)` | `null` (no limit) or a max char count; emitted as `maxlength` on the `<textarea>` + a live count display |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | textarea placeholder text |
| `readonly` `boolean` | `@Wire @LievitProperty(locked=true)` | `false` (default); when `true` the textarea is `readonly`, the trigger detection is disabled |
| `disabled` `boolean` | `@Wire @LievitProperty(locked=true)` | `false`; when `true` the textarea is `disabled`, the trigger detection is disabled |
| `name` `String` | `@Wire @LievitProperty(locked=true)` | the HTML `name` attribute for form submission |
| `loadSuggestions(String trigger, String prefix)` | `@LievitAction` | called by the enhancer when a trigger fires or the prefix changes; sets `suggestions`, `activeTriggerChar`, `activePrefix`, `open=true`; the server filters the candidate list by `prefix` (case-insensitive prefix match or delegates to the registered `dataSourceId`); no state mutates before validation |
| `confirmMention(String trigger, String tokenLabel, int start, int length)` | `@LievitAction` | called by the enhancer on selection commit (Enter or click); the server replaces the range `[start, start+length]` in `value` with the full token (`trigger + tokenLabel + split`), sets `open=false`, clears `suggestions` / `activeTriggerChar` / `activePrefix`; validates that `trigger` is a known configured char and `tokenLabel` is in the last-rendered `suggestions` list before mutating |
| `dismissPopup()` | `@LievitAction` | called by the enhancer on Esc or when the trigger word is erased; sets `open=false`, clears `suggestions` / `activeTriggerChar` / `activePrefix` |
| `updateValue(String value)` | `@LievitAction` | called by `l:model.debounce` on the textarea to keep `value` in sync for form-save flows; validates `maxLength` before mutating |

### `Suggestion` (the suggestion item model)

| field | type | meaning |
|---|---|---|
| `id` `String` | value used in `tokenLabel` on commit; also used as the `role=option` `id` attribute (escaped) |
| `label` `String` | display label (shown in the popup row and inserted as the token label after trigger char) |
| `description` `String` | optional secondary line (e.g. email, tag description) |
| `avatarUrl` `String` | optional avatar image URL; `null` = no avatar shown |
| `group` `String` | optional group header string; `null` = ungrouped; suggestions sharing the same `group` are visually sectioned |
| `disabled` `boolean` | when `true`, the option is rendered but not selectable (visible in the list, skipped by keyboard nav) |

### `TriggerConfig` (per-trigger server config)

| field | type | meaning |
|---|---|---|
| `char` `String` | the single trigger character (e.g. `"@"`, `"#"`) |
| `dataSourceId` `String` | identifies the server-side candidate provider to call in `loadSuggestions` |
| `split` `String` | separator appended after the token label on commit (default `" "`) |
| `minChars` `int` | how many chars after the trigger char before `loadSuggestions` is called (default `0` = fire on trigger char itself) |
| `maxOptions` `int` | max number of suggestions the server returns for this trigger (default `10`) |

### Template params

`@param String value`, `@param List<Suggestion> suggestions`, `@param String activeTriggerChar`,
`@param boolean open`, `@param String placement`, `@param int rows`, `@param Integer maxLength`,
`@param String placeholder`, `@param boolean readonly`, `@param boolean disabled`, `@param String name`,
`@param ComponentMetadata _component`, `@param MentionsComponent _instance`.
No `Content` slot (WIRE has none — owned template markup only; server-first refactor blueprint §1.b).

---

## 3. Variants / sizes / states

### Sizes

`size` `@param String` (default `"md"`) — controls the textarea font size and the popup option row height.
Height-based alignment applies to the popup rows (not the textarea itself, which grows by `rows`).

| size | popup option row height | textarea font | when |
|---|---|---|---|
| `sm` | `--lv-space-8` (32 px) | `--lv-text-sm` | dense forms |
| `md` | `--lv-space-9` (36 px, default) | `--lv-text-base` | standard use |
| `lg` | `--lv-space-10` (40 px) | `--lv-text-base` | prominent / touch-first |

### States

| state | how expressed | ARIA reflection |
|---|---|---|
| `disabled` | native `disabled` on `<textarea>`; `disabled:` Tailwind utilities; trigger detection skipped | `aria-disabled` is NOT redundant on a native disabled element — native `disabled` is sufficient |
| `readonly` | native `readonly` on `<textarea>`; trigger detection skipped | no ARIA needed; the native attribute is read by AT |
| `aria-invalid` | destructive border + ring on the textarea wrapper | `aria-invalid="true"` on the `<textarea>`; error message in linked `<span aria-live="polite">` |
| `open` (popup visible) | suggestion listbox present in DOM, positioned via the popover seam | `aria-expanded="true"` on the `<textarea>` (`role=combobox`) |
| closed (no active trigger) | suggestion listbox absent from DOM (not `display:none` — fully removed) | `aria-expanded="false"`, `aria-activedescendant` attribute removed |
| `aria-busy` | set by the runtime `beforeCall`/`afterCall` hook during a wire round-trip | `aria-busy="true"` on the component root; the template does not manage it |
| char count | visible count when `maxLength` is set | `aria-live="polite"` counter; `aria-invalid` triggers at limit |

### Popup open trigger variants

The component supports multiple concurrent trigger configs; only ONE popup is open at a time.
Switching trigger chars without closing first is handled: the enhancer calls `dismissPopup()` for the
previous trigger before firing `loadSuggestions()` for the new one.

---

## 4. The a11y contract (the load-bearing section)

### WAI-ARIA pattern

**APG Combobox (BUILT: trigger-char specialisation).**
The APG editable combobox pattern is the authoritative source:
https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
The trigger-char variant is NOT an APG example (APG does not define this sub-pattern), so it is BUILT
against the raw APG Combobox spec: the `<textarea>` carries `role="combobox"`, the popup is a
`role="listbox"`, and `aria-activedescendant` on the textarea tracks the active suggestion.

### Roles + ARIA attributes (what the template emits)

| element | role / ARIA | note |
|---|---|---|
| `<textarea>` | `role="combobox"` | overrides the implicit textbox role; the combobox role is correct for an editable input that controls a popup |
| `<textarea>` | `aria-expanded="${open ? "true" : "false"}"` | reflects `open` state |
| `<textarea>` | `aria-controls="<listboxId>"` | references the suggestion listbox by ID |
| `<textarea>` | `aria-autocomplete="list"` | the popup provides a list of completions; the value is not auto-completed in-place |
| `<textarea>` | `aria-activedescendant="<activeOptionId>"` | set by the enhancer (not the server); references the currently keyboard-focused option; ABSENT when no option is active |
| `<textarea>` | `aria-labelledby` / `aria-label` | provided by the consuming `field` wrapper via `aria-labelledby` pointing to the `<label>` id; the mentions partial itself does NOT emit a visible label (see §8: the field wrapper owns labelling) |
| `<textarea>` | `aria-invalid="true"` | when the consuming `field` detects an error |
| `<textarea>` | `aria-describedby="<errorId> <countId>"` | references both the error region and the char-count region (when `maxLength` is set) |
| suggestion listbox | `role="listbox"` `id="<listboxId>"` | the popup list; present in the DOM only when `open=true` |
| suggestion listbox | `aria-label="<activeTriggerChar> suggestions"` | gives the listbox an accessible name (e.g. "@ suggestions") |
| option group header | `role="presentation"` | the group header row is decorative; the group itself is a `role="group" aria-labelledby="<groupHeaderId>"` |
| each option | `role="option"` `id="<optionId>"` | the id must be unique and stable within a render; used as the `aria-activedescendant` target |
| each option | `aria-selected="false"` | APG requires EVERY option in a single-select listbox to carry `aria-selected`; the ACTIVE option (keyboard-focused) uses `aria-selected="true"` per the APG editable-combobox example |
| each option | `aria-disabled="true"` when `disabled=true` | skipped by `collection-nav` |
| avatar `<img>` | `aria-hidden="true"` | decorative; the option label supplies the accessible name |
| popup container root | `data-slot="mentions-popup"` `popover` | the popover seam's anchor attribute for CSS Anchor Positioning + light-dismiss |

### Keyboard interaction map (complete, load-bearing)

The `<textarea>` is the sole keyboard focus point. The popup and its options are NEVER DOM-focused;
AT focus moves via `aria-activedescendant` (the APG editable-combobox model, verified against
https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/ ).

| key | context | action | who |
|---|---|---|---|
| (any printable char) | textarea (no active trigger) | normal textarea input; the enhancer scans the character for a trigger char; if a trigger is detected, fires `loadSuggestions()` | platform (char insertion) + `mentions.enhancer.ts` (trigger scan) |
| (any printable char that matches a trigger, e.g. `@`) | textarea (no active popup) | opens the popup: enhancer calls `loadSuggestions(trigger, "")` → wire round-trip → `open=true` → listbox renders | `mentions.enhancer.ts` → wire |
| (printable chars after trigger char) | textarea (popup open) | extends the prefix; enhancer calls `loadSuggestions(trigger, newPrefix)` debounced; popup re-renders with filtered results | platform + `mentions.enhancer.ts` (debounced) |
| ArrowDown | textarea (popup open) | moves active option to the next non-disabled option in the listbox; wraps from last to first; updates `aria-activedescendant`; scrolls active option into view | `collection-nav.enhancer.ts` |
| ArrowDown | textarea (popup closed) | no effect (mentions differs from select: the popup is trigger-char-driven, not arrow-to-open) | absorbed by `mentions.enhancer.ts` |
| ArrowUp | textarea (popup open) | moves active option to the previous non-disabled option; wraps from first to last; updates `aria-activedescendant`; scrolls into view | `collection-nav.enhancer.ts` |
| Home | popup open | moves active option to the first non-disabled option in the listbox | `collection-nav.enhancer.ts` |
| End | popup open | moves active option to the last non-disabled option in the listbox | `collection-nav.enhancer.ts` |
| Enter | popup open, option active | commits the active option: fires `confirmMention(trigger, activeLabel, start, length)` → wire inserts token into `value` → `open=false` → popup closes | `mentions.enhancer.ts` → wire |
| Enter | popup open, no option active | commits the first option (if any); if the suggestions list is empty, treated as a normal newline | `mentions.enhancer.ts` → wire (or platform) |
| Enter | popup closed | normal newline in textarea | platform |
| Tab | popup open | commits the currently active suggestion (same as Enter); then moves DOM focus to the next focusable in the page (Tab is the "accept and move on" gesture) | `mentions.enhancer.ts` (commit) + platform (Tab nav) |
| Tab | popup closed | normal tab focus movement | platform |
| Escape | popup open | closes the popup without committing: fires `dismissPopup()` → `open=false`; leaves the typed trigger+prefix text in the textarea as-is; focus stays on the textarea | `mentions.enhancer.ts` → wire |
| Escape | popup closed | no effect (a second Esc does not clear the textarea — caller decides; this component does not consume it) | not handled |
| Backspace / Delete | popup open, prefix non-empty | removes a character from the prefix inside the textarea; enhancer re-derives the prefix and re-queries OR calls `dismissPopup()` if the trigger char itself is deleted | platform (char removal) + `mentions.enhancer.ts` (prefix re-scan) |
| Backspace | popup open, prefix empty (cursor right after trigger char) | deletes the trigger char; enhancer calls `dismissPopup()` since the trigger is gone | platform + `mentions.enhancer.ts` |
| Alt+ArrowDown | textarea | NOT implemented (the trigger-char popup is controlled by typing, not by Alt+Arrow; absorbing this combo would interfere with normal textarea use) | not handled |
| click on option | popup open | commits the clicked option; fires `confirmMention(trigger, clickedLabel, start, length)` | `mentions.enhancer.ts` → wire |
| click outside popup | popup open | fires `dismissPopup()` via the popover seam's light-dismiss | popover seam |
| (focus leaves textarea) | popup open | fires `dismissPopup()`; the popup is bound to the textarea's focus | `mentions.enhancer.ts` (blur handler) |

### Focus management

- **DOM focus stays on the `<textarea>` at all times** while the popup is open.
  This is the APG editable-combobox model: the listbox options are NEVER DOM-focused.
  `aria-activedescendant` on the `<textarea>` is what moves AT focus into the popup.
- **No focus trap**: the popup is non-modal (the user can Tab away, which commits the active suggestion).
  The `focus-trap` enhancer is NOT composed here; it is reserved for modal overlays (dialog/drawer).
- **Focus restore**: when the popup closes (Esc, Backspace-erases-trigger, Tab, or click-outside),
  focus remains on the `<textarea>` — no restore needed because focus never left.
- **Roving tabindex in the popup**: NOT used. The listbox uses `aria-activedescendant` (virtual focus).
  This is the correct APG model for an editable combobox.
- The popup container itself is `tabindex="-1"` (excluded from Tab sequence, per APG: "the popup and
  the popup descendants are excluded from the page Tab sequence").
- The `collection-nav` enhancer manages the `aria-activedescendant` pointer on the `<textarea>` as
  arrow keys move the active option.

### Live regions

- **Suggestion count**: an `aria-live="polite"` region (off-screen, `role="status"`) announces the
  number of available suggestions when the popup opens or the list updates:
  e.g. "3 @ suggestions available". Implemented via the shared live-region announcer.
- **No results**: announces "No suggestions" when `suggestions` is empty and the popup would otherwise
  be silent.
- **Char count**: an `aria-live="polite"` `<span id="<countId>">` shows remaining characters when
  `maxLength` is set (e.g. "247 / 280"); referenced via `aria-describedby` on the `<textarea>`.

### Shared mechanisms composed

- **`mentions.enhancer.ts`** (net-new, this component only): trigger-char scanning, prefix extraction,
  debounced `loadSuggestions` dispatch, `confirmMention` dispatch, Escape/Backspace handling,
  blur-dismiss, cursor-position tracking (start + length of the active trigger-word for server-side
  replace).
- **`collection-nav.enhancer.ts`** (shared, net-new): roving via `aria-activedescendant` within the
  listbox; ArrowUp/Down/Home/End movement; skips disabled options; scrolls active into view; typeahead
  NOT activated here (typing continues in the textarea, not as typeahead in the popup).
- **popover seam** (existing): CSS Anchor Positioning + `popover` attribute for popup positioning
  (`bottom-start` or `top-start` per `placement`); light-dismiss on click-outside.

Do NOT re-implement any of these mechanisms.

---

## 5. Tokens

The component reads the following `--lv-*` tokens:

### Textarea

| token | use |
|---|---|
| `--lv-color-input` | textarea background |
| `--lv-color-input-fg` | textarea text colour |
| `--lv-color-border` | textarea border |
| `--lv-radius-md` | textarea border radius |
| `--lv-text-sm` / `--lv-text-base` | textarea font size (size-dependent) |
| `--lv-font-sans` | textarea font family |
| `--lv-space-3` / `--lv-space-4` | textarea horizontal / vertical padding |
| `--lv-ring` | focus-visible ring on the textarea |
| `--lv-color-destructive` | `aria-invalid` border + ring recolour |
| `--lv-color-muted` | placeholder text, disabled background tint |
| `--lv-color-muted-fg` | char-count secondary text |

### Suggestion popup

| token | use |
|---|---|
| `--lv-color-popover` | popup background |
| `--lv-color-popover-fg` | popup text |
| `--lv-color-border` | popup border |
| `--lv-radius-md` | popup border radius |
| `--lv-shadow-md` | popup elevation (same as `select` popup) |
| `--lv-z-popover` | popup z-index layer |
| `--lv-color-accent` | hovered / active option background |
| `--lv-color-accent-fg` | hovered / active option text |
| `--lv-space-2` | option avatar gap, group label inset |
| `--lv-space-3` | option vertical padding |
| `--lv-space-9` / `--lv-space-8` / `--lv-space-10` | option row min-height (size-dependent) |
| `--lv-text-xs` | option description / secondary line font size |
| `--lv-text-sm` | group header label font size |
| `--lv-color-muted-fg` | option description colour, group header colour |
| `--lv-font-sans` | popup font family |

### Net-new tokens proposed

None. The textarea + popup surface is fully covered by the existing `input` / `popover` / `accent`
token vocabulary. The avatar thumbnail dimension (`2rem`) is derived from `--lv-space-8` (which equals
32 px = `2rem` at default scale) — no new spatial token needed.

OKLCH is the source-of-truth format for all colour tokens (architecture contract §4, D1 DECIDED).

---

## 6. Wire actions + enhancer integration

### `l:*` directives bound in the template

| directive | on element | purpose |
|---|---|---|
| `l:model.debounce.300ms="value"` | `<textarea>` | keeps `value` in sync for form-save flows (debounced to avoid round-trip per keypress); the enhancer listens to the SAME input event BEFORE the debounce fires to detect triggers synchronously |
| `data-lievit-component`, `data-lievit-id`, `data-lievit-snapshot` | component root | standard wire mount attributes (ADR-0019); the enhancer reads the snapshot for action dispatch |

### Wire action signatures and what they mutate

| action | Java signature | mutates | validation in Java |
|---|---|---|---|
| `loadSuggestions` | `void loadSuggestions(String trigger, String prefix)` | `suggestions`, `activeTriggerChar`, `activePrefix`, `open=true` | `trigger` must be in `triggers`; `prefix` length ≤ 200 chars |
| `confirmMention` | `void confirmMention(String trigger, String tokenLabel, int start, int length)` | `value` (replaces `[start, start+length]` with the full token), `open=false`, `suggestions` cleared, `activeTriggerChar` / `activePrefix` cleared | `trigger` in `triggers`; `tokenLabel` must be the `label` of a `Suggestion` in the last-rendered `suggestions` list; `start` + `length` must be within `value.length()`; `maxLength` check on result |
| `dismissPopup` | `void dismissPopup()` | `open=false`, `suggestions` cleared, `activeTriggerChar` / `activePrefix` cleared | none (dismissal is always safe) |
| `updateValue` | `void updateValue(String value)` | `value` | `maxLength` enforced; `value` must be a plain string |

### Round-trip narrative

1. User types `@` in the textarea.
2. `mentions.enhancer.ts` detects the trigger char synchronously (on the `input` event, before the
   `l:model` debounce fires). It records the cursor position `start` (index of `@`) and calls the
   wire action `loadSuggestions("@", "")`.
3. Server sets `suggestions = [Alice, Bob, Carol…]`, `activeTriggerChar = "@"`, `activePrefix = ""`,
   `open = true`. Re-renders the template. The morph mounts the suggestion listbox into the DOM.
4. The popover seam positions the listbox below (or above) the trigger char position.
   `collection-nav` initialises: active option = first non-disabled suggestion; `aria-activedescendant`
   on `<textarea>` is set to the first option's id; announces "3 @ suggestions available".
5. User types `al` — the textarea now reads `@al`. The enhancer calls `loadSuggestions("@", "al")`
   (debounced 300 ms). Server re-renders `suggestions = [Alice, Alicia]`. Morph patches the listbox.
6. User presses ArrowDown — `collection-nav` moves the active option to the next; `aria-activedescendant`
   updated client-side (no round-trip).
7. User presses Enter — `mentions.enhancer.ts` reads the active option's label (`"Alicia"`), computes
   `start` (index of `@`) and `length` (length of `"@al"` = 3), fires `confirmMention("@", "Alicia", start, 3)`.
8. Server replaces `"@al"` in `value` with `"@Alicia "`. Sets `open=false`, clears suggestions.
   Re-renders. Morph removes the listbox. `aria-expanded="false"`. Focus remains on `<textarea>`.
9. The textarea now shows the updated value with `"@Alicia "` inserted; the cursor is placed after
   the inserted token (the enhancer reads the new `value` length after morph and sets `selectionStart`).

### Enhancer architecture detail

`mentions.enhancer.ts` registers a **lifecycle `onComponentInit`** hook (via the runtime lifecycle
registry) and a **directive `data-lv-mentions`** on the component root. On init it:
- Attaches a `input` event listener on the `<textarea>` for trigger scanning and prefix tracking.
- Attaches a `keydown` event listener on the `<textarea>` for Enter/Escape/Tab/Backspace handling
  (when popup is open, these keys are intercepted with `event.preventDefault()` before platform acts).
- Attaches a `blur` event listener to call `dismissPopup()` on focus leave (with a short guard to
  allow click-on-option to complete before blur fires).
- After each morph (`onComponentUpdate` lifecycle hook), re-reads the current `open` state from the
  rendered DOM (`data-slot="mentions-popup"` presence) and re-wires `collection-nav` on the listbox.

`collection-nav.enhancer.ts` is registered by the mentions enhancer on the `role="listbox"` element
after the morph renders it. It manages `aria-activedescendant` on the `<textarea>` (passed as the
`controlledBy` option). It is deregistered when the listbox is removed from the DOM.

---

## 7. Acceptance tests

The component is DONE only when ALL tests pass on a REAL substrate (not a mocked one).

### Render + structure

- **`render: textarea carries combobox role`** (jsdom, real `LievitRuntime`): mount a `MentionsComponent`
  with `open=false`; assert `<textarea role="combobox" aria-expanded="false" aria-controls="<id>"`
  is present; assert no suggestion listbox in the DOM; assert `data-slot="mentions"` on the root.
- **`render: popup renders suggestion rows when open`** (jsdom, real `LievitRuntime`): mount with
  `open=true`, `suggestions=[{id:"a",label:"Alice"},{id:"b",label:"Bob"}]`; assert `role="listbox"`
  is present; assert two `role="option"` elements; assert `aria-expanded="true"` on the textarea.
- **`render: closed popup is absent from DOM (not hidden)`**: mount then close; assert the listbox
  element is not in the DOM at all (not `display:none` — the APG non-modal non-trap pattern).
- **`render: suggestion with avatar renders img aria-hidden`**: a suggestion with `avatarUrl` set
  renders an `<img aria-hidden="true">` beside the label.
- **`render: grouped suggestions render role=group + aria-labelledby`**: suggestions with `group` set
  are wrapped in `role="group" aria-labelledby="<groupHeaderId>"`.
- **`render: disabled option carries aria-disabled`**: a `Suggestion` with `disabled=true` renders
  `aria-disabled="true"` on its `role=option` element.
- **`render: maxLength renders char count + aria-describedby`**: `maxLength=280`; assert a `<span
  aria-live="polite">` with "280 / 280" (full remaining); assert `aria-describedby` on `<textarea>`
  includes the count span's id.
- **`render: readonly textarea`**: `readonly=true`; assert the `<textarea>` has the `readonly` attribute.

### Accessibility (axe-core)

- **`axe: popup open — zero combobox violations`**: render with `open=true` and populated suggestions;
  run `axe-core` with rules `aria-required-attr`, `aria-allowed-attr`, `aria-valid-attr-value`,
  `aria-roles`, `listbox-no-horizontal-scrolling`; assert zero violations.
- **`axe: popup closed — zero violations`**: render with `open=false`; same rules; zero violations.
- **`axe: option without accessible name fails`**: a suggestion whose `label` is `""` must produce an
  axe violation on `aria-label` (asserts the accessible-name gate for options).
- **`axe: textarea accessible name required`**: a `MentionsComponent` rendered WITHOUT a wrapping
  `field` (no `aria-labelledby`) must produce an axe violation on `aria-input-field-name` — confirms
  that the component relies on the field wrapper for labelling.

### Keyboard (real enhancer, real `LievitRuntime`, jsdom)

For all keyboard tests: mount with `open=true`, two suggestions `[Alice, Bob]`, active = first.

- **`keyboard: ArrowDown moves activedescendant to next option`**: dispatch `keydown(ArrowDown)` on
  `<textarea>`; assert `aria-activedescendant` on `<textarea>` equals Bob's option id.
- **`keyboard: ArrowDown wraps from last to first`**: active = last; `keydown(ArrowDown)`; assert
  `aria-activedescendant` = Alice's id.
- **`keyboard: ArrowUp moves activedescendant to previous option`**: active = Bob;
  `keydown(ArrowUp)`; assert `aria-activedescendant` = Alice's id.
- **`keyboard: Home moves to first option`**: active = Bob; `keydown(Home)`; assert first option active.
- **`keyboard: End moves to last option`**: active = Alice; `keydown(End)`; assert last option active.
- **`keyboard: Enter commits active option`**: assert `confirmMention` wire action was dispatched with
  the active option's label, trigger char, and the correct start+length.
- **`keyboard: Escape dismisses popup`**: `keydown(Escape)`; assert `dismissPopup` wire action
  dispatched; assert popup absent from DOM after morph.
- **`keyboard: Tab commits + moves focus`**: `keydown(Tab)`; assert `confirmMention` dispatched;
  assert focus moved to the next focusable element.
- **`keyboard: disabled option is skipped by ArrowDown`**: suggestions `[Alice (disabled), Bob]`;
  active = Alice; `keydown(ArrowDown)`; assert active = Bob (disabled skipped).
- **`keyboard: popup closed — ArrowDown does not open popup`**: mount with `open=false`;
  `keydown(ArrowDown)` on textarea; assert no wire action dispatched, popup still absent.
- **`keyboard: Backspace on empty prefix fires dismissPopup`**: simulate typed `@` only (prefix="");
  `keydown(Backspace)` deletes the trigger char; assert `dismissPopup` dispatched.

### Focus management

- **`focus: DOM focus stays on textarea while popup is open`**: open popup; press ArrowDown;
  assert `document.activeElement` is the `<textarea>` (not any option element).
- **`focus: popup container is tabindex=-1 (excluded from tab sequence)`**: assert the listbox root
  has `tabindex="-1"`.
- **`focus: blur fires dismissPopup`**: open popup; dispatch `blur` on `<textarea>`; assert
  `dismissPopup` dispatched (with a guard: click-on-option completes before blur fires).

### Wire round-trip IT (lievit-kit, real runtime, `CollapsibleComponentIT` pattern)

- **`IT: loadSuggestions populates and opens popup`**: mount `MentionsComponent` with `open=false`;
  dispatch `loadSuggestions("@", "al")`; assert re-rendered DOM contains `role="listbox"` with
  options matching the server's filtered suggestions; assert `aria-expanded="true"`.
- **`IT: confirmMention inserts token into value`**: mount with `value="Hello "`, `open=true`,
  suggestions `[{id:"u1",label:"Alice"}]`; dispatch `confirmMention("@", "Alice", 6, 1)` (trigger
  char `@` at index 6, length 1); assert re-rendered `value` = `"Hello @Alice "` and `open=false`.
- **`IT: dismissPopup clears popup state`**: mount with `open=true`; dispatch `dismissPopup()`; assert
  re-render: `open=false`, `suggestions` empty, listbox absent.
- **`IT: confirmMention rejects unknown token label`**: dispatch `confirmMention("@", "HackerLabel",
  0, 1)` where `"HackerLabel"` is NOT in the server-rendered suggestions; assert the action throws /
  returns an error response (validation before mutation).
- **`IT: updateValue respects maxLength`**: `maxLength=10`; dispatch `updateValue("12345678901")`
  (11 chars); assert value NOT mutated / error returned.

### Escaping (XSS)

- **`escaping: suggestion id with hostile string renders inert`**: a `Suggestion` with
  `id="\"><script>alert(1)</script>"` rendered as `role="option" id="..."` via
  `Escape.htmlAttribute()` — assert the option element's `id` attribute is the escaped string, no
  script tag present in the DOM.
- **`escaping: value with hostile content renders inert in textarea`**: `value="<script>alert(1)
  </script>"` — the `<textarea>` content is text (not innerHTML), no script executed.
- **`escaping: avatar URL with javascript: scheme is dropped`**: `avatarUrl="javascript:alert(1)"` —
  assert the `<img>` element either is absent or has `src=""` / a safe fallback; the `javascript:`
  scheme is rejected server-side before emitting the `src` attribute.

### Playwright (gesture fidelity, legacy-VM oracle)

- **`e2e: typing @ opens suggestion popup on real page`**: navigate to a page hosting a
  `MentionsComponent`; `page.type(selector, "@")` — assert the suggestion popup becomes visible in
  the real DOM.
- **`e2e: ArrowDown + Enter selects and inserts mention token`**: `page.type("@al")` → popup appears
  → `page.keyboard.press("ArrowDown")` → `page.keyboard.press("Enter")` → assert the textarea value
  contains the inserted `@Alice ` token (the BODY of the field, not a fake substrate — the
  client-island-fidelity lesson).
- **`e2e: Escape closes popup without inserting`**: `page.type("@")` → popup → `page.keyboard.press
  ("Escape")` → assert popup absent, textarea value unchanged (no token inserted).
- **`e2e: click on suggestion inserts token`**: open popup via typing; `page.click` on a suggestion
  row; assert token inserted.

### JTE compile + render

- Covered by the `test/jte-compile` real-compiler + render gate (present for all components; not a
  manual test step).

---

## 8. Non-goals / anti-patterns

- **Not a rich-text editor.** The mentions component is a plain `<textarea>` with trigger-char
  detection. If the adopter needs formatted text (bold, links, block elements), that is the
  `rich-text-editor` component, which is a separate S2 component with a `contenteditable` surface.
  Do not add formatting commands here.
- **Not a tags-input.** The mentions component inserts text tokens INTO a free-form prose textarea.
  Tags-input (`tags-input`) manages a discrete list of tag chips with removal affordances; they serve
  different UX patterns and different data shapes. Do not conflate.
- **Not a `<textarea>` replacement with inline rich rendering.** The raw `value` stored and submitted
  is the plain text with trigger+label tokens (`"@Alice"`), not HTML or a JSON mention-map. If the
  display surface needs to render mention tokens as styled chips, the DISPLAY of the submitted value
  (elsewhere in the UI) applies its own partial — the input stays plain text.
- **No inline `<script>` or `on*=` attributes.** The strict CSP refuses them; all behavior lives in
  the enhancer modules registered via the runtime directive/lifecycle registries.
- **No framework (no Lit, no Alpine, no React).** The enhancer is typed vanilla TS, CSP-clean, under
  512 bytes gzip for the trigger-scan + dispatch logic. The `collection-nav` shared enhancer handles
  the listbox nav. No framework dependency.
- **No client-side-only suggestion list (hardcoded options).** The suggestion list is ALWAYS a server
  fact: `loadSuggestions` is a wire action; the server filters and returns candidates. Hardcoding
  options in the template or the enhancer violates the "no data in a partial" rule.
- **No auto-open on focus.** The popup opens ONLY on a trigger character, not on textarea focus.
  This is the UX contract for a mentions field; an open-on-focus auto-suggest is a different pattern
  (use `combobox` for that).
- **No multi-popup (two popups open at once).** If the user types a second trigger char before the
  first popup is committed, the enhancer dismisses the first popup before opening the second.
- **No selection highlighting via DOM focus.** The active option is tracked purely via
  `aria-activedescendant` on the `<textarea>`; no option element receives `tabindex="0"` or DOM
  focus (the APG non-modal combobox model).
- **Not a PARTIAL.** The suggestion list is dynamic, `open` state is a server fact, and the value
  round-trip requires a WIRE component. A PARTIAL cannot hold `@Wire` state.
- **No Turbo Stream swaps.** The popup content is driven by the lievit WIRE morph (the bespoke morph
  on the signed-snapshot round-trip), never by Turbo Stream responses. The delivery boundary is locked
  (ADR-0086).

---

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH) tokens.
You MAY read the following as PATTERN references (a11y, inventory, look): WAI-ARIA APG Combobox
(https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), the editable-combobox example
(https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/), Ant Design
Mentions feature set, Tailwind UI for visual styling ideas. You MUST NOT paste literal source from any
of them — the output is always ORIGINAL generation. (The one bright line, `02-licensing.md`.)

Compose the ONE shared mechanisms — `collection-nav.enhancer.ts` for listbox arrow/Home/End nav and
`aria-activedescendant` management; the popover seam for positioning + light-dismiss. Write
`mentions.enhancer.ts` as the net-new trigger-scanning and commit-dispatching module.
Do NOT hand-roll listbox keyboard navigation or popup positioning.

Mirror `button.jte` house conventions exactly: header doc-comment with the credits + a11y + params +
usage sections; typed `@param`; `data-slot` on the root; the two escaping channels (`attrs` trusted-raw
for static wire mount attributes, `dataAttrs`/`wireArgs` escaped via `Escape.htmlAttribute` for any
per-row or per-suggestion dynamic value); zero `<script>`, zero inline `on*=`.

WIRE conventions (server-first refactor blueprint §1.b): no `Content` slot; the template is owned
markup; boolean state as JTE boolean-attribute conditional; `aria-expanded` reflects `open` directly.

Validate in EVERY Java `@LievitAction` BEFORE mutating state: trigger char in configured set,
token label in last-rendered suggestions, cursor range within value bounds, maxLength on value.

The `confirmMention` token-insertion is a SERVER-SIDE string replace (Java, in the action method),
not a client-side mutation. The client sends `(trigger, tokenLabel, start, length)`; the server
computes the new `value`. Never trust the client's proposed replacement string directly.

The render test MUST assert: (a) the listbox body options are VISIBLE after open (the projection
assertion — the client-island-fidelity lesson); (b) `aria-activedescendant` is updated by ArrowDown
(assert the WHOLE keyboard contract, not just the happy path); (c) `confirmMention` inserts the
correct token (assert the WHOLE contract, both trigger chars if multiple are configured).

Minimal code to GREEN; refactor only while green.
