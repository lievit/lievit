/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-field>`: a label + control + error wrapper (composition component).
 *
 * Groups a form label, the control (supplied via the default slot), and an optional
 * error message into a single accessible unit. When `error` is set:
 *   - an error message element is rendered with `id` = `<controlId>-error`
 *   - the component sets `aria-describedby` on the slotted control pointing at that
 *     element (so assistive tech reads the error after the control)
 *   - a live `aria-live="polite"` region announces the error as it appears
 *
 * The `for` prop wires the rendered `<label>` to the control by id; the adopter
 * sets `inputId` on `<lv-input>` (or the native control's id) to match.
 *
 * This is a composition component, not a standalone control. Owned source, copied
 * in by `lievit add field`. Light-DOM rendered.
 */
@customElement("lv-field")
export class LvField extends LitElement {
  /** Label text. */
  @property() label = "";

  /** Id of the controlled element for native label association. */
  @property() for = "";

  /** Shows a required marker on the label. */
  @property({ type: Boolean }) required = false;

  /** Validation error message. Empty string = no error. */
  @property() error = "";

  /** Hint text shown below the control (before error if both set). */
  @property() hint = "";

  createRenderRoot(): this {
    adoptLightStyles("lv-field", LvField.css);
    return this;
  }

  static readonly css = `
    .lv-field {
      display: flex;
      flex-direction: column;
      gap: var(--lv-space-1);
    }
    .lv-field__label {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      font-weight: 500;
      color: var(--lv-color-fg);
      display: inline-block;
    }
    .lv-field__required {
      color: var(--lv-color-danger);
      margin-left: var(--lv-space-1);
    }
    .lv-field__hint {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-muted);
    }
    .lv-field__error {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-danger);
    }
  `;

  render() {
    const errorId = this.for ? `${this.for}-error` : "";
    return html`
      <div class="lv-field">
        ${this.label
          ? html`
              <label class="lv-field__label" for=${this.for}>
                ${this.label}
                ${this.required
                  ? html`<span class="lv-field__required" aria-hidden="true">*</span>`
                  : null}
              </label>
            `
          : null}
        <slot></slot>
        ${this.hint && !this.error
          ? html`<span class="lv-field__hint">${this.hint}</span>`
          : null}
        ${this.error
          ? html`
              <span
                class="lv-field__error"
                id=${errorId}
                role="alert"
                aria-live="polite"
              >${this.error}</span>
            `
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-field": LvField;
  }
}
