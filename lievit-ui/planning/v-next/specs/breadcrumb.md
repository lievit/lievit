<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — breadcrumb

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/breadcrumb.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Breadcrumb (nav of links) — https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
      (platform-supplied via `<nav>` + `<a>`; no react-aria reference needed — the pattern is static
      navigation, keyboard/focus is fully platform-native)
    - inventory: Ant Design Breadcrumb as inventory reference (separator customisation, item icons,
      last-item-as-current, collapsed middle items with ellipsis)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A breadcrumb is a secondary navigation trail that shows the user's current location inside a hierarchical
page structure (e.g. Home / Customers / Acme Corp / Edit). It is a STATIC display of ordered links —
the server renders it from a typed list of items, each with a label and an optional href. PARTIAL because
it holds zero state: the current-page item is a fact the controller already knows (it renders the page),
so it arrives as a param, not as something the component needs to manage. Server-first works perfectly:
there is nothing client about a list of links. The component job is to render the semantic structure,
the visual separators, and the correct ARIA attributes in one place, consistently.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| items | `List<BreadcrumbItem>` | — | **REQUIRED.** Ordered list of crumbs, root-first. Each `BreadcrumbItem` carries: `label String` (display text), `href String` (null → renders as `<span>`, not a link), `icon gg.jte.Content` (optional leading icon per crumb), `attrs String` (TRUSTED raw — STATIC author-typed extras, e.g. `target="_blank"`, `data-turbo="false"`). The LAST item in the list is the current-page crumb. |
| navLabel | String | "Breadcrumb" | `aria-label` on the `<nav>` wrapper; override when a page has multiple `<nav>` regions or when a non-English app needs a translated label. |
| separator | String | "/" | Visual separator character rendered between crumbs. Anything renderable as text (e.g. `"/"`, `"›"`, `">"`, `"•"`). Rendered via CSS `content:` or a `<span aria-hidden="true">` so it is invisible to assistive technology. |
| collapsed | boolean | false | When `true` AND `items.size() > maxVisible + 2`, hides the middle items behind an ellipsis expander. The first and last crumbs are always visible. |
| maxVisible | int | 3 | Maximum number of visible intermediate crumbs before collapsing kicks in. Only meaningful when `collapsed=true`. When the total item count is ≤ `maxVisible + 2` (first + last), no collapse occurs. |
| size | String | "md" | `sm \| md \| lg` — scales the text size and spacing (NOT height-rowed like form controls; breadcrumbs sit inline in a layout, so size scales type, not a control height). |
| cssClass | String | "" | Extra utility classes on the root `<nav>`. |

**`BreadcrumbItem` record** (server-side typed; no per-item escaping issues because `href` and `label`
are typed Java strings passed through template `${...}` safe escaping — there is no `wireArgs`/`dataAttrs`
channel here since breadcrumbs are not interactive per-row action surfaces):

```java
public record BreadcrumbItem(
    String label,          // display text; must be non-blank
    @Nullable String href, // null → current/non-link item; non-null → <a href>
    @Nullable Content icon // optional leading icon slot per item
) {}
```

No `attrs` TRUSTED channel on `BreadcrumbItem` by default (the crumb set is always server-authored, never
DB-row-derived in a hostile sense). If an adopter needs per-link extras (e.g. `data-turbo="false"` on one
link), they pass a static-safe `attrs` String on that item — documented as trusted/author-controlled only,
same rule as button's `attrs`.

## 3. Variants / sizes / states

### Sizes (text-scaling, not height-based)
Breadcrumbs are inline nav elements, not form controls, so size scales TYPE not a control height:

| size | text token | spacing | use case |
|---|---|---|---|
| sm | `--lv-text-xs` | `--lv-space-1` gap | compact headers, dense layouts |
| md (default) | `--lv-text-sm` | `--lv-space-2` gap | standard page headers |
| lg | `--lv-text-base` | `--lv-space-3` gap | prominent top-of-page placement |

`data-size` is still stamped on the root for styling hooks + test targets (consistent with the library
convention even when size is type-scale rather than height-scale).

### States

| state | how expressed |
|---|---|
| **current page** (last item) | `aria-current="page"` on the `<a>` (if it has an href) or on the `<span>` (if no href); coloured `--lv-color-fg` (fully opaque, not muted); no underline to distinguish it from a traversable link |
| **traversable link** (not last) | `<a href>` styled `--lv-color-muted-fg` with `hover:--lv-color-fg` + `hover:underline`; focus-visible ring via `--lv-ring` |
| **non-link crumb** (no href, not last) | `<span>` styled `--lv-color-muted-fg`; non-interactive, no ring |
| **collapsed / ellipsis** | middle items hidden; an ellipsis `<span aria-label="…" role="button">` or `<button>` stands in (see §6 note on collapsed) |
| **with icon** | leading `<span aria-hidden="true">` wrapping the icon content, before the label; the icon is decorative |

### Separator rendering
The separator is decorative and MUST be hidden from assistive technology.
Preferred implementation: a `<span aria-hidden="true">` carrying the separator string, placed between each
pair of `<li>` items (inside the list items as a sibling, not as pseudo-content, so it works in JTE without
a CSS dependency on the separator value). Alternative: CSS `li + li::before { content: var(--lv-breadcrumb-separator); }`
with the `--lv-breadcrumb-separator` custom property set via inline style on the `<ol>` — either is
acceptable, but the `aria-hidden` span is simpler to parameterise from Java and avoids an inline-style.

The chosen approach is `<span aria-hidden="true">` — it is JTE-native, requires no inline style, and
the separator value comes directly from the `separator` param without CSS indirection.

### Collapsed variant
When `collapsed=true` and the item count exceeds `maxVisible + 2`:
- items[0] (root, first) is always rendered.
- items[last] (current) is always rendered.
- items[1 .. last-1] are hidden; a `<li>` with a `<button aria-label="Show full path" aria-expanded="false">`
  (containing "…") is rendered in their place.
- Expanding is a PARTIAL-level concern only if done client-side. For a PARTIAL that is strictly server-rendered,
  the collapsed state is resolved server-side: the controller decides whether to pass `collapsed=true` or
  `collapsed=false` based on some condition (the PARTIAL does not toggle itself). If a toggling ellipsis is
  needed, the consuming WIRE template wires `l:click` on the ellipsis button to an action that re-renders
  with `collapsed=false`. The PARTIAL itself never owns toggle state.

## 4. The a11y contract

- **WAI-ARIA pattern**: APG Breadcrumb (nav of links).
  Source: https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
  Example: https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/examples/breadcrumb/

- **roles + ARIA**:

  | element | role / attribute | value / rule |
  |---|---|---|
  | `<nav>` | implicit `role="navigation"` (landmark) | always present; `aria-label="${navLabel}"` (default "Breadcrumb") to distinguish from other `<nav>` regions on the page |
  | `<ol>` | implicit `role="list"` | ordered list; items in DOM order = root→current |
  | `<li>` | implicit `role="listitem"` | one per crumb + one per separator span |
  | `<a href>` (traversable link) | implicit `role="link"` | no extra ARIA needed; href is present; focus-visible ring |
  | `<a href>` on the last item (current, if has href) | `aria-current="page"` | APG requirement: marks the user's current location; the link can still be an `<a>` (some designs link the current crumb to itself, e.g. to reload) |
  | `<span>` on the last item (current, no href) | `aria-current="page"` | APG: aria-current is still set even on a non-link current item |
  | separator `<span>` | `aria-hidden="true"` | separators are decorative; screen readers must not announce them |
  | icon `<span>` | `aria-hidden="true"` | icon is decorative; the label provides the accessible name |

- **keyboard map**:

  The APG explicitly states keyboard interaction is "Not applicable" for breadcrumbs: the pattern is a
  static list of standard links; no custom keyboard behaviour is required or defined. Platform-native
  link navigation applies.

  | key | does | who |
  |---|---|---|
  | Tab / Shift+Tab | move focus through the links in DOM order | platform (native `<a>`) |
  | Enter (on a focused link) | navigate to href | platform (native `<a>`) |

  No arrow-key roving, no Home/End, no typeahead. This is correct per APG — do NOT add custom keyboard
  handling (it would violate the "prefer real native elements" rule and create a non-standard UX for a
  pattern that is trivially handled by the platform).

- **focus management**: entirely platform-supplied. Each `<a>` is a real link in the tab order. The
  breadcrumb has no focus trap, no roving tabindex, no programmatic focus movement. A non-link current
  item (`<span aria-current="page">`) is correctly NOT in the tab order (it is not interactive).

- **live region**: none. A breadcrumb is a static navigation aid, not a status announcer.

- **shared mechanism composed**: none. This is the simplest navigation pattern — the exemplar of "a real
  `<nav>` + real `<a>` elements + the right aria-current is all that is needed."

- **screen reader expectations**:
  - The `<nav aria-label="Breadcrumb">` announces as a navigation landmark; screen reader users can
    jump to it via landmark navigation.
  - Items are announced as a list ("list of N items") → each link/item in DOM order.
  - The current item announces "Breadcrumb, navigation" at the landmark, then "[label] link, current page"
    (or "[label] current page" for a span) at the item — the `aria-current="page"` produces the "current
    page" announcement in all major screen readers.
  - Separators are silent (aria-hidden).
  - Icons are silent (aria-hidden).

## 5. Tokens

The breadcrumb reads the following `--lv-*` tokens:

| token | use |
|---|---|
| `--lv-text-xs` | sm size text |
| `--lv-text-sm` | md size text (default) |
| `--lv-text-base` | lg size text |
| `--lv-color-muted-fg` | traversable link colour (subdued, not the primary text) |
| `--lv-color-fg` | current-page crumb colour + link hover colour |
| `--lv-color-accent` | optional: link hover accent tint (adopter can override) |
| `--lv-space-1` | sm gap between crumb items |
| `--lv-space-2` | md gap between crumb items (default) |
| `--lv-space-3` | lg gap between crumb items |
| `--lv-ring` | focus-visible ring on focused links |
| `--lv-font-sans` | type family |

**NET-NEW token**: `--lv-breadcrumb-separator` — a CSS custom property on the `<ol>` if an adopter wants
CSS-pseudo separator instead of the `aria-hidden` span approach. This is additive and optional; the primary
approach uses the `aria-hidden` span, so this token is proposed as a styling hook for adopter overrides
only. Value default: `"/"` (a CSS string). Goes in `:root` only (no dark-mode variant — separators are
structural, not colour tokens). However if the implementation uses `aria-hidden` spans exclusively, this
token is NOT needed and the net-new list is empty. Recommended: skip the token, use `aria-hidden` spans.

**No net-new colour tokens required.** The breadcrumb's visual language is fully covered by the existing
`--lv-color-muted-fg` / `--lv-color-fg` / `--lv-ring` palette.

All colour tokens are authored in OKLCH (architecture contract §4, D1 DECIDED).

## 6. Wire / island integration

**Tier: PARTIAL — static, no enhancer.**

The breadcrumb is server-rendered once per page render. There is no client state, no wire round-trip,
no enhancer. The controller builds the `List<BreadcrumbItem>` from the current route/entity hierarchy
and passes it to the template. The template renders the full trail deterministically.

**JTE structure** (element map):

```
<nav aria-label="${navLabel}" data-slot="breadcrumb" data-size="${size}" class="…${cssClass}">
  <ol class="flex flex-wrap items-center gap-…">
    !{for each item in items}
      <li class="flex items-center gap-…">
        !{if item.icon != null}
          <span aria-hidden="true" class="…">${item.icon}</span>
        !{endif}
        !{if isLast && item.href != null}
          <a href="${item.href}" aria-current="page" class="…">
            ${item.label}
          </a>
        !{elseif isLast}
          <span aria-current="page" class="…">${item.label}</span>
        !{elseif item.href != null}
          <a href="${item.href}" class="…">
            ${item.label}
          </a>
        !{else}
          <span class="…">${item.label}</span>
        !{endif}
      </li>
      !{if not isLast}
        <li aria-hidden="true" class="…">${separator}</li>
      !{endif}
    !{endfor}
  </ol>
</nav>
```

Key structural decisions:
- The separator is a dedicated `<li aria-hidden="true">` — NOT inside the crumb `<li>` — so the list
  item count announced by screen readers reflects ONLY the crumb items (each crumb is one `<li>`; the
  separator `<li>` is hidden from the a11y tree). Alternative: if the separator goes inside each crumb
  `<li>` as a `<span aria-hidden="true">` sibling of the link, the item count is still clean. Both are
  correct; the dedicated `<li aria-hidden="true">` is slightly more readable in the JTE loop.
- `${item.href}` and `${item.label}` go through JTE's default HTML-safe `${}` escaping — these are NOT
  `attrs` TRUSTED raw injections. The `BreadcrumbItem` is a typed Java record whose fields are safe to
  emit via standard JTE output.
- If an individual item carries `attrs` (a static author-supplied string for `target`, `rel`, etc.), it
  is emitted as `$unsafe{item.attrs}` — the TRUSTED raw channel, identical to button's `attrs`. The value
  MUST be a STATIC string authored by the Java developer, never a DB-derived runtime value.
- The collapsed path: when `collapsed=true` and the item count exceeds `maxVisible + 2`, the template
  emits only items[0], the ellipsis `<li>`, and items[last]. The ellipsis is a `<button>` so it is
  keyboard-reachable. Since the PARTIAL does not own the toggle (it is stateless), the button's
  `l:click="expandBreadcrumb"` would be wired only in a consuming WIRE context; if used standalone (no
  wire), the button is inert (no JS) but still visually present — collapsed state is therefore a
  controller decision. Document this clearly in the template header comment.
- No `<script>`, no inline `on*=`, no hardcoded separators in CSS — the separator is a param.

**data-* hooks present**:

| attribute | on | purpose |
|---|---|---|
| `data-slot="breadcrumb"` | `<nav>` root | test target + adopter CSS |
| `data-size="${size}"` | `<nav>` root | size styling hook |
| `data-current` (no value) | last `<li>` | test + adopter styling of the current crumb item |

## 7. Acceptance tests

The component is DONE only when ALL of these pass on a REAL substrate (not mocked):

**render (jsdom, JTE real-compiler + real `${}` escaping)**

- `renders_nav_with_aria_label`: a 3-item list renders a `<nav aria-label="Breadcrumb">` with a
  `data-slot="breadcrumb"` attribute.
- `renders_ordered_list_of_crumbs`: the `<ol>` contains exactly 3 crumb `<li>` elements (separator
  `<li>` nodes are `aria-hidden` and must not interfere with the crumb count assertion).
- `traversable_links_have_correct_href`: items[0] and items[1] render as `<a href="…">` with the
  expected href values.
- `current_item_has_aria_current_page`: the last item (with href) renders `<a aria-current="page">`;
  the last item (without href) renders `<span aria-current="page">`.
- `non_link_current_item_is_not_in_tab_order`: a last item with `href=null` renders a `<span>`, not
  an `<a>`, confirming it is not focusable (a span is naturally excluded from tab order).
- `separators_are_aria_hidden`: every separator element carries `aria-hidden="true"` and contains
  the expected separator string.
- `icons_are_aria_hidden`: a crumb with an icon slot renders the icon inside `<span aria-hidden="true">`.
- `custom_nav_label_is_reflected`: passing `navLabel="Navigazione"` renders `aria-label="Navigazione"`.
- `custom_separator_is_reflected`: passing `separator="›"` renders `›` in the separator elements.
- `size_attribute_on_root`: passing `size="lg"` renders `data-size="lg"` on `<nav>`.
- `collapsed_hides_middle_items`: with 6 items and `collapsed=true maxVisible=2`, only items[0], an
  ellipsis element, and items[5] are rendered; items[1..4] are absent from the DOM.
- `collapsed_ellipsis_is_keyboard_reachable`: the ellipsis renders as a `<button>` (not a bare `<span>`),
  so it appears in the tab order.
- `single_item_renders_only_current`: a 1-item list renders one `<span aria-current="page">` (the sole
  item is both root and current) with no separators.

**axe-core (zero violations on the rendered DOM, all items)**

- `axe_passes_standard_3_item_breadcrumb`: zero violations on a 3-link trail; checks landmark-unique +
  aria-current validity.
- `axe_passes_no_href_current_item`: zero violations when the current item is a `<span aria-current="page">`.
- `axe_passes_icon_crumbs`: zero violations when items carry icons (asserts icons are aria-hidden and do
  not create accessible-name gaps).

**keyboard (asserting platform-native behaviour via the rendered DOM)**

- `tab_order_contains_only_links`: all `<a>` elements in the breadcrumb appear in document tab order;
  `<span>` items (current, no href) and `aria-hidden` separators do NOT appear.
- `enter_on_link_navigates`: simulating Enter on a focused `<a>` fires navigation (assert `click` event
  on the anchor — platform behaviour, asserted to confirm no handler prevents it).

The keyboard map is "Tab/Enter — platform". There is nothing custom to assert; the above two tests confirm
the platform contract holds.

**focus (no trap, no management)**

- `no_focus_trap_present`: Tab on the last link in the breadcrumb moves focus OUT of the `<nav>` (assert
  the next focused element is outside `data-slot="breadcrumb"`).

**variants / sizes**

- `sm_size_emits_data_size_sm`: `data-size="sm"` on `<nav>`.
- `md_size_is_default`: omitting `size` emits `data-size="md"`.
- `lg_size_emits_data_size_lg`: `data-size="lg"` on `<nav>`.

**escaping (the XSS abuse-case)**

- `hostile_label_is_escaped`: an item label of `"><script>alert(1)</script>` renders the literal string
  inert in the DOM (JTE `${}` HTML-escapes it; no script executes).
- `hostile_href_is_escaped`: an item href of `javascript:alert(1)` must be rejected or rendered inert.
  Implementation note: the template SHOULD sanitise `href` by rejecting non-`http(s)` schemes or by
  routing all hrefs through `Escape.htmlAttribute`. If the template naively emits `href="${item.href}"`,
  JTE's default escaping will escape the quotes but NOT the `javascript:` scheme — so the implementation
  MUST add an explicit scheme allowlist guard (allow only `http://`, `https://`, `/`, `#`). Assert this
  case in the test.
- `trusted_attrs_are_not_user_data`: document (not assert) that `item.attrs` is TRUSTED raw. The test
  documents the channel with a static-value smoke (`target="_blank"` → present in output) and a
  developer-docs note.

**JTE compiles + renders**: covered by the existing `test/jte-compile` real-compiler gate. This test
gate confirms the template syntax is valid JTE (no compile error), which is non-trivial for the loop +
conditional structure.

## 8. Non-goals / anti-patterns

- **No JavaScript / no enhancer.** A breadcrumb is static. If a crumb list needs to change dynamically
  in response to client state, that is a concern of the WIRE template that owns the page — the breadcrumb
  PARTIAL is re-rendered server-side on navigation and simply reflects the new trail. Do NOT reach for an
  enhancer to "update" the breadcrumb client-side.
- **No CSS-generated separators with a per-component custom property.** Tempting (`li + li::before`) but
  it makes the separator value a CSS concern, not a Java concern, and breaks parameterisation from the
  controller. The `aria-hidden` span approach keeps the separator a plain Java String.
- **No `role="navigation"` on the `<nav>`.** `<nav>` carries it implicitly; adding it explicitly is
  redundant and a lint violation.
- **No `aria-label="breadcrumb"` hardcoded in the template.** The label goes through the `navLabel`
  param so non-English adopters can translate it. The DEFAULT value `"Breadcrumb"` is correct for
  English, but the template must never bake in a literal string.
- **No adding keyboard roving or arrow-key navigation.** The APG explicitly says keyboard interaction
  is "not applicable." Any custom arrow-key handling would be non-standard, confusing, and a spec
  violation.
- **No making the current-page item non-focusable by removing it from the DOM.** The current item
  MUST still render (with `aria-current="page"`); hiding it entirely breaks screen reader landmark
  navigation to the current location. Only the HREF can be omitted (making it a `<span>`), which
  correctly removes it from tab order while keeping it visible and announced.
- **No reusing `aria-current="true"`.** The APG specifically requires `aria-current="page"` (not
  `true`, not `location`, not `step`) for a breadcrumb representing the current PAGE. Use the exact value.
- **No using `<ul>` instead of `<ol>`.** The crumb trail is ordered (root → current); `<ol>` is the
  semantically correct choice and matches the APG example.
- **No rendering the collapsed ellipsis as a non-interactive `<span>` without `tabindex`.** If an
  ellipsis is rendered and could trigger expansion, it must be a `<button>` so keyboard users can
  activate it. If no expansion is possible (pure static rendering), omit the ellipsis entirely and
  render the full list.
- **No inline `<script>` or `on*=` attributes.** The strict CSP refuses them; the breadcrumb needs
  none; any attempt to add one is an anti-pattern (the existing anti-pattern grep catches it).

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH) tokens. You MAY read the WAI-ARIA APG Breadcrumb pattern
page (https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/) and the APG example page, Ant Design
Breadcrumb, and Tailwind UI Breadcrumb as PATTERN and LOOK references. You MUST NOT paste literal source
from any of them (the one bright line, `02-licensing.md`) — output is always original generation.

Mirror `button.jte`'s house conventions exactly: header doc-comment with labelled sections (`TIER:`,
`STRUCTURE:`, `A11y:`, `Params:`, `Usage:`), typed `@param`, `data-slot="breadcrumb"` on the root,
zero `<script>`, zero inline `on*=`. Use `${}` safe escaping for all item values; use `$unsafe{}` ONLY
for the static `item.attrs` trusted-raw channel, with a comment that it is author-controlled only.

Add an explicit href scheme allowlist guard (`href` must start with `/`, `#`, `http://`, or `https://`;
otherwise render the item as a `<span>` without an href) — the escaping test demands this.

Minimal code to GREEN against the acceptance tests above. The a11y gate (axe-core) and the escaping
tests are non-negotiable. The collapsed-ellipsis path is the one conditional complexity: implement it
cleanly as a JTE `!{if}` block, keep it readable.
