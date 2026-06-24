<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — command (palette)

- **tier**: WIRE + ENH (`command.enhancer.ts` — client-side filtering/scoring + keyboard nav;
  composes `collection-nav.enhancer.ts` for the listbox roving + typeahead)
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of the existing `command` enhancer + wire scaffold)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Combobox (select-only variant for the trigger; listbox popup) +
      **react-aria `useComboBox` / `useListBox` interaction model** as the pattern reference
      (the keyboard map + ARIA wiring + `aria-activedescendant` model, transcribed into ORIGINAL
      template + `command.enhancer.ts` composing `collection-nav`; no react-aria source copied).
      APG URLs verified: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ and
      https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/ and
      https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
    - inventory: Ant Design (no direct equivalent — `cmdk` / shadcn Command is the de-facto
      reference for feature surface: groups, recents, empty state, async loading, nested pages,
      keyboard-first activation from any trigger)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI
      (NO code copied)

## 1. What it is

A command palette: a modal overlay containing a search input + a grouped listbox of commands,
where the user types to filter and selects an action to execute. The palette is summoned
imperatively (a global shortcut, a trigger button) and dismissed on selection or Esc.

The component is WIRE because the command registry (which commands are available, their labels,
their groups, their permissions) is a server fact: the server renders the full command set into
the initial palette HTML, gatekept by the same authz the actions themselves require. The
irreducible CLIENT behavior — live fuzzy filtering as the user types (sub-round-trip latency
is mandatory for a command palette; a wire round-trip per keystroke is unacceptable) — is the
`command.enhancer.ts`, which scores/filters the already-rendered option nodes client-side and
shows/hides them in place. On selection the enhancer fires the chosen command's wire action; the
server executes the action (full authz + validation, same as any wire call).

Server-first wins because: the full command set is rendered once on page load (or lazy-mounted
on first open); the filtering is a pure client DOM operation on that pre-rendered set (no
framework needed, a typed-TS enhancer suffices); and the action execution is a normal wire
round-trip with server-enforced authz. The palette does NOT ship a separate React/Alpine widget
or re-derive the command set on the client — the server is the registry.

The palette opens inside the overlay/popover seam (the shared focus-trap enhancer handles the
modal focus behavior: initial focus on the search input, trap within the overlay, focus restore
on close). The `collection-nav.enhancer.ts` drives the listbox roving and typeahead; the
`command.enhancer.ts` wraps it with the scoring/filtering layer and the command-dispatch
protocol — composing, never re-implementing.

## 2. API — the WIRE surface + template params

**Java (`CommandPaletteComponent`)**:

| member | kind | meaning |
|---|---|---|
| `open` `boolean` | `@Wire` | palette open-state; toggled by `openPalette()` / `close()` |
| `commands` `List<Command>` | `@Wire @LievitProperty(locked=true)` | the full server-side command registry: id + label + group + shortcut (display only) + icon + href (for link-commands) + actionName (for wire-commands); authz-filtered at construction time — a client cannot inject or unlock commands |
| `groups` `List<String>` | `@Wire @LievitProperty(locked=true)` | the display order of group labels (determines section render order in the listbox) |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | input placeholder text, default `"Search commands…"` |
| `recentCommandIds` `List<String>` | `@Wire` | ids of recently-used commands; persisted server-side; the enhancer promotes them visually but the server owns the list |
| `page` `String` | `@Wire` | active nested page id (empty = root); non-empty renders only the sub-commands of that page |
| `openPalette()` | `@LievitAction` | sets `open=true`; may also reset `page` to root |
| `close()` | `@LievitAction` | sets `open=false`; resets `page` to root |
| `executeCommand(String id)` | `@LievitAction` | authz-validates the id ∈ commands (for the current user + current page), then dispatches: link-commands redirect (server emits a redirect header); wire-commands trigger their named action; records usage into `recentCommandIds` |
| `openPage(String pageId)` | `@LievitAction` | sets `page` to a nested-page id; the template re-renders with only that page's commands visible |
| `backToRoot()` | `@LievitAction` | sets `page` to empty (root view) |

**`Command` record fields** (used by the template; constructed in Java):
`id` `String`, `label` `String`, `group` `String`, `icon` `String | null`,
`shortcutDisplay` `String | null` (e.g. `"⌘K"` — display only, the actual binding lives in the
enhancer), `href` `String | null` (null = wire action), `pageId` `String | null` (non-null = this
command navigates to a nested page instead of executing), `disabled` `boolean`.

**Template params** (one per `@Wire` field + infra):

| param | type | meaning |
|---|---|---|
| `open` | `boolean` | whether the overlay is mounted and visible |
| `commands` | `List<Command>` | the filtered-by-page command set for the current `page` |
| `groups` | `List<String>` | display order of group labels |
| `placeholder` | `String` | search input placeholder |
| `recentCommandIds` | `List<String>` | ids to visually distinguish in the list |
| `page` | `String` | current nested page id (empty = root) |
| `_component` | `ComponentMetadata` | wire infra (component FQN, cid, snapshot) |
| `_instance` | `CommandPaletteComponent` | access to derived view helpers (e.g. `groupedCommands()`) |

No `Content` slot (WIRE has none — server-first refactor blueprint §1.b).
The body markup — the search input, the listbox, the groups, the empty-state region — is OWNED
markup in the template, not a slot. Adopters customise by forking the template (the copy-in
model, RFC 0036).

## 3. Variants / sizes / states

**Variants** (the palette itself has one visual form; the COMMAND items carry intent):
- Default: single visual style for the palette container. No palette-level `variant` param.
- Command item intent: `default | destructive` — a destructive command (e.g. "Delete record")
  renders its label in `--lv-color-destructive` + the destructive icon tint. Other items are
  default. The item intent comes from the `Command` record's `intent` field (`String`, default
  `"default"`).

**Sizes**:
- The palette panel width is controlled by a `size` param: `sm | md | lg`.
  `sm` = `--lv-space-96` (narrow, ≈ 384px), `md` = `--lv-space-128` (default, ≈ 512px),
  `lg` = `--lv-space-192` (≈ 768px, for palettes with rich preview panes).
  Height is always intrinsic (max-height capped at `--lv-space-96` with `overflow-y: auto` on
  the listbox region so long command sets don't overflow the viewport).
- The search input and command items obey the global `md` (36px) height; there is no per-item
  size param.

**States**:
- `open` / closed: when `open=false` the entire overlay + listbox are absent from the DOM
  (rendered as `hidden`, leaving the a11y tree and tab order entirely). When `open=true` the
  panel is present; the enhancer moves focus to the search input.
- `disabled` on a `Command`: the option renders with `aria-disabled="true"` + visual muting;
  the enhancer skips it during keyboard navigation and ignores click/Enter on it.
- **Filtering** (client-side): the enhancer shows/hides `role="option"` nodes in place based on
  the search query without a wire round-trip. The `aria-hidden="true"` attribute is toggled on
  non-matching nodes; the `aria-activedescendant` pointer is kept on a visible node.
- **Empty state**: when no commands match the current query, an owned `data-slot="empty"` region
  is shown (server-rendered text, e.g. "No commands found."). The enhancer toggles its
  `hidden` attribute based on the filtered count.
- **Loading** (async variant): when the command set for a nested page is fetched via HTMX (the
  HTMX variant, see §6), the listbox region carries `aria-busy="true"` during the swap; the
  runtime's `beforeCall`/`afterCall` hooks manage it automatically.
- **Recent commands**: items whose id is in `recentCommandIds` render a `data-recent="true"`
  attribute; the enhancer (or CSS `[data-recent]` selector) gives them a visual distinction.
  The template renders a "Recent" group at the top when `recentCommandIds` is non-empty.
- **Nested page breadcrumb**: when `page` is non-empty, a breadcrumb strip renders above the
  search input showing the current page label + a "Back" button wired to `backToRoot()`.

**Slots** (PARTIAL-style content regions, owned markup not external slots — WIRE has no
`gg.jte.Content` slots):
- `data-slot="overlay"`: the modal overlay root (scrim + panel).
- `data-slot="search-input"`: the `<input role="combobox">`.
- `data-slot="listbox"`: the `<ul role="listbox">`.
- `data-slot="group"`: each `<li role="presentation">` group section header.
- `data-slot="option"`: each `<li role="option">` command item.
- `data-slot="empty"`: the no-results region.
- `data-slot="breadcrumb"`: the nested-page breadcrumb bar (hidden at root level).

## 4. The a11y contract (the heart — non-negotiable, fully specified)

**WAI-ARIA pattern**: APG Combobox (select-only, non-editable trigger for the palette open
mechanism) + APG Listbox (the command list). The search `<input>` is the combobox element per
APG: DOM focus stays on it; the active command is tracked via `aria-activedescendant` (never
DOM focus on the option). This is the canonical APG listbox popup model.

Sources verified: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ ·
https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/ ·
https://www.w3.org/WAI/ARIA/apg/patterns/listbox/

**Roles + ARIA** (what the template emits; all server-rendered, never set by JS):

| element | role / attribute | value |
|---|---|---|
| search `<input>` | `role="combobox"` | the combobox element per APG |
| search `<input>` | `aria-expanded` | `"${open ? "true" : "false"}"` |
| search `<input>` | `aria-controls` | `"<listboxId>"` (static, stable id) |
| search `<input>` | `aria-haspopup` | `"listbox"` |
| search `<input>` | `aria-autocomplete` | `"list"` (client filtering) |
| search `<input>` | `aria-activedescendant` | `""` initially; managed by enhancer to the active option id |
| search `<input>` | `aria-label` | `"Search commands"` (or `aria-labelledby` → a visually-hidden label) |
| listbox `<ul>` | `role="listbox"` | the popup list |
| listbox `<ul>` | `id` | `"<listboxId>"` (matches `aria-controls` above) |
| listbox `<ul>` | `aria-label` | `"Commands"` |
| group header `<li>` | `role="presentation"` | the section divider, not selectable |
| group label `<span>` inside header | `id="<groupLabelId>"` | referenced by group's `aria-labelledby` |
| group `<ul>` inside header | `role="group"` | the group's option container |
| group `<ul>` | `aria-labelledby` | `"<groupLabelId>"` |
| command `<li>` | `role="option"` | each command item |
| command `<li>` | `id` | `"opt-<commandId>"` (stable; referenced by `aria-activedescendant`) |
| command `<li>` | `aria-selected` | `"false"` always (selection occurs only on activation; no persistent selection state in a command palette) |
| command `<li>` | `aria-disabled` | `"true"` when `command.disabled` |
| command `<li>` | `data-intent` | `"default"` \| `"destructive"` (for CSS) |
| scrim `<div>` | `aria-hidden` | `"true"` (decorative, click handled by enhancer) |
| empty region | `role="status"` | so screen readers announce when there are no results |
| empty region | `aria-live` | `"polite"` (announces "No commands found." on filter clear) |
| breadcrumb strip `<nav>` | `aria-label` | `"Command palette navigation"` |
| back `<button>` | — (native button) | accessible name = "Back" (visible label or `aria-label`) |

The overlay panel itself does NOT use `role="dialog"` — a command palette is a combobox popup,
not a dialog. The focus-trap IS applied (the palette is modal), but the APG role for the overlay
shell is `role="presentation"` (a neutral wrapper); the combobox + listbox carry the semantics.
This matches cmdk's accessibility model and aligns with how screen readers announce the pattern:
as a search-driven list, not a dialog with a form.

**Keyboard map** (the load-bearing table — cite APG Combobox select-only + APG Listbox):

| key | context | action | who |
|---|---|---|---|
| `ArrowDown` | input focused, list closed | open the palette + move `aria-activedescendant` to the first visible option | enhancer |
| `ArrowDown` | input focused, list open | move `aria-activedescendant` to the next visible option; stop at the last | `collection-nav` |
| `ArrowUp` | input focused, list open | move `aria-activedescendant` to the previous visible option; stop at the first | `collection-nav` |
| `ArrowUp` | input focused, list closed | open the palette + move `aria-activedescendant` to the last visible option | enhancer |
| `Home` | input focused, list open | move `aria-activedescendant` to the first visible option | `collection-nav` |
| `End` | input focused, list open | move `aria-activedescendant` to the last visible option | `collection-nav` |
| `PageDown` | input focused, list open | move `aria-activedescendant` forward 10 visible options | `collection-nav` |
| `PageUp` | input focused, list open | move `aria-activedescendant` backward 10 visible options | `collection-nav` |
| `Enter` | input focused, option active | execute the active command: if `href`-command navigate; if wire-command fire `executeCommand(id)`; if page-command fire `openPage(pageId)`; if `disabled` do nothing | enhancer → wire |
| `Escape` | palette open | close the palette: fire `close()` wire action; focus-trap restores focus to the opener | enhancer (`focus-trap`) |
| `Tab` | palette open | close the palette (same as Esc — the palette is modal, Tab must not escape) | `focus-trap` enhancer intercepts Tab, fires `close()` |
| `Shift+Tab` | palette open | same as Tab (close) | `focus-trap` |
| `Alt+ArrowDown` | input, list closed | open without moving activedescendant | enhancer (APG optional, implemented) |
| `Alt+ArrowUp` | input, list open | close the palette | enhancer (APG optional, implemented) |
| `Backspace` | input, page ≠ root | if the search query is empty, fire `backToRoot()` | enhancer |
| Printable chars | input focused | filter the visible options in place (client-side scoring); reset activedescendant to first visible match | enhancer (input `oninput` via directive) |
| `Escape` | input, nested page | if query is non-empty: clear the query; else fire `backToRoot()` then `close()` | enhancer (priority: clear-first, then back, then close) |

**Focus management**:
- **Initial focus**: on `open` transition (morph mounts the overlay), the `focus-trap` enhancer
  moves DOM focus to the search `<input>` (the first focusable inside the panel). This fires
  immediately after the morph; the user can type without any extra click.
- **Focus trap**: while the palette is open, the `focus-trap` enhancer intercepts Tab/Shift+Tab
  and prevents focus from leaving the overlay. The palette is intentionally modal (like a dialog)
  — Tab closes it, not cycles within it, because there are no interactive elements after the
  search input that should be Tab-reachable (the listbox uses `aria-activedescendant`, not DOM
  focus on options).
- **Active descendant (not DOM focus) on options**: following the APG combobox + listbox model,
  DOM focus remains on the `<input>` at all times while the palette is open. The illusion of
  "focus on an option" is achieved by `aria-activedescendant` + visual `[data-active]` CSS on
  the option node. The `collection-nav` enhancer manages the pointer; never move DOM focus to
  `role="option"` nodes.
- **Focus restore on close**: when `close()` fires (Esc, Tab, selection, or scrim-click), the
  `focus-trap` enhancer records the opener element before mounting and restores DOM focus to it
  after the morph removes the overlay. The opener is the element that was focused when
  `openPalette()` was triggered (typically the `⌘K` trigger button or the global shortcut
  context).
- **Scroll into view**: when `aria-activedescendant` moves to an option outside the visible
  listbox scroll area, the enhancer calls `scrollIntoView({ block: "nearest" })` on the option
  node.

**Live region**:
- The empty-state region (`data-slot="empty"`, `role="status" aria-live="polite"`) announces
  "No commands found." when the filtered count drops to zero.
- The result count is NOT announced on every keystroke (that would be noisy); only the
  zero/non-zero transition is meaningful (via the `role="status"` element toggling visible text).

**Shared mechanisms composed** (do NOT re-implement):
- `focus-trap.enhancer.ts`: initial focus on input, modal trap (Tab closes), focus restore.
- `collection-nav.enhancer.ts`: the listbox roving (ArrowUp/Down/Home/End/PageUp/PageDown) +
  `aria-activedescendant` management + scroll-into-view.
- The popover/overlay seam: the panel is positioned as a centered modal overlay (not anchored to
  a trigger); it uses the same overlay token stack (`--lv-z-modal`, `--lv-color-overlay` scrim)
  as `dialog`. The scrim + the CSS centering are the seam's responsibility; the command palette
  does not hand-roll positioning.

## 5. Tokens

**Colour tokens** (OKLCH source of truth, architecture-contract §4):

| token | used for |
|---|---|
| `--lv-color-popover` | palette panel background |
| `--lv-color-popover-fg` | default text inside the panel |
| `--lv-color-overlay` | the scrim behind the panel |
| `--lv-color-border` | panel border + group section dividers |
| `--lv-color-accent` | active/hovered option background |
| `--lv-color-accent-fg` | active/hovered option text |
| `--lv-color-muted` | group label text, shortcut badge text, placeholder text |
| `--lv-color-muted-bg` | shortcut badge background |
| `--lv-color-destructive` | label text + icon for destructive-intent commands |
| `--lv-color-destructive-fg` | destructive command text on active row |
| `--lv-color-fg` | primary option label text |
| `--lv-color-input` | search input background |
| `--lv-color-ring` | search input focus ring |

**Structural tokens**:

| token | used for |
|---|---|
| `--lv-space-2` | item icon-to-label gap, horizontal option padding |
| `--lv-space-3` | group header vertical padding |
| `--lv-space-4` | panel horizontal padding, search row padding |
| `--lv-space-6` | between sections |
| `--lv-space-9` | (36px) search input height + option row height |
| `--lv-space-96` | palette width (`sm`) and listbox max-height cap |
| `--lv-space-128` | palette width (`md`, default) |
| `--lv-space-192` | palette width (`lg`) |
| `--lv-radius-lg` | panel border-radius |
| `--lv-radius-md` | option item border-radius (when `data-active`) |
| `--lv-shadow-xl` | panel elevation (same as dialog) |
| `--lv-z-modal` | panel z-index (above the overlay scrim) |
| `--lv-z-overlay` | scrim z-index |
| `--lv-text-sm` | option label size |
| `--lv-text-xs` | group label size, shortcut badge size |
| `--lv-font-sans` | panel typography |
| `--lv-motion-fast` | the overlay open/close fade transition duration |

**NET-NEW tokens proposed** (additive, justified; go in `:root` + `.dark` blocks):
- `--lv-color-muted-bg`: a very-low-chroma surface for the shortcut `<kbd>` badge background
  (a hint subtler than `--lv-color-accent`; the pattern is shared by `kbd` partial and
  `command`). Justify: no existing token is semantically correct for "subtle chip background";
  `--lv-color-secondary` is too prominent. Value: `oklch(96% 0.005 260)` light,
  `oklch(22% 0.008 260)` dark.
- `--lv-motion-fast`: a short easing duration for overlay micro-animations (open/close fade,
  ~120ms). Justify: `--lv-motion-duration` (if it exists) is calibrated for larger transitions;
  a command palette open deserves a dedicated fast value. If the token already exists under this
  or a similar name, use that — do not duplicate.

## 6. Wire actions + enhancer integration

**Template directives**:

| directive | element | fires |
|---|---|---|
| `l:click="openPalette"` | the global trigger button (outside the component; typically a header icon or a floating button) | opens the palette |
| `l:click="close"` | the scrim `<div>` (when `closable`) | closes; focus-trap restores focus |
| `l:click="close"` | the X close `<button>` (if rendered) | same |
| `l:click="backToRoot"` | the breadcrumb Back `<button>` | exits nested page |
| `l:click="executeCommand" data-id="<escaped commandId>"` | each `role="option"` item (non-page, non-disabled) | executes; SAFE escaped channel |
| `l:click="openPage" data-page-id="<escaped pageId>"` | each page-navigation option | navigates to nested page |

No `l:model` on the search input — the enhancer drives filtering purely client-side without wire
round-trips on keystroke. The wire round-trip occurs ONLY on command execution / open / close /
page navigation.

**SAFE per-option channel** (the XSS rule from architecture-contract §3.4):
Each option's `data-id` and `data-page-id` values come from the server-rendered command registry
(`command.id`, `command.pageId`). They are DB-derived → they go through the `wireArgs`/`dataAttrs`
escaped channel (`Escape.htmlAttribute`), never via `attrs` (trusted-raw). The enhancer reads
`element.dataset.id` — not `innerHTML`, never `eval`.

**`command.enhancer.ts` responsibilities**:

1. **Register on `data-slot="overlay"` presence** (lifecycle `onComponentInit` / a `l:command`
   directive on the overlay root): mount when the overlay appears in the DOM, unmount when it
   leaves.
2. **Delegate to `focus-trap`**: call `focusTrap.activate(overlayRoot, { initialFocus: searchInput,
   onDeactivate: () => fireAction('close') })` on mount. The trap closes the palette on Tab/Esc.
3. **Delegate to `collection-nav`**: call `collectionNav.attach(searchInput, listboxEl)` to get
   ArrowUp/Down/Home/End/PageUp/PageDown + `aria-activedescendant` management for free.
4. **Client-side filtering**: listen to `input` on the search `<input>` (via the runtime's event
   directive). On each input event, score each `role="option"` node against the query using a
   simple fuzzy score (label contains query subsequence; score = match tightness). Show/hide nodes
   by toggling `aria-hidden="true"` on non-matching items; toggle the group `<li>` hidden when all
   its children are hidden; toggle the empty-state region. Reset `aria-activedescendant` to the
   first visible, non-disabled option.
5. **Scroll into view**: after every activedescendant change (delegated from `collection-nav`'s
   callback), call `scrollIntoView({ block: 'nearest' })` on the newly active option node.
6. **Command dispatch on Enter / click**: on Enter (or click on a non-disabled option),
   read `element.dataset.id`; fire the wire action `executeCommand` with the escaped `data-id`.
   For page-navigation options, read `element.dataset.pageId` and fire `openPage`. For
   `href`-commands, navigate via `window.location.assign` (the server emits the href in the
   `data-href` attribute; the enhancer reads it).
7. **Backspace-to-root**: when the search input is empty and `Backspace` is pressed and
   `data-page` on the overlay is non-empty (a nested page), fire `backToRoot`.
8. **Global keyboard binding**: register a `keydown` listener on `document` for the palette's
   global shortcut (e.g. `Ctrl+K` / `⌘K`). The shortcut string is read from
   `data-shortcut="mod+k"` on the `data-slot="overlay"` root (server-rendered, never hardcoded
   in the enhancer). This is the one place the enhancer touches `document`; it registers and
   deregisters cleanly on lifecycle mount/unmount. The `mod` key maps to `metaKey` on macOS and
   `ctrlKey` elsewhere (standard cmdk convention).
9. **Recent commands visual promotion**: after filtering, scan the visible options; if their
   `data-recent="true"` attribute is set, add a CSS class so they visually float to a "Recent"
   group (or the server already rendered a dedicated "Recent" group — the enhancer doesn't need
   to reorder DOM nodes; it just ensures `[data-recent]` items are never hidden solely because
   of group ordering).

**Round-trip summary**:
- `openPalette()` → server sets `open=true` → re-render WITH the overlay → morph mounts it →
  enhancer activates: trap gains focus on input, collection-nav ready, global shortcut registered.
- User types → enhancer filters in place → NO wire round-trip.
- User presses ArrowDown → collection-nav moves `aria-activedescendant` → NO wire round-trip.
- User presses Enter → enhancer reads active option → fires `executeCommand(id)` wire action →
  server validates + executes + sets `open=false` → re-render WITHOUT overlay → morph removes →
  focus-trap restores focus.
- Esc → focus-trap fires `close()` → server sets `open=false` → re-render → morph removes →
  focus-trap restores.
- Nested page click → `openPage(pageId)` → server sets `page` → re-render WITH new command set →
  morph patches the listbox → enhancer reinitializes on the new options.

**HTMX variant** (for async command sets): when the command set for a page is large or
server-computed (e.g. search results from a DB), the listbox region can carry an `hx-get` +
`hx-trigger="input delay:200ms"` on the search input, swapping the listbox fragment from the
server. In this mode the enhancer still owns focus/trap/global-shortcut; the HTMX response
returns a new `<ul role="listbox">` fragment with `aria-busy` removed. The enhancer re-attaches
`collection-nav` after each swap (lifecycle hook on the listbox node replacement).

## 7. Acceptance tests (the gate — refute-by-default)

Every test runs on a REAL substrate (the client-island-fidelity rule — no mocked `$lievit`,
no fake enhancer):

**Render** (real `LievitRuntime` + jsdom, real `command.enhancer.ts` + `focus-trap` +
`collection-nav` mounted):

- `opens and renders the search input and listbox`: fire `openPalette()`; assert the overlay is
  present in the DOM; assert `<input role="combobox" aria-expanded="true">` is present and
  focused; assert the listbox `<ul role="listbox">` is present and contains at least one
  `<li role="option">`.
- `renders command groups with correct structure`: assert each group renders a
  `role="presentation"` header + a `role="group" aria-labelledby` sub-list + option items inside.
- `renders command icon, label, and shortcut badge per option`: a command with icon, label, and
  `shortcutDisplay` renders all three; a command with null icon renders no icon element.
- `renders destructive intent with data-intent="destructive"`: a command with `intent="destructive"`
  has `data-intent="destructive"` on the option node.
- `renders recent commands with data-recent="true"`: a command whose id is in `recentCommandIds`
  has `data-recent="true"`.
- `closes and removes the overlay from the DOM`: fire `close()`; assert the overlay is absent from
  the DOM; assert `aria-expanded="false"` on the (now-hidden) combobox element.
- `renders nested page breadcrumb when page is non-empty`: set `page` to a nested page id;
  assert the breadcrumb `<nav>` is visible and contains a "Back" `<button>`.
- `renders empty state region when no commands match`: filter to a query that matches nothing;
  assert `data-slot="empty"` is visible and has `role="status"`.

**axe-core** (zero violations, real rendered DOM):

- `axe: open palette DOM has no violations`: render the open palette with a representative command
  set; run axe on the overlay; assert zero violations (rules covering: combobox, listbox, option
  roles; `aria-controls` reference valid; `aria-activedescendant` references an existing id;
  all interactive elements have accessible names).
- `axe: active option has aria-activedescendant correctly set`: after ArrowDown, assert that the
  `aria-activedescendant` value on the input matches the `id` of the visually active option and
  that axe sees no invalid-id-reference violation.

**Keyboard** (the §4 map, each key asserted on the REAL enhancer in jsdom):

- `ArrowDown opens the palette and activates the first option`: input focused, palette open;
  assert `aria-activedescendant` is set to the first visible option's id.
- `ArrowDown moves the active option to the next visible one`: with option 1 active, press
  ArrowDown; assert `aria-activedescendant` moves to option 2's id.
- `ArrowUp moves the active option to the previous visible one`: with option 2 active, press
  ArrowUp; assert `aria-activedescendant` returns to option 1's id.
- `ArrowDown stops at the last visible option (no wrap)`: press ArrowDown past the last option;
  assert `aria-activedescendant` stays on the last option's id.
- `ArrowUp stops at the first visible option (no wrap)`: press ArrowUp past the first option;
  assert `aria-activedescendant` stays on the first option's id.
- `Home moves to the first visible option`: press Home; assert first option is active.
- `End moves to the last visible option`: press End; assert last option is active.
- `PageDown jumps forward 10 options`: assert activedescendant advances by up to 10.
- `PageUp jumps backward 10 options`: assert activedescendant retreats by up to 10.
- `Enter fires executeCommand with the active option id`: make option with id "cmd-x" active;
  press Enter; assert the wire action `executeCommand` was fired with `id="cmd-x"`.
- `Enter is inert on a disabled option`: make a disabled option active; press Enter; assert no
  wire action is fired.
- `Enter on a page-navigation option fires openPage`: make a page-nav option active; press Enter;
  assert `openPage` is fired with the correct page id.
- `Escape closes the palette`: press Esc; assert `close()` wire action fired and overlay is absent.
- `Tab closes the palette`: press Tab while input focused; assert palette closes.
- `Backspace fires backToRoot when query empty and page is non-root`: set page to a nested page
  with empty query; press Backspace; assert `backToRoot()` is fired.
- `Escape on a nested page with non-empty query clears the query first`: type "foo" in nested
  page; press Esc; assert the input value is cleared and palette stays open; press Esc again;
  assert `backToRoot()` then `close()` order.
- `global Ctrl+K / Cmd+K shortcut opens the palette`: dispatch a `keydown` event for `ctrl+k`
  on `document`; assert `openPalette()` is fired.

**Filtering** (client-side, no wire round-trip):

- `typing filters visible options by fuzzy match`: type "save" in the search input; assert options
  whose label matches "save" are visible (no `aria-hidden`); assert non-matching options have
  `aria-hidden="true"`.
- `filtering hides groups whose all options are hidden`: type a query that matches no options in
  group "File"; assert the "File" group header is hidden.
- `filtering shows the empty state when nothing matches`: type a query matching nothing; assert
  `data-slot="empty"` is visible and the listbox has no visible options.
- `filtering resets aria-activedescendant to the first visible option`: with option 3 active, type
  a query that hides options 1–3 but shows option 4; assert `aria-activedescendant` is option 4.
- `active option stays in view after ArrowDown`: assert `scrollIntoView` is called on the newly
  active option node after each ArrowDown.

**Focus** (trap, initial focus, restore):

- `initial focus on open is the search input`: after `openPalette()` morph, assert
  `document.activeElement` is the search `<input>`.
- `Tab while palette open closes the palette and restores focus to the opener`: open palette from
  a trigger button; press Tab; assert the overlay is gone and `document.activeElement` is the
  trigger button.
- `Esc restores focus to the opener`: same opener + Esc; same assertion.
- `focus trap does not allow Tab to move past the search input into background content`: while
  the palette is open, press Tab; assert focus does not land on any background element.
- `click on the scrim fires close() and restores focus`: simulate click on the scrim element;
  assert `close()` wire action fired and focus returns to the opener.

**Wire round-trip IT** (lievit-kit, real runtime, `CollapsibleComponentIT` pattern):

- `mount → openPalette → re-render asserts overlay present, aria-expanded=true, input focused`.
- `mount → openPalette → executeCommand → re-render asserts overlay absent, aria-expanded=false`.
- `mount → openPalette → openPage → re-render asserts breadcrumb present, correct page commands`.
- `mount → openPalette → backToRoot → re-render asserts breadcrumb absent, root commands restored`.

**Playwright** (gesture fidelity, legacy-VM oracle — the real substrate, not jsdom):

- `real keyboard: ArrowDown + Enter executes a command on the live app`: open palette via ⌘K;
  press ArrowDown; press Enter; assert the expected action fires and the palette closes.
- `real keyboard: typing filters and Enter executes the first match`: open palette; type "ren";
  assert visible options contain only "Rename…"; press Enter; assert action fired.
- `real mouse: clicking a command item fires executeCommand and closes the palette`.
- `real Esc: closes and returns focus to the trigger button`.
- `scrim click closes the palette`.

**Escaping** (XSS abuse-case):

- `a command id containing a hostile string renders inert`: a command with
  `id = '"><script>alert(1)</script>'` renders its `data-id` as an HTML-escaped attribute; the
  enhancer reads `dataset.id` (never `innerHTML`); assert the literal string does not appear as a
  live tag in the DOM.
- `a command label containing HTML renders as text, not markup`: a label `"<b>Bold</b>"` renders
  as the literal characters, not as a bold element (JTE escaping).

**JTE compiles + renders**: covered by `test/jte-compile` real-compiler + render gate (the same
gate that catches the `gg.jte.development-mode=false` + precompiled-templates class).

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH) tokens.
You MAY read the public WAI-ARIA APG Combobox/Listbox pages + cmdk/shadcn Command feature surface
+ Ant Design (no native equivalent — use cmdk as the AD proxy for feature inventory) + react-aria
`useComboBox` interaction spec as PATTERN references for a11y and feature inventory.
You MUST NOT paste literal source from any of them — the output is always original generation
(the one bright line, `02-licensing.md`).

**Compose the shared mechanisms — do NOT hand-roll**:
- `focus-trap.enhancer.ts` for initial focus + modal trap + Esc/Tab close + focus restore.
- `collection-nav.enhancer.ts` for ArrowUp/Down/Home/End/PageUp/PageDown +
  `aria-activedescendant` management. The command enhancer WRAPS these; it does not re-implement
  arrow navigation or focus trapping.
- The overlay/popover seam for the scrim + panel mounting + centering tokens.
These three shared pieces MUST be built and tested BEFORE this component is implemented
(Phase-0 dependency, architecture-contract §2.b). Do not implement `command` until
`focus-trap`, `collection-nav`, and the overlay seam are green.

**The a11y contract is the keyboard map in §4** — assert ALL rows of it.
A keyboard test that covers only the happy path (Enter selects) and skips Esc, Tab, Backspace,
PageUp/Down, and Home/End is not a passing gate.

**Client-side filtering is a DOM operation, not a wire round-trip**:
Do NOT add `l:model` or `l:keyup` on the search input for filtering.
The enhancer reads the native `input` event, scores the pre-rendered option nodes, and
toggles `aria-hidden` in place. A wire call per keystroke defeats the purpose of a command palette.
The ONLY wire calls the enhancer fires are `executeCommand`, `openPage`, `backToRoot`,
`openPalette`, and `close`.

**The overlay panel is NOT `role="dialog"`** — it is a combobox popup overlay.
The focus trap IS applied (modal behavior), but the semantic role for the panel shell is
`role="presentation"`. Do not use `aria-modal="true"` on the panel; `aria-modal` belongs on
dialog panels, not combobox popups. The screen-reader semantics are delivered by the combobox +
listbox roles.

Mirror the WIRE JTE conventions (server-first refactor blueprint §1.b):
owned template markup, boolean `open` state rendered as a JTE conditional (panel present or
`hidden`), no `Content` slot, typed `@param`, `data-slot` on each region, the two escaping
channels. The `button.jte` header doc-comment format is the reference exemplar.

Minimal code to GREEN against the acceptance tests; refactor only while green.
The client-island-fidelity rule applies: every test that asserts an interaction or a render
must run on the REAL enhancer + REAL runtime substrate, never on a mocked `$lievit` or a
fake collection-nav stub.
