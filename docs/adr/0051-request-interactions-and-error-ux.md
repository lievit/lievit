# ADR-0051: Request interactions, per-scope concurrency + the page-expired recovery hook

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

The client runtime (ADR-0019/0024) drives wire calls but had no concurrency policy between
simultaneous calls and no graceful recovery for an expired session. Two gaps, both client-side:

1. **Concurrency (#95).** Livewire v4's `SupportRequestInteractions` scopes calls independently per
   component AND per island and applies a fixed cancel-vs-queue matrix: a user action does not
   cancel another in-flight user action (it queues after it) but does cancel an in-flight poll; a
   poll never cancels a user action; a later poll cancels an earlier poll; different scopes never
   interfere. lievit already had **request bundling** (the per-component `inFlight` promise chain
   serializing user commits) and a **custom-header hook** (an interceptor mutating `headers`), so
   the queue half and the `request` hook were done. Missing: the *cancel* half and the per-scope
   isolation, and a genuine abort of the superseded fetch (not just ignoring its result).

2. **Error-responses UX (#103).** A `409 snapshot-expired` / `410` class-gone failure triggered an
   unconditional hard re-mount (full page reload) inside `dispatch`. That is a broken-feeling UX:
   Livewire's `SupportErrorResponses` instead shows a native "this page has expired, reload?"
   confirm (deduped across concurrent failures), suppressing any error overlay, and lets apps
   override via the request hook's `fail`/`preventDefault`.

Both must compose the existing seams (ADR-0019/0024), never fork the core loop.

## Decision

### 1. An abort signal on the wire send path

`SendOptions` gains an optional `signal: AbortSignal`, passed straight to `fetch`. A superseded
in-flight call is genuinely aborted, not merely discarded. When `dispatch` catches a rejection whose
`signal.aborted` is true, it returns silently (no error phase, no report): a poll cancelled by a
click never flashes an error.

### 2. `ConcurrencyRegistry`, the cancel-vs-queue matrix as a pure state machine (#95)

A new `concurrency.ts` owns the matrix. The scope key is `(componentId, island)`, so a component's
own calls and each of its islands are independent. `begin(componentId, island, kind)` (kind =
`user` | `poll`) applies the matrix against any in-flight call for the scope, hands back an
`AbortSignal` + a `proceed` verdict + a token, and records the new in-flight call:

```
  incoming \ in-flight │ (idle)   user        poll
  ─────────────────────┼──────────────────────────────────
  user                 │ proceed  proceed[Q]  proceed +abort-poll
  poll                 │ proceed  DROP        proceed +abort-poll
```

`user` over `user` does not abort (the existing `inFlight` chain queues it); a `poll` behind a
`user` is **dropped** (`proceed:false`); a `user` or newer `poll` over a `poll` aborts it. `end(...,
token)` clears the slot only if this call still owns it (a late-settling superseded call never
clobbers its successor). The runtime constructs one registry, calls `begin` at the top of
`dispatch`, threads the signal into `send`, and `end`s in a `finally`.

**Poll ticks bypass the per-component commit queue.** `callAction`/`refresh` with `meta.poll` go
straight to `dispatch` (racing) instead of `enqueue` (queuing), so the matrix governs them: queuing
a poll would defeat "a later poll cancels an earlier poll" and "a poll behind a user action is
dropped". User commits still queue through `inFlight`.

### 3. The `onExpired` recovery hook + the page-expired feature (#103)

The interceptor surface gains an `onExpired(control, outcome)` phase fired on a `409`/`410` failure
*before* the default re-mount, mirroring `onRedirect`. `ExpiredControl` carries `status` / `reason`,
a `preventDefault()` (suppress the hard reload, own the recovery), and a `defaultPrevented()` getter
so a later handler can defer to an earlier one. `dispatch` skips `remount()` when any handler
prevented default.

The built-in `installPageExpired` feature registers an `onExpired` handler that preventDefaults and
shows a native confirm once (a shared `prompting` flag dedups concurrent failures), reloading on
accept; it also covers the `403`-CSRF case via `onError` (excluding the `locked-property` tamper
reason, same status). An app overrides by registering its own `onExpired` first and calling
`preventDefault()`; the feature reads `defaultPrevented()` and stays silent. The dialog/reload
functions are injectable for tests; CSP-safe (`window.confirm` + `location.reload`, no `eval`).

## Consequences

- The concurrency policy is a pure, exhaustively-tested state machine independent of the DOM and
  fetch; the runtime only threads its signal and verdict. The full user/poll x component/island
  matrix is covered by an integration test against the real runtime.
- A superseded fetch is truly aborted (the request leaves the network), not just ignored, so a rapid
  poll/click burst does not pile up requests.
- The `request` hook (custom headers) and request bundling (user-over-user queue) were already
  present; this ADR adds only the cancel half + per-scope isolation, so the change is additive.
- Expired recovery is now a hookable seam: the default reload, the built-in dialog, or an app's
  custom UX, selected by interceptor registration order. No core edit beyond the one `onExpired`
  offer in `dispatch`.

## Out of scope (deferred): #123 disable bfcache for sensitive components

#123 (a `disableBackButtonCache()` runtime call in `mount` producing no-cache/no-store response
headers via a Spring response filter, reset per request) is **entirely server-side** (its own
acceptance says "client-side: none"). It needs a `lievit-core` component-context API + a
`lievit-spring-boot-starter` servlet filter, which is outside this client-runtime slice's touch
surface. Tracked for a server-side slice; this ADR does not address it.

## Alternatives considered

**Reuse the `inFlight` queue for polls too.** Rejected: queuing a poll behind the in-flight call
makes "a later poll cancels an earlier poll" impossible (the second poll would wait, not race) and
turns a dropped-poll into a delayed-poll. Polls must race; the matrix, not the queue, governs them.

**Model the page-expired dialog as a lifecycle hook (the passive bus).** Rejected: a lifecycle hook
cannot suppress the default re-mount (it only observes). The recovery must be *steerable*, so it
belongs on the participating interceptor chain with a `preventDefault`, like `onRedirect`.

**Conflate every 403 with session-expiry.** Rejected: a `403 locked-property` is a tamper guard, not
an expiry; prompting "page expired, reload?" on a tamper attempt is wrong. The feature excludes it
by reason.
