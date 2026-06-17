# ADR-0007: No-compromise quality gates

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

lievit is an authority asset: its credibility is the product. It is also a security-load-bearing
runtime (it signs state that crosses a trust boundary). "Vibe-coded" is an explicit anti-pattern.
The bar has to be set once, high, and enforced mechanically, not left to discipline.

## Decision

lievit ships under no-compromise quality gates, all CI-enforced:

- **Coverage**: 100% of the logic and 100% of the wire protocol.
- **Mutation testing**: Pitest >= 75%.
- **Fuzzing**: jazzer, zero crashes over 24 h.
- **Property-based**: jqwik, zero falsifications on the codec, checksum, and signing.
- **Null safety**: zero NPE, NullAway gate (JSpecify `@Nullable`).
- **Native**: a green GraalVM-native CI matrix.
- **Boundaries**: ArchUnit rules enforce the module graph (wire codec pure-Java zero-Spring;
  template adapters independent of each other).
- **External pen-test**: a Cure53-grade external penetration test with zero critical findings is
  a gate before any public Maven Central distribution (budget 3-7k EUR).
- **Golden roundtrip**: `(request, response.html, response.snapshot.jwt)` triples are byte-
  checked. Browser tests locate by role / text, never by CSS selector.

**Performance budget** (enforced, not aspirational): wire p50 < 5 ms / p99 < 20 ms, payload
< 2 kb compressed, client bundle < 80 kb, native startup < 50 ms, resting memory < 60 MB.

Development is contract-first and test-driven: a frozen spec becomes a failing test, then minimal
code to green, then refactor while green, with traceability from requirement to test.

## Consequences

- The gates make "looks done" and "is done" the same thing, which is the credibility the asset
  trades on. The wire protocol in particular cannot regress silently.
- Holding 100% coverage plus mutation plus fuzz plus property-based plus native is a heavy CI
  cost and a real authoring discipline. Accepted deliberately: it is the moat.
- The pen-test gate ties the public-distribution timeline to an external dependency and a budget.
  This is by design: shipping a signing runtime publicly without an external review is not on the
  table.

## Alternatives considered

**Pragmatic coverage (e.g. 80%) and skip mutation / fuzz.** Cheaper and faster, but for a
security-load-bearing authority asset the gap between 80% and verified-everywhere is exactly where
the embarrassing bug lives. Rejected.

**Defer the external pen-test to post-launch.** Lower upfront cost, but publishing a snapshot-
signing library without an external review undermines the EU-grade positioning. Rejected as a
pre-public gate.
