# ADR-0004: Engine-agnostic template adapters, JTE canonical primary

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

Spring applications render with several template engines. JTE is type-safe and the lievit
primary; Thymeleaf is the most common in the Spring base; Mustache and FreeMarker have real
installed bases; some teams render raw. lievit must not force a rewrite of an existing view
layer to adopt the wire runtime, but it also must not let every engine leak into the core.

## Decision

The wire runtime is **engine-agnostic** behind a template-adapter abstraction. v0.1 ships **five
first-class adapters**:

- **JTE** — canonical primary (type-safe, the documented default).
- **Thymeleaf** — covers ~80% of the Spring base.
- **Mustache**.
- **FreeMarker**.
- **raw**.

The adapters sit behind a single abstraction and **do not depend on one another** (ArchUnit-
enforced). The wire codec stays pure Java with zero template-engine knowledge.

## Consequences

- A team adopts lievit without abandoning its current view engine; JTE is recommended for the
  full type-safe experience but not required.
- The core and the codec stay free of engine coupling, which keeps GraalVM-native tree-shaking
  clean and the module graph acyclic.
- Five adapters is five things to test against the same contract. A shared adapter contract test
  suite keeps them honest; the cost is real but bounded.
- The split is what lets a consumer drag only the engine they use (see the packaging ADR-0008):
  shipping all five in one artifact would force unused engines onto every adopter.

## Alternatives considered

**JTE only.** Smallest surface, but excludes the large Thymeleaf base and forces a view rewrite
to adopt. Rejected: adoption friction is the wrong place to economize.

**A single mega-adapter with runtime engine detection.** One artifact, but it would pull every
engine onto the classpath and couple the core to all of them, hurting native tree-shaking.
Rejected in favour of separate, independent adapters.
