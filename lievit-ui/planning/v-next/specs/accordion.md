<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — accordion

- **tier**: WIRE
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/collapse.jte` / accordion family)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Accordion (https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) — platform
      `<button>` inside a heading supplies role + Enter/Space + Tab for free; `role="region"` +
      `aria-labelledby` on the panel when a landmark is warranted; no react-aria reference needed because
      the APG pattern is fully platform-supplied (no roving tabindex, no focus-trap, no enhancer required)
    - inventory: Ant Design Collapse as inventory reference (single/multiple expand modes, ghost/borderless
      variants, nested panels, collapsible header, custom header content, panel-level disable)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

An accordion is a vertically stacked list of panels, each with a header button that toggles the visibility
of its associated content region. The OPEN-STATE of each panel is a server fact (`@Wire`): the server
holds which panels are expanded and renders the headers with the correct `aria-expanded` + the panels
with `hidden` or present, so the morph faithfully projects the truth with no client-side divergence.

WIRE because open-state is server-authoritative (the same authz-first principle as dialog/select: the
server decides what is expanded, validates the mode invariants like single-panel enforcement, and
re-renders the whole component on each toggle — the client sees only the morphed DOM). The client needs
no enhancer: the platform `<button>` element gives keyboard + activation for free, and Tab/Shift+Tab
traverse the standard page sequence. This is the APG Accordion pattern in its purest form — a
"server holds state, platform supplies keyboard" composition.

Decision rule: stateful (open-state per panel) → WIRE; keyboard is fully platform-supplied (native
`<button>` in a heading) → NO enhancer; the pattern defines no roving tabindex, no focus-trap, no
collection-nav. Adding either would be complexity the spec explicitly rejects.

## 2. API — the WIRE surface + template params

**Java (`AccordionComponent`)**:

| member | kind | meaning |
|---|---|---|
| `panels` `List<Panel>` | `@Wire @LievitProperty(locked=true)` | the ordered set of panels; each `Panel` carries `id` (unique within the component), `title` (String, the header label), `disabled` (boolean, panel-level disable), and optionally `titleContent` (server-rendered rich header markup — a JTE fragment owned by the adopter) |
| `mode` `String` | `@Wire @LievitProperty(locked=true)` | `"single"` (at most one panel open at a time, the default) \| `"multiple"` (any number open simultaneously) |
| `expandedIds` `Set<String>` | `@Wire` | the set of currently-expanded panel ids; single-mode enforces `size ≤ 1` in the action |
| `collapsible` `boolean` | `@Wire @LievitProperty(locked=true)` | in `single` mode, whether the currently-open panel can be collapsed by clicking its header again (default `true`); `false` = always-one-open, the open action on the expanded panel is a no-op (and sets `aria-disabled="true"` on its header) |
| `toggle(String id)` | `@LievitAction` | expands if collapsed; collapses if expanded (unless `collapsible=false`); in `single` mode, closing any previously-open panel happens here, server-side, in a single atomic mutation; validates `id ∈ panels`; no-op on disabled panels |

**Template params** (`accordion.jte`): one `@param` per `@Wire` field + `@param ComponentMetadata _component` +
`@param AccordionComponent _instance`. No `Content` slot: WIRE has none; panel body content is OWNED
template markup that the adopter writes in their copy of the template (the copy-in model, `00` §1, or the
import model when RFC 0036 lands). The `panels` list carries the data; the markup that renders inside each
panel body is in the template's owned region for that panel, driven by the panel id switch.

**`Panel` record** (value object, locked server config):

| field | type | meaning |
|---|---|---|
| `id` | `String` | unique id, used as the DOM id anchor (`panel-<id>`, `header-<id>`) and for `expandedIds` membership |
| `title` | `String` | plain-text header label (safe-escaped into the `<button>` text) |
| `disabled` | `boolean` | if `true`, the header button is `disabled` (native) + `aria-disabled="true"`; the `toggle` action is a no-op for this id |
| `level` | `int` | the heading level (`1`–`6`) the panel header renders as (defaults to `3`; the adopter sets this to match the surrounding document outline) |

## 3. Variants / sizes / states

**Variants** (the intent vocabulary, shared library set; mapped via a `switch` to token pairs):

| variant | intent | token read |
|---|---|---|
| `default` | standard bordered card-like panels | `--lv-color-border`, `--lv-color-popover`, `--lv-color-popover-fg` |
| `ghost` | no outer border, dividers only between panels | `--lv-color-border` (dividers); `transparent` outer |
| `borderless` | fully flat, no borders at all; used for nested/inset accordions | only background + divider-less |

`variant` defaults to `"default"`. Mapped in `!{var variantClass = ...}` per the shared variant pattern.

**Sizes**: the accordion does not carry a `size` param on the component level (the panel header button is
not a toolbar-aligned control). Header padding + typography use fixed token values that match `md` button
height as a vertical rhythm reference — the adopter composes `button`/`input` of a specific size inside
the PANEL BODY, not the header. If an adopter needs a compact accordion, they override `--lv-space-3`
padding via a CSS custom property on the root element, not via a size param.

**States per panel**:

| state | how expressed | who owns it |
|---|---|---|
| expanded | `aria-expanded="true"` on the header `<button>`; panel region present in DOM | WIRE field + template |
| collapsed | `aria-expanded="false"`; panel region `hidden` | WIRE field + template |
| disabled | native `disabled` on `<button>` + `aria-disabled="true"` | `Panel.disabled` field + template |
| non-collapsible-expanded (single mode, `collapsible=false`) | `aria-disabled="true"` on the expanded header (the panel IS open but the button has no effective action) | WIRE field + template; `aria-disabled` distinguishes "the action is suppressed" from `disabled` ("the panel is excluded") |
| focus-visible | `:focus-visible` → `--lv-ring` ring on the `<button>` | platform + token |
| hover | `:hover` → `--lv-color-accent` background tint on the header | CSS utility |

**Component-level states**:

- `aria-busy` on the root during the wire round-trip (runtime `beforeCall`/`afterCall` hook; the component
  does nothing — the runtime stamps it automatically).

## 4. The a11y contract (the heart)

- **WAI-ARIA pattern**: APG Accordion —
  https://www.w3.org/WAI/ARIA/apg/patterns/accordion/
  The spec is verified against the official APG page (fetched 2026-06-24). Every role, attribute,
  and keyboard key in this section derives from that source.

- **roles + ARIA** (what the JTE template renders — static structure, always server-produced):

  | element | role / attribute | value |
  |---|---|---|
  | accordion root `<div>` | `data-slot="accordion"` | (no ARIA role; it is a generic container) |
  | panel header: `<h{level}>` | `role="heading" aria-level="${panel.level}"` | or a real `<h3>` etc. if level is statically known |
  | header trigger: `<button>` (inside the heading) | implicit `role="button"` (native) | — |
  | header trigger: `aria-expanded` | `"true"` when id ∈ expandedIds, `"false"` otherwise | reflects the server `@Wire` fact |
  | header trigger: `aria-controls` | `"panel-${panel.id}"` | points to the content region |
  | header trigger: `aria-disabled` | `"true"` when the panel is in the non-collapsible-expanded state OR `panel.disabled = true` | both cases; note: the native `disabled` attr is also present on truly-disabled panels |
  | panel content `<div>` | `id="panel-${panel.id}"` | the target of `aria-controls` |
  | panel content `<div>` | `role="region" aria-labelledby="header-btn-${panel.id}"` | ONLY when the panel body content is substantive enough to warrant a landmark (APG: use `region` + `aria-labelledby` when the panel's content is significant; omit `role="region"` for trivial content to avoid landmark clutter). The template renders `region` by default; adopters can suppress via a `panelRole` param (`""` = no role). |
  | panel content `<div>` | `hidden` attribute when collapsed | present when expanded, `hidden` when collapsed (not `display:none` via CSS — the `hidden` attribute removes from the a11y tree + Tab order by default) |
  | header trigger id: `id="header-btn-${panel.id}"` | used by the panel region's `aria-labelledby` | |

  APG NOTE: the heading element wraps the button; the button is the sole interactive child of the heading;
  persistent summary text or icons outside the button but inside the heading region are allowed.

- **keyboard map** (the complete APG-exact table; all keys are platform-supplied — no enhancer):

  | key | does | who supplies it |
  |---|---|---|
  | `Enter` | when focus is on a collapsed panel header: fires `l:click` → `toggle(id)` → expands; in `single` mode, simultaneously closes the previously-open panel (server-side); when on an expanded panel header: collapses (if `collapsible=true`); no-op (if `collapsible=false` AND mode=`single`) | platform (native `<button>` activation) |
  | `Space` | same as `Enter` (native `<button>` activation) | platform |
  | `Tab` | moves focus to the next focusable element in the standard page Tab sequence (all accordion headers AND all focusable elements within an open panel body are included) | platform |
  | `Shift+Tab` | moves focus to the previous focusable element in the page Tab sequence | platform |

  The APG Accordion pattern does NOT define `ArrowDown`, `ArrowUp`, `Home`, or `End` as keyboard
  interactions. Adding them would diverge from the spec. They are deliberately absent here.

- **focus management**: standard page Tab order. No focus trap, no roving tabindex, no initial-focus
  override. On toggle (open or close), the morph preserves focus on the header button that was activated
  (the runtime morph already handles focus identity-preservation, ADR-0019). No restore-on-close is needed
  because focus never leaves the trigger.

- **live region**: none. The toggle is visible (the panel expands/collapses in-place); no status
  announcement is required by the APG pattern.

- **shared mechanisms composed**: none. The accordion composes no shared enhancer (no focus-trap, no
  collection-nav, no popover seam). It is the canonical "platform does it all" WIRE: the `<button>` gives
  keyboard + role + disabled; the WIRE round-trip gives state + re-render; the morph gives focus survival.
  This is the simplest WIRE tier exemplar.

## 5. Tokens

Reads:

| token | used for |
|---|---|
| `--lv-color-border` | outer border (default variant) + inter-panel dividers |
| `--lv-color-popover` | panel header + body background |
| `--lv-color-popover-fg` | header text + body text |
| `--lv-color-accent` | header hover background tint |
| `--lv-color-accent-fg` | header text on accent hover (if contrast demands it) |
| `--lv-color-muted` | collapsed-state header tint (subtle de-emphasis for collapsed headers) |
| `--lv-color-muted-fg` | collapsed-state header text |
| `--lv-color-fg` | primary text in expanded-state header |
| `--lv-space-3` | header vertical padding (top + bottom per side) |
| `--lv-space-4` | header horizontal padding |
| `--lv-space-2` | panel body vertical padding top (tight join to the header bottom) |
| `--lv-space-4` | panel body horizontal padding (aligns with header text) |
| `--lv-space-5` | panel body bottom padding |
| `--lv-radius-md` | outer container border-radius (default variant); individual header/panel corners use `--lv-radius-sm` where the container clips them |
| `--lv-text-sm` | header label text size |
| `--lv-font-sans` | header label font family |
| `--lv-font-medium` | header label font weight |
| `--lv-ring` | focus-visible ring on the header button |
| `--lv-shadow-xs` | outer container shadow (default variant, subtle depth) |
| `--lv-motion-duration` | chevron rotation animation duration (the expand/collapse chevron turns 180°; CSS `transition: transform var(--lv-motion-duration)` — no JS animation, no inline style, CSP-clean) |
| `--lv-motion-easing` | chevron rotation easing curve |

**NET-NEW tokens**: none. The accordion surface is fully covered by the existing token vocabulary.
The chevron animation uses the existing `--lv-motion-*` tokens; the `ghost` + `borderless` variants
suppress tokens via zero values in Tailwind utilities, not new tokens.

**OKLCH authorship**: all colour tokens above are authored in `oklch(L C H)` per the architecture
contract D1 decision (`00` §4). No literal hex or rgb in the component body.

## 6. Wire actions

**Directives the template binds**:

- `l:click="toggle" data-id="${panel.id}"` on each panel header `<button>`. The `data-id` value is
  `panel.id` passed through `Escape.htmlAttribute` (the SAFE escaping channel — it is a per-row,
  server-config value, treated the same as a per-row DB id). The action reads `dataset.id` from the
  event's target.

**Server action signature**:

```java
@LievitAction
public void toggle(String id) {
    // Validation: id must be in the locked `panels` list.
    // No-op on disabled panels.
    // No-op if collapsible=false AND id IS the sole expanded panel in single mode.
    if (expandedIds.contains(id)) {
        if (collapsible || mode.equals("multiple")) {
            expandedIds.remove(id);
        }
        // else: non-collapsible single mode — no mutation, no error, silent no-op.
    } else {
        if (mode.equals("single")) {
            expandedIds.clear();  // collapse the previously open panel server-side
        }
        expandedIds.add(id);
    }
}
```

Validation + authz happen in the action, BEFORE any state mutation. The action never trusts the client
to send a valid id; it validates `id ∈ panels.stream().map(Panel::id).collect(toSet())` first, discarding
hostile ids silently (no error surface to probe).

**Round-trip**:

1. User clicks a collapsed header → `l:click="toggle"` fires with `data-id="<id>"`.
2. Runtime POSTs to `/lievit/{cid}/call?action=toggle` with the signed snapshot + `id` from `dataset.id`.
3. Server validates id, mutates `expandedIds`, re-renders the template.
4. Response: `text/html` + rotated `Lievit-Snapshot` header.
5. Client morphs the new HTML: the clicked header now has `aria-expanded="true"`; the panel region
   appears (hidden → present); in `single` mode, the previously-expanded header now has `aria-expanded=
   "false"` and its panel gains `hidden`. Focus stays on the activated button (morph identity-preserving).

**No enhancer wiring**: the accordion has no typed-TS enhancer. There is no `l:accordion` directive, no
lifecycle hook registration. The wire protocol + platform native `<button>` + morph are sufficient.

## 7. Acceptance tests

The component is DONE only when ALL tests pass on a REAL substrate (not a mocked `$lievit`).

**render** (real `LievitRuntime` + jsdom; the accordion is WIRE so the render test uses the real runtime
— not just a JTE template parse — to assert the server state is correctly projected into DOM):
- Mount with two panels (`alpha`, `beta`), `expandedIds={"alpha"}`, mode=`single`. Assert: `alpha` header
  has `aria-expanded="true"`, its panel region is present and NOT `hidden`; `beta` header has `aria-expanded=
  "false"`, its panel region has `hidden`. The body content of the `alpha` panel is VISIBLE (the
  projection assertion — the content must be observable, not just "a div exists").
- Mount with mode=`multiple`, `expandedIds={"alpha","beta"}`. Assert both headers `aria-expanded="true"`,
  both panels present.
- Mount with `collapsible=false`, mode=`single`, `expandedIds={"alpha"}`. Assert `alpha` header has
  `aria-disabled="true"` (non-collapsible-expanded state). `beta` header has `aria-expanded="false"`,
  no `aria-disabled`.
- A disabled panel (`panel.disabled=true`): assert its header `<button>` has `disabled` attribute AND
  `aria-disabled="true"`.

**axe-core** (zero violations on the APG Accordion rules, rendered DOM):
- Mount a two-panel accordion (one open, one closed) and run `axe.run` with `rules: ["accordion"]` or the
  full default ruleset; assert zero violations.
- Assert `aria-controls` on each header button resolves to an existing element id in the DOM.
- Assert `aria-labelledby` on each `role="region"` panel resolves to the corresponding header button id.

**keyboard** (each key in the §4 map, asserted on the REAL rendered DOM with JSDOM `KeyboardEvent`
dispatch or Playwright — assert the OBSERVABLE OUTCOME, not just that an event fired):
- `Enter` on a collapsed header: fires the wire round-trip; after morph, the header is `aria-expanded=
  "true"` and its panel is present. (The test asserts the DOM after the round-trip, using the IT pattern,
  not a mocked call.)
- `Space` on a collapsed header: same as `Enter` (native `<button>` behaviour; assert equivalence).
- `Enter` on an expanded header (mode=`multiple` or collapsible=`true`): header becomes `aria-expanded=
  "false"`, panel gets `hidden`.
- `Enter` on an expanded header (mode=`single`, `collapsible=false`): no state change; `aria-expanded`
  stays `"true"`; no wire call is fired (the server action is a no-op, but the test asserts by observing
  the DOM and the call count).
- `Tab` (via Playwright or jsdom `Tab` key event): focus moves from the first header button to the second
  header button (and into the open panel's body if it contains focusable elements) in document order.
- `Shift+Tab`: reverse of above; focus order is standard page sequence.
- A `disabled` panel header button: `Enter`/`Space` are blocked (native `disabled`; assert no wire call
  fired, no DOM change).

**focus** (no trap, no roving, no special restore — assert the absence of unexpected focus behavior):
- After toggling a panel via keyboard `Enter`, focus remains on the activated `<button>` (the morph
  preserves it); focus does NOT jump to the panel body or to any other element.
- `Tab` from the last header button: focus leaves the accordion into the next page element (no trap).
- `Shift+Tab` from the first header button: focus leaves the accordion upward (no trap).

**variants**:
- `default`: root element has the `--lv-color-border` border utility class and `--lv-shadow-xs`; inter-panel
  dividers present.
- `ghost`: no outer border utility class; inter-panel dividers present; background transparent.
- `borderless`: no outer border, no dividers, fully flat.
- `data-variant` attribute on the root matches the active variant string in all cases.

**single vs multiple mode**:
- mode=`single`, two panels: clicking the closed panel opens it AND closes the previously-open panel in a
  SINGLE round-trip (assert: after one click, only one panel has `aria-expanded="true"`).
- mode=`multiple`: clicking a closed panel opens it WITHOUT affecting the other panels (assert both can be
  open simultaneously after two clicks).

**disabled panel**:
- Clicking a disabled panel header (mouse or keyboard): assert the wire action is NOT called (the `disabled`
  attribute blocks native activation; assert call count = 0 and DOM unchanged).

**wire round-trip IT** (lievit-kit, real `LievitRuntime`, the `CollapsibleComponentIT` pattern):
- Mount `AccordionComponent` with two panels, mode=`single`, `expandedIds={}`.
- Fire `toggle("alpha")` via the runtime call.
- Assert re-render: `alpha` header `aria-expanded="true"`, `alpha` panel body is present and its content
  is visible; `beta` remains `aria-expanded="false"` + `hidden`.
- Fire `toggle("alpha")` again (collapsible=`true`).
- Assert: both panels collapsed, `expandedIds` empty in re-rendered DOM.
- Fire `toggle` with a hostile id (`"'; DROP TABLE--"`): assert no exception, no state change (validation
  discards unknown ids silently).

**escaping** (the XSS abuse-case — the `data-id` channel is SAFE-escaped):
- Construct a `Panel` with `id = "\"><script>alert(1)</script>"` (a hostile string).
- Assert the rendered `data-id` attribute is HTML-escaped (the literal angle-bracket is `&lt;` in the
  attribute, not a tag); no `<script>` element is present in the DOM; `axe.run` finds zero violations.

**JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate (existing suite).
No special case; the accordion template must compile to `.class` files with no exceptions.

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read the WAI-ARIA APG Accordion pattern
(https://www.w3.org/WAI/ARIA/apg/patterns/accordion/), Ant Design Collapse, and Tailwind UI Disclosure
as references for PATTERN and LOOK. You MUST NOT paste literal source from any of them — the output is
always original generation (`02-licensing.md`, the one bright line).

The accordion has NO shared enhancer dependency. Do NOT add `collection-nav`, `focus-trap`, or any other
enhancer — the APG pattern defines no roving tabindex and no focus-trap; adding either contradicts the
spec. If you find yourself reaching for an enhancer, re-read §4 and stop.

The `toggle` action validates `id ∈ panels` BEFORE any mutation. Hostile ids are discarded silently. In
`single` mode, `expandedIds.clear()` happens inside the same action call before `expandedIds.add(id)` —
never two round-trips.

`aria-disabled="true"` on the non-collapsible-expanded header is DISTINCT from `disabled`: the panel is
open and accessible, but the close gesture is suppressed. Do not conflate the two states in the template.

The panel region uses `hidden` (the HTML attribute) for the collapsed state, NOT a CSS utility alone.
`hidden` removes the element from the a11y tree and tab order by browser default; a CSS `display:none`
utility alone is insufficient if the `hidden` attribute is absent. Both may be present.

Use `role="region"` + `aria-labelledby` on the panel content `<div>` as the DEFAULT. The APG recommends
this for substantial content. Add a `panelRole` template param (default `"region"`, set `""` to suppress)
so adopters can opt out when the content is trivial and landmark clutter is a concern.

Mirror WIRE conventions from the server-first refactor blueprint §1.b: no `Content` slot, owned template
markup in the panel body region, boolean ARIA attributes rendered via JTE boolean-attribute conditional
(`aria-expanded="${panel.expandedIds.contains(id) ? "true" : "false"}"`), no `<script>`, no inline
`on*=`. The root carries `data-slot="accordion"`, each header `<button>` carries `data-slot="accordion-
header"`, each panel region carries `data-slot="accordion-panel"`.

Minimal code to GREEN against the acceptance tests. The keyboard map is short and entirely platform-
supplied — do not over-engineer it.
