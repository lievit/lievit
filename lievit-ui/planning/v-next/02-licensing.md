<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 02 — Licensing: the ONE bright line (no literal code-copy)

STATUS: blueprint, 2026-06-23. **DECIDED (Francesco, D8).** lievit is a PUBLIC OSS repo under
**Apache-2.0** (`LICENSE` at the repo root). Every component v-next ships is **LLM-GENERATED ORIGINAL
markup and code**. It takes PATTERNS as ideas (a11y semantics from react-aria; the component
inventory + variant surface from Ant Design) and VISUAL STYLE as inspiration (the Tailwind UI look),
but it NEVER copies code. The output is always original generation.

The legal reality this rests on: look-and-feel / visual style is not copyrightable; independently
generated original code is not a derivative work even when it visually resembles a paid product
(~95% the same look is fine — the look is not the protected thing, the literal expression is).

## The whole gate, in one rule

> **NEVER literal code-copy from any source.** No paste of react-aria source, no paste of Ant Design
> source, no paste of Tailwind UI markup / class strings / component code. Reading any of them as a
> REFERENCE for a pattern or a look is fine; the output is always original generation over our own
> `--lv-*` tokens + the WAI-ARIA APG structure.

That is the entire discipline. The three named sources are PATTERN / STYLE references, not code we
adapt:

| Source | What we take | How |
|---|---|---|
| **React Aria** (Adobe) | the a11y interaction PATTERN (keyboard maps, focus order, ARIA wiring) as an idea | read the spec, generate ORIGINAL vanilla-TS/JTE; no react-aria source copied |
| **Ant Design** (Ant Group) | the component INVENTORY + variant/feature ideas | read the inventory, generate ORIGINAL components; no antd source copied |
| **Tailwind UI / Tailwind Plus** (Tailwind Labs) | the visual STYLE / look (density, polish, rhythm) as inspiration | implement the look ORIGINALLY over `--lv-*`; Tailwind UI is **inspiration-only, never code** |

Because nothing is code-adapted, there is no per-component code provenance to track and no
adapted-code license text to carry. The heavy NOTICE / per-component provenance machinery a derivation
model would need does NOT apply here.

## Courtesy credits (the only attribution we keep)

We are not legally required to attribute pattern references, but a short courtesy note is good OSS
manners and documents where the a11y / inventory ideas came from. Keep ONE optional `CREDITS.md` (or a
short "Inspiration & references" section in the README) naming react-aria, Ant Design, and Tailwind UI
as references that informed the design. No `/NOTICE`, no `licenses/` bundle, no per-component
provenance gate.

## The component header line (kept, but light)

Each component's JTE header already cites the pattern source it mapped (architecture contract §3) —
e.g. "a11y: WAI-ARIA APG Dialog + react-aria interaction model; styling: original over `--lv-*`,
Tailwind-UI look". This is a DESIGN-DOCUMENTATION line (where the idea came from, useful to the
maintainer), not a legal provenance record and not a CI-gated obligation. It stays because it makes
the a11y source grep-able for the next maintainer, not because licensing requires it. The spec
template's `@provenance` block (`04`) is read the same way: a credits/discipline note, not a
contamination ledger.

## The Tailwind UI line, spelled out (the one place to be careful)

Tailwind UI / Tailwind Plus is a paid product. Its value to us is the LOOK, which is not copyrightable.
The discipline:

- **Take the look as inspiration**, generate every pixel ORIGINALLY over `--lv-*` + the APG structure.
  A generated original component that visually resembles a Tailwind UI screen ~95% is fine.
- **Never paste** Tailwind UI markup or class strings into a file. That is the one literal-copy line,
  and it is the same line that applies to react-aria and antd source.
- An agent implementing a component is told (spec template, `04`): "you MAY read react-aria / Ant
  Design / Tailwind UI as references for pattern + look; you MUST NOT paste their source — generate
  original code over `--lv-*`." That single instruction carries the whole licensing posture.

## What we removed (and why it was over-built)

The previous draft modeled lievit as ADAPTING react-aria + Ant Design CODE, which forced a derivation
machine: a `/NOTICE` file, a bundled `THIRD-PARTY-LICENSES`, a mandatory per-component `@provenance`
licensing gate, a packaging test, and a CI grep. None of that is needed under Francesco's ruling: we
do not adapt code, we generate original code from patterns. Removing the machinery is not a weakening
— it matches the actual legal model (original generation, no derivation), so there is nothing to
attribute and nothing to ship licenses for. The one rule that remains (no literal code-copy) is the
only one that ever mattered.

---

## Open decisions for Francesco (licensing)

- **D8 — DECIDED**: every component is original LLM generation from patterns + look; the only rule is
  "no literal code-copy from any source"; Tailwind UI is inspiration-only; courtesy credits in
  `CREDITS.md`/README, no NOTICE / per-component provenance machinery.
- **D9, D10 — CLOSED by D8**: there is no react-aria-CODE-vs-SPEC choice (we never adapt code, only
  read patterns) and no lawyer-pass-on-attribution-mechanics question (there is no attribution
  machinery to vet). The model is the simplest, safest one: original generation, one bright line.
