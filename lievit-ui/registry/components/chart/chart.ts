/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/** A named data series. Values align positionally with `categories`. */
export interface ChartSeries {
  /** Series key (used for the tooltip + legend + accessible label). */
  key: string;
  /** Display label; falls back to `key`. */
  label?: string;
  /** Numeric values, one per category. */
  data: number[];
  /** Explicit colour; defaults to the next `--lv-color-chart-N` token. */
  color?: string;
}

/**
 * `<lv-chart>`: a small, token-driven charting wrapper rendering NATIVE inline SVG.
 *
 * SCIENTIFIC DECISION (auto-deduced, plan's rule): native inline SVG beats bundling a chart
 * library (Recharts/Chart.js) on every non-debatable criterion for a light-DOM island.
 * (1) a11y: one `role="img"`+`aria-label` plus a visually-hidden <table> gives screen readers
 * the real data, which canvas charts cannot; (2) customisability: the `--lv-color-chart-1..5`
 * tokens + currentColor cascade straight into the SVG; (3) bundle: zero heavy dep, only lit,
 * fully tree-shakeable; (4) SSR-friendly: SVG is declarative markup, no canvas/ResizeObserver
 * boot. So the wrapper owns a viewBox-scaled SVG (responsive without measuring the DOM) and a
 * token-styled tooltip on hover/focus.
 *
 * Variants via `type`: "bar" | "line" | "area". Data down, events up: emits `lv-point` with
 * { series, category, value, index } on hover/focus of a point.
 *
 * CSP-safe, dependency-free (only lit). Owned source, copied in by `lievit add chart`.
 * Light-DOM rendered so Tailwind + `--lv-*` tokens cascade in.
 */
@customElement("lv-chart")
export class LvChart extends LitElement {
  /** Chart kind. */
  @property() type: "bar" | "line" | "area" = "bar";

  /** Category (x-axis) labels. */
  @property({ type: Array }) categories: string[] = [];

  /** One or more data series. */
  @property({ type: Array }) series: ChartSeries[] = [];

  /** Accessible name for the chart (role="img"). */
  @property() label = "Chart";

  /** Show the category axis labels under the plot. */
  @property({ type: Boolean, attribute: "show-axis" }) showAxis = true;

  /** Show the series legend above the plot. */
  @property({ type: Boolean }) legend = true;

  /** SVG viewBox width (the plot scales responsively to its container width). */
  @property({ type: Number }) width = 600;

  /** SVG viewBox height. */
  @property({ type: Number }) height = 300;

  @state() private hover: { si: number; ci: number } | null = null;

  // inner plot padding inside the viewBox
  private readonly pad = { top: 12, right: 12, bottom: 28, left: 36 };

  createRenderRoot(): this {
    adoptLightStyles("lv-chart", LvChart.css);
    return this;
  }

  static readonly css = `
    .lv-chart { position: relative; display: block; font-family: var(--lv-font-sans); color: var(--lv-color-fg); }
    .lv-chart__legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--lv-space-3);
      margin-bottom: var(--lv-space-2);
      font-size: var(--lv-text-xs);
    }
    .lv-chart__legend-item { display: inline-flex; align-items: center; gap: var(--lv-space-1); }
    .lv-chart__swatch { width: 0.7rem; height: 0.7rem; border-radius: var(--lv-radius-sm); flex-shrink: 0; }
    .lv-chart__svg { width: 100%; height: auto; display: block; overflow: visible; }
    .lv-chart__grid { stroke: var(--lv-color-border); stroke-width: 1; }
    .lv-chart__axis-label { fill: var(--lv-color-muted); font-size: 11px; }
    .lv-chart__bar { transition: opacity 0.12s ease; }
    .lv-chart__bar:focus-visible { outline: none; }
    .lv-chart__bar--dim { opacity: 0.45; }
    .lv-chart__dot { transition: r 0.12s ease; cursor: pointer; }
    .lv-chart__dot:focus-visible { outline: none; }
    .lv-chart__hit:focus-visible { outline: none; }
    .lv-chart__hit:focus-visible + .lv-chart__dot,
    .lv-chart__bar:focus-visible { box-shadow: var(--lv-ring); }
    .lv-chart__tooltip {
      position: absolute;
      z-index: 10;
      pointer-events: none;
      transform: translate(-50%, -120%);
      background: var(--lv-color-bg);
      color: var(--lv-color-fg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      padding: var(--lv-space-1) var(--lv-space-2);
      font-size: var(--lv-text-xs);
      white-space: nowrap;
    }
    .lv-chart__tooltip-row { display: flex; align-items: center; gap: var(--lv-space-1); }
    .lv-chart__tooltip-cat { font-weight: 600; margin-bottom: 2px; }
    .lv-chart__sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  `;

  private colorFor(s: ChartSeries, i: number): string {
    return s.color ?? `var(--lv-color-chart-${(i % 5) + 1})`;
  }

  private maxValue(): number {
    let max = 0;
    for (const s of this.series) for (const v of s.data) if (v > max) max = v;
    // include 0 baseline; avoid a zero range
    return max === 0 ? 1 : max;
  }

  private plotW(): number {
    return this.width - this.pad.left - this.pad.right;
  }

  private plotH(): number {
    return this.height - this.pad.top - this.pad.bottom;
  }

  /** x centre for category index `ci` (band scale). */
  private bandX(ci: number): number {
    const n = Math.max(this.categories.length, 1);
    return this.pad.left + (this.plotW() / n) * (ci + 0.5);
  }

  /** y for a value (0 at the baseline, max at the top). */
  private valueY(v: number): number {
    return this.pad.top + this.plotH() * (1 - v / this.maxValue());
  }

  private setHover(si: number, ci: number) {
    this.hover = { si, ci };
    const s = this.series[si];
    this.dispatchEvent(
      new CustomEvent("lv-point", {
        detail: { series: s.key, category: this.categories[ci], value: s.data[ci], index: ci },
        bubbles: true,
        composed: true,
      })
    );
  }

  private clearHover() {
    this.hover = null;
  }

  private renderGrid() {
    const lines = [0, 0.25, 0.5, 0.75, 1];
    return svg`${lines.map((t) => {
      const y = this.pad.top + this.plotH() * t;
      return svg`<line class="lv-chart__grid" x1=${this.pad.left} y1=${y} x2=${this.width - this.pad.right} y2=${y} />`;
    })}`;
  }

  private renderAxis() {
    if (!this.showAxis) return nothing;
    const n = Math.max(this.categories.length, 1);
    return svg`${this.categories.map((c, ci) => {
      const x = this.bandX(ci);
      return svg`<text class="lv-chart__axis-label" x=${x} y=${this.height - 8} text-anchor="middle">${
        n > 8 && ci % 2 ? "" : c
      }</text>`;
    })}`;
  }

  private renderBars() {
    const groups = Math.max(this.categories.length, 1);
    const bandW = this.plotW() / groups;
    const seriesN = Math.max(this.series.length, 1);
    const innerPad = bandW * 0.2;
    const barW = (bandW - innerPad) / seriesN;
    return svg`${this.series.map((s, si) =>
      s.data.map((v, ci) => {
        const x = this.pad.left + bandW * ci + innerPad / 2 + barW * si;
        const y = this.valueY(v);
        const h = this.pad.top + this.plotH() - y;
        const dim = this.hover && (this.hover.si !== si || this.hover.ci !== ci);
        return svg`<rect
          class="lv-chart__bar ${dim ? "lv-chart__bar--dim" : ""}"
          x=${x} y=${y} width=${Math.max(barW - 1, 1)} height=${Math.max(h, 0)}
          rx="2" fill=${this.colorFor(s, si)}
          tabindex="0" role="img"
          aria-label=${`${s.label ?? s.key}, ${this.categories[ci] ?? ci}: ${v}`}
          @mouseenter=${() => this.setHover(si, ci)}
          @mouseleave=${() => this.clearHover()}
          @focus=${() => this.setHover(si, ci)}
          @blur=${() => this.clearHover()}
        ></rect>`;
      })
    )}`;
  }

  private linePath(s: ChartSeries): string {
    return s.data
      .map((v, ci) => `${ci === 0 ? "M" : "L"} ${this.bandX(ci)} ${this.valueY(v)}`)
      .join(" ");
  }

  private areaPath(s: ChartSeries): string {
    if (s.data.length === 0) return "";
    const base = this.pad.top + this.plotH();
    const top = s.data.map((v, ci) => `${ci === 0 ? "M" : "L"} ${this.bandX(ci)} ${this.valueY(v)}`).join(" ");
    return `${top} L ${this.bandX(s.data.length - 1)} ${base} L ${this.bandX(0)} ${base} Z`;
  }

  private renderLinesOrArea() {
    return svg`${this.series.map((s, si) => {
      const color = this.colorFor(s, si);
      return svg`
        ${this.type === "area"
          ? svg`<path d=${this.areaPath(s)} fill=${color} fill-opacity="0.18" stroke="none" />`
          : nothing}
        <path d=${this.linePath(s)} fill="none" stroke=${color} stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" />
        ${s.data.map((v, ci) => {
          const x = this.bandX(ci);
          const y = this.valueY(v);
          const active = this.hover && this.hover.si === si && this.hover.ci === ci;
          return svg`
            <circle class="lv-chart__hit" cx=${x} cy=${y} r="12" fill="transparent"
              tabindex="0" role="img"
              aria-label=${`${s.label ?? s.key}, ${this.categories[ci] ?? ci}: ${v}`}
              @mouseenter=${() => this.setHover(si, ci)}
              @mouseleave=${() => this.clearHover()}
              @focus=${() => this.setHover(si, ci)}
              @blur=${() => this.clearHover()}
            ></circle>
            <circle class="lv-chart__dot" cx=${x} cy=${y} r=${active ? 5 : 3.5}
              fill=${color} stroke="var(--lv-color-bg)" stroke-width="1.5" />`;
        })}`;
    })}`;
  }

  private renderTooltip() {
    if (!this.hover) return nothing;
    const { si, ci } = this.hover;
    const s = this.series[si];
    if (!s) return nothing;
    const cx = (this.bandX(ci) / this.width) * 100;
    const cy = (this.valueY(s.data[ci]) / this.height) * 100;
    return html`<div
      class="lv-chart__tooltip"
      style="left:${cx}%;top:${cy}%"
      role="status"
    >
      <div class="lv-chart__tooltip-cat">${this.categories[ci] ?? ci}</div>
      <div class="lv-chart__tooltip-row">
        <span class="lv-chart__swatch" style="background:${this.colorFor(s, si)}"></span>
        <span>${s.label ?? s.key}: <strong>${s.data[ci]}</strong></span>
      </div>
    </div>`;
  }

  private renderDataTable() {
    return html`<table class="lv-chart__sr">
      <caption>
        ${this.label}
      </caption>
      <thead>
        <tr>
          <th scope="col">Category</th>
          ${this.series.map((s) => html`<th scope="col">${s.label ?? s.key}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${this.categories.map(
          (c, ci) => html`<tr>
            <th scope="row">${c}</th>
            ${this.series.map((s) => html`<td>${s.data[ci] ?? ""}</td>`)}
          </tr>`
        )}
      </tbody>
    </table>`;
  }

  render() {
    return html`
      <div class="lv-chart">
        ${this.legend && this.series.length > 0
          ? html`<div class="lv-chart__legend" aria-hidden="true">
              ${this.series.map(
                (s, si) => html`<span class="lv-chart__legend-item">
                  <span class="lv-chart__swatch" style="background:${this.colorFor(s, si)}"></span>
                  ${s.label ?? s.key}
                </span>`
              )}
            </div>`
          : nothing}
        <svg
          class="lv-chart__svg"
          viewBox="0 0 ${this.width} ${this.height}"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label=${this.label}
          @mouseleave=${() => this.clearHover()}
        >
          ${this.renderGrid()}
          ${this.type === "bar" ? this.renderBars() : this.renderLinesOrArea()}
          ${this.renderAxis()}
        </svg>
        ${this.renderTooltip()}
        ${this.renderDataTable()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-chart": LvChart;
  }
}
