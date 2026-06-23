# ADR-0050: Navigate depth (head merge, @persist, progress bar, scroll opt-in)

- **Status:** superseded by [ADR-0085](0085-adopt-turbo-drive-for-navigation.md)
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

> **Superseded (2026-06-23, ADR-0085).** The whole `installNavigate` SPA implementation this ADR
> extends was retired in favor of Turbo Drive. Every responsibility below now maps to a Turbo-native
> mechanism: head merge → Drive's head reconciliation; `@persist` → `data-turbo-permanent`; progress
> bar → Drive's `.turbo-progress-bar`; scroll → Drive's scroll restoration; tracked-asset reload →
> `data-turbo-track="reload"`. Kept for history; do not implement against it.

## Context

The SPA navigation core shipped with the `installNavigate` feature (issue #155, ADR-0019 extension
model): `l:navigate` links intercept the click, fetch the target page, morph the `<body>`, push/pop
history, and fire `lievit:navigate*` events, with `.hover` prefetch and a tracked-asset full-reload
escape hatch. Three navigation-depth gaps remained against the issue acceptance criteria
(#193 navigate core, #195 navigate depth):

- **Head merge (#193).** The core only *diffed* tracked head assets and full-reloaded when they
  changed; a page-specific stylesheet new to the incoming page was never applied, so the swapped
  body could render unstyled.
- **`@persist` (#195).** Livewire's `@persist` carries a region (an audio player mid-playback)
  across a navigation as the same live DOM node. Livewire implements it via Alpine `x-persist`;
  lievit ships no Alpine, so it needed a native mechanism.
- **Progress bar + scroll opt-in (#195).** A top-of-page progress bar during the fetch (suppressible
  per link), and a `.preserve-scroll` opt-in so a forward navigation can keep its scroll offset
  instead of resetting to top.

Issue #117 (preserve-scroll across *wire* requests, the `l:preserve-scroll` element + the
`l:*.preserve-scroll` directive modifier) was already implemented and tested in the
`preserve-scroll` feature (PR #401); it is distinct from this navigation-scroll work and is closed
separately.

## Decision

Extend the existing `installNavigate` feature in `lievit-ui/runtime/features/navigate.ts` only; no
core loop edit, no new feature module, registered through the same features barrel (ADR-0019).

- **Head merge.** On each swap, parse the incoming page into a detached document, merge its
  `<head>` `<link>`/`<style>`/`<script>` assets into the live `<head>` additively: any asset whose
  signature (tag + `src`/`href`, or tag + inline text) is not already present is appended as a real
  element node so the browser fetches/executes it; present assets are left untouched (no duplication,
  the runtime bundle is never re-run). The tracked-asset full-reload escape hatch is unchanged and
  runs first.
- **`@persist` via `l:persist="key"`.** Before the morph, detach each live `l:persist` region into a
  same-keyed placeholder element; morph the body (the placeholder reconciles structure); after the
  morph, replace each surviving placeholder with the original live node. The live node is reused, so
  its identity (and any in-flight media) survives. A persisted region the incoming page does not
  render is dropped. Lievit-native: no Alpine.
- **Progress bar.** A fixed top bar (`data-lievit-progress`, color via the new
  `NavigateOptions.progressColor`, default Livewire `#2299dd`) is shown while a non-cached page fetch
  is in flight and removed when it settles; suppressed for a link carrying `data-no-progress-bar`.
- **Scroll.** A forward navigation resets scroll to top unless the link carries
  `l:navigate.preserve-scroll`; back/forward still restores the cached offset. `navLink` now matches
  any `l:navigate*` attribute so modifier combinations (`.hover.preserve-scroll`) bind.

## Consequences

- Navigation no longer leaves a page-specific stylesheet behind, and a persisted media region keeps
  playing across navigations, both without a full reload.
- The feature stays a single self-contained module behind the ADR-0019 extension API; the runtime
  core, the morph, and the server dispatcher are untouched. The only server expectation is the
  pre-existing `data-navigate-track` stamp on tracked assets (no change here).
- `@persist` reuses the live node by key; an app must give each persisted region a stable key. A key
  collision (two regions sharing a key) keeps the first and drops the rest, matching the
  one-node-per-key intent.
- The progress bar is unstyled beyond a thin colored fixed bar; an app wanting a richer bar styles
  `[data-lievit-progress]` or suppresses it and renders its own.

## Alternatives considered

**A separate navigate-depth feature module.** Rejected: the four pieces are inseparable from the
navigation flow (they hook the same fetch/swap), so a separate module would have to duplicate the
link interception and the swap seam. Extending the one feature keeps the swap logic in one place.

**`@persist` by moving the live node into the incoming detached body before the morph.** Rejected:
the morph reconciles from the incoming body's `innerHTML` string, which re-creates nodes and loses
the live node's identity. Detaching to a placeholder and re-inserting after the morph is the only
way to keep the same object across an `innerHTML`-driven morph.

**Replacing the whole `<head>` instead of merging.** Rejected: it would re-run the runtime bundle
(or strip it) and defeat the no-full-reload purpose; additive merge with dedupe is the Livewire
behavior.
