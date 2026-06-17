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
 * Data down, events up: emits a bubbling `lv-change` event with the new numeric
 * value (as a number) when the value changes.
 *
 * Owned source, copied in by `lievit add slider`. Light-DOM rendered.
 */
@customElement("lv-slider")
export class LvSlider extends LitElement {
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

  /** Id forwarded to the native input for `<label for=...>` association. */
  @property() inputId = "";

  /** Show the current value alongside the slider. */
  @property({ type: Boolean }) showValue = false;

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

  private onChange(e: Event) {
    const val = Number((e.target as HTMLInputElement).value);
    this.value = val;
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: val, bubbles: true, composed: true })
    );
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
          @input=${this.onChange}
        />
        ${this.showValue
          ? html`<span class="lv-slider__value" aria-live="polite">${this.value}</span>`
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-slider": LvSlider;
  }
}
