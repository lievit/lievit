<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — button (EXEMPLAR: trivial, platform-a11y, PARTIAL)

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/button.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Button (native `<button>` / `<a href>` — platform-supplied; no react-aria reference
      needed because the native element carries role + keyboard + disabled for free)
    - inventory: Ant Design Button as inventory reference (sizes + variants + icon-only + loading)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is
A token-styled button, or a link styled as a button when `href` is set. STATIC presentational → PARTIAL: it
holds no state and the CLICK is NOT its concern — the consuming WIRE template wires the action via `l:click`
on the rendered element, or a plain form submit / `<a href>` drives navigation. The partial renders only the
styled control. Server-first works trivially: there is nothing client about a button.

## 2. API — params
| param | type | default | meaning |
|---|---|---|---|
| variant | String | "primary" | INTENT: primary \| secondary \| destructive \| destructive-outline \| destructive-ghost \| ghost \| outline |
| size | String | "md" | sm \| md \| lg — HEIGHT-based, toolbar-aligned |
| iconOnly | boolean | false | square icon-only control; content is a single `@template.lievit.icon` |
| type | String | "button" | button \| submit \| reset (ignored when href set) |
| href | String | null | when set, render an `<a href>` styled as a button |
| disabled | boolean | false | dims + blocks activation |
| ariaLabel | String | null | aria-label; **REQUIRED when iconOnly=true** (no visible text → no accessible name otherwise) |
| loading | boolean | false | NET-NEW vs current: shows a spinner, sets `aria-busy`, blocks activation |
| cssClass | String | "" | extra utility classes |
| attrs | String | "" | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (wire directives, target/rel) |
| dataAttrs | Map<String,String> | {} | **SAFE escaped** dynamic data-* (value via `Escape.htmlAttribute`) |
| wireClick | String | null | **SAFE** wire action name → `l:click="${wireClick}"` |
| wireArgs | Map<String,String> | {} | **SAFE** per-row args, merged into the escaped data-* fragment |
| content | gg.jte.Content | — | the label / icon+label (a single icon when iconOnly) |

## 3. Variants / sizes / states
- variants → token pairs via a `switch` (see current `button.jte`): primary=`--lv-color-primary`/`-fg`,
  secondary=`--lv-color-secondary`/`-fg`, destructive=`--lv-color-destructive`/`-fg`, the destructive-*
  red-but-not-solid, ghost/outline = transparent + accent hover.
- sizes (height-based): sm=`--lv-space-8` (32px), md=`--lv-space-9` (36px, default), lg=`--lv-space-10`
  (40px). iconOnly → width = height, `p-0`. Horizontal padding + text size scale with height.
- states: `disabled` (native + `disabled:` utilities; `<a>` gets `aria-disabled` + drops href),
  focus-visible → `--lv-ring`, `aria-invalid` → destructive border + ring. **loading** (net-new) → spinner
  + `aria-busy="true"` + activation blocked.

## 4. The a11y contract
- **WAI-ARIA pattern**: APG Button — satisfied by the native element. No manual `role`. A real `<button>`
  gives role + Enter/Space + disabled; an `<a href>` stays a real link (right/middle-click, copy-URL work).
- **roles + ARIA**: `<button>` (or `<a>`); `aria-label` from `ariaLabel` (mandatory for iconOnly);
  `aria-disabled` on a disabled `<a>` (an `<a>` cannot be natively disabled); `aria-busy="true"` when loading.
- **keyboard map**:
  | key | does | who |
  |---|---|---|
  | Enter / Space | activate | platform (native `<button>`) |
  | Tab | focus in/out | platform |
  (a disabled button/link is removed from activation; a disabled `<a>` keeps `aria-disabled` + no href.)
- **focus management**: platform. focus-visible ring via `--lv-ring`. No trap, no roving.
- **live region**: none.
- **shared mechanism composed**: none (platform-only). This is the simplest tier — the exemplar of "prefer a
  real native element over a div-with-role".

## 5. Tokens
Reads: `--lv-color-{primary,secondary,destructive,accent,fg,…}` (+ `-fg`), `--lv-space-{8,9,10,2,3,4,6}`,
`--lv-text-{xs,sm,base}`, `--lv-radius-md`, `--lv-ring`, `--lv-shadow-xs`, `--lv-font-sans`. NET-NEW token:
none (the loading spinner reuses the `spinner` partial + existing motion tokens).

## 6. Wire actions
None of its own. The button is the SURFACE an action is wired onto: a consuming WIRE template adds
`l:click="save"` via `cssClass`/`attrs`, or uses the SAFE `wireClick`+`wireArgs` channel for a per-row,
DB-derived action (the reactive-list rule — `revokeDevice` + `wireArgs={id: row.id()}` → escaped `data-id`).

## 7. Acceptance tests
- **render** (jsdom): renders a `<button>` by default, an `<a href>` when href set; `data-slot="button"`,
  `data-variant`, `data-size` present; content projected + visible.
- **axe-core**: zero violations; an iconOnly button WITHOUT ariaLabel FAILS (asserts the accessible-name rule).
- **keyboard**: Enter/Space activate (platform — assert the `click` fires); disabled blocks activation.
- **variants/sizes**: each variant emits its token classes; each size emits its height token; iconOnly is square.
- **states**: disabled `<a>` has `aria-disabled` + no href; loading sets `aria-busy` + blocks click + shows spinner.
- **escaping** (the XSS abuse-case): `dataAttrs={confirm: "\">|<script>"}` renders inert (the value is
  HTML-escaped, never a tag); `attrs` is documented trusted-only and NOT fed user data.
- **JTE compiles + renders**: covered by `test/jte-compile`.

## 8. Agent instructions
Generate ORIGINAL code over `--lv-*`; you may read Ant Design Button / shadcn / Tailwind UI as references;
never paste literal source from any of them (the one bright line, `02`). Mirror the CURRENT `button.jte`
exactly (it is already the house exemplar);
the only DELTA is the net-new `loading` state + the explicit a11y test gate. Minimal code to GREEN.
