<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — item / kbd / link

- **tier**: PARTIAL (three co-specified display primitives; no WIRE, no enhancer)
- **build sequence**: S1  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/item.jte`, `registry/jte/kbd.jte`,
  `registry/jte/link.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Link pattern (`https://www.w3.org/WAI/ARIA/apg/patterns/link/`) for `link`;
      HTML Living Standard `<kbd>` semantics for `kbd`;
      platform-native `<li>` / `<dd>` / `<dt>` roles for `item` — all three supplied by the platform,
      no react-aria reference needed (native elements carry role + keyboard + focus for free where
      applicable, or are non-interactive and need none)
    - inventory: Ant Design Typography (Text, Link), shadcn `Badge`+`Kbd` primitive,
      Tailwind UI `<kbd>` visual treatment as inventory / visual references
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

---

## 1. What they are

Three atomic DISPLAY primitives co-specified here because they share a tier (PARTIAL, no server
state, no interaction logic of their own), a styling approach (inline / flow-level, `--lv-*` token
skin), and a build concern (they are leaves that every composite component — sidebar, command palette,
description list, infolist-entry — renders inside itself or composes via `@template`).

**`item`**: a single row / entry in a list-like context (sidebar nav item, command palette row,
description list entry, table-row action row). Renders as `<li>`, `<dd>`, or a non-semantic `<div>`
depending on its containing context, declared via the `element` param. Carries leading icon, label,
trailing badge/meta, and an optional nested `content` region (for sub-items). It is purely a
presentation scaffold: actions and links are composed INTO it by the consuming template via `content`
or `href`/`wireClick`, not hard-wired. Server-first works trivially: the item holds no state.

**`kbd`**: a typographic token that renders `<kbd>` HTML — the semantic element for keyboard input /
keyboard shortcuts (HTML Living Standard §4.5.18). Renders a SINGLE key (`⌘`) or a compound chord
(`⌘ K`) from an ordered list of key strings. A chord is rendered as a sequence of individual
`<kbd>` children wrapped in an outer `<kbd>` per the HTML spec nesting model. No interaction.
Server-first: static markup only.

**`link`**: an inline or block-level anchor styled to lievit's design language — token-colored,
underline-on-hover, focus ring, correct external-target affordances. Always renders a native `<a>`
(the APG recommendation: "use the HTML `<a>` element to create links whenever possible"). When the
target is external, it stamps `target="_blank" rel="noopener noreferrer"` and appends a
visually-hidden "opens in new tab" span for screen readers. Server-first works trivially: a link
is a GET, nothing to server-state.

All three are PARTIALs: they hold no `@Wire` state, they fire no wire actions of their own,
and the consuming WIRE template wires any action on them if needed. The only irreducible client
behavior a link ever needs (tracking, SPA navigation) lives in the consuming template's `l:click`
wired onto the `<a>` via `attrs`, not in this partial.

---

## 2. API — params / props (the typed surface)

### 2.a `item` partial

| param | type | default | meaning |
|---|---|---|---|
| `element` | `String` | `"li"` | HTML element: `li` (for `<ul>`/`<ol>` lists), `dd` (description list value), `dt` (description list term), `div` (non-semantic, e.g. sidebar section). Drives the root element; the partial does NOT emit a wrapping list. |
| `variant` | `String` | `"default"` | `default \| active \| danger \| muted` — intent-based color emphasis. `active` = the current/selected item; `danger` = destructive action row. |
| `size` | `String` | `"md"` | `sm \| md \| lg` — height-based, toolbar-aligned (same scale as `button`). Controls min-height + icon size + text size. |
| `disabled` | `boolean` | `false` | dims the row; if `href` is set in `content`, the consumer is responsible for removing it (the item partial itself is not an interactive element and does not set `aria-disabled`). |
| `cssClass` | `String` | `""` | extra utility classes appended to the root element. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `id="item-profile"`, `data-testid="..."`). Never fed DB-derived values. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (each value via `Escape.htmlAttribute`). |
| `leading` | `gg.jte.Content` | — | optional slot: icon or avatar rendered before the label. Typically `@template.lievit.icon(...)`. |
| `trailing` | `gg.jte.Content` | — | optional slot: badge, count, chevron, or secondary action rendered after the label. |
| `content` | `gg.jte.Content` | — | the item's primary label text or richer markup (a nested `<a>`, a `<button>`, a sub-list). The item partial is the SCAFFOLD; the interactive element (if any) is in here. |

### 2.b `kbd` partial

| param | type | default | meaning |
|---|---|---|---|
| `keys` | `List<String>` | — | **REQUIRED.** Ordered list of key names to display. A single entry (`["⌘"]`) renders one `<kbd>`. Multiple entries (`["⌘", "K"]`) render a chord: an outer `<kbd>` wrapping individual inner `<kbd>` per key (HTML spec nesting model). |
| `size` | `String` | `"md"` | `sm \| md \| lg` — scales font size + padding + border-radius. Does NOT follow the height-based toolbar scale (kbd is inline flow, not a block control). |
| `ariaLabel` | `String` | `null` | when set, overrides the visible key text as the accessible name. Use when the key symbol is ambiguous (e.g. `"⌘"` → `ariaLabel="Command"`). When null, the visible text is the accessible name (the `<kbd>` element's text content is announced). |
| `cssClass` | `String` | `""` | extra utility classes appended to the outer element. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only. |

### 2.c `link` partial

| param | type | default | meaning |
|---|---|---|---|
| `href` | `String` | — | **REQUIRED.** The link destination. Always rendered as a native `<a href>`. |
| `variant` | `String` | `"default"` | `default \| muted \| destructive \| ghost` — token-based color intent. `default` = primary brand color underlined; `muted` = subdued; `destructive` = danger red; `ghost` = inherits surrounding text color, underline only on hover. |
| `size` | `String` | `"inherit"` | `sm \| md \| lg \| inherit` — explicit text size, or `inherit` (default: the link inherits whatever flow size the parent sets, typical for inline use). |
| `external` | `boolean` | `false` | when `true`: stamps `target="_blank" rel="noopener noreferrer"` + appends a visually-hidden `<span class="sr-only">` "(opens in new tab)" for screen readers + renders an external-link icon as a trailing `<span aria-hidden="true">`. |
| `disabled` | `boolean` | `false` | adds `aria-disabled="true"` (native `disabled` does not exist on `<a>`), removes `href`, dims visually. The element stays in the tab order with role `link` and announces as disabled. |
| `download` | `String` | `null` | when set, adds `download="${download}"` to the anchor. The value is the suggested filename; pass `""` for no filename hint. |
| `ariaLabel` | `String` | `null` | override accessible name (use for icon-only links or when the visible text is ambiguous in context). |
| `cssClass` | `String` | `""` | extra utility classes appended to the `<a>`. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `target`, `rel`, `hreflang`, `l:click="action"` for wire wiring). |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (each value via `Escape.htmlAttribute`). |
| `content` | `gg.jte.Content` | — | the link's visible label content. May include an icon via `@template.lievit.icon(...)` when used inline. |

---

## 3. Variants / Sizes / States

### 3.a `item` variants, sizes, states

**Variants** (intent vocabulary, mapped to token pairs via a `switch`):
- `default` — `--lv-color-fg` label, transparent background; `:hover` → `--lv-color-accent`/`-fg` bg.
- `active` — `--lv-color-accent`/`-fg` bg, `--lv-color-accent-fg` label (the current-selection look).
  The consuming template sets `active` based on server state (URL match, selection, etc.).
- `danger` — `--lv-color-destructive` label; `:hover` → `--lv-color-destructive`/`--lv-color-destructive-fg` bg.
- `muted` — `--lv-color-muted-fg` label, used for section headers / group separators inside lists.

**Sizes** (height-based, toolbar-aligned; same scale as `button`/`input`):
- `sm` → min-height `--lv-space-8` (32px), icon `--lv-space-4`, text `--lv-text-xs`.
- `md` → min-height `--lv-space-9` (36px, default), icon `--lv-space-5`, text `--lv-text-sm`.
- `lg` → min-height `--lv-space-10` (40px), icon `--lv-space-5`, text `--lv-text-base`.

**States**:
- `disabled` — `opacity: 0.5`, `pointer-events: none` via Tailwind utilities. The item partial is not
  itself interactive, so no `aria-disabled` (the interactive element INSIDE `content` is the one that
  carries disabled state).
- `data-variant` and `data-size` attributes on the root for styling hooks + test targets.
- No `:focus-visible` ring on the item root itself (the ring belongs on the interactive element inside `content`).

### 3.b `kbd` sizes

**Sizes** (inline scale, NOT toolbar-aligned — kbd is flow-level):
- `sm` → `--lv-text-xs` font, `--lv-space-1` vertical / `--lv-space-2` horizontal padding.
- `md` → `--lv-text-sm` font (default), `--lv-space-1` / `--lv-space-2` padding.
- `lg` → `--lv-text-base` font, `--lv-space-1` / `--lv-space-3` padding.

No variant axis: `kbd` is always the same intent (neutral key cap). `data-size` on the root.

**States**: none. Static display element.

### 3.c `link` variants, sizes, states

**Variants** (intent vocabulary):
- `default` — `--lv-color-primary` text, `text-decoration: underline` on `:hover` + `:focus-visible`.
- `muted` — `--lv-color-muted-fg` text, underline on hover.
- `destructive` — `--lv-color-destructive` text, underline on hover.
- `ghost` — inherits text color (`currentColor`), underline on `:hover` + `:focus-visible` only
  (no color change; fits inside body copy without visual loudness).

**Sizes**:
- `inherit` (default) — no `font-size` emitted; inherits from the parent. Correct for inline use.
- `sm` / `md` / `lg` — explicit `--lv-text-{xs,sm,base}`, for standalone link blocks.

**States**:
- `:hover` — underline (all non-ghost variants also intensify color slightly via Tailwind `hover:` opacity).
- `:focus-visible` — `--lv-ring` outline (same ring token as `button`/`input`), consistent.
- `disabled` — `aria-disabled="true"`, no `href`, `opacity-50`, `cursor-not-allowed`, no underline on hover.
- `external=true` — trailing icon (`aria-hidden`), visually-hidden "(opens in new tab)" `<span>`.
- `data-variant`, `data-size` on the root `<a>` for styling hooks + test targets.

---

## 4. The a11y contract (the heart — non-negotiable, fully specified)

### 4.a `item`

**WAI-ARIA pattern**: platform-native element semantics only. No ARIA role added.
The `element` param selects the correct semantic element for the context:
- `<li>` inside a `<ul>`/`<ol>` → role `listitem` (platform).
- `<dt>` inside a `<dl>` → role `term` (platform).
- `<dd>` inside a `<dl>` → role `definition` (platform).
- `<div>` → no implicit role (correct for non-list contexts such as a free-layout sidebar section).

**Roles + ARIA**:
- The item partial itself emits NO explicit `role`, NO `aria-selected`, NO `aria-current`.
  These states belong to the consuming template, which knows the server-side truth (e.g. whether
  this nav item matches the current URL). The consuming template emits `aria-current="page"` on
  the `<a>` inside `content`, or `aria-selected="true"` on the item if it is a `role=option` in
  a listbox. The item partial is the SKIN, not the semantic owner.
- Exception: when `disabled=true`, the item partial adds `aria-disabled="true"` only if the
  root element has an interactive role (never on `<li>` or `<dd>`, which are not interactive).
  In practice the `disabled` flag is visual only; the consuming template handles disabled links.
- `data-slot="item"` on the root for test targeting.

**Keyboard interaction**:
| key | does | who |
|---|---|---|
| Tab | moves focus to / from focusable elements INSIDE the item (`content` slot) | platform |
| Enter / Space | activates the interactive element inside `content` | platform (native `<a>` or `<button>` inside) |

No non-platform keyboard behavior. The item partial renders a layout scaffold; the interactive
element inside `content` owns its own keyboard contract.

**Focus management**: platform. No trap, no roving, no focus-ring on the item root itself.
The focus ring is on the focusable element inside `content`.

**Live region**: none.

**Shared mechanism composed**: none. Platform-only semantics.

**APG citation**: no specific APG interactive pattern applies (non-interactive container).
Native HTML element semantics are authoritative: https://html.spec.whatwg.org/multipage/grouping-content.html#the-li-element

### 4.b `kbd`

**WAI-ARIA pattern**: platform. The HTML `<kbd>` element carries its own semantics per the HTML
Living Standard: it "represents user input (typically keyboard input, although it may also be used
to represent other input, such as voice commands)". Assistive technology announces it as keyboard
input. No ARIA role is added.

**Roles + ARIA**:
- Outer `<kbd>` element: HTML implicit role — `generic` in the ARIA in HTML mapping. Screen readers
  may read the text content and convey it as typed/code content depending on their heuristics.
  This is the correct and idiomatic treatment.
- `aria-label` on the outer `<kbd>` when `ariaLabel` is set: overrides the announced text for
  symbolic keys (e.g. the `⌘` glyph → `aria-label="Command"`). Used sparingly; only when the
  visual symbol is genuinely ambiguous to a screen reader user.
- Chord rendering: outer `<kbd>` wrapping inner `<kbd>` per key — the HTML spec nesting model.
  This tells AT that the content is a compound keyboard sequence, not arbitrary text.
- `data-slot="kbd"` on the root; `data-size` for test targeting.

**Keyboard interaction**:
| key | does | who |
|---|---|---|
| (none) | `<kbd>` is a non-interactive display element; it is NOT focusable | — |

A `<kbd>` is never in the tab order. If a keyboard shortcut hint must be discoverable by keyboard
users, the surrounding text (e.g. "Press ⌘ K to open search") provides the context.

**Focus management**: none. Non-interactive.

**Live region**: none.

**Shared mechanism composed**: none.

**HTML spec citation**: https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-kbd-element

### 4.c `link`

**WAI-ARIA pattern**: APG Link (`https://www.w3.org/WAI/ARIA/apg/patterns/link/`).
The APG states: "authors are strongly encouraged to use a native host language link element, such
as an HTML `<a>` element." This partial ALWAYS renders a native `<a>`, so the platform supplies
`role=link`, Enter-to-activate, right-click context menu, tab order, and copy-URL — none of which
a `div[role=link]` gets for free. `role="link"` is never added manually; the `<a>` carries it.

**Roles + ARIA**:
- `<a href>`: implicit role `link` (platform, no manual role).
- Accessible name: computed from child text content (the `content` slot). Override with
  `ariaLabel` → `aria-label` on the `<a>` (required for icon-only links where `content` is an
  `<svg>`/`<icon>` with no text).
- `aria-disabled="true"` when `disabled=true` (native `disabled` does not exist on `<a>`);
  `href` is removed so the element loses native activation but stays in the tab order (AT announces
  it as a disabled link).
- External: no extra ARIA role. The visually-hidden `<span class="sr-only">(opens in new tab)</span>`
  is the screen-reader signal; it is part of the text content (appended after `content`), so AT
  reads it naturally without needing `aria-label` to duplicate it.
- `target="_blank" rel="noopener noreferrer"` on external links (security: `noopener`; privacy:
  `noreferrer`; both are required together per OWASP and the HTML spec).
- `data-slot="link"` on the root; `data-variant`, `data-size` for test targeting.

**Keyboard interaction** (APG Link, `https://www.w3.org/WAI/ARIA/apg/patterns/link/`):
| key | does | who |
|---|---|---|
| Tab | moves focus to the link | platform |
| Shift + Tab | moves focus away from the link | platform |
| Enter | activates the link (navigates to `href` or fires the wire action in `attrs`) | platform (native `<a>`) |
| (context) Shift + F10 | opens the browser context menu (copy link, open in new tab, etc.) | platform (native `<a>`) |

No non-platform keyboard behavior. Enter-to-activate is supplied by the native `<a>` element;
Space does NOT activate a link (it activates buttons; this distinction matters for AT users).
If wire behavior is needed (`l:click`), it is added via `attrs` by the consuming template; the
platform still handles Enter for the plain-navigation case.

**Focus management**: platform. `:focus-visible` ring via `--lv-ring` (consistent with
`button`/`input`). No trap, no roving.

**Live region**: none.

**Shared mechanism composed**: none. Platform `<a>` is the entire keyboard + focus solution.

**APG URL cited**: `https://www.w3.org/WAI/ARIA/apg/patterns/link/`

---

## 5. Design tokens

### 5.a Tokens consumed by `item`

| token | used for |
|---|---|
| `--lv-color-fg` | default label text |
| `--lv-color-muted-fg` | `muted` variant label; secondary meta text (trailing) |
| `--lv-color-accent` | `active` variant background |
| `--lv-color-accent-fg` | `active` variant label |
| `--lv-color-destructive` | `danger` variant label + hover bg tint |
| `--lv-color-destructive-fg` | `danger` variant hover label (on colored bg) |
| `--lv-space-8` | `sm` min-height (32px) |
| `--lv-space-9` | `md` min-height (36px, default) |
| `--lv-space-10` | `lg` min-height (40px) |
| `--lv-space-3` | horizontal padding left/right |
| `--lv-space-4` | `leading`/`trailing` icon container size (sm) |
| `--lv-space-5` | `leading`/`trailing` icon container size (md/lg) |
| `--lv-space-2` | gap between leading / label / trailing |
| `--lv-text-xs` | `sm` label text size |
| `--lv-text-sm` | `md` label text size (default) |
| `--lv-text-base` | `lg` label text size |
| `--lv-radius-md` | hover background rounding |
| `--lv-font-sans` | label typeface |

**NET-NEW tokens**: none. The `item` variant surface maps directly to existing `accent`, `muted`,
`destructive`, and `fg` token families.

### 5.b Tokens consumed by `kbd`

| token | used for |
|---|---|
| `--lv-color-muted` | key cap background (the neutral inset look) |
| `--lv-color-muted-fg` | key cap text |
| `--lv-color-border` | key cap border (1px, all sides) |
| `--lv-radius-sm` | key cap corner rounding |
| `--lv-shadow-xs` | subtle key-cap depth (bottom border–shadow) |
| `--lv-text-xs` | `sm` key text |
| `--lv-text-sm` | `md` key text (default) |
| `--lv-text-base` | `lg` key text |
| `--lv-space-1` | vertical padding |
| `--lv-space-2` | horizontal padding sm/md |
| `--lv-space-3` | horizontal padding lg |
| `--lv-space-1` | gap between inner `<kbd>` elements in a chord |
| `--lv-font-mono` | monospace typeface (key caps read better in mono) |

**NET-NEW tokens**: `--lv-font-mono` — a monospace font stack token. Justified: key cap glyphs
(symbols, letters) are visually more consistent and legible in monospace; `--lv-font-sans` is
too variable across typefaces for the compact cap context. This token goes in `:root` (defaulting
to a system-mono stack: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`) and
in the `.dark, [data-theme="dark"]` block (structural token — no colour, so no dark-mode value
needed). Additive, justified, no existing token covers this.

### 5.c Tokens consumed by `link`

| token | used for |
|---|---|
| `--lv-color-primary` | `default` variant text color |
| `--lv-color-muted-fg` | `muted` variant text color |
| `--lv-color-destructive` | `destructive` variant text color |
| `--lv-color-fg` | `ghost` variant — inherits surrounding text (via `currentColor`) |
| `--lv-ring` | `:focus-visible` outline (the shared ring, same as `button`) |
| `--lv-text-xs` | `sm` explicit size |
| `--lv-text-sm` | `md` explicit size |
| `--lv-text-base` | `lg` explicit size |
| `--lv-font-sans` | typeface (when size is explicit; inherit otherwise) |

**NET-NEW tokens**: none. The link variant surface maps to existing `primary`, `muted-fg`,
`destructive`, `fg`, and `ring` tokens.

---

## 6. Wire / island integration

All three partials are STATIC — no enhancer, no wire round-trip of their own.
They are leaves that consuming WIRE templates render and wire from the outside.

### 6.a `item`

**Server-rendered JTE structure**:
```
<{element}                              <!-- li | dd | dt | div -->
  data-slot="item"
  data-variant="{variant}"
  data-size="{size}"
  class="{sizeClasses} {variantClasses} {disabledClasses} {cssClass}"
  ${attrs}
  data-* (from dataAttrs, escaped)
>
  @if(leading != null)
    <span data-slot="item-leading" aria-hidden="true">
      @template.content(leading)
    </span>
  @endif
  <span data-slot="item-content" class="...flex-1 truncate...">
    @template.content(content)
  </span>
  @if(trailing != null)
    <span data-slot="item-trailing" aria-hidden="true">
      @template.content(trailing)
    </span>
  @endif
</{element}>
```

`leading` and `trailing` slots are `aria-hidden="true"` because they carry decorative icons /
badge counts; their meaning is conveyed by the label in `content`. If a trailing slot carries
meaningful info (e.g. an unread count badge), the consuming template must add a visually-hidden
span inside `content` or use `aria-label` on the count element itself.

**Enhancer**: none. The item is a static scaffold.

**Consuming template wiring pattern** (illustrative, not part of this spec):
```jte
@template.lievit.item(
  element="li",
  variant="${isCurrentPage ? "active" : "default"}",
  attrs="aria-current=\"${isCurrentPage ? "page" : "false"}\"",
  leading=@`@template.lievit.icon(name="home", size="sm")`,
  content=@`<a href="/dashboard" class="flex-1">Dashboard</a>`
)
```
The `<a>` inside `content` gets the platform keyboard contract; the `item` partial is only the row skin.

### 6.b `kbd`

**Server-rendered JTE structure**:

Single key:
```
<kbd
  data-slot="kbd"
  data-size="{size}"
  class="{sizeClasses} {cssClass}"
  ${attrs}
  @if(ariaLabel != null) aria-label="${ariaLabel}"@endif
>
  {keys[0]}
</kbd>
```

Chord (multiple keys):
```
<kbd
  data-slot="kbd"
  data-size="{size}"
  class="{sizeClasses} {cssClass}"
  ${attrs}
  @if(ariaLabel != null) aria-label="${ariaLabel}"@endif
>
  @for(String key : keys)
    <kbd class="{innerKbdClasses}">${key}</kbd>
    @if(!keyList.isLast()) <span aria-hidden="true" class="kbd-sep"> </span>@endif
  @endfor
</kbd>
```

The separator `<span aria-hidden="true">` renders a visual `+` or thin space between keys without
inserting extra text into the accessible name (the outer `aria-label`, or the concatenated text
content of inner `<kbd>` elements, is what AT reads).

**Enhancer**: none.

### 6.c `link`

**Server-rendered JTE structure**:
```
<a
  href="${disabled ? null : href}"
  data-slot="link"
  data-variant="{variant}"
  data-size="{size}"
  class="{variantClasses} {sizeClasses} {disabledClasses} {cssClass}"
  @if(disabled) aria-disabled="true"@endif
  @if(external) target="_blank" rel="noopener noreferrer"@endif
  @if(download != null) download="${download}"@endif
  @if(ariaLabel != null) aria-label="${ariaLabel}"@endif
  ${attrs}
  data-* (from dataAttrs, escaped)
>
  @template.content(content)
  @if(external)
    <span class="sr-only">(opens in new tab)</span>
    <span aria-hidden="true" class="{externalIconClasses}">↗</span>
  @endif
</a>
```

`href` is rendered as a null-drop (omitted) when disabled, so the element stays an `<a>` without
a destination. The `attrs` param carries any `l:click="action"` or Turbo Drive attributes wired
by the consuming template; the partial does not know and does not care about wire directives.

**Enhancer**: none. The `<a>` handles everything via the platform.

---

## 7. Acceptance tests (the gate — refute-by-default)

### 7.a `item` tests

- **render — element param** (jsdom): `element="li"` renders `<li>`; `element="dd"` renders `<dd>`;
  `element="div"` renders `<div>`. `data-slot="item"`, `data-variant`, `data-size` present on root.
- **render — slots** (jsdom): with all three slots set, `data-slot="item-leading"`,
  `data-slot="item-content"`, `data-slot="item-trailing"` are each present and contain the slot content.
  Without `leading`/`trailing`, those spans are absent from the DOM.
- **render — disabled** (jsdom): `disabled=true` adds the disabled utility classes; the item root
  carries NO `aria-disabled` (it is a non-interactive element). The consuming template's inner `<a>`
  would carry `aria-disabled` — that is outside item's contract.
- **render — variant classes** (jsdom): each of the four variants (`default`, `active`, `danger`,
  `muted`) emits distinct CSS class tokens referencing the correct `--lv-*` token names. No literal
  color values in the output.
- **render — size classes** (jsdom): `sm`/`md`/`lg` each emit the correct min-height token class.
- **axe-core** (jsdom): zero violations on a rendered `<ul><li>` item; zero violations on a `<dl><dt>/<dd>` item.
  Assert no improper ARIA (no `role`, no `aria-selected`, no `aria-disabled` on the static container).
- **escaping** (jsdom, XSS abuse): `dataAttrs={"id": "\"onmouseover=\"alert(1)"}` renders the value
  HTML-escaped, inert; the `attrs` param is documented trusted-only and asserted not to be fed
  the hostile string.
- **JTE compiles + renders**: covered by `test/jte-compile` real-compiler gate.

### 7.b `kbd` tests

- **render — single key** (jsdom): `keys=["⌘"]` renders one `<kbd data-slot="kbd">⌘</kbd>` with
  no inner children; `data-size` present.
- **render — chord** (jsdom): `keys=["⌘", "K"]` renders an outer `<kbd>` wrapping two inner `<kbd>`
  elements (one per key). The separator `<span>` is `aria-hidden="true"`. The outer `<kbd>` text
  content (via `innerText`) is `⌘ K` (the chord readable as a string).
- **render — ariaLabel** (jsdom): when `ariaLabel="Command K"`, the outer `<kbd>` has
  `aria-label="Command K"` and the raw symbol is still in the visual content. When `ariaLabel=null`,
  no `aria-label` attribute is present.
- **render — size** (jsdom): each size (`sm`/`md`/`lg`) emits distinct font-size and padding token
  class names; no literal pixel values.
- **axe-core** (jsdom): zero violations on a rendered `<kbd>`; the `<kbd>` element has an
  accessible name (either from text content or `ariaLabel`).
- **not-focusable** (jsdom): the rendered `<kbd>` element has no `tabindex` attribute and is not
  part of the document's focusable element sequence.
- **JTE compiles + renders**: covered by `test/jte-compile`.

### 7.c `link` tests

- **render — default** (jsdom): renders `<a href="/foo" data-slot="link">` with correct
  `data-variant="default"` and `data-size="inherit"`. `content` is projected inside the `<a>`.
  No `aria-disabled`, no `target`, no `rel` on a plain internal link.
- **render — external** (jsdom): `external=true` adds `target="_blank"`, `rel="noopener noreferrer"`,
  the visually-hidden `<span class="sr-only">(opens in new tab)</span>` is present inside the `<a>`,
  and the trailing icon `<span aria-hidden="true">` is present.
- **render — disabled** (jsdom): `disabled=true` → `aria-disabled="true"` on the `<a>`, `href`
  attribute is ABSENT (null-dropped), disabled class is present. The element is still rendered as
  `<a>` (not a `<span>`).
- **render — ariaLabel** (jsdom): `ariaLabel="Edit profile"` → `aria-label="Edit profile"` on
  the `<a>`. When null, no `aria-label` attribute present.
- **render — download** (jsdom): `download="report.pdf"` → `download="report.pdf"` on the `<a>`.
  `download=""` → `download=""`.
- **render — variant classes** (jsdom): each of the four variants emits the correct token-referencing
  color utility class. No literal `oklch(...)` or hex values in the output.
- **axe-core** (jsdom): zero violations. An icon-only link (`content` = `<svg>`) WITHOUT `ariaLabel`
  FAILS the accessible-name check (asserts the rule fires — this is the guard against silent
  accessible-name omission, mirroring the `button` `iconOnly` rule).
- **keyboard** (jsdom + userEvent): Tab moves focus to the link; Enter fires the `click` event
  (platform native); Space does NOT fire the `click` event on the `<a>` (Space scrolls the page —
  the key behavioral distinction between link and button that AT users rely on).
- **disabled keyboard** (jsdom): `disabled=true` → the `<a>` has no `href`; Enter does NOT navigate
  (no click event on an `<a>` without `href`); the element is still focusable via Tab (not removed
  from the tab order).
- **focus** (jsdom): `:focus-visible` ring class is applied on keyboard-focus (assert the token
  class referencing `--lv-ring` is present; the actual CSS rendering is a visual contract not a
  jsdom assertion).
- **escaping** (jsdom, XSS abuse): `dataAttrs={"track": "\"onmouseover=\"alert(1)"}` renders the
  value HTML-escaped, inert. `href` is a TRUSTED author-supplied string (template author is
  responsible; never fed raw user input directly to `href`).
- **JTE compiles + renders**: covered by `test/jte-compile`.

---

## 8. Non-goals / anti-patterns

### What these components deliberately do NOT do

**`item`**:
- Does NOT render its own interactive element (`<a>`, `<button>`). The item is a row scaffold;
  the link or button is in the `content` slot, owned by the consuming template.
- Does NOT manage `aria-selected`, `aria-current`, or `aria-expanded`. Those states belong to the
  consuming template, which has the server-side truth (current URL, selection state, disclosure state).
- Does NOT wrap a `<ul>` or `<ol>` around itself. The consuming template owns the list container.
- Does NOT hard-code option lists, navigation labels, or any data inside the partial. All data
  arrives via `@param` from the controller (the "no data in a partial" rule, architecture contract §3.2).
- Is NOT a menu item (`role=menuitem`). Use `dropdown-menu` (which renders its own item rows) for
  menus; `item` is for list and description-list contexts.

**`kbd`**:
- Does NOT render a `<button>` or anything interactive. It is a typographic annotation; activation
  of the keyboard shortcut is the user's business (the partial just displays the key name).
- Does NOT compute the shortcut for the current OS (⌃ vs ⌘). The consumer passes the correct
  key strings for the platform; the partial renders what it receives.
- Does NOT carry `tabindex` or any focus behavior. A `<kbd>` is never a focus target.
- Does NOT use `<code>` as the element. `<kbd>` is the correct semantic choice per the HTML Living
  Standard for keyboard input representation.

**`link`**:
- Does NOT render `<button>`. A control that triggers an action on the CURRENT page is a `<button>`,
  not a link. A link navigates. If a wire action is the intent, the consuming template adds
  `l:click="action"` in `attrs`; the `<a>` with an `href` still provides the plain-navigation
  fallback.
- Does NOT use `role="link"` on a non-anchor element. The APG is unambiguous: use `<a href>`.
  There is no legitimate use case in lievit for a `div[role=link]`.
- Does NOT manage Turbo Drive or SPA navigation logic. Turbo Drive intercepts all `<a href>` clicks
  at the document level; this partial does nothing extra for it.
- Does NOT render the external icon using an `<img>` or a full `@template.lievit.icon(...)` component
  call. It uses an inline Unicode/SVG glyph character inside a `<span aria-hidden="true">` — the
  partial must not create a dependency on the `icon` partial just for a trailing arrow.
- Does NOT suppress `rel="noopener noreferrer"` for performance or any other reason on external links.
  The security requirement is unconditional.
- Does NOT set `aria-label` to duplicate the `content` text. `aria-label` is only for icon-only
  links where the text content is non-descriptive. Duplicating visible text in `aria-label` causes
  double-reading by AT.

---

## 9. Agent instructions

Generate ORIGINAL code over `--lv-*`; you may read the HTML Living Standard (`<kbd>`, `<a>`,
`<li>`, `<dt>`, `<dd>`), the WAI-ARIA APG Link pattern, Ant Design Typography, and Tailwind UI
visual treatment as references for PATTERN and LOOK; NEVER paste literal source from any of them
(the one bright line, `02-licensing.md`).

Mirror `button.jte`'s house conventions exactly: header doc-comment with the labelled sections
(including the STRUCTURE citation to the APG/HTML spec + the credits line), typed `@param` with
defaults, `data-slot` on every root element, the two escaping channels (`attrs` trusted-raw vs
`dataAttrs` SAFE escaped), zero `<script>`, zero inline `on*=`.

Implement all three partials in their own `.jte` files (`item.jte`, `kbd.jte`, `link.jte`).
They are co-specified here (they share a tier + a build concern) but are SEPARATE templates.

The chord rendering in `kbd.jte` MUST use the HTML spec nesting model (outer `<kbd>` wrapping
inner `<kbd>` per key), not a `<span>`-based layout with a `+` separator as the only separator.

The `link.jte` MUST null-drop `href` when `disabled=true` (emit no `href` attribute at all,
not `href=""` or `href="#"`). A blank or hash href is navigable; a disabled link must not be.

The `item.jte` MUST use a JTE local variable (`!{var elementTag = element}`) to select the root
tag dynamically rather than if/else branching for each element variant — the tag name is the
only thing that changes per variant.

Minimal code to GREEN against the acceptance tests in §7; refactor only while green.
The net-new `--lv-font-mono` token MUST be added to `:root` in `registry/tokens/lievit-tokens.css`
alongside the implementation (additive, structural token, no dark-mode value needed).
