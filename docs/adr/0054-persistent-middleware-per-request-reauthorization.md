# ADR-0054: Persistent middleware / per-request re-authorization on the wire endpoint

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Every wire update is a POST to the same `/lievit/{id}/call` endpoint, not the page's original route
(issue #179). In Laravel that bypasses the page route's middleware, so Livewire reconstructs the original
path, re-resolves the route, and re-applies an allowlist of persistent middleware (auth, authorize,
substitute-bindings) on the AJAX endpoint. lievit shares the stateless-snapshot architecture, so the same
question applies: is a wire update authorized as strongly as the page that rendered the component, on
every POST?

Two layers of authorization are in play and must not be conflated:

- **URL-level protection** (the page sits behind a Spring Security rule like
  `.requestMatchers("/admin/**").hasRole("ADMIN")`).
- **Per-action authorization** (`@LievitAuthorize` / `@PreAuthorize` on the specific action, ADR-0053).

## Decision

**Spring's filter chain gives most of #179 for free; lievit adds the per-update action re-check.**

1. **The wire endpoint sits INSIDE the app's `SecurityFilterChain`.** Unlike Laravel (whose AJAX route
   bypasses the page's per-route middleware), Spring Security matches a filter chain by URL pattern
   across ALL requests. So `POST /lievit/{id}/call` is covered by whichever chain's matcher includes it,
   and session auth + CSRF + the authentication context are re-established on **every** POST by the
   framework itself. This is the Spring-native equivalent of Livewire's persistent middleware: an
   adopter routes `/lievit/**` through the same chain as the protected pages (the documented convention;
   the bundled examples leave `/lievit/**` permitAll at the URL level and rely on per-action checks,
   which is the other valid posture).

2. **`@LievitAuthorize` is re-evaluated on every wire call, never cached from mount** (ADR-0053). The
   `WireDispatcher` consults the `ActionAuthorizer` immediately before each action and each matched
   `@LievitOn` listener, on every `call(...)`. There is no per-mount authorization memo to go stale: the
   check reads the live `Authentication` from the `SecurityContext` the filter chain just populated. This
   is the explicit-per-action half of #179, complementary to the URL-level half the chain enforces.

3. **The session-expired-mid-interaction story composes with the existing page-expired UX (ADR-0051).**
   When the session expires between mount and a later update, the chain rejects the POST: a `401`/`403`
   from an authentication/authorization filter, or a `409 snapshot-expired` when the snapshot TTL lapses.
   ADR-0051's `onExpired` / `onError` interceptor seam already turns a `409`/`410` (and the `403`-CSRF
   case) into the deduped "this page has expired, reload?" recovery, overridable per app. A
   `403 forbidden-action` from a denied action is deliberately NOT treated as expiry (same exclusion
   logic ADR-0051 uses for the `locked-property` tamper): a genuine authorization denial is not a stale
   session and must not prompt a reload.

**Deferred (not in this slice): the route-model-binding harvest.** Livewire's persistent middleware also
harvests route-model bindings resolved on the original path so the model synth reuses them without a
re-query. lievit has no route-model-binding-into-`@Wire` synth yet (a `@LievitPage` seeds path variables
as props, ADR-0033, but there is no shared resolved-entity cache). When that synth lands, the original
path + method can be memo'd on dehydrate and the resolved entity reused; until then there is nothing to
harvest, so the memo is not added (it would be dead weight on every snapshot).

## Consequences

- The #179 security hole ("a wire update bypasses the page's authorization") does not exist in lievit as
  long as `/lievit/**` is in the protecting chain: the filter chain re-authorizes every POST, and
  `@LievitAuthorize` re-checks every action. No bespoke path-reconstruction machinery is needed, because
  Spring matches chains by URL, not by route.
- The two postures are explicit and documented: URL-level (route the wire endpoint through the page's
  chain) and per-action (`@LievitAuthorize`). An adopter can use either or both.
- Expired-session recovery is already solved (ADR-0051); this ADR only pins that an authorization denial
  is distinct from an expiry and must not trigger the reload prompt.
- The route-model-binding optimization is deferred without a security cost: authorization does not depend
  on it; it is purely a re-query saving for a synth that does not exist yet.

## Alternatives considered

**Port Livewire's mechanism literally: memo the original path + method, reconstruct a fake request,
re-resolve the route, run an allowlist of filters.** Rejected: it reimplements what Spring's URL-matched
filter chain already does for free, fighting the framework lievit lives inside (ADR-0007's "never
reimplement what Spring owns"). The path-reconstruction exists in Laravel precisely because its
middleware is per-route; Spring's is per-URL, so the problem is already solved upstream.

**Cache the per-action authorization decision in the snapshot memo at mount.** Rejected: it is a security
regression. A principal's authorities can change between mount and a later update (role revoked, session
re-authenticated as someone else); a cached allow would let a now-unauthorized action run. Re-checking on
every call is the only correct posture.
