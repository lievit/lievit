# Authorization

lievit authorizes actions on **Spring Security**, the canonical mechanism, not an invented one. The
starter depends on `spring-boot-starter-security`; a wire action is authorized by the same SpEL you
already write for `@PreAuthorize`, against the same `Authentication`, with the same
`PermissionEvaluator`. The reasoning is in [ADR-0053](../adr/0053-spring-security-authorization-backbone.md)
and [ADR-0054](../adr/0054-persistent-middleware-per-request-reauthorization.md).

## The default is permissive

Adding Spring Security to the classpath changes nothing until you opt in:

- An action with **no** authorization annotation always runs.
- The starter ships a permit-all `SecurityFilterChain` that exempts `/lievit/**` from CSRF (the
  snapshot HMAC is the wire endpoint's integrity guarantee). It exists only to neutralize Spring
  Boot's default lock-down; **declare your own chain and it is replaced entirely**.

So you secure exactly the actions you annotate, and you bring your own login flow.

## `@LievitAuthorize` on an action

`@LievitAuthorize` carries a Spring Security expression (the `@PreAuthorize` language). The dispatcher
checks it **before** the action runs; a denied action never executes and never mutates state. The
client gets a fail-closed `403` with `Lievit-Reason: forbidden-action`.

```java
@LievitComponent
public class InvoiceComponent {

    @Wire long invoiceId;

    @LievitAction
    @LievitAuthorize("hasRole('ADMIN')")
    void deleteInvoice() { /* runs only for ROLE_ADMIN */ }

    // Plain @PreAuthorize is honored too.
    @LievitAction
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    void saveDraft() { /* runs only for an authenticated principal */ }
}
```

The full expression vocabulary is available: `hasRole`, `hasAnyRole`, `hasAuthority`,
`isAuthenticated`, `isFullyAuthenticated`, `hasPermission`, and any custom bean (`@authz.check(...)`).

### Stacking (AND)

`@LievitAuthorize` is repeatable; stacked checks must **all** pass:

```java
@LievitAction
@LievitAuthorize("isAuthenticated()")
@LievitAuthorize("hasRole('ADMIN')")
void purge() { /* requires authenticated AND admin */ }
```

### Authorizing against the component's own state

The expression's root is Spring Security's `MethodSecurityExpressionRoot` (exactly as
`@PreAuthorize`). The component instance the action runs on is reachable as **`#root.this`**, so you
can authorize against its `@Wire` state. The property needs a public getter.

```java
@LievitAction
@LievitAuthorize("hasPermission(#root.this.invoiceId, 'Invoice', 'update')")
void approve() { ... }

public long getInvoiceId() { return invoiceId; }
```

## Object permissions: the `PermissionEvaluator` (the Policy analog)

`hasPermission(...)` delegates to a Spring Security `PermissionEvaluator`. Declare one bean and the
starter wires it into the expression handler automatically:

```java
@Bean
PermissionEvaluator permissionEvaluator() {
    return new PermissionEvaluator() {
        @Override public boolean hasPermission(Authentication auth, Object target, Object permission) {
            return /* row-level policy: is `target` the agent's own record? */;
        }
        @Override public boolean hasPermission(
                Authentication auth, Serializable id, String type, Object permission) {
            return /* id/type policy */;
        }
    };
}
```

This is the Laravel-Policy / Filament `HasAuthorization` analog: domain-object authorization in one
place, reachable from every action's expression.

## The event path is not a bypass

`@LievitAuthorize` on a `@LievitOn` listener is enforced exactly as on an `@LievitAction`: an event
the client routes to a guarded listener is denied (`403 forbidden-action`) if the principal fails the
check. A naive clone authorizes `l:click` but lets an event-triggered method run unauthorized; lievit
closes that gap.

```java
@LievitOn("invoice-submitted")
@LievitAuthorize("hasRole('ADMIN')")
void onSubmitted() { ... }
```

## Per-request re-authorization (the persistent-middleware question)

Every wire update is a POST to the same `/lievit/{id}/call`. Two things keep it as protected as the
page that rendered it ([ADR-0054](../adr/0054-persistent-middleware-per-request-reauthorization.md)):

1. **The wire endpoint sits inside your `SecurityFilterChain`.** Spring matches chains by URL across
   all requests, so if you route `/lievit/**` through the chain that protects your pages, session
   auth and authorization are re-established on every POST. This is the Spring-native equivalent of
   Livewire's persistent middleware: no path reconstruction needed, because Spring's middleware is
   per-URL, not per-route.
2. **`@LievitAuthorize` is re-evaluated on every call**, never cached from mount. The check reads the
   live `Authentication`, so a revoked role takes effect on the next update, not after a re-mount.

You can use either posture or both: URL-level protection (route `/lievit/**` through the page's
chain) and/or per-action `@LievitAuthorize`. The bundled examples leave `/lievit/**` permitAll at the
URL level and rely on per-action checks.

### Session expired mid-interaction

If the session lapses between mount and a later update, the chain rejects the POST (a `401`/`403`, or
a `409 snapshot-expired` when the snapshot TTL passes). The client runtime's `onExpired` / `onError`
recovery ([ADR-0051](../adr/0051-request-interactions-and-error-ux.md)) turns that into the deduped
"this page has expired, reload?" prompt, which you can override. A `403 forbidden-action` from a
denied action is deliberately **not** treated as expiry: a genuine authorization denial does not
prompt a reload.

## The kit: per-resource policy checks

`lievit-kit` funnels every write through an `AdminAuthorizer`. Wire the
`PermissionEvaluatorAdminAuthorizer` bean and each Resource auto-checks the policy per operation
(`view` / `create` / `update` / `delete`), Filament's automatic per-resource policy check:

```java
@Bean
AdminAuthorizer adminAuthorizer(PermissionEvaluator permissionEvaluator) {
    return new PermissionEvaluatorAdminAuthorizer(permissionEvaluator);
}
```

A record-scoped op (edit / delete) authorizes against the concrete record (`hasPermission(auth,
record, "update")`); a resource-scoped op (list / create) authorizes against the resource slug. Deny-
by-default applies only once this authorizer is wired; absent it the kit keeps `permitAll()`.
