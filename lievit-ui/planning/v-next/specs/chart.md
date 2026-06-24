<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — chart

- **tier**: PARTIAL (server SVG) + ENH (`chart.enhancer.ts` — optional interactive layer for tooltips,
  crosshairs, and zoom/pan; the static SVG is fully usable without it)
- **build sequence**: S2
- **status (current)**: COVERED (re-forge of existing `registry/jte/chart.jte` and associated server
  rendering; the interaction enhancer is a net-new typed-TS module)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Figure (no APG dedicated chart pattern; built against the W3C
      SVG Accessibility guidance + ARIA `role="img"` + `<title>`/`<desc>` technique, with table
      as an accessible data alternative); the keyboard interaction for the interactive enhancer
      is BUILT against the raw SVG Accessibility API Mappings + APG tooltip pattern
    - inventory: Ant Design Charts (bar, line, area, pie/donut, composed; axes; tooltips; zoom;
      legend; reference lines; responsive wrapper) as inventory reference
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by
      Tailwind UI charts and Recharts visual language (NO code copied)

## 1. What it is

A server-rendered SVG chart (bar, line, area, pie/donut, or composed) built from a typed Java data
model, delivered as a PARTIAL. The chart itself is pure presentation — the DATA is a server fact, the
visual encoding is a deterministic function of that data, and there is nothing client-owned about the
pixel positions of bars or the curve of a line. Server-first works well here: every other framework
ships client-JS chart engines (Recharts, Chart.js, ECharts) because they historically assumed data
arrived over a fetch; in a server-rendered stack the data is already on the server, so generating the
SVG there eliminates the JS bundle, the flash-of-empty-chart, and the client-side re-render cycle.

The chart emits an accessible `<svg role="img">` with a machine-readable `<title>` and `<desc>` plus a
visually-hidden `<table>` fallback (all rows and values, usable by screen readers and data-table
scrapers). For interactive features that CANNOT be expressed server-side without an unacceptable
round-trip penalty (hover tooltip pinpointing a datum, crosshair following the pointer, client-driven
zoom/pan on large datasets), an optional `chart.enhancer.ts` typed-TS module overlays those behaviors
on the static SVG without re-rendering the chart data. The enhancer is the irreducible client bit; the
chart is fully legible and accessible without it.

The component does NOT bundle a client-side JS charting library. Every pixel in the SVG is authored
server-side by the Java `ChartRenderer` helper. This is the decision that makes lievit charts behave
like lievit components instead of like embedded third-party widgets.

## 2. API — params / props

### 2.a JTE `@param` surface (PARTIAL — the typed rendering surface)

| param | type | default | meaning |
|---|---|---|---|
| `type` | `ChartType` (enum) | `BAR` | `BAR \| LINE \| AREA \| PIE \| DONUT \| COMPOSED` |
| `series` | `List<ChartSeries>` | — | **required**; each series carries a name, a list of `ChartPoint` (x-value + y-value), and an optional `color` override |
| `xAxis` | `ChartAxis` | defaults | label, formatter, tick count, type (`CATEGORY \| NUMERIC \| TIME`), hide flag |
| `yAxis` | `ChartAxis` | defaults | label, formatter, tick count (suggested), min/max override, hide flag |
| `y2Axis` | `ChartAxis` | null | optional second Y axis for composed charts; null = single axis |
| `legend` | `ChartLegend` | defaults | position (`TOP \| BOTTOM \| LEFT \| RIGHT`), hide flag |
| `referenceLines` | `List<ChartReferenceLine>` | `[]` | horizontal or vertical reference lines (value + label + dashed style) |
| `height` | `int` | `300` | SVG height in px (width = 100%, responsive) |
| `aspectRatio` | `String` | null | CSS aspect-ratio override (e.g. `"16/9"`); when set, `height` is ignored |
| `title` | `String` | — | **required**: the chart's accessible name; rendered as SVG `<title>` + `aria-labelledby`; also the visible heading when `showTitle=true` |
| `description` | `String` | null | optional accessible description; rendered as SVG `<desc>` + `aria-describedby` |
| `showTitle` | `boolean` | `false` | renders a visible `<h3>` heading above the chart |
| `colorPalette` | `String` | `"default"` | `default \| categorical \| sequential \| diverging` — maps to `--lv-chart-color-N` token series |
| `gridLines` | `boolean` | `true` | show horizontal grid lines |
| `interactive` | `boolean` | `false` | if `true`, emits `data-lievit-enhancer="chart"` to mount `chart.enhancer.ts`; activates `data-point-*` annotations on SVG elements |
| `zoomable` | `boolean` | `false` | enables the zoom/pan sub-behavior of the enhancer (requires `interactive=true`) |
| `showTable` | `boolean` | `true` | renders the visually-hidden accessible `<table>` alternative; can be set `false` for sparklines |
| `tableCaption` | `String` | derived from `title` | caption text for the accessible table |
| `loading` | `boolean` | `false` | shows a skeleton placeholder; renders an empty SVG frame + `aria-busy="true"` + the `spinner` partial |
| `emptyText` | `String` | `"No data"` | text shown when all `series` have zero points |
| `cssClass` | `String` | `""` | extra utility classes on the outer container |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `data-testid="revenue-chart"`) |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` (each value via `Escape.htmlAttribute`) |

`ChartSeries` record: `String name, List<ChartPoint> data, String color /* nullable */, String seriesType /* nullable, for COMPOSED */`.
`ChartPoint` record: `Object x /* String or Number */, double y`.
`ChartAxis` record: `String label, Function<Object,String> formatter, int tickCount, boolean hide, ChartAxisType type, Double min, Double max`.
`ChartReferenceLine` record: `double value, AxisRef axis /* X or Y */, String label, boolean dashed`.

### 2.b Enhancer attributes (emitted by the JTE template when `interactive=true`)

| attribute | on | meaning |
|---|---|---|
| `data-lievit-enhancer="chart"` | outer container | mounts `chart.enhancer.ts` |
| `data-chart-type` | outer container | the chart type string (for enhancer branching) |
| `data-chart-zoomable` | outer container | `"true"` when zoomable |
| `data-point-series` | each `<rect>`/`<circle>`/`<path>` data mark | escaped series name |
| `data-point-x` | each data mark | escaped x-axis value string |
| `data-point-y` | each data mark | escaped y-axis value string (formatted) |
| `data-point-index` | each data mark | zero-based index within the series |
| `data-tooltip-id` | outer container | `id` of the tooltip overlay `<div>` the enhancer controls |
| `data-legend-item` | each legend item SVG/span | series name; the enhancer uses this for series highlight |

All per-point `data-point-*` values pass through `Escape.htmlAttribute` (the SAFE escaping channel),
never through `attrs` (TRUSTED raw). An adopter-supplied x-label cannot inject attributes.

## 3. Variants / sizes / states

### Chart types (the `type` enum — each is a distinct render path in `ChartRenderer`)

| type | description | key features |
|---|---|---|
| `BAR` | vertical bar chart | grouped / stacked mode (`stackMode`); negative values; label on bar |
| `LINE` | line chart | linear / monotone / step curve (`curveType`); dot on data point; smooth |
| `AREA` | area chart | filled below line; stacked area support; gradient fill option |
| `PIE` | pie chart | sector labels; inner radius = 0 (full pie) |
| `DONUT` | donut chart | same as pie, `innerRadius > 0`; center stat slot (accessible via `<text>`) |
| `COMPOSED` | overlay of bar + line + area | per-series `seriesType` override; Y/Y2 axis assignment |

Each type maps its data marks to SVG primitives (`<rect>`, `<polyline>`, `<path>`, `<circle>`) that
carry the `data-point-*` attributes for the enhancer. The server renderer produces clean, minimal SVG —
no animation attributes, no embedded `<script>`, no `on*=` handlers.

### Sizes / responsive behavior

Charts are WIDTH-RESPONSIVE (100% of their container by default). Height is set via the `height` param
(default 300 px) or overridden by `aspectRatio`. There is no `sm/md/lg` size token in the height sense
(chart height is data-driven); the axis label size and tick density scale via the `--lv-text-xs` token.
The outer `<figure>` is a block element; the SVG `viewBox` is computed from the rendered pixel
dimensions at server time so it scales correctly without a JS resize observer.

### States

| state | how expressed |
|---|---|
| `loading=true` | outer `aria-busy="true"` + skeleton overlay (`--lv-color-muted` animated shimmer via CSS `@keyframes`); SVG frame renders as empty |
| all series empty | `emptyText` message centred in the SVG frame (role="status" for announcements) |
| `interactive=true` + data mark hovered | enhancer adds `data-highlighted` on the mark + sibling marks in the same x-band; tooltip appears |
| `zoomable=true` + zoom active | enhancer stamps `data-zoom-active` on the container; an in-SVG brush selection rectangle is rendered by the enhancer |
| `showTitle=false` | no visible heading; `title` is still mandatory for a11y (goes into SVG `<title>`) |

### Slot vocabulary

The chart PARTIAL has no `gg.jte.Content` slot for the main data surface (data is a typed Java model,
not caller markup). Two optional `gg.jte.Content` slots are provided for peripheral content:

| slot | param | meaning |
|---|---|---|
| `header` | `gg.jte.Content header` | rendered above the chart figure (stat summary, title row, filter chips) |
| `footer` | `gg.jte.Content footer` | rendered below (source note, time-range selector, export link) |

These are the only `Content` slots. The chart body itself is NEVER a slot — data comes in via `series`.

## 4. The a11y contract

- **WAI-ARIA pattern**: no dedicated APG chart pattern exists. The implementation is BUILT against:
    - W3C SVG Accessibility Techniques (`role="img"` + `<title>` + `<desc>`) for the static SVG shell
    - APG Tooltip pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) for the interactive
      hover/focus tooltip
    - WCAG 2.2 success criteria 1.1.1 (Non-text content), 1.3.1 (Info and Relationships), 4.1.2
      (Name, Role, Value)
    - The `<table>` alternative is the primary non-visual access path (all values, series names, x
      labels, formatted y values — same information as the visual chart)

  APG URL used: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
  SVG a11y reference: https://www.w3.org/TR/svg-aam-1.0/ and https://www.w3.org/WAI/tutorials/images/complex/

- **roles + ARIA**:
    - outer `<figure>`: no explicit role (native `figure` semantic); `aria-labelledby="<titleId>"`
      (pointing at the visible title when `showTitle=true`, or at the SVG `<title>` id otherwise)
    - SVG element: `role="img"` `aria-labelledby="<svgTitleId>"` `aria-describedby="<svgDescId>"`
      (when `description` is set); `aria-busy="true"` during loading
    - SVG `<title id="<svgTitleId>">`: the accessible name of the chart (the `title` param)
    - SVG `<desc id="<svgDescId>">`: the accessible description (the `description` param when set)
    - data mark elements (`<rect>`, `<circle>`, `<path>`) when `interactive=true`:
      each gets `role="img"` `aria-label="<seriesName>: x=<xVal>, y=<yVal>"` + `tabindex="0"` so
      keyboard users can navigate individual data points (not just rely on the table)
    - accessible table: `aria-hidden="false"` (visible to AT, visually hidden via `sr-only`);
      `<caption>` = `tableCaption`; `<th scope="col">` for series names; `<th scope="row">` for x
      labels; `<td>` for each y value (formatted with units)
    - legend items: `aria-label="<seriesName> series"` on each legend marker
    - tooltip overlay `<div>` (when `interactive=true`): `role="tooltip"` `id="<tooltipId>"`
      `aria-live="off"` (it is shown on hover/focus; it is not an asynchronous status update)
    - the focused data mark gets `aria-describedby="<tooltipId>"` added by the enhancer when the
      tooltip is visible

- **keyboard map** (static chart + interactive enhancer):
  | key | does | who |
  |---|---|---|
  | Tab | move focus to the chart figure, then into each focusable data mark (when `interactive=true`) | platform + tabindex on marks |
  | Tab (within marks) | advance to next data mark in document order (left-to-right, series-by-series) | platform |
  | Shift+Tab | move to previous data mark | platform |
  | Enter / Space (on a focused data mark) | show / dismiss the tooltip for that mark | enhancer |
  | Escape (tooltip visible) | dismiss the tooltip; return focus to the triggering mark | enhancer (APG Tooltip key) |
  | Tab (while tooltip visible) | dismiss tooltip; advance focus normally | enhancer |
  | Home (mark focused) | jump focus to first mark in the current series | enhancer |
  | End (mark focused) | jump focus to last mark in the current series | enhancer |
  | ArrowLeft / ArrowRight (mark focused) | move to previous / next mark WITHIN the same series | enhancer |
  | ArrowUp / ArrowDown (mark focused, COMPOSED chart) | move to the same x-position in the previous / next series | enhancer |
  | (static chart, no `interactive`) | Tab focuses the figure; no marks are individually focusable; the table is the data access path | platform |

  When `interactive=false`, the SVG receives `aria-hidden="false"` (the `<title>`/`<desc>` are the
  access point), and the visually-hidden table is the data alternative. No keyboard marks.

  When `zoomable=true` and a zoom brush is active (pointer-drag or keyboard selection), Esc cancels
  the zoom and restores the full view; Enter commits the zoom. The brush start/end are set via
  ArrowLeft/Right with Shift held (shifts the brush endpoint).

- **focus management**:
    - Static (`interactive=false`): the `<figure>` is in the tab order (tabindex=0 on the outer
      `<figure>` only). The SVG itself is `focusable="false"` (SVG 2 attribute); screenreaders access
      it via the `role="img"` + title/desc.
    - Interactive (`interactive=true`): each data mark has `tabindex="0"` (NOT roving; marks are a
      flat linear sequence, not a managed collection). The enhancer manages focus-within: when a mark
      loses focus, the tooltip is dismissed. No focus trap (a chart is non-modal).
    - The visible tooltip has `tabindex="-1"` (it is not independently focusable; focus stays on the
      mark that triggered it).
    - Focus restore: when the chart is inside a dialog and the dialog closes, the runtime morph +
      `focus-trap.enhancer.ts` handle restore to the dialog trigger (not this component's concern).
    - The enhancer does NOT compose `collection-nav` (marks are a flat sequence by tabindex, not a
      managed roving-tabindex collection); ArrowLeft/Right are local enhancements registered by the
      chart enhancer directly.

- **live region**: the `emptyText` message sits in a `role="status"` span so it is announced when
  the chart transitions to empty (e.g. after a filter removes all data via an HTMX swap). Loading
  state uses `aria-busy="true"` on the SVG. The tooltip does NOT use a live region
  (`role="tooltip"` with `aria-describedby` is the correct AT announcement path for hover/focus
  tooltips per APG).

- **shared mechanisms composed**:
    - APG Tooltip pattern via the `chart.enhancer.ts` (show-on-focus + show-on-hover + Esc to
      dismiss). This is the SAME tooltip behavior as the `tooltip` partial's enhancer — the chart
      enhancer delegates to the shared tooltip show/hide logic (a shared `tooltip-behavior.ts`
      utility), not a hand-roll. (The tooltip partial's `chart.enhancer.ts` import ensures tooltip
      positioning + ARIA wiring are consistent across the library.)
    - No popover seam (the chart tooltip is absolutely-positioned relative to the chart container,
      not a CSS Anchor Positioning popover — the anchor would need to be each `<rect>`/`<circle>`
      which are SVG elements not yet fully supported by CSS Anchor in all targets; CSS `transform`
      from the mark's bounding box is used instead).
    - No focus-trap (non-modal).
    - No collection-nav (flat tabindex, not a managed collection).

## 5. Tokens

### Colour tokens (OKLCH, additive)

| token | meaning | light | dark |
|---|---|---|---|
| `--lv-chart-color-1` through `--lv-chart-color-8` | categorical series palette (the default 8-color set) | `oklch(0.60 0.18 <hue-N>)` | `oklch(0.72 0.18 <hue-N>)` |
| `--lv-chart-color-seq-start` | sequential palette start | `oklch(0.88 0.06 250)` | `oklch(0.30 0.06 250)` |
| `--lv-chart-color-seq-end` | sequential palette end | `oklch(0.42 0.20 250)` | `oklch(0.75 0.20 250)` |
| `--lv-chart-color-div-neg` | diverging palette negative pole | `oklch(0.55 0.22 25)` | `oklch(0.68 0.22 25)` |
| `--lv-chart-color-div-pos` | diverging palette positive pole | `oklch(0.55 0.18 160)` | `oklch(0.68 0.18 160)` |
| `--lv-chart-color-grid` | grid line colour | `oklch(0.90 0 0)` | `oklch(0.22 0 0)` |
| `--lv-chart-color-axis` | axis line + tick colour | `oklch(0.72 0 0)` | `oklch(0.45 0 0)` |
| `--lv-chart-color-axis-label` | axis label text colour | `oklch(0.60 0 0)` | `oklch(0.55 0 0)` |
| `--lv-chart-color-tooltip-bg` | tooltip background | `oklch(0.99 0 0)` | `oklch(0.15 0 0)` |
| `--lv-chart-color-tooltip-fg` | tooltip text | `oklch(0.20 0 0)` | `oklch(0.92 0 0)` |
| `--lv-chart-color-highlight` | highlighted mark overlay (hover/focus) | `oklch(0.99 0 0 / 0.35)` | `oklch(0.15 0 0 / 0.35)` |
| `--lv-chart-color-brush` | zoom brush fill | `oklch(0.60 0.12 250 / 0.20)` | `oklch(0.72 0.12 250 / 0.20)` |
| `--lv-chart-color-brush-border` | zoom brush border | `oklch(0.60 0.18 250)` | `oklch(0.72 0.18 250)` |
| `--lv-chart-color-reference` | reference line colour | `oklch(0.60 0.0 0)` | `oklch(0.55 0.0 0)` |

All `--lv-chart-color-*` tokens are NET-NEW (the existing token set has no chart palette). They are
additive: added to `:root` + the `.dark, [data-theme="dark"]` re-point block, namespaced, not
literals. No chart colour is ever hardcoded inside the component.

### Structural tokens (existing, consumed read-only)

| token | used for |
|---|---|
| `--lv-text-xs` | axis tick labels, legend text, tooltip label |
| `--lv-text-sm` | axis title labels, chart title (when `showTitle=true`) |
| `--lv-font-sans` | all text in the SVG (via `font-family` SVG attribute set to `var(--lv-font-sans)`) |
| `--lv-space-2` | tick label offset from axis, internal padding |
| `--lv-space-3` | legend item gap, tooltip padding x |
| `--lv-space-4` | tooltip padding y, chart header/footer gap |
| `--lv-radius-md` | tooltip border-radius, bar rounded-top (when `rounded=true`) |
| `--lv-shadow-md` | tooltip box-shadow |
| `--lv-z-popover` | tooltip z-index (above page content but below modals) |
| `--lv-ring` | focus ring on individual data marks (interactive mode, `outline: var(--lv-ring)`) |
| `--lv-color-muted` | loading skeleton shimmer base |
| `--lv-color-border` | chart container border (when `bordered=true` param is set) |

## 6. Wire / island integration

### Server-rendered JTE structure

The component is a PARTIAL: no WIRE Java component, no wire round-trip. The adopting controller
builds the `ChartSeries` + `ChartAxis` model from its data source and passes it via `@param`. There is
no Java `ChartComponent.java` with `@Wire` fields.

Structural skeleton (conceptual, the implementation generates it):

```
<figure data-slot="chart"
        data-chart-type="${type.name().toLowerCase()}"
        data-variant="${colorPalette}"
        class="${cssClass} ..."
        aria-labelledby="<titleId>"
        ${attrs}>    <!-- TRUSTED raw: static wire directives only -->

  <!-- visible title (showTitle=true only) -->
  <h3 id="<titleId>" class="...">...</h3>

  <!-- optional header slot -->
  <!-- rendered when header param non-null -->

  <!-- loading skeleton (loading=true) -->
  <div aria-busy="true" role="status" ...>spinner partial</div>

  <!-- the SVG -->
  <svg role="img"
       aria-labelledby="<svgTitleId>"
       aria-describedby="<svgDescId>"  <!-- only when description set -->
       focusable="false"
       width="100%"
       height="${height}"
       viewBox="0 0 ${computedWidth} ${height}"
       data-tooltip-id="<tooltipId>"   <!-- only when interactive=true -->
       data-lievit-enhancer="chart"    <!-- only when interactive=true -->
       ...>

    <title id="<svgTitleId>">${title}</title>
    <desc id="<svgDescId>">${description}</desc>   <!-- only when description set -->

    <!-- grid lines group -->
    <g class="lv-chart__grid" aria-hidden="true"> ... </g>

    <!-- x axis -->
    <g class="lv-chart__x-axis" aria-hidden="true"> ... </g>

    <!-- y axis (+ optional y2 axis) -->
    <g class="lv-chart__y-axis" aria-hidden="true"> ... </g>

    <!-- reference lines -->
    <g class="lv-chart__reference-lines" aria-hidden="true"> ... </g>

    <!-- data series (bars / lines / areas / pie sectors) -->
    <!-- each data mark: -->
    <!--   <rect class="lv-chart__bar" -->
    <!--         role="img" aria-label="<series>: x=<xVal>, y=<yVal>" -->
    <!--         tabindex="0"  (only when interactive=true) -->
    <!--         data-point-series="<escaped>" -->
    <!--         data-point-x="<escaped>" -->
    <!--         data-point-y="<escaped>" -->
    <!--         data-point-index="<N>" -->
    <!--         fill="var(--lv-chart-color-<N>)" -->
    <!--         ... /> -->

    <!-- legend (inside SVG for positioning; aria-hidden since the table covers semantics) -->
    <g class="lv-chart__legend" aria-hidden="true"> ... </g>

  </svg>

  <!-- accessible table (sr-only, unless showTable=false) -->
  <table class="sr-only" aria-label="${tableCaption}">
    <caption>...</caption>
    <thead><tr><th scope="col">...</th>...</tr></thead>
    <tbody>...</tbody>
  </table>

  <!-- tooltip overlay (only when interactive=true) -->
  <div id="<tooltipId>"
       role="tooltip"
       aria-live="off"
       class="lv-chart__tooltip ..."
       hidden>
    <!-- populated by the enhancer on hover/focus -->
  </div>

  <!-- optional footer slot -->

</figure>
```

All `data-point-*` attribute values are written through `Escape.htmlAttribute` in the JTE template
(the SAFE escaping channel), regardless of where the x/y values originate. The `attrs` param accepts
only TRUSTED static author strings and is marked `$unsafe` to prevent dynamic data entering that path.

The SVG uses `aria-hidden="true"` on axis/grid/legend groups because those are decorative; the
accessible name and data live in the `<title>`, `<desc>`, and the `<table>`.

### Enhancer responsibilities (`chart.enhancer.ts`)

The enhancer is registered in the lievit runtime directive registry under the `"chart"` name:
`LievitRuntime.enhancers.register("chart", ChartEnhancer)`. It is instantiated per-chart when
`data-lievit-enhancer="chart"` is present on the SVG; when absent (static chart), the module is
never instantiated and the JS is tree-shaken away.

Responsibilities:

1. **Tooltip show/hide**: on `pointerenter` / `focus` on a `[data-point-series]` mark, read the
   `data-point-*` attributes (already escaped; no eval), compute the tooltip content string from
   them, inject it into the `[role="tooltip"]` div (text content, not innerHTML — XSS safe), position
   the tooltip div relative to the mark's bounding box (`getBoundingClientRect` + CSS transform), and
   remove the `hidden` attribute. On `pointerleave` / `blur`, add `hidden` again. Delegates to the
   shared `tooltip-behavior.ts` utility for the show/hide/position logic (single-source, same as the
   `tooltip` partial enhancer).

2. **ARIA link**: when showing the tooltip for a focused mark, the enhancer sets
   `aria-describedby="<tooltipId>"` on that mark and removes it on hide.

3. **Keyboard navigation within marks**: registers `keydown` on each mark for
   ArrowLeft/Right (prev/next within series), ArrowUp/Down (same x-position, different series in
   COMPOSED charts), Home/End (first/last in series), Esc (dismiss tooltip). These are registered
   on the SVG element (event delegation by `data-point-index` + `data-point-series`), not on each
   mark individually.

4. **Series highlight**: on hover/focus, the enhancer adds `data-highlighted="true"` on marks in the
   same x-band across series (visual indication of the shared x-position), and `data-dim="true"` on
   unrelated marks. Removed on leave/blur. This is a CSS-driven visual change (`:has([data-dim]) .lv-chart__bar { opacity: 0.4 }`), never an inline style.

5. **Zoom / pan** (when `data-chart-zoomable="true"`): the enhancer registers `pointerdown` on the
   SVG for brush selection, tracks `pointermove` to render the brush rectangle (a plain SVG `<rect>`
   appended by the enhancer with `pointer-events:none`), and on `pointerup` computes the new domain
   window from pixel coordinates, then re-scales the visible marks via CSS `transform` on the series
   group (a client-side scale that does NOT re-fetch data; the server already sent all points). A
   "Reset zoom" button (injected by the enhancer below the chart) clears the transform. For datasets
   too large for client-side re-scale, the adopter replaces zoom with an HTMX pattern: a range-select
   fires an HTMX request that re-renders the chart partial with a narrower `series` window.

6. **Morph stability**: the enhancer registers on the lievit lifecycle `onComponentUpdate` to re-apply
   tooltip listeners after a parent WIRE morph patches the DOM (in case the chart is inside a WIRE
   component that re-renders). It does NOT re-render the chart data; only the listener registration is
   refreshed.

The enhancer fires NO wire actions of its own — the chart is a PARTIAL with no WIRE Java component.
If a user click on a chart point should trigger a server action (e.g. drilldown), the adopter wires
it via a `l:click="action"` on the chart's outer `<figure>` using the `attrs` param, or by listening
to the custom DOM event `lv-chart-mark-click` that the enhancer dispatches on the SVG when a mark is
activated (the event carries `{series, x, y, index}` in its `detail`; the adopter can handle it with
a `l:on.lv-chart-mark-click` wire directive or a vanilla listener).

## 7. Acceptance tests

- **render** (jsdom, NO enhancer mounted — static chart): given a `ChartSeries` list with 3 bars,
  the rendered HTML contains `<svg role="img">`, a `<title>` matching the `title` param, an
  `aria-labelledby` pointing to the title id, 3 `<rect class="lv-chart__bar">` elements with
  `data-point-series` / `data-point-x` / `data-point-y` attributes, and an accessible `<table>`
  with correct `<th scope="col">` series headers and `<th scope="row">` x-value headers. The SVG
  `aria-hidden` is NOT present on the `<svg>` element itself (it is accessible via role="img").

- **render — line chart** (jsdom): given 2 series of 5 points, a LINE chart renders a `<polyline>`
  or `<path>` per series, each point visible as a `<circle>` (or equivalent mark) with the correct
  `data-point-*` attributes; the accessible table has 5 rows and 2 data columns.

- **render — pie/donut** (jsdom): given 4 series of 1 point each, a PIE chart renders 4 `<path>`
  sectors; a DONUT renders the same with an `innerRadius` hole; each sector has an `aria-label`
  with the series name and percentage value; the accessible table has 4 rows and 1 column.

- **render — empty** (jsdom): given an empty `series` list, the rendered output contains the
  `emptyText` string in a `role="status"` span; no `<rect>`/`<circle>` marks are rendered.

- **render — loading** (jsdom): given `loading=true`, the outer element has `aria-busy="true"` and
  the spinner partial is present; the SVG data marks are absent.

- **axe-core — static** (jsdom): zero axe violations on the rendered static chart DOM, against rules:
  `aria-required-children`, `image-alt` (the `<svg role="img">` must have an accessible name),
  `table-duplicate-name`, `region`, `color-contrast` (token values must pass WCAG AA for the
  default palette; assert at least `--lv-chart-color-1` through `-4` meet 4.5:1 against the
  background).

- **axe-core — interactive** (jsdom, real `LievitRuntime` + `chart.enhancer.ts` mounted): open a
  focused mark tooltip, then assert zero axe violations; the tooltip has `role="tooltip"` and the
  focused mark has `aria-describedby` pointing to it.

- **keyboard — tooltip** (jsdom + real enhancer): Tab to the first `<rect>` data mark; assert it
  receives focus (tabindex=0); assert the tooltip `hidden` attribute is removed on `focus`; press
  Esc — assert `hidden` is added back and focus remains on the mark.

- **keyboard — mark navigation** (jsdom + real enhancer): Tab to a middle mark; press ArrowRight —
  assert focus moves to the next mark in the same series (index+1); press End — assert focus is on
  the last mark; press Home — assert focus is on the first mark.

- **keyboard — no marks when non-interactive** (jsdom): given `interactive=false`, no mark element
  has `tabindex="0"`; Tab to the chart figure returns only the `<figure>` in the focus path.

- **escaping** (jsdom): a `ChartPoint` whose `x` value is `"><script>alert(1)</script>` must
  render with the `data-point-x` attribute value HTML-escaped (the injected string is inert); assert
  the rendered attribute string does not contain a raw `<`.

- **colour palette** (jsdom): given `colorPalette="categorical"`, the rendered `<rect>` fills reference
  `var(--lv-chart-color-1)` through the series count; assert no literal hex/rgb/oklch colour appears
  in the rendered SVG markup (token-only rule).

- **variants — title visibility** (jsdom): `showTitle=true` → an `<h3>` is present with the title
  text; `showTitle=false` → no `<h3>` present; in both cases the SVG `<title>` element is present.

- **table alternative** (jsdom): `showTable=true` (default) → a `<table class="sr-only">` is
  present with a `<caption>` and all data values rendered as `<td>` cells; `showTable=false` →
  no `<table>` present (used for sparklines where table is noise).

- **zoom** (jsdom + real enhancer): given `interactive=true zoomable=true`, simulate a `pointerdown`
  → `pointermove` → `pointerup` gesture across the SVG; assert that a "Reset zoom" button appears in
  the DOM; click the reset button — assert the button is removed and the data series group CSS
  transform is cleared.

- **lv-chart-mark-click event** (jsdom + real enhancer): simulate Enter on a focused mark; assert
  that a `lv-chart-mark-click` CustomEvent is dispatched on the SVG with `detail.series`,
  `detail.x`, `detail.y`, `detail.index` populated correctly.

- **COMPOSED chart** (jsdom): given 2 series (one BAR, one LINE via `seriesType` override) in a
  COMPOSED chart, both a `<rect>` (bar) and a `<polyline>` (line) appear in the SVG; each has
  correct `data-point-series` values; both series appear in the accessible table.

- **reference lines** (jsdom): given one horizontal reference line at y=100, a `<line>` or `<path>`
  element with `class="lv-chart__reference-line"` is present in the SVG at the correct computed
  y-position; the reference label text is present in the SVG.

- **wire round-trip** (N/A: this is a PARTIAL with no WIRE Java component; the adopting controller
  is responsible for constructing the model. The JTE compile+render gate covers this path.)

- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate
  (all chart types exercised with representative fixtures).

- **Playwright — gesture fidelity** (legacy-VM oracle): hover over a bar in the rendered chart in
  the real browser — assert the tooltip overlay becomes visible and contains the correct series name
  and y value (not a mocked substrate — the client-island-fidelity lesson: the tooltip must appear
  in the REAL DOM, not just in a jsdom assertion that a `hidden` attribute was toggled). Tab to a
  data mark, assert focus ring is visible.

## 8. Non-goals / anti-patterns

- **No client-side JS charting library** (no Recharts, no Chart.js, no ECharts, no D3 bundled).
  The SVG is authored server-side. The enhancer handles only the interactive overlay layer; it does
  NOT re-compute or re-render the chart geometry.

- **No `<canvas>` rendering**. The chart is SVG for accessibility (screen readers can traverse the
  a11y tree of SVG elements; `<canvas>` is opaque to AT without additional, fragile ARIA).

- **No animation** by default. CSS transitions on hover highlight are acceptable (pure CSS, no JS
  animation loops). No SVG `<animate>`, no JS tweening. Animation is a common source of motion
  sickness (WCAG 2.3.3) and adds bundle cost without semantic benefit in a gestionale context.
  An adopter who needs animated intro can add a CSS class.

- **No inline `<style>` or `on*=` in the SVG**. The CSP refuses them and the house convention bars
  them. All styling is via `var(--lv-*)` SVG `fill`/`stroke` attribute references, never hardcoded
  colour values or inline style attributes.

- **No embedded `<script>` inside the SVG**. The SVG is inlined in HTML; an SVG `<script>` would
  execute in the page context. The enhancer is a separate `chart.enhancer.ts` module.

- **No imperative API** (no `chart.setData()`, no `chart.addPoint()`, no event emitters on the
  Java component). If the data changes, the adopter re-renders the partial (HTMX swap, page
  navigation, or a parent WIRE morph). The SVG is always a deterministic projection of the data at
  render time.

- **No multi-axis pie** (no concentric donut rings). DONUT has a single ring. Concentric rings
  are a separate, rarely-needed chart type with distinct accessibility challenges; compose two
  DONUT charts if needed.

- **Not a real-time streaming chart**. For live data, the adopter composes a parent WIRE component
  that re-renders the chart partial on a server-push / polling cycle. The chart partial is stateless;
  it does not manage a data window.

- **Not a replacement for a full analytics dashboard library**. For complex cross-filtering,
  linked brushing across charts, or embedded BI pivot tables, the adopter uses a server-side BI
  tool or an Analytics iframe. This component covers bar/line/area/pie for gestionale dashboards,
  not generic BI tooling.

- **The enhancer does not render new SVG elements for chart data**. It adds only the tooltip div,
  the brush rect during zoom gesture, and the Reset button — all are peripheral to the chart data.
  Any agent that tries to generate SVG paths or re-draw bars in JS is violating this contract.
