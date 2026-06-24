<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — icon

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/icon.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG SVG Accessibility + ARIA 1.2 §6.6 `img` role — two-mode contract:
      decorative (aria-hidden="true", removed from a11y tree) vs meaningful (role="img" + aria-label,
      placed in a11y tree with an accessible name). Platform-supplied; no react-aria reference needed
      because the SVG element carries the semantics once the two ARIA attributes are set correctly.
    - inventory: Lucide Icons as the canonical icon set (same set gest already ships); any
      host-supplied SVG string is accepted. Ant Design Icon as inventory reference for size tiers,
      spin/pulse animation, and rotation utilities.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI icon
      usage patterns (NO code copied)

## 1. What it is

A thin, server-rendered wrapper that emits a single inline SVG icon from the Lucide set (or a
caller-supplied raw SVG string) with precisely two accessibility modes baked in at render time:
**decorative** (aria-hidden, silent to screen readers) and **meaningful** (role="img" + aria-label,
readable as an image). The split is not a run-time toggle — it is a server-side param decision, which
is exactly why this is PARTIAL and not a wire component: the a11y mode and the icon identity are
facts the controller knows when it builds the model, and no client state is ever needed. Server-first
works perfectly: SVG markup is static HTML; there is nothing client about rendering an icon.

The component is the single delivery surface for every icon in the library, ensuring the decorative /
meaningful contract is applied consistently across 60+ consuming components rather than being
hand-implemented per call site. Every component that includes an icon (button `leading`/`trailing`,
badge, avatar, input prefix/suffix, sidebar nav item, alert, toast, etc.) composes THIS partial
instead of embedding raw SVG directly.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| name | String | — | **Required.** Lucide icon name in kebab-case (`"circle-check"`, `"chevron-down"`, `"user"`). The template resolves it to the bundled Lucide SVG string via a server-side registry map. |
| svgContent | String | null | **Alternative to `name`**: a TRUSTED raw SVG string (`$unsafe`) for caller-supplied custom icons not in the Lucide set. When set, `name` is ignored. The caller owns the SVG security boundary; `svgContent` must never carry user-generated input. |
| label | String | null | Accessible name. When `null` (or blank): decorative mode — `aria-hidden="true"`, removed from a11y tree. When non-null: meaningful mode — `role="img" aria-label="${label}"`, added to a11y tree with this label. **Required whenever the icon is the sole visual conveyance of meaning** (icon-only button, status indicator without adjacent text). |
| size | String | "md" | Icon bounding box: `xs` \| `sm` \| `md` \| `lg` \| `xl`. Maps to `--lv-icon-size-*` tokens (not the button `--lv-space-*` height-scale — icons have their own 5-step token scale to serve inline text, standalone display, and hero uses). |
| color | String | "inherit" | `inherit` \| `muted` \| `primary` \| `accent` \| `success` \| `warning` \| `destructive` \| `fg`. Maps to the matching `--lv-color-*` token. `inherit` (the default) means the icon inherits the surrounding text colour via `currentColor`, which is the correct default for icon-in-button / icon-in-label usage where the parent controls colour. |
| spin | boolean | false | Applies a CSS rotation animation (`--lv-motion-spin`). Used for loading spinners. Respects `prefers-reduced-motion` via the token. |
| pulse | boolean | false | Applies a CSS opacity-pulse animation (`--lv-motion-pulse`). Used for live/realtime indicators. Respects `prefers-reduced-motion`. |
| rotate | int | 0 | Rotates the icon by 0 \| 90 \| 180 \| 270 degrees via a CSS utility class. Zero means no rotation. |
| cssClass | String | "" | Extra utility classes appended to the wrapper `<span>`. |
| attrs | String | "" | **TRUSTED raw** (`$unsafe`) — STATIC author-typed HTML attribute strings only (e.g. `data-testid="icon-check"`). Never feed user-generated values here. |

### Notes on the two content channels

`name` resolves through a server-side `IconRegistry` map (a `Map<String,String>` of Lucide SVG
strings, populated once at startup, accessed by the JTE template via the registry instance injected
as a model attribute by a Spring `@ControllerAdvice`). The map is immutable after boot; no
per-request mutation. The SVG strings in the registry are trusted — they are bundled at build time
from the pinned Lucide release, not user input. They are emitted via `$unsafe` (the `attrs`
channel).

`svgContent` is the escape hatch for one-off custom icons (a brand mark, a proprietary glyph). It
bypasses the registry and emits the raw string via `$unsafe`. The caller is responsible for ensuring
this string is not user-sourced. The spec flags this because it is the one XSS-relevant decision in
an otherwise fully-safe partial.

## 3. Variants / sizes / states

### Sizes

The icon size scale is independent from the button/input `--lv-space-{8,9,10}` height scale.
Icons serve three different contexts (inline-with-text, standalone display, hero), so they need
their own 5-step scale:

| size param | token | value | use context |
|---|---|---|---|
| `xs` | `--lv-icon-size-xs` | 12px | footnotes, dense badges, caption inline |
| `sm` | `--lv-icon-size-sm` | 16px | inline with `text-sm` body copy, button sm leading/trailing |
| `md` | `--lv-icon-size-md` | 20px (default) | inline with base copy, button md/lg leading/trailing, nav items |
| `lg` | `--lv-icon-size-lg` | 24px | standalone display, section headers, sidebar top-level items |
| `xl` | `--lv-icon-size-xl` | 32px | hero / empty-state illustration icon, alert banner icon |

All five are NET-NEW tokens (see §5). The existing `registry/jte/icon.jte` likely hardcodes
pixel values; the re-forge migrates to the token scale.

The icon wrapper `<span>` is `inline-flex items-center justify-center` sized to the token; the SVG
is `width: 100%; height: 100%` inside it, respecting the token-driven bounding box. `flex-shrink-0`
prevents the icon from collapsing in a flex row.

### Color modes

| color param | rendered token | meaning |
|---|---|---|
| `inherit` | `currentColor` (CSS keyword, no token lookup needed) | default; follows surrounding text colour |
| `muted` | `--lv-color-muted-fg` | subdued, secondary |
| `primary` | `--lv-color-primary` | brand accent |
| `accent` | `--lv-color-accent` | interactive accent (hover-state equivalent) |
| `success` | `--lv-color-success` | positive status |
| `warning` | `--lv-color-warning` | caution status |
| `destructive` | `--lv-color-destructive` | error / danger status |
| `fg` | `--lv-color-fg` | full-weight foreground (title, high-emphasis) |

Color is applied to the `<span>` wrapper as a Tailwind utility over the token (`text-[var(--lv-color-*)]`
or an `lv-icon-color-*` utility class), so the SVG's `fill="currentColor"` / `stroke="currentColor"`
inherits correctly from the wrapper.

### Animation states

Both `spin` and `pulse` are mutually exclusive in practice (activating both is undefined behaviour
— the spec does not combine them). They are exposed as separate booleans rather than a single
`animation` enum to keep the params flat and the template switch-free.

- `spin=true`: the wrapper `<span>` gets the `animate-spin` equivalent utility. Duration and easing
  come from `--lv-motion-spin` (a CSS custom-property shorthand). `@media (prefers-reduced-motion: reduce)`
  suppresses the animation via the token's media query branch.
- `pulse=true`: the wrapper gets the `animate-pulse` equivalent utility. Duration from
  `--lv-motion-pulse`.

### Rotation

`rotate=0` → no class. `rotate=90|180|270` → a `rotate-{90,180,270}` utility (Tailwind v4 built-in,
via a CSS `rotate` property). Used by components that reuse the same arrow/chevron glyph in multiple
orientations (accordion chevron, collapsible panel arrow, back/forward navigation).

### States (from parent context, not own props)

The icon has no interactive states of its own. When composed inside an interactive parent:
- Inside a `disabled` button: inherits the parent's `opacity-50 pointer-events-none` — the icon
  dims without any own logic.
- Inside an `aria-invalid` field: the parent may pass `color="destructive"` explicitly, or the icon
  inherits `currentColor` from the already-recoloured parent.
- `data-slot="icon"` (the standard slot attribute): allows a parent component to target the icon via
  CSS when it is in a `leading` or `trailing` slot context (`[data-slot="leading"] [data-slot="icon"]
  { … }`).

## 4. The a11y contract

- **WAI-ARIA pattern**: ARIA 1.2 §6.6 / WAI-ARIA APG SVG Accessibility.
  APG reference: https://www.w3.org/WAI/ARIA/apg/ (general ARIA guidance).
  ARIA 1.2 img role: https://www.w3.org/TR/wai-aria-1.2/#img.
  SVG Accessibility: https://www.w3.org/TR/svg-aam-1.0/ (SVG Accessibility API Mappings).
  W3C WAI SVG tutorial: https://www.w3.org/WAI/tutorials/images/decorative/ (decorative images) and
  https://www.w3.org/WAI/tutorials/images/informative/ (informative images).

The entire a11y contract for this component reduces to ONE binary decision, made at render time:

### 4.a Decorative mode (`label` is null or blank)

The icon adds no information beyond what adjacent text already conveys. Remove it from the a11y
tree entirely so screen readers skip it without announcing "image" or the SVG title text.

Template emits on the wrapper `<span>`:
```
aria-hidden="true"
```

The SVG itself must NOT carry a `<title>` element (which some Lucide SVGs include); if the
bundled Lucide SVG string has a `<title>`, the registry strips it at startup (the `IconRegistry`
build step). An SVG `<title>` visible inside an `aria-hidden` container is still exposed by some
AT implementations as a tooltip-equivalent; stripping it guarantees silence.

Also on the SVG root: `focusable="false"` (IE/Edge legacy attribute, harmless in modern browsers,
prevents the SVG itself from receiving keyboard focus in old rendering engines).

### 4.b Meaningful mode (`label` is non-null and non-blank)

The icon is the sole or primary visual carrier of meaning (e.g. a status icon in a table cell
with no adjacent label, or an icon-only button's inner SVG when the BUTTON does not carry
`aria-label` itself). Expose it as an image with an accessible name.

Template emits on the wrapper `<span>`:
```
role="img"
aria-label="${label}"
```

The SVG inside: `aria-hidden="true"` (the role + label on the wrapper fully describe the icon; the
SVG's own a11y tree is redundant and suppressed). `focusable="false"`.

**Important boundary**: when the icon is composed INSIDE a button that already carries its own
`aria-label` (the `iconOnly=true` button case), the icon MUST be decorative (`label=null`). Two
accessible names stacked (one on the icon, one on the button) produce redundant or conflicting
announcements. The button spec already enforces this; the icon spec says it from the icon side.
The consuming call site is responsible for choosing the right mode — there is no auto-detection.

### 4.c Keyboard map

| key | does | who |
|---|---|---|
| — (none) | the icon is not focusable and has no keyboard interaction | — |

The icon is never a keyboard target. If it is placed inside an interactive control (button, link,
etc.), the PARENT element receives focus, not the icon. `focusable="false"` on the SVG prevents
the SVG itself from entering the tab order in legacy engines.

### 4.d Focus management

None. The icon is not focusable. No trap, no roving, no focus restore. The parent interactive
element owns focus entirely.

### 4.e Live region

None. Icons are silent structural elements. An announcing use case (e.g. a toast icon alongside
status text) is managed by the parent component's live region, not the icon.

### 4.f Shared mechanisms composed

None. The icon is the simplest PARTIAL: no enhancer, no popover seam, no focus trap, no roving.
It is a presentational primitive. This is intentional: every other component COMPOSES it rather
than re-rolling inline SVG. The icon's own a11y surface is exhausted by the two-attribute binary
above (aria-hidden vs role+aria-label).

## 5. Tokens

### Existing tokens consumed

- `--lv-color-muted-fg`, `--lv-color-primary`, `--lv-color-accent`, `--lv-color-accent-fg`,
  `--lv-color-success`, `--lv-color-warning`, `--lv-color-destructive`, `--lv-color-fg`:
  the named colour variants (§3 table). `currentColor` for `inherit` (no token lookup).
- `--lv-motion-spin`: the spin animation keyframe + duration token. Used for loading indicators.
- `--lv-motion-pulse`: the pulse animation keyframe + duration token.

### NET-NEW tokens (the 5-step icon size scale)

These do not exist in the current v2 token set and are proposed as additive extensions:

| token | proposed value (OKLCH structural, not colour) | justification |
|---|---|---|
| `--lv-icon-size-xs` | `0.75rem` (12px) | caption / dense badge inline |
| `--lv-icon-size-sm` | `1rem` (16px) | body-sm inline, button-sm icon |
| `--lv-icon-size-md` | `1.25rem` (20px, default) | body-base inline, button-md/lg icon |
| `--lv-icon-size-lg` | `1.5rem` (24px) | standalone display, nav item |
| `--lv-icon-size-xl` | `2rem` (32px) | hero / empty-state |

These are structural (dimensioning) tokens, not colour tokens. They are theme-invariant and do not
require a `.dark` block entry. They join `--lv-space-*` and `--lv-radius-*` as structural scale
tokens, but occupy a named sub-namespace (`--lv-icon-size-*`) rather than extending the space
scale, because their semantics are icon-specific (SVG bounding box, not layout spacing).

The values are chosen to align with Tailwind v4's default rem scale and with the icon sizes
typically used in Tailwind UI designs (12/16/20/24/32px), so the Tailwind-UI-grade visual refresh
uses these tokens without friction.

Both `:root` and the `.dark, [data-theme="dark"]` re-point block are updated. Because these are
dimensioning tokens (not colour), the dark block entries are identical to the light ones — but they
are included for completeness so an adopter override of the dark block does not accidentally drop
them.

## 6. Wire / island integration

**Static, no enhancer.**

The icon is a pure PARTIAL: it emits only server-rendered JTE markup. There is no typed-TS
enhancer, no wire directive, no `data-lievit-component` attribute, and no morph concern of its own.

### JTE structure

The template renders a single `<span>` wrapper containing the raw SVG:

```
<span
  data-slot="icon"
  data-size="${size}"
  data-color="${color}"
  class="inline-flex flex-shrink-0 items-center justify-center
         lv-icon-size-${size}
         ${!color.equals("inherit") ? "lv-icon-color-" + color : ""}
         ${spin ? "lv-icon-spin" : ""}
         ${pulse ? "lv-icon-pulse" : ""}
         ${rotate != 0 ? "rotate-" + rotate : ""}
         ${cssClass}"
  ${label != null && !label.isBlank()
      ? "role=\"img\" aria-label=\"" + label + "\""
      : "aria-hidden=\"true\""}
  ${attrs}
>
  <!-- raw SVG emitted here via $unsafe from the IconRegistry or svgContent -->
</span>
```

The `$unsafe` channel is used for the SVG body because the icon strings are server-controlled
(bundled Lucide SVGs stripped of `<title>` by the registry, or a caller-supplied `svgContent`
string the caller guarantees is trusted). No user-generated value ever reaches this channel.

The SVG root element itself carries `focusable="false"` and `aria-hidden="true"` (always, in both
modes — the role + label live on the `<span>` wrapper, not the SVG).

The `label` string, if present, is HTML-escaped before insertion into `aria-label` via the safe
`dataAttrs` / `Escape.htmlAttribute` channel — this is the one param in the icon that carries
caller-supplied text and must be escaped. The SVG body is trusted-source and uses `$unsafe`.

### Escaping decision (load-bearing security note for the implementation agent)

| value | channel | why |
|---|---|---|
| SVG body from `IconRegistry` | `$unsafe` (trusted raw) | server-controlled, bundled at build time |
| `svgContent` param | `$unsafe` (trusted raw) | caller guarantees it is not user input; documented |
| `label` param → `aria-label` | `Escape.htmlAttribute` (safe escaped) | caller-supplied text, may contain HTML metacharacters |
| `cssClass` param → class attr | template string concat (safe) | utility class names only, no attribute injection risk |
| `attrs` param | `$unsafe` (trusted raw) | STATIC author-typed strings only; documented constraint |

### Composing the icon from a parent template

A button using the icon as a leading slot:

```
@template.lievit.icon(name="user", size="sm", label=null)
```

A standalone meaningful status icon in a table cell:

```
@template.lievit.icon(name="circle-check", size="md", color="success", label="Verified")
```

An icon-only button (the button carries `ariaLabel`; the icon is decorative):

```
@template.lievit.button(
    iconOnly=true,
    ariaLabel="Delete record",
    variant="destructive-ghost",
    content=@`@template.lievit.icon(name="trash-2", size="sm", label=null)`
)
```

A loading spinner (spin + no label — the parent button's `aria-busy` announces the state):

```
@template.lievit.icon(name="loader-circle", size="sm", spin=true, label=null)
```

## 7. Acceptance tests

All tests run on a REAL JTE compile + render substrate (the `test/jte-compile` gate for PARTIAL
components). No mocked registry, no string-templating shortcuts — the `IconRegistry` is a real
Spring bean and its test fixture is seeded with at least three Lucide SVG strings (e.g.
`"check"`, `"circle-check"`, `"loader-circle"`) so the render gate has genuine SVG markup to emit.

### 7.1 Render tests (jsdom, real JTE render)

- **decorative-mode renders aria-hidden**: `label=null` → the wrapper `<span>` has
  `aria-hidden="true"`, no `role`, no `aria-label`. The SVG root has `focusable="false"` and
  `aria-hidden="true"`.
- **meaningful-mode renders role+label**: `label="Verified"` → the `<span>` has `role="img"`
  and `aria-label="Verified"`, no `aria-hidden`. The inner SVG has `aria-hidden="true"` and
  `focusable="false"`.
- **data-slot present**: rendered `<span>` has `data-slot="icon"` in both modes.
- **data-size present**: rendered `<span>` has `data-size="${size}"` for each of the 5 size values.
- **data-color present**: rendered `<span>` has `data-color="${color}"` for each colour mode.
- **known name resolves to SVG**: `name="check"` renders an `<svg>` element inside the wrapper
  (the registry resolved it). The `<svg>` does not contain a `<title>` element (registry stripped it).
- **unknown name renders empty gracefully**: `name="nonexistent-icon-xyz"` does not throw; the
  wrapper renders with the size/color classes but an empty body (or a fallback placeholder SVG);
  the registry returns an empty string for unknown names.
- **svgContent overrides name**: when `svgContent` is set, the `name` param is ignored and the
  provided SVG string is emitted.
- **spin emits animation class**: `spin=true` → the wrapper has the `lv-icon-spin` class.
- **pulse emits animation class**: `pulse=true` → the wrapper has the `lv-icon-pulse` class.
- **rotate emits rotate class**: `rotate=90` → `rotate-90` class present; `rotate=0` → no rotate
  class.
- **color=inherit emits no color class**: `color="inherit"` → no `lv-icon-color-*` class; `color=
  "success"` → `lv-icon-color-success` class present.
- **cssClass appended**: `cssClass="ml-2"` → the `ml-2` class is present on the wrapper alongside
  the icon classes.

### 7.2 Accessibility tests (axe-core, real render)

- **decorative icon: zero axe violations** — `aria-hidden="true"` on the wrapper satisfies the
  SVG a11y rules; the icon is fully removed from the computed a11y tree. Assert with axe-core
  `checkA11y`.
- **meaningful icon: zero axe violations** — `role="img" aria-label="..."` satisfies the
  accessible-name rule; the inner SVG's `aria-hidden="true"` prevents double-announcement. Assert
  with axe-core. Specifically: the `image-alt` rule passes (the `role=img` has a non-empty label).
- **meaningful icon WITHOUT label FAILS the accessible-name rule** (regression guard): if
  `role="img"` is emitted but `aria-label` is empty or absent, axe-core flags `aria-required-attr`
  / `image-alt`. This test documents the FAILURE to confirm the guard works: a meaningful icon must
  have a non-blank label or it must be decorative. The spec does not allow a third state.
- **no focusable SVG**: the rendered SVG never appears in the tab order (assert `tabIndex` is -1 or
  the `focusable="false"` attribute is present on the SVG root).

### 7.3 Keyboard tests

No keyboard tests required: the icon is not a keyboard target. The keyboard contract is entirely
"does not receive focus, does not respond to keys". The `focusable="false"` assertion in §7.2
covers this.

### 7.4 Variant / size tests

- **each of the 5 sizes renders the matching token class** (`lv-icon-size-xs` through
  `lv-icon-size-xl`).
- **default size is md**: no explicit `size` param → `lv-icon-size-md` class + `data-size="md"`.
- **each named colour renders the matching token class** (or `currentColor` for `inherit`).

### 7.5 Escaping / XSS test

- **label is HTML-escaped**: `label='"><script>alert(1)</script>'` → the `aria-label` attribute
  value is `&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;` (or equivalent safe escaping); no
  script tag is present in the rendered markup. Assert via a raw string match on the rendered HTML.
- **svgContent is emitted raw (trusted-channel documentation test)**: a `svgContent` containing
  `<svg><path d="M0 0"/></svg>` is emitted verbatim — this is a documentation-level test confirming
  the channel is `$unsafe`, and the code comment MUST warn the caller.

### 7.6 JTE compile gate

- **the template compiles without errors** — covered by the existing `test/jte-compile` real-
  compiler gate that runs across all `registry/jte/*.jte` templates. This gate catches a broken
  `@param` type, a misspelled method name, or a missing `IconRegistry` injection before any render.

## 8. Non-goals / anti-patterns

- **Not an icon picker or icon browser**: this spec is the render primitive. A UI for browsing the
  available icon set is a separate tool/doc, not a component.
- **Not a CSS icon font**: every icon is an inline SVG, not a font glyph or a CSS background-image.
  Font-based icons are not accessible and cannot be reliably coloured via `currentColor` in all
  contexts. The registry model is chosen deliberately.
- **Not a Lit/React island**: there is no client-side icon resolution, no dynamic icon loading, no
  client-rendered SVG. The icon name is resolved on the server; the SVG is in the HTML. No
  JavaScript is involved.
- **Not a `<img src>` or `<use href>` reference**: inline SVG is chosen over external sprite
  references because a strict CSP (`img-src self`, no blob or data URIs for SVG sprites) can block
  external SVG references in some browser/server configurations. Inline is the only CSP-safe option.
- **Does not auto-detect decorative vs meaningful**: the caller decides by setting or omitting
  `label`. There is no heuristic ("if adjacent text present, set aria-hidden"). The heuristic would
  be wrong in enough cases to be dangerous; the spec puts the responsibility on the call site, where
  the intent is known.
- **Does not sanitize `svgContent`**: the `svgContent` param is a TRUSTED-RAW channel. Sanitizing
  SVG server-side at render time would require a DOM parse + reserialise, which is expensive and
  not the component's job. The constraint is: `svgContent` must be server-controlled. If an
  adopter needs to render user-supplied SVG, they must sanitize before passing it to this param —
  this is documented on the param row, not enforced by the component.
- **Not responsible for icon-set licensing**: the component bundles Lucide Icons (ISC license,
  permissive). Any adopter-supplied custom SVG via `svgContent` is the adopter's licensing
  responsibility. The component does not police it.
- **Does not combine spin + pulse**: activating both simultaneously is undefined. The template
  emits both classes in that case; the visual result is an animation conflict. The spec calls it
  undefined rather than a hard error because a runtime guard would add complexity for a non-case.
  Linters / adopter convention prevent it.
- **Not a tooltip host**: the icon does not include a built-in tooltip for the `label` value. If a
  visible tooltip is needed alongside an icon, compose the `tooltip` PARTIAL around the icon caller;
  the icon itself never spawns a tooltip.

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` and the five net-new `--lv-icon-size-*` tokens.
You may read the Lucide Icons source, Ant Design Icon feature docs, and Tailwind UI icon usage
patterns as references for inventory and look. You MUST NOT paste literal source from any of them
(the one bright line, `02`). The implementation is original generation.

Mirror `button.jte`'s house conventions exactly: header doc-comment with labelled sections
(TIER, STRUCTURE, A11y, Params, Usage), typed `@param`, `data-slot`, the two escaping channels,
zero `<script>`, zero inline `on*=` handlers.

The `IconRegistry` is a Spring `@Component` populated at startup from a bundled Lucide SVG map.
It exposes a single method `String get(String name)` returning the SVG string (or empty string for
unknown names). It is injected into the JTE model via a `@ControllerAdvice` that adds it as a model
attribute named `iconRegistry`. The template calls `iconRegistry.get(name)` and emits via `$unsafe`.

The `label` param goes through `Escape.htmlAttribute` before emission into the `aria-label` value.
Use the `dataAttrs` channel pattern for it, consistent with how other text-typed params are handled
across the library.

The five net-new tokens go in `:root` AND the `.dark, [data-theme="dark"]` block (identical values
for structural tokens, but both blocks must be updated for completeness).

Implement `lv-icon-spin` and `lv-icon-pulse` as utility classes in the component CSS (or as Tailwind
v4 `@utility` extensions) that wire to the `--lv-motion-spin` / `--lv-motion-pulse` tokens, and
include `@media (prefers-reduced-motion: reduce) { .lv-icon-spin, .lv-icon-pulse { animation: none } }`
inside the same definition. Reduced-motion support is non-optional.

Minimal code to GREEN against the acceptance tests. The a11y binary (decorative vs meaningful) is
the contract — assert BOTH modes in the axe-core test, including the FAILURE case for a meaningful
icon with a missing label.
