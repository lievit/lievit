# ADR-0053: Spring Security is lievit's authorization backbone (`@LievitAuthorize` + the action authz seam)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

A wire action (`@LievitAction`) is callable from the client. lievit's only authorization until now was
structural: the annotation IS the allowlist (ADR-0013), so only a `@Wire` field is settable and only a
`@LievitAction` is callable. That answers "which methods are reachable", not "may THIS principal invoke
this one". Per-action authorization (Livewire's `#[Authorize]`, Laravel's `Gate`) was absent (issue #57,
P1, security-critical).

ADR-0014 chose to keep the starter **Spring-Security-agnostic** (no forced dependency), documenting the
filter-chain contract instead. That was right while lievit had no authorization model of its own. It no
longer is: a framework whose headline use is a Spring Boot gestionale must ship authorization on the
canonical mechanism, not push every adopter to hand-wire it. So this ADR supersedes ADR-0014's
"no forced dependency" stance (the leak-free error-rendering half of ADR-0014 stands unchanged).

The hard constraints: the wire codec / dispatcher is pure Java, zero Spring (ADR-0007); the public
annotation surface was capped at seven (ADR-0002); and the existing ~hundreds of tests must stay green
when Spring Security lands on the classpath (Spring Boot's default `SecurityFilterChain` otherwise locks
down every endpoint with HTTP Basic). Spring Boot 4 ships Spring Security 7.

## Decision

**Spring Security is the authorization backbone.** `lievit-spring-boot-starter` now depends on
`spring-boot-starter-security` (not optional: it is the security spine, present by default).

**`@LievitAuthorize` (the eighth annotation).** A repeatable method annotation carrying a Spring Security
SpEL string (the exact `@PreAuthorize` expression language), usable on a `@LievitAction` (or a
`@LievitOn` listener). It is admitted as the eighth public annotation; this ADR supersedes the count in
ADR-0002 (authorization is security-critical and cannot be expressed as convention). Plain
`@PreAuthorize` / `@PostAuthorize` on an action are honored too. Stacked `@LievitAuthorize` are
AND-combined.

**The seam lives in core, the Spring binding in the starter.**

- `lievit-core` gains a pure-Java SPI `ActionAuthorizer.authorize(component, method)` and a new
  `WireError.FORBIDDEN_ACTION` (403, `forbidden-action`). The `WireDispatcher` consults the authorizer
  **before** invoking the action and **before** a matched `@LievitOn` listener runs (the Livewire
  `SupportEvents` bypass the study flagged: the event path must enforce authorization identically). A
  deny is fail-closed: the body never runs, no state mutates. The default authorizer is
  `permitAll()` (no Spring in core, ADR-0007 intact). `@LievitAuthorize` is a pure annotation, no Spring
  import.
- `lievit-spring-boot-starter` binds a `SpringSecurityActionAuthorizer` that evaluates the SpEL the
  canonical way: Spring Security's `MethodSecurityExpressionHandler` parses the expression
  (`getExpressionParser().parseExpression`), builds the context
  (`createEvaluationContext(authentication, methodInvocation)`), and `ExpressionUtils.evaluateAsBoolean`
  decides (the documented WebSocket `MessageExpressionAuthorizationManager` migration recipe). The same
  `MethodSecurityExpressionRoot` backs it, so `hasRole`, `hasAuthority`, `isAuthenticated`,
  `hasPermission` all resolve as in `@PreAuthorize`. The component is reachable as `#root.this`.

**The `PermissionEvaluator` SPI is the Policy analog.** When the host declares a `PermissionEvaluator`
bean it is attached to the expression handler, so `hasPermission(#root.this.invoice, 'update')` works.
The kit ships `PermissionEvaluatorAdminAuthorizer` (an `AdminAuthorizer`) that maps each
`AdminOperation` to a permission (`view`/`create`/`update`/`delete`) and calls the evaluator per action,
so a kit Resource auto-checks the policy on each operation (Filament's automatic per-resource policy
check).

**Permissive default (backward compatible).** Three things make the old tests pass:

1. The starter ships a permissive default `SecurityFilterChain` (`@ConditionalOnMissingBean`) that
   `permitAll()`s every request and exempts `/lievit/**` from CSRF, neutralizing Spring Boot's default
   lock-down. An app that declares its own chain (the documented secure convention, e.g. both bundled
   examples) fully replaces it.
2. `SpringSecurityActionAuthorizer` permits any action with no authorization annotation: enforcement is
   opt-in per action.
3. The kit's deny-by-default applies only when an adopter wires the `PermissionEvaluatorAdminAuthorizer`;
   absent it, `AdminAuthorizer.permitAll()` still holds.

## Consequences

- Per-action authorization ships on the canonical Spring mechanism: an adopter writes the same SpEL they
  already know, against the same `Authentication`, with the same `PermissionEvaluator`.
- Adding Spring Security to the classpath changes no existing behavior: the permissive default chain +
  the permit-unless-annotated authorizer keep every prior test green (one test moved from a raw
  `.principal()` to Spring Security's `user(...)` test support, the canonical way to authenticate a
  MockMvc request once a chain is active).
- The eighth annotation is a deliberate, security-motivated exception to ADR-0002; the bar (an ADR that
  supersedes it) is met.
- A denied action is a leak-free 403 (`forbidden-action`): the client never learns which expression
  failed or against what (ADR-0014's leak-free half, preserved).
- `lievit-core` stays Spring-free: the authorization decision is an SPI; only the starter knows Spring
  Security.

## Alternatives considered

**Keep ADR-0014's "no forced dependency" and document the contract only.** Rejected: it pushes
security-critical wiring onto every adopter and gives lievit no first-class authorization story, which a
gestionale-first framework cannot afford.

**Rely on Spring's AOP `@EnableMethodSecurity` proxy to enforce `@PreAuthorize` on the action.**
Rejected as the primary mechanism: the dispatcher invokes the action via reflection on the resolved
`Method`, not always through the proxy, and method-security AOP does not cover the `@LievitOn` event
path. Evaluating the expression programmatically in the `ActionAuthorizer` is deterministic, unit-
testable, and covers both paths uniformly. AOP method security stays available for an adopter's own
service methods.

**Force the starter's chain to authenticate everything (secure-by-default).** Rejected: it would break
the existing tests and impose a login flow on every app the moment the dependency lands. The secure
convention is documented and one chain-bean away; the safe-but-open default is the backward-compatible
floor.
