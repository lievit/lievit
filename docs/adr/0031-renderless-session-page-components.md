# ADR-0031: `@LievitRenderless`, `@LievitSession`, and full-page components (`@LievitLayout` / `@LievitTitle`)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

> **ADR numbering note.** See ADR-0030: this server-features work claims 0030–0031, leaving
> 0024–0029 for the parallel sibling branches.

## Context

The P1 server-side slice of Epic #34 (Livewire runtime parity) adds three component-author surfaces
that each need a new annotation, on top of the events/lifecycle/magic/redirect work of ADR-0030:

- **`@LievitRenderless`** (#59): skip the re-render after an action that mutates only server state
  the client does not display, so the round trip skips the wasted render + DOM morph.
- **`@LievitSession`** (#55): persist a `@Wire` property into the HTTP session, restoring it on
  mount so it survives a full page refresh.
- **Full-page components** (#63): a component usable directly as a route target, rendered inside a
  layout (`@LievitLayout`) with a page title (`@LievitTitle`).

These continue past ADR-0030's supersession of the seven-annotation cap (ADR-0002): the parity epic
is the documented reason the annotation set grows beyond seven.

## Decision

### `@LievitRenderless` — a method annotation, enforced by a listener

`@LievitRenderless` on an `@LievitAction` marks it renderless. `RenderlessListener` (registered on
CALL + RENDER) tallies, per call, whether each invoked action renders; on RENDER it calls
`requestSkipRender()` when **at least one renderless action ran and no rendering action did**
(Livewire's "skip render when no rendering action ran"). A magic action (`$set`, ADR-0030) and a
pure `wire:model` update are not tallied, so they still render. This reuses the ADR-0022
render-skippable seam; it is the declarative form of the imperative `skipRender()`.

### `@LievitSession` — a field annotation, against-the-stateless-grain by design

`@LievitSession` on a `@Wire` field persists it into the HTTP session. lievit is stateless by design
(ADR-0001: the snapshot carries all state, the server keeps nothing between calls), so this is the
**deliberate, documented exception**, a sharp tool for cross-refresh UI preferences where the query
string (`@LievitUrl`) does not fit. The core stays Spring-free (ADR-0007): `SessionStore` is a
two-method abstraction the `SessionListener` (MOUNT + HYDRATE restore, DEHYDRATE write) uses; the
starter binds an `HttpSessionStore` per wire call (a `ThreadLocal`, like `LievitEffects`), and the
listener no-ops when no store is bound (so a `@LievitSession` component still runs statelessly in a
unit test). Keys default to `<component-fqn>.<field>`; an explicit `key` may embed a
`{dotted.path}` placeholder resolved against state (shared `PlaceholderNames` with `@LievitOn`).
Restore-on-MOUNT runs after `@LievitMount` (session wins over the mount default); restore-on-HYDRATE
runs before client updates (a `wire:model` this call still wins, it is the user's latest intent).

### Full-page components — `@LievitLayout` / `@LievitTitle`, reflected in core

`@LievitLayout("layouts/app")` and `@LievitTitle("...")` are type-level annotations; `PageComponent`
reflects (and caches) them. The core only reflects the declarations (`null` layout = "use the
configured default"); the starter/web layer maps the route, renders the component, wraps it in the
resolved layout under a content slot, sets the `<title>`, and binds route params to the mount. The
core stays free of Spring MVC routing.

## Consequences

- Three more annotations (`@LievitRenderless`, `@LievitSession`, `@LievitLayout`, `@LievitTitle`),
  all governed here; the seven-annotation cap is formally a "core + parity" split now (ADR-0030 +
  this).
- `@LievitSession` is the one feature that breaks the stateless invariant; it is opt-in, documented
  as against-the-grain on the annotation itself, and degrades to stateless when no session is bound.
- Renderless and full-page reuse existing seams (render-skip; metadata reflection), adding no
  protocol surface. `@LievitSession` adds the `SessionStore` SPI + a per-call ThreadLocal binding in
  the starter, paralleling the effects sink.

## Alternatives considered

**Renderless via a runtime `skipRender()` only.** No annotation, the action calls a method.
Rejected as the *only* form: the declarative annotation is the common case (Livewire `#[Renderless]`)
and reads at the method signature; the imperative seam still exists underneath (the listener sets the
same flag), so a future `skipRender()` runtime call is additive.

**`@LievitSession` storing the whole component.** Persist all state in session (a stateful mode).
Rejected: it abandons ADR-0001 wholesale; the per-field opt-in keeps statelessness the default and
the exception explicit and bounded.

**Full-page layout as a template convention (no annotation).** Infer the layout from a naming
convention. Rejected: Livewire parity expects the explicit `#[Layout]`/`#[Title]`, and an explicit
annotation is clearer than a magic file name; the default-layout fallback covers the no-annotation
case.
