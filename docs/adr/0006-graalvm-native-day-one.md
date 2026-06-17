# ADR-0006: GraalVM native day one, zero runtime reflection

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

The target deployment is scale-out and scale-to-zero (a stateless wire runtime fronting public
traffic). On the JVM, cold start is the enemy of scale-to-zero. GraalVM native images give
sub-50 ms startup and a small memory footprint, but only if the library is built for them from
the start: reflection and runtime classpath scanning are added later, they are very hard to
retrofit out. Spring Boot 4 + Spring AOT make native a first-class path when a library cooperates.

## Decision

lievit targets **GraalVM native from day one**, with **zero runtime reflection**.

- Wiring that other frameworks do via runtime reflection is done at **compile time** via
  annotation processing (APT) plus Spring AOT hints.
- The GraalVM-native build is a **green CI gate**, not an afterthought: the matrix covers the
  supported JDK / LTS / OS-arch combinations.
- Packaging is Spring Boot native + Distroless multi-arch. lievit is a library, so it does not
  ship a standalone container; it ships so that the adopter's native build just works.

## Consequences

- Cold-start and memory budgets (native startup < 50 ms, resting memory < 60 MB) are achievable,
  which is what makes scale-to-zero real.
- Every feature must be reflection-free or supply its AOT hints. This constrains the design
  (no runtime classpath scanning, no reflective field access without a registered hint) and is
  enforced continuously by the native CI gate.
- The native build matrix has a real CI cost and lengthens the pipeline. Accepted: native is a
  positioning pillar versus Vaadin Flow and the JVM incumbents.

## Alternatives considered

**JVM-first, native "later".** The common path. In practice "later" means a painful retrofit
because reflection has already spread through the codebase. Rejected: the constraint is cheap to
hold from the start and expensive to add afterward.

**Native-only (drop the JVM path).** Too aggressive: many adopters run on the JVM and the JVM
path must stay first-class. lievit supports both; native is the gate that keeps the codebase
honest.
