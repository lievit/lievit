/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-switch>`: a toggle switch control.
 *
 * Implements the WAI-ARIA APG switch pattern (role="switch", research 4.3):
 * a button with `role="switch"` and `aria-checked` carries keyboard activation
 * (Enter/Space) and announces state changes to screen readers. The track and thumb
 * are purely visual; the ARIA attributes on the button element carry semantics.
 * Data down, events up: emits a bubbling `lv-change` event with the new `checked`
 * boolean. Owned source, copied in by `lievit add switch`. Light-DOM rendered.
 */
@customElement("lv-switch")
export class LvSwitch extends LitElement {
  /** Whether the switch is on. */
  @property({ type: Boolean }) checked = false;

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** Accessible label for the switch. */
  @property() label = "";

  createRenderRoot(): this {
    adoptLightStyles("lv-switch", LvSwitch.css);
    return this;
  }

  static readonly css = `
    .lv-switch-wrap {
      display: inline-flex;
      align-items: center;
      gap: var(--lv-space-2);
    }
    .lv-switch {
      position: relative;
      display: inline-flex;
      align-items: center;
      width: 2.5rem;
      height: 1.375rem;
      border-radius: 999px;
      background: var(--lv-color-border);
      border: none;
      cursor: pointer;
      padding: 0;
      transition: background 150ms ease;
    }
    .lv-switch[aria-checked="true"] { background: var(--lv-color-primary); }
    .lv-switch:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-switch[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-switch__thumb {
      position: absolute;
      left: 0.1875rem;
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
      background: var(--lv-color-bg);
      transition: transform 150ms ease;
      pointer-events: none;
    }
    .lv-switch[aria-checked="true"] .lv-switch__thumb {
      transform: translateX(1.125rem);
    }
    .lv-switch__label {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
    }
  `;

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      this.toggle();
    }
  }

  private onClick() {
    this.toggle();
  }

  private toggle() {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: this.checked, bubbles: true, composed: true })
    );
  }

  render() {
    return html`
      <span class="lv-switch-wrap">
        <button
          class="lv-switch"
          role="switch"
          aria-checked=${this.checked ? "true" : "false"}
          aria-label=${this.label || ""}
          ?disabled=${this.disabled}
          type="button"
          @click=${this.onClick}
          @keydown=${this.onKeyDown}
        >
          <span class="lv-switch__thumb"></span>
        </button>
        ${this.label
          ? html`<span class="lv-switch__label" aria-hidden="true">${this.label}</span>`
          : null}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-switch": LvSwitch;
  }
}
