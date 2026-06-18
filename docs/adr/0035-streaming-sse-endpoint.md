# ADR-0035: Streaming server half — a live `LievitStream` sink + an SSE endpoint

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

> **ADR numbering note.** Part of the same server/engine P2 pass as ADR-0034 (0034–0035). This one
> covers the server half of streaming (`$this.stream` / `l:stream`, #153) and the client POST consumer
> that wires it to the existing `l:stream` writer.

## Context

The client streaming consumer shipped on `main` (`features/stream.ts`: `parseStreamEnvelope`,
`applyStreamEnvelope`, `consumeStream`, `openStream`) — it can write `{target, content, replace}`
envelopes into an `l:stream` target — but there was no server to produce them. Issue #153 asks for an
SSE response that flushes a JSON envelope per `stream()` call mid-request (progressive output: an AI
token stream, a long job; explicitly relevant to the gestionale's AI integration). The client
`openStream` used an `EventSource` (GET-only), which cannot carry a signed snapshot.

## Decision

### Core — a request-scoped `LievitStream` sink (mirrors `LievitEffects`)

- **`LievitStream`** is a `ThreadLocal`-bound, per-call sink (like `LievitEffects`): an
  `@LievitAction` calls `LievitStream.current().stream(target, content[, replace])`. Each call
  records a **`StreamChunk`** (`target`, `content`, `replace`) and forwards it to the sink's writer.
  Two factories: `live(Consumer<StreamChunk>)` (the SSE flush) and `capturing()` (in-memory, so a
  streaming action is testable off the wire). `current()` outside a streaming call fails fast — a
  non-streaming call binds no sink, so a stray `stream()` is a loud bug, never a silent drop.
- `StreamChunk` forbids a null content (an empty string is a valid chunk), so the client never has to
  skip an envelope; a falsy `""` / `"0"` flushes correctly.

### Starter — the SSE endpoint reuses the whole dispatch lifecycle

- **`POST /lievit/{componentId}/stream`** returns an `SseEmitter`. It is wire-guarded (no `X-Lievit`
  header ⇒ refused, like the batch endpoint) so a plain browser GET cannot open it. The controller
  binds a `live` `LievitStream` whose writer `emitter.send(...)`s the JSON envelope
  (`encodeStreamChunk`, the `{target, content, replace}` shape the client parses) the moment the
  action streams it, then invokes the action through the **normal `LievitWireService.call`** — the
  component is rehydrated from the signed snapshot, the `@LievitAction` allowlist applies, and the
  action sees current state. When the call returns, the stream completes. No second dispatch path:
  streaming is the same lifecycle with a sink bound.

### Client — a POST stream consumer wired to the existing `l:stream` writer

- **`openStreamCall(root, componentId, {snapshot, calls, csrf, fetchImpl})`** POSTs the snapshot to
  the streaming endpoint (carrying `X-Lievit`), reads the `text/event-stream` response body with a
  `ReadableStream` reader, and feeds each parsed envelope to the existing `applyStreamEnvelope`. A
  helper **`parseSseFrames`** splits the buffered text into complete `data:` payloads + a partial
  tail. This replaces the GET-only `EventSource` for the snapshot-carrying case (the original
  `openStream` stays for a plain GET SSE).

## Consequences

- Additive: a component that never streams binds no sink; the unary `/call` endpoint is untouched.
- Streaming reuses the full dispatch (rehydrate, allowlist, lifecycle), so it inherits the security
  posture (no new deserialization surface, the snapshot HMAC still gates rehydration).
- The SSE response is server-authored content only; no snapshot rotation rides it (a stream is a
  side channel, the next `/call` rotates the snapshot as usual).
- Reversal cost: low. Drop the endpoint + sink + the client `openStreamCall`; the existing
  `consumeStream`/`openStream` primitives are unaffected.

## Alternatives considered

- **Stream over the unary POST response body** instead of a separate SSE endpoint: rejected — the
  `/call` response is HTML + snapshot header with a defined contract; interleaving a chunk stream into
  it would fork that contract. A dedicated endpoint keeps the unary path pristine.
- **Keep `EventSource` (GET)** and pass the snapshot in the query string: rejected — a signed
  snapshot is large and not a query parameter; POST + a body-reader is the correct transport.
