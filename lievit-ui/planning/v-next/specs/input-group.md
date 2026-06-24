<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — input-group

- **tier**: PARTIAL
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of `registry/jte/input-group.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: no WAI-ARIA APG composite pattern for a generic input group (the native elements inside carry
      their own semantics; the group container uses the APG grouping role where a shared label exists).
      BUILT against the APG Grouping / Landmark guidance
      (https://www.w3.org/WAI/ARIA/apg/patterns/ — no dedicated "input group" pattern; see §4 for the
      applied rules). react-aria has no `useInputGroup`; the grouping discipline is sourced directly from
      the APG labelling rules + the `<fieldset>`/`role="group"` guidance.
    - inventory: Ant Design `Input.Group` + `Input.Search` compound / `InputNumber` affix model as
      inventory reference (prefix text, suffix text, prefix icon, suffix icon, clearable, search-addon,
      before/after select-addons)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      Input with addons (NO code copied)

## 1. What it is

An input-group is a horizontal composition of one CORE control (an `<input>`, `native-select`, or
similar form control) with optional decorative/functional pieces flanking it: leading/trailing addons
(text labels, icons, or small action buttons that are visually glued to the control border) and
leading/trailing elements (standalone controls, such as a `native-select`, that share the border
radius but are full peers of the core control).

The group is PURELY presentational: it renders the layout + visual treatment (fused borders, shared
border-radius, correct focus rings) and leaves all state, validation, and wire actions to the controls
it wraps. PARTIAL is the correct tier: there is no group-level state, no open/close, no selection —
only the CSS contract that makes several controls look like one cohesive unit. Server-first works
trivially: the adopting controller renders the input, the addons, and the ARIA relationships; the group
partial provides only the markup shell and the styling contract.

The canonical usage is: a URL field with a scheme addon ("https://"), a search field with an icon
prefix and a submit button suffix, a phone field with a country-code selector leading element, or a
currency field with a units trailing addon.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| size | String | "md" | sm \| md \| lg — HEIGHT-based, toolbar-aligned; cascades to the visual sizing of all pieces (the core `input` partial and addons must share this value for pixel-alignment) |
| disabled | boolean | false | dims the entire group; each inner control still carries its own `disabled` attr; the group wrapper adds `data-disabled` for CSS targeting |
| ariaLabel | String | null | accessible name for the group container (`aria-label` on the `role="group"` wrapper); REQUIRED when no explicit `<label>` associates via `htmlFor` to the core input |
| ariaLabelledBy | String | null | space-separated id(s) → `aria-labelledby` on the group wrapper; preferred over `ariaLabel` when a visible `<label>` exists (avoids duplication) |
| ariaDescribedBy | String | null | space-separated id(s) → `aria-describedby` on the group wrapper; for hint/error region ids already rendered by the surrounding `field` partial |
| invalid | boolean | false | propagates `aria-invalid="true"` on the group; also sets `data-invalid` for CSS (destructive border + ring) |
| cssClass | String | "" | extra utility classes on the group root |
| attrs | String | "" | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (additional ARIA attributes, test hooks); never feed DB-derived values here |
| dataAttrs | Map\<String,String\> | {} | **SAFE escaped** dynamic `data-*` (each value via `Escape.htmlAttribute`); for test selectors or wire-adjacent hooks |
| leadingElement | gg.jte.Content | null | a FULL peer control (e.g. a `native-select` for country code, a `button`) rendered LEFT of the core control, fused border-radius, separated by an internal divider |
| leadingAddon | gg.jte.Content | null | a NON-interactive decoration or small interactive piece (text label, icon, small action icon-button) rendered inside/adjacent to the LEFT edge of the core control; lighter visual weight than `leadingElement` |
| trailingAddon | gg.jte.Content | null | mirror of `leadingAddon` on the RIGHT edge |
| trailingElement | gg.jte.Content | null | mirror of `leadingElement` on the RIGHT; a button that triggers a search action is the canonical trailing element |
| content | gg.jte.Content | — | the CORE control (mandatory): the `input` partial, `native-select` partial, or any other form control; rendered in the centre slot |

### Slot semantics (the element-vs-addon distinction)

The two slot kinds have different CSS contracts:

- **element** (`leadingElement` / `trailingElement`): a standalone control that is visually peer to
  the core input. It gets its OWN background (`--lv-color-input`), its border is shared with the
  group frame (not duplicated), and it is separated from the core control by a subtle divider
  (`--lv-color-border`). The outermost border-radius of the group applies: the leading element gets
  `rounded-l-*` and the trailing element gets `rounded-r-*`; the core input loses its own radius on
  the shared side.
- **addon** (`leadingAddon` / `trailingAddon`): a decorative or lightweight-interactive prefix/suffix.
  It gets the `--lv-color-muted` background, sits visually INSIDE the group border frame, and does not
  have its own border — the group border encloses it. An addon that contains a purely decorative icon
  carries `aria-hidden="true"` on the icon (the `icon` partial already does this by default). An addon
  that contains a small `<button>` (e.g. a clear button, a reveal-password toggle) needs its own
  `aria-label` and remains a native `<button>` (platform keyboard + focus for free).

Both slot kinds are optional and composable: a group can have a `leadingAddon` + a `trailingElement`,
or two elements flanking the core, or just one addon — any combination is valid. An empty group
(content only, no leading/trailing) is a legal no-op (it renders the `content` unchanged, still
wrapped in the group frame for consistent styling in a toolbar row).

## 3. Variants / Sizes / States / Slots

### Sizes (height-based, toolbar-aligned)

| size | token | height | meaning |
|---|---|---|---|
| sm | `--lv-space-8` | 32 px | compact forms, table inline-edit |
| md | `--lv-space-9` | 36 px | default; shadcn baseline; aligns with `button` md |
| lg | `--lv-space-10` | 40 px | prominent search bars |

The `size` param is passed through to the wrapped `input` / `native-select` partials by the ADOPTER
(the group partial does not set size on its children — it cannot reach inside a `Content` slot). The
group's own height token governs addon/element height so they align flush with the core control. The
spec for surrounding use (`field`) must carry the same `size` to every child.

### Variants

`input-group` has no `variant` of its own. Visual intent (destructive / invalid) is signalled via:

- `invalid=true` → `data-invalid` on the root → CSS applies destructive border + ring
  (`--lv-color-destructive` border, `--lv-ring` in the destructive colour).
- The `field` partial wrapping the group propagates the error state via `ariaDescribedBy` → error
  region id; the group itself carries `aria-invalid="true"` when `invalid=true`.

### States

| state | signal | visual / ARIA effect |
|---|---|---|
| normal | — | default border + `--lv-color-input` background on elements, `--lv-color-muted` on addons |
| focus-within | CSS `:focus-within` on the group root | group outline ring (`--lv-ring`) — one ring wraps the whole group, not individual controls |
| invalid | `invalid=true` + `aria-invalid="true"` | destructive border + destructive ring on focus-within |
| disabled | `disabled=true` + `data-disabled` | reduced opacity (`--lv-opacity-disabled`); inner controls carry their own `disabled` attr |
| hover | CSS `:hover` on group root (when not disabled) | border lifts to `--lv-color-border-hover` |

### Slots

| slot param | element type | required | notes |
|---|---|---|---|
| content | gg.jte.Content | YES | the core form control |
| leadingElement | gg.jte.Content | no | full-peer control, left |
| leadingAddon | gg.jte.Content | no | decoration/lightweight control, left |
| trailingAddon | gg.jte.Content | no | decoration/lightweight control, right |
| trailingElement | gg.jte.Content | no | full-peer control, right |

Order in the DOM (left to right): `leadingElement` → `leadingAddon` → `content` → `trailingAddon`
→ `trailingElement`. This order is fixed; the CSS uses `display: flex; flex-direction: row`.

### Real-world variant matrix (Ant-Design-grade coverage)

| use case | slots used |
|---|---|
| URL field with scheme | `leadingAddon`="https://" · `content`=input |
| Search with icon prefix + submit button | `leadingAddon`=icon · `content`=input · `trailingElement`=button |
| Phone field with country selector | `leadingElement`=native-select · `content`=input |
| Currency amount | `content`=input · `trailingAddon`="EUR" |
| Amount with unit selector | `content`=input · `trailingElement`=native-select |
| Password with reveal | `content`=input[type=password] · `trailingAddon`=icon-button (reveal) |
| Clearable input | `content`=input · `trailingAddon`=icon-button (clear, shows when value non-empty) |
| Compound two-input (date range row) | `leadingElement`=input · `content`=separator-span · `trailingElement`=input |
| Bare group (no addons — toolbar flush) | `content`=input only |

## 4. Accessibility

- **WAI-ARIA pattern**: no APG pattern dedicated to "input group" as a layout primitive exists.
  The applied rules are sourced from:
  - APG Grouping: https://www.w3.org/WAI/ARIA/apg/patterns/ (landing — no dedicated pattern page;
    the grouping discipline is in the APG "Landmark Regions" + "Using aria-labelledby" guidance).
  - W3C WAI ARIA spec `role="group"`: https://www.w3.org/TR/wai-aria-1.2/#group
  - WCAG 1.3.1 (Info and Relationships) + 1.3.5 (Identify Input Purpose) — cited rules in the axe
    gate.

  The group DOES NOT introduce a new ARIA widget role. Each inner control carries its own native
  semantics (`<input>`, `<select>`, `<button>`). The group wrapper uses `role="group"` only when
  the group as a whole has a SHARED semantic label (e.g. a date-range group where both inputs
  together answer one question). When the core input already has its own `<label>` (via the
  surrounding `field` partial), the group wrapper is a `<div>` (no `role`) and the label→input
  association is the only needed relationship.

### Roles + ARIA attributes (emitted by the template)

| element | role / attribute | condition | value |
|---|---|---|---|
| group root `<div>` | `role="group"` | when `ariaLabel` or `ariaLabelledBy` is set | identifies the cluster as a named group |
| group root `<div>` | `aria-label` | `ariaLabel` set | the provided label string |
| group root `<div>` | `aria-labelledby` | `ariaLabelledBy` set | the provided id(s) |
| group root `<div>` | `aria-describedby` | `ariaDescribedBy` set | hint/error region id(s) |
| group root `<div>` | `aria-invalid="true"` | `invalid=true` | signals the group contains invalid input |
| group root `<div>` | `data-disabled` | `disabled=true` | CSS hook; inner controls carry own `disabled` |
| group root `<div>` | `data-slot="input-group"` | always | test + styling hook |
| group root `<div>` | `data-size` | always | sm \| md \| lg |
| addon containers `<div data-slot="leading-addon">` etc. | `aria-hidden="true"` | when the addon contains ONLY a decorative icon or static text (no interactive child) | removes the decoration from the a11y tree so screen readers only hear the input label, not a redundant text fragment |

**Critical rule**: a decorative leading/trailing addon (text like "https://" or a static icon) MUST
carry `aria-hidden="true"` on the addon container, OR the icon partial inside it must already carry
`aria-hidden="true"`. A screen reader user does not benefit from hearing "https://" as a separate
announcement — the input's own `<label>` (via the `field` partial) should already say "Website URL".
The addon is visual context only.

**If the addon contains an interactive child** (a clear button, a reveal-password toggle): the addon
container is NOT `aria-hidden`; the interactive child (a real `<button>`) carries its own `aria-label`
("Clear", "Show password") and is focusable/activated via the platform. No wrapper role needed.

### Keyboard interaction map

`input-group` introduces no keyboard behavior of its own. The keyboard map is entirely the
PLATFORM's, because all interactive elements inside are real native elements:

| key | does | who |
|---|---|---|
| Tab | moves focus sequentially through the group's focusable children (core input → trailing addon button → trailing element select, in DOM order) | platform |
| Shift+Tab | reverse Tab order through focusable children | platform |
| Enter / Space | activates a focused `<button>` inside the group (e.g. submit, clear, reveal) | platform |
| Arrow keys | navigates within a focused `<select>` element | platform |
| any printable character | types into the focused `<input>` | platform |

No enhancer is needed. No roving tabindex, no focus trap, no collection navigation. The group is
non-modal and non-composite from an ARIA perspective.

### Focus management

- **Initial focus**: no initial-focus rule; the group is not a modal overlay. Focus enters the group
  by Tab in the page's natural order.
- **Focus order**: DOM order, left to right (leadingElement → core input → trailingAddon buttons →
  trailingElement). The adopter must place the group in the correct DOM order within the form.
- **Focus trap**: none. The group is not a modal; Tab exits to the next focusable in the page.
- **Focus ring**: the group root uses CSS `:focus-within` to show a single ring (`--lv-ring`) around
  the whole group when any inner control is focused. Individual inner controls drop their own outline
  inside the group (the CSS `:focus-visible` outline is reset to `none` on children INSIDE the group
  context, replaced by the group-level ring — this is the "one ring, not N rings" rule that makes the
  fused-border illusion hold). Exception: a `<button>` that is a trailingElement (NOT inside the fused
  border) keeps its own focus ring because it is visually a separate peer.

### Screen-reader expectations

A screen reader user tabbing through the group will hear:

1. The core input's accessible name (from its `<label>` via the `field` partial).
2. The input's current value and type.
3. Any `aria-describedby` hint/error region.
4. Then, on Tab, any interactive trailing addon button ("Clear, button") or trailing element select
   with its own label.
5. Decorative addons (static text, icons) are silenced via `aria-hidden`.

The user does NOT hear a "group" announcement unless `ariaLabel`/`ariaLabelledBy` is set, in which
case the screen reader announces the group name before the first child ("URL, group" then the input).
Reserve `role="group"` + a label for compound groups where the shared label genuinely adds information
(e.g. "Date range, group: From, date input. To, date input.").

### Live region

None. `input-group` is a layout container. Status announcements (validation, async results) are the
responsibility of the surrounding `field` partial's error region or a toast.

### Shared mechanisms composed

None. `input-group` is purely presentational. It does not compose `focus-trap`, `collection-nav`, or
the popover seam — those are for interactive WIRE components. The group is the anti-thesis of overlay
complexity: it is the simplest non-trivial layout primitive.

## 5. Design tokens

### Tokens consumed

| token | usage |
|---|---|
| `--lv-color-input` | background of the core input area + full-peer element slots |
| `--lv-color-muted` | background of addon slots (the lighter "attached label" look) |
| `--lv-color-border` | the group border, the internal divider between element and core |
| `--lv-color-border-hover` | border on `:hover` (group not disabled) |
| `--lv-color-destructive` | border colour when `invalid=true` |
| `--lv-color-fg` | text colour inside addons |
| `--lv-color-muted-fg` | placeholder-grade text in static text addons |
| `--lv-ring` | the `:focus-within` outline (the single ring for the whole group) |
| `--lv-ring-destructive` | the `:focus-within` ring when `invalid=true` |
| `--lv-space-8` | height + internal padding for size=sm |
| `--lv-space-9` | height + internal padding for size=md |
| `--lv-space-10` | height + internal padding for size=lg |
| `--lv-space-2` | horizontal padding inside addon slots |
| `--lv-space-3` | horizontal padding inside addon slots (md baseline) |
| `--lv-space-4` | horizontal padding inside addon slots (lg) |
| `--lv-radius-md` | outer border-radius of the group |
| `--lv-text-sm` | text size for addon text labels (sm/md sizes) |
| `--lv-text-base` | text size for addon text labels (lg size) |
| `--lv-font-sans` | font for addon text content |
| `--lv-opacity-disabled` | opacity of the group when `disabled=true` |
| `--lv-shadow-xs` | subtle inset shadow on the group border (optional, matches `input` styling) |

### Net-new tokens proposed

None. All required visual properties map to the existing token vocabulary. The addon muted background
uses `--lv-color-muted` (already exists); the internal divider uses `--lv-color-border` (already
exists); the focus ring uses `--lv-ring` (already exists). A new token would only be justified if a
distinct visual role were introduced — it is not.

### Dark mode

No new dark-mode rules. The existing `--lv-color-{input,muted,border,fg,muted-fg}` re-point in the
`.dark, [data-theme="dark"]` block already covers every surface this component reads. Structural
tokens (spacing, radius, type, z, motion) are theme-invariant.

## 6. Wire / island integration

### Server-rendered JTE structure

`input-group` is **PARTIAL, static, no enhancer**. The full DOM is server-rendered in a single `.jte`
pass. No wire round-trip, no enhancer, no `data-lievit-component` attribute.

**Elements, data-* hooks, and slot order in the template:**

```
<div
  data-slot="input-group"
  data-size="${size}"
  [role="group" aria-label="..." aria-labelledby="..." aria-describedby="..." if set]
  [aria-invalid="true" if invalid]
  [data-disabled if disabled]
  class="... (flex row, border, rounded-md, focus-within ring)"
  ${attrs}   ← TRUSTED raw (static only)
  ...escaped dataAttrs...
>

  <!-- leadingElement slot: renders only when leadingElement != null -->
  <div data-slot="leading-element" class="... (border-r divider, rounded-l-md)">
    ${leadingElement}
  </div>

  <!-- leadingAddon slot: renders only when leadingAddon != null -->
  <div
    data-slot="leading-addon"
    [aria-hidden="true" when containing only decorative content — adopter responsibility to omit when interactive]
    class="... (muted bg, padding, text-sm, flex items-center)"
  >
    ${leadingAddon}
  </div>

  <!-- core content slot: ALWAYS renders -->
  <div data-slot="content" class="... (flex-1, min-w-0)">
    ${content}
  </div>

  <!-- trailingAddon slot: renders only when trailingAddon != null -->
  <div
    data-slot="trailing-addon"
    [aria-hidden="true" when containing only decorative content]
    class="... (muted bg, padding, text-sm, flex items-center)"
  >
    ${trailingAddon}
  </div>

  <!-- trailingElement slot: renders only when trailingElement != null -->
  <div data-slot="trailing-element" class="... (border-l divider, rounded-r-md)">
    ${trailingElement}
  </div>

</div>
```

**CSS contracts enforced by the template:**

1. The group root is `display: flex; flex-direction: row; align-items: stretch` so all slots reach the
   same height.
2. The group root carries `border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md);
   overflow: hidden` — the overflow clip is what makes inner controls appear borderless (their own borders
   are clipped by the group).
3. Inner `<input>` and `<select>` partials MUST be rendered without their own outer border when inside a
   group. This is achieved via a CSS descendant selector on `[data-slot="input-group"] input,
   [data-slot="input-group"] select { border: none; border-radius: 0; box-shadow: none; }` in the token
   stylesheet — NOT via a prop on the `input` partial (the group's CSS context overrides).
4. Leading/trailing element slots add a `1px` internal divider via `border-right`/`border-left`
   (`--lv-color-border`), NOT a full standalone border, so the group frame is visually one unit.
5. `data-size` on the root drives the addon height and padding via Tailwind data-attribute variants
   (`data-[size=sm]:h-8`, `data-[size=md]:h-9`, `data-[size=lg]:h-10`).

**Escaping channels (the XSS decision rule, mirroring `button.jte`):**

- `attrs` = TRUSTED raw (`$unsafe`) — STATIC author-typed strings only (e.g. `data-testid="url-field-group"`
  baked at template authoring time). NEVER feed a DB-derived or user-provided value through `attrs`.
- `dataAttrs` = SAFE escaped dynamic `data-*` (each value through `Escape.htmlAttribute`). Any value that
  comes from a controller model (a request-scoped string, a DB field) goes through `dataAttrs`, never `attrs`.

### No enhancer

`input-group` has no TypeScript enhancer. There is no client state, no event binding, no wire directive.
The component is entirely server-rendered markup: the runtime's morph will patch it as part of a
surrounding WIRE component's re-render, but the group itself contributes nothing to that cycle beyond
its stable DOM.

When a containing WIRE component (e.g. a search form with an htmx-driven result list) morphs its region,
the group's DOM identity is preserved by the morph's key-matching (the `data-slot` + surrounding `id`
attributes); the focused `<input>` inside the group retains focus and its typed value survives (the
morph's form-state preservation, ADR-0019).

## 7. Acceptance tests

The component is DONE only when ALL of the following pass on a REAL substrate (not a mocked one).

### 7.1 Render (jsdom, real JTE compile + render)

- **base render**: `content`-only group renders one `<div data-slot="input-group">` wrapping the content;
  no leading/trailing slots rendered; no `role` attribute on the root (no label provided).
- **slot presence**: `leadingAddon` present → `<div data-slot="leading-addon">` is in the DOM and contains
  the slot's content; absent → no such element in the DOM (not an empty placeholder).
- **all slots**: a group with all four slots populated renders them in the correct DOM order: leading-element
  → leading-addon → content → trailing-addon → trailing-element.
- **role=group emitted**: when `ariaLabel="URL field"` is set, the root has `role="group"` and
  `aria-label="URL field"`.
- **no role when plain**: when neither `ariaLabel` nor `ariaLabelledBy` is set, the root has no `role`
  attribute (a gratuitous `role="group"` without a label is a WAI-ARIA error).
- **aria-labelledby**: when `ariaLabelledBy="lbl-date-range"` is set, the root has `role="group"` and
  `aria-labelledby="lbl-date-range"`.
- **aria-invalid**: `invalid=true` renders `aria-invalid="true"` on the root AND `data-invalid` for CSS.
- **disabled**: `disabled=true` renders `data-disabled` on the root.
- **data-size**: each of sm/md/lg renders `data-size="sm"` / `data-size="md"` / `data-size="lg"` on the root.
- **data-slot on root**: always `data-slot="input-group"`.
- **JTE compiles + renders without error**: covered by the `test/jte-compile` real-compiler + render gate.

### 7.2 axe-core (zero violations on the rendered DOM)

Assertions run on the real rendered HTML, not a mocked fragment:

- **wcag2a, wcag2aa ruleset**: zero violations.
- **WCAG 1.3.1** (Info and Relationships): a group with `role="group"` and `aria-labelledby` pointing at a
  rendered `<label>` id reports zero violations.
- **WCAG 4.1.2** (Name, Role, Value): every interactive element inside the group has an accessible name; an
  icon-only trailing button without `aria-label` FAILS (axe catches it — asserts the failure to prove the
  gate works).
- **decorative addon**: a group where `leadingAddon` contains only a static icon partial (which already emits
  `aria-hidden="true"` on the `<svg>`) reports zero violations — the decorative content is correctly hidden.
- **interactive addon button**: a group where `trailingAddon` contains a `<button aria-label="Clear">` reports
  zero violations — the interactive child is in the a11y tree with a name.

### 7.3 Keyboard (platform — assert the observable outcome)

All keyboard tests run on a real jsdom render with the real DOM focusable elements:

- **Tab order**: starting focus outside the group, Tab enters the group and focuses the first focusable child
  (the core `<input>` when no leading interactive element). A second Tab (when a trailing button is present)
  moves focus to the trailing button. A third Tab exits the group to the next page element. Assert via
  `document.activeElement`.
- **Enter on trailing button**: when a trailing element is a `<button>`, pressing Enter fires the button's
  click handler. Assert the handler was called.
- **Disabled controls**: when `disabled=true` and inner controls carry `disabled`, Tab skips them. Assert no
  inner element receives focus.
- **No trap**: after the last focusable inside the group receives focus, Tab moves to the NEXT focusable
  OUTSIDE the group (assert the group does not trap focus — the anti-trap assertion).

### 7.4 Focus ring (CSS `:focus-within`)

- **Single ring**: when the core `<input>` is focused, the group root's CSS `:focus-within` class applies.
  Assert via `classList` / `matches(":focus-within")`. (The individual input's own ring is suppressed inside
  the group context — assert the input does NOT render its own `--lv-ring` outline when inside the group.)
- **Destructive ring**: when `invalid=true` and the core input is focused, the ring is the destructive variant.
  Assert the group root has `data-invalid` and `:focus-within` simultaneously.

### 7.5 Variants / sizes

- **size tokens**: each of sm/md/lg renders `data-size` correctly; the Tailwind data-attribute variant classes
  that drive height are present on the relevant elements (assert class string contains the expected height
  class per size).
- **addon background**: the `leading-addon` slot's container has the `--lv-color-muted` background CSS variable
  reference in its class list (assert the Tailwind utility for that token is present).
- **element divider**: when a `leadingElement` is rendered, the `leading-element` slot container has a
  `border-r` (border-right) class. When a `trailingElement` is rendered, the `trailing-element` slot container
  has a `border-l` class.

### 7.6 Escaping (XSS gate)

- **dataAttrs safe**: `dataAttrs={testId: "\">|<script>alert(1)</script>"}` → the rendered attribute value is
  HTML-escaped (`&quot;&gt;|&lt;script&gt;...`), never a live `<script>` tag.
- **attrs trusted**: the spec documents that `attrs` is for STATIC author strings only; the test asserts that a
  static `attrs='data-testid="group-a"'` renders verbatim, AND documents (in the test name) that this channel
  must never receive dynamic data.

### 7.7 Compound composition

- **with input partial**: a group wrapping a real `input` partial (rendered to HTML via JTE) produces a
  well-formed fused unit; the input's own border classes are overridden by the group context CSS (assert the
  input has `border-0` or equivalent when inside the group).
- **with native-select as leading element**: a group with a `native-select` partial in `leadingElement` renders
  the select before the core input; Tab order is select → input (DOM order).

## 8. Non-goals / anti-patterns

- **No group-level state.** `input-group` does not hold, validate, or wire any form field value. Value state
  lives in the individual `<input>` / `<select>` elements inside, managed by their own `l:model` directives or
  native form submission. The group is a CSS layout shell, not a form controller.
- **No variant param.** Colour intent (destructive / info / success) is not expressed on the group as a whole.
  `invalid=true` is the only signal the group carries; all other intent lives on the inner controls or the
  surrounding `field` partial.
- **No JavaScript enhancer.** There is nothing client-side here. If you find yourself wanting to add an
  enhancer to `input-group`, the logic you need belongs on the INNER control (e.g. an auto-clear button
  belongs to the `input` partial's "clearable" feature, not to the group).
- **Not a fieldset replacement.** `input-group` is a visual layout primitive for a SINGLE logical field with
  decorative or lightweight addons. A group of MULTIPLE unrelated fields (e.g. first name + last name in a
  row) is a CSS grid layout in the surrounding `field` / `form` partial, not an `input-group`.
- **No implicit aria-hidden on addon containers.** The template renders the `aria-hidden` attribute on an
  addon container only when the ADOPTER explicitly passes purely-decorative content. The template cannot
  detect whether the content is interactive; the adopter is responsible for omitting `aria-hidden` when the
  addon slot contains a button. Getting this wrong in either direction is an a11y bug; the axe gate catches it.
- **Not a replacement for `field`.** `input-group` does not render a `<label>`, a hint, or an error message.
  It must always be wrapped by (or used alongside) the `field` partial, which owns the label→input association
  and the `aria-describedby` wiring. An `input-group` rendered without a wrapping `field` and without
  `ariaLabel`/`ariaLabelledBy` set will fail the axe accessible-name gate.
- **Not a multi-control compound widget.** A "date range" composed as two `<input>` elements inside one
  `input-group` is a layout convenience, not an APG DateRangePicker. The `role="group"` + `aria-labelledby`
  provides a shared semantic wrapper, but no additional keyboard semantics are added. The full APG
  `useDateRangePicker` interaction model belongs in a dedicated `date-picker` component (which IS in the
  inventory, S0) — not here.
- **No hardcoded option lists or labels inside the partial.** All text inside addons (unit labels, scheme
  strings, icon choices) comes from the ADOPTER's `leadingAddon`/`trailingAddon` Content slots, rendered by
  the controller. No strings are hardcoded in the partial (the "no data in a partial" rule, repo CLAUDE.md).

## Agent instructions

Generate ORIGINAL code over `--lv-*` tokens; you may read Ant Design `Input.Group` / Input affix model and
Tailwind UI Input with addons as references for PATTERN (visual treatment, slot semantics) and LOOK. You MUST
NOT paste literal source from any of them (no Ant Design / Tailwind UI class strings or JSX) — the output is
always original generation (`02-licensing.md`).

The house conventions from `button.jte` apply exactly:
- Header doc-comment with all labelled sections (including the credits line, the `STRUCTURE` source citation,
  and the `A11y` summary).
- Typed `@param` with defaults; each `gg.jte.Content` slot is null-checked before rendering its wrapper div
  (`!{var hasLeadingAddon = leadingAddon != null}` → conditional render of `<div data-slot="leading-addon">`).
- `data-slot="input-group"`, `data-size="${size}"`, `data-variant` is NOT used (no variant param here).
- The two escaping channels: `attrs` is `$unsafe` TRUSTED only, `dataAttrs` is `Map<String,String>` escaped.
- Zero `<script>`, zero inline `on*=`.

The GROUP-LEVEL CSS `:focus-within` ring is the main styling challenge: the inner `<input>` must suppress its
own outline inside the group context, while the group root shows one coherent ring. Achieve this with a
descendant CSS selector in the token stylesheet (NOT an inline style, NOT a Tailwind arbitrary value, NOT a
prop on the `input` partial — the group's context CSS is the right tool). This is a stylesheet rule alongside
the token definitions, not a per-component inline hack.

The `aria-hidden` on addon containers is NOT emitted automatically by the template for all cases: it is a
deliberate param or content-convention. The safest default is to NOT emit `aria-hidden` on the addon wrapper
(leave it to the content: the `icon` partial already emits `aria-hidden="true"` on its `<svg>`; a static text
span should be wrapped in a `<span aria-hidden="true">` by the adopter when it is purely decorative). Document
this clearly in the template's Usage examples so adopters apply the rule correctly.

Minimal code to GREEN against the acceptance tests; refactor only while green. The keyboard tests and the axe
tests are the contract — assert ALL of them.
