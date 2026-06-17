/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-alert>`: an inline message banner.
 *
 * The ARIA role tracks severity: `danger` and `warning` use `role="alert"` (assertive, the
 * APG pattern for time-sensitive errors), while `info` and `success` use `role="status"`
 * (polite), so screen readers interrupt only for the urgent kinds (WAI-ARIA alert pattern,
 * research 4.3). An optional `heading` is announced first. Owned source, copied in by
 * `lievit add alert`. Light-DOM rendered.
 */
@customElement("lv-alert")
export class LvAlert extends LitElement {
  /** Severity, drives both colour and the ARIA live role. */
  @property() variant: "info" | "success" | "warning" | "danger" = "info";

  /** Optional bold heading rendered above the message. */
  @property() heading = "";

  createRenderRoot(): this {
    adoptLightStyles("lv-alert", LvAlert.css);
    return this;
  }

  static readonly css = `
    .lv-alert {
      display: block;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      line-height: var(--lv-leading);
      padding: var(--lv-space-3) var(--lv-space-4);
      border-radius: var(--lv-radius-md);
      border: 1px solid transparent;
    }
    .lv-alert__heading { font-weight: 600; margin-bottom: var(--lv-space-1); }
    .lv-alert--info {
      background: color-mix(in srgb, var(--lv-color-info) 12%, var(--lv-color-bg));
      border-color: var(--lv-color-info);
      color: var(--lv-color-fg);
    }
    .lv-alert--success {
      background: color-mix(in srgb, var(--lv-color-success) 12%, var(--lv-color-bg));
      border-color: var(--lv-color-success);
      color: var(--lv-color-fg);
    }
    .lv-alert--warning {
      background: color-mix(in srgb, var(--lv-color-warning) 12%, var(--lv-color-bg));
      border-color: var(--lv-color-warning);
      color: var(--lv-color-fg);
    }
    .lv-alert--danger {
      background: color-mix(in srgb, var(--lv-color-danger) 12%, var(--lv-color-bg));
      border-color: var(--lv-color-danger);
      color: var(--lv-color-fg);
    }
  `;

  /** Urgent variants interrupt; informational ones are polite. */
  private ariaRole(): "alert" | "status" {
    return this.variant === "danger" || this.variant === "warning" ? "alert" : "status";
  }

  render() {
    return html`
      <div class="lv-alert lv-alert--${this.variant}" role=${this.ariaRole()}>
        ${this.heading
          ? html`<div class="lv-alert__heading">${this.heading}</div>`
          : null}
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-alert": LvAlert;
  }
}
