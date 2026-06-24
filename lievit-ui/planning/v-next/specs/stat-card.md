<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — stat-card

- **tier**: PARTIAL
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/stat-card.jte` / `statistic.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: No WAI-ARIA APG pattern for this component (pure display, no interactive role beyond the
      elements it contains). BUILT against the W3C WCAG 2.2 text-contrast and accessible-name rules.
      The trend indicator uses `aria-label` to convey direction + value textually; the stat value uses
      the `<output>` element where it represents a computed result, otherwise a plain `<p>`. No react-aria
      reference needed (no focus management, no roving, no overlay).
    - inventory: Ant Design Statistic as inventory reference (value, title, prefix/suffix, precision,
      trend direction + trend value, loading state, card-vs-inline layout); Tailwind UI Stats / KPI
      card patterns for the visual layout vocabulary.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      (NO code copied)

## 1. What it is

A stat-card is a single-metric display unit: a labelled numeric (or string) value shown prominently,
optionally annotated with a unit suffix/prefix, a comparison trend indicator (up/down/neutral with a
delta value), a contextual description, and leading/trailing decoration (icon or avatar). It is purely
presentational — it holds no state and initiates no actions. The server computes the value, the partial
renders it, and the consuming page decides whether to wire an htmx refresh. PARTIAL is the right tier:
there is nothing client about a static number display; the server owns the truth and re-renders the whole
card on any refresh cycle.

Use a stat-card when:
- a dashboard, overview pane, or report header needs one KPI or aggregate metric rendered prominently.
- a comparison against a prior period or target (the trend) must be communicated alongside the value.
- the consuming layout is a grid of peer cards (a "KPI row"), a sidebar summary, or an infolist section.

Do NOT use a stat-card for:
- interactive counters (compose a `button` + HTMX pattern instead).
- tabular rows of metrics (use `data-list` / `table`).
- progress toward a goal (use `progress`).
- status conditions (use `badge`, `alert`).

## 2. API — params / props (the typed surface)

All params are `@param` in the JTE template. No `@Wire` fields (PARTIAL). The two-escaping-channel
rule applies where dynamic data flows in: `attrs` is TRUSTED raw, `dataAttrs` is SAFE escaped.

| param | type | default | meaning |
|---|---|---|---|
| `title` | `String` | _(required)_ | The metric label (e.g. "Nuovi contatti", "Ricavi mensili"). Rendered above the value. Becomes the accessible name of the `<figure>` via `aria-labelledby`. |
| `value` | `String` | _(required)_ | The primary metric value, already formatted by the server (e.g. "1 284", "92,4 %", "€ 38 000"). Never formatted client-side; the controller owns precision + locale. |
| `prefix` | `String` | `""` | Symbol or unit displayed immediately before the value (e.g. "€", "$", "#"). Rendered inline, same scale as the value. |
| `suffix` | `String` | `""` | Symbol or unit displayed immediately after the value (e.g. "%", "k", "/ mese"). Rendered inline. |
| `description` | `String` | `""` | Secondary line below the value: context, period, or source note (e.g. "vs mese scorso", "Parma · Q2 2026"). Empty → the element is omitted. |
| `trend` | `String` | `"none"` | Direction of the trend indicator: `up \| down \| neutral \| none`. Controls the icon (arrow up / arrow down / minus) and the intent colour (up → success, down → destructive, neutral → muted). `none` → no trend indicator rendered. |
| `trendValue` | `String` | `""` | The delta to display alongside the trend icon (e.g. "+12 %", "−340 €", "stabile"). Empty → no delta text, only the icon. Required when `trend` ≠ `none` for a complete accessible label. |
| `trendLabel` | `String` | `""` | Override for the screen-reader-only accessible label of the trend indicator (replaces the auto-generated "Tendenza: su, +12 %" default). Use when the auto-label is ambiguous in context. |
| `loading` | `boolean` | `false` | Skeleton state: replaces value + trend with animated placeholder bars; `aria-busy="true"` on the root. |
| `size` | `String` | `"md"` | `sm \| md \| lg` — scales the value font size and card padding. Does NOT change the toolbar height (this is a display component, not a form control); size affects typographic prominence. |
| `variant` | `String` | `"default"` | Visual intent of the card surface: `default \| info \| success \| warning \| destructive`. Controls the card border accent colour token. Does NOT recolour the value itself (the value is always `--lv-color-fg`); only the left-border accent changes. `default` → no accent border. |
| `href` | `String` | `null` | When set, wraps the entire card in an `<a href>` making it a navigable link (drill-down to the metric detail page). The `<a>` carries `aria-label` derived from `title` + `value` so the link has a complete accessible name. |
| `leading` | `gg.jte.Content` | `null` | Optional slot: icon, avatar, or pictogram rendered to the left of the title+value block. Common use: a Lucide icon at `size-5`. |
| `trailing` | `gg.jte.Content` | `null` | Optional slot: secondary action or badge rendered at the top-right corner of the card (e.g. a period selector badge, a settings icon button). The consumer is responsible for wiring any interactivity on elements placed here. |
| `footer` | `gg.jte.Content` | `null` | Optional slot: a ruled bottom section (e.g. a comparison bar, a sparkline, a detail link row). Rendered below the trend + description, separated by a `<hr>`. |
| `cssClass` | `String` | `""` | Extra utility classes appended to the card root element (for layout: `col-span-2`, `w-full`, etc.). |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed attribute strings only (e.g. `data-testid="revenue-card"`, `x-intersect="..."` for HTMX lazy-load). Never feed per-row DB values here. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (each value through `Escape.htmlAttribute`). Use for HTMX trigger targets or per-row identifiers when the card is inside a loop. |

### Notes on the `value` param

The server MUST format `value` before passing it (locale-aware number formatting, currency symbol,
date formatting). The partial is a dumb renderer; it never performs formatting logic client-side.
A raw `double` or `long` must be formatted by the Spring controller or a JTE helper before binding.

## 3. Variants / Sizes / States / Slots

### Variants (intent vocabulary, shared library set)

| variant | token pair used | meaning |
|---|---|---|
| `default` | no accent border | a neutral metric; most cards |
| `info` | `--lv-color-info` left-border accent | a monitoring or informational KPI |
| `success` | `--lv-color-success` left-border accent | a positive outcome or target met |
| `warning` | `--lv-color-warning` left-border accent | a metric approaching a threshold |
| `destructive` | `--lv-color-destructive` left-border accent | a metric in alert state or below target |

The variant tints ONLY the decorative left-border accent (`border-l-2` style), never the text or
background. This keeps the value legible and prevents false colour-coding of the number itself.
The `trend` direction independently drives the trend indicator colour (`success` for `up`,
`destructive` for `down`, `muted` for `neutral`) and is NOT coupled to `variant`.

### Sizes (typographic prominence, NOT toolbar-aligned)

Stat-card is a display component, not a form control, so `size` drives the VALUE font size and
card padding rather than a fixed pixel height. The title and description remain at `--lv-text-sm`
across all sizes; only the prominent metric figure scales.

| size | value font token | card padding | use when |
|---|---|---|---|
| `sm` | `--lv-text-2xl` | `--lv-space-4` | compact sidebar summary, dense grid |
| `md` | `--lv-text-3xl` | `--lv-space-5` | default dashboard KPI card |
| `lg` | `--lv-text-4xl` | `--lv-space-6` | hero metric, top-of-page highlight |

### States

| state | rendering | ARIA |
|---|---|---|
| `loading=true` | value + trend replaced by animated skeleton bars; title still visible | `aria-busy="true"` on root `<figure>`; skeleton bars are `aria-hidden="true"` |
| `href` set (link card) | entire card wrapped in `<a>`; hover ring via `--lv-ring` | `<a aria-label="<title>: <value>">` |
| `href` not set (static card) | `<figure>` root, no interactive wrapping | no interactive role |
| `trend=up` | green arrow-up icon + `trendValue` text | trend `<span aria-label="Tendenza: in aumento, <trendValue>">` |
| `trend=down` | red arrow-down icon + `trendValue` text | trend `<span aria-label="Tendenza: in calo, <trendValue>">` |
| `trend=neutral` | muted minus icon + `trendValue` text | trend `<span aria-label="Tendenza: stabile, <trendValue>">` |
| `trend=none` | no trend element rendered | — |
| `description` set | secondary line rendered below trend | plain `<p>` |
| `description` empty | element omitted | — |

### Slots

| slot param | type | purpose |
|---|---|---|
| `leading` | `gg.jte.Content` | Icon, avatar, or pictogram to the left of title+value. `null` → layout collapses to single-column. |
| `trailing` | `gg.jte.Content` | Top-right corner content (badge, icon button). `null` → corner absent. |
| `footer` | `gg.jte.Content` | Ruled bottom section (sparkline, comparison bar, detail link). `null` → footer absent. |

Slot names follow the shared library vocabulary (`leading`, `trailing`, `footer`) — never `iconStart`,
`prefix-slot`, `bottom-content`, or other per-component inventions.

## 4. Accessibility (the load-bearing section)

### WAI-ARIA pattern

No WAI-ARIA APG composite pattern applies to a pure-display numeric card. The applicable rules are:

- **WCAG 2.2 SC 1.1.1** (Non-text content): every non-decorative icon must carry an accessible label;
  decorative icons are `aria-hidden="true"`.
- **WCAG 2.2 SC 1.4.3 / 1.4.6** (Contrast): value text at all sizes must meet 4.5:1 against the card
  background (or 3:1 for the `--lv-text-3xl` / `--lv-text-4xl` large-text sizes where the 3:1 threshold
  applies); trend colour tokens must also pass.
- **WCAG 2.2 SC 4.1.2** (Name, Role, Value): the trend indicator must convey direction AND magnitude
  textually, not by colour alone.

Reference consulted: https://www.w3.org/WAI/ARIA/apg/patterns/ (no applicable pattern for a static
display card); WCAG 2.2 at https://www.w3.org/TR/WCAG22/; APG landmark + figure guidance at
https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/.

The card uses `<figure>` as its root: `<figure>` is the correct semantic element for self-contained
content (a metric with its caption/title), annotated with `aria-labelledby` pointing to the title
element so screen readers announce "figure, [title]" on entry.

### Roles and ARIA attributes

| element | role / attribute | value / rule |
|---|---|---|
| card root (not linked) | `<figure>` | `aria-labelledby="<titleId>"`, `aria-busy="true"` when `loading` |
| card root (linked) | `<a>` wrapping `<figure>` | `aria-label="<title>: <value><suffix>"` on the `<a>`; `<figure aria-hidden="true">` so SR does not double-read the inner structure |
| title | `<figcaption id="<titleId>">` | the metric label; the `id` is referenced by `aria-labelledby` on the figure |
| value | `<p>` (or `<output>` when the value is a server-computed result responding to a form action) | `aria-atomic="true"` when updated via HTMX morph so the SR re-reads the full value |
| prefix / suffix | `<span aria-hidden="true">` | decorative inline symbol; included in `aria-label` on the `<a>` when linked |
| trend indicator | `<span role="img">` | `aria-label` = explicit `trendLabel` param if set, else auto-generated: `"Tendenza: in aumento, +12 %"` / `"Tendenza: in calo, −5 %"` / `"Tendenza: stabile"`. Never conveys direction by colour alone. |
| trend icon (svg) | `<svg aria-hidden="true">` | decorative; meaning carried by the parent `role=img` label |
| description | `<p>` | plain text; no ARIA override needed |
| skeleton bars | `<span aria-hidden="true">` | purely visual; the `aria-busy` on the root tells SR to wait |
| `leading` slot decoration | adopter-controlled | if the adopter places a Lucide icon: `aria-hidden="true"` (decorative); if a meaningful avatar: `alt` or `aria-label` on the adopter side |
| `trailing` slot | adopter-controlled | adopter is responsible for accessible names on any interactive elements placed here |
| card `<hr>` (footer divider) | `<hr role="separator" aria-hidden="true">` | decorative; `aria-hidden` so SR does not announce it redundantly |

### Keyboard interaction map

| key | action | who supplies it |
|---|---|---|
| Tab | moves focus TO the card (when `href` set) or to interactive elements inside `trailing`/`footer` slots (if any) | platform |
| Enter / Space | follows the `href` link (when `href` set) | platform (native `<a>`) |
| Tab (inside trailing/footer slots) | cycles through any interactive elements the adopter placed in the slots | platform (no roving — the card itself does not manage slot focus) |

When `href` is NOT set and no interactive elements are in the slots, the card is NOT in the tab
order (it is a display element, `<figure>` is not focusable by default). There is no keyboard
interaction beyond what the adopter's slotted content provides.

### Focus management

- **No focus trap**: a stat-card is non-modal display content.
- **No initial focus**: the card does not steal focus on render.
- **No roving tabindex**: the card contains no collection navigation.
- **Link card**: when `href` is set, the `<a>` receives focus normally; the focus-visible ring uses
  `--lv-ring` (the shared token, consistent with every other interactive primitive in the library).
- **Slot content**: focus management of elements inside `trailing` / `footer` is the adopter's
  responsibility. The card template does not modify or constrain it.
- **Shared mechanism composed**: none. This component does not compose `focus-trap`,
  `collection-nav`, or the popover seam.

### Screen reader expectations

- On entry to a linked card: SR announces "[link] [title]: [value][suffix]" (from the `<a aria-label>`).
- On entry to a non-linked card: SR announces "figure, [title]" (from `aria-labelledby`), then
  reads the value, trend indicator label, and description in document order.
- Trend direction is announced textually: "Tendenza: in aumento, +12 %" — no reliance on colour.
- Loading state: SR reads `aria-busy="true"` and may announce "busy" or suppress reading of the
  skeleton content.
- HTMX-refreshed value: `aria-atomic="true"` on the value element ensures the SR re-reads the
  full formatted string, not just the changed characters.

### Live region

None. The stat-card is not a status announcer. If a consuming page needs to announce that a metric
refreshed ("Valori aggiornati"), that announcement belongs to a `role="status"` region in the page
layout, not inside the card partial.

## 5. Design tokens

The stat-card reads the following `--lv-*` tokens. No literal colour, spacing, or radius values.
All colour tokens are authored in OKLCH (source-of-truth format, architecture contract §4).

### Colour tokens

| token | use |
|---|---|
| `--lv-color-card` | card background |
| `--lv-color-card-fg` | default text colour for title, value, description |
| `--lv-color-border` | card outer border + footer `<hr>` |
| `--lv-color-muted` | title + description text (subdued vs the value) |
| `--lv-color-muted-fg` | trend `neutral` indicator text + icon |
| `--lv-color-success` | trend `up` indicator accent (border + icon + text) |
| `--lv-color-success-fg` | trend `up` text colour |
| `--lv-color-destructive` | trend `down` indicator accent + `destructive` variant border |
| `--lv-color-destructive-fg` | trend `down` text colour |
| `--lv-color-info` | `info` variant left-border accent |
| `--lv-color-info-fg` | (not used on stat-card value; reserved for future tint) |
| `--lv-color-warning` | `warning` variant left-border accent |
| `--lv-color-warning-fg` | (reserved) |
| `--lv-color-fg` | value text (always full-contrast, never muted) |
| `--lv-ring` | focus-visible ring on the `<a>` link card |

### Spacing tokens

| token | use |
|---|---|
| `--lv-space-1` | gap between trend icon and trend value text |
| `--lv-space-2` | gap between title and value; gap between value and trend/description |
| `--lv-space-3` | gap between leading slot and title+value column |
| `--lv-space-4` | card padding (`sm` size) |
| `--lv-space-5` | card padding (`md` size, default) |
| `--lv-space-6` | card padding (`lg` size) |

### Typography tokens

| token | use |
|---|---|
| `--lv-text-sm` | title, description, trend value text, prefix, suffix |
| `--lv-text-xs` | description when compact (`sm` card) |
| `--lv-text-2xl` | value (`sm` size) |
| `--lv-text-3xl` | value (`md` size, default) |
| `--lv-text-4xl` | value (`lg` size) |
| `--lv-font-sans` | all text |
| `--lv-font-medium` | title weight |
| `--lv-font-semibold` | value weight (numeric prominence) |

### Structural tokens

| token | use |
|---|---|
| `--lv-radius-lg` | card corner radius |
| `--lv-shadow-sm` | card elevation (subtle lift; omitted in `default` variant without border accent) |

### Net-new tokens

None. All required tokens exist in the current `registry/tokens/lievit-tokens.css` token set.
The `--lv-text-2xl` / `--lv-text-3xl` / `--lv-text-4xl` scale tokens are shared with `heading`
and other display components; if they are missing from the current set they are additive, go in
both `:root` and `.dark`, and are NOT component-specific.

## 6. Wire / island integration

### Static, no enhancer

The stat-card is a **static PARTIAL**. It has no typed-TS enhancer, no `l:*` directives, and no
wire round-trip of its own. It does not compose the popover seam, focus-trap, or collection-nav.

### Server-rendered JTE structure

```
<figure data-slot="stat-card"
        data-variant="${variant}"
        data-size="${size}"
        aria-labelledby="<titleId>"
        [aria-busy="true" when loading]
        [class includes cssClass]
        [$unsafe attrs]>

  <!-- optional left-border accent via variant -->
  <!-- leading slot -->
  !{if leading != null}
    <div data-slot="stat-card-leading" aria-hidden="true">
      ${leading}
    </div>
  !{/if}

  <div data-slot="stat-card-body">

    <figcaption id="<titleId>" data-slot="stat-card-title">
      ${title}                          <!-- server-escaped -->
    </figcaption>

    <!-- value row: prefix + value + suffix -->
    <div data-slot="stat-card-value-row">
      !{if !prefix.isEmpty()}
        <span aria-hidden="true" data-slot="stat-card-prefix">${prefix}</span>
      !{/if}
      <p data-slot="stat-card-value" aria-atomic="true">
        ${value}                        <!-- server-formatted, server-escaped -->
      </p>
      !{if !suffix.isEmpty()}
        <span aria-hidden="true" data-slot="stat-card-suffix">${suffix}</span>
      !{/if}
    </div>

    <!-- trend indicator (omitted when trend == "none") -->
    !{if !trend.equals("none")}
      <div data-slot="stat-card-trend" data-trend="${trend}">
        <span role="img"
              aria-label="${trendLabel.isEmpty()
                ? computedTrendLabel(trend, trendValue)   <!-- server-computed -->
                : trendLabel}">
          @template.lievit.icon(name=trendIconName(trend), cssClass="...", attrs="aria-hidden=\"true\"")
          !{if !trendValue.isEmpty()}
            <span aria-hidden="true">${trendValue}</span>
          !{/if}
        </span>
      </div>
    !{/if}

    <!-- description (omitted when empty) -->
    !{if !description.isEmpty()}
      <p data-slot="stat-card-description">${description}</p>
    !{/if}

  </div>

  <!-- trailing slot -->
  !{if trailing != null}
    <div data-slot="stat-card-trailing">
      ${trailing}
    </div>
  !{/if}

  <!-- footer slot -->
  !{if footer != null}
    <hr role="separator" aria-hidden="true">
    <div data-slot="stat-card-footer">
      ${footer}
    </div>
  !{/if}

</figure>
```

When `href` is set, the entire `<figure>` is wrapped in:
```
<a href="${href}"
   aria-label="${title}: ${prefix}${value}${suffix}"
   data-slot="stat-card-link">
  <figure aria-hidden="true" ...>
    ...
  </figure>
</a>
```

The `<figure>` receives `aria-hidden="true"` when inside the `<a>` so the link's `aria-label`
is the sole accessible name and the inner structure is not double-read.

When `loading=true`, the value row and trend indicator are replaced by:
```
<div data-slot="stat-card-skeleton" aria-hidden="true">
  <span class="skeleton-bar ..."></span>
  <span class="skeleton-bar ..."></span>
</div>
```
The skeleton bars animate via a CSS keyframe using `--lv-color-muted` (CSP-clean, no inline style).

### Data-* hooks

| attribute | element | purpose |
|---|---|---|
| `data-slot="stat-card"` | root `<figure>` | CSS selector hook for layout + test target |
| `data-variant="${variant}"` | root | styling hook for the variant border accent |
| `data-size="${size}"` | root | styling hook for the size scale |
| `data-trend="${trend}"` | trend container | styling hook for the trend colour |
| `data-slot="stat-card-value"` | value `<p>` | test target for value assertion |
| `data-slot="stat-card-trend"` | trend div | test target for trend assertion |
| `data-slot="stat-card-skeleton"` | skeleton div (loading) | test target for loading state |

### Escaping

- `title`, `value`, `prefix`, `suffix`, `description`, `trendValue` are all server-supplied strings
  rendered through JTE's HTML-escaped `${}` output — safe by default.
- `attrs` is TRUSTED raw (`$unsafe`) and must only contain STATIC, author-typed strings (wire
  directives, `data-testid`, HTMX attributes). Never pass a per-row DB string through `attrs`.
- `dataAttrs` values are each escaped via `Escape.htmlAttribute` and emitted as `data-*` attributes.
  Use this channel for per-row identifiers in looped contexts.

### HTMX refresh pattern (consumer responsibility)

The stat-card itself ships no HTMX. The consuming template may add an HTMX poll or trigger on the
wrapping element:

```
@template.lievit.stat-card(
  title="Nuovi contatti",
  value="${stats.newContacts()}",
  trend="up",
  trendValue="+12 %",
  attrs="hx-get=\"/stats/contacts\" hx-trigger=\"every 30s\" hx-target=\"this\" hx-swap=\"outerHTML\""
)
```

The `attrs` channel carries the HTMX attributes as a STATIC, author-typed string (not per-row DB
data), consistent with the escaping contract.

## 7. Acceptance tests

The component is done only when ALL of the following pass on a REAL substrate (not a mocked one).

### Render tests (jsdom, real JTE compiler + render gate)

- **`renders-default-card`**: a stat-card with `title="Ricavi"`, `value="€ 38 000"` renders a
  `<figure data-slot="stat-card">` containing a `<figcaption>` with "Ricavi" and a
  `<p data-slot="stat-card-value">` with "€ 38 000". No trend element present when `trend="none"`.
- **`renders-prefix-and-suffix`**: `prefix="€"` renders a `<span aria-hidden>` before the value;
  `suffix="%"` renders one after. Both are `aria-hidden="true"`.
- **`renders-trend-up`**: `trend="up"` and `trendValue="+12 %"` renders the trend container with
  `data-trend="up"`, a `<span role="img">` whose `aria-label` contains "in aumento" and "+12 %".
  The SVG icon inside has `aria-hidden="true"`.
- **`renders-trend-down`**: `trend="down"` renders a `<span role="img">` whose `aria-label`
  contains "in calo".
- **`renders-trend-neutral`**: `trend="neutral"` renders a `<span role="img">` whose `aria-label`
  contains "stabile".
- **`trend-none-omits-element`**: `trend="none"` → no element with `data-slot="stat-card-trend"` in
  the output DOM.
- **`renders-description`**: a non-empty `description` renders a `<p data-slot="stat-card-description">`.
  Empty `description` → element absent.
- **`renders-loading-skeleton`**: `loading=true` → root has `aria-busy="true"`;
  `data-slot="stat-card-skeleton"` present; `data-slot="stat-card-value"` absent (replaced).
- **`renders-linked-card`**: `href="/detail"` → root is `<a data-slot="stat-card-link">` with
  `aria-label` containing both the title and the formatted value; inner `<figure>` has
  `aria-hidden="true"`.
- **`renders-leading-slot`**: a `leading` content param renders inside
  `<div data-slot="stat-card-leading" aria-hidden="true">`.
- **`renders-trailing-slot`**: a `trailing` content param renders inside
  `<div data-slot="stat-card-trailing">`.
- **`renders-footer-slot`**: a `footer` content param renders inside
  `<div data-slot="stat-card-footer">` preceded by an `<hr role="separator" aria-hidden="true">`.
- **`no-footer-omits-hr`**: `footer=null` → no `<hr>` and no footer element in output.

### axe-core assertions (rendered DOM, jsdom)

- **`axe-default-card`**: zero axe violations on the default rendered card DOM (rules: `wcag2a`,
  `wcag2aa`, `wcag21aa`). Passes `image-alt`, `color-contrast`, `aria-labelledby`.
- **`axe-trend-indicator`**: zero violations on a card with `trend="up"` — confirms the `role=img`
  + `aria-label` satisfies `aria-allowed-role` + `aria-label` rules.
- **`axe-linked-card`**: zero violations on a linked card — confirms the `<a>` has an accessible
  name (from `aria-label`), no duplicate-id, no nested interactive.
- **`axe-loading-card`**: zero violations on `loading=true` — confirms `aria-busy` is valid in context.
- **`axe-icon-only-leading`**: when `leading` contains a bare `<svg>`, axe catches a missing
  accessible label; when it contains `<svg aria-hidden="true">`, zero violations. (This test
  documents the adopter contract: decorative icons in slots must be `aria-hidden`.)

### Keyboard tests (jsdom)

- **`linked-card-tab-reachable`**: when `href` is set, the card is in the tab order and receives
  focus on Tab. When not linked and slots are empty, it is NOT in the tab order.
- **`linked-card-enter-follows-href`**: pressing Enter on the focused `<a>` fires the native link
  navigation (assert `click` event fires on the element).
- **`trailing-slot-interactive`**: when `trailing` contains a `<button>`, Tab moves focus from the
  card `<a>` into the button inside `trailing` (the card does not intercept slot focus traversal).

### Variant / size tests (jsdom)

- **`variant-classes`**: each of `default | info | success | warning | destructive` renders with
  `data-variant="<variant>"` on the root. The `info` variant has the accent-border token class; the
  `default` variant does not.
- **`size-classes`**: each of `sm | md | lg` renders with `data-size="<size>"` on the root, and the
  value element carries the correct font-size token class for that size.

### Escaping / security tests (jsdom)

- **`dataAttrs-hostile-value`**: `dataAttrs={"id": "\">|<script>alert(1)"}` — the rendered
  `data-id` attribute value is HTML-escaped and does not break out of the attribute or inject a
  `<script>` tag. Assert the raw output string is inert.
- **`value-xss`**: `value="<img onerror=alert(1)>"` rendered through JTE's `${}` channel produces
  the literal escaped text, not an injected element.

### JTE compile + render gate

- **`jte-compiles`**: covered by the `test/jte-compile` real-compiler gate that runs over
  `registry/jte/stat-card.jte`. No separate test needed; this gate runs on every CI build.

## 8. Non-goals / anti-patterns

- **No client-side number formatting.** The server formats `value` before binding. A raw double or
  `long` passed as `value` produces an unformatted string. Format in the Spring controller.
- **No chart or sparkline built in.** A sparkline or inline bar chart belongs in the `footer` slot
  (compose the `chart` partial there). The stat-card does not ship a chart.
- **No interactive counter.** If the metric responds to user input (e.g. a quantity picker), compose
  a `button` + HTMX on the consuming page. The stat-card fires no actions.
- **No tabs or period switcher built in.** Period switching belongs in the `trailing` slot (a badge
  or `native-select`), wired by the consuming template.
- **No progress bar built in.** For progress toward a target, use the `progress` partial. The
  stat-card's trend indicator is a direction+delta annotation, not a proportional bar.
- **No auto-refresh.** HTMX polling is an adopter concern wired via the `attrs` channel. The partial
  ships no timing logic.
- **No colour-only trend.** The trend direction MUST be communicated textually via `aria-label`,
  never by colour alone. The colour is a reinforcement, not the signal.
- **No hardcoded option data.** No option list, label enum, or icon map is baked into the partial.
  The `trend` icon is determined by a `!{var trendIconName = ...}` switch computed from the param;
  option lists for filters in consuming layouts come from the controller model.
- **No per-component dark-mode rules.** Dark mode is handled by the token re-point block in
  `lievit-tokens.css`; the partial adds no `dark:` utilities that override token semantics.
- **No `<script>` or inline `on*=`.** The CSP is strict; any such tag would be refused silently.
  The partial is server-pure markup: zero `<script>`, zero inline handlers.
- **No Lit / Alpine / React.** This is a PARTIAL. Any interactivity is the adopter's WIRE template
  or HTMX concern, not this component's.
