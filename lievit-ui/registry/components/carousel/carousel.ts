/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBody } from "../../icons/icon-bodies.js";

/**
 * `<lv-carousel>`: a slides carousel.
 *
 * Slides are the host's own child elements (one element = one slide). The component renders
 * its chrome (prev/next controls, the scroll viewport, the live region) and then ADOPTS the
 * user's slide elements into the viewport. It cannot use a `<slot>`: in light DOM there is no
 * shadow root, so `<slot>` never projects (verified) and Lit appends its render after the
 * existing children. Instead we physically relocate the slides into the viewport once and keep
 * them in sync with a `MutationObserver`. This is the light-DOM equivalent of slotting.
 *
 * Accessibility follows the WAI-ARIA APG carousel pattern:
 * - The root is `role="region"` with `aria-roledescription="carousel"` and an `aria-label`.
 * - Each slide gets `role="group"`, `aria-roledescription="slide"` and an `aria-label`
 *   "N of M"; off-screen slides are `aria-hidden` and `inert` (out of the tab order).
 * - Prev/Next are real buttons (Lucide arrows), disabled at the bounds (or wrapping when
 *   `loop`); the current index is announced via an `aria-live="polite"` status region.
 * - ArrowLeft/ArrowRight (ArrowUp/Down when vertical) move between slides when focused.
 *
 * Mechanics: CSS scroll-snap (native, no transform math, robust to variable slide widths and
 * SSR). Optional `autoplay` advances on an interval and pauses on hover / focus / hidden tab.
 *
 * Data down, events up: `index` (number) sets the active slide; emits `lv-change` `{ index }`
 * whenever the active slide changes. Light-DOM rendered.
 */
@customElement("lv-carousel")
export class LvCarousel extends LitElement {
  /** Active slide index (0-based). */
  @property({ type: Number }) index = 0;

  /** Scroll axis. */
  @property() orientation: "horizontal" | "vertical" = "horizontal";

  /** Wrap around at the ends instead of disabling the prev/next button. */
  @property({ type: Boolean }) loop = false;

  /** Auto-advance interval in ms; 0 (default) disables autoplay. */
  @property({ type: Number }) autoplay = 0;

  /** Accessible label for the carousel region. */
  @property() label = "Carousel";

  @state() private count = 0;

  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private observer: MutationObserver | null = null;
  private slideEls: HTMLElement[] = [];

  createRenderRoot(): this {
    adoptLightStyles("lv-carousel", LvCarousel.css);
    return this;
  }

  static readonly css = `
    .lv-carousel { position: relative; display: block; }
    .lv-carousel__viewport {
      border-radius: var(--lv-radius-md);
      scroll-behavior: smooth;
      scrollbar-width: none;
    }
    .lv-carousel__viewport--horizontal {
      display: flex;
      scroll-snap-type: x mandatory;
      overflow-x: auto;
    }
    .lv-carousel__viewport--vertical {
      display: flex;
      flex-direction: column;
      scroll-snap-type: y mandatory;
      overflow-y: auto;
      max-height: 100%;
    }
    .lv-carousel__viewport::-webkit-scrollbar { display: none; }
    .lv-carousel__viewport > * {
      scroll-snap-align: start;
      flex: 0 0 100%;
      min-width: 0;
    }
    .lv-carousel__nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: var(--lv-radius-full);
      border: 1px solid var(--lv-color-border);
      background: var(--lv-color-bg);
      color: var(--lv-color-fg);
      cursor: pointer;
      box-shadow: var(--lv-shadow-sm);
      z-index: var(--lv-z-base);
    }
    .lv-carousel__nav:hover:not([disabled]) { background: var(--lv-color-surface); }
    .lv-carousel__nav:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-carousel__nav[disabled] { opacity: 0.4; cursor: not-allowed; }
    .lv-carousel__nav svg { width: 1rem; height: 1rem; }
    .lv-carousel__nav--prev { left: var(--lv-space-2); }
    .lv-carousel__nav--next { right: var(--lv-space-2); }
    .lv-carousel--vertical .lv-carousel__nav { top: auto; left: 50%; transform: translateX(-50%); }
    .lv-carousel--vertical .lv-carousel__nav--prev { top: var(--lv-space-2); }
    .lv-carousel--vertical .lv-carousel__nav--next { bottom: var(--lv-space-2); }
    .lv-carousel__status {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.observer?.disconnect();
    this.stopAutoplay();
  }

  firstUpdated() {
    this.adoptSlides();
    this.observer = new MutationObserver(() => this.adoptSlides());
    // Watch the host for added/removed slides; the chrome lives inside `.lv-carousel`,
    // so only direct children that are NOT the chrome are slides.
    this.observer.observe(this, { childList: true });
    this.maybeStartAutoplay();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has("index")) this.scrollToIndex();
    if (changed.has("autoplay")) this.maybeStartAutoplay();
    if (changed.has("orientation")) this.relocateViewportClass();
  }

  /**
   * Move every host child that is not the rendered chrome into the viewport, then re-tag.
   * Idempotent: a child already inside the viewport is left in place.
   */
  private adoptSlides() {
    const chrome = this.querySelector(".lv-carousel");
    const viewport = this.querySelector(".lv-carousel__viewport");
    if (!chrome || !viewport) return;

    const stray = Array.from(this.children).filter((c) => c !== chrome) as HTMLElement[];
    for (const el of stray) viewport.appendChild(el);

    this.slideEls = Array.from(viewport.children) as HTMLElement[];
    if (this.slideEls.length !== this.count) this.count = this.slideEls.length;
    if (this.index > this.count - 1) this.index = Math.max(0, this.count - 1);
    this.tagSlides();
    this.scrollToIndex();
  }

  private relocateViewportClass() {
    this.adoptSlides();
  }

  /** Apply per-slide ARIA + tab management. */
  private tagSlides() {
    this.slideEls.forEach((slide, i) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", `${i + 1} of ${this.count}`);
      const hidden = i !== this.index;
      slide.setAttribute("aria-hidden", hidden ? "true" : "false");
      slide.toggleAttribute("inert", hidden);
    });
  }

  private clampOrWrap(i: number): number {
    if (this.count === 0) return 0;
    if (this.loop) return (i + this.count) % this.count;
    return Math.min(Math.max(i, 0), this.count - 1);
  }

  private go(i: number) {
    const next = this.clampOrWrap(i);
    if (next === this.index) return;
    this.index = next;
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: { index: next }, bubbles: true, composed: true })
    );
  }

  /** Advance to the next slide. Wraps when `loop`. Public so hosts can drive it. */
  next = () => this.go(this.index + 1);

  /** Go to the previous slide. Wraps when `loop`. Public so hosts can drive it. */
  prev = () => this.go(this.index - 1);

  private scrollToIndex() {
    const slide = this.slideEls[this.index];
    const vp = this.querySelector(".lv-carousel__viewport") as HTMLElement | null;
    if (!slide || !vp) return;
    if (this.orientation === "vertical") {
      vp.scrollTo({ top: slide.offsetTop - vp.offsetTop, behavior: "smooth" });
    } else {
      vp.scrollTo({ left: slide.offsetLeft - vp.offsetLeft, behavior: "smooth" });
    }
    this.tagSlides();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const back = this.orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    const fwd = this.orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    if (e.key === back) {
      e.preventDefault();
      this.prev();
    } else if (e.key === fwd) {
      e.preventDefault();
      this.next();
    }
  };

  // --- autoplay -------------------------------------------------------------
  private maybeStartAutoplay() {
    this.stopAutoplay();
    if (this.autoplay > 0) {
      this.timer = setInterval(() => {
        if (this.paused) return;
        const atEnd = this.index + 1 >= this.count;
        this.go(atEnd && !this.loop ? 0 : this.index + 1);
      }, this.autoplay);
    }
  }

  private stopAutoplay() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private onVisibility = () => {
    this.paused = document.hidden;
  };

  private onPointerEnter = () => {
    if (this.autoplay > 0) this.paused = true;
  };

  private onPointerLeave = () => {
    if (this.autoplay > 0) this.paused = false;
  };

  render() {
    const canPrev = this.loop || this.index > 0;
    const canNext = this.loop || this.index < this.count - 1;
    const vertical = this.orientation === "vertical";

    return html`
      <div
        class="lv-carousel ${vertical ? "lv-carousel--vertical" : ""}"
        role="region"
        aria-roledescription="carousel"
        aria-label=${this.label}
        tabindex="0"
        @keydown=${this.onKeyDown}
        @mouseenter=${this.onPointerEnter}
        @mouseleave=${this.onPointerLeave}
        @focusin=${this.onPointerEnter}
        @focusout=${this.onPointerLeave}
      >
        <button
          class="lv-carousel__nav lv-carousel__nav--prev"
          type="button"
          aria-label="Previous slide"
          ?disabled=${!canPrev}
          @click=${this.prev}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
          >${unsafeSVG(iconBody(vertical ? "arrow-up" : "arrow-left"))}</svg>
        </button>

        <div
          class="lv-carousel__viewport ${vertical
            ? "lv-carousel__viewport--vertical"
            : "lv-carousel__viewport--horizontal"}"
        ></div>

        <button
          class="lv-carousel__nav lv-carousel__nav--next"
          type="button"
          aria-label="Next slide"
          ?disabled=${!canNext}
          @click=${this.next}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
          >${unsafeSVG(iconBody(vertical ? "arrow-down" : "arrow-right"))}</svg>
        </button>

        <div class="lv-carousel__status" role="status" aria-live="polite">
          Slide ${this.count ? this.index + 1 : 0} of ${this.count}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-carousel": LvCarousel;
  }
}
