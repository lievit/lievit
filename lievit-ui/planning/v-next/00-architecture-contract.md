<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 00 — Architecture contract (the target every v-next component MUST conform to)

STATUS: blueprint, written 2026-06-23 on `feat/ui-vnext-blueprint`.
This is a DESIGN doc. It changes no component code. It is the shared contract that makes a
parallel implementation fan-out CONVERGE (Phase 2) instead of producing 60 divergent components.

**Read first**: `docs/adr/0012-server-first-no-lit-partials-wire-htmx.md` (the spine: no Lit, server
renders, client morphs), `docs/adr/0019-client-runtime-bundle.md` (the dependency-free runtime),
`docs/adr/0005-theming-zero-css-default.md` (tokens, adopter owns the look), `docs/adr/0009-lievit-ui-copy-in-registry.md`
(copy-in, now demoted to opt-out by RFC 0036), and `planning/server-first-refactor-blueprint.md` (the
COMPLETE refactor that produced the current 40 partials + 14 wire + 0 islands).

## 0. The thesis of this doc: preserve the spine, describe the DELTA

The server-first pivot is DONE and SOUND. The wire protocol, the signed-snapshot round-trip, the bespoke
morph, the JTE conventions, the `--lv-*` token system, the directive/lifecycle extension registries: none
of these are reopened. The v-next rebuild is NOT a greenfield. It is three deltas layered on a sound spine:

1. **a11y delta** — every component's accessibility pattern is pinned to a single source of truth
   (WAI-ARIA APG + react-aria's interaction model), made explicit in the spec, and asserted by axe-core
   + keyboard tests. Today a11y lives as prose in JTE header comments; v-next makes it a tested contract.
2. **inventory/feature delta** — the component SET is the COMPLETE ant-design-equivalent surface (Francesco:
   "completo al 100%, no MMP"; `03-component-inventory.md`). Appropriate-complexity here means COMPLETENESS
   is the right complexity for a DEFINITIVE library (you adopt it because it has everything); restraint lives
   in each component's VARIANT surface (no gratuitous variants) and in the build TIER (server-first + one
   shared a11y source), never in cutting components.
3. **styling delta** — the visual conventions are upgraded toward Tailwind-UI-grade polish, implemented
   as ORIGINAL markup over the existing `--lv-*` tokens (Tailwind UI is inspiration-only, never copied;
   see `02-licensing.md`).

Plus the structural delta that motivates the whole rebuild (RFC 0036): the library becomes consumable
by IMPORT as ONE Maven/Java artifact (templates + jar-served JS runtime + Java, no npm;
`01-distribution-consumable.md`), not copy-in-by-default.

What does NOT change (the invariant spine — do not reinvent any of these):
- The three tiers (PARTIAL / WIRE / HTMX-pattern) and the no-Lit rule.
- The wire protocol (ADR-0001), the `Lievit-Snapshot` / `Lievit-Effects` headers, the bespoke morph.
- The runtime under `runtime/` (ADR-0019): dependency-free, strict-CSP-safe, directive + lifecycle registries.
- The `--lv-*` token namespace and the dark-mode re-point block (`registry/tokens/lievit-tokens.css`).
- The JTE house conventions (header doc-comment, typed `@param`, `data-slot`, zero `<script>`, the two
  escaping channels `attrs` trusted-raw vs `dataAttrs`/`wireArgs` escaped). The `button.jte` is the
  reference exemplar of all of these.

---

## 1. The tier model (unchanged spine, restated as the contract)

Every v-next component is exactly ONE of:

| Tier | What it is | Files | When |
|---|---|---|---|
| **PARTIAL** (`registry:jte`) | pure presentation, zero client state, cannot fail silently | one `.jte` → adopter JTE root | display + native-element form controls (the control carries its own semantics, binds via `l:model`) |
| **WIRE** (`registry:wire`) | stateful interaction whose state/actions belong server-side in typed Java | `<Name>Component.java` + `<name>.jte` (+ `meta.json`) → Java root + JTE root | open-state, selection-set, multi-step, anything whose truth is a server fact |
| **HTMX pattern** | server swap (load-more, typeahead, tab-content) | no shipped component; a documented recipe + the `registry:jte` partial it swaps in | the lighter alternative to WIRE for a simple server fetch |
| **ENHANCER** (`*.enhancer.ts`, escape-hatch) | the one irreducible client bit (drag, OTP auto-advance, paste, command-palette filtering) | a typed-vanilla-TS module, CSP-clean, fires a wire action | ONLY where server round-trip is a real UX loss; never a framework |

The **decision rule** (from ADR-0012, do not relitigate per component):
pure display → PARTIAL · stateful-server-truth → WIRE · simple server swap → HTMX · genuinely-heavy-client
→ still server + a typed-TS enhancer for the irreducible bit (NO Lit, NO Alpine, NO framework).

The 12 existing enhancers (`builder`, `checkbox-list`, `color-picker`, `combobox`, `command`, `input-otp`,
`key-value-input`, `repeater`, `sidebar`, `tags-input`, `theme-switcher`, `toast`) are the proven escape-hatch
set. v-next adds an enhancer ONLY where react-aria's interaction (e.g. a focus-managed listbox, a roving
toolbar) cannot be expressed as native-element + server-morph; each such case is flagged in `03-component-inventory.md`.

---

## 2. The headless BEHAVIOR layer (the a11y delta — the heart of v-next)

This is the contract's centre of gravity. "Headless + styled" here does NOT mean a React-style headless
hook library. It means: **the BEHAVIOR (roles, states, keyboard, focus management) is specified once,
sourced from one authority, and the STYLING is a separable token-driven skin over it.** In a server-first
stack the behavior lives in three places, and the contract pins which goes where:

### 2.a Where each piece of behavior lives

| Behavior concern | Owner in lievit | Rule |
|---|---|---|
| Roles + ARIA relationships (`role`, `aria-expanded`, `aria-controls`, `aria-labelledby`, `aria-selected`) | the **JTE template** (server-rendered) | static structure → always server markup; never set by JS after load |
| Disclosure / selection STATE (which item is open/selected) | the **WIRE Java field** (`@Wire`), reflected into ARIA by the template | state is a server fact; the template reads it and emits the matching ARIA attribute |
| Native keyboard (Tab, Enter/Space on a `<button>`, arrow on `<input type=radio>`) | the **platform** (real native elements) | prefer a real `<button>`/`<a>`/`<input>` over a div-with-role; the platform gives keyboard + focus for free |
| Non-native keyboard (roving tabindex in a toolbar, type-ahead in a listbox, focus trap in a dialog, arrow-nav in a menu) | a **typed-TS enhancer** (escape-hatch) following the react-aria interaction model | only where the platform doesn't supply it; CSP-clean; the SINGLE source for that pattern, reused by every component that needs it |
| Focus RESTORE after a morph (focus/selection survive the DOM patch) | the **runtime morph** (ADR-0019, already implemented) | components do nothing; the morph preserves node identity + uncontrolled form state |

### 2.b The single-source-a11y rule (the convergence lever)

A WAI-ARIA APG pattern is implemented **once** and reused, never re-derived per component. Concretely:
- The **overlay/popover seam** (native `popover` attribute + CSS Anchor Positioning, the Wave-3 seam) is
  the ONE positioning + light-dismiss + focus-return mechanism. `dialog`, `dropdown-menu`, `context-menu`,
  `combobox`, `select`, `tooltip`, `hover-card`, `date-picker` all compose it. They do not each hand-roll
  positioning.
- The **focus-trap** behavior (dialog/drawer/sheet/modal) is ONE enhancer (`focus-trap.enhancer.ts`,
  net-new), parameterised, reused by every overlay-with-trap. Not re-coded in each.
- The **listbox/menu roving + typeahead** behavior (the react-aria `useListBox`/`useMenu` interaction
  model, mapped to vanilla TS) is ONE enhancer (`collection-nav.enhancer.ts`, net-new), reused by
  `select`, `combobox`, `dropdown-menu`, `command`, `navigation-menu`.

This is what `react-aria` gives us: not its code (we can't copy hooks into a JTE/server stack), but its
**interaction spec** — the exact keyboard map, focus order, and ARIA wiring it documents per pattern. We
transcribe that spec into the enhancer + the template once, cite it, and test it. The "Radix-gap" cases
(a pattern react-aria does not cover) get a built implementation against the raw WAI-ARIA APG; both are
flagged per component in `03-component-inventory.md`.

### 2.c The a11y acceptance gate (makes "accessible" non-negotiable)

Every component ships with:
- an **axe-core assertion** on its rendered DOM (real render, real data — jsdom for partials, real
  `LievitRuntime` for wire, Playwright for the gesture-driven ones), zero violations of the cited rules;
- a **keyboard test** asserting the exact key map from its spec (the keys that matter for THAT pattern);
- a **focus test** where focus management is non-trivial (trap, restore, roving).

"a11y" as an adjective is banned in the spec; each component states the WAI-ARIA pattern name + the keys
+ the axe rules it must pass. This is the same discipline gest's CLAUDE.md already imposes
("when a spec encodes a contract, assert the WHOLE contract").

---

## 3. JTE template conventions (unchanged; restated so a fresh agent converges)

Mirror `button.jte` exactly. The mandatory shape of every `.jte`:

1. **Header doc-comment** (Apache block + a `<%-- --%>` block) with the labelled sections:
   `<name> partial -- <one-line what>` · `TIER:` · `STRUCTURE (scientific decision rule):` cite the
   source mapped (WAI-ARIA APG / react-aria / Ant Design feature / shadcn) and why it wins ·
   `A11y (<pattern>):` roles, keyboard, focus, live regions · `Params:` one line per `@param` ·
   `Usage:` 1-2 `@template.<name>(...)` examples. The cited source documents WHERE the a11y/inventory idea
   came from (a credits/maintainer note, not a legal provenance record — `02-licensing.md` is decided +
   lightweight: the only rule is no literal code-copy, output is original generation).
2. **Typed `@param` with defaults.** No data hardcoded inside the partial (option lists, labels,
   enums-as-strings arrive via `@param` from the controller's typed model — the "no data in a partial"
   rule, repo CLAUDE.md). Content/children come in as `gg.jte.Content` slots (`content`, plus optional
   `leading`/`trailing`/`footer`). NOTE: a WIRE template has NO `Content` slot (the adapter builds the
   model from `@Wire` fields + `_component` + `_instance` only); a wire component's "children" are OWNED
   markup in the template's region (server-first refactor blueprint §1.b, verified).
3. **Body**: plain HTML + Tailwind v4 utilities + `--lv-*` tokens, NEVER hardcoded values. Local computed
   strings via `!{var ...}`. Composes other partials via `@template.<name>(...)`. Zero `<script>`, zero
   inline `on*=` (the strict CSP refuses them; this is the surface the silent-slot bug taught us to keep
   server-pure). `data-slot="<name>"` on the root + `data-variant`/`data-size` for styling hooks + test
   targets.
4. **The two escaping channels** (the XSS decision rule, see `button.jte`): `attrs` = TRUSTED raw
   (`$unsafe`, author-typed STATIC strings only) · `dataAttrs`/`wireArgs` = SAFE escaped
   (`Map<String,String>`, each value through `gg.jte.html.escape.Escape.htmlAttribute`). A per-row,
   DB-derived value goes through `wireArgs`/`dataAttrs`, NEVER `attrs`. This is the load-bearing security
   convention; every v-next component with a per-row action follows it.

---

## 4. The design-TOKEN system (EXTEND, do not replace)

The token system in `registry/tokens/lievit-tokens.css` is the v2 Filament/shadcn-grade vocabulary and is
KEPT byte-stable. v-next extends it; it does not replace it. The contract:

- **Every component reads `var(--lv-*)`, never a literal.** A retheme is a token override in `:root`, not a
  component edit (ADR-0005). This is already enforced by the gest anti-pattern grep and must stay true.
- **Dark mode** is the single `.dark, [data-theme="dark"]` re-point block; structural tokens (spacing,
  radius, type, z, motion) are theme-invariant and never repeated. New components add NO new dark-mode
  rules unless they introduce a genuinely new colour token (then it goes in BOTH blocks).
- **Net-new tokens are additive and namespaced.** The Tailwind-UI-grade styling delta may need a few new
  tokens (e.g. a denser `--lv-space-7`, a `--lv-shadow-inner` for inset controls, a focus-within ring
  variant). Each is proposed in the spec, justified, added to the `:root` + `.dark` blocks, and documented
  as additive. **No new token may be a literal colour baked into a component.**
- **Colour token SOURCE-OF-TRUTH format is OKLCH** (D1 DECIDED, Francesco). Every colour token is authored
  in OKLCH (`oklch(L C H)`), the perceptually-uniform modern-CSS format with native browser support in
  2026. OKLCH buys better theming + contrast math (programmatic tints/shades, predictable lightness for
  hover/active/disabled states, easier WCAG-contrast reasoning) — exactly what the Tailwind-UI-grade refresh
  + the dark-mode re-point need. Hex is allowed ONLY as a COMPILED fallback if a concrete target ever needs
  it (a build step can emit a hex twin); it is never the authored source. The existing hex colour tokens are
  migrated to OKLCH as part of the token extension (values chosen to match the current look, so the migration
  is visually byte-stable even though the literal strings change). Structural tokens (spacing, radius, type,
  z, motion) are unaffected.
- **The brand-able seam stays ~20 tokens.** An adopter rebrands by overriding the semantic colour pairs +
  `--lv-radius` + the fonts. v-next must not grow the rebrand surface; a Tailwind-UI look is achieved by
  the DEFAULT token VALUES + the markup, not by forcing adopters to set more tokens.

---

## 5. The variant / size / state API shape (the convergence contract)

This is the single most important section for parallel-fan-out convergence: every component exposes the
SAME SHAPE of API so 60 agents produce a coherent library, not 60 dialects.

### 5.a Variants (intent, not colour)

- A `variant` `@param` names an INTENT, never a colour: `primary | secondary | destructive | ghost |
  outline` for actions; `info | success | warning | destructive` for status; `default | <intent>` elsewhere.
  Mapped to tokens via a `switch` in `!{var variantClass = ...}` (see `button.jte`). The intent vocabulary
  is shared across the library (a `destructive` button and a `destructive` alert read the same token pair).
- New intents are added to the shared vocabulary, not invented per component.

### 5.b Sizes (height-based, toolbar-aligned)

- `size` `@param` = `sm | md | lg`, **height-based** so controls line up flush in a toolbar row (the
  Filament toolbar-alignment decision, `button.jte`): `sm → --lv-space-8` (32px), `md → --lv-space-9`
  (36px, the default + shadcn baseline), `lg → --lv-space-10` (40px). A `button`, `input`, `native-select`
  of the same size are pixel-aligned. Every form-control + button v-next component obeys this scale.

### 5.c States (token-driven, ARIA-reflected)

- Interactive states are expressed as: `disabled` (native attr + `disabled:` utilities + `aria-disabled`
  for `<a>`), `:hover`/`:focus-visible` (the `--lv-ring` focus token, shared by every interactive
  primitive), `aria-invalid` (recolours to `--lv-color-destructive` + the destructive ring), `aria-busy`
  (set by the runtime `beforeCall`/`afterCall` hook during a wire round-trip — components don't manage it).
- A WIRE component's stateful state (`open`, `selected`, `value`) is a `@Wire` field reflected into the
  matching ARIA attribute by the template (`aria-expanded="${isOpen ? "true" : "false"}"`). State is never
  duplicated client-side (repo CLAUDE.md: "state has one owner, the server is the source of truth").

### 5.d The slot vocabulary

- PARTIAL slots: `content` (children) + optional `leading` / `trailing` / `header` / `footer` as
  `gg.jte.Content`. Names are shared across the library (every component's "icon before the label" is
  `leading`, never `iconStart` in one and `prefix` in another).

---

## 6. How a component is BOTH server-rendered AND interactive (the wire integration)

The mechanism is already built (ADR-0001 + ADR-0019); the contract states how a v-next component plugs in.

- **Mount**: the server renders the WIRE template to HTML, stamping `data-lievit-component="<FQN>"`,
  `data-lievit-id="<cid>"`, `data-lievit-snapshot="<signed>"` on the root (ADR-0019 §root attributes).
- **Interact**: a `l:click="action"` / `l:submit` / `l:model="field"` / `l:keydown.enter` on an element
  is bound by the runtime's directive registry. A click serializes the snapshot, `POST /lievit/{id}/call`,
  the server re-runs the action (validation + authz in Java, BEFORE state mutates), re-renders the
  template, returns `text/html` + the rotated `Lievit-Snapshot`.
- **Patch**: the client morphs the new HTML into the live DOM (bespoke morph, identity-preserving: focus,
  selection, scroll, and what the user typed all survive). The component does nothing special; it just
  renders the right HTML for its current `@Wire` state every time.
- **Enhance (only where needed)**: a typed-TS enhancer adds the one irreducible client behavior (a drag
  handle that fires a wire action on drop; an OTP field that auto-advances and fires on complete) via the
  directive/lifecycle registries — never by editing the runtime core (ADR-0019: registry IS the API).

The invariant this buys: **a wire component cannot fail to project** (no client-side render of server data,
no `<slot>` that silently doesn't fill — the bug class the whole pivot killed). The server renders the
truth; the client only patches.

---

## 7. The conformance gate (so the contract is not just prose)

Per repo doctrine ("every rule lives at the most deterministic layer that can hold it"), the contract is
enforced, not trusted:

| Contract clause | Enforced by |
|---|---|
| reads `var(--lv-*)`, no literal colours | a token-lint (grep for hex/rgb/`oklch(` literals in component bodies) in CI |
| no `<script>` / inline `on*=` in a `.jte` | the existing anti-pattern grep |
| header doc-comment present + cites a source | a doc-header lint (extend the existing partial-header lint) |
| `@param` typed, no hardcoded option lists | review + the lint |
| a11y pattern holds | axe-core assertion + keyboard/focus test per component (§2.c) |
| JTE actually compiles + renders | the `test/jte-compile` real-compiler + render gate (already exists for ui + kit) |
| wire round-trip works on the REAL runtime | a render-asserting IT in `lievit-kit` per wire component (the `CollapsibleComponentIT` pattern) |
| variant/size/slot vocabulary is the shared one | review against this contract + the spec template's checklist |

A component is "done" only when its gate row is green — refute-by-default, not green-at-all-costs (§Phase 3
of `05-rebuild-workflow.md`).

---

## 8. Open decisions for Francesco (architecture-contract level)

- **D1 — DECIDED: OKLCH**. Colour tokens are authored in OKLCH (perceptually uniform, native 2026 browser
  support, better theming/contrast math, the shadcn-v4 default); hex only as a compiled fallback if a target
  ever needs it. The existing hex tokens migrate to OKLCH, values matched so the look is byte-stable. See §4.
- **D2 — enhancer count ceiling**: the single-source-a11y rule proposes ~3 net-new shared enhancers
  (`focus-trap`, `collection-nav`, and reuse of the popover seam). Confirm we are willing to own these as
  first-class runtime extensions (they are the react-aria interaction model, transcribed). Recommendation: yes.
- **D3 — "headless" exposure**: do we ever expose the behavior layer WITHOUT styling (a true headless mode
  for an adopter who wants their own markup)? In a server-first stack this means shipping the WIRE Java +
  the a11y enhancers but NOT the styled `.jte`. Recommendation: defer — the styled `.jte` IS the product;
  a headless-only mode is a long-tail option, not Phase-2 scope. Flag so it is a conscious cut.
