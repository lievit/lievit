# Events and `$dispatch`

Components talk to each other through events, never through shared state. An action dispatches an
event; a listener on another component reacts. The server runs the listener and re-renders only the
components that care. This is the lievit equivalent of Livewire's event bus, on a stateless wire
([ADR-0030](../adr/0030-runtime-parity-events-lifecycle-magic-redirects.md), effects channel
[ADR-0012](../adr/0012-effects-channel.md)).

## Dispatching from the server

Inside a `@LievitAction`, read the per-call effects sink and dispatch:

```java
@LievitAction
public void save() {
    repository.save(draft);
    LievitEffects.current().dispatch("saved", Map.of("id", draft.id()));
}
```

Three forms control delivery:

| Call | Delivered to |
|---|---|
| `dispatch(name, detail)` | every mounted component (global) |
| `dispatchSelf(name, detail)` | only the dispatching component |
| `dispatchTo(componentName, name, detail)` | only components of that named type |

## Dispatching from a template

`$dispatch` in an `l:*` expression is a global dispatch with no method on the component:

```html
<button l:click="$dispatch('saved', { id: 7 })">Done</button>
```

## Listening with `@LievitOn`

A method (or a class-level `$refresh`) fires when a matching event arrives. The handler's parameters
are bound from the event detail by name. `@LievitOn` is repeatable and supports dynamic
`{placeholder}` names resolved against `@Wire` state at registration time.

```java
@LievitComponent(template = "note-list")
public class NoteListComponent {

    @LievitOn("saved")
    void onSaved(int id) {   // bound from the "saved" event's { id } detail
        reload();
    }
}
```

A class-level `@LievitOn("refresh-list")` with no method body re-renders the component on that event
(the bare `$refresh` listener).

## What happens on the wire

ADR-0030 keeps the protocol additive: a call producing no events is byte-for-byte the pre-events
response shape.

1. The action's `dispatch` calls ride the `Lievit-Effects` response header as a `dispatch` array of
   `{name, detail, to?, self?}`.
2. The client re-emits each as a DOM `CustomEvent(name, {detail})` on `window` (the cross-app bus).
3. Respecting `to` (only components of that name) and `self` (only the dispatcher), the client issues
   a wire call to each *listening* component with the request field `_events: [{name, detail}]`.
4. The server runs that component's matching `@LievitOn` listeners and re-renders it.

```ts
// lievit-ui/runtime/events.test.ts — routing semantics
routeDispatchedEvents([{ name: "saved", detail: { id: 1 } }], origin, registry, bus, target);
// global: routes to OTHER mounted components

routeDispatchedEvents([{ name: "tick", self: true }], origin, registry, bus, target);
// self: only the dispatcher

routeDispatchedEvents([{ name: "refresh", to: "list" }], origin, registry, bus, target);
// to: only the named component type
```

## The client event bus

Client code can listen without a DOM element via `runtime.on(...)`:

```ts
// lievit-ui/runtime/events.test.ts
const bus = new ClientEventBus();
const seen = [];
bus.on("saved", (detail) => seen.push(detail));
bus.emit("saved", { id: 7 });
// seen === [{ id: 7 }]
```

Every `dispatch` effect is always re-emitted as a `CustomEvent` on `window`, so non-lievit code can
react too.

## The effects channel

Events are one of several non-HTML side effects an action can produce. They all ride the optional
`Lievit-Effects` header on a `200`, omitted entirely when an action produced none:

| Effect | Meaning | Client reaction |
|---|---|---|
| `redirect` | navigation requested | navigate (`location.assign`); the re-render is skipped by default |
| `dispatch` | events queued | re-emit + route to listeners (above) |
| `returns` | the action's return value | available to the caller / test API; no DOM effect |
| `url` | `@LievitUrl` field's new query string | update the address bar via the History API |
| `errors` | per-field validation messages | render inline; `l:error` / `$errors` read this |
| `islands` | island names re-rendered | morph only those fragments |
| `js` | named CSP-safe handler calls | look each name up in `runtime.js` and invoke (never `eval`) |
| `release` | the build's release token | compare to `data-lievit-release`; re-mount on mismatch |

The bag is **server-authored and never signed** (nothing the client could tamper rides in it, so it
is outside the HMAC boundary) and appears only on a `200`. Dispatches are applied **before** a
redirect, so listeners react before navigation. See
[wire protocol §5b](../wire-protocol.md#5b-the-effects-channel-lievit-effects-adr-0012).

```ts
// lievit-ui/runtime/effects.test.ts — order is deterministic
applyEffects({ dispatch: [{ name: "saved" }], redirect: "/done" }, target, navigate);
// fires "saved" listeners, THEN navigates to /done
```

## Redirects

`LievitEffects.current().redirect("/done")` queues the redirect and skips the re-render by default
(no wasted HTML the client is about to discard, matching Livewire's `render_on_redirect = false`).

```java
@LievitAction
public void submit() {
    save();
    LievitEffects.current().redirect("/thank-you");
}
```

Reserved for later (named so the channel leaves room, not yet implemented): `stream` (SSE/chunked)
and `download` (base64 ride-along). Each is a new key in the bag, never a new response shape.
