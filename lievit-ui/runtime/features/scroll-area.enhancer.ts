/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Scroll-area enhancer — typed vanilla-TS, CSP-clean. Registered via the runtime lifecycle bus
 * on elements carrying `data-lievit-scroll-area` (the discovery attribute set by scroll-area.jte
 * when overlay=true).
 *
 * What this enhancer does (and does NOT do):
 *
 * DOES:
 * - Discovers scroll-area roots via `[data-lievit-scroll-area]` on `onComponentInit` and
 *   `afterCall`.
 * - On mount: reads `data-orientation`, `data-type`, `data-hide-delay` from the root.
 * - Thumb sizing: uses ResizeObserver to keep each rail thumb's size proportional to the
 *   viewport/content ratio (thumbRatio = viewport / content).
 * - Thumb position: on `scroll` events from the viewport, translates the thumb to reflect
 *   the scroll position (offsetPct = scrollOffset / (content - viewport)).
 * - aria-valuenow: updated on each scroll event (0-100 range, rounded).
 * - data-scrolling: set on root during scroll; cleared after `hideDelay` ms of inactivity.
 * - data-pointer-over: set on root on `pointerenter`, removed on `pointerleave` (drives hover
 *   visibility in CSS without JS class churn per frame).
 * - Thumb drag: pointerdown on the thumb starts a drag; pointermove translates the viewport
 *   scroll position; pointerup ends the drag. Uses setPointerCapture for reliable drag tracking.
 * - data-no-overflow: set on the root when the content does not overflow the viewport on that
 *   axis (thumb would be full-size); removed when it does. CSS can use this to auto-hide rails.
 * - Cleanup on destroy: listeners are registered with AbortController; aborting the controller
 *   removes all listeners atomically. The WeakSet guard prevents double-wiring.
 *
 * DOES NOT:
 * - Handle native scrollbar styling (that is overlay=false territory, zero JS).
 * - Intercept keyboard scroll events (the platform handles those on the focusable viewport).
 * - Provide smooth scrolling (that is a CSS `scroll-behavior` decision for the adopter).
 * - Create a scroll event for every pointermove tick during drag (it scrolls the viewport,
 *   the scroll event fires naturally and syncs the thumb through the normal path).
 *
 * Attribute protocol on the ROOT element (set by `scroll-area.jte` when overlay=true):
 * - `data-lievit-scroll-area`       discovery attribute (presence-boolean, value is "")
 * - `data-orientation`              "vertical" | "horizontal" | "both"
 * - `data-type`                     "hover" | "always" | "scroll" -- visibility policy
 * - `data-hide-delay`               ms as string, delay before hiding rail after scroll stop
 *
 * Attribute protocol set by the ENHANCER at runtime:
 * - `data-scrolling`                present while scrolling, removed after hideDelay
 * - `data-pointer-over`             present while pointer is inside the root
 * - `data-no-overflow`              present when content does not overflow the viewport
 *
 * WCAG / APG sources:
 *   https://www.w3.org/WAI/ARIA/apg/patterns/scrollbar/ (2.1 + 2.2)
 */

import type { LievitRuntime } from "../runtime.js";

/** Wired roots (idempotency guard). */
const wiredRoots = new WeakSet<Element>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the scroll ratio (0-1) for a given axis. */
function scrollRatio(scrollOffset: number, contentSize: number, viewportSize: number): number {
  const scrollable = contentSize - viewportSize;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, scrollOffset / scrollable));
}

/** Return the thumb size ratio (0-1) for a given axis. */
function thumbRatio(viewportSize: number, contentSize: number): number {
  if (contentSize <= 0) return 1;
  return Math.min(1, viewportSize / contentSize);
}

// ---------------------------------------------------------------------------
// Wire a single scroll-area root
// ---------------------------------------------------------------------------

function wireRoot(root: HTMLElement): void {
  if (wiredRoots.has(root)) return;
  wiredRoots.add(root);

  const orientation = root.dataset["orientation"] ?? "vertical";
  const hideDelay = parseInt(root.dataset["hideDelay"] ?? "1000", 10);

  const viewport = root.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
  if (viewport == null) return;

  const verticalRail = root.querySelector<HTMLElement>('[data-slot="scroll-area-bar"][data-orientation="vertical"]');
  const horizontalRail = root.querySelector<HTMLElement>('[data-slot="scroll-area-bar"][data-orientation="horizontal"]');
  const verticalThumb = verticalRail?.querySelector<HTMLElement>('[data-slot="scroll-area-thumb"]') ?? null;
  const horizontalThumb = horizontalRail?.querySelector<HTMLElement>('[data-slot="scroll-area-thumb"]') ?? null;

  const ac = new AbortController();
  const { signal } = ac;

  // --------------------------------------------------------------------------
  // Thumb sync (size + position)
  // --------------------------------------------------------------------------

  function syncVertical(): void {
    if (verticalRail == null || verticalThumb == null) return;
    const railH = verticalRail.clientHeight;
    const contentH = viewport!.scrollHeight;
    const viewH = viewport!.clientHeight;

    const ratio = thumbRatio(viewH, contentH);
    const thumbH = Math.max(20, railH * ratio); // minimum 20px for usability
    verticalThumb.style.height = `${thumbH}px`;
    verticalThumb.style.flexShrink = "0";

    const hasOverflow = contentH > viewH + 1;
    if (hasOverflow) {
      root.removeAttribute("data-no-overflow");
    } else {
      root.setAttribute("data-no-overflow", "");
    }

    const sRatio = scrollRatio(viewport!.scrollTop, contentH, viewH);
    const maxTranslate = railH - thumbH;
    verticalThumb.style.transform = `translateY(${maxTranslate * sRatio}px)`;

    // aria-valuenow: 0-100
    const now = Math.round(sRatio * 100);
    verticalRail.setAttribute("aria-valuenow", String(now));
  }

  function syncHorizontal(): void {
    if (horizontalRail == null || horizontalThumb == null) return;
    const railW = horizontalRail.clientWidth;
    const contentW = viewport!.scrollWidth;
    const viewW = viewport!.clientWidth;

    const ratio = thumbRatio(viewW, contentW);
    const thumbW = Math.max(20, railW * ratio);
    horizontalThumb.style.width = `${thumbW}px`;
    horizontalThumb.style.flexShrink = "0";

    const sRatio = scrollRatio(viewport!.scrollLeft, contentW, viewW);
    const maxTranslate = railW - thumbW;
    horizontalThumb.style.transform = `translateX(${maxTranslate * sRatio}px)`;

    const now = Math.round(sRatio * 100);
    horizontalRail.setAttribute("aria-valuenow", String(now));
  }

  function syncAll(): void {
    if (orientation === "vertical" || orientation === "both") syncVertical();
    if (orientation === "horizontal" || orientation === "both") syncHorizontal();
  }

  // Initial sync
  syncAll();

  // --------------------------------------------------------------------------
  // Scroll event: update thumb position + data-scrolling
  // --------------------------------------------------------------------------

  let scrollTimer: ReturnType<typeof setTimeout> | null = null;

  viewport.addEventListener("scroll", () => {
    syncAll();
    root.setAttribute("data-scrolling", "");
    if (scrollTimer != null) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      root.removeAttribute("data-scrolling");
      scrollTimer = null;
    }, hideDelay);
  }, { signal });

  // --------------------------------------------------------------------------
  // ResizeObserver: resize of viewport or content changes thumb size/position
  // --------------------------------------------------------------------------

  const ro = new ResizeObserver(() => {
    syncAll();
  });

  // Observe the viewport (its size affects both view and content in the horizontal case)
  ro.observe(viewport);

  // Observe direct children of the viewport if possible (content size changes)
  for (const child of Array.from(viewport.children)) {
    ro.observe(child);
  }

  // Clean up ResizeObserver on abort (we hook into a finaliser using a plain listener)
  signal.addEventListener("abort", () => {
    ro.disconnect();
    if (scrollTimer != null) clearTimeout(scrollTimer);
  });

  // --------------------------------------------------------------------------
  // Pointer-over: data-pointer-over for hover visibility policy
  // --------------------------------------------------------------------------

  root.addEventListener("pointerenter", () => {
    root.setAttribute("data-pointer-over", "");
  }, { signal });

  root.addEventListener("pointerleave", () => {
    root.removeAttribute("data-pointer-over");
  }, { signal });

  // --------------------------------------------------------------------------
  // Thumb drag (vertical)
  // --------------------------------------------------------------------------

  if (verticalThumb != null && verticalRail != null) {
    let dragStartY = 0;
    let dragStartScrollTop = 0;

    verticalThumb.addEventListener("pointerdown", (e: PointerEvent) => {
      e.preventDefault();
      verticalThumb.setPointerCapture(e.pointerId);
      dragStartY = e.clientY;
      dragStartScrollTop = viewport.scrollTop;
      verticalThumb.dataset["dragging"] = "";
    }, { signal });

    verticalThumb.addEventListener("pointermove", (e: PointerEvent) => {
      if (!verticalThumb.hasPointerCapture(e.pointerId)) return;
      const railH = verticalRail.clientHeight;
      const thumbH = verticalThumb.offsetHeight;
      const maxTranslate = railH - thumbH;
      if (maxTranslate <= 0) return;
      const dy = e.clientY - dragStartY;
      const scrollable = viewport.scrollHeight - viewport.clientHeight;
      const scrollDelta = (dy / maxTranslate) * scrollable;
      viewport.scrollTop = dragStartScrollTop + scrollDelta;
    }, { signal });

    verticalThumb.addEventListener("pointerup", (e: PointerEvent) => {
      verticalThumb.releasePointerCapture(e.pointerId);
      delete verticalThumb.dataset["dragging"];
    }, { signal });

    verticalThumb.addEventListener("pointercancel", (e: PointerEvent) => {
      verticalThumb.releasePointerCapture(e.pointerId);
      delete verticalThumb.dataset["dragging"];
    }, { signal });
  }

  // --------------------------------------------------------------------------
  // Thumb drag (horizontal)
  // --------------------------------------------------------------------------

  if (horizontalThumb != null && horizontalRail != null) {
    let dragStartX = 0;
    let dragStartScrollLeft = 0;

    horizontalThumb.addEventListener("pointerdown", (e: PointerEvent) => {
      e.preventDefault();
      horizontalThumb.setPointerCapture(e.pointerId);
      dragStartX = e.clientX;
      dragStartScrollLeft = viewport.scrollLeft;
      horizontalThumb.dataset["dragging"] = "";
    }, { signal });

    horizontalThumb.addEventListener("pointermove", (e: PointerEvent) => {
      if (!horizontalThumb.hasPointerCapture(e.pointerId)) return;
      const railW = horizontalRail.clientWidth;
      const thumbW = horizontalThumb.offsetWidth;
      const maxTranslate = railW - thumbW;
      if (maxTranslate <= 0) return;
      const dx = e.clientX - dragStartX;
      const scrollable = viewport.scrollWidth - viewport.clientWidth;
      const scrollDelta = (dx / maxTranslate) * scrollable;
      viewport.scrollLeft = dragStartScrollLeft + scrollDelta;
    }, { signal });

    horizontalThumb.addEventListener("pointerup", (e: PointerEvent) => {
      horizontalThumb.releasePointerCapture(e.pointerId);
      delete horizontalThumb.dataset["dragging"];
    }, { signal });

    horizontalThumb.addEventListener("pointercancel", (e: PointerEvent) => {
      horizontalThumb.releasePointerCapture(e.pointerId);
      delete horizontalThumb.dataset["dragging"];
    }, { signal });
  }

  // Store abort controller for cleanup (keyed on the root element itself via closure;
  // the WeakSet prevents rewiring, the AC cleans up listeners when the root is torn down
  // by a morph-remove — the lifecycle bus fires afterCall which may trigger removeAll).
  //
  // The lievit runtime does not currently fire a "destroy" lifecycle hook per-element, so
  // we use MutationObserver on the parent to detect removal (a common pattern for lifecycle).
  // If the root's parent changes and the root is no longer in the document, abort.
  const parentNode = root.parentNode;
  if (parentNode != null) {
    const mo = new MutationObserver(() => {
      if (!root.isConnected) {
        ac.abort();
        mo.disconnect();
      }
    });
    mo.observe(parentNode, { childList: true });
    // If the AbortController is aborted by any other path, also disconnect the MO.
    signal.addEventListener("abort", () => mo.disconnect());
  }
}

// ---------------------------------------------------------------------------
// Scan a component root for scroll-area roots
// ---------------------------------------------------------------------------

function scanRoot(root: Element): void {
  // The root itself may carry the attribute (when the scroll-area IS the component root).
  if ((root as HTMLElement).hasAttribute("data-lievit-scroll-area")) {
    wireRoot(root as HTMLElement);
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-lievit-scroll-area]"))) {
    wireRoot(el);
  }
}

// ---------------------------------------------------------------------------
// Public installer
// ---------------------------------------------------------------------------

/**
 * Installs the scroll-area enhancer on a runtime. Scans every component root for
 * `[data-lievit-scroll-area]` elements (set by scroll-area.jte when overlay=true)
 * on init and after every wire call.
 *
 * Must be registered in `runtime/features/index.ts` by the coordinator.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function
 */
export function installScrollArea(runtime: LievitRuntime): () => void {
  return runtime.use({
    onComponentInit(ctx) {
      scanRoot(ctx.root);
    },
    afterCall(outcome) {
      scanRoot(outcome.root);
    },
  });
}
