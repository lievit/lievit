# ADR-0070: The single-file DSL view parser/writer for the SFC<->MFC convert

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #141 asks for a `convert` command that transforms a component between the two authoring shapes
locked in ADR-0003: single-file (markup inline via the `dev.lievit.dsl.H` builder, ADR-0018) and
multi-file (a class + a JTE template). Converting *out of* single-file needs to read the
`@LievitRender Html view()` render expression (a tree of `H.*` factory calls with a fluent
`.attr(...)` / `.wireClick(...)` chain) and turn it into a neutral form; converting *into* single-file
needs to write that same form back out as a `H.*` expression.

There is no general Java parser on the build (no JavaParser dependency), and pulling one in for a CLI
convenience would be a heavy, GraalVM-hostile dependency for a tiny, fixed grammar.

## Decision

Ship a purpose-built `DslViewParser` + `DslViewWriter` in `lievit-compiler` (`dev.lievit.compiler.convert`)
that read and write exactly the curated DSL surface, not arbitrary Java:

- The parser is a small recursive-descent reader over the render expression: a factory name + its
  parenthesized arguments + a trailing fluent chain. `div(...)`/`el("tag", ...)` map to an element,
  `text("...")` to a literal, `text(expr)` to an expression node carrying the raw source, `raw("...")`
  to a raw node, and each `.attr(...)` / `.wireClick(...)` to a neutral attribute. Anything outside the
  surface (a `fragment(...)` root, an unknown factory, a non-DSL call) is **warn-and-skipped**.
- The writer is the exact inverse: an element renders as its named factory (`div(...)`) or `el("tag", ...)`,
  attributes render via the fluent wire helper when one exists (`wireClick`) else `.attr(...)`.

Both go through the engine-neutral `ViewNode` AST (ADR-0072), so a parse-write round-trip is a fixed
point. The convert deliberately emits/parses the DSL **as text**: the compiler never imports
`dev.lievit.dsl`, preserving its ArchUnit-enforced zero-DSL-dependency boundary (ADR-0023).

## Consequences

- The convert is faithful for the curated DSL surface and honest (warn+skip) outside it; it never
  emits wrong markup.
- The parser is a fixed small grammar, not a Java parser: it cannot handle a render method that
  computes markup with arbitrary Java (a loop building children). That is exactly the case ADR-0072
  warn-and-skips, which is the correct failure mode.
- No new dependency; GraalVM-native posture (ADR-0006) and the compiler module boundary unchanged.

## Alternatives considered

**Pull in JavaParser / a tree-sitter binding.** Rejected for v0.1: a heavy dependency on the CLI and
the compiler for a fixed, tiny grammar; it also fights the GraalVM-native goal. The purpose-built
reader is the dumbest thing that works (the Ronacher principle).

**Reflect the already-compiled component (the ComponentCompiler path).** Rejected: reflection gives
the metadata (fields, actions) but not the render method's *expression text*, which is exactly what a
source-to-source convert must rewrite. The convert is a source transform, not a runtime one.
