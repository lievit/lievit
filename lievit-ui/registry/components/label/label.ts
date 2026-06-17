/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-label>`: a token-styled form label.
 *
 * Renders a native `<label for=...>` so the browser's label/control association works (click
 * the label, focus the control; screen readers announce the control's name, WAI-ARIA
 * research 4.3). The `for` attribute names the controlled element's id. An optional required
 * marker is exposed to assistive tech via `aria-hidden` on the asterisk so it is not read as
 * literal punctuation. Owned source, copied in by `lievit add label`. Light-DOM rendered.
 */
@customElement("lv-label")
export class LvLabel extends LitElement {
  /** Id of the control this label names (native `for`/`id` association). */
  @property() for = "";

  /** Shows a required marker after the text. */
  @property({ type: Boolean }) required = false;

  createRenderRoot(): this {
    adoptLightStyles("lv-label", LvLabel.css);
    return this;
  }

  static readonly css = `
    .lv-label {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      line-height: var(--lv-leading);
      color: var(--lv-color-fg);
      font-weight: 500;
      display: inline-block;
    }
    .lv-label__required { color: var(--lv-color-danger); margin-left: var(--lv-space-1); }
  `;

  render() {
    return html`
      <label class="lv-label" for=${this.for}>
        <slot></slot>
        ${this.required
          ? html`<span class="lv-label__required" aria-hidden="true">*</span>`
          : null}
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-label": LvLabel;
  }
}
