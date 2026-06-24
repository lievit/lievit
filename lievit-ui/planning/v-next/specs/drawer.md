<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — drawer / slide-over (WIRE + focus-trap + popover seam)

- **tier**: WIRE + ENH (`focus-trap.enhancer.ts` — the shared overlay trap, the same instance dialog uses)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/drawer.jte` / slide-over)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Dialog (Modal) pattern — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ —
      plus the non-modal Dialog variant for `modal=false`; **react-aria `useDialog` / `FocusScope`
      interaction model** as the pattern reference (focus order, trap, restore, Esc, initial-focus
      heuristic — transcribed into ORIGINAL template + the shared `focus-trap` enhancer; no react-aria
      source copied). The drawer is the Dialog pattern rendered to the side of the viewport instead of
      the center; every a11y rule is identical.
    - inventory: Ant Design Drawer as inventory reference (placement, sizes, footer, nested drawers,
      push behaviour, keyboard-closable, mask/scrim optional)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI
      slide-over (NO code copied)

## 1. What it is

A drawer (also called a slide-over or side panel) is a panel that slides in from one edge of the viewport
over the current content. Its OPEN-STATE is a server fact (`@Wire boolean open`) and its BODY is OWNED
server-rendered markup in the copied/owned template — NOT a `Content` slot (WIRE has none; this is the
invariant that killed the slide-over empty-body bug class, architecture contract §6). It is the canonical
SIDE-OVERLAY: it shares the same WAI-ARIA Dialog role, the same `focus-trap` enhancer, and the same
overlay seam as `dialog`, differing only in placement (edge-anchored, not centered), size vocabulary
(width-based for left/right, height-based for top/bottom), and the optional `push` behaviour where the
page content shifts instead of being covered.

WIRE because open/close + the body content are server-driven: the pattern is identical to dialog (gest's
profile, filter panels, and task-detail flows already drive side panels with `l:click`). The irreducible
CLIENT behavior — focus trap while open, focus restore on close, Esc to close, scrim click to close, the
slide transition — is the shared `focus-trap` enhancer, NOT a hand-roll. The dialog spec states the rule:
"drawer/sheet/slide-over reuse the SAME two [mechanisms], parameterised (modal vs non-modal, center vs
side)." This component is the proof that parameterisation works.

Server-first works because the panel body is determined server-side (form fields, record data, action
buttons all driven by a Java model); the client only patches the rendered HTML on morph after each wire
round-trip.

## 2. API — the WIRE surface + template params

**Java (`DrawerComponent`)**:

| member | kind | meaning |
|---|---|---|
| `open` `boolean` | `@Wire` | the open-state; the single piece of overlay state the template reads |
| `title` `String` | `@Wire @LievitProperty(locked=true)` | the panel accessible name (→ `aria-labelledby`); required |
| `placement` `String` | `@Wire @LievitProperty(locked=true)` | `left` \| `right` (default) \| `top` \| `bottom` — the edge the panel slides in from |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `sm` \| `md` (default) \| `lg` \| `xl` \| `full` — panel width (left/right) or height (top/bottom) |
| `modal` `boolean` | `@Wire @LievitProperty(locked=true)` | default `true`; when `false`, renders non-modal (no scrim, no focus trap, page remains interactive — the APG non-modal variant; see §4) |
| `closable` `boolean` | `@Wire @LievitProperty(locked=true)` | default `true`; shows the × button + allows Esc/scrim close; `false` = the user MUST act on the panel content (never closable by escape) |
| `push` `boolean` | `@Wire @LievitProperty(locked=true)` | default `false`; when `true`, the page body shifts by the panel width/height instead of being covered (no scrim in this mode; only valid when `modal=false`) |
| `destroyOnClose` `boolean` | `@Wire @LievitProperty(locked=true)` | default `false`; when `true`, the panel subtree is absent from the DOM when closed (removed, not `hidden`); `false` = it stays in the DOM as `hidden` so the wire component can be triggered without a fresh mount |
| `openDrawer()` | `@LievitAction` | sets `open = true`; the trigger elsewhere fires this |
| `close()` | `@LievitAction` | sets `open = false`; is a no-op (Java guard) when `!closable`; the enhancer fires this action, never closes client-only |
| (body + footer) | OWNED template markup | the server-rendered panel body and optional footer action bar, edited in the copied/owned template; NOT a slot |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param DrawerComponent _instance` (for any derived view the body reads). The body and footer are OWNED
markup in the template body; there is no `gg.jte.Content` slot (WIRE has none — architecture contract
§3.2, server-first refactor blueprint §1.b).

## 3. Variants / sizes / states

**Placement** (the primary structural axis):
- `right` (default): panel slides in from the right edge. The most common gestionale usage (detail panels,
  filter drawers, task forms).
- `left`: slides in from the left edge.
- `top`: slides in from the top edge (notification streams, search overlays). Panel is full-width, `size`
  controls height.
- `bottom`: slides in from the bottom edge (mobile action sheets, confirmation flows).

**Size** (panel dimension perpendicular to the edge):
- For `left`/`right` placement (width-based): `sm` = `--lv-space-drawer-sm` (320px), `md` = `--lv-space-drawer-md`
  (480px, default), `lg` = `--lv-space-drawer-lg` (640px), `xl` = `--lv-space-drawer-xl` (800px),
  `full` = `100vw` (takes the full width, leaves no visible content behind).
- For `top`/`bottom` placement (height-based): same token names resolve to height values
  (`sm`=256px, `md`=384px, `lg`=512px, `xl`=640px, `full`=100dvh).
- Minimum panel size: always at least the viewport dimension if `full`; otherwise respects the token floor
  so content is never clipped on narrow viewports.

**Modal flag**:
- `modal=true` (default): scrim covers the page (`aria-hidden` on page content behind the panel, focus
  trap active, scroll lock active). The standard overlay mode.
- `modal=false`: no scrim, no focus trap, page remains interactive (the non-modal Dialog variant per APG).
  Used for persistent side panels that display context without blocking the user. When combined with
  `push=true`, the page layout shifts to accommodate the panel.

**Push** (layout-shift mode, `modal=false` only):
- `push=false` (default): the panel overlaps the page content.
- `push=true`: the page content area shifts (CSS translate or margin) by the panel size, so the panel
  and the page are both fully visible. Only valid when `modal=false`; when `modal=true`, `push` is
  ignored (a modal overlay always covers).

**Closable flag**:
- `closable=true` (default): the × close button is rendered in the panel header; Esc key and scrim click
  close the panel.
- `closable=false`: no × button; Esc and scrim click are inert. The user must activate a panel action
  (e.g. a Save or Cancel button) to close. The Java `close()` action enforces this: it is a no-op when
  `!closable` (the guard lives in Java, before state mutates, not in the enhancer).

**destroyOnClose flag**:
- `false` (default): the panel subtree is rendered into the DOM with `hidden` when `open=false`. The
  component is always mounted; opening is a wire round-trip that flips `open=true`.
- `true`: the panel subtree is ABSENT from the DOM when `open=false` (JTE boolean-attribute conditional
  renders nothing). Required when the body content is expensive to maintain in the DOM when not needed
  (e.g. a large form with many subcomponents). On open, a full server render of the body is triggered
  by the `openDrawer()` action.

**States**:
- `open` reflected as: panel element present + `aria-modal` (when modal) or absent/`hidden`.
- `disabled` is not a drawer state (the trigger button that opens it carries disabled, not the drawer
  itself).
- `aria-busy` during the wire round-trip (set by the runtime's `beforeCall`/`afterCall` hook, not the
  component — architecture contract §5.c).
- The slide-in / slide-out motion is a CSS transition on the panel's transform (translate from the edge
  to position 0); the class is toggled by the `open` state change in the template. The transition honours
  `prefers-reduced-motion` (the `--lv-motion-reduce` token maps to `transition: none` under that query).

## 4. The a11y contract (the heart — the overlay model, non-negotiable)

**Source**: WAI-ARIA APG Dialog (Modal) pattern,
https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ — verified 2026-06-24.
The drawer IS a Dialog in the ARIA sense; the WAI-ARIA role and all keyboard rules are identical to the
`dialog` spec. The difference is purely visual (placement). Every rule below is sourced from the APG.

**WAI-ARIA pattern**: APG Dialog (Modal) for `modal=true`; APG Dialog (Non-modal) for `modal=false`.

**roles + ARIA**:
- Panel root: `role="dialog"` (both modal and non-modal variants use the same role).
  When `modal=true`, add `aria-modal="true"` to inform assistive technologies that content behind the
  panel is inert; this is the APG-recommended attribute (some older AT rely on it instead of `inert`).
  When `modal=false`, omit `aria-modal` (the panel does not constrain the a11y tree).
- `aria-labelledby="<titleId>"` on the panel root → the panel title element `id="<titleId>"`.
- `aria-describedby` is NOT set by default on semantically rich body content (the APG explicitly notes
  that AT would announce the full body as "a single unbroken string" without structural clarity, which
  is worse than no description; if the adopter has a single-sentence description, they can add it
  via the OWNED body markup as a `<p id="...">` and wire `aria-describedby` in the template — but the
  template does NOT auto-wire it).
- Title: a real heading element (`<h2>` by default, parameterizable to `<h3>` via the `titleLevel`
  template local) carrying `id="<titleId>"`.
- Close button: a real `<button>` with `aria-label="Close"` (icon-only → label is mandatory, the button
  spec rule). Rendered only when `closable=true`.
- Scrim (when `modal=true`): `aria-hidden="true"` on the scrim element; `click` → fires `close()` wire
  action (when `closable=true`). The scrim is NOT a focusable or interactive element in the a11y tree.
- Page content behind the panel (when `modal=true`): marked `inert` (the HTML `inert` attribute, set
  by the `focus-trap` enhancer on the sibling content container while the panel is open; removes the
  behind-content from the a11y tree and tab order entirely — stronger and more reliable than
  `aria-hidden` alone, the modern approach).

**keyboard map** (sourced from APG dialog-modal; verified against the APG page):

| key | does | who |
|---|---|---|
| Tab | Move focus to the NEXT tabbable element inside the panel; at the last tabbable element, WRAP to the first (the trap) | `focus-trap` enhancer (when `modal=true`) / platform (when `modal=false`, Tab leaves the panel naturally) |
| Shift+Tab | Move focus to the PREVIOUS tabbable element inside the panel; at the first tabbable element, WRAP to the last (the trap) | `focus-trap` enhancer (when `modal=true`) / platform (when `modal=false`) |
| Escape | Close the panel when `closable=true` (fires the `close()` wire action); inert when `closable=false` | `focus-trap` enhancer |
| Enter / Space on the × button | Close the panel (same as Esc when closable) | platform (native `<button>`) |
| Enter / Space on footer action buttons | Activate the wired action (save, cancel, etc.) | platform (native `<button>` elements in OWNED footer markup) |

The four APG-specified interactions — Tab, Shift+Tab, Escape (when closable), and initial-focus-on-open
— are fully covered. No other keys are special for this component.

**focus management** (the load-bearing part, owned by `focus-trap.enhancer.ts`):

- **Initial focus (modal=true)**: on open, the `focus-trap` enhancer moves focus INTO the panel.
  Initial-focus heuristic (matching APG context-dependent guidance):
  1. If an element carries `data-autofocus` in the OWNED body markup, that element receives focus.
  2. Otherwise, if a primary action button exists in the footer, focus the close button (× or Cancel)
     to avoid accidental destructive activation — the APG "least destructive option" guidance.
  3. Otherwise, focus the first tabbable element in the panel.
  4. If no tabbable element exists (a display-only panel), focus the panel root itself via
     `tabindex="-1"` (the APG "focus a static element" guidance for semantically complex content).
- **Initial focus (modal=false)**: focus does NOT move automatically on open. The panel appears without
  stealing focus from the page. The user navigates to it with Tab as normal.
- **Trap (modal=true)**: while `open=true`, Tab and Shift+Tab cycle within the panel and cannot land on
  any element outside it. The `inert` attribute on the page content + the trap in the enhancer together
  enforce this. The APG states: "Tab and Shift+Tab do not move focus outside the dialog."
- **No trap (modal=false)**: Tab moves freely across the page. The panel is a non-modal dialog; the
  user can interact with both the panel and the page.
- **Restore on close**: when the panel closes (by any mechanism — Esc, × click, wire action, scrim
  click), the `focus-trap` enhancer restores focus to the element that TRIGGERED the open action. The
  enhancer records the `document.activeElement` at the moment `openDrawer()` fires (just before the
  round-trip). If that element no longer exists in the DOM after close, focus falls back to `document.body`.
- **Scroll lock (modal=true)**: the `focus-trap` enhancer adds a scroll lock on the `<body>` while open
  (via a CSS class that sets `overflow: hidden`; CSP-clean, no inline style). Removed on close.
- **Scroll lock (modal=false)**: no scroll lock; the page remains freely scrollable.

**live region**: none. The drawer is not a status announcer. If the adopter's owned body contains a
success/error message after a wire action, they add the appropriate `role="status"` or `role="alert"` in
the OWNED body markup; the drawer template does not impose a live region.

**screen-reader expectations**: when `open=true`, the panel is announced as "dialog" with its `aria-labelledby`
name. AT reads the title, then the body in source order. When `aria-modal="true"` is set, AT that respect
it will treat the content behind the panel as unavailable (the `inert` attribute also removes it from AT's
virtual cursor). When the panel closes, focus returns to the trigger and AT reads the trigger's label.

**shared mechanisms composed** (do NOT re-implement, do NOT diverge from the dialog spec's instances):
- `focus-trap.enhancer.ts` — initial focus + trap + restore + scroll lock + Esc key + `inert` on page
  content (when modal). The SAME enhancer instance as `dialog`, parameterised by `modal` and `closable`.
- The popover/overlay seam — the rendering infrastructure (CSS layer, `z-index` token, the scrim element,
  the enter/exit transition classes). The same seam as `dialog`, parameterised by `placement` instead of
  `center`.

The `focus-trap` enhancer MUST be the same shared implementation that `dialog` uses. A drawer-specific
fork of the trap logic is the single-source violation the whole architecture prevents.

## 5. Tokens

**Consumed (reads only `var(--lv-*)`, never a literal)**:

| token | role |
|---|---|
| `--lv-color-overlay` | scrim background (semi-transparent, OKLCH with alpha); same as dialog |
| `--lv-color-popover` | panel background surface |
| `--lv-color-popover-fg` | panel foreground (text, icons) |
| `--lv-color-border` | panel edge border / separator between header and body |
| `--lv-color-muted` | muted text in the panel header (subtitle, optional) |
| `--lv-color-fg` | primary text in the panel body |
| `--lv-z-overlay` | z-index for the scrim layer |
| `--lv-z-modal` | z-index for the panel itself (above the scrim) |
| `--lv-shadow-xl` | panel elevation shadow (cast toward the page content) |
| `--lv-radius-lg` | panel corner radius on the inward-facing corners (e.g. left corner-radius for a right-placement panel); the edge-flush corners are `radius-none` |
| `--lv-space-{4,5,6}` | panel header padding, body padding, footer padding |
| `--lv-text-lg` | panel title font size |
| `--lv-font-sans` | panel title font family |
| `--lv-ring` | focus-visible ring on the close button and panel-internal focusables |
| `--lv-motion-slide` | transition duration for the slide-in/out animation (mapped to a CSS `transition` on `transform`) |
| `--lv-motion-reduce` | motion reduction: when the OS requests reduced motion, maps to `transition: none` on the panel |

**NET-NEW tokens (additive, justified, go in `:root` + `.dark` blocks)**:

| token | value (`:root`) | value (`.dark`) | justification |
|---|---|---|---|
| `--lv-space-drawer-sm` | `320px` | (structural, no dark variant) | panel width/height for `size=sm`; not expressible with the existing `--lv-space-*` scale (which tops at padding/gap units, not panel dimensions) |
| `--lv-space-drawer-md` | `480px` | (structural) | panel width/height for `size=md` (default) |
| `--lv-space-drawer-lg` | `640px` | (structural) | panel width/height for `size=lg` |
| `--lv-space-drawer-xl` | `800px` | (structural) | panel width/height for `size=xl` |
| `--lv-motion-slide` | `300ms` | (structural) | slide transition duration; separate from any existing motion token so adopters can tune panel animation independently |

All existing colour tokens (`--lv-color-overlay`, `--lv-z-overlay/modal`, `--lv-shadow-xl`) are reused
verbatim from `dialog`; no new colour tokens are needed. The rebrand surface is unchanged (the ~20-token
adopter seam is not grown by this component).

## 6. Wire / island integration

**Server-rendered JTE structure (the elements and `data-*` hooks)**:

The template renders two root-level elements when `open=true` (or `destroyOnClose=false`, always):

1. **Scrim element** (when `modal=true`):
   ```
   <div data-slot="drawer-scrim"
        class="<overlay z and bg token classes>"
        aria-hidden="true"
        ${open ? "" : "hidden"}
        l:click="close"
        data-lievit-guard="closable">
   </div>
   ```
   The `data-lievit-guard="closable"` is read by the `focus-trap` enhancer: it fires `close()` on scrim
   click only when the Java `closable` field is `true`. The guard value is server-stamped (not client-computed).

2. **Panel element**:
   ```
   <div data-slot="drawer"
        data-placement="${placement}"
        data-size="${size}"
        data-modal="${modal}"
        role="dialog"
        ${modal ? "aria-modal=\"true\"" : ""}
        aria-labelledby="<titleId>"
        ${open ? "" : "hidden"}
        data-lievit-component="<FQN>"
        data-lievit-id="<cid>"
        data-lievit-snapshot="<signed>">

     <!-- Header -->
     <div data-slot="drawer-header">
       <h2 id="<titleId>" data-slot="drawer-title">${title}</h2>
       !{if closable}
       @template.lievit.button(variant="ghost", iconOnly=true, ariaLabel="Close",
                               attrs="l:click=\"close\"", ...)
       !{/if}
     </div>

     <!-- Body (OWNED markup — edited in the copied template) -->
     <div data-slot="drawer-body" ...>
       <!-- adopter's server-rendered content here -->
     </div>

     <!-- Footer (OWNED markup, optional) -->
     <div data-slot="drawer-footer" ...>
       <!-- adopter's action buttons here -->
     </div>
   </div>
   ```

Key structural invariants:
- `data-slot="drawer"` on the panel root (test target + `data-slot` naming convention).
- `data-placement` and `data-size` on the root: CSS `[data-placement="right"]` + `[data-size="md"]`
  selectors drive the position and width/height; avoids Tailwind utility-class fan-out in JTE.
- `data-modal` on the root: the `focus-trap` enhancer reads it to decide whether to activate the trap,
  scroll lock, and `inert` on the page behind.
- `aria-modal` is emitted only when `modal=true` (JTE boolean conditional; the `!{if modal}` block).
- The `hidden` attribute is used for `destroyOnClose=false` (the DOM is present but not visible/a11y-tree-reachable).
  For `destroyOnClose=true`, the entire panel subtree is absent from the template output when `!open`.
- The title element carries `id="<titleId>"` where `<titleId>` is derived from `_component.id()` to
  avoid collisions when multiple drawers coexist in the DOM.
- The panel element carries the three `data-lievit-*` wire root attributes (`component`, `id`, `snapshot`)
  as the wire protocol requires (ADR-0001).

**Typed-TS enhancer responsibilities (`focus-trap.enhancer.ts`, parameterised for the drawer)**:

The enhancer is the SAME shared `focus-trap.enhancer.ts` that `dialog` uses, registered once and
reused by all overlay components. It binds via a lifecycle hook (`onComponentInit` / `onComponentUpdate`)
triggered by the lievit runtime after each morph. The responsibilities for the drawer invocation:

1. **On open** (the `open` attribute transitions from absent/`hidden` to present/visible on the panel):
   - Record `document.activeElement` as the restore target.
   - If `data-modal="true"`: add `inert` to the page content sibling; add scroll-lock class to `<body>`.
   - Apply initial-focus heuristic (§4 focus management): find `[data-autofocus]`, or the close button,
     or the first tabbable element, or fall back to `tabindex="-1"` on the panel root.
   - Activate the Tab/Shift+Tab trap interceptors (when `data-modal="true"`).
   - Register the Escape keydown listener (reads `data-lievit-guard="closable"` before firing `close()`).

2. **On Tab / Shift+Tab** (when `data-modal="true"`):
   - Intercept the keydown event; compute the next/previous tabbable element within the panel subtree.
   - If at the boundary, wrap to the other end. `preventDefault()` on the event.
   - Move DOM focus to the computed target.

3. **On Escape**:
   - Check `[data-lievit-guard="closable"]` on the scrim (or the panel root itself); if truthy, fire the
     `close` wire action via the lievit runtime dispatch (`$lievit.call(cid, 'close', {})`).
   - Is inert (does nothing) when `closable=false`.

4. **On scrim click**:
   - Same guard check as Escape; fire `close` when `closable=true`.

5. **On close** (the `hidden` attribute appears on the panel, or it is removed from the DOM):
   - Remove `inert` from the page content sibling (when `modal=true`).
   - Remove scroll-lock class from `<body>`.
   - Deactivate the trap interceptors.
   - Restore focus to the recorded restore target (`document.activeElement` at open time).
   - If the restore target no longer exists in the DOM, fall back to `document.body`.

The enhancer FIRES the `close` wire action — it does NOT close the panel client-only. The server owns
`open`; closing is always a wire round-trip. The enhancer only manages focus and scroll during the
round-trip delay (the panel stays visually open while the round-trip is in flight; the morph then removes
it — the same model as `dialog`, no special handling needed).

**Wire directive wiring**:
- `l:click="openDrawer"` on the trigger element (always outside the panel, in the page markup that USES
  this WIRE component).
- `l:click="close"` on the close button (via the `attrs` pass-through on the `button` partial inside
  the OWNED header; see the dialog spec §6 for the pattern).
- Footer action buttons fire their own wire actions (`l:click="save"`, `l:click="cancel"`, etc.) in the
  OWNED footer markup.
- The scrim `l:click="close"` is conditional on the Java `closable` flag (see `data-lievit-guard` above;
  the enhancer double-checks before firing to avoid client-side subversion of the Java guard).

**Round-trip flow (right-placement drawer, modal, closable)**:
1. Trigger click → `openDrawer()` → server sets `open=true` → re-renders panel (visible, with body)
   + scrim → morph mounts them → `focus-trap` enhancer fires: records opener, adds `inert` to page,
   locks scroll, moves focus into panel.
2. User interacts with panel body (form fields, buttons — all server-rendered, `l:model`/`l:click` wired).
3. Esc or × click → enhancer fires `close()` wire action → server sets `open=false` → re-renders
   panel as `hidden` (or absent if `destroyOnClose`) → morph hides it → enhancer fires: removes `inert`,
   unlocks scroll, restores focus to opener.

**No Turbo Stream, no Lit, no Alpine**: the component does not emit Turbo Streams and does not use any
framework. The morph is the lievit bespoke morph (ADR-0019). The only client code is the shared
`focus-trap` enhancer, which is a typed-vanilla-TS module, CSP-clean.

## 7. Acceptance tests (the gate — refute-by-default)

The component is DONE only when ALL rows below pass on a REAL substrate. "Fake substrate" is the failure
mode the client-island-fidelity lesson names: a mocked `$lievit` or a jsdom without the real
`LievitRuntime` + `focus-trap` enhancer mounted certifies nothing about the real interaction. Each test
uses the real `LievitRuntime` + real enhancer.

**Render (real `LievitRuntime` + jsdom, real `focus-trap` enhancer mounted)**:

- `drawer_closed_is_hidden_or_absent` — when `open=false` and `destroyOnClose=false`, the panel is
  present in the DOM with `hidden`; it is not in the a11y tree (axe does not traverse it); the scrim is
  also `hidden`. When `destroyOnClose=true`, the panel subtree is absent from the DOM entirely.
- `drawer_open_renders_panel_body_visible` — after `openDrawer()` + morph, the panel is visible (no
  `hidden`), `role=dialog` is present, `aria-labelledby` resolves to the `<h2>` title, the BODY content
  is VISIBLE (the projection assertion — this is the exact bug class the whole WIRE pivot killed; it is
  not optional).
- `drawer_title_renders_as_heading` — the title element carries `id` matching `aria-labelledby`; the
  heading text equals the `title` parameter.
- `drawer_close_removes_panel` — `close()` action sets `open=false`; after morph, the panel is gone/hidden
  and the scrim is gone/hidden.
- `drawer_closable_false_hides_x_button` — when `closable=false`, no `<button aria-label="Close">` is
  present in the rendered panel.
- `drawer_placement_data_attribute` — `data-placement="right"` (and left/top/bottom) is present on the
  panel root for each placement value.
- `drawer_size_data_attribute` — `data-size="md"` (and sm/lg/xl/full) is present on the panel root.
- `drawer_modal_false_omits_aria_modal` — when `modal=false`, `aria-modal` is absent from the panel.
- `drawer_modal_true_emits_aria_modal` — when `modal=true`, `aria-modal="true"` is on the panel root.

**axe-core (real open panel DOM, zero violations)**:

- `drawer_axe_dialog_role_rules` — zero violations for the `aria-dialog-name` rule (panel has accessible
  name via `aria-labelledby`), the `aria-required-attr` rule (no invalid ARIA attributes), and the
  general `wcag2a` + `wcag2aa` ruleset on the open panel.
- `drawer_axe_close_button_accessible_name` — the close button (when closable) has a non-empty accessible
  name (`aria-label="Close"`); the axe `button-name` rule passes.
- `drawer_axe_scrim_is_hidden` — the scrim element has `aria-hidden="true"`; the axe traversal does not
  flag it as an unlabelled interactive element.

**Keyboard (the §4 map — assert the observable outcome on the REAL enhancer)**:

- `drawer_tab_traps_within_panel_when_modal` — with `modal=true` open, synthetic Tab from the LAST
  tabbable element wraps focus to the FIRST tabbable inside the panel. Asserts `document.activeElement`
  is inside the panel, never outside.
- `drawer_shift_tab_traps_backward_when_modal` — Shift+Tab from the FIRST tabbable element wraps to the
  LAST. Asserts `document.activeElement` inside the panel.
- `drawer_tab_leaves_panel_when_non_modal` — with `modal=false` open, Tab from the last panel element
  moves focus OUTSIDE the panel to the next page tabbable. No wrapping occurs.
- `drawer_esc_closes_when_closable` — Escape keydown fires the `close()` wire action when `closable=true`;
  after the morph, the panel is hidden and `document.activeElement` is back on the opener.
- `drawer_esc_inert_when_not_closable` — Escape keydown with `closable=false` does NOT fire `close()`;
  the panel remains open; `document.activeElement` stays inside the panel.
- `drawer_enter_on_x_button_closes` — Enter on the close button (when closable) activates it (platform
  native button); the `close()` wire action fires.

**Focus management**:

- `drawer_initial_focus_lands_in_panel` — on open, `document.activeElement` is inside the panel (not on
  the trigger, not on the body). Asserts the heuristic: `data-autofocus` element if present, else close
  button, else first tabbable, else the panel root itself.
- `drawer_initial_focus_on_data_autofocus` — when the OWNED body has an element with `data-autofocus`,
  that element receives initial focus, not the close button or first tabbable.
- `drawer_initial_focus_non_modal_stays_on_trigger` — with `modal=false`, opening the panel does NOT
  move focus; `document.activeElement` remains on the trigger after the morph.
- `drawer_focus_restores_to_opener_on_close` — after close, `document.activeElement` is the element that
  was focused when `openDrawer()` was triggered. Works for both Esc, × click, and wire-action-driven close.
- `drawer_focus_restore_falls_back_to_body` — if the opener no longer exists after close (e.g. it was
  inside a table row that was swapped), `document.activeElement` is `document.body`.
- `drawer_scroll_locked_while_open_modal` — while `modal=true` open, the `<body>` has the scroll-lock
  class and `overflow: hidden`; after close, the class is gone.
- `drawer_page_content_inert_while_open_modal` — while `modal=true` open, the page content sibling has
  the `inert` attribute (not just `aria-hidden`); a focusable element behind the drawer is not reachable
  by Tab.

**Wire round-trip IT (lievit-kit, real runtime, CollapsibleComponentIT pattern)**:

- `drawer_wire_open_action_renders_panel` — mount the `DrawerComponent` with `open=false`; call
  `openDrawer()` action; assert the re-rendered DOM has the panel visible, `role=dialog`, body content
  present (the projection assertion).
- `drawer_wire_close_action_hides_panel` — from open state, call `close()` action; assert the re-rendered
  DOM has the panel hidden/absent.
- `drawer_wire_close_no_op_when_not_closable` — with `closable=false`, calling `close()` action from
  Java DOES NOT change `open`; the panel remains open; the re-rendered DOM is unchanged.
- `drawer_wire_destroy_on_close_absent_from_dom` — with `destroyOnClose=true`, after `close()`, the
  panel subtree is absent (not merely `hidden`) from the rendered HTML.

**Playwright (gesture fidelity, legacy-VM oracle — the real substrate rule)**:

- `drawer_playwright_opens_on_trigger_click` — a real `page.click()` on the trigger opens the panel;
  the body shows resolved fields (server-rendered, not a fake substrate); the panel is visible.
- `drawer_playwright_esc_closes_modal_drawer` — Escape (`page.keyboard.press('Escape')`) closes the
  panel; focus returns to the trigger.
- `drawer_playwright_scrim_click_closes_when_closable` — a real `page.click()` on the scrim closes the
  panel when `closable=true`.
- `drawer_playwright_scrim_click_inert_when_not_closable` — `page.click()` on the scrim does NOT close
  when `closable=false`; the panel remains.
- `drawer_playwright_tab_cycle_trapped` — with the panel open (modal), repeated `page.keyboard.press('Tab')`
  never lands on an element outside the panel (Playwright asserts `document.activeElement` inside the
  panel boundary after each press).

**JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate (the existing
gate, not additional work).

## 8. Non-goals / anti-patterns

- **No hand-rolled focus trap.** The `focus-trap.enhancer.ts` is the ONE source for this behavior; the
  drawer does not implement its own version. This is the architecture contract §2.b rule; violating it
  means two implementations drift and the next dialog-class overlay gets a third. The spec cites the
  rule: "drawer/sheet/slide-over reuse the SAME two, parameterised (modal vs non-modal, center vs side)."
- **No `Content` slot.** The WIRE tier prohibits `gg.jte.Content` slots (server-first refactor
  blueprint §1.b). The body and footer are OWNED markup in the copied template. "Children" that cannot
  be owned template markup belong in a PARTIAL or a different pattern.
- **No client-side open-state.** The panel does not maintain a client-side boolean. The `open` state
  lives in the `@Wire` Java field; closing is always a wire round-trip; the enhancer does not flip any
  local state. A client-only show/hide (CSS toggle without a round-trip) would desync the server state
  and produce phantom `open=false` panel bodies the next time the component is re-rendered by an
  unrelated wire action.
- **No Turbo Stream emission.** The drawer does not swap content via Turbo Streams. Content updates
  go through the normal wire round-trip (morph). This is the boundary ADR-0086 defines.
- **No Lit, Alpine, or framework in the enhancer.** The `focus-trap` enhancer is typed-vanilla-TS +
  CSP-clean. It does not import any framework. ADR-0012 holds.
- **No inline `on*=` handlers in the JTE template.** The CSP (`script-src 'self'`) refuses them silently.
  All event binding goes through `l:*` wire directives (for wire actions) or through the enhancer (for
  the focus-trap behavior). The JTE anti-pattern grep enforces this.
- **No `aria-modal` on a non-modal drawer.** When `modal=false`, `aria-modal` MUST NOT be set. Setting
  it on a non-modal dialog incorrectly tells AT to treat the rest of the page as inert, which breaks the
  whole non-modal use case (the user can no longer navigate the page with AT while the panel is open).
- **No `aria-describedby` auto-wired on rich body content.** The APG explicitly warns against this
  (announcing the full body as "a single unbroken string"). The adopter wires it deliberately in the
  OWNED body if the panel has a single-sentence purpose description.
- **No duplicate `focus-trap` per sheet/slide-over variant.** The `sheet` component (S1, a drawer
  variant with a structured header+footer) composes THIS drawer's `focus-trap` wiring, it does not
  write a new one.
- **`push=true` is not valid with `modal=true`.** The Java component enforces this: if `modal=true` and
  `push=true` are both set, `push` is ignored and a server-side log warning is emitted. The template
  always renders the scrim when `modal=true`; the push layout shift is only for non-modal drawers.
- **No gratuitous placement variants.** The four placements (`left`, `right`, `top`, `bottom`) cover
  every real-world gestionale use case. No diagonal, no "center" (that is `dialog`).

## 9. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read the WAI-ARIA APG Dialog pattern page
(https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and the Ant Design Drawer feature inventory
+ Tailwind UI slide-over LOOK as references for PATTERN and LOOK. You MUST NOT paste literal source
from any of them (no APG example code, no Ant Design JSX, no Tailwind UI markup) — the output is
always original generation (`02-licensing.md`).

Compose the ONE shared `focus-trap.enhancer.ts` — do NOT hand-roll focus trapping, scroll lock, `inert`,
or Esc handling for this component specifically. If the shared enhancer is not yet built, spec it first
(Phase 0) and block on it: this component requires a working `focus-trap` to be testable, just as the
`dialog` spec states.

Mirror `button.jte`'s house conventions exactly (header doc-comment with the credits section, typed
`@param`, `data-slot` on the root, the two escaping channels — `attrs` trusted-raw only, `wireArgs`/
`dataAttrs` escaped — zero `<script>`, zero `on*=`). The drawer is a WIRE component: follow the WIRE
conventions (owned body markup, no `Content` slot, boolean `open` as JTE boolean-attribute conditional,
`data-lievit-*` root attributes, `ComponentMetadata _component`).

The render test MUST assert that the body content is VISIBLE after open (the projection assertion; this
is the lesson from the slide-over empty-body bug, it is not optional). The focus tests MUST use the REAL
`focus-trap` enhancer mounted in the real `LievitRuntime`, not a mocked `$lievit`. The Playwright test
MUST run against the legacy-VM oracle (real page, real HTTP) so that real-DOM behavior is verified, not
a fake substrate.

Validate `closable` in the Java `close()` action BEFORE mutating `open` (the guard is Java, not the
enhancer). Validate that `push=true` + `modal=true` is rejected server-side with a warning.

Minimal code to GREEN against the acceptance tests; refactor only while green. The keyboard map in §4
is the contract — assert ALL of it.
