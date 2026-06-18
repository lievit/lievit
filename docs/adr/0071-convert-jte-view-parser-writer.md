# ADR-0071: The JTE template view parser/writer for the SFC<->MFC convert

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

The MFC half of the issue #141 convert reads and writes a JTE template body (the multi-file markup
shape, ADR-0003/0004). Converting *out of* multi-file parses the template into the neutral `ViewNode`
AST (ADR-0072); converting *into* multi-file writes the AST back to a JTE body. As with the DSL side
(ADR-0070), there is no general JTE/HTML parser available, and a component template uses only a small,
predictable subset of JTE.

A template also carries a `@import`/`@param` header. That header restates the component's `@Wire`
fields; if the convert carried it through the AST, the two shapes could drift (a field renamed on one
side but not the other).

## Decision

Ship a purpose-built `JteViewParser` + `JteViewWriter` in `lievit-compiler` covering exactly the markup
a lievit component template uses:

- **Header dropped, re-derived.** The parser strips `@import`/`@param`; the writer emits only the
  markup body. The convert command regenerates the `@param` header from the component's `@Wire` fields
  (ADR-0072), so the header is a projection of the class, never a second source of truth.
- **Markup mapping.** Elements parse into `ViewNode.Element` (void elements self-close), text into a
  literal, `${expr}` into an expression node carrying the raw source, `$unsafe{...}` into a raw node;
  `l:*` / literal / `${...}` attributes split into neutral attributes. Insignificant whitespace is
  collapsed so the round-trip is a fixed point.
- **Control blocks warn-and-skipped.** A JTE `@if` / `@for` / `@template.*` block has no faithful
  single-file equivalent in the curated DSL, so it is dropped with a warning rather than guessed; the
  safe markup around it still converts.

The writer is the inverse of the parser; both pivot on the same `ViewNode` AST, so parse-write-parse is
a fixed point.

## Consequences

- The convert is faithful for the static-markup subset (the common component template) and honest about
  control flow (warn+skip), which is the correct boundary: control flow in a template maps to Java in
  the class, not to the DSL markup tree.
- The `@param` header can never drift from the `@Wire` fields, because it is regenerated, not carried.
- No new dependency; the compiler stays pure Java (the JTE engine itself is not on the compiler's
  classpath, only its template *text* is parsed).

## Alternatives considered

**Reuse the real JTE compiler to parse the template.** Rejected: JTE compiles to Java, it does not
expose a reusable HTML+directive AST for a source-to-source transform, and it would couple the compiler
module to the JTE engine (an adapter), breaking the ADR-0004 boundary.

**Carry the `@param` header through the AST.** Rejected: it duplicates the `@Wire` fields and invites
drift; regenerating it from the class is true-by-maintenance.
