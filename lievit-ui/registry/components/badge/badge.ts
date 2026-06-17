/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-badge>`: a small status pill, the gestionale status indicator.
 *
 * Pure presentation. The status variants map to the status tokens (success/warning/danger/
 * info, research 4.2). Owned source, copied in by `lievit add badge`. Light-DOM rendered.
 */
@customElement("lv-badge")
export class LvBadge extends LitElement {
  /** Status colour. `neutral` is the muted default. */
  @property() variant: "neutral" | "success" | "warning" | "danger" | "info" = "neutral";

  createRenderRoot(): this {
    adoptLightStyles("lv-badge", LvBadge.css);
    return this;
  }

  static readonly css = `
    .lv-badge {
      display: inline-flex;
      align-items: center;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      line-height: 1;
      padding: var(--lv-space-1) var(--lv-space-2);
      border-radius: var(--lv-radius-sm);
      font-weight: 500;
    }
    .lv-badge--neutral { background: var(--lv-color-surface); color: var(--lv-color-muted); }
    .lv-badge--success { background: var(--lv-color-success); color: var(--lv-color-success-fg); }
    .lv-badge--warning { background: var(--lv-color-warning); color: var(--lv-color-warning-fg); }
    .lv-badge--danger { background: var(--lv-color-danger); color: var(--lv-color-danger-fg); }
    .lv-badge--info { background: var(--lv-color-info); color: var(--lv-color-info-fg); }
  `;

  render() {
    return html`<span class="lv-badge lv-badge--${this.variant}"><slot></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-badge": LvBadge;
  }
}
