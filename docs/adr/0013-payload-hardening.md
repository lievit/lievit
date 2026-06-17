# ADR-0013: Payload hardening — settable/callable allowlist, deserialization allowlist, structural caps

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

ADR-0001 makes the snapshot signature the security boundary: a tampered snapshot fails the HMAC.
The Livewire source study (`docs/research/livewire-design-decisions-complete.md` §Security 2, 4, 7)
surfaced three gaps the signature does **not** close, all reachable from a *validly signed* first
POST:

1. **The settable / callable surface is the real authorization boundary.** The signature stops
   tampering *between* requests; it says nothing about *which* fields a well-formed first POST may
   set or which methods it may call. Livewire derives this from `getPublicPropertiesDefinedOnSubclass`
   / `getPublicMethodsDefinedBySubClass` minus lifecycle hooks, rejecting the rest
   (`HandleComponents.php:527-529,684-693`).
2. **Deserialization / gadget chains.** Livewire keeps a denylist of known PHP object-injection
   gadgets, checked before any synthesizer instantiates (`SecurityPolicy.php`,
   `HandleComponents.php:359,382`). On the JVM the gadget surface is *worse* (Jackson polymorphic
   typing, `ObjectInputStream`).
3. **Algorithmic-complexity / DoS via payload shape.** Beyond the 64 kb byte cap, Livewire bounds
   max calls (50), max update-path nesting depth (10), and max components per batch (200)
   (`HandleComponents.php:517-520,656-660`).

These are independent of the signature and must be enforced even when the HMAC passes.

## Decision

lievit hardens the payload at three layers, all enforced in the pure-Java core
(`WireDispatcher` + `PayloadGuard`, ADR-0007) before any value is bound or any action runs.

**1. Settable / callable allowlist — the annotation IS the allowlist.** Only a `@Wire` field is
client-settable; only a `@LievitAction` method is client-callable. lievit is structurally better
than Livewire here: there is no public-surface to subtract from, the annotation is the allowlist.

- An `_updates` entry naming a non-`@Wire` field (a setter, a private field, an inherited field) is
  **dropped**, never bound. The write does not happen; the call proceeds. (A drop rather than a hard
  error: the signed snapshot already bounds the non-malicious surface, a stray key is noise; the
  security property is that the write is impossible, pinned by `WireDispatcherTest`.)
- A `_calls` entry naming anything that is not a `@LievitAction` — a lifecycle hook (`@LievitMount`,
  `@LievitRender`), a getter, an arbitrary method — resolves to no action and is a
  `410 Gone` (`Lievit-Reason: gone`). A lifecycle hook is never reachable from the wire.

**2. Deserialization allowlist (gadget protection).** `cls` already resolves to a registered
`@LievitComponent` only (`ComponentRegistry`, 410 on unknown). On top of that, every `@Wire` field
*value* — whether inbound (`_updates`) or rehydrated from the signed snapshot `wire` — must be plain
JSON data: a scalar (`null`, boolean, number, string), a `List`, or a `Map` with `String` keys,
recursively. Anything else (an opaque Java object, a value carrying a polymorphic `@class` hint) is
a `422 Unprocessable` (`Lievit-Reason: forbidden-deserialization`), refused before it is bound. The
snapshot is *state, never code* (ADR-0001); no reflective open typing rides in. This is also a
GraalVM-native fit (ADR-0006). The check runs on the signed `wire` too: defense in depth if the
signing key ever leaks.

**3. Structural caps (DoS).** `PayloadGuard` bounds the payload shape independently of its byte
size: max `_updates` (default 100), max `_calls` (default 50, Livewire parity), max update-value
nesting depth (default 10, Livewire parity; the recursion is depth-capped so a deep map cannot blow
the stack). Exceeding any is a `413` (`Lievit-Reason: too-complex`), refused before any action runs.
Configurable via `lievit.max-updates` / `lievit.max-calls` / `lievit.max-nesting-depth`. Max
components per batch is N/A: lievit's endpoint is one component per call (the batched-route
divergence stays open in ADR-0001's amendment).

New `WireError` codes: `PAYLOAD_TOO_COMPLEX` (413, `too-complex`), `FORBIDDEN_DESERIALIZATION`
(422, `forbidden-deserialization`). The existing `UNKNOWN_COMPONENT` (410) carries the
non-callable-method case; the existing `LOCKED_PROPERTY` (403) is unchanged.

## Consequences

- A validly-signed first POST can no longer set a server-owned field it was never granted, call a
  lifecycle hook, smuggle a gadget object, or DoS the server with a small-but-pathological payload.
  The signature and the allowlist are now orthogonal defenses.
- The public API is unchanged (no new annotation; the seven-annotation cap of ADR-0002 holds). The
  `WireDispatcher` gains a `PayloadGuard` constructor argument; its no-arg constructor keeps the
  protocol defaults, so the public surface is stable.
- The allowlist is *not* overzealous: plain JSON arrays and nested objects within the caps pass
  unchanged, so legitimate form/collection state still round-trips (pinned by `HostileWireIT`).
- A bind failure (a JSON shape that passes the guard but does not fit the field type) surfaces as
  the generic fail-closed `500` of ADR-0014, never as a `413`/`422`: the guard bounds shape, not
  type-fit.

## Alternatives considered

**A gadget denylist (Livewire's model).** Enumerate known-dangerous classes and reject them. On the
JVM the gadget surface is open-ended (any class on the classpath with the wrong shape), so a denylist
is a losing race. lievit inverts it to an allowlist of plain JSON shapes: nothing typed deserializes
at all, which is both safer and simpler. Rejected.

**Enforce caps in the web layer (servlet filter).** Possible, but the dispatcher already owns the
lifecycle and the codec is Spring-free (ADR-0007); putting the structural and deserialization checks
in the core keeps them unit-testable without a servlet container and reusable by any future
transport. The web layer only maps the resulting `WireError` to HTTP. Chosen.

**Reject (rather than drop) an unknown-field update.** A hard `4xx` on any non-`@Wire` key. Rejected
for v0.1: it makes a benign stale-client key a hard failure, and the security property (the write
cannot happen) holds either way. Revisit if a stricter posture is wanted behind a flag.
