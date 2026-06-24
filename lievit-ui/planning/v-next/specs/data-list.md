<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — data-list / description-list / key-value (PARTIAL family, S1)

- **tier**: PARTIAL (three co-resident sub-components; static presentation, zero client state)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/data-list.jte` + `data-list/row.jte` +
  `description-list.jte` + `description-list/item.jte` + `key-value.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG List (`role="list"` / `role="listitem"`, Safari explicit-role rule) +
      APG Table (static `<table>` with `<thead>` / `<th scope>`, keyboard "Not Applicable") +
      HTML platform `<dl>/<dt>/<dd>` (native description-list association, no dedicated APG
      interactive pattern; the authority is the W3C HTML spec + WCAG H40, verified against
      https://www.w3.org/WAI/ARIA/apg/patterns/ — no interactive pattern exists; the right
      source is the HTML semantic element, which carries the association for free). No react-aria
      reference needed: every surface here is static presentational content, not an interactive widget.
    - inventory: Ant Design Descriptions as inventory reference (bordered/borderless, column grid,
      item colspan, label+content pairs, extra slot for actions, sizes); the divided-list surface
      maps to shadcn's `divide-y` list pattern + Filament's infolist RepeatableEntry.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      (NO code copied)

---

## 1. What it is

Three co-resident read-only display surfaces that live under the `data-list` slug and cover every
"key→value / list / record" display need on a gestionale detail or summary page:

1. **`data-list` + `data-list.row`** — a divided list: a `<ul role="list">` of rows
   (leading media | content column | trailing actions), separated by a hairline rule, optionally
   wrapped in a card border. The display list for collections of records (profile items, device
   sessions, document attachments, permission entries). Each row's actionable affordance lives in
   the content/actions slot as a native `<a>` or `<button>` — the row itself is static.
2. **`description-list` + `description-list.item`** — a label-to-value grid: a `<dl>` of
   `<dt>/<dd>` pairs laid out in a configurable N-column CSS grid with optional colspan per item.
   The display surface for a single record's fields (the detail-page infolist, Ant Design
   Descriptions / Filament infolist section). Each value can be any markup: a string, a badge,
   a swatch, a code block, an infolist-entry.
3. **`key-value`** — a two-column ruled table: a `<table>` with a `<thead>` (configurable column
   headers) over a `<tbody>` of string pairs. The display surface for a homogeneous ordered map
   (the kit's KeyValueEntry, a form's key-value REPEATER in read-only view). Distinguished from
   description-list by its COLUMN HEADER row and its homogeneous string-pair structure.

All three are PARTIAL: pure server-rendered presentation, zero client state, no enhancer.
Server-first works trivially — there is nothing client about a read-only display surface. The
controller resolves every value to its display string BEFORE the template is called; the template
iterates + paints, never re-evaluates domain logic. This follows the "silent-slot lesson": no
closure re-evaluation in the template.

The three surfaces are DISTINCT and must NOT be conflated (this spec records the boundary):
- `data-list` = a COLLECTION of rows (same item-type repeated, variable N).
- `description-list` = a RECORD's fields (heterogeneous label→value pairs, fixed for a record).
- `key-value` = a HOMOGENEOUS MAP (string→string, with column headers).

---

## 2. API — params / props (the typed surface)

### 2.a `data-list` container
| param | type | default | meaning |
|---|---|---|---|
| `content` | `gg.jte.Content` | — | the rows slot (`data-list.row` partials) |
| `bordered` | `boolean` | `true` | wraps the list in a card surface (border + radius + card bg); `false` = a flush inline divided list with no outer chrome |
| `role` | `String` | `"list"` | the ARIA role; the default `"list"` is explicit (Safari removes the implicit list role when `list-style` is cleared); override to `null` for a pure presentational `<ul>` with no semantic list role |
| `ariaLabel` | `String` | `null` | `aria-label` on the `<ul>`; supply when the list is not labelled by a visible heading (`aria-labelledby` is preferred when a heading exists, passed via `cssClass`-adjacent markup by the caller) |
| `cssClass` | `String` | `""` | extra utility classes on the `<ul>` root |

### 2.b `data-list.row`
| param | type | default | meaning |
|---|---|---|---|
| `content` | `gg.jte.Content` | — | the main column (name + meta, or any markup); **required** |
| `leading` | `gg.jte.Content` | `null` | leading media slot (icon, avatar, index number, status dot); `null` = omitted |
| `actions` | `gg.jte.Content` | `null` | trailing actions cluster (badge, button, chevron, meta text); `null` = omitted |
| `role` | `String` | `"listitem"` | the ARIA role; the default is explicit for the same Safari reason; override when composing in a non-list context |
| `href` | `String` | `null` | when set, the ENTIRE row becomes a `<a>` link (the whole tile is the target; same pattern as stat-card's whole-tile link); focus ring wraps the full row |
| `hoverHighlight` | `boolean` | `true` | `hover:bg-[var(--lv-color-muted-bg)]` tint; set `false` for purely decorative rows that have no interaction |
| `cssClass` | `String` | `""` | extra utility classes on the `<li>` (or `<a>` if `href`) root |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (each value via `Escape.htmlAttribute`); for per-row wire directives when embedded in a WIRE context |

### 2.c `description-list` container
| param | type | default | meaning |
|---|---|---|---|
| `content` | `gg.jte.Content` | — | the item rows slot (`description-list.item` partials) |
| `columns` | `int` | `1` | the grid column count; 1 = a stacked single-column list; 2–4 = the multi-column Filament/Ant-Design grid layout; clamped to `Math.max(1, columns)` |
| `bordered` | `boolean` | `false` | adds a border + radius + card-bg wrapper around the whole grid (the Ant Design `bordered` Descriptions variant); `false` = borderless, fields fill their parent |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — controls the label/value text size and the row gap; maps to the space + text token scales |
| `title` | `String` | `null` | an optional heading above the grid (maps to Ant Design Descriptions `title`); rendered as a `<p>` with semibold weight; `null` = omitted |
| `extra` | `gg.jte.Content` | `null` | an optional trailing actions slot aligned to the right of the title row (Ant Design Descriptions `extra`); `null` = omitted; only rendered when `title` is also set |
| `cssClass` | `String` | `""` | extra utility classes on the `<dl>` root |

### 2.d `description-list.item`
| param | type | default | meaning |
|---|---|---|---|
| `term` | `String` | — | the label / attribute name (a humanized field label, e.g. "Nome", "Email"); **required** |
| `content` | `gg.jte.Content` | — | the value markup: a string, an `infolist-entry` partial, a `badge`, a swatch, a code block; **required** |
| `columnSpan` | `int` | `1` | the number of parent-grid columns this pair spans (Filament `Entry.columnSpan` / Ant Design `span`); clamped to `Math.max(1, columnSpan)`; applied to BOTH `<dt>` and `<dd>` so the pair stays a grid cell-pair |
| `colon` | `boolean` | `true` | whether to append a `:` after the term label (Ant Design Descriptions default); `false` for contexts where a colon is unwanted |
| `cssClass` | `String` | `""` | extra utility classes on the `<dd>` value element |

### 2.e `key-value` (homogeneous map table)
| param | type | default | meaning |
|---|---|---|---|
| `pairs` | `Map<String,String>` | — | the ordered key → value map (already projected to display strings); **required** |
| `keyLabel` | `String` | `"Key"` | the key-column `<th>` header |
| `valueLabel` | `String` | `"Value"` | the value-column `<th>` header |
| `bordered` | `boolean` | `true` | outer border + radius on the `<table>`; `false` = a borderless inline table |
| `striped` | `boolean` | `false` | alternate-row zebra tinting via `--lv-color-surface` on even rows |
| `emptyMessage` | `String` | `null` | message rendered in a full-width `<td colspan=2>` when `pairs` is empty; `null` = renders an empty table body (header row still appears) |
| `cssClass` | `String` | `""` | extra utility classes on the `<table>` root |

---

## 3. Variants / sizes / states

### Variants (by surface)

**`data-list`**:
- `bordered=true` (default) — card border + radius-lg + card-bg chrome, the Filament panelled list.
- `bordered=false` — flush inline divided list, no outer chrome; for embedding inside an existing card.

**`data-list.row`**:
- **default row** — static content with optional leading + actions slots.
- **linked row** (`href` set) — entire `<li>` renders as `<a href>` (a `<li>` containing an `<a>` that covers the full tile); the `<a>` gets `display:block` + the same padding; focus ring wraps the full tile.
- **action-rich row** — `actions` slot populated with badge/button/chevron; the actions slot is `flex shrink-0 items-center gap-2`, pinned to the trailing edge.
- **media-leading row** — `leading` slot populated with avatar/icon/index; the media slot is `flex shrink-0 items-center`.

**`description-list`**:
- `bordered=false` (default) — borderless, fields flow in the grid without an outer card; used inside an existing card/section.
- `bordered=true` — outer border + radius + card-bg, matching the Ant Design `bordered` mode; the container carries its own visual chrome.
- `columns=1` — stacked single-column list (default; mobile-safe, also the fallback at small breakpoints).
- `columns=2..4` — multi-column grid (Filament 2-column infolist, Ant Design Descriptions default 3-column).
- `size=sm` — compact: `--lv-text-xs` + tighter `gap-y`.
- `size=md` — default: `--lv-text-sm` + standard `gap-y`.
- `size=lg` — spacious: `--lv-text-base` + looser `gap-y`.

**`key-value`**:
- `bordered=true` (default) — outer border + radius-md + overflow-hidden on the `<table>`.
- `bordered=false` — no outer chrome; the table collapses to its cells.
- `striped=false` (default) — uniform row background.
- `striped=true` — even rows tinted `--lv-color-surface`.

### Sizes
- `data-list` / `data-list.row` do not expose a `size` param: row density is controlled by the content + padding of the row, not a container size; callers adjust via `cssClass` or by composing tighter content.
- `description-list`: `size=sm|md|lg` as documented above, maps `sm→--lv-text-xs`, `md→--lv-text-sm`, `lg→--lv-text-base`.
- `key-value`: no `size` param; fixed at `--lv-text-sm` (the kit's KeyValueEntry display scale).

### States
All three surfaces are **static read-only content, not interactive controls**. They have no disabled, invalid, or aria-busy state of their own. Interactive affordances (copy-to-clipboard, row edit, row delete) live in the slots as native `<button>` or `<a>` elements, each carrying its own state. The partial carries no state.

- A `data-list.row` with `href` is a link (`<a>`) and inherits platform `:hover`/`:focus-visible` states; no custom `:focus-visible` logic needed (the adopter applies `--lv-ring` on the `<a>` in their token override, or via the standard Tailwind focus-ring utility).
- Values in `description-list.item` that are themselves interactive (e.g. an `infolist-entry` with `copyable=true`) carry the interactive state in the `infolist-entry` partial's own slot element, not in this partial.

---

## 4. The a11y contract (the heart)

### 4.a `data-list` — WAI-ARIA List pattern

**WAI-ARIA pattern**: The list pattern — `role="list"` container + `role="listitem"` children.
The APG does not publish a dedicated interactive pattern page for a static display list; the authority
is the WAI-ARIA 1.2 spec role definitions + the WCAG 1.3.1 Info and Relationships SC.
Verified against https://www.w3.org/WAI/ARIA/apg/patterns/ (2026-06-24): no dedicated pattern page
for a static list; the correct approach is the native `<ul>`/`<li>` elements (role="list" /
role="listitem" are their native implicit roles) with explicit role attributes added to defeat the
Safari / Chrome bug that strips the implicit list role when `list-style: none` is applied.

**Roles + ARIA**:
- `<ul>` root: `role="list"` (explicit, for Safari list-style:none; see `data-list.jte` comment);
  `aria-label` from `ariaLabel` when no visible heading labels the list.
- `<li>` row: `role="listitem"` (explicit, same reason).
- Leading icon (when decorative): `aria-hidden="true"` via the `icon` partial.
- Actions in the trailing slot: native `<button>` or `<a>` elements carry their own roles and labels;
  icon-only buttons in the actions slot **MUST** carry `aria-label` (the button rule — enforced by
  the `button.jte` `ariaLabel` param, not this partial).
- Linked row (`href` set): the `<a>` that covers the row must have a meaningful text content (the
  `content` slot provides it); if the content is image/icon-only, the caller is responsible for
  providing `aria-label` on the `<a>` via `cssClass` or a wrapping caller attribute.

**Keyboard map**:
| key | does | who |
|---|---|---|
| Tab | moves focus INTO the list's first focusable descendant (link/button in a slot) | platform |
| Tab (within row) | moves between focusable elements inside a row | platform |
| Tab (after last) | leaves the list (no trap, no roving; this is NOT an interactive listbox) | platform |
| Enter / Space | activates the focused `<a>` (linked row) or `<button>` (actions slot) | platform (native elements) |

No roving tabindex, no arrow navigation, no Home/End. This is a DISPLAY list, not a listbox widget.
If selection or arrow navigation is needed, use `select (rich)` or `combobox`, not `data-list`.

**Focus management**: platform. No trap, no roving. The focusable elements inside each row (links,
buttons in slots) are independent tab stops in document order. Focus ring on `<a>`/`<button>` via
`--lv-ring` (applied by the button partial or the adopter's link style).

**Live region**: none. This is a static display list; it does not announce content changes. If a
list updates in response to a server action, the re-render is a morph (ADR-0019) and the new content
is in the DOM; a screen reader reads it on navigation. If the update needs to be announced
immediately, the caller wraps in an `aria-live` region — not this partial's concern.

**Shared mechanism composed**: none (platform-only). No enhancer.

---

### 4.b `description-list` — HTML `<dl>/<dt>/<dd>` platform semantics

**WAI-ARIA pattern**: HTML description list — native `<dl>` (description list, formerly "definition
list"), `<dt>` (description term), `<dd>` (description detail). This is a platform HTML semantic
element, not a WAI-ARIA APG interactive pattern. The APG at
https://www.w3.org/WAI/ARIA/apg/patterns/ (2026-06-24) has no page for description lists; the
authority is the W3C HTML specification for `<dl>/<dt>/<dd>` + WCAG H40 (Using description lists,
https://www.w3.org/WAI/WCAG21/Techniques/html/H40). Screen readers associate each `<dt>` with its
following `<dd>` natively.

**Roles + ARIA**:
- `<dl>` root: implicit `role="term"` group; no explicit ARIA role needed (adding `role="group"`
  is non-standard and unnecessary). An `aria-label` or an adjacent visible heading (referenced via
  `aria-labelledby` by the caller) identifies the group when context is needed.
- `<dt>` term: no explicit ARIA (the native `<dt>` is correctly interpreted by AT).
- `<dd>` definition: no explicit ARIA.
- The title `<p>` above the grid (when `title` set): plain text; the caller may promote it to an
  `<h2>`/`<h3>` via `cssClass` + a heading-size utility if it is a structural section heading.
  The component ships it as `<p>` (not heading-level): the correct heading level is the caller's
  domain, not a configurable param (the heading trap — see non-goals §8).
- Values that are infolist-entry or badge partials carry THEIR OWN a11y (decorative swatch
  `aria-hidden`, icon `aria-label` when standalone, etc.) inside the `<dd>` content slot.

**Keyboard map**:
| key | does | who |
|---|---|---|
| Tab | moves focus INTO the first focusable element inside any `<dt>` or `<dd>` (e.g. a link or button in a value slot) | platform |
| Tab (within list) | advances through focusable elements in DOM order across terms and values | platform |
| Enter / Space | activates the focused link or button inside a value slot | platform |

No roving, no arrow navigation. Static read-only content; keyboard interaction = platform tab order
through any focusable elements embedded in value slots. The `<dt>` term itself is not focusable.

**Focus management**: platform only. No trap, no roving.

**Live region**: none.

**Shared mechanism composed**: none (platform HTML element semantics, no enhancer).

---

### 4.c `key-value` — WAI-ARIA Table pattern

**WAI-ARIA pattern**: APG Table (static data table, not a grid/data-grid interactive widget).
Verified at https://www.w3.org/WAI/ARIA/apg/patterns/table/ (2026-06-24): the APG states
"Not Applicable" for keyboard interaction on a static table. The table uses a real `<table>`
element with `<thead>/<th scope>/<tbody>/<tr>/<td>` for native semantic association. ARIA on a
native `<table>` is only needed when the native element is insufficient (e.g. a ARIA grid for
interactive cell selection); here the native structure is sufficient.

**Roles + ARIA**:
- `<table>` root: implicit `role="table"` via the native element; `aria-label` from a nearest
  enclosing visible heading or an explicit `aria-label` on the element. Since this component has
  no `label` param (the two-column structure IS its own header row), the `<th>` headers label
  each column; no separate `aria-label` on the `<table>` is needed when both `<th>` cells are
  meaningful strings (the default `keyLabel`/`valueLabel` give "Key" / "Value" as accessible
  column names).
- `<th scope="col">` in `<thead>`: identifies each column header for AT column-association.
- `<td>` cells in `<tbody>`: plain cells, associated with their column header via `scope`.
- Empty state (when `pairs` is empty and `emptyMessage` is set): a `<td colspan="2">` cell
  within a `<tr>` announces the message to AT as a table cell.

**Keyboard map**:
| key | does | who |
|---|---|---|
| Tab | moves focus through any focusable elements in `<td>` cells (e.g. a copyable button injected by the adopter) | platform |
| Enter / Space | activates a focused focusable element in a cell | platform |

"Not Applicable" for cell navigation — this is a STATIC table (APG explicit statement). Arrow-key
grid navigation is only for `role="grid"` (interactive cells). The `key-value` table has no
interactive cells in its own markup.

**Focus management**: platform. No trap, no roving.

**Live region**: none.

**Shared mechanism composed**: none (native `<table>` element, no enhancer).

---

## 5. Tokens

All three surfaces are static display, so they consume the DISPLAY subset of the token vocabulary:
colours, spacing, radius, typography. No motion, no z-index, no ring (ring applies to the
interactive elements INSIDE slots, not the container).

### Tokens consumed by `data-list` / `data-list.row`
| token | role |
|---|---|
| `--lv-color-border` | the hairline divide between rows + the outer card border (when `bordered`) |
| `--lv-color-card` | the card surface background (when `bordered`) |
| `--lv-color-card-fg` | the card surface text (when `bordered`) |
| `--lv-color-muted-bg` | the hover tint on a row (`:hover` background) |
| `--lv-color-fg` | the default content text colour |
| `--lv-color-muted-fg` | meta text, secondary labels |
| `--lv-radius-lg` | the outer card border-radius (when `bordered`) |
| `--lv-space-1` | the flex gap between name and meta lines within the content column |
| `--lv-space-2` | icon/avatar gap within the leading or actions slot |
| `--lv-space-3` | the gap between leading / content / actions within a row |
| `--lv-space-4` | horizontal padding of a row |
| `--lv-space-3` (py) | vertical padding of a row |
| `--lv-text-sm` | default row text size |
| `--lv-font-sans` | the typeface |
| `--lv-duration-fast` | the hover background transition duration |
| `--lv-ease` | the hover background transition easing |

NET-NEW tokens: none. The hover transition reuses the existing motion tokens.

### Tokens consumed by `description-list` / `description-list.item`
| token | role |
|---|---|
| `--lv-color-muted-fg` | the term label colour |
| `--lv-color-fg` | the definition value colour |
| `--lv-color-border` | the outer border (when `bordered`) |
| `--lv-color-card` | the card surface (when `bordered`) |
| `--lv-color-card-fg` | the card surface text (when `bordered`) |
| `--lv-radius-md` | the border-radius when `bordered` |
| `--lv-space-4` | the padding inside the border when `bordered` |
| `--lv-space-6` | the column gap between grid cells |
| `--lv-space-4` | the row gap between grid rows (md size) |
| `--lv-space-2` | the row gap at `size=sm` |
| `--lv-space-6` | the row gap at `size=lg` |
| `--lv-space-1` | the gap between `<dt>` and `<dd>` (stacked within a grid cell) |
| `--lv-text-xs` | size=sm term + value text |
| `--lv-text-sm` | size=md term + value text (default) |
| `--lv-text-base` | size=lg term + value text |
| `--lv-font-medium` | the term label font-weight |
| `--lv-font-normal` | the value font-weight |
| `--lv-font-sans` | the typeface |
| `--lv-font-semibold` | the title heading font-weight (when `title` set) |

**Net-new token proposed**: `--lv-space-7` = `1.75rem` (28px) as the row gap for `size=lg`. The
current token scale skips 7 (goes 6 → 8). Without it, `size=lg` must use `--lv-space-6` or
`--lv-space-8`, neither of which matches the visual rhythm at larger text. This token is additive,
goes in `:root` only (gap is theme-invariant), no `.dark` entry needed.
Add to `lievit-tokens.css` `:root` block: `--lv-space-7: 1.75rem;`.

### Tokens consumed by `key-value`
| token | role |
|---|---|
| `--lv-color-border` | the outer border + the cell dividers (border-collapse rows) |
| `--lv-color-muted-fg` | the `<th>` column header text |
| `--lv-color-fg` | the `<td>` cell text |
| `--lv-color-surface` | the alternate-row tint (when `striped`) |
| `--lv-radius-md` | the outer border-radius (when `bordered`) |
| `--lv-font-medium` | the `<th>` header font-weight |
| `--lv-font-normal` | the `<td>` cell font-weight |
| `--lv-font-sans` | the typeface |
| `--lv-text-sm` | all cell text |
| `--lv-space-2` | cell padding |
| `--lv-space-3` | cell padding (net-new, slightly more generous than the current `--lv-space-2` — see note below) |

**Note on cell padding**: the current `key-value.jte` uses `--lv-space-2` (0.5rem) for cell padding.
The v-next re-forge proposes `--lv-space-3` (0.75rem) as the default cell padding to match the
Tailwind-UI-grade refresh (the existing `--lv-space-2` is compact and looks cramped at Tailwind-UI
fidelity). No new token is needed; `--lv-space-3` already exists.

NET-NEW tokens: `--lv-space-7` (shared with description-list above; one entry in `:root`).

---

## 6. Wire / island integration

All three surfaces are **static, no enhancer**. There is no typed-TS enhancer, no wire action, no
`l:*` directive, no runtime mount. Each partial is pure JTE → HTML; the client does nothing but
display it.

### Integration point: embedding inside a WIRE context

These partials are CONSUMED by WIRE templates (e.g. a device-session list in a security dialog, a
record detail in a slide-over). In those contexts the parent WIRE template renders one of these
partials in its owned markup. The partials themselves carry no wire state; the parent WIRE component
owns the data and passes it via `@param` to the partial. This is the correct composition:

```jte
<%-- Inside a parent WIRE template (e.g. UserProfileComponent's template): --%>
@template.lievit.description-list(
    columns = 2,
    title = "Anagrafica",
    content = @`
        @template.lievit.description-list.item(term = "Nome", content = @`${_instance.displayName()}`)
        @template.lievit.description-list.item(term = "Email", content = @`${_instance.email()}`)
        @template.lievit.description-list.item(term = "Stato", content = @`
            @template.lievit.badge(label = _instance.statusLabel(), variant = _instance.statusVariant())
        `)
    `
)
```

The `data-list.row` `dataAttrs` param is the **SAFE escaped channel** for embedding per-row wire
actions when a parent WIRE component needs to stamp a wire directive on a row (e.g. a `l:click` on
a row to open a detail dialog). The parent passes `dataAttrs=Map.of("lievit-action", "openRow",
"id", Escape.htmlAttribute(row.id()))` via the WIRE template; the partial emits the escaped
`data-*` attributes on the `<li>`. This is the same XSS-safe pattern as `button.jte`'s
`wireArgs` channel: a per-row, DB-derived value goes through `dataAttrs`, NEVER through `attrs`.

### JTE element + data-slot hooks

| Partial | Root element | `data-slot` | child slots |
|---|---|---|---|
| `data-list` | `<ul>` | `data-list` | — (content is a `gg.jte.Content` slot) |
| `data-list.row` | `<li>` (or `<a>` when `href` set) | `data-list-row` | `data-list-row-media`, `data-list-row-content`, `data-list-row-actions` |
| `description-list` | `<dl>` | `description-list` | — (content is a `gg.jte.Content` slot; title + extra are rendered above) |
| `description-list.item` | sibling `<dt>` + `<dd>` pair | `description-list-term` (dt), `description-list-value` (dd) | — |
| `key-value` | `<table>` | `key-value` | `key-value-key-head`, `key-value-value-head`, `key-value-row` |

`data-variant` and `data-size` are set on the root where applicable:
- `data-list`: `data-bordered="true|false"`.
- `description-list`: `data-columns="N"`, `data-size="sm|md|lg"`, `data-bordered="true|false"`.
- `key-value`: `data-bordered="true|false"`, `data-striped="true|false"`.

These are the test targets and the styling hooks for adopters who apply variant-scoped utilities via
CSS attribute selectors.

---

## 7. Acceptance tests

The component is DONE only when ALL of the following pass on a REAL substrate (jsdom with the JTE
compiler for PARTIAL; no mocked renderer — the client-island-fidelity lesson). No Playwright needed
(static display, no gesture).

### 7.a `data-list` + `data-list.row`

- **render — bordered**: `data-list(bordered=true, content=…)` renders a `<ul>` with `data-slot=
  "data-list" data-bordered="true"` + the card-chrome classes (`rounded-[var(--lv-radius-lg)]`
  `border border-[var(--lv-color-border)]` `bg-[var(--lv-color-card)]`); the rows are direct `<li>`
  children.
- **render — flush**: `bordered=false` renders a `<ul>` WITHOUT the card-chrome classes; the
  divide-y rule is still present between rows.
- **render — row with all slots**: a `data-list.row(leading=…, content=…, actions=…)` renders a
  `<li data-slot="data-list-row">` containing three `<div>` children with `data-slot=
  "data-list-row-media"`, `data-list-row-content"`, `data-list-row-actions"` in that order.
- **render — row without optional slots**: `leading=null, actions=null` → only the content `<div>`
  is rendered; no empty leading/actions divs in the DOM.
- **render — linked row** (`href="/detail/1"`): the `<li>` wraps a full-tile `<a href="/detail/1">`
  that contains all three slot divs; the `<li>` itself has no `href`; the `<a>` has `display:block`.
- **axe-core**: zero violations on the rendered list DOM. Assert specifically: the list has
  `role="list"`; each row has `role="listitem"`; no orphan listitem (a row outside a list).
- **axe-core — no accessible-name violation**: a list with `ariaLabel=null` and no adjacent heading
  does NOT trigger an ARIA label missing violation (lists do not require an accessible name by rule;
  this is a false-positive guard).
- **a11y — linked row accessible name**: a linked row whose content slot is text-only (`"Mario Rossi"`)
  → the `<a>` has a non-empty accessible name derived from its text content; axe passes the
  link-name rule.
- **Safari list role**: `<ul role="list">` is present in the rendered HTML even when `list-style:
  none` would be applied via CSS (the explicit `role` attribute is in the markup, not CSS-dependent;
  this is a template assertion, not a browser test).
- **hover transition token**: the `<li>` class string contains `hover:bg-[var(--lv-color-muted-bg)]`
  and `transition-colors` when `hoverHighlight=true`.
- **escaping — dataAttrs XSS**: `dataAttrs=Map.of("lievit-action", "openRow", "id", "\">|<script>")` →
  the rendered `data-id` attribute value is HTML-escaped (`&quot;&gt;|&lt;script&gt;`); no raw `<`
  in the emitted HTML.
- **JTE compiles + renders**: covered by the project-level `test/jte-compile` real-compiler gate.

### 7.b `description-list` + `description-list.item`

- **render — single column**: `description-list(columns=1, content=…)` renders a `<dl data-slot=
  "description-list" data-columns="1">` with CSS grid `grid-cols-1`; all item `<dt>`/`<dd>` are
  direct children of the `<dl>`.
- **render — multi-column**: `columns=3` → `data-columns="3"`, the `--lv-dl-cols:3` inline custom
  property is on the `<dl>`; the CSS `grid-template-columns:repeat(var(--lv-dl-cols),…)` resolves
  to 3 equal columns.
- **render — item pair**: `description-list.item(term="Email", content=@`mario@ex.com`)` renders
  a `<dt data-slot="description-list-term">Email</dt>` immediately followed by a `<dd data-slot=
  "description-list-value">mario@ex.com</dd>` as direct children of the `<dl>` (NO wrapper
  element between the `<dl>` and its `dt`/`dd` — this is load-bearing for native association).
- **render — columnSpan**: `columnSpan=2` → both the `<dt>` and the `<dd>` carry `style=
  "grid-column:span 2 / span 2;"`.
- **render — colon default**: `term="Nome"` with `colon=true` (default) → the `<dt>` text content
  is `"Nome:"` (or equivalent via CSS `content:":"` — the implementation chooses; either the param
  appends the colon in the template string, or a CSS `::after` pseudo adds it; assert the
  observable text includes the colon).
- **render — colon suppressed**: `colon=false` → the `<dt>` text is `"Nome"` without a colon.
- **render — bordered**: `bordered=true` → the `<dl>` carries `border rounded-[var(--lv-radius-md)]
  bg-[var(--lv-color-card)]` classes; `bordered=false` → those classes are absent.
- **render — title + extra**: `title="Anagrafica"` → a `<p data-slot="description-list-title">
  Anagrafica</p>` is rendered above the `<dl>`; `extra` slot content follows it in the same row.
- **render — size=sm**: the `<dl>` carries `text-[length:var(--lv-text-xs)]`; gap is narrower.
- **render — size=lg**: the `<dl>` carries `text-[length:var(--lv-text-base)]`; gap is wider.
- **axe-core**: zero violations on the rendered `<dl>` DOM. A `<dt>` without a following `<dd>` in
  the same group would be a violation — assert that every item renders a paired `<dt>` + `<dd>`.
- **a11y — no wrapper between dl and dt/dd**: assert the FIRST child of `<dl>` is a `<dt>` (not a
  `<div>` or `<span>` wrapper); this is the load-bearing structure for native AT association.
- **a11y — term colour**: `<dt>` carries `color:var(--lv-color-muted-fg)` (low-emphasis label).
- **JTE compiles + renders**: covered by `test/jte-compile`.

### 7.c `key-value`

- **render — with pairs**: `key-value(pairs=Map.of("Nome","Mario","Email","mario@ex.com"))` renders
  a `<table data-slot="key-value">` with one `<thead><tr>` containing two `<th scope="col">` cells
  + one `<tbody>` with two `<tr>` rows, each with two `<td>` cells; the key and value text are
  present in the correct cells.
- **render — empty pairs + emptyMessage**: `pairs=Map.of()` + `emptyMessage="Nessuna chiave"` →
  `<tbody>` contains one `<tr><td colspan="2">Nessuna chiave</td></tr>`; no empty `<td>` orphan.
- **render — empty pairs without emptyMessage**: `pairs=Map.of()` + `emptyMessage=null` → `<tbody>`
  is present but empty (no `<tr>` children); the header row still renders.
- **render — striped**: `striped=true` → even `<tr>` elements carry `bg-[var(--lv-color-surface)]`.
- **render — bordered**: `bordered=true` → the `<table>` carries `border` + `rounded-[var(--lv-
  radius-md)]`; `bordered=false` → those classes are absent.
- **render — custom labels**: `keyLabel="Campo"`, `valueLabel="Valore"` → `<th scope="col">Campo</th>`
  + `<th scope="col">Valore</th>`.
- **axe-core**: zero violations. Assert specifically: `<th scope="col">` is present for both
  header cells (the WCAG column-header scope requirement for a two-column table).
- **a11y — no role="table" redundancy**: the native `<table>` element already carries the implicit
  table role; the template does NOT add an explicit `role="table"` attribute (it would be redundant
  and is not emitted).
- **JTE compiles + renders**: covered by `test/jte-compile`.

---

## 8. Non-goals / anti-patterns

- **NOT an interactive listbox or data-grid**: `data-list` has no selection state, no arrow
  navigation, no roving tabindex, no `aria-selected`. When rows need to be selectable, use
  `data-table` (with checkbox column) or `select (rich)` (for a listbox widget).
- **NOT a sortable, filterable, or paginated table**: `key-value` has no sortable `<th>`, no
  filter input, no pagination. For those features, use `data-table`. The `key-value` table is
  static by contract.
- **NOT a form**: `description-list` and `key-value` are READ-ONLY. They display projected values,
  never `<input>` elements. For editing, the adopter composes a WIRE form with the same layout.
- **NOT a heading-bearing section**: the `description-list` `title` param renders a `<p>`, not an
  `<h2>`/`<h3>`. The correct heading level is the caller's decision; the partial does not accept a
  `headingLevel` param (the heading trap — heading levels are structural, not configurable by a
  component). If a heading is needed, the caller wraps the whole partial in a `<section>` with an
  `<h2>`.
- **NOT a copy-to-clipboard widget**: `key-value` and `description-list` carry no click-to-copy
  behavior. The adopter adds a copy affordance in the value slot as a `<button>` (the WIRE parent
  wires a copy action onto it); the partial carries no inline JS and no `onclick`.
- **Do not put interactive elements directly in `<dt>`**: a `<dt>` is a term / label — it should be
  static text. Interactive affordances (edit, copy) belong in the `<dd>` value content or in a
  `data-list.row`'s `actions` slot.
- **Do not use `data-list` as a navigation menu**: if the list's purpose is navigation (a list of
  links to pages), use `<nav>` + `breadcrumb` / `navigation-menu`, which carry the correct
  `role="navigation"` landmark. A `data-list` whose rows are links is not a navigation landmark.
- **Do not add `aria-label` to every `<dl>`**: description lists do not need an accessible name in
  most contexts (WCAG does not require it for read-only description lists embedded in a labelled
  section). Adding `aria-label` to every `<dl>` creates noise. Only add it when the `<dl>` stands
  alone on a page without any surrounding structural context.
- **Do not hand-roll the `<dl>/<dt>/<dd>` association with `<div>` wrappers**: a `<div>` between
  `<dl>` and its `<dt>`/`<dd>` children breaks the native AT association in most browsers (Chrome
  and Firefox allow one level of `<div>` grouping per the HTML5 spec, but it is fragile and
  unnecessary here). The template emits `<dt>` + `<dd>` as direct children of `<dl>` (the
  `description-list.item` sibling-pair rule, already enforced in the current implementation).

---

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read Ant Design Descriptions + shadcn's
description-list examples + Tailwind UI detail page patterns as references for INVENTORY (which
variants, which params, which layout) and LOOK (visual style). You MUST NOT paste literal source
from any of them (the one bright line, `02-licensing.md`) — the output is always original
generation, written from scratch.

**The three surfaces are distinct**: do not conflate `data-list` (divided `<ul>` for collections),
`description-list` (label→value `<dl>` grid for a single record), and `key-value` (two-column
`<table>` for a homogeneous map). Each re-forges the existing `.jte` of the same name.

**The `<dt>`/`<dd>` pairing rule is non-negotiable**: `description-list.item` MUST emit its `<dt>`
and `<dd>` as direct children of the parent `<dl>` (the caller's `${content}` expansion inserts
them directly into the `<dl>` body). NO wrapping `<div>` or `<span>` between `<dl>` and the pair.
This is the load-bearing semantic association; violating it breaks AT in most browsers.

**The Safari list-role rule is non-negotiable**: `<ul role="list">` and `<li role="listitem">` MUST
carry explicit `role` attributes even though they are implicit on those elements. CSS `list-style:
none` strips the implicit role in Safari; the explicit attribute survives.

**The `<th scope="col">` rule is non-negotiable**: every `key-value` `<th>` MUST carry `scope="col"`.
This is the WCAG column-header SC for a two-column static table.

**The escaping channel is the XSS gate**: any per-row, DB-derived value that lands in a `data-*`
attribute (e.g. `data-list.row`'s `dataAttrs`) MUST go through `Escape.htmlAttribute`. The `attrs`
(trusted-raw, `$unsafe`) param is for STATIC author-typed strings only. This split is not optional.

**Net-new token**: add `--lv-space-7: 1.75rem;` to `lievit-tokens.css` `:root` BEFORE implementing
the `description-list` `size=lg` gap. This is the only new token in the set; no `.dark` entry.

**The linked-row `href` rule**: when `data-list.row` renders with `href` set, the `<li>` must
contain a block-level `<a>` that covers the full tile (same pattern as `stat-card.jte`'s whole-card
link wrapper). The `<a>` is the interactive element; the `<li>` is purely structural. Do NOT make
the `<li>` itself the link (`<li href>` is invalid HTML).

Mirror the current templates' JTE house conventions exactly: header doc-comment with labelled
sections (TIER, STRUCTURE citing the source, A11y, Params, Usage), typed `@param`, `data-slot`,
the two escaping channels, zero `<script>`, zero inline `on*=`. `button.jte` is the reference
exemplar. Minimal code to GREEN against the acceptance tests; the a11y rules (explicit roles,
scope, sibling pairs) are the contract — assert ALL of them.
