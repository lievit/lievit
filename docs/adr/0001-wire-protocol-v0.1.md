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
- **DOM patching**: Idiomorph directly (no DIY diff, no innerHTML replacement, no virtual DOM), as
  Turbo 8 uses it. (Amended 2026-06-17: the original text claimed this "converges with Livewire
  v3"; that is factually wrong, Livewire v3/v4 uses `@alpinejs/morph`. lievit keeps Idiomorph as a
  framework-agnostic choice that does not pull Alpine onto a non-Alpine stack; see the amendment.)
- **Client modifiers**: `l:model` is **deferred by default** (no network until an action fires);
  `l:model.live` is the per-keystroke opt-in (debounced ~150 ms); plus `.lazy` / `.blur` /
  `.debounce.Xms`. Events: `l:click / submit / keydown.enter`. (Amended 2026-06-17: the original
  text made `l:model` debounce 500 ms per keystroke by default, which is *more* chatty than
  Livewire's actual default of zero requests while typing; see the amendment.)
- **Error codes**: `410 Gone` (unknown FQN), `409 Conflict` + header
  `Lievit-Reason: snapshot-expired`, `413` (payload > 64 kb), `504` (action timeout 5 s),
  `403` + `Lievit-Reason: locked-property` (client update to a locked `@Wire` field),
  `429` + `Lievit-Reason: too-many-failures` (checksum-failure rate limit). (Last two added
  2026-06-17; see the amendment.)
- **Locked fields**: a `@Wire` field marked `@LievitProperty(locked = true)` is server-authoritative;
  an inbound client `_updates` entry for it is rejected (`403`). The signature stops tampering
  *between* requests; the lock stops the *first* request from writing a server-owned field. (Added
  2026-06-17; see the amendment.)
- **Checksum-failure rate limit**: 10 signature failures per client per 600 s trip a `429`, on top
  of the HMAC, to stop offline brute-forcing of the signature. (Added 2026-06-17; see the amendment.)
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

## Amendment 2026-06-17 (Livewire research, `docs/research/livewire-internals.md`)

A read-only study of the Livewire source (PR #5) found four corrections to this ADR. Recorded here
inline rather than as a superseding ADR, because the spine of the decision (stateless HTTP, signed
snapshot, HMAC boundary, `kid` rotation, `iat`/`exp`, the error-code state machine) is validated by
the study and unchanged; only these four points move. The original prose above is annotated where
it was wrong, so the divergence is auditable.

1. **`l:model` is deferred by default, not 500 ms debounce.** The original ADR made `l:model` send
   one debounced request per keystroke (500 ms) and justified it as avoiding "the Livewire wound of
   one request per keystroke". Livewire v3/v4 (`docs/wire-model.md:53-55`,
   `js/directives/wire-model.js:31-36`) sends **nothing** while typing: it syncs only when an action
   fires. `.live` is the per-keystroke opt-in, debounced ~150 ms. The original default was therefore
   *more* chatty than Livewire's (which is zero). Corrected: `l:model` defers (sync on action),
   `l:model.live` is the opt-in.

2. **Morph: Idiomorph is kept, but not "because Livewire v3 uses it".** Livewire v3/v4 uses
   `@alpinejs/morph` (`package.json:26`, `js/morph.js:61`), not Idiomorph; Turbo 8 uses Idiomorph.
   lievit keeps Idiomorph as a deliberate, framework-agnostic choice (it does not drag Alpine onto a
   non-Alpine stack), but the justification is corrected: "Idiomorph, as Turbo 8 uses; Livewire uses
   Alpine's own morph, which lievit does not depend on."

3. **A `locked` capability closes a real security gap.** The signed snapshot proves the snapshot was
   not altered *between* requests; it does **not** stop the *first* POST from setting any `@Wire`
   field to any value. Without a lock, "the snapshot is signed" gives a false sense of safety for
   ids, prices, and role flags. Livewire's `#[Locked]` (`docs/security.md:173-186`) is the defense.
   lievit adds it as `@LievitProperty(locked = true)` rather than an eighth annotation, respecting
   the seven-annotation cap (ADR-0002). A client update to a locked field is a `403`
   (`Lievit-Reason: locked-property`).

4. **A checksum-failure rate limit (10 / 600 s → 429).** Livewire blocks a client after 10 bad
   checksums in 600 s (`Checksum.php:11-12,44-79`) to stop offline brute-forcing of the HMAC.
   lievit adopts the same budget per client (the IP), mapped to a `429`
   (`Lievit-Reason: too-many-failures`), recorded on each signature failure before the failure is
   rethrown.

Out of scope for this amendment (recorded by the study, deferred deliberately): the per-component
endpoint path vs Livewire's single batched route, the HTML+header response vs an `effects` channel,
and a `children`-style client-may-mutate carve-out in the signed payload. These are real divergences
worth a conscious decision, but they do not block the walking skeleton; they are tracked for a later
ADR.
