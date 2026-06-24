<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — date-picker (WIRE + ENH: the hard a11y one)

- **tier**: WIRE + ENH (`date-picker.enhancer.ts` — the grid roving + keyboard navigation inside the
  calendar dialog; composes `focus-trap.enhancer.ts` for the dialog layer)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of the existing date-picker in `registry/jte/`; the
  `native-date` PARTIAL that delegates to `<input type="date">` is a SEPARATE component and is NOT
  this spec)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: **WAI-ARIA APG Dialog (modal) example "Date Picker Dialog"**
      (`https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/`) +
      **APG Spinbutton pattern** (`https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/`) for
      the month/year spinbutton inputs; **react-aria `useDatePicker` / `useCalendar` / `useCalendarGrid`**
      interaction model as the pattern reference for the trigger combobox + roving grid + range modes
      (keyboard maps, ARIA wiring, focus order transcribed into ORIGINAL template +
      `date-picker.enhancer.ts`; no react-aria source copied)
    - inventory: Ant Design DatePicker as inventory reference (single date, date range, date-time,
      week/month/quarter/year modes, presets, disabled dates, shortcuts bar)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI (NO
      code copied)

---

## 1. What it is

A date (or date-range) picker composed of two co-operating pieces: a **trigger** (a styled text input
displaying the formatted date, acting as the combobox input) and a **calendar dialog** (a modal panel
containing a month-grid for visual date selection). The selected date is a server fact (`@Wire
LocalDate value`) — WIRE, not a client widget. The ONE irreducible CLIENT behavior is the keyboard
roving inside the calendar grid (arrow navigation, Page Up/Down, Home/End) and the month/year
spinbutton increment/decrement: these are the `date-picker.enhancer.ts`. The dialog lifecycle
(open/close, focus trap, Esc, scrim, scroll lock) is the shared `focus-trap.enhancer.ts` composed
unchanged, exactly as `dialog` uses it.

Why server-first works: the adopted date is a domain fact (a booking date, a deadline, a birth
date); it lives in the Java model from the first render, not assembled client-side. The grid morph
on month/year change is a wire round-trip (the server re-renders the right days); the calendar does
not re-compute the month in JS. The only JS that is irreducible is the arrow-key routing WITHIN the
already-rendered grid cells and the spinbutton step — the "one irreducible client bit" the enhancer
owns.

A `native-date` PARTIAL (`<input type="date">` wrapper with `--lv-*` tokens) is the lightweight
alternative for non-gestionale use. This rich picker is for gestionale admin screens where visual
calendar presentation, preset shortcuts, disabled-date rules, and date-range selection are required.

---

## 2. API — the WIRE surface + template params

### Java (`DatePickerComponent`)

| member | kind | meaning |
|---|---|---|
| `value` `LocalDate` | `@Wire` | the selected single date (null = none selected) |
| `rangeStart` `LocalDate` | `@Wire` | range mode: start date (null = none); used only when `mode=RANGE` |
| `rangeEnd` `LocalDate` | `@Wire` | range mode: end date (null = none); used only when `mode=RANGE` |
| `viewYear` `int` | `@Wire` | the calendar year the grid is currently displaying (not the value) |
| `viewMonth` `int` | `@Wire` | the calendar month (1–12) the grid is currently displaying |
| `open` `boolean` | `@Wire` | dialog open-state |
| `mode` `String` | `@Wire @LievitProperty(locked=true)` | `single` \| `range` \| `week` \| `month` \| `year` (locked: cannot be changed by client action) |
| `format` `String` | `@Wire @LievitProperty(locked=true)` | display format string (e.g. `dd/MM/yyyy`); used to format value for the trigger input |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | trigger input placeholder (default `"Seleziona una data"`) |
| `minDate` `LocalDate` | `@Wire @LievitProperty(locked=true)` | earliest selectable date (null = no minimum); server enforces |
| `maxDate` `LocalDate` | `@Wire @LievitProperty(locked=true)` | latest selectable date (null = no maximum); server enforces |
| `disabledDates` `Set<LocalDate>` | `@Wire @LievitProperty(locked=true)` | specific disabled dates (locked; a client cannot inject disabled rules) |
| `disabledDayOfWeek` `Set<DayOfWeek>` | `@Wire @LievitProperty(locked=true)` | disabled weekdays (e.g. `{SATURDAY, SUNDAY}`) |
| `presets` `List<Preset>` | `@Wire @LievitProperty(locked=true)` | shortcut labels + their `LocalDate` target (e.g. "Today", "Yesterday", "Last 7 days"); locked |
| `showWeekNumbers` `boolean` | `@Wire @LievitProperty(locked=true)` | whether week-number column is rendered |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `sm` \| `md` (default) \| `lg` — trigger height |
| `disabled` `boolean` | `@Wire @LievitProperty(locked=true)` | entire control disabled |
| `label` `String` | `@Wire @LievitProperty(locked=true)` | accessible label for the trigger; used as `aria-label` if no visible `<label>` is associated |
| `openDialog()` | `@LievitAction` | sets `open=true`; no-op if `disabled` |
| `close()` | `@LievitAction` | sets `open=false`; focus restore handled by `focus-trap` enhancer |
| `selectDate(String iso)` | `@LievitAction` | sets `value` (single/week/month/year) or advances the range (rangeStart → rangeEnd); validates: date must be parseable as `LocalDate`, must not be disabled, must be within min/max; authz + validation in Java BEFORE state mutates; also calls `close()` for single mode |
| `selectRangeDate(String iso)` | `@LievitAction` | for `mode=RANGE`: sets `rangeStart` on first call, then `rangeEnd` on second (server tracks whether rangeStart is already set); resets both if a new click arrives before rangeEnd |
| `prevMonth()` / `nextMonth()` | `@LievitAction` | decrements/increments `viewMonth` (wraps across year boundary, adjusting `viewYear`); re-renders the grid |
| `prevYear()` / `nextYear()` | `@LievitAction` | decrements/increments `viewYear` |
| `setViewMonth(int month)` | `@LievitAction` | jump to a specific month (1–12) via spinbutton direct input |
| `setViewYear(int year)` | `@LievitAction` | jump to a specific year via spinbutton direct input |
| `selectPreset(int index)` | `@LievitAction` | selects the preset at the given index; validates index ∈ presets; may set rangeStart + rangeEnd for range presets |
| `clearValue()` | `@LievitAction` | resets `value` (and `rangeStart`/`rangeEnd`) to null, closes if open |
| `visibleDays()` | getter on `_instance` | `List<DayCell>` for the current `viewMonth`/`viewYear` (padded to complete weeks, carries: date, isToday, isSelected, isInRange, isRangeStart, isRangeEnd, isDisabled, isOutsideMonth, weekNumber); `@LievitProperty(serialize=false)` |
| `formattedValue()` | getter on `_instance` | the trigger input display string (formats `value`/range using `format`); `@LievitProperty(serialize=false)` |

**`DayCell` record** (inner, used only by the template):
`LocalDate date`, `boolean isToday`, `boolean isSelected`, `boolean isInRange`,
`boolean isRangeStart`, `boolean isRangeEnd`, `boolean isDisabled`, `boolean isOutsideMonth`,
`int weekNumber`.

**`Preset` record**: `String label`, `LocalDate targetDate` (single) or `LocalDate rangeStartDate` +
`LocalDate rangeEndDate` (range); `int index` (position in list, used by `selectPreset`).

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param DatePickerComponent _instance` (for `visibleDays()` + `formattedValue()`).
No `Content` slot — this is WIRE, body is OWNED markup.

---

## 3. Variants / sizes / states

### Modes (locked server config)
| mode | what it selects | grid presentation |
|---|---|---|
| `single` | one `LocalDate` | standard month grid, one date highlighted |
| `range` | `rangeStart` + `rangeEnd` | month grid with in-range shading between the two selected dates |
| `week` | the ISO week containing the clicked date (the full Monday–Sunday row highlights) | month grid with full row selection |
| `month` | year + month (no day; `value` normalised to first-of-month) | year-view: 12 month chips instead of day grid |
| `year` | the year (no month/day; `value` normalised to Jan 1) | decade-view: 10–12 year chips |

### Sizes (trigger height — height-based, toolbar-aligned)
| size | height token | trigger aligns with |
|---|---|---|
| `sm` | `--lv-space-8` (32 px) | `button size=sm`, `input size=sm` |
| `md` | `--lv-space-9` (36 px, default) | shadcn baseline |
| `lg` | `--lv-space-10` (40 px) | `button size=lg` |

The calendar dialog panel is size-invariant (the trigger size does not change the calendar panel width).

### States
| state | how expressed |
|---|---|
| `disabled` (whole control) | trigger: native `disabled` attr + `disabled:` utilities + `aria-disabled`; dialog cannot be opened; visually dimmed |
| `hover` (trigger) | `:hover` → `--lv-color-input` background shift |
| `focus-visible` (trigger) | `:focus-visible` → `--lv-ring` (shared focus token) |
| `open` | trigger: `aria-expanded="true"`; dialog rendered (not `hidden`) |
| `aria-invalid` | trigger border + ring recolour to `--lv-color-destructive`; use when the outer `<field>` wraps it and the value fails server validation |
| `aria-busy` | set by runtime `beforeCall`/`afterCall` during a wire round-trip (month/year navigation shows spinner on the grid caption area) |
| `isSelected` (day cell) | `aria-selected="true"` + `tabindex="0"` on the cell; token-coloured background |
| `isRangeStart` / `isRangeEnd` | range-end rounded caps; `isInRange` cells get the in-range fill |
| `isToday` | today ring (outline, not fill, so it is distinct from selected) |
| `isDisabled` (day cell) | `aria-disabled="true"` + `tabindex="-1"` + strike-through; click fires no action |
| `isOutsideMonth` | rendered but dimmed (`--lv-color-muted`), still navigable, click selects and flips the month view |
| loading (month nav) | `aria-busy` on the grid container + spinner partial during the wire round-trip |

### Slots (WIRE has no `Content` slot; structure is OWNED)
There are no JTE `gg.jte.Content` slots — this is a WIRE component. The calendar body (grid,
navigation bar, presets panel, footer) is owned markup composed inside the template.
The trigger leading icon (calendar icon) is composed via `@template.lievit.icon(...)` directly.

---

## 4. The a11y contract (the heart — the dialog + grid model)

### WAI-ARIA patterns
Two APG patterns compose here without overlap:
1. **APG Dialog (modal)** — the calendar panel overlay
   (`https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/`): the dialog
   role + aria-modal + focus trap + Esc + Tab cycling. The `focus-trap.enhancer.ts` owns all of this,
   parameterised the same way as `dialog` (no separate implementation).
2. **APG Grid** — the calendar month grid (the `role="grid"` table with `role="gridcell"` cells):
   roving tabindex arrow navigation. Owned by `date-picker.enhancer.ts`.
3. **APG Spinbutton** — the month/year navigation inputs
   (`https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/`): Up/Down arrow increment/decrement.
   Owned by `date-picker.enhancer.ts`.
4. **APG Combobox** — the trigger input acts as the date field: `role="combobox"`,
   `aria-haspopup="dialog"`, `aria-expanded` reflecting `open`, read-only in default mode (typing
   is an optional free-entry mode).

### Roles + ARIA (what the JTE template emits — static server markup)

**Trigger (the combobox input)**:
```
<input role="combobox"
       aria-haspopup="dialog"
       aria-expanded="${open ? 'true' : 'false'}"
       aria-controls="<dialogId>"
       aria-label="${label}"   (or aria-labelledby if a visible <label> exists)
       aria-describedby="<formatHintId>"
       aria-invalid="${ariaInvalid ? 'true' : 'false'}"
       aria-disabled="${disabled ? 'true' : 'false'}"
       value="${_instance.formattedValue()}"
       readonly           (default; direct keyboard entry is opt-in via a future prop)
       data-slot="trigger"
       ...>
```
A visible calendar icon `<button>` beside the input also opens the dialog (icon-only → `aria-label="Apri calendario"`).

**Format hint (hidden assistive text)**:
```
<span id="<formatHintId>" class="sr-only">Formato: ${format}</span>
```

**Calendar dialog panel** (rendered only when `open`):
```
<div role="dialog"
     id="<dialogId>"
     aria-modal="true"
     aria-label="Seleziona una data"   (or interpolate the format for context)
     data-slot="dialog"
     ...>
```

**Dialog header — month/year navigation**:
```
<button aria-label="Anno precedente">  <!-- prevYear -->
<button aria-label="Mese precedente">  <!-- prevMonth -->
<span role="spinbutton"
      aria-label="Mese"
      aria-valuenow="${viewMonth}"
      aria-valuemin="1"
      aria-valuemax="12"
      aria-valuetext="${monthName}">
<span role="spinbutton"
      aria-label="Anno"
      aria-valuenow="${viewYear}"
      aria-valuemin="${minYear}"
      aria-valuemax="${maxYear}"
      aria-valuetext="${viewYear}">
<button aria-label="Mese successivo">  <!-- nextMonth -->
<button aria-label="Anno successivo">  <!-- nextYear -->
```
An `aria-live="polite"` region (inside the dialog) announces the new month+year label after each
navigation action (the APG example pattern: `"June 2026"`).

**Calendar grid**:
```
<table role="grid"
       aria-labelledby="<monthYearLabelId>"
       data-slot="grid">
  <thead>
    <tr>
      <th role="columnheader" abbr="Lunedì" scope="col">Lu</th>
      <!-- ... one per visible weekday ... -->
    </tr>
  </thead>
  <tbody>
    <tr>  <!-- one per week row -->
      <td role="gridcell"
          id="cell-<iso>"
          aria-selected="${cell.isSelected ? 'true' : 'false'}"
          aria-disabled="${cell.isDisabled ? 'true' : 'false'}"
          aria-label="${cell.date formatted with full month, day, year}"
          tabindex="${cell is active ? '0' : '-1'}"
          data-date="${cell.date as ISO}"
          data-slot="day">
        <span aria-hidden="true">${cell.date.dayOfMonth}</span>
      </td>
    </tr>
  </tbody>
</table>
```
Only one gridcell has `tabindex="0"` at any time (roving tabindex model). The enhancer manages which
cell is active and updates `tabindex` attributes in place (no morph needed for navigation keys alone;
only a date SELECTION triggers a wire round-trip via `selectDate`/`selectRangeDate`).

**Dialog footer (OK / Cancel / Clear)**:
```
<button type="button" l:click="close">Annulla</button>
<button type="button" l:click="clearValue">Cancella</button>
<button type="button" l:click="close">OK</button>   <!-- or l:click="confirmRange" for range mode -->
```
All are real `<button>` elements — platform supplies Enter/Space + focus.

**Presets panel** (when `presets` is non-empty; rendered as a sibling section inside the dialog):
```
<ul role="listbox" aria-label="Scorciatoie">
  <li role="option"
      aria-selected="false"
      data-preset-index="<escaped index>"
      l:click="selectPreset"
      data-index="${preset.index}">
    ${preset.label}
  </li>
</ul>
```
Arrow nav in the presets list composes `collection-nav.enhancer.ts` (the same shared listbox
roving, parameterised). The index is passed as a `data-index` data attribute through the SAFE
escaped channel (per-row action rule — see §2 above; `dataAttrs` channel).

### Keyboard interaction map (the complete contract)

The table covers all interactive surfaces inside the component. "Enhancer" = `date-picker.enhancer.ts`
unless noted otherwise.

| surface | key | action | who |
|---|---|---|---|
| **Trigger input** | Enter / Space | opens the dialog; focuses the active/selected cell or today | enhancer (fires `openDialog` wire action) |
| Trigger input | ArrowDown | opens the dialog (same as Enter) | enhancer |
| Trigger input | Escape | closes the dialog if open | `focus-trap` enhancer |
| Trigger input | Tab | moves to next element in page tab order | platform |
| **Calendar icon button** | Enter / Space | opens the dialog | platform (native `<button>`) |
| **Dialog** | Escape | closes the dialog, returns focus to the trigger | `focus-trap` enhancer |
| Dialog | Tab | moves to next tabbable element INSIDE the dialog; wraps from OK → Prev-Year button | `focus-trap` enhancer |
| Dialog | Shift+Tab | moves to previous tabbable element INSIDE the dialog; wraps from Prev-Year → OK | `focus-trap` enhancer |
| **Month/Year spinbutton** | ArrowUp | increments the spinbutton (month: wraps 12→1 carrying year; year: +1) | enhancer |
| Month/Year spinbutton | ArrowDown | decrements the spinbutton (month: wraps 1→12; year: -1) | enhancer |
| Month/Year spinbutton | Home | sets to minimum value (`1` for month, `minYear` for year) | enhancer |
| Month/Year spinbutton | End | sets to maximum value (`12` for month, `maxYear` for year) | enhancer |
| Month/Year spinbutton | Page Up | large step +1 year (on the year spinbutton) | enhancer |
| Month/Year spinbutton | Page Down | large step -1 year (on the year spinbutton) | enhancer |
| Month/Year spinbutton | printable digit(s) | accumulates typed digits (with 1s timeout), jumps to matching value | enhancer |
| **Prev/Next month/year buttons** | Enter / Space | fires the respective wire action | platform (native `<button>`) |
| **Calendar grid** | ArrowRight | focus next day (next cell) | enhancer (roving tabindex) |
| Calendar grid | ArrowLeft | focus previous day | enhancer |
| Calendar grid | ArrowDown | focus same weekday, next week | enhancer |
| Calendar grid | ArrowUp | focus same weekday, previous week | enhancer |
| Calendar grid | Home | focus first day of the current displayed week (Sunday or Monday per locale) | enhancer |
| Calendar grid | End | focus last day of the current displayed week | enhancer |
| Calendar grid | Page Up | focus same date number in the previous month (or last day of that month if unavailable); updates `viewMonth`/`viewYear` via wire | enhancer → wire (`prevMonth`) |
| Calendar grid | Shift+Page Up | focus same date in the previous year; updates via wire | enhancer → wire (`prevYear`) |
| Calendar grid | Page Down | focus same date in the next month; updates via wire | enhancer → wire (`nextMonth`) |
| Calendar grid | Shift+Page Down | focus same date in the next year; updates via wire | enhancer → wire (`nextYear`) |
| Calendar grid | Enter / Space | selects the focused cell's date; fires `selectDate`/`selectRangeDate`; single mode → also closes dialog | enhancer → wire |
| Calendar grid | Escape | closes dialog, returns focus to trigger (delegated to `focus-trap`) | `focus-trap` enhancer |
| **Preset list** | ArrowDown / ArrowUp | moves active preset option | `collection-nav` enhancer |
| Preset list | Enter / Space | fires `selectPreset(index)` | `collection-nav` + wire |
| Preset list | Escape | returns focus to the trigger, closes dialog | `focus-trap` enhancer |
| **OK button** | Enter / Space | closes the dialog; for range mode, confirms the selection | platform → wire (`close`) |
| **Cancel button** | Enter / Space | closes dialog without changing the value | platform → wire (`close`) |
| **Clear button** | Enter / Space | clears value and closes | platform → wire (`clearValue`) |

### Focus management (the load-bearing part)

- **initial focus on dialog open**: the `focus-trap` enhancer moves focus to the first tabbable element
  inside the dialog — the "Prev Year" navigation button (matching the APG datepicker-dialog example).
  Alternatively the component may mark an element `data-autofocus` (e.g. the selected or today cell) for
  `focus-trap` to target first, which is the preferred UX path (focus the selected date directly).
- **focus trap while open**: Tab / Shift+Tab cycle only within the dialog panel; Tab from the last
  focusable (OK button) wraps to the first (Prev Year button), and vice versa. Owned by `focus-trap`.
- **roving tabindex in the grid**: only one `<td role="gridcell">` has `tabindex="0"` at any moment.
  Arrow-key navigation updates which cell is `tabindex="0"` (client-only, no morph). The active cell is
  the last focused one, or the selected date on open, or today if nothing is selected. Owned by
  `date-picker.enhancer.ts`.
- **focus restore on close**: `focus-trap` records the opener (trigger input or calendar icon button)
  at mount time and returns focus there on `close()`. Same mechanism as `dialog`.
- **scroll lock**: body scroll is locked while the dialog is open. `focus-trap` adds the lock; CSP-clean.
- **month boundary during arrow navigation**: when arrows cross into the previous/previous month,
  the enhancer fires `prevMonth()` / `nextMonth()` wire action and, after the morph, moves focus to the
  appropriate cell in the newly-rendered grid. The morph is identity-preserving: the enhancer re-anchors
  `tabindex="0"` by `data-date` attribute after the patch.

### Live regions
- A `role="status"` / `aria-live="polite"` region inside the dialog announces the current month+year
  after every navigation action: `"Giugno 2026"`. This is the APG-recommended pattern for the calendar
  dialog.
- The shared `announcer` (lievit runtime) is NOT needed here — the live region is scoped to the dialog.

### Shared mechanisms composed
| mechanism | what it handles | do NOT re-implement |
|---|---|---|
| `focus-trap.enhancer.ts` | dialog open/close, focus trap, Esc, scroll lock, focus restore | same instance as `dialog` — parameterised |
| `date-picker.enhancer.ts` | grid roving tabindex, arrow nav, Page Up/Down, spinbutton step+type | net-new, single source |
| `collection-nav.enhancer.ts` | preset listbox roving + typeahead | same instance as `select`/`dropdown-menu` |
| popover seam (native `popover` + CSS anchor) | the dialog panel positioning above/below the trigger | same seam as all overlays |

---

## 5. Tokens

### Consumed from the existing `--lv-*` token set

**Trigger (input)**:
- `--lv-color-input` — trigger background
- `--lv-color-border` — trigger border
- `--lv-color-fg` — trigger text (selected date)
- `--lv-color-muted` — placeholder text
- `--lv-color-destructive` — `aria-invalid` border + ring recolour
- `--lv-space-{8,9,10}` — height (size sm/md/lg)
- `--lv-space-{2,3,4}` — horizontal padding + icon gap
- `--lv-text-sm` — trigger font size (md), `--lv-text-xs` (sm)
- `--lv-radius-md` — trigger corner radius
- `--lv-ring` — focus-visible ring (shared across all interactive primitives)
- `--lv-font-sans`

**Dialog panel**:
- `--lv-color-popover` — calendar panel background
- `--lv-color-popover-fg` — calendar panel text
- `--lv-color-border` — panel border
- `--lv-color-overlay` — scrim background (behind the panel)
- `--lv-z-overlay` — scrim z-index
- `--lv-z-modal` — panel z-index (above scrim)
- `--lv-radius-lg` — panel corner radius
- `--lv-shadow-xl` — panel elevation
- `--lv-space-{4,5,6}` — panel internal padding

**Navigation bar**:
- `--lv-color-accent` — prev/next button hover background
- `--lv-color-accent-fg` — button icon colour on hover
- `--lv-text-sm` — month/year label
- `--lv-font-sans`

**Calendar grid cells**:
- `--lv-color-primary` — selected day background
- `--lv-color-primary-fg` — selected day text
- `--lv-color-accent` — today ring colour (outline, not fill)
- `--lv-color-muted` — outside-month day text
- `--lv-radius-md` — individual day cell corner radius (rounded square)
- `--lv-text-sm` — day number text
- `--lv-space-{1,2}` — cell padding

**Range mode**:
- `--lv-color-primary` / `--lv-color-primary-fg` — range-start and range-end caps
- NET-NEW: `--lv-color-primary-subtle` — the in-range fill (a very light tint of primary)
  **Justification**: the in-range fill is a distinct semantic — "selected but not an endpoint". It is
  a perceptually lighter variant of `--lv-color-primary` (e.g. `oklch(L+0.15 C*0.25 H)` of the primary).
  It cannot be expressed as the existing `--lv-color-accent` (accent is for hover/focus of the neutral
  action, not for a selection range). **Additive, namespaced, goes in `:root` + `.dark` blocks.**

**Presets panel**:
- `--lv-color-accent` — hovered/active preset background
- `--lv-color-fg` — preset label text
- `--lv-text-sm`

**Disabled day cells**:
- `--lv-color-muted` — text colour; `opacity: 0.4` utility class

**Dark mode**: the single `.dark, [data-theme="dark"]` re-point block covers all the above tokens
through the existing mechanism. The only net-new dark token is `--lv-color-primary-subtle` (a darker
variant: e.g. `oklch(L-0.25 C*0.25 H)` of the dark-mode primary, so the range fill is visible on dark
backgrounds without being harsh).

### Net-new token summary

| token | OKLCH example | purpose | additive |
|---|---|---|---|
| `--lv-color-primary-subtle` | `oklch(0.92 0.04 250)` (light) / `oklch(0.28 0.04 250)` (dark) | in-range fill between rangeStart and rangeEnd | yes — `:root` + `.dark` |

All existing colour tokens are authored in OKLCH per architecture contract §4 (D1 DECIDED).

---

## 6. Wire actions + enhancer wiring

### The `l:*` directives the template binds

```
<!-- trigger input -->
<input l:click="openDialog"
       l:keydown.enter="openDialog"
       l:keydown.arrow-down="openDialog"
       ...>

<!-- calendar icon button -->
<button l:click="openDialog" aria-label="Apri calendario">...</button>

<!-- month navigation buttons -->
<button l:click="prevYear">...</button>
<button l:click="prevMonth">...</button>
<button l:click="nextMonth">...</button>
<button l:click="nextYear">...</button>

<!-- day cells (per-row; the SAFE data-* channel) -->
<td l:click="selectDate"
    data-date="${cell.date.toString()}"   ← SAFE: ISO string from LocalDate, not user input
    ...>

<!-- range mode uses selectRangeDate instead -->
<td l:click="selectRangeDate" data-date="${cell.date.toString()}" ...>

<!-- presets (the SAFE index channel) -->
<li l:click="selectPreset"
    data-index="${preset.index}"
    ...>

<!-- footer buttons -->
<button l:click="close">Annulla</button>
<button l:click="clearValue">Cancella</button>
<button l:click="close">OK</button>
```

The spinbutton spans and the grid cells' keyboard interactions are NOT wired with `l:*` directives —
they are handled by `date-picker.enhancer.ts`, which fires the appropriate wire action programmatically
(e.g. calls the wire's `prevMonth` action when Page Up is pressed in the grid).

### Wire action signatures and invariants

| action | Java signature | mutates | validation (before mutate) |
|---|---|---|---|
| `openDialog()` | `void openDialog()` | `open = true` | no-op if `disabled` |
| `close()` | `void close()` | `open = false` | always allowed |
| `selectDate(String iso)` | `void selectDate(String iso)` | `value`, then calls `close()` for single mode | parse `LocalDate.parse(iso)`; check ∉ `disabledDates`; check ∉ `disabledDayOfWeek`; check between `minDate`/`maxDate`; invalid → log + no-op (no client error; the cell was server-rendered disabled) |
| `selectRangeDate(String iso)` | `void selectRangeDate(String iso)` | `rangeStart` then `rangeEnd` (second call); resets if new click before end | same date validation; also enforce `rangeEnd >= rangeStart`; if second click < rangeStart, swap |
| `prevMonth()` / `nextMonth()` | `void prevMonth()` / `void nextMonth()` | `viewMonth`, `viewYear` | wrap across year boundary |
| `prevYear()` / `nextYear()` | `void prevYear()` / `void nextYear()` | `viewYear` | clamp at `minYear`/`maxYear` |
| `setViewMonth(int m)` | `void setViewMonth(int m)` | `viewMonth` | `1 ≤ m ≤ 12`; invalid → no-op |
| `setViewYear(int y)` | `void setViewYear(int y)` | `viewYear` | within `minYear`/`maxYear`; invalid → no-op |
| `selectPreset(int idx)` | `void selectPreset(int idx)` | `value`/`rangeStart`/`rangeEnd` | `idx ∈ [0, presets.size())`; parse the preset dates the same way as `selectDate` |
| `clearValue()` | `void clearValue()` | `value = null`, `rangeStart = null`, `rangeEnd = null`, `open = false` | always allowed |

### Enhancer responsibilities (`date-picker.enhancer.ts`)

The enhancer mounts via the lievit lifecycle registry `onComponentInit` on the component's root element.

1. **Grid roving tabindex**: on mount, scan all `[role="gridcell"]` children; set `tabindex="0"` on the
   one matching today / the selected date / the first non-disabled cell. On arrow-key press in the grid,
   prevent default, compute the target cell index, update `tabindex` attributes, call `.focus()` on the
   target cell. No morph for arrow navigation alone.

2. **Grid month-boundary crossing**: when an arrow key would move outside the rendered month, fire the
   appropriate `prevMonth()` / `nextMonth()` wire action. After the morph settles (runtime `afterMorph`
   lifecycle hook), re-anchor `tabindex="0"` on the target cell by `data-date` value.

3. **Page Up / Shift+Page Up / Page Down / Shift+Page Down**: fire `prevMonth()` / `prevYear()` /
   `nextMonth()` / `nextYear()` as appropriate; after morph, focus the same `data-date` (or last day of
   the new month if that date does not exist there).

4. **Home / End**: move to first/last day of the currently focused week row (no wire call; client-only).

5. **Enter / Space on a grid cell**: read `dataset.date`, fire `selectDate` or `selectRangeDate` wire
   action with the ISO value. Skipped for disabled cells (`aria-disabled="true"`).

6. **Spinbutton step**: on `ArrowUp`/`ArrowDown` on `[role="spinbutton"][aria-label="Mese"]`, increment/
   decrement `viewMonth` (wrapping, carrying year) by firing `setViewMonth` + optionally `setViewYear`.
   On `[aria-label="Anno"]`, fire `setViewYear`. On printable digit keys, accumulate typed digits (1s
   debounce), then fire `setViewMonth` / `setViewYear` with the numeric value.

7. **Escape routing**: Esc inside the grid is forwarded to `focus-trap` (the enhancer does NOT handle it
   independently; it merely ensures the key is not consumed and bubbles to `focus-trap`'s handler).

8. **After-morph re-init** (`onAfterMorph` lifecycle hook): re-scan the grid cells, restore the active
   cell's `tabindex="0"` by `data-date`, because the morph may have replaced the DOM nodes. This is the
   same pattern the `combobox` enhancer uses after a list re-render.

### Round-trip summary

```
Trigger click
  → openDialog (wire) → re-render with open=true → morph mounts dialog
    → focus-trap sets initial focus (selected cell or Prev-Year button)
    → enhancer re-anchors grid roving

Arrow keys in grid (client-only, no morph)
  → enhancer moves tabindex + focus

Page Down in grid
  → nextMonth (wire) → re-render new month grid → morph
    → enhancer after-morph hook re-anchors tabindex to correct cell

Enter on focused cell
  → selectDate (wire, SAFE data-date channel) → validates → value set, open=false
    → re-render: dialog absent, trigger shows new formatted value
    → focus-trap restores focus to trigger

Preset click
  → selectPreset (wire, SAFE data-index channel) → sets value/range, open=false
    → re-render: trigger updated

Clear click
  → clearValue (wire) → value null, open=false
    → re-render: trigger shows placeholder
```

---

## 7. Acceptance tests (the gate — refute-by-default)

All tests run on a REAL substrate — not a mocked `$lievit` (client-island-fidelity lesson from
gest's CLAUDE.md). Tests that cover client keyboard behavior use the real `date-picker.enhancer.ts`
and the real `LievitRuntime`.

### Render tests (real `LievitRuntime` + jsdom, REAL enhancers mounted)

- **trigger renders with correct role**: the `<input role="combobox">` has `aria-haspopup="dialog"`,
  `aria-expanded="false"`, `aria-controls` pointing to the dialog id; `data-slot="trigger"` present.
- **dialog is absent from DOM when closed**: the panel is not in the DOM (or has `hidden`) when
  `open=false`; it is entirely absent from the a11y tree.
- **dialog renders correctly when open**: after `openDialog()` round-trip, the panel has
  `role="dialog"`, `aria-modal="true"`, `aria-label` set; the grid has `role="grid"` + `aria-labelledby`
  → the month/year label; all cells have `role="gridcell"` + `aria-selected` + `tabindex`.
- **selected date cell is marked**: the cell matching the current `value` has `aria-selected="true"` +
  `tabindex="0"`; all other cells have `aria-selected="false"` or absent + `tabindex="-1"`.
- **today cell has today marker**: the cell for LocalDate.now() has the today CSS class and does NOT
  have `aria-selected="true"` unless it is also the selected value.
- **disabled dates are inert**: cells for disabled dates have `aria-disabled="true"` + `tabindex="-1"`;
  clicking them fires no wire action (click handler checks `aria-disabled` before firing).
- **outside-month cells are present but dimmed**: cells for padding days have `isOutsideMonth` CSS +
  are still navigable (not aria-disabled unless also in disabledDates).
- **range mode shading**: in `mode=RANGE`, after setting `rangeStart` and `rangeEnd`, cells between the
  two dates have the in-range class; start + end cells have their respective cap classes.
- **week mode highlights full row**: in `mode=WEEK`, clicking any cell in a week highlights all 7 cells
  of that row as selected.
- **presets panel renders**: when `presets` is non-empty, the `role="listbox"` list is present inside
  the dialog; each item has `role="option"` + `data-index` (safely escaped).
- **format hint is present**: the `<span class="sr-only">` with `id=<formatHintId>` carrying the format
  string is in the DOM; the trigger's `aria-describedby` references it.
- **spinbuttons render correctly**: two `[role="spinbutton"]` elements have `aria-valuenow`,
  `aria-valuemin`, `aria-valuemax`, `aria-valuetext` matching the current `viewMonth`/`viewYear`.
- **disabled whole control**: trigger has `aria-disabled="true"` + `disabled` attr; `openDialog` wire
  action is a no-op; no dialog is ever rendered.
- **sizes emit correct height token classes**: `size=sm` → `--lv-space-8`; `md` → `--lv-space-9`; `lg`
  → `--lv-space-10`; `data-size` attribute present on the root.
- **aria-invalid recolours trigger**: `aria-invalid="true"` on the trigger emits the destructive border
  + ring token classes.

### Axe-core tests (zero violations on cited rules)

- **closed state**: run axe on the trigger + surrounding field; zero violations (combobox pattern rules,
  label/name rules).
- **open state**: run axe on the full dialog DOM; zero violations — specifically: dialog roles, grid
  roles, aria-selected consistency, aria-labelledby resolution, aria-describedby resolution, focus
  management (tabindex usage).
- **open, disabled date cell present**: axe passes even when `aria-disabled` cells are present (verify
  no false ARIA-allowed-attr violation).

### Keyboard tests (each key in the §4 map; real enhancer + real DOM)

- **Enter on trigger opens dialog**: keydown Enter on the trigger → dialog renders in DOM; focus moves
  inside the dialog.
- **ArrowDown on trigger opens dialog**: same as Enter.
- **Escape closes dialog**: open dialog → keydown Escape → dialog absent from DOM; focus on trigger.
- **Tab cycles within dialog**: open dialog → Tab from OK button → focus wraps to Prev-Year button; Tab
  through all tabbable elements stays within panel.
- **Shift+Tab wraps correctly**: from first tabbable → wraps to last.
- **ArrowRight in grid moves one day forward**: focus cell for 2026-06-10 → ArrowRight → focus on
  `[data-date="2026-06-11"]`; tabindex updated.
- **ArrowLeft in grid moves one day back**: symmetric.
- **ArrowDown moves one week forward**: focus row R, column C → ArrowDown → focus row R+1, column C.
- **ArrowUp moves one week back**: symmetric.
- **Home moves to first day of week**: focus on Wednesday → Home → focus on Monday (or Sunday per locale).
- **End moves to last day of week**: focus on Wednesday → End → focus on Sunday (or Saturday per locale).
- **Page Down fires nextMonth and re-anchors focus**: focus on 2026-06-15 → Page Down → wire `nextMonth`
  fires → after morph, focus on `[data-date="2026-07-15"]`; `viewMonth` is 7.
- **Shift+Page Down fires nextYear**: focus on 2026-06-15 → Shift+Page Down → `nextYear` fires → focus
  on `[data-date="2027-06-15"]`.
- **Page Up / Shift+Page Up**: symmetric to Page Down / Shift+Page Down.
- **Page Down when target date missing in next month**: focus on 2026-01-31 → Page Down → target
  2026-02-31 does not exist → focus on last day of Feb (2026-02-28).
- **Enter on grid cell selects date (single mode)**: focus cell `[data-date="2026-06-15"]` → Enter →
  wire `selectDate("2026-06-15")` fires → dialog closes → trigger value shows "15/06/2026" (or
  format-equivalent).
- **Space on grid cell selects date**: same as Enter.
- **Enter on disabled cell is inert**: focus cell with `aria-disabled="true"` → Enter → no wire action.
- **Spinbutton ArrowUp increments month**: focus month spinbutton → ArrowUp → `setViewMonth(nextMonth)`
  wire fires; `aria-valuenow` + grid update after morph.
- **Spinbutton ArrowDown decrements month and wraps**: on month 1, ArrowDown → `setViewMonth(12)` +
  `setViewYear(year-1)`.
- **Spinbutton year ArrowUp**: fire `setViewYear(year+1)`.
- **Spinbutton digit typeahead**: type "06" on month spinbutton → after 1s → `setViewMonth(6)`.
- **Preset ArrowDown/Up moves active option**: in presets listbox, ArrowDown → next option is active.
- **Preset Enter selects**: Enter on active preset → `selectPreset(index)` fires → value set → trigger updated.

### Focus tests

- **initial focus is inside dialog on open**: open dialog → `document.activeElement` is a child of the
  panel (the selected cell, or today's cell, or the Prev-Year button — assert NOT outside the panel).
- **focus trap holds**: Tab Tab Tab from any element in the dialog never exits the panel.
- **focus returns to trigger on close**: open → close via Escape → `document.activeElement ===
  triggerInput`.
- **focus returns to trigger on OK**: open → Enter on OK → focus on trigger.
- **focus returns to icon-button opener**: if dialog was opened via the calendar icon button →
  close → focus on the icon button.
- **scroll lock active while open**: `document.body.style.overflow` or the body class indicates locked
  while dialog open; unlocked after close.
- **roving tabindex: only one cell has tabindex=0**: assert there is EXACTLY one
  `[role="gridcell"][tabindex="0"]` in the open grid at all times.

### Wire round-trip IT (lievit-kit, real runtime — the `CollapsibleComponentIT` pattern)

- **mount → open → render grid**: mount `DatePickerComponent` with `value=null, open=false` →
  call `openDialog()` → re-render asserts dialog DOM present with correct `viewMonth`/`viewYear` grid.
- **select date → value reflected in trigger**: select `2026-06-15` → re-render → `formattedValue()`
  returns `"15/06/2026"` (or format-equivalent) → trigger value attribute matches.
- **prevMonth → grid re-renders**: open at June 2026 → `prevMonth()` → re-render → grid cells are for
  May 2026; `aria-labelledby` region reads "Maggio 2026".
- **range: select start then end**: `mode=RANGE` → `selectRangeDate("2026-06-10")` →
  `selectRangeDate("2026-06-15")` → `rangeStart` = 2026-06-10, `rangeEnd` = 2026-06-15; cells in
  between have `isInRange=true`; range-end closes dialog.
- **disabled date is rejected**: call `selectDate("2026-12-25")` when 2026-12-25 ∈ `disabledDates` →
  `value` unchanged, no close.
- **clearValue resets to null**: set value → `clearValue()` → `value=null`, trigger shows placeholder.
- **preset selection**: `selectPreset(0)` → value matches `presets[0].targetDate`; trigger shows
  formatted value.

### Playwright tests (gesture fidelity — legacy-VM oracle)

- **real click opens calendar and grid is visible**: `page.click('[data-slot="trigger"]')` → panel
  appears in DOM with real grid cells rendered and visible (not just present in DOM — assert bounding
  box height > 0 and text content visible).
- **real keyboard arrow selects a date**: open dialog → `page.keyboard.press('ArrowRight')` moves
  focus one day → `page.keyboard.press('Enter')` → trigger value updates.
- **real Escape closes dialog**: open dialog → `page.keyboard.press('Escape')` → panel absent, focus
  on trigger.
- **real Page Down changes month**: open dialog → `page.keyboard.press('PageDown')` → grid caption
  shows next month name.
- **range selection via clicks**: `mode=RANGE` → click first date → click second date → in-range cells
  are visually styled (assert CSS class or bounding box for the range fill).
- **preset click selects date**: click a preset option → dialog closes, trigger shows the preset date.

### JTE compile + render
Covered by the existing `test/jte-compile` real-compiler gate (compiles the template with the
actual JTE engine, not a mock). The render gate asserts a non-empty output for a representative
`DatePickerComponent` with `open=false` and `open=true`.

### Escaping (the XSS abuse-case)
- `data-date` channel: a DayCell with `date = LocalDate.parse("2026-06-15")` (server-derived, never
  user input) renders `data-date="2026-06-15"` inert. The `selectDate` action re-parses with
  `LocalDate.parse(iso)` and rejects anything that is not a valid ISO date.
- `data-index` channel for presets: a preset with index 0 renders `data-index="0"`; the action validates
  `idx ∈ [0, presets.size())`. A hostile value like `"><script>` injected into a preset label is
  HTML-escaped through the standard JTE auto-escape (label goes through `${preset.label}`, not
  `$unsafe`).
- `attrs` is TRUSTED-ONLY (author-typed static strings, same as `button`). It is not fed per-row data.

---

## 8. Non-goals / anti-patterns

- **No `<input type="date">` wrapper here**: that is the separate `native-date` PARTIAL. Use it when
  the browser native picker is acceptable. Use this rich picker only when visual calendar, presets,
  disabled-date rules, or range selection are required.
- **No client-side month generation**: the server renders the grid. The enhancer does NOT compute
  which days to show; it only routes keyboard events and updates roving `tabindex`. Month navigation
  is a wire round-trip; the days are always server-truth.
- **No re-implementation of focus trapping**: `focus-trap.enhancer.ts` is the ONE source. This
  component COMPOSES it, does not duplicate it.
- **No re-implementation of popover positioning**: the overlay seam (native `popover` + CSS anchor)
  is the ONE source. The dialog panel uses it, does not hand-roll positioning.
- **No re-implementation of listbox roving for presets**: `collection-nav.enhancer.ts` owns it.
- **No date math in the enhancer**: the enhancer reads `data-date` ISO strings from the DOM (put there
  by the server) and fires wire actions. Date arithmetic (first-of-month, last-of-month, leap years,
  day-of-week) stays in Java (`DayCell` computation inside `visibleDays()`).
- **No free-text date entry in the base spec**: the trigger is `readonly` by default. Free-text
  parsing (typing "15/06/2026" and parsing it) is a future variant / separate prop; it introduces
  locale-aware parsing complexity that is out of scope here.
- **No inline time picking**: time is not combined here. If date+time selection is required, compose
  `date-picker` + `time-picker` as two separate controls in a `field-row` / `input-group`, do not merge
  them into a single widget.
- **No client-side disabled-date evaluation**: disabled dates, min/max, disabled weekdays are all server
  facts (`@LievitProperty(locked=true)`), reflected in the rendered `aria-disabled` on day cells. The
  enhancer reads `aria-disabled` to skip Enter/Space; it does NOT re-evaluate the rules client-side.
- **No framework inside the enhancer**: no Lit, no Alpine, no React. A typed-vanilla-TS module,
  CSP-clean, dependency-free.
- **No `Content` slot on the dialog body**: WIRE components have no `Content` slot (server-first
  refactor blueprint §1.b). The calendar body is OWNED markup inside the template.
- **No Turbo Stream swap for the grid**: the grid morph on month navigation is the lievit wire
  round-trip (the runtime morphs the full re-rendered component), not a Turbo Stream partial swap.
  The delivery boundary is the lievit runtime (ADR-0086, locked).
