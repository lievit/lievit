<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — aspect-ratio

- **tier**: PARTIAL
- **build sequence**: S2 (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/aspect-ratio.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: no WAI-ARIA APG pattern applies — this is a pure CSS layout wrapper; the semantic role, name,
      and landmark belong entirely to the content inside it (images carry `alt`, videos carry their own
      accessible name). See §4 for the negative confirmation.
    - inventory: Ant Design (no equivalent — Ant Design delegates this to CSS utilities; shadcn/ui
      `AspectRatio` used as inventory reference for the wrapper + padding-top trick vs modern
      `aspect-ratio` property baseline)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; no special look; the component IS the
      constraint — visual polish is in the token-driven border/radius/overflow it optionally applies

## 1. What it is

A presentational layout wrapper that constrains a block to a fixed width-to-height ratio. Its single
responsibility is to maintain the declared ratio regardless of the available width, making it trivially
composable for responsive images, embedded videos, maps, skeleton placeholders, or any content that
must not reflow into an unwanted aspect.

The implementation uses the CSS `aspect-ratio` property (baseline in all browsers since 2022) as the
primary mechanism, with a CSS custom property (`--lv-ar-ratio`) to carry the computed ratio so the
`@param` integers stay typed Java instead of a formatted string. There is no JavaScript, no server
state, no open/close, no selection: the content defines the accessible semantics, and the wrapper is
presentationally neutral. PARTIAL is the unambiguous tier choice.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `ratioX` | `int` | `16` | the width part of the ratio (e.g. 16 in 16:9) |
| `ratioY` | `int` | `9` | the height part of the ratio (e.g. 9 in 16:9) |
| `overflow` | `String` | `"hidden"` | CSS overflow behaviour on the inner content element: `"hidden"` \| `"visible"` \| `"auto"` — emitted as a Tailwind utility class (`overflow-hidden`, `overflow-visible`, `overflow-auto`) |
| `rounded` | `String` | `""` | token-driven corner radius: `""` (none) \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"` \| `"full"` — mapped to `--lv-radius-*` via a Tailwind token class |
| `border` | `boolean` | `false` | renders a `1px` border using `--lv-color-border` |
| `cssClass` | `String` | `""` | extra utility classes appended to the OUTER element |
| `innerClass` | `String` | `""` | extra utility classes appended to the INNER content element |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `id="…"`, `data-testid="…"`); never fed dynamic or user-supplied values |
| `content` | `gg.jte.Content` | — | the child content (image, video, iframe, skeleton, map, or any block) — mandatory |

**Notes on the ratio computation**: the ratio is expressed as two typed `int` params rather than a
pre-formatted `String` (e.g. `"16/9"`) so the Java call-site stays type-safe and the partial owns the
formatting. Internally the template builds the CSS custom property value with `!{var ratio =
ratioX + " / " + ratioY}` and emits `style="--lv-ar-ratio: ${ratio};"` on the outer element. This
keeps the ratio a pure CSS fact: the inner element reads `aspect-ratio: var(--lv-ar-ratio)`.

**No `dataAttrs` / `wireArgs` channel**: this component never receives per-row server data that needs
escaping — the ratio is an authoring-time literal from the template author, not a DB value. The
`attrs` trusted-raw channel is present only for `id` / `data-testid` / test hooks; it must never be
fed user-supplied strings.

**No `leading` / `trailing` / `footer` slots**: the `content` slot IS the entire interior. There is no
decorative affordance that belongs to the wrapper; any overlay (a play-button, a badge) is
the adopter's content placed absolutely inside the content slot.

## 3. Variants / sizes / states

### Variants (ratios in common use)

There is no `variant` param in the token-intent vocabulary sense: the component does not express an
INTENT, it expresses a CONSTRAINT. The ratio is always a numeric pair. However, the spec notes the
canonical ratios an adopter will commonly pass and verifies the output is visually correct for each:

| common ratio | `ratioX` / `ratioY` | typical use |
|---|---|---|
| 16:9 (default) | 16 / 9 | video, hero images, media cards |
| 4:3 | 4 / 3 | older media, document thumbnails |
| 1:1 (square) | 1 / 1 | avatar frames, product thumbnails |
| 3:2 | 3 / 2 | photography (35mm) |
| 21:9 | 21 / 9 | cinematic / wide banner |
| 2:3 | 2 / 3 | portrait (book cover, story card) |
| 9:16 | 9 / 16 | mobile video (Reels/Shorts shape) |

Any positive integer pair is valid; the list above is documentation, not an enum.

### Sizes

There is no `size` param: the component takes up the width of its container (block by default) and the
height is derived from the ratio. Making the component narrower is the adopter's concern (wrap it in a
column, set a `max-w-*` on it via `cssClass`).

### States

The component has no interactive states. It is presentationally static. The content inside it may
carry its own interactive states (a focusable image link, a playing video) — those states are owned
by the content, not the wrapper.

There is one layout-only conditional to note: when `overflow="hidden"` (the default), content that
overflows the ratio box is clipped. This is correct for images that fill the box (`object-cover`). An
adopter who needs the content to bleed out (e.g. a popover that opens from inside) sets
`overflow="visible"`.

### Slots

| slot | type | notes |
|---|---|---|
| `content` | `gg.jte.Content` | mandatory; the inner block element (image, video, iframe, skeleton, etc.) |

## 4. Accessibility

- **WAI-ARIA pattern**: NONE. This is a pure CSS layout wrapper. The W3C WAI-ARIA APG
  (https://www.w3.org/WAI/ARIA/apg/patterns/) defines no pattern for an aspect-ratio container because
  such a wrapper is semantically transparent: screen readers and assistive technologies see through it
  to the content inside. Adding any ARIA role to the wrapper would interfere with the content's own
  landmark / role / name.
  The negative confirmation was verified against the APG patterns index and the HTML specification's
  "transparent" content model concept. Cited URL: https://www.w3.org/WAI/ARIA/apg/patterns/

- **Roles + ARIA emitted by the template**: none on the wrapper elements. The outer element is a
  plain `<div>` (no `role`, no `aria-*`). The inner content element is also a plain `<div>` (no
  `role`, no `aria-*`). Role, accessible name, and description belong to the content inside:
  - an `<img>` inside carries `alt` (mandatory, supplied by the adopter's content slot);
  - a `<video>` inside carries its own accessible controls;
  - an `<iframe>` inside carries `title`;
  - a skeleton placeholder inside may carry `aria-busy="true"` (see `loading-section` spec).

- **Keyboard map**:

  | key | action | who |
  |---|---|---|
  | (none) | the wrapper is non-interactive and never receives focus | — |

  The wrapper itself is never focusable. If the content inside is focusable (an `<a>`, `<button>`, or
  `<video controls>`), the platform supplies focus + keyboard for it unchanged — the wrapper does not
  intercept or redirect keyboard events.

- **Focus management**: none. No initial focus, no focus trap, no roving tabindex. The wrapper is
  display-only; focus passes directly through it to whatever focusable element the content contains.

- **Live region**: none. The wrapper does not announce anything. Loading states inside it belong to
  the content (e.g. a skeleton with `aria-busy`).

- **Shared mechanisms composed**: none. This component is the simplest possible tier: a CSS wrapper,
  no enhancer, no popover seam, no focus-trap, no collection-nav.

- **Implementation note**: the outer `<div>` MUST NOT carry `role="img"` even when the content is an
  image — the `<img>` itself carries the role and `alt`. Adding `role="img"` on the wrapper would
  double-announce the image to screen readers.

## 5. Tokens

The component reads a small set of structural `--lv-*` tokens. All colour tokens are OKLCH; no
literal colours appear in the template body.

| token | purpose | where used |
|---|---|---|
| `--lv-radius-sm` | rounded="sm" corner radius | `rounded-[var(--lv-radius-sm)]` on outer element |
| `--lv-radius-md` | rounded="md" corner radius | `rounded-[var(--lv-radius-md)]` on outer element |
| `--lv-radius-lg` | rounded="lg" corner radius | `rounded-[var(--lv-radius-lg)]` on outer element |
| `--lv-radius-xl` | rounded="xl" corner radius | `rounded-[var(--lv-radius-xl)]` on outer element |
| `--lv-radius-full` | rounded="full" pill/circle radius | `rounded-[var(--lv-radius-full)]` on outer element |
| `--lv-color-border` | border colour (when `border=true`) | `border border-[var(--lv-color-border)]` on outer element |
| `--lv-ar-ratio` | the computed ratio as a CSS custom property | `aspect-ratio: var(--lv-ar-ratio)` on the inner element |

**NET-NEW token: `--lv-ar-ratio`** — a component-scoped CSS custom property, set inline as a
`style` attribute on the outer element (`style="--lv-ar-ratio: ${ratioX} / ${ratioY};"`). It is not
a design token in the `:root` sense (it carries a per-instance computed value, not a design decision),
but it is namespaced `--lv-` to stay within the library's CSS custom property namespace and to be
overridable by an adopter who needs to dynamically change the ratio from a CSS rule. It requires no
addition to `lievit-tokens.css` (it is a runtime value, not a design constant). No entry in the dark-
mode re-point block is needed because it is not a colour token.

**Tokens NOT read**: spacing, typography, shadow, z-index tokens — the wrapper has no intrinsic
padding, text, elevation, or z-stack. Those are the content's concern.

## 6. Wire / island integration

**Static, no enhancer.**

The component is a two-element JTE partial: an outer wrapper `<div>` and an inner content `<div>`.
It holds no server state, fires no wire actions, has no enhancer, and does not use the lievit runtime.

**Server-rendered JTE structure**:

```
outer <div>  [data-slot="aspect-ratio"]  [data-ratio="${ratioX}:${ratioY}"]
             style="--lv-ar-ratio: ${ratioX} / ${ratioY};"
             [class: overflow, rounded, border, cssClass]
             [attrs: trusted-raw]
  inner <div> [data-slot="aspect-ratio-inner"]
              class="size-full [innerClass]"
              style="aspect-ratio: var(--lv-ar-ratio);"
    ${content}   ← the adopter's image / video / iframe / skeleton
```

The `data-slot="aspect-ratio"` on the outer and `data-slot="aspect-ratio-inner"` on the inner
serve as test selectors and as the styling hook convention (consistent with the rest of the library).
`data-ratio="${ratioX}:${ratioY}"` (e.g. `data-ratio="16:9"`) is a convenience attribute for
debugging and for adopter CSS selectors (`[data-ratio="1:1"] { … }`); the value is author-supplied
integers and is safe to render without escaping.

**Why two elements?** A single element with `aspect-ratio` on it works for simple cases, but it
gives the adopter no clean hook for `overflow: hidden` without clipping the border-radius, and it
makes the `innerClass` override more complex. The two-element pattern (outer constrains the shape +
radius + border; inner enforces the ratio + receives the content) is the pattern used by every
major CSS framework for this component; it is idiomatic and learnable. The outer handles visual
framing (radius, border, overflow clipping at the right layer); the inner enforces the numeric ratio.

**No `l:*` directives, no wire actions, no round-trips.** The partial is rendered once by the server
and never patched by the lievit runtime (nothing changes on interaction, because there is no
interaction). It composes naturally inside a WIRE template as static markup.

## 7. Acceptance tests

The component is DONE only when ALL of the following pass on a REAL substrate (jsdom for a PARTIAL —
the correct substrate; no LievitRuntime needed because there is no enhancer):

- **render — ratio CSS is emitted correctly**: render with `ratioX=16, ratioY=9`; assert the outer
  element has `style` containing `--lv-ar-ratio: 16 / 9`; assert the inner element has
  `style` containing `aspect-ratio: var(--lv-ar-ratio)`.

- **render — non-default ratio**: render with `ratioX=1, ratioY=1`; assert `--lv-ar-ratio: 1 / 1`
  in the outer style attribute.

- **render — data-slot attributes present**: assert outer has `data-slot="aspect-ratio"` and inner
  has `data-slot="aspect-ratio-inner"`.

- **render — data-ratio attribute**: assert outer has `data-ratio="16:9"` for the default ratio.

- **render — content projected**: render with a `<img alt="test">` as content; assert the `<img>` is
  present inside the inner element (the content slot is correctly filled — this is the projection
  assertion the template convention requires).

- **render — overflow variants**: render with `overflow="visible"`; assert the inner element carries
  `overflow-visible`. Repeat for `overflow="auto"` and the default `overflow="hidden"`.

- **render — rounded variants**: render with `rounded="lg"`; assert the outer element carries the
  Tailwind class that resolves to `--lv-radius-lg`. Render with `rounded=""`; assert no radius
  class is emitted.

- **render — border=true**: assert the outer element carries the border utility class and the token
  class that resolves to `--lv-color-border`. Render with `border=false` (default); assert no border
  class.

- **render — cssClass and innerClass pass-through**: render with `cssClass="max-w-sm"` and
  `innerClass="bg-muted"`; assert each appears on its respective element.

- **axe-core — zero violations**: run axe on the rendered DOM (outer + inner + a sample `<img
  alt="A mountain landscape">` as content); assert zero violations. The `alt` is on the image, not
  the wrapper — this test confirms the wrapper introduces no a11y violation of its own.

- **axe-core — image with empty alt (decorative)**: render with `<img alt="">` (a decorative image);
  assert zero axe violations (an empty `alt` is correct for decorative images; the wrapper must not
  fail for this case).

- **no focusable wrapper**: assert neither the outer nor the inner element has a `tabindex` or
  `role` attribute (the wrapper is semantically transparent).

- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate.

## 8. Non-goals / anti-patterns

- **Do NOT add a `role` or `aria-label` to the wrapper.** The wrapper is a CSS layout primitive; it
  has no semantic meaning of its own. An `<img>` inside it carries `alt`; a `<video>` carries its own
  accessible controls. Adding `role="img"` on the wrapper would double-announce the content.

- **Do NOT use the old padding-top hack** (`padding-top: 56.25%` for 16:9). The `aspect-ratio` CSS
  property is the correct modern mechanism (baseline 2022). The padding hack produced non-semantic
  markup that required an absolutely-positioned inner element; the CSS property produces clean,
  readable markup.

- **Do NOT accept a `ratio` `String` param** (e.g. `"16:9"` or `"16/9"`). String params for ratios
  require format documentation, validation, and produce XSS surface if ever fed from user input. Two
  typed `int` params (`ratioX`, `ratioY`) are type-safe and the formatting is owned by the template.

- **Do NOT accept a pre-formatted `style` attribute** for the ratio. The ratio must flow through the
  `--lv-ar-ratio` CSS custom property path so that the wrapper is overridable via CSS and the
  component follows the no-literal-value rule.

- **Do NOT clip content by default at the outer element.** The outer element's `overflow` governs
  clipping for visual framing (border-radius cropping); the inner element is `size-full` to fill the
  constrained box. Content that intentionally exceeds the box (e.g. a tooltip anchor inside) can use
  `overflow="visible"` on the outer to escape the clip.

- **Do NOT make the outer or inner element a flex/grid container.** That is the adopter's concern for
  the content inside. The wrapper is purely a sizing/ratio constraint; layout direction belongs to the
  content slot.

- **Do NOT add JavaScript** for ratio detection, resize observers, or polyfills. The `aspect-ratio`
  CSS property has full browser support for the targeted baseline; no JS is needed or acceptable.

- **Do NOT compose this component inside itself.** Nesting aspect-ratio wrappers produces undefined
  dimensional behaviour; the content slot should be a real media element or a flat block.

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. The visual output is purely structural (no colour, no
shadow, no typography on the wrapper itself); the token surface is the radius + border set in §5. The
ratio mechanism is a CSS custom property set inline; use `!{var ratio = ratioX + " / " + ratioY}` in
the JTE local-var block before the HTML. Mirror `button.jte` house conventions exactly: header
doc-comment (TIER: PARTIAL, STRUCTURE: cite the `aspect-ratio` CSS property as the mechanism and the
two-element pattern as the structural decision, CREDITS as above), typed `@param`, `data-slot` on
both elements, zero `<script>`, zero `on*=`. The `attrs` channel is present (trusted-raw, `$unsafe`)
for `id`/`data-testid`; there is no `dataAttrs`/`wireArgs` channel because no per-row DB value flows
through this component. The acceptance tests in §7 are the gate — run all of them, assert the
projection (content visible inside inner), assert the ratio in the style attribute, assert axe passes.
Minimal code to GREEN.
