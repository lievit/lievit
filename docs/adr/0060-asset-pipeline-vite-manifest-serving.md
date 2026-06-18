# ADR-0060: Asset pipeline: Vite-manifest-versioned bundle serving + per-update component assets

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #171. Livewire has a three-part asset story: a versioned runtime bundle injected by a directive
(`FrontendAssets`), per-component scripts/styles compiled to a `run($wire,$js)` module
(`SupportScriptsAndAssets`), and `getAssets()` returned on every update so a late-arriving component
brings its JS/CSS. lievit must reframe this for JTE + Vite + the strict CSP, not copy the Blade-text
slicing.

Three legs already shipped before this ADR: the auto-injection point + bootstrap attributes
(`LievitAssetInjector`, ADR-0039), the compile-time recording of a component's colocated `.lievit.ts`
module + scoped CSS (`CompiledComponent`, ADR-0023), and the client runtime bundle itself (ADR-0019).
What was missing: *how the runtime bundle is served and versioned*, *how a per-component module reaches
the browser*, and *how a late-arriving component ships its assets on a wire update*.

Two forces shape the lievit answer. First, the bundle is built by Vite, whose canonical
backend-integration contract is the `.vite/manifest.json` (`{src -> {file, css[], isEntry}}`): the
build emits one content-hashed file per entry, and the server serves that hashed file with a long TTL.
Second, the strict CSP (ADR-0019): the served JS is an external module referenced by `src` with a
nonce, never inline, never `eval`.

## Decision

- **`AssetManifest`** (compiler, pure Java): the parsed Vite manifest, a `{src -> {file, css[]}}`
  lookup. `AssetManifest.EMPTY` when no manifest is packaged (dev), so a lookup misses and the caller
  falls back to the unhashed bundle. The shape lives in the compiler (it is a build-tool fact, testable
  without Spring); the starter's `AssetManifestLoader` reads it off the classpath.
- **`LievitAssetController`** (starter): serves the canonical Spring static-resource way off the
  classpath under `lievit.assets.classpath-dir` (default `lievit-runtime/`, the Vite output). The stable
  bootstrap URL `/lievit/lievit.js` redirects (302) to the content-hashed `/lievit/assets/<file>` when a
  manifest is present (immutable cache), and serves the unhashed bundle inline in dev. Per-component dev
  modules are served at `/lievit/module/**`.
- **`ComponentAssetEmitter`** + `WireEffects.Assets` (starter): the wire service derives, per render,
  the assets the rendered component(s) bring (the `run($wire,$js)` module URL Vite-hashed when known,
  the `@assets` head tags, the scoped-CSS `styleModule`) and attaches them to the `Lievit-Effects`
  bag's new `assets` key (server-authored, like the islands extraction, not a core `LievitEffects`
  sink). The batch endpoint aggregates them into its page-level `assets` map.
- **Client `applyAssets`** (`runtime/features/assets.ts`): consumes the `assets` block CSP-safely,
  injecting each script/head-tag/style-link once (deduped), with the content hash cache-busting the
  scoped-CSS `<link>`.

## Consequences

- The runtime bundle is versioned and cache-busted by content hash with no bespoke versioning: the
  hashed file is immutable, the stable `/lievit/lievit.js` redirects to it. Dev works with no build
  step (the unhashed bundle serves directly).
- A late-arriving component ships its JS/CSS on the update that renders it, under the strict CSP, with
  a nonce. The server emits the block whenever the component renders; the client dedups by key (the
  stateless server cannot track per-page loaded state, ADR-0001).
- The asset-on-update derivation is the wire layer's bookkeeping, so `lievit-core` and the wire
  protocol shape are untouched: `assets` is one more optional key in the server-authored bag.

## Alternatives considered

**A core `LievitEffects.asset(...)` sink.** Rejected: the asset story is not a user-callable effect, it
is derived from *which component types rendered*, which the wire layer already knows. A core sink would
add API surface (ADR-0002 cap) for no author benefit and force a `lievit-core` edit.

**Serve the bundle from a CDN / external host.** Rejected for the default: it reintroduces a hosting
and data-egress surface lievit is built to avoid. Classpath serving keeps "add the starter, it works";
an adopter can still front `/lievit/**` with a CDN.
