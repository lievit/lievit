<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — label

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/label.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG practices "Providing Accessible Names and Descriptions"
      (https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) + WCAG H44
      (https://www.w3.org/WAI/WCAG21/Techniques/html/H44) + HTML spec § the `label` element
      (https://html.spec.whatwg.org/multipage/forms.html#the-label-element). No dedicated APG
      widget pattern exists for `<label>` — it is a PLATFORM-supplied element; the platform owns
      the for/id binding, the click-to-focus activation, and the accessible-name computation.
      No react-aria reference needed (no focus management or keyboard beyond platform).
    - inventory: Ant Design Form.Item label region as inventory reference (required marker,
      optional tag, tooltip icon, colon convention, horizontal/vertical layout, bold weight variant)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI
      form label conventions (NO code copied)

## 1. What it is

A styled caption element that associates a visible text label with exactly one form control, plus
optional affordances (required marker, optional tag, hint icon).
The association is a FOR/ID binding carried by the native `<label for="...">` element — the platform
supplies the click-to-focus activation, the accessible name computation for the control, and the
increased hit-area for free.
The component holds NO state and performs NO interaction of its own: it is always a PARTIAL.
Server-first works trivially: a label is pure, deterministic markup; the only "client" behavior is
the platform's built-in label activation, which needs no enhancer.

The component is the LABELING half of the `field` partial (which wraps label + control + error +
hint into a complete form row).
It is also usable standalone when an adopter needs fine-grained layout control.
It is NOT a floating/placeholder label (a distinct component if ever needed) and NOT a description
or error message (those are `field`'s error/hint slots).

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `forId` | `String` | `null` | The `id` of the associated form control. Renders as `<label for="${forId}">`. REQUIRED for accessible association when the control is not a child of the label. When `null`, the label wraps its content (implicit association — only valid when the control is a direct child of the template's `content`). |
| `required` | `boolean` | `false` | Shows the required marker (a `*` visually styled in `--lv-color-destructive`, with an SR-only explanation). Does NOT set `aria-required` on the label itself (that attribute belongs on the CONTROL, set by the consuming template). |
| `optional` | `boolean` | `false` | Shows a subtle "(optional)" tag — the complement of `required` for forms where required is the default assumption. Mutually exclusive with `required`; if both are true, `required` wins. |
| `hint` | `String` | `null` | When non-null, renders a small help-circle icon after the label text that is tooltip-activatable (composes the `tooltip` partial). Used for brief inline clarifications too short for a full hint row. |
| `hintId` | `String` | `null` | `id` to stamp on the hint tooltip element so the consuming `field` can pass it as `aria-describedby` to the control. Ignored when `hint` is null. |
| `size` | `String` | `"md"` | `sm \| md \| lg` — scales the label's text size and line-height to match the associated control's height tier (toolbar-aligned, architecture contract §5.b). Does NOT affect the control; it is a visual pairing aid. |
| `variant` | `String` | `"default"` | `default \| bold` — `bold` applies `font-weight: var(--lv-font-weight-semibold)` for section-header-style labels (Ant Design equivalent of the bold column header in a form). The shared intent vocabulary has no colour intents for a label (it is never coloured by intent; error state is carried by the control + error message, not the label). |
| `hidden` | `boolean` | `false` | Visually hides the label while keeping it in the accessibility tree (WCAG H44: hidden labels satisfy 1.3.1 + 4.1.2 but NOT 3.3.2; consuming `field` documents the trade-off). Uses the `sr-only` pattern (`position:absolute; clip: rect(0,0,0,0); ...`), NOT `display:none`. |
| `cssClass` | `String` | `""` | Extra utility classes appended to the label root. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `data-testid="name-label"`). Never fed per-row or user-derived data. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (each value through `gg.jte.html.escape.Escape.htmlAttribute`). |
| `content` | `gg.jte.Content` | — | The label text (and optionally an inline icon before the text). Mandatory; a label with no visible text and no `ariaLabel` on the associated control produces an accessibility violation. |
| `leading` | `gg.jte.Content` | `null` | Optional icon or decorative element placed BEFORE the label text (e.g. a small status dot). Renders inside the `<label>`, before `content`. |
| `trailing` | `gg.jte.Content` | `null` | Optional element placed AFTER the label text and before the required/optional marker (e.g. a badge). Renders inside the `<label>`. |

## 3. Variants / sizes / states

### Variants
Two intent values, both purely typographic (no colour intent — a label never changes colour to
signal intent; that signal lives on the control and the error message):

- `default` — `--lv-text-sm`, `--lv-font-weight-medium`, `--lv-color-fg` (the standard form label).
- `bold` — `--lv-font-weight-semibold` over the same size/colour; used for section-heading labels
  in dense data-entry forms.

### Sizes
Height-based, aligning with the associated control's `size` tier (architecture contract §5.b):

| size | text token | line-height | typical pairing |
|---|---|---|---|
| `sm` | `--lv-text-xs` | `--lv-leading-4` | paired with `size="sm"` controls (32 px) |
| `md` | `--lv-text-sm` | `--lv-leading-5` | default; paired with `size="md"` controls (36 px) |
| `lg` | `--lv-text-base` | `--lv-leading-6` | paired with `size="lg"` controls (40 px) |

### States
A label has no interactive states of its own.
It inherits no `:hover`, `:focus`, or `disabled` styling at the label level — the CONTROL carries
those.
Relevant special cases:

- **hidden** (`hidden=true`): the `sr-only` CSS pattern hides the label visually; it remains in
  the DOM and in the accessibility tree (the `for` binding stays intact; the control still has its
  accessible name). `display:none` is NEVER used for a hidden label.
- **required** (`required=true`): the required marker `*` is coloured `--lv-color-destructive`
  but the label text itself is NOT recoloured. An `aria-hidden="true"` marker hides the `*` glyph
  from screen readers; a sibling `<span class="sr-only">` provides the textual equivalent
  "(required)" to SRs.
- **optional** (`optional=true`, mutually exclusive with `required`): the optional tag is coloured
  `--lv-color-muted-fg` in a subtler weight.

### Slots
- `content` (mandatory): the visible label text, possibly with inline icon.
- `leading` (optional): icon or decoration before the text.
- `trailing` (optional): inline element after the text but before the required/optional marker.

## 4. The a11y contract

- **WAI-ARIA pattern**: "platform" — the native `<label>` element is the ENTIRE a11y mechanism.
  There is no WAI-ARIA widget pattern for `<label>`; the HTML spec and WAI-ARIA APG practices on
  accessible names (https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) define its
  use. WCAG H44 (https://www.w3.org/WAI/WCAG21/Techniques/html/H44) is the normative technique.
  The platform supplies: the FOR/ID association, the click-to-activate behavior on the control, and
  the computation of the control's accessible name from the label text.

- **roles + ARIA**: the component renders a native `<label>` element.
  - No explicit ARIA role is needed or added: `<label>` maps to the implicit `generic` role; the
    accessible-name relationship it creates is via the HTML `for`/`id` binding, not via ARIA.
  - Required marker: the `*` glyph is `aria-hidden="true"`. A visually hidden
    `<span class="sr-only"> (required)</span>` renders after it so screen readers announce
    "(required)" as part of the label text (it becomes part of the control's accessible name
    via the label). This matches the WCAG advisory technique for required markers.
  - Optional tag: the "(optional)" text is visible; no extra aria annotation needed (it is plain
    text within the label, naturally included in the accessible name).
  - Hint icon: when `hint` is set, composes the `tooltip` partial with `aria-hidden="true"` on
    the icon glyph; the tooltip content is associated via `aria-describedby` on the CONTROL (not
    the label) using `hintId`. The `tooltip` partial handles its own disclosure pattern.
  - `hidden=true` label: uses `class="sr-only"` (absolute-positioned, clipped), NOT
    `aria-hidden="true"` and NOT `display:none`. The control must still receive its accessible
    name through the binding.

- **keyboard map**:
  | key | does | who |
  |---|---|---|
  | Click (pointer or Enter/Space when label has focus) | activates / focuses the associated control | platform (native `<label>` behavior, HTML spec § label activation) |

  The label element itself is NOT in the tab order (`tabindex` is never added to it).
  It has no keyboard interaction surface of its own.
  All keyboard interaction lives on the ASSOCIATED CONTROL.
  This is by design — the APG guidance on names-and-descriptions explicitly notes that `<label>`
  with a `for` attribute activates the control on click, while `aria-labelledby` does NOT (the
  platform gives this for free; adding any JS event handling would be redundant and fragile).

- **focus management**: none. The label is NOT focusable. When a user clicks the label, platform
  focus transfers to the associated control. No enhancer, no JS focus logic.

- **live region**: none. A label is not a dynamic status announcer. Errors and hints are
  announced through the `field` partial's error/hint region (which carries `role="alert"` /
  `aria-live="polite"` as appropriate, not the label).

- **shared mechanism composed**:
  - `tooltip` partial (optional — only when `hint` is non-null): the hint icon + popover
    is the ONE tooltip mechanism, not a hand-roll.
  - No `focus-trap`, no `collection-nav`, no popover seam (none apply to a static label).

- **WCAG success criteria this component must satisfy**:
  - **1.3.1 Info and Relationships** (Level A): the label text is programmatically associated to
    its control via `for`/`id`.
  - **2.4.6 Headings and Labels** (Level AA): the label is descriptive (the adopter is responsible
    for content; the component provides the structural mechanism).
  - **3.3.2 Labels or Instructions** (Level A): the label is visible when `hidden=false` (the
    default). When `hidden=true`, 3.3.2 is NOT fully satisfied — the consuming `field` must
    document this trade-off in the authored usage.
  - **4.1.2 Name, Role, Value** (Level A): the control receives its accessible name through the
    `<label for>` binding.

## 5. Tokens

The component reads only typographic and colour tokens; it has no elevation, shadow, z-index, or
interactive-state tokens of its own.

| token | used for |
|---|---|
| `--lv-text-xs` | label text size at `size="sm"` |
| `--lv-text-sm` | label text size at `size="md"` (default) |
| `--lv-text-base` | label text size at `size="lg"` |
| `--lv-leading-4` | line-height at sm |
| `--lv-leading-5` | line-height at md |
| `--lv-leading-6` | line-height at lg |
| `--lv-font-weight-medium` | label text weight, `variant="default"` |
| `--lv-font-weight-semibold` | label text weight, `variant="bold"` |
| `--lv-font-sans` | label font family |
| `--lv-color-fg` | label text colour (default) |
| `--lv-color-muted-fg` | optional tag colour + (when hidden=false) the colon decoration if the adopter opts into Ant-Design-style colon suffix |
| `--lv-color-destructive` | required marker `*` colour |
| `--lv-space-1` | gap between label text and required/optional marker |
| `--lv-space-2` | gap between label text and hint icon; gap between leading icon and text |

**NET-NEW tokens**: none. All required tokens exist in the v2 token set. The required-marker red
reuses `--lv-color-destructive` (shared with destructive button, `aria-invalid` borders, alert
destructive — same intent vocabulary). The optional-tag muted reuses `--lv-color-muted-fg`.

**Dark-mode**: no new dark-mode rules are needed; `--lv-color-fg`, `--lv-color-destructive`,
`--lv-color-muted-fg` are already re-pointed in the `.dark, [data-theme="dark"]` block.

## 6. Wire / island integration

**Static, no enhancer.**

The label partial is pure server-rendered JTE markup. There is no WIRE component, no wire action,
no lifecycle hook, no typed-TS enhancer, no `l:*` directive.

**Server-rendered JTE structure** (the elements and their roles):

```
<label
  for="${forId}"            -- omitted when forId is null (implicit association)
  class="... ${cssClass}"   -- size + variant token classes + optional sr-only
  ${attrs}                  -- TRUSTED raw: static author strings only
  data-slot="label"
  data-size="${size}"
  data-variant="${variant}"
  data-required="${required}"
  ...escaped dataAttrs...   -- SAFE: each value through Escape.htmlAttribute
>
  <!-- leading slot (optional) -->
  @if(leading != null)
    <span data-slot="label-leading" aria-hidden="true">${leading}</span>
  @endif

  <!-- label text (mandatory content slot) -->
  <span data-slot="label-content">${content}</span>

  <!-- trailing slot (optional) -->
  @if(trailing != null)
    <span data-slot="label-trailing">${trailing}</span>
  @endif

  <!-- required marker (when required=true) -->
  @if(required)
    <span aria-hidden="true" data-slot="label-required"
          class="text-[--lv-color-destructive] ml-[--lv-space-1]">*</span>
    <span class="sr-only"> (required)</span>
  @endif

  <!-- optional tag (when optional=true and !required) -->
  @if(optional && !required)
    <span data-slot="label-optional"
          class="text-[--lv-color-muted-fg] font-[--lv-font-weight-medium] ml-[--lv-space-1]">
      (optional)
    </span>
  @endif

  <!-- hint icon (when hint is set) -->
  @if(hint != null)
    @template.lievit.tooltip(
      content=@`${hint}`,
      triggerId="${hintId != null ? hintId + "-trigger" : ""}",
      id="${hintId != null ? hintId : ""}"
    )
      <span aria-hidden="true" data-slot="label-hint-icon"
            class="ml-[--lv-space-2] inline-flex items-center">
        @template.lievit.icon(name="circle-help", size="xs", cssClass="text-[--lv-color-muted-fg]")
      </span>
    @end
  @endif
</label>
```

**data-* hooks** (for tests + adopter CSS targeting):
- `data-slot="label"` on the root.
- `data-size="sm|md|lg"` on the root (for CSS-layer or Playwright selectors).
- `data-variant="default|bold"` on the root.
- `data-required="true|false"` on the root (for field-level CSS cascade if desired).
- `data-slot="label-required"` on the marker span (for test assertion).
- `data-slot="label-optional"` on the optional span.
- `data-slot="label-hint-icon"` on the hint icon wrapper.
- `data-slot="label-content"` on the content span.

**Escaping channels** (the two-channel rule from architecture contract §3):
- `attrs`: TRUSTED raw `$unsafe` — only STATIC strings the template author writes (e.g.
  `data-testid="..."`, a Playwright hook). Never fed user data or DB-derived values.
- `dataAttrs`: SAFE escaped via `Escape.htmlAttribute` per value — any dynamic/per-row attribute.

No `l:*` directives, no `wireArgs`, no wire round-trip. This component is the clean floor of the
PARTIAL tier.

## 7. Acceptance tests

The component is DONE only when ALL of the following pass on a REAL substrate (jsdom for PARTIAL,
with real JTE compilation — not a mocked render; the client-island-fidelity lesson applies even to
static partials: a test that asserts the wrong DOM certifies nothing).

### Render assertions (jsdom, real JTE compiler + `test/jte-compile` gate)

- **render-explicit-association**: `forId="email"` renders `<label for="email">`;
  `data-slot="label"` present; `data-size="md"` present; `data-variant="default"` present;
  `content` text is visible in the label.
- **render-implicit-association**: `forId=null` renders `<label>` with no `for` attribute;
  the label wraps its content inline.
- **render-required-marker**: `required=true` renders: the `*` glyph with `aria-hidden="true"`
  and `data-slot="label-required"`; a `span.sr-only` containing " (required)"; the `*` carries
  `class` referencing `--lv-color-destructive`; `data-required="true"` on the root.
- **render-optional-tag**: `optional=true, required=false` renders the "(optional)" span with
  `data-slot="label-optional"` and a class referencing `--lv-color-muted-fg`; no required marker.
- **render-required-wins-over-optional**: `required=true, optional=true` renders ONLY the
  required marker, not the optional tag.
- **render-hint-icon**: `hint="Max 50 chars", hintId="name-hint"` renders the hint icon wrapper
  with `aria-hidden="true"` and `data-slot="label-hint-icon"`; the `tooltip` partial is composed
  with id `"name-hint"`; the icon glyph is NOT the label's accessible name contribution.
- **render-hidden-label**: `hidden=true` renders the `<label>` with the `sr-only` CSS class;
  the label is NOT `display:none` and NOT `aria-hidden="true"`; the `for` attribute is intact.
- **render-sizes**: each of `sm | md | lg` renders the root with `data-size` equal to the size
  value; the rendered class references the correct text token for that tier.
- **render-bold-variant**: `variant="bold"` renders `data-variant="bold"` on the root + a class
  referencing `--lv-font-weight-semibold`.
- **render-leading-slot**: `leading` content renders inside the label before `content`, wrapped
  in a span with `aria-hidden="true"` and `data-slot="label-leading"`.
- **render-trailing-slot**: `trailing` content renders inside the label after `content`, before
  the required/optional marker.

### axe-core assertions (zero violations on the cited rules)

- **axe-for-id-association**: render a `<label for="ctrl">` paired with `<input id="ctrl">` in
  the same jsdom; axe reports zero violations on rules `label`, `label-content-name-mismatch`,
  `form-field-multiple-labels`. WCAG success criteria 1.3.1 + 4.1.2 + 3.3.2 pass.
- **axe-hidden-label-still-associates**: `hidden=true` label + its paired control; axe reports
  zero violations on `label` (the SR-only label is not `display:none`, so the binding holds);
  note: 3.3.2 is intentionally not checked on the hidden variant — the test documents this.
- **axe-required-marker-not-name-pollution**: `required=true`; the control's computed accessible
  name includes " (required)" (the sr-only text) and does not expose the raw `*` glyph; axe
  `label-content-name-mismatch` reports zero violations.

### Variant and size gate

- **variants-token-classes**: `variant="default"` renders `--lv-font-weight-medium`-referencing
  class; `variant="bold"` renders `--lv-font-weight-semibold`-referencing class.
- **sizes-token-classes**: each `sm|md|lg` renders the text + leading token classes from §5's
  token table; a `sm` label does NOT emit `--lv-text-base`.

### Escaping (the XSS abuse-case)

- **escaping-dataAttrs**: a `dataAttrs` entry with value `"><script>alert(1)</script>` renders
  the attribute value HTML-escaped in the output; no script tag is injected.
- **escaping-hintId**: `hintId="x\" onmouseover=\"alert(1)"` renders the attribute inert (the
  value is passed through `Escape.htmlAttribute` before stamping on the tooltip `id`).

### JTE compilation gate

- **jte-compiles**: the real JTE compiler (not a mocked render) compiles `label.jte` without
  errors for every `@param` combination exercised by the above tests. Covered by the
  `test/jte-compile` suite — no separate test needed; the compile gate is a prerequisite.

### What is NOT tested here (lives in `field` spec)

- That the `field` partial passes `forId` correctly from its own `controlId` param to this label.
- That `aria-describedby` on the control is wired to `hintId` (that wiring is the `field`
  partial's contract, which composes this one).
- That `aria-required` appears on the control (the control's own template is responsible).

## 8. Non-goals / anti-patterns

- **Does NOT set `aria-required` on anything.** `aria-required` belongs on the CONTROL (`<input>`,
  `<select>`, etc.), set by the control's own template or the consuming `field` partial. The label's
  `required=true` is purely visual + accessible-name (the SR-only " (required)" text).
- **Does NOT add ARIA roles to the `<label>` element.** The native element's implicit semantics are
  correct and complete; `role="label"` is not a valid ARIA role; adding one is harmful.
- **Does NOT use `display:none` or `visibility:hidden` for hidden labels.** These remove the
  element from the accessibility tree, breaking the association. Use `hidden=true` (sr-only) only.
- **Does NOT handle error state visually.** A label does NOT turn red when the associated control
  is invalid. Error state is signalled by the control (`aria-invalid`) and the error message in
  the `field` partial. A red label-text on invalid is a common anti-pattern that confuses colour
  with meaning and fails WCAG 1.4.1 (use of colour).
- **Does NOT wrap arbitrary complex markup** (nested interactive elements, buttons, inputs other
  than its labeled control). The HTML spec's content model prohibits labelable descendant elements
  except the labeled control; the `content` slot must be phrasing content.
- **Does NOT float or animate** (no floating-label / label-as-placeholder pattern). A floating
  label is a distinct pattern with significant a11y complexity (the `placeholder-shown` trick
  breaks when a value is autofilled and misleads screen readers about whether the field has a
  label). If that pattern is needed, it is a separate component.
- **Does NOT replace the `field` partial.** The `label` partial is the LABELING piece only. For a
  complete form row (label + control + error + hint), use `field`, which composes this.
- **Does NOT accept a `variant` colour intent** (`info | success | warning | destructive`). Colour
  as a label signal is an anti-pattern (WCAG 1.4.1); the intent is on the CONTROL.
- **Does NOT use `title` or `placeholder` as a labeling fallback.** Both are unreliable: `title`
  is not consistently surfaced by screen readers; `placeholder` disappears on input and fails
  WCAG 3.3.2. Always provide a visible or SR-only `<label>`.

## 8b. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens; you may read Ant Design Form.Item label region +
WCAG H44 + the WAI-ARIA APG names-and-descriptions practice as references for PATTERN and
INVENTORY; never paste literal source from Ant Design / Tailwind UI (the one bright line, `02`).
Mirror `button.jte` conventions exactly: header doc-comment with the credits line, typed `@param`
with defaults, `data-slot`, the two escaping channels (`attrs` trusted-raw / `dataAttrs` safe),
zero `<script>`, zero inline `on*=`. The required-marker pattern (glyph `aria-hidden` + sr-only
text) is the load-bearing a11y subtlety — assert it in the axe test AND the render test. The
hidden-label sr-only class must NOT be `display:none`. Minimal code to GREEN against the
acceptance tests; the escaping test for `hintId` is NOT optional.
