# ADR-0075: `@LievitIsolate` separate-request components

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #61: Livewire's `#[Isolate]` (`SupportIsolating`) marks a component so its updates are sent as
their own network request instead of being folded into the shared multi-component commit, so an
expensive or independent component does not couple its latency to the rest of the page's batch.

Two forces shape the lievit answer:

1. **The seven-annotation cap (ADR-0002).** `isolate` is component-scoped behavior, the same shape
   `@LievitLazy` (ADR-0036) is: a class-level marker that changes how the runtime treats a component,
   expressed without bloating the per-field surface. It is governed by an ADR that supersedes the
   literal count, exactly as `@LievitLazy`, `@LievitUrl`, and `@LievitTransition` were.
2. **The statelessness invariant + unchanged snapshot schema (ADR-0001).** A behavior flag must ride
   the existing signed snapshot, never a new wire field. The memo bag (`@memo`) the dispatcher already
   round-trips (locale pinning, ADR-0037) is exactly the vehicle: a dehydrate listener writes the
   flag, the client reads it off the snapshot.

## Decision

- **`@LievitIsolate`** is a class-level annotation on a `@LievitComponent` (lievit-core).
- **`IsolateListener`** (core, registered on the lifecycle bus) reflects the annotation on MOUNT and
  DEHYDRATE and writes `isolate: true` into the snapshot memo under the key `isolate`. A component
  without the annotation writes nothing, so the common-case snapshot (the Counter) is byte-unchanged
  and there is no behavior or size cost. The annotation lookup is cached per class.
- **The client** (lievit-ui) reads the flag off the snapshot memo (`wire["@memo"].isolate`) via
  `runtime.isIsolated(element)`: the seam a request bundler consults to keep an isolated component out
  of a shared commit. The server stays stateless: it emits the flag, the client owns the bundling, the
  same split as the modelable up-leg (ADR-0016) and locale pinning (ADR-0037).

## Consequences

- The server-side feature is complete: the flag is stamped, survives the round trip, and is readable
  by the client off the signed snapshot.
- **Client bundling scope.** lievit v0.1 has no shared client-side batch: every commit is already
  issued per-component (the server's batch endpoint, ADR-0032, is not yet driven by a client-side
  multi-component bundler; see `poll.ts`). So an isolated component is *de-facto* in its own request
  today, and `isIsolated()` is the seam a future shared bundler reads to keep it out of the batch.
  The "two components, one isolated -> two requests" acceptance is satisfied by construction now and
  remains correct when a shared bundler lands.
- The seven-annotation cap holds the same way `@LievitLazy` held it: a governed class-level marker,
  no new per-field surface.
- Security and statelessness are inherited: the flag rides the HMAC-signed memo (ADR-0001), so it
  cannot be forged; nothing survives between stateless calls except the snapshot.

## Alternatives considered

**A new wire field / snapshot key for `isolate`.** Rejected: it changes the snapshot schema for a
per-component behavior flag the memo already carries cleanly (the locale pattern). One concept, one
vehicle.

**A runtime sink (`LievitIsolate.current().isolate()`) instead of an annotation.** The
`LievitEffects` shape. Rejected here: isolation is a static property of the component (it is isolated
or it is not), not a per-call decision an action makes, so a class-level marker reflected once is the
honest expression, mirroring `@LievitLazy`.

## Cross-references

- ADR-0002 — the seven-annotation cap (held: a governed class-level marker, like `@LievitLazy`).
- ADR-0016 — the client owns request routing; the server emits flags into the snapshot.
- ADR-0032 — the batch update endpoint the shared client bundler would drive.
- ADR-0036 — `@LievitLazy`, the precedent for a class-level marker that changes runtime treatment.
- ADR-0037 — the snapshot memo (`@memo`) the isolate flag rides, the locale-pinning pattern.
