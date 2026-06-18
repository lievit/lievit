# ADR-0040: The realtime broadcast channel (server→client push over SSE)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

The wire protocol (ADR-0001, ADR-0012) is request/response: the server only ever speaks to the
browser as the answer to a wire call the browser made. Nothing lets the server push to a client
out-of-band of a request. Two parity features need exactly that:

- **#304 — broadcast (live push) notifications.** A toast must land on a logged-in user's clients
  the moment something happens to them ("someone assigned you a task now"), and the persistent
  notification bell (`DatabaseNotification` / `NotificationBell`, already shipped) must refresh live
  instead of waiting for its 30 s poll.
- **#45 — the Echo-listener bridge.** Livewire's `echo:channel,Event` listeners subscribe to a
  server-push channel and route the broadcast payload to a component's `@LievitOn` handler. Same
  transport, the receiving half of the same primitive.

ADR-0001 already anticipated this: it deferred "WebSocket / SSE transports to v0.2 as an opt-in, not
the default" and **rejected** the persistent-WebSocket-with-server-held-state model (LiveView's)
because it forces sticky sessions and breaks lievit's stateless, scale-to-zero posture. The
wire-protocol §6 reserved the transport; ADR-0012 reserved a `stream` effect slot. This ADR settles
the transport and builds #304 / #45 on it.

This is the foundational realtime primitive other push features build on, so the transport choice is
settled here before the features.

## Decision

Ship a **server→client realtime channel over Server-Sent Events (SSE)**, the lievit primitive, then
broadcast notifications on top.

### SSE via `SseEmitter`, not WebSocket

The channel is Spring MVC's `SseEmitter` (the canonical servlet SSE primitive; docs-first, Spring
Framework reference "Asynchronous Requests → HTTP Streaming"). A long-lived `GET /lievit/broadcast`
returns an `SseEmitter` held in a per-recipient registry; the server pushes events into it.

SSE over WebSocket because:

- **It keeps the stateless posture.** SSE is a one-way server→client stream over plain HTTP. It does
  not hold component state and does not force sticky sessions the way a stateful WebSocket does, so
  the runtime still scales out and to zero (the ADR-0001 invariant). The push channel carries
  *events*, never component state; the snapshot stays the only state carrier.
- **No new dependency.** `SseEmitter` ships with `spring-boot-starter-web` (already a starter
  dependency). WebSocket would add `spring-websocket` (+ usually STOMP), exactly the "force a
  dependency on apps that don't use it" lievit avoids. The realtime channel reuses what is on the
  classpath.
- **CSP-trivial.** The browser transport is `EventSource` to a same-origin endpoint, so it rides the
  page's existing `connect-src 'self'`; no CSP change, no inline script (the strict-CSP posture
  holds). It is the same `EventSource` shape the streaming feature (`stream.ts`) already uses.
- **One-way is enough.** The push is server→client only; the client talks back through the existing
  wire endpoint (a delivered event becomes a normal `_events` wire call that re-runs `@LievitOn`).
  We do not need the bidirectional, framed WebSocket channel for this.

The trade-off accepted: SSE has a per-browser connection cap per origin (HTTP/1.1 ~6; HTTP/2
multiplexes) and reconnect semantics the browser owns. For an admin gestionale (a handful of tabs
per user) this is a non-issue; a future fan-out at scale can put a message broker behind the channel
without changing the client contract.

### Per-user channels, opt-in, gated

- **Per-user.** `GET /lievit/broadcast` derives the channel key from the request's security
  `Principal` (the page's security context, wire-protocol §7), never from a client-supplied
  parameter. A client can only ever subscribe to its own user's channel; an anonymous request is
  `401`. This is the per-user channel of #304's acceptance and the privacy boundary.
- **Opt-in.** The channel + controller beans are `@ConditionalOnProperty(lievit.broadcast.enabled=true)`,
  default off. An app that does not push live notifications never mounts the route and never holds an
  open SSE connection. (The starter web layer is always present, so the gate is a property, not a
  `@ConditionalOnClass`; no extra dependency is introduced to gate against.)
- **The event shape is the dispatched-event envelope.** Each SSE frame is JSON
  `{ name, detail?, to? }` — the same shape as a wire-call `dispatch` effect (ADR-0012 / ADR-0030).
  The client routes a pushed event through the *same* machinery as a dispatched one
  (`receiveBroadcast` → `routeDispatchedEvents`): re-emit on `window`, fire the `runtime.on` JS
  listeners, and deliver to the matching `@LievitOn` components (`to` = a per-component target like
  the bell; absent = a global fan-out). A pushed event behaves identically to a dispatched one (the
  echo bridge, #45).

### Broadcast notifications on top (#304)

`BroadcastNotification` (kit) pushes an `AdminNotification` as the existing `lievit-admin-notify`
toast event (same `toMap()` detail, so a pushed toast renders identically to a flashed one) and a
`lievit-notifications-refresh` event targeted at the `NotificationBell` component (so the bell
re-runs its read live). `sendAndBroadcast` persists the durable copy *and* pushes the live one: the
recipient sees it now if a client is open, and on next bell load regardless (best-effort live,
durable persist).

## Consequences

- **#304 and #45 are unblocked** on one primitive: a per-user push channel + the event-shape
  identity with the dispatch effect.
- **Stateless posture preserved.** The channel carries events, not state; no sticky sessions, scale
  to zero still holds. The snapshot stays the only state carrier.
- **Additive and opt-in.** No existing component, the wire loop, or any app that ignores it changes.
  An app turns it on with one property and one `installBroadcast(runtime)` call.
- **One core client seam.** `LievitRuntime.receiveBroadcast` is the only core touch (a fenced public
  method that reuses the dispatch routing); the feature (`broadcast.ts`) owns the transport, ADR-0019
  conflict-free-extension intact.
- **Best-effort live.** A recipient with no open connection receives nothing live; the durable
  persisted notification is the fallback the bell shows on next load. Read-your-writes across the
  push is not guaranteed (it is the realtime trade-off), which is why `sendAndBroadcast` persists too.
- **Connection management is the server's.** The registry prunes a connection on completion/timeout/
  IO failure; a dead client never propagates an error to the broadcaster. The SSE idle timeout
  (default 5 min, configurable) bounds a connection server-side; the browser `EventSource` reconnects.

## Alternatives considered

**Persistent WebSocket with server-held state (LiveView model).** Lower latency, bidirectional.
Rejected (re-affirming ADR-0001): it forces sticky sessions and a stateful connection, breaking the
stateless/scale-to-zero identity; and it adds `spring-websocket` (+ STOMP) to every consumer. The
one-way push SSE gives is all #304/#45 need.

**A `stream` effect over the existing wire response (ADR-0012's reserved slot).** That slot is for
*mid-request* progressive output (the AI-token-streaming case, `stream.ts`), tied to a wire call the
client initiated. A broadcast is *out-of-band* of any request (no wire call triggered it), so it
needs its own long-lived channel, not a per-response stream. The two are complementary: same
`EventSource` transport, different lifecycle.

**Poll faster (shorten the bell's 30 s interval).** The simplest "live-ish" option and needs no
channel. Rejected as the answer to #304: it is not live (worst-case latency = the interval), and a
short interval multiplies wire calls across every connected client. Polling stays the no-realtime
fallback; the bell keeps its poll for apps that do not enable broadcast.

**Take the user id from a request parameter / the snapshot.** Simpler subscribe. Rejected: it would
let a client subscribe to another user's channel (a cross-user leak). The `Principal` is the only
trustworthy channel key (wire-protocol §7).
