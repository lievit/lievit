<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — sheet (drawer variant with structured header + footer, WIRE + focus-trap + popover seam)

- **tier**: WIRE + ENH (`focus-trap.enhancer.ts` — the shared trap, NOT a hand-roll — + the popover/overlay seam)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of the existing `registry/jte/sheet.jte` / drawer variant in kit)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Dialog (modal) — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ — the
      sheet is the APG drawer variant of the Dialog pattern: `role="dialog" aria-modal="true"`, same focus
      trap + Esc + Tab-cycle semantics, positioned at a viewport edge instead of centered.
      **react-aria `useDialog` / `FocusScope`** as the interaction-model pattern reference (the focus
      order, trap, restore, and Esc wiring, transcribed into ORIGINAL template + the shared
      `focus-trap.enhancer.ts`; no react-aria source copied).
    - inventory: Ant Design Drawer as inventory reference (side variants, nested sheets, header/footer
      structure, closable, placement, sizes, push-body optional); shadcn/ui Sheet as styling reference
      for the header+footer composition (the "Sheet" name specifically encodes that structure); Tailwind
      UI slide-over as visual-polish reference. All INSPIRATION-ONLY, output is original.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI slide-over
      (NO code copied).

---

## 1. What it is

A sheet is a modal overlay panel that slides in from a viewport edge (left, right, top, or bottom) and
exposes a structured surface with a **header** (title + optional subtitle + close button), a scrollable
**body**, and an optional **footer** (action buttons). It is the "drawer with a mandatory header+footer
contract" — the distinction from `drawer` (which is a freer WIRE overlay) is that sheet OWNS a
header+body+footer template structure, making it the right choice when the adopter needs a canonical
"open a side panel with an action bar" pattern without composing the structure manually.

OPEN-STATE is a server fact (`@Wire boolean open`). BODY + HEADER + FOOTER are OWNED server-rendered
template markup (not `<slot>` / `Content` — the bug class the pivot killed). WIRE because every state
change (open, step inside a multi-step sheet) is a server decision and the content is server-rendered
data. The irreducible CLIENT behavior — focus trap while open, focus restore on close, Esc to close,
scrim click to close, the slide-in animation — is the shared `focus-trap.enhancer.ts` + the
popover/overlay seam. This component is the canonical S1 consumer of the dialog exemplar's shared
mechanisms; it adds only the edge-placement dimension.

Server-first works for a sheet for the same reason it works for dialog: the panel body is data driven
by the server (a selected record, a form, a step payload); the client only morphs the already-rendered
panel into the live DOM and manages focus + animation.

---

## 2. API — the WIRE surface + template params

**Java (`SheetComponent`)**:

| member | kind | meaning |
|---|---|---|
| `open` `boolean` | `@Wire` | the open-state (the SINGLE piece of overlay state; everything else is derived from this) |
| `title` `String` | `@Wire @LievitProperty(locked=true)` | the accessible name rendered in the header; mapped to `aria-labelledby`; REQUIRED |
| `subtitle` `String` | `@Wire @LievitProperty(locked=true)` | optional secondary line in the header; `null` = omitted |
| `placement` `String` | `@Wire @LievitProperty(locked=true)` | `right` \| `left` \| `top` \| `bottom` — which edge the sheet slides from; default `right` |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `sm` \| `md` \| `lg` \| `xl` \| `full` — panel width (for `right`/`left`) or height (for `top`/`bottom`); default `md` |
| `closable` `boolean` | `@Wire @LievitProperty(locked=true)` | shows the X close button + allows Esc and scrim click to close; `false` = the adopter controls close via explicit footer actions; default `true` |
| `hasFooter` `boolean` | `@Wire @LievitProperty(locked=true)` | whether the footer region is rendered; default `true`; set `false` for read-only/informational sheets with no action bar |
| `scrollBody` `boolean` | `@Wire @LievitProperty(locked=true)` | when `true` (default), the body scrolls independently and header+footer are sticky; when `false`, the whole sheet scrolls as one |
| `openSheet()` | `@LievitAction` | sets `open = true`; the action validates caller authz before mutating |
| `close()` | `@LievitAction` | sets `open = false`; is a no-op (enforced in the action body) when `!closable` and the call originates from the Esc/scrim path |
| (header body) | OWNED template markup | the title + subtitle + close button rendered in the header region |
| (body content) | OWNED template markup | the scrollable body; the adopter copies + edits the template (server-first refactor blueprint §1.b) |
| (footer content) | OWNED template markup | the action buttons wired via `l:click`; rendered only when `hasFooter=true` |

**Template params** (one `@param` per `@Wire` field + the WIRE pair):

| param | type | meaning |
|---|---|---|
| `open` | `boolean` | renders the sheet panel or hides it entirely (`hidden` / absent) |
| `title` | `String` | header title text; also the `id` source for `aria-labelledby` |
| `subtitle` | `String` | optional subtitle in the header; null-guarded in template |
| `placement` | `String` | data-placement attribute + CSS modifier class for the slide direction |
| `size` | `String` | data-size attribute + CSS modifier for the panel dimension |
| `closable` | `boolean` | whether the close button is rendered + `data-closable` on root for the enhancer |
| `hasFooter` | `boolean` | whether the footer region is rendered |
| `scrollBody` | `boolean` | adds a modifier class that makes body `overflow-y-auto` and header/footer `sticky` |
| `_component` | `ComponentMetadata` | wire metadata (snapshot, FQN, cid); stamped on root by the template |

No `Content` slot exists — WIRE components have owned markup, never a `gg.jte.Content` child
(server-first refactor blueprint §1.b, verified in the dialog exemplar).

---

## 3. Variants / sizes / states

### Placement variants

| value | meaning | slide direction |
|---|---|---|
| `right` (default) | panel slides in from the right edge | `translateX(100%)` → `translateX(0)` |
| `left` | panel slides in from the left edge | `translateX(-100%)` → `translateX(0)` |
| `top` | panel slides in from the top edge | `translateY(-100%)` → `translateY(0)` |
| `bottom` | panel slides in from the bottom edge | `translateY(100%)` → `translateY(0)` |

The placement maps to `data-placement="right|left|top|bottom"` on the root element; Tailwind
variant modifiers (`data-[placement=right]:…`) or a CSS custom-property switch drives the
directional position tokens. No extra `variant` param (placement IS the variant axis here).

### Size

`sm | md | lg | xl | full` — width for `right`/`left` placement, height for `top`/`bottom`.
Maps to `data-size` on the root.

| value | right/left width | top/bottom height |
|---|---|---|
| `sm` | `var(--lv-sheet-width-sm)` (320px baseline) | `var(--lv-sheet-height-sm)` (240px baseline) |
| `md` (default) | `var(--lv-sheet-width-md)` (480px baseline) | `var(--lv-sheet-height-md)` (360px baseline) |
| `lg` | `var(--lv-sheet-width-lg)` (640px baseline) | `var(--lv-sheet-height-lg)` (480px baseline) |
| `xl` | `var(--lv-sheet-width-xl)` (800px baseline) | `var(--lv-sheet-height-xl)` (600px baseline) |
| `full` | 100vw | 100vh |

On mobile viewports (`< --lv-breakpoint-sm`) all placements collapse to `bottom` at full width
and `md` height; this is a CSS-only responsive rule, no JS needed.

### States

| state | how reflected |
|---|---|
| `open=false` | panel is absent from the DOM (rendered with `hidden` or JTE boolean-conditional entirely); scrim absent; focus trap inactive |
| `open=true` | panel rendered; scrim present with `aria-hidden="true"`; `focus-trap` enhancer active |
| `closable=false` | no X button in header; enhancer ignores Esc and scrim-click (reads `data-closable="false"` on root) |
| `aria-busy` | runtime sets `aria-busy="true"` on the panel root during a wire round-trip; the adopter's footer spinner reacts to it |
| `hasFooter=false` | footer region absent from the DOM; body expands to fill |
| `scrollBody=true` | body region has `overflow-y-auto`; header and footer are `sticky` within the panel |

---

## 4. The a11y contract (the heart — non-negotiable, fully specified)

- **WAI-ARIA pattern**: APG Dialog (Modal), drawer/sheet variant.
  Canonical source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
  The sheet is a positional variant of the modal dialog: same `role="dialog" aria-modal="true"`,
  same focus trap, same Tab-cycle within panel, same Esc-to-close, same focus restoration.
  The difference is visual (edge-anchored panel vs centered) and template-structural
  (mandatory header+body+footer regions); the a11y contract is identical to APG Dialog.

- **roles + ARIA**:

  | element | role / attribute | value | who sets it |
  |---|---|---|---|
  | panel root (`<div>`) | `role` | `"dialog"` | template (server-rendered) |
  | panel root | `aria-modal` | `"true"` | template |
  | panel root | `aria-labelledby` | `"<titleId>"` — the `id` of the `<h2>` title element | template |
  | panel root | `aria-describedby` | `"<subtitleId>"` when subtitle present | template |
  | panel root | `aria-busy` | `"true"` during wire round-trip | runtime (lifecycle hook) |
  | `data-slot="sheet"` on root | — | for test targeting + CSS | template |
  | `data-placement` | — | `right\|left\|top\|bottom` | template (from `placement` param) |
  | `data-size` | — | `sm\|md\|lg\|xl\|full` | template (from `size` param) |
  | `data-closable` | — | `"true"\|"false"` | template (from `closable` param); the enhancer reads this |
  | `data-variant` | — | `"default"` (only one variant axis is placement; kept for consistency) | template |
  | title `<h2>` | `id` | `"<cid>-title"` | template; must match `aria-labelledby` |
  | subtitle `<p>` | `id` | `"<cid>-subtitle"` | template; must match `aria-describedby` when present |
  | close button | real `<button>` | `aria-label="Close"` (icon-only → label mandatory, the button rule) | template |
  | scrim (`<div>`) | `aria-hidden` | `"true"` (not a meaningful content region) | template |
  | background content | nothing extra needed | `aria-modal="true"` on the panel causes AT to ignore background when supported; the scrim is a visual affordance | template |

  When `open=false`, the ENTIRE sheet subtree (scrim + panel) is absent from the DOM — not
  just hidden with CSS. This removes both from the accessibility tree and from Tab order without
  any `inert` attribute or `display:none` management. The JTE boolean-conditional (`!{open}`)
  renders nothing when closed, exactly as dialog does.

- **keyboard map** (the COMPLETE APG table + focus-trap extensions):

  | key | action | who supplies it |
  |---|---|---|
  | `Tab` | Moves focus to the NEXT tabbable element WITHIN the panel. When focus is on the last tabbable element, wraps to the first tabbable element inside the panel. Focus never leaves the panel while open. | `focus-trap.enhancer.ts` |
  | `Shift + Tab` | Moves focus to the PREVIOUS tabbable element WITHIN the panel. When focus is on the first tabbable element, wraps to the last tabbable element inside the panel. | `focus-trap.enhancer.ts` |
  | `Escape` | Closes the sheet (fires the `close()` wire action) when `closable=true`. Is inert when `closable=false`. | `focus-trap.enhancer.ts` (reads `data-closable` before firing) |
  | `Enter` / `Space` on the close button | Fires the close button (native `<button>` → activates → fires `l:click="close"`). | Platform (native `<button>`) |
  | `Enter` / `Space` on footer buttons | Activate the wired action on that button (whatever the adopter has wired). | Platform (native `<button>`) |
  | `Tab` / `Shift+Tab` outside the sheet (while open) | PREVENTED — the focus trap intercepts all Tab events. Focus does not reach background elements while the sheet is open. | `focus-trap.enhancer.ts` |

  Source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ keyboard interaction section.
  The three APG-mandated keys (Tab, Shift+Tab, Escape) are listed above verbatim. The enhancer
  must implement all three; any additional navigation (scrolling within the body) is handled by
  the platform's native scroll behavior.

- **focus management** (the load-bearing part — all owned by `focus-trap.enhancer.ts`):

  - **Initial focus on open**: when the panel is rendered and morphed into the DOM, the enhancer
    receives the `onComponentInit` lifecycle call. It then determines initial focus in this order:
    1. An element with `data-autofocus` inside the panel (allows the adopter to declare intent).
    2. The first focusable interactive element in the panel body (a form field, a link, a button).
    3. The close button (when `closable=true`), as a safe fallback.
    4. The panel root itself (`tabindex="-1"` on the root, `focus()` called) as the last resort
       for informational sheets with no interactive elements.
    This ordering matches the react-aria `FocusScope` autofocus and `contain` behavior.

  - **Focus trap**: while `open=true`, the enhancer listens to `keydown` (Tab / Shift+Tab) on the
    document and redirects focus to stay within the panel. Concretely: it queries all tabbable
    elements inside the panel (`[tabindex]:not([tabindex="-1"]), button:not([disabled]), a[href], input, select, textarea`) at focus-change time (NOT cached at mount, because the server morph may add/remove elements mid-session), wraps at both ends.

  - **Focus restore on close**: before attaching the focus trap, the enhancer records
    `document.activeElement` (the opener element). When the close wire action fires and the panel
    morphs away, the enhancer restores focus to that recorded element. If the opener is gone from
    the DOM (e.g. the row that triggered the sheet was removed by the same action), focus falls to
    `document.body`.

  - **Body scroll lock**: while `open=true`, the enhancer adds a CSS class to `<body>` (e.g.
    `lv-body-locked`) that sets `overflow: hidden` via a pre-authored CSS rule. The rule lives in
    the lievit token stylesheet, not in an inline `style` attribute (which would violate CSP's
    no-inline-style directive). Removed on close.

  - **Scroll position preserve**: the body scroll lock is applied AFTER recording `document.body.scrollTop`
    and restored BEFORE removing the lock, so the page does not jump.

- **live region**: none. The sheet is not a status announcer. If an action inside the sheet
  produces a success/error status, the caller composes a `toast` (which uses `role=status`) AFTER
  close, not inside the sheet.

- **shared mechanisms composed** (the single-source-a11y rule — do NOT hand-roll these):
  - `focus-trap.enhancer.ts` — initial focus + trap + restore + body scroll lock + Esc handling.
    Parameterised with `closable` (read from `data-closable`). The dialog exemplar's enhancer is
    reused byte-for-byte: sheet is a positional variation, not a behavioral one.
  - The **popover/overlay seam** — the rendering conditional (panel present/absent) + the scrim
    backdrop. The sheet does NOT use the native `popover` attribute (that is for non-modal
    anchored popovers); it uses the overlay seam's full-viewport variant (same as dialog).

---

## 5. Tokens

### Consumed (existing token system)

| token | usage |
|---|---|
| `--lv-color-overlay` | scrim background (`oklch(…)` with alpha) |
| `--lv-color-popover` | panel background (the surface token for overlaid content) |
| `--lv-color-popover-fg` | panel text colour |
| `--lv-color-border` | header / footer separator lines |
| `--lv-color-muted` | subtitle text colour |
| `--lv-color-fg` | title + body text colour |
| `--lv-color-accent` | close button hover background (ghost-style) |
| `--lv-shadow-xl` | panel drop-shadow (the elevation token for top-level overlays) |
| `--lv-z-overlay` | scrim z-index |
| `--lv-z-modal` | panel z-index (above scrim) |
| `--lv-space-4` | header padding (y) |
| `--lv-space-6` | header padding (x) + body padding |
| `--lv-space-2` | subtitle margin-top |
| `--lv-radius-lg` | panel corner radii on the inward-facing edges (e.g. `right` placement: top-left + bottom-left radii) |
| `--lv-ring` | focus-visible ring on the panel root (when focused via `tabindex="-1"`) |
| `--lv-font-sans` | panel typography |
| `--lv-text-base` | body text size |
| `--lv-text-lg` | title text size |
| `--lv-text-sm` | subtitle text size |
| `--lv-font-semibold` | title font weight |
| `--lv-motion-duration-md` | slide-in / slide-out animation duration |
| `--lv-motion-ease-out` | slide-in easing |
| `--lv-motion-ease-in` | slide-out easing |

### Net-new tokens (additive, proposed — no literal colour ever)

| token | proposed value (`:root`) | dark block | justification |
|---|---|---|---|
| `--lv-sheet-width-sm` | `20rem` (320px) | same | panel dimension token; structural, theme-invariant |
| `--lv-sheet-width-md` | `30rem` (480px) | same | |
| `--lv-sheet-width-lg` | `40rem` (640px) | same | |
| `--lv-sheet-width-xl` | `50rem` (800px) | same | |
| `--lv-sheet-height-sm` | `15rem` (240px) | same | for top/bottom placements |
| `--lv-sheet-height-md` | `22.5rem` (360px) | same | |
| `--lv-sheet-height-lg` | `30rem` (480px) | same | |
| `--lv-sheet-height-xl` | `37.5rem` (600px) | same | |
| `--lv-sheet-header-height` | `var(--lv-space-16)` (64px) | same | sticky header height; keeps body padding math in one place |
| `--lv-sheet-footer-height` | `var(--lv-space-16)` (64px) | same | sticky footer height |

These tokens are structural (spacing/dimension), NOT colour. They require no dark-mode repeat
(architecture contract §4: structural tokens are theme-invariant). They are additive: no existing
token is redefined. They extend the `--lv-sheet-*` namespace; any adopter retheme overrides these
two families at `:root`.

---

## 6. Wire actions + enhancer integration

### l:* directive surface (the template binds these)

| element | directive | meaning |
|---|---|---|
| trigger (in the calling template, outside the sheet) | `l:click="openSheet"` | fires `openSheet()` which sets `open=true`; the sheet re-renders with the panel |
| close button inside header | `l:click="close"` | fires `close()` which sets `open=false`; panel morphs away |
| scrim element | `l:click="close"` (conditioned on `closable`) | fires `close()` on scrim click; the template renders this binding only when `closable=true` |
| footer action buttons | `l:click="<adopter action>"` | each footer button wires its own action (e.g. `l:click="save"`, `l:click="cancel"`); these are OWNED markup, named by the adopter |
| panel root | `data-lievit-component`, `data-lievit-id`, `data-lievit-snapshot` | the WIRE root attributes stamped by the template on mount; the runtime and the enhancer read them |

### Round-trip flow (the causal chain)

```
1. Trigger (outside sheet) → l:click="openSheet"
   → POST /lievit/{cid}/call {action:"openSheet", snapshot:…}
   → Java: openSheet() sets open=true
   → server re-renders: panel HTML present, scrim present
   → response: text/html + rotated Lievit-Snapshot header
   → client morph: panel inserted into live DOM (identity-preserving)
   → focus-trap enhancer onComponentInit: records opener, determines initial focus, moves focus, activates trap, locks body scroll

2. User interacts inside the sheet (Tab/arrow/type — no round-trip for navigation)

3. Close path A — close button or Esc:
   → close() wire action OR enhancer fires close() on Esc
   → POST /lievit/{cid}/call {action:"close", snapshot:…}
   → Java: close() sets open=false (no-op if !closable)
   → server re-renders: no panel, no scrim
   → client morph: panel removed from DOM
   → enhancer onComponentDestroy (or mutation observer): restores focus to opener, unlocks body scroll

4. Close path B — scrim click (when closable=true):
   → same as close path A (the scrim l:click="close" directive fires the same action)

5. Footer action (e.g. save):
   → l:click="save" fires save() wire action
   → Java: save() persists, may set open=false or leave open for validation errors
   → re-render: either closed panel or panel with error state
   → morph: panel updates (or disappears); enhancer restores focus to opener if panel gone
```

### Enhancer responsibilities (`focus-trap.enhancer.ts`, parameterised for sheet)

The sheet composes the SAME enhancer as dialog. The enhancer is NOT copied or specialized; it is
parameterised via data attributes that the sheet template stamps:

| data attribute | value set by template | enhancer reads |
|---|---|---|
| `data-closable` | `"true"` or `"false"` | whether to close on Esc and whether to wire the scrim-click |
| `data-initial-focus` | `"<selector>"` (optional, set via `data-autofocus` on a child) | which child to focus on open |
| `data-lievit-component` | the FQN | how the enhancer fires the close wire action (constructs the POST) |
| `data-lievit-snapshot` | signed snapshot | the round-trip payload |

The enhancer's registration is via the lievit runtime's lifecycle registry (`onComponentInit` /
`onComponentDestroy`), NOT by a `l:` directive (because it manages document-level Tab events, not
a single element event). This is the same pattern the dialog exemplar's enhancer uses.

The enhancer does NOT close the sheet client-only. Esc fires the `close()` wire action (a round-trip
to Java); the server owns `open`, and the client only patches. The enhancer manages focus/scroll in
the brief interval between the round-trip POST and the morph completing.

---

## 7. Acceptance tests (the gate — refute-by-default)

The component is DONE only when ALL of the following pass on a REAL substrate. A mocked `$lievit`
runtime, a mocked focus-trap, or a mocked scrim is NOT a valid substrate for any of these tests.
(This constraint is the client-island-fidelity lesson encoded as a hard rule: the calendar
slide-over shipped empty because the test ran on a fake substrate.)

### Render tests (real `LievitRuntime` + jsdom, REAL `focus-trap.enhancer.ts` mounted)

- **`sheet renders panel when open=true`**: open the sheet, assert the panel element is present in
  the DOM with `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the title `id`;
  assert the title text is visible; assert the BODY content is VISIBLE (the projection assertion —
  the null-slot lesson: server-rendered markup MUST appear); assert the footer is present when
  `hasFooter=true`.
- **`sheet panel is absent when open=false`**: render with `open=false`, assert NO element with
  `role="dialog"` exists in the DOM and no scrim is present.
- **`sheet renders all four placement variants`**: render each of `right`, `left`, `top`, `bottom`
  and assert the panel carries the correct `data-placement` attribute.
- **`sheet renders all five sizes`**: render each of `sm`, `md`, `lg`, `xl`, `full` and assert
  the correct `data-size` attribute; the panel dimension is driven by the net-new width/height token.
- **`sheet omits close button when closable=false`**: render with `closable=false`, assert no
  element with `aria-label="Close"` is in the DOM.
- **`sheet omits footer when hasFooter=false`**: render with `hasFooter=false`, assert the footer
  slot element is absent; assert the body element fills the remaining space (has the expanded class).
- **`sheet title links aria-labelledby`**: assert the panel's `aria-labelledby` value equals the
  title element's `id` (`"<cid>-title"`).
- **`sheet subtitle links aria-describedby when present`**: render with `subtitle` set, assert
  `aria-describedby` on panel equals `"<cid>-subtitle"`.
- **`sheet omits aria-describedby when subtitle absent`**: render without `subtitle`, assert no
  `aria-describedby` attribute on the panel.

### axe-core assertions (zero violations on the open panel DOM)

- **`sheet passes axe on open panel (right placement, md size)`**: run axe-core on the open panel
  DOM, assert ZERO violations of: `aria-dialog-name` (panel has an accessible name), `button-name`
  (close button has `aria-label`), `aria-allowed-attr` (no invalid aria on any element).
- **`sheet passes axe on all four placements`**: run axe on each placement variant open panel.
- **`sheet fails axe when title is empty`** (negative case): render with `title=""`, assert axe
  REPORTS an `aria-dialog-name` violation (the gate correctly detects an accessible-name gap).

### Keyboard tests (assert the COMPLETE APG §4 map, each key asserted individually)

- **`Tab cycles focus within the panel`**: open the sheet; the panel has at minimum a close button
  and one footer button; press Tab repeatedly; assert focus never leaves the panel (no background
  element receives focus); assert focus cycles from the last tabbable back to the first.
- **`Shift+Tab cycles focus backward within the panel`**: same setup; press Shift+Tab; assert
  backward cycle with wrap.
- **`Escape closes the sheet when closable=true`**: open the sheet; press Escape; assert the
  `close()` wire action is fired (assert the POST to `/lievit/{cid}/call` with
  `{action:"close"}` was dispatched OR assert the panel is absent after the morph from the
  wire round-trip IT).
- **`Escape is inert when closable=false`**: open the sheet with `closable=false`; press Escape;
  assert the panel remains in the DOM and no close action is dispatched.
- **`Tab does not reach background elements`**: render background interactive elements (a `<button>`
  outside the sheet); open the sheet; Tab through all panel elements; assert the background button
  is NEVER focused.
- **`Enter on close button fires close`**: open the sheet; focus the close button; press Enter;
  assert the `close()` action fires.

### Focus management tests

- **`initial focus lands on first focusable body element`**: open a sheet whose body contains a
  text `<input>`; assert that `document.activeElement` is that input after the morph.
- **`initial focus lands on close button when body has no focusable elements`**: open a sheet
  whose body is purely display text; assert `document.activeElement` is the close button.
- **`data-autofocus overrides initial focus`**: open a sheet whose body contains a `<textarea>`
  with `data-autofocus`; assert `document.activeElement` is the textarea (not the first focusable
  or the close button).
- **`focus returns to opener on close`**: record the opener `<button>` before opening; close the
  sheet; assert `document.activeElement` is the opener button.
- **`body scroll lock applied on open`**: open the sheet; assert `document.body` has the
  `lv-body-locked` class (which sets `overflow: hidden`).
- **`body scroll lock removed on close`**: close the sheet; assert `document.body` does NOT have
  `lv-body-locked`.

### Variants / sizes (data attribute contract)

- **`each size emits correct data-size`**: parameterised over `sm|md|lg|xl|full`; assert the panel
  root carries `data-size="<value>"`.
- **`each placement emits correct data-placement`**: parameterised over `right|left|top|bottom`;
  assert `data-placement="<value>"`.

### Wire round-trip IT (lievit-kit, real runtime, the CollapsibleComponentIT pattern)

- **`openSheet action renders panel in DOM`**: mount the `SheetComponent` with `open=false`;
  fire `openSheet()`; assert the re-rendered DOM has a panel with `role="dialog"` and the
  expected body content.
- **`close action removes panel from DOM`**: mount with `open=true`; fire `close()`; assert the
  re-rendered DOM has NO panel element.
- **`close is no-op when closable=false`**: mount with `open=true, closable=false`; fire `close()`
  (simulating an Esc-triggered close); assert the panel is STILL in the DOM (the action guards
  `closable`).

### Playwright gesture tests (real browser, legacy-VM oracle — the fidelity gate)

- **`real scrim click closes sheet`**: navigate to a page that contains a sheet trigger; click the
  trigger; assert the panel body shows resolved server-rendered fields (not a blank body — the
  projection assertion); click the scrim; assert the panel is gone from the DOM and focus is on
  the trigger.
- **`real Esc closes sheet`**: open the sheet via click; press Escape; assert panel gone, focus
  on trigger.
- **`Tab cannot reach background`**: open the sheet; Tab through all focusable elements; assert
  via `page.evaluate` that `document.activeElement` never equals a background element.
- **`right/left/top/bottom placement renders visually at correct edge`**: a screenshot-based or
  bounding-rect assertion: panel bounding rect touches the correct viewport edge.

### JTE compile + render gate

- **`sheet.jte compiles without error`**: covered by the existing `test/jte-compile` real-compiler
  gate; the sheet template is registered with the gate's component list.

---

## 8. Non-goals / anti-patterns

- **NO hand-rolled focus trap.** The `focus-trap.enhancer.ts` is the SINGLE source for modal focus
  management in this library. Sheet is a consumer of that enhancer, not a re-implementation. Any
  inline JS or second copy of focus-cycling logic is the precise failure mode the single-source-a11y
  rule prevents.
- **NO `<slot>` / `Content` for the body.** The body is OWNED server-rendered markup in the copied
  template. A `gg.jte.Content` slot was the root cause of the slide-over empty-body bug: a JTE
  `<slot>` that does not fill is invisible, and the test passes because the fake substrate does not
  morph. The rule is absolute for WIRE overlays.
- **NO client-only close.** Closing the sheet (Esc, scrim click, X button, footer Cancel) ALWAYS
  fires the `close()` wire action. The server owns `open`; the client never sets it client-side.
  The enhancer fires the action and manages focus in the interim; it does not toggle a CSS class
  or remove the DOM node itself.
- **NO `display: none` / `visibility: hidden` for the closed state.** When `open=false`, the panel
  is absent from the JTE conditional output entirely. CSS-only show/hide leaves the panel in the
  DOM and in the a11y tree; users with assistive technology would encounter a hidden dialog.
- **NO inline `<script>` or `on*=` attributes.** CSP `script-src 'self'` refuses them silently.
  All behavior enters via the enhancer (registered in the lievit runtime bundle) or via `l:*`
  directives. The silent-slot / CSP-script dual lesson.
- **NO duplicate `aria-modal` management on background elements.** The `aria-modal="true"` on the
  panel signals to modern AT that background content is inert. Do not additionally set `inert` on
  the background or `aria-hidden` on body children — this creates maintenance burden and can break
  AT that uses different heuristics. The focus trap is the behavioral safeguard; `aria-modal` is the
  semantic one.
- **NOT a replacement for `dialog` when no header+footer structure is needed.** If the adopter needs
  a simple overlay with no required structural contract, they compose `drawer`. The sheet's value
  proposition is the HEADER+BODY+FOOTER owned-template structure; use `drawer` for freeform overlays.
- **NOT a non-modal side panel.** If the use case is a persistent side panel that does not trap focus
  (e.g. a details inspector alongside a list), `drawer` with `modal=false` (or a layout column) is
  correct. Sheet is always modal (focus-trapped, scrim-backed); non-modal drawers are a separate
  concern.
- **NO direct Turbo Stream usage.** Delivery boundary is locked (ADR-0086): page navigation = Turbo
  Drive; per-component DOM morph = lievit own runtime. The sheet is NOT a Turbo Stream component.

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH) tokens. Read the public APG Dialog pattern
(https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), react-aria `useDialog` / `FocusScope`
interaction spec, and Ant Design Drawer + shadcn Sheet feature set as PATTERN REFERENCES for a11y
semantics, inventory, and look. NEVER paste literal source from react-aria / ant-design / shadcn /
Tailwind UI (the one bright line, `02-licensing.md`) — generate original code.

Compose `focus-trap.enhancer.ts` and the popover/overlay seam — do NOT hand-roll focus trapping,
scroll lock, or body-inert management. The dialog exemplar (`specs/dialog.md`) is the reference
for how to compose both mechanisms; sheet is a positional variation (same enhancer, same seam,
new placement + size dimensions + header+body+footer structure).

The panel body is OWNED template markup, NOT a `Content` slot (WIRE has none — server-first
refactor blueprint §1.b). Render the panel as a JTE boolean-attribute conditional (`!{open}`
renders nothing when false — absent from the DOM, not just hidden).

The render test MUST assert the body is VISIBLE after open (the projection assertion is not
optional — it is the direct lesson from the slide-over empty-body production bug).

The keyboard test MUST cover ALL six rows of the §4 keyboard map individually (Tab, Shift+Tab,
Escape closable, Escape non-closable, Tab-no-background, Enter-on-close-button). Asserting three
of six is the bug-class the "assert the WHOLE contract" rule was written to prevent.

Stamp `data-slot="sheet"`, `data-placement`, `data-size`, `data-closable` on the panel root —
these are the test targets AND the CSS modifier hooks; no element reaches for a hard-coded class
to detect placement.

Net-new tokens (`--lv-sheet-width-*`, `--lv-sheet-height-*`, `--lv-sheet-header-height`,
`--lv-sheet-footer-height`) go into `registry/tokens/lievit-tokens.css` at `:root` (structural,
no dark repeat). Propose values matching the baseline dimensions in §5.

Minimal code to GREEN against the acceptance tests; refactor only while green.
