/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-textarea>`: a token-styled multi-line text input.
 *
 * Same data-down/events-up contract as `<lv-input>`: value in via the property, bubbling
 * `lv-input` event out on change; the wire's `l:model` owns the binding. Sets `aria-invalid`
 * from the `invalid` flag (WAI-ARIA, research 4.3). Owned source, copied in by
 * `lievit add textarea`. Light-DOM rendered.
 */
@customElement("lv-textarea")
export class LvTextarea extends LitElement {
  /** Current text value (data down). */
  @property() value = "";

  /** Placeholder shown when empty. */
  @property() placeholder = "";

  /** Visible rows. */
  @property({ type: Number }) rows = 3;

  /** Marks the field invalid: red border plus `aria-invalid`. */
  @property({ type: Boolean }) invalid = false;

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  createRenderRoot(): this {
    adoptLightStyles("lv-textarea", LvTextarea.css);
    return this;
  }

  static readonly css = `
    .lv-textarea {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-base);
      line-height: var(--lv-leading);
      color: var(--lv-color-fg);
      background: var(--lv-color-bg);
      padding: var(--lv-space-2) var(--lv-space-3);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
    }
    .lv-textarea:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-textarea--invalid { border-color: var(--lv-color-danger); }
    .lv-textarea[disabled] { opacity: 0.5; cursor: not-allowed; }
  `;

  private onInput(e: Event) {
    const value = (e.target as HTMLTextAreaElement).value;
    this.value = value;
    this.dispatchEvent(
      new CustomEvent("lv-input", { detail: value, bubbles: true, composed: true })
    );
  }

  render() {
    return html`
      <textarea
        class="lv-textarea ${this.invalid ? "lv-textarea--invalid" : ""}"
        rows=${this.rows}
        placeholder=${this.placeholder}
        ?disabled=${this.disabled}
        aria-invalid=${this.invalid ? "true" : "false"}
        .value=${this.value}
        @input=${this.onInput}
      ></textarea>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-textarea": LvTextarea;
  }
}
