# ADR-0081: Auto-wire `applyAssets` into the effect-apply loop

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

ADR-0064 shipped the client asset consumer `applyAssets(block, doc?, nonce?)`
(`runtime/features/assets.ts`) as a self-contained, opt-in unit and deliberately did NOT wire it into
the global effect-apply loop, to avoid a merge collision on the shared effect core while the asset
pipeline (ADR-0060/#171) was in flight. The documented opt-in was "an app calls `applyAssets` itself
from an effects hook". Issue #423 closes that follow-up: per-update asset injection should be on by
default, the same way `installScopedCss` is on by default in `installAllFeatures`.

Two seams were missing, so it was not a one-liner:

- `effects.ts` did not parse the `assets` key of the `Lievit-Effects` bag into a typed `AssetsBlock`,
  so the parsed effects never carried it.
- `InterceptorOutcome` (the `afterCall(outcome)` argument) exposed only `componentId`/`root`/`status`/
  `ok`/`reason`, never the effects block or the page CSP nonce, so an `afterCall` interceptor had
  nothing to apply.

`installScopedCss` is the template: a feature that plugs into the runtime's `afterCall` seam, needs no
core fork, and re-applies on every update.

## Decision

- **Parse `assets` into the effects bag.** `effects.ts` gains an optional `assets?: AssetsBlock` key
  on the `Effects` interface, importing the `AssetsBlock` type from `features/assets.ts`. `parseEffects`
  already `JSON.parse`s the whole header, so the key is decoded with no extra code; the type makes it
  visible and consumable.
- **Expose the assets block + page nonce on `InterceptorOutcome`.** The success outcome the runtime
  builds carries `assets` (the parsed block for this update, or `null`) and `nonce` (the page CSP
  nonce, or `undefined`). The nonce comes from `RuntimeOptions.nonce`, the same page-derived bootstrap
  channel the runtime already takes the CSRF token on (ADR-0039 stamps the nonce server-side; the page
  passes it to `startLievit` next to `csrfToken`). The failure/synthetic outcomes carry `assets: null`.
- **Add `installAssets(runtime)`** (`features/assets.ts` keeps `applyAssets` UNCHANGED; the installer is
  a thin afterCall interceptor): it registers a global interceptor whose `onMorph` (the runtime's
  post-morph "afterCall" success phase) calls `applyAssets(outcome.assets, document, outcome.nonce)`.
  Register it in `installAllFeatures` and barrel-export it from `features/index.ts`. Dedup state lives
  in the document (the injected markers), so repeated updates load each asset exactly once.

## Consequences

- Per-update asset injection is on by default for any app using `installAllFeatures`: a late-rendered
  component's `run($wire,$js)` scripts, `@assets` head tags, and scoped-CSS `<link>`s load
  automatically, once, CSP-safely, with the nonce stamped when the page runs a nonce policy.
- `InterceptorOutcome` is a slightly wider public seam (two optional fields); existing interceptors are
  unaffected (both fields are optional and the prior fields are unchanged).
- `applyAssets` stays a pure, dependency-free, separately tested unit; the installer is the only new
  wiring, mirroring `installScopedCss`.
- The nonce is plumbed through `RuntimeOptions`, not sniffed from the DOM, so it is injectable in tests
  and has a single, explicit source (the page bootstrap), consistent with `csrfToken`.

## Alternatives considered

**Edit `applyEffects` in `effects.ts` to call `applyAssets` directly.** This was ADR-0064's named
eventual home. Rejected: `applyEffects` has no `Document`/nonce in scope and is the shared, hot core;
the `afterCall` interceptor seam is exactly where `installScopedCss` already applies post-update DOM
work, keeps the core untouched, and gives access to the nonce on the outcome.

**Sniff the nonce from the runtime `<script>` tag or a `<meta>` in the DOM.** Rejected for v0.1: it
guesses a DOM convention and is awkward to inject in tests. The page already hands the runtime its
CSRF token through `RuntimeOptions`; the nonce rides the same explicit channel.

**Surface the assets block as a DOM event (like `url`).** Rejected for the same reason ADR-0064 gave:
head-asset injection is not a component-scoped reaction a listener is the right shape for; a direct
`applyAssets` call is simpler and the dedup state lives in the document, not in a listener.
