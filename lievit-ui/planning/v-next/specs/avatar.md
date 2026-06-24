<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — avatar

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/avatar.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: no WAI-ARIA APG pattern for avatar as a standalone display element; the `<img>` with `alt`
      and the decorative `aria-hidden` path are both native-platform conventions, no react-aria reference
      needed. Interactive avatar (clickable link/button) composes the platform `<button>`/`<a>` pattern
      (APG Button) — same as the `button` partial. APG reference:
      https://www.w3.org/WAI/ARIA/apg/patterns/button/
    - inventory: Ant Design Avatar as inventory reference (image, initials, icon, sizes, shape,
      group/stack; interactive clickable; status badge overlay)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A circular (or square) frame that displays a person or entity: an image, initials derived from a name,
or a generic icon fallback. It is PURE DISPLAY with no selection or disclosure state, so it is a
PARTIAL — the frame is server-rendered to HTML and that is all. Server-first is trivially correct: the
`src`, `name`, and fallback are server-side facts (a `UserPrincipal`, an entity name) and there is
nothing to manage client-side. The group/stack variant (`avatar-group`) is a second micro-partial that
composes multiple `avatar` instances with a negative-margin overlap; the kit owns the backing data loop
and the count-overflow chip.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `src` | `String` | `null` | URL of the avatar image. When null or blank the partial falls back to `initials` then `icon`. |
| `name` | `String` | `null` | Full name or display name of the subject. Used to derive the initials fallback (first letters of the first two words, uppercased) AND as the `alt` text for the image when `alt` is not set explicitly. |
| `alt` | `String` | `null` | Explicit `alt` string for the `<img>`. When null, `name` is used. When empty string `""` (deliberate decorative use), renders as `alt=""` (presentational). |
| `initials` | `String` | `null` | Override the auto-derived initials. When set, takes precedence over the `name`-derived computation. |
| `icon` | `String` | `"user"` | Lucide icon slug rendered when both `src` and initials are absent. Pass `null` to suppress the icon fallback entirely (renders the `--lv-color-muted` background bare). |
| `size` | `String` | `"md"` | `xs` \| `sm` \| `md` \| `lg` \| `xl` \| `2xl` — controls the diameter; see §3. |
| `shape` | `String` | `"circle"` | `circle` \| `square` — circle maps to `--lv-radius-full`; square maps to `--lv-radius-md`. |
| `color` | `String` | `null` | Intent token for the initials/icon background: `default` \| `primary` \| `secondary` \| `success` \| `warning` \| `destructive` \| `accent`. When null the partial auto-assigns a stable color from the intent set by hashing `name` (or `initials`) so the same person always gets the same hue. |
| `status` | `String` | `null` | Optional online-status badge overlaid on the bottom-right corner: `online` \| `away` \| `busy` \| `offline`. Renders a small colored dot; null suppresses it. |
| `href` | `String` | `null` | When set, wraps the frame in an `<a href>` making the avatar a navigation link. |
| `hrefLabel` | `String` | `null` | `aria-label` for the link wrapper — REQUIRED when `href` is set and the image alt alone is not sufficient as a link accessible name (e.g. "View Francesco Bilotta's profile"). |
| `clickable` | `boolean` | `false` | When true and `href` is null, wraps the frame in a `<button>` (not a link — use `href` for navigation). The `name` is used as the button's `aria-label` unless `ariaLabel` overrides it. |
| `ariaLabel` | `String` | `null` | Explicit `aria-label` for the `<button>` wrapper (when `clickable=true`). Falls back to `name`. When neither is available and `clickable=true`, the impl MUST NOT render; the JTE should emit a dev-visible comment warning. |
| `ariaHidden` | `boolean` | `false` | When true, stamps `aria-hidden="true"` on the root element. Use when the avatar is decorative and adjacent text already identifies the person. |
| `cssClass` | `String` | `""` | Extra utility classes on the root element (the frame). |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `data-testid="avatar-ceo"`, `tabindex="-1"` for a container-managed focus pattern). Never fed DB-derived values. |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` attributes (value via `Escape.htmlAttribute`). Use for per-row wire args when an avatar appears in a list and the containing WIRE template wires a click action on it. |

## 3. Variants / sizes / states

### Fallback precedence (server-evaluated)

1. `src` present and non-blank → `<img>` with `alt`.
2. `initials` present, or `name` present (auto-derive two initials) → initials text in the color background.
3. `icon` slug present (default `"user"`) → `@template.lievit.icon` rendered in the color background.
4. All three absent → bare `--lv-color-muted` circle/square.

The fallback is computed server-side in a `!{var ...}` local so the JTE body never forks on client state.

### Sizes (diameter-based, not height-based — avatar is a square or circle, not a bar control)

| size | diameter token | font / icon size | status dot diameter |
|---|---|---|---|
| `xs` | `--lv-space-6` (24px) | `--lv-text-2xs` | 6px (no status rendered at xs — too small) |
| `sm` | `--lv-space-8` (32px) | `--lv-text-xs` | 8px |
| `md` | `--lv-space-10` (40px, default) | `--lv-text-sm` | 10px |
| `lg` | `--lv-space-12` (48px) | `--lv-text-base` | 12px |
| `xl` | `--lv-space-16` (64px) | `--lv-text-lg` | 14px |
| `2xl` | `--lv-space-20` (80px) | `--lv-text-xl` | 16px |

`data-size` is stamped on the root for test targeting and CSS hooks.

### Shape

`circle` → `border-radius: var(--lv-radius-full)`.
`square` → `border-radius: var(--lv-radius-md)`.
`data-shape` is stamped on the root.

### Color (background for initials / icon fallback)

When `color` is explicit, map the intent slug to the pair `--lv-color-<intent>` (background) /
`--lv-color-<intent>-fg` (text/icon).

When `color` is null, auto-assign by hashing the first characters of `name` (or `initials`) against
the intent set `[primary, secondary, accent, success, warning, destructive]` using a deterministic
modulo so the same string always yields the same intent. The hash runs server-side in a `!{var ...}`
local; no JS involved.

### Status badge

The status dot is an absolutely-positioned `<span aria-hidden="true">` at the bottom-right of the
frame, colored by status intent:

| status | color token |
|---|---|
| `online` | `--lv-color-success` |
| `away` | `--lv-color-warning` |
| `busy` | `--lv-color-destructive` |
| `offline` | `--lv-color-muted` |

The dot is `aria-hidden` because online-presence meaning is conveyed to screen readers by the surrounding
context (a user list's row label, a presence indicator with adjacent text), never by the dot alone.
If the consuming template needs to announce presence, it adds a visually-hidden `<span class="sr-only">`
OUTSIDE the avatar partial with the text — the avatar itself stays display-only.

### States

`disabled` is NOT a state on an avatar frame. If the avatar is wrapped in a `<button>` (`clickable=true`),
the `disabled` attribute must be applied by the consuming WIRE template on the wrapping button, not by
the avatar partial itself (the partial renders only the frame). The wrapping button inherits `disabled:`
Tailwind utilities and native disabled semantics (see `button` spec §3).

Focus-visible ring (`--lv-ring`) applies automatically to the `<button>` or `<a>` wrappers via native
`:focus-visible` — no extra avatar-specific logic.

The `<img>` inside the avatar has `loading="lazy"` by default, switchable via `attrs` if eager loading
is needed (`attrs="loading=\"eager\""`) — TRUSTED author-typed string, not user data.

### Avatar group (micro-partial: `avatar-group.jte`)

A second PARTIAL — `avatar-group` — renders a horizontal stack of `avatar` instances with a
configurable negative-margin overlap and an overflow chip ("+N more").

| param | type | default | meaning |
|---|---|---|---|
| `max` | `int` | `5` | Maximum avatars to render before collapsing into the overflow chip. |
| `size` | `String` | `"md"` | Propagated to every `avatar` instance inside. |
| `shape` | `String` | `"circle"` | Propagated to every `avatar` instance inside. |
| `overlap` | `String` | `"md"` | `sm` \| `md` \| `lg` — controls the negative margin between items (`--lv-space-2` / `--lv-space-3` / `--lv-space-4`). |
| `totalCount` | `int` | `0` | Total number of avatars in the logical set (used to compute the overflow number). When 0, no overflow chip is shown. |
| `content` | `gg.jte.Content` | — | The sequence of `@template.lievit.avatar(...)` calls, one per visible avatar. The kit's backing loop renders exactly `min(count, max)` and passes `totalCount` for the overflow chip. |

The overflow chip is a plain `<span>` styled as an avatar frame (same size/shape) with text `+N`
and `aria-hidden="true"` by default; the consuming template is responsible for providing adjacent text
context (`aria-label` or an `<li>` label on the group container) if the count matters for screen
reader users.

## 4. The a11y contract

- **WAI-ARIA pattern**: no dedicated APG pattern for a standalone display avatar. The accessible
  treatment derives from two platform rules:
    1. A meaningful image carries an `alt` text (`<img alt="Francesco Bilotta">`).
    2. A purely decorative image carries `alt=""` and does not need further annotation.
  When the avatar is wrapped in an interactive element (`<a>` or `<button>`), the APG Button pattern
  applies: https://www.w3.org/WAI/ARIA/apg/patterns/button/
- **roles + ARIA**:
    - `<img>` (when `src` present): `alt` from `alt` param, else `name`, else `""` (decorative).
    - initials / icon fallback: the frame is a `<span>` (display-only, no implicit role) with
      `aria-label="${name}"` when name is present and the avatar is non-interactive; if `ariaHidden=true`,
      the whole root gets `aria-hidden="true"` and the `aria-label` is suppressed.
    - `<a href>` wrapper: no explicit `role` (the `<a>` carries `role=link`); accessible name =
      `hrefLabel` if set, else the `alt` / `aria-label` of the inner frame (which bubbles up via
      the contained `<img alt>` or `aria-label` on the inner span).
    - `<button>` wrapper (clickable): no explicit `role` (native `<button>` carries `role=button`);
      accessible name = `ariaLabel` if set, else `name`.
    - status dot `<span>`: always `aria-hidden="true"`.
    - overflow chip `<span>` in avatar-group: `aria-hidden="true"` (count context comes from surrounding
      landmark / list label, not the chip).
    - `ariaHidden=true`: stamps `aria-hidden="true"` on the root element; suppresses `aria-label` /
      `alt` so screen readers skip the element entirely.

- **keyboard map**:

  | key | does | who |
  |---|---|---|
  | Tab | moves focus onto the `<button>` or `<a>` wrapper (only when `clickable=true` or `href` set) | platform |
  | Enter | activates the `<button>` (fires click) or follows the `<a>` | platform |
  | Space | activates the `<button>` | platform (native `<button>`) |

  When the avatar is non-interactive (pure display, no `href`, no `clickable`), it is NOT in the tab
  order and no keyboard interaction applies.

- **focus management**: entirely platform-managed. The `<button>` and `<a>` wrappers receive
  `:focus-visible` ring from the `--lv-ring` token via native CSS pseudo-class — no JS involved.
  No trap. No roving tabindex (a group of clickable avatars is a sequence of independent focusable
  elements, each tab-stopped; if the consuming template needs a roving tabindex group pattern, that
  is the consuming WIRE template's responsibility, not the avatar partial's).
- **live region**: none. The avatar never announces asynchronously.
- **shared mechanism composed**: none (platform-only). This is a pure display partial; the
  interactive wrappers defer entirely to the `<button>`/`<a>` native element semantics, exactly
  as the `button` partial does. No `focus-trap`, no `collection-nav`, no popover seam.

## 5. Tokens

Reads:

| token | usage |
|---|---|
| `--lv-space-6` | xs diameter (24px) |
| `--lv-space-8` | sm diameter (32px) |
| `--lv-space-10` | md diameter (40px, default) |
| `--lv-space-12` | lg diameter (48px) |
| `--lv-space-16` | xl diameter (64px) |
| `--lv-space-20` | 2xl diameter (80px) |
| `--lv-space-2`, `--lv-space-3`, `--lv-space-4` | avatar-group overlap negative-margin variants |
| `--lv-radius-full` | circle shape |
| `--lv-radius-md` | square shape |
| `--lv-color-primary` / `--lv-color-primary-fg` | primary intent background/text |
| `--lv-color-secondary` / `--lv-color-secondary-fg` | secondary intent |
| `--lv-color-accent` / `--lv-color-accent-fg` | accent intent |
| `--lv-color-success` / `--lv-color-success-fg` | success intent + online status dot |
| `--lv-color-warning` / `--lv-color-warning-fg` | warning intent + away status dot |
| `--lv-color-destructive` / `--lv-color-destructive-fg` | destructive intent + busy status dot |
| `--lv-color-muted` / `--lv-color-muted-fg` | default/offline intent + bare fallback background |
| `--lv-color-border` | thin ring border around the frame (always present, 1px, for contrast against same-color backgrounds) |
| `--lv-color-bg` | the avatar-group gap fill between overlapping frames (uses the page background to create the separation) |
| `--lv-ring` | focus-visible ring on interactive wrappers |
| `--lv-text-2xs`, `--lv-text-xs`, `--lv-text-sm`, `--lv-text-base`, `--lv-text-lg`, `--lv-text-xl` | initials font size per size tier |
| `--lv-font-sans` | initials typeface |
| `--lv-font-weight-medium` | initials weight (medium, not bold — avoids initials feeling heavy at small sizes) |
| `--lv-z-base` | status dot stacking (above the frame, no new z-level needed) |

**NET-NEW tokens**: none. The full size/color/shape vocabulary is covered by the existing v2 token set.
The `2xl` size maps to `--lv-space-20` which MUST be present in the token file; verify its existence
before implementation and add it as an additive structural token if missing (it is a straightforward
rung on the spacing scale, not a colour token, so dark-mode does not require a re-point).

## 6. Wire / island integration

**Static, no enhancer.**

The avatar partial is pure server-rendered markup. There is no client state to manage.

### Server-rendered JTE structure

Root element: `<span data-slot="avatar" data-size="${size}" data-shape="${shape}"` (plus optional
`data-variant="${resolvedColor}"` for test hooks) closing as a `<span>` when non-interactive, or
promoted to `<a href>` / `<button>` when `href` / `clickable` is set (see §2).

The body of the frame (one of four paths, computed server-side in `!{var ...}` locals):

```
<span data-slot="avatar" data-size="md" data-shape="circle" ...>
  <!-- path 1: image -->
  <img src="<src>" alt="<resolvedAlt>" loading="lazy" aria-hidden="<ariaHidden>">

  <!-- path 2: initials -->
  <span data-slot="avatar-initials" aria-hidden="true"><resolvedInitials></span>

  <!-- path 3: icon -->
  @template.lievit.icon(name = resolvedIcon, size = resolvedIconSize, ariaHidden = true)

  <!-- path 4: bare background — no inner element, just the styled frame -->

  <!-- status dot (when status != null and size != xs) -->
  <span data-slot="avatar-status" data-status="${status}" aria-hidden="true"></span>
</span>
```

When `ariaHidden=false` and the frame uses the initials or icon path (no `<img>`), the root `<span>`
carries `aria-label="${resolvedName}"` so screen readers get the accessible name even without an image.

When `ariaHidden=true`, the root carries `aria-hidden="true"` and the `aria-label` is suppressed; the
`<img alt>` (if present) is also set to `alt=""` so the image is treated as decorative.

The `<button>` / `<a>` wrapper (when `clickable=true` or `href` set) wraps the entire frame span.
The frame span inside the wrapper gets `aria-hidden="true"` (the wrapper carries the accessible name
via `aria-label` / `hrefLabel`, so the inner frame content must not be double-announced).

### data-* hooks consumed by the containing WIRE template

When `avatar` appears inside a repeating WIRE template (e.g. a user list), the containing template
passes per-row dynamic values via the SAFE `dataAttrs` channel — for example:

```java
dataAttrs = Map.of("user-id", Escape.htmlAttribute(row.userId()))
```

The avatar partial renders this as `data-user-id="<escaped>"` on the root, which the containing WIRE
template can wire via `l:click="selectUser" data-user-id="..."` on the wrapper. The avatar partial
itself is unaware of the action; it is only the styled frame.

### No enhancer responsibilities

There is no `avatar.enhancer.ts`. If an interactive avatar needs a tooltip on hover, the `tooltip`
partial is composed around it by the consuming template, not wired inside the avatar. If the frame
needs a lazy-load intersection observer for very long lists, that is the containing WIRE template or a
list-level enhancer, not the avatar partial — keeping the avatar PARTIAL tier clean.

## 7. Acceptance tests

- **render — image path** (jsdom): given `src="https://example.com/a.jpg"` and `name="Ada Lovelace"`,
  the rendered HTML contains `<img src="https://example.com/a.jpg" alt="Ada Lovelace" loading="lazy">`;
  `data-slot="avatar"`, `data-size="md"`, `data-shape="circle"` are present on the root.

- **render — initials path** (jsdom): given `src=null`, `name="Ada Lovelace"`, the rendered HTML
  contains a `[data-slot="avatar-initials"]` element with text `"AL"`; no `<img>` is present.

- **render — initials override** (jsdom): given `initials="AL"` and a mismatched `name="Bob"`, the
  rendered initials text is `"AL"` (the explicit override wins over the derived value).

- **render — icon fallback** (jsdom): given `src=null`, `name=null`, `initials=null`, the rendered HTML
  contains `@template.lievit.icon` output for `"user"` and no initials element.

- **render — no fallback bare** (jsdom): given `src=null`, `name=null`, `initials=null`, `icon=null`,
  the rendered root carries no inner image, no initials span, no icon; just the styled frame.

- **render — status dot** (jsdom): given `status="online"` and `size="md"`, the rendered HTML contains
  `[data-slot="avatar-status"][data-status="online"][aria-hidden="true"]`; the dot is absent when
  `size="xs"`.

- **render — shape** (jsdom): `shape="square"` stamps `data-shape="square"` on the root; the Tailwind
  utility for `--lv-radius-md` is present in the class list; `shape="circle"` stamps `--lv-radius-full`.

- **render — sizes** (jsdom): each of `xs`, `sm`, `md`, `lg`, `xl`, `2xl` stamps the correct
  `data-size` attribute and emits the corresponding diameter token utility class.

- **render — color explicit** (jsdom): `color="primary"` applies the `--lv-color-primary` background
  token utility on the root; the auto-hash is not invoked.

- **render — color auto-hash stability** (jsdom): calling the partial twice with `name="Ada Lovelace"`
  and `color=null` produces the same `data-variant` on both renders (deterministic hash).

- **render — href link wrapper** (jsdom): given `href="/users/1"` and `hrefLabel="View Ada's profile"`,
  the root element is `<a href="/users/1" aria-label="View Ada's profile">`; the inner frame span has
  `aria-hidden="true"`.

- **render — clickable button wrapper** (jsdom): given `clickable=true` and `ariaLabel="Select Ada"`,
  the root element is `<button type="button" aria-label="Select Ada">`; the inner frame span has
  `aria-hidden="true"`.

- **render — ariaHidden=true** (jsdom): the root element carries `aria-hidden="true"` and no
  `aria-label`; if an `<img>` is present, its `alt` is `""`.

- **render — ariaHidden=true with no name** (jsdom): when `ariaHidden=false` and both `name` and
  `alt` are null and no `<img>` is rendered (initials or icon path), the `aria-label` attribute
  is absent (no empty `aria-label=""`).

- **axe-core — image path** (jsdom + axe): zero violations; the `<img>` has a non-empty `alt` when
  name or explicit alt is provided; the `image-alt` rule is satisfied.

- **axe-core — initials path** (jsdom + axe): zero violations; the non-image frame carries
  `aria-label` when `ariaHidden=false`; no unlabelled img; the `label` rule is satisfied.

- **axe-core — interactive link** (jsdom + axe): `<a href>` with `hrefLabel` passes the
  `link-name` rule; zero violations.

- **axe-core — interactive button** (jsdom + axe): `<button>` with `ariaLabel` (or `name`) passes
  the `button-name` rule; zero violations.

- **axe-core — decorative (ariaHidden=true)** (jsdom + axe): the `aria-hidden` root suppresses
  the entire frame from the a11y tree; zero violations.

- **keyboard — interactive link** (jsdom): focus is reachable via Tab; Enter triggers navigation
  (assert click event fired); Space does not activate an `<a>` (platform: Space scrolls on `<a>`).

- **keyboard — interactive button** (jsdom): focus is reachable via Tab; Enter fires click; Space
  fires click (native `<button>`).

- **keyboard — non-interactive** (jsdom): a pure display avatar (`href=null`, `clickable=false`) is
  NOT in the tab order (no `tabindex` attribute, role is presentational).

- **avatar-group — count and overflow** (jsdom): given `max=3` and 5 `avatar` children passed as
  `content`, the rendered output contains exactly 3 avatar frames and one overflow chip `[data-slot=
  "avatar-overflow"]` with text `"+2"`; `totalCount=5` and `max=3` → `5 - 3 = 2`.

- **avatar-group — no overflow chip** (jsdom): given `max=5`, `totalCount=0`, and 3 avatars in
  `content`, no overflow chip is rendered.

- **avatar-group — overlap size** (jsdom): `overlap="sm"` stamps the correct negative-margin token
  class on each avatar frame inside the group.

- **escaping** (XSS abuse case): a `dataAttrs` map containing `{"user-id": "\">|<script>"}` renders
  the value HTML-escaped in the `data-user-id` attribute; the output is inert. The `attrs` param
  is documented trusted-only and MUST NOT be fed user-derived values (this is a dev discipline, not
  a runtime escape).

- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate (the
  gate compiles every `.jte` in `registry/jte/`; if avatar imports icon via `@template.lievit.icon`,
  the compile gate transitively validates the call site).

## 8. Non-goals / anti-patterns

- **No client-side image-error fallback JavaScript.** The fallback order (image → initials → icon)
  is computed server-side. If the `src` URL 404s at runtime, the browser shows a broken-image icon;
  the adopter is responsible for providing valid `src` values. A client-side `onerror` handler
  would require an inline `on*=` attribute, which the strict CSP refuses. If graceful image-error
  handling is needed, it must be an explicit adopter-side WIRE action (`onImageError` → flip a
  boolean, re-render without `src`), not a partial-side JS patch.

- **No lazy-load pagination or infinite-scroll.** The avatar partial renders one frame. A long list
  of avatars (e.g. a user directory) is paginated or virtualized by the containing WIRE template or
  an HTMX pattern; the avatar partial never owns list mechanics.

- **No built-in tooltip.** The avatar frame does not compose a tooltip — that is the consuming
  template's concern. Tooltips on avatars (e.g. show the full name on hover) are done by wrapping
  the `@template.lievit.avatar(...)` call in `@template.lievit.tooltip(...)` at the call site.

- **No drag-and-drop.** Reordering avatars in a group is the responsibility of the containing
  `builder` or `repeater` partial + its enhancer. The avatar partial is the styled frame only.

- **No upload / cropping.** An avatar-upload control with a crop UI is a separate component (a
  WIRE component wrapping a `file-upload` + an image-crop enhancer). The display avatar partial
  is read-only.

- **No animation on image load.** A fade-in `transition` when the image loads would require JS to
  detect the load event and toggle a class — same CSP concern as the onerror fallback. Adopters
  who want a fade can add it via the `cssClass` param with a CSS `@keyframes` animation on the
  `<img>` that fires via the `loading="lazy"` intersection trigger (pure CSS, no JS), or override
  the frame's token classes. The partial ships without animation by default.

- **No hardcoded colours.** Every background and text colour is a `--lv-*` token. No `oklch(...)`,
  `rgb(...)`, or `#rrggbb` literal appears in the template body. The auto-hash color selection
  computes an INTENT SLUG server-side (e.g. `"primary"`, `"accent"`) and maps it to the token pair;
  it never emits a literal colour.

- **The avatar partial does NOT produce an `aria-live` announcement.** Presence status (online /
  away / etc.) changes are not announced automatically. The consuming view is responsible for
  surfacing presence updates via an explicit `role="status"` live region or the shared announcer
  partial if real-time presence push is wired.
