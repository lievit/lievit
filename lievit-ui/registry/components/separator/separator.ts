/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-separator>`: a thin divider line.
 *
 * Carries `role="separator"` and `aria-orientation` so assistive tech announces the divide
 * (WAI-ARIA separator pattern, research 4.3); a purely decorative separator can be hidden by
 * the adopter with `aria-hidden`. Owned source, copied in by `lievit add separator`.
 * Light-DOM rendered.
 */
@customElement("lv-separator")
export class LvSeparator extends LitElement {
  /** Orientation of the rule. */
  @property() orientation: "horizontal" | "vertical" = "horizontal";

  createRenderRoot(): this {
    adoptLightStyles("lv-separator", LvSeparator.css);
    return this;
  }

  static readonly css = `
    .lv-separator { background: var(--lv-color-border); border: 0; }
    .lv-separator--horizontal { width: 100%; height: 1px; }
    .lv-separator--vertical { width: 1px; height: 100%; display: inline-block; }
  `;

  render() {
    return html`
      <div
        class="lv-separator lv-separator--${this.orientation}"
        role="separator"
        aria-orientation=${this.orientation}
      ></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-separator": LvSeparator;
  }
}
