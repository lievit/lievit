# ADR-0041: `with()` extra view data (a convention-named render contribution)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #65 is Livewire `with()` / `SupportWithMethod` parity: a component needs to pass derived view
variables to its template that are NOT persisted `@Wire` state, the way a Livewire `render()` method
returns `view('...')->with([...])`. lievit already merges two layers into the template model in the
starter's `LievitWireService.mergeModel`: the `@Wire` snapshot state, then the `@LievitComputed`
values (ADR-0015). There was no seam for one-shot derived collections (a query result, a formatted
total, a filtered list) that the view renders but the snapshot must not carry.

ADR-0002 capped the public annotation surface at seven; ADR-0030/0031 grew it for the runtime-parity
epic, but only where a behaviour genuinely needs an annotation. `with()` does not: Livewire itself
expresses it as the return of an ordinary method, and lievit already resolves the lifecycle hooks of
ADR-0030 (#47) by **method name**, not by annotation. The same convention fits here.

The dispatcher (`WireDispatcher`, lievit-core) is Spring-free (ADR-0007) and owns the render phase;
the template-model assembly lives in the starter (`mergeModel`). The contribution therefore has to
ride the `WireCall` result from core to the starter, exactly as `computed` already does.

## Decision

A component MAY declare a no-argument method named `with()` returning a `Map`. It is resolved by
method name (cached per class in `WithMethodMetadata`, mirroring `LifecycleHooks`/
`EventListenerMetadata`), invoked during the RENDER phase after the action ran and after computed
resolution, and its entries ride the new `WireCall.viewData()` field. It is NOT an annotation: the
ADR-0002 surface is unchanged.

The starter's `mergeModel` applies the three layers last-wins: `@Wire` state, then computed, then
`with()` view data. A `with()` key therefore overrides a same-named public property (Livewire's
precedence). The view data is never signed into the snapshot (like computed, it is rederived each
render); a skipped render (renderless / redirect) resolves no view data.

`with()` must take no parameters and return a `Map`; any other `with` overload is ignored (so a
component is free to have an unrelated `with(...)` helper). Keys are coerced to `String`.

## Consequences

Easier: a component passes derived collections to its template without polluting the snapshot or
inventing a `@Wire` field for view-only data, and without an eighth annotation. The override
precedence lets a `with()` entry shadow a property for the view while the property keeps its own
persisted value (the test pins both).

Harder / accepted risk: `with()` is convention-named, so a typo (`With`, `withData`) silently does
nothing, the same failure mode the lifecycle hooks already accept (ADR-0030). The method runs every
render; an expensive `with()` is the author's cost to manage (memoize via `@LievitComputed` if it
must run once). `WireCall` gained a sixth component; the existing four- and five-argument
constructors are retained so no call site or golden test changed.

## Alternatives considered

**Reuse `@LievitRender` returning a `Map`.** The render hook already exists and Livewire conflates
render + `with()`. Rejected: in single-file mode a `@LievitRender` method returns markup, so reading
its return as view data is ambiguous, and the dispatcher deliberately discards the render hook's
return today. A distinct `with()` name is unambiguous and matches Livewire's own helper name.

**A new `@LievitWith` annotation.** Rejected: it adds to the ADR-0002 surface for a behaviour the
naming convention already covers, and the lifecycle hooks set the precedent (ADR-0030) that
render-phase contributions are resolved by method name, not by annotation.

**Merge `with()` into the `computed` map.** Rejected: `computed` is the memoized `@LievitComputed`
values (ADR-0015) with its own semantics; folding `with()` into it would blur two distinct concepts
and break the per-method memoization contract. A separate `viewData` field keeps them honest.
