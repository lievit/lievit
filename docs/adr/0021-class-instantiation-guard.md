# ADR-0021: Class-instantiation guard for the synthesizer path

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

ADR-0020 adds the typed-state round-trip: a non-primitive `@Wire` value dehydrates to a tuple
`{ "@w": { "d", "s", "t" } }` where `t` names the concrete class a synthesizer reflectively
reconstructs on hydrate. That reflective instantiation is a new surface: a forged-or-leaked
snapshot could name a dangerous class in `t` and induce its construction.

ADR-0013 deliberately rejected a *gadget denylist* for the field-value path, inverting it to a
JSON-shape *allowlist* (nothing typed deserializes at all). That decision still holds for the `d`
payload — it is plain JSON. But the synthesizer path (ADR-0020) does reflectively construct a class
named in `t`, so the denylist Livewire keeps (`SecurityPolicy.php`, consulted before any synth
instantiates) becomes relevant again, as the defense-in-depth layer behind the HMAC for *that one
path*. Issue #165 scopes this to exactly the new part: the existing HMAC checksum, `PayloadGuard`,
and `ChecksumFailureLimiter` are already shipped and unchanged.

## Decision

lievit adds a `ClassInstantiationGuard` (`io.lievit.wire.synth`, pure Java) consulted before *any*
synthesizer reflectively instantiates the class named in a tuple's `t`:

- **Default-deny by package prefix.** A small, hardcoded denylist of JVM gadget-prone roots
  (`java.lang.Runtime`, `java.lang.ProcessBuilder`, `java.io.`, `java.net.`, `java.nio.file.`,
  `javax.naming.`, `javax.script.`, `jakarta.`, `org.springframework.context.`,
  `com.sun.`, `sun.`, `jdk.`, `javassist.`, `org.apache.commons.collections.functors.`,
  `groovy.`, `bsh.`, `org.codehaus.groovy.`) refuses instantiation outright.
- **Class object guard.** Beyond the package roots, the guard refuses any class that is not a
  concrete, non-abstract, non-`Class`/non-`ClassLoader`/non-`Thread` type, and refuses
  `java.*` / `javax.*` / `jakarta.*` classes that are not on the synth registry's own known-safe
  set (the temporals, `BigDecimal`, `UUID`, the collection impls the synths produce). A user
  value object (the common case) is in the application's own package and passes.
- **Fail-closed.** A denied `t` is a `FORBIDDEN_DESERIALIZATION` (422, ADR-0013/0014), never a
  500, and never reaches the synth's reflective constructor. The decision is logged server-side
  (the class name), never echoed to the client (ADR-0014).

The guard is consulted by the registry's hydrate path only (the dehydrate path constructs nothing).
The `Wireable` path is *also* gated: a `fromWire` factory on a denied type is not invoked.

## Consequences

- The typed-state round-trip cannot be turned into a class-instantiation gadget by a forged or
  leaked snapshot: the HMAC stops tampering, the allowlist stops typed `d` deserialization, and
  this guard stops dangerous `t` instantiation. The three are orthogonal.
- The existing HMAC / `PayloadGuard` / `ChecksumFailureLimiter` paths are untouched (issue #165
  scope): this ADR adds only the instantiation gate.
- Default-deny by root means a legitimate component that holds a JDK type the built-in synths do
  not cover (e.g. a `java.time.Year`) must either use a built-in-covered type, implement
  `Wireable`, or be added to the registry. This is the safe direction (a new JDK type is opt-in,
  not opt-out).
- The guard is a denylist *of roots* layered under an allowlist *of shapes*: it does not claim to
  enumerate every gadget (ADR-0013 already argued that is a losing race), it closes the obvious
  roots and defers everything typed to the synth registry's own known set.

## Alternatives considered

**No guard (rely on the allowlist + HMAC alone).** The `d` allowlist closes typed JSON, but `t`
is reflectively instantiated by a synth, which the allowlist does not cover. Rejected: the synth
path is precisely the new reflective surface issue #165 exists to gate.

**A full positive allowlist of instantiable classes (config-driven).** Cleanest in theory, but it
forces every application to register its own value objects before they round-trip, which breaks
the zero-config promise. Rejected for v0.1 in favor of default-deny-by-root + application-package
pass-through; a config-driven allowlist is a roadmap refinement if a deployment needs to lock down
further.
