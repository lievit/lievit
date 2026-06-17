# ADR-0030: Runtime parity — events, full lifecycle hooks, magic actions, redirects

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

> **ADR numbering note.** The highest ADR at branch time was 0023. Two sibling feature
> branches (`feat/lw-client-directives`, `feat/lw-v4-convergence`) are adding ADRs in
> parallel; this server-features work deliberately claims **0030** (and **0031**), leaving the
> 0024–0029 band free for the siblings, to avoid a number collision on merge.

## Context

Epic #34 is runtime-feature parity with Livewire: the server + client behaviours that make lievit
components express what Livewire apps rely on. The lifecycle bus (ADR-0022) and the effects channel
(ADR-0012) were landed precisely so these features register as **additive listeners + new effect
data**, not dispatcher rewrites. This ADR covers the four **server-side P0** features that share
that seam:

- **Component events** (#43): a component dispatches a named event (already a `dispatch` effect,
  ADR-0012) and *receives* events through `@LievitOn` listener methods. lievit had the emitting half
  but not the receiving half, the targeting (`self` / `to-component`), or dynamic listener names.
- **Full lifecycle hooks** (#47): beyond `@LievitMount` / `@LievitRender`, the ordered
  `boot`/`booted`, `hydrate`/`dehydrate`, `updating`/`updated` (incl. per-property `updated{Prop}`),
  `rendering`/`rendered` hooks — the extension seam every non-trivial component uses.
- **Magic actions** (#49): `$set` / `$toggle` / `$refresh` / `$get` / `$parent`, the framework-
  provided actions a template writes inline (`l:click="$set('open', true)"`). Without them most
  Livewire templates do not port.
- **Server-driven redirects** (#51): `redirect()` inside an action (the `redirect` effect already
  exists, ADR-0012) plus the render-skip-on-redirect default.

ADR-0002 capped the public API at seven annotations; ADR-0012 already foresaw that the *receiving*
half of `dispatch` (`#[On]`) would be "a separate decision, not settled here". This ADR is that
decision, and it adds one new annotation, **`@LievitOn`**, superseding the seven-annotation cap for
the runtime-parity surface (the cap held through the whole core; the parity epic is the documented
reason it grows).

## Decision

Everything below is a **`LifecycleBus` listener or an effects-channel addition**. The
`WireDispatcher` gains exactly one new thing: an overloaded `call(..., List<InboundEvent>)` that
runs the inbound `@LievitOn` listeners after the `_calls` actions, inside the existing CALL section.
No phase order changed; no built-in step moved.

### Magic actions — a CALL-phase listener that early-returns

`MagicAction.parse` recognises a `$`-prefixed call string and splits the inline scalar args
(`$set('count', 5)` → name `$set`, args `["count", 5]`). `MagicActionListener` (registered on CALL)
performs the mutation for `$set` / `$toggle` and calls `ctx.requestEarlyReturn()` so the dispatcher
never routes the synthetic name to the `@LievitAction` allowlist (it would be `UNKNOWN_COMPONENT`).
`$refresh` / `$get` / `$parent` early-return as no-ops server-side (`$refresh` lets the normal
re-render happen; `$get` is read-only; `$parent` is resolved client-side). A magic mutation goes
through the **same settable allowlist** a client `_updates` entry obeys (ADR-0013): a `$set` on a
locked or non-`@Wire` field is *dropped*, never an exception. It can never invoke a method.

### Full lifecycle hooks — convention-named, dispatched through the bus

`LifecycleHooks.of(type)` reflects (and caches) the convention-named hooks; `LifecycleHooksListener`
(registered on MOUNT, HYDRATE, UPDATE, RENDER, DEHYDRATE) invokes them at the matching phase.
Ordering, the load-bearing part: `updating` / `updating{Prop}` run on UPDATE **before** the field is
written (old value); `updated` / `updated{Prop}` run as the UPDATE finish callback **after** the
write (new value), exactly the ADR-0022 strict-ordering seam. `boot` runs before mount/hydrate work,
`booted` as the finish; `rendering` before the render, `rendered` after; `dehydrate` as the state is
read back. None of these methods is an `@LievitAction`, so the client cannot call a hook as an
action (ADR-0013).

### Component events — `@LievitOn`, targeting, dynamic names

`@LievitOn("name")` (new annotation, method- or class-level, repeatable) declares a listener;
class-level is a bare `$refresh` listener (re-render, no handler). `EventListenerMetadata` reflects
them and resolves `{dotted.path}` placeholders against `@Wire` state per call (`post.{post.id}.saved`
→ `post.2.saved`). The dispatcher routes inbound events (carried in a new `_events` payload field)
to matching listeners via `EventInvoker`, binding the detail to handler parameters by name. The
emitting side gains targeting: `LievitEffects.dispatchSelf` / `dispatchTo` set a `target` on the
`DispatchedEvent`, serialized to the effect's `self` / `to` keys so the **client** routes delivery.

**Client contract (documented here, implemented by the client-directive sibling):** the
`Lievit-Effects` header's `dispatch` array carries `{name, detail, to?, self?}`. The runtime
re-emits each as a `CustomEvent(name, {detail})` on `window`; for every component listening for
`name` (respecting `to` = component-name and `self` = the dispatcher only), it issues a wire call to
that component carrying `_events: [{name, detail}]`. The server then runs the matching `@LievitOn`
listeners and re-renders the receiving component. `$dispatch(name, detail)` in an `l:*` expression
maps to a global dispatch.

### Redirects — render-skip default

`LievitEffects.current().redirect(location)` already queues the `redirect` effect (ADR-0012).
`RedirectListener` (RENDER phase) additionally calls `requestSkipRender()` when a redirect is
queued, so the response carries no HTML the client is about to discard (Livewire's
`render_on_redirect = false` default). Route-name resolution (`redirectRoute`) and the full-page-vs-
wire 3xx distinction live in the starter/web layer; the core API is the imperative `redirect(url)`.

### Wiring

The starter's default `LifecycleBus` bean now registers the built-in listeners (hooks, session,
magic, renderless, redirect). Each no-ops for a component that does not use its feature, so a plain
component (the Counter) is byte-for-byte unchanged. The web layer parses `_events`, threads them to
`dispatcher.call(..., inboundEvents)`, and binds an `HttpSessionStore` per call (ADR-0031). The
`Lievit.test` harness gains `assertDispatched` / `assertNotDispatched` / `assertDispatchedTo` /
`assertRedirect` / `assertNoRedirect`.

## Consequences

- The four P0 runtime features ship as listeners + effect data, proving the ADR-0022/ADR-0012 seam:
  the dispatcher gained one overload and zero reordered steps.
- `@LievitOn` is the eighth annotation; ADR-0002's cap is superseded for the parity surface, with
  this ADR as the documented reason. The settable-allowlist and action-allowlist security
  properties (ADR-0013) are unchanged: magic mutations and event handlers both stay inside them.
- The wire protocol gains an optional `_events` request field and `to`/`self` keys on the `dispatch`
  effect; both are additive (absent = the pre-#34 behaviour), so existing clients/snapshots survive.
- The client half of events / `$parent` / magic-action proxies is a separate (client-directive)
  work item; the server contract above is the interface between them.

## Alternatives considered

**Route inbound events as synthetic `_calls` entries.** Reuse the call pipeline by naming the
listener in `_calls`. Rejected: it would put listener method names into the action allowlist (a
security regression) and conflate "the user clicked this action" with "an event arrived". A separate
`_events` field keeps the two authorization surfaces distinct.

**Magic actions as a dispatcher branch.** Hardcode `$set`/`$toggle` in `invokeAction`. Rejected: it
is exactly the special-case sprawl ADR-0022 exists to prevent; the CALL early-return seam was built
for this.

**Make every lifecycle hook an annotation.** `@LievitBoot`, `@LievitUpdated`, … Rejected: it would
add seven+ annotations against ADR-0002 for hooks Livewire resolves by convention; the
convention-naming keeps the annotation surface to the one (`@LievitOn`) that genuinely needs a name.
