/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-scroll-area` -- the overlay-scrollbar behaviour, as a Stimulus controller (the conversion of
 * `runtime/features/scroll-area.enhancer.ts`). Mounted on the scroll-area ROOT via
 * `data-controller="lv-scroll-area"`, which the template stamps ONLY when `overlay=true`
 * (`overlay=false` is a purely static partial: native scrollbar, ZERO JS, no controller).
 *
 * It is the PURELY-CLIENT exemplar: a scroll area never talks to the server (no
 * {@link import("../base/dismissable-controller.js").DismissableController}, no `data-lv-wire-close`,
 * no `callWire`). The controlled/uncontrolled doctrine is honoured by construction -- this surface is
 * UNCONTROLLED, so it makes ZERO `/lievit/<id>/call`; nothing here imports the wire seam.
 *
 * shadcn DOM namespace: every hook is a shadcn `data-slot` attribute (`scroll-area-viewport`,
 * `scroll-area-bar`, `scroll-area-thumb`) reached through Stimulus targets; the runtime state it
 * stamps stays on the established `data-scrolling` / `data-pointer-over` / `data-no-overflow` /
 * `data-dragging` attributes the CSS already speaks. No `data-lv-*` regression.
 *
 * What it does (parity with the old enhancer):
 * - **Thumb sizing**: each rail thumb is sized to the viewport/content ratio (min 20px), kept live
 *   by a {@link ResizeObserver} over the viewport + its children.
 * - **Thumb position + aria-valuenow**: on the viewport `scroll` event the thumb is translated to
 *   the scroll offset and the rail's `aria-valuenow` (0-100) is updated.
 * - **data-scrolling**: set on the root while scrolling, cleared after `data-hide-delay` ms of idle.
 * - **data-pointer-over**: set while the pointer is inside the root (drives the hover policy in CSS).
 * - **data-no-overflow**: set on the root when the (vertical) content does not overflow the viewport.
 * - **Thumb drag**: pointer-drag on a thumb scrolls the viewport (pointer-captured for reliability);
 *   `data-dragging` marks the active thumb.
 *
 * CSP-clean wiring (NOT inline handlers): the `scroll` and thumb `pointer*` events are declared in
 * the template as `data-action` descriptors on the viewport / thumb targets, so Stimulus re-binds
 * them automatically when the wire morph re-renders those descendants. The root's own
 * `pointerenter` / `pointerleave` and the {@link ResizeObserver} are bound in {@link connect} and
 * torn down in {@link disconnect}.
 *
 * Morph-safety: Stimulus connects this controller once per element+identifier and disconnects it on
 * removal, so there is NO `WeakSet`-of-wired-roots, NO `data-*-enhanced` marker, NO `afterCall`
 * teardown sweep, and NO MutationObserver-on-the-parent -- Stimulus owns the lifecycle for free.
 *
 * WCAG / APG source: https://www.w3.org/WAI/ARIA/apg/patterns/scrollbar/
 */

import { Controller } from "@hotwired/stimulus";

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

export default class LvScrollAreaController extends Controller<HTMLElement> {
  static targets = ["viewport", "verticalRail", "verticalThumb", "horizontalRail", "horizontalThumb"];

  declare readonly hasViewportTarget: boolean;
  declare readonly viewportTarget: HTMLElement;
  declare readonly hasVerticalRailTarget: boolean;
  declare readonly verticalRailTarget: HTMLElement;
  declare readonly hasVerticalThumbTarget: boolean;
  declare readonly verticalThumbTarget: HTMLElement;
  declare readonly hasHorizontalRailTarget: boolean;
  declare readonly horizontalRailTarget: HTMLElement;
  declare readonly hasHorizontalThumbTarget: boolean;
  declare readonly horizontalThumbTarget: HTMLElement;

  private resizeObserver: ResizeObserver | null = null;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  // Active-drag state (only one thumb drags at a time).
  private dragAxis: "vertical" | "horizontal" | null = null;
  private dragStart = 0;
  private dragStartScroll = 0;

  // Stable handler identities so connect() / disconnect() add+remove the SAME listener (no leaks).
  private readonly onPointerEnter = (): void => {
    this.element.setAttribute("data-pointer-over", "");
  };
  private readonly onPointerLeave = (): void => {
    this.element.removeAttribute("data-pointer-over");
  };

  connect(): void {
    this.element.addEventListener("pointerenter", this.onPointerEnter);
    this.element.addEventListener("pointerleave", this.onPointerLeave);

    // Initial sync (the rail thumbs are full-size until measured).
    this.syncAll();

    // Keep thumb size/position live as the viewport or its content resizes.
    this.resizeObserver = new ResizeObserver(() => this.syncAll());
    if (this.hasViewportTarget) {
      this.resizeObserver.observe(this.viewportTarget);
      for (const child of Array.from(this.viewportTarget.children)) {
        this.resizeObserver.observe(child);
      }
    }
  }

  disconnect(): void {
    this.element.removeEventListener("pointerenter", this.onPointerEnter);
    this.element.removeEventListener("pointerleave", this.onPointerLeave);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.scrollTimer != null) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }
    this.dragAxis = null;
  }

  // --- scroll ----------------------------------------------------------------------------------

  /** Viewport `scroll`: resync the thumbs, flag `data-scrolling`, schedule the idle clear. */
  scrolled(): void {
    this.syncAll();
    this.element.setAttribute("data-scrolling", "");
    if (this.scrollTimer != null) {
      clearTimeout(this.scrollTimer);
    }
    this.scrollTimer = setTimeout(() => {
      this.element.removeAttribute("data-scrolling");
      this.scrollTimer = null;
    }, this.hideDelay);
  }

  // --- thumb drag (vertical) -------------------------------------------------------------------

  /** Begin a vertical thumb drag: capture the pointer + record the scroll origin. */
  dragStartVertical(e: PointerEvent): void {
    if (!this.hasVerticalThumbTarget || !this.hasViewportTarget) return;
    e.preventDefault();
    this.capture(this.verticalThumbTarget, e.pointerId);
    this.dragAxis = "vertical";
    this.dragStart = e.clientY;
    this.dragStartScroll = this.viewportTarget.scrollTop;
    this.verticalThumbTarget.setAttribute("data-dragging", "");
  }

  /** Translate the active vertical drag into a viewport scrollTop; the scroll event syncs the thumb. */
  dragMoveVertical(e: PointerEvent): void {
    if (this.dragAxis !== "vertical" || !this.hasViewportTarget) return;
    const railH = this.verticalRailTarget.clientHeight;
    const thumbH = this.verticalThumbTarget.offsetHeight;
    const maxTranslate = railH - thumbH;
    if (maxTranslate <= 0) return;
    const dy = e.clientY - this.dragStart;
    const scrollable = this.viewportTarget.scrollHeight - this.viewportTarget.clientHeight;
    this.viewportTarget.scrollTop = this.dragStartScroll + (dy / maxTranslate) * scrollable;
  }

  /** End the vertical drag (pointerup / pointercancel): release capture + clear the marker. */
  dragEndVertical(e: PointerEvent): void {
    if (this.hasVerticalThumbTarget) {
      this.release(this.verticalThumbTarget, e.pointerId);
      this.verticalThumbTarget.removeAttribute("data-dragging");
    }
    this.dragAxis = null;
  }

  // --- thumb drag (horizontal) -----------------------------------------------------------------

  /** Begin a horizontal thumb drag: capture the pointer + record the scroll origin. */
  dragStartHorizontal(e: PointerEvent): void {
    if (!this.hasHorizontalThumbTarget || !this.hasViewportTarget) return;
    e.preventDefault();
    this.capture(this.horizontalThumbTarget, e.pointerId);
    this.dragAxis = "horizontal";
    this.dragStart = e.clientX;
    this.dragStartScroll = this.viewportTarget.scrollLeft;
    this.horizontalThumbTarget.setAttribute("data-dragging", "");
  }

  /** Translate the active horizontal drag into a viewport scrollLeft; the scroll event syncs the thumb. */
  dragMoveHorizontal(e: PointerEvent): void {
    if (this.dragAxis !== "horizontal" || !this.hasViewportTarget) return;
    const railW = this.horizontalRailTarget.clientWidth;
    const thumbW = this.horizontalThumbTarget.offsetWidth;
    const maxTranslate = railW - thumbW;
    if (maxTranslate <= 0) return;
    const dx = e.clientX - this.dragStart;
    const scrollable = this.viewportTarget.scrollWidth - this.viewportTarget.clientWidth;
    this.viewportTarget.scrollLeft = this.dragStartScroll + (dx / maxTranslate) * scrollable;
  }

  /** End the horizontal drag (pointerup / pointercancel): release capture + clear the marker. */
  dragEndHorizontal(e: PointerEvent): void {
    if (this.hasHorizontalThumbTarget) {
      this.release(this.horizontalThumbTarget, e.pointerId);
      this.horizontalThumbTarget.removeAttribute("data-dragging");
    }
    this.dragAxis = null;
  }

  // --- internals -------------------------------------------------------------------------------

  private get hideDelay(): number {
    return parseInt(this.element.dataset["hideDelay"] ?? "1000", 10);
  }

  /** Resync every rail that the server actually rendered (orientation drives which targets exist). */
  private syncAll(): void {
    if (this.hasVerticalRailTarget && this.hasVerticalThumbTarget) this.syncVertical();
    if (this.hasHorizontalRailTarget && this.hasHorizontalThumbTarget) this.syncHorizontal();
  }

  private syncVertical(): void {
    if (!this.hasViewportTarget) return;
    const viewport = this.viewportTarget;
    const rail = this.verticalRailTarget;
    const thumb = this.verticalThumbTarget;

    const railH = rail.clientHeight;
    const contentH = viewport.scrollHeight;
    const viewH = viewport.clientHeight;

    const thumbH = Math.max(20, railH * thumbRatio(viewH, contentH)); // 20px usability floor
    thumb.style.height = `${thumbH}px`;
    thumb.style.flexShrink = "0";

    if (contentH > viewH + 1) {
      this.element.removeAttribute("data-no-overflow");
    } else {
      this.element.setAttribute("data-no-overflow", "");
    }

    const sRatio = scrollRatio(viewport.scrollTop, contentH, viewH);
    thumb.style.transform = `translateY(${(railH - thumbH) * sRatio}px)`;
    rail.setAttribute("aria-valuenow", String(Math.round(sRatio * 100)));
  }

  private syncHorizontal(): void {
    if (!this.hasViewportTarget) return;
    const viewport = this.viewportTarget;
    const rail = this.horizontalRailTarget;
    const thumb = this.horizontalThumbTarget;

    const railW = rail.clientWidth;
    const contentW = viewport.scrollWidth;
    const viewW = viewport.clientWidth;

    const thumbW = Math.max(20, railW * thumbRatio(viewW, contentW));
    thumb.style.width = `${thumbW}px`;
    thumb.style.flexShrink = "0";

    const sRatio = scrollRatio(viewport.scrollLeft, contentW, viewW);
    thumb.style.transform = `translateX(${(railW - thumbW) * sRatio}px)`;
    rail.setAttribute("aria-valuenow", String(Math.round(sRatio * 100)));
  }

  /** Pointer-capture a thumb when the platform supports it (happy-dom/jsdom may not). */
  private capture(el: HTMLElement, pointerId: number): void {
    if (typeof el.setPointerCapture === "function") {
      el.setPointerCapture(pointerId);
    }
  }

  private release(el: HTMLElement, pointerId: number): void {
    if (typeof el.releasePointerCapture === "function") {
      el.releasePointerCapture(pointerId);
    }
  }
}
