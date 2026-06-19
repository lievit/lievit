/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBodies } from "../../icons/icon-bodies.js";

/**
 * A panel descriptor for `<lv-resizable>`. Sizes are PERCENTAGES of the group's main axis.
 */
export interface LvResizablePanel {
  /** Stable id; defaults to the index. Echoed back in `lv-resize`. */
  id?: string;
  /** Initial size as a percentage (0-100). If omitted, panels share the remaining space evenly. */
  size?: number;
  /** Minimum size percentage. Default 10. */
  min?: number;
  /** Maximum size percentage. Default 100. */
  max?: number;
  /** When true, the panel can collapse to 0 by dragging past its min. */
  collapsible?: boolean;
}

/**
 * `<lv-resizable>`: a group of panels separated by draggable handles (the native equivalent
 * of shadcn's react-resizable-panels). Mirrors that ARIA model exactly:
 *
 * - Each handle is a `role="separator"` with `aria-orientation`, `aria-valuemin`,
 *   `aria-valuemax` and `aria-valuenow` (the size, as a percentage, of the panel BEFORE it),
 *   plus `aria-controls` to the preceding panel. It is keyboard-focusable (`tabindex=0`).
 * - Pointer drag resizes the two adjacent panels (the dragged delta is taken from one and
 *   given to the other, clamped to each panel's min/max).
 * - Keyboard: Arrow keys nudge by `keyboardStep` (default 5%) along the axis; Home/End drive
 *   the preceding panel to its min/max; Enter toggles collapse on a collapsible neighbour.
 * - `direction` = `horizontal` (default, side-by-side, vertical separators) | `vertical`.
 *
 * Data down, events up: `panels` is the controlled descriptor list; the component owns the
 * ephemeral sizes and emits a bubbling `lv-resize` with `{ sizes }` (percentages) on change.
 * The handle carries a Lucide `grip-vertical` indicator when `withHandle` is set.
 *
 * Owned source, copied in by `lievit add resizable`. Light-DOM rendered, token-styled.
 */
@customElement("lv-resizable")
export class LvResizable extends LitElement {
  /** The panels, in order. */
  @property({ type: Array }) panels: LvResizablePanel[] = [];

  /** Layout axis. `horizontal` = panels side by side with vertical drag handles. */
  @property() direction: "horizontal" | "vertical" = "horizontal";

  /** Render a visible grip indicator inside each handle. */
  @property({ type: Boolean, attribute: "with-handle" }) withHandle = false;

  /** Keyboard nudge step, in percent of the group. */
  @property({ type: Number, attribute: "keyboard-step" }) keyboardStep = 5;

  /** Live sizes (percentages), one per panel. Derived from `panels` on first render. */
  @state() private _sizes: number[] = [];

  private _dragIndex = -1; // index of the handle being dragged (separator before panel i+1)
  private _dragStart = 0;
  private _startSizes: number[] = [];
  private static _seq = 0;
  private readonly _gid = `lv-resizable-${(LvResizable._seq += 1)}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-resizable", LvResizable.css);
    return this;
  }

  static readonly css = `
    .lv-resizable {
      display: flex;
      width: 100%;
      height: 100%;
      font-family: var(--lv-font-sans);
    }
    .lv-resizable--vertical { flex-direction: column; }
    .lv-resizable__panel {
      overflow: hidden;
      min-width: 0;
      min-height: 0;
    }
    .lv-resizable__handle {
      position: relative;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--lv-color-border);
      cursor: col-resize;
      touch-action: none;
    }
    .lv-resizable--horizontal > .lv-resizable__handle { width: 1px; cursor: col-resize; }
    .lv-resizable--vertical > .lv-resizable__handle { height: 1px; cursor: row-resize; }
    /* widen the hit area without widening the visible line */
    .lv-resizable__handle::after {
      content: "";
      position: absolute;
    }
    .lv-resizable--horizontal > .lv-resizable__handle::after {
      inset: 0 -3px;
    }
    .lv-resizable--vertical > .lv-resizable__handle::after {
      inset: -3px 0;
    }
    .lv-resizable__handle:focus-visible { outline: none; box-shadow: var(--lv-ring); z-index: 1; }
    .lv-resizable__grip {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 0.75rem;
      height: 1rem;
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      background: var(--lv-color-bg);
      color: var(--lv-color-muted);
    }
    .lv-resizable--vertical > .lv-resizable__handle .lv-resizable__grip { transform: rotate(90deg); }
    .lv-resizable__grip svg { width: 0.625rem; height: 0.625rem; }
  `;

  private ensureSizes(): number[] {
    const n = this.panels.length;
    if (this._sizes.length === n && this._sizes.length > 0) return this._sizes;
    // Seed from declared sizes; distribute the remainder evenly over the unsized panels.
    const declared = this.panels.map((p) => p.size);
    const known = declared.filter((s): s is number => typeof s === "number");
    const usedTotal = known.reduce((a, b) => a + b, 0);
    const unsizedCount = n - known.length;
    const each = unsizedCount > 0 ? Math.max(0, (100 - usedTotal) / unsizedCount) : 0;
    this._sizes = declared.map((s) => (typeof s === "number" ? s : each));
    return this._sizes;
  }

  private min(i: number): number {
    return this.panels[i]?.min ?? 10;
  }

  private max(i: number): number {
    return this.panels[i]?.max ?? 100;
  }

  /**
   * Move `delta` percent across handle `h` (panel `a`=h grows, panel `b`=h+1 shrinks, or the
   * reverse for a negative delta), clamped so neither neighbour breaches its [min,max].
   * A `collapsible` neighbour may go all the way to 0 instead of stopping at its min.
   */
  private applyDelta(h: number, delta: number, base: number[]) {
    const sizes = base.slice();
    const a = h;
    const b = h + 1;
    const aMin = this.panels[a]?.collapsible ? 0 : this.min(a);
    const bMin = this.panels[b]?.collapsible ? 0 : this.min(b);
    // `a` may grow up to its max and shrink down to its (collapsible) min;
    // `b` is the mirror, so the same bounds expressed against `a`'s delta.
    const lower = Math.max(aMin - sizes[a], sizes[b] - this.max(b));
    const upper = Math.min(this.max(a) - sizes[a], sizes[b] - bMin);
    const want = Math.min(Math.max(delta, lower), upper);
    sizes[a] = sizes[a] + want;
    sizes[b] = sizes[b] - want;
    this._sizes = sizes;
    this.requestUpdate();
    this.emit();
  }

  private emit() {
    this.dispatchEvent(
      new CustomEvent("lv-resize", {
        detail: { sizes: this._sizes.slice() },
        bubbles: true,
        composed: true,
      })
    );
  }

  private get axisLength(): number {
    const group = this.querySelector(".lv-resizable") as HTMLElement | null;
    if (!group) return 0;
    return this.direction === "horizontal" ? group.clientWidth : group.clientHeight;
  }

  private onHandlePointerDown(h: number, e: PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this._dragIndex = h;
    this._dragStart = this.direction === "horizontal" ? e.clientX : e.clientY;
    this._startSizes = this.ensureSizes().slice();
    document.addEventListener("pointermove", this.onPointerMove);
    document.addEventListener("pointerup", this.onPointerUp);
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this._dragIndex < 0) return;
    const length = this.axisLength;
    if (length === 0) return;
    const pos = this.direction === "horizontal" ? e.clientX : e.clientY;
    const deltaPx = pos - this._dragStart;
    const deltaPct = (deltaPx / length) * 100;
    this.applyDelta(this._dragIndex, deltaPct, this._startSizes);
  };

  private onPointerUp = () => {
    this._dragIndex = -1;
    document.removeEventListener("pointermove", this.onPointerMove);
    document.removeEventListener("pointerup", this.onPointerUp);
  };

  private onHandleKeydown(h: number, e: KeyboardEvent) {
    const horiz = this.direction === "horizontal";
    const sizes = this.ensureSizes();
    const step = this.keyboardStep;
    let handled = true;
    switch (e.key) {
      case horiz ? "ArrowLeft" : "ArrowUp":
        this.applyDelta(h, -step, sizes);
        break;
      case horiz ? "ArrowRight" : "ArrowDown":
        this.applyDelta(h, step, sizes);
        break;
      case "Home":
        // drive the preceding panel to its min
        this.applyDelta(h, this.min(h) - sizes[h], sizes);
        break;
      case "End":
        // drive the preceding panel to its max
        this.applyDelta(h, this.max(h) - sizes[h], sizes);
        break;
      case "Enter":
        // toggle collapse of the preceding panel when collapsible
        if (this.panels[h]?.collapsible) {
          const target = sizes[h] > 0 ? -sizes[h] : this.min(h);
          this.applyDelta(h, target, sizes);
        } else {
          handled = false;
        }
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("pointermove", this.onPointerMove);
    document.removeEventListener("pointerup", this.onPointerUp);
  }

  render() {
    const sizes = this.ensureSizes();
    const horiz = this.direction === "horizontal";
    const grip = iconBodies["grip-vertical"] ?? "";
    return html`
      <div class="lv-resizable lv-resizable--${this.direction}">
        ${this.panels.map((p, i) => {
          const panelId = `${this._gid}-panel-${i}`;
          const flexBasis = `${sizes[i] ?? 0}%`;
          const panel = html`<div
            class="lv-resizable__panel"
            id=${panelId}
            data-panel=${p.id ?? String(i)}
            style="flex: 0 0 ${flexBasis};"
          >
            <slot name=${`panel-${i}`}></slot>
          </div>`;
          if (i === this.panels.length - 1) return panel;
          const handle = html`<div
            class="lv-resizable__handle"
            role="separator"
            tabindex="0"
            aria-orientation=${horiz ? "vertical" : "horizontal"}
            aria-controls=${panelId}
            aria-valuemin=${this.min(i)}
            aria-valuemax=${this.max(i)}
            aria-valuenow=${Math.round(sizes[i] ?? 0)}
            @pointerdown=${(e: PointerEvent) => this.onHandlePointerDown(i, e)}
            @keydown=${(e: KeyboardEvent) => this.onHandleKeydown(i, e)}
          >
            ${this.withHandle
              ? html`<span class="lv-resizable__grip" aria-hidden="true"
                  ><svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    ${unsafeSVG(grip)}
                  </svg></span
                >`
              : null}
          </div>`;
          return html`${panel}${handle}`;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-resizable": LvResizable;
  }
}
