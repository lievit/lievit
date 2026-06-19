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
 * is supplied.
 *
 * Form-associated (`static formAssociated`): submits under `name` inside a plain
 * `<form method=post>` exactly like a native checkbox: it contributes `value` (default
 * `"on"`) ONLY when checked, and is absent from `new FormData(form)` when unchecked. It
 * reports through ElementInternals (`setFormValue`) where supported and ALSO mirrors a
 * hidden `<input name>` (rendered only when checked) as the portable fallback for
 * environments without ElementInternals (e.g. the happy-dom test runtime), so FormData
 * sees the field either way. `formResetCallback` returns it to its initial checked state;
 * `formDisabledCallback` follows a disabled fieldset. Data down, events up: on change it
 * emits the back-compat `lv-change` CustomEvent AND a native bubbling `change` event so
 * the wire's `l:model` binds with zero config.
 *
 * Owned source, copied in by `lievit add checkbox`. Light-DOM rendered.
 */
@customElement("lv-checkbox")
export class LvCheckbox extends LitElement {
  /** Marks the element form-associated so it participates in form submission and reset. */
  static readonly formAssociated = true;

  /** Whether the checkbox is ticked. */
  @property({ type: Boolean }) checked = false;

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** Accessible label when no external <label for=...> is used. */
  @property() label = "";

  /** Form field name; the control submits its value under this name when checked. */
  @property() name = "";

  /** Submitted value when checked (native checkbox default is `"on"`). */
  @property() value = "on";

  /** Id forwarded to the native input for `<label for=...>` association. */
  @property() inputId = "";

  /** ElementInternals where supported (real browsers); undefined in environments without it. */
  private readonly internals: ElementInternals | null = (() => {
    try {
      return (this as { attachInternals?: () => ElementInternals }).attachInternals?.() ?? null;
    } catch {
      return null;
    }
  })();

  /** The checked state the control resets to on form reset (captured at first connect). */
  private initialChecked = false;

  connectedCallback() {
    super.connectedCallback();
    this.initialChecked = this.checked;
    this.syncFormValue();
  }

  /** Reports the current value to the form: `value` when checked, null when unchecked. */
  private syncFormValue() {
    this.internals?.setFormValue(this.checked ? (this.value || "on") : null);
  }

  /** Reset to the initial checked state (form-associated lifecycle). */
  formResetCallback() {
    this.checked = this.initialChecked;
    this.syncFormValue();
    this.requestUpdate();
  }

  /** Follow a disabled ancestor fieldset (form-associated lifecycle). */
  formDisabledCallback(disabled: boolean) {
    this.disabled = disabled;
  }

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
    this.syncFormValue();
    // Back-compat CustomEvent plus a native `change` so `l:model` (native event listener) binds.
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: checked, bubbles: true, composed: true })
    );
    this.dispatchEvent(new Event("change", { bubbles: true }));
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
        ${this.internals || !this.checked
          ? null
          : html`<input type="hidden" name=${this.name || ""} .value=${this.value || "on"} />`}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-checkbox": LvCheckbox;
  }
}
