/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-button>`: a token-styled button primitive.
 *
 * Renders a native `<button>`, which carries the button role, keyboard activation
 * (Enter/Space) and disabled semantics for free (WAI-ARIA APG button pattern, research 4.3),
 * so no manual ARIA is needed. Presentation only: in a lievit template the click drives a
 * wire action via `l:click`; the component never holds domain state.
 *
 * Owned source, copied in by `lievit add button`. Light-DOM rendered so adopter CSS and the
 * `--lv-*` tokens cascade in freely; edit at will.
 */
@customElement("lv-button")
export class LvButton extends LitElement {
  /** Visual emphasis. `primary` is the default call to action. */
  @property() variant: "primary" | "ghost" | "danger" = "primary";

  /** Disables the control: blocks activation and dims it. */
  @property({ type: Boolean }) disabled = false;

  /** Native button type. `submit` posts the enclosing form. */
  @property() type: "button" | "submit" | "reset" = "button";

  createRenderRoot(): this {
    adoptLightStyles("lv-button", LvButton.css);
    return this;
  }

  static readonly css = `
    lv-button { display: inline-block; }
    .lv-btn {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      line-height: var(--lv-leading);
      padding: var(--lv-space-2) var(--lv-space-4);
      border-radius: var(--lv-radius-md);
      border: 1px solid transparent;
      cursor: pointer;
    }
    .lv-btn:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-btn--primary { background: var(--lv-color-primary); color: var(--lv-color-primary-fg); }
    .lv-btn--ghost {
      background: transparent;
      color: var(--lv-color-fg);
      border-color: var(--lv-color-border);
    }
    .lv-btn--danger { background: var(--lv-color-danger); color: var(--lv-color-danger-fg); }
  `;

  render() {
    return html`
      <button
        class="lv-btn lv-btn--${this.variant}"
        type=${this.type}
        ?disabled=${this.disabled}
      >
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-button": LvButton;
  }
}
