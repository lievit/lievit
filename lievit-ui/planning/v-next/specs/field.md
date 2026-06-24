<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — field

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/field.jte` / form-group partial)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: no distinct WAI-ARIA APG pattern for a field wrapper itself; the a11y contract is the
      `aria-labelledby` / `aria-describedby` wiring that links a `<label>` to its control and an error
      region to its control — native HTML + WCAG 1.3.1 / WCAG 3.3.1. Verified against the APG "Providing
      Accessible Names and Descriptions" guidance and the W3C technique H44 (label for a control) +
      ARIA18 (aria-labelledby) + ARIA21 (aria-describedby for errors). No react-aria equivalent needed
      because the wiring is pure HTML + id association, no client interaction.
    - inventory: Ant Design Form.Item as inventory reference (label, help/hint, error/warning/success
      status, required marker, layout inline/vertical/horizontal, no-label mode, extra content slot,
      tooltip on label). shadcn/ui FormField + FormItem + FormLabel + FormMessage as secondary structural
      reference.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI form
      layout (NO code copied)

## 1. What it is

A field is the **layout wrapper** that groups one form control with its visible `<label>`, optional
hint text, and optional error/warning/success message into a single composable unit. Its only job is
to produce the correct HTML id associations (`for`/`aria-describedby`) so that screen readers announce
the label and any error when the control receives focus — without the consuming template having to
manage those ids by hand.

Server-first works trivially: id wiring is static markup, the error/hint text is a server fact (a
validation result from the controller), and the layout (vertical stack vs horizontal label-before-control
vs inline) is a rendering decision. There is nothing client about a field wrapper. PARTIAL is the
correct tier: the field holds no state, fires no action, and its every output is deterministic from its
`@param` inputs.

The field renders: a `<label>` (or a `<span role="group">` aria-labelledby header for a fieldset-style
multi-control group), the composed control slot (`content`), a hint region (when `hint` is set), and an
error/warning/success message region (when `message` is set). The `message` region is pre-rendered even
when empty so the layout does not reflow when an error appears during an htmx morph.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `controlId` | `String` | — | **REQUIRED.** The `id` of the form control inside `content`. Becomes the `for` attribute on the `<label>` and the anchor for `aria-describedby` ids. |
| `label` | `String` | `null` | Visible label text. When `null`, no `<label>` is rendered (no-label mode; `aria-label` must be on the control itself — the consuming template's responsibility). |
| `required` | `boolean` | `false` | When `true`, appends a required marker (a styled asterisk) to the label; also propagates `required` semantics via the `<label>`'s visual cue (the REQUIRED attribute lives on the control, not here). |
| `layout` | `String` | `"vertical"` | `"vertical"` (label above, full-width control) \| `"horizontal"` (label left at fixed width, control right) \| `"inline"` (label + control inline, no block stacking; used for checkbox/radio composites). |
| `labelWidth` | `String` | `null` | When `layout="horizontal"`, the CSS width applied to the label column (e.g. `"8rem"`, `"120px"`). `null` → a sensible token default (`--lv-field-label-width`). |
| `size` | `String` | `"md"` | `"sm"` \| `"md"` \| `"lg"` — scales label text and vertical spacing to match the control size in the same row. |
| `status` | `String` | `null` | `null` \| `"error"` \| `"warning"` \| `"success"` — colours the message region and, when set, adds `aria-describedby` on the control pointing at the message region. |
| `message` | `String` | `null` | The error / warning / success / plain hint message text. Rendered in the message region. `null` renders the region as a visually-hidden empty block (no reflow on appearance). |
| `hint` | `String` | `null` | Secondary hint text rendered BELOW the label (before the control in vertical layout; or in a sub-line in horizontal). Distinct from `message`: hint is always visible, message is contextual feedback. When both are set, both render; `aria-describedby` on the control lists the hint id FIRST, the message id SECOND (so the screen reader reads the hint before the error). |
| `labelTooltip` | `String` | `null` | When set, renders a small `(?)` icon button next to the label text that reveals the tooltip text (composed with the `tooltip` partial). Provides extra context without cluttering the label itself. |
| `htmlFor` | `String` | `null` | Explicit override of the `for` attribute when `controlId` is not sufficient (e.g. a WIRE component with a synthetic id). Falls back to `controlId` when `null`. |
| `cssClass` | `String` | `""` | Extra utility classes applied to the field root element. |
| `labelCssClass` | `String` | `""` | Extra utility classes applied to the `<label>` element. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `data-testid="..."`). Never fed per-row DB data. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` (each value via `Escape.htmlAttribute`). |
| `content` | `gg.jte.Content` | — | **REQUIRED.** The form control (or group of controls) to lay out inside the field. |
| `leading` | `gg.jte.Content` | `null` | Optional slot rendered before the label text (e.g. an icon). |
| `extra` | `gg.jte.Content` | `null` | Optional slot rendered after the message region (e.g. a character counter, a password strength meter). Mirrors the Ant Design `extra` prop. |

**Id-generation convention**: the partial computes stable companion ids from `controlId`:
- hint region id = `${controlId}-hint`
- message region id = `${controlId}-msg`

The control rendered inside `content` is expected to carry `aria-describedby` pointing at these ids (when
`hint` or `message` is set). Because the control is a PARTIAL composed via `content`, the simplest path is
for the consuming template to pass the matching ids explicitly to the inner control partial (e.g. the
`input` partial accepts `ariaDescribedby`). The field partial does NOT reach inside `content` and inject
attributes — that would break the server-rendered contract. The consuming template is responsible for
threading the ids; the field spec documents the convention so every usage is consistent.

## 3. Variants / sizes / states

**layout variants**:
- `"vertical"`: the default. Label on its own line above the control; hint below the label; message below
  the control. Full-width control. Used for most form fields.
- `"horizontal"`: label in a left column (width `--lv-field-label-width`, overridden by `labelWidth`),
  control + hint + message in a right column. Used in data-entry forms where vertical space is scarce and
  labels are short (e.g. a settings panel). On narrow viewports (below `--lv-breakpoint-sm`) falls back to
  vertical automatically.
- `"inline"`: label and control side-by-side in a single flex row, no stacking. Used for boolean
  controls (checkbox, switch) where the label reads as "caption for the control" rather than "column
  header above it". In this mode `required` marker and `hint` still render; `message` renders below the
  row.

**status**:
- `null` (no status): label, hint, and message use default muted/fg tokens.
- `"error"`: message region is coloured `--lv-color-destructive` / `--lv-color-destructive-fg`; the
  control that receives focus has its ring coloured via `aria-invalid` (the control owns this; the field
  supplies the `aria-describedby` wiring).
- `"warning"`: message region uses `--lv-color-warning` / `--lv-color-warning-fg`. The control's ring is
  not altered (warnings do not mark the field as invalid — the data may still be submitted).
- `"success"`: message region uses `--lv-color-success` / `--lv-color-success-fg`. Used for async
  validation confirmation.

**sizes** (scales label typography and vertical spacing to stay aligned with the control):
- `"sm"`: label text `--lv-text-xs`, spacing `--lv-space-1` gap.
- `"md"` (default): label text `--lv-text-sm`, spacing `--lv-space-1.5` gap.
- `"lg"`: label text `--lv-text-base`, spacing `--lv-space-2` gap.

**required marker**: when `required=true`, a `<span aria-hidden="true">*</span>` follows the label text
(styled `--lv-color-destructive`); the asterisk is `aria-hidden` because the `required` attribute on the
control itself communicates requiredness to assistive technology without the decoration.

**no-label mode** (`label=null`): the partial renders only the hint + message regions (no `<label>`
element). The consuming template is responsible for providing an accessible name directly on the control
(`aria-label` / `aria-labelledby`). The `controlId` parameter is still required for the
`aria-describedby` id convention.

**disabled appearance**: the field partial does not receive a `disabled` flag — the control inside
`content` carries `disabled`. When the control is disabled, Tailwind's `has-[:disabled]:` utilities on
the field root dim the label and hint text. The field partial emits the `data-slot="field"` root so
adopters can compose `has-[:disabled]:opacity-50` from outside.

**loading / busy state**: the field does not manage `aria-busy`. If an async validation round-trip is in
progress, the consuming WIRE template sets `aria-busy` on the control directly (the wire runtime manages
it via `beforeCall` / `afterCall`).

## 4. The a11y contract (the heart — non-negotiable, fully specified)

- **WAI-ARIA pattern**: no single APG composite pattern names a "field wrapper". The a11y contract is
  assembled from three W3C specifications:
    1. **H44 / WCAG 1.3.1** — a `<label for="id">` must reference the control's id; the label text
       becomes the control's accessible name.
    2. **ARIA21** — `aria-describedby` on the control references the id(s) of the hint and/or message
       region so those texts are announced when the control receives focus.
    3. **WCAG 3.3.1** — error messages must be identified (by text, icon colour, or both) and be
       programmatically associated with the field.
    Source: https://www.w3.org/WAI/ARIA/apg/patterns/ (no specific pattern page; the binding is from
    https://www.w3.org/TR/WCAG21/#info-and-relationships and the ARIA in HTML spec
    https://www.w3.org/TR/html-aria/).

- **roles + ARIA**:
    - Field root: `<div role="group">` ONLY when the field wraps a multi-control composite (e.g. a
      date-range or a time-range with separate hour/minute inputs) — in that case, `aria-labelledby` on
      the group points at the label `<span>` and the label is rendered as `<span>` not `<label>`. For a
      single-control field (the common case), the root is a plain `<div>` with no role.
    - Label: `<label for="${controlId}">` when `label` is set. The `for` attribute creates the native
      association; no `aria-labelledby` needed for a single control.
    - Hint region: `<p id="${controlId}-hint" class="...">` always rendered when `hint` is set;
      `aria-hidden` when hint text is blank (so the id exists but is not announced). The hint id is
      listed first in `aria-describedby` on the control.
    - Message region: `<p id="${controlId}-msg" aria-live="polite" class="...">` always rendered
      (possibly visually hidden) so the layout does not reflow. When `status` is not `null` and `message`
      is set, the element is visible and the message id is listed in `aria-describedby` on the control.
      `aria-live="polite"` ensures dynamically injected messages (e.g. from an htmx swap of the field)
      are announced without interrupting the user.
    - Required marker: `<span aria-hidden="true">*</span>` — decorative; `required` on the control
      announces "required" to the screen reader without the asterisk.
    - Label tooltip trigger (when `labelTooltip` is set): an icon `<button>` with `aria-label="More
      information about <label text>"` and `type="button"`, composed with the `tooltip` partial; the
      tooltip text is announced when the button receives focus, via the tooltip's `role="tooltip"` +
      `aria-describedby` wiring (delegated to the `tooltip` partial spec).

- **keyboard map**:
  | key | does | who |
  |---|---|---|
  | Tab | moves focus INTO the control inside `content` (the field root is not focusable) | platform |
  | Tab (on label tooltip trigger) | moves focus to the tooltip trigger when present | platform |
  | Enter / Space (on label tooltip trigger) | opens / closes the label tooltip | `tooltip` partial (composed, platform) |
  | (all other keys) | operated by the control inside `content` — the field does not intercept | platform / control |

  The field partial itself is NOT a focusable element and introduces NO keyboard behaviour of its own
  beyond the `<label>` click-to-focus behaviour provided natively by the browser (clicking the `<label>`
  focuses the associated control via the `for` attribute — platform).

- **focus management**: none beyond native `<label for>` click-to-focus. No trap, no roving, no
  initial-focus. The field is a layout container; focus lives in the control.

- **live region**: the message region carries `aria-live="polite"` so that when a field's message
  appears or changes (via an htmx morph of the field fragment, e.g. after server-side validation), the
  new message is announced. The `aria-live` region is always present in the DOM so the browser registers
  it before any dynamic update (a live region added dynamically at the moment of the first message is NOT
  reliably announced by all screen readers).

- **shared mechanism composed**: `tooltip` partial (for the label tooltip icon, when `labelTooltip` is
  set). The field does NOT compose the popover seam, focus-trap, or collection-nav — it is a layout
  wrapper, not an interactive overlay.

- **APG URL cited**: https://www.w3.org/WAI/ARIA/apg/patterns/ (general reference). For the error
  association: https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA21 (Using aria-describedby to identify
  error fields). For the label association: https://www.w3.org/WAI/WCAG21/Techniques/html/H44 (Using
  label elements to associate text labels with form controls).

## 5. Tokens

**Reads** (no literal values, all via `var(--lv-*)`):

| token | used for |
|---|---|
| `--lv-text-xs` | label text in `size="sm"` |
| `--lv-text-sm` | label text in `size="md"` (default) |
| `--lv-text-base` | label text in `size="lg"` |
| `--lv-font-sans` | label / hint / message font family |
| `--lv-font-medium` | label font weight (one step above body text to visually separate it) |
| `--lv-color-fg` | label text colour (default) |
| `--lv-color-muted` | hint text colour + message icon colour (muted, secondary) |
| `--lv-color-muted-fg` | hint text on muted background when a background chip is used |
| `--lv-color-destructive` | required marker asterisk colour; error message text colour |
| `--lv-color-destructive-fg` | error message text on destructive background (when an error chip style is used) |
| `--lv-color-warning` | warning message text colour |
| `--lv-color-warning-fg` | warning message text on warning background |
| `--lv-color-success` | success message text colour |
| `--lv-color-success-fg` | success message text on success background |
| `--lv-space-1` | gap between label and control in `size="sm"` |
| `--lv-space-1.5` | gap between label and control in `size="md"` |
| `--lv-space-2` | gap between label and control in `size="lg"` |
| `--lv-space-0.5` | gap between control and message/hint below it |
| `--lv-space-3` | horizontal gap between label column and control column in `layout="horizontal"` |
| `--lv-space-2` | horizontal gap between label and control in `layout="inline"` |

**NET-NEW tokens proposed** (additive, justified):

| token | value (light / dark) | justification |
|---|---|---|
| `--lv-field-label-width` | `oklch(0 0 0 / 0)` → width: `8rem` (a spacing/dimension, not a colour) | the default label-column width for `layout="horizontal"`; adopters override once in `:root` to align all horizontal fields across the app; without a token this must be hardcoded in every field usage or in a Tailwind utility that adopters cannot retheme |

No new colour tokens: the status colours (`destructive`, `warning`, `success`) already exist in the token
system. No new spacing tokens beyond `--lv-field-label-width`. Structural tokens (spacing, dimension)
are theme-invariant and require no dark-mode entry.

## 6. Wire / island integration

The field is a **static PARTIAL**. It carries no `data-lievit-component`, no `@Wire` state, no wire
directives, and no typed-TS enhancer. There is no round-trip, no lifecycle hook, and no island. The
component is entirely static from the server's perspective.

**Server-rendered JTE structure** (the element tree, data-* hooks):

```
<div
  data-slot="field"
  data-layout="${layout}"        <!-- "vertical" | "horizontal" | "inline" -->
  data-size="${size}"            <!-- "sm" | "md" | "lg" -->
  data-status="${status ?? ""}"  <!-- "" | "error" | "warning" | "success" -->
  class="[field root classes]${cssClass}"
  $unsafe{attrs}
  [data-* from escaped dataAttrs]
>

  <!-- label row (emitted only when label != null) -->
  <div data-slot="field-label-row" class="[label-row layout classes]">
    @if(leading != null)
      <span data-slot="field-leading" aria-hidden="true">[leading slot]</span>
    @endif
    <label
      for="${htmlFor != null ? htmlFor : controlId}"
      class="[label classes]${labelCssClass}"
    >
      [label text]
      @if(required)
        <span aria-hidden="true" class="[required-marker classes]">*</span>
      @endif
    </label>
    @if(labelTooltip != null)
      <!-- composed with tooltip partial; aria-label set to "More information about ${label}" -->
      @template.lievit.tooltip(content=labelTooltip, trigger=...)
    @endif
  </div>

  <!-- hint (emitted when hint != null; above the control in vertical/horizontal) -->
  @if(hint != null)
    <p id="${controlId}-hint" data-slot="field-hint" class="[hint classes]">
      ${hint}
    </p>
  @endif

  <!-- control slot -->
  <div data-slot="field-control" class="[control-wrapper classes]">
    ${content}
  </div>

  <!-- message region: ALWAYS in DOM (empty when null, visible when set) -->
  <p
    id="${controlId}-msg"
    data-slot="field-message"
    aria-live="polite"
    class="[message classes; visually-hidden when status==null && message==null]"
  >
    @if(message != null)${message}@endif
  </p>

  <!-- extra slot (optional, e.g. char counter) -->
  @if(extra != null)
    <div data-slot="field-extra" class="[extra classes]">
      ${extra}
    </div>
  @endif

</div>
```

**No enhancer**: the partial is static; the TypeScript bundle does not need to bind anything to it.
The `aria-live` region is registered by the browser at render time (server-rendered in the initial HTML,
so no dynamic-region race condition).

**How consuming templates wire `aria-describedby`**: because the field does not reach inside `content`,
the consuming template is responsible for passing the computed hint/message ids to the control. Example
pattern:

```jte
<%-- id-convention: hint=${controlId}-hint, msg=${controlId}-msg --%>
@template.lievit.field(
  controlId="email",
  label="Email",
  hint="We'll send a confirmation link.",
  status=${fieldStatus},
  message=${fieldError},
  content=@`
    @template.lievit.input(
      id="email",
      type="email",
      ariaDescribedby="email-hint${fieldError != null ? " email-msg" : ""}",
      ariaInvalid=${fieldError != null}
    )
  `
)
```

The field partial exports the id convention via a documented comment in its JTE header; the consuming
template assembles `aria-describedby` from the documented formula (`${controlId}-hint` and
`${controlId}-msg`). A future helper (e.g. a Java `FieldIds` record the controller passes to the model)
can automate this wiring further, but the field partial itself stays simple and does not own it.

## 7. Acceptance tests

The component is DONE only when ALL tests pass on a REAL substrate (not a mocked one).

- **render (jsdom, vertical layout, all slots filled)**:
  Renders a `<label for="email">` with the label text; the `<label>` has an asterisk when
  `required=true`; the asterisk is `aria-hidden="true"`; the control `content` is projected inside
  `data-slot="field-control"`; the hint `<p id="email-hint">` is present; the message `<p
  id="email-msg">` is present in the DOM even when `message=null` (no reflow assertion: inserting a
  message does not shift layout); `data-slot="field"`, `data-layout="vertical"`, `data-size="md"`,
  `data-status=""` are on the root.

- **render (jsdom, horizontal layout)**:
  The root has `data-layout="horizontal"`; the label column has the expected width token class.

- **render (jsdom, inline layout)**:
  The root has `data-layout="inline"`; label and control are siblings in a flex row.

- **render (jsdom, no-label mode)**:
  When `label=null`, no `<label>` is rendered; the hint and message regions are still present.

- **render (jsdom, error status)**:
  `data-status="error"` on the root; the message `<p>` is visible (not visually-hidden); the message
  text matches the `message` param; the message element has `aria-live="polite"`.

- **render (jsdom, warning status)**:
  `data-status="warning"` on the root; message visible in the warning colour token class.

- **render (jsdom, success status)**:
  `data-status="success"` on the root; message visible in the success colour token class.

- **render (jsdom, labelTooltip set)**:
  A `<button type="button">` with `aria-label` containing the label text is rendered adjacent to the
  `<label>` text; the tooltip partial is composed (the tooltip partial's own tests cover its a11y; this
  test asserts the trigger exists and has an accessible name).

- **render (jsdom, all three sizes)**:
  `data-size="sm"` / `"md"` / `"lg"` on the root for the matching `size` param; each size class
  applies the expected `--lv-text-*` and `--lv-space-*` token utilities.

- **axe-core (rendered with a real `<input>` in the content slot and hint + error message set)**:
  Zero violations of rules `label`, `label-content-name-mismatch`, `aria-describedby`, `color-contrast`,
  `region` on the rendered field DOM. The `for` → `id` association is present and valid. The
  `aria-describedby` on the input references existing ids. The required asterisk does not produce a
  `label` violation because it is `aria-hidden`.

- **aria-live announced on dynamic message injection (jsdom + MutationObserver simulation)**:
  Mount a field with `message=null`; assert the message `<p>` is present but empty; inject a message
  text directly into the element (simulating an htmx fragment swap); assert the element has
  `aria-live="polite"` (the live region is registered before the update — the race-condition guard).

- **variants/sizes**: each layout variant + each size renders the `data-layout` / `data-size` attribute
  and the token-bearing utility classes for the expected --lv-* tokens (asserted by class name, not
  inline style).

- **escaping (the XSS abuse-case)**:
  Pass `dataAttrs=Map.of("confirm", "\">|<script>alert(1)</script>")` — the rendered `data-confirm`
  attribute value is HTML-escaped and inert. Pass `attrs="data-static='ok'"` — renders verbatim
  (trusted). Pass a hostile string as `label` — it is HTML-escaped by JTE's default output escaping
  (JTE auto-escapes `${}` interpolation; the label is NOT passed via `$unsafe`).

- **label click-to-focus (jsdom)**:
  Render a `<label for="email">` + an `<input id="email">` in the content slot; programmatically click
  the label; assert `document.activeElement` is the input (native `<label for>` platform behaviour).

- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate (compilation
  gate exists for the library; this template must be included in it).

- **no-slot-bleed guard (jsdom)**:
  Render two field instances on the same page; assert that the message region of field-A does not
  contain the message text of field-B (id uniqueness is the key; the test passes distinct `controlId`
  values and asserts isolation).

## 8. Non-goals / anti-patterns

- **The field does NOT own `aria-describedby` on the control.** It cannot reach inside the `content`
  slot to inject attributes — that breaks the server-rendered PARTIAL contract. The consuming template
  threads the ids; the field documents the convention. Workarounds that use JS to retroactively inject
  `aria-describedby` are anti-patterns: they create a dependency on JS for basic a11y.

- **The field does NOT manage the control's `aria-invalid`.** The control (e.g. `input`, `native-select`)
  receives `aria-invalid` from the consuming template (a Spring controller validation result). The field
  only colours the message region; it does not duplicate the `aria-invalid` wiring.

- **The field is NOT a form layout grid.** Multi-column form layouts (two fields side by side, a
  responsive grid of inputs) are the responsibility of the consuming template's outer markup or a
  `form` partial. The field lays out ONE label-control pair, nothing more.

- **The field does NOT validate.** Validation is a server concern (Spring's `BindingResult` / Bean
  Validation). The field receives a `status` + `message` from the controller model and renders them.
  No client-side validation logic lives here.

- **The `message` slot is NOT a `Content` slot.** It is a `String` param. Rich HTML inside an error
  message is an anti-pattern (errors must be plain text, readable by all screen readers without
  interpreting markup). If a link is needed in the message, use the `extra` slot for supplementary
  content.

- **The field does NOT generate `controlId`.** The consuming template (or the controller's model) is
  responsible for generating stable, unique ids. Auto-generated ids at render time are fragile in
  server-rendered + morphed pages (the morph may pair old and new nodes by id; id instability causes
  focus loss).

- **The field does NOT stack messages.** It renders ONE message string. If multiple validation errors
  apply to a single field (uncommon in a gestionale form), the controller composes them into a single
  string before passing to `message`. A multi-error summary belongs in the `form` partial's error-summary
  region, not in the field.

- **No `disabled` param on the field.** The control inside `content` owns `disabled`. The field uses the
  CSS `has-[:disabled]:` pseudo-class to visually dim the label/hint without duplicating state.

- **No client-side character counting or async validation on the field itself.** A character counter
  lives in the `extra` slot (a separate partial, e.g. `char-count`). Async validation fires from the
  control (an `l:model.debounce` on an `input` triggers a WIRE action that sets the parent component's
  field status); the field just renders whatever `status` + `message` the server sends back.
