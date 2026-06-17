/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-input>`: a token-styled single-line text input.
 *
 * Data down, events up: the value comes in via the `value` property and the component emits
 * a bubbling `lv-input` event with the new value on every keystroke; it never holds domain
 * state. The wire protocol's `l:model` owns the binding and the debounce ("state has one
 * owner: the server", docs/lievit-ui.md). Sets `aria-invalid` from the `invalid` flag so
 * assistive tech is told about validation state (WAI-ARIA, research 4.3).
 *
 * Owned source, copied in by `lievit add input`. Light-DOM rendered.
 */
@customElement("lv-input")
export class LvInput extends LitElement {
  /** Current text value (data down from the server / parent). */
  @property() value = "";

  /** Placeholder shown when empty. */
  @property() placeholder = "";

  /** Native input type (text, search, email, ...). */
  @property() type = "text";

  /** Marks the field invalid: red border plus `aria-invalid`. */
  @property({ type: Boolean }) invalid = false;

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  createRenderRoot(): this {
    adoptLightStyles("lv-input", LvInput.css);
    return this;
  }

  static readonly css = `
    .lv-input {
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
    }
    .lv-input:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-input--invalid { border-color: var(--lv-color-danger); }
    .lv-input[disabled] { opacity: 0.5; cursor: not-allowed; }
  `;

  private onInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.value = value;
    this.dispatchEvent(
      new CustomEvent("lv-input", { detail: value, bubbles: true, composed: true })
    );
  }

  render() {
    return html`
      <input
        class="lv-input ${this.invalid ? "lv-input--invalid" : ""}"
        type=${this.type}
        .value=${this.value}
        placeholder=${this.placeholder}
        ?disabled=${this.disabled}
        aria-invalid=${this.invalid ? "true" : "false"}
        @input=${this.onInput}
      />
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-input": LvInput;
  }
}
