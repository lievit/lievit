# ADR-0001: Wire protocol v0.1 (stateless HTTP + HMAC-signed snapshot)

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

lievit keeps a server-rendered component in sync with the browser. The transport between them is
the load-bearing decision: it determines whether the runtime can scale out, scale to zero, and
front public traffic, and it is the project's primary security surface. Phoenix LiveView keeps
component state on the server behind a persistent WebSocket, which forces sticky sessions and
defeats scale-to-zero. Livewire keeps state in the page and ships it back and forth, which is
stateless but trusts the client with state unless it is signed.

The component state must survive the round trip without the server holding a session, and the
client must not be able to tamper with the state it carries back.

## Decision

The wire protocol v0.1 is **stateless HTTP** with a **signed state snapshot** carried by the
client.

- **Endpoint**: `POST /lievit/{componentId}/call`, stateless (no server-side session for
  component state).
- **Payload**: `{ _token, _snapshot (jwt-hs256), _updates, _calls }`.
- **Response**: `text/html` (the patched markup) plus header `Lievit-Snapshot` (the next snapshot).
- **Snapshot schema**: `{cid, cls, wire, iat, exp}`. It carries **state, never code**. `cls` is
  a fully-qualified class name resolved to a `@LievitComponent` at unwrap time; `wire` is the
  bound field state; `iat` / `exp` are issued-at / expiry.
- **Signing**: HMAC-SHA-256 (HS256, JWT-like), `kid` header for key rotation. Signing key
  >= 32 bytes (base64url). `LIEVIT_SIGNING_KEY_PREV` gives a 24 h grace window across a rotation.
- **Component ID**: UUID v4 in v0.1 (SecureRandom, 128-bit), encoded Crockford base32 (26 chars,
  alphabet without I/L/O/U). UUID v7 (time-ordered) is roadmap.
- **DOM patching**: Idiomorph directly (no DIY diff, no innerHTML replacement, no virtual DOM),
  converging with Livewire v3, Turbo 8, and LiveView.
- **Client modifiers**: `l:model.live / .lazy / .blur / .debounce.500ms` (debounce 500 ms is the
  default, opt out with `.eager`, which avoids the Livewire wound of one request per keystroke).
  Events: `l:click / submit / keydown.enter`.
- **Error codes**: `410 Gone` (unknown FQN), `409 Conflict` + header
  `Lievit-Reason: snapshot-expired`, `413` (payload > 64 kb), `504` (action timeout 5 s).
- **Limits**: payload 64 kb, snapshot 16 kb (a server-side snapshot store is deferred to v0.2),
  idle TTL 1 h, action timeout 5 s.

WebSocket / SSE transports are deferred to v0.2 as an opt-in, not the default.

## Consequences

- The runtime scales out and scales to zero: any instance can serve any wire call because no
  instance holds component state. Public-facing deployment is viable, unlike Vaadin Flow.
- The snapshot signature is the security boundary. A tampered snapshot fails verification; an
  expired one is rejected with a precise reason. The HMAC chain becomes the thing every security
  review starts from (see SECURITY.md).
- Carrying state on the wire bounds component state size (the 64 kb / 16 kb limits). Components
  that need large state must move it server-side, which is exactly what v0.2's snapshot store is for.
- Stateless HTTP has higher per-interaction latency than a persistent WebSocket. For the target
  segment (business / internal / CRUD-interactive) this is well within budget; low-latency
  multiplayer is an explicit non-goal.

## Alternatives considered

**Persistent WebSocket with server-held state (LiveView model).** Lower latency, but sticky
sessions kill scale-to-zero and complicate public-facing deployment. Rejected as the v0.1
default; revisited as an opt-in transport in v0.2.

**Unsigned client-carried state (naive Livewire-like).** Simpler, but trusts the client with
component state. A single tampering vector would compromise the runtime. Rejected: the signature
is non-negotiable.

**Server-side snapshot store from v0.1.** Removes the payload-size constraint, but adds a
stateful store to the v0.1 critical path before there is evidence it is needed. Deferred to v0.2.
