<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — section / card

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/card.jte` + any existing section/panel partial)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: no WAI-ARIA APG modal interaction pattern applies (a card is a structural grouping container,
      not an interactive widget); the collapsible variant composes the existing `accordion` WIRE component
      (APG Accordion — platform `<button>` + controlled region) rather than re-implementing the
      expand/collapse. The card itself is a static landmark or a generic `<section>` / `<article>` /
      `<div>` depending on context — the heading level is caller-supplied for correct document outline.
    - inventory: Ant Design Card as inventory reference (sizes, bordered, extra actions slot, tabbed card,
      inner card / meta card; the collapsible variant maps to accordion composition)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI Card (NO
      code copied)

## 1. What it is

A visual grouping surface: a padded, optionally bordered, optionally shadowed container with a structured
header slot (title + subtitle + optional leading icon + optional trailing actions area) and a body slot.
The card/section dichotomy is resolved by a single component with a `as` param (`section | article | div`)
so the caller controls the HTML landmark without duplicating the styled surface. STATIC display → PARTIAL:
a card holds no selection state, no open-state of its own. Server-first works trivially — there is nothing
client about a container. The one variant requiring client interactivity (collapsible) is covered by
COMPOSING the existing `accordion` WIRE component, not by adding state to this partial. The body content
arrives via the `content` slot (`gg.jte.Content`), keeping the partial data-free.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `as` | String | "div" | root element: `div` (generic) \| `section` \| `article`. Use `section`/`article` when the card is a meaningful landmark in the document outline (APG sectioning); `div` when it is purely decorative grouping. |
| `variant` | String | "default" | INTENT: `default` (subtle border + muted bg) \| `outlined` (stronger border, transparent bg) \| `elevated` (shadow emphasis, no border) \| `ghost` (no border, no shadow, transparent bg — content-only container) \| `destructive` (destructive border + tinted bg, for error/alert surfaces) |
| `size` | String | "md" | `sm` \| `md` \| `lg` — controls internal padding + header typography scale |
| `title` | String | null | card title text; when set, the header region renders. When null AND no `header` slot, the header is omitted entirely. One of `title` or `header` MUST be set if the card needs an accessible name via `aria-labelledby`. |
| `titleTag` | String | "h3" | the heading element for `title`: `h1` \| `h2` \| `h3` \| `h4` \| `h5` \| `h6`. Caller controls the document outline level. Ignored when `header` slot is used (caller owns the heading in that case). |
| `subtitle` | String | null | secondary text below the title, rendered as a `<p>` in the header. |
| `bordered` | boolean | true | renders the border ring (via `--lv-color-border`). When `variant=elevated`, defaults effectively to false (shadow replaces border). |
| `noPadding` | boolean | false | strips inner body padding (used when the body slot provides its own full-bleed content, e.g. a table or an image). |
| `fullHeight` | boolean | false | makes the card `h-full` so it stretches to fill its grid cell. |
| `cssClass` | String | "" | extra utility classes appended to the root element |
| `attrs` | String | "" | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (ARIA landmark labels such as `aria-label="Revenue summary"`, `tabindex`, `data-*` analytics). |
| `dataAttrs` | Map<String,String> | {} | **SAFE escaped** dynamic `data-*` (each value via `Escape.htmlAttribute`; use for per-row ids or test targets in a list of cards). |
| `header` | gg.jte.Content | null | SLOT — replaces the title/subtitle auto-header entirely. Use when the caller needs richer heading markup (a badge next to the title, a multi-line heading). When set, `title` + `subtitle` + `titleTag` are ignored. |
| `leading` | gg.jte.Content | null | SLOT — icon or avatar placed before the title in the auto-header. |
| `trailing` | gg.jte.Content | null | SLOT — action area in the top-right of the header (one or more `@template.lievit.button(...)` or a `@template.lievit.dropdown-menu(...)`). |
| `footer` | gg.jte.Content | null | SLOT — a padded footer bar below the body, separated by a border. Typical use: a row of confirm/cancel buttons for an inline form card. |
| `content` | gg.jte.Content | — | **REQUIRED** — the card body. Everything inside the body padding region. |

## 3. Variants / Sizes / States / Slots

### Variants (intent vocabulary)

| variant | visual character | token map |
|---|---|---|
| `default` | subtle muted-bg fill + quiet border | `bg: --lv-color-card` + `border: --lv-color-border` + `shadow: none` |
| `outlined` | transparent bg + stronger border | `bg: transparent` + `border: --lv-color-border` (at higher opacity) + `shadow: none` |
| `elevated` | white/surface bg + drop-shadow, no border | `bg: --lv-color-popover` + `border: none` + `shadow: --lv-shadow-md` |
| `ghost` | no chrome, transparent bg, no border | `bg: transparent` + `border: none` + `shadow: none` — content-only grouping |
| `destructive` | tinted destructive bg + destructive border | `bg: --lv-color-destructive/10` + `border: --lv-color-destructive` — error surfaces |

Mapped via a `switch` in `!{var variantClass = ...}` exactly as in `button.jte`. The intent vocabulary
is shared across the library (a `destructive` card reads the same token pair as a `destructive` alert).

### Sizes (padding + typography scale)

| size | body padding | header title size | subtitle size |
|---|---|---|---|
| `sm` | `--lv-space-3` (12 px) | `--lv-text-sm` | `--lv-text-xs` |
| `md` | `--lv-space-4` (16 px) | `--lv-text-base` | `--lv-text-sm` |
| `lg` | `--lv-space-6` (24 px) | `--lv-text-lg` | `--lv-text-sm` |

The `noPadding` param strips body padding independently of size (the header retains its padding when
`noPadding` is true — padding removal is body-only). Size is kept `md` by default (the shadcn baseline).
Cards do NOT conform to the toolbar height-based size rule (that rule applies only to form controls +
buttons); card size governs internal spacing, not an external height constraint.

### States

A PARTIAL card has no stateful states of its own (no hover/focus/active — the card is not interactive).
Composable use-cases that ARE interactive:

- **Clickable card**: the caller wraps the card in an `<a href>` or adds `l:click` on the rendered root
  via `attrs` — the card emits no interactive behaviour itself.
- **Collapsible card**: compose `@template.lievit.accordion(...)` for the expand/collapse region. The
  accordion WIRE component owns the `open` state, the `<button>` trigger, the `aria-expanded` +
  `aria-controls` ARIA, and the keyboard interaction (Enter/Space via the native `<button>`). The card
  partial renders only the styled shell; the accordion provides the state + behaviour.
- **Selected card** (in a multi-card selection list): the caller adds `aria-selected` + a selection ring
  via `dataAttrs` or `attrs`; the card partial renders the visual surface.

The `aria-busy` token-driven state (`--lv-ring`, `--lv-color-destructive`) is available but set by the
CONSUMING wire component or controller, never by the card partial itself.

### Slot anatomy

```
┌─ root (<div|section|article>  data-slot="card") ──────────────────┐
│  ┌─ header (data-slot="card-header") ──────────────────────────┐   │
│  │  [leading slot]  [title / header slot]  [trailing slot]     │   │
│  │                  [subtitle]                                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ── separator (when footer present, or always under header) ─────   │
│  ┌─ body (data-slot="card-body") ──────────────────────────────┐   │
│  │  [content slot]                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ── separator (when footer present) ────────────────────────────   │
│  ┌─ footer (data-slot="card-footer") ──────────────────────────┐   │
│  │  [footer slot]                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

The header separator (between header and body) renders only when a header is present (either `title` is
set or the `header` slot is provided). The footer separator renders only when the `footer` slot is
provided. The body region's top border-t is the visual separator — not a `<hr>` — for clean Tailwind
composition.

## 4. Accessibility

**Reference consulted**: WAI-ARIA Authoring Practices Guide, Structural Roles, and the General Principles
section at https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/ . A "card" is NOT a WAI-ARIA
widget pattern (there is no APG "Card" interaction pattern); it is a STRUCTURAL grouping element. The
a11y contract is therefore simpler than a widget — it governs landmark semantics + heading hierarchy, not
keyboard interaction.

- **WAI-ARIA pattern**: None (structural container). The card is NOT an interactive widget and
  MUST NOT have `role="widget"` or any interactive widget role applied to the container. Correct
  semantics depend on the `as` param and the calling context.

- **Roles + ARIA emitted by the template**:

  | situation | role / element | rationale |
  |---|---|---|
  | `as="section"` or `as="article"` | the native element provides `role="region"` / `role="article"` — no additional `role` attr | the native element IS the ARIA landmark; don't double it |
  | `as="div"` (default) | `role` is absent (a `<div>` has no implicit landmark role) — callers who need a region add it via `attrs` | don't force a landmark on a generic grouping |
  | when `as="section"` and `title` is set | `aria-labelledby="<cardTitleId>"` on the root — gives the region an accessible name so screen readers list it in the regions landmark list | required by APG landmark rules: a `<section>` without an accessible name is treated as generic |
  | when `as="section"` and `header` slot is used | caller must ensure their custom heading has an `id` and passes `aria-labelledby="<thatId>"` via `attrs` — the spec notes this requirement in the template header doc-comment | |
  | `title` heading element | the heading tag from `titleTag` (`h3` default); `id="<cardTitleId>"` | establishes the accessible name + contributes to the page heading outline |
  | `trailing` slot actions | no additional role (the buttons inside the slot carry their own roles) | |
  | `footer` slot | no additional role; it is a presentational region | |

  The `<section>` / `<article>` landmarks appear in the AT landmark list only when they have an accessible
  name (`aria-labelledby`). When `as="div"`, no landmark is emitted — which is CORRECT for decorative
  grouping. This makes the `as` + `title` pair the instrument for landmark control.

- **Keyboard interaction map**:

  | key | does | who |
  |---|---|---|
  | Tab | moves focus INTO the card's focusable children (standard document tab order) | platform |
  | (all other keys) | handled by the focused element inside the card, not the card container | platform / the child component |

  A card has NO card-level keyboard interaction. There is no roving tabindex, no Enter/Space on the
  container, no Esc handler. Interactive descendants (buttons in `trailing`, form controls in `content`,
  footer buttons) handle their own keys via the platform or their own enhancer.

  **Collapsible variant (accordion composition)**: the `accordion` WIRE component's `<button>` trigger
  handles Enter/Space (native button, platform-supplied). See the `accordion` spec for the full keyboard
  map of the expand/collapse pattern. The card partial is passive.

- **Focus management**: platform-only. No initial focus logic, no trap, no roving. The card is never a
  modal overlay (that is `dialog` + `focus-trap`). Focus enters and leaves via the normal tab order.
  The morph preserves focus (runtime ADR-0019), so focus inside a card that re-renders (e.g. an inline
  form card in a WIRE component) survives the DOM patch without any card-level handling.

- **Live region**: none. A card is not a status announcer. If a card surface contains a loading / error
  state, the caller composes the `loading-section` partial (which carries `role="status"` / `aria-busy`)
  or the `alert` partial inside the `content` slot.

- **Screen-reader expectations**:
  - When `as="section"` with a title: the AT announces the region name when entering it. Screen reader
    users navigating by landmarks find the card in the regions list with its title as the label.
  - When `as="div"`: no landmark announcement. Content is read in source order.
  - The heading (`titleTag`) appears in the heading outline. Callers MUST choose a `titleTag` consistent
    with the surrounding document outline (if the page h1 is the page title, card titles in the main
    content area are typically h2 or h3 — caller's responsibility, card does not impose h3 everywhere).
  - An icon-only button in the `trailing` slot MUST have `ariaLabel` set (the button rule — see `button`
    spec §4).

- **Shared mechanisms composed**: none. The card is a structural partial with no widget behaviour.
  The collapsible composition defers entirely to `accordion` (which already owns the APG Accordion pattern).

## 5. Tokens

The full set of `--lv-*` tokens this partial consumes, in logical groups:

**Color (OKLCH, sourced from `registry/tokens/lievit-tokens.css`)**:
- `--lv-color-card` — the default card surface background (a slightly-off-white in light; a slightly-raised
  dark in dark mode; the shadcn `card` semantic pair)
- `--lv-color-card-fg` — the default text colour on the card surface
- `--lv-color-popover` — the `elevated` variant surface (pure white / dark surface, higher than `card`)
- `--lv-color-border` — default border ring
- `--lv-color-muted` — subtitle text + header muted label
- `--lv-color-muted-fg` — subtitle + metadata text
- `--lv-color-destructive` — `destructive` variant border
- `--lv-color-destructive/10` — (as Tailwind v4 opacity modifier) `destructive` variant tinted bg

**Shadow**:
- `--lv-shadow-xs` — default subtle shadow when `variant=default` with `bordered=false`
- `--lv-shadow-md` — `elevated` variant shadow (medium depth, the popover elevation)

**Spacing**:
- `--lv-space-3` (12 px) — `sm` body padding
- `--lv-space-4` (16 px) — `md` body padding; header horizontal padding at all sizes
- `--lv-space-6` (24 px) — `lg` body padding; vertical header padding at `lg`
- `--lv-space-2` (8 px)  — gap between `leading` icon and title text; gap between stacked title+subtitle

**Typography**:
- `--lv-text-xs` — subtitle at `sm`; metadata labels
- `--lv-text-sm` — subtitle at `md`/`lg`; `sm` title
- `--lv-text-base` — `md` title (default)
- `--lv-text-lg` — `lg` title
- `--lv-font-sans` — applied on the root
- `--lv-font-medium` — title font-weight
- `--lv-font-normal` — subtitle font-weight

**Radius**:
- `--lv-radius-md` — `sm` card corner radius
- `--lv-radius-lg` — `md`/`lg` card corner radius (the default; larger cards feel less boxy)

**Net-new tokens**: none. All surfaces (card bg, border, shadow, spacing, radius) are covered by the
existing v2 token set. The `--lv-color-card` + `--lv-color-card-fg` semantic pair already exists in the
shadcn-grade token set (it was added in the Filament-parity pass). No net-new token is required for any
variant. The `destructive` bg tint uses the existing Tailwind v4 opacity-modifier syntax on
`--lv-color-destructive` — no separate tint token needed.

## 6. Wire / island integration

**This is a PARTIAL. There is no enhancer, no wire component, no HTMX pattern.** The card emits static
server-rendered HTML. No `data-lievit-component`, no `data-lievit-snapshot`, no `l:*` directives on the
card root itself.

**Server-rendered JTE structure** (the elements + data hooks):

```
<{as}  ← root: <div>, <section>, or <article>
  data-slot="card"
  data-variant="${variant}"
  data-size="${size}"
  ${bordered ? "data-bordered" : ""}
  ${noPadding ? "data-no-padding" : ""}
  ${fullHeight ? "class='h-full'" : ""}
  ${!attrs.isBlank() ? $unsafe{attrs} : ""}
  ${!dataAttrs.isEmpty() ? /* escaped data-* fragment */ : ""}
  ${as == "section" && title != null ? "aria-labelledby='card-title-<cid>'" : ""}
>

  <%-- header region — rendered only when title is set OR header slot is provided --%>
  !{var hasHeader = title != null || header != null}
  @if(hasHeader)
    <div data-slot="card-header" class="... padding based on size ...">

      @if(leading != null)
        <div data-slot="card-leading" class="shrink-0">
          ${leading}
        </div>
      @endif

      @if(header != null)
        <%-- caller-supplied heading: no auto h-tag, no title id --%>
        <div data-slot="card-title-area" class="min-w-0 flex-1">
          ${header}
        </div>
      @elseif(title != null)
        <div data-slot="card-title-area" class="min-w-0 flex-1">
          <${titleTag} id="card-title-<cid>" data-slot="card-title"
            class="... titleClass based on size ...">
            ${title}
          </${titleTag}>
          @if(subtitle != null)
            <p data-slot="card-subtitle" class="... subtitleClass based on size ...">
              ${subtitle}
            </p>
          @endif
        </div>
      @endif

      @if(trailing != null)
        <div data-slot="card-trailing" class="ml-auto shrink-0 flex items-center gap-2">
          ${trailing}
        </div>
      @endif

    </div>
    <%-- visual separator between header and body --%>
    <div data-slot="card-separator" class="border-t var(--lv-color-border)" aria-hidden="true"></div>
  @endif

  <%-- body region --%>
  <div data-slot="card-body"
    class="${noPadding ? '' : '... bodyPaddingClass based on size ...'}">
    ${content}
  </div>

  <%-- footer region — rendered only when footer slot is provided --%>
  @if(footer != null)
    <div data-slot="card-separator-footer" class="border-t var(--lv-color-border)"
      aria-hidden="true"></div>
    <div data-slot="card-footer" class="... footerPaddingClass based on size ...">
      ${footer}
    </div>
  @endif

</{as}>
```

The `<cid>` placeholder stands for a server-generated stable id (a counter injected by the template
engine or passed by the caller if the card appears in a list — the standard pattern for `aria-labelledby`
targets in JTE). The template must NOT use a random id (random ids break idempotency + the morph's
identity-preserving patch).

**data-* hooks (stable test + CSS targets)**:
- `data-slot="card"` — root; every integration test + CSS override anchors here.
- `data-slot="card-header"` — the header region.
- `data-slot="card-title"` — the auto-generated heading.
- `data-slot="card-subtitle"` — the subtitle paragraph.
- `data-slot="card-title-area"` — wraps title+subtitle; addressable for flex layout overrides.
- `data-slot="card-leading"` — the icon/avatar slot.
- `data-slot="card-trailing"` — the actions slot.
- `data-slot="card-body"` — the body region.
- `data-slot="card-footer"` — the footer region.
- `data-variant="${variant}"` — test target for variant assertions.
- `data-size="${size}"` — test target for size assertions.

**No enhancer.** The card partial registers nothing in the runtime directive or lifecycle registries.
Interactivity belongs to the content inside it (composed WIRE components, buttons, form controls) or to
the wrapper the caller places AROUND it. The collapsible use-case is not a card state: it is the
`accordion` WIRE component rendered INSIDE or INSTEAD of a card-body region (the caller composes them).

## 7. Acceptance tests

The component is DONE only when ALL of these pass on a REAL substrate (no mocked `$lievit`, no stubbed
JTE — the client-island-fidelity principle applies even to a PARTIAL: tests run the REAL JTE compiler +
real jsdom render, not a string-templated stub).

**Render tests (jsdom, real JTE compiler + render gate)**:

- **`renders root element per 'as' param`**: `as="div"` → `<div data-slot="card">`;
  `as="section"` → `<section data-slot="card">`; `as="article"` → `<article data-slot="card">`.

- **`header region present when title is set, absent when neither title nor header slot`**:
  `title="Revenue"` → DOM contains `[data-slot="card-header"]` + a heading element with text "Revenue";
  with no `title` and no `header` slot → `[data-slot="card-header"]` is absent from the DOM.

- **`titleTag controls the heading element`**: `title="X" titleTag="h2"` → the heading is an `<h2>`;
  `titleTag="h4"` → `<h4>`. Default is `<h3>`.

- **`subtitle renders below the title when set`**: `title="X" subtitle="Fiscal Q2"` → DOM contains
  `[data-slot="card-subtitle"]` with text "Fiscal Q2". With no `subtitle` → the element is absent.

- **`leading slot renders before the title-area`**: a `leading` slot with an icon partial → the icon
  is present in `[data-slot="card-leading"]` and precedes `[data-slot="card-title-area"]` in DOM order.

- **`trailing slot renders at the right of the header`**: a `trailing` slot with a button → button is
  present in `[data-slot="card-trailing"]`; it is a sibling of `[data-slot="card-title-area"]` with
  `margin-left:auto` applying.

- **`header slot overrides title+subtitle+titleTag`**: when `header` slot provided with a custom `<h2>`,
  `title` is also set → the `<h2>` from the slot is in the DOM; the auto-generated `<h3>` from `title`
  is NOT present; `data-slot="card-title-area"` contains the caller's markup.

- **`content slot is always rendered`**: `content` projects correctly into `[data-slot="card-body"]`.
  Any content — text, nested partials, wire components — renders verbatim.

- **`footer slot renders with separator when set, absent when null`**: `footer` slot provided → DOM has
  `[data-slot="card-footer"]` + a preceding separator element with `aria-hidden="true"`;
  no `footer` → neither element is present.

- **`noPadding strips body padding`**: `noPadding=true` → `[data-slot="card-body"]` has no padding
  utility classes. `noPadding=false` (default) → padding classes are present based on `size`.

- **`fullHeight adds h-full`**: `fullHeight=true` → root element has `h-full` class.

- **`each variant emits data-variant and correct token classes`**: for each of the 5 variants, assert
  `data-variant="${variant}"` is on the root and the primary bg/border/shadow token utilities are applied
  (assert by CSS-class substring, not by literal colour value — the tokens resolve at runtime). The
  `destructive` variant carries both the destructive border class and the tinted bg modifier.

- **`each size emits data-size and correct padding classes`**: `sm`, `md`, `lg` — assert `data-size` +
  the body padding token class per size. `noPadding=true` always emits no body padding regardless of size.

- **`bordered=false removes the border class`**: `bordered=false` → no border utility class on the root.

**Accessibility tests (axe-core, same real jsdom render)**:

- **`axe-core: zero violations, as=div, no title`**: the rendered card with `as="div"` and no title
  passes axe-core with zero violations. (A `<div>` requires no accessible name.)

- **`axe-core: zero violations, as=section, title set, aria-labelledby wired`**:
  `as="section" title="My Card"` → axe-core detects no violations. Specifically: the
  `region-missing-accessible-name` rule (axe id: `region`) must PASS — the `aria-labelledby` points to
  the heading id, which is present in the DOM and has non-empty text content.

- **`axe-core: section WITHOUT title and WITHOUT aria-labelledby FAILS the region rule`**: this is an
  ABUSE CASE — assert that axe-core DOES fire a violation for `as="section"` with no `title` and no
  `aria-labelledby` in `attrs`. The template comment must document this requirement. (Verifies the spec's
  warning is real, not aspirational.)

- **`axe-core: icon-only button in trailing slot passes accessible-name rule`**: compose a trailing
  slot with an icon-only button with `ariaLabel="Card options"` → zero violations. Without the
  `ariaLabel` → the accessible-name rule fires. (Delegates to `button` spec §7 but must be asserted
  in-context.)

- **`axe-core: heading level contract — no violation on any titleTag h1..h6`**: each heading level
  renders without axe violations when it is the only heading on the test page. (The CORRECT heading
  hierarchy is the CALLER's responsibility; the card does not impose a level — but it must not itself
  introduce a broken heading structure.)

**Keyboard tests (jsdom, real DOM)**:

- **`Tab reaches focusable children in DOM order`**: a card body containing a button → Tab from outside
  the card → focus lands on the button → Tab again → focus leaves the card. No card-level key handling
  intercepts this.

- **`card root is NOT focusable by default`**: `as="div"` card without `tabindex` in `attrs` →
  `document.querySelector('[data-slot="card"]').tabIndex` is -1 (not in tab order). The card is not an
  interactive element.

- **`collapsible composition: accordion button Enter/Space expands the region`**: a card where the
  `content` slot contains an `accordion` WIRE component → the accordion's `<button>` receives Enter →
  the accordion region expands. The card itself emits no key handler. (This test is primarily an
  integration-proof that the composition works; the full keyboard contract lives in the `accordion` spec.)

**Variant + size tests**:

- **`all 5 variants × 3 sizes render without error`**: 15 combinations, assert that JTE compilation
  and rendering do not throw and that the root element is present with the correct `data-variant` +
  `data-size`.

- **`ghost variant has no border and no shadow classes`**: assert absence of border and shadow utilities.

- **`elevated variant has shadow class and no border class`**: assert shadow token class present;
  border utility absent (when `bordered` defaults to false for elevated).

**JTE compile + render gate**:
- Covered by the `test/jte-compile` real-compiler gate that runs against all `registry/jte/*.jte` files.
  This gate must include `card.jte` in its file list.

**Escaping test (dataAttrs — the XSS abuse case)**:

- **`dataAttrs hostile value renders inert`**: `dataAttrs={"analytics-id": "\">|<script>alert(1)</script>"}` →
  the rendered attribute value is HTML-escaped (the `>` and `<` are entity-encoded); no `<script>` tag
  appears in the rendered output. The `attrs` param is documented trusted-only and is NOT fed user data
  in any test (the contract: `attrs` = STATIC author-typed strings only).

## 8. Non-goals / anti-patterns

- **NOT a widget.** The card MUST NOT have an `onClick` / `l:click` on its root, a `role="button"`, or
  a `tabindex` in the default template. An interactive card surface (a selectable card in a list) is a
  CALLER concern: the caller wraps in an `<a>` or adds `attrs="l:click='select'"` on a consuming WIRE
  template. The card partial is the SURFACE, not the behaviour.

- **NOT collapsible by its own state.** The card does NOT have a `collapsible` boolean param that adds
  expand/collapse. The collapsible variant is COMPOSITION: the `accordion` WIRE component is placed
  inside the `content` slot, or the caller wraps the card body in an accordion region. Adding
  expand/collapse to the card would duplicate the `accordion` component's open-state logic and its a11y
  contract — the single-source rule forbids this.

- **NOT a data container.** No hardcoded option lists, user data, or server-derived values inside the
  partial. All data comes in via `@param` (title, subtitle, slots). The "no data in a partial" rule from
  the architecture contract applies.

- **NOT a modal or overlay.** The card is an inline container. For modal overlays, use `dialog`,
  `drawer`, or `sheet`. The card does not set `z-index`, `position: fixed`, or `aria-modal`.

- **NOT responsible for heading hierarchy.** The card does not enforce `h3` everywhere or compute a
  level from context. `titleTag` defaults to `h3` as a reasonable baseline for a sub-section card in a
  typical page, but the caller MUST choose the correct level for the document outline. A card that
  renders `h3` inside an `h1`-only page with no `h2` will have an incorrect outline — that is the
  caller's accessibility debt, not the card's bug.

- **NOT a layout grid.** The card does not set column widths, grid spans, or responsive breakpoints.
  Responsive card grids are a layout concern; the calling page or a grid partial wraps multiple cards.
  `fullHeight` is the one layout convenience exposed (for equal-height card rows via `items-stretch`
  on the parent grid).

- **NO `<script>` or inline `on*=`.** The CSP refuses them; the card template is fully server-rendered
  markup with no client JavaScript. Any dynamic behaviour inside the card belongs to composed WIRE
  components or enhancer-driven children, never to the card template itself.

- **NO re-implementation of accordion semantics.** If a reviewer sees `aria-expanded` or
  `aria-controls` on the card root, that is a defect: those attributes belong to the accordion
  `<button>` trigger rendered INSIDE the card's content, not on the card container.
