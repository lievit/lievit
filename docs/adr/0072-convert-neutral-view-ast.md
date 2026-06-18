# ADR-0072: A neutral view AST + the ViewConverter facade for the convert

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

The SFC<->MFC convert (issue #141) is bidirectional: single-file DSL <-> multi-file JTE template. A
naive design would write four direct translators (DSL->JTE, JTE->DSL, and the two class rewrites),
which double-counts the markup mapping and makes round-trip stability an accident rather than a
property. The convert must be **faithful and idempotent**: converting A->B->A must yield the original.

## Decision

Pivot every direction on a single engine-neutral view AST and a thin facade:

- **`ViewNode`** (sealed: `Element` / `Literal` / `Expression` / `Raw`) + **`ViewAttribute`**
  (literal / dynamic / boolean) is the one intermediate representation. Both shapes are parsed *into*
  it and written *out of* it (ADR-0070 for the DSL, ADR-0071 for JTE). Round-trip stability is then a
  property of the AST being a fixed point, proven by golden round-trip tests on both writers, not an
  emergent hope.
- **`ViewConverter`** is the whole-component facade: it detects a component's shape from its source,
  runs the right parse + write for the markup, and applies a **targeted text rewrite** of the Java
  class for the wiring (edit the `@LievitComponent` annotation, add/remove the `@LievitRender Html
  view()` method, add/drop the DSL imports). Everything else in the class (fields, actions, lifecycle
  hooks, javadoc) is preserved verbatim, because the rewrite touches only the three regions the convert
  owns.
- **`@param` header** of a generated template is derived from the class's `@Wire` fields (ADR-0071), so
  the two shapes cannot drift.
- **Warn-and-skip** is surfaced through `ParsedView` / `ConvertResult` carrying `ConversionWarning`s;
  the convert applies the safe parts and the caller decides whether a lossy convert proceeds (ADR-0074).

## Consequences

- Adding a third authoring shape later (e.g. a Thymeleaf template) is one new parser + writer against
  the same AST, not a new pair of direct translators per existing shape.
- Idempotency is structural and test-pinned (`ViewConverterTest#round_trip_is_idempotent_on_the_view`).
- The class rewrite is text-targeted, not a full Java reparse, so it is dependency-free and preserves
  authored code exactly; the cost is that it relies on the conventional shape of a lievit component
  (the `@LievitComponent` annotation, a single `@LievitRender` render method), which is the only shape
  the scaffold emits.

## Alternatives considered

**Four direct translators, no neutral AST.** Rejected: duplicates the markup mapping and makes
round-trip stability accidental.

**Rewrite the class via a full Java parser.** Rejected for v0.1 (same reasoning as ADR-0070): a heavy
dependency for a transform that only ever edits three well-known regions of a conventionally-shaped
class.
