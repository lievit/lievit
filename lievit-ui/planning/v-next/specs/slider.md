<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — slider

- **tier**: PARTIAL + ENH (`slider.enhancer.ts`, typed-TS — keyboard step dispatch, value sync, mark
  labels, thumb drag; `native-input[type=range]` is the accessibility baseline, the enhancer enhances
  it rather than replacing it)
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of `registry/jte/slider.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Slider (`https://www.w3.org/WAI/ARIA/apg/patterns/slider/`) + APG
      Slider (Multi-Thumb) (`https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/`)
      as the authority; the native `<input type=range>` supplies `role=slider` + keyboard + ARIA for
      free on single-thumb; the enhancer handles the gap cases (range pair, marks, vertical orientation
      value sync) where the native element falls short. No react-aria reference needed for
      single-thumb; the multi-thumb gap is BUILT against raw APG (react-aria `useSlider` is a pattern
      reference for focus-order between thumbs, not copied).
    - inventory: Ant Design Slider as inventory reference (range mode, marks/steps, tooltips,
      vertical orientation, disabled, custom tooltip formatter)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO
      code copied)

## 1. What it is

A range control that lets a user select a numeric value (or a pair of values in range mode) within a
bounded interval by dragging a thumb along a track, or by keyboard. Single-thumb mode uses a real
`<input type=range>` as the accessible core: the platform supplies `role=slider`, `aria-valuenow`,
`aria-valuemin`, `aria-valuemax`, Tab focus, and the full APG keyboard map for free, so no enhancer is
needed for basic single-thumb accessibility. The enhancer's job is purely the cases where the native
element falls short: range (dual-thumb) mode, custom mark labels, vertical orientation value display,
and the styled custom track/thumb overlay that makes the control Tailwind-UI-grade. Server-first works
for the slider: the value is a server fact (`l:model` or a form POST), the template renders the track,
the thumb overlay, and the mark labels from params, and the native input or the enhancer syncs the
value on user interaction without a wire round-trip (the round-trip happens on blur or explicit submit,
not on every drag tick, which would be UX-hostile).

## 2. API — params / props (the typed surface)

The slider is a PARTIAL (no stateful server `@Wire` component): the value comes in as a `@param`,
the interaction updates it via `l:model` binding to a parent WIRE field or a plain form `<input
name=…>` fallback.

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | `null` | form field name for the hidden `<input>` (used when not bound via `l:model`); required when used in a plain `<form>` |
| `value` | `double` | `0` | current value (single-thumb) |
| `min` | `double` | `0` | minimum of the range (`aria-valuemin`) |
| `max` | `double` | `100` | maximum of the range (`aria-valuemax`) |
| `step` | `double` | `1` | increment per keyboard step and drag snap (`0` = continuous / no snap) |
| `rangeMode` | `boolean` | `false` | dual-thumb range selection; activates the multi-thumb BUILT path |
| `valueLow` | `double` | `0` | range-mode only: the lower thumb value |
| `valueHigh` | `double` | `100` | range-mode only: the upper thumb value |
| `orientation` | `String` | `"horizontal"` | `"horizontal"` \| `"vertical"` — drives `aria-orientation` + layout class |
| `disabled` | `boolean` | `false` | disables interaction; dims + blocks activation; native `disabled` on `<input type=range>` |
| `marks` | `List<SliderMark>` | `[]` | tick marks: each `SliderMark` carries `value: double` + `label: String` (may be blank for an unlabelled tick) |
| `showTooltip` | `String` | `"hover"` | `"always"` \| `"hover"` \| `"never"` — controls value tooltip visibility on the thumb |
| `tooltipFormatter` | `String` | `null` | server-formatted label for the current value (e.g. `"42 %"`); if `null`, the raw numeric value is shown |
| `tooltipFormatterLow` | `String` | `null` | range-mode only: server-formatted label for `valueLow` |
| `tooltipFormatterHigh` | `String` | `null` | range-mode only: server-formatted label for `valueHigh` |
| `ariaLabel` | `String` | `null` | `aria-label` for the thumb (single-thumb); overrides `aria-labelledby` when no visible label exists |
| `ariaLabelLow` | `String` | `null` | range-mode: `aria-label` for the lower thumb |
| `ariaLabelHigh` | `String` | `null` | range-mode: `aria-label` for the upper thumb |
| `ariaValuetext` | `String` | `null` | `aria-valuetext` for the single thumb (when numeric value is not user-friendly, e.g. `"Low"`) |
| `ariaValuetextLow` | `String` | `null` | range-mode: `aria-valuetext` for the lower thumb |
| `ariaValuetextHigh` | `String` | `null` | range-mode: `aria-valuetext` for the upper thumb |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — controls thumb size + track thickness |
| `cssClass` | `String` | `""` | extra utility classes on the root wrapper |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (wire directives, data-* static) |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` on the root wrapper (value via `Escape.htmlAttribute`) |

`SliderMark` is a typed server record (Java `record SliderMark(double value, String label)`), passed
from the controller's typed model — never hardcoded inside the partial (the "no data in a partial" rule).

### Escaping channels

- `attrs` = TRUSTED raw (`$unsafe`) for STATIC, author-typed strings only (e.g. `l:model="sliderValue"`
  wired from a parent WIRE template, or static `data-testid`). Never feed per-row DB-derived values here.
- `dataAttrs` = SAFE escaped dynamic `data-*` (each value through `Escape.htmlAttribute`); use for any
  DB-derived or runtime-variable attribute value.

## 3. Variants / sizes / states

### Variants
The slider has no INTENT variant (it is not an action, it is a control). The one semantic distinction
is `rangeMode`: single-thumb vs dual-thumb, expressed as a boolean param, not a variant string.
Track fill colour uses `--lv-color-primary` in the default (selected range fill); a consuming template
can override the root token via CSS if a different intent colour is needed.

### Sizes (height/thumb-based, toolbar-aligned)
| size | thumb diameter | track thickness | token |
|---|---|---|---|
| `sm` | 14px | 4px | `--lv-space-3-5` (thumb) / `--lv-space-1` (track) |
| `md` | 18px | 5px | `--lv-space-4-5` (thumb) / `--lv-space-1-5` (track) — default |
| `lg` | 22px | 6px | `--lv-space-5-5` (thumb) / `--lv-space-2` (track) |

The overall control height (horizontal) or width (vertical) is determined by the thumb size + the focus
ring clearance (`--lv-ring`), so a `sm` slider in a toolbar row is visually compact and ring-safe.

### States
- `disabled`: native `disabled` on `<input type=range>`; dims the track + thumb to `--lv-color-muted`;
  blocks drag and keyboard; `pointer-events: none` on the styled overlay.
- `:hover` (thumb): thumb background shifts to `--lv-color-primary-hover`; track fill stays primary.
- `:focus-visible` (thumb / native input): `--lv-ring` applied on the styled thumb overlay; the native
  input's default ring is suppressed (`outline-none`) and replaced by the shared ring token so it
  matches every other interactive primitive.
- `aria-invalid`: track border + thumb ring recolour to `--lv-color-destructive`; used when a parent
  `field` partial marks the control invalid (e.g. value out of a required sub-range).
- `showTooltip="always"` vs `"hover"` vs `"never"`: the tooltip element is present in the DOM in all
  cases (for screen-reader fallback via `aria-valuetext`); `showTooltip` controls its CSS visibility
  class only (`opacity-0` vs `opacity-100`), never removes it from the DOM.
- range mode (`rangeMode=true`): two native `<input type=range>` elements stacked (see §6); each has
  its own focus ring; the lower thumb cannot exceed the upper, enforced both in the enhancer (client
  clamp) and in the server param rendering (server renders `max="${valueHigh}"` on the low input).

### Marks
When `marks` is non-empty, the partial renders a row of tick elements below (horizontal) or beside
(vertical) the track, each positioned at `((mark.value - min) / (max - min)) * 100 %`. A mark with a
non-blank `label` renders a visible `<span>` with `aria-hidden="true"` (it is a visual decoration;
`aria-valuetext` carries the semantic value to AT). A mark with a blank label renders a tick dot only.

## 4. The a11y contract (the load-bearing section)

- **WAI-ARIA pattern**: APG Slider (`https://www.w3.org/WAI/ARIA/apg/patterns/slider/`) for single-thumb;
  APG Slider (Multi-Thumb) (`https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/`) for range
  mode. Both URLs verified 2026-06-24.

### Roles + ARIA (single-thumb)

The native `<input type=range>` already supplies:
- `role="slider"` (platform, implicit on `<input type=range>`)
- `aria-valuenow` = current `value` (platform, from the input's live value)
- `aria-valuemin` = `min` (native `min` attribute)
- `aria-valuemax` = `max` (native `max` attribute)

The JTE template additionally sets:
- `aria-label="${ariaLabel}"` when `ariaLabel` is non-null (and no visible label exists)
- `aria-labelledby="<labelId>"` when a visible `<label>` is present (the field partial wires this)
- `aria-valuetext="${ariaValuetext}"` when non-null (the human-readable override, e.g. `"Low"`)
- `aria-orientation="vertical"` when `orientation="vertical"` (horizontal is the default; omitted for brevity)
- `aria-disabled="true"` is NOT used — the native `disabled` attribute is the authority (and the native
  input already communicates disabled state via the platform AOM)

The styled thumb overlay (the `<div>` that makes the control look Tailwind-UI-grade) is
`aria-hidden="true"` — it is a pure visual layer; the real semantic element is the hidden-by-style-only
native `<input type=range>` positioned on top via absolute+opacity-0 (or via custom-thumb CSS where
supported). This pattern ("transparent native input, styled overlay") is the clean CSP-safe way to
achieve a custom visual while keeping the native a11y contract.

### Roles + ARIA (range / dual-thumb)

Two native `<input type=range>` elements are rendered, one per thumb:
- Both have `role="slider"` (implicit, platform)
- Lower thumb: `aria-valuenow="${valueLow}"` `aria-valuemin="${min}"` `aria-valuemax="${valueHigh}"`
  (the upper bound of the lower thumb is the current upper value, APG multithumb rule)
- Upper thumb: `aria-valuenow="${valueHigh}"` `aria-valuemin="${valueLow}"` `aria-valuemax="${max}"`
  (the lower bound of the upper thumb is the current lower value, APG multithumb rule)
- Each thumb has its own `aria-label` or `aria-labelledby` (e.g. `"Minimum price"` / `"Maximum price"`)
  from `ariaLabelLow` / `ariaLabelHigh`
- `aria-valuetext` set per thumb when `ariaValuetextLow` / `ariaValuetextHigh` is non-null

The APG multithumb rule: `aria-valuemin`/`aria-valuemax` update dynamically as the user moves either
thumb, so each thumb always communicates its live constraint to AT. The template server-renders the
initial constraint; the enhancer updates these attributes on every drag/keypress (client, no round-trip)
before the next morph.

### Keyboard interaction map

The native `<input type=range>` supplies ALL of the following for single-thumb without any enhancer.
For range mode, EACH thumb independently receives the same map (focus jumps between them via Tab):

| key | action | who |
|---|---|---|
| `ArrowRight` | increase value by one `step` | platform (native `<input type=range>`) |
| `ArrowUp` | increase value by one `step` | platform |
| `ArrowLeft` | decrease value by one `step` | platform |
| `ArrowDown` | decrease value by one `step` | platform |
| `Home` | set value to `min` (or `valueLow`/`valueHigh` lower bound for that thumb) | platform |
| `End` | set value to `max` (or `valueLow`/`valueHigh` upper bound for that thumb) | platform |
| `Page Up` | increase value by a larger step (browser-defined; typically 10% of range) | platform (optional, APG) |
| `Page Down` | decrease value by a larger step (browser-defined; typically 10% of range) | platform (optional, APG) |
| `Tab` | focus next interactive element (or next thumb in range mode) | platform |
| `Shift+Tab` | focus previous interactive element (or previous thumb in range mode) | platform |

The enhancer does NOT re-implement any of the above. Its keyboard responsibilities:
- Range mode only: after ArrowKey/Home/End on the lower thumb, clamp `valueLow ≤ valueHigh` and update
  both `aria-valuemax` (lower input) and `aria-valuemin` (upper input) immediately (before the wire
  round-trip, so AT hears the updated constraint in real time).
- Marks + step snapping: if `step` is `0` (continuous) but marks are present, the enhancer optionally
  snaps to the nearest mark on keyboard End/Home (this is a visual courtesy, not an APG requirement).

### Focus management

- **Single-thumb**: platform focus (Tab into / Shift+Tab out of the native input). Focus ring = `--lv-ring`
  on the styled overlay (synced to `:focus-visible` on the input via CSS sibling or `:has()`).
- **Range mode**: tab order is `low-thumb → high-thumb`, constant regardless of which thumb's value is
  currently higher (APG multithumb rule: "The tab order remains constant regardless of thumb value and
  visual position within the slider"). The enhancer must NOT re-sort the DOM order when the thumbs cross.
- **No trap**: the slider is not a modal; Tab leaves it normally.
- **No roving tabindex**: each thumb is independently focusable; roving tabindex does NOT apply here
  (roving is for single-focusable-per-group patterns like toolbar/radio-group; the multithumb slider
  puts every thumb in the tab order independently).

### Live region
None. The value is continuously announced via `aria-valuenow` (and `aria-valuetext` when set) on the
focused native input as the user interacts — the platform handles the live announcement without an
explicit `role=status` region. A consuming component that shows a summary ("Price: $20–$80") after
the user commits a range selection should use the shared announcer if it wants to announce the final
value explicitly, but the slider partial itself does not ship a live region.

### Shared mechanisms composed
None of the three shared mechanisms (popover seam / focus-trap / collection-nav) applies:
- No popover: the slider does not open an overlay.
- No focus trap: the slider is not modal.
- No collection roving: the thumbs are independently in the tab order; `collection-nav` is the wrong
  tool here (it is for single-focusable collections; the multithumb thumb-crossing constraint is handled
  by the simple clamp in `slider.enhancer.ts`).

The slider's enhancer is its own small typed-TS module, not a consumer of any shared mechanism.

## 5. Tokens

### Colour tokens (OKLCH source-of-truth)
| token | role |
|---|---|
| `--lv-color-primary` | track fill (the selected range between min/thumb or between thumbs) |
| `--lv-color-primary-hover` | thumb hover background |
| `--lv-color-bg` | thumb background at rest |
| `--lv-color-border` | track rail (the unfilled portion) + thumb border |
| `--lv-color-muted` | disabled track + thumb |
| `--lv-color-muted-fg` | disabled tick labels + tooltip text when disabled |
| `--lv-color-destructive` | track fill + thumb border when `aria-invalid` |
| `--lv-color-popover` | tooltip background |
| `--lv-color-popover-fg` | tooltip text |
| `--lv-ring` | focus ring on thumb (the shared ring token, identical to button/input) |

### Spacing + radius tokens
| token | role |
|---|---|
| `--lv-space-1` | track thickness (sm, approximately; see §3 size table) |
| `--lv-space-1-5` | track thickness (md) |
| `--lv-space-2` | track thickness (lg) |
| `--lv-space-3-5` | thumb diameter (sm) |
| `--lv-space-4-5` | thumb diameter (md) |
| `--lv-space-5-5` | thumb diameter (lg) |
| `--lv-space-2` | tooltip horizontal padding |
| `--lv-space-1` | tooltip vertical padding |
| `--lv-radius-full` | thumb (circular) + tooltip pill |
| `--lv-radius-full` | track rail (pill-shaped ends) |
| `--lv-shadow-sm` | thumb shadow at rest (gives depth) |
| `--lv-shadow-md` | thumb shadow on hover/focus (subtle lift) |
| `--lv-text-xs` | mark labels + tooltip text |
| `--lv-font-sans` | mark labels + tooltip text |

### Net-new tokens proposed
The current token set does not include half-unit spacing values (`--lv-space-3-5`, `--lv-space-4-5`,
`--lv-space-5-5`, `--lv-space-1-5`). These are needed to hit the exact thumb/track proportions that
produce the Tailwind-UI-grade look without jumping from too-small (size 3 = 12px) to too-large (size 4
= 16px). Proposal: add five tokens in `:root` (structural, theme-invariant, no dark block needed):

```css
/* additive — half-unit fillers for slider + any future compact controls */
--lv-space-1-5: calc(var(--lv-space-1) * 1.5);   /* ~6px at 1rem base */
--lv-space-3-5: calc(var(--lv-space-3) * 1.167);  /* ~14px */
--lv-space-4-5: calc(var(--lv-space-4) * 1.125);  /* ~18px */
--lv-space-5-5: calc(var(--lv-space-5) * 1.1);    /* ~22px */
```

These are structural (spacing), not colour, so no dark-mode block is required. They are additive and
namespaced; no existing token is modified.

## 6. Wire / island integration

The slider is a PARTIAL, not a WIRE component: the value is not a `@Wire` field managed server-side.
Instead, the value travels via either:

1. **`l:model` binding** (when the slider lives inside a parent WIRE template): the parent WIRE field
   holds the value; the slider's hidden `<input>` or the native range input carries `l:model="fieldName"`,
   and the morph round-trip propagates the new value only on blur or explicit submit.
2. **Plain form `<input name=…>`** (when inside a standard `<form>` POST): the native `<input type=range
   name="${name}">` carries the value as a standard form field; no wire round-trip.

### Server-rendered JTE structure

```
data-slot="slider"
data-size="${size}"
data-orientation="${orientation}"
data-range="${rangeMode ? "true" : "false"}"
  ├── .slider-track-rail                   ← the styled rail (aria-hidden)
  │   └── .slider-track-fill               ← the coloured fill (aria-hidden; width/height set by CSS custom property --slider-pct)
  ├── <input type="range" …>               ← the REAL accessible thumb (single-thumb or low thumb in range mode)
  │   [opacity-0 overlay OR visually-hidden with real pointer-events]
  ├── <input type="range" …>               ← range mode only: the high thumb
  ├── .slider-thumb-overlay[aria-hidden]   ← purely visual styled thumb(s); position driven by CSS --slider-pct
  ├── .slider-tooltip[aria-hidden]         ← value tooltip bubble (visual only; a11y value is on the input)
  └── .slider-marks[aria-hidden]           ← tick row when marks is non-empty (visual decoration)
      └── .slider-mark* ×N                 ← one per SliderMark; includes .slider-mark-label for non-blank labels
```

The `--slider-pct` CSS custom property is set inline on the root (e.g. `style="--slider-pct: 42%"`)
from the server-side computed fill percentage: `((value - min) / (max - min)) * 100`. The track fill
and the thumb overlay position read it without JavaScript for the initial render. The enhancer updates
it on every drag/keypress so the visual tracks the native input's live value without a round-trip.

`data-lievit-enhancer="slider"` on the root element triggers the `slider.enhancer.ts` lifecycle hook
via the runtime directive registry.

### Enhancer responsibilities (`slider.enhancer.ts`)

The enhancer is typed vanilla-TS, CSP-clean, registered via the runtime directive/lifecycle registry
(never via inline `on*=`). It does NOT replace the native input's keyboard behavior.

**On mount** (`onComponentInit` / `connectedCallback` lifecycle):
- Read `data-range`, `data-size`, `data-orientation` from the root.
- Attach `input` event listeners to the native `<input type=range>` element(s).

**On native `input` event** (fires continuously during drag AND on every keyboard step):
- Compute `--slider-pct` from the input's live `.value`, `min`, `max`; write to root element
  `style` directly (no DOM reflow for the rail/fill, they CSS-read the custom property).
- Range mode: clamp `valueLow ≤ valueHigh` (if thumbs cross, set the moved thumb's value back to
  the other thumb's value), then update `aria-valuemax` on the lower input + `aria-valuemin` on
  the upper input immediately so AT hears the updated constraint.
- Update the styled thumb overlay's CSS translate to match the new percentage.
- Tooltip: if `showTooltip="hover"` or `"always"`, update the tooltip text node with the live
  formatted value (from `data-tooltip-formatter` on the root, or raw numeric if absent); position
  the tooltip above/beside the thumb using CSS `translate` derived from `--slider-pct`.

**On native `change` event** (fires on mouseup / touch-end / keyboard commit — NOT on every tick):
- If `l:model` is wired (detected via `data-lievit-model` attribute on the input): the lievit
  runtime's `l:model` directive already picks this up and fires the wire action automatically.
- If a plain `<input type=hidden name="${name}">` is present: copy the value there so the form
  POST carries the final committed value.

**On thumb `mouseover` / `focusin` (when `showTooltip="hover"`)**:
- Add `opacity-100` class to `.slider-tooltip`; remove it on `mouseleave` / `focusout`.

**No custom keyboard handler**: the enhancer does NOT intercept ArrowKey/Home/End/PageUp/PageDown.
The platform supplies all of these for free on the native input. Intercepting them would be
duplication, fragile, and would break if the browser or AT modifies behavior. The ONLY keyboard
side-effect the enhancer adds is updating `--slider-pct` reactively via the `input` event (which
fires on keyboard steps too).

### Wire round-trip
The slider does NOT trigger a round-trip on every drag tick. The round-trip (when wired via
`l:model`) fires on the native `change` event (end of drag / blur / keyboard commit), not on `input`.
This is the correct behavior: a round-trip on every tick would produce a server-morph while the user
is mid-drag, fighting the DOM morph's identity-preserving patch with a value the user is actively
changing. Continuous visual feedback (track fill, thumb position, tooltip) is handled entirely by the
enhancer updating `--slider-pct`, which is fast and zero-round-trip.

## 7. Acceptance tests (the gate — refute-by-default)

All tests run on a REAL substrate, not a mocked one (the client-island-fidelity lesson).

### Render tests (jsdom, real JTE compiler, `test/jte-compile` gate)

- **single-thumb renders**: `data-slot="slider"`, one `<input type=range>`, `min`/`max`/`value`
  attributes match params; `aria-label` present when `ariaLabel` param is set.
- **range mode renders two inputs**: `rangeMode=true` → two `<input type=range>` elements; lower has
  `aria-valuemax="${valueHigh}"`, upper has `aria-valuemin="${valueLow}"` (APG multithumb constraint).
- **aria-valuetext rendered**: when `ariaValuetext="Low"` param is set, the native input carries
  `aria-valuetext="Low"`.
- **vertical orientation**: `data-orientation="vertical"` on root; `aria-orientation="vertical"` on
  the native input.
- **marks render**: three marks → three `.slider-mark` elements positioned at correct percentages;
  non-blank label → `.slider-mark-label` with the label text; blank label → no label span.
- **disabled state**: native input carries `disabled` attribute; overlay carries `pointer-events-none`
  class.
- **size variants**: each of `sm|md|lg` emits its `data-size` + the correct thumb/track token classes.
- **tooltip present**: `.slider-tooltip` element is in the DOM regardless of `showTooltip`; the CSS
  visibility class differs between `"always"` (`opacity-100`) and `"never"` (`opacity-0`).
- **aria-invalid**: when `aria-invalid="true"` set on the root (by a parent field partial), the track
  fill and thumb border classes reference `--lv-color-destructive`.
- **JTE compiles + renders**: covered by `test/jte-compile` real-compiler gate.

### axe-core assertions (jsdom, real LievitRuntime with enhancer mounted)

- **single-thumb, visible label**: zero axe violations; label association valid (`aria-labelledby`
  or `aria-label` present).
- **single-thumb, icon-only (no visible label)**: `ariaLabel` MUST be set; assert axe fails (the
  accessible-name rule violation) when `ariaLabel=null` with no `aria-labelledby` — the test proves
  the spec's REQUIRED constraint, not just the happy path.
- **range mode**: zero axe violations on both thumb elements; each has a distinct accessible name;
  `aria-valuemin`/`aria-valuemax` are numerically valid; `aria-valuenow` is within `[min, max]`.
- **disabled slider**: zero axe violations in disabled state.
- **marks with labels**: mark labels are `aria-hidden="true"` (they are not interactive; axe must not
  flag them as unlabelled or improperly interactive).

### Keyboard tests (jsdom, real enhancer mounted, native input event dispatch)

All keyboard assertions dispatch events on the native `<input type=range>` and assert the OBSERVABLE
outcome (visible DOM + ARIA attributes), matching the §4 keyboard map exactly:

- **ArrowRight increases value**: dispatch `keydown ArrowRight` on native input → input's `.value`
  increases by `step`; `--slider-pct` CSS property on root updates accordingly.
- **ArrowLeft decreases value**: symmetric.
- **ArrowUp increases, ArrowDown decreases**: symmetric; same assertions.
- **Home sets to min**: dispatch `keydown Home` → input `.value` equals `min`; `--slider-pct` = `0%`.
- **End sets to max**: dispatch `keydown End` → input `.value` equals `max`; `--slider-pct` = `100%`.
- **disabled blocks keyboard**: native input is `disabled` → dispatched ArrowRight does NOT change
  value (assert `.value` unchanged after dispatch).
- **range mode: low thumb cannot exceed high**: ArrowRight on low thumb when `valueLow` is at
  `valueHigh` → value stays clamped; `aria-valuemax` on low input equals `valueHigh` after the clamp.
- **range mode: high thumb cannot go below low**: ArrowLeft on high thumb when `valueHigh` is at
  `valueLow` → value stays clamped; `aria-valuemin` on high input equals `valueLow` after the clamp.
- **tab order in range mode**: Tab from low thumb moves focus to high thumb; Shift+Tab from high thumb
  returns to low thumb; tab order is stable (assert `document.activeElement` sequence).

### Focus tests

- **single-thumb focus ring**: `:focus-visible` on the native input → assert the styled overlay has
  the ring CSS class derived from `--lv-ring`.
- **range mode tab order constant**: move low thumb value above high thumb value (programmatic); Tab
  still moves focus from low input to high input in DOM order (the enhancer must NOT have re-sorted
  the inputs).

### Variants / sizes
- `sm | md | lg`: each emits `data-size` + the size-specific token classes for thumb + track.
- track fill colour is `--lv-color-primary`; `aria-invalid` recolours to `--lv-color-destructive`.

### Enhancer integration tests (real LievitRuntime, `jsdom` with real DOM + real `<input type=range>`)

- **drag updates --slider-pct**: simulate a programmatic value change on the native input + dispatch
  `input` event → assert `style.getPropertyValue("--slider-pct")` on the root reflects the new
  percentage.
- **tooltip updates on input**: `showTooltip="always"` + dispatch `input` → tooltip text node contains
  the new value (raw numeric or `tooltipFormatter` value when set).
- **tooltip toggles on hover**: `showTooltip="hover"` + `mouseover` on thumb → tooltip becomes visible
  (`opacity-100`); `mouseleave` → hidden again.
- **l:model fires on change (not on input)**: attach a spy on the lievit runtime's wire dispatch;
  dispatch `input` events (continuous) → spy NOT called; dispatch `change` event (commit) → spy called
  exactly once with the final value.
- **plain form hidden input sync**: `name="price"` + no `l:model` → `change` event → hidden input
  `<input type=hidden name="price">` carries the committed value.

### Playwright (gesture fidelity, legacy-VM oracle)

- **drag thumb**: `page.mouse` drag from thumb start position to a new position → assert the value
  tooltip shows the new value + the track fill visually covers the correct proportion (screenshot-diff
  or pixel assertion on the fill element's computed width).
- **range drag both thumbs**: drag low thumb right, drag high thumb left, assert final `valueLow <
  valueHigh`; assert both tooltips show independent values.
- **keyboard on focused thumb**: `page.keyboard.press("ArrowRight")` × 3 steps → assert the displayed
  tooltip value increases by `3 × step`.
- **escaping** (the XSS abuse-case): `dataAttrs={confirm: "\">|<script>alert(1)"}` renders the
  attribute value HTML-escaped, never as a tag break.

## 8. Non-goals / anti-patterns

- **No custom keyboard handler for ArrowKey/Home/End/PageUp/PageDown**: the native `<input type=range>`
  supplies these for free and correctly. Reimplementing them in the enhancer is duplication that
  diverges from browser behavior + breaks with AT overrides. The enhancer's only keyboard side-effect
  is the reactive `--slider-pct` update via the `input` event.
- **No wire round-trip on every drag tick**: the morph fights mid-drag DOM state. Round-trips happen
  on `change` (commit) only.
- **No Lit / Alpine / framework for the thumb drag**: the enhancer is typed vanilla-TS, CSP-clean.
  The styled overlay's position is a CSS custom property updated by one line of JS — no virtual DOM,
  no reconciler.
- **No re-sorting thumbs in range mode when they cross**: the APG multithumb rule mandates that the
  tab order remains constant (low thumb = first in DOM, always). The visual crossed state (where the
  left thumb value exceeds the right) should be prevented by the value clamp, not by DOM reorder.
- **No tooltip as a popover/portal**: the tooltip is a plain absolutely-positioned sibling of the
  thumb, not a popover-seam overlay. It does not need light-dismiss or focus-trap; it is purely
  visual feedback and is `aria-hidden`.
- **No server round-trip to format the tooltip in-flight**: the tooltip's live formatting is a
  client concern (the enhancer updates it from `data-tooltip-formatter` or raw numeric). If a complex
  server-formatted label is needed, pass it via `tooltipFormatter` at render time and let the enhancer
  update the numeric portion client-side; do not hit the server on every drag tick.
- **No `role=slider` on the styled overlay div**: the `aria-hidden` styled overlay must never carry
  `role=slider` or any interactive role; duplicating the role produces two sliders for AT where one
  exists.
- **No marks-based keyboard navigation**: marks are visual decorations. The keyboard steps by `step`,
  not by mark boundaries, unless `step` itself aligns with mark values. The enhancer does not intercept
  ArrowKeys to jump between marks; that would override the platform's step logic.
- **No `aria-live` on the track fill or tooltip**: the value is announced via `aria-valuenow` on
  the focused native input — no supplemental live region is needed or desired (it would produce double
  announcements on every arrow key press).

## 9. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens (OKLCH). You MAY read the W3C WAI-ARIA APG Slider
pattern + APG Slider (Multi-Thumb) pattern + Ant Design Slider feature set + Tailwind UI as references
for PATTERN (a11y, inventory) and LOOK. You MUST NOT paste literal source from ANY of them — the
output is always original generation (`02-licensing.md`).

Mirror `button.jte`'s house conventions exactly: header doc-comment (Apache block + `<%-- --%>` with
`TIER:`, `STRUCTURE:`, `A11y:`, `Params:`, `Usage:`); typed `@param` with defaults; `data-slot`;
`data-variant`/`data-size`; the two escaping channels (`attrs` TRUSTED, `dataAttrs` SAFE); zero
`<script>`, zero inline `on*=`; no data hardcoded inside the partial.

The native `<input type=range>` is the accessible spine — do not replace it with a `div[role=slider]`.
The styled overlay is `aria-hidden`. The enhancer updates `--slider-pct` on the `input` event; it does
NOT add custom keyboard handlers for the arrows (the platform supplies them). The round-trip fires on
`change`, not `input`.

Add the five net-new `--lv-space-*` tokens (`--lv-space-1-5`, `--lv-space-3-5`, `--lv-space-4-5`,
`--lv-space-5-5`) to `registry/tokens/lievit-tokens.css` `:root` block (structural, no dark block
needed) before using them in the template.

Minimal code to GREEN against the §7 acceptance tests. The keyboard map is the contract — assert ALL
of it (both single-thumb and range mode paths). The range-mode tab-order constancy test is load-bearing;
do not skip it. The escaping test (hostile `dataAttrs` value) is mandatory.
