# Wire protocol v0.1 (normative spec)

This is the precise specification of the lievit wire protocol. ADR-0001 records *why* the
protocol is stateless HTTP with a signed snapshot; this document is the *what* and the *how*, at
the level of detail an implementation is built to. When the two disagree, ADR-0001 owns the
decision and this document owns the mechanics.

Status: spec-first. No runtime code exists yet, by intent. This is the contract the
implementation will be built to.

## 1. The snapshot lifecycle: mount, render, action, re-render

A component is a typed Java class. Its life on the wire is a loop of four phases. The first two
run once on the initial page load; the last two repeat for every interaction.

```
  [1] MOUNT (first load, server)
      browser requests a page that embeds a component
      -> the server constructs the component instance
      -> @LievitMount runs (post-construction, pre-render): seed @Wire fields
      -> the component holds its initial state

  [2] RENDER (first load, server)
      @LievitRender (or the default render) produces HTML
      -> the server signs a snapshot of the current @Wire state
      -> HTML is embedded in the page, the signed snapshot rides with it
         (a data attribute on the component root, e.g. data-lievit-snapshot)
      -> browser paints; lievit's client script binds l:* directives

  --- the page is now live; every interaction is a wire call ---

  [3] ACTION (interaction, browser -> server)
      a bound event fires (l:click, l:submit, l:model change)
      -> the client collects: the current _snapshot, pending @Wire _updates,
         and the _calls (action invocations) to run
      -> POST /lievit/{componentId}/call with { _token, _snapshot, _updates, _calls }

  [4] RE-RENDER (server -> browser)
      -> verify _token (CSRF) and _snapshot (HMAC + expiry)
      -> resolve cls (FQN) to a @LievitComponent; reconstruct the instance
      -> rehydrate @Wire fields from the snapshot's `wire`
      -> apply _updates (the changed bound fields) onto the instance
      -> invoke _calls (the actions) in order; each may mutate @Wire state
      -> re-render to HTML
      -> sign a fresh snapshot of the new state
      -> respond: 200, text/html body (the patched markup),
         header Lievit-Snapshot: <new signed snapshot>
      -> the client morphs the DOM (Idiomorph) and stores the new snapshot
```

The invariant: **the server never holds component state between calls.** State lives in the
signed snapshot, which the client carries. Any instance can serve any call. This is what lets the
runtime scale out and scale to zero (ADR-0001).

The snapshot returned in phase 4 becomes the `_snapshot` sent in the next phase 3. The chain of
snapshots is the component's state history as far as the wire is concerned; the server keeps none
of it.

## 2. The snapshot schema: `{cid, cls, wire, iat, exp}`

The snapshot is a signed token (HS256, JWT-like; see section 3). Its payload carries **state,
never code**:

| Field | Meaning | Notes |
|---|---|---|
| `cid` | Component ID | A UUID v4 (v0.1), 128-bit `SecureRandom`, encoded Crockford base32 (26 chars, alphabet without `I` / `L` / `O` / `U`). UUID v7 (time-ordered) is roadmap. Identifies the component instance on the page; it is the `{componentId}` in the endpoint path. |
| `cls` | Fully-qualified class name | Resolved to a `@LievitComponent` at unwrap time. The wire carries the *name*, not the class; the server looks it up. An unknown FQN is a `410 Gone` (section 4). |
| `wire` | The bound field state | The serialized values of the `@Wire` fields. This is the only mutable state on the wire. Bounded by the snapshot size limit (section 6). |
| `iat` | Issued-at | Unix epoch seconds. Set when the snapshot is signed. |
| `exp` | Expiry | Unix epoch seconds. `iat` + idle TTL (1 h default, section 6). An expired snapshot is a `409 Conflict` (section 4). |

What is deliberately **not** in the snapshot:

- **No code, no behavior.** `cls` is a name; the server owns the class. The client cannot inject a
  class or a method to run. This is the property that makes a tampered `cls` a lookup failure
  (410), not a code-execution vector.
- **No secrets.** Anything sensitive that a component needs at render time is fetched server-side
  from the principal / session, never round-tripped through the snapshot.
- **No DOM.** The snapshot carries field state; the HTML is re-derived by rendering, never stored.

`wire` serialization is engine-agnostic and JSON-shaped; the exact field encoding (and the
`@LievitProperty` serialize / transform hooks) is an implementation concern, but the schema above
is the stable contract.

## 3. Signing: HMAC-SHA-256 and `kid` rotation

The snapshot is signed, not encrypted: its payload is readable, its integrity is guaranteed. The
signature is the security boundary of the whole protocol (ADR-0001, SECURITY.md).

- **Algorithm**: HMAC-SHA-256 (HS256), JWT-like envelope (header, payload, signature).
- **Header carries `kid`**: the key id of the signing key used, so the verifier knows which key to
  check against during a rotation.
- **Key requirements**: the signing key is at least 32 bytes, base64url-encoded. Configured via
  `LIEVIT_SIGNING_KEY`. A weak or missing key is a startup failure, not a runtime surprise.
- **Verification**: on every wire call, the server recomputes the HMAC over the received
  header+payload with the key named by `kid` and compares in constant time. A mismatch is a
  hard rejection (the snapshot is treated as forged); the call does not reach the component.

### Key rotation

Rotation is a planned operation with a grace window, so in-flight snapshots signed by the old key
do not all fail at the instant of rotation:

```
  before:  LIEVIT_SIGNING_KEY      = key-A   (kid: A)

  rotate:  LIEVIT_SIGNING_KEY      = key-B   (kid: B)   <- new snapshots signed with B
           LIEVIT_SIGNING_KEY_PREV = key-A   (kid: A)   <- still accepted for verification

  grace:   24 h. During the window, a snapshot with kid: A verifies against key-A (PREV),
           a snapshot with kid: B verifies against key-B (current). New snapshots are
           always signed with B.

  after:   remove LIEVIT_SIGNING_KEY_PREV. Snapshots still bearing kid: A now fail
           verification -> 409 (snapshot from a retired key) and the client re-mounts.
```

The verifier selects the key by the `kid` in the header: current key for new `kid`, previous key
(if `LIEVIT_SIGNING_KEY_PREV` is set and within the 24 h grace) for the old `kid`. After the
grace window, only the current key is honored.

### What the signature does NOT cover: locked fields

The signature proves the snapshot was not altered **between** requests. It does **not** stop the
**first** POST from setting any `@Wire` field to any value: the client sends the initial state and
its `_updates`, and a malicious client can put anything in either. For an id, a price, or a role
flag this is a real vulnerability hiding behind "the snapshot is signed" (the gap the Livewire
research surfaced, ADR-0001 amendment 2026-06-17).

A `@Wire` field marked `@LievitProperty(locked = true)` is **server-authoritative**: the server
seeds it (mount / action), it is serialized into the snapshot so the template can render it, but any
inbound `_updates` entry targeting it is rejected with `403` + `Lievit-Reason: locked-property`. The
lock, not the signature, is the defense for state the client must never set. This is the lievit
equivalent of Livewire's `#[Locked]`, expressed without an eighth annotation (ADR-0002's cap).

### Checksum-failure rate limit

On top of the HMAC, lievit limits **signature failures** per client: more than 10 forged/tampered
snapshots from one client (keyed on the IP) within 600 s trips a `429` +
`Lievit-Reason: too-many-failures`. The HMAC already makes a forged snapshot unusable; the limiter
stops a client from grinding against the signature offline (Livewire parity: 10 / 600 s).

## 4. The error-code state machine

Every wire call lands in exactly one terminal state. The client reacts to each deterministically.

```
                       POST /lievit/{componentId}/call
                                   |
                          verify _token (CSRF)
                                   |
                        invalid --> 403 (Spring Security default)
                                   |
                          verify _snapshot HMAC
                                   |
                        forged ---> reject (treated as tamper; not a normal code path)
                                   |
                          check exp (expiry / TTL)
                                   |
                        expired --> 409 Conflict + Lievit-Reason: snapshot-expired
                                   |               client: re-mount the component (fresh GET)
                          check payload size
                                   |
                        > 64 kb --> 413 Payload Too Large
                                   |
                          resolve cls (FQN) to a @LievitComponent
                                   |
                        unknown --> 410 Gone
                                   |               client: stale class (deploy moved on); re-mount
                          run _calls (actions), bounded by 5 s
                                   |
                        timeout --> 504 Gateway Timeout
                                   |
                          re-render + sign new snapshot
                                   |
                                   v
                        200 OK, text/html + header Lievit-Snapshot
```

| Code | Condition | `Lievit-Reason` | Client reaction |
|---|---|---|---|
| `200` | Success | (none) | Morph the DOM (Idiomorph), store the new snapshot from `Lievit-Snapshot`. |
| `409` | Snapshot expired (past `exp`) | `snapshot-expired` | Re-mount: discard the stale snapshot, request a fresh component render. |
| `410` | `cls` FQN no longer resolves to a `@LievitComponent` (renamed / removed across a deploy) | (gone) | Re-mount: the component the snapshot names is gone; reload the host page. |
| `413` | Request payload exceeds 64 kb | (too large) | Surface an error; the component state outgrew the wire (move state server-side, v0.2 store). |
| `504` | An action exceeded the 5 s timeout | (timeout) | Surface a timeout; the action did not complete. |
| `403` | CSRF token invalid/missing | (Spring Security) | Standard CSRF failure; the session is stale. |
| `403` | Client `_updates` targeted a locked `@Wire` field | `locked-property` | A bug or a tamper attempt; the field is server-owned. Surface an error; do not retry. |
| `429` | Too many checksum failures from this client (10 / 600 s) | `too-many-failures` | The client is being rate-limited after repeated forged/tampered snapshots; back off. |

`409` and `410` are both "the snapshot no longer matches the server", but they are distinct
causes: `409` is *time* (the snapshot aged out), `410` is *identity* (the class moved). Keeping
them separate lets the client tell "your session is stale" from "this build no longer has that
component", which matter differently to a user mid-task.

## 5. Client directives: `l:model` modifiers and Idiomorph patching

The client script binds `l:*` directives in the rendered HTML and turns DOM events into wire
calls.

### Binding directives

- **`l:model`** binds an input's value bidirectionally to a `@Wire` field. Its modifiers control
  *when* the change is sent to the server:

  | Modifier | Sends the update when | Use for |
  |---|---|---|
  | `l:model` (no modifier) | **never on its own**: the value is held client-side and synced with the next action (the deferred default) | the common text input case |
  | `l:model.live` | on every input event, debounced ~150 ms | live-search, instant-feedback fields (use sparingly) |
  | `l:model.lazy` | on `change` (when the field loses focus or commits) | fields that only matter when finished |
  | `l:model.blur` | on `blur` (focus leaves the field) | validate-on-leave fields |
  | `l:model.debounce.Xms` | debounced by the explicit interval given (implies `.live`) | tuning the live debounce window |

  **`l:model` is deferred by default**: it sends no network request while the user types and rides
  along with the next action (`l:click`, `l:submit`), which is what makes a typical form interactive
  at zero per-keystroke cost. `.live` is the explicit opt-in to per-keystroke traffic (debounced
  ~150 ms). This matches Livewire v3/v4 and the performance budget; the earlier "500 ms per
  keystroke default" was a factual error corrected in the ADR-0001 amendment of 2026-06-17.

- **Action events** invoke `@LievitAction` methods:

  | Directive | Fires on |
  |---|---|
  | `l:click="action"` | click |
  | `l:submit="action"` | form submit (prevents the native submit) |
  | `l:keydown.enter="action"` | Enter keydown |

  An action directive collects the current snapshot and any pending `l:model` updates, then issues
  the wire call (phase 3 of the lifecycle).

### DOM patching: Idiomorph

The 200 response body is the freshly rendered HTML for the component. The client does **not**
replace `innerHTML` and does **not** run a DIY diff or a virtual DOM. It uses **Idiomorph**
directly to morph the existing DOM toward the new markup:

- Idiomorph preserves DOM identity where the structure matches, so focus, selection, scroll
  position, in-flight CSS transitions, and uncontrolled input state survive the patch.
- Only the parts that actually changed are touched; unchanged nodes are left in place.
- Idiomorph is the same library Turbo 8 uses. Livewire v3/v4 morphs with `@alpinejs/morph`, not
  Idiomorph; lievit chooses Idiomorph deliberately because it is framework-agnostic and does not
  drag Alpine onto a non-Alpine stack (corrected in the ADR-0001 amendment of 2026-06-17). The
  shared principle across all three (Livewire, Turbo, LiveView) is "morph, do not replace
  innerHTML"; the library differs.

## 6. Limits and budgets

These are protocol-level limits, enforced server-side and surfaced through the error codes above.

| Limit | Value (v0.1) | Enforced by | What happens at the edge |
|---|---|---|---|
| **Request payload** | 64 kb | server (pre-deserialization) | `413 Payload Too Large` |
| **Snapshot size** | 16 kb | server (at sign time and at unwrap) | a component whose `wire` state exceeds this must move state server-side; the v0.2 server-side snapshot store is the path |
| **Idle TTL** | 1 h | `exp` = `iat` + TTL | past `exp` -> `409 snapshot-expired` -> client re-mounts |
| **Action timeout** | 5 s | server (bounds each `_calls` invocation) | `504 Gateway Timeout` |
| **Signing key** | >= 32 bytes, base64url | startup validation | startup failure if weak/missing |
| **Previous-key grace** | 24 h | `LIEVIT_SIGNING_KEY_PREV` | old-`kid` snapshots verify within the window, fail after |
| **Checksum-failure budget** | 10 failures / 600 s per client | server (per-IP) | `429 too-many-failures` once the budget is exceeded |

Deferred to v0.2 (recorded here so v0.1 leaves room for them): a **server-side snapshot store**
(removes the 16 kb / 64 kb pressure for large-state components), **WebSocket / SSE transports**
(opt-in, not the default), and **UUID v7** component IDs (time-ordered). None of these change the
v0.1 contract above; they extend it.

## Cross-references

- ADR-0001 — the decision and its alternatives (why stateless HTTP + signed snapshot).
- ADR-0002 — the seven-annotation API surface the lifecycle hooks belong to.
- ADR-0007 — quality gates, including the golden roundtrip triples that pin
  encode/decode/tamper/replay behavior of the snapshot.
- SECURITY.md — the HMAC chain as the security boundary, key handling, reporting.
- README.md — the at-a-glance summary of this protocol.
