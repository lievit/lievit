<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — time-picker (S2, WIRE + spinbutton enhancer + popover seam)

- **tier**: WIRE + ENH (`time-spinbutton.enhancer.ts`, shared spinbutton keyboard behavior) + popover seam
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: NET-NEW
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Spinbutton pattern (BUILT: time spinbuttons, the APG date-picker-spinbuttons example
      as the canonical pattern reference for time-segment spinbuttons); react-aria `useTimeField` /
      `useDateSegment` interaction model as pattern reference (the segment-by-segment navigation, spinbutton
      ARIA wiring + valuetext formatting, transcribed into ORIGINAL template + `time-spinbutton` enhancer;
      no react-aria source copied). APG URL consulted:
      https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/
      https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/
    - inventory: Ant Design TimePicker as inventory reference (step, 12/24h, range, disabled times, footer
      actions, time-columns panel as an alternative interaction surface); rich-time-panel clock-column
      layout as a secondary mode
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      (NO code copied)

---

## 1. What it is

A time-picker: a trigger control that shows the selected time + a popover panel where the user sets hours,
minutes, and optionally seconds/AM-PM. The server holds the selected time string as a `@Wire` field and
re-renders the trigger label on change — WIRE because the chosen time is a server fact (it flows into a
form, a booking constraint, a filter), and the morph keeps the DOM patch minimal. Two interaction surfaces
exist inside the panel: the default is an **inline spinbutton row** (three or four `role="spinbutton"`
input segments for hours, minutes, seconds, AM/PM — the APG pattern, keyboard-first, always present as
the accessible baseline); the secondary is a **time-columns panel** (scrollable columns of time values,
inspired by Ant Design's time picker — an optional enhancement for touch/mouse-first UIs, wired via server
actions). The irreducible client behavior — segment-by-segment arrow-key stepping, digit type-ahead within
a segment, and cross-segment Tab focus — is a typed-TS enhancer (`time-spinbutton.enhancer.ts`, original
and self-contained) wired to the spinbutton elements. The popover seam (native `popover` + CSS Anchor
Positioning) handles positioning and light-dismiss. A native `<input type="time">` is rendered as a
fallback inside a `<noscript>` block and is always present for form submission (progressive enhancement
baseline). Server-first works here because the time value is a scalar string the server stores and reflects;
the panel rendering (which segments, which values are disabled, footer actions) is entirely server-derived.

---

## 2. API — the WIRE surface + template params

### Java (`TimePickerComponent`)

| member | kind | meaning |
|---|---|---|
| `value` `String` | `@Wire` | ISO-local-time string, format `HH:mm` (24h) or `HH:mm:ss` (with seconds). Empty string = no selection. The server-canonical representation — always 24h internally regardless of display mode. |
| `open` `boolean` | `@Wire` | popover panel open state |
| `mode` `String` | `@Wire @LievitProperty(locked=true)` | `"24h"` (default) \| `"12h"`. Controls AM/PM segment visibility and display formatting. Locked: the server sets it at mount from the field configuration. |
| `showSeconds` `boolean` | `@Wire @LievitProperty(locked=true)` | whether to show the seconds segment (default `false`). Locked: set from field config. |
| `step` `int` | `@Wire @LievitProperty(locked=true)` | minute stepping increment in the columns panel (default `1`). Does not constrain the spinbutton segment (the user may type any valid minute). |
| `minTime` `String` | `@Wire @LievitProperty(locked=true)` | ISO time string `HH:mm` or `HH:mm:ss` — lower bound for validation (inclusive). Empty = no lower bound. |
| `maxTime` `String` | `@Wire @LievitProperty(locked=true)` | ISO time string `HH:mm` or `HH:mm:ss` — upper bound for validation (inclusive). Empty = no upper bound. |
| `disabledTimes` `List<String>` | `@Wire @LievitProperty(locked=true)` | explicit times or ranges to disable (format `"HH:mm"` or `"HH:mm-HH:mm"`). Validated server-side; disabled times are styled + aria-disabled in the columns panel. |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | placeholder text shown when `value` is blank (default `"hh:mm"`). |
| `nullable` `boolean` | `@Wire @LievitProperty(locked=true)` | when `true`, a clear button is shown (default `false`). |
| `panelMode` `String` | `@Wire @LievitProperty(locked=true)` | `"spinbutton"` (default) \| `"columns"`. Which panel surface to render inside the popover. Both modes are server-rendered; the spinbutton mode is always the keyboard-accessible baseline. |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `"sm"` \| `"md"` (default) \| `"lg"`. Height-based, toolbar-aligned. |
| `disabled` `boolean` | `@Wire @LievitProperty(locked=true)` | disables the trigger and all panel interactions. |
| `invalid` `boolean` | `@Wire` | reflects validation failure (out-of-range, invalid format) — rendered as `aria-invalid` on the trigger. Can be set by the surrounding `field` partial or by the server's validation action. |
| `label` `String` | `@Wire @LievitProperty(locked=true)` | accessible label for the group container. Not visible (the `field` partial renders the visible label); used for `aria-label` on the group. |
| `hourLabel` `String` | `@Wire @LievitProperty(locked=true)` | aria-label for the hours spinbutton (default `"hours"`). |
| `minuteLabel` `String` | `@Wire @LievitProperty(locked=true)` | aria-label for the minutes spinbutton (default `"minutes"`). |
| `secondLabel` `String` | `@Wire @LievitProperty(locked=true)` | aria-label for the seconds spinbutton (default `"seconds"`). |
| `periodLabel` `String` | `@Wire @LievitProperty(locked=true)` | aria-label for the AM/PM spinbutton (default `"AM/PM"`). Shown only when `mode="12h"`. |
| `setTime(String hh, String mm, String ss, String period)` | `@LievitAction` | receives the raw segment strings, validates format + range + disabledTimes + min/max in Java BEFORE mutating `value`; sets `invalid` if out of range; closes the popover on valid commit (explicit OK / panel close). |
| `toggleOpen()` | `@LievitAction` | opens/closes the popover panel. |
| `clearTime()` | `@LievitAction` | sets `value = ""` when `nullable`. Server validates that `nullable` is true. |
| `selectColumnValue(String segment, String rawValue)` | `@LievitAction` | used by the columns-panel mode: fires when the user clicks a cell in a time column (hour / minute / second). Validates the new value for the given segment, merges into the current `value`, re-renders the panel with the updated selection highlight. |

**Derived view helpers** (read by the template, not `@Wire` — serialize=false):

| helper | meaning |
|---|---|
| `displayValue()` | formats `value` for display in the trigger (respects `mode` — `"03:45 PM"` vs `"15:45"`). Returns `placeholder` when blank. |
| `parsedHour()` / `parsedMinute()` / `parsedSecond()` | integers for `aria-valuenow`; `-1` when blank. |
| `displayHour()` | hour string in display format (12h or 24h). |
| `columnHours()` / `columnMinutes()` / `columnSeconds()` | `List<ColumnCell>` for the columns-panel mode (each cell has `value`, `label`, `disabled`, `selected` fields). Applies `step`, `minTime`, `maxTime`, `disabledTimes`. |
| `amPm()` | `"AM"` \| `"PM"` \| `""` (only meaningful when `mode="12h"`). |
| `isValueValid()` | `false` when `value` is non-blank but fails range/disabled-time checks; used to drive `aria-invalid`. |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param TimePickerComponent _instance` (for derived helpers). No `Content` slot (WIRE has none — server-first refactor blueprint §1.b).

---

## 3. Variants / sizes / states

### Sizes (height-based, toolbar-aligned — architecture contract §5.b)

| size | trigger height | token |
|---|---|---|
| `sm` | 32 px | `--lv-space-8` |
| `md` (default) | 36 px | `--lv-space-9` |
| `lg` | 40 px | `--lv-space-10` |

The trigger, the spinbutton segments inside the panel, and the column cells all scale with `size`.
A `time-picker[size=md]` lines up flush with a `button[size=md]` and an `input[size=md]` in a toolbar row.

### States

| state | how expressed |
|---|---|
| **default** | trigger shows `displayValue()` or placeholder; panel hidden |
| **open** | trigger has `aria-expanded="true"`; popover panel is rendered and positioned via the popover seam |
| **disabled** | native `disabled` on the trigger button; all panel actions are blocked; `aria-disabled` on each spinbutton segment; trigger and segments styled via `disabled:` utilities + `--lv-color-muted` |
| **invalid** | `aria-invalid="true"` on the trigger and on the affected segment(s); destructive border + `--lv-ring` destructive ring |
| **aria-busy** | set by the runtime `beforeCall`/`afterCall` hook during the wire round-trip; components do nothing — the runtime manages this |
| **nullable / clearable** | a clear button (`aria-label="Clear time"`) appears inside the trigger when `value` is non-blank and `nullable=true`; fires `clearTime()` |
| **loading** | `aria-busy="true"` on the trigger during async validation; reuses the spinner partial + existing motion tokens |
| **segment-focused** | the active spinbutton segment receives the `:focus-visible` ring via `--lv-ring`; the group outer border highlights (matching the `input` focus convention) |

### Panel modes

| panelMode | what renders | keyboard |
|---|---|---|
| `"spinbutton"` (default) | a row of `role="spinbutton"` segments (HH / MM / SS / AM-PM) + optional confirm/cancel footer buttons | APG spinbutton keys per segment; Tab moves between segments |
| `"columns"` | scrollable column lists (one per segment: hours / minutes / seconds) + the spinbutton row above as the accessible baseline (always present even in columns mode) | click / touch a cell → `selectColumnValue()`; spinbutton row keeps keyboard access |

Both modes always render the spinbutton row. The columns panel is an additional visual surface;
removing the spinbuttons from the DOM in columns mode is forbidden (it removes keyboard access).

### No `variant` param

The time-picker has no `variant` param: it is a form control, not an action control. Intent is expressed
via the `field` partial wrapper (required marker, error state) and the `invalid` state, not via colour
variants on the control itself. This is consistent with `input`, `native-select`, `date-picker`.

---

## 4. The a11y contract (the heart — non-negotiable, fully specified)

### WAI-ARIA pattern

**APG Spinbutton** (BUILT: time spinbuttons — the official datepicker-spinbuttons example at
https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/ is the canonical
reference for how to compose multiple spinbutton segments into a single picker). The react-aria
`useTimeField` / `useDateSegment` interaction model is the keyboard/focus pattern reference, transcribed
into ORIGINAL code.

### Roles and ARIA attributes

**Group container** (the element wrapping all spinbutton segments):

| attribute | value | purpose |
|---|---|---|
| `role="group"` | static | marks the segment row as a logical group |
| `aria-label` | `label` param (e.g. `"time"`) | accessible name for the group; the surrounding `field` partial also provides the visible label via `aria-labelledby` if wired |
| `aria-labelledby` | `"<titleId> <valueId>"` | title label + a hidden `<span>` containing the formatted current value string (e.g. `"3:45 PM"`) for screen readers that announce the group summary on entry (mirrors the datepicker-spinbuttons example) |
| `data-lievit-component` / `data-lievit-id` / `data-lievit-snapshot` | wire root attributes | the runtime mount point — on the outermost wrapper, not on the `<group>` span |

**Each spinbutton segment** (hours / minutes / seconds / AM-PM):

| attribute | value | purpose |
|---|---|---|
| `role="spinbutton"` | static | core semantic role per APG |
| `aria-label` | `"hours"` / `"minutes"` / `"seconds"` / `"AM/PM"` (from `hourLabel` etc.) | per-segment accessible name |
| `aria-valuenow` | integer (0-23 for hours 24h, 0-12 for hours 12h, 0-59 for minutes/seconds; `0` or `1` for AM/PM mapped to 0/1) | current numeric value |
| `aria-valuemin` | `0` for hours/minutes/seconds; `0` for AM/PM | minimum |
| `aria-valuemax` | `23` (24h) or `12` (12h) for hours; `59` for minutes/seconds; `1` for AM/PM | maximum |
| `aria-valuetext` | display-formatted string (e.g. `"03"` for hours, `"PM"` for period, `"--"` when blank) | the human-readable value announced by screen readers instead of the raw number |
| `aria-invalid` | `"true"` when the segment's value is out of allowed range; absent otherwise | invalid state |
| `aria-disabled` | `"true"` when the component is `disabled` | disabled state |
| `aria-required` | `"true"` when the field is required (passed from the `field` partial) | required state |
| `tabindex` | `"0"` on the first segment; `-1` on others initially (roving within the group is managed by the enhancer; Tab to the next segment uses sequential tab order, not roving, per the APG example) | tab order |

**Trigger button** (the closed-state display element):

| attribute | value | purpose |
|---|---|---|
| `aria-haspopup` | `"dialog"` | the popover panel plays the role of a dialog overlay |
| `aria-expanded` | `"true"` \| `"false"` | open-state |
| `aria-controls` | `"<panelId>"` | the popover panel element |
| `aria-label` | `"Choose time, <displayValue()>"` | announces both the purpose and the current value |

**Increment / decrement buttons** (optional flanking controls for mouse/touch users, one pair per segment):

| attribute | value |
|---|---|
| `tabindex="-1"` | excluded from tab order (keyboard users use arrow keys on the segment) |
| `aria-controls` | id of the spinbutton segment they control |
| `aria-disabled="true"` | when the segment is at min (decrement) or max (increment) |
| `aria-hidden="true"` | on the `+`/`-` glyph itself (the button has its `title` / `aria-label`) |

**Clear button** (when `nullable=true` and `value` non-blank):

| attribute | value |
|---|---|
| native `<button>` | real button element |
| `aria-label` | `"Clear time"` |
| `type="button"` | not a submit trigger |

**Native fallback** (progressive enhancement):

A real `<input type="time">` with `name`, `value` (= `value` param), and `aria-hidden="true"` is rendered
and kept in sync with `value` for form submission. It is visually hidden (not `display:none`) so browser
autofill + form validation still reaches it.

### Keyboard interaction map

Source: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/ and
https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/

The keys apply to a focused spinbutton segment. The `time-spinbutton.enhancer.ts` handles all rows marked
"enhancer"; the platform handles rows marked "platform".

| key | does | who |
|---|---|---|
| `ArrowUp` | increases the segment value by 1 step; wraps from max to min | enhancer |
| `ArrowDown` | decreases the segment value by 1 step; wraps from min to max | enhancer |
| `ArrowRight` | moves focus to the NEXT segment (minutes after hours, etc.); no-op at the last segment | enhancer |
| `ArrowLeft` | moves focus to the PREVIOUS segment; no-op at the first segment | enhancer |
| `Home` | sets the segment to its minimum value | enhancer |
| `End` | sets the segment to its maximum value | enhancer |
| `Page Up` | increases by a larger step (5 for minutes/seconds; 1 for hours/AM-PM); wraps | enhancer |
| `Page Down` | decreases by a larger step (5 for minutes/seconds; 1 for hours/AM-PM); wraps | enhancer |
| `0`-`9` (digit keys) | type-ahead within the segment: accumulates digits into the current segment's value; auto-advances to the next segment when the typed value fills the segment width (e.g. typing `1` then `5` sets minutes to 15 and moves to seconds); fires `setTime()` on auto-advance | enhancer |
| `a` / `p` (AM/PM segment only) | sets AM or PM respectively; auto-advances past the segment | enhancer |
| `Tab` | moves focus to the next segment (if any remain in the group); exits the group when on the last segment (natural page flow) | platform + enhancer (prevents default inside the group to route between segments; lets Tab exit normally after the last) |
| `Shift+Tab` | moves focus to the previous segment; exits the group before the first | platform + enhancer |
| `Enter` | commits the current segment values and fires `setTime()`, closing the popover | enhancer → wire |
| `Escape` | closes the popover without committing partial edits (restores the segments to the last committed `value`); fires `toggleOpen()` | enhancer → wire |
| `Backspace` / `Delete` | clears the current segment to the blank/placeholder state (`--`) | enhancer |

Keys that apply to the **trigger button** (closed state):

| key | does | who |
|---|---|---|
| `Enter` / `Space` | opens the popover panel, focuses the first spinbutton segment | platform (native `<button>`) + enhancer (focus routing on open) |
| `ArrowDown` | opens the popover panel (convenience, matching `date-picker` convention) | enhancer |

### Focus management

- **Initial focus on open**: when the popover opens, focus moves to the first spinbutton segment (hours).
  Managed by the enhancer's lifecycle hook on the popover's appearance in the DOM.
- **Focus within the panel**: focus stays on the spinbutton segments while the panel is open.
  The panel is non-modal (not a focus-trap): Tab exits the panel naturally. The columns panel rows
  are click-only (no keyboard focus row navigation inside the columns themselves — the spinbutton row
  above provides the keyboard interface). There is NO focus-trap; the `focus-trap.enhancer.ts` is NOT
  composed here (the panel is a non-modal popover, not a dialog overlay).
- **Focus on close**: when the popover closes (Esc, Enter-commit, scrim-click, or explicit close action),
  focus returns to the trigger button. The enhancer records the opener and returns focus on close,
  matching the APG guidance and the `select` component's non-modal focus-restore pattern.
- **Segment-to-segment navigation**: `ArrowLeft`/`ArrowRight` route between spinbutton segments
  (horizontal time-segment sequence). Tab also advances between segments (platform order) and exits
  after the last. The enhancer intercepts Tab inside the group to prevent the default page-Tab until the
  last segment is focused; at the last segment Tab exits normally (no trap).
- **Focus identity through morphs**: the runtime morph (ADR-0019) preserves node identity and focus
  across wire round-trips. The enhancer does not restore focus after a morph; the morph does.

### Live region

A visually hidden `<output role="status" aria-live="polite">` (one per component instance, id-bound) is
updated after a successful `setTime()` action to announce the committed time (e.g. `"Time set to 3:45 PM"`).
It clears after 2 000 ms (the enhancer manages the timer). This mirrors the quantity-spinbutton example's
`<output>` pattern (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/quantity-spinbutton/).
The announcement uses the same live-region announcer shared across the library (architecture contract §2.b
+ `03-component-inventory.md` §4).

### Shared mechanisms composed

- **Popover seam** (native `popover` + CSS Anchor Positioning): positioning + light-dismiss on outside-click.
  The trigger is the anchor; the panel is a `popover` element. Do NOT hand-roll positioning.
- **Live-region announcer**: for the "Time set to …" status message. Do NOT create a one-off `aria-live`
  region.
- **No focus-trap**: the panel is non-modal. Do not compose `focus-trap.enhancer.ts` here.
- **No `collection-nav`**: the columns panel cells are click-only, not a keyboard-navigable collection.

---

## 5. Tokens

### Consumed tokens

| token | where used |
|---|---|
| `--lv-color-input` | trigger and segment background |
| `--lv-color-input-fg` | trigger and segment text |
| `--lv-color-border` | trigger border, segment separators, panel border |
| `--lv-color-popover` | panel background |
| `--lv-color-popover-fg` | panel text |
| `--lv-color-muted` | placeholder text, disabled state text |
| `--lv-color-accent` | column cell hover background |
| `--lv-color-accent-fg` | column cell hover text |
| `--lv-color-primary` | selected column cell background |
| `--lv-color-primary-fg` | selected column cell text |
| `--lv-color-destructive` | invalid/error border + ring |
| `--lv-color-destructive-fg` | invalid error text |
| `--lv-ring` | focus-visible ring on segments and trigger |
| `--lv-space-8` | trigger height (sm) |
| `--lv-space-9` | trigger height (md, default) |
| `--lv-space-10` | trigger height (lg) |
| `--lv-space-1` | segment horizontal padding (tight) |
| `--lv-space-2` | segment separator gap, segment vertical padding |
| `--lv-space-3` | trigger horizontal padding, panel internal padding |
| `--lv-space-4` | panel section padding |
| `--lv-space-6` | panel footer button gap |
| `--lv-radius-md` | trigger border-radius |
| `--lv-radius-lg` | panel border-radius |
| `--lv-shadow-md` | panel elevation (matches `select` popover) |
| `--lv-z-popover` | panel z-index |
| `--lv-text-sm` | segment text size (sm/md) |
| `--lv-text-base` | segment text size (lg) |
| `--lv-text-xs` | segment label text (the `aria-label` visual hint, shown below segments for sighted users) |
| `--lv-font-mono` | segment digit rendering (monospace keeps stable width as digits change) |
| `--lv-font-sans` | trigger display value, column cell labels |
| `--lv-motion-duration-fast` | column scroll snap transition |
| `--lv-motion-easing-standard` | column scroll snap easing |

### Net-new tokens proposed

| token | value (OKLCH, `:root`) | dark override | justification |
|---|---|---|---|
| `--lv-color-time-segment-active` | `oklch(0.88 0.04 250)` | `oklch(0.28 0.04 250)` | the currently-focused spinbutton segment needs a distinctive background distinct from `--lv-color-accent` (which is the hover for column cells). Without it, the focused segment blends with adjacent cells in the columns panel. Additive: one new semantic colour pair. |
| `--lv-color-time-segment-active-fg` | `oklch(0.16 0.04 250)` | `oklch(0.92 0.04 250)` | foreground partner for `--lv-color-time-segment-active`. |

Both tokens are proposed additive tokens, namespaced to `--lv-`, authored in OKLCH, added to both `:root`
and the `.dark, [data-theme="dark"]` block. No literal colour is baked into the component.

---

## 6. Wire actions (the round-trip contract)

### Directives the template binds

| directive | element | meaning |
|---|---|---|
| `l:click="toggleOpen"` | trigger button | opens/closes the popover panel |
| `l:click="clearTime"` | clear button (when `nullable`) | fires `clearTime()` |
| `l:click="selectColumnValue" data-segment="hour" data-value="<escaped>"` | each column cell (hours column) | fires `selectColumnValue("hour", cell.value())` on click; `data-value` is escaped via `wireArgs` |
| `l:click="selectColumnValue" data-segment="minute" data-value="<escaped>"` | each column cell (minutes column) | same for minutes |
| `l:click="selectColumnValue" data-segment="second" data-value="<escaped>"` | each column cell (seconds column) | same for seconds (when `showSeconds`) |
| `l:click="setTime" data-hh="<escaped>" data-mm="<escaped>" data-ss="<escaped>" data-period="<escaped>"` | confirm button in footer | explicit commit |

The spinbutton segments themselves do NOT carry `l:*` directives. The enhancer reads their
`aria-valuenow` state, updates it client-side on each keystroke (for responsive feedback), and fires
`setTime()` via the wire protocol on commit (Enter, auto-advance, or focus-loss — configurable). This
keeps the server round-trip off the hot path of every single keystroke while ensuring the committed value
is always validated server-side.

### Escaping channel

- `data-value` / `data-hh` / `data-mm` / `data-ss` / `data-period` on interactive elements: **SAFE
  escaped** via `wireArgs` map, each value through `Escape.htmlAttribute`. These are time strings that
  come from `columnHours()` / `columnMinutes()` / `columnSeconds()` which are derived from the
  server-held `value` + config — but the escaping channel is applied unconditionally (a hostile injected
  time string must render inert).
- The segment container's `data-lievit-snapshot` is **TRUSTED raw** via `attrs` — the runtime writes
  it; the template does not touch it.

### Server action signatures

```
setTime(String hh, String mm, String ss, String period):
  - reads data-hh / data-mm / data-ss / data-period from the wire call args
  - constructs a candidate ISO time string
  - validates: format, range (minTime/maxTime), not in disabledTimes
  - on valid: sets value = canonicalized 24h ISO string; sets invalid = false
  - on invalid: sets invalid = true; does NOT mutate value (preserves last good value)
  - conditionally: closes the popover (on explicit OK / auto-advance commit) or keeps it open
    (on column-cell click, to allow further adjustment)

selectColumnValue(String segment, String rawValue):
  - validates segment ∈ {"hour", "minute", "second"}
  - validates rawValue is a valid integer for that segment
  - merges into the current value (only the named segment changes)
  - validates the resulting composite time against minTime/maxTime/disabledTimes
  - updates value + invalid accordingly
  - re-renders: the columns panel highlights the new selection; spinbutton segments update

toggleOpen():
  - flips open; if closing, restores the spinbutton segments to the last committed value
    (discards any un-committed segment edits)

clearTime():
  - validates nullable == true (authz check)
  - sets value = ""
  - sets invalid = false
  - closes the popover
```

### Enhancer responsibilities (`time-spinbutton.enhancer.ts`)

The enhancer is registered via the lievit runtime's directive/lifecycle registry (ADR-0019: registry IS
the API). It is NOT a framework.

1. **On component init** (lifecycle `onComponentInit`): scans the component root for
   `[role="spinbutton"]` segments; records their order, min, max, valuetext mapping; sets up the typed
   digit-accumulation buffer per segment.
2. **Key handling on a focused segment**: binds `keydown` on the segment container (event delegation).
   Routes `ArrowUp/Down/Left/Right/Home/End/PageUp/PageDown/0-9/a/p/Backspace/Delete/Tab/Enter/Esc`
   per the §4 keyboard map. Updates `aria-valuenow` and `aria-valuetext` client-side for immediate
   visual feedback. Does NOT fire a wire action on every keystroke.
3. **Commit**: on `Enter`, explicit footer-button click (`l:click="setTime"` reads current segment
   values), or auto-advance after the last segment — the enhancer assembles `hh/mm/ss/period` from
   the current `aria-valuenow` values and fires `setTime()` via the wire protocol.
4. **Focus routing**: on popover open, moves DOM focus to the first `[role="spinbutton"]` segment.
   On popover close (Esc or commit), returns focus to the trigger button (records opener before open).
5. **Digit buffer**: maintains a per-segment pending-digit string (e.g. typing `1` waits 1 second for
   a second digit, then commits `01`; typing `15` commits immediately as `15`). Auto-advances to the
   next segment when the pending value fills the segment's digit width.
6. **AM/PM handling**: on the period segment, maps `a/A → "AM"`, `p/P → "PM"`, ArrowUp/Down toggle.
7. **Column scroll sync**: when `panelMode="columns"`, after a wire morph scrolls the column to show
   the selected cell, the enhancer ensures the selected cell is vertically centered in its column
   (scroll-snap assist). This is a pure DOM operation, no wire action.
8. **Post-morph cleanup** (lifecycle `onComponentUpdate`): re-scans for segments after each morph
   (the morph may add/remove the seconds segment based on `showSeconds`); resets the digit buffer.

---

## 7. Acceptance tests (the gate — refute-by-default)

Every test runs on a REAL substrate, not a mocked one (the client-island-fidelity lesson).

### Render tests (real `LievitRuntime` + jsdom, REAL enhancer mounted)

- **`renders-trigger-with-placeholder`**: a blank `value` renders the trigger showing `placeholder`;
  `aria-expanded="false"` on the trigger; the panel is absent from the DOM.
- **`renders-trigger-with-formatted-value-24h`**: `value="15:30"`, `mode="24h"` → trigger shows `"15:30"`;
  `aria-label` on the trigger contains `"15:30"`.
- **`renders-trigger-with-formatted-value-12h`**: `value="15:30"`, `mode="12h"` → trigger shows `"3:30 PM"`.
- **`renders-spinbutton-segments-on-open`**: after `toggleOpen()`, the panel appears; there are exactly 2
  spinbutton segments (hours + minutes) when `showSeconds=false`, 3 when `showSeconds=true`, 4 when
  `mode="12h"` (hours + minutes + AM/PM, or + seconds); each has `role="spinbutton"`, `aria-valuenow`,
  `aria-valuemin`, `aria-valuemax`, `aria-valuetext`; the group has `role="group"`.
- **`renders-columns-panel`**: `panelMode="columns"` → the columns panel renders alongside the spinbutton
  row; hours/minutes columns are present; the selected cell in each column has `aria-selected="true"`
  (or `data-selected`); the spinbutton row is ALSO present (not removed in columns mode).
- **`renders-clear-button-when-nullable`**: `nullable=true`, `value="10:00"` → a `<button aria-label="Clear time">`
  is present; `nullable=true`, `value=""` → the clear button is absent.
- **`renders-disabled-state`**: `disabled=true` → trigger `<button>` is natively `disabled`; spinbutton
  segments have `aria-disabled="true"`; no `l:click` fires.
- **`renders-invalid-state`**: `invalid=true` → trigger has `aria-invalid="true"`; destructive border
  token class present; segments have `aria-invalid="true"`.
- **`renders-with-min-max`**: `minTime="09:00"`, `maxTime="18:00"` → `aria-valuemin`/`aria-valuemax` on
  the hours spinbutton reflect `9`/`18` correctly.
- **`renders-native-input-for-form`**: a `<input type="time">` with the correct `value` is present and
  `aria-hidden="true"`.

### axe-core assertions (zero violations on cited rules)

- `spinbutton`: each `role="spinbutton"` element has an accessible name (`aria-label`), `aria-valuenow`,
  `aria-valuemin`, `aria-valuemax` — zero violations of the `spinbutton` role requirements.
- `aria-required-attr`: all required ARIA attributes present on spinbutton segments.
- `group-labelling`: the `role="group"` container has an accessible name.
- `button-name`: trigger and clear button have accessible names.
- `color-contrast`: all text/background combinations with the new `--lv-color-time-segment-active`
  tokens meet WCAG 2.1 AA contrast.
- Run on the OPEN panel DOM (not just the closed trigger).

### Keyboard tests (REAL enhancer, assert observable DOM outcomes)

Each key in the §4 map is asserted:

- **`ArrowUp-increases-hours`**: hours segment focused + `aria-valuenow="10"` → ArrowUp → `aria-valuenow="11"`;
  `aria-valuetext` updates to `"11"`.
- **`ArrowDown-decreases-minutes`**: minutes segment + `aria-valuenow="30"` → ArrowDown → `aria-valuenow="29"`.
- **`ArrowUp-wraps-hours`**: hours 24h, `aria-valuenow="23"` → ArrowUp → `aria-valuenow="0"`.
- **`ArrowDown-wraps-minutes`**: `aria-valuenow="0"` → ArrowDown → `aria-valuenow="59"`.
- **`Home-sets-minimum`**: hours `aria-valuenow="15"` → Home → `aria-valuenow="0"`.
- **`End-sets-maximum`**: hours 24h `aria-valuenow="5"` → End → `aria-valuenow="23"`.
- **`PageUp-large-step-minutes`**: minutes `aria-valuenow="30"` → PageUp → `aria-valuenow="35"`.
- **`PageDown-large-step-minutes`**: minutes `aria-valuenow="3"` → PageDown → `aria-valuenow="0"` (wraps
  to 0, not to 58).
- **`digit-typeahead-accumulate`**: minutes focused → type `1`, wait < 1s → type `5` → `aria-valuenow="15"`;
  auto-advances to the next segment.
- **`digit-single-fills`**: minutes focused → type `6` → after 1s timeout auto-commits `06`; advances.
- **`ArrowRight-advances-segment`**: hours focused → ArrowRight → minutes segment has focus.
- **`ArrowLeft-retreats-segment`**: minutes focused → ArrowLeft → hours segment has focus.
- **`Enter-commits-setTime`**: after editing segments → Enter → `setTime()` wire action fires with the
  correct `hh/mm` values; popover closes; trigger label updates to the new time.
- **`Escape-closes-without-commit`**: edit a segment → Escape → `toggleOpen()` fires; popover closes;
  trigger label unchanged (last committed value restored); focus returns to trigger.
- **`Backspace-clears-segment`**: hours `aria-valuenow="10"` → Backspace → `aria-valuetext="--"`.
- **`am-pm-key`**: period segment (12h mode) → type `p` → `aria-valuetext="PM"`; type `a` → `aria-valuetext="AM"`.

### Focus tests

- **`focus-moves-to-first-segment-on-open`**: trigger `Enter` → popover opens → `document.activeElement`
  is the hours spinbutton segment.
- **`focus-returns-to-trigger-on-close`**: open → press Esc → `document.activeElement` is the trigger.
- **`tab-advances-between-segments`**: hours focused → Tab → `document.activeElement` is minutes; Tab again
  from last segment → focus exits the component (Tab default allowed).
- **`shift-tab-retreats`**: minutes focused → Shift+Tab → `document.activeElement` is hours.
- **`no-focus-trap`**: Tab from the last segment → focus leaves the component (asserts focus does NOT
  cycle back to hours — this is non-modal, not a dialog).

### Wire round-trip IT (lievit-kit, real runtime, CollapsibleComponentIT pattern)

- **`setTime-valid-round-trip`**: mount with `value=""` → fire `setTime("15","30","00","")` → re-render
  asserts `value="15:30"`, `invalid=false`, trigger displays `"15:30"`, popover closed.
- **`setTime-invalid-out-of-range`**: `minTime="09:00"` → fire `setTime("08","00","00","")` → re-render
  asserts `invalid=true`, `value` unchanged.
- **`setTime-12h-pm`**: `mode="12h"` → fire `setTime("03","45","00","PM")` → re-render asserts
  `value="15:45"`, trigger displays `"3:45 PM"`.
- **`selectColumnValue-hour`**: fire `selectColumnValue("hour","14")` → re-render asserts the hours column
  highlights cell `14`, `value` updated to `"14:XX"`.
- **`clearTime`**: `nullable=true`, `value="10:00"` → fire `clearTime()` → re-render asserts `value=""`,
  trigger shows placeholder, clear button absent.
- **`toggleOpen-opens-and-closes`**: fire `toggleOpen()` → panel present; fire again → panel absent.
- **`disabled-blocks-actions`**: `disabled=true` → fire `toggleOpen()` → no state mutation (the action
  short-circuits in Java).

### Variant / size tests

- **`size-sm-md-lg-data-attribute`**: each size renders `data-size="sm"`, `"md"`, `"lg"` on the root;
  trigger height token class matches §3.
- **`panelMode-columns-renders-columns`**: `panelMode="columns"` → columns panel elements present AND
  spinbutton row present.

### Playwright tests (gesture fidelity, real browser, legacy-VM oracle)

- **`click-open-select-close`**: real `page.click` on the trigger → panel appears → click a column
  cell → trigger label updates to the selected time → `page.keyboard.press("Escape")` → panel closes,
  focus on trigger.
- **`keyboard-full-flow`**: `page.keyboard.press("Tab")` to focus trigger → Enter → hours segment
  focused → ArrowUp three times → Tab to minutes → type `3`, `0` → Enter → trigger shows the committed
  time (not a fake substrate — the body carries the resolved server value).
- **`clear-button`**: `nullable=true`, value set → click clear → trigger shows placeholder.

### Escaping test

- **`hostile-wireArgs-render-inert`**: `selectColumnValue` with a cell whose `data-value` is
  `"\">|<script>alert(1)</script>"` (injected via `wireArgs`) → the rendered attribute is HTML-escaped,
  the `<script>` tag is never present in the DOM. Asserts the XSS abuse-case for the `wireArgs` channel.

### JTE compile + render gate

- Covered by the `test/jte-compile` real-compiler gate (architecture contract §7). The time-picker
  template must compile and render without error for all combinations of `showSeconds` × `mode` × `panelMode`.

---

## 8. Non-goals / anti-patterns

- **Not a clock face / analog input**: no circular clock UI. That is a visual widget with no APG pattern
  and no keyboard model in lievit. The spinbutton row is the interaction; the columns panel is an optional
  visual enhancement.
- **Not a date-time compound**: this component picks TIME only. A date-time compound composes
  `date-picker` + `time-picker` at the field/form level; they are separate WIRE components, not a merged
  one. Their values are serialized and combined server-side.
- **No framework (no Lit, no Alpine)**: the enhancer is typed vanilla TS, registered via the runtime
  registry (ADR-0012 holds).
- **No client-side rendering of the time list**: the columns panel is server-rendered. The enhancer does
  NOT generate column cells in the DOM. A hostile or injected time value cannot add cells to the list.
- **No hand-rolled positioning**: the popover seam (native `popover` + CSS Anchor Positioning) is the ONE
  positioning mechanism. Do not replicate it.
- **No focus-trap**: the panel is non-modal. Do not compose `focus-trap.enhancer.ts` (the trap is for
  dialog/drawer/sheet — modal overlays). The time-picker panel closes on Esc and on outside-click via
  the popover seam's light-dismiss; it does not trap Tab.
- **No collection-nav**: the columns panel is click-only; `collection-nav.enhancer.ts` is for keyboard
  listboxes and menus. Do not compose it here.
- **No server round-trip on every keypress**: the enhancer updates `aria-valuenow` / `aria-valuetext`
  locally for responsive feedback; it fires `setTime()` only on commit. Wiring `l:model` on the
  spinbutton segments would incur a round-trip per keystroke — do not do this.
- **No removal of the spinbutton row in columns mode**: the spinbutton row is ALWAYS present (even when
  `panelMode="columns"`). Removing it removes keyboard access. The columns panel is an additional visual
  surface, not a replacement.
- **Not a `<input type="time">` style-override**: the rich time-picker is a WIRE component with server-
  validated state. The native `<input type="time">` is a fallback for form submission and progressive
  enhancement, not the primary control.
- **Not a range picker in this component**: a time range (start + end) is two separate `time-picker`
  instances wired together at the form level. A compound range-picker may be a separate spec; it is not
  this component's responsibility.
- **No 12h/24h switching at runtime by the user**: `mode` is a locked server property. The adopter
  sets it from the field configuration at mount time; the user cannot toggle it.

---

## Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH); you may read the WAI-ARIA APG Spinbutton pattern
(https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/), the APG datepicker-spinbuttons example, and
React Aria `useTimeField`/`useDateSegment` SPEC + Ant Design TimePicker feature set from training as
pattern references. You MUST NOT paste literal source from any of them (no react-aria / ant-design /
Tailwind UI code or class strings) — the output is always original generation (the one bright line, `02`).

Mirror `button.jte`'s house conventions exactly: header doc-comment (with the credits line, the cited
APG URL, and the cited pattern reference), typed `@param`, `data-slot`, the two escaping channels
(`attrs` trusted-raw for the runtime snapshot / `wireArgs` escaped for per-cell data-value), zero
`<script>`, zero inline `on*=`.

Compose the popover seam — do NOT hand-roll panel positioning or light-dismiss.
Do NOT compose `focus-trap` (the panel is non-modal).
Do NOT compose `collection-nav` (columns are click-only).

The `time-spinbutton.enhancer.ts` is the sole keyboard handler for the spinbutton segments. It is
registered via the runtime directive/lifecycle registry (ADR-0019: registry IS the API), never via
inline `addEventListener` in the template.

Validate EVERY `setTime()` call server-side BEFORE mutating `value` (format, range, disabledTimes).
The client's `aria-valuenow` updates are provisional display state; the server is the truth.

The spinbutton row MUST be present in ALL panel modes (it is the keyboard-accessible baseline).
The render test MUST assert the spinbutton row is present even when `panelMode="columns"`.

Always render the native `<input type="time">` as `aria-hidden="true"` for form submission fallback.
Minimal code to GREEN against the acceptance tests; refactor only while green. The keyboard map in §4
is the contract — assert ALL of it.
