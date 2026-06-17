# ADR-0012: The effects channel (HTML body + `Lievit-Effects` header)

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

ADR-0001 fixed the wire response as `text/html` (the patched markup) plus a single
`Lievit-Snapshot` header. That shape carries exactly one thing back to the client: new HTML to
morph. It forecloses every server-driven side effect that is not a DOM patch.

The Livewire research (`docs/research/livewire-design-decisions-complete.md`, finding 17, and the
ADR-0001 amendment of 2026-06-17) flagged this as **the single most consequential divergence**.
Livewire's response is `{snapshot, effects}`, where `effects` is a typed side-effects bag:
`html`, `dispatch`, `redirect`, `js`, `stream`, `returns`, `scripts`, `islandFragments`
(`HandleRequests.php:214-223`, `js/request/index.js:418-455`). Without an effects channel, lievit
cannot express:

- **Redirect** as a response effect (a browser `fetch` cannot follow a 302 the way an interactive
  action needs; finding 18).
- **Dispatch** an event for cross-component messaging (finding 16; the DOM `CustomEvent` bus).
- **Return values** from an action (the test API and JS interop read these; finding 17, 33).
- **Stream / JS-eval / downloads** (findings 17, deferred here but they all need *some* side
  channel).

This divergence **gates** the cross-component, redirect, and streaming features. It is the
foundational protocol decision other parity features build on, so it is settled here before any
of them.

## Decision

The wire response evolves to carry, on a successful (`200`) call, **the HTML body unchanged plus a
structured effects channel in a response header**. This **amends ADR-0001's "Response: text/html"
decision** (see the amendment block at the end of ADR-0001).

### Wire shape: option (a), HTML body + `Lievit-Effects` header

The 200 response is:

```
200 OK
Content-Type: text/html
Lievit-Snapshot: <signed snapshot>          # unchanged from ADR-0001
Lievit-Effects:  <compact JSON effects bag> # new, OMITTED when there are no effects

<the patched component HTML>                 # the body, unchanged from ADR-0001
```

`Lievit-Effects` carries a small JSON object, the effects bag:

```json
{ "redirect": "/path", "dispatch": [ { "name": "saved", "detail": { "id": 7 } } ], "returns": 42 }
```

Every key is **optional**; an action that produces no effects sends **no `Lievit-Effects`
header at all**. The bag is JSON, header-encoded (a single compact line, ASCII-safe). `html` stays
the body (it is the bulk of every response and morphs in place via Idiomorph); the bag carries only
the *non-HTML* effects, so it is small and bounded.

This was chosen over option (b) — a full JSON envelope `{html, snapshot, effects}` — to **preserve
the "HTML over the wire" identity of ADR-0001**: the body stays HTML, the client keeps morphing it
directly, and the snapshot stays in its own header (its HMAC and `kid` rotation are untouched). It
is also **backward compatible**: a no-effects action behaves exactly as before (HTML + snapshot
header, no third header), so the Counter roundtrip and every existing client survive unchanged.

### Effects in v0.1 of the channel

Three effects ship now; the rest are reserved (the channel is the extension point, so adding them
later is not a protocol break):

| Effect | Shape | Meaning | Client reaction |
|---|---|---|---|
| `redirect` | `string` (a URL/path) | the action requested a navigation | the client navigates (`location.assign`) instead of morphing |
| `dispatch` | `array` of `{name, detail?}` | the action queued browser events | the client dispatches each as a DOM `CustomEvent` on `window` |
| `returns` | any JSON value | the action's return value | available to the caller / test API; no DOM effect by itself |

**Reserved for later** (named here so the channel leaves room, not implemented): `stream`
(SSE/chunked partial updates), `js` (server-requested client eval — a security-sensitive surface
deferred deliberately), `download` (base64 file ride-along). Adding any of these is a new key in
the bag, never a new response shape.

### How an action produces effects

An `@LievitAction` method stays `void` for the common case (no effect, the Counter). To produce
effects, a component reads a per-call **`LievitEffects`** sink. The dispatcher hands the component
the sink for the duration of the call via a `ThreadLocal` accessor (`LievitEffects.current()`),
mirroring how Livewire exposes `$this->redirect()` / `$this->dispatch()` on the component without a
parameter on every action signature. The sink is reset per call, so it is request-scoped and
stateless across calls (ADR-0001's invariant holds: the server keeps nothing between calls). An
action's non-`void` return value is captured as the `returns` effect automatically.

This adds **no new public annotation** (ADR-0002's seven-annotation cap holds): effects are a
runtime API (`LievitEffects`), not a declaration.

### Snapshot, errors, and limits are untouched

- The **snapshot HMAC** is unchanged: the effects bag is *not* signed (it is server-authored, never
  round-tripped from the client, so there is nothing to tamper). The snapshot stays the only signed
  artifact and the only security boundary (SECURITY.md).
- The **error-code state machine** (wire-protocol §4) is unchanged: effects only ever appear on a
  `200`. A `403/409/410/413/429/504` carries no effects (the call did not reach a successful
  re-render).
- The bag rides inside the existing 64 kb payload budget; effects are small (a redirect path, a
  handful of event names). No new limit is introduced for v0.1; a future `stream` effect will need
  its own transport (deferred with WebSocket/SSE in ADR-0001).

## Consequences

- **Unblocks the gated features.** Redirect, cross-component dispatch, and action return values now
  have a home; streaming and JS-eval have a reserved slot. Findings 16/18/19/21 can build on this
  without another protocol decision.
- **HTML-over-the-wire identity preserved.** The body is still HTML; the client still morphs it.
  The channel is additive: a header that is simply absent on the no-effects path.
- **Backward compatible.** Existing components, the Counter roundtrip, and any client that ignores
  the new header keep working. The migration is purely additive.
- **Header size is a soft ceiling.** Servers and proxies cap header size (commonly 8 kb). The bag is
  designed to stay tiny (no HTML, no large state); a component that needs to push large data uses
  the HTML body or, later, a `stream` effect. We accept this ceiling rather than move HTML into a
  JSON envelope.
- **One ThreadLocal on the call path.** The effects sink is request-scoped via a `ThreadLocal`,
  set and cleared around each dispatch. It is the price of keeping action signatures clean (`void`
  for the common case) and matches the framework's "the component just calls `redirect()`" feel.

## Alternatives considered

**(b) Full JSON envelope `{html, snapshot, effects}`.** This is Livewire's exact shape and the most
general. Rejected as the v0.1 channel because it abandons ADR-0001's HTML-over-the-wire identity:
the client would parse JSON, extract `html`, and morph from a string field instead of from the
response body, and the snapshot would move out of its dedicated header into the envelope (re-opening
the HMAC-transport question for no gain). The header approach gets the same expressiveness for the
three effects we ship with strictly less churn. If a future effect (large `stream` payloads) makes
the header ceiling bite, revisiting (b) is an open door, recorded here.

**Effects as a second response (a follow-up request).** Have the client poll or fetch effects
separately. Rejected: two round trips for one interaction, and it splits the atomic result of one
action across two responses (the snapshot and its effects could then disagree).

**A new `@LievitOn` / effect annotation.** Express dispatch/redirect declaratively. Rejected for
v0.1: it would be the eighth annotation (ADR-0002) and effects are inherently imperative (an action
*decides at runtime* to redirect). The runtime `LievitEffects` sink keeps the surface at seven.
Listener registration (the receiving half of `dispatch`, finding 16) is a separate decision and is
**not** settled here.
