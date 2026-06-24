<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — loading-section / skeleton / spinner

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/skeleton.jte` + `spinner.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA `role=status` (implicit `aria-live="polite"` + `aria-atomic="true"`) for the
      live-region announcement surface; `aria-busy` (global ARIA state) on the loading container;
      BUILT against the raw ARIA spec and WCAG 4.1.3 (Status Messages, Level AA) — no dedicated APG
      pattern exists for loading indicators; react-aria not applicable (no interactive widget); MDN
      ARIA references used as authoritative secondary source
      (https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role ,
      https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-busy ,
      https://www.w3.org/WAI/WCAG22/Understanding/status-messages )
    - inventory: Ant Design Skeleton + Spin as inventory reference (shapes, active animation, size,
      tip text, full-screen overlay spin, nested Spin wrapping real content)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      skeleton shimmer + Ant Design Spin (NO code copied)

## 1. What it is

Three related but distinct presentational states bundled in one component family:

- **Spinner** (`mode="spinner"`): an animated circular indicator, used inline or centered in its
  parent, that signals a background operation is in progress without implying content structure.
  Use when the shape of the arriving content is not known or the wait is expected to be very brief.
- **Skeleton** (`mode="skeleton"`): a structured set of placeholder shapes (text lines, image block,
  avatar circle, button bar) that mirrors the layout of the content being fetched. Use when the shape
  of the arriving content is known and the wait is perceptible (> ~300 ms), because it reduces
  perceived latency via layout anticipation.
- **Loading section** (`mode="section"`): a composable wrapper that overlays a spinner (and optional
  tip text) over already-rendered or partially-rendered content (the owned template region) while a
  server round-trip or background fetch is in progress. This is the `aria-busy` use case: the content
  is PRESENT but marked as updating; the spinner is a visual overlay.

All three are STATIC presentation — no client state, no interactivity, no server round-trip of their
own. They are PARTIAL: the consuming controller or WIRE component decides when to show them (by
setting the `loading` boolean on its model or its `@Wire` field) and renders this partial accordingly.
Server-first works trivially: there is nothing interactive about a loading indicator; it is rendered
or not rendered by the server on each request.

The component satisfies WCAG 4.1.3 Status Messages (Level AA): loading state is communicated
programmatically via `role=status` (polite live region) so assistive technologies are informed
without focus being moved.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `mode` | `String` | `"spinner"` | `spinner` \| `skeleton` \| `section` — which loading surface to render |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — scales the spinner diameter and skeleton line heights; does NOT affect section mode (the overlay fills its positioned parent) |
| `variant` | `String` | `"default"` | `default` \| `primary` — spinner stroke colour; `default` = `--lv-color-muted-fg`; `primary` = `--lv-color-primary`; skeleton always uses the shimmer colour palette |
| `label` | `String` | `"Loading…"` | the accessible label injected into the `role=status` live region (screen-reader text; visually hidden in spinner/skeleton modes); also used as the visible tip text in `section` mode when `showTip=true` |
| `showTip` | `boolean` | `false` | in `section` mode: render `label` as a visible tip string below the spinner overlay; in other modes, `label` is always visually hidden |
| `active` | `boolean` | `true` | in `skeleton` mode: whether the shimmer animation plays; `false` = static grey placeholder (useful for SSR pre-paint where animation is not yet hydrated) |
| `skeletonRows` | `int` | `3` | in `skeleton` mode with `skeletonShape="lines"`: the number of text-line rows to render; each row has a randomised width within `--lv-skeleton-line-width-range` |
| `skeletonShape` | `String` | `"lines"` | in `skeleton` mode: `lines` \| `card` \| `avatar-row` \| `image` \| `button-bar` — the placeholder layout preset (see §3) |
| `fullPage` | `boolean` | `false` | in `section` mode: positions the overlay fixed over the viewport (full-page loading gate) instead of absolute over the nearest positioned ancestor; sets `--lv-z-overlay` |
| `cssClass` | `String` | `""` | extra utility classes appended to the root element |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `id`, `data-testid`); never feed dynamic / user-derived data here |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (each value through `Escape.htmlAttribute`); for test hooks and consuming WIRE component identity |
| `content` | `gg.jte.Content` | — | **section mode only**: the real content being loaded, rendered inside the overlay region; the server renders it; the spinner overlays it while `aria-busy="true"`; absent in spinner/skeleton modes (they have no content slot) |

Note: `section` mode with `content` is the Ant Design Spin "wrap a component" pattern. The consumed
content is OWNED server-rendered markup (the `gg.jte.Content` slot filled by the calling template),
not generated client-side. The spinner overlay is an absolutely-positioned sibling within the wrapper,
not a portal — CSP-clean, no JS required for the layout.

## 3. Variants / sizes / states

### mode matrix

| mode | visual surface | aria contract | uses `content` slot |
|---|---|---|---|
| `spinner` | rotating SVG ring | `role=status` + visually-hidden label | no |
| `skeleton` | shimmer placeholder shapes | `role=status` + visually-hidden label | no |
| `section` | spinner + optional tip text over real content | `aria-busy` on wrapper + `role=status` live region for tip | yes |

### size (spinner diameter + skeleton line scale)

| size | spinner diameter | skeleton line height | token |
|---|---|---|---|
| `sm` | 16 px | `--lv-space-3` (12 px) | `--lv-space-4` ring wrapper |
| `md` | 24 px (default) | `--lv-space-4` (16 px) | `--lv-space-6` ring wrapper |
| `lg` | 40 px | `--lv-space-5` (20 px) | `--lv-space-10` ring wrapper |

Size does NOT affect the `section` overlay (the overlay fills the positioned parent by CSS).

### variant (spinner stroke colour only; skeleton is always shimmer)

| variant | spinner stroke | token |
|---|---|---|
| `default` | muted foreground | `--lv-color-muted-fg` |
| `primary` | primary brand | `--lv-color-primary` |

### skeletonShape presets (skeleton mode)

| skeletonShape | what it renders |
|---|---|
| `lines` | `skeletonRows` staggered text-line bars, widths vary (60–100 %) |
| `card` | a tall image block + two lines below (card thumbnail placeholder) |
| `avatar-row` | a circle (avatar) + two lines to its right (list item placeholder) |
| `image` | a single 16:9 aspect-ratio rectangle block |
| `button-bar` | a row of two rounded pill blocks (action bar placeholder) |

### states

- **active shimmer** (skeleton, `active=true`): a CSS `@keyframes` shimmer gradient animates over
  the placeholder bars; uses `prefers-reduced-motion: reduce` → animation is suppressed, static
  colour only.
- **static** (skeleton, `active=false`): solid `--lv-skeleton-bg` colour, no animation.
- **overlaying** (section mode): the wrapper has `aria-busy="true"`; the spinner is rendered; the
  content slot is present but visually dimmed (`opacity: 0.4`) and `inert` (pointer-events disabled
  via `--lv-pointer-events-none`); the live region carries the label.
- **done** (section mode, `loading=false` equivalent — achieved by NOT rendering this partial and
  instead rendering the real content directly): the wrapper has no `aria-busy`, no overlay. The
  partial is simply not rendered; the real content renders in its place. No JS toggle.

All states are expressed as server-rendered markup differences, not client-side class toggles.
The consuming template or WIRE component re-renders the page with or without the partial.

## 4. The a11y contract

- **WAI-ARIA pattern**: No dedicated APG pattern. Built against:
    - `role=status` (ARIA 1.2 §role-definitions, MDN):
      implicit `aria-live="polite"` + `aria-atomic="true"`, no focus change on update.
    - `aria-busy` (ARIA 1.2 §aria-busy, MDN):
      global state; `true` = element being updated; AT waits before announcing partial content.
    - WCAG 4.1.3 Status Messages (Level AA):
      loading state must be programmatically determinable WITHOUT receiving focus.
    - Cited authorities:
      https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role
      https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-busy
      https://www.w3.org/WAI/WCAG22/Understanding/status-messages

- **roles + ARIA attributes**:

  **Spinner and skeleton modes** (standalone, no wrapped content):
    - root element: `<div role="status" aria-label="${label}" aria-live="polite" aria-atomic="true">`
      (explicit `aria-live` + `aria-atomic` mirror the implicit defaults to ensure cross-AT
      consistency; MDN recommends explicit values for broader support)
    - label span: `<span class="sr-only">${label}</span>` inside the `role=status` container so
      the full text is in scope for `aria-atomic="true"` announcement.
    - visual SVG ring (spinner) or shimmer bars (skeleton): `aria-hidden="true"` — purely decorative.
    - when `active=false` (skeleton, static): `role=status` remains; label still in DOM so a lazy
      AT that polls still finds it.

  **Section mode** (spinner wrapping real content):
    - outer wrapper: `<div aria-busy="true" class="lv-loading-section-wrap ...">` —
      signals the region is updating; AT defers partial-content announcements.
    - live region for tip/label: a separate `<div role="status" aria-live="polite"
      aria-atomic="true" aria-label="${label}"><span class="sr-only">${label}</span></div>` —
      always present and always contains the current label so AT announces it on update.
    - overlay spinner container: `aria-hidden="true"` (the visual spinner is decorative; the
      `role=status` live region carries the semantic).
    - tip text (when `showTip=true`): rendered as a visible `<span>` INSIDE the `role=status`
      container so `aria-atomic="true"` includes it in the polite announcement.
    - content slot wrapper: the rendered content sits in a sibling `<div>` at normal z-index;
      it carries no special ARIA (its own semantics are intact; the parent `aria-busy` covers it).
    - when `fullPage=true`: the wrapper is `position: fixed`; no additional ARIA change needed —
      `aria-busy` on the fixed wrapper still applies.

- **keyboard map**:

  | key | does | who |
  |---|---|---|
  | (none) | loading indicators are non-interactive | — |

  No keyboard interaction is defined or expected. The `role=status` live region MUST NOT receive
  focus on update (ARIA spec + MDN). The `inert` content in `section` mode cannot be focused
  while `aria-busy="true"` (handled by CSS `pointer-events: none` + optional `tabindex="-1"` on
  the content wrapper — see §6). There is no dismiss key, no activation, no arrow navigation.

- **focus management**: NONE. This is a passive live region.
    - Focus MUST NOT move to the `role=status` element when it updates (ARIA + WCAG 4.1.3 rule:
      "status messages must be programmatically determinable WITHOUT receiving focus").
    - The consuming WIRE or controller that triggers the loading state retains focus on whatever
      element the user was on; focus does not move.
    - In `section` mode the content's own tab stops become unreachable while the overlay is active
      (the `inert` CSS approach); focus remains on whatever was active before the overlay appeared.
    - When loading ends (the partial is no longer rendered), focus naturally returns to wherever it
      was; no explicit restore logic is needed because the partial was never the focus owner.

- **live region**: the `role=status` element IS the live region. Announcement model:
    - `aria-live="polite"`: the AT waits for the user to be idle before announcing the label text.
      This matches the non-urgent nature of loading feedback ("Loading…" does not interrupt a user
      mid-sentence).
    - `aria-atomic="true"`: the entire content of the `role=status` element is announced as one
      unit when it changes, not piecemeal.
    - The label text MUST be present in the DOM at the time the `role=status` element is first
      parsed; the AT registers the live region on DOM insertion. The server renders both the element
      AND its label text on the same response — no JS injection is needed.
    - On removal (loading complete): the partial is simply not rendered; AT does not announce removal
      of polite live regions (AT-specific but generally silent on removal).

- **reduced motion**: the shimmer `@keyframes` animation and the spinner rotation animation MUST
  be suppressed when `@media (prefers-reduced-motion: reduce)`. In reduced-motion context:
  skeleton → static grey bars; spinner → a static ring (no rotation). The `role=status` label is
  unchanged; the AT experience is identical.

- **shared mechanism composed**: none. This is a passive PARTIAL — no focus trap, no collection
  nav, no popover seam. The live-region announcer pattern (shared across toast, form error summary,
  and async loading per §4 of `03-component-inventory.md`) is implemented directly here; this
  component IS one of the canonical consumers of that pattern. The shared announcer utility
  (referenced in the inventory table row for toast) is NOT composed here because the loading label
  is server-rendered markup in a persistent DOM node, not a JS-injected string — no JS insertion is
  needed and the server-rendered `role=status` element covers the requirement.

## 5. Tokens

**Consumed tokens** (all must resolve from `var(--lv-*)`; no literal colour or spacing values):

| token | where used |
|---|---|
| `--lv-color-muted-fg` | spinner stroke (variant=default) |
| `--lv-color-primary` | spinner stroke (variant=primary) |
| `--lv-color-muted` | skeleton shimmer base background |
| `--lv-color-muted-fg` | skeleton shimmer highlight (lighter pass over base) |
| `--lv-color-overlay` | section mode scrim behind the spinner overlay |
| `--lv-color-fg` | tip text colour in section mode |
| `--lv-color-bg` | spinner background circle (visible in section overlay) |
| `--lv-space-3` | sm skeleton line height |
| `--lv-space-4` | sm spinner wrapper; md skeleton line height |
| `--lv-space-5` | lg skeleton line height |
| `--lv-space-6` | md spinner wrapper; gap between spinner and tip |
| `--lv-space-10` | lg spinner wrapper |
| `--lv-space-2` | skeleton line gap (between rows) |
| `--lv-radius-full` | skeleton line bar border-radius (pill shape) |
| `--lv-radius-sm` | skeleton card/image block border-radius |
| `--lv-text-sm` | tip text size |
| `--lv-font-sans` | tip text font |
| `--lv-motion-duration-base` | spinner rotation animation duration |
| `--lv-motion-easing-linear` | spinner rotation easing (`linear` for a steady spin) |
| `--lv-z-overlay` | section fullPage=true z-index |
| `--lv-z-popover` | section fullPage=false z-index (spinner sits above content, below modals) |

**NET-NEW tokens** (proposed; additive; go in both `:root` + `.dark` blocks in `lievit-tokens.css`):

| token | value (`:root`, OKLCH) | value (`.dark`, OKLCH) | justification |
|---|---|---|---|
| `--lv-skeleton-bg` | `oklch(0.93 0.005 264)` | `oklch(0.24 0.008 264)` | the shimmer base plate colour; current `--lv-color-muted` is too dark on light and too light on dark for a convincing skeleton; this dedicated token lets adopters rebrand skeletons independently of muted text |
| `--lv-skeleton-shimmer` | `oklch(0.97 0.003 264)` | `oklch(0.30 0.006 264)` | the shimmer highlight pass; lighter than `--lv-skeleton-bg` by a fixed lightness step (OKLCH makes this trivially verifiable: ΔL ≈ 0.04); referenced in the `@keyframes` gradient |
| `--lv-motion-easing-linear` | `linear` | same | spinner rotation needs a true linear easing; the existing `--lv-motion-easing-*` tokens cover ease-in/out but not a steady constant-speed spin; also reused by progress indeterminate |
| `--lv-pointer-events-none` | `none` | same | structural token for disabling pointer events on inert overlay content; allows adopter override if needed; avoids hardcoding `pointer-events: none` as a literal |

No new colour token may be a literal colour baked into a component — all four above go into the
token file and reference `var(--lv-skeleton-bg)` etc. in the component body.

## 6. Wire / island integration

**This component is STATIC — no typed-TS enhancer, no wire actions, no lievit directives.**

The server renders the partial; the client morphs when the parent WIRE component re-renders without it.
No JS is required for loading state management.

### Server-rendered JTE structure

**Spinner mode** (`mode="spinner"`):

```
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  aria-label="${label}"
  data-slot="loading-section"
  data-mode="spinner"
  data-size="${size}"
  data-variant="${variant}"
  class="lv-spinner [size + variant utility classes] ${cssClass}"
  ${attrs}>
  <svg aria-hidden="true" focusable="false" class="lv-spinner__ring" viewBox="0 0 24 24">
    <!-- original SVG ring: a background circle + a foreground arc; the arc
         has a stroke-dasharray animation that gives the "chasing" effect;
         both circles rendered as <circle> elements with stroke=currentColor;
         the root SVG gets the spinner size via width/height from the size token -->
  </svg>
  <span class="sr-only">${label}</span>
</div>
```

The `sr-only` span is redundant with `aria-label` but is present for `aria-atomic="true"` — some AT
implementations read the DOM text of the live region, not the `aria-label`. Both carry the same text.

**Skeleton mode** (`mode="skeleton"`):

```
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  aria-label="${label}"
  data-slot="loading-section"
  data-mode="skeleton"
  data-shape="${skeletonShape}"
  data-active="${active}"
  data-size="${size}"
  class="lv-skeleton ${active ? 'lv-skeleton--active' : ''} ${cssClass}"
  ${attrs}>
  <span class="sr-only">${label}</span>
  <%-- shape-specific placeholder markup (lines / card / avatar-row / image / button-bar) --%>
  <%-- each bar: <div aria-hidden="true" class="lv-skeleton__bar" style="width: [var]"></div> --%>
  <%-- widths are pre-computed on the server into a local !{var rows = ...} string list;
       they must NOT be DB-derived or user-supplied (use the fixed preset widths from
       the shape spec + a deterministic server-side cycle — not Math.random()) --%>
</div>
```

The shimmer animation is a CSS-only `@keyframes` gradient sweep over the `lv-skeleton__bar` elements;
no JS required. `data-active="false"` suppresses the animation class. The `prefers-reduced-motion`
media query in the CSS file stops the keyframes animation when the OS preference is set.

**Section mode** (`mode="section"`):

```
<div
  aria-busy="true"
  data-slot="loading-section"
  data-mode="section"
  data-full-page="${fullPage}"
  class="lv-loading-section [fullPage utility classes] ${cssClass}"
  ${attrs}>

  <%-- 1. Live region (always present, carries the semantic; not the spinner) --%>
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    class="lv-loading-section__status">
    <span class="sr-only">${label}</span>
    !{if showTip}
    <span class="lv-loading-section__tip" aria-hidden="false">${label}</span>
    !{end if}
  </div>

  <%-- 2. Spinner overlay (decorative; positioned absolute/fixed over the content) --%>
  <div aria-hidden="true" class="lv-loading-section__overlay">
    @template.lievit.loading-section(mode="spinner", size=size, variant=variant, label="", cssClass="lv-loading-section__spinner")
    <%-- note: label="" because this nested spinner renders inside aria-hidden; the semantic
         is carried by the role=status sibling above, not by this decorative spinner --%>
  </div>

  <%-- 3. Content (server-rendered, present but inert while loading) --%>
  <div class="lv-loading-section__content" tabindex="-1">
    ${content}
  </div>

</div>
```

The `tabindex="-1"` on the content wrapper (combined with the CSS `pointer-events: none` via
`--lv-pointer-events-none`) makes the real content unreachable by keyboard and pointer while the
overlay is active. The `tabindex` value is not set via JS — it is server-rendered on every response
where the section is in loading state. When the section is no longer loading, the consuming template
renders the content directly (without this partial), and the wrapper and its `tabindex="-1"` are
gone from the DOM.

### data-* hooks

| attribute | purpose |
|---|---|
| `data-slot="loading-section"` | root selector for axe-core tests + Playwright finders |
| `data-mode="spinner|skeleton|section"` | test selector for mode assertions |
| `data-size="sm|md|lg"` | test selector for size assertions |
| `data-variant="default|primary"` | test selector for variant assertions |
| `data-shape="lines|card|avatar-row|image|button-bar"` | test selector for skeleton shape assertions (skeleton mode only) |
| `data-active="true|false"` | test selector for shimmer active state |
| `data-full-page="true|false"` | test selector for fullPage overlay mode |

### No enhancer

There is no `.enhancer.ts` file for this component. All behaviour is CSS + server-rendered ARIA.
The lievit runtime does NOT need to mount anything for this partial. No `data-lievit-component`,
no `l:*` directives, no `Lievit-Snapshot` header.

The consuming WIRE component sets its own `@Wire boolean loading` field and renders this partial
(or not) accordingly. The WIRE's `aria-busy` lifecycle hook (the runtime's `beforeCall` /
`afterCall` mechanism described in `00-architecture-contract.md` §5.c) is a DIFFERENT mechanism —
it applies to the WIRE component's own root during a wire round-trip, not to this partial.
This partial is the CONTENT-LEVEL loading gate (full section, skeleton, spinner); the wire
`aria-busy` is the micro-interaction gate (button spinner during a 200 ms server call).

## 7. Acceptance tests

All tests run on a REAL substrate — jsdom for static render + CSS assertions; no mocked partial
renderer; the axe-core test uses the real JTE-compiled output. "Mocked substrate certifies nothing"
(repo CLAUDE.md client-island-fidelity lesson).

**Render tests** (jsdom, real JTE compiler output):

- **`spinner_renders_role_status_with_label`**: `mode=spinner`, assert the root has `role="status"`,
  `aria-live="polite"`, `aria-atomic="true"`, `data-slot="loading-section"`, `data-mode="spinner"`;
  the `.sr-only` span text equals the `label` param; the SVG has `aria-hidden="true"`.
- **`skeleton_renders_correct_row_count`**: `mode=skeleton`, `skeletonShape=lines`, `skeletonRows=4`;
  assert exactly 4 `.lv-skeleton__bar` elements with `aria-hidden="true"` are present; the root
  has `role="status"` + the visually-hidden label.
- **`skeleton_active_flag_controls_animation_class`**: `active=true` → root has class
  `lv-skeleton--active`; `active=false` → class absent; `data-active` attribute reflects both.
- **`section_mode_renders_aria_busy_on_wrapper`**: `mode=section`; assert the root has
  `aria-busy="true"` (NOT `role=status` on the root — the wrapper is the busy container); assert a
  child `[role=status]` element exists; assert `data-slot="loading-section"` on the root.
- **`section_mode_content_slot_is_present_and_inert`**: `mode=section`, `content` slot contains a
  `<button>Foo</button>`; assert the button is in the DOM (content IS rendered — the server does
  not hide it, the CSS does); assert the content wrapper has `tabindex="-1"`; assert the overlay
  `div` is present with `aria-hidden="true"`.
- **`section_full_page_sets_data_attribute`**: `mode=section`, `fullPage=true`; assert
  `data-full-page="true"` on the root.
- **`show_tip_renders_visible_label`**: `mode=section`, `showTip=true`, `label="Caricamento…"`;
  assert a `.lv-loading-section__tip` element with `aria-hidden="false"` is present and its text
  equals the label; assert the `sr-only` span ALSO contains the same text (both present for
  `aria-atomic` completeness).
- **`show_tip_false_omits_visible_label`**: `mode=section`, `showTip=false`; assert no
  `.lv-loading-section__tip` element in the DOM.
- **`skeleton_shapes_render_distinct_structure`**: one test per `skeletonShape` value
  (`lines`, `card`, `avatar-row`, `image`, `button-bar`); assert the DOM structure matches the
  shape's documented placeholder (e.g. `avatar-row` has a `.lv-skeleton__avatar` circle + two
  `.lv-skeleton__bar` line elements).
- **`label_empty_string_is_valid_for_nested_spinner`**: a spinner rendered as a decorative child
  (inside section overlay, `aria-hidden="true"` parent) with `label=""`; assert the root has
  `aria-label=""` (empty label is intentional here because the outer `role=status` carries the
  semantic — not a bug); axe rule `region` does not fire because the element is inside `aria-hidden`.

**axe-core assertions** (on the JTE-compiled real HTML, zero violations of the listed rules):

- **`spinner_passes_axe_status_role_rules`**: `mode=spinner`; axe rules: `aria-required-children`,
  `aria-valid-attr-value`, `aria-hidden-focus`, `region`; assert zero violations.
- **`skeleton_passes_axe_status_role_rules`**: `mode=skeleton`; same rule set.
- **`section_passes_axe_aria_busy_rules`**: `mode=section` with real content in the slot; axe rules:
  `aria-required-attr`, `aria-valid-attr-value`, `aria-hidden-focus`, `region`,
  `duplicate-id-active`; assert zero violations. (Confirms that nesting a spinner with `aria-label=""`
  inside an `aria-hidden` parent does not trigger accessible-name violations on the hidden subtree.)
- **`icon_only_spinner_has_accessible_name`**: `mode=spinner`, `label="Attendere"` (non-empty);
  assert no `aria-label` or accessible-name violations (the component's `role=status` + `aria-label`
  give it a programmatic name; WCAG 4.1.2 name/role/value satisfied).

**Keyboard tests**: NOT APPLICABLE — no keyboard interaction is defined (§4 keyboard map: none).
A test asserting that `role=status` does NOT appear in the tab order:
- **`loading_section_not_in_tab_order`**: all three modes; assert the root element has no
  `tabindex` attribute (or `tabindex="-1"` at most); assert the element is NOT reachable via
  simulated Tab key from a preceding button in jsdom.

**Variant / size tests**:

- **`size_param_sets_data_size_and_token_class`**: `sm`, `md`, `lg` each produce
  `data-size="<size>"` on the root + the size-specific Tailwind token class (e.g. `h-[var(--lv-space-6)]`
  for md spinner wrapper); assert all three.
- **`variant_param_sets_data_variant`**: `default` and `primary` produce `data-variant="<variant>"`;
  assert stroke colour class references `--lv-color-muted-fg` vs `--lv-color-primary`.

**Reduced-motion test**:

- **`skeleton_active_false_when_reduced_motion`**: this is a CSS-only contract; the test asserts the
  `@media (prefers-reduced-motion: reduce)` block in the component's compiled CSS sets the
  `lv-skeleton--active` animation to `animation-duration: 0s` or `animation: none` — asserted by
  parsing the compiled stylesheet; no browser required.

**JTE compile + render gate**: covered by the repository-wide `test/jte-compile` real-compiler
gate; this partial must compile without error in all three `mode` values as part of that gate.

**Escaping** (the XSS abuse-case):
- **`data_attrs_hostile_value_renders_inert`**: pass `dataAttrs={hook: "\">|<script>alert(1)</script>"}`;
  assert the rendered HTML contains the escaped string (`&quot;` etc.) and does NOT contain a
  `<script>` tag; `attrs` is documented TRUSTED and NOT fed user data in any test.

## 8. Non-goals / anti-patterns

- **NOT a wire component**: this partial has no `@Wire` fields, no wire actions, no round-trip of
  its own. It does not call the server. It does not manage its own loading state. The consuming
  controller or WIRE component owns the `loading` boolean; this partial renders when told.
- **NOT a progress bar**: for quantified progress (`0–100 %`), use the `progress` PARTIAL
  (`role=progressbar`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`). This component covers
  indeterminate / unknown-duration loading only. Mixing the two in one component conflates semantically
  distinct ARIA roles.
- **NOT a toast / alert**: this partial does NOT announce errors. Error messages use `role=alert`
  (`aria-live=assertive`, interrupts immediately). Loading state is non-urgent → `role=status`
  (`aria-live=polite`). Do not change `aria-live` to `assertive` on this component for any loading
  scenario.
- **NOT an overlay that traps focus**: unlike `dialog`, this component does NOT focus-trap. The
  content is marked inert (pointer-events + tabindex) but the section partial is never the focus
  owner. A full-page loading gate (`fullPage=true`) dims the page but does NOT trap focus — if a
  true modal gate with trapped focus is needed, compose a `dialog` instead.
- **No skeleton widths from user data**: the `skeletonRows` line widths MUST NOT be derived from
  user input or database values (they are decorative). They use a fixed deterministic server-side
  width preset cycle. This rule prevents XSS via inline styles and also prevents width-pattern
  fingerprinting (if skeleton widths matched actual content, they would leak content length).
- **No JS-toggled loading state**: the consuming template re-renders the entire section (with or
  without this partial) on each server response. Do NOT add JS that toggles a CSS class or
  `aria-busy` client-side to avoid a round-trip. The bespoke morph is fast; avoid the client-side
  imperative approach that duplicates server truth.
- **No `aria-live=off` on the `role=status` container**: even when the spinner is decorative
  (section mode nested spinner with `aria-hidden="true"` parent), the `role=status` live region
  OUTSIDE the `aria-hidden` subtree must remain active. Never silence the live region to "reduce
  noise" — use `aria-label=""` on the decorative nested spinner (which sits inside `aria-hidden`)
  instead.
- **No `aria-busy` without a `role=status` companion**: the `aria-busy` on the section wrapper
  suppresses partial-content announcements; the `role=status` live region is required to fill the
  semantic gap — it is what actually announces the loading label. Never ship `aria-busy` alone
  (the user would hear nothing from AT). The two attributes are complementary, not interchangeable.
- **No Lit, no Alpine, no framework inside this partial**: the shimmer animation and spinner
  rotation are CSS-only. No `<script>` or inline `on*=` handler. The CSP blocks them; the
  server-first spine does not need them here.
