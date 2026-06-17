/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-progress>`: a determinate or indeterminate progress bar.
 *
 * Implements the WAI-ARIA progressbar pattern (research 4.3): `role="progressbar"`,
 * `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label` carry the
 * state to assistive tech without any visual text. When `value` is -1 (the
 * indeterminate sentinel), `aria-valuenow` is omitted and the bar animates.
 * Respects `prefers-reduced-motion`. Pure visual component; no events emitted.
 *
 * Owned source, copied in by `lievit add progress`. Light-DOM rendered.
 */
@customElement("lv-progress")
export class LvProgress extends LitElement {
  /** Current value (0-100). Use -1 for indeterminate. */
  @property({ type: Number }) value = -1;

  /** Accessible label. */
  @property() label = "Progress";

  createRenderRoot(): this {
    adoptLightStyles("lv-progress", LvProgress.css);
    return this;
  }

  static readonly css = `
    .lv-progress {
      display: block;
      width: 100%;
      height: 0.5rem;
      background: var(--lv-color-surface);
      border-radius: var(--lv-radius-sm);
      overflow: hidden;
    }
    .lv-progress__bar {
      height: 100%;
      background: var(--lv-color-primary);
      border-radius: var(--lv-radius-sm);
      transition: width 200ms ease;
    }
    .lv-progress__bar--indeterminate {
      width: 40%;
      animation: lv-progress-slide 1.2s ease-in-out infinite;
    }
    @keyframes lv-progress-slide {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(350%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .lv-progress__bar--indeterminate { animation-duration: 0s; }
    }
  `;

  render() {
    const indeterminate = this.value < 0;
    const pct = indeterminate ? 40 : Math.min(100, Math.max(0, this.value));

    return html`
      <div
        class="lv-progress"
        role="progressbar"
        aria-label=${this.label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${indeterminate ? "" : String(pct)}
      >
        <div
          class="lv-progress__bar ${indeterminate ? "lv-progress__bar--indeterminate" : ""}"
          style=${indeterminate ? "" : `width: ${pct}%`}
        ></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-progress": LvProgress;
  }
}
