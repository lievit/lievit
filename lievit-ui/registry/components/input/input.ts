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
 * Form-associated (`static formAssociated`): submits its `value` under `name` inside a plain
 * `<form method=post>`. It reports the value through ElementInternals (`setFormValue`) where the
 * platform supports it and ALSO mirrors it into a hidden `<input name>` (the portable fallback for
 * environments without ElementInternals, e.g. the happy-dom test runtime), so `new FormData(form)`
 * sees the field either way. `formResetCallback` returns it to its initial value; `formDisabledCallback`
 * follows a disabled fieldset. Data down, events up: the value comes in via the `value` property; on
 * every keystroke it emits the back-compat `lv-input` CustomEvent AND a native bubbling `input` event
 * (a native `change` on commit/blur) so the wire's `l:model` binds with zero config. It never holds
 * domain state ("state has one owner: the server", docs/lievit-ui.md). Sets `aria-invalid` from the
 * `invalid` flag so assistive tech is told about validation state (WAI-ARIA, research 4.3).
 *
 * Owned source, copied in by `lievit add input`. Light-DOM rendered.
 */
@customElement("lv-input")
export class LvInput extends LitElement {
  /** Marks the element form-associated so it participates in form submission and reset. */
  static readonly formAssociated = true;

  /** Current text value (data down from the server / parent). */
  @property() value = "";

  /** Form field name; the control submits its value under this name. */
  @property() name = "";

  /** Placeholder shown when empty. */
  @property() placeholder = "";

  /** Native input type (text, search, email, ...). */
  @property() type = "text";

  /** Marks the field invalid: red border plus `aria-invalid`. */
  @property({ type: Boolean }) invalid = false;

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** ElementInternals where supported (real browsers); undefined in environments without it. */
  private readonly internals: ElementInternals | null = (() => {
    try {
      return (this as { attachInternals?: () => ElementInternals }).attachInternals?.() ?? null;
    } catch {
      return null;
    }
  })();

  /** The value the control resets to on form reset (captured at first connect). */
  private initialValue = "";

  connectedCallback() {
    super.connectedCallback();
    this.initialValue = this.value;
    this.syncFormValue();
  }

  /** Reports the current value to the form (ElementInternals; the hidden mirror covers the rest). */
  private syncFormValue() {
    this.internals?.setFormValue(this.value);
  }

  /** Reset to the initial value (form-associated lifecycle). */
  formResetCallback() {
    this.value = this.initialValue;
    this.syncFormValue();
    this.requestUpdate();
  }

  /** Follow a disabled ancestor fieldset (form-associated lifecycle). */
  formDisabledCallback(disabled: boolean) {
    this.disabled = disabled;
  }

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
    this.syncFormValue();
    // Back-compat CustomEvent plus a native `input` so `l:model` (which listens for native input) binds.
    this.dispatchEvent(
      new CustomEvent("lv-input", { detail: value, bubbles: true, composed: true })
    );
    this.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private onChange(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.value = value;
    this.syncFormValue();
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: value, bubbles: true, composed: true })
    );
    this.dispatchEvent(new Event("change", { bubbles: true }));
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
        @change=${this.onChange}
      />
      ${this.internals
        ? null
        : html`<input type="hidden" name=${this.name || ""} .value=${this.value} />`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-input": LvInput;
  }
}
