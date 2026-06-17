/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-toast>`: a brief overlay notification.
 *
 * Implements the WAI-ARIA status / alert live-region pattern (research 4.3):
 * `info` and `success` use `role="status"` (polite); `warning` and `danger` use
 * `role="alert"` (assertive). The `open` property controls visibility; the
 * component auto-dismisses after `duration` ms (0 = no auto-dismiss). An optional
 * `dismiss` button emits a `lv-dismiss` event the parent can observe to set
 * `open=false`. Owned source, copied in by `lievit add toast`. Light-DOM rendered.
 */
@customElement("lv-toast")
export class LvToast extends LitElement {
  /** Whether the toast is visible. */
  @property({ type: Boolean }) open = false;

  /** Severity, drives colour and the ARIA live role. */
  @property() variant: "info" | "success" | "warning" | "danger" = "info";

  /** Optional bold heading. */
  @property() heading = "";

  /**
   * Auto-dismiss after this many milliseconds. 0 = stay until dismissed.
   * Resets on every change to `open`.
   */
  @property({ type: Number }) duration = 4000;

  /** Show a dismiss (×) button. */
  @property({ type: Boolean }) dismissible = false;

  private _timer: ReturnType<typeof setTimeout> | undefined;

  createRenderRoot(): this {
    adoptLightStyles("lv-toast", LvToast.css);
    return this;
  }

  static readonly css = `
    .lv-toast {
      display: none;
      position: fixed;
      bottom: var(--lv-space-4);
      right: var(--lv-space-4);
      min-width: 16rem;
      max-width: 24rem;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      padding: var(--lv-space-3) var(--lv-space-4);
      border-radius: var(--lv-radius-md);
      border: 1px solid transparent;
      box-shadow: var(--lv-shadow-md);
      z-index: 9000;
    }
    .lv-toast--open { display: flex; align-items: flex-start; gap: var(--lv-space-3); }
    .lv-toast__body { flex: 1; min-width: 0; }
    .lv-toast__heading { font-weight: 600; margin-bottom: var(--lv-space-1); }
    .lv-toast__dismiss {
      background: transparent;
      border: none;
      cursor: pointer;
      color: inherit;
      padding: 0;
      font-size: var(--lv-text-base);
      line-height: 1;
      opacity: 0.7;
      flex-shrink: 0;
    }
    .lv-toast__dismiss:hover { opacity: 1; }
    .lv-toast__dismiss:focus-visible { outline: none; box-shadow: var(--lv-ring); border-radius: var(--lv-radius-sm); }
    .lv-toast--info {
      background: color-mix(in srgb, var(--lv-color-info) 12%, var(--lv-color-bg));
      border-color: var(--lv-color-info);
      color: var(--lv-color-fg);
    }
    .lv-toast--success {
      background: color-mix(in srgb, var(--lv-color-success) 12%, var(--lv-color-bg));
      border-color: var(--lv-color-success);
      color: var(--lv-color-fg);
    }
    .lv-toast--warning {
      background: color-mix(in srgb, var(--lv-color-warning) 12%, var(--lv-color-bg));
      border-color: var(--lv-color-warning);
      color: var(--lv-color-fg);
    }
    .lv-toast--danger {
      background: color-mix(in srgb, var(--lv-color-danger) 12%, var(--lv-color-bg));
      border-color: var(--lv-color-danger);
      color: var(--lv-color-fg);
    }
  `;

  updated(changed: Map<string, unknown>) {
    if (changed.has("open")) {
      clearTimeout(this._timer);
      if (this.open && this.duration > 0) {
        this._timer = setTimeout(() => this.dismiss(), this.duration);
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._timer);
  }

  private dismiss() {
    this.open = false;
    this.dispatchEvent(new CustomEvent("lv-dismiss", { bubbles: true, composed: true }));
  }

  /** Assertive for urgent variants, polite otherwise. */
  private ariaRole(): "alert" | "status" {
    return this.variant === "danger" || this.variant === "warning" ? "alert" : "status";
  }

  render() {
    return html`
      <div
        class="lv-toast lv-toast--${this.variant} ${this.open ? "lv-toast--open" : ""}"
        role=${this.ariaRole()}
        aria-live=${this.ariaRole() === "alert" ? "assertive" : "polite"}
        aria-atomic="true"
      >
        <div class="lv-toast__body">
          ${this.heading
            ? html`<div class="lv-toast__heading">${this.heading}</div>`
            : null}
          <slot></slot>
        </div>
        ${this.dismissible
          ? html`
              <button
                class="lv-toast__dismiss"
                type="button"
                aria-label="Dismiss notification"
                @click=${this.dismiss}
              >×</button>
            `
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-toast": LvToast;
  }
}
