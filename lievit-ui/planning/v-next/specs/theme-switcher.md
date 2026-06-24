<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — theme-switcher

- **tier**: PARTIAL + ENH (`theme-switcher.enhancer.ts`, an existing enhancer, re-forged)
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of the existing `theme-switcher` enhancer + a new
  `registry/jte/theme-switcher.jte` partial that gives it a proper server-rendered frame)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: BUILT against WAI-ARIA APG Button pattern (each mode option is a real `<button
      aria-pressed>`) and APG Toolbar (the three-button group is a `role="toolbar"`) — no react-aria
      reference needed; the native `<button>` supplies role + Enter/Space + disabled for free, and
      the toolbar grouping is covered by APG directly
    - inventory: no direct Ant Design equivalent; pattern reference is the Tailwind UI dark-mode
      toggle + shadcn `ThemeToggle` convention (three-state: light / dark / system); feature inventory
      chosen for a gestionale: three states + compact + labeled variants
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      icon-group pattern (NO code copied)

## 1. What it is

A three-state theme-preference control: **light / dark / system** (follows the OS). It persists the
user's choice to `localStorage` and reflects it as `data-theme="light"` or `data-theme="dark"` on
`<html>` (or a configurable root element), which is the single repoint mechanism the entire lievit
token system depends on (ADR-0005 / `00` §4). When system is chosen the control reads
`prefers-color-scheme` and repoints accordingly, updating live on OS-level change.

Server-first works naturally: the component renders as a styled button-group PARTIAL (no WIRE state
needed — the preference is a purely-client-side / `localStorage` fact, not a domain value the server
owns). The one irreducible client behavior — reading `prefers-color-scheme`, writing to `localStorage`,
toggling `data-theme` on the root, keeping the pressed state in sync — belongs to the typed-TS
enhancer. There is no server round-trip; the PARTIAL renders the static frame and the enhancer animates
it to life on mount.

The server DOES need to render the correct initial state (to avoid a flash-of-unstyled-theme, FOUT):
the adopter injects the saved preference into the `<html>` tag as `data-theme="..."` via an inline
pre-body script (not this component's concern — it is a documented adopter responsibility outside the
CSP boundary, a one-liner in the layout template) or via a server-side cookie that sets the class on
the first HTML response. The component itself renders correctly regardless: on mount the enhancer reads
the DOM, syncs the pressed state, and is authoritative from that point on.

## 2. API — params / props (the typed surface)

### 2.a JTE `@param` surface (the PARTIAL)

| param | type | default | meaning |
|---|---|---|---|
| `variant` | `String` | `"icon"` | `"icon"` — icon-only buttons (compact toolbar); `"labeled"` — icon + visible label per option; `"icon-labeled"` — icon + label in a single combined toggle |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — height-based, toolbar-aligned (the shared size contract) |
| `storageKey` | `String` | `"lievit-theme"` | the `localStorage` key the enhancer reads/writes; the server renders it as `data-storage-key` for the enhancer to read |
| `rootSelector` | `String` | `"html"` | CSS selector for the element that receives `data-theme="light\|dark"`; rendered as `data-root-selector` |
| `defaultTheme` | `String` | `"system"` | `"light"` \| `"dark"` \| `"system"` — the initial selection when `localStorage` has no saved preference; rendered as `data-default-theme` |
| `labelLight` | `String` | `"Light"` | accessible label + visible label (when `variant="labeled"`) for the light option |
| `labelDark` | `String` | `"Dark"` | accessible label + visible label for the dark option |
| `labelSystem` | `String` | `"System"` | accessible label + visible label for the system option |
| `showSystemOption` | `boolean` | `true` | when `false`, renders only light/dark (two-state toggle instead of three-state group) |
| `cssClass` | `String` | `""` | extra utility classes on the root element |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `id="theme-switcher"` when wiring an external label) |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` (each value through `Escape.htmlAttribute`) |

No `content` / `leading` / `trailing` slots: the icons and labels are fixed by variant and the three
semantic states — there is no adopter-supplied children for a control whose three options are
type-safe constants.

### 2.b Enhancer attributes (the `data-*` hooks the enhancer binds)

The enhancer is identified by `data-lievit-enhancer="theme-switcher"` on the root element. All its
configuration arrives via `data-*` attributes rendered by the partial:

| attribute | set by | meaning |
|---|---|---|
| `data-storage-key` | `storageKey` param | where to persist the preference |
| `data-root-selector` | `rootSelector` param | which element gets `data-theme` |
| `data-default-theme` | `defaultTheme` param | fallback when no localStorage entry |
| `data-show-system` | `showSystemOption` param | `"true"` or `"false"` |
| `data-theme-option="light\|dark\|system"` | template | on each `<button>`; the enhancer uses this to identify which button maps to which state |
| `data-slot="theme-switcher"` | template | root identifier for test/token targeting |
| `data-variant` | `variant` param | for styling hooks |
| `data-size` | `size` param | for styling hooks |

## 3. Variants / Sizes / States / Slots

### Variants (intent-based)

| value | what renders |
|---|---|
| `"icon"` (default) | three icon-only `<button>` elements in a `role="toolbar"` wrapper; each button is square (iconOnly rule); each carries an `aria-label` from its label param |
| `"labeled"` | three `<button>` elements with icon + visible text label side by side |
| `"icon-labeled"` | a single combined `<button>` that cycles through states on click; its visible label + icon update to show the CURRENT active theme; behaves as a three-state toggle (aria-pressed cycles) — this variant gets its own sub-section below |

The `"icon"` and `"labeled"` variants render a `role="toolbar"` group of three `<button
aria-pressed>` controls. The `"icon-labeled"` variant renders a SINGLE `<button>` that rotates state;
its accessible name is the current mode label + icon (the enhancer updates both on press).

When `showSystemOption=false`, the group shrinks to two options (light / dark) and the `"icon-labeled"`
variant becomes a two-state toggle (`aria-pressed` toggles light ↔ dark only).

### Sizes (height-based, toolbar-aligned)

| size | height token | purpose |
|---|---|---|
| `sm` | `--lv-space-8` (32 px) | compact toolbar, sidebar header |
| `md` | `--lv-space-9` (36 px, default) | standard toolbar, page header |
| `lg` | `--lv-space-10` (40 px) | settings page hero control |

In the `"icon"` variant every button is square (width = height). In `"labeled"` horizontal padding
scales with height (same scale as `button.jte`).

### States

| state | how expressed |
|---|---|
| **active (pressed)** | `aria-pressed="true"` on the active option button; styled via `aria-pressed` attribute selector (token `--lv-color-accent` background, `--lv-color-accent-fg` foreground) |
| **inactive** | `aria-pressed="false"` on inactive option buttons |
| **system resolving** | while `matchMedia` fires before the preference is committed, no pressed state (the enhancer sets both to `aria-pressed="false"` during the transient; very brief) |
| **hover** | `:hover` + `--lv-color-accent/10` tint (ghost-style hover) |
| **focus-visible** | `--lv-ring` focus ring (shared token) |
| **disabled** (full group) | `disabled` on all buttons; dims the entire group; applicable when the adopter wraps in a disabled form section |

### Slots

None. The three option icons are rendered inline by the partial from the `icon` partial (`@template.lievit.icon`) with fixed icon names per option (sun / moon / monitor). Labels come from the label params. No `Content`/`leading`/`trailing` (the three states are type-safe constants, not adopter content).

## 4. The a11y contract (the load-bearing section)

### WAI-ARIA pattern

**APG Toolbar** (`role="toolbar"`) containing three **APG Button** buttons (`<button
aria-pressed>`), one per theme option. Source authority: WAI-ARIA APG Toolbar pattern
(https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) and APG Button pattern
(https://www.w3.org/WAI/ARIA/apg/patterns/button/). The `aria-pressed` state on each button
follows the APG Toggle Button guidance (https://www.w3.org/WAI/ARIA/apg/patterns/button/examples/button_idl/).

For the `"icon-labeled"` single-button variant the relevant pattern is APG Toggle Button with
cycling state (light → dark → system → light): it uses `aria-pressed` cycling through all three
values is non-standard; instead the button's accessible name and label text change to name the
CURRENT active mode, and `aria-pressed="true"` means "a non-default preference is active" (i.e.
anything other than `"system"` when `showSystemOption=true`, or whichever is currently selected
when `showSystemOption=false`). This is a deliberate simplification: the single-button variant
communicates state via the visible label update, not via `aria-pressed` tristate. A screen reader
hears the new button name on each press.

### Roles + ARIA attributes

| element | role / attribute | value / rule |
|---|---|---|
| root `<div>` (`"icon"` / `"labeled"` variant) | `role="toolbar"` | groups the three toggle buttons |
| root `<div>` | `aria-label` | `"Theme"` (English default) or the adopter-supplied equivalent via `attrs` |
| each option `<button>` | native `button` role | platform-supplied |
| each option `<button>` | `aria-pressed` | `"true"` for the active option, `"false"` for the others; managed by the enhancer on mount and on press |
| each option `<button>` (`"icon"` variant) | `aria-label` | the label param (`"Light"` / `"Dark"` / `"System"`) — mandatory because iconOnly has no visible text |
| root `<button>` (`"icon-labeled"` variant) | native `button` role | single cycling toggle |
| root `<button>` (`"icon-labeled"` variant) | `aria-label` / visible text | updated to reflect the current mode name by the enhancer; the server renders the `defaultTheme` label initially |
| all `<button>` | `data-theme-option="light\|dark\|system"` | the enhancer reads this to know which state each button represents |
| `<svg>` icons | `aria-hidden="true"` | the button's `aria-label` or visible text carries the name; the icon is decorative |

### Keyboard interaction map

Verified against APG Toolbar (https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) and APG Button
(https://www.w3.org/WAI/ARIA/apg/patterns/button/). The toolbar pattern specifies that arrow keys
move focus within the toolbar; Enter/Space activate the focused button.

| key | action | who supplies it |
|---|---|---|
| `Tab` | moves focus into the toolbar (to the active option button, or the first if none active); `Tab` again moves focus OUT of the toolbar (toolbar is one tab stop) | `collection-nav.enhancer.ts` (roving tabindex within the toolbar) |
| `Shift+Tab` | reverse-Tab, same one-tab-stop rule | `collection-nav` |
| `ArrowRight` / `ArrowDown` | move focus to the next option button within the toolbar (wraps: last → first) | `collection-nav` (roving tabindex, APG Toolbar spec) |
| `ArrowLeft` / `ArrowUp` | move focus to the previous option button (wraps: first → last) | `collection-nav` |
| `Home` | move focus to the first option button | `collection-nav` |
| `End` | move focus to the last option button | `collection-nav` |
| `Enter` / `Space` | activate the focused option button: set `aria-pressed="true"` on it, `aria-pressed="false"` on the others, persist to `localStorage`, update `data-theme` on the root | platform (native `<button>`) triggers click; `theme-switcher` enhancer handles the state update |
| `Tab` / `Shift+Tab` (single-button `"icon-labeled"` variant) | normal focus in/out (single button, no toolbar roving) | platform |
| `Enter` / `Space` (single-button `"icon-labeled"` variant) | cycle the active theme (light → dark → system or light → dark when two-state), update label + icon + persistence | platform + `theme-switcher` enhancer |

Note: the APG Toolbar pattern specifies a **roving tabindex** (only the focused/active item has
`tabindex="0"`, the rest have `tabindex="-1"`) so the toolbar is a single tab stop. This is
exactly the `collection-nav` enhancer's roving-tabindex mode, reused here. The `theme-switcher`
enhancer itself handles ONLY the theme-persistence + `aria-pressed` state; the toolbar keyboard
navigation is delegated to `collection-nav`.

### Focus management

- **Initial focus target**: when the user Tabs into the toolbar, focus lands on the ACTIVE option
  button (the one with `aria-pressed="true"`), not necessarily the first. The roving tabindex is
  initialised by `collection-nav` on mount to point at the active button.
- **No focus trap**: the toolbar is non-modal; Tab leaves normally.
- **Focus return**: not applicable (the toolbar never moves focus away).
- **Roving tabindex**: `collection-nav` manages `tabindex="0"` on exactly ONE button at a time.

The `"icon-labeled"` single-button variant has no roving tabindex (one button, platform handles Tab).

### Screen-reader expectations

- On activating an option: the button's `aria-pressed` state changes from `"false"` to `"true"`;
  assistive technologies announce the button name + pressed state. Example: "Dark, toggle button,
  pressed" after selecting dark mode.
- There is no `aria-live` region for the theme change itself: the visual repoint is immediate and
  self-evident; announcing "theme changed" would be noise. The button state change IS the
  announcement.
- For the single-button `"icon-labeled"` variant: on press the button's accessible name changes (e.g.
  from "Light" to "Dark"); AT announces the new name on the next focus or via the `aria-label` update.
  To make the name change audible immediately without focus, the enhancer sets `aria-live="polite"` on
  the button's label `<span>` (the visible text node only, not the whole button). This is the minimum
  live-region surface; the icon `<svg>` stays `aria-hidden`.

### Shared mechanisms composed

- **`collection-nav.enhancer.ts`** (roving tabindex mode): owns Arrow/Home/End navigation within the
  toolbar. The `theme-switcher` enhancer does not re-implement roving tabindex; it calls into
  `collection-nav`'s registration API (parameterised: `orientation="horizontal"`, `wrap=true`,
  `selector="[data-theme-option]"`). The `"icon-labeled"` single-button variant does NOT use
  `collection-nav` (one button, nothing to rove).
- No focus-trap (non-modal).
- No popover seam (no overlay).

## 5. Design tokens

### Consumed tokens

| token | where used |
|---|---|
| `--lv-color-accent` | background of the active (`aria-pressed="true"`) option button |
| `--lv-color-accent-fg` | foreground (icon + label) of the active option button |
| `--lv-color-bg` | background of inactive buttons (transparent / host background) |
| `--lv-color-fg` | foreground (icon + label) of inactive buttons |
| `--lv-color-muted` | foreground of inactive buttons at rest (slightly dimmed) |
| `--lv-color-border` | border of the toolbar group container (subtle hairline wrap) |
| `--lv-space-8` | height in `sm` size |
| `--lv-space-9` | height in `md` size (default) |
| `--lv-space-10` | height in `lg` size |
| `--lv-space-1` | gap between icon and label in `"labeled"` variant |
| `--lv-space-2` | horizontal padding in the labeled button |
| `--lv-space-1` | gap between buttons inside the toolbar group |
| `--lv-radius-md` | border-radius of the toolbar group wrapper |
| `--lv-radius-sm` | border-radius of each individual option button |
| `--lv-ring` | focus-visible ring on the focused button |
| `--lv-text-sm` | label text size in `sm` / `md` sizes |
| `--lv-text-base` | label text size in `lg` size |
| `--lv-font-sans` | label font |
| `--lv-shadow-xs` | subtle inset shadow on the toolbar group (depth cue, like a segmented control) |
| `--lv-motion-fast` | transition on the `aria-pressed` active state shift (background + foreground cross-fade) |

### NET-NEW tokens

None. The `--lv-color-accent` / `--lv-color-accent-fg` pair (the "selected segment" look) is already
in the token set. No new dark-mode rules: the `.dark / [data-theme="dark"]` re-point block already
handles `--lv-color-accent` → its dark-mode value, so the active button colours flip automatically
when the theme switches — which is exactly right.

The `--lv-shadow-xs` token is already in the v2 set; if it does not exist it is additive (shadow:
`0 1px 2px oklch(0% 0 0 / 0.06)` light, `0 1px 2px oklch(0% 0 0 / 0.16)` dark).

## 6. Wire / island integration

### Server-rendered JTE structure

The partial renders a static HTML frame. It does NOT use `l:click` or any WIRE directives (there is
no server round-trip — the preference is a client fact). The enhancer is identified by the presence
of `data-lievit-enhancer="theme-switcher"` on the root; the lievit runtime's lifecycle registry
calls `ThemeSwitcherEnhancer.mount(root)` on page load (and re-calls after a Turbo Drive navigation
via the `page:load` lifecycle hook registered by the runtime, ADR-0019).

**Root element** (three-button `"icon"` / `"labeled"` variants):
```
<div
  role="toolbar"
  aria-label="Theme"
  data-slot="theme-switcher"
  data-lievit-enhancer="theme-switcher"
  data-variant="${variant}"
  data-size="${size}"
  data-storage-key="${storageKey}"
  data-root-selector="${rootSelector}"
  data-default-theme="${defaultTheme}"
  data-show-system="${showSystemOption}"
  class="... [token-driven classes] ..."
  ${attrs}
>
  <button
    type="button"
    data-theme-option="light"
    aria-label="${labelLight}"
    aria-pressed="false"
    tabindex="0"
    class="..."
  >
    @template.lievit.icon(name="sun", ariaHidden=true, cssClass="...")
    !{var labelVisible = variant.equals("labeled") ? labelLight : ""}
    ${labelVisible.isEmpty() ? "" : "<span class=\"...\">" + labelLight + "</span>"}
  </button>

  <button
    type="button"
    data-theme-option="dark"
    aria-label="${labelDark}"
    aria-pressed="false"
    tabindex="-1"
    class="..."
  >
    @template.lievit.icon(name="moon", ariaHidden=true, cssClass="...")
    ...
  </button>

  @if(showSystemOption)
  <button
    type="button"
    data-theme-option="system"
    aria-label="${labelSystem}"
    aria-pressed="false"
    tabindex="-1"
    class="..."
  >
    @template.lievit.icon(name="monitor", ariaHidden=true, cssClass="...")
    ...
  </button>
  @endif
</div>
```

The server renders ALL buttons with `aria-pressed="false"` and `tabindex="-1"` (except the first,
which gets `tabindex="0"` as the roving-tabindex placeholder). The enhancer corrects the pressed
state and the active tabindex on mount, BEFORE the first paint (synchronous in `mount()`). This means
there is a render-then-correct pattern; to avoid any visible flash the partial has an inline
`display: none` on the root that the enhancer removes in the same synchronous mount call — so the
control is invisible until the enhancer has set the correct state.

**Single-button `"icon-labeled"` variant**:
```
<button
  type="button"
  data-slot="theme-switcher"
  data-lievit-enhancer="theme-switcher"
  data-variant="icon-labeled"
  data-size="${size}"
  data-storage-key="${storageKey}"
  data-root-selector="${rootSelector}"
  data-default-theme="${defaultTheme}"
  data-show-system="${showSystemOption}"
  aria-label="${defaultTheme.equals("dark") ? labelDark : defaultTheme.equals("light") ? labelLight : labelSystem}"
  class="..."
  ${attrs}
>
  @template.lievit.icon(name="sun", ariaHidden=true, cssClass="...")
  <span aria-live="polite" class="...">Light</span>
</button>
```

The enhancer updates the icon (swaps the `data-icon` attribute of the `<lv-icon>` or replaces the
SVG use-href) and the `<span>` text + the button's `aria-label` on each press.

### Typed-TS enhancer responsibilities (`theme-switcher.enhancer.ts`)

This is NOT a WIRE enhancer (it fires no wire action). It is a **pure-client typed-TS enhancer**
registered via the lievit lifecycle registry (`registerEnhancer("theme-switcher", ThemeSwitcherEnhancer)`).

**On `mount(root: HTMLElement)`**:
1. Read `storageKey`, `rootSelector`, `defaultTheme`, `showSystem` from `root.dataset`.
2. Read the persisted preference from `localStorage.getItem(storageKey)` → `"light" | "dark" |
   "system" | null`.
3. If `null`, use `defaultTheme`. Resolve `"system"` to the actual OS preference via
   `window.matchMedia("(prefers-color-scheme: dark)").matches`.
4. Apply `data-theme="light"` or `data-theme="dark"` to the element matched by `rootSelector`
   (via `document.querySelector(rootSelector)`).
5. Sync `aria-pressed` states: set `"true"` on the button whose `data-theme-option` matches the
   stored preference (or `"system"` if system is stored), `"false"` on the others.
6. Sync roving tabindex: delegate to `collection-nav` (three-button variant) — call
   `CollectionNav.init(root, { orientation: "horizontal", wrap: true, selector: "[data-theme-option]" })`.
7. Show the root (remove the `display:none` guard).
8. Register a `matchMedia` listener for `(prefers-color-scheme: dark)` changes: on OS change,
   if the stored preference is `"system"`, re-resolve and reapply `data-theme`.

**On `click` on a `[data-theme-option]` button**:
1. Read `option = button.dataset.themeOption` (`"light" | "dark" | "system"`).
2. Set `aria-pressed="true"` on this button, `"false"` on the others.
3. Persist: `localStorage.setItem(storageKey, option)`.
4. Resolve: if `option === "system"` → read `matchMedia`; else use directly.
5. Apply `data-theme="light"|"dark"` to the root element.
6. Update `collection-nav`'s active item pointer.

**On `click` on the single-button `"icon-labeled"` variant**:
1. Read current stored preference, cycle to next (`light → dark → system → light`, or `light →
   dark → light` when `showSystem=false`).
2. Persist + apply `data-theme` as above.
3. Update `aria-label`, icon reference, and `<span>` text to reflect the newly ACTIVE state.

**`matchMedia` listener cleanup**: the enhancer stores the listener handle and removes it in
`unmount(root)` (called by the runtime lifecycle on Turbo Drive `turbo:before-cache`). This
prevents listener leaks across navigations.

**No wire actions fired**. No `Lievit-Snapshot`. No `POST /lievit/`. The enhancer is
self-contained client-only. This is the correct tier: the theme preference is not a domain fact
the server owns; it is a display preference that lives in the browser.

### Turbo Drive integration

The lievit runtime fires `registerEnhancer` callbacks on both initial page load and on each
`turbo:load` (page:load). The theme-switcher enhancer's `mount()` is therefore called after every
navigation. Because the `data-theme` on `<html>` persists across navigations (the `<html>` element
is not replaced by Turbo Drive), the theme never flashes between pages. The enhancer re-syncs the
button pressed states on remount (they may have changed from a different page's theme-switcher
instance).

## 7. Acceptance tests

Each test runs on a **real substrate**: real JTE compile + render for the PARTIAL output, real
`LievitRuntime` + real `ThemeSwitcherEnhancer` for enhancer tests — not a mocked `$lievit` (the
client-island-fidelity lesson).

### Render tests (jsdom + JTE real compile)

- **`renders three buttons in icon variant`**: default params → the root has `role="toolbar"`, three
  `<button>` children, each with `data-theme-option` ∈ `{light, dark, system}`, each with `aria-label`
  set; `data-slot="theme-switcher"`, `data-variant="icon"`, `data-size="md"` present on root.
- **`renders two buttons when showSystemOption=false`**: only light + dark buttons present; no
  `data-theme-option="system"`.
- **`renders labeled variant with visible text`**: each button contains a visible `<span>` with the
  label text alongside the icon.
- **`renders icon-labeled variant as single button`**: root is a `<button>` not a `<div>`; no
  `role="toolbar"`.
- **`sizes emit correct data-size`**: `size="sm"` → `data-size="sm"`; `size="lg"` → `data-size="lg"`.
- **`icons are aria-hidden`**: every `<svg>` / icon element has `aria-hidden="true"`.
- **`JTE compiles and renders`**: covered by `test/jte-compile` real-compiler gate.

### axe-core assertions

- **`axe: zero violations on default icon variant`**: run axe-core on the rendered DOM (root +
  buttons); cite APG Button + APG Toolbar rules; assert zero violations.
- **`axe: icon-only buttons have accessible names`**: each `<button>` with `data-theme-option` has a
  non-empty `aria-label`; axe `button-name` rule must pass.
- **`axe: labeled variant zero violations`**: same axe gate on the labeled variant.
- **`axe: single-button variant zero violations`**: axe on `"icon-labeled"` variant.

### Enhancer / keyboard tests (real `ThemeSwitcherEnhancer` mounted in jsdom)

These tests mount the rendered HTML into a real jsdom, then call `ThemeSwitcherEnhancer.mount(root)`
with a mock `localStorage` and a mock `matchMedia`.

- **`on mount: reads localStorage and sets aria-pressed`**: localStorage has `"dark"` →
  the dark button has `aria-pressed="true"`, others `"false"`.
- **`on mount: falls back to defaultTheme when localStorage is empty`**: no localStorage entry,
  `defaultTheme="light"` → light button pressed.
- **`on mount: system resolves to OS preference`**: `defaultTheme="system"`, mock matchMedia
  returns `matches=true` (dark) → `data-theme="dark"` on the root, system button pressed.
- **`on mount: shows the root (removes display:none guard)`**: after mount, the root is visible
  (not `display:none` or `hidden`).
- **`clicking a button sets aria-pressed and data-theme`**: simulate click on the dark button →
  `aria-pressed="true"` on dark, `"false"` on light + system; `document.querySelector("html")`
  has `data-theme="dark"`.
- **`clicking a button persists to localStorage`**: after click on light, `localStorage.getItem
  (storageKey) === "light"`.
- **`clicking the active button is idempotent`**: click dark twice → no error, dark stays pressed.
- **`system option repoints on OS change`**: system pressed, mock matchMedia fires change to
  `matches=false` (light) → `data-theme="light"` updates on root without a click.
- **`unmount removes matchMedia listener`**: `unmount(root)` called → the matchMedia mock's
  `removeEventListener` was called (no listener leak).

### Keyboard interaction tests (real enhancer + `collection-nav`, jsdom)

- **`Tab into toolbar focuses the active button`**: initial active = system; Tab → focus lands on
  the system button (`tabindex="0"`).
- **`ArrowRight moves focus to next button`**: focus on light → ArrowRight → focus on dark.
- **`ArrowRight wraps from last to first`**: focus on system (last) → ArrowRight → focus on
  light.
- **`ArrowLeft moves focus to previous button`**: focus on dark → ArrowLeft → focus on light.
- **`ArrowLeft wraps from first to last`**: focus on light → ArrowLeft → focus on system.
- **`Home moves focus to first button`**: focus on system → Home → focus on light.
- **`End moves focus to last button`**: focus on light → End → focus on system.
- **`Enter/Space activates the focused button`**: focus on dark → Space → dark becomes pressed,
  `data-theme="dark"`, localStorage updated.
- **`single-button variant cycles on Enter`**: `"icon-labeled"` variant, current = light →
  Enter → dark active (label + icon updated); Enter again → system; Enter again → light.
- **`single-button variant cycles light↔dark when showSystem=false`**: two-state → Enter toggles.

### Variants / sizes test

- **`each size emits correct height token class`**: `sm` → token class referencing `--lv-space-8`;
  `md` → `--lv-space-9`; `lg` → `--lv-space-10`; each asserted on the button element.
- **`aria-pressed drives active styling hook`**: after enhancer mount the active button has
  `aria-pressed="true"`; assert the CSS attribute selector `[aria-pressed="true"]` is the
  styiling discriminant (no extra class needed — token-driven via `aria-pressed` attribute).

### Escaping

No per-row DB-derived values flow through this component (the option values are fixed constants
`"light"`, `"dark"`, `"system"`; the label params are server-set static strings). The `dataAttrs`
channel is available for adopter-supplied `data-*` and is escaped via `Escape.htmlAttribute`.
Abuse case: `dataAttrs={testid: "\"><script>alert(1)"}` → rendered as an inert escaped attribute
value in the DOM, never a script tag. Assert this in the render tests.

### Playwright (gesture fidelity — real browser, legacy-VM oracle)

- **`theme switches on real click (Playwright)`**: navigate to the theme-switcher demo page;
  click the dark button; assert `document.documentElement.dataset.theme === "dark"` and the page
  visually reflects dark tokens (assert a sampled `--lv-color-bg` CSS variable value).
- **`keyboard navigation is real (Playwright)`**: Tab into the toolbar; ArrowRight moves focus;
  Enter applies the theme; assert the same `dataset.theme` check.
- **`theme persists across navigation (Playwright)`**: select dark; navigate to a second page via
  Turbo Drive; assert `document.documentElement.dataset.theme` is still `"dark"`.

## 8. Non-goals / anti-patterns

- **Not a WIRE component.** The theme preference is NOT a server-owned domain value. Do not add
  `data-lievit-component`, `data-lievit-snapshot`, or any `l:click` wire directives. There is no
  server round-trip and there should not be.
- **Not a server-side cookie solution.** Preventing FOUT by writing a cookie on theme change and
  reading it server-side to pre-set `data-theme` on `<html>` is a valid adopter concern, but it is
  NOT this component's responsibility. The component documents it as an adopter integration note;
  it does not implement it.
- **Not a CSS-class toggler.** The token system depends on `data-theme="dark"` / `data-theme="light"`
  on the configurable root (ADR-0005). The enhancer must NOT toggle a `.dark` class or any other
  class-based mechanism; `data-theme` is the single repoint mechanism and must stay canonical.
- **Not a framework island.** No Lit, no Alpine, no React. The enhancer is plain typed TypeScript,
  CSP-clean, no `eval`, no dynamic `<script>`. The strict `script-src 'self'` CSP the library
  enforces means ANY inline script or eval-based approach is refused silently.
- **Not an inline-style writer.** The enhancer does not write `style` attributes. Theme tokens are
  applied by switching `data-theme` on the root; the CSS token repoint block handles the rest.
  This is the correct layer: token logic lives in CSS, not JS.
- **Not a global singleton enforcer.** Multiple `theme-switcher` instances on the same page are
  allowed (e.g. one in the topbar, one in the settings page). They all read/write the SAME
  `localStorage` key and `rootSelector`, so they stay in sync. The enhancer does not check for or
  enforce a single instance.
- **Not a language-specific label provider.** The label params (`labelLight`, `labelDark`,
  `labelSystem`) are server-rendered strings: the adopter (or the i18n layer in the Spring controller)
  provides the locale-correct label. The partial does not hard-code English beyond its default param
  values (which are overridden in any i18n-aware template call).
- **Does not persist to server / user profile.** If the adopter needs the theme preference to persist
  to the authenticated user's profile (cross-device), that is an adopter-level integration: a form
  POST that writes to the user record, and the server reads it to set `data-theme` in the layout
  template. The `theme-switcher` component itself handles only `localStorage` + `matchMedia`; it is
  not the right layer for profile persistence.
