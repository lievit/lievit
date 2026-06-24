<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — carousel

- **tier**: PARTIAL (shell + slides) + ENH (`carousel.enhancer.ts` — the irreducible client bits: autoplay
  start/stop/pause, pointer-swipe, `aria-live` toggling, keyboard focus pause, and slide-index tracking
  that survives the morph)
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: NET-NEW
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Carousel (BUILT against raw APG: `aria-roledescription=carousel`, region landmark,
      prev/next button pattern, conditional `aria-live`, focus-pauses-rotation rule; react-aria has no
      `useCarousel` hook, so this is a clean APG BUILT implementation; no react-aria reference applicable)
    - inventory: Ant Design Carousel as inventory reference (autoplay, dots navigation, swipe, arrow
      controls, fade/slide transition; the tabbed variant composes the existing `tabs` component)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A carousel presents a sequence of slides — images, cards, or arbitrary server-rendered content — with
controls to advance to the next or previous slide, an optional autoplay timer, and optional dot-indicator
navigation. The SLIDE CONTENT is owned server-rendered markup (like dialog body: no `Content` slot — the
whole point of the server-first pivot was killing the silent-slot bug class). The SLIDE INDEX (which slide
is shown) is lightweight ephemeral view state: it does not need a server round-trip every time the user
clicks next, which is the decision for NOT making this a WIRE component.

Decision rule for the tier:
- The slide sequence and all slide content are SERVER-RENDERED at mount time and present in the DOM as
  hidden sibling panels; the enhancer reveals the active one by toggling visibility.
- The current-index is the ONLY piece of state, and it is ephemeral view state (it does not need
  persistence, authz, or server validation). If it DID (e.g. a wizard-like tracked progress), the
  right tool is WIRE + `tabs` (the tabbed carousel variant, which composes the existing `tabs` component).
- The irreducible client behaviors — autoplay tick, pointer/touch swipe, `aria-live` toggling when
  autoplay state changes, focus-pauses-rotation rule — are exactly the +ENH escape-hatch: typed vanilla
  TS, CSP-clean, no framework.
- A server round-trip for every next/prev click would produce visually stuttered navigation (wire latency
  at 4G is 200–600ms; slide transitions should be instant): this is a genuine UX loss that justifies the
  enhancer owning the advance logic client-side.

Server-first works here because the slide CONTENT is rendered at page load (full markup in the DOM),
never fetched per-slide. Lazy loading a large gallery (e.g. 200 product images) is a SEPARATE concern:
use the HTMX pattern on the carousel wrapper (server swaps the whole updated carousel markup when the
user scrolls to a threshold), not a dynamic per-slide fetch inside this component.

When NOT to use a carousel: for a list of items the user scrolls linearly without slides, use the
`scroll-area` component. For navigation between distinct page sections, use `tabs`. For a single
promotional hero image, just use `<img>` with an `<a>`.

## 2. API — params (PARTIAL surface)

All params flow from the server-side controller into the JTE template. The enhancer reads its own
configuration from `data-*` attributes stamped by the template (the standard lievit wiring convention).

| param | type | default | meaning |
|---|---|---|---|
| `id` | `String` | — | **required** — the HTML `id` of the carousel `<section>`. Used for `aria-controls` on every control button and for the enhancer's `data-carousel-id`. |
| `label` | `String` | — | **required** — the accessible name of the carousel region (`aria-label`). Must NOT contain the word "carousel" (APG rule: `aria-roledescription` already says "carousel" to AT). |
| `slides` | `List<Slide>` | — | **required** — ordered list of `Slide` records; each Slide has `String label` (the per-slide accessible name, e.g. "1 of 6" or a descriptive name) and `gg.jte.Content slideContent` (the rendered markup for that slide panel). |
| `variant` | `String` | `"default"` | `default` (slide transition) \| `fade` (opacity cross-fade). Maps to a `data-variant` attribute the enhancer + CSS consume. |
| `autoplay` | `boolean` | `false` | whether autoplay begins on mount. |
| `autoplayInterval` | `int` | `5000` | milliseconds between auto-advances (only meaningful when `autoplay=true`). |
| `loop` | `boolean` | `true` | whether advancing past the last slide wraps to the first (and backward from first wraps to last). |
| `showArrows` | `boolean` | `true` | render the previous/next arrow buttons. |
| `showDots` | `boolean` | `true` | render the dot-indicator nav row. |
| `initialIndex` | `int` | `0` | zero-based index of the slide to show on first render (server sets the correct `aria-hidden` state for each slide panel at this index). |
| `swipeable` | `boolean` | `true` | enables pointer/touch swipe gesture (enhancer, CSP-safe pointer events). |
| `pauseOnHover` | `boolean` | `true` | autoplay pauses while the pointer is inside the carousel region. |
| `size` | `String` | `"md"` | `sm \| md \| lg` — controls the height of the slide track (not toolbar-aligned like form controls; carousel height is distinct). `sm` = `--lv-carousel-height-sm`, `md` = `--lv-carousel-height-md`, `lg` = `--lv-carousel-height-lg`. |
| `cssClass` | `String` | `""` | extra utility classes on the root `<section>`. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `data-testid="hero"`). Never feed per-row DB values here. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` (each value via `Escape.htmlAttribute`). |

**`Slide` record** (a typed Java record the controller constructs):

| field | type | meaning |
|---|---|---|
| `label` | `String` | per-slide accessible name (e.g. `"1 of 6"` or a descriptive title). Rendered as `aria-label` on the `role="group"` slide panel. |
| `slideContent` | `gg.jte.Content` | the JTE `Content` lambda for the slide's owned markup (the one place a `Content` param is appropriate: not the carousel itself but each named slide in the list). |

Note: the template itself has NO top-level `Content` slot (consistent with the "no `Content` slot for a
composite component" rule). The content enters via the typed `List<Slide>` where each item has its own
`Content`. The slide content is therefore typed, ordered, and fully controlled by the controller.

## 3. Variants / sizes / states

### Variants (transition style)
- `default` (slide): the active panel translates in from the direction of travel; the outgoing panel
  translates out. CSS `transform: translateX(...)` driven by `data-direction="next|prev"` stamped by the
  enhancer on the track element. Uses `--lv-motion-standard` easing, `--lv-motion-duration-md` (200ms).
- `fade`: the outgoing panel fades to `opacity:0`, the incoming fades to `opacity:1`. Same motion tokens.
  `data-variant="fade"` on the root; CSS selector `[data-variant="fade"] .lv-carousel-slide` switches to
  absolute positioning + opacity transition.

Both transitions are `prefers-reduced-motion`-aware: when `@media (prefers-reduced-motion: reduce)` is
active, transitions are skipped (the enhancer still advances the index but sets `data-motion-reduced` on
the root so CSS can suppress the animation in a single rule, without JS inline style).

### Sizes (slide track height)
These are carousel-specific height tokens (not the toolbar-aligned `--lv-space-8/9/10` form-control scale;
carousels are content containers, not form controls):

| size | token | purpose |
|---|---|---|
| `sm` | `--lv-carousel-height-sm` | compact info card carousel (approx 200px) |
| `md` (default) | `--lv-carousel-height-md` | standard image/card carousel (approx 360px) |
| `lg` | `--lv-carousel-height-lg` | hero / feature carousel (approx 540px) |

The slide track height is set via these tokens; the individual slide content is responsible for filling
the track (the controller sets appropriate content for the declared size). Horizontal width is always
`100%` of the containing block.

### States
- **Autoplay running**: the enhancer sets `data-autoplay="running"` on the root. The rotation-control
  button label reads "Stop automatic slide show". The `aria-live` attribute on the slide track is `"off"`
  (APG: do not announce during auto-rotation, it is disruptive).
- **Autoplay paused** (by hover, focus, or explicit stop): `data-autoplay="paused"` on the root. The
  rotation-control button label reads "Start automatic slide show". The `aria-live` attribute switches to
  `"polite"` (APG: polite announcements during manual navigation).
- **Autoplay absent** (`autoplay=false`): `data-autoplay` attribute absent; `aria-live="polite"` always
  (there is no auto-rotation to be disruptive).
- **First slide** (when `loop=false`): the previous button gets `disabled` (native) to prevent going
  before the start; dot[0] is current (see dot state below).
- **Last slide** (when `loop=false`): the next button gets `disabled` (native).
- **Dot indicators**: each dot is a `<button>` with `aria-label="Slide N"` and `aria-disabled="true"` on
  the CURRENT slide (APG grouped-carousel: `aria-disabled` preferred over native `disabled` so it remains
  focusable and its label still reads). Non-current dots are active buttons.
- **focus-visible** on all interactive controls: the `--lv-ring` token, consistent with every other
  interactive primitive.
- **Swipe in progress**: `data-swiping="true"` on the root while a pointer drag is in flight; CSS may use
  this to suppress the transition and show a real-time translate (instant feedback during drag).

## 4. The a11y contract (the load-bearing section)

**WAI-ARIA pattern**: APG Carousel (BUILT).
APG source: https://www.w3.org/WAI/ARIA/apg/patterns/carousel/
APG example (prev/next buttons, the implementation model this spec follows):
https://www.w3.org/WAI/ARIA/apg/patterns/carousel/examples/carousel-1-prev-next/

This is a BUILT implementation (not a react-aria reference) because react-aria has no carousel primitive.
The spec below transcribes the APG pattern faithfully.

### Roles and ARIA attributes

| Element | Role / attribute | Value / rule |
|---|---|---|
| Root `<section>` | implicit `role="region"` | `<section>` is a sectioning element; `aria-roledescription` promotes it to "carousel" in AT |
| Root `<section>` | `aria-roledescription="carousel"` | tells AT this region is a carousel (APG mandatory) |
| Root `<section>` | `aria-label="${label}"` | the human-readable name; must NOT contain "carousel" (APG rule — AT already says it) |
| Root `<section>` | `data-carousel-id="${id}"` | the enhancer's mount hook |
| Root `<section>` | `data-autoplay="running|paused"` | enhancer-managed; absent when autoplay=false |
| Root `<section>` | `data-variant="${variant}"` | CSS transition hook |
| Root `<section>` | `data-size="${size}"` | height token hook |
| Slide track `<div>` | `aria-live="off|polite"` | `off` while auto-rotating, `polite` when paused/stopped (enhancer toggles) |
| Slide track `<div>` | `aria-atomic="false"` | ensures only the changed slide is announced, not the whole track |
| Each slide `<div>` | `role="group"` | marks a slide boundary for AT (APG: `group` for prev/next carousel, `tabpanel` for tabbed variant) |
| Each slide `<div>` | `aria-roledescription="slide"` | tells AT this group is a "slide" |
| Each slide `<div>` | `aria-label="${slide.label}"` | per-slide accessible name (e.g. "1 of 6" or a descriptive title) |
| Each slide `<div>` | `aria-hidden="true|false"` | `false` on the active slide, `true` on all others — SERVER renders this at `initialIndex`, enhancer updates it on advance |
| Rotation control `<button>` | native `<button>` | first in tab order within the carousel (APG: rotation control must precede next/prev) |
| Rotation control `<button>` | `aria-label` | dynamic: "Stop automatic slide show" when running, "Start automatic slide show" when paused (APG wording) |
| Rotation control `<button>` | `data-carousel-rotation-control` | enhancer hook; absent from DOM when `autoplay=false` (no rotation = no control) |
| Previous `<button>` | native `<button>` | `aria-label="Previous slide"` |
| Previous `<button>` | `aria-controls="${id}-track"` | references the slide track container (APG: controls the region being changed) |
| Previous `<button>` | `disabled` | when at first slide AND `loop=false` |
| Previous `<button>` | `data-carousel-prev` | enhancer hook |
| Next `<button>` | native `<button>` | `aria-label="Next slide"` |
| Next `<button>` | `aria-controls="${id}-track"` | references the slide track container |
| Next `<button>` | `disabled` | when at last slide AND `loop=false` |
| Next `<button>` | `data-carousel-next` | enhancer hook |
| Dot `<button>` | native `<button>` | `aria-label="Slide ${n}"` (1-based) |
| Current dot `<button>` | `aria-disabled="true"` | preferred over `disabled` (APG grouped-carousel: remains focusable, label still reads) |
| Dot wrapper `<div>` | `role="group"` | `aria-label="Choose slide to display"` — groups the picker controls (APG grouped-carousel) |

### Keyboard interaction map

The APG keyboard model for a prev/next carousel is minimal: all controls are native buttons, so the
platform handles Enter/Space. The enhancer's job is: toggle autoplay on the rotation control, advance on
prev/next, update the dot indicator, manage `aria-hidden`, and pause on focus.

| Key | On which element | Action | Who supplies it |
|---|---|---|---|
| `Tab` | anywhere in carousel | moves focus to the next interactive element in the carousel tab sequence: rotation-control (if present) → previous → next → dots[0..N] → then exits the carousel into the page | platform (all real `<button>` elements) |
| `Shift+Tab` | anywhere in carousel | reverse tab order | platform |
| `Enter` / `Space` | rotation control button | toggles autoplay (start / stop); does NOT move focus (APG: button activation does not shift focus) | platform (native `<button>`) |
| `Enter` / `Space` | previous button | advances to the previous slide; pauses autoplay if running | platform (native `<button>`) + enhancer (slide transition + aria-hidden update) |
| `Enter` / `Space` | next button | advances to the next slide; pauses autoplay if running | platform (native `<button>`) + enhancer (slide transition + aria-hidden update) |
| `Enter` / `Space` | non-current dot button | jumps to the numbered slide | platform (native `<button>`) + enhancer |
| `Enter` / `Space` | current dot button | no-op (button is `aria-disabled="true"`; `aria-disabled` does not block the click event, but the enhancer ignores it) | enhancer (no-op guard) |

**Focus pauses autoplay (APG rule, critical)**:
Keyboard focus on ANY element inside the carousel region pauses the autoplay timer. The rotation does not
resume until the user explicitly activates the rotation control to restart it. The enhancer attaches a
`focusin` listener on the carousel root to implement this rule; on `focusin`, if autoplay is running, the
enhancer pauses it (sets `data-autoplay="paused"`, flips `aria-live` to `"polite"`, updates the rotation
control label) and records that it was paused by focus so it does NOT auto-resume on `focusout`.

**Swipe gestures (not in APG; enhancer-only)**:
Swipe left = next; swipe right = previous. Implemented via `pointerdown` / `pointermove` / `pointerup`
on the slide track. The enhancer uses a threshold (default 50px horizontal displacement) to distinguish
a swipe from a tap. CSP-clean (no inline handlers). Pauses autoplay on swipe start, same as any
manual interaction.

**Hover pauses autoplay (when `pauseOnHover=true`)**:
`pointerenter` on the carousel root pauses autoplay; `pointerleave` resumes it IF the rotation was
running at hover-start AND the user has NOT explicitly stopped it with the rotation control AND no
keyboard focus is inside the carousel. The enhancer tracks a `_hoverPaused` vs `_focusPaused` flag
to avoid a resume race when both conditions clear.

### Focus management

- **No focus trap**: a carousel is NOT modal. Tab exits normally into the page.
- **No roving tabindex**: all dots are real `<button>` elements in the tab order. The APG does not
  specify a roving model for the dot group; using native buttons means Tab simply cycles through them,
  which is the APG intent.
- **No `collection-nav` enhancer**: the dots are a flat list of independent buttons, not a navigable
  collection with Home/End/typeahead. `collection-nav` is NOT composed here.
- **No `focus-trap` enhancer**: carousel is non-modal. `focus-trap` is NOT composed here.
- **Initial focus**: set by the page (first focusable in reading order); the carousel does not
  programmatically move focus on mount.
- **After slide advance**: focus stays on the button that was activated (next/prev/dot). The slide
  content is NOT focused; AT reads the new slide via the `aria-live` announcement.
- **Focus restoration on unmount**: not applicable (the carousel is not dismissed).

### Live region (the dynamic announcement)

The slide track `<div>` carries `aria-live` and `aria-atomic="false"`. The VALUE of `aria-live` is
the carousel's most important dynamic ARIA attribute:

- `aria-live="off"` while autoplay is running: frequent automatic changes would otherwise produce a
  constant stream of AT announcements (disruptive; APG mandate).
- `aria-live="polite"` when autoplay is paused or absent: manual navigation is announced politely
  so the user knows which slide is now shown.

The enhancer toggles this attribute on the track element every time it starts or pauses autoplay.
The SERVER renders the initial value: `off` when `autoplay=true`, `polite` when `autoplay=false`.

When a slide becomes visible, `aria-hidden="false"` is set on it and `aria-hidden="true"` on all others.
Because the slide has `role="group" aria-roledescription="slide" aria-label="..."`, AT reads its label
(e.g. "slide, 3 of 6") when the live region fires. The slide body content is then navigated to by the
user; AT does not read the whole body automatically (that would be a fire-hose for long slide content).

### Screen-reader expectations

When the user presses the "Next" button:
1. The new slide becomes visible (`aria-hidden="false"`).
2. The live region (`aria-live="polite"`) announces the slide's label (e.g. "3 of 6").
3. AT reads "slide, 3 of 6" (the `aria-roledescription` + the `aria-label`).
4. Focus stays on the "Next" button (unchanged).

When focus enters the carousel (keyboard Tab from outside):
1. If autoplay was running, it pauses immediately.
2. AT reads the focused button (the rotation control, if present; otherwise the previous button).
3. The autoplay stop is silent (no live region announcement needed — the button label already
   reflects the new state).

## 5. Tokens

**Reads** (from the shared `--lv-*` namespace):

| Token | Used for |
|---|---|
| `--lv-color-bg` | slide track background |
| `--lv-color-fg` | slide text (inherits into slide content) |
| `--lv-color-overlay` | the optional scrim behind the control buttons when overlaid on an image slide |
| `--lv-color-primary` | active/current dot indicator fill |
| `--lv-color-muted` | inactive dot indicator fill |
| `--lv-color-border` | dot border (when the variant uses outlined dots) |
| `--lv-color-accent` | arrow button hover background |
| `--lv-color-accent-fg` | arrow button icon color on hover |
| `--lv-radius-full` | dot shape (pill/circle) |
| `--lv-radius-lg` | carousel container corner radius (wraps the track) |
| `--lv-radius-md` | arrow button corner radius |
| `--lv-shadow-md` | arrow button elevation (when they float over the slide) |
| `--lv-ring` | focus-visible ring on all interactive controls |
| `--lv-space-2` | dot gap |
| `--lv-space-3` | dot size (width + height) |
| `--lv-space-9` | arrow button size (the `--lv-space-9` = 36px form-control height, toolbar-aligned) |
| `--lv-space-4` | internal padding inside the carousel controls bar |
| `--lv-motion-duration-md` | slide transition duration |
| `--lv-motion-standard` | slide transition easing (cubic-bezier) |
| `--lv-z-above` | arrow buttons z-index (float above the slide track) |

**NET-NEW tokens** (additive; justified below; added to `:root` + `.dark` blocks in `lievit-tokens.css`):

| Token | OKLCH value proposal | Justification |
|---|---|---|
| `--lv-carousel-height-sm` | `200px` | structural (not a colour); the carousel track height at `size="sm"`. Not expressible via existing `--lv-space-*` (those top out at `--lv-space-10` = 40px; a carousel track is a content container at a different scale). |
| `--lv-carousel-height-md` | `360px` | structural; the default track height. |
| `--lv-carousel-height-lg` | `540px` | structural; the hero/feature track height. |

These three are structural (px heights), not colour tokens, so they have no dark-mode variant. They are
the only NET-NEW tokens; every colour concern reuses existing tokens. Adopters override these three to
tune carousel sizes without editing component markup.

## 6. Wire / island integration

### Server-rendered JTE structure

The template renders the COMPLETE slide markup for all slides at mount time. All slides are in the DOM.
The enhancer shows/hides them by toggling `aria-hidden`; NO server round-trip happens per slide advance.

```
<section id="${id}"
         class="lv-carousel ${cssClass}"
         aria-roledescription="carousel"
         aria-label="${label}"
         data-carousel-id="${id}"
         data-size="${size}"
         data-variant="${variant}"
         data-autoplay="${autoplay ? (initialRunning ? "running" : "paused") : ""}"
         data-autoplay-interval="${autoplayInterval}"
         data-loop="${loop}"
         data-swipeable="${swipeable}"
         data-pause-on-hover="${pauseOnHover}"
         ${attrs}>

  <!-- Controls bar: rotation control (if autoplay), prev, next -->
  <div class="lv-carousel-controls" data-slot="controls">
    !{var isAutoplay = autoplay}
    @if(isAutoplay)
    <button type="button"
            aria-label="Stop automatic slide show"
            data-carousel-rotation-control>
      @template.lievit.icon(name="pause-circle", ariaHidden=true)
    </button>
    @endif

    @if(showArrows)
    <button type="button"
            aria-label="Previous slide"
            aria-controls="${id}-track"
            data-carousel-prev
            ${initialIndex == 0 && !loop ? "disabled" : ""}>
      @template.lievit.icon(name="chevron-left", ariaHidden=true)
    </button>
    <button type="button"
            aria-label="Next slide"
            aria-controls="${id}-track"
            data-carousel-next
            ${initialIndex == slides.size() - 1 && !loop ? "disabled" : ""}>
      @template.lievit.icon(name="chevron-right", ariaHidden=true)
    </button>
    @endif
  </div>

  <!-- Slide track -->
  <div id="${id}-track"
       class="lv-carousel-track"
       data-slot="track"
       aria-live="${autoplay ? "off" : "polite"}"
       aria-atomic="false">

    @for(int i = 0; i < slides.size(); i++)
    !{var slide = slides.get(i)}
    <div class="lv-carousel-slide"
         role="group"
         aria-roledescription="slide"
         aria-label="${slide.label()}"
         aria-hidden="${i != initialIndex ? "true" : "false"}"
         data-slide-index="${i}">
      ${slide.slideContent()}
    </div>
    @endfor

  </div>

  <!-- Dot indicators -->
  @if(showDots)
  <div class="lv-carousel-dots"
       data-slot="dots"
       role="group"
       aria-label="Choose slide to display">
    @for(int i = 0; i < slides.size(); i++)
    <button type="button"
            aria-label="Slide ${i + 1}"
            ${i == initialIndex ? "aria-disabled=\"true\"" : ""}
            data-carousel-dot="${i}">
    </button>
    @endfor
  </div>
  @endif

</section>
```

The template uses JTE `@if` / `@for` control flow, NOT `<script>`. Zero inline `on*=` handlers (CSP
refuses them). All dynamic string values go through JTE's built-in escaping channel (JTE escapes
`${...}` expressions in attribute context automatically; the `$unsafe` / `attrs` channel is only for the
author-controlled static `attrs` string, which is the same two-channel discipline as `button.jte`).

The `initialIndex`-based `aria-hidden` state means the SERVER renders the correct initial visibility
for each slide, so the page is semantically correct even before the enhancer mounts (progressive
enhancement: AT + keyboard work without JS; autoplay and transitions require the enhancer).

### Enhancer responsibilities (`carousel.enhancer.ts`)

The enhancer is a CSP-clean typed-vanilla-TS module registered via the lievit lifecycle registry
(`onComponentInit` or a `data-carousel-id` directive). It:

1. **Reads config** from `data-*` attributes on the root element (id, autoplay, interval, loop,
   swipeable, pauseOnHover) — no hardcoded values; the server stamped them.

2. **Owns the active index** in a single `_index: number` field (the one piece of ephemeral client
   state this component owns, as justified in §1). On mount, reads `initialIndex` from the slide that
   has `aria-hidden="false"`.

3. **`advanceTo(nextIndex)`** — the single state-mutation method:
   - stamps `data-direction="next|prev"` on the track for CSS to key the slide-in direction;
   - sets `aria-hidden="true"` on the old active slide, `aria-hidden="false"` on the new one;
   - updates `aria-disabled` on the dot buttons (true = current, absent = navigable);
   - updates `disabled` on prev/next buttons when `loop=false` and at the boundary;
   - clears `data-direction` after the CSS transition ends (`transitionend` event).

4. **Autoplay timer**: `setInterval`-based; the interval value comes from `data-autoplay-interval`.
   Pauses (`clearInterval`) on: rotation-control click, `focusin` anywhere in the carousel, `pointerenter`
   if `pauseOnHover`. Resumes on `pointerleave` ONLY if it was hover-paused AND not focus-paused AND the
   user has not explicitly stopped it. Updates `data-autoplay`, `aria-live` on track, and rotation-control
   `aria-label` on every state change.

5. **Swipe handling**: `pointerdown` records the start X; `pointermove` (with `setPointerCapture`) updates
   a live translate on the track (instant feedback); `pointerup` commits (advance if threshold exceeded,
   snap back if not). Uses pointer events, not touch events (unified pointer model, CSP-safe).

6. **Reduced-motion guard**: reads `window.matchMedia('(prefers-reduced-motion: reduce)')` on mount; if
   true, sets `data-motion-reduced` on the root and skips the CSS transition (instant swap).

7. **Morph survival**: the enhancer's `_index` is the only state. After a lievit morph (if the carousel
   is embedded in a WIRE component), the enhancer must re-sync: the lifecycle `onAfterMorph` hook calls
   `syncFromDOM()` which re-reads `aria-hidden` states from the new DOM. (The morph preserves node
   identity, so the active slide's `aria-hidden="false"` survives the patch; `syncFromDOM` is a safety
   belt.)

8. **Does NOT fire wire actions**: this is a pure PARTIAL+ENH; there is no WIRE round-trip per advance.
   If the consuming context needs to KNOW which slide is active (e.g. a server-side analytics call), the
   controller subscribes to a custom DOM event `lv:carousel:change` (dispatched by the enhancer on
   `advanceTo` with `detail: { index, label }`) and handles it in its own wire action or via an
   htmx-triggered fetch. The carousel itself is decoupled from that concern.

### No WIRE round-trip per slide

This is the key design decision restated for clarity: the carousel does NOT call a lievit wire action
on every next/prev advance. The slide index is ephemeral view state. If a consuming WIRE template
needs to react (e.g. lazy-load the next set of slides), it listens for `lv:carousel:change` and fires
its OWN wire action — the carousel does not own that coupling.

## 7. Acceptance tests

All tests run on a REAL substrate, not a mocked one. The client-island-fidelity rule (CLAUDE.md) is
the direct lesson here: a carousel test that runs in a fake runtime with mocked `$lievit` would
certify nothing about the real interaction.

### Render (jsdom + real enhancer mounted, NOT mocked)

- **`renders_all_slides_in_DOM_with_correct_aria_hidden`**: on render with 4 slides and `initialIndex=1`,
  all 4 slide panels are present in the DOM; slide[1] has `aria-hidden="false"`, slides [0,2,3] have
  `aria-hidden="true"`.
- **`renders_region_with_correct_roledescription_and_label`**: the root `<section>` has
  `aria-roledescription="carousel"` and `aria-label` equal to the param value (not "carousel" in it).
- **`renders_slide_groups_with_roledescription`**: every slide panel has `role="group"` and
  `aria-roledescription="slide"` and a non-empty `aria-label`.
- **`renders_control_buttons_with_aria_controls`**: the previous and next buttons each have
  `aria-controls` pointing to the track element's `id`.
- **`renders_rotation_control_only_when_autoplay_true`**: with `autoplay=false`, no
  `data-carousel-rotation-control` button is present; with `autoplay=true`, it is present and first in
  DOM order within the controls bar.
- **`renders_dots_with_current_aria_disabled`**: with `initialIndex=2` and 5 slides, dot[2] has
  `aria-disabled="true"`, all others do not.
- **`renders_prev_disabled_at_first_slide_when_no_loop`**: `initialIndex=0`, `loop=false` → prev button
  has the native `disabled` attribute.
- **`renders_next_disabled_at_last_slide_when_no_loop`**: `initialIndex=lastIndex`, `loop=false` → next
  button is `disabled`.
- **`renders_aria_live_off_when_autoplay_true`**: the track element has `aria-live="off"` when
  `autoplay=true`.
- **`renders_aria_live_polite_when_autoplay_false`**: the track element has `aria-live="polite"` when
  `autoplay=false`.
- **`slide_content_is_visible_after_mount`**: the active slide's owned content is present and visible in
  the DOM (the projection assertion — the same lesson as the dialog spec: assert the BODY IS VISIBLE).

### axe-core

- **`axe_zero_violations_on_mounted_carousel`**: run `axe(root)` on the mounted carousel (real enhancer,
  real DOM); zero violations of the Carousel / Region / Button accessible-name rules.
- **`axe_zero_violations_after_advance`**: advance to slide 2 via the "Next" button; run axe again;
  zero violations (the aria-hidden state change is valid).

### Keyboard (REAL enhancer, assert observable DOM after key)

- **`enter_on_next_button_advances_to_slide_2`**: focus the next button, press Enter; assert slide[1] has
  `aria-hidden="false"` and slide[0] has `aria-hidden="true"` and dot[1] has `aria-disabled="true"`.
- **`enter_on_prev_button_wraps_to_last_when_loop_true`**: start at index 0, focus prev, press Enter
  with `loop=true`; assert slide[last] is now active.
- **`enter_on_prev_button_inert_when_disabled`**: `loop=false`, `initialIndex=0`; prev button is
  `disabled`; pressing Enter does nothing (assert index unchanged).
- **`enter_on_dot_button_jumps_to_that_slide`**: focus dot[3], press Enter; assert slide[3] is active.
- **`enter_on_current_dot_is_noop`**: `initialIndex=2`; focus dot[2] (which has `aria-disabled="true"`);
  press Enter; assert active slide is still 2 (enhancer ignores `aria-disabled` dot).
- **`enter_on_rotation_control_toggles_autoplay`**: `autoplay=true`; mount; press Enter on rotation
  control; assert `data-autoplay="paused"` on root + rotation control label = "Start automatic slide
  show" + `aria-live="polite"` on track. Press Enter again; assert `data-autoplay="running"` + label
  = "Stop automatic slide show" + `aria-live="off"`.
- **`tab_exits_carousel_after_last_control`**: Tab through all interactive controls (rotation, prev, next,
  all dots); after the last dot, Tab exits to the next focusable element outside the carousel.

### Focus management

- **`focusin_inside_carousel_pauses_autoplay`**: `autoplay=true`; mount (autoplay starts ticking);
  fire `focusin` on the prev button; assert `data-autoplay="paused"`, `aria-live="polite"`.
- **`focusin_pause_does_not_resume_on_focusout`**: after the above, fire `focusout`; assert still
  `data-autoplay="paused"` (focus-pause is sticky; only the rotation-control button resumes).
- **`hover_pauses_and_resumes_when_pauseOnHover_true`**: `autoplay=true`, `pauseOnHover=true`; fire
  `pointerenter`; assert paused; fire `pointerleave`; assert running again (no focus inside, not
  explicitly stopped).
- **`hover_does_not_resume_after_explicit_stop`**: `autoplay=true`; stop via rotation-control button;
  fire `pointerenter` + `pointerleave`; assert still `data-autoplay="paused"` (user stopped explicitly).

### Variants and sizes

- **`data_variant_and_size_on_root`**: render with `variant="fade"` and `size="lg"`; assert root has
  `data-variant="fade"` and `data-size="lg"`.
- **`reduced_motion_suppresses_transition`**: mock `matchMedia('prefers-reduced-motion')` to `true`;
  mount; assert `data-motion-reduced` on the root; advance to next; assert the new slide is immediately
  active without a CSS transition class.

### JTE compiles and renders

- Covered by the project's `test/jte-compile` real-compiler + render gate (same as all other partials).

### Escaping

- **`dataAttrs_hostile_value_renders_inert`**: pass `dataAttrs={label: "\">|<script>"}` as an extra
  data attribute; assert the rendered `data-label` attribute value is HTML-escaped (the hostile string
  is inert, never a tag).
- **`slide_label_is_html_escaped`**: a `Slide` with `label='"><script>'` renders its `aria-label`
  with the value HTML-escaped (JTE's `${...}` escaping in attribute position).

### Playwright (gesture fidelity, legacy-VM oracle or standalone server)

- **`swipe_left_advances_to_next_slide`**: open the carousel page; perform a real `page.mouse` drag
  from right to left (>50px) on the slide track; assert the DOM shows the next slide active (the
  client-island-fidelity lesson: assert the observable DOM change, not a mocked swipe).
- **`autoplay_advances_slide_automatically`**: `autoplay=true`, `autoplayInterval=500`; wait 600ms;
  assert the active slide has changed from the initial one.
- **`keyboard_navigation_real_browser`**: real `page.keyboard.press('Tab')` to reach the Next button;
  `page.keyboard.press('Enter')`; assert slide 2 is now active in the rendered page.

## 8. Non-goals / anti-patterns

- **No per-slide wire round-trip**: the carousel does NOT fire a lievit wire action on every
  next/prev advance. The slide index is ephemeral view state. If the consuming context needs server
  awareness, it listens for the `lv:carousel:change` DOM event. Wiring EVERY slide advance to the
  server introduces 200–600ms latency per click — the exact UX loss the +ENH escape-hatch exists to
  avoid.
- **No WIRE tier**: the carousel is PARTIAL+ENH, not a WIRE component. Open-state and selection-state
  are not server facts here. If the caller needs a server-tracked current-slide (e.g. a wizard with
  server-side step validation), use the `tabs` WIRE component instead (the tabbed carousel variant
  reduces to `tabs` + styled slide panels).
- **No framework**: the enhancer is typed vanilla TS — NO Lit, NO Alpine, NO React (ADR-0012). A
  carousel does not justify a framework island; the typed enhancer is ~150 lines.
- **No lazy per-slide fetch**: the carousel renders ALL slide content at mount. Lazy-fetching a 200-
  image gallery per slide is a server-streaming concern handled at the page level (HTMX on the outer
  container), not inside this component. Putting a fetch inside the enhancer couples it to a URL
  scheme and breaks the clean server-first boundary.
- **No focus trap**: the carousel is NOT modal. Do NOT compose `focus-trap.enhancer.ts` here; Tab must
  exit the carousel normally into the page.
- **No `collection-nav` enhancer**: the dot buttons are a flat list of independent action buttons, not
  a navigable collection with roving tabindex, Home/End, or typeahead. The APG does not specify those
  interactions for carousel dots. Composing `collection-nav` here would be over-engineering for a flat
  button group that already works via Tab.
- **No `aria-live="assertive"`**: the slide track always uses `polite` (when autoplay is paused) or
  `off` (when running). Never `assertive` — assertive interrupts the user mid-sentence and is reserved
  for errors, not content transitions.
- **No `<div role="button">`**: all controls are real `<button>` elements. The platform provides
  keyboard activation, focus, and disabled state for free; a `div` would require re-implementing all
  of that.
- **No `aria-pressed` on the rotation control**: the APG explicitly prohibits `aria-pressed` on the
  rotation control (the label change is the state communication; `aria-pressed` would make AT announce
  both the label AND the pressed state, producing redundant output).
- **No inline `<script>` or `on*=` handlers in the JTE template**: the strict CSP refuses them, and
  the enhancer is the correct lievit mechanism for any client behavior.
- **No hardcoded slide count or labels in the template**: slide count, labels, and content come in via
  the typed `List<Slide>` parameter from the controller. Zero hardcoded data inside the partial.

## 8 (cont.). Agent instructions

Generate ORIGINAL code over `--lv-*` tokens.
Read the APG Carousel pattern + the two W3C example implementations (prev-next + tablist)
as the a11y reference; read Ant Design Carousel as the inventory reference (autoplay, dots, swipe,
fade); read Tailwind UI for visual inspiration.
You MUST NOT paste literal source from WAI-ARIA examples, react-aria, Ant Design, or Tailwind UI —
the output is always original generation (`02-licensing.md`, the one bright line).

Do NOT compose `focus-trap` or `collection-nav` here (both are explicitly out-of-scope, §8).
Do NOT introduce a WIRE round-trip per slide (ephemeral view state, the decision is locked in §1 and §6).
Do NOT render slide content via a `Content` slot on the carousel root; use the `List<Slide>` typed param.

Follow `button.jte` house conventions exactly: header doc-comment with credits, typed `@param`,
`data-slot` on root + named regions, the two escaping channels (`attrs` trusted-raw, `dataAttrs`/JTE
auto-escape for dynamic values), zero `<script>`, zero inline `on*=`.

The acceptance-test in §7 is the GATE. The keyboard map in §4 is the contract — assert ALL keys on the
REAL substrate (no mocked `$lievit`). The `slide_content_is_visible_after_mount` render test is the
projection assertion; it is not optional (the lesson from the dialog exemplar).

Minimal code to GREEN; refactor only while green.
