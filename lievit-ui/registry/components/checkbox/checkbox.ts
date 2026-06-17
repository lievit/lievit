/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-checkbox>`: a token-styled checkbox control.
 *
 * Renders a native `<input type="checkbox">` which carries `role="checkbox"`,
 * keyboard activation (Space), and checked/disabled semantics for free
 * (WAI-ARIA APG checkbox pattern, research 4.3). An explicit `label` prop is
 * exposed to assistive tech via `aria-label` when no external `<label for=...>`
 * is supplied. Data down, events up: emits a bubbling `lv-change` event with the
 * new `checked` boolean when the value changes.
 *
 * Owned source, copied in by `lievit add checkbox`. Light-DOM rendered.
 */
@customElement("lv-checkbox")
export class LvCheckbox extends LitElement {
  /** Whether the checkbox is ticked. */
  @property({ type: Boolean }) checked = false;

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** Accessible label when no external <label for=...> is used. */
  @property() label = "";

  /** Id forwarded to the native input for `<label for=...>` association. */
  @property() inputId = "";

  createRenderRoot(): this {
    adoptLightStyles("lv-checkbox", LvCheckbox.css);
    return this;
  }

  static readonly css = `
    .lv-checkbox-wrap {
      display: inline-flex;
      align-items: center;
      gap: var(--lv-space-2);
      cursor: pointer;
    }
    .lv-checkbox-wrap[data-disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-checkbox {
      appearance: none;
      -webkit-appearance: none;
      width: 1rem;
      height: 1rem;
      border: 2px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      background: var(--lv-color-bg);
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
    }
    .lv-checkbox:checked {
      background: var(--lv-color-primary);
      border-color: var(--lv-color-primary);
    }
    .lv-checkbox:checked::after {
      content: "";
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 6l3 3 5-5' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
    }
    .lv-checkbox:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-checkbox[disabled] { cursor: not-allowed; }
    .lv-checkbox__label {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
    }
  `;

  private onChange(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    this.checked = checked;
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: checked, bubbles: true, composed: true })
    );
  }

  render() {
    return html`
      <span class="lv-checkbox-wrap" ?data-disabled=${this.disabled}>
        <input
          class="lv-checkbox"
          type="checkbox"
          id=${this.inputId || ""}
          .checked=${this.checked}
          ?disabled=${this.disabled}
          aria-label=${this.label || ""}
          @change=${this.onChange}
        />
        ${this.label
          ? html`<span class="lv-checkbox__label">${this.label}</span>`
          : null}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-checkbox": LvCheckbox;
  }
}
