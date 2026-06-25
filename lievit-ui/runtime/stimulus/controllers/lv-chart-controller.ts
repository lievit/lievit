/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-chart` -- the interactive overlay for `lievit/chart.jte`, as a Stimulus controller (the
 * conversion of the colocated `registry/jte/chart.enhancer.ts`). Mounted ON THE `<figure>` via
 * `data-controller="lv-chart"` when the partial is rendered with `interactive=true`. The SVG, the
 * accessible `<title>`/`<desc>`, the sr-only `<table>` and every `data-point-*` mark are all
 * server-rendered HTML; this controller owns only the irreducible client behaviours:
 *
 * 1. **tooltip** show/hide on a mark's `pointerenter`/`focus` (hide on `pointerleave`/`blur`, with a
 *    short anti-flicker delay). Text-content only (XSS-safe), positioned over the mark.
 * 2. **series highlight** -- marks at the same `data-point-x` get `data-highlighted`, the rest
 *    `data-dim` (chart.css drives the visual; no inline style beyond the tooltip position).
 * 3. **keyboard navigation** within marks -- Arrow keys move focus along a series / across series,
 *    Home/End jump to the ends, Enter/Space activate, Escape dismisses the tooltip.
 * 4. **lv-chart-mark-click** -- a DOM `CustomEvent` dispatched on the SVG on click / Enter / Space.
 * 5. **zoom / pan** (only when `data-chart-zoomable="true"`) -- a brush selection on the SVG that
 *    re-scales the marks group via CSS transform, plus an injected "Reset zoom" button.
 *
 * UNCONTROLLED by doctrine: a chart is a PARTIAL with NO wire Java component, so it NEVER fires a
 * wire `/lievit/<id>/call`. That is why this extends the plain Stimulus {@link Controller} (not
 * {@link DismissableController}): there is no `data-lv-wire-close`, no `dismissViaWire`, zero
 * round-trip. `lv-chart-mark-click` is a client DOM event the adopter listens to (`l:on.*`), not a
 * wire call. The controlled/uncontrolled doctrine for chart is exactly "always uncontrolled".
 *
 * Morph-safety is FREE: every mark/SVG listener is declared in the template as `data-action`, so
 * Stimulus's action observer re-binds the re-rendered descendants after a wire morph + idiomorph
 * with no `WeakSet`-of-wired-figures and no `afterCall` re-wire sweep (the enhancer's
 * `rewireFigure`). The single document-level Escape listener is the one thing `data-action` cannot
 * express (a global key chord does not fire reliably as `keydown@document` in the test substrate),
 * so it is bound in `connect()` and removed in `disconnect()`.
 *
 * a11y source (tooltip): https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 */

import { Controller } from "@hotwired/stimulus";

const POINT_SERIES_ATTR = "data-point-series";
const POINT_X_ATTR = "data-point-x";
const POINT_Y_ATTR = "data-point-y";
const POINT_INDEX_ATTR = "data-point-index";
const DATA_OPEN_ATTR = "data-open";
const DATA_HIGHLIGHTED_ATTR = "data-highlighted";
const DATA_DIM_ATTR = "data-dim";

/** Marks carry `data-point-series`; this selects every interactive datum in the figure. */
const MARK_SELECTOR = "[data-point-series]";

/** The shape carried in `lv-chart-mark-click`'s `detail`. */
interface ChartMarkDetail {
  readonly series: string;
  readonly x: string;
  readonly y: string;
  readonly index: string;
}

export default class LvChartController extends Controller<HTMLElement> {
  static targets = ["tooltip"];

  declare readonly hasTooltipTarget: boolean;
  declare readonly tooltipTarget: HTMLElement;

  /** The mark currently showing the tooltip (focus/hover), for Esc-return-focus + aria cleanup. */
  private activeMark: Element | null = null;
  /** Pending hide timer (prevents flicker as the pointer travels between a mark and the tooltip). */
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether a zoom/pan brush gesture is in progress. */
  private brushing = false;
  /** The brush rect injected into the SVG while zooming. */
  private brushRect: SVGRectElement | null = null;
  /** Brush start x in SVG-local pixels. */
  private brushStartX = 0;
  /** The injected "Reset zoom" button, while a zoom transform is applied. */
  private resetBtn: HTMLButtonElement | null = null;

  /** Document-level Escape handler (global shortcut), bound only while connected. */
  private readonly onDocKeydown = (e: KeyboardEvent): void => this.handleDocKeydown(e);

  connect(): void {
    // The Esc-dismiss for a HOVER-shown tooltip (no focused mark to receive a markKeydown). When a
    // mark IS focused, its own markKeydown handles Esc first and stops propagation, so this stays a
    // no-op; either way the tooltip closes once.
    document.addEventListener("keydown", this.onDocKeydown);
  }

  disconnect(): void {
    document.removeEventListener("keydown", this.onDocKeydown);
    if (this.hideTimer != null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.activeMark = null;
    this.brushing = false;
    this.brushRect = null;
    this.resetBtn = null;
  }

  // --- mark interaction (wired via data-action in chart.jte) -------------------------------------

  /** `pointerenter` / `focus` on a mark: highlight its x-band and show the tooltip immediately. */
  markActivate(e: Event): void {
    const mark = e.currentTarget as Element;
    if (this.hideTimer != null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.highlightX(mark.getAttribute(POINT_X_ATTR) ?? "");
    this.showTooltip(mark);
  }

  /** `pointerleave` / `blur`: hide the tooltip + clear the highlight after a short anti-flicker delay. */
  markDeactivate(): void {
    if (this.hideTimer != null) {
      clearTimeout(this.hideTimer);
    }
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.clearHighlight();
      this.hideTooltip();
    }, 60);
  }

  /** `click` on a mark: dispatch the `lv-chart-mark-click` DOM event (no wire call). */
  markClick(e: Event): void {
    this.dispatchMarkClick(e.currentTarget as Element);
  }

  /** `keydown` on a mark: Arrow/Home/End navigation, Enter/Space activate, Escape dismiss. */
  markKeydown(e: KeyboardEvent): void {
    const mark = e.currentTarget as Element;
    const seriesIdx = mark.getAttribute(POINT_SERIES_ATTR) ?? "0";
    const xIdx = mark.getAttribute(POINT_X_ATTR) ?? "0";
    const seriesMarks = this.marksInSeries(seriesIdx);
    const pos = seriesMarks.indexOf(mark);

    switch (e.key) {
      case "ArrowRight": {
        e.preventDefault();
        this.focusEl(seriesMarks[pos + 1]);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        this.focusEl(seriesMarks[pos - 1]);
        break;
      }
      case "Home": {
        e.preventDefault();
        this.focusEl(seriesMarks[0]);
        break;
      }
      case "End": {
        e.preventDefault();
        this.focusEl(seriesMarks[seriesMarks.length - 1]);
        break;
      }
      case "ArrowUp":
      case "ArrowDown": {
        // Move to the same x-position in an adjacent series (COMPOSED charts).
        e.preventDefault();
        const allSeries = this.allSeriesIndices();
        const sPos = allSeries.indexOf(seriesIdx);
        const nextSeries = e.key === "ArrowDown" ? allSeries[sPos + 1] : allSeries[sPos - 1];
        if (nextSeries != null) {
          this.focusEl(
            this.element.querySelector(
              `[${POINT_SERIES_ATTR}="${nextSeries}"][${POINT_X_ATTR}="${xIdx}"]`,
            ),
          );
        }
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        this.dispatchMarkClick(mark);
        break;
      }
      case "Escape": {
        if (this.activeMark != null) {
          e.stopPropagation();
          this.hideTooltip();
        }
        break;
      }
    }
  }

  // --- zoom / pan (wired via data-action on the SVG only when zoomable) --------------------------

  /** `pointerdown` on the SVG (not on a mark): begin a brush selection. */
  brushStart(e: PointerEvent): void {
    if (e.button !== 0) {
      return;
    }
    if ((e.target as Element).hasAttribute(POINT_SERIES_ATTR)) {
      return;
    }
    const svg = e.currentTarget as SVGSVGElement;
    this.brushing = true;
    svg.setPointerCapture?.(e.pointerId);

    const svgRect = svg.getBoundingClientRect();
    this.brushStartX = e.clientX - svgRect.left;

    // The injected rect is wiped by idiomorph (it is not in the server HTML), so recreate it if a
    // morph detached the previous one.
    if (this.brushRect == null || !svg.contains(this.brushRect)) {
      const br = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      br.setAttribute("pointer-events", "none");
      br.setAttribute("fill", "var(--lv-color-ring, var(--lv-color-primary))");
      br.setAttribute("fill-opacity", "0.15");
      br.setAttribute("stroke", "var(--lv-color-ring, var(--lv-color-primary))");
      br.setAttribute("stroke-width", "1");
      br.style.display = "none";
      svg.appendChild(br);
      this.brushRect = br;
    }
    this.brushRect.style.display = "";
  }

  /** `pointermove` on the SVG: paint the brush rect while brushing. */
  brushMove(e: PointerEvent): void {
    if (!this.brushing || this.brushRect == null) {
      return;
    }
    const svg = e.currentTarget as SVGSVGElement;
    const svgRect = svg.getBoundingClientRect();
    const currentX = e.clientX - svgRect.left;
    const x = Math.min(this.brushStartX, currentX);
    const w = Math.abs(currentX - this.brushStartX);
    const vbHeight = parseFloat(svg.getAttribute("viewBox")?.split(" ")[3] ?? "300");
    const localW = svgRect.width > 0 ? svgRect.width : 1;
    this.brushRect.setAttribute("x", String((x / localW) * 1000));
    this.brushRect.setAttribute("y", "0");
    this.brushRect.setAttribute("width", String((w / localW) * 1000));
    this.brushRect.setAttribute("height", String(vbHeight));
  }

  /** `pointerup` on the SVG: end the brush and apply the zoom transform + inject the Reset button. */
  brushEnd(e: PointerEvent): void {
    if (!this.brushing) {
      return;
    }
    this.brushing = false;
    const svg = e.currentTarget as SVGSVGElement;
    svg.releasePointerCapture?.(e.pointerId);

    if (this.brushRect != null) {
      this.brushRect.style.display = "none";
    }

    const svgRect = svg.getBoundingClientRect();
    const endX = e.clientX - svgRect.left;
    const minX = Math.min(this.brushStartX, endX);
    const maxX = Math.max(this.brushStartX, endX);
    const width = maxX - minX;
    if (width < 8) {
      return; // ignore tiny drags
    }

    const localW = svgRect.width > 0 ? svgRect.width : 1;
    const scale = localW / width;
    const offset = -minX * scale;
    svg.style.setProperty("--lv-chart-zoom-scale", String(scale));
    svg.style.setProperty("--lv-chart-zoom-offset", `${offset}px`);
    svg.style.transform = `scaleX(${scale}) translateX(${offset / scale}px)`;
    svg.style.transformOrigin = "left center";

    this.injectResetButton(svg);
  }

  // --- internals --------------------------------------------------------------------------------

  private get tooltip(): HTMLElement | null {
    return this.hasTooltipTarget ? this.tooltipTarget : null;
  }

  private showTooltip(mark: Element): void {
    const tooltip = this.tooltip;
    if (tooltip == null) {
      return;
    }
    const xVal = mark.getAttribute(POINT_X_ATTR) ?? "";
    const yVal = mark.getAttribute(POINT_Y_ATTR) ?? "";
    const ariaLabel = mark.getAttribute("aria-label") ?? `${xVal}: ${yVal}`;

    // Text content only -- XSS-safe, never innerHTML.
    tooltip.textContent = ariaLabel;
    tooltip.removeAttribute("hidden");
    tooltip.setAttribute(DATA_OPEN_ATTR, "");

    // Position over the mark's bounding box, clamped to the viewport.
    const rect = mark.getBoundingClientRect();
    const ttRect = tooltip.getBoundingClientRect();
    let top = rect.top - ttRect.height - 8;
    let left = rect.left + rect.width / 2 - ttRect.width / 2;
    if (top < 4) {
      top = rect.bottom + 8;
    }
    if (left < 4) {
      left = 4;
    }
    if (left + ttRect.width > window.innerWidth - 4) {
      left = window.innerWidth - ttRect.width - 4;
    }
    tooltip.style.setProperty("top", `${top}px`);
    tooltip.style.setProperty("left", `${left}px`);

    // Link the mark to the tooltip while it is visible.
    mark.setAttribute("aria-describedby", tooltip.id);
    this.activeMark = mark;
  }

  private hideTooltip(): void {
    const tooltip = this.tooltip;
    if (tooltip == null) {
      return;
    }
    tooltip.setAttribute("hidden", "");
    tooltip.removeAttribute(DATA_OPEN_ATTR);
    tooltip.textContent = "";
    tooltip.style.removeProperty("top");
    tooltip.style.removeProperty("left");

    if (this.activeMark != null) {
      this.activeMark.removeAttribute("aria-describedby");
      this.activeMark = null;
    }
  }

  private handleDocKeydown(e: KeyboardEvent): void {
    if (e.key !== "Escape" || this.activeMark == null) {
      return;
    }
    // APG tooltip: Escape dismisses the tooltip; focus is left untouched. Moving focus back onto the
    // mark would re-fire its show-on-focus path and immediately re-open the tooltip; the keyboard
    // case already holds focus on the mark, so nothing more is needed.
    this.hideTooltip();
  }

  private highlightX(xVal: string): void {
    for (const m of this.marks()) {
      if (m.getAttribute(POINT_X_ATTR) === xVal) {
        m.setAttribute(DATA_HIGHLIGHTED_ATTR, "true");
        m.removeAttribute(DATA_DIM_ATTR);
      } else {
        m.setAttribute(DATA_DIM_ATTR, "true");
        m.removeAttribute(DATA_HIGHLIGHTED_ATTR);
      }
    }
  }

  private clearHighlight(): void {
    for (const m of this.marks()) {
      m.removeAttribute(DATA_HIGHLIGHTED_ATTR);
      m.removeAttribute(DATA_DIM_ATTR);
    }
  }

  private dispatchMarkClick(mark: Element): void {
    const detail: ChartMarkDetail = {
      series: mark.getAttribute(POINT_SERIES_ATTR) ?? "",
      x: mark.getAttribute(POINT_X_ATTR) ?? "",
      y: mark.getAttribute(POINT_Y_ATTR) ?? "",
      index: mark.getAttribute(POINT_INDEX_ATTR) ?? "",
    };
    const svg = this.element.querySelector("svg") ?? this.element;
    svg.dispatchEvent(
      new CustomEvent<ChartMarkDetail>("lv-chart-mark-click", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  private injectResetButton(svg: SVGSVGElement): void {
    if (this.resetBtn != null && this.element.contains(this.resetBtn)) {
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Reset zoom";
    btn.className =
      "lv-chart__zoom-reset mt-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)] underline underline-offset-4 hover:text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]";
    btn.addEventListener("click", () => {
      svg.style.removeProperty("transform");
      svg.style.removeProperty("transform-origin");
      svg.style.removeProperty("--lv-chart-zoom-scale");
      svg.style.removeProperty("--lv-chart-zoom-offset");
      btn.remove();
      this.resetBtn = null;
    });
    this.element.appendChild(btn);
    this.resetBtn = btn;
  }

  /** Focus an element if it exists and is focusable (works for both SVG and HTML marks). */
  private focusEl(el: Element | null | undefined): void {
    if (el != null && typeof (el as HTMLElement).focus === "function") {
      (el as HTMLElement).focus();
    }
  }

  private marks(): Element[] {
    return Array.from(this.element.querySelectorAll(MARK_SELECTOR));
  }

  private marksInSeries(seriesIdx: string): Element[] {
    return Array.from(
      this.element.querySelectorAll(`[${POINT_SERIES_ATTR}="${seriesIdx}"]`),
    );
  }

  private allSeriesIndices(): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const m of this.marks()) {
      const s = m.getAttribute(POINT_SERIES_ATTR) ?? "";
      if (!seen.has(s)) {
        seen.add(s);
        result.push(s);
      }
    }
    return result;
  }
}
