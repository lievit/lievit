<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — scroll-area

- **tier**: PARTIAL + ENH (`scroll-area.enhancer.ts` — optional custom-scrollbar overlay;
  the partial is fully functional without it; the enhancer is a progressive enhancement)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/scroll-area.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG — no dedicated Scroll Area pattern; behavior anchored to the native scrollable
      region contract: `role="region"` + `aria-label` / `aria-labelledby` for a named scroll container,
      keyboard scroll via native platform (arrow keys inside a focusable scroll container), no custom
      interaction model; BUILT against raw APG "Developing a Keyboard Interface" guidance +
      WCAG 2.2 SC 1.4.12 (text spacing) + SC 2.1.1 (keyboard) + SC 2.5.5 (target size for the
      scrollbar thumb when present). React Aria does not ship a ScrollArea primitive; interaction
      reference is BUILT against the APG keyboard scrolling contract.
    - inventory: Ant Design is not the primary reference here (no ScrollArea in AD core); radix-ui
      ScrollArea and shadcn ScrollArea are taken as INVENTORY references for the overlay-scrollbar
      feature matrix (viewport wrapper, scrollbar rail + thumb, corner, horizontal/vertical/both axes,
      hide-delay); feature inventory transcribed as ORIGINAL spec, no code copied.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI /
      shadcn scrollbar styling (NO code copied)

## 1. What it is

A scroll-area is a bounded scrollable region: a container whose content may exceed its allocated
height and/or width, with overflow handled by scroll rather than by overflow:visible. The component
has two modes that compose cleanly:

**Mode A — native scrollbar (always present, zero JS)**: the viewport div carries
`overflow: auto` and the platform renders its native scrollbar. Fully functional as a static
PARTIAL with no enhancer. Suitable for any non-decorative scroll surface (sidebar content areas,
modal bodies, command palette result lists, data-table wrappers).

**Mode B — overlay scrollbar (progressive enhancement, requires the enhancer)**: the native
scrollbar is hidden (`scrollbar-width: none` / `::-webkit-scrollbar { display: none }`) and a
custom-styled, overlay (non-layout-shifting) scrollbar rail + thumb is mounted on top by the
`scroll-area.enhancer.ts`. The thumb position and size are derived from the scroll position and
scrollable dimensions; dragging the thumb scrolls the viewport. This mode matches Tailwind-UI
visual polish — the scrollbar appears only on hover/focus-within and fades out after a configurable
delay.

Server-first works for this component because the CONTENT is always server-rendered inside the
viewport; the scroll state is ephemeral view state (owned by the browser/enhancer, not a server
fact); and the custom-scrollbar overlay is a pure visual enhancement — no state belongs on the
server, no WIRE round-trip is needed. PARTIAL is the correct tier.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `height` | `String` | `null` | CSS value applied as `max-height` on the viewport (e.g. `"400px"`, `"60vh"`, `"calc(100vh - 4rem)"`). `null` → no max-height (fills its grid/flex row). |
| `width` | `String` | `null` | CSS value applied as `max-width` on the viewport. `null` → inherits (full width of the container). |
| `orientation` | `String` | `"vertical"` | `"vertical"` \| `"horizontal"` \| `"both"` — which axes are scrollable. Determines the overflow axes enabled + which scrollbar rails the enhancer mounts. |
| `overlay` | `boolean` | `false` | `true` → hide the native scrollbar + activate the overlay scrollbar enhancer. The partial renders the `data-lievit-scroll-area` hook so the enhancer can mount. |
| `hideDelay` | `int` | `1000` | milliseconds after the last scroll/pointer event before the overlay scrollbar fades out. Rendered as `data-hide-delay="<N>"` (enhancer reads it). Ignored when `overlay=false`. |
| `type` | `String` | `"hover"` | `"hover"` \| `"always"` \| `"scroll"` — visibility policy for the overlay scrollbar rail. `hover` = visible on pointer-hover or focus-within; `always` = always visible; `scroll` = visible only while scrolling (fades after `hideDelay`). Rendered as `data-type="<value>"`. Ignored when `overlay=false`. |
| `ariaLabel` | `String` | `null` | `aria-label` on the viewport region. Required when the scroll area is a meaningful landmark and no visible heading element provides the name (i.e. when `ariaLabelledBy` is not set). |
| `ariaLabelledBy` | `String` | `null` | `aria-labelledby` pointing to a heading element that names the scroll area. Takes precedence over `ariaLabel` when both are set. |
| `cssClass` | `String` | `""` | extra utility classes appended to the root wrapper element. |
| `viewportCssClass` | `String` | `""` | extra utility classes appended to the inner viewport div (e.g. `p-4` for padding inside the scroll container). |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed attributes on the root (e.g. `data-testid="results-scroll"`, `id="..."` for an aria referent). STATIC strings only; never fed per-row DB data. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes on the root (each value via `Escape.htmlAttribute`). |
| `content` | `gg.jte.Content` | — | the scrollable body content (required; renders inside the viewport). |

### Notes on the two escaping channels

`attrs` is `$unsafe` trusted-raw: the author writes static string literals there
(`data-testid="foo"`, `id="scroll-main"`). It MUST NOT contain dynamic per-record values.
`dataAttrs` is SAFE: values are HTML-attribute-escaped via `Escape.htmlAttribute` before output.
A DB-derived value (e.g. a record id that needs to live on the element) goes through `dataAttrs`,
never `attrs`. This is the same discipline as `button.jte`.

## 3. Variants / sizes / states

### Orientation variants
- `orientation="vertical"` (default): `overflow-y: auto; overflow-x: hidden`. Single vertical
  scrollbar when `overlay=true`.
- `orientation="horizontal"`: `overflow-x: auto; overflow-y: hidden`. Single horizontal scrollbar
  when `overlay=true`.
- `orientation="both"`: `overflow: auto`. Two scrollbar rails (vertical + horizontal) + a
  `data-slot="corner"` square in the bottom-right when `overlay=true`.

The orientation is expressed as `data-orientation="<value>"` on the root and as
`data-orientation` on each scrollbar rail (for styling hooks).

### Overlay type variants
Applies only when `overlay=true`. Expressed as `data-type="<value>"` on the root for the
enhancer + CSS `[data-type=hover]` / `[data-type=always]` / `[data-type=scroll]` selectors:
- `hover`: rail and thumb hidden by default; visible on `[data-scroll-area]:hover`,
  `:focus-within`, or when `[data-scrolling]` is set by the enhancer.
- `always`: rail and thumb always visible (uses the same token colors but opacity 1).
- `scroll`: hidden by default; the enhancer adds `[data-scrolling]` while scrolling + removes
  it after `hideDelay` ms, triggering a CSS opacity transition.

### Sizes
Scroll-area is a layout primitive, not a control with discrete sizes. Height and width are
passed as free CSS values via `height` / `width` params. No `sm|md|lg` scale applies (there
is no toolbar-alignment need). The content inside may use `size`-scaled components independently.

### States
- **default**: viewport scrollable, native scrollbar (or overlay if `overlay=true`), content renders.
- **no-overflow**: when content fits within the allocated height/width, the scrollbar is absent
  (native: hidden by the platform; overlay: enhancer detects `scrollHeight <= clientHeight` and
  sets `data-no-overflow` on the root, hiding the rail via CSS).
- **scrolling**: the enhancer sets `[data-scrolling]` on the root during active scrolling
  (transitioned CSS class for `type=scroll` and `type=hover` show-on-scroll).
- **pointer-over**: `[data-pointer-over]` set by the enhancer while the pointer is within the
  root, used by `type=hover` to keep the rail visible.
- **thumb-dragging**: `[data-dragging]` set on the scrollbar rail while the user drags the thumb,
  keeping the rail visible and applying an active-thumb color.

### Slots
- `content` (`gg.jte.Content`): the scrollable body. Renders directly inside the viewport div.
  No `leading` / `trailing` / `footer` slots (this is a layout wrapper, not a UI control).

## 4. The a11y contract

- **WAI-ARIA pattern**: no dedicated APG Scroll Area pattern. The contract is derived from:
    - APG "Developing a Keyboard Interface" (keyboard scrollability of a region):
      https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
    - WAI-ARIA 1.2 `role="region"` landmark semantics:
      https://www.w3.org/TR/wai-aria-1.2/#region
    - WCAG 2.2 SC 2.1.1 (Keyboard): all scrollable content reachable by keyboard.
    - WCAG 2.2 SC 1.4.13 (Content on Hover or Focus): the overlay scrollbar must not
      obscure content or require pointer precision when visible.
    - Custom-scrollbar thumb sizing: the thumb MUST be at least 44x44 CSS pixels (SC 2.5.5
      Target Size) when interactive (draggable), OR the native keyboard scrolling of the viewport
      is the only required scroll activation path (the thumb is a supplementary pointer shortcut).
      Recommendation: set thumb min-height/min-width via token to satisfy SC 2.5.5.

- **roles + ARIA**:
    - **viewport div**: when `ariaLabel` or `ariaLabelledBy` is supplied, adds `role="region"`
      + the matching `aria-label` / `aria-labelledby`. This makes the scroll container a named
      landmark, navigable by screen reader landmark shortcuts. When neither is supplied the div
      has no explicit role (it is a generic container; the content inside carries its own
      semantics).
    - **viewport div (keyboard scrollability)**: `tabindex="0"` is set when the viewport would
      otherwise have no focusable descendant that makes it keyboard-reachable for scrolling.
      The template sets `tabindex="0"` by default; a consuming template that guarantees the
      viewport always contains at least one focusable child may pass a data attribute to suppress
      it (`data-tabindex-suppress`). This follows the APG guidance: a scrollable region that
      contains only non-interactive content (e.g. a list of text) must be reachable by Tab so
      the keyboard user can invoke arrow-key scroll.
    - **overlay scrollbar rail** (`overlay=true`): `role="scrollbar"` + `aria-controls="<viewportId>"`
      + `aria-orientation="vertical"` / `"horizontal"` + `aria-valuenow="<0-100>"` (percent
      scrolled) + `aria-valuemin="0"` + `aria-valuemax="100"`. These are set and updated by the
      enhancer as the user scrolls. The rail itself has `aria-label="Vertical scrollbar"` /
      `"Horizontal scrollbar"`.
    - **scrollbar thumb**: no independent ARIA role; it is a child of the rail and inherits the
      rail's `role="scrollbar"`. The thumb is a presentation child (`aria-hidden` NOT set — it is
      the visual affordance of the scrollbar landmark).
    - **corner div** (`orientation="both"`, `overlay=true`): `aria-hidden="true"` (pure visual;
      not an interactive target).
    - **scrollbar rail HIDDEN from keyboard when redundant**: `tabindex="-1"` on the rail element
      (the keyboard user scrolls via arrow keys on the focused viewport, NOT by focusing the
      scrollbar thumb). The `role="scrollbar"` + aria attributes are for programmatic / AT
      discovery, not keyboard-first operation.

- **keyboard map**:
  | key | does | who |
  |---|---|---|
  | Tab | reaches the viewport (if `tabindex="0"` is set); moves focus into it if it contains focusable children | platform |
  | ArrowUp / ArrowDown | scrolls the viewport vertically by one line (when `orientation` is `vertical` or `both` and the viewport has focus) | platform (native scroll behavior on a focused scrollable div) |
  | ArrowLeft / ArrowRight | scrolls the viewport horizontally by one line (when `orientation` is `horizontal` or `both` and the viewport has focus) | platform |
  | Page Up / Page Down | scrolls by one page vertically | platform |
  | Home / End | scrolls to the very top / bottom of the scrollable content | platform |
  | Space | scrolls down by one page (when viewport is focused and no button/interactive child has focus) | platform |
  (No non-platform keys. The enhancer adds NO keyboard bindings — keyboard scrolling is a platform concern;
  the enhancer only drives the visual scrollbar and the pointer drag.)

- **focus management**: standard tab order. No trap, no roving, no initial-focus management. The
  viewport receives focus via Tab; interior focusable elements receive focus in DOM order after that.
  The enhancer does NOT intercept keyboard events; it only listens to the `scroll` DOM event and
  pointer events on the thumb.

- **live region**: none. The scroll area is a layout container; it carries no dynamic announcements.
  If the content inside changes (e.g. infinite-scroll loads more items), the content's own
  announcement mechanism (a `role=status` in the parent context) handles it; this component is
  agnostic.

- **shared mechanisms composed**: none. This component does NOT compose the popover seam,
  focus-trap, or collection-nav (it is not an overlay and it is not a collection). The enhancer
  is minimal and self-contained (pointer drag + aria-valuenow update only).

- **APG URL cited**:
  https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
  https://www.w3.org/TR/wai-aria-1.2/#scrollbar

## 5. Tokens

### Tokens read

| token | used for |
|---|---|
| `--lv-color-border` | scrollbar rail background (subtle track) |
| `--lv-color-fg` | scrollbar thumb base color (as an OKLCH alpha variant) |
| `--lv-color-muted` | scrollbar rail in `type=always` (slightly stronger than transparent) |
| `--lv-color-accent` | scrollbar thumb on `:hover` and `[data-dragging]` |
| `--lv-space-1` | scrollbar rail width (4px thin track) |
| `--lv-space-2` | scrollbar thumb min-height/min-width (satisfies SC 2.5.5 at 8px; actual min is computed to 44px by the enhancer for pointer usability) |
| `--lv-radius-full` | scrollbar thumb border-radius (pill shape) |
| `--lv-motion-duration-fast` | opacity transition on the rail show/hide (100ms show, hideDelay fade-out) |
| `--lv-motion-easing-standard` | easing for the opacity fade |
| `--lv-z-scrollbar` | z-index for the overlay rail (above content, below popover overlays) |

### NET-NEW tokens proposed

| token | value (OKLCH, `:root`) | dark value | rationale |
|---|---|---|---|
| `--lv-z-scrollbar` | `10` | — (structural, theme-invariant) | the overlay scrollbar rail sits above the viewport content but below all popover-tier overlays (`--lv-z-popover` = 50). A dedicated z-index token, not a magic literal, keeps the stacking order auditable. |
| `--lv-color-scrollbar-thumb` | `oklch(0.55 0.00 0 / 0.3)` | `oklch(0.80 0.00 0 / 0.3)` | a semi-transparent neutral that adapts to both light and dark backgrounds without a hard color value. Avoids co-opting `--lv-color-fg` (which is opaque) or `--lv-color-border` (which is for borders). This is the "a scrollbar thumb is its own visual role" token. |
| `--lv-color-scrollbar-thumb-active` | `oklch(0.45 0.00 0 / 0.55)` | `oklch(0.85 0.00 0 / 0.55)` | the thumb on hover and while dragging. Slightly darker/stronger than the default to give a clear active state without borrowing `--lv-color-accent` (accent implies brand, a scrollbar thumb is structural). |
| `--lv-color-scrollbar-track` | `oklch(0.92 0.00 0 / 0.0)` | `oklch(0.20 0.00 0 / 0.0)` | the rail/track background; fully transparent by default (overlay style). `type=always` sets opacity to 0.08 via a utility class over this token so the track is subtly visible without adding another token. |

No new spacing, typography, or radius tokens are needed; the existing set covers the scrollbar geometry.

## 6. Wire / island integration

### Server-rendered JTE structure

The partial renders two nested divs and, when `overlay=true`, the scrollbar rail(s) alongside
the viewport:

```
<div data-slot="scroll-area"
     data-orientation="${orientation}"
     data-type="${overlay ? type : null}"    ← null drops the attribute (JTE null-drop)
     data-hide-delay="${overlay ? hideDelay : null}"
     data-lievit-scroll-area               ← the enhancer mount hook (present only when overlay=true)
     class="relative overflow-hidden ..."
     ${attrs}>                               ← TRUSTED raw, static strings only

  <!-- viewport: the scrollable container -->
  <div data-slot="scroll-area-viewport"
       id="<generatedId>"                   ← used by aria-controls on the rail
       role="${hasLabel ? "region" : null}"  ← only when a label is supplied
       aria-label="${ariaLabel}"
       aria-labelledby="${ariaLabelledBy}"
       tabindex="0"
       class="h-full w-full overflow-auto scrollbar-hide ...
              ${viewportCssClass}"
       $dataAttrs>                           ← SAFE escaped dynamic data-*
    ${content}                               ← gg.jte.Content, the scrollable body
  </div>

  <!-- scrollbar rails: rendered only when overlay=true -->
  !{if overlay && (orientation == "vertical" || orientation == "both")}
  <div data-slot="scroll-area-bar"
       data-orientation="vertical"
       role="scrollbar"
       aria-controls="<generatedId>"
       aria-orientation="vertical"
       aria-valuenow="0"
       aria-valuemin="0"
       aria-valuemax="100"
       aria-label="Vertical scrollbar"
       tabindex="-1"
       class="absolute right-0 top-0 flex h-full touch-none select-none ...">
    <div data-slot="scroll-area-thumb"
         class="relative flex-1 rounded-full bg-[--lv-color-scrollbar-thumb] ...">
    </div>
  </div>
  !{end if}

  !{if overlay && (orientation == "horizontal" || orientation == "both")}
  <div data-slot="scroll-area-bar"
       data-orientation="horizontal"
       role="scrollbar"
       aria-controls="<generatedId>"
       aria-orientation="horizontal"
       aria-valuenow="0"
       aria-valuemin="0"
       aria-valuemax="100"
       aria-label="Horizontal scrollbar"
       tabindex="-1"
       class="absolute bottom-0 left-0 flex w-full touch-none select-none flex-col ...">
    <div data-slot="scroll-area-thumb"
         class="relative flex-1 rounded-full bg-[--lv-color-scrollbar-thumb] ...">
    </div>
  </div>
  !{end if}

  !{if overlay && orientation == "both"}
  <div data-slot="scroll-area-corner"
       aria-hidden="true"
       class="absolute bottom-0 right-0 ...">
  </div>
  !{end if}

</div>
```

`data-slot` values: `scroll-area` (root), `scroll-area-viewport`, `scroll-area-bar` (rails),
`scroll-area-thumb`, `scroll-area-corner`. These are the styling and test targets.

The `scrollbar-hide` Tailwind utility (`scrollbar-width: none; ::-webkit-scrollbar { display: none }`)
is applied only when `overlay=true` (the partial gates it on the `overlay` param). When `overlay=false`,
the native scrollbar is visible and no CSS hides it.

### Typed-TS enhancer responsibilities (`scroll-area.enhancer.ts`)

The enhancer is activated ONLY when the root carries `data-lievit-scroll-area`; it is a no-op
otherwise. It is OPTIONAL progressive enhancement: the partial is fully usable without it
(native scrollbar mode).

The enhancer is bound via the lievit runtime lifecycle registry (`onComponentInit` on the
`data-lievit-scroll-area` attribute, like the existing 12 enhancers). It receives a reference
to the root element and performs:

1. **Thumb size + position sync**: on `scroll` event on the viewport + on `ResizeObserver`
   callback for viewport/content size changes, recomputes:
   - `thumbHeightRatio = viewport.clientHeight / viewport.scrollHeight` (vertical)
   - `thumbPositionRatio = viewport.scrollTop / (viewport.scrollHeight - viewport.clientHeight)`
   - Applies `height: thumbHeightRatio * rail.clientHeight px` and
     `transform: translateY(thumbPositionRatio * (rail.clientHeight - thumb.offsetHeight) px)`
     on the thumb element directly (no class mutation, no round-trip, no framework).
   - Updates `aria-valuenow` on the rail element to `Math.round(thumbPositionRatio * 100)`.
   - Same math for horizontal axis when applicable.

2. **Overflow detection**: after each resize, checks whether `scrollHeight > clientHeight`
   (vertical) / `scrollWidth > clientWidth` (horizontal). When no overflow: sets
   `data-no-overflow` on the root (CSS hides the rail). When overflow returns: removes it.

3. **Thumb drag**: on `pointerdown` on the thumb, enters drag mode:
   - Sets `data-dragging` on the rail.
   - On `pointermove` (captured to the thumb via `setPointerCapture`), computes the delta
     ratio and sets `viewport.scrollTop` / `viewport.scrollLeft` directly.
   - On `pointerup` / `pointercancel`: removes `data-dragging`, releases capture.
   - Prevents text selection during drag (`user-select: none` via the `select-none` class
     that is already on the rail).
   - Does NOT intercept keyboard events on the thumb. The thumb is `tabindex="-1"`.

4. **Hover / scroll visibility** (when `type !== "always"`):
   - Sets `data-pointer-over` on root on `pointerenter` / removes on `pointerleave`.
   - Sets `data-scrolling` on root on `scroll` start; removes it after `hideDelay` ms
     (via `clearTimeout` + `setTimeout`).
   - CSS selectors `[data-scroll-area][data-pointer-over] [data-slot="scroll-area-bar"]`,
     `[data-scroll-area][data-scrolling] [data-slot="scroll-area-bar"]`, and
     `[data-scroll-area][data-type="always"] [data-slot="scroll-area-bar"]` control opacity.

5. **Cleanup**: on the lievit `onComponentDestroy` lifecycle hook (if the component is removed
   from the DOM), disconnects the `ResizeObserver` and removes event listeners.

The enhancer fires NO wire actions (there is no server state to update — scroll position is
purely ephemeral view state). It reads `data-hide-delay` and `data-type` from the root element
(set by the partial at render time) so there is no out-of-band configuration. It is
**CSP-clean**: no `eval`, no `innerHTML`, no inline style injection beyond direct `style`
property assignments on the thumb element (which is CSP-safe — CSP governs `<style>` tags and
`style=` attributes in markup, not JavaScript `element.style.transform = "..."` assignments).

The enhancer is self-contained: it composes no other shared enhancers (no focus-trap, no
collection-nav). This is appropriate because scroll-area has no collection navigation, no focus
trap, and no overlay positioning.

## 7. Acceptance tests

### Render (jsdom, PARTIAL without enhancer — the static contract)

- **`scroll-area renders content inside the viewport`**: mounts the partial with `content` body,
  asserts `[data-slot="scroll-area-viewport"]` contains the expected content node.
- **`scroll-area emits data-slot attributes on all structural elements`**: asserts root has
  `data-slot="scroll-area"`, viewport has `data-slot="scroll-area-viewport"`; no orphaned
  structural elements.
- **`scroll-area without overlay renders no rail elements`**: `overlay=false` → no
  `[data-slot="scroll-area-bar"]` in the DOM.
- **`scroll-area with overlay renders vertical rail when orientation is vertical`**: `overlay=true`,
  `orientation="vertical"` → exactly one `[data-slot="scroll-area-bar"][data-orientation="vertical"]`
  present; no horizontal rail.
- **`scroll-area with overlay renders both rails and corner when orientation is both`**: two
  `[data-slot="scroll-area-bar"]` elements + one `[data-slot="scroll-area-corner"]` present.
- **`scroll-area with ariaLabel sets role=region and aria-label on the viewport`**: supplying
  `ariaLabel="Search results"` → viewport has `role="region"` + `aria-label="Search results"`.
- **`scroll-area without ariaLabel or ariaLabelledBy does not set role on the viewport`**: no
  `role` attribute on viewport (generic container, not a landmark).
- **`scroll-area viewport has tabindex=0 by default`**: asserts `tabindex="0"` on the viewport
  div (keyboard scrollability contract).
- **`scroll-area with overlay hides native scrollbar via CSS class`**: `overlay=true` → viewport
  carries the `scrollbar-hide` utility; `overlay=false` → it does not.
- **`scroll-area renders data-orientation on the root`**: the `orientation` param value is
  reflected as `data-orientation` on the root element.
- **`scroll-area renders data-type and data-hide-delay only when overlay=true`**: when
  `overlay=true, type="hover", hideDelay=800` the root has both attributes; when `overlay=false`
  neither is present.
- **`scroll-area with max-height applies the inline style`**: `height="300px"` →
  `style="max-height: 300px"` on the viewport (or root, depending on implementation choice).
- **`scroll-area escaping (XSS gate)`**: `dataAttrs = {"data-id": "\">|<script>alert(1)</script>"}` →
  the rendered HTML contains the escaped form, never an executable tag.

### axe-core (accessibility gate)

- **`scroll-area with ariaLabel passes axe-core`**: render the partial with `ariaLabel` set,
  `overlay=true` (rails with `role=scrollbar` present), run axe-core → zero violations. This
  exercises the `scrollbar` role contract (`aria-controls` references an existing id,
  `aria-orientation`, `aria-valuenow` present).
- **`scroll-area without ariaLabel passes axe-core`**: render without any label (generic
  container mode) → zero violations (no orphaned landmark, no labelled-by pointing to nothing).
- **`scroll-area scrollbar rail is labelled (accessible-name rule)`**: each `[role="scrollbar"]`
  has a non-empty accessible name (`aria-label="Vertical scrollbar"`); axe
  `aria-required-attr` + `aria-allowed-attr` pass.

### Keyboard (platform scroll contract — asserted in jsdom with simulated scroll events)

- **`arrow keys scroll the viewport when viewport is focused`**: focus the viewport, dispatch
  `ArrowDown` → assert `viewport.scrollTop` increased; dispatch `ArrowUp` → assert it decreased.
  (These are platform events; the test asserts the DOM reacts, not that the component handles them.)
- **`Tab reaches the viewport`**: in a focusable-children-absent scenario, the viewport is in
  the tab sequence (`tabindex=0`); `Tab` keystroke focuses it.
- **`no keyboard binding is added by the enhancer`**: assert the enhancer registers no `keydown`
  / `keypress` / `keyup` listener on the viewport or the rail (keyboard scrolling is platform-only;
  any enhancer keyboard listener would indicate a violation of the spec).

### Enhancer behavior (jsdom with real `LievitRuntime` + JSDOM scroll simulation)

- **`enhancer updates aria-valuenow on scroll`**: mount with `overlay=true`; set
  `viewport.scrollTop = viewport.scrollHeight / 2` and dispatch `scroll`; assert the vertical
  rail's `aria-valuenow` is `"50"` (± rounding).
- **`enhancer sets data-scrolling during scroll and clears it after hideDelay`**: mount with
  `type="scroll", hideDelay=100`; dispatch `scroll` → root has `[data-scrolling]`;
  advance fake timers by 100ms → `[data-scrolling]` removed.
- **`enhancer sets data-pointer-over on pointerenter and removes on pointerleave`**: dispatch
  `pointerenter` on the root → `[data-pointer-over]` present; dispatch `pointerleave` → absent.
- **`enhancer sets data-no-overflow when content fits`**: set `viewport.scrollHeight <=
  viewport.clientHeight` via JSDOM mocks; trigger resize observer callback → root has
  `[data-no-overflow]`; assert the rail element is hidden via CSS (token-driven).
- **`enhancer drag: pointerdown on thumb scrolls viewport on pointermove`**: dispatch
  `pointerdown` on the thumb; dispatch `pointermove` with a delta; assert `viewport.scrollTop`
  changed by the proportional amount.
- **`enhancer drag: data-dragging is set during drag and removed on pointerup`**: pointerdown
  → rail has `[data-dragging]`; pointerup → removed.
- **`enhancer fires no wire actions`**: assert the enhancer never calls any wire action method
  on the lievit runtime (scroll position is not a server fact).
- **`enhancer cleans up ResizeObserver and listeners on destroy`**: call `onComponentDestroy`;
  assert the `ResizeObserver` is disconnected (spy on `disconnect()`).

### Variants / sizes

- **`orientation=horizontal renders only horizontal rail`**: `overlay=true, orientation="horizontal"`
  → exactly one rail with `data-orientation="horizontal"`, zero vertical rails.
- **`orientation=both renders corner`**: asserts the `data-slot="scroll-area-corner"` is
  `aria-hidden="true"`.
- **`type=always emits data-type=always on root`**: asserts the attribute is set correctly.
- **`height param applies max-height`**: `height="200px"` → the correct CSS property is set on
  the intended element.

### JTE compile + render gate

Covered by the `test/jte-compile` real-compiler gate (the shared gate already checks every
`.jte` in the registry compiles and renders without error; no per-component duplication needed).

## 8. Non-goals / anti-patterns

- **NOT a WIRE component**: the scroll position is ephemeral view state, not a server fact.
  Do not make this WIRE to "persist scroll position" — if scroll position needs to be persisted
  (e.g. a restored session), that is the consuming page's concern (the browser's `scroll-behavior`
  + `scrollRestoration` API, or a separate wire action on the page, not this component).
- **NOT a focus trap**: the scroll area is a passthrough container; focus flows in and out
  normally. Do not add `tabindex` trapping logic. If a scroll area is inside a dialog, the
  dialog's `focus-trap` enhancer handles the outer trap; the scroll area just carries `tabindex="0"`.
- **NOT a virtual scroll / virtualization**: this component scrolls real DOM content. A
  virtualized list (thousands of items) is a different component (`data-grid` or `tree-view`
  with a virtualization enhancer). Do not add item-pool / windowing logic here.
- **NOT a carousel or a scroll-snap surface**: scroll-snap CSS is a consuming-template concern,
  not this component's API. A carousel composes the `carousel` component, not `scroll-area`.
- **NOT an infinite-scroll trigger**: infinite scroll (load-more at the bottom) is an HTMX
  pattern (`hx-trigger="intersect"` on a sentinel) that the consuming template composes.
  `scroll-area` does not emit any event or wire action for scroll-end detection.
- **NOT a replacement for native scroll in a table**: a `data-table` that needs horizontal
  scrolling applies `overflow-x: auto` on its own wrapper; it does not need to nest inside a
  `scroll-area` component (that would be over-composition).
- **No custom scrollbar in `overlay=false` mode**: when `overlay=false`, the native scrollbar
  is the only scrollbar. Do not inject custom CSS or DOM nodes when `overlay=false`; the partial
  is a zero-JS static render in that mode.
- **No framework in the enhancer**: the enhancer is typed vanilla TS. No Alpine, no Lit, no
  MutationObserver-of-MutationObservers, no virtual DOM. The thumb geometry is elementary
  arithmetic; keep it that way.
- **No inline `style=` attributes in the JTE template** (CSP rule): height/width are applied as
  CSS custom properties via a `<style>` block in the host page OR as Tailwind arbitrary values
  (`max-h-[var(--scroll-h)]` + a scoped CSS variable) — NOT as `style="max-height: ${height}"`.
  The CSP blocks inline styles in markup. The enhancer may set `element.style.transform` (JS
  property assignment, not an attribute — CSP-safe) for the thumb position.
- **No aria-live region**: a scroll area is a container, not a status announcer. Any
  announcement responsibility belongs to the content inside it.

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens (OKLCH source-of-truth format, `00` §4). You MAY
read radix-ui ScrollArea source / shadcn ScrollArea as INVENTORY and PATTERN references; you MAY
read WAI-ARIA APG keyboard interface guidance and the `role=scrollbar` spec as the a11y contract.
You MUST NOT paste literal source from any of them (the one bright line, `02-licensing.md`) —
the output is always original generation.

Key discipline reminders:
- The partial is TWO modes: `overlay=false` = zero JS, zero custom scrollbar DOM; `overlay=true` =
  the rails render + `data-lievit-scroll-area` hook is emitted. Do not add overlay DOM when
  `overlay=false`; do not omit it when `overlay=true`.
- The enhancer composes NO shared mechanisms (focus-trap, collection-nav, popover seam are
  irrelevant here). It is self-contained and minimal.
- The enhancer MUST NOT intercept keyboard events. Keyboard scroll is a platform concern.
- `aria-valuenow` on the rail MUST be updated on every `scroll` event (the screen reader
  reads the scrollbar landmark's current position; a stale value is a broken AT experience).
- The thumb `transform: translateY(...)` is set as a JS `style` property assignment (CSP-safe),
  not via a `data-*` attribute or a class toggle.
- Mirror `button.jte` house conventions exactly: header doc-comment with the credits line,
  typed `@param`, `data-slot`, the two escaping channels (`attrs` trusted-raw, `dataAttrs`
  safe-escaped), zero `<script>`, zero inline `on*=`.
- The net-new tokens (`--lv-z-scrollbar`, `--lv-color-scrollbar-thumb`,
  `--lv-color-scrollbar-thumb-active`, `--lv-color-scrollbar-track`) must be added to both
  the `:root` block and the `.dark, [data-theme="dark"]` re-point block in
  `registry/tokens/lievit-tokens.css` before the JTE template references them.
- Minimal code to GREEN against the acceptance tests in §7; refactor only while green.
