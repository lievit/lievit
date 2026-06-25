# ADR-0014: Fail-closed, leak-free error rendering + the wire endpoint's security context

- **Status:** accepted; the "no forced Spring Security dependency" stance superseded by ADR-0053
  (the starter now depends on Spring Security as its authorization backbone). The leak-free
  error-rendering decision and the filter-chain contract below stand unchanged.
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

The Livewire study (`docs/research/livewire-design-decisions-complete.md` §Security 6, 8) flagged
two posture gaps on the wire endpoint:

- **Error leakage.** Livewire renders a generic `419`/`404` in production and the full trace only in
  local debug; the snapshot-diff debugger is hard-disabled outside dev
  (`CorruptComponentPayloadException.php:19-31`, `SupportChecksumErrorDebugging.php:12-13`). A naive
  Spring controller does the opposite: an unhandled exception reaches Spring's default error
  handling, which can surface the message, the internal class names, and a stack trace to the
  client.
- **Security context on the endpoint.** Livewire's update route is in the `web` middleware group
  (CSRF), re-applies the page's auth/session middleware on the AJAX endpoint
  (`PersistentMiddleware.php`), and returns `404` (not `403`) to unknown requests to avoid
  confirming the endpoint to scanners (`RequireLivewireHeaders.php:14-17`).

lievit's `WireException` handler already returns an empty body with only the `Lievit-Reason` header;
the gap is the *non-`WireException`* path (an action that throws, a binding failure) and the
documentation of the endpoint's security-context contract.

## Decision

**Fail-closed, leak-free error rendering.** `LievitWireController` carries two exception handlers:

- `@ExceptionHandler(WireException.class)` maps the carried `WireError` to its terminal status +
  `Lievit-Reason` header with an **empty body**. The exception message is never written to the
  response (it may name internal detail). Unchanged from ADR-0001 except this is now explicit.
- `@ExceptionHandler(Exception.class)` is the catch-all backstop: any other throwable (a
  `@LievitAction` that threw, a deserialization or binding failure, an unexpected runtime error) is
  **logged server-side with its full detail** (message, stack trace, FQN) and answered with a
  generic `500` + `Lievit-Reason: internal-error` and an **empty body**. The client learns *that* it
  failed and the coarse reason; never the internals. New `WireError.INTERNAL_ERROR` (500,
  `internal-error`).

The invariant: **no error response carries a stack trace, an internal class name (FQN), the
exception message, or any snapshot / token / payload content.** Detail lives only in the server log.
Pinned by `HostileWireIT` (a throwing action whose message names a fake internal class
`dev.lievit.secret.GadgetChain`; the test asserts none of it reaches the body).

**The wire endpoint inherits the page's security context.** lievit does not put Spring Security on
the starter's classpath (it would force a dependency on every consumer). The contract instead is
documented and is the host application's responsibility:

- The `POST /lievit/{id}/call` endpoint **must be covered by the same Spring Security filter chain**
  that protects the page that rendered the component. Spring Security applies a filter chain by URL
  pattern across all requests, so unlike Livewire (whose AJAX route bypasses the page's per-route
  middleware) lievit's endpoint is covered by default *as long as the chain's matcher includes
  `/lievit/**`*. An action must never run less-authenticated than the page.
- **CSRF**: the `_token` rides in the payload (ADR-0001). When Spring Security is present its
  standard CSRF filter validates it and rejects a missing/invalid token with its own `403`, upstream
  of the controller. lievit adds nothing here; it documents that CSRF protection must remain enabled
  for the endpoint (it is a state-changing POST).
- **No request-body-mutating filter** (trim, empty-to-null) may run before the snapshot is read: it
  would corrupt the signed payload and turn every call into a forgery. Documented in
  `wire-protocol.md` §7.
- **Scanner posture**: an unknown component is already `410 Gone` (the class moved) and an
  unmatched path is the servlet container's `404`; lievit keeps the 404/410 posture (not `403`) so
  the endpoint does not confirm a component's existence to a probe. Confirmed, not changed.

## Consequences

- A production deployment cannot leak internals through an error: the worst an attacker learns is the
  coarse `Lievit-Reason`. Debuggability is preserved server-side via the log.
- The starter stays Spring-Security-agnostic (no forced dependency); the security-context contract
  is explicit in the ADR and the protocol doc, so a consumer who forgets to cover `/lievit/**` is
  doing something the docs warn against, not hitting a silent default.
- The catch-all handler means an action exception is a `500`, not a stack-trace page. A genuinely
  expected error inside an action should still be modeled as state the template renders, not thrown.

## Alternatives considered

**Ship Spring Security in the starter and auto-register a filter chain for `/lievit/**`.** Tempting,
but it would impose Spring Security on every consumer and fight an app's own chain. The endpoint
should inherit the host's existing chain, not introduce a parallel one. Rejected; documented as a
contract instead.

**Return the error detail in a structured JSON body (for the client to display).** Convenient for
debugging, but it is exactly the leak the gap is about. Detail goes to the log; the client gets the
reason code only. Rejected.

**A `dev`-profile flag that re-enables detailed bodies.** Reasonable future affordance (Livewire has
the equivalent), but deferred: the leak-free default is the safe floor, and local debugging has the
server log. Revisit if developer demand appears.
