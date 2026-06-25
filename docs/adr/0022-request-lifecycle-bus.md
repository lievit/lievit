# ADR-0022: Request lifecycle — ordered phases + a trigger() interceptor bus

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

The `WireDispatcher` runs a fixed lifecycle for a wire call: rehydrate → apply updates → validate
→ invoke actions → render → read wire (mount has its own variant: seed props → mount → seed-URL →
render). Until now every cross-cutting feature (validation, URL binding, computed cache, children)
was a hardcoded step in `call`/`mount`. That does not scale: Livewire implements almost every
`Support*` feature as a set of *listeners on named lifecycle phases* (locales pin on `hydrate`
and store on `dehydrate`; persistent middleware records on `dehydrate` and replays on
`snapshot-verified`), dispatched through an `on()/trigger()` bus where a listener may return a
`finish` callback run after the phase (`helpers.php`, `HandleComponents.php`).

Without a named-phase interceptor bus, lievit re-implements each feature as a special case in the
dispatcher and the extension story collapses (issue #167). The component-facing lifecycle *hooks*
(`@LievitMount`/`@LievitRender`, the future `updated{Prop}`) are a separate surface; THIS is the
framework-facing bus those hooks (and built-in features) dispatch through.

## Decision

lievit adds a `LifecycleBus` (`dev.lievit.component`, pure Java, ADR-0007) and a fixed,
documented phase order the `WireDispatcher` triggers on every call:

**Update pipeline:** `HYDRATE` → `UPDATE` (per update; `UPDATED` finishers run after **all**
updates are applied) → `CALL` (per call, with an early-return seam) → `RENDER` (skippable) →
`DEHYDRATE` → `DESTROY`.

**Mount pipeline:** `MOUNT` → `RENDER` → `DEHYDRATE` → `DESTROY` (the `PRE_MOUNT` short-circuit
seam is reserved for a future SSR/cache feature; declared in the enum, not yet triggered).

**The bus.** `on(LifecyclePhase, LifecycleListener)` registers a listener; `trigger(phase, ctx)`
invokes every listener for the phase in registration order and collects the non-null `finish`
callbacks they return. A listener's `before(ctx)` runs at the phase; its returned `Runnable`
(if any) is a `finish` callback the dispatcher runs after the phase's own work, in registration
order, so a listener can observe or amend the result of the phase (the locales pattern: capture
on `dehydrate`).

**Strict ordering invariants** (the load-bearing part):
- `UPDATED` finishers run after ALL property updates are applied, never inline per-update, so one
  hook can override another's update.
- A per-call `CALL` listener may signal `earlyReturn` to short-circuit before the method is
  dispatched (the seam `$set`-style magic actions use); the public-method allowlist still applies
  (an unknown action is `UNKNOWN_COMPONENT`, never invoked).
- `RENDER` is skippable: a listener (the `renderless`/`skipRender` seam) may mark the context
  render-skipped, and the dispatcher then does not invoke the render hook; the web layer carries no
  HTML for that component.

**The context.** `LifecycleContext` carries the metadata, the instance, the phase-specific data
(the update key+value for `UPDATE`, the call name for `CALL`), and the mutable signals
(`earlyReturn`, `skipRender`, a `memo` map that survives into the snapshot for the locales /
persistent-middleware pattern).

The dispatcher keeps a default (empty) bus, so existing call sites (`new WireDispatcher()`) and the
golden behavior are unchanged; a feature registers listeners by constructing the dispatcher with a
populated bus. The built-in steps (validation, URL, computed, children) stay in the dispatcher for
v0.1 — moving them onto the bus is a mechanical follow-up now that the bus exists; this ADR lands
the bus and the strict ordering, the extension seam every later feature needs.

## Consequences

- A cross-cutting feature (locale pinning, persistent middleware, future `updated{Prop}` hooks,
  magic actions, renderless) registers as a listener on a named phase rather than editing the
  dispatcher: the extension architecture issue #167 calls for.
- The phase order is now an asserted invariant (`*InvariantTest`), so a refactor that reorders
  hydrate/update/call/render/dehydrate breaks a test, not production subtly.
- `updated`-after-all, early-return, and render-skippable are encoded as bus semantics, so the
  features that depend on them (issue #167 lists `updated{Prop}`, `$set`, renderless) have a
  correct seam from day one.
- The bus is synchronous and per-call (bound for the duration of one `call`/`mount`), consistent
  with the stateless invariant (ADR-0001): nothing survives between calls except the snapshot
  `memo`.
- The dispatcher gains a `LifecycleBus` constructor argument; the no-arg constructor supplies an
  empty bus, so the public surface is stable and the Counter is unchanged.

## Alternatives considered

**Keep hardcoded steps; add features as more steps.** The status quo. Every feature edits the
dispatcher; ordering bugs (updated-after-all, render-skip) recur per feature. Rejected: it is the
special-case sprawl issue #167 exists to prevent.

**Spring `ApplicationEventPublisher` as the bus.** Couples the pure-Java core to Spring (ADR-0007),
loses the `finish`-callback / ordered-per-phase semantics, and is async-by-default. Rejected: the
bus must be synchronous, ordered, and Spring-free.

**A single `LifecycleInterceptor` interface with one method per phase.** Simpler to call but forces
every listener to implement (or no-op) every phase and loses the `finish`-callback seam. Rejected
in favor of `on(phase, listener)` registration, which matches Livewire's `on/trigger` and lets a
feature subscribe to exactly the phases it needs.
