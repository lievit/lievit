<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — popover (the SEAM: native popover + CSS Anchor Positioning)

- **tier**: WIRE + ENH (`popover-anchor.enhancer.ts` — the one irreducible client bit: anchor
  positioning fallback + focus-return bookkeeping for light-dismiss; NOT a framework)
- **build sequence**: S0  (the SEAM; every overlay component in S0 depends on this being built first)
- **status (current)**: COVERED (re-forge of an existing `popover`/overlay primitive; the
  canonical popover mechanism the whole overlay family — dialog, drawer, dropdown-menu, select,
  tooltip, hover-card, date-picker — composes; spec pins it as the ONE positioning seam so no
  other overlay hand-rolls it)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Disclosure (Show/Hide) pattern
      (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) as the base keyboard+ARIA model
      for the trigger/panel pair; native HTML `popover` attribute (MDN + open-ui.org/components/
      popover.research.explainer) as the browser-native light-dismiss + top-layer seam; NO APG
      "Popover" pattern exists — the APG Disclosure pattern + native `popover` + context-specific
      ARIA roles (added by the composing component) is the correct assembly. BUILT against these
      two primary sources; no react-aria reference for this specific pattern (RA wraps the native
      API; we use the native API directly).
    - inventory: the popover panel itself is NOT an Ant Design `Popover` clone (Ant Design's
      `Popover` is a tooltip-with-rich-content; lievit's is the POSITIONING + LIGHT-DISMISS SEAM
      that EVERY overlay composes); the feature inventory is drawn from Radix UI `Popper` /
      Floating UI placement vocabulary as the de-facto placement API, plus the native `popover`
      attribute's auto/manual/hint type vocabulary.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; panel surface + arrow/caret
      look inspired by Tailwind UI (NO code copied)

---

## 1. What it is

The popover is the **shared positioning + light-dismiss + focus-return seam** that every non-modal
overlay in lievit composes: `dropdown-menu`, `select`, `combobox`, `tooltip`, `hover-card`,
`date-picker`, `time-picker`, `context-menu`, `command` palette, and `mentions`. It is NOT a
standalone informational bubble (that is `tooltip`); it is the ONE mechanism every overlay builds on
so that none of them hand-rolls anchor positioning or light-dismiss (the architecture contract §2.b
single-source-a11y rule, the convergence lever).

Concretely: a popover consists of a **trigger element** (always a real `<button>`) and a **panel**
(a styled container carrying the `popover="auto"` attribute). The browser's native popover API
supplies the top-layer stacking, the Escape key close signal, and the `popover="auto"` light-dismiss
(click outside). CSS Anchor Positioning (`anchor-name` / `position-area`) supplies the placement
relative to the trigger — no JS positioning loop. The `popover-anchor.enhancer.ts` handles the
one irreducible client bit: (a) a CSS Anchor Positioning polyfill wiring for older browsers until
support is universal; (b) bookkeeping of the "opener" element so focus can be returned on
light-dismiss (the browser returns focus on Esc-dismiss; the enhancer covers the click-outside case
where the browser spec does NOT guarantee return).

The open-state is a **server fact** (`@Wire boolean open`) because:
- the composing component (select, dropdown-menu, date-picker…) needs the panel body rendered by
  the server (no client-side slot that can silently fail to fill — the bug class the whole pivot
  killed);
- the server controls WHAT is inside the panel, which may depend on domain state (filtered options,
  a date grid with marked appointments, a command palette seeded with recent actions).

The wire round-trip on open is therefore intentional and fast (a single server re-render of the
panel content). The enhancer does NOT manage open-state; it only wires the CSS anchor and manages
focus-return bookkeeping.

The popover **does not trap focus** (it is non-modal, unlike `dialog`). Tab leaves the panel
naturally; focus-return on close is the one non-native concern the enhancer covers.

---

## 2. API — the WIRE surface + template params

### Java (`PopoverComponent`)

| member | kind | meaning |
|---|---|---|
| `open` `boolean` | `@Wire` | the open-state; `true` = panel is in the DOM and visible |
| `placement` `String` | `@Wire @LievitProperty(locked=true)` | `bottom \| bottom-start \| bottom-end \| top \| top-start \| top-end \| left \| left-start \| left-end \| right \| right-start \| right-end` — CSS Anchor Positioning `position-area` value; default `"bottom-start"` |
| `type` `String` | `@Wire @LievitProperty(locked=true)` | `auto \| manual \| hint` — maps to `popover="auto|manual|hint"`; default `"auto"` (light-dismiss enabled). `manual` = composing component manages close explicitly (e.g. `select` closes on option pick via wire action). |
| `offset` `int` | `@Wire @LievitProperty(locked=true)` | gap in px between trigger and panel edge; default `4`. Applied as a CSS custom property `--lv-popover-offset`. |
| `withArrow` `boolean` | `@Wire @LievitProperty(locked=true)` | render a decorative caret/arrow pointing at the trigger; default `false`. Position derived from `placement`. |
| `triggerId` `String` | `@Wire @LievitProperty(locked=true)` | the `id` of the trigger `<button>`; used for `aria-controls` + CSS `anchor-name`; auto-generated from `_component.id()` if blank |
| `panelId` `String` | `@Wire @LievitProperty(locked=true)` | the `id` of the popover panel; used for `popovertarget` + `aria-controls`; auto-generated |
| `toggleOpen()` | `@LievitAction` | toggle `open`; called by the trigger `l:click`. When `open` flips to `true`, the server re-renders the panel body. |
| `close()` | `@LievitAction` | set `open = false`; called by the composing component (e.g. a menu item click) or by the enhancer on light-dismiss to sync server state. |

> **No `@LievitAction open()` is exposed.** The composing component adds its own open trigger
> (e.g. a `dropdown-menu` has `openMenu()` that also seeds the options); `toggleOpen()` is the
> generic entry point when no setup is needed.

### Template params

One `@param` per `@Wire` field + `@param ComponentMetadata _component` + `@param PopoverComponent
_instance`. No `Content` slot (WIRE has none — server-first refactor blueprint §1.b). The panel
body is **OWNED template markup** edited in the adopting component's owned copy.

> **How composing components use this**: `dropdown-menu`, `select`, etc. do NOT call `@template.
> lievit.popover(...)` from their own template. Instead, they OWN a copy of the popover wire
> template (the copy-in pattern, opt-out per RFC 0036) and extend it — the panel body section is
> where their owned markup lives. The popover wire component is the BASE; the composing component
> EXTENDS it by overriding the body region of its owned copy. This is the correct WIRE extension
> model (no slot, owned markup, server-first refactor blueprint §1.b).

---

## 3. Variants / Sizes / States / Slots

### Variants (panel surface intent)

The popover panel itself carries no semantic variant (it is a neutral surface whose intent is
declared by the composing component via `role`). A `variant` param exists on the PANEL surface to
control the visual treatment — for the standalone popover or for composing components that want the
base look:

| variant | intent | token pair |
|---|---|---|
| `default` | neutral panel (the base) | `--lv-color-popover` / `--lv-color-popover-fg` |
| `muted` | lower-contrast subdued surface (hover-card, hint-level overlays) | `--lv-color-muted` / `--lv-color-muted-fg` |
| `destructive` | danger context (confirm-delete popover body) | `--lv-color-destructive` / `--lv-color-destructive-fg` |

### Placement vocabulary (all twelve positions)

```
bottom-start (default) | bottom | bottom-end
top-start              | top    | top-end
left-start             | left   | left-end
right-start            | right  | right-end
```

Each maps to a CSS `position-area` value (CSS Anchor Positioning Level 1). The enhancer adds the
`--lv-popover-placement` attribute for the arrow direction when `withArrow=true`.

### Popover type

| type | light-dismiss | Esc closes | closes other `auto` | use case |
|---|---|---|---|---|
| `auto` | click outside | yes | yes | dropdown-menu, select, combobox, date-picker, command |
| `manual` | no | no | no | composing component owns close; used when the panel must stay open through internal interactions (e.g. a nested sub-menu popover) |
| `hint` | click outside | yes | no | tooltip, hover-card (does not interrupt an open `auto` popover) |

### States

- `open` (`@Wire boolean`): when `true` the panel is rendered in the DOM with the native
  `popover` attribute; when `false` the panel markup is absent (not hidden via CSS — the
  server-side conditional governs presence; the native `popover` API itself also hides via
  `display:none` in the top layer until shown, but server-conditional presence is cleaner and
  avoids any flash of hidden content).
- `aria-expanded` on the trigger: `"true"` when `open`, `"false"` otherwise — server-emitted.
- `aria-busy` on the trigger: set by the lievit runtime's `beforeCall`/`afterCall` hook during
  the wire round-trip (the server re-render of the panel body). The component does nothing; the
  runtime manages it.
- disabled trigger: when the composing component marks the trigger `disabled`, the panel cannot
  open (native `<button disabled>` blocks activation; the wire action is never fired).

### Slots / regions (OWNED markup regions, not JTE `Content` slots)

| region | description |
|---|---|
| panel body | the primary OWNED template markup section; composing component fills this with its content (options list, date grid, form, rich text) |
| panel header (optional) | a title region; used when the popover is a rich informational panel (e.g. hover-card, command palette header) |
| panel footer (optional) | action buttons region; used when the popover carries confirmable actions |
| arrow/caret | the decorative pointer element rendered when `withArrow=true`; positioned by CSS from `placement` |

---

## 4. The a11y contract (the load-bearing section)

### WAI-ARIA pattern

**APG Disclosure (Show/Hide)** (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) for the
trigger/panel pair, extended with the **native `popover` attribute** browser semantics (top-layer
presence, Escape close signal, light-dismiss). The popover panel itself carries **no fixed ARIA
role** — the role is added by the composing component to match its semantic purpose:
- `role="menu"` for `dropdown-menu` / `context-menu`
- `role="listbox"` for `select`
- `role="dialog"` (non-modal) for rich panels with their own interactive content
- `role="tooltip"` for `tooltip` (though that component uses `popover="hint"` + CSS hover)
- no role (plain `<div>`) for `hover-card` (purely informational, descriptive)

This is the correct assembly: APG does not define a "Popover" pattern because "popover" is a
**presentation behaviour** (top-layer, light-dismiss), not a semantic role. The ARIA role must
reflect the PURPOSE, added by the composing component on top of the seam.

### Roles + ARIA (the trigger/panel pair)

The POPOVER SEAM itself emits:

| element | role / attribute | value | condition |
|---|---|---|---|
| trigger `<button>` | `role` | (native `button`, no override) | always |
| trigger `<button>` | `aria-expanded` | `"true"` / `"false"` | server-emitted from `open` |
| trigger `<button>` | `aria-controls` | `<panelId>` | always (APG Disclosure optional but applied; screen readers need the association) |
| trigger `<button>` | `aria-haspopup` | set by the COMPOSING component to reflect panel type | composing component adds this (e.g. `"menu"` for dropdown, `"listbox"` for select, `"dialog"` for rich panels; plain popover: omit or `"true"`) |
| panel | `popover` | `"auto"` / `"manual"` / `"hint"` | always — the native attribute |
| panel | `id` | `<panelId>` | always |
| panel | ARIA role | set by the composing component | composing component adds the semantic role |
| panel | `aria-labelledby` | set by the composing component when panel has a title | composing component |

> The native `popover` attribute causes the UA to expose `aria-expanded` state automatically on
> the trigger button when `popovertarget` is used (per open-ui.org spec). lievit STILL emits
> `aria-expanded` explicitly from the server state (`open`) to be unambiguous and to serve screen
> readers that may not yet pick up the UA automatic mapping. The two signals are consistent.

### Keyboard interaction map

Source: APG Disclosure pattern (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) +
native `popover` attribute browser specification (Esc close signal, Tab behaviour).

| key | focus location | action | who supplies it |
|---|---|---|---|
| `Enter` | trigger `<button>` | toggle open/close: fires `toggleOpen()` wire action | platform (native `<button>`) |
| `Space` | trigger `<button>` | toggle open/close: fires `toggleOpen()` wire action | platform (native `<button>`) |
| `Escape` | anywhere (panel open) | close the panel (native `auto`/`hint` popover close signal); the enhancer fires `close()` wire action to sync server state | native browser (`auto` + `hint` types only); enhancer syncs server |
| `Tab` | anywhere | standard focus order; focus leaves the panel and moves to the next focusable element in document order; does NOT close the panel (non-modal — no trap) | platform |
| `Shift+Tab` | anywhere | reverse standard focus order; same non-trapping behaviour | platform |

> **What the composing component adds on top**: when the panel carries a `role="menu"` or
> `role="listbox"`, the `collection-nav.enhancer.ts` takes over the arrow-key / typeahead /
> Home / End / Enter-to-select behaviour WITHIN the panel. Those keys are NOT the popover seam's
> responsibility. The seam handles open/close; the collection-nav enhancer handles navigation
> inside the collection. This clean split is the single-source-a11y rule in practice.

### Focus management

- **Initial focus on open**: the popover does NOT move focus into the panel automatically unless
  `autofocus` is set on an element within the panel (native behaviour). The composing component
  decides: `dropdown-menu` moves focus to the first menu item (via `collection-nav`); a rich
  informational panel may leave focus on the trigger (non-modal disclosure pattern). The seam
  does not impose a choice; it provides the hook (`data-lv-autofocus` on a panel descendant,
  read by the enhancer, which calls `.focus()` after the morph).
- **No focus trap**: the panel is non-modal. Tab navigates naturally through and out of the panel.
  The `dialog` and `drawer` components compose the `focus-trap.enhancer.ts` for the trap — not
  the popover seam.
- **Focus return on close**:
  - On `Escape` close: the native browser returns focus to the trigger automatically (the native
    popover API spec guarantees this for the Escape close signal).
  - On light-dismiss (click outside with `type="auto"`): the browser does NOT guarantee focus
    return. The `popover-anchor.enhancer.ts` records the trigger as the "opener" on open, and
    on the `toggle` / `beforetoggle` event (the native popover event) calls `opener.focus()` when
    `newState === "closed"` and the active element is not the trigger. The wire `close()` action
    is also fired to sync server `open=false`.
  - On programmatic close (composing component fires `close()` wire action, e.g. a menu item
    click): the morph removes the panel; the enhancer's `toggle` listener fires the focus-return.
- **Scroll lock**: none (the popover is non-modal; only `dialog`/`drawer` lock body scroll).

### Screen-reader expectations

- With `aria-expanded="false"` on the trigger: the panel is absent from the DOM entirely (server
  conditional), so it is completely absent from the accessibility tree. No hidden subtree to
  traverse.
- With `aria-expanded="true"`: the panel is present in the top layer; its ARIA role (set by the
  composing component) and its content are announced when focus enters.
- `aria-controls` on the trigger lets users jump to the panel via `JAWS F6` / `NVDA CTRL+ALT+K`
  (landmark/ARIA controls navigation), useful when the panel is visually distant.
- The native `popover` attribute maps to an implicit `dialog` role in some UA implementations;
  composing components MUST override this with the correct role (`menu`, `listbox`, etc.) to avoid
  a false `dialog` announcement.

### Live region

None in the seam itself. Composing components that show dynamic results (search result counts in
`select`, command palette hit counts) add a `role="status"` live-region inside their owned panel
body — that is their concern, not the seam's.

### Shared mechanism: this IS the seam

The popover is not a CONSUMER of a shared mechanism — it IS the shared mechanism. All other overlay
components consume it. Nothing in lievit re-implements anchor positioning or light-dismiss.

---

## 5. Design tokens

### Tokens consumed

| token | what it styles |
|---|---|
| `--lv-color-popover` | panel background |
| `--lv-color-popover-fg` | panel foreground text |
| `--lv-color-muted` | `variant=muted` panel background |
| `--lv-color-muted-fg` | `variant=muted` panel foreground |
| `--lv-color-destructive` | `variant=destructive` panel background |
| `--lv-color-destructive-fg` | `variant=destructive` panel foreground |
| `--lv-color-border` | panel border |
| `--lv-shadow-md` | panel elevation shadow |
| `--lv-radius-md` | panel corner radius |
| `--lv-z-popover` | z-index for the top-layer panel (native `popover` is already top-layer; this ensures Tailwind utilities align with the intent) |
| `--lv-space-{1,2,3,4}` | internal panel padding, gap |
| `--lv-ring` | focus ring on the trigger button |
| `--lv-motion-duration-fast` | the panel's entry/exit animation duration (opacity + scale, CSS `@starting-style` / `transition` on the native `[popover]` element's `display:none` transition) |
| `--lv-motion-easing-out` | easing curve for the entry animation |

### Arrow / caret tokens

| token | what it styles |
|---|---|
| `--lv-color-border` | arrow border colour (matches panel border) |
| `--lv-color-popover` | arrow fill colour (matches panel background) |

### NET-NEW tokens proposed

| token | value (OKLCH) | rationale |
|---|---|---|
| `--lv-popover-offset` | `4px` | the trigger-to-panel gap; consumed as a `margin` override via `position-area`; additive, not a colour |
| `--lv-motion-duration-fast` | `120ms` | if not already in the token set; short transition for micro-overlays (tooltip, popover) distinct from the longer `--lv-motion-duration-base` (200ms) used by dialogs/drawers; additive |

> All colour tokens are authored in OKLCH (architecture contract §4, D1 DECIDED). No hex or
> rgb literal appears in a component body.

---

## 6. Wire / island integration

### Server-rendered JTE structure

The template emits two root-level elements (adjacent siblings, not wrapped — the trigger stays in
the normal document flow; the panel goes to the top layer):

```
<button
  id="${triggerId}"
  type="button"
  data-slot="popover-trigger"
  data-lievit-component="${_component.fqn()}"
  data-lievit-id="${_component.id()}"
  data-lievit-snapshot="${_component.snapshot()}"
  aria-expanded="${open ? "true" : "false"}"
  aria-controls="${panelId}"
  popovertarget="${panelId}"
  popovertargetaction="toggle"
  l:click="toggleOpen"
  style="anchor-name: --${triggerId}"
  [... composing component adds aria-haspopup, aria-label, variant/size classes ...]
>
  [trigger content — owned markup in the composing component's copy]
</button>

!{if open}
<div
  id="${panelId}"
  popover="${type}"
  data-slot="popover-panel"
  data-variant="${variant}"
  data-placement="${placement}"
  data-with-arrow="${withArrow}"
  data-lv-opener="${triggerId}"
  style="position-anchor: --${triggerId}; position-area: ${placementToCssPositionArea(placement)}; margin: var(--lv-popover-offset) 0;"
  [... composing component adds role, aria-labelledby, aria-describedby ...]
>
  !{if withArrow}
  <div data-slot="popover-arrow" data-placement="${placement}"></div>
  !{endif}
  [panel body — owned markup in the composing component's copy]
</div>
!{endif}
```

Key conventions:
- `anchor-name` is set inline as `--<triggerId>` (a valid `<dashed-ident>` because `triggerId` is
  a generated UUID-like string starting with `lv-`). Inline styles are SAFE here because the
  value is server-generated, not user-supplied.
- `position-area` replaces the old `inset-*` placement math; no JS positioning loop.
- The panel is conditionally rendered server-side (`!{if open}`) — absent from the DOM entirely
  when closed. This means the `popover` attribute's built-in `display:none` hiding is REDUNDANT
  but harmless; the server conditional is the authoritative gate.
- `data-lv-opener` on the panel is the enhancer's hook for focus-return on non-Esc close.
- `data-slot` + `data-variant` + `data-placement` + `data-with-arrow` are the test and styling
  hooks (architecture contract §3.3).

### The `popover-anchor.enhancer.ts` responsibilities

The enhancer is registered via the lievit lifecycle registry (`onComponentInit`). It:

1. **Records the opener**: on the `toggle` event (`beforetoggle`, `newState === "open"`) on the
   panel element, stashes `document.getElementById(panel.dataset.lvOpener)` as `this._opener`.
2. **Focus return on non-Esc close**: on the `toggle` event (`newState === "closed"`), if
   `document.activeElement !== this._opener` (the browser did NOT move focus back), calls
   `this._opener?.focus()`.
3. **Fires `close()` wire action on light-dismiss**: when a `popover="auto"` panel closes via
   click-outside (not via the trigger's own `l:click="toggleOpen"` — those already fire the wire
   action), the browser fires `toggle` but no lievit directive fires. The enhancer detects this
   (`newState === "closed"` and `open` server-state is still `true` from the snapshot) and fires
   the `close` wire action to sync the server.
4. **CSS Anchor Positioning polyfill wiring** (progressive enhancement): if
   `CSS.supports("position-area", "bottom")` is `false`, loads the CSS Anchor Positioning
   polyfill (bundled in the lievit JS bundle, CSP-safe — no external fetch) and re-applies
   placement via the polyfill's API. This is the ONLY JS positioning code; when Anchor Positioning
   is universally supported, this branch becomes dead code and is removed.
5. **`autofocus` delegation**: after the morph of an open panel, the enhancer looks for
   `[data-lv-autofocus]` inside the panel and calls `.focus()` on it. This is the hook the
   composing component (e.g. `dropdown-menu`) uses to move focus to the first item without
   hand-rolling the focus logic in its own component.

The enhancer does NOT manage `open` state, does NOT render anything, does NOT intercept
Escape (the browser's native popover close signal handles that for `auto`/`hint`; the `toggle`
event fires and the enhancer syncs the wire state). It is the minimum irreducible client layer.

### Wire round-trip flow

1. User clicks the trigger → platform fires click → `l:click="toggleOpen"` → POST
   `/lievit/{id}/call` with action `toggleOpen`.
2. Server: `toggleOpen()` flips `open`; validates (no additional validation needed for a bare
   toggle; composing components validate in THEIR action, e.g. `openMenu()` checks authz).
3. Server re-renders the template: when `open=true`, the panel body markup is now present.
   Returns `text/html` + rotated `Lievit-Snapshot`.
4. Client morph patches the new HTML into the live DOM (panel appears in top layer; the native
   `popover` API shows it via `showPopover()` — called by the browser on DOM insertion when the
   `popover` attribute is present and `popovertarget` toggled the open state, or the morph
   triggers it via the `togglePopover()` directive that the enhancer calls after morph).
5. Enhancer fires: records opener, optionally moves focus to `[data-lv-autofocus]`.
6. On close (Escape / click-outside / composing action): panel absent from next morph or browser
   hides it; enhancer fires `close()` wire action if needed; focus returns to opener.

---

## 7. Acceptance tests

Every test runs on a REAL substrate (not a mocked `$lievit`) — the client-island-fidelity lesson.

### Render

- **`popover_renders_trigger_and_closed_panel`** (real LievitRuntime + jsdom): the trigger
  `<button>` is present with `aria-expanded="false"`, `aria-controls` pointing to the panel id;
  the panel element is ABSENT from the DOM (server conditional, `open=false`).
- **`popover_renders_open_panel`** (real LievitRuntime + jsdom): after `toggleOpen()` wire call,
  the panel is present in the DOM with `popover="auto"` and `data-slot="popover-panel"`;
  `aria-expanded` on the trigger is `"true"`; the panel body content (owned markup) is VISIBLE
  (the projection assertion — not just "has a div").
- **`popover_panel_absent_when_closed`** (real LievitRuntime + jsdom): after `close()` wire call,
  the panel element is gone from the DOM entirely (not just `display:none`); `aria-expanded` is
  `"false"`.
- **`popover_arrow_rendered_when_with_arrow_true`** (jsdom): `withArrow=true` emits
  `[data-slot="popover-arrow"]` with the correct `data-placement` matching the `placement` param.
- **`popover_no_arrow_when_with_arrow_false`** (jsdom): no `[data-slot="popover-arrow"]` in DOM.
- **`popover_variants_emit_correct_data_attributes`** (jsdom): each of `default`, `muted`,
  `destructive` emits `data-variant="<value>"` on the panel and the correct token-class utility.
- **`popover_placement_emits_correct_css_position_area`** (jsdom): each of the twelve placement
  values maps to the correct `position-area` CSS value in the inline style; assert at least
  `bottom-start`, `top-end`, `right`, `left-start`.

### axe-core

- **`popover_trigger_axe_zero_violations_closed`**: axe-core on the trigger-only DOM (closed
  state) — zero violations; a trigger without visible label text FAILS the accessible-name rule
  (composing component must provide label; the test asserts the composing component's `aria-label`
  or visible text is present — this test uses a minimal owned template with a visible trigger label).
- **`popover_trigger_axe_zero_violations_open`**: axe-core on the full DOM (trigger + open panel)
  — zero violations; panel with `role="menu"` (test fixture) passes menu semantics rules.
- **`popover_trigger_axe_aria_expanded_state`**: axe-core checks `aria-expanded` is a valid
  boolean string; `aria-controls` references an existing element when open, absent when closed.

### Keyboard

- **`popover_enter_opens_and_closes`** (real LievitRuntime + jsdom): dispatch `KeyboardEvent(
  "keydown", { key: "Enter" })` on the trigger → assert the wire action `toggleOpen` was fired;
  morph delivers open panel; dispatch Enter again → panel absent, `aria-expanded="false"`.
- **`popover_space_opens`** (real LievitRuntime + jsdom): `Space` on the trigger → same as Enter.
- **`popover_escape_closes_and_syncs`** (real LievitRuntime + jsdom): open the panel; dispatch
  `KeyboardEvent("keydown", { key: "Escape" })` on the document → assert the native `toggle`
  event fired; assert the `close()` wire action was fired by the enhancer; assert the panel is
  absent after morph.
- **`popover_tab_does_not_trap`** (real LievitRuntime + jsdom): with panel open and focus inside
  the panel, dispatch `Tab` → assert focus moves OUT of the panel (no trap); assert the panel
  remains open (Tab does NOT close a non-modal popover).

### Focus

- **`popover_focus_returns_to_opener_on_escape`** (real LievitRuntime + jsdom): trigger click
  opens panel; Escape closes → assert `document.activeElement === triggerButton`.
- **`popover_focus_returns_to_opener_on_lightdismiss`** (real LievitRuntime + jsdom): open panel;
  simulate click outside (mousedown on `document.body`) → the enhancer fires focus-return;
  assert `document.activeElement === triggerButton`.
- **`popover_autofocus_delegate_moves_focus`** (real LievitRuntime + jsdom): a panel with
  `[data-lv-autofocus]` on a child input; open → assert `document.activeElement` is the input,
  not the trigger.
- **`popover_no_autofocus_focus_stays_on_trigger`** (real LievitRuntime + jsdom): panel without
  `[data-lv-autofocus]`; open → assert `document.activeElement === triggerButton` (default
  non-modal disclosure behaviour).

### Wire round-trip IT

- **`popover_roundtrip_open_close`** (lievit-kit, real runtime, CollapsibleComponentIT pattern):
  mount a `PopoverComponent` with a minimal owned panel body; call `toggleOpen()` → assert the
  returned HTML contains the panel with the owned markup; call `close()` → assert the HTML does
  NOT contain the panel element.
- **`popover_close_is_noop_when_already_closed`** (lievit-kit, real runtime): `close()` on an
  already-closed popover; assert `open` remains `false`; no error thrown.
- **`popover_manual_type_does_not_change_on_outside_click`** (lievit-kit): `type="manual"`
  popover stays `open=true` after a simulated outside-click; the enhancer does NOT fire `close()`
  for `manual` type (assert by checking wire action was not called).

### JTE compile + render

- **`popover_jte_compiles`**: covered by the `test/jte-compile` real-compiler gate on every
  commit (the pre-commit hook runs `tracegate code-docs` which includes template compilation).
- **`popover_jte_renders_all_placements`**: the JTE render gate exercises all twelve placement
  values in a parameterised render test (no Spring context needed; pure JTE renderer).

### Escaping

- **`popover_panel_id_is_not_injectable`** (jsdom): a `panelId` containing `"<script>alert(1)
  </script>"` renders the attribute value HTML-escaped; no `<script>` tag is emitted. The
  `panelId` is a server-generated value but the test asserts the escaping channel is correct
  (the `id` attribute value goes through the JTE auto-escape, NOT the trusted `attrs` channel).
- **`popover_anchor_name_is_server_generated`** (code review assertion, not a runtime test): the
  inline `anchor-name` style is set from `triggerId`, which is server-generated (UUID-like,
  no user input); the test asserts that no template path allows a user-supplied `triggerId`.

### Playwright (gesture fidelity)

- **`popover_real_keyboard_toggle`** (Playwright, legacy-VM oracle): `page.keyboard.press("Tab")`
  to the trigger; `Enter` opens; panel body shows resolved server content; `Escape` closes; assert
  focus is on the trigger.
- **`popover_lightdismiss_on_click_outside`** (Playwright): open the popover; `page.click("body")`
  outside → panel is gone; trigger has focus.
- **`popover_tab_leaves_panel_open`** (Playwright): with panel open, press `Tab` repeatedly →
  focus leaves the panel; assert panel is still visible (no accidental close on Tab).

---

## 8. Non-goals / anti-patterns

- **Not a standalone informational bubble.** Do not use the bare popover component to show
  tooltip-style content on hover. The `tooltip` component (which composes this seam with
  `popover="hint"` + CSS `:hover`/`focus` triggering, no wire round-trip) is the correct choice
  for that pattern.
- **Not a modal.** The popover NEVER traps focus. A panel that must trap focus and block
  background interaction is a `dialog` or `drawer` (which compose `focus-trap.enhancer.ts`). Using
  popover for modal-like content breaks the non-trapping contract and fails WCAG 2.1 SC 2.1.2.
- **Not a hand-rolled position calculator.** No component in lievit may compute pixel offsets in
  JS and set `top`/`left` on a floating panel. The CSS Anchor Positioning + `position-area` is the
  one mechanism. A component that bypasses this is incorrect.
- **Not a client-side open-state manager.** The `open` boolean is a server fact; the enhancer
  does NOT toggle it client-only. A composing component that manages open-state in client JS
  (without a wire round-trip) loses the server-rendered panel body guarantee and reintroduces the
  silent-slot failure mode.
- **Not re-implemented per consuming component.** Every consuming component (dropdown-menu, select,
  combobox, tooltip, hover-card, date-picker, command…) EXTENDS the popover by owning a copy of
  its template and filling the panel body. None of them re-code anchor positioning, light-dismiss,
  or focus-return. A consuming component that duplicates any of these is an architecture violation.
- **Not a `<dialog>` element.** The popover panel is a `<div popover>` (or the appropriate
  semantic container: `<menu popover>`, `<ul popover>`, etc.), never a `<dialog>`. The `dialog`
  COMPONENT uses a `<dialog>` element (native modal semantics, focus trap, `inert` backdrop). The
  two must not be confused.
- **`popovertarget` on non-button elements.** The native `popovertarget` attribute is only valid
  on `<button>` and `<input type="button">`. Do not set it on `<a>`, `<div>`, or `<span>`.
- **Anchor Positioning with `position: fixed` fallback via JS.** The CSS Anchor Positioning
  polyfill in the enhancer is the fallback; it is not a hand-rolled JS position calculator. If the
  polyfill is removed in the future (full browser support), the enhancer branch becomes a no-op.
  Do not add a separate `fixed`-position JS fallback alongside the CSS one.
- **`role="tooltip"` on a rich interactive panel.** A panel with buttons, links, or form controls
  must NOT carry `role="tooltip"` (tooltip is for non-interactive content only, per APG). A rich
  panel is `role="dialog"` (non-modal) or a specific widget role (`menu`, `listbox`). The composing
  component is responsible for the correct role.

---

## 9. Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH) tokens. You may read the WAI-ARIA APG Disclosure
pattern (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/), the MDN native `popover` attribute
docs, and the Radix UI Popper / Floating UI placement vocabulary as PATTERN references for the
placement API vocabulary and light-dismiss semantics. You MUST NOT paste literal source from any
of them — the output is always original generation (the one bright line, `02-licensing.md`).

This component IS the shared seam: compose nothing above it for positioning/light-dismiss. Build
it correctly once so dialog, drawer, dropdown-menu, select, combobox, tooltip, hover-card,
date-picker, time-picker, command, mentions, cascader, and tree-select can all compose it.

Mirror `button.jte`'s house conventions exactly: header doc-comment with credits, typed `@param`,
`data-slot`, the two escaping channels, zero `<script>`, zero inline `on*=`. The trigger is a real
native `<button>` (platform keyboard + focus for free). The panel body is OWNED template markup
(no `Content` slot — WIRE has none; server-first refactor blueprint §1.b).

The focus-return and close-sync logic lives in `popover-anchor.enhancer.ts`; it does not belong
in the Java component, the template, or the lievit runtime core (ADR-0019: registry IS the API —
enhance via the directive/lifecycle registries, never by editing the core).

Minimal code to GREEN against the acceptance tests. The keyboard map is the contract — assert ALL
of it. The light-dismiss wire sync test (7, round-trip IT) is non-optional: it is the test that
proves the server state stays consistent when the browser closes the panel without a wire action.
