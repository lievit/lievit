# ADR-0020: Typed-state round-trip — a synthesizer registry + Wireable SPI

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

The wire snapshot carries the `@Wire` field state as a JSON-shaped map (ADR-0001,
wire-protocol.md §2). Until now the `WireDispatcher` read each field with plain reflection
(`field.read`) into that map and, on the next call, wrote the value back with `field.write`.
This worked only for primitives, strings, and `Map`/`List` of those: JJWT/Jackson serializes a
`LocalDate`, an enum, a `BigDecimal`, or a record to *some* JSON, but on the way back the codec
decodes it to a bare `String`/`Number`/`LinkedHashMap`, and `field.write` then assigns the wrong
type or stores a raw map where the field expects a typed object.

This is the confirmed foundational blocker (kit-CRUD, issue #163): a component holding a domain
value object rehydrates as a `LinkedHashMap` and dies on the second wire call. Every component
that holds a record, an enum, a date, a money VO, or a domain value object is impossible past the
first request.

Livewire solved this with **synthesizers**: every non-primitive property dehydrates to a
`[data, meta]` tuple where `meta.s` names the synthesizer that reconstructs the exact type and
`meta.class` carries the concrete class; on hydrate the codec reads `meta.s`, looks up the synth,
and rebuilds the exact type, recursively
(`HandleComponents.php` dehydrate/hydrate/hydrateForUpdate, `Synthesizers/*`, `Wireable.php`).

## Decision

lievit adopts the same tuple-with-type-tag shape, in the pure-Java core (`dev.lievit.wire.synth`,
zero Spring, ADR-0007). The seam lives in the `WireDispatcher`'s dehydrate/rehydrate/update path,
**not** in the `SnapshotCodec`: the codec stays a dumb JWT signer of a JSON-shaped map, so
signing, expiry, and `kid` rotation are untouched.

**1. The wire tuple.** A non-primitive `@Wire` value dehydrates to a single-key map
`{ "@w": { "d": <json data>, "s": <synth-key>, "t": <concrete-fqn|null> } }`. The reserved
`@w` envelope key marks a value as a typed tuple; `d` is the JSON-shaped data (recursively
synthesized for nested typed values), `s` is the synthesizer key, `t` is the concrete type when
the synth needs it to reconstruct (records/POJOs/enums; `null` when the key alone is sufficient,
e.g. temporals). Primitives, strings, booleans, and plain JSON scalars pass through **unwrapped**
(no tuple), so the Counter snapshot is byte-for-byte unchanged and the protocol is backward
compatible.

**2. The `Synthesizer<T>` SPI.** `key()`, `matches(Object)` (dehydrate dispatch by instance),
`matchesType(Class)` (the typed-update path: pick a synth by the field's *declared* type when an
inbound `_updates` value has no meta), `dehydrate(T) -> Dehydrated` (the `{d,s,t}` triple),
`hydrate(Object data, String concreteType) -> T` (rebuild from a verified tuple), and
`hydrateFromType(Class, Object raw) -> T` (rebuild a raw scalar written from a `wire:model`, e.g.
an `<input type=date>` string to `LocalDate`, a `<select>` string to an enum).

**3. The `SynthesizerRegistry`.** Resolves a synth by key (hydrate path), by instance (dehydrate
path), and by declared type (typed-update path). Ships built-ins for the JVM analogues of
Livewire's set: temporals (`LocalDate`/`LocalDateTime`/`LocalTime`/`Instant`), enums (incl.
update-from-string via `valueOf`), `BigDecimal`/`BigInteger`, `UUID`, collections (`List`/`Set`),
maps with non-string keys, and records / POJOs (the `StdClassSynth` analogue, reflective).
Resolution is most-specific-first; the registry is immutable after construction.

**4. The `Wireable` SPI.** A user type implements `toWire() -> Object` / a static
`fromWire(Object)` factory (discovered reflectively) to opt into round-trip without a bespoke
synth. The registry prefers `Wireable` over the reflective record/POJO synth.

**5. Recursion.** Dehydrate and hydrate recurse: a record holding a `List<EnumX>` dehydrates each
level to its own tuple and rebuilds each level by its meta, so arbitrarily nested typed state
round-trips. The recursion is depth-bounded by the existing `PayloadGuard` nesting cap (ADR-0013).

**6. Security (the typed path is gated).** Reflective instantiation of a `t` (concrete class) is
gated by a `ClassInstantiationGuard` consulted before *any* synth constructs a class named in a
tuple's `t` (ADR-0021, issue #165). The `PayloadGuard` deserialization allowlist (ADR-0013) still
runs on the tuple's `d` payload — it is plain JSON data — so the gadget surface stays closed: a
typed value is reconstructed only by an allowlisted synth from allowlisted JSON, never by open
polymorphic typing.

## Consequences

- Every typed `@Wire` field now survives the stateless round-trip: the kit-CRUD value object
  lives past the second action; enums, dates, money VOs, and domain records are first-class.
- The `SnapshotCodec`, signing, expiry, and rotation are untouched: the tuple is just more JSON
  in the `wire` map. The golden roundtrip tests (`SnapshotCodecTest`) are unchanged.
- The public API is unchanged (no new annotation; ADR-0002's cap holds). `Wireable` is a runtime
  interface, like `LievitEffects`, not an annotation.
- The reflective record/POJO synth is GraalVM-native-sensitive: a record reconstructed reflectively
  needs a reflection hint. The native hints processor (ADR-0006) registers `@Wire` field types;
  a follow-up wires the synth path into it. Until then, `Wireable` is the native-safe escape hatch.
- A field whose value is neither a primitive, a registered synth target, nor `Wireable` dehydrates
  via the reflective POJO synth; a truly unsupported shape fails closed (ADR-0014), never silently
  stores a map.

## Alternatives considered

**Keep the bare-map decode and special-case each type in the dispatcher.** This is the status quo
that broke. Each new typed field would be a bespoke branch; nested types would be unreachable.
Rejected: it is exactly the "hardcoded special-case" the synthesizer architecture exists to avoid.

**Use Jackson polymorphic typing (`@class` hints) to round-trip the exact type.** This is the JVM
gadget surface ADR-0013 deliberately closed. Open polymorphic typing reconstructs *any* class on
the classpath from a signed (or, if the key leaks, forged) payload. Rejected: the synth registry
reconstructs only allowlisted types from allowlisted JSON, which is both safer and explicit.

**Put the synth seam in the `SnapshotCodec`.** The codec is the pure JWT layer; mixing the type
system into it couples signing to the component model and complicates rotation. Rejected: the
dispatcher already owns dehydrate/rehydrate and is where the field types are known.
