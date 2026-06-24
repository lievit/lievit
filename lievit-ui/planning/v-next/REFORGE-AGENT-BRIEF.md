<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Re-forge agent brief (read this fully before touching any file)

You are re-forging ONE lievit-ui presentational primitive to its v-next spec. Quality bar:
**React-Aria-grade accessibility, Ant-Design-grade feature completeness, Tailwind-UI-grade
styling** — all by ORIGINAL generation, never a literal copy of any source's code.

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

## HARD rules (lessons already paid for — violating these breaks the gate)

- **NEVER `@import io.lievit.*` in a `.jte`.** Templates are PRESENTATIONAL: every datum arrives via `@param` (a `String`, `boolean`, `List<String>`, `gg.jte.Content`, or `java.util.Map<String,String>`). The wire/stateful behavior lives in the Java component + runtime, NOT in the template. The JTE-compile gate classpath is JDK + jte + `registry/icons` only — an `io.lievit` import fails to resolve and reds the gate.
- **NEVER nest `<%-- ... --%>` inside the doc-comment block.** JTE comments do not nest; an inner `--%>` closes the outer comment early and everything after is mis-parsed as markup (this reds the gate with a bogus `Unclosed tag <...>`). In usage examples inside the comment, write `(decorative)` not `<%-- decorative --%>`, and never put raw `<Type,Type>` generics in the comment text (write "Map of String to String").
- **NEVER put `@if(...)` inside an HTML attribute NAME position.** JTE forbids `@if(x != null)attr="${x}" @endif` and reds the gate (`Illegal HTML attribute name @if`). Use **smart attributes** instead: `attr="${x}"` (JTE omits the attribute when the value is null); for a boolean, `disabled="${disabled}"` renders the bare attr when true and omits when false; for a conditional aria, `aria-required="${required ? "true" : null}"`; for a compound condition, `data-x="${cond ? value : null}"`. Smart attributes are the canonical JTE way to conditionally emit attributes.
- **`@template.lievit.icon(...)` takes ONLY `name`, `size`, `cssClass`, `label`.** There is NO `ariaHidden` param — icon renders `aria-hidden="true"` automatically when `label == null` (decorative by default). Passing any other param reds the gate (`No parameter with name X is defined in lievit/icon.jte`).
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
