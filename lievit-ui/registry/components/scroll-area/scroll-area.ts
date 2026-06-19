/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-scroll-area>`: a scrollable viewport with a styled, token-driven scrollbar overlay.
 *
 * Mirrors the Radix ScrollArea structure (root > viewport > scrollbar > thumb): the native
 * scrollbar is hidden (scrollbar-width:none + ::-webkit-scrollbar) and a custom thumb is
 * painted over the viewport, sized and positioned from the live scroll metrics. The custom
 * scrollbar is PURELY presentational: native scrolling is untouched, so keyboard (PageUp/Down,
 * arrows, Home/End on a focusable child), mouse wheel and touch all keep working, and the
 * accessibility tree is the native one (no fake role hijacking, matching Radix which leaves
 * the viewport a plain scroll container).
 *
 * The thumb is also draggable (pointer) and the track is click-to-page, like Radix. The bars
 * auto-show on scroll/hover and fade out after idle (type="hover" default; "always" pins them,
 * "scroll" shows only while scrolling). Vertical + horizontal both supported via `orientation`.
 *
 * Data down, events up: the projected content is the default slot; the component owns no
 * domain state, only ephemeral view state (thumb geometry, visibility) derived from scroll.
 *
 * Owned source, copied in by `lievit add scroll-area`. Light-DOM rendered, token-styled.
 */
@customElement("lv-scroll-area")
export class LvScrollArea extends LitElement {
  /** Which scrollbars to render: `vertical` (default), `horizontal`, or `both`. */
  @property() orientation: "vertical" | "horizontal" | "both" = "vertical";

  /**
   * When the scrollbars are visible:
   * - `hover` (default): on scroll or pointer-over the area, fade out after idle.
   * - `scroll`: only while actively scrolling.
   * - `always`: pinned visible whenever the content overflows.
   */
  @property() type: "hover" | "scroll" | "always" = "hover";

  /** Idle delay (ms) before a `hover`/`scroll` bar fades out. */
  @property({ type: Number, attribute: "scroll-hide-delay" }) scrollHideDelay = 600;

  private _hideTimer: number | undefined;
  private _dragAxis: "x" | "y" | null = null;
  private _dragStart = 0;
  private _dragScrollStart = 0;

  createRenderRoot(): this {
    adoptLightStyles("lv-scroll-area", LvScrollArea.css);
    return this;
  }

  static readonly css = `
    .lv-scroll-area {
      position: relative;
      overflow: hidden;
      font-family: var(--lv-font-sans);
    }
    .lv-scroll-area__viewport {
      width: 100%;
      height: 100%;
      overflow: scroll;
      border-radius: inherit;
      scrollbar-width: none; /* Firefox: hide the native bar, we paint our own */
      -ms-overflow-style: none;
    }
    .lv-scroll-area__viewport::-webkit-scrollbar { width: 0; height: 0; background: transparent; }
    .lv-scroll-area__viewport:focus-visible { outline: none; box-shadow: var(--lv-ring); }

    .lv-scroll-area__scrollbar {
      position: absolute;
      display: none;
      touch-action: none;
      user-select: none;
      opacity: 0;
      transition: opacity 0.16s ease;
      z-index: var(--lv-z-base);
    }
    .lv-scroll-area__scrollbar--visible { opacity: 1; }
    .lv-scroll-area__scrollbar--shown { display: block; }
    .lv-scroll-area__scrollbar--y {
      top: 0;
      right: 0;
      bottom: 0;
      width: 0.625rem;
      padding: 1px;
    }
    .lv-scroll-area__scrollbar--x {
      left: 0;
      right: 0;
      bottom: 0;
      height: 0.625rem;
      padding: 1px;
    }
    .lv-scroll-area__thumb {
      position: relative;
      background: var(--lv-color-border);
      border-radius: var(--lv-radius-full);
      cursor: default;
    }
    .lv-scroll-area__thumb:hover { background: var(--lv-color-muted); }
    .lv-scroll-area__scrollbar--y .lv-scroll-area__thumb { width: 100%; }
    .lv-scroll-area__scrollbar--x .lv-scroll-area__thumb { height: 100%; }
  `;

  private get viewport(): HTMLElement | null {
    return this.querySelector(".lv-scroll-area__viewport");
  }

  private wantsY(): boolean {
    return this.orientation === "vertical" || this.orientation === "both";
  }

  private wantsX(): boolean {
    return this.orientation === "horizontal" || this.orientation === "both";
  }

  firstUpdated() {
    // Recompute geometry when the content size changes (not just on scroll).
    const vp = this.viewport;
    if (vp && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => this.syncBars());
      ro.observe(vp);
      Array.from(vp.children).forEach((c) => ro.observe(c as Element));
    }
    this.updateComplete.then(() => this.syncBars());
  }

  /** Recompute thumb size/position for both axes and toggle bar presence on overflow. */
  private syncBars = () => {
    const vp = this.viewport;
    if (!vp) return;

    if (this.wantsY()) {
      const bar = this.querySelector<HTMLElement>(".lv-scroll-area__scrollbar--y");
      const thumb = this.querySelector<HTMLElement>(".lv-scroll-area__scrollbar--y .lv-scroll-area__thumb");
      const overflow = vp.scrollHeight > vp.clientHeight + 1;
      if (bar && thumb) {
        bar.classList.toggle("lv-scroll-area__scrollbar--shown", overflow);
        if (overflow) {
          const ratio = vp.clientHeight / vp.scrollHeight;
          const trackH = vp.clientHeight - 2;
          const thumbH = Math.max(ratio * trackH, 20);
          const maxTop = trackH - thumbH;
          const top = maxTop * (vp.scrollTop / (vp.scrollHeight - vp.clientHeight) || 0);
          thumb.style.height = `${thumbH}px`;
          thumb.style.transform = `translateY(${top}px)`;
        }
      }
    }

    if (this.wantsX()) {
      const bar = this.querySelector<HTMLElement>(".lv-scroll-area__scrollbar--x");
      const thumb = this.querySelector<HTMLElement>(".lv-scroll-area__scrollbar--x .lv-scroll-area__thumb");
      const overflow = vp.scrollWidth > vp.clientWidth + 1;
      if (bar && thumb) {
        bar.classList.toggle("lv-scroll-area__scrollbar--shown", overflow);
        if (overflow) {
          const ratio = vp.clientWidth / vp.scrollWidth;
          const trackW = vp.clientWidth - 2;
          const thumbW = Math.max(ratio * trackW, 20);
          const maxLeft = trackW - thumbW;
          const left = maxLeft * (vp.scrollLeft / (vp.scrollWidth - vp.clientWidth) || 0);
          thumb.style.width = `${thumbW}px`;
          thumb.style.transform = `translateX(${left}px)`;
        }
      }
    }
  };

  private showBars() {
    if (this.type === "always") return; // pinned via updated()
    this.querySelectorAll(".lv-scroll-area__scrollbar").forEach((b) =>
      b.classList.add("lv-scroll-area__scrollbar--visible")
    );
    window.clearTimeout(this._hideTimer);
    this._hideTimer = window.setTimeout(() => {
      this.querySelectorAll(".lv-scroll-area__scrollbar").forEach((b) =>
        b.classList.remove("lv-scroll-area__scrollbar--visible")
      );
    }, this.scrollHideDelay);
  }

  private onScroll = () => {
    this.syncBars();
    this.showBars();
  };

  private onPointerEnter = () => {
    if (this.type === "hover") this.showBars();
  };

  private onThumbPointerDown(axis: "x" | "y", e: PointerEvent) {
    e.preventDefault();
    const vp = this.viewport;
    if (!vp) return;
    this._dragAxis = axis;
    this._dragStart = axis === "y" ? e.clientY : e.clientX;
    this._dragScrollStart = axis === "y" ? vp.scrollTop : vp.scrollLeft;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.addEventListener("pointermove", this.onThumbPointerMove);
    document.addEventListener("pointerup", this.onThumbPointerUp);
  }

  private onThumbPointerMove = (e: PointerEvent) => {
    const vp = this.viewport;
    if (!vp || !this._dragAxis) return;
    if (this._dragAxis === "y") {
      const trackH = vp.clientHeight - 2;
      const scrollable = vp.scrollHeight - vp.clientHeight;
      const delta = (e.clientY - this._dragStart) * (scrollable / trackH);
      vp.scrollTop = this._dragScrollStart + delta;
    } else {
      const trackW = vp.clientWidth - 2;
      const scrollable = vp.scrollWidth - vp.clientWidth;
      const delta = (e.clientX - this._dragStart) * (scrollable / trackW);
      vp.scrollLeft = this._dragScrollStart + delta;
    }
  };

  private onThumbPointerUp = () => {
    this._dragAxis = null;
    document.removeEventListener("pointermove", this.onThumbPointerMove);
    document.removeEventListener("pointerup", this.onThumbPointerUp);
  };

  /** Click on the track (not the thumb) pages the viewport toward the click, like Radix. */
  private onTrackPointerDown(axis: "x" | "y", e: PointerEvent) {
    if ((e.target as HTMLElement).classList.contains("lv-scroll-area__thumb")) return;
    const vp = this.viewport;
    if (!vp) return;
    if (axis === "y") {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      vp.scrollTop += e.clientY < rect.top + rect.height / 2 ? -vp.clientHeight : vp.clientHeight;
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      vp.scrollLeft += e.clientX < rect.left + rect.width / 2 ? -vp.clientWidth : vp.clientWidth;
    }
  }

  updated() {
    if (this.type === "always") {
      this.querySelectorAll(".lv-scroll-area__scrollbar").forEach((b) =>
        b.classList.add("lv-scroll-area__scrollbar--visible")
      );
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this._hideTimer);
    document.removeEventListener("pointermove", this.onThumbPointerMove);
    document.removeEventListener("pointerup", this.onThumbPointerUp);
  }

  render() {
    return html`
      <div class="lv-scroll-area" @pointerenter=${this.onPointerEnter}>
        <div
          class="lv-scroll-area__viewport"
          part="viewport"
          tabindex="0"
          @scroll=${this.onScroll}
        >
          <slot></slot>
        </div>
        ${this.wantsY()
          ? html`<div
              class="lv-scroll-area__scrollbar lv-scroll-area__scrollbar--y"
              aria-hidden="true"
              @pointerdown=${(e: PointerEvent) => this.onTrackPointerDown("y", e)}
            >
              <div
                class="lv-scroll-area__thumb"
                @pointerdown=${(e: PointerEvent) => this.onThumbPointerDown("y", e)}
              ></div>
            </div>`
          : null}
        ${this.wantsX()
          ? html`<div
              class="lv-scroll-area__scrollbar lv-scroll-area__scrollbar--x"
              aria-hidden="true"
              @pointerdown=${(e: PointerEvent) => this.onTrackPointerDown("x", e)}
            >
              <div
                class="lv-scroll-area__thumb"
                @pointerdown=${(e: PointerEvent) => this.onThumbPointerDown("x", e)}
              ></div>
            </div>`
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-scroll-area": LvScrollArea;
  }
}
