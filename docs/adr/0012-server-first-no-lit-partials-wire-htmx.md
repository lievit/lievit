# ADR 0012: lievit-ui is a SERVER component library (JTE partials + lievit-wire + htmx); drop the Lit client islands

- Status: ACCEPTED (Francesco's decision, 2026-06-19)
- Supersedes in part: ADR-0009 (copy-in registry) + ADR-0011 (v0.1 registry decisions) - the copy-in unit becomes a server partial / wire component, not a Lit client island.
- Relates: ADR-0001 (wire protocol), ADR-0005 (theming zero-css-default).

## Context

lievit-ui v2 shipped 46 client components as light-DOM Lit web-components. In production this surfaced a fundamental, SILENT bug: light-DOM custom elements use native `<slot>`, which is inert without a shadow root, so slotted content (button labels, badge text, popover/dialog bodies) was never projected. No console error, no failed test (tests asserted template structure, not projected DOM) - a textbook silent failure. Root reasons, beyond the one bug:
- Client-rendered components can fail SEMANTICALLY in silence (run without error, render wrong); only render/projection-asserting tests or a visual/E2E layer catch it, and we had neither.
- light-DOM Lit + manual slot projection is a thin training area (for the model and the ecosystem) -> high subtle-bug risk.
- lievit IS Livewire-for-Spring: a component's state + actions can live SERVER-SIDE in Java (typed, testable), with the client only morphing the re-rendered HTML. Most "interactivity" the Lit islands implemented client-side is better done server-side via wire.
- The operating context is an internal gestionale, one operator + AI, where predictability + standardization + maintainability outweigh client-UX richness.

## Decision

lievit-ui becomes a SERVER component library. One predictable model, convention-driven, copy-in on BOTH layers (UI markup AND server component).

- **Presentation** -> JTE partials (plain HTML + Tailwind v4 + `--lv-*` tokens). Zero JS. Cannot fail silently.
- **Stateful interactivity** -> lievit-wire (a Java component + `l:*` directives; state/actions/validation/authz in Java; server re-renders, client morphs). Logic is typed Java.
- **Simple server swaps** (load-more, tab content, filtered dropdown, typeahead) -> htmx (the canonical pattern; wire is the richer stateful version).
- **Rare pure-client micro-state** (a toggle with no server value) -> a small typed vanilla TS module (CSP-clean, the existing gest pattern). NOT Alpine (its expression engine needs eval, which the strict CSP `script-src 'self'` blocks; and it is stringly-typed).
- **NO Lit client islands as the shipped model.** The 46 islands are reclassified: most -> JTE partials, the interactive ones -> wire components / htmx patterns, a few dropped. Lit is not a tier of the library.
- **Convention-driven + copy-in**: a predictable structure per component (the partial, the optional wire component + its template, the meta) so `lievit add <component>` copies source the adopter OWNS and edits, on both UI and server side.
- **Escape hatch (not the default)**: because everything is copy-in source, an adopter MAY drop in a client component (Lit or vanilla) for a single genuinely-heavy widget (e.g. a drag-resize calendar). lievit-ui does not ship one; it documents the seam.

## Type-safety

The contract lives in Java: wire components + JTE `@param` are typed and tested; htmx moves server-rendered HTML produced from typed Java. The only untyped surface is the HTML fragment shape, rendered from typed inputs. This is strictly more type-safe than client components whose DOM projection is not type-checked (the slot bug) and far more than Alpine (JS-in-attributes, stringly-typed).

## Consequences

- Pro: one model, predictable; logic in typed Java (the strongest surface); no silent client-render failures; no thin-training-area; convention-driven copy-in on both layers; smaller shipped surface; aligns with where server-rendered web converges (htmx, Hotwire/Livewire, LiveView, islands, even React Server Components).
- Con: genuinely client-heavy UX (sub-100ms typeahead, drag-resize calendar, client-sort grids) becomes a server round-trip and loses some snappiness. ACCEPTED for an internal tool; the escape hatch covers the rare exception. Over-wiring (a server round-trip per keystroke) must be avoided: wire for meaningful interactions, debounce/enhance the hot paths.
- The 46 Lit islands are reclassified/removed - a large, interconnected refactor (the kit renders some of them, e.g. `Cell.Badge` -> `<lv-badge>`; blocks compose them; gest consumes them). Executed as a planned, phased, coordinated refactor (the blueprint), not a blind fan-out.

## Alternatives considered (steelmanned)

- **Keep Lit for the ~5 heavy widgets** (calendar, rich-select, data-grid, command, chart). Rejected: Francesco chose full standardization + predictability over a hybrid; the calendar is the only real UX loss and the escape hatch covers it; a hybrid keeps the thin-training + silent-failure surface alive for those 5.
- **Keep web-components for framework-agnostic distribution.** Rejected: the winning copy-in model (shadcn) is copy-in MARKUP you own, not runtime web-components; server-first is where the ecosystem converges; agnosticism is not a goal that outweighs predictability here.
- **Fix the slot projection and keep all islands** (the immediate patch). Rejected as the END state: it keeps client-rendering silent-failure risk + the thin-training area; it was the stop-gap, not the to-be.
