<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — empty

- **tier**: PARTIAL
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of `registry/jte/empty.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: no WAI-ARIA APG pattern applies (purely presentational display; `aria-label` on the root
      `<div>` makes the region discoverable; no keyboard interaction, no composite widget)
    - inventory: Ant Design Empty as inventory reference (image/icon, title, description, action slot,
      size variants); the AD `simpleImage` preset maps to `icon-only` here
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A full-width placeholder displayed when a surface has no data to show — an empty list, an empty search
result, an empty inbox, an empty file tree. Its single job is to communicate "there is nothing here yet"
in a way that is immediately recognisable, on-brand, and optionally actionable (a "Create your first X"
button). It is purely presentational and holds no state: PARTIAL is the exact right tier. There is nothing
client about an empty state — the controller already knows the list is empty, so the server renders this
template in place of the list, and the client morphs it away when items appear. Server-first works
trivially: the switch between the empty partial and the populated list is a normal JTE conditional on the
controller's model.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| variant | String | "default" | INTENT: `default` \| `search` \| `error` \| `offline` — drives the default icon and the title/description copy when no override is given; does NOT change colour dramatically, only the illustration and the implied copy direction |
| size | String | "md" | `sm` \| `md` \| `lg` — scales the illustration, title, and description proportionally; sm fits inside a table cell or a combobox listbox; lg fills a full-page blank-slate |
| title | String | null | primary message; when null, a locale-default per `variant` is used (the controller supplies it from its own message source — the partial NEVER bakes in literal copy) |
| description | String | null | secondary explanatory text; when null, omitted entirely |
| imageUrl | String | null | URL of a custom illustration; when set, overrides the default icon; **SAFE**: rendered as `src` in an `<img>`, the URL is HTML-attribute-escaped via `dataAttrs` |
| imageAlt | String | "" | `alt` for the custom image; defaults to empty string (decorative) — the caller MUST set a meaningful value when the image carries semantic information |
| iconOnly | boolean | false | suppress the title and description, showing only the illustration (useful inside small containers such as a combobox empty state) |
| cssClass | String | "" | extra utility classes on the root element |
| attrs | String | "" | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `id="empty-search"`, ARIA attributes the caller needs to impose from outside) |
| dataAttrs | Map<String,String> | {} | **SAFE escaped** dynamic `data-*` (each value through `Escape.htmlAttribute`) |
| action | gg.jte.Content | null | optional CTA slot; typically a single `@template.lievit.button(...)` ("Add item", "Retry", "Go back"); when null, the slot is omitted |
| image | gg.jte.Content | null | alternative to `imageUrl`: a fully custom illustration slot (a `@template.lievit.icon`, an inline SVG wrapper, or a `<img>` the caller owns); when set, takes precedence over `imageUrl` and the default icon |

**Escaping channels**:
- `attrs` = TRUSTED raw (`$unsafe`): static author-typed strings only (ARIA override attributes, IDs).
  Never feed per-row or DB-derived values through `attrs`.
- `dataAttrs` = SAFE escaped: each value HTML-attribute-escaped; use for any dynamic data the controller
  wants to stamp on the root (e.g. `data-variant`, `data-context`).
- `imageUrl` is rendered as an HTML attribute value and MUST be routed through the escaped channel
  (`dataAttrs`), never concatenated into `attrs`.

## 3. Variants / Sizes / States

### Variants (intent, not colour)

| variant | default icon | implied semantic |
|---|---|---|
| `default` | `inbox` or `box` (Lucide) | generic "no data yet" |
| `search` | `search-x` or `file-search` (Lucide) | "no results for your query" |
| `error` | `triangle-alert` (Lucide) | "something went wrong fetching the data" |
| `offline` | `wifi-off` (Lucide) | "connection unavailable, try again" |

The `variant` drives which icon is shown when neither `imageUrl` nor the `image` slot are set.
It does NOT introduce separate colour schemes — the component uses the single `--lv-color-muted`
surface for all variants; the semantic distinction is entirely in the icon + the title/description
copy the controller supplies. If the caller needs a colour shift for `error` they add a `cssClass`
(the partial does not hard-code a colour exception per variant).

### Sizes

| size | illustration scale | title typography | description typography | min-height guidance |
|---|---|---|---|---|
| `sm` | `--lv-space-10` (40 px) icon or image | `--lv-text-sm`, `font-medium` | `--lv-text-xs` | fits inside a list body or combobox dropdown |
| `md` | `--lv-space-16` (64 px) icon / image capped at 96 px | `--lv-text-base`, `font-medium` | `--lv-text-sm` | default; inline section empty-state |
| `lg` | `--lv-space-24` (96 px) icon / image capped at 160 px | `--lv-text-lg`, `font-semibold` | `--lv-text-base` | full-page blank-slate |

The `sm` mode + `iconOnly=true` combination is the canonical empty state inside small containers (an
empty combobox listbox, an empty `select` panel): illustration only, zero text.

### States

The component is purely static — it has no interactive states of its own. The caller decides whether
it is visible by rendering it conditionally; the morph will replace it when data arrives. There is no
`disabled`, no `hover`, no `aria-busy` state on the empty component itself.

The `action` slot may contain a `button` that carries its own hover/focus/disabled states per the
button spec; those belong to the button, not the empty component.

## 4. Accessibility

- **WAI-ARIA pattern**: none. The `empty` component is a presentational region with no interactive role
  and no composite widget behavior. There is no APG pattern for an empty-state placeholder.
  Reference consulted: https://www.w3.org/WAI/ARIA/apg/patterns/ (no applicable pattern found; the
  component is a static region whose a11y contract is fully covered by native semantics + the rules
  below).

- **roles + ARIA**:
    - Root element: plain `<div>` — no `role` override needed; the element is presentational.
    - The root receives `aria-label` when the controller sets it via `attrs` (e.g. for a section whose
      label is otherwise not adjacent in the DOM). The partial does NOT auto-generate an `aria-label`
      from `title` — that would duplicate text already present visually; the caller opts in explicitly.
    - `aria-hidden="true"` on the illustration element (icon or `<img>`) when the image is purely
      decorative (the default: `imageAlt=""` or `iconOnly=true`). When `imageAlt` is non-empty the
      `aria-hidden` is dropped and the `alt` attribute carries the accessible description.
    - The `title` text is wrapped in a heading only if the caller requires it — the partial defaults to
      a `<p>` for the title (it is a label, not a page section heading). If the surrounding context
      makes a heading semantically correct, the caller passes a heading element via the `image` slot or
      overrides with `cssClass`. The partial deliberately does NOT hardcode `<h3>` to avoid heading
      hierarchy violations.
    - The `description` text is a `<p>`.
    - The `action` slot renders its content as-is; the contained button carries its own `role=button`
      and accessible name.

- **Keyboard map**:
  | key | does | who |
  |---|---|---|
  | Tab | moves focus into and out of the `action` slot button (if present); skips the illustration and the text entirely (non-focusable) | platform (native button/link inside the action slot) |

  No other keyboard interaction exists. The illustration, title, and description are not interactive.
  There is no roving tabindex, no listbox, no composite widget.

- **Focus management**: platform-only. The `action` slot button participates in the normal Tab order of
  the page. No trap, no initial-focus management, no focus restore — the empty component is not an
  overlay. The illustration and text paragraphs are not focusable (`tabindex` is never set on them).

- **Screen-reader expectations**:
    - The title and description are read in document order as plain text; no announcement is triggered.
    - A screen reader does NOT need to visit the illustration when `aria-hidden="true"` (the default
      decorative case). When `imageAlt` is non-empty the alt text is announced as part of the
      illustration `<img>`.
    - The `action` slot button is announced with its own accessible name (the button spec rule: the
      label text or `aria-label` for icon-only). The empty component does not impose any `aria-*`
      on the slot content.

- **Live region**: none. The empty state itself is not a dynamic announcement. The surrounding list or
  table controller may announce "0 results" via its own live region; that is the caller's concern.

- **Shared mechanisms composed**: none. This component is the simplest possible presentational surface.
  It does not compose the popover seam, focus-trap, collection-nav, or announcer. Any action button
  inside the `action` slot is a `button` partial, which composes nothing of its own either.

## 5. Tokens

The empty component reads the following `--lv-*` tokens. All colour tokens are authored in OKLCH
(the source-of-truth format, `00-architecture-contract.md` §4).

| token | used for |
|---|---|
| `--lv-color-muted` | illustration container background tint (subtle, optional) |
| `--lv-color-muted-fg` | icon fill + title text colour + description text colour (muted, not full-contrast) |
| `--lv-color-fg` | title text when a higher-contrast title is needed (the `lg` size variant may use this) |
| `--lv-space-2` | gap between icon and title (`sm`) |
| `--lv-space-3` | gap between icon and title (`md`), gap between title and description |
| `--lv-space-4` | gap between icon and title (`lg`), gap between description and action button |
| `--lv-space-6` | vertical padding around the illustration + text block inside the root |
| `--lv-space-8` | icon size at `sm` (32 px) |
| `--lv-space-10` | icon size at `md` (40 px) |
| `--lv-space-16` | icon size at `lg` (64 px); image max-width multiplied at each size |
| `--lv-text-xs` | description at `sm`, label at `sm` when `iconOnly=false` |
| `--lv-text-sm` | description at `md`, title at `sm` |
| `--lv-text-base` | description at `lg`, title at `md` |
| `--lv-text-lg` | title at `lg` |
| `--lv-font-sans` | all text |
| `--lv-font-medium` | title weight at `sm`/`md` |
| `--lv-font-semibold` | title weight at `lg` |

**NET-NEW tokens**: none. The existing muted surface + muted-fg pair already supplies the right visual
register for an empty state (subdued, non-alarming). No new dark-mode rule is needed: `--lv-color-muted`
and `--lv-color-muted-fg` are already in the dark re-point block and will invert correctly.

## 6. Wire / island integration

**Static, no enhancer.** This is a PARTIAL with no client state and no interaction to enhance.

The JTE template structure:

```
<div data-slot="empty" data-variant="${variant}" data-size="${size}" class="..." ${attrs}>
  <!-- illustration: custom image slot, or imageUrl <img>, or default icon -->
  <div data-slot="empty-illustration" aria-hidden="[true if decorative]">
    @if(image != null)
      ${image}
    @elseif(imageUrl != null)
      <img src="${escapedImageUrl}" alt="${imageAlt}" class="...">
    @else
      @template.lievit.icon(name="${defaultIconForVariant}", size="${iconSize}", cssClass="...",
                             ariaHidden=true)
    @endif
  </div>
  <!-- text block, suppressed when iconOnly -->
  @if(!iconOnly)
    @if(title != null)
      <p data-slot="empty-title" class="...">${title}</p>
    @endif
    @if(description != null)
      <p data-slot="empty-description" class="...">${description}</p>
    @endif
  @endif
  <!-- action slot, suppressed when null -->
  @if(action != null)
    <div data-slot="empty-action" class="...">
      ${action}
    </div>
  @endif
</div>
```

**Data hooks**:
- `data-slot="empty"` on the root: the selector tests use this as the component boundary.
- `data-variant="${variant}"` on the root: styling hooks + test target for variant assertions.
- `data-size="${size}"` on the root: styling hooks + test target for size assertions.
- `data-slot="empty-illustration"`, `data-slot="empty-title"`, `data-slot="empty-description"`,
  `data-slot="empty-action"`: fine-grained test targets; adopters can also use them for scoped CSS.

**Escaping in the template**:
- `${attrs}` → `$unsafe` trusted raw (static author strings only).
- `imageUrl` → MUST be routed through `dataAttrs` as `data-src` if dynamic, or rendered via a
  `!{var escapedImageUrl = Escape.htmlAttribute(imageUrl)}` local and then used as `src="${escapedImageUrl}"`.
  It is NEVER spliced into `attrs`.
- `dataAttrs` map → each value through `Escape.htmlAttribute`, emitted as `data-<key>="<escaped-value>"`.

**Composing lievit partials**: the default icon is rendered via `@template.lievit.icon(...)` so the icon
inherits the icon partial's own a11y contract (`ariaHidden=true` for decorative use). The `action` slot
renders its content as opaque `gg.jte.Content`; the partial does not inspect or modify it.

No lievit runtime binding. No enhancer. No wire action. No `l:*` directive on any element. The morph
replaces the whole empty element when the containing WIRE component refreshes; the partial does nothing
to participate in that process.

## 7. Acceptance tests

The component is DONE only when ALL tests below pass on a REAL substrate.

### Render (jsdom, real JTE compilation via the `test/jte-compile` gate)

- **default render**: `@template.lievit.empty()` with no params compiles and renders; `data-slot="empty"`,
  `data-variant="default"`, `data-size="md"` are present on the root; the illustration element is present
  and `aria-hidden="true"`; the title `<p>` is absent (title=null, no default hardcoded); the action div is
  absent.
- **with title + description**: title="No items" + description="Create one to get started" → the title `<p>`
  contains "No items", the description `<p>` contains "Create one to get started", both present in DOM order
  (illustration → title → description).
- **action slot**: passing a rendered button partial as the `action` slot → `data-slot="empty-action"` is
  present and contains the button's root element.
- **iconOnly mode**: `iconOnly=true` → title `<p>` and description `<p>` are absent from the DOM; the action
  div is absent regardless of `action` param (iconOnly suppresses text + action).
- **custom imageUrl**: `imageUrl="https://example.com/empty.svg"` → an `<img>` is rendered inside
  `data-slot="empty-illustration"` with `src="https://example.com/empty.svg"` and `alt=""` (decorative
  default); `aria-hidden` is NOT on the `<img>` (the `alt=""` empty-string convention already marks it
  decorative to screen readers).
- **custom image slot**: `image` slot supplied (e.g. a custom SVG wrapper) → the `imageUrl` path and the
  default icon path are both skipped; only the slot content is inside `data-slot="empty-illustration"`.
- **non-empty imageAlt**: `imageAlt="A filing cabinet with no files"` + `imageUrl="..."` → `alt="A filing
  cabinet with no files"` on the `<img>`; `aria-hidden` is absent from the illustration wrapper (the image
  is semantic, not decorative).

### Variants and sizes

- **all variants render**: `default`, `search`, `error`, `offline` each set `data-variant` on the root to
  the matching string; each renders a DIFFERENT default icon name (assert the icon `name` attribute or the
  icon `data-slot` + a `data-name` stamp from the icon partial).
- **all sizes render**: `sm`, `md`, `lg` each set `data-size` on the root; the illustration container
  carries the size-appropriate token class (assert `data-slot="empty-illustration"` has the right utility
  class for the illustration size).
- **size `sm` + iconOnly**: the root renders, illustration is present, no title/description/action; the
  illustration carries the sm-size class.

### Accessibility (axe-core)

- **axe-core zero violations — default render**: run axe on the rendered `<div data-slot="empty">` subtree
  with `{ runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] }` → zero violations.
- **axe-core — with action button**: when an action button is present inside the `empty-action` slot, axe
  still returns zero violations; in particular the button has an accessible name (the button spec gate
  already enforces this, but the empty spec re-asserts it in context).
- **axe-core — with imageAlt**: when `imageAlt` is non-empty, axe confirms `img` has a non-empty `alt`
  and zero image-alt violations.
- **decorative image is not flagged**: when `imageAlt=""` (the default), axe does NOT flag the `<img>` as
  a violation because empty-string `alt` is the correct decorative idiom; assert the rule
  `image-alt` is `not-applicable` or `pass` (not `violation`).

### Keyboard

- **Tab skips non-interactive content**: render a full empty state (illustration + title + description + an
  action button); programmatically trigger Tab from outside the component; the focus lands ONLY on the
  action button (the next Tab skip takes focus past the entire component); the illustration `<div>` and
  title/description `<p>` elements receive no focus.
- **action button is reachable**: with an action button present, one Tab from the element before the empty
  state brings focus to the action button; a subsequent Tab moves focus out to the element after.
- **no interactive element, no stop**: render empty state with no `action` slot; Tab from the element
  before the component moves directly to the element after (the empty component is transparent to the tab
  order).

### Escaping (the XSS abuse-case)

- **dataAttrs are escaped**: `dataAttrs = {"context": "\">/><script>alert(1)</script>"}` → the rendered
  HTML contains `data-context="&quot;&gt;/&gt;&lt;script&gt;alert(1)&lt;/script&gt;"` (inert escaped
  string); the raw angle brackets and quotes do NOT appear unescaped.
- **imageUrl is escaped**: `imageUrl = "javascript:alert(1)"` → the rendered `src` attribute contains the
  escaped or rejected string; it does NOT form a live `javascript:` URI (the escaping via
  `Escape.htmlAttribute` defangs the colon and quotes).

### JTE compiles + renders

Covered by the `test/jte-compile` real-compiler gate that already exists for the whole partial registry.
The empty template must compile clean with JTE's real compiler (not a mock), emit valid HTML, and render
without throwing for all combinations of null/non-null optional params.

## 8. Non-goals / anti-patterns

- **No hardcoded copy inside the partial.** The partial does NOT embed default title/description strings
  such as "No data" or "Start by creating an item." Those are controller concerns: the controller knows
  the context (empty search, first-use, error state) and supplies the appropriate message from its own
  message source. A partial with hardcoded copy forces a fork for every localisation and every context.
  `title=null` means "render no title element", not "render a default".

- **Not an error message component.** The `error` variant communicates "no data because of an error" but
  is NOT a replacement for `alert` (inline form error) or `toast` (transient notification). If the data
  fetch failed with a recoverable error that the user should act on NOW, use `alert` and/or `toast`. The
  empty component is a blank-slate placeholder, not a diagnostic tool.

- **Not interactive itself.** The empty component holds no state, fires no wire action, registers no
  directive. Any interactivity lives in the `action` slot (a button or link the caller provides). If a
  caller finds themselves wanting to attach a `l:click` directly to the empty component's root, that is a
  sign the controller should render something OTHER than an empty state.

- **No heading element by default.** The partial does not emit `<h1>`, `<h2>`, or any heading for the
  title. Heading level is a page-structure decision that belongs to the caller, not to a presentational
  placeholder. The caller who needs a heading wraps the title via the `image` slot or a surrounding
  template region.

- **Not a full-page blank-slate layout component.** The `lg` size fills the available width and provides
  generous vertical padding, but the empty component does not control the page layout around it (column
  width, centering in a full viewport, nav rails). Layout wrappers, sections, and cards are separate
  components; the empty component is a leaf that lives inside them.

- **No client-side "show when list is empty" toggle.** Toggling between the list view and the empty state
  is a server-side conditional in the JTE template of the WIRE component that owns the list — not a CSS
  display trick managed by a TypeScript enhancer. The server renders the truth; the morph replaces the
  subtree.

- **No Ant Design `configProvider` / global preset substitution.** The Ant Design `Empty.PRESENTED_IMAGE_*`
  static override pattern (replacing the default image globally) has no analog here. Each call site passes
  its own `imageUrl` or `image` slot; a global default is a concern for the adopter's own JTE base
  template, not the library.

## 9. Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH) tokens. You MAY read Ant Design Empty as an inventory
reference for the variant/size set and the slot structure; you MUST NOT paste literal source from Ant
Design, shadcn, or Tailwind UI (the one bright line, `02-licensing.md`) — the output is always original
generation. Mirror `button.jte` house conventions exactly: header doc-comment with the labelled sections
(TIER, STRUCTURE, A11y, Params, Usage), typed `@param` with defaults, `data-slot` on the root and on
every named region, the two escaping channels (`attrs` trusted-raw vs `dataAttrs`/`imageUrl` safe-escaped),
zero `<script>`, zero inline `on*=`. The default icon per variant is selected via a `switch` in a local
computed string (`!{var defaultIcon = ...}`). Sizes are applied via a switch on the size param, emitting
the appropriate token class. Do not hardcode copy. Compose `@template.lievit.icon(...)` for the default
icon so the icon partial's own a11y contract is inherited. Minimal code to GREEN against the acceptance
tests above; the render + axe + escaping tests are the gate — assert ALL of them.
