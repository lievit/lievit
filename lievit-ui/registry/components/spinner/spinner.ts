/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-spinner>`: a busy indicator.
 *
 * Carries `role="status"` plus an accessible `label` (default "Loading") exposed via
 * `aria-label`, so screen readers announce the busy state without seeing the animation
 * (WAI-ARIA status pattern, research 4.3). The animation respects
 * `prefers-reduced-motion`. Owned source, copied in by `lievit add spinner`. Light-DOM
 * rendered.
 */
@customElement("lv-spinner")
export class LvSpinner extends LitElement {
  /** Diameter token: small or medium. */
  @property() size: "sm" | "md" = "md";

  /** Accessible label announced by assistive tech. */
  @property() label = "Loading";

  createRenderRoot(): this {
    adoptLightStyles("lv-spinner", LvSpinner.css);
    return this;
  }

  static readonly css = `
    .lv-spinner {
      display: inline-block;
      border-radius: 50%;
      border: 2px solid var(--lv-color-border);
      border-top-color: var(--lv-color-primary);
      animation: lv-spin 0.6s linear infinite;
    }
    .lv-spinner--sm { width: 1rem; height: 1rem; }
    .lv-spinner--md { width: 1.5rem; height: 1.5rem; }
    @keyframes lv-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .lv-spinner { animation-duration: 0s; }
    }
  `;

  render() {
    return html`
      <span
        class="lv-spinner lv-spinner--${this.size}"
        role="status"
        aria-label=${this.label}
      ></span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-spinner": LvSpinner;
  }
}
