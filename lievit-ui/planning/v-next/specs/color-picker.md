<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — color-picker

- **tier**: PARTIAL (shell) + ENH (`color-picker.enhancer.ts`)
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of the existing `color-picker` enhancer + any partial shell)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Spinbutton (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/) for the R/G/B
      channel inputs; APG Toolbar (https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) for the swatch grid;
      platform `<input type="color">` for the native fallback channel; BUILT against raw APG (no react-aria
      pattern exists for a color picker as a composite widget — this is a Radix-gap BUILT case)
    - inventory: Ant Design ColorPicker as inventory reference (hex/rgb/hsl tabs, swatch presets, alpha
      channel, eyedropper, format toggle; the full-canvas gradient picker is deliberately NOT in scope — see §8)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A color-picker lets users select a color value from a structured input surface: a native
`<input type="color">` trigger that opens a popover containing editable hex/RGB/HSL channel
spinbuttons, an optional alpha slider, a preset swatch grid, and an optional eyedropper button.
The SELECTED COLOR is a server fact (a `String` hex value in a form field or a WIRE field), so
the component is a PARTIAL with an enhancer for the irreducible client behavior.

The tier split is deliberate. The shell — the trigger button, the hidden `<input type="color">`,
the hex/channel inputs, the swatch chips, the alpha slider — is pure server-rendered JTE markup.
The enhancer owns exactly two irreducible client responsibilities: (a) keeping the channel
spinbuttons, hex input, alpha slider, and `<input type="color">` in sync as the user edits any
one of them (a pure-client derived-state calculation that would require a server round-trip per
keystroke if server-managed), and (b) the swatch-grid roving-tabindex keyboard navigation. Everything
else — form submission, the value written into the hidden input, popover open/close — is handled
by the platform (`<input type="color">` native picker or the server-rendered popover seam).

Server-first works because the VALUE is a single `String` (the hex color) that the server holds,
validates, and reflects into the template on submit. The channel editing between picker-open and
picker-confirm is the one genuinely-client seam (ephemeral derived state, sub-keystroke latency
required) that earns the typed-TS enhancer. There is no server round-trip during editing; the
round-trip happens only on confirm (form submit or explicit wire action).

## 2. API — params / props (the typed surface)

### 2.a PARTIAL `@param` surface

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | — | the `<input>` name submitted with the form (required) |
| `value` | `String` | `"#000000"` | the current hex color string (`#rrggbb`); populates all channel inputs on render |
| `alpha` | `boolean` | `false` | when `true`, renders the alpha channel slider + emits `rgba(…)` on confirm |
| `alphaValue` | `int` | `100` | alpha percentage 0–100, used when `alpha=true` |
| `format` | `String` | `"hex"` | initial display format: `hex \| rgb \| hsl`; the format-toggle button cycles through |
| `swatches` | `List<String>` | `[]` | preset hex values rendered as clickable swatch chips (empty = no swatch row) |
| `swatchColumns` | `int` | `8` | grid columns for the swatch row (controls `grid-cols-N`) |
| `eyedropper` | `boolean` | `false` | renders the eyedropper button (requires EyeDropper API; degrades gracefully when absent) |
| `disabled` | `boolean` | `false` | dims + blocks all interaction |
| `size` | `String` | `"md"` | `sm \| md \| lg` — height of the trigger button; toolbar-aligned with other form controls |
| `ariaLabel` | `String` | `"Color picker"` | accessible name for the composite widget `<group>` |
| `ariaLabelledby` | `String` | `null` | overrides `ariaLabel` when a visible label element exists (`id` reference) |
| `id` | `String` | — | base id; the template derives `<id>-trigger`, `<id>-popover`, `<id>-hex`, `<id>-r`, `<id>-g`, `<id>-b`, `<id>-h`, `<id>-s`, `<id>-l`, `<id>-a`, `<id>-swatches` |
| `cssClass` | `String` | `""` | extra utility classes on the root wrapper |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (additional data-* for wire directives on the trigger) |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` values (each through `Escape.htmlAttribute`) |

### 2.b Enhancer `data-*` hooks (read by `color-picker.enhancer.ts` at mount)

All set by the template; the enhancer reads them as its configuration surface.

| attribute | on element | meaning |
|---|---|---|
| `data-lv-color-picker` | root wrapper | mount target; presence triggers enhancer init |
| `data-lv-cp-alpha` | root wrapper | `"true"` when alpha channel is enabled |
| `data-lv-cp-format` | root wrapper | initial format (`hex \| rgb \| hsl`) |
| `data-lv-cp-eyedropper` | root wrapper | `"true"` when eyedropper button is present |
| `data-lv-cp-swatch-count` | root wrapper | number of swatch chips (helps the enhancer bound roving) |
| `data-slot="trigger"` | the trigger `<button>` | the colored preview swatch + label |
| `data-slot="native-input"` | `<input type="color">` | the hidden native input; `value` synced here on commit |
| `data-slot="hex-input"` | the hex `<input>` | hex text field |
| `data-slot="channel-r"` | R `<input>` | red channel (0–255) |
| `data-slot="channel-g"` | G `<input>` | green channel (0–255) |
| `data-slot="channel-b"` | B `<input>` | blue channel (0–255) |
| `data-slot="channel-h"` | H `<input>` | hue (0–360) |
| `data-slot="channel-s"` | S `<input>` | saturation (0–100) |
| `data-slot="channel-l"` | L `<input>` | lightness (0–100) |
| `data-slot="alpha-input"` | A `<input>` | alpha (0–100) |
| `data-slot="format-toggle"` | format-cycle `<button>` | cycles `hex → rgb → hsl → hex` |
| `data-slot="eyedropper-btn"` | eyedropper `<button>` | invokes `EyeDropper.open()` |
| `data-slot="swatch"` | each swatch `<button>` | `data-color="#rrggbb"` holds the preset value |
| `data-slot="swatches"` | swatch grid wrapper | roving-tabindex container for swatch buttons |
| `data-slot="color-preview"` | preview square in popover | live color preview; background set by enhancer |
| `data-slot="confirm-btn"` | confirm `<button>` | writes final value + closes popover |
| `data-slot="cancel-btn"` | cancel `<button>` | discards ephemeral edit + closes popover |

## 3. Variants / sizes / states

### Sizes
Height-based, toolbar-aligned (matches `button`, `input` of the same size):

| size | trigger height token | trigger min-width | text-size |
|---|---|---|---|
| `sm` | `--lv-space-8` (32 px) | `--lv-space-16` | `--lv-text-xs` |
| `md` | `--lv-space-9` (36 px, default) | `--lv-space-20` | `--lv-text-sm` |
| `lg` | `--lv-space-10` (40 px) | `--lv-space-24` | `--lv-text-base` |

The trigger button shows a colored preview swatch square on the left and the current hex (or
rgba/hsla) value as text on the right. The `data-size` attribute is set on the root wrapper
for test targeting.

### Variants
A `variant` param is NOT exposed on this component: the trigger button always renders in the
`outline` intent (a form-control button, never a CTA). The INTERIOR of the trigger swatch is
the variable-color surface. The popover panel inherits `--lv-color-popover` / `--lv-color-popover-fg`.

### Format modes
Three display format modes, toggled by the enhancer cycling `data-lv-cp-format` on the root:

| mode | visible inputs | hidden inputs |
|---|---|---|
| `hex` | hex text input | R/G/B, H/S/L |
| `rgb` | R, G, B spinbuttons | hex text, H/S/L |
| `hsl` | H, S, L spinbuttons | hex text, R/G/B |

All hidden inputs remain in the DOM with `hidden` / `aria-hidden="true"` so the enhancer can read
them; the template renders all three groups and sets `hidden` on the inactive ones. Switching format
does NOT trigger a server round-trip; it is a pure-client visibility toggle.

### States

| state | appearance | ARIA |
|---|---|---|
| `disabled` | trigger dimmed via `disabled:` utilities; popover cannot open | native `disabled` on trigger; `aria-disabled="true"` on the wrapper group |
| `:focus-visible` | `--lv-ring` focus ring on the focused channel input or swatch | platform (native `:focus-visible`) |
| `aria-invalid` | trigger border + hex input border recolour to `--lv-color-destructive`; destructive ring | `aria-invalid="true"` on the hidden `<input name>` + the trigger |
| open | popover panel visible, trigger has `aria-expanded="true"` | `aria-expanded` on trigger |
| closed | popover panel hidden (`popover` attribute, CSS `display:none`) | `aria-expanded="false"` |
| eyedropper-unsupported | eyedropper button has `hidden` set; its slot is not rendered | element absent from DOM + a11y tree |
| alpha-disabled | alpha row hidden; alpha slot absent | element absent from DOM |

## 4. The a11y contract (the heart — non-negotiable, fully specified)

### WAI-ARIA pattern
There is NO single APG pattern for a color picker as a composite widget. This is a **BUILT** case
against the raw APG. The component is composed of three well-defined sub-patterns:

1. The **trigger** follows the APG Button pattern (native `<button>`; platform supplies role + keyboard).
2. The **channel spinbuttons** (R, G, B, H, S, L, A) each follow the APG Spinbutton pattern
   (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/).
3. The **swatch grid** follows the APG Toolbar pattern
   (https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) — a roving-tabindex container of buttons.

The whole composite is wrapped in a `<div role="group">` with an accessible name (the field label),
identifying it as one logical control to screen readers.

### Roles + ARIA

| element | role / attribute | value / rule |
|---|---|---|
| root wrapper `<div>` | `role="group"` | accessible name via `aria-labelledby="<ariaLabelledby>"` or `aria-label="<ariaLabel>"` |
| root wrapper `<div>` | `aria-disabled` | `"true"` when disabled |
| trigger `<button>` | `<button>` (platform role `button`) | `aria-expanded="${open ? 'true' : 'false'}"`, `aria-haspopup="dialog"`, `aria-controls="<id>-popover"` |
| trigger `<button>` | `aria-label` | `"Pick color: <currentHex>"` (includes the current value so blind users know the current selection) |
| color swatch preview in trigger | `aria-hidden="true"` | purely decorative, the trigger label carries the value |
| popover panel `<div>` | `role="dialog"` | `aria-label="Color picker"`, `aria-modal="false"` (non-modal: Tab leaves it) |
| hex `<input type="text">` | `role="textbox"` (platform) | `aria-label="Hex color"`, `aria-describedby` → a short hint `"#rrggbb"` |
| R/G/B/H/S/L/A `<input type="number">` | `role="spinbutton"` (platform via `type=number`) | `aria-label="Red"` / `"Green"` / `"Blue"` / `"Hue"` / `"Saturation"` / `"Lightness"` / `"Alpha"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` (e.g. `"128"` for numeric, `"Saturation: 75%"` for hsl) |
| alpha `<input type="range">` | `role="slider"` (platform) | `aria-label="Alpha"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow`, `aria-valuetext="<n>%"` |
| format-toggle `<button>` | `<button>` (platform) | `aria-label="Format: Hex"` / `"Format: RGB"` / `"Format: HSL"` (current format named) |
| eyedropper `<button>` | `<button>` (platform) | `aria-label="Pick color from screen"` |
| swatch grid `<div>` | `role="toolbar"` | `aria-label="Color presets"`, roving tabindex (one stop into the grid, arrow-nav within) |
| each swatch `<button>` | `<button>` (platform) | `aria-label="<hex value>"` (e.g. `"#ff6b6b"`), `aria-pressed="true"` when this swatch matches the current value |
| confirm `<button>` | `<button>` (platform) | `aria-label="Confirm color"` |
| cancel `<button>` | `<button>` (platform) | `aria-label="Cancel"` |
| native hidden `<input type="color">` | — | `aria-hidden="true"`, `tabindex="-1"` (synced programmatically; not in the user's tab flow) |
| color-preview square `<div>` | — | `aria-hidden="true"` (decorative) |

### Keyboard interaction map

The popover is NON-MODAL (it is a picker attached to a field, not a blocking dialog). Tab moves
through its controls in document order; it does NOT trap focus. The `focus-trap` enhancer is NOT
composed here. The popover seam provides light-dismiss on click-outside and on Esc.

| key | context | action | who |
|---|---|---|---|
| Enter / Space | trigger button (closed) | open the popover; focus moves to the hex input (or first channel input in current format) | enhancer (opens popover) + platform (Enter/Space on button) |
| Esc | popover open | close popover, discard ephemeral edit, restore focus to the trigger | enhancer (registers keydown on the popover panel) |
| Tab | popover open | move focus to next control within the popover in DOM order; when on the last control (cancel button), Tab moves focus OUT of the popover and closes it | platform + enhancer (close on Tab-out) |
| Shift+Tab | popover open | move focus to previous control | platform |
| ArrowUp | channel spinbutton focused | increment the channel value by 1 (or by `step`); clamp to `aria-valuemax` | platform (`<input type=number>`) |
| ArrowDown | channel spinbutton focused | decrement the channel value by 1 (or by `step`); clamp to `aria-valuemin` | platform (`<input type=number>`) |
| Home | channel spinbutton focused | set value to `aria-valuemin` (APG Spinbutton) | enhancer (platform does not implement Home/End on `<input type=number>` consistently) |
| End | channel spinbutton focused | set value to `aria-valuemax` (APG Spinbutton) | enhancer |
| Page Up | channel spinbutton focused | increment by large step (10 for 0–255 channels, 10° for hue, 10% for saturation/lightness/alpha) | enhancer (APG Spinbutton optional) |
| Page Down | channel spinbutton focused | decrement by large step | enhancer |
| printable chars / backspace | hex input or channel spinbutton focused | standard text / number editing; enhancer re-derives and syncs all other inputs on `input` event | platform + enhancer sync |
| ArrowLeft / ArrowRight | swatch grid toolbar | move focus to previous / next swatch button (roving tabindex, wraps; APG Toolbar horizontal) | enhancer (`collection-nav` sub-pattern; do NOT hand-roll) |
| Home / End | swatch grid toolbar | move focus to first / last swatch | enhancer |
| Enter / Space | swatch button focused | apply swatch color: sync all inputs + the native input to the swatch value; do NOT confirm (user still clicks Confirm to commit) | enhancer |
| Enter | confirm button focused | confirm: write value to the hidden `<input name>` → triggers `input` + `change` events → closes popover | platform (button) + enhancer (sync + close) |
| Enter / Space | cancel button focused | discard ephemeral edit → restore all channel inputs to the last confirmed value → close popover | platform (button) + enhancer (restore + close) |

### Focus management

- **Initial focus on open**: the enhancer moves focus to the first visible text input (hex input when
  format=hex, else the first channel spinbutton of the active format). This matches the expected
  picker UX: the user sees the current hex and can immediately edit it.
- **No trap**: the popover is non-modal. Tab moves forward through all picker controls and exits the
  popover when Tab is pressed on the cancel button (the last focusable). The enhancer listens for
  `focusout` events on the popover panel and closes the popover when focus moves outside (equivalent
  to light-dismiss via focus).
- **Restore on close**: on any close path (Esc, confirm, cancel, Tab-out, click-outside), focus
  returns to the trigger button. The enhancer records the trigger reference at open time.
- **Roving tabindex in the swatch grid**: the swatch `role="toolbar"` has `tabindex="-1"` on all
  swatch buttons except the active one (the currently-selected swatch or the first swatch if none
  is selected), which has `tabindex="0"`. This makes the entire swatch grid a SINGLE tab stop.
  Arrow keys move focus between swatches. This is the APG Toolbar pattern applied to a swatch
  grid; the enhancer manages it (the same `collection-nav` sub-behavior used by toolbar). The swatch
  grid is an OPTIONAL element; when no swatches are provided the grid is absent and this management
  is skipped.
- **Format toggle button**: a plain `<button>` in the tab order; no special management needed.
- **Eyedropper button**: when `EyeDropper` API is absent at runtime, the button is in the DOM with
  `hidden` (set by the template when `eyedropper=false`, or conditionally revealed by the enhancer
  if the API is available at mount). When hidden it is absent from the tab order.
- **Shared mechanism composed**: the **popover seam** (native `popover` attribute + CSS Anchor
  Positioning) handles positioning and click-outside light-dismiss. The `collection-nav` sub-behavior
  from the shared `collection-nav.enhancer.ts` handles swatch-grid roving. The full `focus-trap`
  enhancer is NOT composed (non-modal picker). Do NOT hand-roll either of these.

### Live region
A `role="status"` live region `<span aria-live="polite" aria-atomic="true">` is rendered inside the
popover, hidden visually with `sr-only`. The enhancer updates it when a swatch is applied:
`"Color set to #ff6b6b"`. This is the only announcement; channel spinbutton changes are self-announcing
via `aria-valuenow`. The live region is always present in the DOM (not injected by JS) to respect CSP.

### APG citations
- Spinbutton: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/
- Toolbar: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
- Button: https://www.w3.org/WAI/ARIA/apg/patterns/button/
- The composite color picker as a whole has NO APG pattern page; this is a BUILT implementation
  assembled from the three sub-patterns above.

## 5. Tokens

### Existing tokens consumed

| token | usage |
|---|---|
| `--lv-color-popover` | popover panel background |
| `--lv-color-popover-fg` | popover text + label color |
| `--lv-color-border` | trigger button border, channel input borders, swatch grid outline |
| `--lv-color-input` | hex input + channel spinbutton background |
| `--lv-color-accent` | swatch `aria-pressed="true"` highlight ring |
| `--lv-color-accent-fg` | swatch selected indicator text (if any) |
| `--lv-color-muted` | color preview background when value is empty/invalid |
| `--lv-color-fg` | primary text inside popover |
| `--lv-color-destructive` | trigger + hex input border/ring when `aria-invalid` |
| `--lv-color-primary` | confirm button (reuses the primary button token pair) |
| `--lv-color-primary-fg` | confirm button text |
| `--lv-ring` | focus-visible ring on all interactive elements |
| `--lv-radius-md` | trigger button + channel inputs radius |
| `--lv-radius-sm` | swatch chip radius |
| `--lv-radius-lg` | popover panel radius |
| `--lv-shadow-md` | popover panel elevation |
| `--lv-z-popover` | popover z-index |
| `--lv-space-{1,2,3,4,6,8,9,10}` | trigger height, internal padding, swatch gap |
| `--lv-text-{xs,sm,base}` | channel labels, hex input text |
| `--lv-font-mono` | hex value display (hex string is monospaced) |

### NET-NEW tokens proposed

| token | kind | `:root` value | `.dark` override | justification |
|---|---|---|---|---|
| `--lv-color-swatch-border` | OKLCH color | `oklch(0.80 0.00 0)` (light gray) | `oklch(0.40 0.00 0)` | swatch chip border needs a neutral tone distinct from `--lv-color-border` (which is interactive-input-grade); a lighter/subtler border for display chips is a recurring need (badge, chip too) |
| `--lv-space-5` | spacing | `1.25rem` (20 px) | — | needed for the swatch chip size (`20×20 px`); the existing scale has `--lv-space-4` (16 px) and `--lv-space-6` (24 px) with no intermediate; this is additive and structural (not a colour) |
| `--lv-cp-swatch-size` | sizing alias | `var(--lv-space-5)` | — | documents that the swatch square is `--lv-space-5 × --lv-space-5`; an adopter can override swatch size independently by setting this alias without touching structural spacing |
| `--lv-cp-preview-size` | sizing alias | `calc(var(--lv-space-9) - 4px)` | — | the colored preview square inside the trigger button is derived from the trigger height minus the 2 px border on each side; externalised so size-variant overrides stay single-point |

All four are additive. The two OKLCH colours are authored in the source-of-truth format (architecture
contract §4). No baked-in literals appear in the component body.

## 6. Wire / island integration

### Server-rendered JTE structure

The component is a PARTIAL (not WIRE) because the server does not own the ephemeral in-picker editing
state — only the committed color value is a form field. The JTE template renders:

```
<div role="group" aria-label="..." data-lv-color-picker data-lv-cp-alpha="..." ... data-slot="color-picker">

  <!-- Trigger button (opens the popover) -->
  <button type="button" id="<id>-trigger"
          aria-expanded="false"
          aria-haspopup="dialog"
          aria-controls="<id>-popover"
          aria-label="Pick color: #rrggbb"
          data-slot="trigger">
    <span class="..." style="background-color: <value>" aria-hidden="true"></span>  <!-- preview swatch -->
    <span class="font-mono ...">#rrggbb</span>  <!-- current value label -->
  </button>

  <!-- Hidden native input: synced by enhancer; submitted with the form -->
  <input type="color" id="<id>-native" name="<name>" value="<value>"
         aria-hidden="true" tabindex="-1" data-slot="native-input">

  <!-- Popover panel (closed by default via popover attribute) -->
  <div id="<id>-popover" role="dialog" aria-label="Color picker" aria-modal="false"
       popover data-slot="popover">

    <!-- Color preview square -->
    <div class="..." aria-hidden="true" data-slot="color-preview"></div>

    <!-- Format inputs: hex group (shown when format=hex, hidden otherwise) -->
    <div data-slot="hex-group" !{hiddenIfNotFormat("hex", format)}>
      <label for="<id>-hex">Hex</label>
      <input type="text" id="<id>-hex" value="<value>"
             aria-label="Hex color"
             aria-describedby="<id>-hex-hint"
             maxlength="7"
             data-slot="hex-input">
      <span id="<id>-hex-hint" class="sr-only">#rrggbb</span>
    </div>

    <!-- RGB group (shown when format=rgb) -->
    <div data-slot="rgb-group" !{hiddenIfNotFormat("rgb", format)}>
      <label for="<id>-r">R</label>
      <input type="number" id="<id>-r" value="..." min="0" max="255" step="1"
             aria-label="Red" aria-valuemin="0" aria-valuemax="255" aria-valuenow="..."
             data-slot="channel-r">
      <!-- G and B inputs follow same pattern -->
    </div>

    <!-- HSL group (shown when format=hsl) -->
    <div data-slot="hsl-group" !{hiddenIfNotFormat("hsl", format)}>
      <!-- H: 0–360, S: 0–100, L: 0–100 -->
    </div>

    <!-- Alpha slider (only when alpha=true) -->
    !{if alpha}
    <div data-slot="alpha-group">
      <label for="<id>-a">Alpha</label>
      <input type="range" id="<id>-a" min="0" max="100" step="1" value="<alphaValue>"
             aria-label="Alpha" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<alphaValue>"
             aria-valuetext="<alphaValue>%"
             data-slot="alpha-input">
    </div>
    !{/if}

    <!-- Format toggle + eyedropper row -->
    <div data-slot="format-row">
      <button type="button" aria-label="Format: Hex" data-slot="format-toggle">HEX</button>
      !{if eyedropper}
      <button type="button" aria-label="Pick color from screen" data-slot="eyedropper-btn">
        @template.lievit.icon(name="eyedropper", ariaHidden=true)
      </button>
      !{/if}
    </div>

    <!-- Swatch grid (only when swatches non-empty) -->
    !{if !swatches.isEmpty()}
    <div role="toolbar" aria-label="Color presets"
         data-slot="swatches" data-lv-cp-swatch-count="${swatches.size()}">
      !{for swatch in swatches}
      <button type="button"
              aria-label="${swatch}"
              aria-pressed="${swatch.equalsIgnoreCase(value) ? 'true' : 'false'}"
              tabindex="${swatch.equalsIgnoreCase(value) ? '0' : '-1'}"
              data-color="${swatch}"
              data-slot="swatch"
              style="background-color: ${swatch}">
      </button>
      !{/for}
    </div>
    !{/if}

    <!-- Live region for swatch announcements -->
    <span role="status" aria-live="polite" aria-atomic="true"
          class="sr-only" data-slot="live-region"></span>

    <!-- Confirm / Cancel -->
    <div data-slot="actions">
      <button type="button" aria-label="Confirm color" data-slot="confirm-btn">OK</button>
      <button type="button" aria-label="Cancel" data-slot="cancel-btn">Cancel</button>
    </div>

  </div><!-- /popover -->
</div><!-- /group -->
```

Key JTE conventions:
- `!{var hiddenIfNotFormat = ...}` computes the `hidden` / `aria-hidden="true"` attribute string for
  each format group (active = no attribute, inactive = `hidden aria-hidden="true"`).
- The `style="background-color: ..."` on swatch and preview square is the ONE permitted use of an
  inline style here: it is a dynamic CSS property value (not a class), and the value is the color
  string itself which is always a valid CSS color. The CSP allows `style` attributes for property
  values (it forbids `<script>` and `on*=` handlers, not CSS property assignments). A static
  `--lv-cp-swatch-color: <value>` custom property via `style` is preferred if the adopter's CSP
  disallows all `style=` attributes: document this in the header comment.
- Zero `<script>`, zero `on*=` handlers.
- `data-slot` on every addressable element for test targeting.
- The two escaping channels apply: swatch colors from `swatches` list arrive via `dataAttrs`
  (escaped), never raw in `attrs`.

### Typed-TS enhancer responsibilities (`color-picker.enhancer.ts`)

Mounted by the runtime lifecycle registry when `[data-lv-color-picker]` is present in the DOM. The
enhancer does NOT touch any element that is not under its root. It does NOT fire server round-trips
during editing (no wire actions during channel edits). It fires exactly one external event: the
`input` + `change` events on the native `<input type="color">` after confirm, which the consuming
form or WIRE template binds via `l:model` or a standard form submit.

Responsibilities:

1. **Format-group visibility**: manages `hidden` / `aria-hidden` on the three format groups
   (hex/rgb/hsl) when the format-toggle button is clicked. Updates the button's `aria-label` to
   reflect the new format. Does NOT re-render server markup; only toggles HTML attributes on the
   already-rendered groups.

2. **Channel sync**: on `input` event on any hex/channel/alpha input, re-derives all other
   representations (hex ↔ RGB ↔ HSL ↔ alpha) and writes the derived values into the other inputs'
   `value` property + `aria-valuenow`. Updates the color-preview square's `style.backgroundColor`.
   This is a pure-client derived-state calculation (sub-keystroke latency required; a server
   round-trip per keystroke would be UX-breaking).

3. **Swatch roving tabindex**: initialises and maintains the roving-tabindex model on the swatch
   toolbar (one `tabindex="0"` at a time, arrow keys move it). This is the `collection-nav`
   sub-behavior; the enhancer composes it from the shared `collection-nav` utility rather than
   hand-rolling. On swatch `Enter`/`Space`, applies the swatch color to all channel inputs + the
   preview square + the live region announcement, WITHOUT confirming.

4. **Eyedropper**: on eyedropper-btn click, checks `window.EyeDropper`; if present, opens it
   (`new EyeDropper().open()`) and on resolve applies the picked color to all channels. If
   `EyeDropper` is absent and the button is in the DOM, the button gets `aria-disabled="true"`
   and `title="Not supported in this browser"` (graceful degradation).

5. **Popover open/close**: opens the popover (via the native `popover` API: `panel.showPopover()`)
   on trigger click; moves focus to the first visible channel input; records the trigger as the
   focus-restore target. On Esc keydown inside the popover, cancels the ephemeral edit and closes.
   On Tab-out (`focusout` when `relatedTarget` is outside the panel), closes. On confirm-btn click,
   writes the final color to the native input + fires `input` + `change` events + closes. On
   cancel-btn click, restores all channel inputs to the last confirmed value + closes. On close,
   restores focus to the trigger.

6. **Spinbutton Home/End/PageUp/PageDown**: supplements the platform's `<input type="number">`
   (which does not implement Home/End/PageUp/PageDown consistently across browsers) by intercepting
   those keydown events and setting the input's value + `aria-valuenow` + running channel sync.

7. **aria-valuenow maintenance**: after any channel edit, updates `aria-valuenow` and `aria-valuetext`
   on the active spinbutton. For HSL channels, `aria-valuetext` includes the unit (e.g.
   `"Saturation: 75%"`, `"Hue: 240 degrees"`).

8. **trigger aria-label sync**: after confirm, updates the trigger button's `aria-label` to
   `"Pick color: <newHex>"` so screen-reader users hear the updated value on next focus.

The enhancer is registered via the directive/lifecycle registry (ADR-0019): it does not modify the
runtime core. It uses `data-slot` selectors (e.g. `root.querySelector('[data-slot="hex-input"]')`)
to locate elements; it is immune to markup structure changes as long as `data-slot` values are stable.

## 7. Acceptance tests (the gate — refute-by-default)

All tests run on a REAL substrate. No mocked `$lievit`, no mocked channel-sync. The client-island
fidelity lesson applies here: the channel-sync and swatch-roving behaviors are exactly the kind of
client logic that slips through fake-substrate tests.

### Render (jsdom + REAL enhancer mounted via real `LievitRuntime`)
- **trigger renders with correct initial value**: the trigger `<button>` contains the hex string
  `#3b82f6` and its preview swatch has `style.backgroundColor` matching that value.
- **trigger aria-label contains current value**: `aria-label="Pick color: #3b82f6"`.
- **popover closed by default**: the popover panel has the `popover` attribute; `showPopover()` has
  not been called; the panel is not visible.
- **native input hidden and aria-hidden**: `[data-slot="native-input"]` has `aria-hidden="true"`,
  `tabindex="-1"`, and `name` matching the `name` param.
- **format groups rendered**: all three format groups (hex, rgb, hsl) are present in the DOM;
  hex group is visible, rgb and hsl groups have `hidden` attribute (default format=hex).
- **swatches render when provided**: given `swatches=["#ff0000","#00ff00"]`, two `[data-slot="swatch"]`
  buttons are rendered with `aria-label="#ff0000"` / `"#00ff00"`; the matching swatch has
  `aria-pressed="true"` and `tabindex="0"`, the other has `tabindex="-1"`.
- **alpha row absent when alpha=false**: no `[data-slot="alpha-input"]` in the DOM.
- **alpha row present when alpha=true**: `[data-slot="alpha-input"]` present with `aria-valuemax="100"`.
- **eyedropper button absent when eyedropper=false**: no `[data-slot="eyedropper-btn"]` in the DOM.
- **disabled state**: when `disabled=true`, the trigger has `disabled` attribute; the root group has
  `aria-disabled="true"`; clicking the trigger does not open the popover.
- **data-size attribute**: root has `data-size="md"` (or whichever size was passed).
- **data-slot on root**: root has `data-slot="color-picker"`.

### axe-core (zero violations on the open picker)
- Open the popover; run axe-core on the whole picker DOM.
- Assert zero violations of rules: `color-contrast` (skip on the swatch preview square only —
  it IS the color), `aria-required-attr` (spinbuttons have `aria-valuenow`), `aria-valid-attr-value`,
  `button-name` (every button has an accessible name), `landmark-no-duplicate-*`, `scrollable-region-focusable`.
- An icon-only button without `aria-label` MUST fail the `button-name` axe rule (regression guard).

### Keyboard (each key asserted on the REAL enhancer — NOT a mocked substrate)
- **Enter on trigger opens popover**: after `trigger.dispatchEvent(keydown Enter)`, assert the popover
  is open and focus is on the hex input (format=hex) or first channel spinbutton (format=rgb).
- **Esc closes popover and restores focus**: open the picker, press Esc, assert the popover is closed
  and `document.activeElement === trigger`.
- **Tab out closes popover**: open the picker, Tab through all controls to the cancel button, Tab once
  more, assert the popover is closed and focus is after the trigger in DOM order.
- **ArrowUp on R spinbutton increments**: with value `#0080ff` (R=0), focus `[data-slot="channel-r"]`,
  dispatch ArrowUp, assert `aria-valuenow="1"` and the hex input now shows `#0180ff`.
- **ArrowDown on R spinbutton decrements**: same setup with R=1, ArrowDown → R=0.
- **Home on R spinbutton sets to 0**: ArrowDown on R=5 then Home → R=0.
- **End on R spinbutton sets to 255**: End on any R value → R=255.
- **PageUp on H spinbutton increments by 10**: Hue=20, PageUp → Hue=30.
- **Enter on swatch applies color without confirming**: click a swatch chip via keyboard Enter, assert
  the hex input reflects the swatch color AND the native input value has NOT changed yet (not confirmed).
- **ArrowRight in swatch grid moves focus**: with two swatches, focus first swatch, ArrowRight, assert
  `document.activeElement` is the second swatch button.
- **ArrowLeft wraps from first to last swatch**: on first swatch, ArrowLeft, assert focus moves to the
  last swatch.
- **Enter on confirm writes value and closes**: enter a hex value via the hex input, click confirm,
  assert the native input value == the entered hex, the popover is closed, focus is on the trigger,
  and the trigger aria-label updated.
- **Enter on cancel restores original value and closes**: open picker (initial value `#3b82f6`), edit
  hex to `#ff0000`, press cancel, assert the hex input reverts to `#3b82f6`, the native input is still
  `#3b82f6`, the popover is closed.

### Channel sync (the core enhancer behavior — REAL enhancer, no mock)
- **Hex → RGB sync**: set hex input to `#ff8000`, fire `input` event, assert R channel shows `255`,
  G shows `128`, B shows `0`, and the preview square background matches.
- **RGB → hex sync**: set R=255, G=0, B=0, fire `input` on R, assert hex input shows `#ff0000`.
- **HSL → hex sync**: switch to HSL format, set H=240, S=100, L=50, fire `input` on L, assert hex
  input shows `#0000ff`.
- **Alpha sync**: with `alpha=true`, set alpha to 50, assert `aria-valuenow="50"` and `aria-valuetext="50%"`.
- **Out-of-range clamping**: set R to 300 (above max 255), fire `input`, assert the channel is clamped
  to 255 and the hex input reflects the clamped value.
- **Invalid hex graceful handling**: type `#zzzzzz` in the hex input, assert the other channels are NOT
  updated to garbage (enhancer ignores parse failures and maintains last valid state).

### Focus
- **Initial focus on open**: after trigger Enter, `document.activeElement` is the hex input (format=hex)
  or first channel spinbutton (format=rgb or format=hsl).
- **Focus restore on close**: open → Esc → `document.activeElement === trigger`.
- **Swatch roving has one tab stop**: only one swatch button has `tabindex="0"` at any time; all others
  have `tabindex="-1"`. The Tab key from outside the swatch grid lands on exactly one button.

### Format toggle
- **Format toggle cycles correctly**: initial format=hex; click format-toggle three times, assert
  aria-label goes `"Format: RGB"` → `"Format: HSL"` → `"Format: Hex"`.
- **Switching format preserves color**: set hex to `#ff8000`, switch to RGB, assert R=255 / G=128 / B=0;
  switch to HSL, assert H≈30 / S=100% / L=50%.

### Eyedropper (conditional)
- **Eyedropper button absent when eyedropper=false**: `[data-slot="eyedropper-btn"]` not in DOM.
- **Eyedropper graceful degradation**: when `eyedropper=true` and `window.EyeDropper` is `undefined`,
  assert the button has `aria-disabled="true"` and `title="Not supported in this browser"`.
- **Eyedropper applies color**: mock `window.EyeDropper` to return `{sRGBHex: "#123456"}`, click
  eyedropper-btn, assert all channel inputs and the hex input reflect `#123456`.

### Variants / sizes
- **sm size**: trigger height token class matches `--lv-space-8`; `data-size="sm"` on root.
- **md size (default)**: trigger height token class matches `--lv-space-9`; `data-size="md"` on root.
- **lg size**: trigger height token class matches `--lv-space-10`; `data-size="lg"` on root.
- **aria-invalid state**: render with `aria-invalid="true"` on the wrapper; assert trigger and hex
  input have destructive-ring token classes; axe-core reports zero `aria-valid-attr-value` violations.

### Escaping (XSS abuse-case)
- **Hostile swatch value is escaped**: `swatches = ['"><script>alert(1)</script>']` renders with the
  value HTML-escaped in `aria-label` and `data-color`; no `<script>` tag is injected into the DOM.
- **Hostile name param is escaped**: `name = '"><img/src=x'` is escaped in the native input's `name`
  attribute; no broken HTML is produced.

### JTE compiles + renders
Covered by the `test/jte-compile` real-compiler + render gate. The template must compile and render
without error for all combination of: `format ∈ {hex,rgb,hsl}`, `alpha ∈ {true,false}`,
`eyedropper ∈ {true,false}`, `swatches` empty and non-empty, `disabled ∈ {true,false}`,
`size ∈ {sm,md,lg}`.

### Playwright (gesture fidelity — real browser, legacy-VM oracle)
- **Full pick flow**: real `page.click(trigger)` → picker opens → real `page.keyboard.type("#abcdef")`
  in hex input → real `page.click(confirm-btn)` → assert the form field value is `#abcdef` and the
  trigger label updated. NOT a jsdom simulation — a real browser render.
- **Swatch pick flow**: real click on a preset swatch → real click confirm → assert submitted value
  matches the swatch color.
- **Keyboard close**: real `page.keyboard.press("Escape")` while picker is open → assert picker is
  closed and trigger is focused.

## 8. Non-goals / anti-patterns

- **NO full-canvas gradient picker** (HSV gradient square + saturation/value 2D drag): this is a
  heavy-client surface (continuous pointer drag, real-time color update) that belongs in a
  specialized creative tool, not in an admin/gestionale form control. Use `<input type="color">` if
  the platform's native gradient picker is needed. This is the Ant Design "full" mode — deliberately
  NOT included.
- **NO copy-paste hex helpers as separate buttons**: the hex input is a standard text input;
  Ctrl+C / Ctrl+V work natively. A "copy" icon button would duplicate platform behavior and clutter
  the keyboard map.
- **NO server round-trips during ephemeral channel editing**: the color derivation (hex ↔ RGB ↔ HSL)
  is a pure-math operation in the enhancer. Routing each keystroke through a wire action would
  introduce latency and unnecessary server load. The server only sees the committed final value.
- **NO real-time preview outside the popover during editing**: the trigger shows the COMMITTED color
  (the last confirmed value). Only the preview square INSIDE the popover reflects the live ephemeral
  edit. Updating the trigger in real time during editing would give unsaved state the appearance of
  saved state.
- **NO auto-confirm on swatch click**: clicking a swatch applies the color to the channel inputs and
  preview but requires the user to press Confirm. Auto-confirming on swatch click skips the opportunity
  to adjust (e.g. pick a swatch then adjust the lightness) and violates the explicit-commit model that
  matches server-side form validation expectations.
- **NO `<input type="color">` as the primary UI** (beyond the hidden sync target): the platform's
  native color picker has no stable cross-browser UX (it is a gradient drag on Chrome, a swatch
  picker on Firefox, a system dialog on Safari). The lievit color-picker provides a consistent,
  accessible UX on top of the native input, which remains as the form-submission sink.
- **NO framework dependency** in the enhancer: no Alpine, no Lit, no React, no libraries. The channel
  sync is a ~30-line math module (hex-to-rgb, rgb-to-hsl, hsl-to-hex, clamp). The CSP is `script-src
  'self'`; dynamic import is allowed, eval is not. The enhancer is a single typed-TS module, bundled
  into the lievit runtime bundle (ADR-0019).
- **NO re-implementation of swatch roving**: compose the `collection-nav` sub-behavior from the shared
  `collection-nav.enhancer.ts`. Hand-rolling an arrow-key roving for swatches creates a second source
  of truth for the exact behavior the entire shared mechanism was built to prevent.

## 9. Agent instructions (the discipline reminders)

Generate ORIGINAL code over `--lv-*` tokens. You MAY read Ant Design ColorPicker + any public
WAI-ARIA APG examples + Tailwind UI inputs as references for PATTERN (a11y semantics, variant
inventory, visual look). You MUST NOT paste literal source from ANY of them — the output is always
original generation (the one bright line, `02-licensing.md`).

Mirror `button.jte`'s house conventions EXACTLY: header doc-comment with the credits line
(citing APG Spinbutton + APG Toolbar as the sub-pattern sources), typed `@param`, `data-slot` on
every addressable element, the two escaping channels (`attrs` trusted-raw / `dataAttrs` safe-escaped),
zero `<script>`, zero `on*=` handlers.

Compose the `collection-nav` sub-behavior (for swatch-grid roving) and the popover seam (for
positioning + light-dismiss). Do NOT hand-roll either. The popover seam is the ONE positioning
mechanism; do not add a custom positioning calculation.

The swatch color values arrive as a `List<String>` parameter from the controller. They go through
the SAFE `dataAttrs` / escaped channel in the `data-color` attribute — NEVER through `attrs` raw.
The `style` attribute on swatch buttons and the preview square is the one permitted inline-style
use (a CSS property value, not a handler). If the adopter's CSP forbids all `style=`, document a
CSS custom property alternative in the header comment.

The channel sync math (hex ↔ RGB ↔ HSL) is a pure function; write it as a small typed-TS utility
module imported by the enhancer, NOT as an inline anonymous function in the event handler. This
makes it unit-testable in isolation.

The `aria-label` on the trigger button MUST be updated after confirm by the enhancer. This is
load-bearing: a screen-reader user on the trigger must hear the newly selected color without having
to open the picker.

Minimal code to GREEN against the acceptance tests. The keyboard map is the contract — assert ALL
of it (including Home/End/PageUp/PageDown on spinbuttons, which are the keys most implementations
miss). The channel-sync tests are not optional; they are the core behavior.
