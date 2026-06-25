/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-anchor` -- ships the CSS Anchor Positioning polyfill that the `popover-anchor` seam always
 * assumed but never loaded (the `@polyfill-placeholder` gap in `runtime/features/
 * popover-anchor.enhancer.ts`). lievit positions every non-modal overlay with native CSS Anchor
 * Positioning Level 1 (`anchor-name` / `position-anchor` / `position-area`, see `popover.jte`).
 * Chromium shipped it; Firefox/Safari were still partial in 2026, so on those engines an anchored
 * panel mis-positions (it falls back to static flow) unless a polyfill runs.
 *
 * Mounted on the popover PANEL via `data-controller="lv-popover lv-anchor"` (popover.jte is the
 * shared positioning seam every non-modal overlay composes). On `connect()` the controller ensures
 * the polyfill -- ONCE per page, and ONLY when the browser lacks native support. The polyfill is the
 * official `@oddbird/css-anchor-positioning` one; loaded lazily through a dynamic `import()` so a
 * supporting browser never downloads it, and so the bytes are off the critical path.
 *
 * Why a controller and not a runtime bootstrap call: the polyfill must engage the moment an anchored
 * surface appears in the DOM (including after a wire morph that injects a controlled popover), and
 * the foundation auto-loads controllers by filename -- so this stays a self-contained file with no
 * edit to the shared bootstrap. The load is a module-singleton promise, so every anchored panel and
 * every reconnect after a morph collapses to a single download + a single `polyfill()` call. The
 * polyfill scans `roots: [document]` and installs its own observers, so one engagement repositions
 * EVERY anchored element on the page (tooltips, dropdowns, menus), not just the panel that triggered it.
 *
 * CSP: strict (`script-src 'self'`, no eval, no inline). The dynamic `import()` is a static module
 * specifier (bundled, same-origin), the `data-controller` attribute is a plain string. No `<script>`
 * tag is injected, no inline handler, no `eval` -- nothing the CSP refuses.
 *
 * Morph-safety: `connect()` only kicks the idempotent loader; there is nothing to tear down, so
 * `disconnect()` is a no-op. Re-connecting on a morph re-calls `ensureAnchorPolyfill()`, which
 * returns the already-resolved singleton promise -- no second download, no re-`polyfill()`.
 */

import { Controller } from "@hotwired/stimulus";

/** A no-arg loader that loads + applies the polyfill; resolves when it is applied. Swappable in tests. */
type PolyfillLoader = () => Promise<unknown>;
/** Returns true when the browser positions anchored elements natively (no polyfill needed). Swappable in tests. */
type SupportProbe = () => boolean;

/**
 * Feature-detects native CSS Anchor Positioning Level 1 -- the exact properties popover.jte stamps
 * (`position-anchor` to bind the panel, `position-area` to place it). `CSS.supports` is the canonical
 * probe; the `anchorName in style` check is the belt-and-suspenders the polyfill's own README uses
 * (a few engines parse the value strings but do not implement the layout). Both must hold.
 */
export function supportsCssAnchorPositioning(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }
  const declarativeOk =
    CSS.supports("position-anchor: --x") && CSS.supports("position-area: bottom");
  const apiOk =
    typeof document !== "undefined" && "anchorName" in document.documentElement.style;
  return declarativeOk && apiOk;
}

/**
 * The real loader: lazily pulls the `/fn` entry (its default export is `polyfill()`, which returns a
 * promise that resolves once positioning has been applied) and runs it over the whole document. The
 * specifier is static so the bundler code-splits it into its own chunk fetched only on this path.
 */
async function defaultLoader(): Promise<unknown> {
  const mod = await import("@oddbird/css-anchor-positioning/fn");
  // Default options: roots=[document] (scan the whole page), so a single engagement fixes every
  // anchored element, not only the panel that triggered the load.
  return mod.default();
}

let supportProbe: SupportProbe = supportsCssAnchorPositioning;
let loader: PolyfillLoader = defaultLoader;
/** Module-singleton: the in-flight / settled engagement. `null` until the first anchored panel connects. */
let engagement: Promise<boolean> | null = null;

/**
 * Ensures the anchor-positioning polyfill is applied -- at most once per page, and only when the
 * browser lacks native support. Returns a promise resolving to whether the polyfill was engaged
 * (`false` = native support, no-op; `true` = polyfill loaded + applied). Idempotent: every call after
 * the first returns the same singleton promise, so N anchored panels + every morph reconnect cost one
 * download. A load failure resolves `false` (never throws) so a missing-chunk edge can't break a connect.
 */
export function ensureAnchorPolyfill(): Promise<boolean> {
  if (engagement != null) {
    return engagement;
  }
  if (supportProbe()) {
    engagement = Promise.resolve(false);
    return engagement;
  }
  engagement = loader()
    .then(() => true)
    .catch(() => false);
  return engagement;
}

/**
 * Test seam: override the support probe and/or the loader. Production never calls this; the
 * controller path reaches the polyfill ONLY through {@link ensureAnchorPolyfill}, so a test can prove
 * the engage / no-engage branches without downloading the real polyfill or touching happy-dom layout.
 */
export function __setAnchorPolyfillSeams(seams: {
  readonly supports?: SupportProbe;
  readonly load?: PolyfillLoader;
}): void {
  if (seams.supports != null) {
    supportProbe = seams.supports;
  }
  if (seams.load != null) {
    loader = seams.load;
  }
}

/** Test seam: forget the singleton engagement + restore the real probe/loader (afterEach reset). */
export function __resetAnchorPolyfill(): void {
  engagement = null;
  supportProbe = supportsCssAnchorPositioning;
  loader = defaultLoader;
}

export default class LvAnchorController extends Controller<HTMLElement> {
  connect(): void {
    // Fire-and-forget: kick the idempotent, support-gated, once-per-page polyfill load. Nothing is
    // bound to the element, so there is nothing for disconnect() to undo.
    void ensureAnchorPolyfill();
  }
}
