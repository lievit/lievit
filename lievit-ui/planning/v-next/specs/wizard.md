<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — wizard (multi-step form stepper, WIRE)

- **tier**: WIRE
- **build sequence**: S1
- **status (current)**: COVERED (re-forge of any existing multi-step registry partial; the
  canonical `WizardComponent.java` + `wizard.jte` with a pinned a11y contract is NET-NEW in practice
  because the existing registry has no spec-pinned stepper with `aria-current="step"`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG (no dedicated wizard pattern; composed from): `aria-current="step"` (WAI-ARIA 1.2
      §6.7, https://www.w3.org/TR/wai-aria-1.2/#aria-current) for the active step indicator; W3C WAI
      Tutorials "Multi-page Forms" (https://www.w3.org/WAI/tutorials/forms/multi-page/) for progress
      disclosure; APG Tabs roving-tabindex model (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) as
      pattern reference for skippable-step keyboard navigation (roving within the step-list) when steps
      are clickable. No react-aria wizard hook exists; the interaction model is BUILT against the raw APG
      and WAI-ARIA 1.2 spec. For the linear (non-skippable) mode, step tabs are not interactive and no
      roving is needed — `aria-current="step"` on the active step indicator is the sole ARIA requirement.
    - inventory: Ant Design Steps as inventory reference (linear/skippable modes, status variants,
      vertical/horizontal orientation, icon/number/dot sub-variants, description line, error/finish
      states); the bottom action bar is owned markup (Next/Prev/Submit buttons wired via `l:click`)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      step-indicator examples and Ant Design Steps (NO code copied)

## 1. What it is

A multi-step form container (wizard / stepper): a header step-indicator strip that shows the user's
position in a sequential (or optionally skippable) process, paired with a single-panel content region
that swaps to the active step's owned markup on each navigation action. The active step and all
navigation state are server facts (`@Wire int currentStep`), so this is WIRE: the server holds which
step is shown, which steps are completed/error, and whether each step is reachable. The client never
decides which panel to display — it sends a wire action and the server re-renders the correct panel
markup via morph.

Server-first works directly here: a step change is a round-trip (`goTo(step)`, `next()`, `prev()`),
and the morph preserves focus within the content panel. The only irreducible client behavior is
optional roving tabindex across the step-list when the wizard is in `skippable` mode (so the user can
arrow-navigate to any step tab and activate it). This is a direct re-use of the shared
`collection-nav.enhancer.ts` (the same roving mechanism used by tabs, select, and menu), NOT a
hand-roll. Linear mode (steps not clickable) has NO enhancer; it is pure server-rendered WIRE.

## 2. API — the WIRE surface + template params

**Java (`WizardComponent`)**:

| member | kind | meaning |
|---|---|---|
| `currentStep` `int` | `@Wire` | zero-based index of the currently displayed step (the single source of truth for position) |
| `steps` `List<StepDefinition>` | `@Wire @LievitProperty(locked=true)` | ordered list of step definitions (title, optional description, optional icon, optional id); locked — the step set is a server config, never injectable |
| `skippable` `boolean` | `@Wire @LievitProperty(locked=true)` | when true, every completed or pending step is clickable (the step indicator becomes navigable); when false, only Prev/Next advance the wizard |
| `allowedSteps` `Set<Integer>` | `@Wire` | the set of step indexes the current user may navigate to (enforced server-side in `goTo()`); used to derive `aria-disabled` on individual step indicators |
| `completedSteps` `Set<Integer>` | `@Wire` | steps the server has marked done (drives `status=finish` rendering) |
| `errorSteps` `Set<Integer>` | `@Wire` | steps that failed validation (drives `status=error` rendering); set by the consuming template's action before navigating away |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | `sm \| md \| lg` — scales the indicator strip and action bar; default `md` |
| `orientation` `String` | `@Wire @LievitProperty(locked=true)` | `horizontal \| vertical` — layout of the step strip; default `horizontal` |
| `labelPlacement` `String` | `@Wire @LievitProperty(locked=true)` | `inline \| bottom` (horizontal only) — whether the title/description appear to the right of the icon or below it |
| `indicatorVariant` `String` | `@Wire @LievitProperty(locked=true)` | `number \| icon \| dot` — the visual indicator inside each step node |
| `next()` | `@LievitAction` | advance to `currentStep + 1`; validates `currentStep + 1 ≤ steps.size() - 1`; the consuming template may override to add step-level validation before calling `super.next()` |
| `prev()` | `@LievitAction` | retreat to `currentStep - 1`; validates `currentStep - 1 >= 0` |
| `goTo(int step)` | `@LievitAction` | navigate to an arbitrary step; enforced: `skippable == true && allowedSteps.contains(step)`, else no-op (authz in Java BEFORE mutate) |
| `isFirst()` | derived getter | `currentStep == 0` (read by template to disable Prev) |
| `isLast()` | derived getter | `currentStep == steps.size() - 1` (read by template to show Submit vs Next) |
| `stepStatus(int i)` | derived getter | returns `"finish" \| "process" \| "error" \| "wait"` for step `i`; "process" = current, "finish" ∈ completedSteps, "error" ∈ errorSteps, "wait" = not yet reached |

**`StepDefinition`** (a locked Java record, not a user-editable entity):

| field | type | meaning |
|---|---|---|
| `id` | `String` | stable step id for the body region's `aria-labelledby` chain; unique within the wizard instance |
| `title` | `String` | the step label (required; rendered as the accessible name of the step indicator) |
| `description` | `String` | optional sub-label (decorative detail; rendered below the title) |
| `icon` | `String` | optional Lucide icon name; shown instead of the step number when `indicatorVariant=icon` |

**Template params** (the `wizard.jte` `@param` surface; one param per relevant `@Wire` field +
`_component` + `_instance`; NO `Content` slot — WIRE has none, body regions are OWNED markup):

| param | type | default | meaning |
|---|---|---|---|
| `currentStep` | `int` | — | from `@Wire` |
| `steps` | `List<StepDefinition>` | — | from `@Wire @LievitProperty(locked=true)` |
| `skippable` | `boolean` | `false` | from `@Wire @LievitProperty(locked=true)` |
| `allowedSteps` | `Set<Integer>` | — | from `@Wire` (controls `aria-disabled` per step) |
| `completedSteps` | `Set<Integer>` | — | from `@Wire` |
| `errorSteps` | `Set<Integer>` | — | from `@Wire` |
| `size` | `String` | `"md"` | from `@Wire @LievitProperty(locked=true)` |
| `orientation` | `String` | `"horizontal"` | from `@Wire @LievitProperty(locked=true)` |
| `labelPlacement` | `String` | `"bottom"` | from `@Wire @LievitProperty(locked=true)` |
| `indicatorVariant` | `String` | `"number"` | from `@Wire @LievitProperty(locked=true)` |
| `_component` | `ComponentMetadata` | — | wire root attributes |
| `_instance` | `WizardComponent` | — | access to `isFirst()`, `isLast()`, `stepStatus(i)` |

## 3. Variants / sizes / states

### Modes (the top-level behavioral split)

- **linear** (`skippable=false`, default): the step indicators in the strip are not interactive links.
  Only the Next/Prev/Submit buttons in the action bar navigate. The step indicator nodes are `<li>`
  containers with `aria-current="step"` on the active one; no `role="tab"` or roving tabindex.
- **skippable** (`skippable=true`): completed and allowed-ahead steps are clickable. Each step
  indicator becomes a `<button>` (or `<a>` if a step URL is set). The step list becomes a
  navigable tab-like strip; `collection-nav.enhancer.ts` manages roving tabindex + arrow navigation.
  `allowedSteps` enforces which targets are reachable: a step NOT in `allowedSteps` renders with
  `aria-disabled="true"` and its button is inert to the enhancer.

### Orientation

- **horizontal** (default): the step strip runs left-to-right above the content panel. Connectors
  are horizontal bars between nodes. Arrow keys in skippable mode are Left/Right.
- **vertical**: the step strip runs top-to-bottom to the left of the content panel (a sidebar
  stepper). Connectors are vertical lines. Arrow keys in skippable mode are Up/Down.

### Label placement (horizontal only)

- **bottom** (default): title + description below the indicator node (a classic top-aligned stepper).
- **inline**: title to the right of the indicator node on the same baseline (a compact horizontal strip).

### Indicator variant

- **number** (default): the step index (1-based) inside the node circle. Completed steps show a
  checkmark icon (from the shared `icon` partial). Error steps show an X icon.
- **icon**: a custom Lucide icon from `StepDefinition.icon` inside the node. Falls back to number
  if no icon is set.
- **dot**: a smaller filled circle without any number or icon (a minimal progress strip). Titles and
  descriptions still render below/inline; the dot is decorative.

### Step status (server-driven, rendered as `data-status`)

| status | meaning | visual |
|---|---|---|
| `process` | this is `currentStep` | primary-coloured node + ring, title bold |
| `finish` | in `completedSteps` | success-coloured node, checkmark/original icon, title normal |
| `error` | in `errorSteps` | destructive-coloured node, X icon, title destructive-coloured |
| `wait` | not yet reached, not in `completedSteps`/`errorSteps` | muted node, number, title muted |

### Sizes (height-based, strip-aligned)

- `sm`: indicator node diameter = `--lv-space-6` (24px), title = `--lv-text-xs`, connector thin.
- `md`: indicator node diameter = `--lv-space-8` (32px), title = `--lv-text-sm`, connector standard. Default.
- `lg`: indicator node diameter = `--lv-space-10` (40px), title = `--lv-text-base`, connector thicker.

### States

- `disabled` (`aria-disabled="true"` on a skippable step button not in `allowedSteps`): dims the
  step node, pointer-events none, excluded from roving.
- `aria-busy` on the wizard root during a wire round-trip (runtime-managed, `beforeCall`/`afterCall`
  hooks); the action bar's Next/Submit button shows a spinner (the shared `loading` state from `button`).
- A step with `status=error` does not block navigation (it is a server semantic, not a client gate).

## 4. The a11y contract

- **WAI-ARIA pattern**: no single APG pattern covers a wizard/stepper. The spec is BUILT from three
  authoritative sources:
    1. WAI-ARIA 1.2 `aria-current="step"` (https://www.w3.org/TR/wai-aria-1.2/#aria-current) — the
       canonical attribute for marking the active step in a sequential indicator.
    2. W3C WAI Tutorial "Multi-page Forms" (https://www.w3.org/WAI/tutorials/forms/multi-page/) —
       the recommended progress-indication pattern (ordered list with visually-hidden status labels +
       `aria-current="step"` on the active item; step titles as accessible names; page title carries
       "Step N of M").
    3. APG Tabs roving-tabindex keyboard model (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) —
       applied to the **skippable** mode step-list only, where steps behave like navigable tabs.
       The linear mode has no keyboard interaction on the step strip.

### roles + ARIA (server-rendered by the template)

| element | role / ARIA | when |
|---|---|---|
| wizard root | `data-slot="wizard"` `aria-label="<wizardAriaLabel>"` (or `aria-labelledby` → the page heading that introduces this wizard) | always |
| step-list container | `role="list"` (semantic ordered list `<ol>`; the `<ol>` naturally carries list semantics; `role="list"` added as a reset for CSS list-style removal to preserve list announcements in Safari) | always |
| each step item | `role="listitem"` (natural from `<li>`) | always |
| active step item | `aria-current="step"` on the `<li>` (linear) OR on the `<button>` (skippable) | when `i == currentStep` |
| skippable step button (reachable) | `<button>` with accessible name = title; `aria-current="step"` when active; `data-step-index="${i}"` (escaped, for the enhancer) | skippable + `i ∈ allowedSteps` |
| skippable step button (unreachable) | `<button aria-disabled="true">` | skippable + `i ∉ allowedSteps` |
| connector (between nodes) | `aria-hidden="true"` (decorative line) | always |
| step status badge (finish/error/wait indicator) | `aria-hidden="true"` on the icon; visually-hidden text "Completed", "Error", "Pending" next to each step title for SR (the WAI Tutorial pattern) | always |
| step content panel | `role="group"` with `aria-labelledby="<stepTitleId>"` (the current step's title `id`) | always (the visible content region) |
| action bar | no landmark role (it is within the form flow); Next/Prev/Submit are real `<button>` elements | always |
| wizard `<form>` (optional wrapping) | `aria-label` or `aria-labelledby` if the wizard wraps a `<form>` tag | when the wizard owns the form element |

**Note on `role="tablist"`**: the skippable step-list is NOT marked `role="tablist"`. APG Tabs'
`tablist`/`tab`/`tabpanel` model implies all tabs share a single visible panel, which is accurate
here, BUT the WAI-ARIA spec states `role="tab"` implies `aria-selected`, conflicting with the
`aria-current="step"` semantic that is the correct attribute for a wizard step. The WAI Tutorial
explicitly uses an ordered list + `aria-current` model, which screen readers announce as "step N of M,
current" — precisely the intended announcement. The `tablist` model is therefore NOT used; the list +
`aria-current` model is the correct BUILT pattern.

### keyboard map

| key | does | who | mode |
|---|---|---|---|
| Tab | advances focus: step-list → content panel → action bar → (out) | platform | both |
| Shift+Tab | retreats focus | platform | both |
| Left Arrow / Up Arrow | (skippable) move focus to previous step button in the strip; wrap to last if on first | `collection-nav` enhancer | skippable + horizontal: Left; vertical: Up |
| Right Arrow / Down Arrow | (skippable) move focus to next step button in the strip; wrap to first if on last | `collection-nav` enhancer | skippable + horizontal: Right; vertical: Down |
| Home | (skippable) move focus to first step button | `collection-nav` enhancer | skippable |
| End | (skippable) move focus to last step button | `collection-nav` enhancer | skippable |
| Enter / Space (on a reachable step button) | fires `goTo(step)` wire action | platform + enhancer calls wire | skippable |
| Enter / Space (on Next button) | fires `next()` wire action | platform | both |
| Enter / Space (on Prev button) | fires `prev()` wire action | platform | both |
| Enter / Space (on Submit button) | native form submit or `next()` on last step | platform | both |

**No keyboard interaction on the step-list in linear mode** (step nodes are non-interactive `<li>`
containers). Tab passes through the strip and lands on the content panel directly.

### focus management

- **initial focus**: on page load, no automatic focus move (the wizard is embedded in the page flow;
  focus starts at the natural document position). After a wire round-trip triggered by Next/Prev/goTo,
  the bespoke morph preserves focus within the content panel if a focused element survives the morph
  (same `id` / identity in the new step's markup). If the new step has no surviving focus target, the
  runtime does not auto-move focus: the natural tab order lands the user in the new content panel.
- **no focus trap**: the wizard is not modal. Tab freely leaves the content panel into the action bar
  and beyond. No `focus-trap` enhancer is composed.
- **skippable roving**: in skippable mode, the step-list uses a roving tabindex (one step button in the
  strip has `tabindex="0"` at a time; all others `tabindex="-1"`). The active step button is the
  default roving position. On arrow key, `collection-nav` moves the roving position and DOM focus.
  Tab from within the step-list exits to the content panel (the roving only spans the step strip).
- **after goTo wire call**: the morph delivers the new step's content. Focus is not moved by the
  enhancer (the wire round-trip morph handles identity-preserving patching). If the action bar button
  that triggered goTo still exists in the new render, focus returns to it (morph identity).

### live region

An ARIA live region (`role="status" aria-live="polite"`) is rendered as a visually-hidden element
inside the wizard root. After each navigation (Next/Prev/goTo), the template emits the current step's
announcement text into this region: `"Step ${currentStep+1} of ${steps.size()}: ${title}"`. This gives
screen-reader users an audible progress announcement even if the morph is visually silent.

### shared mechanisms composed

- **`collection-nav.enhancer.ts`** (roving tabindex + arrow-key navigation within the step-list):
  composed in skippable mode only. NOT hand-rolled; the same enhancer used by tabs, select, and menu.
  Parameterised with `orientation` to pick Left/Right vs Up/Down arrow keys.
- **No `focus-trap`** (the wizard is not modal).
- **No popover seam** (no overlay).

## 5. Tokens

### Consumed (existing token set)

| token | usage |
|---|---|
| `--lv-color-primary` / `--lv-color-primary-fg` | active step node background + icon colour |
| `--lv-color-success` / `--lv-color-success-fg` | completed step node (finish status) |
| `--lv-color-destructive` / `--lv-color-destructive-fg` | error step node + error title colour |
| `--lv-color-muted` / `--lv-color-muted-fg` | wait (not yet reached) step node + muted title |
| `--lv-color-border` | connector line colour (between step nodes) |
| `--lv-color-bg` | step node border in wait state (subtle ring against page background) |
| `--lv-color-fg` | default title text |
| `--lv-color-fg-muted` | description sub-label text |
| `--lv-space-6` | sm node diameter (24px) |
| `--lv-space-8` | md node diameter (32px, default) |
| `--lv-space-10` | lg node diameter (40px) |
| `--lv-space-2` | connector thickness (sm) |
| `--lv-space-3` | gap between node and title (inline label placement) |
| `--lv-space-4` | gap between step items (horizontal), content padding |
| `--lv-space-6` | content panel vertical padding |
| `--lv-space-8` | action bar top margin |
| `--lv-text-xs` | sm step title |
| `--lv-text-sm` | md step title (default) |
| `--lv-text-base` | lg step title |
| `--lv-text-xs` | description sub-label (all sizes) |
| `--lv-radius-full` | step node (always a circle) |
| `--lv-ring` | focus-visible ring on skippable step buttons |
| `--lv-font-sans` | all text |
| `--lv-font-weight-medium` | active step title |
| `--lv-font-weight-normal` | non-active step title |
| `--lv-transition-colors` | node colour transition on status change |

### NET-NEW tokens proposed

| token | value (OKLCH, :root) | value (.dark) | justification |
|---|---|---|---|
| `--lv-color-success` | `oklch(0.62 0.17 145)` | `oklch(0.55 0.15 145)` | finish-step node background; not currently in the v2 token set but needed here and will be reused by badge/alert success variant; additive, namespaced, goes in both `:root` and `.dark` blocks |
| `--lv-color-success-fg` | `oklch(0.98 0.01 145)` | `oklch(0.98 0.01 145)` | text/icon on a success-coloured node; same rebrand seam logic as `--lv-color-primary-fg` |
| `--lv-wizard-connector-width` | `2px` | `2px` | the connector line stroke width; a structural token (not a colour); lets adopters slim/thicken connectors without touching component markup |

## 6. Wire actions

### Directives the template binds

- **Prev button**: `<button l:click="prev" ...>` — real `<button>`, platform-supplied Enter/Space.
  Disabled (native `disabled` attribute) when `_instance.isFirst()`.
- **Next button**: `<button l:click="next" ...>` — real `<button>`. Rendered only when
  `!_instance.isLast()`. Shows `aria-busy="true"` + spinner during the wire round-trip (the `button`
  partial's `loading` state, driven by the runtime `beforeCall`/`afterCall` hook).
- **Submit button** (on the last step): `<button type="submit" l:click="next" ...>` or a plain
  `<button type="submit">` if the wizard wraps a `<form>` — the consuming template wires its own
  submit action here. The wizard spec owns only `next()` on the last step; the actual form submission
  is the consumer's concern.
- **Skippable step buttons**: each reachable step button in the step-list emits
  `l:click="goTo" data-step="${i}"` (where `i` is the zero-based step index, HTML-escaped via
  `dataAttrs`). The enhancer reads `dataset.step` on click to supply the `goTo` argument. Unreachable
  steps (`i ∉ allowedSteps`) have `aria-disabled="true"` and no `l:click` directive; the enhancer
  skips them in roving navigation.

### Server action signatures

```
void next()   — advances currentStep by 1; guard: currentStep < steps.size() - 1
void prev()   — retreats currentStep by 1; guard: currentStep > 0
void goTo(int step) — sets currentStep = step; guards: skippable == true AND allowedSteps.contains(step)
```

All three guards are enforced in Java BEFORE the state mutation — a client cannot force an
out-of-bounds navigation or skip a locked step by crafting a request.

### Round-trip flow

1. User clicks Next → `l:click="next"` fires → signed snapshot serialised → POST
   `/lievit/{id}/call` → `next()` runs (Java, authz/guard) → `currentStep` incremented → template
   re-rendered with new `currentStep` → response `text/html` + rotated `Lievit-Snapshot`.
2. Morph patches the DOM: the step-list re-renders (status attributes updated, `aria-current` moved to
   the new active step), the content panel swaps to the new step's owned markup, the action bar
   re-renders (Prev now enabled if `currentStep > 0`).
3. The live-region element is updated by the new render with the announcement text.
4. `collection-nav` (skippable) re-initialises roving position from the new `aria-current` step.

### Enhancer wire-action wiring (skippable mode)

`collection-nav.enhancer.ts` is parameterised with:
- `container`: the `<ol>` step-list element (query via `data-slot="wizard-step-list"`).
- `items`: `[role=none] > button:not([aria-disabled])` — the reachable step buttons.
- `orientation`: read from `data-orientation` on the wizard root.
- `onActivate(item)`: reads `item.dataset.step` → fires the `goTo` wire action with that index via
  the runtime's `triggerAction` API (CSP-clean, no inline handler).

In linear mode, `collection-nav` is NOT mounted (the step-list items carry no `l:click`, so the
enhancer has nothing to bind; the lifecycle `onComponentInit` checks for skippable before mounting).

## 7. Acceptance tests

Every test runs on a REAL substrate (not mocked) — the client-island-fidelity lesson.

### Render (real `LievitRuntime` + jsdom, REAL `collection-nav` mounted for skippable tests)

- **step-list renders with correct count**: mount a wizard with 3 steps at `currentStep=0`; assert the
  `<ol>` contains exactly 3 `<li>` elements.
- **`aria-current="step"` on the active step**: assert the first `<li>` (index 0) has
  `aria-current="step"` and the others do not.
- **step status classes via `data-status`**: step 0 = `data-status="process"`, step 1 = `wait`;
  after wiring `completedSteps={0}` and `currentStep=1`: step 0 = `data-status="finish"`, step 1 =
  `data-status="process"`.
- **linear mode: step nodes are not interactive**: in linear mode, no step `<li>` contains a
  `<button>`; clicking the step node area fires no wire action.
- **skippable mode: reachable step renders a `<button>`**: mount with `skippable=true`,
  `allowedSteps={0,1,2}`; assert each step `<li>` contains a `<button>` (not `aria-disabled`).
- **skippable mode: unreachable step is `aria-disabled`**: `allowedSteps={0,2}` (step 1 locked);
  assert the step-1 button has `aria-disabled="true"`.
- **content panel `aria-labelledby` resolves**: the step panel `role="group"` has
  `aria-labelledby="<stepTitleId>"`; assert the referenced element contains the active step's title text.
- **live-region text updated**: after a `next()` call and re-render, the `role="status"` element
  contains "Step 2 of 3: <title>".
- **Prev disabled on first step**: assert the Prev `<button>` has `disabled` when `currentStep=0`.
- **Next absent / Submit present on last step**: at `currentStep=2` of 3, assert no Next button and
  the Submit/finish-action button is present.

### axe-core

- Zero violations of the ARIA list, `aria-current`, button-accessible-name, and landmark rules on the
  rendered DOM in both linear and skippable modes.
- Specifically assert: no orphaned `aria-current` (only one element per wizard has it); all step
  buttons have accessible names (the step title); the content panel `aria-labelledby` reference
  resolves; the live-region has `role="status"`.

### Keyboard (each key in the §4 map, asserted on the REAL enhancer in jsdom)

- **Tab progression**: assert Tab from the step-list (linear) skips over step nodes and lands in the
  content panel; then Tab again lands on Next/Prev buttons.
- **skippable ArrowRight / ArrowLeft**: with `skippable=true`, focus on step-0 button; press
  ArrowRight → assert focus moves to step-1 button (DOM focus, not aria-activedescendant — roving
  tabindex model); ArrowLeft from step-0 → focus wraps to last step.
- **skippable ArrowDown / ArrowUp** (vertical orientation): same as above with Up/Down.
- **Home / End** (skippable): Home from step-2 → focus moves to step-0; End from step-0 → step-2.
- **Enter on a reachable step button**: press Enter on step-2 button → assert `goTo(2)` wire action
  fired (check the wire call log on the runtime mock or assert the re-rendered `currentStep`).
- **Enter on an `aria-disabled` step button**: press Enter → assert no wire action fired, no state
  change.
- **Enter on Next button**: assert `next()` wire action fires and `currentStep` increments in
  re-render.
- **Enter on Prev button**: assert `prev()` wire action fires and `currentStep` decrements.

### Focus management

- **roving position after goTo re-render** (skippable): trigger `goTo(2)` → morph → assert the
  step-2 button has `tabindex="0"` and all others have `tabindex="-1"`.
- **Tab exits step-list to content panel**: assert focus does not stay trapped in the step strip after
  Tab.

### Wire round-trip IT (lievit-kit, real `WizardComponent`, `CollapsibleComponentIT` pattern)

- **next() advances and re-renders**: mount at step 0 → fire `next()` → assert rendered HTML shows
  `currentStep=1`, `aria-current="step"` on step-1 node, step-0 status = `finish` if in
  `completedSteps`.
- **prev() retreats**: mount at step 2 → fire `prev()` → assert `currentStep=1`.
- **goTo() guard enforced**: in linear mode (`skippable=false`), call `goTo(2)` → assert `currentStep`
  unchanged (server guard refused).
- **goTo() in skippable + locked step**: `allowedSteps={0,2}`, call `goTo(1)` → assert `currentStep`
  unchanged.
- **goTo() in skippable + allowed step**: `allowedSteps={0,1,2}`, call `goTo(2)` → assert
  `currentStep=2`.

### Variants / sizes / orientation

- **each `size`**: sm/md/lg each renders the correct `data-size` attribute and the node diameter maps
  to the correct token class.
- **horizontal vs vertical**: `orientation="vertical"` renders with `data-orientation="vertical"`;
  `collection-nav` receives the correct orientation value (assert the data attribute read by the
  enhancer).
- **`indicatorVariant=dot`**: step nodes have no number text and no icon, only a dot element.
- **`indicatorVariant=icon`**: step nodes show the icon from `StepDefinition.icon`; fall back to
  number when `icon` is null.

### JTE compile + render gate

Covered by the `test/jte-compile` real-compiler gate (the standard conformance gate, `00` §7).

### Escaping

- **`data-step` escape**: a `StepDefinition` with `id = "2\"><script>alert(1)</script>"` renders a
  step button whose `data-step` value is HTML-escaped and the injected string appears inert; the
  `goTo` action on the server validates the index (integer, not the id string) so injection cannot
  affect server state.

### Playwright (gesture fidelity, legacy-VM oracle)

- Real `page.keyboard.press('ArrowRight')` in skippable mode moves focus to the next step button;
  `page.keyboard.press('Enter')` triggers navigation; the content panel shows the new step's resolved
  server-rendered content (not a fake substrate).
- Real `page.click('[data-slot="button"][data-action="next"]')` advances the step; assert the
  step-indicator strip shows the updated `aria-current` in the DOM.

## 8. Non-goals / anti-patterns

- **Client-side step panel swap**: the wizard NEVER hides/shows content panels with CSS or JS based on
  `currentStep`. The server renders exactly ONE step's content; the morph replaces it. There is no
  "all panels rendered with `hidden`" anti-pattern. Server-first means the server decides what to
  render, not the client.
- **Validation gating in the component**: the `WizardComponent` does NOT do step-level form
  validation. Validation is the consuming template's responsibility (mark steps in `errorSteps` before
  calling `next()`). The component enforces only structural guards (bounds, skippable flag,
  `allowedSteps`).
- **`role="tablist"` on the step-list**: explicitly rejected (see §4 note). `aria-current="step"` is
  the correct ARIA attribute for a wizard; `aria-selected` (implied by `role="tab"`) is not. The
  ordered list + `aria-current` model is the W3C WAI-recommended approach.
- **Turbo Streams for step navigation**: the step navigation is a wire round-trip, not a Turbo Stream
  swap. ADR-0086 (delivery boundary): Turbo Drive handles page navigation; lievit runtime handles the
  per-component morph. No Turbo here.
- **Modal dialog wrapping**: the wizard is NOT wrapped in a `dialog`. If a wizard must appear in an
  overlay, compose the `dialog` component (its WIRE open-state + body markup) around the wizard's
  server-rendered content — but that is two composed components, not a built-in mode of the wizard.
- **Infinite / branching step graphs**: the wizard models a linear ordered list of steps, with the
  `allowedSteps` set providing skip-ahead/skip-back control. A DAG of branching steps is not in scope;
  the consuming template may update `steps` and `allowedSteps` server-side to simulate conditionality,
  but the component does not model graph semantics.
- **Auto-advance on complete**: the wizard never automatically fires `next()` after a step action
  completes. Auto-navigation is the consuming template's action responsibility (it may call
  `currentStep++` in its own action method, but the wizard component itself is passive).
- **Hardcoded step labels**: no option list or step title is baked into the template. Every step
  title, description, and icon comes from `StepDefinition` in the locked `steps` list (the "no data
  in a partial" rule extended to WIRE components).
