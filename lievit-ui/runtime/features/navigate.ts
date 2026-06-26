/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:navigate` — OPT-IN SPA navigation on Turbo Drive (the Livewire `wire:navigate` model, ADR-0085
 * revised for 1.2.0). lievit's value is the wire (partial component re-render: fetch + idiomorph
 * morph) and that is INDEPENDENT of full-page SPA navigation. Full-page SPA-feel (no reload flash,
 * scroll restoration, prefetch) is a SEPARATE, optional concern — polish, not necessity. The browser
 * already navigates natively (robust, zero-JS, CSP-clean, no cross-origin trap); Turbo only adds the
 * SPA feel on top.
 *
 * ## Why opt-in (the 1.2.0 change)
 *
 * Earlier this module booted Turbo Drive as a side-effect of import and let Drive hijack EVERY
 * same-origin link by default (opt-out). That global hijack was a leaky abstraction and the root of a
 * whole bug class: the login form POST became a Drive `fetch` that the strict CSP `connect-src`
 * blocked (a native POST would have been governed by `form-action` and never blocked). So 1.2.0
 * inverts the default: **Turbo Drive is OPT-IN, default OFF.** Importing this module — or calling
 * {@link installAllFeatures} — boots NOTHING; navigation stays native until an app opts a link in.
 *
 * The opt-in is the `l:navigate` directive. It mirrors Livewire `wire:navigate`: the property that
 * matters is OPT-IN + SCOPED, not a bespoke nav engine. We keep Turbo (battle-tested) but adopt its
 * documented opt-in mode: `Turbo.session.drive = false` makes Drive ignore everything unless a link
 * or form (or an ancestor) carries `data-turbo="true"` (Turbo handbook: "Opt-in Drive"). `l:navigate`
 * is a thin alias over `data-turbo="true"` — the consumer writes `l:navigate`, never touches Turbo,
 * and if the engine is ever swapped the markup does not change.
 *
 * ## What this module does
 *
 *  1. **registers the `l:navigate` directive** — on a bound link/area it sets `data-turbo="true"`
 *     (opts that element INTO Drive) and lazily MOUNTS Turbo on first use ({@link mountTurboOptIn}:
 *     dynamic-import the vendored dist, then immediately `session.drive = false`). No `l:navigate` on
 *     the page ⇒ Turbo is never imported ⇒ zero global hijack.
 *  2. **bridges Turbo's lifecycle events** — `turbo:before-visit` / `turbo:before-render` /
 *     `turbo:load` are translated into lievit's `lievit:navigate` / `lievit:navigating` /
 *     `lievit:navigated` CustomEvents, the vocabulary `current.ts` (active-link re-eval) and
 *     `broadcast.ts` (channel teardown) already listen on, so those features keep working unmodified.
 *  3. **re-binds wire components after a Drive swap** — on `turbo:load` it re-runs
 *     {@link LievitRuntime.start} over the new body so a swapped-in wire component (fresh, unbound
 *     DOM) re-registers its snapshot and re-binds its `l:*` directives (`start` is idempotent and
 *     re-scannable on a subtree).
 *
 * The event-bridge + re-bind listeners are attached eagerly by {@link installNavigate} and are inert
 * until Turbo is mounted (no Drive ⇒ no `turbo:*` events ⇒ no-op), so attaching them costs nothing and
 * does not hijack navigation.
 *
 * NOTE on morph: this is page-level navigation. The per-wire-call surgical morph (`morph.ts`,
 * ADR-0019) is a DIFFERENT granularity (it reconciles ONE component's re-render against the server's
 * authoritative state) and is NOT replaced — it stays lievit's bespoke morph. The wire works with or
 * without Turbo.
 *
 * CSP: the vendored Turbo Drive build is `eval`-free / `new Function`-free (verified at vendor time),
 * so it runs under `script-src 'self'`. This file adds no inline script either. With Drive opt-in, a
 * native form POST (e.g. login) is a real navigation governed by `form-action`, not a Drive `fetch`
 * on `connect-src` — the bug class that the global hijack created cannot occur.
 */

import type { LievitRuntime } from "../runtime.js";

/** lievit's navigation-event names — the vocabulary `current.ts` / `broadcast.ts` already listen on. */
const NAVIGATE = "lievit:navigate";
const NAVIGATING = "lievit:navigating";
const NAVIGATED = "lievit:navigated";

/** The bare directive name (`l:navigate`) and the Turbo opt-in attribute it sets. */
const DIRECTIVE_NAME = "navigate";
const TURBO_ATTR = "data-turbo";

/**
 * The default Turbo mounter: lazily import the vendored Turbo Drive dist and immediately disable
 * global Drive. The dist auto-`start()`s Drive on import (and sets `window.Turbo`); flipping
 * `session.drive = false` straight after makes Drive OPT-IN — it hijacks nothing until a link/form
 * carries `data-turbo="true"` (Turbo handbook: "Opt-in Drive"). Idempotent across calls because the
 * dynamic import is module-cached and `installNavigate` only ever calls a mounter once.
 *
 * @returns a promise resolved once Drive is mounted and flipped off (awaited only in tests).
 */
export async function mountTurboOptIn(): Promise<void> {
  const turbo = await import("../vendor/turbo.es2017-esm.js");
  // Drive OFF by default: only `data-turbo="true"` (set by `l:navigate`) opts an element in.
  turbo.session.drive = false;
}

/** Options for {@link installNavigate}: the window/document to bind + an injectable Turbo mounter. */
export interface NavigateOptions {
  /** The window to bind Turbo's events on and re-scan (defaults to the global `window`). */
  readonly win?: Window;
  /**
   * Mounts Turbo Drive in opt-in mode (default {@link mountTurboOptIn}). Injected in tests to assert
   * the opt-in wiring without booting the real Turbo. Called AT MOST ONCE, on the first `l:navigate`.
   */
  readonly mountTurbo?: () => void | Promise<void>;
}

/**
 * Installs lievit's `l:navigate` opt-in + Turbo Drive glue on a runtime (ADR-0085, 1.2.0). Returns an
 * unsubscribe that removes the Turbo event listeners. Nothing is booted until an `l:navigate` element
 * is bound: this is the opt-in default.
 *
 * @param runtime the started runtime (re-`start`ed after each body swap to bind new components)
 * @param options injectable window + Turbo mounter (for tests)
 * @returns an unsubscribe that removes the document listeners
 */
export function installNavigate(runtime: LievitRuntime, options: NavigateOptions = {}): () => void {
  const win = options.win ?? window;
  const doc = win.document;
  const mountTurbo = options.mountTurbo ?? mountTurboOptIn;

  // Turbo is mounted lazily, at most once, on the first `l:navigate` element bound (the opt-in).
  let turboMounted = false;
  function ensureTurbo(): void {
    if (turboMounted) {
      return;
    }
    turboMounted = true;
    void mountTurbo();
  }

  // The `l:navigate` directive: opt this link/area INTO Turbo Drive and mount Turbo on first use.
  // Turbo reads the closest `[data-turbo]` ancestor; "true" upgrades the element even though Drive is
  // globally OFF (`session.drive = false`). Idempotent: the registry marks each element bound-once and
  // `setAttribute` is a no-op when already set.
  runtime.directives.register({
    name: DIRECTIVE_NAME,
    bind(element) {
      if (element.getAttribute(TURBO_ATTR) !== "true") {
        element.setAttribute(TURBO_ATTR, "true");
      }
      ensureTurbo();
    },
  });

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
