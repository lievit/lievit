<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — pagination

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/pagination.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Navigation landmark (native `<nav>` + `<a>` links + `aria-current="page"` —
      platform-supplied; no react-aria reference needed because `<nav>` + real `<a>` elements carry the
      landmark role + keyboard + focus for free; the only ARIA augmentation is `aria-current` on the
      active page link, exactly as APG Breadcrumb documents the pattern:
      https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/ and
      https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
    - inventory: Ant Design Pagination as inventory reference (numbered pages, prev/next, ellipsis,
      page-size switcher, quick-jumper, total count display, size variants, simple mode)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A navigation control that lets a user move through a server-paginated resource by page number. It renders
a `<nav>` landmark containing prev/next controls and a numbered page list; the current page is marked with
`aria-current="page"` on its link. STATIC presentational → PARTIAL: pagination holds NO client state. The
consuming context (a WIRE table, an HTMX fragment, a controller-rendered list) owns the current page and
total count; this partial receives them as typed `@param`s and renders the correct markup. The page links
are plain `<a href>` elements — a click navigates (Turbo Drive intercepts for SPA-like transitions),
or the consuming WIRE template replaces them with `l:click="goToPage"` wired `<button>` elements when
navigation must be a wire action instead of a URL change.

Server-first works trivially: there is nothing client about a page indicator. The entire pagination chrome
is a function of (currentPage, totalPages, windowSize, baseUrl) — all server facts. This is the same
decision rule as `button`: the partial renders only the styled control; the consuming context wires the
action.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `currentPage` | `int` | — | **Required.** 1-based index of the active page. |
| `totalPages` | `int` | — | **Required.** Total page count. 0 or 1 → renders nothing (single page needs no pagination chrome). |
| `baseUrl` | `String` | `null` | URL prefix for page links: `baseUrl + "?page=" + n`. When null the partial renders `<button>` elements (wire mode — caller supplies `attrs`/`wireClick` for each page via the loop). |
| `windowSize` | `int` | `5` | Number of page buttons visible around the current page (the sliding window). Must be odd ≥ 3. Controls how many numbered items appear before ellipsis truncation kicks in. |
| `showFirstLast` | `boolean` | `true` | Render explicit "first page" and "last page" buttons beyond the window edges. When `false`, only prev/next and the window are rendered. |
| `showPrevNext` | `boolean` | `true` | Render prev (‹) and next (›) arrow buttons flanking the page list. |
| `showTotal` | `boolean` | `false` | Render a "Total N items" or "Page X of Y" summary before the nav. Caller supplies `totalItems` when enabled. |
| `totalItems` | `long` | `0` | Item count for the summary label (read only when `showTotal=true`). |
| `showSizeSwitcher` | `boolean` | `false` | Render a native `<select>` for page-size selection after the nav. Requires `pageSizes` + `currentPageSize`. |
| `pageSizes` | `List<Integer>` | `[10, 20, 50, 100]` | Options shown in the page-size switcher (read only when `showSizeSwitcher=true`). No data hardcoded in the partial — caller supplies the list from the controller's typed model. |
| `currentPageSize` | `int` | `10` | The currently selected page size (read only when `showSizeSwitcher=true`). |
| `pageSizeBaseUrl` | `String` | `null` | URL prefix for page-size change links (wire mode: null → size-switcher fires a submit or a wire action via `pageSizeAttrs`). |
| `showJumper` | `boolean` | `false` | Render a "Go to page" text input + button at the end. |
| `simple` | `boolean` | `false` | Simple mode: hides the numbered list; shows only prev/next + "Page X / Y" fraction. Use on narrow viewports or where space is constrained. |
| `size` | `String` | `"md"` | `sm \| md \| lg` — height-based, toolbar-aligned (same scale as `button`/`input`). |
| `disabled` | `boolean` | `false` | Dims the entire control and removes link hrefs / adds `aria-disabled` to all interactive elements. |
| `ariaLabel` | `String` | `"Pagination"` | `aria-label` on the `<nav>` element. **Change when multiple pagination navs appear on the same page** (e.g. `"Table pagination"` vs `"Search results pagination"`) — the landmark must be uniquely labelled. |
| `cssClass` | `String` | `""` | Extra utility classes on the outermost wrapper `<div>`. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (wire directives on the nav root, e.g. `l:submit`). Never feed a DB-derived value here. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes on the wrapper (value through `Escape.htmlAttribute`). |
| `pageAttrs` | `String` | `""` | **TRUSTED raw** extra attributes applied to EVERY page-number `<a>`/`<button>` element (e.g. a shared `l:click="goToPage"` wire directive in wire mode). |
| `pageDataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** per-page `data-*` items NOT derived from the page number itself. For per-page DB-derived values use `wireArgs` via the repeating item pattern. |
| `ellipsisContent` | `gg.jte.Content` | `null` | Custom ellipsis content. When null, renders the default `…` `<span aria-hidden="true">`. |
| `prevContent` | `gg.jte.Content` | `null` | Custom content for the prev arrow button/link. When null, renders the default `‹` icon with `aria-hidden`. |
| `nextContent` | `gg.jte.Content` | `null` | Custom content for the next arrow button/link. When null, renders the default `›` icon with `aria-hidden`. |

### Wire mode vs URL mode (the two activation surfaces)

When `baseUrl` is set (URL mode), every page button is an `<a href="${baseUrl}?page=${n}">` — Turbo Drive
handles navigation, no JS required. When `baseUrl` is null (wire mode), every page button is a `<button
type="button">` with the page number in `data-page="${n}"` (SAFE, escaped), and the caller wires the
action via `pageAttrs` (e.g. `pageAttrs='l:click="goToPage"'`); the Java action reads `dataset.page`.
The SAME template renders both surfaces; only the element type and href differ.

## 3. Variants / sizes / states

### Variants (intent vocabulary)
Pagination has no `variant` `@param` — it is a navigation control with a single intent. The
"current page" emphasis uses `--lv-color-primary`/`-fg` (matching the primary button token pair) to
distinguish the active page without introducing a new intent name. If an adopter needs a muted-look
pagination (secondary feel), they override the `--lv-color-primary` token at the page or section scope.

### Sizes (height-based, toolbar-aligned)
`size` maps to the same height scale as `button` and `input` so a pagination row aligns flush in a
toolbar:
- `sm` → `--lv-space-8` (32 px) — compact tables, dense layouts.
- `md` → `--lv-space-9` (36 px, default) — the standard form-control baseline.
- `lg` → `--lv-space-10` (40 px) — prominent, touch-friendly surfaces.

Each page button is `min-w: size-height` (square by default) + horizontal padding that scales with size
when the label is wider than one character. Text size follows `--lv-text-sm` (sm), `--lv-text-sm`
(md, same as button), `--lv-text-base` (lg).

### States

| State | How expressed |
|---|---|
| **Current page** | `aria-current="page"` on the `<a>`/`<button>`; token: bg `--lv-color-primary`, text `--lv-color-primary-fg`; `data-state="current"` for styling hooks |
| **Hover / focus-visible** | `:hover` → `--lv-color-accent` bg; `:focus-visible` → `--lv-ring` outline (shared focus token) |
| **Disabled (whole control)** | `disabled` prop → all `<button>` get `disabled` attr; all `<a>` get `aria-disabled="true"` + no `href` + `tabindex="-1"`; visual: `opacity: 0.5` via `disabled:` utility |
| **Prev/Next at boundary** | When `currentPage === 1`, prev is disabled; when `currentPage === totalPages`, next is disabled. Rendered as `<button disabled>` or `<a aria-disabled="true">` respectively. |
| **Ellipsis** | Non-interactive `<span aria-hidden="true">` (or custom `ellipsisContent`); never a button; skipped by screen readers |
| **Simple mode** | Numbered list hidden; fraction "Page X / Y" rendered as `aria-live="polite"` region so screen readers announce page changes |

### The sliding window + ellipsis algorithm
(Deterministic; the implementation agent must follow this EXACTLY to avoid spec drift.)

Given `currentPage` (C), `totalPages` (T), `windowSize` (W, always odd):
- half = floor(W / 2)
- windowStart = max(1, min(C − half, T − W + 1))
- windowEnd = min(T, windowStart + W − 1)
- Show pages [windowStart..windowEnd].
- If windowStart > 1: show page 1 button, then ellipsis if windowStart > 2.
- If windowEnd < T: show ellipsis if windowEnd < T − 1, then page T button.
- When `showFirstLast=false`, omit the explicit page-1 and page-T buttons; the window alone is the
  boundary of visibility.

### Optional compound elements
- **Page-size switcher**: a plain `<select>` (`native-select` partial) with value=`currentPageSize` and
  options from `pageSizes`. Labels read "10 / page", "20 / page", etc. Rendered as a separate labelled
  field (`<label>` + `<select>`) after the `<nav>` but inside the outer wrapper.
- **Quick jumper**: a compact `<input type="number" min="1" max="${totalPages}">` + `<button type="submit">`
  inside a `<form>` (or wired via `l:submit`). The input is labelled "Go to" by an adjacent `<label>` or
  by `aria-label`. Submitted value is clamped server-side; the partial does not validate.
- **Total summary**: a `<span role="status" aria-live="polite">` that reads "Total 253 items" or "Page 3
  of 27". `role="status"` announces the update when the page changes (morph swaps the span).

## 4. The a11y contract (the heart)

- **WAI-ARIA pattern**: APG Navigation landmark with `aria-current="page"` (the same pattern documented
  at https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/ for `aria-current` usage, and at
  https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/ for the `<nav>` landmark; pagination is
  the navigation-within-a-resource application of these two building blocks).
  APG citation used: the Breadcrumb pattern page (https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/)
  and the Landmark Regions practice (https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/).

- **roles + ARIA**:
    - Outer container: `<nav aria-label="${ariaLabel}">` — the `navigation` landmark role (via native
      `<nav>`). `aria-label` is REQUIRED; the default is `"Pagination"`. When two pagination navs coexist
      on the same page (e.g. top + bottom of a table), the caller sets distinct `ariaLabel` values.
    - Page list: `<ol>` — an ordered list because page order is semantically meaningful.
      Screen readers announce item count ("list of 9 items").
    - Page items: `<li>` wrappers; the link/button inside each `<li>` is the focusable element.
    - Current page link/button: `aria-current="page"` on the `<a>`/`<button>` (NOT on the `<li>`).
      Value `"page"` is the correct token per ARIA 1.2 §6.6.4 for same-page location indicators.
    - Prev / next controls: real `<a>`/`<button>` elements with an accessible name from visible text
      or from `aria-label="Previous page"` / `aria-label="Next page"` when the control contains only an
      icon (the icon-only accessible-name rule, same as button).
    - Ellipsis: `<li><span aria-hidden="true">…</span></li>` — hidden from the a11y tree. Screen readers
      skip it; the numbered context communicates the gap implicitly.
    - Disabled prev/next at boundary: `<button disabled aria-label="Previous page">` (button variant) or
      `<a aria-disabled="true" tabindex="-1" aria-label="Previous page">` (link variant).
    - Page-size switcher (optional): `<label for="page-size-select">Items per page</label>
      <select id="page-size-select">…</select>` — native platform accessibility, no ARIA needed.
    - Quick jumper (optional): `<label for="page-jump-input">Go to page</label>
      <input id="page-jump-input" type="number" min="1" max="${totalPages}" aria-describedby="…">`.
    - Total summary (optional): `<span role="status" aria-live="polite" aria-atomic="true">`.

- **keyboard map**:

  | Key | Action | Who supplies it |
  |---|---|---|
  | Tab | Move focus forward through each page link/button in DOM order (prev → pages → next → size-switcher → jumper) | Platform (real `<a>`/`<button>`) |
  | Shift+Tab | Move focus backward through the same sequence | Platform |
  | Enter | Activate the focused link/button (navigate to that page) | Platform (native `<a>` Enter follows href; native `<button>` Enter fires click) |
  | Space | Activate a focused `<button>` (wire mode) | Platform (native `<button>`) |
  | (disabled elements) | Disabled `<button>` is removed from tab order; disabled `<a>` has `tabindex="-1"` and is removed from tab order | Platform + template |

  APG note: The navigation landmark pattern has no defined keyboard interaction beyond standard tab
  traversal (APG states "Not applicable" for keyboard interaction on navigation landmarks, the same
  ruling as Breadcrumb). No arrow-key roving, no typeahead, no focus trap. This is intentional: a
  pagination list is a flat set of links, not a composite widget.

- **focus management**: platform. Each `<a>`/`<button>` is individually focusable; focus order follows
  DOM order (prev, pages left-to-right, next, optionally size-switcher, optionally jumper). No roving
  tabindex. No trap. No initial-focus management. After a page change (whether URL navigation or wire
  morph), focus returns to wherever the runtime morph leaves it — in URL mode Turbo Drive handles scroll
  restoration; in wire mode the lievit morph preserves node identity, so if the "page 3" button survives
  the morph, focus stays there. When the page-number buttons ARE replaced (the active page changes), the
  morph should move focus to the new active page button; the consuming context signals this by including
  `autofocus` on the current-page element after the morph (optional, adopter responsibility).

- **live region**: the optional Total summary `<span role="status" aria-live="polite" aria-atomic="true">`
  announces "Total 253 items" or "Page 3 of 27" to screen readers when the morph updates it. In simple
  mode, the fraction `<span aria-live="polite">` also announces the new page. These are the ONLY live
  regions; the page buttons themselves are not live regions.

- **shared mechanism composed**: none — pagination uses only platform semantics (`<nav>`, `<ol>`, `<a>`,
  `<button>`, `aria-current`). No popover seam, no focus-trap, no collection-nav. This is the canonical
  PARTIAL exemplar for "prefer real native elements; the platform gives role + keyboard + focus for free".

## 5. Tokens

Reads:

| Token | Role in the component |
|---|---|
| `--lv-color-primary` | Background of the current-page button |
| `--lv-color-primary-fg` | Text colour of the current-page button |
| `--lv-color-accent` | Hover background of non-current page buttons |
| `--lv-color-accent-fg` | Hover text of non-current page buttons |
| `--lv-color-fg` | Default text colour of page buttons |
| `--lv-color-muted` | Ellipsis text + disabled-state text |
| `--lv-color-border` | Border of the outlined page button style |
| `--lv-color-bg` | Background of the page button in resting state (when not filled) |
| `--lv-space-8` | `sm` height (32 px) |
| `--lv-space-9` | `md` height (36 px, default) |
| `--lv-space-10` | `lg` height (40 px) |
| `--lv-space-1` | Gap between page buttons |
| `--lv-space-2` | Horizontal padding inside each button (sm) |
| `--lv-space-3` | Horizontal padding inside each button (md/lg) |
| `--lv-space-4` | Gap between nav + size-switcher / jumper |
| `--lv-text-xs` | Font size in `sm` mode |
| `--lv-text-sm` | Font size in `md` mode (same as button) |
| `--lv-text-base` | Font size in `lg` mode |
| `--lv-radius-md` | Border radius of page buttons |
| `--lv-ring` | Focus-visible outline (shared focus token; same as button/input) |
| `--lv-font-sans` | Font family |
| `--lv-font-mono` | Font family for the jumper input (numeric, monospaced) |

**NET-NEW tokens**: none. The pagination styling surfaces are fully covered by the existing token
vocabulary. The current-page emphasis reuses `--lv-color-primary`/`-fg` (the same pair as the primary
button) — no new intent is needed. The only design decision is whether the page buttons have a visible
border by default (reads `--lv-color-border`) or are borderless; that is a styling choice over existing
tokens, not a new token.

**Dark mode**: the dark-mode re-point of `--lv-color-primary`, `--lv-color-accent`, `--lv-color-border`
in the `.dark / [data-theme="dark"]` block covers all pagination elements. No per-component dark rules.

## 6. Wire / island integration

### Server-rendered JTE structure

```
<div data-slot="pagination" data-size="${size}" class="…${cssClass}" ${attrs}>
  <!-- optional total summary -->
  !{if showTotal}
  <span role="status" aria-live="polite" aria-atomic="true" data-slot="pagination-total">
    Total ${totalItems} items
  </span>
  !{/if}

  <nav aria-label="${ariaLabel}" data-slot="pagination-nav">
    <ol class="…">
      <!-- prev button -->
      !{if showPrevNext}
      <li>
        <a href="${prevHref}" aria-label="Previous page"
           aria-disabled="${currentPage == 1 ? "true" : null}"
           tabindex="${currentPage == 1 ? "-1" : null}"
           data-slot="pagination-prev" ${pageAttrs}>
          <!-- prevContent or default ‹ icon with aria-hidden -->
        </a>
      </li>
      !{/if}

      <!-- first page + leading ellipsis (when windowStart > 1) -->
      <!-- ... sliding window page items ... -->
      <!-- each item: -->
      <li>
        <a href="${pageHref}" aria-current="${n == currentPage ? "page" : null}"
           data-slot="pagination-page" data-page="${n}" ${pageAttrs}>
          ${n}
        </a>
      </li>
      <!-- trailing ellipsis + last page (when windowEnd < totalPages) -->

      <!-- next button -->
      !{if showPrevNext}
      <li>
        <a href="${nextHref}" aria-label="Next page"
           aria-disabled="${currentPage == totalPages ? "true" : null}"
           tabindex="${currentPage == totalPages ? "-1" : null}"
           data-slot="pagination-next" ${pageAttrs}>
          <!-- nextContent or default › icon with aria-hidden -->
        </a>
      </li>
      !{/if}
    </ol>
  </nav>

  <!-- optional page-size switcher -->
  !{if showSizeSwitcher}
  <div data-slot="pagination-size-switcher">
    @template.lievit.label(text="Items per page", for="pagination-size-${instanceId}")
    @template.lievit.native-select(
      id="pagination-size-${instanceId}",
      options=pageSizes,
      value=currentPageSize,
      attrs=pageSizeAttrs
    )
  </div>
  !{/if}

  <!-- optional quick jumper -->
  !{if showJumper}
  <form data-slot="pagination-jumper" ...>
    <label for="pagination-jump-${instanceId}">Go to page</label>
    <input id="pagination-jump-${instanceId}" type="number" min="1" max="${totalPages}"
           class="…" />
    <button type="submit">Go</button>
  </form>
  !{/if}
</div>
```

Key structural rules:
- `aria-current="page"` is a null-drop boolean-value attribute: when `n != currentPage` it is NOT
  emitted at all (not `aria-current="false"`). JTE emits it conditionally.
- `aria-disabled` and `tabindex="-1"` are emitted ONLY on the `<a>` variant of disabled elements;
  `<button>` elements use the native `disabled` attribute.
- Ellipsis items are `<span aria-hidden="true">` inside `<li>` — never a `<button>` or `<a>`.
- `data-slot` attributes are present on all structural elements for styling hooks, Playwright
  selectors, and test targets.
- `data-page="${n}"` on each page button (SAFE, via the integer-to-string rendering path) is the
  wire-action anchor when `baseUrl=null`.
- The page-size switcher composes `native-select` + `label` partials; it does NOT hand-roll a
  `<select>`. This is the "compose, do not hand-roll" rule in practice.
- `instanceId` is a short server-generated uid (e.g. `_instance.id()`) used to tie `<label for>`
  to `<input id>` and `<select id>` without global ID collisions when multiple pagination instances
  are on the same page.

### The two escaping channels (XSS decision rule, same as `button.jte`)
- `attrs` / `pageAttrs` = **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (wire
  directives the author types in the Java template call). A DB-derived value NEVER goes here.
- `dataAttrs` / `pageDataAttrs` = **SAFE escaped** (each value through
  `gg.jte.html.escape.Escape.htmlAttribute`) — any dynamic data goes through this channel.
- `data-page="${n}"` is an integer rendered directly from the server-side loop variable (not from
  user input), so it is safe to inline; document this so implementers do not treat it as a
  trusted-raw bypass.

### Typed-TS enhancer
**Static, no enhancer.** All interaction is platform-native (`<a>` / `<button>` focus + activation).
No enhancer is registered for this component. The optional quick-jumper uses a plain `<form>` submit
(URL mode) or a `l:submit` wire directive (wire mode) — both are platform forms, no JS.

The ONLY JavaScript concern is in the consuming context (not this partial): when wire mode is used,
the consuming WIRE component's Java action (`goToPage(int page)`) reads `dataset.page` from the
request and mutates its `currentPage` field. That wiring is the consumer's responsibility, not the
partial's.

## 7. Acceptance tests

- **render — basic numbered output** (jsdom): given `currentPage=3, totalPages=10, windowSize=5,
  baseUrl="/items"`, assert: a `<nav>` with `aria-label="Pagination"` is rendered; an `<ol>` child;
  five numbered `<a>` elements (pages 1–3 window: 1, 2, 3, 4, 5 with default windowSize centred on 3);
  the page-3 `<a>` has `aria-current="page"`; pages without `aria-current` do NOT have the attribute
  (not `aria-current="false"`); `data-slot="pagination"` and `data-size="md"` on the root.

- **render — ellipsis and boundary buttons** (jsdom): given `currentPage=6, totalPages=20,
  windowSize=5, showFirstLast=true`, assert: page-1 button present; ellipsis `<span aria-hidden="true">`
  present before window; window shows pages 4–8; ellipsis after window; page-20 button present;
  page-6 has `aria-current="page"`.

- **render — prev/next disabled at boundary** (jsdom): `currentPage=1` → prev has
  `aria-disabled="true"` + `tabindex="-1"` (link variant) or `disabled` (button variant); next has
  neither. `currentPage=totalPages` → next is disabled; prev is not.

- **render — simple mode** (jsdom): `simple=true` → no `<ol>` with numbered pages; a visible
  "Page 3 / 10" text is rendered inside an `aria-live="polite"` region; prev/next still present.

- **render — wire mode (no baseUrl)** (jsdom): `baseUrl=null` → page buttons are `<button
  type="button">` not `<a href>`; each has `data-page="${n}"` with the correct integer value.

- **render — optional compound elements** (jsdom): `showTotal=true` → a `<span role="status"
  aria-live="polite">` with the total count is rendered before the `<nav>`. `showSizeSwitcher=true` +
  `pageSizes=[10,20,50]` + `currentPageSize=20` → a `<select>` with three `<option>` elements, the
  `value=20` option selected. `showJumper=true` → a `<form>` with `<input type="number">` +
  `<button type="submit">` rendered after the nav.

- **render — zero/single page** (jsdom): `totalPages=0` → renders nothing (empty output, not even the
  `<nav>`); `totalPages=1` → renders nothing.

- **render — disabled whole control** (jsdom): `disabled=true` → ALL `<button>` elements have `disabled`
  attr; ALL `<a>` elements have `aria-disabled="true"` + `tabindex="-1"` + no `href`; root has
  `data-disabled` for opacity styling.

- **axe-core — zero violations** (jsdom, rendered DOM): run axe on `currentPage=3, totalPages=10`
  default output; assert zero violations. Rules that must pass:
  `aria-allowed-attr`, `aria-required-attr`, `aria-valid-attr-value`, `landmark-unique` (when a single
  pagination is present), `link-name` (prev/next must have accessible names), `list` (the `<ol>` rule).

- **axe-core — multiple pagination navs** (jsdom): two pagination instances on the same page, one with
  `ariaLabel="Table pagination"`, one with `ariaLabel="Search results pagination"` → zero violations on
  the `landmark-unique` rule; assert the two `<nav>` elements have distinct labels.

- **axe-core — icon-only prev/next without ariaLabel** (jsdom): if prev/next contain only an icon with
  `aria-hidden` and no visible text, assert the accessible-name rule (`link-name`) is satisfied by the
  surrounding `aria-label` attribute on the element.

- **keyboard — Tab traversal** (jsdom, JSDOM keyboard events): focus the prev button, Tab through all
  page buttons, Tab to the next button; assert each receives focus in DOM order. Shift+Tab reverses.
  Assert that disabled elements are NOT in the tab sequence (prev on page 1: skip it; it is not
  reachable by Tab).

- **keyboard — Enter activates a page link** (jsdom): focus the page-4 `<a>`, fire Enter; assert the
  navigation event (jsdom `href` check or the `click` event fires). In wire mode (`<button>`): fire
  Enter/Space; assert the `click` event fires with `dataset.page === "4"`.

- **variants/sizes** (jsdom): `size="sm"` → `data-size="sm"` on root; the page button height token class
  referencing `--lv-space-8` is present. `size="lg"` → `data-size="lg"`, `--lv-space-10` class.

- **aria-current is absent (not false) on non-current pages** (jsdom): assert EVERY page button that is
  not the current page has NO `aria-current` attribute (not even `aria-current="false"` — that is an
  invalid token for this attribute). The JTE conditional must drop the attribute entirely.

- **escaping — hostile data in dataAttrs** (jsdom): pass `dataAttrs={"x-test": "\">|<script>alert(1)"}`;
  assert the rendered attribute value is HTML-escaped and inert — no `<script>` tag in the output.

- **escaping — data-page is an integer, never user-controlled** (jsdom): assert that each page button's
  `data-page` is a non-negative integer matching the loop variable; no string injection is possible
  because the value is typed `int` at the template boundary.

- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate. This test
  runs the JTE compiler on `pagination.jte` and asserts it compiles without error (catches template
  syntax regressions). The render test in this section confirms the compiled output matches the DOM
  assertions above.

- **total summary live region announced** (jsdom): morph the pagination from page 1 to page 2 (swap
  the `<span role="status">` text); assert the element has `aria-live="polite"` and `aria-atomic="true"`;
  assert the text content changed. (The actual screen-reader announcement is a browser concern; the test
  pins the DOM contract that makes it possible.)

## 8. Non-goals / anti-patterns

- **No client-side page calculation.** The sliding window algorithm runs in the Java/JTE layer
  (the server knows `currentPage` and `totalPages`). The partial never ships JavaScript that recomputes
  which page buttons to show. If page calculation were client-side, the initial render would require
  hydration — that is the SPA path, not the server-first path.

- **No cursor-based pagination.** This component renders NUMBERED pages (1-based integer). Cursor/offset
  pagination (prev/next only, no page numbers) is a different pattern; build it as a separate, simpler
  `pagination-simple` partial or use this component with `simple=true` + `totalPages=null` (wire mode
  where the consumer drives prev/next actions directly).

- **No `role="navigation"` on the `<ol>`.** The `<nav>` element is the landmark; the `<ol>` is a plain
  list. Adding `role="navigation"` to the `<ol>` would create a nested navigation landmark, which is
  incorrect (two landmarks of the same type nested inside each other confuses screen reader navigation).

- **No `aria-current="true"`.** The only valid token for a pagination page indicator is
  `aria-current="page"`. The value `"true"` is technically allowed by ARIA 1.2 but is semantically
  weaker — screen readers announce "page" explicitly, which tells the user WHY this item is current.
  Never substitute `aria-current="true"` or a CSS class alone.

- **No ARIA roles on `<li>`.** The list items need no `role="presentation"` or any other ARIA override.
  `<li>` inside `<ol>` is correct as-is; overriding it to `role="none"` would remove the list semantics
  that tell screen reader users how many pages there are.

- **No inline `<script>` or `on*=` handlers.** CSP-strict (`script-src 'self'`, no eval, no inline).
  Any dynamic behaviour in the quick-jumper is a `<form>` submit or a `l:submit` wire directive. The
  partial body is zero-JS by construction.

- **No ownership of the "which page to load" logic.** The partial renders a navigation aid. The data
  retrieval (SQL LIMIT/OFFSET, page validation, redirect on out-of-range) is the consuming controller's
  or WIRE component's responsibility. This partial never fetches data.

- **No duplication of `native-select` for the page-size switcher.** The switcher composes the
  `native-select` partial rather than hand-rolling a `<select>`. Hand-rolling would drift from the
  shared style and break the token contract.

- **No ellipsis as a clickable button.** Some libraries make ellipsis items expand into a page-number
  input on click. This pattern adds complexity (an interactive element that behaves differently from
  all other interactive elements) for minimal gain in a server-rendered context; use `showJumper=true`
  for the "jump to an arbitrary page" use case.

## 8.1 Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read Ant Design Pagination, Tailwind UI
pagination examples, and the WAI-ARIA APG Breadcrumb / Landmark Regions pages as PATTERN references
(a11y semantics, variant inventory, visual look). You MUST NOT paste literal source from any of them
(no Ant Design / Tailwind UI class strings, no react-aria / shadcn source) — the output is always
original generation (the one bright line, `02-licensing.md`).

Mirror `button.jte`'s house conventions EXACTLY:
- Header doc-comment (Apache block + `<%-- --%>` block) with the labelled sections.
- Typed `@param` with defaults; no data hardcoded inside the partial (page sizes, labels arrive via
  `@param` from the controller's typed model).
- `data-slot="pagination"` on the root + `data-size` for the size hook.
- Zero `<script>`, zero inline `on*=`.
- The two escaping channels: `attrs`/`pageAttrs` = trusted raw (`$unsafe`); `dataAttrs`/`pageDataAttrs`
  = safe escaped (`Escape.htmlAttribute`).

Implement the sliding-window algorithm in a JTE `!{var …}` block or a helper method on a render-model
object passed via `@param`; the template itself must not contain complex branching — extract into a
typed Java builder if the JTE block grows unwieldy.

Compose `native-select` + `label` partials for the size switcher; do NOT hand-roll `<select>`. The
quick-jumper is a plain `<form>` — no enhancer.

The acceptance tests are the contract — assert ALL of them. Pay special attention to:
- `aria-current="page"` only on the active page, absent (not false) on all others.
- Disabled `<a>` elements get `aria-disabled="true"` + `tabindex="-1"` (not the `disabled` attribute).
- `data-page` values are typed integers, never strings from user input.
- The `<nav>` has a non-empty `aria-label`.
Minimal code to GREEN against the acceptance tests; refactor only while green.
