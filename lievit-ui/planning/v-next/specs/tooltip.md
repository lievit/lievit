<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — tooltip

- **tier**: PARTIAL + ENH (`tooltip.enhancer.ts`, minimal — owns show/hide timing + Esc + `aria-describedby` wiring)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/tooltip.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Tooltip (`https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/`) + `tooltip` ARIA role spec
      (`https://w3c.github.io/aria/#tooltip`); **BUILT against raw APG** (react-aria `useTooltip` is a
      valid pattern reference for the hover-delay + focus-trigger model; no react-aria source copied)
    - inventory: Ant Design Tooltip as inventory reference (placement matrix, delay, arrow, max-width, controlled)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI (NO code copied)

## 1. What it is

A tooltip is a non-interactive popup that surfaces a short text description when its trigger element receives
keyboard focus or is hovered by a pointing device.
It is supplemental — never the sole carrier of essential information (color contrast, form instructions, required
markers must never live only in a tooltip).
PARTIAL tier because the tooltip's CONTENT is static server-rendered text and its OPEN STATE is a purely
client-side, ephemeral concern (no server fact is involved: the user's mouse position or keyboard focus is not
worth a round-trip).
The one irreducible client piece is: the show/hide timing (hover delay + instant focus, dismiss on blur/mouseleave/Esc),
the `aria-describedby` binding between the trigger and the floating panel, and the native `popover` attribute
management — this belongs in a minimal typed-TS enhancer, `tooltip.enhancer.ts`.
The enhancer is NOT a framework: it fires no wire actions, it only manages a CSS class + the `popover` attribute on
a peer element.
Server-first works cleanly: the server renders the trigger + the tooltip bubble (both present in the DOM, bubble
initially hidden via the `popover` attribute), the enhancer surfaces them on demand.
For content that includes focusable elements (links, buttons), use a `popover` component or a non-modal `dialog`
instead — the APG explicitly calls this out.

## 2. API — params

The tooltip is a two-element surface: the **trigger wrapper** (the element whose title/description is the
tooltip) and the **bubble** (the floating panel with `role="tooltip"`).
Because the enhancer wires `aria-describedby` at runtime using the `data-lievit-tooltip-id` hook, both elements
must be co-located in the same partial render call.
The partial wraps the trigger via a `trigger` slot and emits the bubble alongside it.

| param | type | default | meaning |
|---|---|---|---|
| `id` | `String` | — | **REQUIRED** — unique id stamped on the bubble (`id="<id>"`) and mirrored into `data-lievit-tooltip-id` on the wrapper; the enhancer reads these to wire `aria-describedby` |
| `content` | `String` | — | **REQUIRED** — the tooltip text (plain text only; no HTML — the bubble renders it as text content, never `$unsafe`); this is `aria-describedby` text |
| `placement` | `String` | `"top"` | `top \| top-start \| top-end \| bottom \| bottom-start \| bottom-end \| left \| right` — CSS Anchor Positioning preferred placement (the popover seam); falls back gracefully when out of viewport |
| `delay` | `int` | `600` | hover show-delay in ms (the enhancer timer); 0 = immediate (useful for icon-only buttons where the label IS the tooltip); focus always shows immediately regardless of delay |
| `hideDelay` | `int` | `0` | hover hide-delay in ms after mouseleave; allows the pointer to traverse into the tooltip bubble itself (the APG hover-persistence rule) |
| `arrow` | `boolean` | `true` | renders a directional arrow pointing at the trigger; CSS-only, no JS |
| `maxWidth` | `String` | `"14rem"` | inline CSS custom-property override `--_lv-tooltip-max-width` (via the local `--lv-*` seam; safe: the adopter sets a structural dimension, never a colour) |
| `disabled` | `boolean` | `false` | when true, the enhancer does nothing (no show on hover/focus); the bubble stays hidden; the trigger is unaffected |
| `cssClass` | `String` | `""` | extra utility classes on the bubble |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only; e.g. `data-testid="save-tooltip"` |
| `trigger` | `gg.jte.Content` | — | **REQUIRED** — the trigger element (button, icon, link, text span); the partial renders this inside the wrapper `<span data-lievit-tooltip-wrapper data-lievit-tooltip-id="<id>">` |

### Escaping channels

`content` is rendered as HTML text content (`${content}` in JTE, HTML-escaped by default) — never `$unsafe`.
`attrs` is `$unsafe` and accepts ONLY static author-typed strings (documented constraint; never fed per-row
DB-derived data).
There is no `dataAttrs` / `wireArgs` channel because the tooltip fires no wire actions; all dynamic
configuration arrives via typed `@param`.

## 3. Variants / sizes / states

### Variants (intent — the shared vocabulary)

The tooltip has one intent vocabulary axis: **visual tone**.

| variant | use | token pair |
|---|---|---|
| `default` | neutral description (the common case) | `--lv-color-popover` bg + `--lv-color-popover-fg` text |
| `info` | informational emphasis | `--lv-color-info` bg + `--lv-color-info-fg` text |
| `warning` | cautionary inline hint | `--lv-color-warning` bg + `--lv-color-warning-fg` text |
| `destructive` | destructive action confirmation hint | `--lv-color-destructive` bg + `--lv-color-destructive-fg` text |

The `default` variant maps to the same `--lv-color-popover` token family used by the `popover` and
`dropdown-menu` components, so all floating surfaces share a look at rest.

### Sizes

Tooltips do not carry a `size` param (they are not toolbar-aligned form controls).
Their typographic scale is fixed at `--lv-text-xs` (the most compact content tier) with `--lv-space-2` vertical
padding and `--lv-space-3` horizontal padding.
`maxWidth` governs line-wrap; the arrow and bubble grow to fit the text.

### States

| state | how expressed |
|---|---|
| hidden (default) | `popover` attribute present, no `popover-open` pseudo-class match → `display: none` via UA sheet |
| visible | enhancer calls `showPopover()` on the bubble → `:popover-open` → fully visible; CSS `@starting-style` animates opacity in |
| disabled | `data-lievit-tooltip-disabled` on wrapper → enhancer no-ops all events |
| trigger focus-visible | the trigger's own `:focus-visible` ring is unaffected by the tooltip; the ring is the trigger's concern, not the bubble's |

The bubble is never `aria-hidden` when hidden — the native `popover` attribute + UA hide is sufficient and
correctly removes the element from the accessibility tree when not showing (the UA sets `visibility: hidden`
on `[popover]` not in the `:popover-open` state, which removes it from the a11y tree per the HTML spec).

### Slots

| slot | JTE param type | purpose |
|---|---|---|
| `trigger` | `gg.jte.Content` | the element that owns the tooltip; rendered inside the wrapper span |

There is no `footer` or `leading`/`trailing` slot: tooltip content is a single plain-text string.
If rich content is needed, use `popover` instead.

## 4. The a11y contract

- **WAI-ARIA pattern**: APG Tooltip (`https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/`).
  The tooltip role is defined at `https://w3c.github.io/aria/#tooltip`.

- **roles + ARIA**:
  | element | role / attribute | value | who sets it |
  |---|---|---|---|
  | bubble `<div>` | `role="tooltip"` | — | JTE template (static, server-rendered) |
  | bubble `<div>` | `id` | `<param id>` | JTE template |
  | wrapper `<span>` | `data-lievit-tooltip-wrapper` | — | JTE template (the enhancer discovery hook) |
  | wrapper `<span>` | `data-lievit-tooltip-id` | `<param id>` | JTE template |
  | trigger element (inside the slot) | `aria-describedby` | `<param id>` | enhancer sets at mount, removes at cleanup |

  The enhancer sets `aria-describedby` on the FIRST focusable descendant of the wrapper (the real trigger
  element) at mount time, pointing at the bubble's `id`.
  If no focusable descendant exists (a `<span>` wrapping static text), the attribute is set on the wrapper span
  itself so the relationship is still expressed.
  The `aria-describedby` is NOT rendered server-side because the tooltip bubble's presence in the DOM is a
  rendering detail; the relationship is a runtime concern the enhancer owns.

- **keyboard map**:
  | key | does | who |
  |---|---|---|
  | `Tab` (into trigger) | moves keyboard focus to the trigger element; tooltip shows IMMEDIATELY (no delay) | platform (Tab) + enhancer (`focusin` listener) |
  | `Tab` / `Shift+Tab` (out of trigger) | removes keyboard focus from trigger; tooltip hides immediately (no hide-delay) | platform (Tab) + enhancer (`focusout` / `blur` listener) |
  | `Escape` | dismisses the tooltip while it is visible; focus STAYS on the trigger (the APG rule: tooltip is non-modal) | enhancer (`keydown` listener on document while visible) |
  | any other key | not handled by the tooltip; the trigger's own key handlers fire normally | platform |

  The tooltip does NOT receive keyboard focus itself (APG rule).
  There is no roving-tabindex, no collection navigation, no focus trap.
  The `Escape` key handler is registered on `document` (capture phase) while the tooltip is open and removed
  when it hides, so it does not interfere with other open overlays' Esc handling.

- **focus management**:
  Focus NEVER enters the tooltip bubble.
  Initial focus: the trigger's normal focus order (set by the trigger element's own `tabindex` or native
  focusability).
  On show: focus stays on the trigger.
  On hide: focus stays on the trigger (or moves away via Tab, which is what caused the hide).
  No focus trap, no focus restore needed (the tooltip is non-modal and never steals focus).
  The enhancer records nothing about focus ownership.

- **live region**: none.
  A tooltip's content is surfaced to screen readers via `aria-describedby`, NOT a live region.
  The AT reads the description when the trigger receives focus; there is nothing to announce dynamically.

- **hover persistence** (the APG rule that matters for pointer users):
  When the pointer leaves the trigger but enters the bubble itself, the tooltip must stay visible.
  The enhancer uses a consolidated `mouseleave` + `mouseenter` pair on both the wrapper and the bubble,
  plus the `hideDelay` timer, to achieve this: moving from trigger to bubble cancels the hide timer.

- **shared mechanisms composed**:
  The tooltip uses the **popover seam** (native `popover` attribute + CSS Anchor Positioning) for positioning
  + the UA-provided show/hide mechanism.
  It does NOT compose `focus-trap` (non-modal, no trap) and does NOT compose `collection-nav` (no list navigation).
  The popover seam is the one shared mechanism; the tooltip is one of its lightest consumers (no wire action,
  no open-state round-trip, no Java component).

## 5. Tokens

### Consumed tokens

| token | used for |
|---|---|
| `--lv-color-popover` | bubble background (default variant) |
| `--lv-color-popover-fg` | bubble text (default variant) |
| `--lv-color-info` | bubble background (info variant) |
| `--lv-color-info-fg` | bubble text (info variant) |
| `--lv-color-warning` | bubble background (warning variant) |
| `--lv-color-warning-fg` | bubble text (warning variant) |
| `--lv-color-destructive` | bubble background (destructive variant) |
| `--lv-color-destructive-fg` | bubble text (destructive variant) |
| `--lv-text-xs` | bubble font-size |
| `--lv-font-sans` | bubble font-family |
| `--lv-space-2` | bubble vertical padding |
| `--lv-space-3` | bubble horizontal padding |
| `--lv-radius-sm` | bubble border-radius |
| `--lv-shadow-md` | bubble drop-shadow (elevation above the page) |
| `--lv-z-tooltip` | bubble z-index (above popover, below modal) |
| `--lv-motion-duration-fast` | show/hide CSS transition duration (`@starting-style` opacity fade) |
| `--lv-motion-easing-standard` | show/hide CSS transition easing |

### NET-NEW tokens

| token | value (light / dark) | justification |
|---|---|---|
| `--lv-z-tooltip` | `950` light / `950` dark (theme-invariant) | a distinct z-layer above `--lv-z-popover` (900) and below `--lv-z-modal` (1000); tooltips must clear all non-modal overlays. Structural token: no colour, no dark re-point needed. |

The arrow is a CSS-only pseudo-element (`::before` or `::after` on the bubble) using `border-color: var(--lv-color-popover)`
(or the variant's background token) — no new token.
`--_lv-tooltip-max-width` is a local (component-scoped) CSS custom property driven by the `maxWidth` param via
`style="--_lv-tooltip-max-width: ${maxWidth}"` on the bubble; it is not a global token (it is per-instance config).
All colour tokens are authored in OKLCH (D1, `00` §4).

## 6. Wire / island integration

The tooltip is a **PARTIAL** with a minimal typed-TS enhancer.
It fires NO wire actions and causes NO server round-trip.
The server renders both elements (wrapper + bubble) once; the enhancer manages visibility client-side.

### Server-rendered JTE structure

```
<span
  data-lievit-tooltip-wrapper
  data-lievit-tooltip-id="${id}"
  data-lievit-tooltip-delay="${delay}"
  data-lievit-tooltip-hide-delay="${hideDelay}"
  data-lievit-tooltip-placement="${placement}"
  !{disabled ? "data-lievit-tooltip-disabled" : ""}
  class="relative inline-block"
>
  <%-- trigger slot: the element that receives focus and hover --%>
  ${trigger}

  <%-- tooltip bubble: always in the DOM, hidden via popover attribute --%>
  <div
    id="${id}"
    role="tooltip"
    popover="manual"
    anchor="${id}-anchor"
    data-slot="tooltip"
    data-variant="${variant}"
    style="--_lv-tooltip-max-width: ${maxWidth}; position-anchor: --${id}-anchor"
    class="lv-tooltip ${cssClass}"
    ${attrs}
  >
    ${content}
    !{arrow ? "<span class=\"lv-tooltip__arrow\" aria-hidden=\"true\"></span>" : ""}
  </div>
</span>
```

The wrapper `<span>` has `anchor-name: --${id}-anchor` in CSS (set by the `.lv-tooltip` wrapper rule keyed
to the sibling bubble's `position-anchor`).
The native `popover="manual"` attribute means the UA hides the bubble by default and the enhancer calls
`showPopover()` / `hidePopover()` explicitly — this is the right mode for a tooltip (not `popover="auto"`,
which would give unwanted light-dismiss-on-click behavior from the UA and conflict with the hover/focus model).

### Enhancer responsibilities (`tooltip.enhancer.ts`)

The enhancer is discovered by `data-lievit-tooltip-wrapper` (the lifecycle registry's `onInit` hook scans for this attribute).
Per wrapper, the enhancer:

1. **mounts**: reads `data-lievit-tooltip-id` → resolves the bubble; reads delay/hide-delay/placement/disabled
   config from `data-lievit-tooltip-*` attributes; sets `aria-describedby="<id>"` on the first focusable
   descendant (or the wrapper itself if none).
2. **shows** (on `pointerenter` + `focusin` on the wrapper): starts a `setTimeout(delay)` for hover; shows
   immediately for focus (`focusin` path ignores delay). On fire: calls `bubble.showPopover()`, applies CSS
   Anchor Positioning class for the requested placement.
3. **hides** (on `pointerleave` + `focusout` on wrapper, and `pointerleave` on bubble itself): cancels the
   show timer if pending; starts a `setTimeout(hideDelay)` before calling `bubble.hidePopover()`. Moving the
   pointer from trigger to bubble fires `pointerleave` on the wrapper but `pointerenter` on the bubble —
   the enhancer hooks `pointerenter` on the bubble to cancel the hide timer (hover persistence).
4. **Esc**: while the tooltip is open, a document-level `keydown` listener (capture, registered on show /
   removed on hide) calls `bubble.hidePopover()` on `Escape`. Focus stays on the trigger.
5. **cleans up**: on the lifecycle `onDestroy` hook, removes `aria-describedby`, cancels timers, removes the
   document listener, calls `hidePopover()` if visible.

The enhancer registers zero wire directives (`l:*`) and fires zero wire actions.
It is a pure DOM / browser-API enhancer: `showPopover`, `hidePopover`, `setTimeout`, event listeners.
CSP-clean: no `eval`, no inline handlers, no dynamic `<script>`.

## 7. Acceptance tests

Every test must run on a REAL substrate — not a mocked enhancer, not a fake `$lievit` runtime.
The client-island-fidelity lesson (gest CLAUDE.md) applies: a jsdom test that mocks the tooltip enhancer
certifies wiring math, not reachability.

### Render

- **`tooltip_renders_bubble_with_tooltip_role`**: render the partial with a trigger slot (`<button>`) and
  content string; assert `[role="tooltip"]` is present in the DOM with the correct text; assert
  `[data-slot="tooltip"]` is present; assert `[data-variant]` matches the param.
- **`tooltip_renders_wrapper_with_discovery_hook`**: assert `[data-lievit-tooltip-wrapper]` is on the outer
  span; assert `data-lievit-tooltip-id` matches `id` param; assert `data-lievit-tooltip-delay` matches `delay`.
- **`tooltip_content_is_html_escaped`**: render with `content` = `<script>alert(1)</script>`; assert the
  bubble's `textContent` contains the literal angle-bracket text, NOT an injected element.
- **`tooltip_variants_emit_data_variant`**: for each of `default`, `info`, `warning`, `destructive`, assert
  the bubble has `data-variant="<name>"`.
- **`tooltip_arrow_absent_when_false`**: render with `arrow=false`; assert no `.lv-tooltip__arrow` in the DOM.
- **`tooltip_disabled_attr_present_when_disabled`**: render with `disabled=true`; assert
  `data-lievit-tooltip-disabled` on the wrapper.

### axe-core

- **`tooltip_axe_zero_violations_hidden`**: run axe-core on the rendered DOM (bubble hidden); assert zero
  violations; specifically assert no `aria-describedby` violation (the attribute is not yet set server-side;
  the enhancer adds it at runtime — the test runs the REAL enhancer and then asserts).
- **`tooltip_axe_zero_violations_visible`**: show the tooltip via the enhancer; run axe-core; assert zero
  violations including the `tooltip` role rules.

### Keyboard (REAL enhancer, jsdom with popover polyfill if needed)

- **`tooltip_shows_immediately_on_focusin`**: mount the enhancer; dispatch `focusin` on the wrapper; assert
  `bubble.showPopover()` was called (or assert `:popover-open` equivalent in jsdom); assert no timer delay
  was applied.
- **`tooltip_hides_on_focusout`**: show tooltip via focusin; dispatch `focusout`; assert tooltip is hidden;
  assert focus was not moved (the trigger element `document.activeElement` is unchanged).
- **`tooltip_esc_dismisses_while_visible`**: show tooltip via focusin; dispatch `keydown` Escape on document;
  assert tooltip is hidden; assert trigger is still `document.activeElement` (focus did not move).
- **`tooltip_esc_is_noop_while_hidden`**: without showing the tooltip, dispatch `keydown` Escape; assert no
  error and tooltip stays hidden (the document listener is not registered when hidden).

### Hover / timing

- **`tooltip_shows_after_delay_on_pointerenter`**: dispatch `pointerenter`; fast-forward timer by `delay` ms;
  assert visible.
- **`tooltip_show_cancelled_before_delay`**: dispatch `pointerenter`; fast-forward by `delay - 1` ms; dispatch
  `pointerleave`; fast-forward fully; assert still hidden (show timer was cancelled).
- **`tooltip_hover_persistence_crossing_into_bubble`**: dispatch `pointerenter` on wrapper; fast-forward to
  show; dispatch `pointerleave` on wrapper; dispatch `pointerenter` on bubble; fast-forward by `hideDelay + 1`
  ms; assert still visible (hide timer cancelled by bubble entry).
- **`tooltip_hides_after_hide_delay_on_pointerleave`**: with `hideDelay=200`, dispatch `pointerleave` after
  showing; fast-forward 201 ms; assert hidden.
- **`tooltip_disabled_does_not_show`**: render with `disabled=true`; dispatch `pointerenter`; fast-forward;
  assert tooltip never shows.

### aria-describedby wiring

- **`tooltip_enhancer_sets_aria_describedby_on_first_focusable`**: mount enhancer; assert the `<button>` inside
  the trigger slot has `aria-describedby="<id>"`.
- **`tooltip_enhancer_sets_aria_describedby_on_wrapper_when_no_focusable`**: render with a `<span>` (non-focusable)
  as trigger; mount enhancer; assert the wrapper `<span>` carries `aria-describedby`.
- **`tooltip_enhancer_removes_aria_describedby_on_destroy`**: mount; destroy; assert `aria-describedby` is gone.

### JTE compile + render gate

- **`tooltip_jte_compiles`**: covered by the `test/jte-compile` real-compiler gate that runs on every
  component template. No additional assertion needed here; the gate fails the build if the template has a
  syntax error.

## 8. Non-goals / anti-patterns

- **No focusable content inside the bubble.** If the tooltip content needs a link or button, use a `popover`
  or non-modal `dialog`. The APG explicitly states this; the partial enforces it by accepting only a plain
  `String` `content` param (no `gg.jte.Content` bubble slot).
- **No WIRE component.** The tooltip open-state is not a server fact. Converting it to a wire component would
  add a round-trip for every hover/focus event — the wrong trade. The open-state is fully ephemeral and
  belongs in the enhancer.
- **No server-side `aria-describedby`.** The relationship is wired at runtime by the enhancer because whether
  the bubble is present in the DOM is a rendering detail; wiring it server-side would require the triggering
  element to know the bubble's id before rendering, coupling unrelated template call sites. The enhancer wires
  it on `onInit`, which is the right seam.
- **No tooltip on non-interactive elements as the sole label.** A tooltip on a `<div>` or static text cannot
  be keyboard-triggered, so keyboard-only users never see it. If the tooltip IS the label (e.g. an icon
  button with no visible text), use `aria-label` on the button; the tooltip then supplements rather than
  replaces the label.
- **No show-on-click.** Tooltips are supplemental descriptions, not menus or dialogs. Click behaviour on the
  trigger is the trigger's own concern, not the tooltip's.
- **No `popover="auto"` on the bubble.** The `auto` mode gives light-dismiss-on-click from the UA, which
  conflicts with the hover/focus-driven show model and would dismiss the tooltip when the user clicks anywhere
  on the page. `manual` is the correct mode.
- **No `role="tooltip"` on an empty or missing bubble.** If `content` is blank, the partial must not render
  the bubble element at all (a JTE conditional on `!content.isEmpty()`), so the role is not present on a
  meaningless element.
- **No hand-rolled CSS positioning.** The popover seam (CSS Anchor Positioning) is the one shared mechanism
  for all floating surfaces. The tooltip does not maintain its own absolute-position logic or
  `getBoundingClientRect()` math.
- **No replication across components.** The show/hide timing logic (`delay`, `hideDelay`, hover-persistence)
  lives ONCE in `tooltip.enhancer.ts`; the `hover-card` component reuses it (both share the same hover-driven
  show model). Do NOT re-implement the timing in `hover-card.enhancer.ts`.

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens (OKLCH source-of-truth for all colour tokens, D1).
You may read the WAI-ARIA APG Tooltip pattern, react-aria `useTooltip` SPEC (not source), and Ant Design
Tooltip feature set as references for PATTERN (a11y, inventory) and LOOK.
You MUST NOT paste literal source from any of them (the one bright line, `02-licensing.md`) — output is
always original generation.

Compose the **popover seam** (native `popover="manual"` + CSS Anchor Positioning) for positioning — do NOT
hand-roll `getBoundingClientRect()` / `position: absolute` math.
The popover seam is the one shared mechanism; do not re-implement it.

Mirror `button.jte`'s house conventions exactly: header doc-comment (with TIER / STRUCTURE / A11y / Params /
Usage sections), typed `@param`, `data-slot`, the two escaping channels (content via JTE default HTML-escape,
attrs trusted-raw only), zero `<script>`, zero inline `on*=`.

The enhancer must register via the lifecycle `onInit` / `onDestroy` hooks, not via a module-level scan.
It must set `aria-describedby` in `onInit` and remove it in `onDestroy`.
The Esc handler must be registered on `document` (capture) only while the tooltip is visible, and removed on hide.
Do NOT register a permanent global keydown listener.

Render the bubble's `popover` attribute as a JTE boolean conditional:
if `content` is blank or null, skip the entire bubble element (a `role="tooltip"` on an empty element is a
violation).

The `--lv-z-tooltip: 950` token is NET-NEW and must be added to both the `:root` and `.dark, [data-theme="dark"]`
blocks in `registry/tokens/lievit-tokens.css` (it is a structural token, so the same value appears in both
blocks — no dark-mode re-point needed, but both blocks must list it for consistency with the token file's
format).

Minimal code to GREEN against the acceptance tests.
The `aria-describedby` wiring test and the hover-persistence test are the load-bearing acceptance criteria —
assert ALL of them, not a blessed subset.
