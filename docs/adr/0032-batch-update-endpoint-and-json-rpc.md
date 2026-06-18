# ADR-0032: Batched update endpoint + `@LievitJson` JSON RPC endpoints

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

> **ADR numbering note.** This server/engine P1/P2 work claims **0032–0033**. The parallel sibling
> client branch claims the 0024–0029 band (per ADR-0030's note) and may add 0034+. If both land,
> reconcile by keeping the lower free numbers for whichever merged first; these two are server-only.

## Context

Two transport/engine items of Epic #34/#36 were still open after the per-feature server pass:

- **#177 — batched update endpoint.** ADR-0001 shipped one endpoint per component
  (`POST /lievit/{id}/call`, snapshot + effects on response headers). A page with several islands
  would N+1 the network: one HTTP round trip per island. Livewire's transport is the opposite — a
  single `POST {prefix}/update` that commits an **array** of components in one request and returns
  one result per component, with a server-side **skip** for a reactive child whose props did not
  change.
- **#99 — `@LievitJson` JSON RPC endpoints.** Livewire's `$wire.method()` / `SupportJson` lets the
  client call a server method as a typed RPC returning a `Promise` of the raw value, with **no
  re-render**. lievit had the return-value-on-the-effects-channel (ADR-0012) but no way to mark a
  method as render-skipping data-only.

## Decision

### Batched update endpoint (#177) — additive, alongside the per-component endpoint

A new `POST /lievit/update` consumes `{components:[{snapshot,updates,calls,events}]}` and returns
`application/json`: `{components:[{id,snapshot,html,effects}|{id,skip:true}], assets}`. The header
shape of the per-component endpoint cannot carry N snapshots/effects, so the batch returns a JSON
body. Both endpoints share **one lifecycle** (`LievitWireService.runCall`); the per-component
endpoint stays the single-component fast path (and keeps the header response for ADR-0001
compatibility).

- **Header guard.** The batch endpoint is a wire-only surface: a request without the `X-Lievit`
  header is rejected `400 missing-header` (new `WireError.MISSING_WIRE_HEADER`), so a plain browser
  navigation or a non-wire form POST cannot drive it (Livewire `RequireLivewireHeaders`).
- **Reactive-child skip.** A batch component carrying no updates, no calls, and no events is *inert*:
  its snapshot is verified only to recover its id, **no lifecycle runs**, and the result is a bare
  `{id, skip:true}` marker. This is the optimization that keeps a page of many islands cheap when
  only one changed.
- **Endpoint resolution.** `EndpointResolver` centralizes the URI prefix + the update/call paths, so
  a single `lievit.endpoint-prefix` relocates the whole wire surface.

### `@LievitJson` JSON RPC (#99) — a method annotation, render-skipping

`@LievitJson` on an `@LievitAction` marks it a JSON RPC endpoint: the client calls it as
`$lievit.method()`, gets a `Promise` resolving with the return value, and the component never
re-renders. The return value rides the **existing** effects-channel `returns` key (ADR-0012); the
only new server behaviour is the render skip. We reuse the `@LievitRenderless` render-skip tally
(ADR-0031): `RenderlessListener` now counts a `@LievitJson` action as renderless, so the
render-skip decision stays in **one place** (no second listener mutating the per-call render state,
no per-call memo pollution). A validation failure short-circuits before the action runs and the
errors effect carries the per-field messages the client rejects the `Promise` with.

## Consequences

- One new endpoint (`/lievit/update`) and one new `WireError` (`MISSING_WIRE_HEADER`, 400). The
  per-component endpoint is unchanged: a single-component call is byte-for-byte the ADR-0001 path.
- `LievitWireService.call` now delegates to a shared `runCall`; the per-component and batch paths
  cannot drift because they run the same lifecycle.
- One new annotation (`@LievitJson`). No protocol surface beyond it: the return value reuses the
  effects channel, the render skip reuses the renderless seam.
- The batch `assets` block is empty today; it is the injection point for the asset pipeline (#171).

## Alternatives considered

**Replace the per-component endpoint with the batch one.** Rejected: the per-component endpoint is
the header-based ADR-0001 contract a single island already uses; keeping both is additive and lets a
single-component call skip the JSON envelope.

**A dedicated `JsonEndpointListener` owning its own render-skip on a per-call memo flag.** Rejected:
the memo is merged into the snapshot (it persists across calls), so a transient render flag would
leak into the signed state. Folding `@LievitJson` into the existing renderless tally keeps the
render-skip decision single-sourced and the snapshot clean.
