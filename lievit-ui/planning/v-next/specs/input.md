<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — input

- **tier**: PARTIAL (`l:model` wiring for form binding; no WIRE component needed — value is always a form
  field the controller owns, not an isolated server-fact needing its own component lifecycle)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/input.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA 1.2 §textbox role (https://www.w3.org/TR/wai-aria-1.2/#textbox) — the native
      `<input type="text|…">` IS the textbox; no react-aria reference needed because the platform supplies
      role + keyboard + focus for free. There is no dedicated APG Textbox pattern page (confirmed
      2026-06-24 against https://www.w3.org/WAI/ARIA/apg/patterns/): the textbox is a native element,
      not a custom widget. Labeling follows APG "Providing Accessible Names and Descriptions"
      (https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/).
    - inventory: Ant Design Input as inventory reference (prefix/suffix/adornments, clearable,
      show-count, status, size, borderless; search-compound composes this partial inside a
      `input-group`; password-toggle is an optional trailing slot here)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code
      copied)

## 1. What it is

A single-line text input control — the foundational form primitive. It wraps a native `<input>` element
inside a styled container that supports a leading adornment (icon, text prefix), a trailing adornment
(icon, clear button, character count, unit label), and four semantic states (default, focused,
invalid, disabled). Its only job is presentation and wiring: it holds no state, emits no events itself,
and cannot fail silently. The consuming controller binds the value via `l:model` or a plain `name`
attribute in a `<form>`. PARTIAL tier is correct because value ownership belongs to the form / controller,
not to a lievit component lifecycle; a native `<input>` already supplies role=textbox, keyboard
interaction, and focus management for free. Server-first works trivially: the server renders the current
field value into `value="${…}"` and the user sees it immediately — no client round-trip for render.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `type` | `String` | `"text"` | the HTML `type` attribute: `text \| email \| password \| search \| url \| tel \| number`. Affects browser validation + keyboard on mobile. Pass `"password"` to get the native masking; the optional trailing password-toggle uses the `trailing` slot. |
| `name` | `String` | `null` | the `name` attribute for plain form submission. Either `name` or `l:model` (via `attrs`) is required in practice; the partial accepts either. |
| `value` | `String` | `""` | the initial/server-set value rendered into `value="…"`. |
| `placeholder` | `String` | `null` | hint text shown when empty. NOT a substitute for a visible label (APG labeling rules). |
| `id` | `String` | `null` | the `id` for `<label for>` association. When absent the `<input>` has no `id`; the consuming template must either supply one or use `aria-label` / `aria-labelledby`. |
| `size` | `String` | `"md"` | `sm \| md \| lg` — HEIGHT-based, toolbar-aligned (see §3). |
| `disabled` | `boolean` | `false` | native `disabled`; dims + blocks interaction; excluded from tab order. |
| `readonly` | `boolean` | `false` | native `readonly` + `aria-readonly="true"`; focusable, copyable, not editable. |
| `required` | `boolean` | `false` | native `required` + `aria-required="true"`; consumed by the `field` partial for the required marker; drives browser built-in validation. |
| `invalid` | `boolean` | `false` | sets `aria-invalid="true"` + switches to destructive border + ring. The consuming `field` partial sets this from server-side validation state. |
| `autocomplete` | `String` | `null` | the `autocomplete` attribute value (e.g. `"email"`, `"current-password"`, `"off"`). Forwarded verbatim. |
| `inputmode` | `String` | `null` | the `inputmode` attribute (`"numeric"`, `"decimal"`, `"email"`, etc.) for mobile keyboard hints. Forwarded verbatim. |
| `maxlength` | `Integer` | `null` | the `maxlength` attribute. When set with `showCount=true`, the count reads this as the denominator. |
| `showCount` | `boolean` | `false` | NET-NEW vs current: renders a live character-count badge in the trailing area (`x / maxlength` or bare `x`). Count is driven by a lightweight `input-count.enhancer.ts` (see §6). Only meaningful when `type` is one of the text types. |
| `clearable` | `boolean` | `false` | NET-NEW: renders a clear button in the trailing area when the field has a value. The clear button fires a wire action or dispatches a DOM `lv:clear` event that the consuming template handles (see §6). |
| `borderless` | `boolean` | `false` | drops the visible border; used inside table cells or inline-edit surfaces. Focus ring still appears. |
| `cssClass` | `String` | `""` | extra utility classes applied to the OUTER container div (not the `<input>`). |
| `inputCssClass` | `String` | `""` | extra utility classes applied directly to the `<input>` element. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only: `l:model="field"`, `l:keydown.enter="submit"`, `data-testid="…"`, `autofocus`. Never user-derived data. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` (each value through `Escape.htmlAttribute`). For per-row context that must reach an event handler or wire action. |
| `leading` | `gg.jte.Content` | `null` | left adornment slot: an icon (`@template.lievit.icon`), a currency symbol, a country-code chip, or any short inline element. Rendered inside the container, visually before the `<input>`. `aria-hidden="true"` on purely decorative content is the caller's responsibility. |
| `trailing` | `gg.jte.Content` | `null` | right adornment slot: a unit label, a visibility-toggle button for password, a loading spinner, or any short inline element. Rendered after the `<input>` and after `showCount`/`clearable` controls when those are also present. Caller is responsible for any accessible names on interactive content in this slot. |

**Escaping channels summary** (the load-bearing XSS rule):
- `attrs` = TRUSTED raw (`$unsafe`) — author-typed STATIC strings; never feed user/DB data here.
- `dataAttrs` = SAFE escaped via `Escape.htmlAttribute` — any per-row or dynamic value goes here.
- `value`, `placeholder`, `id`, `name`, `autocomplete`, `inputmode` = passed through JTE's default
  HTML-attribute escaping (they are typed `String` params rendered into attribute position by JTE's
  normal output, not `$unsafe`).

## 3. Variants / sizes / states

### Sizes (height-based, toolbar-aligned)

| size | height token | font | horizontal padding | meaning |
|---|---|---|---|---|
| `sm` | `--lv-space-8` (32px) | `--lv-text-xs` | `--lv-space-3` | compact; toolbar / table-cell |
| `md` | `--lv-space-9` (36px, **default**) | `--lv-text-sm` | `--lv-space-3` | standard form field; shadcn baseline |
| `lg` | `--lv-space-10` (40px) | `--lv-text-base` | `--lv-space-4` | prominent / hero form |

A `button`, `input`, `native-select`, and `select (rich)` of the same `size` are pixel-aligned — the
same `--lv-space-{8,9,10}` height token governs all of them (architecture contract §5.b).

### Variants (intent)

The `input` partial has no `variant` param in the sense of colour intent (it is not an action).
Its visual intent is expressed entirely through STATE. However, `borderless=true` is a layout variant
used inside table cells, inline-edit rows, and builder surfaces.

### States

| state | trigger | visual expression | ARIA |
|---|---|---|---|
| default | — | `--lv-color-border` outline, `--lv-color-input` background | — |
| hover | `:hover` | `--lv-color-border-hover` outline brightens | — |
| focus-visible | `:focus-visible` on `<input>` | `--lv-ring` focus ring on the container (CSS `:focus-within`) | platform (native focus) |
| invalid | `invalid=true` | `--lv-color-destructive` border + destructive ring | `aria-invalid="true"` on `<input>` |
| disabled | `disabled=true` | `--lv-color-fg-muted` text, dimmed background, `cursor:not-allowed` | native `disabled`; removed from tab order |
| readonly | `readonly=true` | slightly muted background, `cursor:default` | native `readonly` + `aria-readonly="true"` |
| borderless | `borderless=true` | no border, no background; focus ring still shows | — |
| loading (trailing) | caller puts a spinner in `trailing` slot | shows the spinner; `aria-busy` NOT set on the input itself (the spinner is a caller concern) | caller handles `aria-busy` on the wrapping context if needed |

### Slots

| slot | type | purpose |
|---|---|---|
| `leading` | `gg.jte.Content` | icon / prefix symbol before the text area |
| `trailing` | `gg.jte.Content` | icon / suffix / password-toggle / unit label after the text area |

When both `clearable=true` and a `trailing` slot are present, the clearable button appears first
(immediately after the input text area), then the trailing slot content — left-to-right within the
trailing zone, so the caller's trailing content is at the far right edge.

When `showCount=true` and `trailing` is also set, the count badge appears between the clearable
button and the trailing slot.

## 4. The a11y contract

- **WAI-ARIA pattern**: WAI-ARIA 1.2 §textbox role (https://www.w3.org/TR/wai-aria-1.2/#textbox).
  There is NO dedicated APG Textbox pattern page (confirmed 2026-06-24 at
  https://www.w3.org/WAI/ARIA/apg/patterns/). This is intentional: `<input type="text|…">` IS the
  native textbox — the platform supplies `role=textbox`, keyboard interaction, cursor movement,
  clipboard, and focus management without any author intervention. The spec authority for labeling is
  APG "Providing Accessible Names and Descriptions"
  (https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/).

- **roles + ARIA**:
  - `<input>` element carries `role="textbox"` (implicit, via the native element mapping).
    No `role` attribute is set; a redundant `role="textbox"` is noise and breaks for specialised types.
  - `aria-invalid="true"` when `invalid=true`.
  - `aria-readonly="true"` when `readonly=true` (native `readonly` also present).
  - `aria-required="true"` when `required=true` (native `required` also present; both are set so
    AT announcements and browser built-in validation align).
  - `aria-disabled` is NOT needed: a native `disabled` attribute already suppresses the control from
    both the tab order and the accessibility tree's interactive node set.
  - `aria-placeholder` is NOT set (the native `placeholder` attribute maps to `aria-placeholder`
    automatically in the accessibility tree; duplicating it is noise).
  - `aria-autocomplete` is NOT set by this partial. A consuming combobox wires it via `attrs`.
  - `aria-multiline` is NOT set; this is a single-line `<input>`, which maps to
    `aria-multiline="false"` by default. The `textarea` spec handles `aria-multiline="true"`.
  - **Labeling (load-bearing)**: an `<input>` MUST have an accessible name. The preferred path is a
    visible `<label for="<id>">` in the enclosing `field` partial — this gives the broadest AT support
    + click-target enlargement. The `id` param enables the association. When a visible label is not
    available, the caller must pass `aria-label="…"` or `aria-labelledby="…"` via `attrs`. The
    `placeholder` attribute MUST NOT be the sole accessible name (it disappears on focus and has
    poor AT support as a label; WCAG SC 3.3.2 + APG labeling rules).

- **keyboard map** (all platform-supplied by the native `<input>` element — no enhancer required):

  | key | action | who |
  |---|---|---|
  | `Tab` / `Shift+Tab` | move focus to / away from the field | platform |
  | any printable character | insert at cursor / replace selection | platform |
  | `Backspace` / `Delete` | delete character behind / ahead of cursor | platform |
  | `ArrowLeft` / `ArrowRight` | move cursor one character | platform |
  | `ArrowLeft` / `ArrowRight` + `Shift` | extend/shrink selection by one character | platform |
  | `Home` / `Ctrl+ArrowLeft` | move cursor to start of field | platform |
  | `End` / `Ctrl+ArrowRight` | move cursor to end of field | platform |
  | `Home` / `End` + `Shift` | extend/shrink selection to start/end | platform |
  | `Ctrl+A` / `Cmd+A` | select all content | platform |
  | `Ctrl+C` / `Cmd+C` | copy selection to clipboard | platform |
  | `Ctrl+X` / `Cmd+X` | cut selection | platform |
  | `Ctrl+V` / `Cmd+V` | paste from clipboard | platform |
  | `Ctrl+Z` / `Cmd+Z` | undo last edit | platform |
  | `Enter` | submit the enclosing `<form>` (single-line `<input>` default) OR fire `l:keydown.enter` if wired via `attrs` | platform (submit) / author (custom binding via `attrs`) |
  | `Esc` | (no default for a plain input; a consuming combobox/search may bind this via `attrs`) | author via `attrs` |

  The `clearable` button inside the trailing zone is a real `<button>`; Enter/Space on it fires the
  clear action (platform, the button rule).

- **focus management**: entirely platform. The `<input>` is a naturally-focusable element; it enters
  the tab order unless `disabled`. Focus-visible ring is shown by the CSS `:focus-within` on the
  container using `--lv-ring`. No trap, no roving, no enhancer for focus. `autofocus` may be passed
  via `attrs` when the field should receive focus on page load — use sparingly (one autofocus per page).

- **live region**: none on the `<input>` itself. The `showCount` character count badge is a static
  display element; it does NOT announce every keystroke (that would be unbearable). If the consuming
  field must announce a validation error on-blur, the `field` partial handles it via its `aria-live`
  error region (the `input` partial is not responsible for error announcements).

- **shared mechanism composed**: none (platform-only). The `input` is the simplest tier — a real
  native element over a styled container. No popover seam, no focus-trap, no collection-nav. If this
  input is wrapped in a combobox pattern, the COMBOBOX spec handles the `aria-autocomplete`,
  `aria-controls`, and the listbox keyboard interaction separately.

## 5. Tokens

### Reads (existing token set)

| token | used for |
|---|---|
| `--lv-color-input` | field background |
| `--lv-color-bg` | borderless background fallback |
| `--lv-color-border` | default border |
| `--lv-color-border-hover` | hover border brightening |
| `--lv-color-fg` | text colour |
| `--lv-color-fg-muted` | placeholder text + disabled text |
| `--lv-color-fg-subtle` | leading/trailing adornment icon colour |
| `--lv-color-destructive` | `invalid` border + ring |
| `--lv-color-destructive-fg` | error icon tint inside `leading` when invalid |
| `--lv-color-primary` | (clearable button hover accent) |
| `--lv-ring` | focus-visible ring (`:focus-within` on container) |
| `--lv-space-{8,9,10}` | height per size |
| `--lv-space-{2,3,4}` | internal horizontal padding (scales with size) |
| `--lv-space-1` | gap between leading icon and text |
| `--lv-text-{xs,sm,base}` | font size per size |
| `--lv-font-sans` | font family |
| `--lv-radius-md` | container border-radius |
| `--lv-shadow-xs` | optional subtle inset shadow on the field background |

### Dark mode

All tokens above are re-pointed in the `.dark, [data-theme="dark"]` block in
`registry/tokens/lievit-tokens.css`. No dark-mode rules in the component; re-pointing the token
is sufficient.

### NET-NEW tokens

- `--lv-color-input-disabled` (additive): the muted fill for a disabled input background.
  Without it, the disabled state falls back to `--lv-color-input` with `opacity`, which can cause
  contrast failures on some token overrides. Separate token makes it overridable independently.
  Goes in `:root` + `.dark` blocks. OKLCH value: `oklch(0.94 0 0)` (light) / `oklch(0.22 0 0)`
  (dark) — neutral, slightly lighter/darker than the default input bg.
- `--lv-color-count-fg` (additive): text colour for the character count badge. Distinct from
  `--lv-color-fg-muted` so the badge can be slightly lighter without affecting other muted-text
  usages. `oklch(0.60 0 0)` (light) / `oklch(0.52 0 0)` (dark).

All colour tokens in OKLCH (architecture contract §4, D1 DECIDED).

## 6. Wire / island integration

### Server-rendered JTE structure

The outer element is a `<div data-slot="input" data-size="${size}">` container. It is a flex row
that holds: an optional leading zone, the native `<input>`, and an optional trailing zone. The
`<input>` is a flex-grow child that fills remaining width.

Structure outline (pseudo-JTE; actual implementation generates original code):

```
<div data-slot="input"
     data-size="${size}"
     class="… container classes … ${borderless ? 'lv-input--borderless' : ''} ${invalid ? 'lv-input--invalid' : ''} ${disabled ? 'lv-input--disabled' : ''} ${cssClass}">

  @if(leading != null)
    <span class="lv-input__leading" aria-hidden="true">   <%-- caller labels any interactive content --%>
      ${leading}
    </span>
  @endif

  <input
    type="${type}"
    @if(id != null) id="${id}" @endif
    @if(name != null) name="${name}" @endif
    value="${value}"
    @if(placeholder != null) placeholder="${placeholder}" @endif
    @if(disabled) disabled @endif
    @if(readonly) readonly aria-readonly="true" @endif
    @if(required) required aria-required="true" @endif
    @if(invalid) aria-invalid="true" @endif
    @if(autocomplete != null) autocomplete="${autocomplete}" @endif
    @if(inputmode != null) inputmode="${inputmode}" @endif
    @if(maxlength != null) maxlength="${maxlength}" @endif
    @if(showCount) data-lv-count-max="${maxlength != null ? maxlength : ""}" @endif
    class="lv-input__field ${inputCssClass}"
    $unsafe{attrs}
    !{dataAttrsFragment}
  />

  @if(clearable)
    <button type="button"
            class="lv-input__clear"
            aria-label="Clear"
            data-lv-clear
            tabindex="-1">   <%-- reachable only when field has value; JS shows/hides it --%>
      @template.lievit.icon(name="x", size="sm", ariaHidden=true)
    </button>
  @endif

  @if(showCount)
    <span class="lv-input__count" aria-hidden="true" data-lv-count></span>
  @endif

  @if(trailing != null)
    <span class="lv-input__trailing">
      ${trailing}
    </span>
  @endif

</div>
```

Notes on the structure:
- The container carries `data-slot="input"` (the test selector) and `data-size="${size}"` (the
  styling hook — Tailwind `data-[size=sm]:h-[--lv-space-8]` etc.).
- The leading span is `aria-hidden="true"` because it is decorative by convention; a caller who puts
  an interactive element in the leading slot (rare) must override this in the slot content itself.
- The clear button has `tabindex="-1"` because it is visually inside the field; the `input-count`
  enhancer manages its visibility and makes it keyboard-reachable when the field has a value
  (it adds `tabindex="0"` when shown, removes it when hidden, so it stays out of tab order when empty).
- `data-lv-count` and `data-lv-count-max` are the enhancer's DOM hooks.
- `!{dataAttrsFragment}` is a local computed string built from `dataAttrs` via `Escape.htmlAttribute`
  in a `!{var …}` block at the top of the template — the SAFE escaping channel (architecture contract
  §3 escaping rule).
- Zero `<script>`, zero inline `on*=` (CSP rule).

### Typed-TS enhancers

#### `input-count.enhancer.ts` (NET-NEW, minimal)

Responsibility: update the count badge text on every `input` event; show/hide the clearable button.

Binds to: any `<input>` inside a `data-slot="input"` container that carries `data-lv-count` or
`data-lv-clear` markers.

Behaviour:
- On `input` event, reads `event.target.value.length`. If `data-lv-count-max` is set, renders
  `"${length} / ${max}"`; otherwise renders `"${length}"`. Writes to the sibling `[data-lv-count]` span.
- On `input` event (clearable), shows the `[data-lv-clear]` button (`tabindex="0"`) when value is
  non-empty; hides it (`tabindex="-1"`, `hidden`) when empty.
- On `[data-lv-clear]` button click, clears `<input>.value`, dispatches `lv:clear` (a composed
  CustomEvent) on the input, and hides the clear button. The consuming template (or a parent WIRE
  component) handles `lv:clear` to reset its own state if needed. If a `l:model` binding is active
  on the input, the runtime's `input` event listener will naturally fire after the synthetic clear
  and sync the model.
- Does NOT manage focus (platform handles focus on click; the clear button is inside the container).
- Does NOT announce the count (not appropriate to announce every character change via live region).
- CSP-clean: no `eval`, no `innerHTML`, no inline event handlers.
- Registered via the lievit runtime directive registry (lifecycle `onDocumentReady` scan for
  `data-slot="input"` elements; re-run after morphs via the `onComponentInit` lifecycle hook on
  any parent WIRE component — ensuring dynamic WIRE-rendered inputs also bind the enhancer).

This enhancer is OPTIONAL: fields without `showCount` or `clearable` render with no JS involvement.

#### No other enhancer

All other behaviours (keydown binding, form submission, model binding) are handled by the lievit
runtime's built-in directive system (`l:model`, `l:keydown.enter`, etc.) via the `attrs` param.
There is no per-input enhancer for these; the runtime directive registry already covers them.

## 7. Acceptance tests

Every test runs on a REAL substrate — no mocked runtime, no shortcut assertions on template
shape. This is the client-island-fidelity rule (repo CLAUDE.md: "a test that exercises a fake
substrate certifies nothing about the real interaction").

### Render tests (jsdom, real JTE compile + render, no mocked `$lievit`)

- **renders a native `<input>` inside `data-slot="input"` container**: the root element carries
  `data-slot="input"` and `data-size="md"` (default size); the child `<input>` is present with no
  spurious `role` attribute.
- **type is forwarded**: `type="email"` produces `<input type="email">`.
- **value is forwarded**: `value="hello"` produces `<input … value="hello">`.
- **placeholder is forwarded**: `placeholder="Search…"` produces the attribute on `<input>`.
- **disabled renders native disabled**: `disabled=true` sets the `disabled` attribute; no `aria-disabled`.
- **readonly sets both native and ARIA**: `readonly=true` sets `readonly` + `aria-readonly="true"`.
- **required sets both native and ARIA**: `required=true` sets `required` + `aria-required="true"`.
- **invalid sets aria-invalid**: `invalid=true` produces `aria-invalid="true"` on `<input>`.
- **leading slot renders when provided**: the `lv-input__leading` span is present and contains the
  expected content; absent when `leading=null`.
- **trailing slot renders when provided**: the `lv-input__trailing` span is present; absent when null.
- **clearable renders the clear button with aria-label="Clear"**: `clearable=true` produces a
  `<button aria-label="Clear" data-lv-clear>` in the container.
- **showCount renders the count badge**: `showCount=true` produces `<span data-lv-count>` in the
  container; `maxlength=50` also sets `data-lv-count-max="50"`.
- **borderless sets the borderless modifier class**: `borderless=true` adds the `lv-input--borderless`
  class to the container.
- **each size emits the correct data-size**: sm → `data-size="sm"`, md → `data-size="md"`,
  lg → `data-size="lg"`.
- **attrs is rendered raw (trusted)**: `attrs="l:model=\"email\""` appears verbatim on the `<input>`.
- **dataAttrs escaping (XSS abuse-case)**: `dataAttrs={"confirm": "\">|<script>alert(1)"}` renders
  the value HTML-escaped (never a tag) on the `<input>` element; the hostile string is inert.
- **id forwards to `<input>`**: `id="email-field"` produces `<input id="email-field">`.
- **autocomplete forwards**: `autocomplete="email"` produces `<input autocomplete="email">`.
- **inputmode forwards**: `inputmode="numeric"` produces `<input inputmode="numeric">`.
- **maxlength forwards**: `maxlength=100` produces `<input maxlength="100">`.

### Axe-core assertions (jsdom, zero violations)

- **field with visible label (via `field` partial wrapping)**: renders an input with a `<label for>`
  association; axe reports zero violations including the accessible-name rule.
- **field with `aria-label` via attrs**: `attrs='aria-label="Search"'` — zero violations.
- **field WITHOUT a label and WITHOUT aria-label**: axe-core MUST report an accessible-name
  violation; this asserts the negative case (the spec does not hide the missing-label failure).
- **invalid field**: `invalid=true` with `aria-describedby` pointing to an error message — zero
  violations; the error text is announced correctly.
- **disabled field**: zero violations; the `disabled` attribute correctly removes it from interactive
  checks.

### Keyboard tests (jsdom / real enhancer mounted)

- **Tab reaches the field**: the `<input>` is in tab order when not disabled.
- **Tab does NOT reach a disabled field**: a `disabled` input is not reachable via Tab.
- **Enter submits the enclosing form**: an input inside a `<form>` — Enter on the focused input
  fires the form's `submit` event (platform behaviour, assert it fires).
- **Clear button is reachable by Tab when field has value (clearable)**: after typing a value,
  the enhancer sets `tabindex="0"` on the clear button; Tab from the input reaches it.
- **Clear button is NOT in tab order when field is empty (clearable)**: before any input,
  `[data-lv-clear]` has `tabindex="-1"` (or `hidden`).
- **Enter/Space on clear button fires lv:clear**: the clear button is a real `<button>`; Enter
  fires click → the enhancer dispatches `lv:clear` on the `<input>`.

### Enhancer tests (real `input-count.enhancer.ts` mounted, jsdom)

- **count badge updates on each keystroke**: typing into the field increments the count display.
- **count shows `x / max` when maxlength is set**: typing 3 chars with `maxlength=10` shows `"3 / 10"`.
- **count shows bare `x` when maxlength absent**: typing 5 chars shows `"5"`.
- **clearable button hidden initially (empty value)**: on mount with no initial value, the clear
  button has `tabindex="-1"` (or is hidden).
- **clearable button shown after typing**: typing a character shows the clear button (`tabindex="0"`).
- **clearing resets count and hides button**: clicking the clear button zeros the count badge and
  hides the button.
- **lv:clear event fired on clear**: the clear action dispatches a composed `lv:clear` CustomEvent
  on the `<input>` element.
- **enhancer re-binds after morph**: a simulated morph (innerHTML replace) followed by
  `onComponentInit` hook — the enhancer re-attaches; count still updates.

### Focus tests

- **no focus trap**: Tab from the input reaches the next focusable element in DOM order (assert the
  clear button when present, or the next form control otherwise) — no trap.
- **focus-visible ring visible on `:focus-within`**: when the `<input>` is focused, the container
  has the `:focus-within` state; the ring token class is applied.

### Variant / size / state rendering

- **each size applies the correct height token class**: sm → `h-[--lv-space-8]`, md → `h-[--lv-space-9]`,
  lg → `h-[--lv-space-10]` (Tailwind data-attribute or class; assert via `data-size` + the rendered class).
- **invalid applies destructive classes on the container**: `invalid=true` adds the `lv-input--invalid`
  modifier to the container; the container renders with the destructive border/ring classes.
- **disabled applies disabled modifier**: `disabled=true` adds `lv-input--disabled` on the container.
- **borderless removes border classes**: `borderless=true` applies `lv-input--borderless`; no border
  utility class is present.

### JTE compile + render gate

- Covered by the `test/jte-compile` real-compiler gate that runs on every commit. The input template
  compiles without error and renders with a minimal param set (`type="text"`, `value=""`, `size="md"`).

## 8. Non-goals / anti-patterns

- **Not a combobox**: the `input` partial does NOT wire `aria-autocomplete`, `aria-controls`, or a
  listbox popup. That is the `combobox` component's job. An input wired with `htmx` for suggestions
  is the HTMX recipe, not this partial.
- **Not a textarea**: multi-line text (`aria-multiline="true"`) is the `textarea` spec. This spec
  covers only single-line `<input>` types.
- **Not a numeric spinner**: `type="number"` can be passed but advanced spinner behaviour
  (APG Spinbutton) with up/down buttons is the `spinbutton` component. Here `type="number"` is a
  simple pass-through for mobile keyboards + browser built-in `min`/`max`/`step` validation only.
- **Placeholder is not a label**: the `placeholder` param MUST NOT be passed as the sole accessible
  name. The `field` partial must wrap this input with a visible `<label>` or the caller must pass
  `aria-label`/`aria-labelledby` via `attrs`. No workaround will be added to make placeholder-only
  inputs "pass" axe; they will correctly fail the axe gate.
- **No client-side validation**: the `input` partial does not validate. It reflects server-decided
  `invalid` state. Client-side validation patterns (real-time format checking, async availability
  checks) belong to the consuming WIRE component or to native browser validation via `type`/`pattern`
  attributes passed through `attrs`.
- **No value-masking client logic**: password masking is `type="password"` (native). A visibility
  toggle ("show password" button) is a caller's concern placed in the `trailing` slot; it manipulates
  `type` by dispatching to the server or toggling via a `l:click` wire action in the parent WIRE
  component. The partial is not responsible for the toggle logic.
- **`attrs` is not for user data**: the trusted-raw `attrs` channel accepts only STATIC author-typed
  strings (wire directives, HTML attributes with known-safe values). A per-row DB value in `attrs`
  is an XSS hole. Use `dataAttrs` for anything dynamic.
- **No `aria-live` on the count badge**: announcing every character change via a live region
  would produce unbearable noise for screen-reader users. The count is purely visual. If a
  consuming surface needs to warn at threshold (e.g. "10 characters remaining"), the consuming
  WIRE component's server-rendered error/hint region handles it, not this partial.
- **No `role="search"` on a search-flavoured input**: a search input inside a `<form role="search">`
  gives the landmark; the input itself stays `<input type="search">` with the native role. The
  `form` partial or the consuming template owns the `role="search"` boundary, not this partial.
- **No inline `<script>` or `on*=` handlers**: the CSP refuses them. All JS behaviour runs through
  the `input-count.enhancer.ts` registered via the runtime directive registry, or through `l:*`
  directives passed via `attrs`.

## 9. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read Ant Design Input, shadcn Input, and
Tailwind UI form controls as references for PATTERN (adornment layout, clearable, count) and LOOK.
You MUST NOT paste literal source from any of them — the output is always original generation
(the one bright line, `02-licensing.md`).

Mirror `button.jte`'s house conventions exactly: header doc-comment with the labelled sections
(TIER, STRUCTURE, A11y, Params, Usage, credits), typed `@param`, `data-slot`, the two escaping
channels, zero `<script>`. The `dataAttrsFragment` local variable follows the pattern from
`button.jte` (`!{var dataAttrsFragment = ...}` built from the `dataAttrs` map via
`Escape.htmlAttribute`).

Do NOT set `role="textbox"` on the `<input>`: the native element already carries the implicit
role; an explicit one is noise and breaks for `type="email"` / `type="search"` which have their
own ARIA role mappings.

Do NOT add a focus trap or any roving-tabindex logic: this is a plain single-line input; the
platform owns focus.

The `input-count.enhancer.ts` is NEW; implement it in `registry/enhancers/input-count.enhancer.ts`,
registered via the lievit runtime's lifecycle registry (`onDocumentReady` + `onComponentInit`).
It must be CSP-clean (no `eval`, no `Function`, no `innerHTML`). Minimal code to GREEN.

The clearable button must be a real `<button type="button">` — not a `<span>` with a click
handler. This gives keyboard + Enter/Space activation for free (the platform button rule).

Validate the acceptance test suite FULLY: every row in §7 is a required assertion, not a menu.
The axe negative case (missing label MUST fail axe) is as load-bearing as the positive cases.
Minimal code to GREEN; refactor only while green.
