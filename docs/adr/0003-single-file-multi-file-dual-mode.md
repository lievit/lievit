# ADR-0003: Single-file and multi-file authoring, both type-safe

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

A component has logic (a Java class) and markup (a template). Two authoring shapes are common:
colocated single-file (logic and markup in one file, Livewire Volt style) and split multi-file
(class plus a separate template). The Volt single-file experience is loved for ergonomics, but
in PHP it is not compiled, so the markup is not type-checked. lievit's whole differentiation is
type-safety; the single-file shape must not be the place where it is lost.

## Decision

Ship **both** authoring modes from v0.1, and both are **type-safe**. The component logic is
always a typed Java class.

- **Single-file**: a `.java` class with the template inline via a **typed HTML DSL**
  (HtmlFlow / j2html style), e.g. `div(span(text(count)))`. Type-safe **by construction**: the
  Java compiler verifies the markup. No JTE involved. One file, colocation.
- **Multi-file**: a `.java` class plus a separate **JTE** template, type-safe via annotation
  processing, friendlier for HTML-heavy or designer-authored markup.

The difference between the two is ergonomics (a DSL versus an HTML file), **not** type-safety.
The only way the single-file shape would lose type-safety is a raw text block with no checker,
and that is explicitly not a supported path.

## Consequences

- Reactive, single-file, type-safe components become the hard differentiator versus Volt / PHP,
  which cannot offer compile-time-checked single-file markup because PHP is not compiled.
- Two authoring surfaces means two things to document and test. The cost is accepted because
  both serve a real preference (colocation versus HTML-first authoring).
- The typed HTML DSL is a dependency and a learning surface of its own for single-file users.
  Multi-file (JTE) remains the path for anyone who prefers to write plain HTML.

## Alternatives considered

**Single-file only (Volt-style).** Maximal colocation, but either drops type-safety (raw text
block) or forces the DSL on everyone. Rejected: HTML-first authors are a real audience.

**Multi-file only.** Simpler to build, but gives up the single-file differentiator that no PHP
tool can match. Rejected: the differentiator is worth the second surface.

**Single-file via raw text-block templates.** Colocated and simple, but unchecked: it is exactly
the type-safety hole the project exists to avoid. Rejected as a supported path.
