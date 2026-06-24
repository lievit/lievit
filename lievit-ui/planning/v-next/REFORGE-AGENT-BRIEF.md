<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Re-forge agent brief (read this fully before touching any file)

You are re-forging ONE lievit-ui presentational primitive to its v-next spec. Quality bar:
**React-Aria-grade accessibility, Ant-Design-grade feature completeness, Tailwind-UI-grade
styling** — all by ORIGINAL generation, never a literal copy of any source's code.

## CLEAN BREAK — no back-compat aliases (DECIDED, load-bearing)

This is a PRE-RELEASE branch that REPLACES the old primitives wholesale. There is no released
v-next API to preserve, no external consumer that breaks silently (copy-in adopters own their
copies; the import path does not exist yet; gest is re-aligned by its cutover; lievitKIT does not
exist yet). So:
- Re-forge each primitive to its **single cleanest v-next API**. Do NOT add back-compat aliases,
  legacy param names, or dual old/new paths "to keep callers working". One name per concept.
- The ONLY consumers of the current API are lievit-ui's OWN blocks in `registry/jte/blocks/`
  (app-shell, login, dashboard, signup) + `registry/jte/data-table*`. "Keep them working" means
  **MIGRATE them to the clean new API** in your report (list the exact call sites + the new call),
  NEVER contort the primitive to stay backward-compatible. They are the dogfood surface, not a
  frozen contract. The coordinator migrates the block call sites after the wave.
- If you find an existing back-compat alias layer on the primitive you're re-forging (e.g. dual
  param names), DELETE it and report the consumers to migrate.

Work in `/home/atelier/workspaces/iambilotta/lievit-vnext-build/lievit-ui`. `cd` there first.

## What you produce (your component ONLY)

1. `registry/jte/<name>.jte` — re-forged template.
2. `registry/jte/<name>/meta.json` — updated metadata (params, deps, enhancer, css).
3. `registry/jte/<name>.css` — only if the spec needs component-scoped CSS (most don't; tokens + utility classes cover it).
4. `test/<name>.test.ts` — vitest source-text assertions for the new surface (rename/extend the existing one).

## Read first (in this order)

1. `planning/v-next/specs/<name>.md` — YOUR component's spec. It is authoritative on variants, sizes, params, a11y, features. FOLLOW IT EXACTLY (variant names, size vocab, param names).
2. `planning/v-next/00-architecture-contract.md` — the component model, the token system, the 3 shared enhancers, the JTE conventions.
3. `planning/v-next/04-component-spec-template.md` — the section structure every component follows.
4. `registry/jte/<name>.jte` + its `meta.json` — the CURRENT primitive you are re-forging (preserve what is already correct; improve the rest).
5. `registry/tokens/lievit-tokens.css` — the token source of truth (OKLCH + hex fallback, `--lv-*`).
6. An already-re-forged exemplar to match house style: `registry/jte/badge.jte`, `registry/jte/switch.jte`, `registry/jte/alert.jte` (+ their meta.json + test).

## Overlay & stateful primitives: CONTROLLED / UNCONTROLLED (the tier doctrine — DECIDED)

An overlay (popover, dialog/modal, drawer/sheet, dropdown-menu, context-menu, menubar,
navigation-menu, hover-card, command, combobox) and any open/expand/active-state primitive
(tabs, accordion, wizard) is a **headless controlled/uncontrolled** component, NEVER a bespoke
WIRE component. The open/expand/active state is NOT owned by the overlay.

- **Uncontrolled = the default.** The trigger toggles a native `[popover]` (or the shared
  `popover-anchor.enhancer.ts`) CLIENT-side; zero-JS degrades; NO Java component; NO server
  round-trip just to open. This is how tooltip/hover-card/popover/dropdown-menu/context-menu/
  menubar/navigation-menu/alert-dialog(simple)/command(preloaded) work.
- **Controlled = opt-in via a plain `@param`.** Expose `open` (boolean, default false) as a
  `@param` the CALLER can bind to ITS OWN parent `@Wire` field — e.g. `open="${form.dialogOpen()}"`.
  The overlay stays a presentational shell: it does NOT declare a `@Wire` field, does NOT have its
  own Java component, does NOT take `_component`/`_instance`/`_componentSnapshot` params. The
  BUSINESS component that needs the overlay owns the open flag. This covers the only cases that
  justify server-owned open: (1) content fetched on open, (2) open must survive a round-trip
  (a form re-rendering with validation errors must STAY open = read-your-writes on `open`),
  (3) open is a genuine business fact.
- **Actions inside are already wire.** Menu items / buttons inside carry their own `l:click`/`href`
  — those are the server round-trips, and they work whether or not the overlay is controlled. Do
  NOT conflate "the items do server work" with "the open state must be server state".
- **Lazy content (optional):** an `hx-get` / `l:lazy` on the panel loads the body on first open;
  the overlay stays uncontrolled, only the content fetches.

DO NOT: shift an overlay/stateful primitive to a bespoke WIRE component; add `_component`/`_instance`/
`_componentSnapshot` params; remove the zero-JS native-popover/`<details>` baseline. The clean overlay
API is `trigger`/`content` Content slots + the `open` controlled boolean param; if a `registry/jte/blocks/`
consumer's call doesn't match the clean API, MIGRATE the consumer (report the call site + the new call),
do NOT add a back-compat alias (see "CLEAN BREAK" above). The parked WIRE drafts in
`planning/v-next/drafts/` are a reference for the CONTROLLED-mode markup ONLY (the `open`/`l:click`
wiring), not a template to ship as-is.

## HARD rules (lessons already paid for — violating these breaks the gate)

- **NEVER `@import io.lievit.*` in a `.jte`.** Templates are PRESENTATIONAL: every datum arrives via `@param` (a `String`, `boolean`, `List<String>`, `gg.jte.Content`, or `java.util.Map<String,String>`). The wire/stateful behavior lives in the Java component + runtime, NOT in the template. The JTE-compile gate classpath is JDK + jte + `registry/icons` only — an `io.lievit` import fails to resolve and reds the gate.
- **NEVER nest `<%-- ... --%>` inside the doc-comment block.** JTE comments do not nest; an inner `--%>` closes the outer comment early and everything after is mis-parsed as markup (this reds the gate with a bogus `Unclosed tag <...>`). In usage examples inside the comment, write `(decorative)` not `<%-- decorative --%>`, and never put raw `<Type,Type>` generics in the comment text (write "Map of String to String").
- **NEVER put `@if(...)` inside an HTML attribute NAME position.** JTE forbids `@if(x != null)attr="${x}" @endif` and reds the gate (`Illegal HTML attribute name @if`). Use **smart attributes** instead: `attr="${x}"` (JTE omits the attribute when the value is null); for a boolean, `disabled="${disabled}"` renders the bare attr when true and omits when false; for a conditional aria, `aria-required="${required ? "true" : null}"`; for a compound condition, `data-x="${cond ? value : null}"`. Smart attributes are the canonical JTE way to conditionally emit attributes.
- **`@template.lievit.icon(...)` takes ONLY `name`, `size`, `cssClass`, `label`.** There is NO `ariaHidden` param — icon renders `aria-hidden="true"` automatically when `label == null` (decorative by default). Passing any other param reds the gate (`No parameter with name X is defined in lievit/icon.jte`).
- **NEVER put an expression in an HTML TAG NAME.** JTE forbids `<${as}>`, `<${titleTag}>`, `</${x}>` (`Illegal HTML tag name`). The root element must be a literal tag. For a configurable LANDMARK use a fixed tag + a `role` attribute (`<div role="${"section".equals(as) ? "region" : null}">`). For a configurable HEADING LEVEL use `<div role="heading" aria-level="${level}">`, never `<h${n}>`. Tag names are static; only attribute VALUES may be expressions.
- **NEVER split one HTML element across `@if`/`@else` branches.** JTE's HTML balance checker rejects opening a tag in one branch and closing it in another (`Unclosed tag <X>, expected </X>, got </Y>`). To make an element conditionally a LINK, do NOT wrap it with a split `<a>…</a>`; use the stretched-link pattern instead: keep ONE balanced root, set it `position:relative`, and put a self-contained `<a class="absolute inset-0" aria-label="…"></a>` INSIDE it under `@if`. Every `@if`/`@else` branch must contain only fully-balanced tags.
- **NEVER edit a SHARED test file** (`test/jte-static-partials.test.ts`, `test/static-partials-*.test.ts`, `test/tier4-components.test.ts`, `test/card-pad.test.ts`, and any file holding assertions for components other than yours). Multiple agents run in parallel; concurrent edits to a shared file clobber each other. Put your component's NEW tests in `test/<name>.test.ts` (create it). If a SHARED file asserts your component's OLD surface, do NOT touch it — list it under TEST_RECONCILE and the coordinator reconciles all shared files serially after the wave.
- **Prefer inlining a TRIVIAL visual bit over composing a sub-partial.** Composing `@template.lievit.<other>(...)` creates a hard cross-partial dependency: the adopter must copy that partial too, and a flat-resolver render test (e.g. `XssEscapingTest` renders your partial standalone) fails to resolve `lievit/<other>.jte`. For a trivial element (a loading spinner ring, a check glyph), inline the markup (a `<span class="animate-spin ...">`, an inline `<svg>`) so the component stays self-contained. Only compose a sub-partial when it carries real, non-trivial shared logic AND you record the dependency in meta.json `registryDependencies`.
- **NEVER invent a token.** If the spec names a token, grep `registry/tokens/lievit-tokens.css` to confirm it exists. If a genuinely-needed token is missing, DO NOT add it — list it in your final report under `TOKENS_NEEDED:` and use the closest existing token meanwhile. The coordinator reconciles tokens centrally (parallel agents clobber each other's token edits).
- **NEVER edit a shared enhancer** (`runtime/features/{focus-trap,collection-nav,popover-anchor}.enhancer.ts`) or `runtime/features/index.ts`. If your component needs a shared-enhancer behavior that does not exist yet, describe it in your report under `ENHANCER_NEEDED:` (component, behavior, the data-attribute contract you want). The coordinator extends the shared enhancer once, correctly. You MAY create a NEW component-specific enhancer `runtime/features/<name>.enhancer.ts` if the spec calls for one that is not shared (and note it in your report so the coordinator registers it in index.ts).
- **NEVER touch** `registry/registry.json` (generated), `test/jte-compile/**` (coordinator owns the facade test), or any OTHER component's files.
- **Follow the spec's variant/size/param vocabulary verbatim.** E.g. variants are `default`/`destructive` (not neutral/danger); font-weight token is `--lv-font-medium` (not `--lv-font-weight-medium`); non-form-control sizes use the spec's size vocab. The consistency report (`planning/v-next/06-spec-consistency-report.md`) lists the corrected vocab — apply it.
- **CSP-safe**: no inline `<script>`, no `on*=` handlers, no inline styles that carry logic. Behavior lives in a TS enhancer.
- **Escaping**: user-supplied strings go through JTE's default HTML escaping; never `$unsafe`. Build attribute strings carefully (the exemplars show the channels).

## Accessibility (the React-Aria bar)

Match the WAI-ARIA APG pattern the spec cites. Correct roles, states (`aria-*`), keyboard interaction model. Where the spec says a shared enhancer provides roving/trap/anchor, wire the template to it via the documented `data-lievit-*` attributes (see how `switch`/`tabs` reference enhancers) — do NOT hand-roll keyboard logic the shared enhancer owns.

## Self-verification before you report done

- `npx tsc --noEmit` clean (if you wrote/changed any `.ts`).
- `npx vitest run test/<name>.test.ts` green for your component.
- You CANNOT run the JTE-compile gate (it is per-wave, heavy, coordinator-run). So DOUBLE-CHECK the two JTE hazards above by eye: no `io.lievit` import, no nested `--%>`, balanced `@param`/`@if`/`@for`/`@endif`/`@endfor`, every `${}` expression valid Java.

## Your final report (structured, the coordinator parses it)

```
COMPONENT: <name>
STATUS: done | blocked
FILES: <paths you wrote>
SPEC_DELTAS: <what you changed vs the old primitive, 1 line each>
TOKENS_NEEDED: <none | token-name: purpose>
ENHANCER_NEEDED: <none | shared-enhancer: behavior + data-attr contract>
NEW_ENHANCER: <none | runtime/features/<name>.enhancer.ts — register in index.ts>
INTERNAL_CONSUMERS: <none | the registry/jte/*.jte files that call @template.lievit.<name>( and whether your API change breaks them — grep `@template.lievit.<name>(` across registry/jte/ and report each caller + the params it passes that you removed/renamed>
TEST_RECONCILE: <none | other test files that assert the old surface and will break>
REMOVED_CAPABILITIES: <none | capability removed from the old primitive + where it now lives>
NOTES: <collisions, spec ambiguities you resolved, anything the coordinator must know>
```
