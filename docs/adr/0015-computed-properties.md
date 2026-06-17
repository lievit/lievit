# ADR-0015: `@LievitComputed` — computed properties with per-request memoization

- **Status:** accepted (supersedes ADR-0002 on the seven-annotation cap)
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

A component frequently needs **derived values** — values computed from `@Wire` state that are
expensive to call (a database count, a price sum, a formatted string) and referenced multiple
times in the same template render. Without memoization the template re-invokes the method on
every reference, which multiplies cost and complicates caching concerns in user code.

Livewire covers this with `#[Computed]` (PHP 8.1 attribute on a method): on the first access
per request it computes and caches the value; subsequent accesses within the same request
return the cached result; the cache is discarded at the end of the request so the next wire
call recomputes from fresh state. The `#[Computed]` value is exposed to the template alongside
`wire:model` data (accessible as a template variable of the same name as the method).

lievit must cover the same use case:
- A `totalPrice()` method derived from cart items, referenced three times in the template,
  must run **once per wire call**, not three times.
- On the next wire call the value must recompute (state may have changed).
- The cache must not leak across the stateless wire boundary.

## Decision

lievit adds **`@LievitComputed`** as a method annotation. This is the **eighth public
annotation** and supersedes the seven-annotation cap in ADR-0002.

### Why a new annotation and not an attribute on an existing one

The candidates are:

- **`@LievitProperty` on a method**: `@LievitProperty` targets `ElementType.FIELD`; extending it
  to methods mixes field-binding semantics with method-memoization semantics in one annotation.
  The seven-annotation cap exists to keep each annotation's meaning clean; polluting
  `@LievitProperty` undermines that. Rejected.
- **Convention (method named `get*` or returning non-void)**: too implicit, too fragile for GraalVM
  AOT (can't distinguish intent from accident). Rejected.
- **`@LievitRender` or `@LievitAction` with a flag**: orthogonal concepts. Rejected.
- **A new annotation `@LievitComputed`**: explicit, memorable, one concept per annotation.
  The name mirrors Livewire's `#[Computed]`. Accepted.

### Why supersede the cap rather than refuse

The cap in ADR-0002 is deliberate friction against accretion. The criteria for superseding it:

1. The feature cannot be expressed cleanly through configuration, convention, or an attribute on
   an existing annotation (established above).
2. The concept is genuinely first-class in the user-facing mental model (a computed property is as
   fundamental as a wire field or an action; it belongs in the five-concept map).
3. The surface stays memorable with eight (the user learns: Component, Wire, Action, Mount, Render,
   Property, Computed — one annotation per concept).

All three hold. The updated cap is **eight annotations**; ADR-0002 is superseded on this point.

### Cache mechanism

The computed cache is a `Map<String, Object>` stored in a `ThreadLocal` bound for the duration
of a single dispatcher call (`mount` or `call`) and cleared in the same `finally` block that
clears `LievitEffects`. This mirrors the `LievitEffects` pattern exactly:

- **Bind** at the start of the call: `ComputedCache.bind(new HashMap<>())`.
- **Access** on demand: `ComputedCache.get(name)` returns the cached value or calls the method
  and caches it.
- **Clear** in the `finally` block: `ComputedCache.clear()`.

The cache key is the method name. The value is the method's return value (nullable).

### Template exposure

Computed values are added to the template model alongside `@Wire` fields. `ComponentMetadata`
discovers `@LievitComputed` methods and the dispatcher includes them in `readWire` output
(as a separate `computedValues()` map in `WireCall`, or merged at the template model level
depending on the template-adapter contract). For now they are exposed via `WireCall` as a
separate `computed` map so the template adapter can merge them cleanly.

### Security: computed values are NOT sent in the snapshot

`@LievitComputed` values are **derived, never stored**: they are not serialized into the
snapshot `wire` payload. They are recomputed on each render from the `@Wire` state. This
means a client cannot tamper with a computed value (it has no wire entry to tamper). The
snapshot stays minimal.

### GraalVM

The reflection pattern is identical to `@LievitAction` methods: `method.setAccessible(true)` in
`ComponentMetadata.of()`, hint registration via Spring AOT (deferred to the AOT module landing).

## Consequences

- The public annotation count is now eight. The cap in ADR-0002 is superseded; ADR-0002 otherwise
  stands.
- Template authors can reference `totalPrice` (the method name, without `()`) in the template,
  with confidence it is computed at most once per wire call.
- Computed values do not appear in the snapshot: they are invisible to the HMAC boundary and
  cannot be tampered. A computed method must be pure relative to `@Wire` state (no side effects);
  this is a documentation contract, not a runtime guard.
- The `ComputedCache` `ThreadLocal` follows the same lifecycle contract as `LievitEffects`:
  bound at call start, cleared at call end, never readable outside a call.

## Alternatives considered

**Attribute on `@LievitProperty` targeting methods.** `@LievitProperty` targets fields; adding
`ElementType.METHOD` conflates two unrelated concerns. Rejected.

**Convention-based discovery (all public non-void getters are computed).** Implicit; fails the
GraalVM AOT requirement (no intent signal for AOT hints). Rejected.

**Require the user to cache in the `@LievitRender` hook.** The `@LievitRender` hook runs once
per call, so a developer could compute there and store in a field. But that field would be
serialized in the snapshot (as a `@Wire` field) or invisible to the template (as a non-`@Wire`
field). Neither is satisfactory: the snapshot grows unnecessarily, or the template cannot see
the value. Rejected.

**Keep the seven-annotation cap, defer computed properties.** The use case is real and
fundamental; deferring it would force users to implement fragile workarounds. The cap is meant
to prevent accretion of incidental surface, not to block fundamental concepts. Rejected.
