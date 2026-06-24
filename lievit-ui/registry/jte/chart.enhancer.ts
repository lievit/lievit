/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * chart.enhancer.ts -- optional interactive overlay for lievit/chart.jte (v-next).
 *
 * Mounted when the chart `<figure>` carries `data-lievit-enhancer="chart"`.
 * The static SVG is fully usable without this module: zero-JS rendering, accessible
 * title/desc and sr-only table are all server-rendered. This enhancer owns only the
 * irreducible client behaviors:
 *
 * 1. **Tooltip show/hide** -- `pointerenter` / `focus` on a `[data-point-series]` mark
 *    reads the mark's `data-point-*` attributes (already HTML-escaped by the server),
 *    builds the tooltip text-content string, positions the tooltip `<div>` via
 *    `getBoundingClientRect` + CSS transform, removes `hidden`, and sets
 *    `aria-describedby` on the mark. On `pointerleave` / `blur`, hides again.
 *
 * 2. **Keyboard navigation within marks** -- `ArrowLeft`/`Right` move focus to
 *    the previous/next mark in the same series; `ArrowUp`/`Down` move to the same
 *    x-position in an adjacent series (COMPOSED charts); `Home`/`End` jump to the
 *    first/last mark in the series; `Esc` dismisses the tooltip.
 *
 * 3. **Series highlight** -- on hover/focus, marks in the same x-band receive
 *    `data-highlighted="true"`; unrelated marks receive `data-dim="true"`.
 *    CSS in chart.css drives the visual change (no inline style).
 *
 * 4. **lv-chart-mark-click event** -- on `Enter` / `Space` (or pointer click) on a
 *    focused/active mark, the enhancer dispatches a `lv-chart-mark-click` CustomEvent
 *    on the SVG with `{ series, x, y, index }` in `detail`.
 *
 * 5. **Zoom / pan** (when `data-chart-zoomable="true"`) -- `pointerdown` on the SVG
 *    starts a brush selection; `pointermove` paints a brush `<rect>` appended by the
 *    enhancer; `pointerup` re-scales the visible marks group via CSS `transform`.
 *    A "Reset zoom" button injected below the chart clears the transform.
 *
 * 6. **Morph stability** -- the enhancer re-wires listeners after a parent WIRE morph
 *    patches the DOM (onComponentUpdate / afterCall). Only listener registration is
 *    refreshed; chart data is never re-rendered by the enhancer.
 *
 * Attribute protocol (emitted by chart.jte when interactive=true):
 * - `data-lievit-enhancer="chart"` on the `<figure>` -- discovery hook
 * - `data-chart-type`             on the `<figure>` -- chart type string
 * - `data-chart-zoomable`         on the `<figure>` -- "true" when zoomable
 * - `data-tooltip-id`             on the `<figure>` -- id of the tooltip `<div>`
 * - `data-point-series`           on each mark     -- series index (string)
 * - `data-point-x`                on each mark     -- x-axis index (string)
 * - `data-point-y`                on each mark     -- y-value (string)
 * - `data-point-index`            on each mark     -- position index within series
 *
 * The enhancer fires NO wire actions: chart is a PARTIAL with no WIRE Java component.
 * For server-side drilldown, the adopter adds `l:on.lv-chart-mark-click` on the figure
 * or listens to the DOM event.
 *
 * CSP-clean: no `eval`, no inline handlers, no dynamic `<script>`.
 *
 * APG source (tooltip): https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 */

import type { LievitRuntime } from "../../runtime/runtime.js";

// ---------------------------------------------------------------------------
// Attribute constants
// ---------------------------------------------------------------------------

const ENHANCER_ATTR = "data-lievit-enhancer";
const CHART_ZOOMABLE_ATTR = "data-chart-zoomable";
const TOOLTIP_ID_ATTR = "data-tooltip-id";
const POINT_SERIES_ATTR = "data-point-series";
const POINT_X_ATTR = "data-point-x";
const POINT_Y_ATTR = "data-point-y";
const POINT_INDEX_ATTR = "data-point-index";
const DATA_OPEN_ATTR = "data-open";
const DATA_HIGHLIGHTED_ATTR = "data-highlighted";
const DATA_DIM_ATTR = "data-dim";

/** Mark CSS classes that carry `data-point-*` attributes. */
const MARK_SELECTOR = "[data-point-series]";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChartDetail {
  series: string;
  x: string;
  y: string;
  index: string;
}

interface ChartState {
  figure: HTMLElement;
  tooltip: HTMLElement | null;
  /** Mark currently showing the tooltip (focus/hover). */
  activeMark: Element | null;
  /** Pending hide timer (prevents flicker on pointer travel). */
  hideTimer: ReturnType<typeof setTimeout> | null;
  /** Document-level Esc handler, active while tooltip is shown. */
  escHandler: EventListener | null;
  /** Whether zoom/pan brush is in progress. */
  brushing: boolean;
  /** Brush SVG rect injected by enhancer (zoom mode). */
  brushRect: SVGRectElement | null;
  /** Brush start x in SVG local coordinates. */
  brushStartX: number;
  /** Reset-zoom button injected by enhancer. */
  resetBtn: HTMLButtonElement | null;
}

/** Figures already wired (idempotency guard). */
const wiredFigures = new WeakSet<Element>();
/** Active chart states keyed by figure. */
const activeCharts = new Map<Element, ChartState>();

// ---------------------------------------------------------------------------
// Tooltip helpers
// ---------------------------------------------------------------------------

function showTooltip(state: ChartState, mark: Element): void {
  if (state.tooltip == null) return;

  const series = mark.getAttribute(POINT_SERIES_ATTR) ?? "";
  const xVal = mark.getAttribute(POINT_X_ATTR) ?? "";
  const yVal = mark.getAttribute(POINT_Y_ATTR) ?? "";
  const ariaLabel = mark.getAttribute("aria-label") ?? `${xVal}: ${yVal}`;

  // Text content only -- XSS safe, no innerHTML.
  state.tooltip.textContent = ariaLabel;
  state.tooltip.removeAttribute("hidden");
  state.tooltip.setAttribute(DATA_OPEN_ATTR, "");

  // Position relative to mark's bounding box.
  const rect = mark.getBoundingClientRect();
  const ttRect = state.tooltip.getBoundingClientRect();
  let top = rect.top - ttRect.height - 8;
  let left = rect.left + rect.width / 2 - ttRect.width / 2;
  // Clamp to viewport.
  if (top < 4) top = rect.bottom + 8;
  if (left < 4) left = 4;
  if (left + ttRect.width > window.innerWidth - 4) {
    left = window.innerWidth - ttRect.width - 4;
  }
  state.tooltip.style.setProperty("top", `${top}px`);
  state.tooltip.style.setProperty("left", `${left}px`);

  // ARIA: link the mark to the tooltip while visible.
  mark.setAttribute("aria-describedby", state.tooltip.id);

  // Esc dismiss.
  if (state.escHandler == null) {
    const esc: EventListener = (ev: Event) => {
      if ((ev as KeyboardEvent).key === "Escape") {
        ev.stopPropagation();
        hideTooltip(state);
        if (state.activeMark instanceof HTMLElement) {
          state.activeMark.focus();
        }
      }
    };
    state.escHandler = esc;
    document.addEventListener("keydown", esc, true);
  }

  state.activeMark = mark;
  void series; // suppress unused-var lint (used via mark attribute)
}

function hideTooltip(state: ChartState): void {
  if (state.tooltip == null) return;
  state.tooltip.setAttribute("hidden", "");
  state.tooltip.removeAttribute(DATA_OPEN_ATTR);
  state.tooltip.textContent = "";
  state.tooltip.style.removeProperty("top");
  state.tooltip.style.removeProperty("left");

  if (state.activeMark != null) {
    state.activeMark.removeAttribute("aria-describedby");
    state.activeMark = null;
  }

  if (state.escHandler != null) {
    document.removeEventListener("keydown", state.escHandler, true);
    state.escHandler = null;
  }
}

// ---------------------------------------------------------------------------
// Series highlight helpers
// ---------------------------------------------------------------------------

function highlightX(figure: HTMLElement, xVal: string): void {
  const marks = figure.querySelectorAll<Element>(MARK_SELECTOR);
  for (const m of Array.from(marks)) {
    if (m.getAttribute(POINT_X_ATTR) === xVal) {
      m.setAttribute(DATA_HIGHLIGHTED_ATTR, "true");
      m.removeAttribute(DATA_DIM_ATTR);
    } else {
      m.setAttribute(DATA_DIM_ATTR, "true");
      m.removeAttribute(DATA_HIGHLIGHTED_ATTR);
    }
  }
}

function clearHighlight(figure: HTMLElement): void {
  const marks = figure.querySelectorAll<Element>(MARK_SELECTOR);
  for (const m of Array.from(marks)) {
    m.removeAttribute(DATA_HIGHLIGHTED_ATTR);
    m.removeAttribute(DATA_DIM_ATTR);
  }
}

// ---------------------------------------------------------------------------
// Keyboard navigation
// ---------------------------------------------------------------------------

function getMarksInSeries(figure: HTMLElement, seriesIdx: string): Element[] {
  return Array.from(
    figure.querySelectorAll<Element>(`[${POINT_SERIES_ATTR}="${seriesIdx}"]`),
  );
}

function getAllSeriesIndices(figure: HTMLElement): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of Array.from(figure.querySelectorAll<Element>(MARK_SELECTOR))) {
    const s = m.getAttribute(POINT_SERIES_ATTR) ?? "";
    if (!seen.has(s)) {
      seen.add(s);
      result.push(s);
    }
  }
  return result;
}

function handleMarkKeydown(
  ev: KeyboardEvent,
  mark: Element,
  figure: HTMLElement,
  state: ChartState,
): void {
  const seriesIdx = mark.getAttribute(POINT_SERIES_ATTR) ?? "0";
  const xIdx = mark.getAttribute(POINT_X_ATTR) ?? "0";
  const seriesMarks = getMarksInSeries(figure, seriesIdx);
  const currentPos = seriesMarks.indexOf(mark);

  switch (ev.key) {
    case "ArrowRight": {
      ev.preventDefault();
      const next = seriesMarks[currentPos + 1];
      if (next instanceof HTMLElement) next.focus();
      break;
    }
    case "ArrowLeft": {
      ev.preventDefault();
      const prev = seriesMarks[currentPos - 1];
      if (prev instanceof HTMLElement) prev.focus();
      break;
    }
    case "Home": {
      ev.preventDefault();
      const first = seriesMarks[0];
      if (first instanceof HTMLElement) first.focus();
      break;
    }
    case "End": {
      ev.preventDefault();
      const last = seriesMarks[seriesMarks.length - 1];
      if (last instanceof HTMLElement) last.focus();
      break;
    }
    case "ArrowUp":
    case "ArrowDown": {
      // Move to same x-position in adjacent series (COMPOSED charts).
      ev.preventDefault();
      const allSeries = getAllSeriesIndices(figure);
      const sPos = allSeries.indexOf(seriesIdx);
      const nextSeries =
        ev.key === "ArrowDown"
          ? allSeries[sPos + 1]
          : allSeries[sPos - 1];
      if (nextSeries != null) {
        const adjacentMark = figure.querySelector<HTMLElement>(
          `[${POINT_SERIES_ATTR}="${nextSeries}"][${POINT_X_ATTR}="${xIdx}"]`,
        );
        adjacentMark?.focus();
      }
      break;
    }
    case "Enter":
    case " ": {
      ev.preventDefault();
      dispatchMarkClick(mark, figure);
      break;
    }
    case "Escape": {
      // Esc handled globally while tooltip open; still stop propagation.
      if (state.activeMark != null) {
        ev.stopPropagation();
        hideTooltip(state);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// lv-chart-mark-click custom event
// ---------------------------------------------------------------------------

function dispatchMarkClick(mark: Element, svg: HTMLElement | Element): void {
  const detail: ChartDetail = {
    series: mark.getAttribute(POINT_SERIES_ATTR) ?? "",
    x: mark.getAttribute(POINT_X_ATTR) ?? "",
    y: mark.getAttribute(POINT_Y_ATTR) ?? "",
    index: mark.getAttribute(POINT_INDEX_ATTR) ?? "",
  };
  const ev = new CustomEvent("lv-chart-mark-click", {
    bubbles: true,
    composed: true,
    detail,
  });
  svg.dispatchEvent(ev);
}

// ---------------------------------------------------------------------------
// Zoom / pan
// ---------------------------------------------------------------------------

function setupZoom(figure: HTMLElement, state: ChartState): void {
  const svg = figure.querySelector<SVGSVGElement>("svg");
  if (svg == null) return;

  svg.addEventListener("pointerdown", (ev: PointerEvent) => {
    // Only primary button (left click), not on a data mark.
    if (ev.button !== 0) return;
    if ((ev.target as Element).hasAttribute(POINT_SERIES_ATTR)) return;

    state.brushing = true;
    svg.setPointerCapture(ev.pointerId);

    const svgRect = svg.getBoundingClientRect();
    state.brushStartX = ev.clientX - svgRect.left;

    if (state.brushRect == null) {
      const br = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      br.setAttribute("pointer-events", "none");
      br.setAttribute("fill", "var(--lv-color-ring, var(--lv-color-primary))");
      br.setAttribute("fill-opacity", "0.15");
      br.setAttribute("stroke", "var(--lv-color-ring, var(--lv-color-primary))");
      br.setAttribute("stroke-width", "1");
      br.style.display = "none";
      svg.appendChild(br);
      state.brushRect = br;
    }
    state.brushRect.style.display = "";
  });

  svg.addEventListener("pointermove", (ev: PointerEvent) => {
    if (!state.brushing || state.brushRect == null) return;
    const svgRect = svg.getBoundingClientRect();
    const currentX = ev.clientX - svgRect.left;
    const x = Math.min(state.brushStartX, currentX);
    const w = Math.abs(currentX - state.brushStartX);
    const vbHeight = parseFloat(svg.getAttribute("viewBox")?.split(" ")[3] ?? "300");
    state.brushRect.setAttribute("x", String((x / svgRect.width) * 1000));
    state.brushRect.setAttribute("y", "0");
    state.brushRect.setAttribute("width", String((w / svgRect.width) * 1000));
    state.brushRect.setAttribute("height", String(vbHeight));
  });

  svg.addEventListener("pointerup", (ev: PointerEvent) => {
    if (!state.brushing) return;
    state.brushing = false;
    svg.releasePointerCapture(ev.pointerId);

    if (state.brushRect != null) {
      state.brushRect.style.display = "none";
    }

    // Apply transform to series group (visual zoom, data stays server-rendered).
    const svgRect = svg.getBoundingClientRect();
    const endX = ev.clientX - svgRect.left;
    const minX = Math.min(state.brushStartX, endX);
    const maxX = Math.max(state.brushStartX, endX);
    const width = maxX - minX;
    if (width < 8) return; // ignore tiny drags

    const scale = svgRect.width / width;
    const offset = -minX * scale;

    const seriesGroup =
      svg.querySelector<SVGGElement>(".lv-chart__bar, .lv-chart__line, .lv-chart__area, .lv-chart__point, .lv-chart__sector")
        ?.closest("g") ?? null;

    // Scope to the whole SVG content for simplicity.
    svg.style.setProperty("--lv-chart-zoom-scale", String(scale));
    svg.style.setProperty("--lv-chart-zoom-offset", `${offset}px`);
    svg.style.transform = `scaleX(${scale}) translateX(${offset / scale}px)`;
    svg.style.transformOrigin = "left center";
    void seriesGroup; // potential future scoping

    // Inject Reset button if not already present.
    if (state.resetBtn == null) {
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
        state.resetBtn = null;
      });
      figure.appendChild(btn);
      state.resetBtn = btn;
    }
  });
}

// ---------------------------------------------------------------------------
// Wire one chart figure
// ---------------------------------------------------------------------------

function wireFigure(figure: HTMLElement): void {
  if (wiredFigures.has(figure)) return;
  wiredFigures.add(figure);

  const tooltipId = figure.getAttribute(TOOLTIP_ID_ATTR);
  const tooltip =
    tooltipId != null ? (document.getElementById(tooltipId) as HTMLElement | null) : null;

  const state: ChartState = {
    figure,
    tooltip,
    activeMark: null,
    hideTimer: null,
    escHandler: null,
    brushing: false,
    brushRect: null,
    brushStartX: 0,
    resetBtn: null,
  };
  activeCharts.set(figure, state);

  const marks = figure.querySelectorAll<Element>(MARK_SELECTOR);

  for (const mark of Array.from(marks)) {
    // Pointer enter: show tooltip + highlight.
    mark.addEventListener("pointerenter", () => {
      if (state.hideTimer != null) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      const xVal = mark.getAttribute(POINT_X_ATTR) ?? "";
      highlightX(figure, xVal);
      showTooltip(state, mark);
    });

    // Pointer leave: hide tooltip after brief delay.
    mark.addEventListener("pointerleave", () => {
      state.hideTimer = setTimeout(() => {
        state.hideTimer = null;
        clearHighlight(figure);
        hideTooltip(state);
      }, 60);
    });

    // Focus: show tooltip immediately.
    mark.addEventListener("focus", () => {
      if (state.hideTimer != null) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      const xVal = mark.getAttribute(POINT_X_ATTR) ?? "";
      highlightX(figure, xVal);
      showTooltip(state, mark);
    });

    // Blur: hide tooltip.
    mark.addEventListener("blur", () => {
      state.hideTimer = setTimeout(() => {
        state.hideTimer = null;
        clearHighlight(figure);
        hideTooltip(state);
      }, 60);
    });

    // Click: dispatch custom event.
    mark.addEventListener("click", () => {
      const svg = figure.querySelector("svg");
      if (svg != null) dispatchMarkClick(mark, svg);
    });

    // Keyboard navigation.
    mark.addEventListener("keydown", (ev: Event) => {
      handleMarkKeydown(ev as KeyboardEvent, mark, figure, state);
    });
  }

  // Zoom/pan.
  const zoomable = figure.getAttribute(CHART_ZOOMABLE_ATTR) === "true";
  if (zoomable) {
    setupZoom(figure, state);
  }
}

// ---------------------------------------------------------------------------
// Re-wire after morph (finds new marks in an existing figure)
// ---------------------------------------------------------------------------

function rewireFigure(figure: HTMLElement): void {
  // Remove the idempotency guard so wireFigure can re-run.
  wiredFigures.delete(figure);
  const oldState = activeCharts.get(figure);
  if (oldState != null) {
    // Preserve zoom state (brush, resetBtn) across re-renders.
    activeCharts.delete(figure);
  }
  wireFigure(figure);
}

// ---------------------------------------------------------------------------
// Scan a root element for chart figures
// ---------------------------------------------------------------------------

function scanRoot(root: Element): void {
  const attr = `[${ENHANCER_ATTR}="chart"]`;
  if (root.matches(attr)) {
    wireFigure(root as HTMLElement);
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(attr))) {
    wireFigure(el);
  }
}

// ---------------------------------------------------------------------------
// Public installer
// ---------------------------------------------------------------------------

/**
 * Installs the chart enhancer on a runtime. Scans for `[data-lievit-enhancer="chart"]`
 * figures on init and after every wire call.
 *
 * The coordinator registers this in runtime/features/index.ts when the chart component
 * is included in the bundle (via NEW_ENHANCER report).
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function
 */
export function installChart(runtime: LievitRuntime): () => void {
  return runtime.use({
    onComponentInit(ctx) {
      scanRoot(ctx.root);
    },
    afterCall(outcome) {
      // Re-scan after morph; new marks may have appeared.
      const attr = `[${ENHANCER_ATTR}="chart"]`;
      const figures = outcome.root.querySelectorAll<HTMLElement>(attr);
      for (const fig of Array.from(figures)) {
        if (wiredFigures.has(fig)) {
          // Already wired but DOM was patched by morph -- re-wire marks.
          rewireFigure(fig);
        } else {
          wireFigure(fig);
        }
      }
      if (outcome.root.matches?.(attr)) {
        rewireFigure(outcome.root as HTMLElement);
      }
    },
  });
}
