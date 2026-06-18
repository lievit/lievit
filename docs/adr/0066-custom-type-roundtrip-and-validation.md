# ADR-0066: Custom serializable property types — round-trip closure and nested-path validation

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta
- **Issues:** #139 (Epic #34)

## Context

ADR-0020 shipped the synthesizer registry + the `Wireable` SPI, and ADR-0021 the
`ClassInstantiationGuard`. Together they already let an adopter put a non-primitive value object in a
`@Wire` field and have it round-trip: a `Wireable` type controls its own JSON-shaped representation
(`toWire()` / static `fromWire(Object)`), the `RecordSynthesizer` covers records reflectively (the
Livewire `StdClassSynth` analogue), and the guard gates the concrete type a tuple names.

Issue #139 (the custom-serializable-types feature) has three acceptance criteria the machinery
*supports* but that were not pinned by tests, so they were not guaranteed: a nested `Wireable` must
round-trip every level, hydration must validate the stored type implements the interface (reject a
forged class), and validation must report at the correct nested dotted path against the value's
unwrapped form. The risk of leaving these unpinned is a silent regression that re-opens the
deserialization hole ADR-0013/0021 closed, or a validation path that reports the wrong key.

## Decision

lievit treats #139 as a closure of the ADR-0020/0021 design, pinned by tests, with no new public API
(the seven-annotation cap of ADR-0002 holds; `Wireable` is a runtime interface).

- **Nested custom types round-trip.** A `Wireable` whose `toWire()` data nests another `Wireable`
  (or a record) dehydrates and hydrates every level via the registry's recursion. Pinned at the
  registry level and end-to-end through the dispatcher (`mount` → tuple → `call` → exact type).
- **Hydrate validates the stored type.** The `wireable` synth refuses a tuple whose `t` does not
  implement `Wireable`, and the `ClassInstantiationGuard` refuses a `t` on a denied root before any
  reflection — a forged snapshot naming `java.lang.Runtime` (or any non-`Wireable` class) is a
  `FORBIDDEN_DESERIALIZATION` (422, ADR-0014), never a constructed object. This is the explicit
  "no deserialization hole" guarantee #139 asks for, now under test at both the registry and the
  dispatcher boundary.
- **Validation reports at the nested dotted path.** A custom-type field carries its own Bean
  Validation constraints; `@Valid` cascades into it and the `BeanValidationFieldValidator` keys each
  violation by its property path (`account.iban`) — the same path a `l:model="account.iban"` binds.
  `validateOnly` surfaces exactly the bound sub-path for a real-time per-field update (ADR-0038). The
  canonical Bean Validation cascade *is* the unwrap: the error reports where the client wrote, with no
  parallel validation engine.

## Consequences

- The custom-serializable-type feature is now a guaranteed, tested capability, not just a latent one:
  an adopter's value object round-trips (whole-object and nested), validates at the right path, and a
  forged class is rejected.
- The security boundary is preserved exactly. The HMAC stops tampering, the ADR-0013 allowlist stops
  typed `d` deserialization, and the ADR-0021 guard stops dangerous `t` instantiation — the three
  remain orthogonal, and the new tests assert the guard fires on the custom-type path specifically.
- No production code beyond the test seam was needed for the `Wireable` half of #139 (it was already
  built); the registry change in this release is the `DynamicObject` registration (ADR-0065). This
  ADR records the decision that #139 closes by pinning behavior, so a future reader knows the
  acceptance criteria are guarded by tests, not by hope.

## Alternatives considered

**Add a positive config-driven allowlist of instantiable custom types.** ADR-0021 already considered
and deferred this: it breaks the zero-config promise (every app would register its value objects
before they round-trip). The default-deny-by-root + application-package pass-through stands;
revisit only if a deployment wants to lock down further. Rejected for v0.1.

**Introduce an `unwrap-for-validation` hook that validates the `toWire()` array form.** Livewire
validates the dehydrated array. On the JVM the idiomatic and safer path is Bean Validation cascading
into the live typed object via `@Valid`, which already reports at the dotted path. Adding a parallel
array-validation engine would duplicate the rules and risk drift between the bound path and the
reported path. Rejected: the cascade is the unwrap.
