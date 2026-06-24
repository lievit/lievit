<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — calendar (interactive month-grid)

- **tier**: WIRE + ENH (`calendar-grid.enhancer.ts`, typed-TS — the one irreducible client
  behaviors: roving-tabindex arrow-nav, drag-move, drag-resize, long-press touch-to-create)
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: NET-NEW (gest ships a bespoke `ht-calendar` Lit island; this is the
  server-first WIRE replacement; see the `Calendar realignment on local branch` memory entry for
  the in-flight worktree context)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Grid pattern (https://www.w3.org/WAI/ARIA/apg/patterns/grid/) + APG
      Date Picker Dialog example keyboard map (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
      — BUILT against raw APG (no react-aria `useCalendar` source; react-aria interaction spec
      consulted as a cross-reference for the roving-tabindex model); drag interactions follow
      FullCalendar-shape keyboard fallback conventions
    - inventory: Ant Design Calendar as inventory reference (month/week/day views, event CRUD,
      drag-move/resize, toolbar, mini-calendar embed); FullCalendar as the shape reference for
      event data + drag vocabulary (no code copied)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI
      calendar/table patterns (NO code copied)

## 1. What it is

An interactive month-grid calendar: a server-rendered grid of weeks × days (the month view),
where the EVENT SET is a server fact (`@Wire List<CalendarEvent> events`), where navigation
(prev month, next month, today, jump to date) triggers a wire round-trip that re-renders the
grid with the new month's events, and where the one irreducible CLIENT behavior — roving-tabindex
arrow-nav within the grid cells, drag-to-move and drag-to-resize events, long-press touch-to-create
— is owned by the typed-TS `calendar-grid.enhancer.ts`, NOT a framework.

WIRE because: the event set, the selected date, the focused month, and the day-cell open state are
ALL server facts; the server renders the truthful HTML for every state; the client morphs on every
navigation action. The calendar IS server-first because 95% of its surface is static HTML (the
grid, the event pills, the header row, the day numbers) and the server knows everything the grid
needs to render correctly. Only three behaviors genuinely cannot be done via server round-trip
without UX loss: (1) arrow-key roving focus within the grid cells — the platform does not supply
it for `role="gridcell"` children, (2) drag-move and drag-resize of event pills — a
pointermove-stream is inherently client, and (3) long-press touch-to-create. These three live
in `calendar-grid.enhancer.ts`.

Week-view and day-view are OUT of this spec (see §8). Month-grid is the target. The optional
mini-calendar (a read-only month-grid used as a navigation widget, no events, no drag) is a PARTIAL
composed from this WIRE's grid template.

## 2. API — the WIRE surface + template params

**Java (`CalendarComponent`)**:

| member | kind | meaning |
|---|---|---|
| `events` `List<CalendarEvent>` | `@Wire @LievitProperty(locked=true)` | the event set for the focused month; locked — a client cannot inject events |
| `focusedMonth` `YearMonth` | `@Wire` | the month currently displayed (default: current month); changed by navigation actions |
| `selectedDate` `LocalDate` | `@Wire` | the currently focused/selected day cell; drives the roving tabindex |
| `activeEventId` `String` | `@Wire` | the id of the event whose detail popover is open (null = none) |
| `firstDayOfWeek` `DayOfWeek` | `@Wire @LievitProperty(locked=true)` | MONDAY or SUNDAY; default MONDAY; locked config |
| `locale` `Locale` | `@Wire @LievitProperty(locked=true)` | display locale for day/month names; default server locale |
| `showWeekNumbers` `boolean` | `@Wire @LievitProperty(locked=true)` | render a week-number column on the left; default false |
| `readonly` `boolean` | `@Wire @LievitProperty(locked=true)` | disables drag, create, and any mutation action; default false |
| `minDate` `LocalDate` | `@Wire @LievitProperty(locked=true)` | earliest selectable date; cells before it get `aria-disabled`; null = no lower bound |
| `maxDate` `LocalDate` | `@Wire @LievitProperty(locked=true)` | latest selectable date; null = no upper bound |
| `prevMonth()` | `@LievitAction` | decrement `focusedMonth` by one month; update `selectedDate` to same-DOW or last day of new month |
| `nextMonth()` | `@LievitAction` | increment `focusedMonth` by one month; same boundary logic |
| `goToToday()` | `@LievitAction` | set `focusedMonth` = current month, `selectedDate` = today |
| `selectDate(LocalDate date)` | `@LievitAction` | set `selectedDate`; validates date ∈ [minDate, maxDate]; fires `onDateSelect` hook |
| `openEvent(String eventId)` | `@LievitAction` | set `activeEventId` = eventId; validates id ∈ events |
| `closeEvent()` | `@LievitAction` | set `activeEventId` = null |
| `moveEvent(String eventId, LocalDate newStart)` | `@LievitAction` | moves an event by delta days (drag-move result); validates id ∈ events + date bounds; readonly guard |
| `resizeEvent(String eventId, LocalDate newEnd)` | `@LievitAction` | extends/shrinks an event end date (drag-resize result); validates + readonly guard |
| `createEvent(LocalDate date)` | `@LievitAction` | fires the adopter-supplied `onCreateRequest` hook with the target date; no internal state mutation (event creation is adopter-owned) |
| `visibleWeeks()` | getter on `_instance` | `List<List<LocalDate>>` — 4-6 rows of 7 dates each, pre-computed for the template; `@LievitProperty(serialize=false)` |
| `eventsForDate(LocalDate)` | getter on `_instance` | `List<CalendarEvent>` for one cell, ordered by start time; `@LievitProperty(serialize=false)` |
| `isFocusedMonth(LocalDate)` | getter on `_instance` | true if the date's month == `focusedMonth` (for dimming overflow days) |
| `isToday(LocalDate)` | getter on `_instance` | true if the date == LocalDate.now() |
| `isSelected(LocalDate)` | getter on `_instance` | true if the date == `selectedDate` |
| `isDisabled(LocalDate)` | getter on `_instance` | true if date < minDate or date > maxDate |

**`CalendarEvent` value record** (locked shape, adopter supplies via the controller):

| field | type | meaning |
|---|---|---|
| `id` | `String` | unique, stable event id (rendered into `data-event-id`, SAFE-escaped) |
| `title` | `String` | display label (HTML-escaped in the template) |
| `start` | `LocalDate` | inclusive start date |
| `end` | `LocalDate` | inclusive end date (= start for single-day events) |
| `color` | `String` | intent token name: `primary \| secondary \| success \| warning \| destructive \| default`; maps to `--lv-color-{intent}` |
| `allDay` | `boolean` | always true for this month-grid; reserved for week/day views |
| `data` | `Map<String,String>` | adopter-supplied extra payload; each value SAFE-escaped into `data-*` on the pill; used by the adopter's `onEventClick` handler |

**Template params** (the `@param` surface of `calendar.jte`):
one `@param` per `@Wire` field + `@param ComponentMetadata _component` + `@param CalendarComponent _instance`.
No `Content` slot (WIRE has none — the grid body is fully OWNED markup).

## 3. Variants / sizes / states

**Views** (via `@Wire @LievitProperty(locked=true) String view`):
- `month` (default, this spec's primary target): 5-6 week rows, each row = 7 day cells + optional week-number cell.
- The `view` field is locked config; switching views via the toolbar is a future spec (week/day views are non-goals of THIS spec, §8).

**Toolbar**:
The grid is always accompanied by a toolbar partial (`_partials/calendar-toolbar.jte`) that renders
the month/year heading + prev/next/today buttons. The toolbar is OWNED markup inside the WIRE template,
not a slot. This mirrors the pattern already proven in gest's `ActivityController`.

**Day-cell states** (reflected in ARIA + CSS):
- `current month` vs `overflow` (days from adjacent months that fill the first/last partial week row): overflow cells are dimmed via `data-overflow="true"`, still focusable.
- `today`: `aria-current="date"` on the gridcell + `data-today="true"`.
- `selected` (the roving-tabindex focus cell): `tabindex="0"` + `aria-selected="true"` + `data-selected="true"`.
- `disabled` (outside [minDate, maxDate]): `aria-disabled="true"` + `tabindex="-1"` + `data-disabled="true"`; drag-drop is rejected in the action.
- `has-events`: `data-has-events="true"` (CSS hook for a dot indicator on compact sizes).
- `drag-over` (client-only, enhancer-managed): `data-drag-over="true"` while a dragged pill hovers.

**Event pill states**:
- `default`: colored pill with title, `tabindex="-1"` (focused only when the cell is the selected cell AND the pill is the focused pill; see §4).
- `dragging` (client-only): `data-dragging="true"` set by the enhancer during a drag; suppresses pointer-events on sibling pills.
- `multi-day span`: a pill that spans multiple cells uses `data-span-start="true"` / `data-span-end="true"` / `data-span-mid="true"` CSS hooks; the template renders a pill into EVERY cell of the span and marks its position.

**Sizes** (via `@Wire @LievitProperty(locked=true) String size`):
- `compact` (sm): condensed row height (`--lv-calendar-row-sm`), up to 2 events per cell then "+N more" overflow link; intended for dashboard widgets.
- `default` (md): standard row height (`--lv-calendar-row-md`), up to 3 events per cell before overflow.
- `comfortable` (lg): expanded row height (`--lv-calendar-row-lg`), up to 5 events before overflow.

**`+N more` overflow** (server-rendered link):
When `eventsForDate(date).size() > maxVisible`, the template renders a `<button data-slot="overflow-link" data-date="<escaped>" l:click="openEvent('more-<date>')">`+N more`</button>` that opens a popover listing the full event set for that date. The overflow popover composes the `popover` PARTIAL (the seam). The threshold `maxVisible` is derived from `size` and is a `@LievitProperty(locked=true)` override.

## 4. The a11y contract (the heart)

**WAI-ARIA pattern**: APG Grid pattern (https://www.w3.org/WAI/ARIA/apg/patterns/grid/) +
APG Date Picker Dialog calendar grid keyboard map (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
— BUILT against raw APG. The month grid is a `role="grid"` with `role="row"` rows and
`role="gridcell"` day cells. Navigation uses the ROVING TABINDEX model (not `aria-activedescendant`)
because each day cell is a real focusable container (it holds event pills), so DOM focus must land
IN the cell (the APG Date Picker calendar grid precedent).

**roles + ARIA**:

| element | role / ARIA | meaning |
|---|---|---|
| grid container `<table>` / `<div>` | `role="grid"` `aria-label="<Month YYYY>"` `aria-labelledby="<headingId>"` | the calendar grid; labelled by the month heading |
| header row `<tr>` | `role="row"` | the day-name header row |
| day-name cell `<th>` | `role="columnheader"` `abbr="<full day name>"` | Mon–Sun (or Su–Sa); `abbr` gives AT the full name |
| week row `<tr>` | `role="row"` | one week; if `showWeekNumbers`, first cell is a `role="rowheader"` |
| week-number cell | `role="rowheader"` `aria-label="Week <N>"` | the ISO/locale week number |
| day cell `<td>` | `role="gridcell"` `aria-label="<Day name, Month D, YYYY>"` `tabindex="0"` (selected) / `"-1"` (others) `aria-selected="true/false"` `aria-current="date"` (today only) `aria-disabled="true"` (disabled) | one day; the roving tabindex cell; a11y name includes the full date so AT announces it without needing the column header |
| event pill `<button>` | `role="button"` `aria-label="<title>, <start>–<end>"` `tabindex="-1"` | the event pill; focusable only via Tab while the parent cell holds focus; fires `openEvent` |
| +N more link | `<button>` `aria-label="<N> more events on <date>"` | overflow trigger; composes the popover seam |
| toolbar `<div>` | `role="toolbar"` `aria-label="Calendar navigation"` | prev/next/today buttons; NOT part of the grid's roving scope |
| prev/next/today `<button>` | native `<button>` | platform keyboard (Enter/Space); no roving, standard tab order |
| month heading `<h2 id="<headingId>">` | — | the `aria-labelledby` target for the grid |
| event detail popover | `role="dialog"` (if `closable`; see §6) | composes the popover seam + focus-trap |

**keyboard map** (the load-bearing table — `calendar-grid.enhancer.ts` owns all non-platform keys
within the grid; the toolbar buttons are plain platform `<button>` elements):

| key | context | does | who |
|---|---|---|---|
| Right Arrow | focus on a day cell | moves focus to the next day; if last day of month row, continues to next week's first cell; does NOT wrap to next month | enhancer (roving tabindex) |
| Left Arrow | focus on a day cell | moves focus to the previous day; does NOT wrap to prev month | enhancer |
| Down Arrow | focus on a day cell | moves focus to the same weekday in the next week (one row down); if in the last week, does not move | enhancer |
| Up Arrow | focus on a day cell | moves focus to the same weekday in the previous week (one row up); if in the first week, does not move | enhancer |
| Home | focus on a day cell | moves focus to the first day of the current week row (Sunday or Monday per `firstDayOfWeek`) | enhancer |
| End | focus on a day cell | moves focus to the last day of the current week row | enhancer |
| Page Down | focus on a day cell | fires `nextMonth()` wire action; after morph, focus lands on the same day number (or last day of new month if the month is shorter) | enhancer → wire |
| Page Up | focus on a day cell | fires `prevMonth()` wire action; same day-number focus recovery | enhancer → wire |
| Shift + Page Down | focus on a day cell | fires `nextMonth()` twelve times (jump to same month next year) | enhancer → wire (12× batched or a dedicated `nextYear()` action) |
| Shift + Page Up | focus on a day cell | fires `prevMonth()` twelve times (same month prev year) | enhancer → wire |
| Enter / Space | focus on a day cell | fires `selectDate(focusedDate)` wire action; if the cell has one event, also opens it | enhancer → wire |
| Tab | focus on a day cell | moves focus to the first event pill WITHIN the cell (if any), then to the toolbar, then out of the calendar | enhancer (modifies tabindex on pills dynamically) |
| Shift + Tab | focus on an event pill | returns focus to the parent day cell | enhancer |
| Enter / Space | focus on an event pill | fires `openEvent(eventId)` wire action → opens the event detail popover | platform (native `<button>`) |
| Tab | focus on the last event pill in a cell | exits the cell: moves focus to the toolbar | platform + enhancer resets tabindexes |
| Escape | focus anywhere in the grid | if an event detail popover is open, closes it (fires `closeEvent()`); otherwise inert | enhancer (reads `activeEventId`) |
| T | focus on a day cell | fires `goToToday()` (a common calendar shortcut; optional, adopter can suppress via a locked property `enableKeyboardShortcuts`) | enhancer → wire |

**Drag keyboard fallback** (for `readonly=false` grids; the drag is pointer-primary but must have a
keyboard path to avoid WCAG 2.5.7 failure):

| key | context | does | who |
|---|---|---|---|
| Enter / Space | focus on an event pill + drag mode announced | opens a "Move event" mini-dialog (a popover with date input); adopter supplies the dialog body | enhancer fires `createEvent` hook; adopter wires the dialog |

The drag keyboard fallback is intentionally minimal: the full drag UX is pointer-driven (mouse +
touch). Keyboard users get a date-input dialog as the accessible path. This matches the APG
recommendation that drag-and-drop operations provide an alternative interaction for non-pointer users.

**Focus management**:
- **Initial focus**: when the calendar mounts, `selectedDate` defaults to today (or the first day of
  `focusedMonth` if today is not in the focused month). The day cell for `selectedDate` has
  `tabindex="0"`; all others have `tabindex="-1"`. Tab into the calendar lands on `selectedDate`.
- **Roving tabindex within the grid**: the enhancer updates `tabindex` on every arrow-key move — the
  newly focused cell gets `tabindex="0"`, the previous one gets `tabindex="-1"`. No `aria-activedescendant`
  (roving is the right model here because the cells contain interactive children — event pills —
  and `aria-activedescendant` cannot manage focus INTO child buttons).
- **Event pill sub-focus**: when the focused cell has pills, Tab moves focus INTO the first pill
  (`tabindex="0"` on it); subsequent Tabs cycle through the pills in that cell; the last Tab exits
  to the toolbar. Shift+Tab from the first pill returns to the cell. This is the APG grid
  "widget in a cell" keyboard pattern.
- **After a wire round-trip (month navigation)**: the morph fires, then the enhancer reads the new
  `data-selected` cell from the DOM and restores focus to it. The morph's identity-preserving
  behavior handles scroll; the enhancer handles focus recovery via the lifecycle `onComponentInit` hook.
- **Event detail popover**: composes the `popover` PARTIAL + optionally `focus-trap.enhancer.ts`
  if the event detail is modal (an adopter config). When the popover closes, focus returns to the
  event pill that opened it (the focus-trap enhancer records the opener, or the enhancer does it
  manually on `closeEvent()`).
- **No focus trap in the grid itself**: the month grid is NOT modal. Tab exits normally to the
  browser's tab order after cycling through the toolbar.

**Live region**:
- When month navigation fires, an `aria-live="polite"` region (inside the toolbar, outside the grid)
  announces the new month heading: `"<Month YYYY>"`. This lets AT users confirm the month changed
  without the full grid re-read.
- When a drag-move or drag-resize completes, the live region announces: `"<Title> moved to <new date>"` /
  `"<Title> extended to <new end date>"`.
- The live region is a `<div role="status" aria-live="polite" aria-atomic="true">` rendered
  server-side; the enhancer writes into it after a successful wire round-trip (the morph does not
  reset it because the element is outside the grid subtree; the enhancer finds it by `data-slot="live-region"`).

**Shared mechanisms composed**:
- `calendar-grid.enhancer.ts` (this component's OWN enhancer — the roving-tabindex + drag engine;
  it is NOT the shared `collection-nav` because the navigation model is 2-D grid, not a 1-D list).
- The `popover` seam (for the event detail popover + the +N more overflow popover).
- `focus-trap.enhancer.ts` (only when the event detail popover is configured as modal by the adopter;
  non-modal popovers use the seam's light-dismiss without a trap).
- The live-region announcer (shared, the same `role=status` mechanism as the toast + form error summary).

## 5. Tokens

**Reads** (existing token set):

| token | usage |
|---|---|
| `--lv-color-bg` | grid background |
| `--lv-color-popover` | day cell background (inside the grid border) |
| `--lv-color-border` | cell dividing lines, grid outer border |
| `--lv-color-fg` | day numbers, event titles |
| `--lv-color-muted` | overflow day numbers (adjacent-month days) |
| `--lv-color-accent` | today ring, selected-day highlight fill |
| `--lv-color-accent-fg` | today day-number label (on accent fill) |
| `--lv-color-primary` | default event pill background |
| `--lv-color-primary-fg` | default event pill text |
| `--lv-color-secondary`, `--lv-color-secondary-fg` | secondary-intent event pill |
| `--lv-color-success`, `--lv-color-success-fg` | success-intent event pill |
| `--lv-color-warning`, `--lv-color-warning-fg` | warning-intent event pill |
| `--lv-color-destructive`, `--lv-color-destructive-fg` | destructive-intent event pill |
| `--lv-color-overlay` | drag ghost / scrim behind overflow popover |
| `--lv-space-1` … `--lv-space-4` | cell padding, pill padding |
| `--lv-space-8`, `--lv-space-9`, `--lv-space-10` | toolbar button heights (aligns with other controls) |
| `--lv-radius-sm` | event pill corner radius |
| `--lv-radius-md` | day cell corner radius (today highlight) |
| `--lv-radius-lg` | grid outer corner radius |
| `--lv-text-xs`, `--lv-text-sm` | event pill text, day number text |
| `--lv-text-base` | month heading text |
| `--lv-font-sans` | all grid text |
| `--lv-shadow-xs` | event pill subtle elevation |
| `--lv-shadow-md` | drag ghost elevation |
| `--lv-ring` | focus-visible ring on focused day cell + event pill |
| `--lv-z-popover` | overflow + event detail popover z-index |
| `--lv-motion-fast` | today highlight pulse (optional, respects `prefers-reduced-motion`) |

**NET-NEW tokens** (additive, proposed; justified by the 2-D grid geometry which has no existing
analogues in the button/input/popover token set):

| token | value (OKLCH, :root) | dark override | justification |
|---|---|---|---|
| `--lv-calendar-row-sm` | `5rem` (80px) | same | day-cell min-height for compact size; structural, not a colour |
| `--lv-calendar-row-md` | `7rem` (112px) | same | day-cell min-height for default size |
| `--lv-calendar-row-lg` | `9rem` (144px) | same | day-cell min-height for comfortable size |
| `--lv-color-calendar-today-bg` | `oklch(0.94 0.04 250)` | `oklch(0.30 0.06 250)` | today cell fill — a tinted surface distinct from `--lv-color-accent` (accent is for selections, not the "today" marker) |
| `--lv-color-calendar-overflow` | `oklch(0.60 0.00 0)` | `oklch(0.50 0.00 0)` | adjacent-month day number; dimmer than muted to visually recede |
| `--lv-color-drag-over` | `oklch(0.92 0.05 250)` | `oklch(0.28 0.06 250)` | drag-drop target cell highlight; a tinted surface the drag ghost is visually dropping INTO |

All NET-NEW tokens are structural (row heights) or derived from the primary palette (the OKLCH
lightness/chroma are computed offsets from `--lv-color-accent`). They do NOT widen the rebrand
surface: an adopter who overrides `--lv-color-accent` gets coherent today/drag-over tints
automatically if they also override these derived values. The calendar row heights are adopter-
configurable via the locked `size` property; the tokens are the defaults.

## 6. Wire actions + enhancer wiring

**l:* directives bound in the template**:

| directive | on element | fires | meaning |
|---|---|---|---|
| `l:click="prevMonth"` | prev button | `prevMonth()` | navigate to previous month |
| `l:click="nextMonth"` | next button | `nextMonth()` | navigate to next month |
| `l:click="goToToday"` | today button | `goToToday()` | jump to current month |
| `l:click="selectDate" data-date="<escaped ISO>"` | day cell (via the SAFE `data-date` channel) | `selectDate(LocalDate)` | select a date; date arrives as `data-date` on the element, read by the enhancer or the server handler |
| `l:click="openEvent" data-event-id="<escaped>"` | event pill `<button>` | `openEvent(String)` | open the event detail popover |
| `l:click="closeEvent"` | close button inside event detail popover | `closeEvent()` | close the popover |

**SAFE escaping** for per-row data: `data-date` (an ISO date string, injected into the SAFE
`dataAttrs` channel via `Escape.htmlAttribute`) and `data-event-id` (same channel) are NEVER
fed through `attrs` (trusted-raw). An adversarially crafted event id with `">` inside renders
inert because the value is HTML-attribute-escaped before emission. This is the same XSS rule
as the `button.jte` `wireArgs` channel.

**Server-side action signatures** (validation before state mutation):

```
// validation happens in the action body, BEFORE @Wire fields are touched
public void selectDate(String rawDate) {
    LocalDate date = LocalDate.parse(rawDate);      // parse first
    if (isDisabled(date)) return;                   // guard against out-of-bounds
    this.selectedDate = date;
    if (!date.getMonth().equals(focusedMonth.getMonth())) {
        this.focusedMonth = YearMonth.from(date);   // follow the date to its month
    }
}

public void moveEvent(String rawEventId, String rawNewStart) {
    if (readonly) return;                           // authz guard first
    LocalDate newStart = LocalDate.parse(rawNewStart);
    if (!events.stream().anyMatch(e -> e.id().equals(rawEventId))) return; // id must be in the locked set
    if (isDisabled(newStart)) return;
    // delegate to adopter hook: onMoveEvent(rawEventId, newStart)
}

public void resizeEvent(String rawEventId, String rawNewEnd) {
    if (readonly) return;
    // same guard pattern; adopter hook: onResizeEvent(rawEventId, rawNewEnd)
}
```

**Round-trip map**:

| user action | directive fires | server action | re-renders | morph result |
|---|---|---|---|---|
| click prev-month | `l:click="prevMonth"` | `prevMonth()` mutates `focusedMonth` | full calendar grid | new month's days + events; enhancer restores focus to same-day-number cell |
| click next-month | `l:click="nextMonth"` | `nextMonth()` | full grid | same |
| arrow key (grid) | enhancer fires wire only on Page Up/Down; arrow nav is client-only tabindex update | `prevMonth()` / `nextMonth()` (Page Up/Down only) | full grid or nothing | full re-render on month-change; purely-client tabindex update otherwise (no round-trip) |
| Page Down (in grid) | enhancer calls `$lievit.call('nextMonth', {})` | `nextMonth()` | full grid | focus recovery |
| click day cell | `l:click="selectDate" data-date="..."` | `selectDate(date)` mutates `selectedDate` | full grid (selectedDate reflected in ARIA) | cell gets `aria-selected aria-selected="true"` + `tabindex="0"` |
| click event pill | `l:click="openEvent" data-event-id="..."` | `openEvent(id)` mutates `activeEventId` | full grid (popover subtree appears) | event detail popover appears; enhancer calls `focus-trap` if modal |
| drag-end (drop on cell) | enhancer calls `$lievit.call('moveEvent', {eventId, newStart})` | `moveEvent(id, date)` | full grid | event pill appears on new date; live region announces |
| drag-end (resize handle) | enhancer calls `$lievit.call('resizeEvent', {eventId, newEnd})` | `resizeEvent(id, date)` | full grid | event pill resized; live region announces |
| escape (popover open) | enhancer fires `l:click="closeEvent"` equivalent | `closeEvent()` sets `activeEventId=null` | full grid (popover gone) | focus returns to opener pill |

**Enhancer responsibilities** (`calendar-grid.enhancer.ts`):
1. **Mount** (`onComponentInit` lifecycle): read `data-selected` cell, set `tabindex="0"` on it; set
   `tabindex="-1"` on all others. Register `keydown` on the grid element.
2. **Arrow nav** (`keydown` on the grid): compute the new target cell by grid position arithmetic
   (row ± 1, col ± 1 within bounds); update tabindexes; call `element.focus()` on the target.
   Page Up/Down additionally fire the wire action (then the enhancer reads the new DOM after morph).
3. **Tab within a cell**: when `Tab` fires on a focused day cell that has pill children, re-tabindex
   the first pill to `0` and focus it. When `Tab` fires on the last pill, reset all pill tabindexes
   to `-1`, move focus to the first toolbar button (find via `data-slot="toolbar"`).
4. **Drag engine**: attach `pointerdown` to event pills (via event delegation on the grid root).
   On drag start: clone the pill as a ghost (`data-dragging="true"`), suppress native drag.
   On pointermove: translate the ghost, hit-test cells, set `data-drag-over="true"` on the hovered
   cell. On pointerup: read the drop target's `data-date`, call `$lievit.call('moveEvent', ...)`.
   Resize: `pointerdown` on the resize handle (a `data-slot="resize-handle"` child of each pill);
   same drag engine, reads `data-date` of the drop cell for `newEnd`.
5. **Touch long-press**: `pointerdown` + 500ms timer on a day cell (no move) → calls
   `$lievit.call('createEvent', {date: cell.dataset.date})`.
6. **Live region write**: after any successful wire round-trip that changes `activeEventId` to null
   (i.e. a move or resize just completed), write the announcement string to the `data-slot="live-region"` element.
7. **Focus after morph**: after `$lievit.call(...)` resolves, re-scan the new DOM for `data-selected` and call `focus()`.

The enhancer registers via the directive `data-lievit-enhancer="calendar-grid"` on the grid root,
installed by the runtime's lifecycle registry on component init. It does NOT edit the runtime core
(ADR-0019: registry IS the API).

## 7. Acceptance tests

Each test runs on a REAL substrate (no mocked `$lievit`; the client-island-fidelity rule from the
gest CLAUDE.md). The calendar is the hardest component in the S2 tier; the acceptance gate is correspondingly thorough.

**Render tests** (real `LievitRuntime` + jsdom, `REAL calendar-grid.enhancer.ts` mounted):

- `calendar_renders_grid_with_correct_role_hierarchy`: mount a CalendarComponent for July 2026;
  assert the DOM has `role="grid"`, one `role="row"` per week (5-6 rows), one `role="columnheader"`
  per day-name cell, one `role="gridcell"` per day cell (7 per row). Total cell count = rows × 7.
- `calendar_marks_today_with_aria_current_date`: mount for the current month; assert exactly one
  `gridcell` has `aria-current="date"`.
- `calendar_marks_selected_date_with_tabindex_zero`: mount; assert exactly one `gridcell` has
  `tabindex="0"` and `aria-selected="true"`; all others have `tabindex="-1"`.
- `calendar_renders_events_as_buttons_within_cells`: mount with 3 events on different dates;
  assert each event's cell contains a `<button>` with `aria-label` containing the event title.
- `calendar_renders_overflow_link_when_events_exceed_max_visible`: mount with 5 events on one
  date, size=md (maxVisible=3); assert a `<button data-slot="overflow-link">` with `aria-label`
  contains "2 more events" exists on that cell.
- `calendar_dims_overflow_days_from_adjacent_months`: mount for a month where the first row
  includes days from the prior month; assert those cells have `data-overflow="true"`.
- `calendar_disables_cells_outside_bounds`: mount with `minDate=2026-07-10`, `maxDate=2026-07-20`;
  assert cells for July 9 and July 21 have `aria-disabled="true"`.
- `calendar_shows_week_numbers_when_configured`: mount with `showWeekNumbers=true`; assert each
  week row has a `role="rowheader"` cell with `aria-label` matching "Week \d+".

**Axe-core assertion**:
- `calendar_passes_axe_core_on_rendered_month_grid`: mount a fully populated CalendarComponent (today
  in focus, 5 events across 3 days, week numbers on); run axe-core; assert zero violations of rules:
  `aria-required-children`, `aria-required-parent`, `aria-roles`, `aria-valid-attr-value`,
  `scrollable-region-focusable`, `button-name`, `color-contrast` (verifies event pill text meets
  WCAG 4.5:1 on the pill background tokens).

**Keyboard tests** (real `LievitRuntime` + jsdom, enhancer mounted, keyboard events dispatched via `KeyboardEvent`):

- `calendar_arrow_right_moves_focus_to_next_day`: focus July 1; dispatch ArrowRight; assert July 2
  cell has `tabindex="0"` and received focus.
- `calendar_arrow_left_moves_focus_to_previous_day`: focus July 2; ArrowLeft; assert July 1 focused.
- `calendar_arrow_down_moves_focus_one_week_forward`: focus July 1 (Wednesday); ArrowDown; assert
  July 8 (next Wednesday) has focus.
- `calendar_arrow_up_moves_focus_one_week_back`: focus July 8; ArrowUp; assert July 1 focused.
- `calendar_home_moves_to_first_day_of_week`: focus July 2 (Thursday, firstDayOfWeek=Monday);
  Home; assert June 30 (the Monday of that week row) has focus.
- `calendar_end_moves_to_last_day_of_week`: focus July 2; End; assert July 6 (Sunday) has focus.
- `calendar_arrow_right_does_not_wrap_at_last_day_of_row`: focus July 6 (last in week row);
  ArrowRight; assert July 7 (first cell of next row) has focus (intra-grid wrap IS allowed — the APG
  grid allows same-column continuation to next row even if wrap-across-months is not; only month-crossing
  is blocked: ArrowRight on July 31 stays on July 31).
- `calendar_arrow_keys_do_not_cross_month_boundary`: focus July 31; ArrowRight; assert July 31 still
  has `tabindex="0"` (focus did not move). Focus July 1; ArrowLeft; assert July 1 unchanged.
- `calendar_page_down_fires_next_month_action_and_recovers_focus`: focus July 15; PageDown; assert
  `nextMonth()` was called (spy on `$lievit.call`); after mock-morph, assert the cell for Aug 15 has
  focus (focus recovery).
- `calendar_page_up_fires_prev_month_action_and_recovers_focus`: focus July 15; PageUp; assert
  `prevMonth()` called; after morph, June 15 focused.
- `calendar_shift_page_down_jumps_to_same_month_next_year`: focus July 15, 2026; Shift+PageDown;
  assert `nextMonth()` was called 12 times (or `nextYear()` if that action is implemented as a batch).
- `calendar_enter_on_day_cell_fires_select_date`: focus July 10; Enter; assert `selectDate` was called
  with `2026-07-10`; after morph, assert July 10 cell has `aria-selected="true"`.
- `calendar_space_on_day_cell_fires_select_date`: same as above with Space.
- `calendar_tab_from_cell_with_events_enters_first_pill`: focus a cell that has 2 event pills; Tab;
  assert the first pill `<button>` has `tabindex="0"` and DOM focus.
- `calendar_shift_tab_from_first_pill_returns_to_cell`: focus first pill; Shift+Tab; assert the
  parent `gridcell` has focus.
- `calendar_enter_on_pill_fires_open_event`: focus an event pill; Enter; assert `openEvent(id)` was
  called with the correct event id.
- `calendar_escape_closes_open_event_popover`: mount with `activeEventId="evt-1"` (popover open);
  Escape; assert `closeEvent()` was called; after morph assert `activeEventId=null`.
- `calendar_t_key_fires_go_to_today`: focus a day cell; press T; assert `goToToday()` was called.
- `calendar_keyboard_nav_skips_disabled_cells`: mount with minDate=July 10; focus July 9
  (ArrowLeft from July 10 should not land on an out-of-bounds date — assert focus stays on July 10).

**Focus tests**:

- `calendar_initial_focus_lands_on_selected_date_cell`: mount; Tab into the grid; assert the cell for
  `selectedDate` (today) receives focus.
- `calendar_focus_is_inside_grid_on_tab_in`: Tab into a calendar with no prior focus; assert a
  `gridcell` element (not a toolbar button) receives focus first.
- `calendar_focus_returns_to_pill_after_event_detail_closes`: open an event detail (click a pill →
  `openEvent`); close via Escape; assert the event pill button that opened the popover has DOM focus.
- `calendar_live_region_announces_month_change`: navigate to next month; assert the `[data-slot="live-region"]`
  text content equals the new month heading string (e.g. "August 2026").
- `calendar_live_region_announces_move_event`: drag-move completion; assert the live region text
  contains the event title + new date.

**Wire round-trip ITs** (lievit-kit, real LievitRuntime, `CalendarComponentIT` pattern):

- `calendar_it_next_month_rerenders_with_august_days`: mount July 2026; call `nextMonth()`; assert
  the re-rendered HTML contains `aria-label="August 2026"` on the grid and `role="gridcell"` cells
  for August dates.
- `calendar_it_select_date_updates_aria_selected`: mount; call `selectDate(LocalDate.of(2026, 7, 15))`;
  assert the re-render has `aria-selected="true"` on the July-15 cell only.
- `calendar_it_open_event_renders_popover_body`: mount with events; call `openEvent(events.get(0).id())`;
  assert the re-render contains the event detail popover with the event title visible in the DOM.
- `calendar_it_move_event_moves_pill_to_new_date`: mount with an event on July 10; call
  `moveEvent(id, LocalDate.of(2026, 7, 17))`; assert the re-render has the pill in July 17's cell,
  not July 10.
- `calendar_it_readonly_blocks_move`: mount with `readonly=true`; call `moveEvent(...)`; assert the
  event did not move (server guard honored).
- `calendar_it_disabled_date_rejects_select`: call `selectDate(LocalDate.of(2026, 7, 5))` when
  minDate=July 10; assert `selectedDate` is unchanged.

**Drag tests** (Playwright, real gesture, legacy-VM oracle):

- `calendar_drag_move_event_to_new_date`: `page.mouse.down()` on an event pill; move to a different
  day cell; `page.mouse.up()`; assert the event pill appears in the target cell's DOM (server
  re-rendered); assert source cell no longer has the pill.
- `calendar_drag_over_highlights_target_cell`: during drag-move (after `pointerdown`, before `pointerup`),
  assert the hovered cell has `data-drag-over="true"` in the live DOM.
- `calendar_drag_resize_extends_event_end`: drag the resize handle of a multi-day event; assert
  the event end date changed on re-render.
- `calendar_keyboard_fallback_opens_move_dialog_on_enter`: focus an event pill; Enter (no drag);
  assert a move-dialog appears (the keyboard fallback for WCAG 2.5.7).

**Escaping** (XSS abuse case):
- `calendar_hostile_event_id_renders_inert`: mount with an event whose `id = '"><script>alert(1)</script>'`;
  assert the rendered `data-event-id` attribute value is HTML-escaped and no script tag appears in
  the DOM. The SAFE `dataAttrs` channel guarantees this; the test verifies it.

**JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate (the same
gate that already covers all 68 templates; calendar.jte is added to the set).

## 8. Non-goals / anti-patterns

- **Week-view and day-view are OUT of this spec.** They share the same `CalendarComponent` Java class
  and `events` wire field, but their template structure is substantially different (time-grid rows,
  hour cells, multi-day stripe). They are separate specs, built after the month-grid proves the wire
  pattern.
- **No Lit island.** `ht-calendar` in gest is a Lit component. This spec replaces it with a
  server-rendered WIRE. Do not re-introduce Lit, Alpine, or any framework (ADR-0012, D12 in the
  inventory, the `calendar realignment on local branch` memory). The typed-TS enhancer is the ONLY
  client addition.
- **No virtualization for event density.** The month grid renders all events for the month server-
  side. If a date has 1000 events, the server renders them (with the overflow "+N more" truncation).
  Virtualized event rendering is a data-grid concern (separate component, S2 data-grid spec).
- **No recurring-event expansion in the component.** Recurring event expansion (RRULE → concrete
  occurrences) is the adopter's responsibility in the controller, before the event set is passed as
  `List<CalendarEvent>`. The component receives only concrete, already-expanded occurrences.
- **No internal event CRUD forms.** The component fires `createEvent(date)` and the adopter wires
  the create form (typically a `dialog` or `drawer` wired in the parent WIRE component). Inline
  event creation is out of scope.
- **No timezone handling in the component.** The component works in `LocalDate` (date-only, no time
  component, no timezone offset). The adopter converts from `ZonedDateTime` before constructing
  `CalendarEvent`. Time-of-day display is for week/day view specs.
- **No drag-and-drop between different calendar instances.** Drag is scoped to the single calendar
  grid; cross-calendar drag is an adopter composition concern.
- **Do not hand-roll focus trapping.** The event detail popover, if modal, MUST compose
  `focus-trap.enhancer.ts` — the single-source rule (architecture contract §2.b). A bespoke trap in
  this component is a hard anti-pattern: drawer/sheet/dialog depend on the SAME enhancer being correct.
- **Do not use `aria-activedescendant` for cell navigation.** The calendar grid uses roving-tabindex
  (real DOM focus moves into each cell) because cells contain interactive children (event pills). The
  `aria-activedescendant` model (used in `select` / `collection-nav`) places focus on the container,
  not the cell, and cannot reach the pill buttons via Tab. Use the CORRECT model for the pattern.
- **Do not store drag state server-side.** A `dragging: boolean` `@Wire` field would trigger a round-
  trip on every `pointermove`, killing the UX. The dragging state is EPHEMERAL client state, owned
  entirely by the enhancer (`data-dragging` / `data-drag-over` attributes written and cleaned up by JS,
  never sent to the server). Only the FINAL drop result (`moveEvent` / `resizeEvent`) goes to the
  server. This is the correct split: ephemeral view state belongs on the client, domain state belongs
  on the server.
- **Do not call the enhancer "calendar.enhancer.ts".** The canonical name is `calendar-grid.enhancer.ts`
  to distinguish it from hypothetical future enhancers for week/day grid views and to communicate its
  2-D-grid-nav scope.
