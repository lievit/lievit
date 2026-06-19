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
 * Form-associated (`static formAssociated`): submits its `value` under `name` inside a plain
 * `<form method=post>`, via ElementInternals (`setFormValue`) where supported and a hidden
 * `<input name>` mirror as the portable fallback (e.g. the happy-dom test runtime), so
 * `new FormData(form)` sees the field either way. `formResetCallback` returns it to its initial
 * value; `formDisabledCallback` follows a disabled fieldset. Data down, events up: value in via
 * the property; on change it emits the back-compat `lv-input` CustomEvent AND a native bubbling
 * `input` event (a native `change` on commit/blur) so the wire's `l:model` binds with zero config.
 * Sets `aria-invalid` from the `invalid` flag (WAI-ARIA, research 4.3). Owned source, copied in by
 * `lievit add textarea`. Light-DOM rendered.
 */
@customElement("lv-textarea")
export class LvTextarea extends LitElement {
  /** Marks the element form-associated so it participates in form submission and reset. */
  static readonly formAssociated = true;

  /** Current text value (data down). */
  @property() value = "";

  /** Form field name; the control submits its value under this name. */
  @property() name = "";

  /** Placeholder shown when empty. */
  @property() placeholder = "";

  /** Visible rows. */
  @property({ type: Number }) rows = 3;

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
    this.syncFormValue();
    // Back-compat CustomEvent plus a native `input` so `l:model` (which listens for native input) binds.
    this.dispatchEvent(
      new CustomEvent("lv-input", { detail: value, bubbles: true, composed: true })
    );
    this.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private onChange(e: Event) {
    const value = (e.target as HTMLTextAreaElement).value;
    this.value = value;
    this.syncFormValue();
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: value, bubbles: true, composed: true })
    );
    this.dispatchEvent(new Event("change", { bubbles: true }));
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
        @change=${this.onChange}
      ></textarea>
      ${this.internals
        ? null
        : html`<input type="hidden" name=${this.name || ""} .value=${this.value} />`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-textarea": LvTextarea;
  }
}
