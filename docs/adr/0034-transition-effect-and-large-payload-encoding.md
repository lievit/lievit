# ADR-0034: `@LievitTransition` server effect + large-payload binary encoding

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

> **ADR numbering note.** This server/engine P2 parity pass claims **0034–0035**. The sibling client
> branch claims 0024–0029; the earlier server pass claimed 0030–0033. These two cover the server
> halves of `l:transition` (#113) and large-payload encoding (#135), plus the `$lievit` `toJSON`
> hardening (#133, client-only).

## Context

Three items remained whose client halves had already shipped on `main` but whose server (or
correctness) half was unbuilt:

- **#113 — `l:transition` server control.** The client transition feature (`features/transition.ts`)
  already reads `runtime.transitionFor(root)`, which reads a `transition` key off the decoded
  `Lievit-Effects` bag. The server never emitted that key: there was no `@LievitTransition`
  annotation and no `transition` field on `LievitEffects` / `WireEffects`. An action could not ask
  the client to skip a transition (a poll tick) or override its duration.
- **#135 — large payload encoding.** A binary `@Wire` argument (a 300KB+ rich-text or file blob)
  crashed the request pipeline: the classic `String.fromCharCode(...bytes)` spread overflows the call
  stack, and a `Uint8Array` under a plain `JSON.stringify` becomes a lossy `{"0":..}` object, never
  the bytes. The server also had no way to bind a `byte[]` field (no synthesizer matched it).
- **#133 — `$lievit` `toJSON`.** Client-only: `JSON.stringify($lievit)` had to yield a clean
  `{id, name, key, data}` snapshot, not fire a phantom wire request through a proxy getter trap or
  loop on a circular reference.

## Decision

### `@LievitTransition` — a CALL-phase listener seeding the `transition` effect (#113)

- **`@LievitTransition(skip, duration, name)`** (new method annotation) marks an `@LievitAction`. A
  new **`TransitionListener`** on the `CALL` lifecycle phase (mirroring `RenderlessListener`) reads
  the annotation off the invoked action and seeds a **`TransitionEffect`** onto the per-call
  `LievitEffects` sink. Because `CALL` fires *before* the action body runs, an action that needs the
  control at runtime calls the imperative `LievitEffects.current().transition(...)` /
  `skipTransition()` inside its body and overrides the annotation (documented imperative-wins
  semantics; last write wins across several annotated actions).
- **`WireEffects`** gains a `transition` key (`{skip?, duration?, name?}`, `NON_NULL`) projecting the
  sink's `TransitionEffect`; `skip` is emitted only when true so a plain duration/name control carries
  no spurious `skip:false`. The shape matches the client's existing `TransitionEffect` interface, so
  the client half needs no change.

### Large-payload encoding — chunked base64 client-side + a `byte[]` synthesizer server-side (#135)

- **Client (`runtime/encode.ts`).** `encodeBytesBase64` encodes a byte array in 32 KiB chunks
  (`String.fromCharCode.apply` over a bounded slice), never spreading the whole array, so a 300KB+
  payload cannot overflow the stack. `toWireValue` normalizes a `Uint8Array` / `ArrayBuffer` (incl.
  nested in arrays/objects) to a tagged envelope `{ __lievit_b64: "<base64>" }`; plain JSON values
  pass through. The wire `body()` builder runs `_updates` through `toWireValue`.
- **Server (`ByteArraySynthesizer`).** A built-in synthesizer (registered in the default registry,
  after `UuidSynthesizer`) round-trips `byte[]` as base64: it dehydrates to a `{"@w":{"d":"<base64>",
  "s":"bytes"}}` tuple in the snapshot, hydrates back from the tuple, and on the typed-update path
  accepts both a plain base64 string (the snapshot reseed) and the `{__lievit_b64}` envelope (the
  large-payload update). This makes `byte[]` a first-class wire type and keeps the decode in the
  synthesizer SPI rather than special-cased in `WireField` (no widening of the deserialization
  allowlist: the envelope is a `Map` with a single string leaf, already inside the `PayloadGuard`
  bounds).

### `$lievit.toJSON` (#133, client-only)

`LievitObject` gains a `toJSON()` returning a `LievitObjectSnapshot` (`{id, name, key, data}`) sourced
from the root's `data-lievit-id` / `data-lievit-component` / `data-lievit-key` attributes plus a
shallow copy of the ephemeral mirror. `JSON.stringify` calls `toJSON`, so stringifying the proxy
yields a clean object with no network call and no circular reference.

## Consequences

- Additive: every change is a new key / annotation / synthesizer / method. A component that uses none
  of them is byte-for-byte unchanged on the wire (the `transition` key is omitted when unused, ADR-0001
  compatibility holds).
- `byte[]` is now a supported `@Wire` type; large binary form fields and rich-text payloads round-trip.
- Reversal cost: low. Each is independently revertible (drop the annotation + listener; drop the
  encoder + synthesizer; drop `toJSON`).

## Alternatives considered

- **Special-case `byte[]` in `WireField.coerce`** instead of a synthesizer: rejected — it would not
  dehydrate back into the snapshot (the readWire path needs a synthesizer), so the round trip would
  not close.
- **A dedicated transition response header** instead of a key on the effects bag: rejected — the
  effects channel is exactly the server→client side-effect bus; a second header duplicates it.
