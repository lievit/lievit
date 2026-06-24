<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — input-otp

- **tier**: WIRE + ENH (`input-otp.enhancer.ts`, the existing enhancer re-specified)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of existing `input-otp` enhancer + WIRE shell)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Spinbutton pattern (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/) +
      APG Spinbutton example "Date Picker Spin Buttons"
      (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/) used as the
      canonical `role="group"` + per-slot `role="spinbutton"` model; keyboard interaction BUILT against
      raw APG (no react-aria reference — react-aria has no `useOTP` hook); the APG has no dedicated OTP
      pattern so this is a BUILT implementation that applies the spinbutton + group composition to a
      fixed-length digit/alphanumeric token entry (the `03-component-inventory.md` designation: "APG
      BUILT: segmented, auto-advance, paste")
    - inventory: no Ant Design equivalent (AD has no OTP component); shadcn `InputOTP` used as
      inventory reference for the variant/length surface; the real-world OTP UX contract (auto-advance,
      paste-split, backspace-retreat, mask mode) derives from common practice, not from a single source
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      (NO code copied)

## 1. What it is

A fixed-length one-time-password / PIN entry field: a horizontal row of N individual digit slots
(each a single-character `<input type="text" inputmode="numeric|text">`) enclosed in a
`role="group"` container, where completing the N-th slot fires a wire action with the assembled
token.
The assembled VALUE is a server fact (`@Wire String value`), so this is WIRE: the server holds the
composed token, validates it, and re-renders the group with an error state when invalid.
The irreducible CLIENT behaviors — auto-advance to the next slot on valid input, backspace-retreat
to the previous slot, paste-split across slots, slot validation (digit-only / alphanumeric),
mask toggling (password-style obscuring), and firing the wire completion action — are the
`input-otp.enhancer.ts`, NOT a hand-roll per-consumer.
Server-first works here because the slot group is stateless from the server's perspective until
completion: the server renders N empty (or pre-filled) `<input>` slots, the enhancer drives all
intra-slot navigation client-side with zero round-trips, and fires ONE wire action on completion
(or on explicit submit in the non-autosubmit variant).
The component is NOT a `<input type="password" autocomplete="one-time-code">` fallback — that is
a separate, simpler PARTIAL (`native-otp`); this rich segmented variant earns its complexity
where the UX requires a visible per-digit slot (2FA TOTP flows, PIN entry, invite-code redemption).

## 2. API — the WIRE surface + template params

**Java (`InputOtpComponent`)**:

| member | kind | meaning |
|---|---|---|
| `value` `String` | `@Wire` | the assembled token (concatenation of all slot values); empty string = not yet complete |
| `length` `int` | `@Wire @LievitProperty(locked=true)` | number of slots (the N); immutable after mount; must be 1–12; default 6 |
| `mode` `String` | `@Wire @LievitProperty(locked=true)` | `"numeric"` (digits 0–9 only) \| `"alphanumeric"` (A-Z 0-9, case-normalised to uppercase) \| `"any"` (any printable char); governs `inputmode` + client-side rejection of invalid chars; default `"numeric"` |
| `masked` `boolean` | `@Wire` | when `true`, renders slots as password-type (chars are dots); toggleable at runtime via the mask toggle action |
| `disabled` `boolean` | `@Wire @LievitProperty(locked=true)` | all slots inert; locked — set at mount time from a server condition (e.g. already-verified) |
| `autoSubmit` `boolean` | `@Wire @LievitProperty(locked=true)` | when `true`, fires `complete(value)` automatically on N-th character entry; when `false`, user must press Enter or click a submit button; default `true` |
| `groupLabel` `String` | `@Wire @LievitProperty(locked=true)` | accessible name for the `role="group"` container (e.g. "Two-factor authentication code"); surfaced as `aria-label` on the group; REQUIRED (no default; a missing label is an a11y violation) |
| `slotLabel` `String` | `@Wire @LievitProperty(locked=true)` | template for individual slot `aria-label` values: `"Digit {n} of {total}"` by default; `{n}` and `{total}` are substituted at render time (server-side) |
| `errorMessage` `String` | `@Wire` | non-blank = the component is in error state; rendered in an associated `role="alert"` region; `aria-invalid` is set on all slots |
| `complete(String token)` | `@LievitAction` | called by the enhancer on completion (autoSubmit) or by the consumer's submit button; validates token format + business logic in Java BEFORE mutating `value`; sets `errorMessage` on failure |
| `toggleMask()` | `@LievitAction` | flips `masked`; only meaningful when the template renders a mask toggle button (optional) |
| `reset()` | `@LievitAction` | clears `value` + `errorMessage`, re-renders all slots empty; focus returns to slot 1 |

**Derived read-only view** (used by the template, not `@Wire` state):

| member | kind | meaning |
|---|---|---|
| `slots()` `List<SlotModel>` | getter on `_instance` (`@LievitProperty(serialize=false)`) | per-slot data: `index` (0-based), `position` (1-based, for labels), `slotId` (stable HTML id = `<cid>-slot-<index>`), `value` (single char or empty), `inputType` (`"text"` when `!masked`, `"password"` when `masked`), `inputmode` (derived from `mode`) |
| `isComplete()` `boolean` | getter on `_instance` | `value.length() == length` and no blank slot |
| `hasError()` `boolean` | getter on `_instance` | `errorMessage != null && !errorMessage.isBlank()` |
| `errorId()` `String` | getter on `_instance` | `<cid>-error` — stable id for `aria-describedby` wiring |

**Template params**: `@param ComponentMetadata _component`, `@param InputOtpComponent _instance`.
No `Content` slot (WIRE has none; the slot inputs are OWNED markup derived from `_instance.slots()`).

## 3. Variants / sizes / states

**Sizes** (height-based, toolbar-aligned):

| size | slot height | slot width | font | class token |
|---|---|---|---|---|
| `sm` | `--lv-space-8` (32px) | `--lv-space-8` | `--lv-text-sm` | `data-size="sm"` |
| `md` | `--lv-space-9` (36px, default) | `--lv-space-9` | `--lv-text-base` | `data-size="md"` |
| `lg` | `--lv-space-10` (40px) | `--lv-space-10` | `--lv-text-lg` | `data-size="lg"` |

Slots are square (width = height) to align digit-columns cleanly.
A group of 6 `md` slots sits flush in a toolbar with a `button` of size `md`.

**Separators** (visual grouping, no semantic weight):
An optional separator character (e.g. `–` or a space) can be rendered between specific slot
positions, declared as a `separatorAfter` `List<Integer>` locked property (e.g. `[3]` for a
6-digit code split `123–456`).
Separators are `<span aria-hidden="true">` — they carry no ARIA meaning and are excluded from
the tab order.

**States**:

| state | how expressed |
|---|---|
| default (empty) | slot border `--lv-color-border`; placeholder char (e.g. `○`) via CSS `::placeholder` |
| focused (active slot) | `--lv-ring` focus ring on the active slot input; border `--lv-color-primary` |
| filled (a slot with a value) | border `--lv-color-border`; char visible (or dot if `masked`) |
| complete (all slots filled) | no separate visual; the wire action fires / the error region updates |
| error | all slot borders → `--lv-color-destructive`; `aria-invalid="true"` on each slot; error message in `role="alert"` below the group |
| disabled | all slot borders → `--lv-color-muted`; `cursor-not-allowed`; `disabled` attr on each `<input>`; `aria-disabled` on the group |
| masked | `type="password"` on each slot input; the mask-toggle button (if rendered) shows the "show" icon |

**No `variant` param**: OTP entry has one purpose and one visual intent; the error recolouring
is covered by the `errorMessage` + `aria-invalid` state path, which maps to the shared
destructive token pair. Adding a `variant` param here would be gratuitous.

## 4. The a11y contract (the heart)

- **WAI-ARIA pattern**: APG Spinbutton, applied as a group of per-slot spinbuttons within a
  `role="group"` container. This is a BUILT implementation (APG has no dedicated OTP pattern).
  The closest APG precedent is the "Date Picker Spin Buttons" example
  (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/), which
  wraps multiple `role="spinbutton"` elements in a `role="group"` with a shared `aria-labelledby`.
  The OTP component applies the same structural model to N fixed-position digit slots, substituting
  the spin increment/decrement semantics with single-character direct entry and auto-advance.

- **roles + ARIA**:
  - group container: `role="group" aria-label="${_instance.groupLabel()}"` (or `aria-labelledby`
    pointing to a visible heading when one is present in the parent layout); the group receives
    `aria-describedby="${_instance.errorId()}"` when `hasError()` is true so screen readers
    surface the error without the user navigating to the alert region.
  - each slot input: `role="spinbutton"` on the `<input>` element; `aria-valuenow` = the slot's
    numeric value (0–9 in numeric mode; omitted in alphanumeric/any mode where `aria-valuetext`
    carries the meaning); `aria-valuemin="0" aria-valuemax="9"` (numeric mode only);
    `aria-valuetext` = the char value if filled, `"blank"` if empty; `aria-label` =
    `_instance.slotLabel()` with `{n}` and `{total}` substituted (e.g. "Digit 1 of 6");
    `aria-invalid="true"` when `hasError()`; `aria-required="false"` (the GROUP is required, not
    each slot individually — the group's completion is the constraint).
  - error region: `role="alert" id="${_instance.errorId()}"` rendered unconditionally but empty
    when `!hasError()`; the alert is live (`aria-live="assertive"` is implicit in `role="alert"`)
    so the error announcement fires automatically when `errorMessage` is set via the wire round-trip.
  - mask toggle button (optional, rendered when the template includes it): a real `<button
    type="button">` with `aria-label="Show code"` / `"Hide code"` toggled by the `masked` state;
    icon-only → `aria-label` is mandatory.
  - group container does NOT get `aria-required`; the containing `<field>` partial handles the
    required marker + `aria-describedby` for the hint text.
  - when `disabled`: `aria-disabled="true"` on the group container; `disabled` attribute on each
    slot `<input>` (native `disabled` removes each from the tab order; the group attribute informs
    AT of the group-level semantics).

- **keyboard map** (the load-bearing table — the enhancer owns every non-platform row):

  | key | does | who |
  |---|---|---|
  | `0`–`9` (numeric mode) | fills the active slot; auto-advances to next slot if not the last; replaces any existing value in the slot | enhancer (validates digit-only, rejects other chars) |
  | `A`–`Z`, `0`–`9` (alphanumeric mode) | fills the active slot (normalised to uppercase); auto-advances | enhancer |
  | any printable char (any mode) | fills the active slot; auto-advances | enhancer |
  | `Backspace` (slot has a value) | clears the active slot value; stays on the same slot | enhancer |
  | `Backspace` (slot is empty) | retreats focus to the previous slot; clears that slot's value | enhancer |
  | `Delete` | clears the active slot value; stays on the same slot | enhancer |
  | `ArrowLeft` | moves focus to the previous slot (no wrap); stays on slot 1 if already at slot 1 | enhancer |
  | `ArrowRight` | moves focus to the next slot (no wrap); stays on last slot if already last | enhancer |
  | `Home` | moves focus to slot 1 | enhancer |
  | `End` | moves focus to the last slot | enhancer |
  | `Enter` (any slot, `autoSubmit=false`) | fires `complete(assembledValue)` if all slots filled; no-op if incomplete | enhancer → wire |
  | `Enter` (any slot, `autoSubmit=true`) | no-op (completion fires automatically on the N-th char) | — |
  | `Tab` | exits the OTP group (moves focus to the next focusable element in the page); the group re-enters at slot 1 on next Tab-in | platform (natural tab order; Tab does NOT advance between slots — Arrow keys do; the group's roving-tabindex means only the active slot is `tabindex="0"`) |
  | `Shift+Tab` | exits the OTP group backwards | platform |
  | paste (`Ctrl+V` / `⌘V`) | distributes the pasted string across slots left-to-right, one char per slot; extra chars are dropped; partial paste fills from slot 1; then auto-advances to the first unfilled slot (or fires complete if paste fills all) | enhancer (handles the `paste` event on any slot) |
  | `Ctrl+A` / `⌘A` | selects all (browser default in the active `<input>`); enhancer does not override | platform |

- **focus management**:
  - **roving tabindex within the group**: only the active slot has `tabindex="0"`; all others have
    `tabindex="-1"`. This is the APG keyboard-interface practice model for composite widgets.
    On mount, the active slot is slot 1 (or the first empty slot if `value` is pre-populated).
  - **Tab in**: Tab brings focus INTO the group at the active slot (only one slot is in the tab
    sequence at any time). The enhancer sets `tabindex="0"` on the logically active slot and
    `tabindex="-1"` on all others.
  - **Tab out**: Tab exits the group; the enhancer does NOT trap Tab (OTP is non-modal). Focus
    returns to the active slot position on next Tab-in (the tabindex state is preserved).
  - **auto-advance**: on valid character entry the enhancer moves DOM focus to the next slot (`next.focus()`).
    This is a programmatic focus move, not a roving-tabindex swap — on auto-advance the newly-focused
    slot also becomes the roving-active slot (its tabindex becomes 0).
  - **backspace retreat**: on backspace in an empty slot the enhancer moves DOM focus to the previous
    slot (and clears it).
  - **initial focus (on wire re-render)**: the morph preserves focus (ADR-0019); if a re-render fires
    while a slot is focused, the morph restores focus to that same slot. After `reset()`, the enhancer
    moves focus to slot 1 explicitly (the server has cleared all values; the client is responsible for
    setting focus after a `reset` wire round-trip via the lifecycle `onComponentUpdate` hook).
  - **no trap**: OTP is non-modal. Tab exits freely. No `focus-trap` enhancer is composed here.
  - the active slot is NOT tracked by `aria-activedescendant` — DOM focus IS on each slot `<input>`
    directly (contrast with `select` where virtual focus tracks the highlighted option); each slot is
    a real focusable control.

- **live region**: the `role="alert"` error region (§roles above). On wire round-trip completing
  with an error (`errorMessage` set), the region's text changes and AT announces it assertively
  without the user navigating. No separate "N of N filled" progress announcement is emitted (it
  would be noisy for a 6-digit flow; screen reader users track position via the slot `aria-label`
  and `aria-valuenow`).

- **paste fidelity for screen reader users**: a screen reader user may paste a code from the
  clipboard (e.g. from an SMS) while focus is on any slot. The enhancer intercepts the `paste`
  event on the group container (delegated, not per-slot), splits and distributes the value, then
  announces "Code filled" via the shared announcer (a transient `role="status"` message) so the
  user knows the paste succeeded without having to navigate through all slots.

- **shared mechanisms composed**:
  - the **shared announcer** (`role="status"`, NET-NEW shared mechanism) for the paste-success
    "Code filled" message. Does NOT compose `focus-trap` (non-modal) or `collection-nav`
    (focus is on real DOM elements, not virtual activedescendant — the listbox model does not apply
    here). The OTP enhancer is a STANDALONE enhancer managing its own roving-tabindex and slot
    navigation; it does NOT reuse `collection-nav` because the model is different (direct character
    input with auto-advance vs. activedescendant roving selection in a list).

- **APG citations used**:
  - Spinbutton pattern: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/
  - Spinbutton example (Date Picker Spin Buttons) — the `role="group"` + multiple spinbuttons model:
    https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/
  - Keyboard interface practice — roving tabindex: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/

## 5. Tokens

**Colour tokens read** (all OKLCH source-of-truth, `00` §4):

| token | used for |
|---|---|
| `--lv-color-border` | default slot border |
| `--lv-color-primary` | focused slot border |
| `--lv-color-destructive` | error-state slot borders + error text |
| `--lv-color-muted` | disabled slot borders + disabled slot background |
| `--lv-color-fg` | slot text colour |
| `--lv-color-muted-fg` | placeholder char colour (the `○` placeholder) |
| `--lv-ring` | focus-visible ring on the active slot |
| `--lv-color-input` | slot background (same token as `input`, for visual consistency) |

**Spacing / shape tokens read**:

| token | used for |
|---|---|
| `--lv-space-8` | sm slot height+width (32px) |
| `--lv-space-9` | md slot height+width (36px, default) |
| `--lv-space-10` | lg slot height+width (40px) |
| `--lv-space-2` | gap between slots |
| `--lv-space-3` | gap between a separator span and the adjacent slots |
| `--lv-space-1` | gap between the group and the error region |
| `--lv-radius-md` | slot border radius |
| `--lv-text-sm` | sm slot font size |
| `--lv-text-base` | md slot font size (default) |
| `--lv-text-lg` | lg slot font size |
| `--lv-font-mono` | slot font family (monospace so all digits occupy equal width) |

**NET-NEW tokens proposed**:

| token | OKLCH value | justification |
|---|---|---|
| `--lv-color-input` | `oklch(0.99 0 0)` light / `oklch(0.18 0 0)` dark | the slot background differs from `--lv-color-popover` and from `--lv-color-bg`; this is the same token `input.jte` needs and should be added once, shared with the `input` partial (not duplicated) |
| `--lv-font-mono` | system-ui-monospace stack | a monospace font for digit slots is a distinct typographic need (no existing `--lv-font-*` mono token); added once, reused by `input[type=number]`, `kbd`, `code` contexts |

Both proposed tokens go in `:root` + `.dark, [data-theme="dark"]` re-point block. No literal
colour is baked into the component body.

## 6. Wire actions + enhancer wiring

**Wire directives emitted by the template**:

| directive | element | meaning |
|---|---|---|
| `data-lievit-component` + `data-lievit-id` + `data-lievit-snapshot` | group root `<div>` | standard WIRE mount attributes (ADR-0019); the enhancer mounts on this root |
| `data-otp-slot="${slot.index()}"` | each slot `<input>` | stable slot-position attribute the enhancer reads to track roving state; escaped via `dataAttrs` |
| `data-otp-length="${_instance.length()}"` | group root | lets the enhancer know N without parsing DOM; escaped via `dataAttrs` |
| `data-otp-mode="${_instance.mode()}"` | group root | `numeric` / `alphanumeric` / `any`; drives client-side character validation |
| `data-otp-autosubmit="${_instance.autoSubmit()}"` | group root | `true` / `false`; drives auto-fire on completion |

**No `l:*` input directives on the slot inputs** (this is the key design decision): the slot
`<input>` elements are driven by the enhancer's native DOM event listeners (`keydown`, `input`,
`paste`, `focus`), NOT by `l:model` or `l:keydown.*` directives. Reason: `l:model` fires a
wire round-trip on every keystroke, which is unacceptable for a 6-digit OTP (6 round-trips before
the value is complete). The enhancer accumulates all slot values CLIENT-SIDE and fires a SINGLE
`complete` wire action when all N slots are filled (or on Enter when `autoSubmit=false`).

**Enhancer responsibilities** (`input-otp.enhancer.ts`):

The enhancer registers on the WIRE lifecycle (ADR-0019 directive registry, `onComponentInit`):
1. **Mount**: on `onComponentInit`, find all `[data-otp-slot]` inputs; set `tabindex="0"` on
   slot 0 and `tabindex="-1"` on all others; attach event listeners to the group root (delegated
   `keydown`, `input`, `paste`, `focus` events).
2. **Character input** (`input` event on a slot): read `event.data` (the inserted character);
   validate against `data-otp-mode`; if valid, write the char to the slot's value, advance focus
   to the next slot; if the last slot was just filled and `autoSubmit=true`, fire the `complete`
   wire action with the assembled token via the wire call mechanism (`$lievit.call(root, 'complete',
   { token: assembled })`).
3. **Keydown** (`keydown` on a slot): handle `Backspace`, `Delete`, `ArrowLeft`, `ArrowRight`,
   `Home`, `End`, `Enter` per the §4 keyboard map; `Backspace` on empty slot retreats and clears
   the previous slot; prevent default for all arrow + Home/End keys so the browser does not move
   the text cursor within the single-char input.
4. **Paste** (`paste` on the group root — delegated): intercept `event.clipboardData.getData('text')`;
   strip non-conforming chars per mode; distribute across slots from position 0; focus the first
   unfilled slot (or fire `complete` if paste fills all); announce "Code filled" via the shared
   announcer; call `event.preventDefault()`.
5. **Roving tabindex on focus**: on `focus` event for any slot, update `tabindex="0"` for that
   slot and `tabindex="-1"` for all others (keeps roving state consistent when the user clicks
   a slot directly).
6. **After `reset` wire round-trip**: on `onComponentUpdate`, if all slot values are empty (the
   server has cleared them after a `reset()` action), move focus to slot 0.
7. **Character validation** (client-side, non-authoritative): numeric → `[0-9]`; alphanumeric →
   `[A-Z0-9]` (input normalised to uppercase); any → any printable. This validation is
   CONVENIENCE only (prevents obviously wrong chars from occupying a slot). The `complete()` Java
   action is the AUTHORITATIVE validator — it validates the assembled token and sets `errorMessage`
   if wrong.
8. **Assembling the token**: the enhancer reads `input.value` for each slot in `data-otp-slot`
   order and concatenates; this is the string passed to the `complete` wire action.
9. **Mask state**: the enhancer does NOT manage `type="password"` vs `type="text"` — that is a
   server-rendered `@Wire boolean masked` state reflected by the template (`type="${slot.inputType()}"`).
   The `toggleMask` wire action causes a re-render, and the morph updates the `type` attribute;
   focus is preserved by the morph (ADR-0019).

**Round-trip flows**:

| flow | initiator | round-trip? | what happens |
|---|---|---|---|
| Character entry in slots | user types | NO (all client until complete) | enhancer moves chars across slots; no server contact |
| Auto-submit on N-th char | enhancer | YES (one round-trip total) | `complete(token)` fired; server validates; re-renders with error or success state |
| Manual submit (`autoSubmit=false`, Enter) | enhancer | YES (one round-trip) | same as above, deferred to Enter |
| Paste | enhancer | YES if paste fills all slots | `complete(token)` fired after distribution |
| Mask toggle | user clicks mask-toggle button | YES | `toggleMask()` re-renders; morph updates `type` attributes; focus preserved |
| Reset | `l:click="reset"` on a reset button | YES | `reset()` clears server state; re-renders empty slots; enhancer moves focus to slot 0 |
| Error display | implicit in `complete()` response | YES | server sets `errorMessage`; re-renders; `role="alert"` fires AT announcement |

## 7. Acceptance tests

Each test asserts an observable outcome on a REAL substrate — not a mocked `$lievit`, not a
mocked enhancer. The client-island-fidelity lesson (gest CLAUDE.md) is the guiding constraint.

**Render (real LievitRuntime + jsdom, REAL `input-otp.enhancer.ts` installed)**:

- **`render_emits_group_and_n_slots`**: mounting the component with `length=6` renders a
  `role="group"` container with exactly 6 `<input>` descendants, each having `role="spinbutton"`,
  a unique `aria-label` matching the `slotLabel` template, and `tabindex="-1"` (all but slot 0).
  Slot 0 has `tabindex="0"`.
- **`render_slot_labels_substituted`**: `slotLabel="Digit {n} of {total}"` with `length=4`
  produces `aria-label="Digit 1 of 4"` on slot 0 and `aria-label="Digit 4 of 4"` on slot 3.
- **`render_separator_rendered_aria_hidden`**: with `separatorAfter=[3]` and `length=6`, the
  DOM contains a `<span aria-hidden="true">` separator between slots 2 and 3 (0-indexed); no
  focusable separator; the slot count remains 6.
- **`render_error_region_present_but_empty`**: when `errorMessage` is null, the `role="alert"`
  element is present in the DOM but contains no text (the alert node exists so AT tracks it; it
  does not announce on initial empty render).
- **`render_error_region_populated_on_error`**: when `errorMessage = "Invalid code"`, the
  `role="alert"` element contains the text "Invalid code"; each slot has `aria-invalid="true"`;
  slot borders carry the destructive token class.
- **`render_disabled_state`**: when `disabled=true`, each `<input>` has the native `disabled`
  attribute; the group root has `aria-disabled="true"`; no slot is in the tab order.
- **`render_masked_state`**: when `masked=true`, each `<input>` has `type="password"`; when
  `masked=false`, each has `type="text"` (with `inputmode` per mode).
- **`render_data_attrs_present`**: `data-otp-length`, `data-otp-mode`, `data-otp-autosubmit`
  are present on the group root with the correct escaped values.

**axe-core** (zero violations, real LievitRuntime + jsdom render):

- **`axe_default_state_no_violations`**: axe passes on the rendered group (spinbutton role,
  labels, group label, no orphan ARIA).
- **`axe_error_state_no_violations`**: axe passes when `errorMessage` is set (`aria-invalid` +
  `role=alert` combination).
- **`axe_missing_group_label_fails_accessible_name_rule`**: when `groupLabel` is blank, axe
  FAILS with the `region` / `group-accessible-name` rule (asserts the accessible-name requirement
  is enforced, not silently dropped).

**Keyboard** (REAL enhancer, REAL `dispatchEvent(new KeyboardEvent(...))` on the real DOM):

- **`keyboard_digit_fills_slot_and_advances`**: dispatching `InputEvent` with data `"3"` on slot
  0 fills slot 0 with "3" and moves DOM focus to slot 1; `aria-valuenow` on slot 0 is `3`.
- **`keyboard_invalid_char_rejected_numeric_mode`**: dispatching `InputEvent` with data `"A"` in
  `mode="numeric"` leaves slot 0 empty and focus unchanged; no advance occurs.
- **`keyboard_backspace_on_filled_slot_clears_stays`**: focus on slot 2 (value "5"); Backspace
  clears slot 2's value; focus stays on slot 2.
- **`keyboard_backspace_on_empty_slot_retreats_and_clears_previous`**: focus on slot 2 (empty);
  slot 1 has value "7"; Backspace moves focus to slot 1 and clears slot 1's value.
- **`keyboard_arrow_left_moves_focus`**: focus on slot 3; ArrowLeft moves focus to slot 2; slot
  2 becomes `tabindex="0"`, slot 3 becomes `tabindex="-1"`.
- **`keyboard_arrow_right_moves_focus`**: focus on slot 2; ArrowRight moves focus to slot 3.
- **`keyboard_arrow_left_at_start_stays`**: focus on slot 0; ArrowLeft is a no-op; focus stays on
  slot 0.
- **`keyboard_arrow_right_at_end_stays`**: focus on the last slot; ArrowRight is a no-op.
- **`keyboard_home_moves_to_first_slot`**: focus on slot 4; Home moves focus to slot 0.
- **`keyboard_end_moves_to_last_slot`**: focus on slot 1; End moves focus to the last slot.
- **`keyboard_enter_fires_complete_when_autosubmit_false_and_all_filled`**: `autoSubmit=false`;
  all 6 slots filled; Enter on slot 3 triggers the `complete` wire action with the assembled 6-char
  token; assert the wire call was dispatched.
- **`keyboard_enter_noop_when_incomplete`**: `autoSubmit=false`; only 4 of 6 slots filled; Enter
  does not fire `complete`.
- **`keyboard_tab_exits_group`**: focus on slot 2; Tab moves focus OUT of the group (to the next
  focusable page element); the OTP group is no longer in the focus chain.

**Auto-submit** (REAL enhancer):

- **`autosubmit_fires_complete_on_nth_char`**: `autoSubmit=true`; type 5 valid chars across slots
  0–4, then type the 6th on slot 5; assert the `complete` wire action fires immediately with the
  6-char token; assert no wire call was fired before the 6th char.
- **`autosubmit_false_does_not_fire_on_nth_char`**: `autoSubmit=false`; type all 6 chars; assert
  no `complete` wire action was fired (it waits for Enter).

**Paste** (REAL enhancer, `ClipboardEvent` simulation):

- **`paste_splits_across_slots`**: focus on any slot; paste `"123456"`; assert each slot's value
  is the corresponding digit; assert the `complete` wire action fires (autoSubmit=true); assert
  the shared announcer emitted a "Code filled" status message.
- **`paste_partial_fills_from_slot_zero`**: paste `"123"` into a 6-slot group; slots 0–2 are
  filled, slots 3–5 are empty; focus moves to slot 3; no `complete` fires.
- **`paste_strips_non_conforming_chars_numeric_mode`**: paste `"1A3B56"` in numeric mode; only
  digits are distributed: slots get `"1"`, `"3"`, `"5"`, `"6"` (A and B stripped); partial fill,
  no complete.
- **`paste_hostile_value_renders_inert`**: paste a value containing `"><script>alert(1)</script>"`
  ; the chars are written into slot `value` properties (not innerHTML); no script executes; the
  assembled token passed to `complete()` is the literal character sequence, not interpreted HTML.

**Focus management**:

- **`focus_roving_tabindex_on_click`**: user clicks slot 4 directly; slot 4 becomes `tabindex="0"`;
  slots 0–3 and 5 are `tabindex="-1"`; DOM focus is on slot 4.
- **`focus_returns_to_slot_zero_after_reset`**: complete the group, trigger a `reset()` wire
  round-trip (server clears all slots, re-renders empty); on `onComponentUpdate`, assert DOM focus
  is on slot 0.
- **`focus_preserved_through_mask_toggle_morph`**: focus is on slot 3; `toggleMask()` fires;
  server re-renders with `masked=true`; morph runs; DOM focus is still on slot 3 after the morph
  (ADR-0019 morph identity contract).

**Wire round-trip IT** (lievit-kit, real runtime, CollapsibleComponentIT pattern):

- **`wire_complete_action_validates_and_sets_error`**: mount component with `length=6`; simulate
  the complete action being called with a wrong token; assert the re-rendered DOM contains a
  non-empty `role="alert"` region with the error text; assert `aria-invalid="true"` on each slot.
- **`wire_complete_action_accepts_valid_token`**: mount; call `complete("123456")` with a valid
  token; assert `errorMessage` is null and `value` is `"123456"` in the re-rendered state.
- **`wire_toggle_mask_flips_input_type`**: mount with `masked=false`; call `toggleMask()`; assert
  re-rendered slots have `type="password"`; call `toggleMask()` again; assert `type="text"`.
- **`wire_reset_clears_value_and_error`**: mount with a pre-set `value` and `errorMessage`; call
  `reset()`; assert re-rendered slots are empty and `role="alert"` is empty.

**JTE compile + render gate**: covered by the `test/jte-compile` real-compiler gate (pre-commit,
all templates compiled + rendered against typed model data; drift fails the gate).

**Escaping** (the XSS abuse-case): `data-otp-length` and `data-otp-mode` are template-level values
derived from `@LievitProperty(locked=true)` server config, not user data — they are low-risk; but
the `slotLabel` text (which IS rendered as `aria-label` on each `<input>`) is passed through the
template's escaping mechanism (not `$unsafe`) — assert that a hostile `slotLabel` value containing
`"><script>` renders as a literal string in `aria-label`, not as executable markup.

## 8. Non-goals / anti-patterns

- **NOT a fallback for `<input type="text" autocomplete="one-time-code">`**: the native OTP input
  (a single `<input>` with `autocomplete="one-time-code"`) is a PARTIAL (`native-otp`) and the
  right choice for forms where the browser's autofill can surface the SMS code. This component is
  for UX contexts where VISIBLE per-digit slots are the explicit design requirement.
- **NOT a multi-round-trip component**: the enhancer fires ONE wire call (`complete`) after all N
  slots are filled. It does NOT fire `l:model` on every keystroke. A `l:model`-based approach would
  produce N round-trips for an N-digit code — never do this.
- **NOT an `<input type="password">` component**: masking is an OPTIONAL overlay on top of the
  segmented input, not the default. The default is visible digit entry. The `masked` state is for
  PIN entry UX where the user has requested obscuring.
- **NOT a general text input with slot aesthetics**: the component is only for fixed-length token
  entry (OTP, TOTP, PIN, invite code). Variable-length or multi-word entry belongs in `input` or
  `textarea`. The `length` is locked after mount; the consumer cannot change it dynamically.
- **NOT responsible for business-level OTP validation timing**: the `complete()` Java action
  validates the token. The component does NOT poll, does NOT have a countdown timer, does NOT
  re-request a new OTP — those flows are responsibilities of the consuming WIRE page or a sibling
  component.
- **NOT using `collection-nav.enhancer.ts`**: OTP slots are NOT a listbox / menu / tab set. The
  `collection-nav` enhancer manages virtual `aria-activedescendant` roving in a list; OTP slots
  have DOM focus on each real `<input>`. Composing `collection-nav` here would be the wrong
  abstraction and would break the plain-typing interaction model.
- **NOT re-implementing the popover seam or focus-trap**: OTP is not an overlay; it does not
  compose either of those shared mechanisms.
- **NO `variant` param**: OTP entry has one visual intent. The error state path (red borders +
  alert region) is the only visual differentiation needed and is driven by `errorMessage` + the
  shared destructive token pair — not a `variant` switch.
- **NO inline `<script>` or `on*=` handlers in the template**: the CSP refuses them silently. All
  client behaviour lives in `input-otp.enhancer.ts`, bound via the directive registry
  (ADR-0012 / ADR-0019).
- **NO hardcoded option lists or labels in the template**: slot labels are generated server-side
  from `slotLabel` + `length`; separators come from `separatorAfter`; all data arrives via `@Wire`
  / `@LievitProperty` fields, never baked into the template body.
