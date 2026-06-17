/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-card>`: a surface container with optional header.
 *
 * Pure presentation: an elevated surface (token `--lv-shadow-sm`, research 4.2) with an
 * optional `heading` rendered in a header region and the body supplied via the default slot.
 * When a heading is present the card is given `role="region"` and `aria-labelledby` pointing
 * at the heading, so assistive tech announces the landmark by its title (WAI-ARIA, research
 * 4.3). Owned source, copied in by `lievit add card`. Light-DOM rendered.
 */
@customElement("lv-card")
export class LvCard extends LitElement {
  /** Optional card title; renders a header region when set. */
  @property() heading = "";

  private static seq = 0;
  private readonly headingId = `lv-card-heading-${LvCard.seq++}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-card", LvCard.css);
    return this;
  }

  static readonly css = `
    .lv-card {
      display: block;
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-sm);
      overflow: hidden;
    }
    .lv-card__header {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-lg);
      font-weight: 600;
      color: var(--lv-color-fg);
      padding: var(--lv-space-4);
      border-bottom: 1px solid var(--lv-color-border);
    }
    .lv-card__body {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      padding: var(--lv-space-4);
    }
  `;

  render() {
    const hasHeading = this.heading.length > 0;
    return html`
      <div
        class="lv-card"
        role=${hasHeading ? "region" : "presentation"}
        aria-labelledby=${hasHeading ? this.headingId : ""}
      >
        ${hasHeading
          ? html`<div class="lv-card__header" id=${this.headingId}>${this.heading}</div>`
          : null}
        <div class="lv-card__body"><slot></slot></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-card": LvCard;
  }
}
