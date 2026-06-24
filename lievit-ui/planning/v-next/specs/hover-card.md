<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — hover-card

- **tier**: PARTIAL (+ optional ENH `hover-card.enhancer.ts` for the keyboard-accessible variant)
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of existing hover-card partial in `registry/jte/`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Tooltip pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) as the primary
      a11y source of truth for the purely-informational variant (`role="tooltip"` + `aria-describedby`);
      APG explicit guidance that "a hover containing focusable elements can be made using a non-modal dialog"
      governs the interactive variant (no interactive children in this component — see §8 non-goals).
      No react-aria reference needed for the static variant; the platform `popover` attribute + CSS Anchor
      Positioning is the seam. The keyboard-accessible path (focus-triggered show/hide) is BUILT against the
      APG tooltip keyboard model (Esc to dismiss; focus keeps tooltip open; blur dismisses).
    - inventory: Radix UI HoverCard as inventory reference for variant surface (rich card on hover, user-card
      preview, profile peek-card); Ant Design Card/Popover for the content region shape.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI card
      and popover surfaces (NO code copied).

## 1. What it is

A hover-card is a floating content-preview panel that appears when the user hovers (or focuses) a trigger
element — typically a user avatar, a linked name, or an entity reference — and reveals a structured
"peek" card about that entity without navigating away. The content is PURELY INFORMATIONAL: it may
include text, images, badges, and stat rows, but NEVER interactive children such as `<a>`, `<button>`, or
form controls inside the card body. This constraint is load-bearing: it is what allows the card to use
`role="tooltip"` (APG Tooltip) and `aria-describedby` instead of requiring a dialog with a focus trap.
If a design call requires clickable links or buttons inside the card, the correct component is `popover`
or `dialog`, not hover-card. See §8 Non-goals.

TIER rationale: the panel content is STATIC — it is fully determined by the server at render time (the
entity the trigger references is known; the adopter passes a typed model). There is no server-round-trip
on open/close; opening is a CSS/JS toggle over already-rendered markup. PARTIAL is correct: WIRE would
add a round-trip budget for a toggle that is pure CSS with a small JS enhancement for keyboard +
focus-management. The `hover-card.enhancer.ts` handles the one irreducible client bit: synchronising
the `popover` show/hide with hover + focus events, enforcing the hover-grace-delay, and wiring the Esc
key — behaviors that cannot be expressed as native-element semantics alone.

Server-first works well: the card body renders to HTML on page load (in a `popover` container, hidden
until shown). The enhancer shows/hides it; it never fetches new content. When the adopter needs an
async-fetched card (content not known until hover), the HTMX variant swaps the card body fragment on
first hover and caches it (see §6).

The popover/anchor-positioning seam (shared mechanism, architecture contract §2.b) owns placement and
light-dismiss so this component does not hand-roll either.

---

## 2. API — params / props (the typed surface)

This is a PARTIAL, so the surface is `@param` declarations. The template is split into two cooperating
partials: `hover-card-trigger.jte` (the wrapper around the trigger element) and `hover-card.jte` (the
card panel itself). Both must be emitted together by the adopter's controller/template.

### 2.a `hover-card-trigger.jte` params

| param | type | default | meaning |
|---|---|---|---|
| `cardId` | `String` | — | **REQUIRED.** The `id` of the matching `hover-card` panel. Used to set `aria-describedby` on the trigger and `popovertarget` on the enhancer's binding. Must be unique per page. |
| `delay` | `int` | `300` | Hover open-delay in ms. Prevents card flickering on cursor pass-through. Passed as `data-delay` for the enhancer. |
| `closeDelay` | `int` | `150` | Hover close-delay in ms (grace time while cursor travels from trigger to card). |
| `openOnFocus` | `boolean` | `true` | When true, keyboard focus on the trigger also opens the card (the keyboard-accessible path; APG Tooltip keyboard model). |
| `cssClass` | `String` | `""` | Extra utility classes on the trigger wrapper span. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. extra data-* for analytics). Never fed per-row DB values. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic data-* (each value via `Escape.htmlAttribute`). For per-row context the enhancer may read. |
| `content` | `gg.jte.Content` | — | **REQUIRED.** The trigger element itself (an `<a>`, a `<span>` with a user avatar, a `<button>`, etc.). The trigger wrapper adds `aria-describedby="${cardId}"` around it. |

### 2.b `hover-card.jte` params (the card panel)

| param | type | default | meaning |
|---|---|---|---|
| `id` | `String` | — | **REQUIRED.** Matches `cardId` on the trigger. Applied as the `id` attribute of the `popover` element so the browser + enhancer can reference it. |
| `placement` | `String` | `"bottom"` | `top \| bottom \| left \| right \| top-start \| top-end \| bottom-start \| bottom-end` — CSS Anchor Positioning preferred side via `position-try-fallbacks`. |
| `maxWidth` | `String` | `"sm"` | `xs \| sm \| md \| lg` — maps to `--lv-hover-card-max-width-{xs,sm,md,lg}` tokens. |
| `cssClass` | `String` | `""` | Extra utility classes on the card panel root. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic data-*. |
| `header` | `gg.jte.Content` | `null` | Optional card header region (avatar + name + role, for example). When null, no header element is emitted. |
| `content` | `gg.jte.Content` | — | **REQUIRED.** The card body (stats rows, bio, date, etc.). Pure display; no interactive children (see §8). |
| `footer` | `gg.jte.Content` | `null` | Optional card footer (e.g. a timestamp or a secondary stat). When null, no footer element is emitted. |

### 2.c The two escaping channels (the XSS rule, mirroring `button.jte`)

- `attrs` = TRUSTED raw (`$unsafe`): only STATIC strings the template author types at build time.
  Never a DB-derived or user-supplied value.
- `dataAttrs` = SAFE escaped: each value passes through `gg.jte.html.escape.Escape.htmlAttribute`
  before emission. Per-row entity ids or context values go here, never in `attrs`.

---

## 3. Variants / Sizes / States / Slots

### Variants

The hover-card has no `variant` param of its own — the card surface is always the `--lv-color-popover`
/`popover-fg` token pair (the standard floating surface). Visual differentiation lives in the CONTENT
the adopter passes via the `header`/`content`/`footer` slots (a badge partial for status, a stat-card
row partial for numbers, etc.). This is consistent with the inventory row ("content preview") and avoids
gratuitous variant proliferation.

One structural variant drives the `data-variant` attribute for CSS targeting and test assertion:
- `default` — the standard card (always this value; provided for completeness and the data-variant hook).

### Sizes (maxWidth-based)

The hover-card does not use the height-based `size` vocabulary (it is not a form control; toolbar
alignment is not relevant). Instead `maxWidth` controls the card's maximum width, which is the meaningful
sizing axis for a preview card:

| maxWidth value | token | computed (typical) |
|---|---|---|
| `xs` | `--lv-hover-card-max-width-xs` | 200px |
| `sm` (default) | `--lv-hover-card-max-width-sm` | 280px |
| `md` | `--lv-hover-card-max-width-md` | 360px |
| `lg` | `--lv-hover-card-max-width-lg` | 480px |

These are NET-NEW tokens (additive, justified: the standard `--lv-space-*` scale is a spacing scale, not
a panel-width scale; reusing it would be misleading). See §5.

### States

| state | how expressed |
|---|---|
| **closed** (default) | the `popover` element has no `popover-open` pseudo-class; CSS hides it; not in the visible a11y tree (the browser's popover mechanism handles this natively) |
| **open** | the popover is shown by the enhancer via `showPopover()` / `hidePopover()`; `popover-open` pseudo-class is present; `data-open` attribute set by the enhancer for CSS/test targeting |
| **hover-grace** | cursor has left the trigger but is traveling toward the card; `closeDelay` timer is running; card stays open |
| **focus-open** | triggered by keyboard focus on the trigger (`openOnFocus=true`); dismissed by Esc or blur |

There are no `disabled` / `aria-invalid` / `aria-busy` states: the hover-card is a display component,
not a form control, and has no wire round-trip to mark busy.

### Slots

| slot param | purpose | required |
|---|---|---|
| `content` (trigger) | the trigger element (link, avatar span, button) | yes |
| `header` (card) | card header region (avatar + name) | no |
| `content` (card) | card body (the preview data) | yes |
| `footer` (card) | card footer (secondary meta, timestamp) | no |

The `header`/`footer` slots emit a `<div data-slot="header">` / `<div data-slot="footer">` only when
the `gg.jte.Content` is non-null, avoiding empty elements in the DOM.

---

## 4. The a11y contract (the heart — non-negotiable, fully specified)

### WAI-ARIA pattern

**APG Tooltip** (https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) — this is the correct pattern for
a hover-triggered content preview whose body contains NO focusable elements. The APG explicitly states:
"Tooltip widgets do not receive focus. A hover that contains focusable elements can be made using a
non-modal dialog." The hover-card spec enforces the no-interactive-children rule precisely so that
`role="tooltip"` + `aria-describedby` is the correct and sufficient a11y mapping.

### Roles + ARIA

| element | role / attribute | value / rule |
|---|---|---|
| trigger wrapper `<span>` | `aria-describedby` | `="${cardId}"` — associates the card panel as the description of the trigger content |
| trigger wrapper `<span>` | `data-lv-hover-card-trigger` | present — the enhancer's mount hook |
| card panel `<div popover>` | `role="tooltip"` | the card is a tooltip; screen readers announce it as the trigger's description |
| card panel `<div popover>` | `id` | `="${id}"` — the target of `aria-describedby` |
| card panel `<div popover>` | `data-slot="hover-card"` | structural hook |
| card panel `<div popover>` | `data-variant` | `"default"` |
| card `<div data-slot="header">` | — | plain `<div>`, no special role; presentational grouping |
| card `<div data-slot="content">` | — | plain `<div>`, no special role |
| card `<div data-slot="footer">` | — | plain `<div>`, no special role |

The `popover` attribute on the card panel is set to `"manual"` (not `"auto"`) so that the enhancer
controls show/hide explicitly, avoiding the native popover's built-in light-dismiss from interfering
with the hover-grace-delay logic.

The trigger wrapper `<span>` is purely a grouping element (`aria-describedby` carrier); it does not
add role or tabindex — the actual interactive semantics belong to the trigger element the adopter
passes as `content` (an `<a>` or a `<button>` or a `<span tabindex="0">`).

### Keyboard interaction map

Source: WAI-ARIA APG Tooltip pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/), verified
2026-06-24. The APG tooltip keyboard model is minimal by design: focus management stays on the trigger,
not the tooltip itself.

| key | action | who supplies it |
|---|---|---|
| `Tab` | moves focus to the trigger element (if focusable) or away from it; opening/closing follows `openOnFocus` | platform (native tab order of the trigger content) |
| `Shift+Tab` | reverse-tab; same open/close logic | platform |
| `Esc` | dismisses the card when open (whether opened by hover or focus) | `hover-card.enhancer.ts` — registers a `keydown` listener on `document` while the card is open |
| (focus arrives on trigger) | opens the card if `openOnFocus=true`; `aria-describedby` ensures the card content is announced as description | enhancer (`focusin` listener on the trigger wrapper) |
| (focus leaves trigger) | closes the card after `closeDelay` ms if `openOnFocus=true` | enhancer (`focusout` listener) |
| (any other key) | no card-specific behavior; the trigger's own key handling is unaffected | platform / trigger element |

There is NO arrow-key navigation, no Home/End, no Enter/Space specific to the card — the card itself
is never focused. This matches the APG tooltip model exactly: "Focus stays on the triggering element
while the tooltip is displayed."

### Focus management

- **No focus enters the card.** The card panel `[popover]` is never given focus; `tabindex` is never
  set on the card root or its children. This is the defining characteristic of the tooltip pattern.
- **Focus stays on the trigger** while the card is open — whether opened by hover or by keyboard focus.
- **No focus trap** — the card is non-modal; Tab moves focus normally through the page.
- **Esc while card is open**: the card closes; focus stays on the trigger (focus is already there).
- **Focus-open path**: when `openOnFocus=true`, the enhancer listens to `focusin` on the trigger
  wrapper. On `focusout` (blur), it starts the `closeDelay` timer. If focus moves back to the wrapper
  before the timer fires (e.g. the user tabs back), the timer is cancelled and the card stays open.
- The shared **popover seam** (native `popover` attribute + CSS Anchor Positioning) owns placement and
  the visibility toggle. The enhancer calls `panelEl.showPopover()` / `panelEl.hidePopover()` on the
  panel. No hand-rolled absolute positioning.
- The **morph** (lievit runtime ADR-0019) preserves focus identity across server-driven re-renders of
  the page; the hover-card participates passively (no special morph logic needed).

### Screen-reader expectations

- When focus lands on the trigger, the SR announces the trigger's accessible name (from the trigger
  content itself, e.g. the link text or the `aria-label` on the avatar) PLUS the card content as a
  description (`aria-describedby` references `role="tooltip"`).
- The announcement is deferred to the SR's tooltip delay (browser/AT-controlled); there is no additional
  live region.
- When the card is shown by hover only (mouse user, no keyboard focus), screen reader users who rely on
  keyboard navigate to the trigger and receive the description via `aria-describedby` — the content is
  accessible without requiring a hover gesture.
- The card panel must NOT be `aria-hidden` when open (that would defeat `aria-describedby`). It must
  NOT have `aria-hidden="true"` at any point when the trigger's `aria-describedby` points to it.

### Live region

None. The hover-card is a static description, not a status update. The `aria-describedby` mechanism
routes content to the SR without a live region.

### Shared mechanisms composed

- **Popover seam** (native `popover="manual"` + CSS Anchor Positioning): owns placement + the
  show/hide toggle surface. This component is a consumer of the seam; it does NOT hand-roll positioning.
  `anchor-name` / `position-anchor` CSS properties wire the card to the trigger.
- **No focus-trap** (correctly omitted: the card is NOT modal; the APG tooltip explicitly prohibits
  moving focus into the card).
- **No collection-nav** (no roving or typeahead: the card has no interactive children by definition).

---

## 5. Design tokens

### Tokens consumed

| token | role |
|---|---|
| `--lv-color-popover` | card background surface |
| `--lv-color-popover-fg` | card body text |
| `--lv-color-border` | card border |
| `--lv-color-muted` | secondary text (dates, secondary labels in card body) |
| `--lv-color-muted-fg` | muted foreground text |
| `--lv-shadow-md` | card elevation (the popover shadow) |
| `--lv-radius-lg` | card corner radius |
| `--lv-space-3` | card internal padding (compact) |
| `--lv-space-4` | card internal padding (standard, between header/content/footer) |
| `--lv-space-2` | gap between icon/avatar and text within the card body |
| `--lv-ring` | focus-visible ring on the trigger wrapper when the trigger content is focused |
| `--lv-z-popover` | z-index layer (the card floats above the page, below modals) |
| `--lv-font-sans` | card typography |
| `--lv-text-sm` | card body text size |
| `--lv-text-xs` | secondary/muted labels in card body |
| `--lv-text-base` | card header name/title |

### NET-NEW tokens (additive, OKLCH-sourced)

| token | value (light) | value (dark) | justification |
|---|---|---|---|
| `--lv-hover-card-max-width-xs` | `200px` | same | structural token (width), not a colour; no dark variant needed |
| `--lv-hover-card-max-width-sm` | `280px` | same | default card width |
| `--lv-hover-card-max-width-md` | `360px` | same | wider preview (user card with bio) |
| `--lv-hover-card-max-width-lg` | `480px` | same | large entity preview |
| `--lv-hover-card-open-duration` | `120ms` | same | show animation duration (CSS `transition`; structural) |
| `--lv-hover-card-close-duration` | `80ms` | same | hide animation duration |

The width tokens are structural (not colours), so they require no `.dark` override block entry.
The animation duration tokens are likewise structural. All existing colour tokens used are already
in OKLCH in the v-next token file; no new colour token is introduced (the card surface reuses the
popover token pair, consistent with `tooltip`, `dropdown-menu`, and `popover`).

The `:root` block gains the four width tokens + two duration tokens. The `.dark` block gains nothing
(structural tokens are invariant).

All colour values inherited through the existing token system are authored in OKLCH (`oklch(L C H)`),
consistent with the architecture contract §4 colour source-of-truth decision (D1 DECIDED).

---

## 6. Wire / island integration

### JTE structure (server-rendered)

The hover-card is TWO cooperating partial templates the adopter calls together in their page/section
template:

**`hover-card-trigger.jte`** — wraps the trigger content:

```
<span
  data-slot="hover-card-trigger"
  data-lv-hover-card-trigger
  data-card-id="${cardId}"
  data-delay="${delay}"
  data-close-delay="${closeDelay}"
  data-open-on-focus="${openOnFocus}"
  aria-describedby="${cardId}"
  class="relative inline-flex ${cssClass}"
  $unsafe{attrs}
  !{var extraDataAttrs = ... escaped map render ...}
>
  ${content}   <%-- the trigger content (link, avatar, etc.) --%>
</span>
```

The `aria-describedby="${cardId}"` is emitted unconditionally on the wrapper span so that SR users
who navigate by keyboard always receive the description, regardless of whether the visual card is
currently visible.

**`hover-card.jte`** — the card panel itself:

```
<div
  id="${id}"
  role="tooltip"
  popover="manual"
  data-slot="hover-card"
  data-variant="default"
  data-max-width="${maxWidth}"
  class="lv-hover-card [max-width:var(--lv-hover-card-max-width-${maxWidth})] ... ${cssClass}"
  $unsafe{attrs}
  !{var extraDataAttrs = ... escaped map render ...}
>
  @if(header != null)
    <div data-slot="header" class="...">${header}</div>
  @endif
  <div data-slot="content" class="...">${content}</div>
  @if(footer != null)
    <div data-slot="footer" class="...">${footer}</div>
  @endif
</div>
```

The `popover="manual"` attribute keeps the element in the DOM but hidden until the enhancer calls
`showPopover()`. The CSS Anchor Positioning seam links the card to the trigger via:
- On the trigger wrapper: `anchor-name: --hc-${cardId}` (emitted as an inline custom property
  via a `style` attribute, which IS a safe context for a CSS custom property name derived from a
  trusted server-side id value).
- On the card panel: `position-anchor: --hc-${cardId}; inset-block-start: anchor(end); ...`
  (via the `lv-hover-card` utility class + the CSS Anchor Positioning property set controlled by
  `data-max-width` + `data-placement`).

Zero `<script>` tags. Zero inline `on*=` handlers. The CSP is strict; the enhancer is the only
client-side code and it is loaded via the lievit runtime bundle (ADR-0019).

### Enhancer responsibilities (`hover-card.enhancer.ts`)

The enhancer is mounted by the lievit runtime's directive registry when it finds
`[data-lv-hover-card-trigger]` in the DOM (a lifecycle `onInit` hook or a `data-directive`
registration, consistent with the existing enhancer pattern).

**On mount per trigger:**
1. Read `data-card-id`, `data-delay`, `data-close-delay`, `data-open-on-focus` from the trigger wrapper.
2. Resolve `panelEl = document.getElementById(cardId)`.
3. Register:
   - `pointerenter` on the trigger wrapper → start open timer (`delay` ms) → call `panelEl.showPopover()`; set `data-open` on the panel.
   - `pointerleave` on the trigger wrapper → start close timer (`closeDelay` ms) → if not re-entered and not hovering the card, call `panelEl.hidePopover()`; remove `data-open`.
   - `pointerenter` on the panel → cancel the close timer (grace: cursor traveled to card).
   - `pointerleave` on the panel → restart the close timer.
   - `focusin` on the trigger wrapper (when `openOnFocus=true`) → open immediately (no delay for focus; immediacy is the keyboard-accessible convention).
   - `focusout` on the trigger wrapper (when `openOnFocus=true`) → start close timer.
   - `keydown` on `document`, while panel is open → if `key === 'Escape'`, call `panelEl.hidePopover()`; remove `data-open`; stop propagation (Esc is consumed while a hover-card is open, so it does not bubble to a surrounding dialog or drawer).

**On unmount (page navigation / morph removes the trigger):**
- Clear all timers. Remove all event listeners. No memory leaks.

**No wire action is fired.** The open/close is purely client state — there is no server fact at stake
(the card content is already in the HTML). This is why PARTIAL + ENH (not WIRE) is the correct tier.

### HTMX async-content variant (documented pattern, not a shipped component variant)

When the card content is not known at render time (e.g. a user-preview card where the bio is fetched
lazily), the adopter uses the HTMX pattern: the `hover-card.jte` body is initially empty, and a
`hx-get="/entity/{id}/hover-card" hx-trigger="mouseenter delay:300ms" hx-target="this"` attribute
(placed on the trigger wrapper or the card panel via `attrs`) fetches and swaps the card body on first
hover. The enhancer still owns the Esc key and focus management. This is a recipe (adopter wires it),
not a built-in param, so it does not appear in the API table. It is documented here so an implementation
agent does not try to build an async-content first-class mode into the partial.

---

## 7. Acceptance tests

### Render tests (jsdom, REAL enhancer mounted via real `LievitRuntime` + `installAllFeatures`)

- **`hover-card-renders-panel-in-dom`**: after template render, the `[role="tooltip"]` element with
  the expected `id` is present in the DOM; it is hidden (no `popover-open` pseudo-class equivalent in
  jsdom: assert `data-open` attribute is absent and the element is not visible).
- **`trigger-wrapper-has-aria-describedby`**: the trigger wrapper `<span>` has `aria-describedby`
  matching the card `id`.
- **`hover-opens-card-after-delay`**: simulate `pointerenter` on the trigger wrapper; advance timers by
  `delay` ms; assert `panelEl.showPopover()` was called (spy or assert `data-open` is set on the panel).
- **`pointer-leave-trigger-closes-after-close-delay`**: simulate `pointerenter` then `pointerleave`
  on the trigger; advance `closeDelay` ms; assert `panelEl.hidePopover()` was called and `data-open`
  is absent.
- **`grace-period-prevents-close-when-entering-card`**: simulate `pointerenter` trigger → `pointerleave`
  trigger → `pointerenter` card (before `closeDelay` expires); assert the card is NOT closed.
- **`pointer-leave-card-closes-after-close-delay`**: simulate hover to card then `pointerleave` on
  the card; advance `closeDelay`; assert card closes.
- **`focus-opens-card-immediately-when-open-on-focus-true`**: simulate `focusin` on the trigger
  wrapper; assert card opens with no timer delay.
- **`blur-closes-card-after-close-delay`**: simulate `focusin` then `focusout`; advance `closeDelay`;
  assert card closes.
- **`esc-closes-open-card`**: open card; simulate `keydown` with `key='Escape'` on document; assert
  card closes and `data-open` removed.
- **`esc-is-noop-when-card-is-closed`**: no open card; simulate Esc; assert no error and no state change.
- **`focus-stays-on-trigger-when-card-open`**: open card via `focusin`; assert `document.activeElement`
  is within the trigger wrapper, NOT within the card panel.
- **`card-panel-never-receives-focus`**: assert the card panel and all its children have no `tabindex`
  attribute and that programmatic `panelEl.focus()` is never called by the enhancer.

### axe-core assertions

- **`axe-zero-violations-closed`**: run `axe.run()` on the rendered page with card closed; assert zero
  violations. Relevant axe rules: `aria-describedby` references a valid id; `role=tooltip` is on an
  element with a valid id.
- **`axe-zero-violations-open`**: open card; run `axe.run()`; assert zero violations. Key: the
  `[role="tooltip"]` element must be visible (not `aria-hidden`) when its id is referenced by
  `aria-describedby`.
- **`accessible-name-on-trigger-content`**: assert the trigger content itself has an accessible name
  (either text content or `aria-label`); the a11y contract requires the trigger to be named
  independently of the hover-card description.

### Keyboard tests

- **`tab-to-trigger-opens-card-keyboard`** (when `openOnFocus=true`): tab into the trigger wrapper;
  assert `data-open` on the card panel.
- **`shift-tab-away-from-trigger-closes-card`**: focus trigger, open card, `Shift+Tab` away; after
  `closeDelay`, assert card closes.
- **`esc-keyboard-dismisses-card`**: focus trigger, card opens; press Esc; assert card closes, focus
  remains on the trigger content element.
- **`esc-does-not-propagate-past-card`**: wrap hover-card in a parent with its own Esc listener; open
  card; press Esc; assert the card closes AND the parent listener is NOT called (stopPropagation check).
- **`open-on-focus-false-suppresses-keyboard-open`**: set `openOnFocus=false`; focus trigger; assert
  card stays closed.

### Variants / sizes tests

- **`max-width-xs-sm-md-lg-each-render-correct-token-class`**: for each `maxWidth` value, assert the
  card panel carries `data-max-width="${maxWidth}"` and the CSS custom property resolves to the
  matching `--lv-hover-card-max-width-*` token.
- **`data-slot-attributes-present`**: assert `data-slot="hover-card-trigger"` on wrapper,
  `data-slot="hover-card"` on panel, and slot attributes on header/content/footer divs when slots
  are provided.
- **`header-absent-when-null`**: render with `header=null`; assert no `[data-slot="header"]` element
  in the DOM.
- **`footer-absent-when-null`**: render with `footer=null`; assert no `[data-slot="footer"]` element.
- **`header-and-footer-present-when-provided`**: render with both non-null; assert both slot divs exist
  and contain the projected content.

### Escaping / security tests

- **`hostile-data-attr-value-renders-inert`**: pass `dataAttrs={"entity-id": "\">|<script>alert(1)"}`;
  assert the rendered attribute value is HTML-escaped and no `<script>` tag is present in the output.
- **`card-id-used-in-aria-describedby-is-server-controlled`**: assert `cardId` is set server-side and
  cannot be overridden by a data-* value from the request (the `id` is a server-authored String param,
  not taken from user input; the test asserts the param is a typed Java String in the template contract).

### Wire round-trip test

Not applicable (PARTIAL + ENH; no wire round-trip; the card content is static).

### JTE compilation + render gate

Covered by `test/jte-compile` (both `hover-card.jte` and `hover-card-trigger.jte` compile and render
with typed params; any missing param or type mismatch is caught at compile time by the real JTE compiler).

---

## 8. Non-goals / anti-patterns

- **No interactive children inside the card.** Links, buttons, and form controls MUST NOT be placed
  inside `hover-card`'s `content` / `header` / `footer` slots. The APG Tooltip pattern (the a11y
  foundation of this component) explicitly prohibits focusable elements inside the tooltip. A design
  that needs a "Follow" button or a profile link inside the preview card MUST use `popover` (non-modal
  overlay with a trigger, allowing focus to enter) or `dialog` (modal). This is the hardest constraint
  on this component and must not be relaxed without changing the a11y tier to `popover`.
- **No wire round-trip on open.** The hover-card is a static-content preview. Asynchronously-fetched
  card bodies are covered by the HTMX recipe described in §6, not by making this a WIRE component.
  The reason: a wire round-trip on hover is too slow for the UX expectations of a hover preview (100ms
  perceived latency); the HTMX fetch-once-and-cache pattern is the right mechanism for lazy content.
- **Not a tooltip replacement.** A tooltip (`tooltip.jte`) carries a single short plain-text annotation
  (`aria-label`-style). A hover-card carries structured preview content (avatar, stats, multi-line
  bio). They share the same `role="tooltip"` + `aria-describedby` a11y mechanism but their content
  complexity and max-width differ. Do not use hover-card for a 3-word label; do not use tooltip for a
  structured card body.
- **Not a context-menu.** Right-click or long-press to reveal actions is `context-menu`. A hover-card
  is DISPLAY-ONLY, triggered by hover/focus, and carries no actions.
- **No auto-placement fallback beyond CSS Anchor Positioning.** The positioning is owned by the shared
  popover seam (CSS Anchor Positioning + `position-try-fallbacks`). The enhancer does NOT hand-roll
  `getBoundingClientRect`-based placement. If the popover seam's anchor positioning does not yet cover
  a needed placement fallback, that gap is fixed IN the seam, not in this component.
- **No server `open` state.** The open/closed state of the hover-card is ephemeral client state — it
  is never persisted, never sent to the server, and never reflected in a Java `@Wire` field. This is a
  structural decision: hover-card is PARTIAL + ENH, not WIRE, precisely because the open state has no
  server meaning.
- **No `popover="auto"` (no native light-dismiss).** The native `popover="auto"` light-dismiss fires
  immediately on any outside interaction, which would fight the hover-grace-delay logic (cursor moving
  from trigger to card would close the card before it arrives). `popover="manual"` is mandatory so
  the enhancer controls all show/hide transitions explicitly.

---

## 8. Agent instructions

- Generate ORIGINAL code over `--lv-*` tokens. You MAY read Radix HoverCard, APG Tooltip, and Tailwind
  UI Popover as references for PATTERN (a11y semantics, card layout, open/close delay logic) and LOOK.
  You MUST NOT paste literal source from any of them (no Radix / Tailwind UI code or class strings)
  — the output is always original generation. (The one bright line, `02-licensing.md`.)
- Compose the shared **popover seam** (native `popover="manual"` + CSS Anchor Positioning) for
  placement. Do NOT hand-roll `getBoundingClientRect` or absolute positioning. The seam is the one
  source; this component is a consumer.
- Do NOT compose `focus-trap` (the card is NOT modal; focus NEVER enters the card panel; adding a trap
  would violate the APG Tooltip pattern and break keyboard navigation).
- Do NOT compose `collection-nav` (the card has no interactive children, no roving, no typeahead).
- The `aria-describedby` on the trigger wrapper MUST be emitted unconditionally by the server-rendered
  template — it must not depend on JavaScript or the open state. SR users navigate by keyboard and
  receive the description on focus; they never hover.
- The card panel (`[role="tooltip"]`) must NEVER be `aria-hidden`. The `aria-describedby` reference
  is to a live element; hiding it from the a11y tree would break the description for keyboard/SR users.
- The `hover-card-trigger.jte` and `hover-card.jte` templates are SEPARATE files (two-partial pattern).
  The adopter's template calls both with a matching `cardId` / `id`. Do not merge them into one
  template — the trigger and the card may be rendered in different parts of the page tree.
- Mirror `button.jte`'s house conventions exactly: header doc-comment (with the credits line), typed
  `@param`, `data-slot`, the two escaping channels, zero `<script>`, zero inline `on*=`.
- The JTE boolean-attribute convention: `openOnFocus` is a `boolean @param`; emit it as
  `data-open-on-focus="${openOnFocus}"` (the string `"true"`/`"false"`) rather than a nullable
  presence attribute — the enhancer reads it as a string check (`=== 'true'`), which survives morph
  identity.
- Minimal code to GREEN against the acceptance tests; refactor only while green. The Esc propagation
  test and the focus-never-enters-card test are NOT optional; they encode the hardest constraints.
