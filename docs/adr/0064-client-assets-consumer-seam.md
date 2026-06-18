# ADR-0064: Client `applyAssets` consumer as a self-contained, opt-in feature

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

The asset pipeline (ADR-0060) makes the server emit a page-level `assets` block on a wire update (the
`run($wire,$js)` module URLs, the `@assets` head tags, the scoped-CSS `styleModule`s). Something on the
client must apply that block: inject the script/head-tag/link once, CSP-safely, with the content hash
cache-busting the scoped-CSS `<link>` (issue #171/#119/#129 client AC).

The existing effect consumers (`dispatch`, `url`, `download`) live in the shared `effects.ts`
`applyEffects` loop and surface DOM events (`URL_EFFECT_EVENT`, `VALIDATION_EFFECT_EVENT`). Wiring the
assets consumer into that loop would edit `effects.ts` (and the `Effects` interface), a hot shared file
under concurrent change. The asset-apply logic is self-contained (it only needs a `Document` and the
parsed block).

## Decision

- Ship the consumer as a **self-contained module** `runtime/features/assets.ts` exporting
  `applyAssets(block, doc?, nonce?)` + the `AssetsBlock` / `StyleModuleAsset` types. It injects each
  asset once (deduped by `src` / tag content / component name), refuses a bare inline `<script>` (no
  `src`) to keep the strict-CSP posture (ADR-0019), stamps a CSP nonce when supplied, and re-fetches a
  scoped-CSS `<link>` only when its content hash changed.
- Do **not** wire it into `installAllFeatures` in this change. An app (or the client's effect loop)
  calls `applyAssets(effects.assets, document, nonce)` when an update carries the block. Folding it
  into the global `applyEffects` is a one-line follow-up the client surface owns, kept out of this
  compiler/starter change to avoid a merge collision on the shared effect core.

## Consequences

- The client AC is met by a tested, ready unit: assets load once, scoped CSS is cache-busted, the CSP
  posture holds, with no edit to the shared `effects.ts` / `runtime.ts` / feature index.
- The seam is explicit: a reader sees `applyAssets` is the consumer and that its global wiring is the
  remaining one-liner, rather than a half-edited shared loop.
- The module is dependency-free and strict-CSP-safe, consistent with the rest of the runtime bundle
  (ADR-0019's "small, zero framework deps").

## Alternatives considered

**Edit `applyEffects` in `effects.ts` to apply the block.** The eventual home, but rejected for this
change: `effects.ts` and the `Effects` interface are under concurrent edit by the client surface; a
self-contained module + a documented one-line follow-up avoids the collision while still shipping the
behavior.

**Surface the block as a DOM event (like `url`).** Rejected: head-asset injection is not a
component-scoped reaction a listener is the right shape for; a direct `applyAssets` call is simpler and
the dedup state lives in the document (the injected markers), not in a listener.
