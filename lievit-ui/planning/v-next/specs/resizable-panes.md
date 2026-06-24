<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — resizable-panes (NET-NEW: BUILT against raw APG, separator role + keyboard resize)

- **tier**: +ENH (`resizable-panes.enhancer.ts` — the irreducible client bits: drag, keyboard, persist;
  the server renders the initial split layout + the splitter shell; the enhancer owns live resize)
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: NET-NEW (no counterpart in the current 68 JTE templates)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Window Splitter pattern — https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
      — BUILT against the raw APG (no react-aria `useWindowSplitter` counterpart exists; react-aria does
      not ship this pattern as of 2026); separator role, keyboard map, aria-valuenow/min/max/controls, all
      verified against the APG URL above
    - inventory: Ant Design Splitter as inventory reference (horizontal/vertical, nested, persist, min/max
      sizes, collapsible panes, onResize / onResizeEnd callbacks); also inspected shadcn
      ResizablePanelGroup / react-resizable-panels feature inventory as a secondary reference
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      ResizablePanelGroup (NO code copied)

## 1. What it is

A layout primitive that renders two (or more) adjacent panes separated by a draggable/keyboard-moveable
splitter, allowing the user to adjust the relative sizes at runtime.
The PRIMARY use case in a gestionale: a master-detail layout (list pane + detail pane), a sidebar + main
content split, or a stacked editor / preview split.

**Decision rule — why +ENH tier, not PARTIAL or WIRE:**
The initial pane layout (direction, min/max constraints, initial sizes, labels) is STATIC configuration
that the server renders once as HTML; this part is a PARTIAL shell.
The RESIZE interaction — drag the handle, arrow-key nudge, collapse/restore, persisting the split
position — is genuinely irreducible client behaviour (sub-pixel pointer math, real-time layout feedback,
`pointer*` events).
A wire round-trip on every pixel of drag would be unusable; this is one of the canonical `+ENH` cases
(see architecture contract §1, "drag, OTP auto-advance … — ONLY where server round-trip is a real UX
loss").
So the component is a styled server-rendered PARTIAL SHELL (the pane containers + the separator element
with its full ARIA structure baked in) plus a typed-TS enhancer (`resizable-panes.enhancer.ts`) that
owns all live interaction.
There is no WIRE round-trip during resize; if the adopter needs the final size server-side (e.g. to
persist it), the enhancer fires a named wire action on `pointerup` / keyboard commit, and the WIRE
component it lives inside handles the persistence.

**Server-first justification:** the initial sizes, direction, labels, and ARIA structure are all known
at render time and rendered as correct HTML; the enhancer only takes over dynamic geometry.
No client-only state seeps into the document's initial a11y tree; screen readers see the correct roles
and values from the server-rendered markup.

## 2. API — params / props (the typed surface)

### 2.a JTE @param surface (the PARTIAL shell)

| param | type | default | meaning |
|---|---|---|---|
| `direction` | `String` | `"horizontal"` | `horizontal` (side by side, a vertical splitter bar) or `vertical` (stacked, a horizontal splitter bar) |
| `initialSizes` | `List<Integer>` | `[50, 50]` | initial sizes as percentages summing to 100; one entry per pane. Two-pane default; three panes = three entries |
| `minSizes` | `List<Integer>` | `[]` (unconstrained) | per-pane minimum sizes in percentage points (0 = no min); must be same length as `initialSizes` when provided |
| `maxSizes` | `List<Integer>` | `[]` (unconstrained) | per-pane maximum size in percentage points (100 = no max) |
| `collapsible` | `List<Boolean>` | `[]` (none) | per-pane collapse flag; `true` means Enter on that pane's adjacent splitter collapses it to its `minSizes` entry (or 0) |
| `step` | `int` | `5` | percentage points moved per arrow-key press |
| `persistKey` | `String` | `null` | when non-null, the enhancer reads/writes split sizes to `localStorage` under this key on resize end; the server renders `initialSizes` as the cold-start fallback |
| `splitLabels` | `List<String>` | `[]` | accessible labels for each splitter handle (one per gap between panes); used as `aria-label` on the separator when no visible label is available |
| `paneLabels` | `List<String>` | `[]` | accessible labels for the primary pane elements (one per pane); the first pane that a splitter "controls" gets `aria-labelledby` pointed at a hidden `<span>` carrying this label |
| `wireResizeEnd` | `String` | `null` | SAFE: name of a wire action to fire on resize end (pointer up or keyboard commit); the enhancer calls it with `data-sizes` = JSON array of final percentages |
| `cssClass` | `String` | `""` | extra utility classes on the outer wrapper |
| `attrs` | `String` | `""` | TRUSTED raw (`$unsafe`) — STATIC author-typed strings only (data-testid, id) |

### 2.b Slots

| slot | type | meaning |
|---|---|---|
| `panes` | `gg.jte.Content` (required, repeated per pane) | the adopter provides N pane bodies as a JTE `Content` array; lievit renders each inside a `data-slot="pane"` div in order |

Note: unlike a WIRE component, this shell IS a PARTIAL (it has a `Content` slot).
The adopter injects pane bodies; the enhancer does not touch their contents.

### 2.c Enhancer data-* attributes (set by the JTE shell on the root + the separator)

These are the contracts the enhancer reads from the rendered DOM; they are all emitted by the JTE
template and never manipulated by the adopter directly.

| attribute | set on | meaning |
|---|---|---|
| `data-lievit-enhancer="resizable-panes"` | wrapper root | mounts the enhancer via the runtime lifecycle registry |
| `data-direction` | wrapper root | `"horizontal"` or `"vertical"` |
| `data-step` | wrapper root | the arrow-key step in percentage points |
| `data-persist-key` | wrapper root | `persistKey` value (omitted when null) |
| `data-wire-resize-end` | wrapper root | `wireResizeEnd` action name (omitted when null) |
| `data-slot="pane"` | each pane div | lets the enhancer find panes in order |
| `data-min` | each pane div | per-pane minimum percentage (from `minSizes`) |
| `data-max` | each pane div | per-pane maximum percentage (from `maxSizes`) |
| `data-collapsible` | each pane div | `"true"` when this pane is collapsible |
| `data-slot="separator"` | each `<div role="separator">` | lets the enhancer find handles |
| `data-index` | each separator | 0-based index of the gap it controls (separator 0 is between pane 0 and pane 1) |

## 3. Variants / sizes / states

### Variants (direction)
- `horizontal` (default): panes sit side by side; the splitter is a narrow vertical bar.
  CSS: the wrapper is `flex flex-row`; each pane is `overflow-hidden`.
- `vertical`: panes are stacked top-to-bottom; the splitter is a narrow horizontal bar.
  CSS: the wrapper is `flex flex-col`.
No `variant` token-intent enum (this is a layout primitive, not an action-intent control).

### Sizes
No `size` param: the component fills its container via `width: 100%; height: 100%` (the outer
wrapper).
The PANE widths/heights are set by the `initialSizes` percentages as inline CSS custom properties
(`--pane-size: <N>%`), written by the JTE template and updated live by the enhancer.
The splitter handle itself has a fixed visual width/height via tokens (`--lv-space-1` thick handle,
`--lv-space-3` hit target with negative margins for easier grab).

### States
| state | how expressed |
|---|---|
| idle | default handle styling |
| `:focus-visible` on handle | `--lv-ring` ring, same as all interactive elements |
| dragging | `data-dragging="true"` on the wrapper root (set by the enhancer on `pointerdown`); the handle widens slightly via the `[data-dragging] [data-slot=separator]` selector |
| collapsed | `data-collapsed="true"` on the pane (set by enhancer when size reaches `minSizes` or 0); the handle shows a collapse-indicator icon; `aria-valuenow` drops to the min |
| disabled (per-pane) | a `data-disabled` on a separator omits arrow-key behaviour and drag; the handle is dimmed via `disabled:` utilities and marked `aria-disabled="true"` |
| `aria-busy` | not emitted (no wire round-trip during resize; the surrounding WIRE context may set it independently) |

## 4. The a11y contract (the heart — non-negotiable, fully specified)

- **WAI-ARIA pattern**: APG Window Splitter.
  Source verified: https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
  This is a BUILT implementation (no react-aria `useWindowSplitter` exists); the keyboard map and
  ARIA attributes below are derived directly from the APG pattern page, not from a secondary source.

- **Roles + ARIA** (all emitted by the JTE template at render time, never injected by JS):

  | element | role / attribute | value at render |
  |---|---|---|
  | `<div data-slot="separator">` | `role="separator"` | (the focusable splitter handle) |
  | separator | `tabindex="0"` | makes the otherwise inert `<div role=separator>` keyboard-reachable (the APG requires the separator to be focusable) |
  | separator | `aria-valuenow` | the initial size of the PRIMARY pane (left or top pane for that gap) as an integer 0–100 |
  | separator | `aria-valuemin` | minimum size of the primary pane (from `minSizes[i]`, default `0`) |
  | separator | `aria-valuemax` | maximum size of the primary pane (from `maxSizes[i]`, default `100`) |
  | separator | `aria-label` | `splitLabels[i]` when provided and no visible label exists; e.g. `"Resize master pane"` |
  | separator | `aria-labelledby` | id of the primary pane's visible heading element when `paneLabels[i]` resolves to a rendered heading in the pane; preferred over `aria-label` when a visible name exists |
  | separator | `aria-controls` | id of the primary (left/top) pane element for that gap |
  | pane div | `id="lv-pane-<uid>-<i>"` | stable server-generated id so the separator's `aria-controls` can reference it |

  Notes:
  - `aria-orientation` is NOT listed in the APG attribute set for the Window Splitter; direction is
    conveyed by which arrow keys the enhancer responds to (Left/Right vs Up/Down).
  - The pane divs themselves carry no ARIA role; they are generic containers, and their content
    (headings, landmarks) provides the structure screen readers use to navigate.
  - When a pane is collapsed (`aria-valuenow` reaches `aria-valuemin`), `aria-valuenow` stays at the
    min (0 or the minSize); the APG does not define a separate collapsed ARIA state.

- **Keyboard map** (the load-bearing table — every key the APG defines, cited verbatim):

  | key | does | who |
  |---|---|---|
  | `ArrowLeft` | moves a vertical (horizontal-direction) splitter left by `step`%; clamped by min/max | enhancer |
  | `ArrowRight` | moves a vertical splitter right by `step`%; clamped by min/max | enhancer |
  | `ArrowUp` | moves a horizontal (vertical-direction) splitter up by `step`%; clamped by min/max | enhancer |
  | `ArrowDown` | moves a horizontal splitter down by `step`%; clamped by min/max | enhancer |
  | `Enter` | if primary pane is expanded: collapse to `minSizes[i]` (or 0 if no min); if collapsed: restore to last non-collapsed size (APG: "Collapses primary pane if expanded; restores previous position if collapsed") | enhancer |
  | `Home` | (optional, implemented) moves splitter to maximum primary pane size (`aria-valuemax`) | enhancer |
  | `End` | (optional, implemented) moves splitter to minimum primary pane size (`aria-valuemin`) | enhancer |
  | `F6` | (optional, NOT implemented — out of scope: F6 is a multi-pane window-cycling key for IDE-grade layouts; gestionale panes are not independent windows) | — |
  | `Tab` | moves focus to the next focusable element in the page; leaves the splitter | platform |
  | `Shift+Tab` | moves focus to the previous focusable element | platform |

  Fixed-splitter note: a separator with `data-disabled` on it omits all arrow-key logic (APG: "Fixed
  splitters omit arrow key implementation").

  After each keyboard move the enhancer updates `aria-valuenow` to the new primary pane percentage and
  applies the new `--pane-size` CSS custom property live (no round-trip).
  The wire action (`wireResizeEnd`) fires only on Enter (collapse/restore commit), on losing keyboard
  focus from the separator (`blur`), or if the adopter needs server persistence.

- **Focus management**:
  - Initial focus: none; the splitter handle(s) enter the natural tab order via `tabindex="0"`.
  - Focus order: each separator is independently focusable; in a two-pane layout there is one separator;
    in a three-pane layout there are two separators, each tab-reachable in DOM order.
  - No trap: resizable panes is a layout container, not an overlay.
  - Focus return: not applicable (no overlay opens/closes).
  - Roving tabindex: not used; each separator has its own `tabindex="0"`.
  - The enhancer does NOT move focus programmatically during drag or keyboard resize; focus stays on the
    separator being interacted with.

- **Live region**: none. Size changes are conveyed by the updated `aria-valuenow` value on the separator
  (screen readers that announce value changes for slider-like roles pick this up naturally, because
  `role=separator` with `aria-valuenow` is treated similarly to a slider by most AT).

- **Shared mechanisms composed**: NONE of the standard shared mechanisms (focus-trap, collection-nav,
  popover seam) apply; resizable panes is a standalone +ENH with its own enhancer.

## 5. Tokens

The component reads:

| token | use |
|---|---|
| `--lv-color-border` | separator handle line colour (default state) |
| `--lv-color-accent` | separator handle hover / active colour |
| `--lv-color-fg` | collapse indicator icon colour |
| `--lv-color-muted` | separator background when idle (the thin visible track) |
| `--lv-space-1` | separator visual thickness (the 4px visible line) |
| `--lv-space-3` | separator hit-target total size (12px, with negative margins so the visual is thinner than the target) |
| `--lv-ring` | focus-visible ring on the separator handle |
| `--lv-radius-full` | optional: pill-shaped drag handle indicator dot |
| `--lv-transition-fast` | the separator width/height transition on hover / dragging state |
| `--lv-z-above` | ensures the separator is above pane content during drag (avoids iframes capturing pointer events) |

NET-NEW tokens proposed: none.
The pane split sizes are expressed as an inline CSS custom property `--pane-size` set on each pane `div`
(`style="flex: 0 0 var(--pane-size)"` or `style="flex: 0 0 <N>%"` written directly); this is NOT a
design token but a per-instance runtime value.

Dark-mode: `--lv-color-border` and `--lv-color-accent` are already in both the `:root` and `.dark`
blocks; no new dark-mode rules are needed.

## 6. Wire / island integration

### Server-rendered JTE structure

The JTE partial renders the wrapper + pane divs + separator divs in one pass.
No Spring WIRE component is required for the layout itself.
If the adopter needs to persist sizes server-side, they wrap this partial inside a WIRE component and
pass `wireResizeEnd` pointing to a `@LievitAction` on that component.

Minimal rendered HTML shape (two-pane horizontal, illustrative):

```html
<div
  data-slot="resizable-panes"
  data-lievit-enhancer="resizable-panes"
  data-direction="horizontal"
  data-step="5"
  data-persist-key="master-detail-split"
  class="flex flex-row w-full h-full overflow-hidden [rest of utility classes]">

  <div
    id="lv-pane-<uid>-0"
    data-slot="pane"
    data-min="20"
    data-max="80"
    data-collapsible="false"
    style="flex: 0 0 var(--pane-size, 40%); overflow: hidden;">
    <!-- adopter pane 0 content (the master list) -->
  </div>

  <div
    role="separator"
    tabindex="0"
    data-slot="separator"
    data-index="0"
    aria-valuenow="40"
    aria-valuemin="20"
    aria-valuemax="80"
    aria-label="Resize master pane"
    aria-controls="lv-pane-<uid>-0"
    class="[separator styling utilities]">
    <!-- optional collapse-indicator icon: aria-hidden="true" -->
  </div>

  <div
    id="lv-pane-<uid>-1"
    data-slot="pane"
    data-min="20"
    data-max="80"
    data-collapsible="false"
    style="flex: 1 1 0; overflow: hidden;">
    <!-- adopter pane 1 content (the detail panel) -->
  </div>
</div>
```

Key structural rules:
- Pane 0 uses `flex: 0 0 var(--pane-size, <initialSize>%)` — it is the "primary" pane whose size the
  separator's `aria-valuenow` tracks.
- Pane 1 (and any subsequent panes beyond the last separator) uses `flex: 1 1 0` — it takes the
  remaining space.
- In a three-pane layout, pane 0 has `--pane-size`, separator 0 controls pane 0, pane 1 has
  `--pane-size-1`, separator 1 controls pane 1, pane 2 takes the remainder.
- The JTE template reads `persistKey` from `localStorage` in `<noscript>`-safe fashion: the initial
  render uses `initialSizes`; the enhancer applies the stored sizes on mount (a one-frame layout shift,
  but the server-rendered value is the correct no-JS fallback).
- `attrs` (trusted raw) is appended to the wrapper root only. `data-*` on the separators is always via
  the escaped `dataAttrs` channel (all values are author-typed static config, not per-row DB values,
  but the escaping convention is upheld for consistency).

### Enhancer responsibilities (`resizable-panes.enhancer.ts`)

Registered via the lievit lifecycle registry (the `onComponentInit` / `data-lievit-enhancer` hook,
ADR-0019); mounts once per wrapper root.

On **mount**:
1. Find all `[data-slot="pane"]` and `[data-slot="separator"]` in the wrapper.
2. If `data-persist-key` is set, read sizes from `localStorage`; validate they sum to ≤ 100 and each
   pane satisfies its `data-min`/`data-max`; apply by writing `style.setProperty('--pane-size', ...)`.
3. Record each separator's `aria-valuenow` as the last-non-collapsed size (for Enter restore).

On **pointer drag** (`pointerdown` → `pointermove` → `pointerup` on separator):
1. `pointerdown`: record start pointer position + start sizes; set `data-dragging="true"` on wrapper;
   call `separator.setPointerCapture(event.pointerId)` so the drag is not broken by iframe content.
2. `pointermove`: compute delta as a fraction of the wrapper dimension; clamp to `data-min`/`data-max`;
   write `--pane-size` on the primary pane; update `aria-valuenow` on the separator.
3. `pointerup`: remove `data-dragging`; release pointer capture; if `data-persist-key`, write sizes to
   `localStorage`; if `data-wire-resize-end`, fire the named wire action with `data-sizes` payload.

On **keyboard** (`keydown` on separator — the APG map):
1. `ArrowLeft`/`ArrowRight` (horizontal direction): adjust primary pane size by ±`data-step`%;
   clamp; update `--pane-size` + `aria-valuenow`.
2. `ArrowUp`/`ArrowDown` (vertical direction): same, mapped to the stacked axis.
3. `Enter`: collapse/restore toggle (see §4 keyboard map).
4. `Home`: set primary pane to `aria-valuemax` (fill to max).
5. `End`: set primary pane to `aria-valuemin` (collapse to min).
6. After any keyboard change: if `data-persist-key`, debounce-write to `localStorage`; fire
   `wireResizeEnd` wire action on `blur` from the separator (not on every keypress).

On **unmount** (component lifecycle teardown): remove `pointerdown`/`pointermove`/`pointerup`/`keydown`
listeners; release any active pointer capture.

**What the enhancer does NOT do:**
- It does not set any ARIA attribute except `aria-valuenow` (the live size value) and, on
  collapse, updating `aria-valuenow` to the min. All other ARIA is server-rendered.
- It does not manipulate pane content.
- It does not fire the wire action on every pointer move (only on pointerup / keyboard blur).
- It does not import any framework (CSP-clean, dependency-free, ADR-0012 / ADR-0019 hold).

## 7. Acceptance tests

The component is DONE only when ALL pass on a REAL substrate (not a mocked one — the client-island
fidelity lesson from gest CLAUDE.md).

### render (jsdom + real LievitRuntime)
- **`renders-two-panes-and-one-separator`**: a two-pane horizontal template renders two `[data-slot=pane]`
  divs and one `[data-slot=separator]` with `role="separator"`, `tabindex="0"`, `aria-valuenow="40"`,
  `aria-valuemin="20"`, `aria-valuemax="80"`, `aria-controls` pointing to the first pane's id.
- **`renders-three-panes-two-separators`**: a three-pane template renders three panes and two separators;
  separator 0 controls pane 0, separator 1 controls pane 1; `data-index` is 0 and 1 respectively.
- **`vertical-direction-sets-data-direction`**: `direction="vertical"` writes `data-direction="vertical"`
  on the wrapper root.
- **`persist-key-sets-data-persist-key`**: `persistKey="my-split"` writes `data-persist-key="my-split"`
  on the wrapper root; absent when null.
- **`initial-sizes-applied-as-pane-size-property`**: pane 0's inline style contains
  `--pane-size: 40%` when `initialSizes=[40,60]`.

### axe-core (rendered DOM, zero violations)
- **`axe-separator-role-compliant`**: run axe on the rendered wrapper DOM; zero violations; specifically
  the `separator` role with `aria-valuenow`/`min`/`max` must not trigger any ARIA role attribute errors.
- **`axe-accessible-name-required`**: a separator WITHOUT `aria-label` AND without `aria-labelledby`
  triggers an `aria-required-attr` / accessible-name violation; the spec requires one or the other —
  this is a NEGATIVE test (asserts the violation fires when the adopter omits labels, so the gate
  catches misconfigured usage).
- **`axe-with-label`**: a separator WITH `aria-label="Resize"` produces zero violations (the positive
  counterpart).

### keyboard (REAL enhancer mounted in jsdom — NOT a mocked `$lievit`)
- **`arrowright-increases-primary-pane`**: focus separator (horizontal), press `ArrowRight`, assert
  `aria-valuenow` incremented by `step`% and the primary pane's `--pane-size` updated accordingly.
- **`arrowleft-decreases-primary-pane`**: focus separator (horizontal), press `ArrowLeft`, assert
  `aria-valuenow` decremented; does not go below `aria-valuemin`.
- **`arrowup-decreases-primary-pane-vertical`**: focus separator (vertical direction), press `ArrowUp`,
  assert `aria-valuenow` decremented.
- **`arrowdown-increases-primary-pane-vertical`**: focus separator (vertical), press `ArrowDown`,
  assert `aria-valuenow` incremented.
- **`enter-collapses-then-restores`**: focus separator on a collapsible pane; press `Enter` →
  `aria-valuenow` drops to `aria-valuemin` and `data-collapsed="true"` on the pane; press `Enter` again
  → `aria-valuenow` restores to the pre-collapse value and `data-collapsed` is removed.
- **`home-sets-to-max`**: press `Home` → `aria-valuenow` equals `aria-valuemax`.
- **`end-sets-to-min`**: press `End` → `aria-valuenow` equals `aria-valuemin`.
- **`clamp-respects-min-max`**: repeated `ArrowRight` beyond `aria-valuemax` does not push `aria-valuenow`
  above `aria-valuemax`.
- **`disabled-separator-ignores-arrow-keys`**: a separator with `data-disabled` does not change
  `aria-valuenow` on any arrow key.

### pointer drag (real enhancer + jsdom `PointerEvent` simulation)
- **`pointerdown-sets-dragging`**: `pointerdown` on separator sets `data-dragging="true"` on the wrapper.
- **`pointermove-updates-pane-size`**: simulate `pointerdown` then `pointermove` 50px right on a 1000px
  wrapper; assert `--pane-size` advanced by ≈5%; `aria-valuenow` updated.
- **`pointerup-clears-dragging`**: after `pointerup`, `data-dragging` is absent.
- **`drag-clamp-at-max`**: move far beyond max; assert `--pane-size` does not exceed `data-max`.
- **`drag-clamp-at-min`**: move far past min; assert `--pane-size` does not drop below `data-min`.

### focus
- **`separator-is-tab-reachable`**: assert `tabindex="0"` on every separator; Tab from a preceding
  element brings focus to the separator (jsdom tab-order simulation).
- **`no-focus-trap`**: Tab from the separator moves focus OUT of the component to the next element;
  there is no trap (assert the next `document.activeElement` is not another separator).
- **`two-separators-both-reachable`**: in a three-pane layout, Tab visits separator 0, then separator 1,
  then exits.

### wire-resize-end integration
- **`wireResizeEnd-fires-on-pointerup`**: with `wireResizeEnd="saveSplit"`, simulate a drag then
  `pointerup`; assert the wire action `saveSplit` was called (mock the runtime wire-call surface) with a
  payload containing the final sizes array.
- **`wireResizeEnd-fires-on-keyboard-blur`**: keyboard-resize then blur the separator; assert the wire
  action fired once (debounced, not on every key).

### persistence
- **`persist-reads-from-localstorage-on-mount`**: set `localStorage["my-split"] = "[60,40]"`;
  mount with `persistKey="my-split"` and `initialSizes=[40,60]`; after enhancer mount, assert pane 0
  has `--pane-size: 60%` (stored value wins over `initialSizes`).
- **`persist-writes-to-localstorage-on-pointerup`**: drag + `pointerup`; assert `localStorage["my-split"]`
  was written with the new sizes.
- **`persist-invalid-stored-value-falls-back`**: corrupt `localStorage["my-split"] = "not-json"`;
  mount; assert `initialSizes` is used (graceful fallback, no throw).

### variants
- **`horizontal-wrapper-has-flex-row`**: direction=horizontal wrapper has `flex-row` or equivalent token
  class.
- **`vertical-wrapper-has-flex-col`**: direction=vertical wrapper has `flex-col` or equivalent.

### JTE compile + render
- Covered by the `test/jte-compile` real-compiler + render gate (existing infrastructure).

### escaping
- `attrs` is trusted-only and documented as STATIC; there is no per-row DB value on a layout shell,
  so the XSS escaping test is not the primary concern here. However: `splitLabels` and `paneLabels`
  values coming from a controller model go through `Escape.htmlAttribute` in the `aria-label` emission —
  `splitLabels=["\">|<script>"]` renders inert (assert the attribute value is HTML-escaped).

### Playwright (gesture fidelity, legacy-VM oracle)
- **`real-drag-resizes-panes`**: real `page.mouse.move` drag on the separator; assert the left pane's
  visible width changed and `aria-valuenow` on the separator reflects the new size.
- **`real-keyboard-resize`**: `page.keyboard.press("ArrowRight")` on focused separator; assert
  `aria-valuenow` incremented; the pane is visually wider.
- **`real-enter-collapses`**: press Enter on a collapsible separator; assert the pane collapses to its
  minimum width and the separator shows the restore indicator.

## 8. Non-goals / anti-patterns

- **No WIRE round-trip during drag**: the APG and UX both demand fluid resize; a wire call per pixel of
  drag is not implemented. Persistence is via `localStorage` + a single wire action on commit.
- **No F6 cycle-panes**: F6 is an optional APG key meant for IDE-grade window managers; a gestionale
  split layout is not that. Omitting it is intentional and APG-compliant ("optional").
- **Not a layout system**: resizable-panes governs ONE split (or nested splits via composition, see
  below), not a full grid/flexbox replacement. For complex dashboards, compose multiple instances.
- **No virtualization enhancer**: the component does not virtualize pane content; that is the
  `data-grid.enhancer.ts` concern for the pane that needs it.
- **No iframe pointer-capture workaround is the adopter's problem**: the enhancer calls
  `setPointerCapture` on `pointerdown` (the platform solution), which is sufficient for same-origin
  iframes; cross-origin iframes require overlay divs during drag — that is out of scope for this spec.
- **Not a tab panel**: resizable panes is a layout primitive, not a tab UI. The panes are always
  rendered and visible (or collapsed). For show/hide panel switching use `tabs` or `accordion`.
- **No right-to-left (RTL) layout flip**: RTL is deferred; `ArrowLeft`/`ArrowRight` semantics remain
  directional (not logical). Add as a follow-on when RTL support is scoped.
- **No animation on drag**: the pane resize is instantaneous on drag (CSS transitions disabled during
  drag via `data-dragging` selector); animation is only on the separator hover state. Smooth-interpolated
  drag would require `requestAnimationFrame` batching, deferred to a performance follow-on if needed.
- **Nested resizable panes**: the component is composable — an adopter nests a `resizable-panes` partial
  inside a pane of an outer `resizable-panes`. Each instance has its own enhancer, keyed by its own
  wrapper root. This is SUPPORTED by the architecture (one enhancer per wrapper root), but not a single
  special variant.
