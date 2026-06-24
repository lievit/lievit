<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — toggle / toggle-buttons

- **tier**: PARTIAL (single toggle) | WIRE (toggle-buttons group, selected-set is a server fact) + ENH (`collection-nav.enhancer.ts` for roving tabindex inside the group)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/toggle.jte` and any toggle-group partial)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Button (`aria-pressed`) + APG Toolbar (roving tabindex for the group container);
      platform-supplied for single toggle (real `<button aria-pressed>`); the group's roving tabindex is the
      shared `collection-nav.enhancer.ts` (toolbar mode) — no react-aria reference needed for the single,
      react-aria `useToggleButton` interaction model as the pattern reference for the group
    - inventory: Ant Design Button group / Segmented as inventory reference (sizes, variants, icon-only,
      disabled per-item, single/multi-select group)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

Two related but independent components sharing this slug:

**toggle** (single): a stateful button that toggles between pressed and not-pressed.
The pressed-state is a boolean fact that may live client-side (ephemeral UI trigger — a sidebar collapser,
a preview toggle) or server-side (a persistent user preference — a "pin" button, a follow toggle).
When the state is ephemeral and local-only, this is a PARTIAL: the `pressed` param is authored in the
template and the consuming WIRE wires `l:click` on it.
When the state is a server fact (the toggle survives navigation, its value is stored or drives other server
state), the consuming component promotes it to a WIRE `@Wire boolean` field.
The default tier is PARTIAL because the rendered HTML is the same in both cases; the difference is only who
owns the `pressed` value.

**toggle-buttons** (group): a set of toggle buttons where exactly one (single-select) or one-or-more
(multi-select) items can be pressed at a time.
The selection-set IS a server fact (the chosen segment / view mode / filter set drives a query or persists
across navigation), so the group is WIRE.
The irreducible client behavior — roving tabindex inside the toolbar so the group is ONE tab stop with
arrow-key navigation — is the shared `collection-nav.enhancer.ts` in toolbar mode.

Server-first works for both: the pressed state is an attribute on a real `<button>`, rendered by the server
on every morph. There is no client-side state to manage. The enhancer adds only what the platform does not
supply natively (roving tabindex across grouped items).

## 2. API — params / props (the typed surface)

### 2.a `toggle` (PARTIAL)

| param | type | default | meaning |
|---|---|---|---|
| `pressed` | `boolean` | `false` | the current pressed state; reflected as `aria-pressed` |
| `variant` | `String` | `"outline"` | INTENT: `outline` \| `ghost` \| `primary` \| `secondary` — the default `outline` matches the common segmented look |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — height-based, toolbar-aligned |
| `iconOnly` | `boolean` | `false` | square icon-only control; `ariaLabel` becomes **REQUIRED** |
| `disabled` | `boolean` | `false` | dims + blocks activation; native `disabled` attr on the `<button>` |
| `ariaLabel` | `String` | `null` | `aria-label` — **REQUIRED when `iconOnly=true`**; optional override when text label is present |
| `ariaDescribedBy` | `String` | `null` | `aria-describedby` pointing to an external description element id |
| `cssClass` | `String` | `""` | extra utility classes (border-radius override for group position) |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (wire directives, `data-group-item`) |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` (value via `Escape.htmlAttribute`) |
| `wireClick` | `String` | `null` | **SAFE** wire action name → `l:click="${wireClick}"` (the consuming WIRE hooks this) |
| `wireArgs` | `Map<String,String>` | `{}` | **SAFE** per-item args merged into the escaped `data-*` fragment |
| `content` | `gg.jte.Content` | — | the label / icon+label (a single icon when `iconOnly`) |
| `leading` | `gg.jte.Content` | `null` | optional icon before the label |
| `trailing` | `gg.jte.Content` | `null` | optional icon/badge after the label |

### 2.b `toggle-buttons` group (WIRE — `ToggleButtonsComponent`)

**Java (`ToggleButtonsComponent`)**:

| member | kind | meaning |
|---|---|---|
| `items` `List<ToggleItem>` | `@Wire @LievitProperty(locked=true)` | ordered item set: `id`, `label`, `icon` (optional), `disabled` (per-item); locked — a client cannot inject items |
| `value` `String` | `@Wire` | the selected item id (single-select; `null` when nothing forced) |
| `values` `Set<String>` | `@Wire` | the selected item ids (multi-select; empty when nothing selected) |
| `multiSelect` `boolean` | `@Wire @LievitProperty(locked=true)` | `false` = exactly one active (single-select, like a segment control); `true` = any subset |
| `allowDeselect` `boolean` | `@Wire @LievitProperty(locked=true)` | single-select: whether clicking the active item deselects it (leaves `value` null); `false` enforces exactly-one |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `sm` \| `md` \| `lg` — applies to all items |
| `variant` `String` | `@Wire @LievitProperty(locked=true)` | `outline` \| `ghost` \| `primary` \| `secondary` — shared across all items; pressed-item uses the pressed-state token overlay |
| `orientation` `String` | `@Wire @LievitProperty(locked=true)` | `horizontal` (default) \| `vertical`; drives `aria-orientation` on the toolbar + `collection-nav` arrow axis |
| `label` `String` | `@Wire @LievitProperty(locked=true)` | accessible name for the toolbar; rendered as `aria-label` on the container (required if no visible heading labels the group) |
| `toggle(String id)` | `@LievitAction` | toggles the item; single-select: sets `value = id` (or null if allowDeselect + already selected); multi-select: adds or removes `id` from `values`; validates `id ∈ items` in Java BEFORE mutate |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param ToggleButtonsComponent _instance`. No `Content` slot (WIRE has none — owned markup renders the
item buttons from `items`).

**`ToggleItem` record** (the locked item descriptor):

| field | type | meaning |
|---|---|---|
| `id` | `String` | stable item identity, used as `wireArgs` value and `aria-pressed` key |
| `label` | `String` | visible text (and screen-reader label when no icon-only override) |
| `icon` | `String` | optional icon name (passed to `@template.lievit.icon`); when present alongside `label`, rendered as `leading` slot |
| `iconOnly` | `boolean` | `false`; when `true`, `label` is the `aria-label` (not rendered visually) |
| `disabled` | `boolean` | `false`; per-item disabled; does not affect other items' navigation |

## 3. Variants / Sizes / States / Slots

### Variants

The `variant` param names an INTENT in the shared library vocabulary, mapped to token pairs:

| variant | resting look | pressed look |
|---|---|---|
| `outline` | `--lv-color-bg` fill + `--lv-color-border` stroke | `--lv-color-accent` fill + `--lv-color-accent-fg` text + `--lv-color-accent` stroke |
| `ghost` | transparent fill, no stroke | `--lv-color-accent` fill + `--lv-color-accent-fg` text |
| `primary` | `--lv-color-primary` fill + `--lv-color-primary-fg` text | stronger primary: `--lv-color-primary` at higher lightness / `--lv-color-primary-pressed` overlay |
| `secondary` | `--lv-color-secondary` fill + `--lv-color-secondary-fg` text | `--lv-color-secondary-pressed` overlay |

The pressed state is driven by the `aria-pressed` attribute on the `<button>` element; CSS selects on
`[aria-pressed="true"]` — no JS class manipulation, no extra data attribute, purely declarative.

### Sizes (height-based, toolbar-aligned)

| size | height token | typical usage |
|---|---|---|
| `sm` | `--lv-space-8` (32 px) | dense toolbars, compact form rows |
| `md` | `--lv-space-9` (36 px, default) | standard toolbar, shadcn baseline |
| `lg` | `--lv-space-10` (40 px) | hero segmented control, prominent filter bar |

`iconOnly` → width = height, `p-0`.
Horizontal padding and text size scale with height (same ladder as `button.jte`).

### States

| state | how expressed | who sets |
|---|---|---|
| resting unpressed | `aria-pressed="false"` + resting token fill | server (template) |
| pressed | `aria-pressed="true"` + pressed token overlay (CSS `[aria-pressed="true"]`) | server (template, reads `value`/`values`) |
| hovered | `:hover` utility | platform CSS |
| focused | `:focus-visible` + `--lv-ring` | platform CSS |
| disabled (item) | native `disabled` attr + `disabled:` utilities | server (template, reads `item.disabled()`) |
| disabled (whole group) | `aria-disabled` on toolbar container + each item `disabled` | server (template) |
| `aria-invalid` | destructive border + ring | server (template, when the field is in error) |
| `aria-busy` | set by the lievit runtime `beforeCall`/`afterCall` during a wire round-trip | lievit runtime (components do nothing) |

### Slots (PARTIAL `toggle` only — WIRE `toggle-buttons` owns its markup)

| slot | type | meaning |
|---|---|---|
| `content` | `gg.jte.Content` | required — the label / icon+label / single icon when `iconOnly` |
| `leading` | `gg.jte.Content` | optional icon before the label |
| `trailing` | `gg.jte.Content` | optional icon/badge after the label |

The WIRE `toggle-buttons` has NO slots; item rendering is OWNED markup inside the template, built from the
`ToggleItem` list (server-first refactor blueprint §1.b).

## 4. The a11y contract (the heart — non-negotiable, fully specified)

### Single `toggle`

- **WAI-ARIA pattern**: APG Button — Toggle Button variant.
  Source: https://www.w3.org/WAI/ARIA/apg/patterns/button/

- **Roles + ARIA**:
    - element: a real `<button>` (no `role` override; the native element supplies `role=button` for free)
    - `aria-pressed="false"` when unpressed; `aria-pressed="true"` when pressed
    - `aria-label` from `ariaLabel` when provided; **mandatory when `iconOnly=true`** (no visible text = no
      accessible name otherwise; axe accessible-name rule)
    - `aria-describedby` from `ariaDescribedBy` when provided
    - `aria-disabled="true"` is NOT used on a `<button>` — native `disabled` is correct (removes from tab
      order AND blocks activation; `<button disabled>` is the right form)
    - `aria-busy="true"` when the wire round-trip is in flight (runtime-managed)

- **Critical label stability rule** (APG requirement): the visible label on a toggle MUST NOT change when
  the pressed state changes. A mute button stays labeled "Mute" whether pressed or not; the state is
  communicated by `aria-pressed`, not by label mutation. This rule is enforced in the spec: no conditional
  label text based on `pressed`.

- **Keyboard map** (APG Button, verified against https://www.w3.org/WAI/ARIA/apg/patterns/button/):

  | key | action | who supplies |
  |---|---|---|
  | `Enter` | activate — toggles pressed state | platform (native `<button>`) |
  | `Space` | activate — toggles pressed state | platform (native `<button>`) |
  | `Tab` / `Shift+Tab` | move focus in / out | platform |

  A disabled button is removed from the tab order and cannot be activated (native `disabled` semantics).
  Focus stays on the button after activation (it does not dismiss context or navigate away).

- **Focus management**: platform. Focus-visible ring via `--lv-ring`. No trap, no roving. The WIRE
  round-trip fires after activation; the lievit runtime morph preserves focus on the button (identity-
  preserving morph — the button node is patched in place, not replaced).

- **Live region**: none for the single toggle (the state change is announced by `aria-pressed` directly to
  assistive technology; no separate status region needed).

- **Shared mechanism composed**: none (platform-only for the single toggle). This component uses the same
  discipline as `button.jte`: prefer a real native element; the platform gives role + keyboard + state
  signalling via `aria-pressed` for free.

---

### `toggle-buttons` group

- **WAI-ARIA patterns**:
    1. APG Button — Toggle Button (`aria-pressed` on each item button).
       Source: https://www.w3.org/WAI/ARIA/apg/patterns/button/
    2. APG Toolbar — for the group container (roving tabindex, single tab stop, arrow navigation).
       Source: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/

- **Roles + ARIA**:
    - **container**: `role="toolbar"` + `aria-label="${label}"` (or `aria-labelledby` when a visible heading
      is present); `aria-orientation="vertical"` when `orientation=vertical` (default is horizontal, so the
      attribute is omitted for horizontal — APG default).
    - **each item button**: a real `<button>` with `aria-pressed="${id == value || values.contains(id) ? 'true' : 'false'}"`;
      native `disabled` when `item.disabled()` is true; `aria-label` from `item.label()` when `item.iconOnly()`.
    - **no `role=group`**: the APG Toolbar pattern is the correct container for a set of related controls
      that share a single tab stop with arrow navigation; `role=group` lacks the keyboard contract.

- **Keyboard map** (APG Toolbar + APG Toggle Button, verified against https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/):

  | key | action | who supplies |
  |---|---|---|
  | `Tab` | move focus INTO the toolbar (to the first non-disabled item, or the previously focused item) | platform + `collection-nav` (roving tabindex management) |
  | `Shift+Tab` | move focus OUT of the toolbar | platform + `collection-nav` |
  | `ArrowRight` (horizontal) | move focus to the next item; wraps from last to first | `collection-nav` enhancer (toolbar mode) |
  | `ArrowLeft` (horizontal) | move focus to the previous item; wraps from first to last | `collection-nav` enhancer (toolbar mode) |
  | `ArrowDown` (vertical) | same as `ArrowRight` for a vertical toolbar | `collection-nav` enhancer |
  | `ArrowUp` (vertical) | same as `ArrowLeft` for a vertical toolbar | `collection-nav` enhancer |
  | `Home` | move focus to the first non-disabled item | `collection-nav` enhancer |
  | `End` | move focus to the last non-disabled item | `collection-nav` enhancer |
  | `Enter` / `Space` (on focused item) | activate — fires `toggle(id)` wire action | platform (native `<button>`) → wire |
  | (disabled item during arrow nav) | skipped — arrow nav skips disabled items | `collection-nav` enhancer |

  The group is a SINGLE tab stop: Tab enters/exits the whole toolbar; Arrow keys navigate within.
  This is the APG Toolbar roving-tabindex model.

- **Focus management**:
    - **Roving tabindex**: at any moment, exactly one item button has `tabindex="0"`; all others have
      `tabindex="-1"`. The `collection-nav` enhancer (toolbar mode) owns this state: it updates
      `tabindex` on arrow key press and on external focus entry. The server renders the INITIAL
      `tabindex` value (the pressed/selected item gets `tabindex="0"`; if none is selected, the first
      non-disabled item does).
    - **Initial focus**: when Tab enters the toolbar, focus lands on the item with `tabindex="0"` (the
      previously focused or the first non-disabled).
    - **After wire round-trip**: the lievit morph preserves node identity; the button that was focused
      retains focus after re-render. The `collection-nav` enhancer re-syncs `tabindex` values after the
      morph (lifecycle `onComponentUpdate`).
    - **No trap**: the toolbar is non-modal; Tab exits normally.
    - **Disabled item skipping**: `collection-nav` skips items with `disabled` attribute during arrow navigation.
    - **Shared mechanism**: `collection-nav.enhancer.ts` in TOOLBAR mode (not listbox mode). This is the
      same enhancer used by `select`, `dropdown-menu`, and `navigation-menu`; the mode parameter selects
      the toolbar vs listbox keyboard contract. Do NOT hand-roll roving tabindex.

- **Live region**: optional status announcement for multi-select (e.g. "Bold enabled" / "Bold disabled")
  via the shared announcer, only when the group cannot produce a visible persistent status cue. In practice,
  `aria-pressed` already signals the state change to AT; the announcer is only needed if the pressed state
  is visually ambiguous and a screen reader user needs a verbal confirmation.

- **Shared mechanisms composed**: `collection-nav.enhancer.ts` (toolbar roving tabindex + disabled-skip +
  Home/End). Do NOT re-implement roving tabindex per component.

## 5. Tokens

### Tokens consumed (single toggle + group items)

| token | usage |
|---|---|
| `--lv-color-bg` | resting fill for `outline` variant |
| `--lv-color-border` | resting stroke for `outline` variant |
| `--lv-color-accent` | pressed fill + stroke (all variants) |
| `--lv-color-accent-fg` | pressed text + icon (all variants) |
| `--lv-color-primary` | resting fill for `primary` variant |
| `--lv-color-primary-fg` | resting text for `primary` variant |
| `--lv-color-secondary` | resting fill for `secondary` variant |
| `--lv-color-secondary-fg` | resting text for `secondary` variant |
| `--lv-color-fg` | resting text for `ghost`/`outline` variants |
| `--lv-color-muted` | disabled text |
| `--lv-color-muted-bg` | disabled fill |
| `--lv-space-8` | height for `sm` |
| `--lv-space-9` | height for `md` (default) |
| `--lv-space-10` | height for `lg` |
| `--lv-space-2` | gap between icon and label |
| `--lv-space-3` | horizontal padding `sm` |
| `--lv-space-4` | horizontal padding `md` |
| `--lv-space-5` | horizontal padding `lg` |
| `--lv-text-xs` | font size `sm` |
| `--lv-text-sm` | font size `md` |
| `--lv-text-base` | font size `lg` |
| `--lv-radius-md` | corner radius for standalone toggle |
| `--lv-radius-sm` | corner radius for inner items in a group |
| `--lv-radius-none` | interior item joints in a group (no radius on joined edges) |
| `--lv-ring` | focus-visible ring |
| `--lv-font-sans` | font family |

### NET-NEW tokens proposed

| token | value (OKLCH) | justification |
|---|---|---|
| `--lv-color-accent-pressed` | `oklch(0.52 0.18 250)` (slightly deeper than `--lv-color-accent`) | pressed-state overlay for items in `primary`/`secondary` variants needs a distinct pressed-deeper colour so the pressed vs resting difference is legible at all contrast levels; reuses the pattern from `--lv-color-primary` hover states but for the `accent` slot specifically. Added to `:root` + `.dark` blocks. |

All colour tokens authored in OKLCH (source-of-truth format, architecture contract §4, D1 DECIDED).
No literal hex. No hardcoded colour strings inside any `.jte`.

## 6. Wire / Island integration

### Single `toggle` (PARTIAL — static, no dedicated enhancer)

The partial renders:

```
<button
  type="button"
  aria-pressed="${pressed ? 'true' : 'false'}"
  data-slot="toggle"
  data-variant="${variant}"
  data-size="${size}"
  data-pressed="${pressed ? 'true' : 'false'}"
  [disabled if disabled]
  [aria-label if ariaLabel set]
  [aria-describedby if ariaDescribedBy set]
  class="[height + padding + text tokens via switch on variant+size] [cssClass]"
  ${attrs}
  [data-* from dataAttrs, each value Escape.htmlAttribute'd]
  [l:click="${wireClick}" if wireClick set]
  [data-* from wireArgs, each value Escape.htmlAttribute'd]
>
  @if(leading != null) @template.lievit.icon(...)
  @template.content(content)
  @if(trailing != null) ...
</button>
```

No `<script>`, no inline `on*=`, no client state. The consuming WIRE template wires `l:click="myAction"`
via `wireClick` or the `attrs` trusted channel. The server sets `pressed` on the next render; the morph
patches the `aria-pressed` attribute and the CSS-selected pressed look updates automatically.

### `toggle-buttons` group (WIRE + `collection-nav.enhancer.ts` toolbar mode)

**Server-rendered WIRE template structure**:

```
<div
  role="toolbar"
  data-slot="toggle-buttons"
  data-variant="${variant}"
  data-size="${size}"
  data-orientation="${orientation}"
  aria-label="${label}"
  aria-orientation="${orientation == 'vertical' ? 'vertical' : null}"
  data-lievit-component="${_component.fqn()}"
  data-lievit-id="${_component.id()}"
  data-lievit-snapshot="${_component.snapshot()}"
  data-collection-nav="toolbar"                       <%-- enhancer hook --%>
  data-nav-orientation="${orientation}"               <%-- enhancer reads axis --%>
  class="inline-flex [gap + radius group tokens]"
>
  @for(ToggleItem item : _instance.items())
    !{boolean isPressed = multiSelect ? values.contains(item.id()) : item.id().equals(value)}
    !{boolean isFirst  = _instance.items().indexOf(item) == 0}
    !{boolean isLast   = _instance.items().indexOf(item) == _instance.items().size() - 1}
    <button
      type="button"
      role="button"
      aria-pressed="${isPressed ? 'true' : 'false'}"
      data-slot="toggle-item"
      data-item-id="${item.id()}"                     <%-- escaped; wireArgs channel --%>
      tabindex="${isPressed || (isFirst && value == null && values.isEmpty()) ? '0' : '-1'}"
      l:click="toggle"
      data-id="${item.id()}"                          <%-- SAFE via Escape.htmlAttribute --%>
      ${item.disabled() ? "disabled" : ""}
      ${item.iconOnly() ? "aria-label=\"" + Escape.htmlAttribute(item.label()) + "\"" : ""}
      class="[height + padding + text tokens] [group-position radius tokens depending on isFirst/isLast] [cssClass]"
    >
      @if(item.icon() != null) @template.lievit.icon(name = item.icon())
      @if(!item.iconOnly()) ${item.label()}
    </button>
  @endfor
</div>
```

**The two escaping channels** (the XSS decision rule):
- `attrs` on the container = TRUSTED raw (`$unsafe`) — STATIC author-typed strings only.
- `data-id="${item.id()}"` on each button = SAFE: each value goes through `Escape.htmlAttribute` before
  rendering. A DB-sourced item id is never interpolated raw.

**`collection-nav.enhancer.ts` responsibilities (toolbar mode)**:

1. **On mount** (`onComponentInit` lifecycle): read `data-collection-nav="toolbar"` + `data-nav-orientation`.
   Confirm that `tabindex` values are already server-rendered (the initial roving state).
2. **Arrow key bindings** (keydown on the container):
   - Horizontal: `ArrowRight` → next focusable; `ArrowLeft` → previous focusable.
   - Vertical: `ArrowDown` → next; `ArrowUp` → previous.
   - Wrapping: last item → first; first → last.
   - `Home` → first non-disabled; `End` → last non-disabled.
   - Disabled items are skipped (check `disabled` attribute).
   - On move: set `tabindex="0"` on the new item, `tabindex="-1"` on the old; call `element.focus()`.
3. **After wire morph** (`onComponentUpdate` lifecycle): re-sync `tabindex` values from the re-rendered
   DOM (the server sets the correct initial `tabindex` for the new pressed state; the enhancer only
   re-registers event listeners on the new node set).
4. **No wire action fired by the enhancer**: the `l:click="toggle"` directive on each button handles
   the wire call natively. The enhancer only manages focus/tabindex.
5. **CSP-clean**: no `eval`, no inline event strings, no `new Function`. Pure event listeners attached
   to real DOM nodes.

**Round-trip for a single-select group**:
user clicks item B (or focuses it with arrows and presses Enter/Space) →
`l:click="toggle"` fires `data-id="B"` →
`toggle("B")` Java action: validates B ∈ items, sets `value = "B"` (or null if allowDeselect + already
selected) →
server re-renders: item B gets `aria-pressed="true" tabindex="0"`, item A gets `aria-pressed="false"
tabindex="-1"` →
morph patches the DOM →
`collection-nav` `onComponentUpdate`: re-registers listeners on the new DOM.

**Round-trip for a multi-select group**:
user activates item C → `toggle("C")` → server adds/removes C from `values` → re-renders → morph.

## 7. Acceptance tests

### Single `toggle` (jsdom, PARTIAL)

- **render — default unpressed**: renders a `<button>` with `aria-pressed="false"`, `data-slot="toggle"`,
  `data-variant="outline"`, `data-size="md"`; content projected and visible.
- **render — pressed**: `pressed=true` → `aria-pressed="true"`; the CSS `[aria-pressed="true"]` selector
  is present in the rendered class; no label text changes.
- **render — iconOnly**: `iconOnly=true`, `ariaLabel="Mute"` → `aria-label="Mute"` is present; no visible
  text in the button.
- **axe-core — iconOnly WITHOUT ariaLabel FAILS**: asserts the accessible-name violation fires (the gate
  that makes `ariaLabel` mandatory for icon-only).
- **axe-core — normal render**: zero violations on a rendered pressed and unpressed toggle.
- **keyboard**: Enter activates (assert the click fires on a real jsdom `<button>`); Space activates;
  disabled toggle receives no activation; focus stays on the button after activation (no focus move).
- **label-stability assertion**: rendering with `pressed=false` and with `pressed=true` produces the SAME
  visible text content (the critical APG label-stability rule).
- **variants/sizes**: `variant="ghost"` emits ghost token classes; `size="sm"` emits `--lv-space-8` height
  token; `iconOnly` renders square (width = height class).
- **states**: `disabled` renders native `disabled` attribute; `aria-busy` is set during a wire round-trip
  (runtime-managed; assert the attribute appears when `aria-busy` is injected).
- **escaping** (XSS abuse-case): `wireArgs={id: "\">|<script>alert(1)</script>"}` renders inert — the
  value is HTML-escaped in the `data-id` attribute; `attrs` is documented trusted-only.
- **JTE compiles + renders**: covered by `test/jte-compile` real-compiler gate.

### `toggle-buttons` group (real LievitRuntime + jsdom + collection-nav enhancer — NOT mocked)

- **render — initial state**: renders `role="toolbar"`, `aria-label` present, each item is a `<button>`
  with `aria-pressed` matching the server `value`/`values`; the selected item has `tabindex="0"`, all
  others `tabindex="-1"`.
- **render — no selection (single-select)**: the first non-disabled item has `tabindex="0"` (roving
  tabindex initial state when nothing is selected).
- **render — disabled item**: item with `disabled=true` renders with native `disabled` attribute; it is
  not the roving-tabindex holder even if it would otherwise be first.
- **axe-core**: zero violations on the rendered toolbar (APG Toolbar + Toggle Button rules); each
  icon-only item has `aria-label`; `role="toolbar"` has an accessible name via `aria-label`.
- **keyboard — ArrowRight moves focus**: assert `document.activeElement` advances to the next item.
- **keyboard — ArrowLeft wraps from first to last**: assert wrap from item[0] to item[last].
- **keyboard — Home/End**: assert Home lands on the first non-disabled, End on the last non-disabled.
- **keyboard — disabled item skipped**: arrow navigation skips a disabled item (asserts the element with
  `disabled` is never the `document.activeElement` during arrow traversal).
- **keyboard — Enter activates**: focus on item B, press Enter → `toggle("B")` wire action fires (assert
  the action name and data-id in the POST body); after morph, item B has `aria-pressed="true"`.
- **keyboard — Space activates**: same as Enter assertion.
- **single-select allowDeselect=false**: clicking the active item does not deselect it (assert `aria-pressed`
  stays "true" on the item after a second click).
- **single-select allowDeselect=true**: clicking the active item deselects it (assert `aria-pressed`
  becomes "false" after the second click, `value` is null in the re-render).
- **multi-select**: activating an item toggles it independently; two items can be `aria-pressed="true"`
  simultaneously.
- **focus after wire morph**: after a toggle wire round-trip, `document.activeElement` is still on the
  item that was clicked (morph preserves node identity).
- **tabindex re-sync after morph**: after a round-trip that changes the selected item, the new selected
  item has `tabindex="0"` and the old selected item has `tabindex="-1"` (server renders the correct
  initial value; enhancer re-registers on `onComponentUpdate`).
- **wire round-trip IT** (lievit-kit, real runtime, `CollapsibleComponentIT` pattern): mount → click item
  → re-render → assert new `aria-pressed` state in the rendered DOM; assert the previously-selected item
  lost `aria-pressed="true"` (single-select).
- **escaping**: item whose `id` contains `"><script>` renders with the id HTML-escaped in `data-id`;
  the toolbar container and the buttons are intact.
- **orientation — vertical**: `orientation="vertical"` → `aria-orientation="vertical"` on the toolbar;
  `ArrowDown` / `ArrowUp` navigate items (not `ArrowLeft/Right`); assert `collection-nav` reads
  `data-nav-orientation="vertical"`.
- **Playwright** (gesture fidelity, legacy-VM oracle): a real mouse click toggles an item; a keyboard user
  tabs into the group, arrows to an item, presses Space; the toolbar shows the pressed state correctly
  in the real browser DOM (not a fake substrate — the client-island-fidelity lesson).

## 8. Non-goals / anti-patterns

- **Do NOT use `role="group"` for the toggle-buttons container.** `role=group` has no keyboard contract;
  the APG Toolbar pattern is the correct choice for a set of controls sharing a single tab stop with arrow
  navigation.
- **Do NOT change the button label when pressed state changes** (APG label-stability rule). A "Bold" button
  stays labeled "Bold" whether pressed or not. If a label like "Enable notifications" / "Disable notifications"
  seems right, that is two different actions, not a toggle — use two separate buttons or a checkbox.
- **Do NOT implement roving tabindex by hand.** The `collection-nav.enhancer.ts` is the single source for
  this behavior. Reinventing it per component is exactly the failure mode the single-source-a11y rule prevents.
- **Do NOT use `aria-selected` on toggle buttons.** `aria-selected` belongs to `role=option` inside a
  listbox. A toggle button uses `aria-pressed`. Using the wrong state attribute breaks AT announcements.
- **Do NOT wire the single `toggle` to track its own pressed state in client JS.** If pressed state is
  ephemeral (sidebar open), the consuming WIRE template owns that boolean as a `@Wire` field. If it is
  persistent (user preference), it lives in a server-side store. The toggle partial renders what the server
  says; it does not maintain a shadow copy client-side.
- **Do NOT allow client-submitted item lists for toggle-buttons.** The `items` list is `@LievitProperty(locked=true)`:
  a client cannot inject new options into the set. Validation in `toggle()` also checks `id ∈ items`.
- **Do NOT apply focus trapping to a toggle group.** The toolbar is non-modal. Tab exits the group freely;
  only a dialog/drawer uses the `focus-trap` enhancer.
- **`toggle-buttons` is NOT a checkbox group.** If the semantic need is "check multiple options in a form
  that submits as a multi-value field", use `checkbox-list`. `toggle-buttons` is for visual selection
  within a view (view mode, filter chips, text-editor formatting). The semantic difference matters for AT.
- **Do NOT use a `toggle-buttons` group for navigation.** Clicking a toggle should update view state within
  the same page, not navigate to a new route. For link-based tab-like navigation, use `tabs` (which uses
  `role=tab` + `role=tabpanel`, a different APG pattern).
- **No `<script>` or inline `on*=` in the JTE template.** The strict CSP refuses them. The `collection-nav`
  enhancer attaches listeners via the directive registry, never via attributes.

## Agent instructions

Generate ORIGINAL code over `--lv-*` tokens.
You MAY read the WAI-ARIA APG Button / Toolbar patterns, react-aria `useToggleButton` / toolbar interaction
model, Ant Design Button group / Segmented feature set, and Tailwind UI toggle styling as references for
PATTERN (a11y, inventory) and LOOK.
You MUST NOT paste literal source from ANY of them — the output is always original generation. (`02-licensing.md`.)
Compose `collection-nav.enhancer.ts` in toolbar mode — do NOT hand-roll roving tabindex or disabled-item skip.
Mirror `button.jte` house conventions exactly (header doc-comment with credited sources, typed `@param`,
`data-slot`, the two escaping channels, zero `<script>`).
For the WIRE `toggle-buttons`: use OWNED markup (no `Content` slot); reflect pressed state via
`aria-pressed` on each `<button>` from the server; render the initial `tabindex` server-side so the
enhancer's `onComponentInit` is a registration, not a re-compute.
Validate `id ∈ items` in the Java `toggle()` action BEFORE mutating `value`/`values`.
The label-stability rule is non-negotiable: assert it in the tests.
Minimal code to GREEN against the acceptance tests; the keyboard map and the label-stability rule are
the contract — assert ALL of it.
