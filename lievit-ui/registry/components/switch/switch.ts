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
 *
 * Form-associated (`static formAssociated`): submits under `name` inside a plain
 * `<form method=post>` like a native checkbox: it contributes `value` (default `"on"`)
 * ONLY when checked, and is absent from `new FormData(form)` when off. It reports through
 * ElementInternals (`setFormValue`) where supported and ALSO mirrors a hidden `<input name>`
 * (rendered only when checked) as the portable fallback for environments without
 * ElementInternals (e.g. the happy-dom test runtime), so FormData sees the field either way.
 * `formResetCallback` returns it to its initial state; `formDisabledCallback` follows a
 * disabled fieldset. Data down, events up: on toggle it emits the back-compat `lv-change`
 * CustomEvent AND a native bubbling `change` event so the wire's `l:model` binds with zero
 * config. Owned source, copied in by `lievit add switch`. Light-DOM rendered.
 */
@customElement("lv-switch")
export class LvSwitch extends LitElement {
  /** Marks the element form-associated so it participates in form submission and reset. */
  static readonly formAssociated = true;

  /** Whether the switch is on. */
  @property({ type: Boolean }) checked = false;

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** Accessible label for the switch. */
  @property() label = "";

  /** Form field name; the control submits its value under this name when on. */
  @property() name = "";

  /** Submitted value when on (defaults to `"on"`, like a native checkbox). */
  @property() value = "on";

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

  /** Reports the current value to the form: `value` when on, null when off. */
  private syncFormValue() {
    this.internals?.setFormValue(this.checked ? (this.value || "on") : null);
  }

  /** Reset to the initial state (form-associated lifecycle). */
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
    this.syncFormValue();
    // Back-compat CustomEvent plus a native `change` so `l:model` (native event listener) binds.
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: this.checked, bubbles: true, composed: true })
    );
    this.dispatchEvent(new Event("change", { bubbles: true }));
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
        ${this.internals || !this.checked
          ? null
          : html`<input type="hidden" name=${this.name || ""} .value=${this.value || "on"} />`}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-switch": LvSwitch;
  }
}
