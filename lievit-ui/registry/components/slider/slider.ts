/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-slider>`: a single-thumb range slider.
 *
 * Renders a native `<input type="range">`, which carries `role="slider"`,
 * `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and full keyboard navigation
 * (Arrow keys, Home, End, PageUp/Down) for free (WAI-ARIA APG slider pattern,
 * research 4.3). No custom ARIA or JS key-handling is needed.
 *
 * The visual track and thumb are styled via CSS while the native semantics come
 * from the underlying input. An accessible `label` is exposed via `aria-label`
 * when no external `<label for=...>` is used.
 *
 * Form-associated (`static formAssociated`): submits its numeric `value` (as a string) under
 * `name` inside a plain `<form method=post>`, via ElementInternals (`setFormValue`) where
 * supported and a hidden `<input name>` mirror as the portable fallback (e.g. the happy-dom test
 * runtime), so `new FormData(form)` sees the field either way. `formResetCallback` returns it to
 * its initial value; `formDisabledCallback` follows a disabled fieldset. Data down, events up: on
 * drag it emits the back-compat `lv-change` CustomEvent AND a native bubbling `input` event, and a
 * native `change` on commit (pointer/key release), so the wire's `l:model` binds with zero config.
 *
 * Owned source, copied in by `lievit add slider`. Light-DOM rendered.
 */
@customElement("lv-slider")
export class LvSlider extends LitElement {
  /** Marks the element form-associated so it participates in form submission and reset. */
  static readonly formAssociated = true;

  /** Current value. */
  @property({ type: Number }) value = 0;

  /** Minimum value. */
  @property({ type: Number }) min = 0;

  /** Maximum value. */
  @property({ type: Number }) max = 100;

  /** Step increment. */
  @property({ type: Number }) step = 1;

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** Accessible label when no external `<label for=...>` is used. */
  @property() label = "";

  /** Form field name; the control submits its value under this name. */
  @property() name = "";

  /** Id forwarded to the native input for `<label for=...>` association. */
  @property() inputId = "";

  /** Show the current value alongside the slider. */
  @property({ type: Boolean }) showValue = false;

  /** ElementInternals where supported (real browsers); undefined in environments without it. */
  private readonly internals: ElementInternals | null = (() => {
    try {
      return (this as { attachInternals?: () => ElementInternals }).attachInternals?.() ?? null;
    } catch {
      return null;
    }
  })();

  /** The value the control resets to on form reset (captured at first connect). */
  private initialValue = 0;

  connectedCallback() {
    super.connectedCallback();
    this.initialValue = this.value;
    this.syncFormValue();
  }

  /** Reports the current value to the form (ElementInternals; the hidden mirror covers the rest). */
  private syncFormValue() {
    this.internals?.setFormValue(String(this.value));
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
    adoptLightStyles("lv-slider", LvSlider.css);
    return this;
  }

  static readonly css = `
    .lv-slider-wrap {
      display: flex;
      align-items: center;
      gap: var(--lv-space-3);
      font-family: var(--lv-font-sans);
    }
    .lv-slider {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 0.375rem;
      border-radius: var(--lv-radius-sm);
      background: var(--lv-color-border);
      cursor: pointer;
      outline: none;
    }
    .lv-slider:focus-visible { box-shadow: var(--lv-ring); }
    .lv-slider:disabled { opacity: 0.5; cursor: not-allowed; }
    /* Webkit thumb */
    .lv-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 1.125rem;
      height: 1.125rem;
      border-radius: 50%;
      background: var(--lv-color-primary);
      border: 2px solid var(--lv-color-bg);
      box-shadow: var(--lv-shadow-sm);
      cursor: pointer;
    }
    .lv-slider:disabled::-webkit-slider-thumb { background: var(--lv-color-muted); }
    /* Firefox thumb */
    .lv-slider::-moz-range-thumb {
      width: 1.125rem;
      height: 1.125rem;
      border-radius: 50%;
      background: var(--lv-color-primary);
      border: 2px solid var(--lv-color-bg);
      box-shadow: var(--lv-shadow-sm);
      cursor: pointer;
    }
    .lv-slider:disabled::-moz-range-thumb { background: var(--lv-color-muted); }
    .lv-slider__value {
      font-size: var(--lv-text-sm);
      color: var(--lv-color-muted);
      min-width: 2.5rem;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `;

  private onInput(e: Event) {
    const val = Number((e.target as HTMLInputElement).value);
    this.value = val;
    this.syncFormValue();
    // Back-compat CustomEvent plus a native `input` (fires on every drag step) so `l:model` binds.
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: val, bubbles: true, composed: true })
    );
    this.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private onChange(e: Event) {
    const val = Number((e.target as HTMLInputElement).value);
    this.value = val;
    this.syncFormValue();
    // A native `change` on commit (pointer/key release) for `l:model.lazy`/`.change` bindings.
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  render() {
    return html`
      <div class="lv-slider-wrap">
        <input
          class="lv-slider"
          type="range"
          id=${this.inputId || ""}
          .value=${String(this.value)}
          min=${this.min}
          max=${this.max}
          step=${this.step}
          ?disabled=${this.disabled}
          aria-label=${this.label || ""}
          aria-valuemin=${this.min}
          aria-valuemax=${this.max}
          aria-valuenow=${this.value}
          @input=${this.onInput}
          @change=${this.onChange}
        />
        ${this.showValue
          ? html`<span class="lv-slider__value" aria-live="polite">${this.value}</span>`
          : null}
        ${this.internals
          ? null
          : html`<input type="hidden" name=${this.name || ""} .value=${String(this.value)} />`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-slider": LvSlider;
  }
}
