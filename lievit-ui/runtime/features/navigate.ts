/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * SPA navigation, on Turbo Drive (ADR-0085). lievit retired its hand-rolled SPA navigation
 * (the old `navigate.ts`: ~377 lines of fetch + body-morph + head-merge + history + prefetch +
 * progress bar + scroll + `@persist`) and ADOPTS **Turbo Drive** (`@hotwired/turbo`, MIT, 37signals),
 * vendored first-party at `../vendor/turbo.es2017-esm.js`. Turbo Drive natively covers every
 * responsibility the old code hand-wrote:
 *
 * | lievit responsibility (old `navigate.ts`)        | Turbo Drive native                         |
 * |--------------------------------------------------|--------------------------------------------|
 * | fetch + `<body>` swap + pushState + back/forward | Drive core (auto-`start()` on import)      |
 * | `<head>` merge (`mergeHead`)                      | Drive's head reconciliation                |
 * | tracked-asset change → full reload               | `data-turbo-track="reload"` on the asset   |
 * | progress bar                                      | Drive's progress bar (`.turbo-progress-bar`)|
 * | `l:persist` live nodes (mid-playback media)       | `data-turbo-permanent` + an `id`           |
 * | prefetch-on-hover (`l:navigate.hover`)           | Drive prefetch (default on; opt out per el)|
 * | scroll restoration                                | Drive's scroll restoration                 |
 *
 * The author-facing contract changes from **opt-in** to **opt-out** (Turbo's model, documented in
 * ADR-0085): the old `l:navigate` marked individual links to upgrade; Turbo Drive upgrades ALL
 * same-origin links by default, and a link opts OUT with `data-turbo="false"`. lievit accepts Turbo's
 * default because it is the canonical, reputable behavior (Appropriate Complexity: customize the
 * minimum). An `l:navigate` attribute left on a link is now a harmless no-op — Turbo drives it anyway.
 *
 * ## The residual glue (the ~10-20% Turbo does not cover) — this file
 *
 * Turbo swaps the `<body>` but knows nothing about lievit's wire components (the
 * `data-lievit-component` roots and their `l:*` directives). After every Drive swap those components
 * are FRESH, unbound DOM. The load-bearing
 * glue: on `turbo:load` / `turbo:render`, re-run {@link LievitRuntime.start} over the new body so each
 * wire component re-registers its snapshot and re-binds its directives (`runtime.start` is idempotent
 * and re-scannable on a subtree, so it is safe to call after every swap).
 *
 * Plus a thin **event bridge**: Turbo's lifecycle events (`turbo:before-visit`, `turbo:before-render`,
 * `turbo:load`) are translated into lievit's existing `lievit:navigate` / `lievit:navigating` /
 * `lievit:navigated` CustomEvents, so the features that already listen for those (`l:current`
 * re-evaluation in `current.ts`, the broadcast channel teardown in `broadcast.ts`) keep working
 * WITHOUT modification. lievit owns its own navigation-event vocabulary; Turbo is the engine under it.
 *
 * NOTE on morph: this is page-level navigation. The per-wire-call surgical morph (`morph.ts`,
 * ADR-0019) is a DIFFERENT granularity (it reconciles ONE component's re-render against the server's
 * authoritative state) and is NOT replaced — it stays lievit's bespoke morph. Turbo 8 can also morph
 * its page REFRESHES (`<meta name="turbo-refresh-method" content="morph">`), which is orthogonal and
 * opt-in per app; it does not touch the wire loop.
 *
 * CSP: the vendored Turbo Drive build is `eval`-free / `new Function`-free (verified at vendor time),
 * so it runs under `script-src 'self'`. This file adds no inline script either.
 */

// Side-effect import: the vendored Turbo dist calls `start()` on load, so importing it boots Turbo
// Drive over the whole document. No CDN, no runtime npm dep — first-party vendored (ADR-0085).
import "../vendor/turbo.es2017-esm.js";

import type { LievitRuntime } from "../runtime.js";

/** lievit's navigation-event names — the vocabulary `current.ts` / `broadcast.ts` already listen on. */
const NAVIGATE = "lievit:navigate";
const NAVIGATING = "lievit:navigating";
const NAVIGATED = "lievit:navigated";

/** Options for {@link installNavigate}: the window/document to bind (injectable for tests). */
export interface NavigateOptions {
  /** The window to bind Turbo's events on and re-scan (defaults to the global `window`). */
  readonly win?: Window;
}

/**
 * Installs lievit's Turbo Drive glue on a runtime (ADR-0085). Returns an unsubscribe that removes the
 * Turbo event listeners. Drive itself is already started by the side-effect import above; this only
 * wires the lievit-specific glue on top of it:
 *
 * - re-binds wire components after each Turbo swap ({@link LievitRuntime.start} on the new body), and
 * - bridges Turbo's lifecycle events to lievit's `lievit:navigate*` CustomEvents.
 *
 * @param runtime the started runtime (re-`start`ed after each body swap to bind new components)
 * @param options injectable window (for tests)
 * @returns an unsubscribe that removes the document listeners
 */
export function installNavigate(runtime: LievitRuntime, options: NavigateOptions = {}): () => void {
  const win = options.win ?? window;
  const doc = win.document;

  function emit(name: string, detail: Record<string, unknown>): void {
    win.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /** Turbo is about to leave the current page → lievit `navigate` (the channel-teardown signal). */
  const onBeforeVisit = (event: Event): void => {
    const url = urlOf(event) ?? win.location.href;
    emit(NAVIGATE, { url });
  };

  /** Turbo is about to render the incoming page → lievit `navigating` (in-flight, pre-swap). */
  const onBeforeRender = (): void => {
    emit(NAVIGATING, { url: win.location.href });
  };

  /**
   * Turbo finished a swap (also fires once on the initial load) → the load-bearing glue: re-bind the
   * fresh wire components, then emit lievit `navigated` so `l:current` re-evaluates the active link.
   */
  const onLoad = (): void => {
    runtime.start(doc.body);
    emit(NAVIGATED, { url: win.location.href });
  };

  doc.addEventListener("turbo:before-visit", onBeforeVisit);
  doc.addEventListener("turbo:before-render", onBeforeRender);
  doc.addEventListener("turbo:load", onLoad);

  return () => {
    doc.removeEventListener("turbo:before-visit", onBeforeVisit);
    doc.removeEventListener("turbo:before-render", onBeforeRender);
    doc.removeEventListener("turbo:load", onLoad);
  };
}

/** Reads the destination URL from a `turbo:before-visit` event detail, if present. */
function urlOf(event: Event): string | null {
  const detail = (event as CustomEvent<{ url?: string }>).detail;
  return detail != null && typeof detail.url === "string" ? detail.url : null;
}
