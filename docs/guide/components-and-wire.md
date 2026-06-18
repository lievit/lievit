# Components and the wire protocol

A component is a typed Java class. Its life on the wire is a loop of four phases: the first two run
once on the initial page load, the last two repeat for every interaction. This page is the
practical view; the [normative spec](../wire-protocol.md) and [ADR-0001](../adr/0001-wire-protocol-v0.1.md)
own the precise contract.

## The lifecycle

```
[1] MOUNT   (first load)  construct the instance, run @LievitMount, seed @Wire fields
[2] RENDER  (first load)  produce HTML, sign a snapshot of @Wire state, embed both in the page
--- the page is now live; every interaction is a wire call ---
[3] ACTION  (browser→server) an l:* event collects the snapshot + pending updates + the action,
                              POSTs /lievit/{id}/call
[4] RE-RENDER (server→browser) verify, rehydrate, apply updates, run the action, re-render,
                               sign a fresh snapshot, morph the DOM in place
```

The invariant: **the server never holds component state between calls.** State lives in the signed
snapshot, which the client carries. Any instance can serve any call. This is what lets the runtime
scale out and scale to zero.

## The annotations

| Annotation | Purpose |
|---|---|
| `@EnableLievit` | Turns on the starter autoconfiguration (on a `@Configuration`). |
| `@LievitComponent` | Marks a class as a server-side component (implicitly a Spring `@Component`). |
| `@Wire` | Binds a field bidirectionally, compile-time type-checked. |
| `@LievitAction` | Marks a method callable from the template. |
| `@LievitMount` | Lifecycle hook: after construction, before render. |
| `@LievitRender` | Custom pre-render hook (or, in single-file mode, returns the `Html` tree). |
| `@LievitProperty` | Extended metadata on a `@Wire` field (`locked`, `modelable`, serialize hooks). |
| `@LievitComputed` | A no-arg method as a per-request computed property — see [computed](computed-and-lifecycle.md). |
| `@LievitUrl` | Reflects a `@Wire` field into the URL query string. |
| `@LievitOn` | Event listener — see [events](events.md). |
| `@LievitRenderless` | Marks an action as renderless (no HTML patch after it runs). |
| `@LievitSession` | Persists a `@Wire` field into the HTTP session (the opt-in exception to statelessness). |
| `@LievitLayout` / `@LievitTitle` | Full-page component: the layout it renders inside and its `<title>`. |

## What crosses the wire

The snapshot is a signed token (HS256, JWT-like) whose payload carries **state, never code**:

| Field | Meaning |
|---|---|
| `cid` | Component ID (a UUID v4, Crockford base32; the `{id}` in the endpoint path). |
| `cls` | The fully-qualified class name. The wire carries the *name*; the server owns the class. |
| `wire` | The serialized `@Wire` field state — the only mutable state on the wire. |
| `iat` / `exp` | Issued-at / expiry (idle TTL, 1 h default). |

A tampered `cls` is a `410 Gone` lookup failure, never a code-execution vector. There is no code, no
behavior, no DOM in the snapshot.

### Typed `@Wire` values round-trip exactly (ADR-0020)

Primitives, strings, and plain JSON pass through the wire unwrapped, so a Counter snapshot is
byte-identical to the naive encoding. A **non-primitive** `@Wire` value (a record, an enum,
`LocalDate` / `LocalDateTime` / `Instant`, `BigDecimal`, `UUID`, a `Set`, a non-String-keyed `Map`,
or a user value object) dehydrates to a `@w`-tagged `{d, s, t}` tuple and hydrates back to the
**exact** type, recursively, instead of decoding to a bare `LinkedHashMap`:

```java
public record Distance(int meters) implements Wireable {
    @Override public Object toWire() { return meters; }
    public static Distance fromWire(Object data) {
        return new Distance(((Number) data).intValue());
    }
}
```

The `Wireable` SPI (`toWire()` + a static `fromWire(Object)`) is the explicit, native-image-safe
opt-in; built-in synthesizers cover the JVM analogues of Livewire's set. See
[ADR-0020](../adr/0020-typed-state-synthesizers.md). Reflective instantiation of the class named in a
tuple's `t` is gated default-deny by [ADR-0021](../adr/0021-class-instantiation-guard.md): a
gadget-prone root is a `422 forbidden-deserialization`, never a 500.

## Locked fields: state the client must never set

The signature proves the snapshot was not altered *between* requests. It does **not** stop the
*first* POST from setting any `@Wire` field to any value. For an id, a price, or a role flag, mark
the field server-authoritative with `@LievitProperty(locked = true)`:

```java
@Wire
@LievitProperty(locked = true)
public String redirectTo = "";   // the server sets it; an inbound update is rejected 403
```

The server seeds it (mount / action) and serializes it so the template can render it, but any
inbound `_updates` entry targeting it is rejected with `403 locked-property`. The lock, not the
signature, is the defense. See the [wire protocol §3](../wire-protocol.md#what-the-signature-does-not-cover-locked-fields).

## The settable / callable allowlist (ADR-0013)

The annotation **is** the authorization allowlist, on the first POST and every later one:

- Only a `@Wire` field is client-settable. An `_updates` entry for a non-`@Wire` name is dropped.
- Only a `@LievitAction` method is client-callable. A `_calls` entry naming a lifecycle hook, a
  getter, or any non-action method is a `410 Gone`.

The signature bounds tampering between requests; the allowlist bounds what a well-formed request may
do. See [ADR-0013](../adr/0013-payload-hardening.md).

## Error codes you will meet

Every wire call lands in exactly one terminal state, fail-closed with an empty body (the
`Lievit-Reason` header is the whole contract; [ADR-0014](../adr/0014-fail-closed-error-rendering.md)):

| Code | When | Client reaction |
|---|---|---|
| `200` | Success | Morph the DOM, store the new snapshot. |
| `409 snapshot-expired` | The snapshot aged past `exp` | Re-mount (fresh GET). |
| `410` | `cls` no longer resolves to a component | Re-mount; the build moved on. |
| `413 too-large` / `too-complex` | Payload over 64 kb, or too many updates/calls | Surface an error; do not retry. |
| `422 forbidden-deserialization` | A non-JSON `@Wire` value reached the wire | A bug or a gadget attempt. |
| `403 locked-property` | An update targeted a locked field | A bug or a tamper attempt. |
| `429 too-many-failures` | >10 forged/tampered snapshots in 600 s | Back off. |
| `504` | An action exceeded the 5 s timeout | Surface a timeout. |

## The endpoint inherits the page's security

`POST /lievit/{id}/call` is a state-changing request that must run at the same trust level as the
page that rendered the component. lievit does not bundle Spring Security; the contract is the host
app's:

- The endpoint must be covered by the **same Spring Security filter chain** as the host page
  (`/lievit/**` is matched by URL pattern). An action must never run less-authenticated than the page.
- Keep CSRF protection enabled; the `_token` rides in the payload and Spring's standard CSRF filter
  validates it upstream of the controller.
- No servlet filter may mutate the request body (trim, lowercase, empty-to-null) ahead of the wire
  endpoint: it would corrupt the signed snapshot.

See the [wire protocol §7](../wire-protocol.md#7-the-wire-endpoint-inherits-the-pages-security-context-adr-0014).
