# ADR-0063: Scoped CSS modules, server half (CSS route + `styleModule` effect + cache-busting)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #129. The client half already ships (`runtime/features/scoped-css.ts`): it hoists a component's
inline `<style l:scope>` into a single `<head>` sheet once per component name, rewrites each selector
to require `[data-lievit-scope="<name>"]`, and stamps that scope on every root, so rules cannot leak
across deeply-namespaced component names.

The remaining server half is the issue's alternate transport: a component's scoped (and/or global)
CSS served over a **dedicated route**, wrapped in the component selector server-side, with a
`styleModule` effect carrying an mtime/content hash so the client injects a cache-busted `<link>`
rather than hoisting an inline block. This decouples the CSS from the component body (it is fetched
once and cached) and is the v4 SFC authoring model where the CSS is a colocated `.lievit.css` file the
compiler already records (ADR-0023).

## Decision

- **`ScopedCss`** (starter, pure): wraps a stylesheet in the component's scope selector
  (`[data-lievit-scope="<scopeId>"]`, the same convention and `scopeId()` the client feature uses, so
  a deeply-namespaced name keeps its own scope) and derives a content hash (CRC-32) for cache-busting.
  At-rule bodies (`@media` etc.) are scoped recursively; `:scope`/`&` map to the root.
- **CSS route** `GET /lievit/css/{component}` (`LievitAssetController`): resolves the component
  (dotted name or FQN), compiles it, scopes its colocated `.lievit.css`, and serves `text/css`. A
  versioned request (`?v=<hash>`) caches immutably; an unversioned one is revalidated. An unknown
  component or one with no CSS is a 404.
- **`styleModule` effect** (`WireEffects.StyleModule`, part of the `assets` block of ADR-0060): when a
  rendered component carries scoped CSS, the wire update emits `{component, href, hash}`; the client
  `applyAssets` injects the `<link>` once per component and replaces it (re-fetch) only when the hash
  changes.

## Consequences

- A component's scoped CSS is served once, cached by the browser, and busted only when its bytes
  change, instead of riding inline in every render of the component body.
- The no-leakage guarantee holds across deeply-namespaced names: the server scopes with the same
  `scopeId` the client stamps on roots, so one component's rule can never match another's subtree.
- Both transports (the shipped inline-hoist and this route) use one scope convention, so a component
  can use either without a different client contract.

## Alternatives considered

**Serve the CSS unscoped and let the client scope it.** Rejected: the client already supports the
inline-hoist path; the point of the route transport is that the served stylesheet is *final* (scoped,
cacheable). Scoping client-side would re-parse the CSS on every load and lose the cache benefit.

**Use file mtime for cache-busting (Livewire's literal model).** Rejected for a content hash: an mtime
is unstable across builds/deploys of identical bytes (it would bust the cache needlessly) and is
unavailable for a classpath resource inside a jar. A content hash busts exactly when the bytes change.
